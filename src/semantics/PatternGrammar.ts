import type { MotifChoreographyAction as ChoreographyAction, MotifChoreographyFrame as ChoreographyFrame, GrammarOperator, MotifPhrase } from '../types';

// Pure, deterministic operators for abstract actions and typed Visual Score
// phrases (ADR-003). `applyOperators` changes action topology for invert/mirror;
// repeat, alternate, grow, shrink, cascade, and call-response change scalar phrase
// samples in `sampleMotifGrammar`; echo additionally expands delayed action frames.

export type ActionMap = Partial<Record<ChoreographyAction, number>>;

export interface MotifGrammarSample {
    intensity: number;
    density: number;
    motion: number;
    phrasePosition: number;
    rhythmicPhase: number;
    activeOperators: GrammarOperator[];
}

// Opposite-motion pairing used by invert/mirror. Total over the action vocabulary so
// inversion is always defined; `echo` is its own opposite (inverting a ring-out is a ring-out).
export const ACTION_ANTONYMS: Record<ChoreographyAction, ChoreographyAction> = {
    expand: 'collapse',
    collapse: 'expand',
    bloom: 'freeze',
    freeze: 'bloom',
    accelerate: 'slow',
    slow: 'accelerate',
    densify: 'thin',
    thin: 'densify',
    focus: 'scatter',
    scatter: 'focus',
    merge: 'fragment',
    fragment: 'merge',
    orbit: 'pulse',
    pulse: 'orbit',
    echo: 'echo'
};

const MIN_ACTION_INTENSITY = 0.01;
const ECHO_COUNT = 2;
const ECHO_DECAY = 0.55;
const MIRROR_COUNTER_SCALE = 0.5;

// invert — replace each action with its antonym at the same intensity (opposite phase).
export function applyInvert(actions: ActionMap): ActionMap {
    const out: ActionMap = {};
    for (const [action, intensity] of actionEntries(actions)) {
        accumulate(out, ACTION_ANTONYMS[action], intensity);
    }
    return out;
}

// mirror — symmetry: keep each action and add a softened counter-motion (its antonym),
// so the gesture reads as balanced rather than one-directional.
export function applyMirror(actions: ActionMap): ActionMap {
    const out: ActionMap = {};
    for (const [action, intensity] of actionEntries(actions)) {
        accumulate(out, action, intensity);
        accumulate(out, ACTION_ANTONYMS[action], intensity * MIRROR_COUNTER_SCALE);
    }
    return out;
}

// echo — produce decaying follow-up frames after a primary frame. Each successive echo
// is scaled by ECHO_DECAY^k (strictly decreasing) and tags an explicit `echo` action so
// downstream resolvers can read the ring-out independently of the carried gesture.
export function applyEcho(primary: ChoreographyFrame, spacingSec: number): ChoreographyFrame[] {
    const gap = Math.max(0.25, Number.isFinite(spacingSec) ? spacingSec : 0.25);
    const echoes: ChoreographyFrame[] = [];
    for (let k = 1; k <= ECHO_COUNT; k++) {
        const scale = Math.pow(ECHO_DECAY, k);
        const actions: ActionMap = {};
        for (const [action, intensity] of actionEntries(primary.actions)) {
            accumulate(actions, action, intensity * scale);
        }
        accumulate(actions, 'echo', scale);
        if (Object.keys(actions).length === 0) continue;
        echoes.push({
            time: primary.time + gap * k,
            actions,
            activeOperators: ['echo'],
            motifId: primary.motifId,
            motif: primary.motif,
            motifRole: primary.motifRole,
            subdivision: primary.subdivision,
            motifIntensity: primary.motifIntensity,
            motifDensity: primary.motifDensity,
            motifMotion: primary.motifMotion,
            novelty: primary.novelty,
            phrasePosition: primary.phrasePosition,
            rhythmicPhase: primary.rhythmicPhase,
            variationSeed: primary.variationSeed
        });
    }
    return echoes;
}

export function applyOperators(actions: ActionMap, operators: GrammarOperator[]): ActionMap {
    let out = actions;
    // invert before mirror so a mirrored gesture is symmetric around the inverted phase.
    if (operators.includes('invert')) out = applyInvert(out);
    if (operators.includes('mirror')) out = applyMirror(out);
    return out;
}

// Sample the data-only score into deterministic phrase variation. Every declared
// operator changes at least one scalar field; the source MotifPhrase stays immutable.
export function sampleMotifGrammar(phrase: MotifPhrase, phrasePosition: number, sampleIndex: number): MotifGrammarSample {
    const position = clamp01(phrasePosition);
    let intensity = clamp01(phrase.intensity);
    let density = clamp01(phrase.density);
    let motion = clamp01(phrase.motion);
    let rhythmicPhase = ((sampleIndex + (phrase.variationSeed % 8) / 8) % 4) / 4;

    for (const operator of phrase.operators) {
        switch (operator) {
            case 'repeat': {
                intensity *= sampleIndex % 2 === 0 ? 1 : 0.82;
                rhythmicPhase = sampleIndex % 2 === 0 ? 0 : 0.5;
                break;
            }
            case 'alternate': {
                const primary = sampleIndex % 2 === 0;
                intensity *= primary ? 1 : 0.72;
                motion *= primary ? 0.82 : 1;
                rhythmicPhase = primary ? 0 : 0.5;
                break;
            }
            case 'grow': {
                const growth = 0.45 + 0.55 * position;
                intensity *= growth;
                density *= growth;
                motion *= 0.65 + 0.35 * position;
                break;
            }
            case 'shrink': {
                const decay = 1 - 0.65 * position;
                intensity *= decay;
                density *= decay;
                motion *= 1 - 0.45 * position;
                break;
            }
            case 'cascade': {
                const layer = Math.min(1, (sampleIndex + 1) / 4);
                density *= 0.45 + 0.55 * layer;
                motion *= 0.6 + 0.4 * layer;
                break;
            }
            case 'call-response': {
                const response = sampleIndex % 2 === 1;
                intensity *= response ? 0.68 : 1;
                density *= response ? 0.75 : 1;
                motion *= response ? 1 : 0.78;
                rhythmicPhase = response ? 0.5 : 0;
                break;
            }
        }
    }

    return {
        intensity: clamp01(intensity),
        density: clamp01(density),
        motion: clamp01(motion),
        phrasePosition: position,
        rhythmicPhase: clamp01(rhythmicPhase),
        activeOperators: [...phrase.operators]
    };
}

// Clamp + prune helper shared by all operators so frames never carry NaN or noise dust.
function accumulate(target: ActionMap, action: ChoreographyAction, intensity: number): void {
    const value = clamp01((target[action] ?? 0) + intensity);
    if (value < MIN_ACTION_INTENSITY) return;
    target[action] = value;
}

function actionEntries(actions: ActionMap): Array<[ChoreographyAction, number]> {
    return Object.entries(actions)
        .filter(([, intensity]) => typeof intensity === 'number' && intensity >= MIN_ACTION_INTENSITY)
        .map(([action, intensity]) => [action as ChoreographyAction, intensity as number]);
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
