import type {
    DramaturgyActivityLevel,
    NarrativeType,
    PerformanceAutomationMeta,
    PerformanceAutomationPlan,
    PerformanceAutomationPoint,
    PerformanceAutomationReason,
    ResolvedStylePack,
    SceneEvolutionPhase,
    SceneTransitionCurve,
    StyleTargetReference,
    VisualScene,
    VisualScenePlan
} from '../types';

// scenePlanAdapter - the Renderer Adapter tier (ADR-005). It is the SINGLE place where a
// renderer-independent VisualScenePlan is mapped back to the existing, unchanged
// PerformanceAutomationPlan contract, and the ONLY place an opaque
// `targetStateReference` is resolved to a concrete preset (via the resolved pack's
// targetMap). It is pure and MUST NOT import or write `src/state/`; runtime state writes
// stay with the existing runtime/UI automation path that consumes the returned plan.

export interface SceneAdapterOptions {
    duration?: number;
    // Dramaturgy density level. Resolves to the spacing/cap pair below unless an explicit
    // override is supplied. Defaults to 'balanced' (identical to the historical defaults).
    activityLevel?: DramaturgyActivityLevel;
    // Density controls so SceneEvolution expansion never floods the timeline: a minimum gap
    // between waypoints and a hard cap per scene. Short scenes collapse toward a single anchor.
    // When omitted these are derived from activityLevel; when present they win.
    minWaypointSpacingSec?: number;
    maxWaypointsPerScene?: number;
}

// Activity level -> waypoint density. 'balanced' reproduces the historical defaults so the
// normal path is unchanged; 'macro' collapses scenes to a single anchor (section boundaries
// only); 'active' emits denser intra-scene evolution waypoints.
const ACTIVITY_DENSITY: Record<DramaturgyActivityLevel, { minSpacing: number; maxPerScene: number }> = {
    macro: { minSpacing: 8.0, maxPerScene: 1 },
    balanced: { minSpacing: 2.5, maxPerScene: 5 },
    active: { minSpacing: 1.2, maxPerScene: 8 }
};
const DEFAULT_ACTIVITY_LEVEL: DramaturgyActivityLevel = 'balanced';

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
    curve: PerformanceAutomationPoint['morphCurve'];
    meta: PerformanceAutomationMeta;
}

export function adaptScenePlanToPerformancePlan(
    plan: VisualScenePlan,
    pack: ResolvedStylePack,
    options: SceneAdapterOptions = {}
): PerformanceAutomationPlan {
    const duration = Number.isFinite(options.duration) && (options.duration as number) > 0 ? (options.duration as number) : Infinity;
    const density = ACTIVITY_DENSITY[options.activityLevel ?? DEFAULT_ACTIVITY_LEVEL] ?? ACTIVITY_DENSITY[DEFAULT_ACTIVITY_LEVEL];
    const minSpacing = options.minWaypointSpacingSec ?? density.minSpacing;
    const maxPerScene = Math.max(1, options.maxWaypointsPerScene ?? density.maxPerScene);
    const raw: RawPoint[] = [];

    plan.scenes.forEach((scene, index) => {
        const ref = resolveTargetReference(scene, pack);
        const reason = narrativeReason(scene.targetStateReference);
        const intensityScale = ref.intensityScale ?? 1;
        const sceneCurve = resolveMorphCurve(scene, ref);
        // Renderer-independent provenance shared by every waypoint of this scene. The per-step
        // evolution phase is added below. Never carries tuning keys (Renderer Independence).
        const sceneMeta: PerformanceAutomationMeta = {
            motif: scene.motif,
            palette: scene.vocabulary.palette,
            behaviour: scene.behaviour,
            stylePack: scene.stylePack,
            substyle: scene.substyle,
            targetStateReference: scene.targetStateReference,
            sceneId: `vos:${plan.stylePack}:${index}`
        };
        // Expand the SceneEvolution lifecycle (birth..death) into intensity waypoints so the
        // existing morph engine reproduces the envelope; the preset stays constant across a
        // scene (its style binding), while audio-sensitivity follows the lifecycle level.
        // Density is capped: the birth anchor is always kept, later phases only if they clear
        // the minimum spacing and the per-scene cap, so short scenes collapse to one point.
        const steps = scene.evolution?.steps?.length
            ? scene.evolution.steps
            : [{ phase: 'birth', at: 0, level: scene.behaviour.energy }];

        let lastKeptTime = -Infinity;
        let kept = 0;
        steps.forEach((step, phaseIndex) => {
            const time = clampTime(scene.timeSec + step.at * scene.durationSec, duration);
            const isBirth = phaseIndex === 0;
            if (!isBirth && (kept >= maxPerScene || time - lastKeptTime < minSpacing)) return;
            lastKeptTime = time;
            kept++;
            raw.push({
                sceneIndex: index,
                phase: step.phase,
                isBirth,
                time,
                preset: ref.preset,
                reason,
                intensity: clamp((0.5 + step.level * 1.5) * intensityScale, 0.3, 3.0),
                confidence: clamp01(0.4 + step.level * 0.5),
                // The birth point carries the cross-scene transition curve; intra-scene
                // waypoints ease smoothly.
                curve: isBirth ? sceneCurve : 'easeInOut',
                meta: { ...sceneMeta, evolutionPhase: step.phase as SceneEvolutionPhase }
            });
        });
    });

    return finalize(raw, plan.stylePack);
}

// Resolve the opaque handle. The key is the segment after ':' (the narrative); the lookup
// map is the substyle's merged targetMap when a substyle is active, else the pack's.
function resolveTargetReference(scene: VisualScene, pack: ResolvedStylePack): StyleTargetReference {
    const map = scene.substyle && pack.substyles[scene.substyle]
        ? pack.substyles[scene.substyle].targetMap
        : pack.targetMap;
    const key = scene.targetStateReference.split(':').pop() ?? '';
    // Resolution order: exact narrative key -> the pack's declared sparse/low-confidence
    // 'default' target -> the hard-coded last resort. The 'default' key lets every pack own
    // its own sparse fallback instead of silently dropping to default.json.
    return map[key] ?? pack.targetMap[key] ?? map.default ?? pack.targetMap.default ?? DEFAULT_TARGET;
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

function defaultMorphForReason(reason: PerformanceAutomationReason): number {
    if (reason === 'intro' || reason === 'outro') return 4.0;
    if (reason === 'drop' || reason === 'peak') return 1.0;
    if (reason === 'build' || reason === 'break') return 2.5;
    return 2.0;
}

// Sort waypoints, drop ones that collapse onto the previous (tiny scenes), and set each
// morph to ease toward the next waypoint so the lifecycle envelope plays out without
// overlapping the following point (mirrors the legacy generator's anti-overlap discipline).
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
        const gap = next ? next.time - point.time : defaultMorphForReason(point.reason);
        const morph = clamp(Math.max(0.1, gap - 0.01), 0.1, 20);
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
