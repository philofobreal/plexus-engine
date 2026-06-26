import type {
    ChoreographyAction,
    ChoreographyFrame,
    DramaturgicalIntentPlan,
    GrammarOperator,
    IntentType,
    VisualChoreographyPlan
} from '../types';
import { applyEcho, applyOperators, type ActionMap } from './PatternGrammar';

// ChoreographyEngine — turns dramaturgical intents into abstract, style-independent
// visual actions, then applies grammar operators (ADR-003). Pure, offline, deterministic:
// no p5/DOM/runtime state, no concrete tuning or style data. Run once per track.

// Base action vocabulary expressed by each intent, with relative intensities (0..1)
// that are later scaled by the intent's weight. Style translation happens downstream.
const INTENT_TO_ACTIONS: Record<IntentType, ActionMap> = {
    establish: { focus: 0.6, slow: 0.4 },
    anticipate: { densify: 0.7, accelerate: 0.5, orbit: 0.4 },
    compress: { collapse: 0.8, densify: 0.6, accelerate: 0.5 },
    expand: { expand: 0.9, scatter: 0.5 },
    release: { bloom: 1.0, scatter: 0.7, pulse: 0.8 },
    celebrate: { bloom: 0.9, pulse: 1.0, orbit: 0.6 },
    recover: { thin: 0.7, slow: 0.6, merge: 0.4 },
    contrast: { fragment: 0.8, freeze: 0.5 },
    return: { merge: 0.6, slow: 0.5, focus: 0.4 },
    sustain: { orbit: 0.5, pulse: 0.4 }
};

// Which grammar operators each intent activates. Kept deterministic and intent-driven so
// identical narratives always yield identical operator usage.
const INTENT_OPERATORS: Record<IntentType, GrammarOperator[]> = {
    establish: ['mirror'],
    anticipate: [],
    compress: [],
    expand: ['echo'],
    release: ['echo'],
    celebrate: ['echo'],
    recover: [],
    contrast: ['invert'],
    return: [],
    sustain: ['mirror']
};

export function processChoreography(intents: DramaturgicalIntentPlan): VisualChoreographyPlan {
    const points = intents.points ?? [];
    const frames: ChoreographyFrame[] = [];

    for (const point of points) {
        const operators = INTENT_OPERATORS[point.intent] ?? [];
        const base = scaleActions(INTENT_TO_ACTIONS[point.intent] ?? {}, point.weight);
        const actions = applyOperators(base, operators);

        const primary: ChoreographyFrame = {
            time: point.time,
            actions,
            activeOperators: operators.filter(op => op !== 'echo')
        };
        frames.push(primary);

        // echo rings the gesture out into decreasing-intensity follow-ups after the event.
        if (operators.includes('echo')) {
            for (const echo of applyEcho(primary, point.duration * 0.5)) frames.push(echo);
        }
    }

    frames.sort((a, b) => a.time - b.time);
    return { version: 1, frames };
}

function scaleActions(actions: ActionMap, weight: number): ActionMap {
    const w = clamp01(weight);
    const out: ActionMap = {};
    for (const [action, intensity] of Object.entries(actions)) {
        if (typeof intensity !== 'number') continue;
        const scaled = clamp01(intensity * w);
        if (scaled >= 0.01) out[action as ChoreographyAction] = scaled;
    }
    return out;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
