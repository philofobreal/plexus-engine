import type {
    DramaturgicalIntentPlan,
    IntentPoint,
    IntentType,
    MusicalNarrativePlan,
    NarrativeType
} from '../types';

// IntentGenerator — turns the musical narrative into a stream of dramaturgical
// intents (ADR-003). Pure, offline, deterministic: depends only on the narrative
// plan, no p5/DOM/runtime state. Run once per track (or on timeline edit).

const NARRATIVE_TO_INTENT: Record<NarrativeType, IntentType> = {
    intro: 'establish',
    groove: 'sustain',
    tension: 'anticipate',
    build: 'compress',
    'fake-drop': 'contrast',
    release: 'expand',
    peak: 'celebrate',
    breakdown: 'recover',
    outro: 'return'
};

export function generateIntents(narrative: MusicalNarrativePlan): DramaturgicalIntentPlan {
    const segments = narrative.segments ?? [];
    const points: IntentPoint[] = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const previous = segments[i - 1];
        const length = Math.max(0, segment.endTime - segment.startTime);
        const transitionDuration = clamp(length * 0.25, 0.5, 4.0);

        let intent = NARRATIVE_TO_INTENT[segment.type] ?? 'sustain';
        let weight = clamp01(segment.intensity);

        // Cathartic release: built tension resolving into a real climax. This is the
        // compress -> release pair, so the entering intent of the drop/peak is `release`,
        // not its steady-state `expand`/`celebrate`.
        if (previous
            && (previous.type === 'build' || previous.type === 'tension')
            && (segment.type === 'release' || segment.type === 'peak')) {
            intent = 'release';
            weight = clamp01(Math.max(previous.intensity, segment.intensity));
        }

        points.push({
            time: segment.startTime,
            intent,
            weight,
            duration: transitionDuration
        });
    }

    return { version: 1, points };
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
