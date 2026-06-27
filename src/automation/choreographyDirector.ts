import type {
    BehaviourState,
    DramaturgicalIntentPlan,
    MicroEvent,
    MotifChoreographyAction,
    MotifChoreographyFrame,
    MotifPhrase,
    MusicalNarrativePlan,
    NarrativeType,
    ResolvedStylePack,
    SceneEvolution,
    SceneEvolutionStep,
    SceneIntent,
    SceneTransition,
    StyleCapabilityMatrix,
    TransitionPhrase,
    VisualChoreographyPlan,
    VisualMotif
} from '../types';
import { findIntentForTime } from '../semantics';
import { scoreMotifCandidates, type MotifCandidate, type VariationContext } from './variationEngine';

// ChoreographyDirector - Visual OS scene SELECTION (ADR-005). It CONSUMES the already
// generated ADR-003 semantic output (narrative, intent, choreography) and chooses, per
// scene, the best style-permitted realization using the (pure) VariationEngine plus a
// deterministic variation/history policy. It NEVER re-derives narrative, intent,
// sections, or motifs. Pure, offline, deterministic: no p5/DOM/runtime-state imports.

export interface SemanticBundle {
    narrative: MusicalNarrativePlan;
    intent: DramaturgicalIntentPlan;
    choreography: VisualChoreographyPlan;
}

// Hard anti-repetition policy. The VariationEngine only *scores* (soft history penalty);
// this policy is the explicit constraint that BANS A->A and too-fast A->B->A returns during
// selection, with graceful degradation when there are not enough alternatives.
export interface VariationPolicy {
    forbidImmediateRepeat: boolean; // ban A->A
    minRepeatGap: number;           // a motif used within the last N scenes is banned (A->B->A)
}

export interface DirectorOptions {
    substyle?: string;
    historyWindow?: number;          // how many recent scenes count toward the soft penalty (default 4)
    variationPolicy?: Partial<VariationPolicy>;
}

const DEFAULT_HISTORY_WINDOW = 4;
const DEFAULT_VARIATION_POLICY: VariationPolicy = { forbidImmediateRepeat: true, minRepeatGap: 2 };
const MICRO_EVENT_THRESHOLD = 0.6;
const MAX_MICRO_EVENTS_PER_SCENE = 8;

// Narrative-driven lifecycle envelopes (birth -> death). `levelMul` scales the scene's
// intensity, so the SAME scene intensity reads differently under different narratives:
// a build ramps late to a full peak, a breakdown stays low, an intro never spikes. This
// is what makes SceneEvolution load-bearing rather than a constant envelope.
const NARRATIVE_EVOLUTION: Record<NarrativeType, Array<{ phase: SceneEvolutionStep['phase']; at: number; levelMul: number }>> = {
    intro:     [{ phase: 'birth', at: 0, levelMul: 0.20 }, { phase: 'growth', at: 0.30, levelMul: 0.40 }, { phase: 'peak', at: 0.60, levelMul: 0.50 }, { phase: 'release', at: 0.80, levelMul: 0.35 }, { phase: 'death', at: 0.93, levelMul: 0.15 }],
    groove:    [{ phase: 'birth', at: 0, levelMul: 0.40 }, { phase: 'growth', at: 0.20, levelMul: 0.60 }, { phase: 'peak', at: 0.50, levelMul: 0.70 }, { phase: 'release', at: 0.80, levelMul: 0.60 }, { phase: 'death', at: 0.95, levelMul: 0.40 }],
    tension:   [{ phase: 'birth', at: 0, levelMul: 0.30 }, { phase: 'growth', at: 0.25, levelMul: 0.50 }, { phase: 'peak', at: 0.70, levelMul: 0.85 }, { phase: 'release', at: 0.88, levelMul: 0.60 }, { phase: 'death', at: 0.96, levelMul: 0.30 }],
    build:     [{ phase: 'birth', at: 0, levelMul: 0.25 }, { phase: 'growth', at: 0.30, levelMul: 0.55 }, { phase: 'peak', at: 0.80, levelMul: 1.00 }, { phase: 'release', at: 0.90, levelMul: 0.70 }, { phase: 'death', at: 0.97, levelMul: 0.40 }],
    'fake-drop': [{ phase: 'birth', at: 0, levelMul: 0.50 }, { phase: 'growth', at: 0.10, levelMul: 0.80 }, { phase: 'peak', at: 0.25, levelMul: 0.90 }, { phase: 'release', at: 0.40, levelMul: 0.40 }, { phase: 'death', at: 0.85, levelMul: 0.20 }],
    release:   [{ phase: 'birth', at: 0, levelMul: 0.70 }, { phase: 'growth', at: 0.08, levelMul: 0.95 }, { phase: 'peak', at: 0.20, levelMul: 1.00 }, { phase: 'release', at: 0.70, levelMul: 0.70 }, { phase: 'death', at: 0.93, levelMul: 0.35 }],
    peak:      [{ phase: 'birth', at: 0, levelMul: 0.80 }, { phase: 'growth', at: 0.05, levelMul: 0.95 }, { phase: 'peak', at: 0.20, levelMul: 1.00 }, { phase: 'release', at: 0.80, levelMul: 0.85 }, { phase: 'death', at: 0.95, levelMul: 0.50 }],
    breakdown: [{ phase: 'birth', at: 0, levelMul: 0.30 }, { phase: 'growth', at: 0.20, levelMul: 0.40 }, { phase: 'peak', at: 0.45, levelMul: 0.50 }, { phase: 'release', at: 0.70, levelMul: 0.30 }, { phase: 'death', at: 0.90, levelMul: 0.12 }],
    outro:     [{ phase: 'birth', at: 0, levelMul: 0.40 }, { phase: 'growth', at: 0.15, levelMul: 0.45 }, { phase: 'peak', at: 0.35, levelMul: 0.45 }, { phase: 'release', at: 0.60, levelMul: 0.30 }, { phase: 'death', at: 0.90, levelMul: 0.10 }]
};

export function directScenes(bundle: SemanticBundle, pack: ResolvedStylePack, options: DirectorOptions = {}): SceneIntent[] {
    const capability = selectCapability(pack, options.substyle);
    const window = Math.max(1, options.historyWindow ?? DEFAULT_HISTORY_WINDOW);
    const policy: VariationPolicy = { ...DEFAULT_VARIATION_POLICY, ...options.variationPolicy };
    const phrases = bundle.choreography.score?.motifs ?? [];
    const frames = bundle.choreography.frames ?? [];
    const transitions = bundle.choreography.score?.transitions ?? [];

    const scenes = (phrases.length > 0 ? phrasesToSceneInputs(phrases) : framesToSceneInputs(frames))
        // Drop degenerate scenes (e.g. a trailing frame with zero/negative duration in the
        // frame-fallback path) so the plan never carries meaningless points.
        .filter((scene) => Number.isFinite(scene.startTime) && scene.endTime - scene.startTime > 1e-6);

    const history: VisualMotif[] = [];
    const out: SceneIntent[] = [];

    for (const scene of scenes) {
        const narrative = narrativeAt(bundle.narrative, scene.startTime);
        const intentPoint = findIntentForTime(scene.startTime, bundle.intent.points ?? []);
        const intent = intentPoint?.intent ?? 'sustain';

        const ctx: VariationContext = {
            previousMotif: history.length > 0 ? history[history.length - 1] : null,
            recentUsage: usageOverWindow(history, window),
            recentWindow: window
        };
        const ranked = scoreMotifCandidates(
            { semanticMotif: scene.motif, intensity: scene.intensity, novelty: scene.novelty, variationSeed: scene.variationSeed },
            capability,
            ctx
        );
        const motif = selectNonRepeatingMotif(ranked, history, policy, scene.motif);
        history.push(motif);

        out.push({
            timeSec: scene.startTime,
            durationSec: Math.max(0, scene.endTime - scene.startTime),
            narrative,
            intent,
            motif,
            role: scene.role,
            behaviour: deriveBehaviour(scene),
            evolution: buildEvolution(narrative, scene.intensity),
            microEvents: collectMicroEvents(frames, scene.startTime, scene.endTime),
            novelty: clamp01(scene.novelty),
            variationSeed: scene.variationSeed,
            sourceFrameTime: scene.startTime,
            transition: incomingTransition(transitions, scene.id)
        });
    }

    return out;
}

// Hard anti-repetition selection. `ranked` is best-first from the VariationEngine.
// Tier 1 honours the full no-repeat window (bans A->A and A->B->A); Tier 2 relaxes to
// banning only the immediate repeat; Tier 3 is the last resort when alternatives run out.
function selectNonRepeatingMotif(
    ranked: MotifCandidate[],
    history: VisualMotif[],
    policy: VariationPolicy,
    fallback: VisualMotif | null
): VisualMotif {
    if (ranked.length === 0) return fallback ?? 'void-minimal';
    const previous = history.length > 0 ? history[history.length - 1] : null;
    const recent = new Set(history.slice(-Math.max(0, policy.minRepeatGap)));

    const tier1 = ranked.find((c) => !recent.has(c.motif) && !(policy.forbidImmediateRepeat && c.motif === previous));
    if (tier1) return tier1.motif;

    if (policy.forbidImmediateRepeat) {
        const tier2 = ranked.find((c) => c.motif !== previous);
        if (tier2) return tier2.motif;
    }
    return ranked[0].motif;
}

// -- Internal scene-input normalization --------------------------------------

interface SceneInput {
    id: string;
    startTime: number;
    endTime: number;
    motif: VisualMotif | null;
    role: MotifPhrase['role'];
    intensity: number;
    density: number;
    motion: number;
    novelty: number;
    variationSeed: number;
}

function phrasesToSceneInputs(phrases: MotifPhrase[]): SceneInput[] {
    return phrases.map((phrase) => ({
        id: phrase.id,
        startTime: phrase.startTime,
        endTime: phrase.endTime,
        motif: phrase.motif,
        role: phrase.role,
        intensity: clamp01(phrase.intensity),
        density: clamp01(phrase.density),
        motion: clamp01(phrase.motion),
        novelty: clamp01(phrase.novelty),
        variationSeed: phrase.variationSeed
    }));
}

// Fallback when no Visual Score is present: treat each choreography frame as a scene that
// runs until the next frame. Still consumes semantic output only -- no re-derivation. The
// trailing frame has no successor, so it inherits the previous gap (or a default) instead
// of a zero-length span; degenerate scenes are filtered out by directScenes regardless.
function framesToSceneInputs(frames: MotifChoreographyFrame[]): SceneInput[] {
    return frames.map((frame, index) => {
        const next = frames[index + 1];
        const previous = frames[index - 1];
        const tailDuration = previous ? Math.max(0.5, frame.time - previous.time) : 4;
        return {
            id: frame.motifId ?? `frame-${index}`,
            startTime: frame.time,
            endTime: next ? next.time : frame.time + tailDuration,
            motif: frame.motif ?? null,
            role: frame.motifRole ?? 'foundation',
            intensity: clamp01(frame.motifIntensity ?? 0.5),
            density: clamp01(frame.motifDensity ?? 0.5),
            motion: clamp01(frame.motifMotion ?? 0.5),
            novelty: clamp01(frame.novelty ?? 0),
            variationSeed: frame.variationSeed ?? index
        };
    });
}

function selectCapability(pack: ResolvedStylePack, substyle?: string): StyleCapabilityMatrix {
    if (substyle && pack.substyles[substyle]) return pack.substyles[substyle].capabilities;
    return pack.capabilities;
}

function narrativeAt(plan: MusicalNarrativePlan, time: number): NarrativeType {
    const segments = plan.segments ?? [];
    let active: NarrativeType = 'groove';
    let bestStart = -Infinity;
    for (const segment of segments) {
        if (segment.startTime <= time && time < segment.endTime) return segment.type;
        if (segment.startTime <= time && segment.startTime > bestStart) {
            bestStart = segment.startTime;
            active = segment.type;
        }
    }
    return active;
}

function deriveBehaviour(scene: SceneInput): BehaviourState {
    return {
        energy: scene.intensity,
        density: scene.density,
        motion: scene.motion,
        volatility: scene.novelty,
        cohesion: clamp01(1 - scene.novelty * 0.7)
    };
}

function buildEvolution(narrative: NarrativeType, intensity: number): SceneEvolution {
    const shape = NARRATIVE_EVOLUTION[narrative] ?? NARRATIVE_EVOLUTION.groove;
    const steps: SceneEvolutionStep[] = shape.map((step) => ({
        phase: step.phase,
        at: step.at,
        level: clamp01(step.levelMul * intensity)
    }));
    return { steps };
}

function collectMicroEvents(frames: MotifChoreographyFrame[], start: number, end: number): MicroEvent[] {
    const events: MicroEvent[] = [];
    for (const frame of frames) {
        if (frame.time < start || frame.time >= end) continue;
        const strongest = strongestAction(frame.actions);
        if (!strongest || strongest.strength < MICRO_EVENT_THRESHOLD) continue;
        events.push({
            timeSec: frame.time,
            action: strongest.action,
            strength: clamp01(strongest.strength),
            source: actionSource(strongest.action)
        });
    }
    // Keep the strongest accents if a dense scene produced many.
    if (events.length > MAX_MICRO_EVENTS_PER_SCENE) {
        events.sort((a, b) => b.strength - a.strength);
        events.length = MAX_MICRO_EVENTS_PER_SCENE;
        events.sort((a, b) => a.timeSec - b.timeSec);
    }
    return events;
}

function strongestAction(actions: Partial<Record<MotifChoreographyAction, number>>): { action: MotifChoreographyAction; strength: number } | null {
    let best: { action: MotifChoreographyAction; strength: number } | null = null;
    for (const key of Object.keys(actions) as MotifChoreographyAction[]) {
        const value = actions[key];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        if (!best || value > best.strength) best = { action: key, strength: value };
    }
    return best;
}

function actionSource(action: MotifChoreographyAction): MicroEvent['source'] {
    if (action === 'pulse' || action === 'bloom' || action === 'expand') return 'impact';
    if (action === 'fragment' || action === 'scatter' || action === 'collapse') return 'fx';
    if (action === 'echo') return 'echo';
    return 'accent';
}

function incomingTransition(transitions: TransitionPhrase[], sceneId: string): SceneTransition | undefined {
    const match = transitions.find((transition) => transition.toMotifId === sceneId);
    if (!match) return undefined;
    return {
        behavior: match.behavior,
        durationSec: match.duration,
        curve: match.curve,
        preserve: match.preserve
    };
}

function usageOverWindow(history: VisualMotif[], window: number): Partial<Record<VisualMotif, number>> {
    const usage: Partial<Record<VisualMotif, number>> = {};
    const start = Math.max(0, history.length - window);
    for (let i = start; i < history.length; i++) {
        const motif = history[i];
        usage[motif] = (usage[motif] ?? 0) + 1;
    }
    return usage;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value < 0 ? 0 : value > 1 ? 1 : value;
}
