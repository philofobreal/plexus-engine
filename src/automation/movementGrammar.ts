import type {
    AutomationSituation,
    BehaviourState,
    DramaturgyVariantMode,
    MovementGesture,
    NarrativeType,
    VariantRole
} from '../types';

// Pure movement-language resolver. It translates semantic and choreographic context into an
// abstract movement quality. Concrete targets remain outside this module.
export interface MovementGestureInput {
    situation: AutomationSituation;
    variantRole: VariantRole;
    behaviour: BehaviourState;
    narrative?: NarrativeType;
    variationMode: DramaturgyVariantMode;
    previousGesture?: MovementGesture;
    movementVocabulary?: readonly MovementGesture[];
    gestureUseCounts?: Partial<Record<MovementGesture, number>>;
}

const SITUATION_GESTURES: Record<AutomationSituation, readonly MovementGesture[]> = {
    'intro-establish':    ['pulse', 'bloom', 'orbit', 'fade'],
    'verse-long':         ['pulse', 'orbit', 'ripple', 'drive'],
    'groove-sustain':     ['drive', 'pulse', 'orbit', 'echo'],
    'buildup-ramp':       ['collapse', 'expand', 'tunnel', 'slice'],
    'drop-short':         ['drive', 'pulse', 'slice', 'lock'],
    'drop-long':          ['drive', 'slice', 'fragment', 'lock', 'tunnel', 'swarm'],
    'drop-after-build':   ['tunnel', 'drive', 'scatter', 'fragment', 'slice'],
    'breakdown-long':     ['fade', 'bloom', 'ripple', 'orbit', 'echo'],
    'peak-sustain':       ['drive', 'swarm', 'tunnel', 'echo', 'fragment'],
    'transition-release': ['fade', 'slice', 'collapse', 'ripple'],
    'outro-dissolve':     ['fade', 'echo', 'collapse', 'bloom']
};

const ROLE_GESTURES: Record<VariantRole, readonly MovementGesture[]> = {
    primary:   ['drive', 'pulse', 'expand', 'tunnel', 'swarm', 'bloom'],
    secondary: ['slice', 'scatter', 'ripple', 'orbit', 'fragment'],
    release:   ['fragment', 'fade', 'echo', 'bloom', 'ripple', 'collapse'],
    sparse:    ['collapse', 'fade', 'lock', 'orbit'],
    focus:     ['lock', 'orbit', 'tunnel', 'echo', 'pulse']
};

const NARRATIVE_GESTURES: Partial<Record<NarrativeType, readonly MovementGesture[]>> = {
    intro: ['bloom', 'pulse'],
    groove: ['drive', 'orbit'],
    tension: ['collapse', 'slice'],
    build: ['expand', 'tunnel'],
    'fake-drop': ['lock', 'collapse'],
    release: ['drive', 'fragment'],
    peak: ['swarm', 'tunnel'],
    breakdown: ['fade', 'ripple'],
    outro: ['echo', 'fade']
};

export function resolveMovementGesture(input: MovementGestureInput): MovementGesture {
    const authored = dedupe(input.movementVocabulary ?? []);
    const candidates = authored.length > 0 ? authored : (SITUATION_GESTURES[input.situation] ?? SITUATION_GESTURES['verse-long']);
    const roleOrder = ROLE_GESTURES[input.variantRole] ?? ROLE_GESTURES.primary;
    const narrativeOrder = input.narrative ? NARRATIVE_GESTURES[input.narrative] ?? [] : [];
    const energy = clamp01(input.behaviour.energy);
    const motion = clamp01(input.behaviour.motion);
    const volatility = clamp01(input.behaviour.volatility);
    const cohesion = clamp01(input.behaviour.cohesion);

    let best = candidates[0];
    let bestScore = -Infinity;
    for (let index = 0; index < candidates.length; index++) {
        const gesture = candidates[index];
        let score = (candidates.length - index) * 0.75;
        score += orderedAffinity(gesture, roleOrder, 4);
        score += orderedAffinity(gesture, narrativeOrder, 1.4);
        score += behaviourAffinity(gesture, energy, motion, volatility, cohesion);

        if (gesture === input.previousGesture) {
            // Stable choreography values continuity; richer modes use the previous gesture as a
            // soft repetition penalty so consecutive segments develop instead of duplicating.
            score += input.variationMode === 'stable' ? 1.5 : input.variationMode === 'paired' ? -4 : -7;
        }
        const useCount = input.gestureUseCounts?.[gesture] ?? 0;
        if (input.variationMode !== 'stable') score -= Math.min(3, useCount * 0.25);
        if (score > bestScore) {
            best = gesture;
            bestScore = score;
        }
    }
    return best;
}

function dedupe(values: readonly MovementGesture[]): MovementGesture[] {
    return [...new Set(values)];
}

function orderedAffinity(gesture: MovementGesture, order: readonly MovementGesture[], weight: number): number {
    const index = order.indexOf(gesture);
    return index < 0 ? 0 : weight * (1 - index / Math.max(1, order.length));
}

function behaviourAffinity(
    gesture: MovementGesture,
    energy: number,
    motion: number,
    volatility: number,
    cohesion: number
): number {
    if (gesture === 'drive' || gesture === 'tunnel' || gesture === 'swarm' || gesture === 'expand') return 2 * energy + motion;
    if (gesture === 'scatter' || gesture === 'fragment' || gesture === 'slice') return 2 * volatility + motion;
    if (gesture === 'lock' || gesture === 'collapse') return 1.5 * cohesion + (1 - motion);
    if (gesture === 'fade' || gesture === 'echo' || gesture === 'bloom') return 1.5 * (1 - energy) + cohesion;
    if (gesture === 'orbit' || gesture === 'ripple') return motion + cohesion;
    return energy + cohesion;
}

function clamp01(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
