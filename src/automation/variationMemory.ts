import type { ChoreographyPlan, MovementGesture, VariationMemoryState } from '../types';

export interface VariationMemory {
    snapshot(): VariationMemoryState;
    record(plan: ChoreographyPlan): void;
}

const GESTURES: MovementGesture[] = [
    'pulse', 'drive', 'orbit', 'scatter', 'collapse', 'expand', 'bloom', 'fragment',
    'ripple', 'slice', 'tunnel', 'swarm', 'lock', 'echo', 'fade'
];
const HISTORY_LIMIT = 12;

// Per-generation memory. No module-level mutable state: every performance-plan build owns one
// isolated instance, and snapshots are defensive copies.
export function createVariationMemory(): VariationMemory {
    const state: VariationMemoryState = {
        recentTargets: [],
        recentGestures: [],
        recentSituations: [],
        familyUseCounts: {},
        gestureUseCounts: Object.fromEntries(GESTURES.map((gesture) => [gesture, 0])) as Record<MovementGesture, number>
    };

    return {
        snapshot: () => ({
            ...state,
            recentTargets: [...state.recentTargets],
            recentGestures: [...state.recentGestures],
            recentSituations: [...state.recentSituations],
            familyUseCounts: { ...state.familyUseCounts },
            gestureUseCounts: { ...state.gestureUseCounts }
        }),
        record: (plan) => {
            state.recentSituations.push(plan.situation);
            for (const segment of plan.segments) {
                state.recentTargets.push(segment.target);
                state.recentGestures.push(segment.movementGesture);
                state.familyUseCounts[segment.target] = (state.familyUseCounts[segment.target] ?? 0) + 1;
                state.gestureUseCounts[segment.movementGesture]++;
            }
            if (plan.situation === 'peak-sustain' && plan.segments.length > 0) state.lastPeakGesture = plan.segments.at(-1)?.movementGesture;
            if (plan.situation.startsWith('drop-')) state.lastDropVocabularyId = plan.vocabularyId;
            trim(state.recentTargets);
            trim(state.recentGestures);
            trim(state.recentSituations);
        }
    };
}

function trim<T>(values: T[]): void {
    if (values.length > HISTORY_LIMIT) values.splice(0, values.length - HISTORY_LIMIT);
}
