import type { BeatEvent } from '../types';
import type { FeatureClock } from '../types/featureClock';
import { normalizeRhythmOnsets, type RhythmOnsetPool } from '../types/rhythmOnsets.ts';

export interface RhythmEventSourceInfo {
    readonly kind: 'legacy-visual' | 'grid-independent-percussive';
    readonly legacyEvents: number;
    readonly addedEvents: number;
    readonly fallbackReason?: 'classic-profile' | 'missing-or-invalid-pool';
}

/** Explicit source selection before attention/trace/movement; every index refers to this array.
 * Classic retains the original array. Unknown/unvalidated evidence never becomes a target.
 */
export function selectRhythmEvents(events: readonly BeatEvent[], duration: number, profile: string | undefined,
    pool?: RhythmOnsetPool, clock?: FeatureClock): { events: readonly BeatEvent[]; info: RhythmEventSourceInfo } {
    const selected = profile === 'musical-v1' ? normalizeRhythmOnsets(pool, duration, clock, events) : undefined;
    return selected ? { events: selected.events, info: { kind: 'grid-independent-percussive', legacyEvents: events.length,
        addedEvents: selected.events.length - events.length } }
        : { events, info: { kind: 'legacy-visual', legacyEvents: events.length, addedEvents: 0,
            fallbackReason: profile === 'musical-v1' ? 'missing-or-invalid-pool' : 'classic-profile' } };
}
