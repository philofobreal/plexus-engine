import type {
    AutomationSituation,
    DramaturgyActivityLevel,
    DramaturgyVariantMode,
    GlobalVisualNarrative,
    NarrativeType,
    MovementGesture,
    PerformanceAutomationMeta,
    PerformanceAutomationPlan,
    PerformanceAutomationPoint,
    PerformanceAutomationReason,
    ResolvedStylePack,
    SceneEvolution,
    SceneEvolutionPhase,
    SceneTransitionCurve,
    StyleTargetReference,
    StyleVariantPairDefinition,
    StyleVariantPairMap,
    StyleVocabularyMap,
    TempoContext,
    VariantRole,
    VisualScene,
    VisualScenePlan
} from '../types';
import { classifyAutomationSituation } from './automationSituationClassifier';
import { planMicroChoreography, variationProfileFor } from './microChoreographyPlanner';
import { createVariationMemory } from './variationMemory';
import { planLongScene } from './longScenePlanner';
import { planGlobalVisualNarrative } from './globalVisualNarrative';

// scenePlanAdapter - the Renderer Adapter tier (ADR-005). It is the SINGLE place where a
// renderer-independent VisualScenePlan is mapped back to the existing, unchanged
// PerformanceAutomationPlan contract, and the ONLY place an opaque target handle is resolved to a
// concrete preset (via the resolved pack's targetMap). For each scene it resolves a behaviour
// VOCABULARY (opaque handles) from the pack, asks the Micro-Choreography planner for a set of
// timed, enveloped segments, then turns each segment's AutomationEnvelope into one (or two)
// PerformanceAutomationPoints. It is pure and MUST NOT import or write `src/state/`.

export interface SceneAdapterOptions {
    duration?: number;
    // Dramaturgy density level. Resolves to the spacing/cap pair below unless an explicit
    // override is supplied. Defaults to 'balanced' (identical to the historical defaults).
    activityLevel?: DramaturgyActivityLevel;
    // Hard cap on segments (= attack waypoints) per scene. When omitted it is derived from
    // activityLevel; when present it wins. The planner's MIN_SEGMENT_SEC governs the floor.
    maxWaypointsPerScene?: number;
    // Accepted for back-compat (callers/tests may still pass it). Spacing is now governed by the
    // planner's adaptive, bar-snapped subdivision, so this value is advisory and unused.
    minWaypointSpacingSec?: number;
    // Variant density mode. Selects the choreography VARIATION profile (vocabulary size, cycle
    // complexity, lifetimes). 'stable' keeps a single behaviour family per scene; 'paired'
    // (default) and 'expressive' add richer cycles. Orthogonal to activityLevel, which caps the
    // overall waypoint count.
    variantMode?: DramaturgyVariantMode;
    // Musical timing context (bars/bpm/confidence) so the planner can bar-snap subdivision and
    // envelope phases. Computed once per track by visualOsPlanner. Absent => equal-time fallback.
    tempo?: TempoContext;
    // Deterministic per-track seed for the planner's seeded jitter (no runtime randomness).
    // Computed once per track by visualOsPlanner; defaults to 0 for direct adapter callers.
    trackSeed?: number;
    globalNarrative?: GlobalVisualNarrative;
}

// Activity level -> segment density. Two levers so Activity is a real density control, not just a
// ceiling: `densityScale` multiplies the planner's target segment length (<1 = shorter segments =
// denser), and `maxPerScene` is the hard cap. 'macro' collapses scenes to a single anchor and
// suppresses release points; 'balanced' is the neutral default; 'active' both shortens segments
// and raises the cap so a long scene actually fills with beats.
const ACTIVITY_DENSITY: Record<DramaturgyActivityLevel, { maxPerScene: number; densityScale: number }> = {
    macro: { maxPerScene: 1, densityScale: 1.8 },
    balanced: { maxPerScene: 5, densityScale: 1.0 },
    active: { maxPerScene: 8, densityScale: 0.5 }
};
const DEFAULT_ACTIVITY_LEVEL: DramaturgyActivityLevel = 'balanced';
const DEFAULT_VARIANT_MODE: DramaturgyVariantMode = 'paired';

// A release phase only earns its own (softer) waypoint when it is at least this long, so trivial
// decays do not litter the timeline.
const MIN_RELEASE_POINT_SEC = 0.8;

// Neutral tempo used when the caller supplies none (direct adapter tests): no grid, equal-time
// subdivision, no bar snapping.
const NEUTRAL_TEMPO: TempoContext = { bpm: 0, secondsPerBar: null, gridOffset: 0, bars: [], reliable: false, confidence: 0 };

const NARRATIVE_TO_REASON: Record<NarrativeType, PerformanceAutomationReason> = {
    intro: 'intro',
    groove: 'verse',
    tension: 'build',
    build: 'build',
    'fake-drop': 'break',
    release: 'drop',
    peak: 'peak',
    breakdown: 'break',
    outro: 'outro'
};

const DEFAULT_TARGET: StyleTargetReference = { preset: 'default.json' };

interface RawPoint {
    sceneIndex: number;
    phase: string;
    isBirth: boolean;
    time: number;
    preset: string;
    reason: PerformanceAutomationReason;
    intensity: number;
    confidence: number;
    // Morph length straight from the segment envelope (attack for the birth/attack point, release
    // for a decay point). finalize only shortens it on overlap; it NEVER stretches to the next point.
    morph: number;
    curve: PerformanceAutomationPoint['morphCurve'];
    meta: PerformanceAutomationMeta;
}

// Behaviour vocabulary resolved for one scene: an ordered list of OPAQUE handles plus a
// provenance id. Renderer-independent (no preset filenames).
interface ResolvedVocabulary {
    handles: string[];
    id: string;
}

export function adaptScenePlanToPerformancePlan(
    plan: VisualScenePlan,
    pack: ResolvedStylePack,
    options: SceneAdapterOptions = {}
): PerformanceAutomationPlan {
    const duration = Number.isFinite(options.duration) && (options.duration as number) > 0 ? (options.duration as number) : Infinity;
    const activityLevel = options.activityLevel ?? DEFAULT_ACTIVITY_LEVEL;
    const density = ACTIVITY_DENSITY[activityLevel] ?? ACTIVITY_DENSITY[DEFAULT_ACTIVITY_LEVEL];
    const maxPerScene = Math.max(1, options.maxWaypointsPerScene ?? density.maxPerScene);
    const densityScale = density.densityScale;
    const variation = variationProfileFor(options.variantMode ?? DEFAULT_VARIANT_MODE);
    const tempo = options.tempo ?? NEUTRAL_TEMPO;
    const trackSeed = Number.isFinite(options.trackSeed) ? (options.trackSeed as number) : 0;
    const allowReleasePoints = activityLevel !== 'macro';
    const raw: RawPoint[] = [];
    const memory = createVariationMemory();
    const globalNarrative = options.globalNarrative ?? planGlobalVisualNarrative(plan);

    // Cross-scene state: the previous scene's narrative (so the classifier can recognize "a drop
    // right after a build") and the vocabulary ids already used (cross-scene rotation).
    let previousNarrative: NarrativeType | null = null;
    const recentVocabularyIds: string[] = [];

    plan.scenes.forEach((scene, index) => {
        const ref = resolveTargetReference(scene, pack);
        const reason = narrativeReason(scene.targetStateReference);
        const narrative = narrativeKeyOf(scene.targetStateReference);
        const sceneCurve = resolveMorphCurve(scene, ref);
        const effectivePackId = scene.substyle ? `${scene.stylePack}#${scene.substyle}` : scene.stylePack;
        const narrativeBias = globalNarrative.sceneBiases.find((bias) => bias.sceneIndex === index);

        // Classify the choreographic situation from already-generated context (never raw audio).
        const situation = classifyAutomationSituation({
            narrative,
            energy: scene.behaviour.energy,
            durationSec: scene.durationSec,
            previousNarrative
        });
        previousNarrative = narrative;

        // Renderer-independent provenance shared by every waypoint of this scene. The per-step
        // evolution phase + choreography role are added below. Never carries tuning keys.
        const sceneMeta: PerformanceAutomationMeta = {
            motif: scene.motif,
            palette: scene.vocabulary.palette,
            behaviour: scene.behaviour,
            stylePack: scene.stylePack,
            substyle: scene.substyle,
            targetStateReference: scene.targetStateReference,
            sceneId: `vos:${plan.stylePack}:${index}`,
            automationSituation: situation,
            globalArcRole: narrativeBias?.roleInTrack
        };

        // Resolve the behaviour vocabulary (opaque handles) and ask the planner for the scene's
        // timed, enveloped segments. The planner ALWAYS returns >=1 segment.
        const vocab = resolveBehaviourVocabulary(situation, narrative, scene.substyle, pack, recentVocabularyIds);
        const memoryState = memory.snapshot();
        const gestureBias = [...(narrativeBias?.gestureBias ?? [])];
        if (situation === 'outro-dissolve' && memoryState.lastPeakGesture) gestureBias.unshift('echo', memoryState.lastPeakGesture);
        const movementVocabulary = biasMovementVocabulary(
            resolveMovementVocabulary(situation, scene.substyle, pack),
            gestureBias
        );
        const longSceneSections = planLongScene(situation, scene.durationSec);
        recentVocabularyIds.push(vocab.id);

        const choreo = planMicroChoreography(
            { situation, startSec: scene.timeSec, durationSec: scene.durationSec, behaviour: scene.behaviour, narrative, vocabulary: vocab.handles, vocabularyId: vocab.id, movementVocabulary },
            { variation, activityCap: maxPerScene, activityDensityScale: densityScale, tempo, memory: memoryState, longSceneSections },
            { trackSeed, sceneIndex: index }
        );
        memory.record(choreo);

        let emittedScenePoints = 0;
        choreo.segments.forEach((seg) => {
            const segRef = resolveTargetKey(seg.target, scene.substyle, pack);
            const env = seg.envelope;

            // Attack waypoint: the segment is born here; morph length = the envelope attack.
            const attackFrac = scene.durationSec > 0 ? seg.offsetSec / scene.durationSec : 0;
            const attackLevel = evolutionLevelAt(scene.evolution, attackFrac);
            const attackPhase = evolutionPhaseAt(scene.evolution, attackFrac);
            const isBirth = seg.index === 0;
            raw.push({
                sceneIndex: index,
                phase: attackPhase,
                isBirth,
                time: clampTime(scene.timeSec + seg.offsetSec, duration),
                preset: segRef.preset,
                reason,
                intensity: clamp((0.5 + attackLevel * seg.intensityScale * 1.5) * (segRef.intensityScale ?? 1), 0.3, 3.0),
                confidence: clamp01(0.4 + attackLevel * 0.5),
                morph: clamp(env.attackSec, 0.1, 20),
                // The first subsegment carries the cross-scene transition curve; later ones use the
                // target's declared curve (or a smooth default).
                curve: isBirth ? sceneCurve : (segRef.morphCurve ?? 'easeInOut'),
                meta: choreoMeta(sceneMeta, attackPhase, vocab.id, seg.role, seg.movementGesture, seg.longScenePhase, effectivePackId, seg.target)
            });
            emittedScenePoints++;

            // Optional release waypoint: only a real 'release' role with a long-enough decay earns
            // its own softer point (so build/groove segments do not double up). The preset stays
            // the same family; only intensity relaxes.
            const remainingAttacks = choreo.segments.length - seg.index - 1;
            if (allowReleasePoints && emittedScenePoints + remainingAttacks < maxPerScene && seg.role === 'release' && env.releaseSec >= MIN_RELEASE_POINT_SEC) {
                const relOffset = seg.offsetSec + env.attackSec + env.sustainSec;
                const relFrac = scene.durationSec > 0 ? relOffset / scene.durationSec : 0;
                const relLevel = evolutionLevelAt(scene.evolution, relFrac);
                const relPhase = evolutionPhaseAt(scene.evolution, relFrac);
                raw.push({
                    sceneIndex: index,
                    phase: relPhase,
                    isBirth: false,
                    time: clampTime(scene.timeSec + relOffset, duration),
                    preset: segRef.preset,
                    reason,
                    intensity: clamp((0.5 + relLevel * seg.intensityScale * 1.5) * (segRef.intensityScale ?? 1) * 0.7, 0.3, 3.0),
                    confidence: clamp01(0.35 + relLevel * 0.4),
                    morph: clamp(env.releaseSec, 0.1, 20),
                    curve: 'easeInOut',
                    meta: choreoMeta(sceneMeta, relPhase, vocab.id, 'release', seg.movementGesture, seg.longScenePhase, effectivePackId, seg.target)
                });
                emittedScenePoints++;
            }
        });
    });

    return finalize(raw, plan.stylePack);
}

function dedupeGestures(values: MovementGesture[]): MovementGesture[] {
    return [...new Set(values)];
}

function biasMovementVocabulary(authored: MovementGesture[], bias: MovementGesture[]): MovementGesture[] {
    if (authored.length === 0) return dedupeGestures(bias);
    const allowed = new Set(authored);
    return dedupeGestures([...bias.filter((gesture) => allowed.has(gesture)), ...authored]);
}

function resolveMovementVocabulary(situation: AutomationSituation, substyle: string | undefined, pack: ResolvedStylePack): MovementGesture[] {
    const map = substyle && pack.substyles[substyle] ? pack.substyles[substyle].movementVocabulary : pack.movementVocabulary;
    return [...(map[situation] ?? [])];
}

// Per-waypoint provenance: the shared scene meta plus the evolution phase and the choreography
// role/target/vocabulary. The targetStateReference is the OPAQUE handle (never a preset file).
function choreoMeta(
    sceneMeta: PerformanceAutomationMeta,
    phase: SceneEvolutionPhase,
    vocabularyId: string,
    role: VariantRole,
    movementGesture: MovementGesture,
    longScenePhase: PerformanceAutomationMeta['longScenePhase'],
    effectivePackId: string,
    target: string
): PerformanceAutomationMeta {
    return {
        ...sceneMeta,
        evolutionPhase: phase,
        vocabularyId,
        variantRole: role,
        movementGesture,
        longScenePhase,
        targetStateReference: `${effectivePackId}:${target}`
    };
}

// Resolve the behaviour vocabulary for a scene's situation. Order: authored behaviourVocabulary
// (opaque handle list) -> the situation's variantPairs (flattened to primary/secondary/release,
// chosen with cross-scene rotation) -> the scene's own narrative handle (so a pack with neither
// still gets a single-family plan). The substyle's merged maps win when a substyle is active.
function resolveBehaviourVocabulary(
    situation: AutomationSituation,
    narrative: NarrativeType,
    substyle: string | undefined,
    pack: ResolvedStylePack,
    recentVocabularyIds: string[]
): ResolvedVocabulary {
    const vocabMap: StyleVocabularyMap = substyle && pack.substyles[substyle] ? pack.substyles[substyle].behaviourVocabulary : pack.behaviourVocabulary;
    const authored = (vocabMap[situation] ?? []).filter((h) => typeof h === 'string' && h.length > 0);
    if (authored.length > 0) return { handles: authored, id: `vocab:${situation}` };

    const pairMap: StyleVariantPairMap = substyle && pack.substyles[substyle] ? pack.substyles[substyle].variantPairs : pack.variantPairs;
    const pair = selectVariantPair(pairMap[situation], recentVocabularyIds);
    if (pair) {
        const handles = [pair.primary, pair.secondary, pair.release].filter((h): h is string => typeof h === 'string' && h.length > 0);
        if (handles.length > 0) return { handles, id: pair.id };
    }
    return { handles: [narrative], id: `narrative:${narrative}` };
}

// Deterministic vocabulary selection across a situation's authored variant pairs: pick the
// candidate used least often in recent history, ties broken by declaration order (so a single
// candidate is stable and multiple candidates rotate to avoid back-to-back repeats).
function selectVariantPair(defs: StyleVariantPairDefinition[] | undefined, recentVocabularyIds: string[]): StyleVariantPairDefinition | null {
    const candidates = (defs ?? []).filter(isValidPairDefinition);
    if (candidates.length === 0) return null;
    const usage = new Map<string, number>();
    for (const id of recentVocabularyIds) usage.set(id, (usage.get(id) ?? 0) + 1);
    let best = candidates[0];
    let bestUsage = usage.get(best.id) ?? 0;
    for (let i = 1; i < candidates.length; i++) {
        const u = usage.get(candidates[i].id) ?? 0;
        if (u < bestUsage) { best = candidates[i]; bestUsage = u; }
    }
    return best;
}

function isValidPairDefinition(def: unknown): def is StyleVariantPairDefinition {
    if (!def || typeof def !== 'object') return false;
    const d = def as Partial<StyleVariantPairDefinition>;
    return typeof d.id === 'string' && d.id.length > 0
        && typeof d.primary === 'string' && d.primary.length > 0
        && typeof d.secondary === 'string' && d.secondary.length > 0;
}

// Resolve the opaque scene handle. The key is the segment after ':' (the narrative).
function resolveTargetReference(scene: VisualScene, pack: ResolvedStylePack): StyleTargetReference {
    return resolveTargetKey(narrativeKeyOf(scene.targetStateReference), scene.substyle, pack);
}

// Resolve ANY opaque target key (a narrative like 'peak' OR a vocabulary handle like 'drop.primary')
// to a concrete StyleTargetReference. The lookup map is the substyle's merged targetMap when a
// substyle is active, else the pack's. Resolution order: exact key -> the pack's same key -> the
// substyle's sparse 'default' -> the pack's sparse 'default' -> the hard-coded last resort. A
// missing/typo handle therefore degrades to the pack default instead of crashing.
function resolveTargetKey(key: string, substyle: string | undefined, pack: ResolvedStylePack): StyleTargetReference {
    const map = substyle && pack.substyles[substyle] ? pack.substyles[substyle].targetMap : pack.targetMap;
    return map[key] ?? pack.targetMap[key] ?? map.default ?? pack.targetMap.default ?? DEFAULT_TARGET;
}

function narrativeKeyOf(handle: string): NarrativeType {
    return (handle.split(':').pop() ?? 'groove') as NarrativeType;
}

// Interpolated, normalized lifecycle level at a fractional position within a scene. Lets a
// choreography segment inherit the narrative-shaped birth..death envelope at its own time.
function evolutionLevelAt(evolution: SceneEvolution | undefined, frac: number): number {
    const steps = evolution?.steps ?? [];
    if (steps.length === 0) return 0.6;
    if (frac <= steps[0].at) return steps[0].level;
    for (let i = 0; i < steps.length - 1; i++) {
        const a = steps[i];
        const b = steps[i + 1];
        if (frac >= a.at && frac <= b.at) {
            const span = b.at - a.at;
            const t = span > 1e-6 ? (frac - a.at) / span : 0;
            return a.level + (b.level - a.level) * t;
        }
    }
    return steps[steps.length - 1].level;
}

function evolutionPhaseAt(evolution: SceneEvolution | undefined, frac: number): SceneEvolutionPhase {
    const steps = evolution?.steps ?? [];
    let phase: SceneEvolutionPhase = 'birth';
    for (const step of steps) {
        if (step.at <= frac) phase = step.phase;
    }
    return phase;
}

function narrativeReason(handle: string): PerformanceAutomationReason {
    const key = handle.split(':').pop() ?? '';
    return NARRATIVE_TO_REASON[key as NarrativeType] ?? 'manual';
}

function resolveMorphCurve(scene: VisualScene, ref: StyleTargetReference): PerformanceAutomationPoint['morphCurve'] {
    if (ref.morphCurve) return ref.morphCurve;
    if (scene.transition) return mapCurve(scene.transition.curve);
    return 'easeInOut';
}

function mapCurve(curve: SceneTransitionCurve): PerformanceAutomationPoint['morphCurve'] {
    if (curve === 'snap') return 'linear';
    return curve;
}

// Sort waypoints, drop ones that collapse onto the previous (tiny scenes), and emit each point
// with its envelope-derived morph. The morph is only SHORTENED when it would overrun the next
// point (anti-overlap); it is NEVER stretched to fill the gap, so the trailing cooldown survives
// as visible "air" on the timeline (the breathing the legacy stretch erased).
function finalize(raw: RawPoint[], stylePack: string): PerformanceAutomationPlan {
    raw.sort((a, b) => a.time - b.time);
    const merged: RawPoint[] = [];
    for (const point of raw) {
        const last = merged[merged.length - 1];
        if (last && point.time - last.time < 0.05) {
            if (point.intensity > last.intensity) merged[merged.length - 1] = point;
            continue;
        }
        merged.push(point);
    }

    const points: PerformanceAutomationPoint[] = merged.map((point, index) => {
        const next = merged[index + 1];
        // Anti-overlap clamp ONLY: never let a morph run past the next point; never stretch it.
        const limit = next ? Math.max(0.1, next.time - point.time - 0.01) : point.morph;
        const morph = clamp(Math.min(point.morph, limit), 0.1, 20);
        return {
            id: `vos-${point.sceneIndex}-${point.phase}-${formatTimeForId(point.time)}`,
            time: point.time,
            sectionId: `vos:${stylePack}:${point.sceneIndex}`,
            preset: point.preset,
            confidence: point.confidence,
            intensity: point.intensity,
            reason: point.reason,
            morphDurationSec: morph,
            morphCurve: morph < 0.2 ? 'linear' : point.curve,
            meta: point.meta
        };
    });
    return { version: 1, source: 'auto', points };
}

function formatTimeForId(time: number): string { return time.toFixed(3).replace('.', '-'); }
function clampTime(time: number, duration: number): number { return Math.max(0, Math.min(time, duration)); }
function clamp01(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
