import type { ChoreographyAction, ChoreographyFrame, GrammarOperator } from '../types';

// PatternGrammar — pure, deterministic operators that transform abstract choreography
// action sets (ADR-003). No p5/DOM/runtime state. Three operators are implemented:
//   mirror  — symmetry: each action gains a softened counter-motion (its antonym).
//   invert  — opposite phase: each action is replaced by its antonym.
//   echo    — delayed decay: a climactic frame rings out into decreasing follow-ups.
//
// FUTURE / NO-OP: the remaining `GrammarOperator` members — repeat, alternate, grow, shrink,
// cascade, call-response — are reserved in the type for forward compatibility but are not yet
// implemented here. The ChoreographyEngine never activates them, so they have no runtime effect
// today; add a handler here before wiring any of them into INTENT_OPERATORS.

export type ActionMap = Partial<Record<ChoreographyAction, number>>;

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
            activeOperators: ['echo']
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
