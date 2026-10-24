import type { BeatEvent } from './index';
import type { FeatureClock } from './featureClock';

/** A traceable projection of accepted visual hits, never a new acoustic detector. */
export interface TimedMusicEvent {
    id: string; // Stable within this analysis, not a cross-file source identity.
    acceptedEventIndex: number;
    sampleIndex: number;
    time: number;
    supportSamples: [number, number]; // Half-open observed feature window, clipped to real PCM.
    uncertaintySamples: [number, number]; // Engineering window bounds, not a confidence interval.
    phase: 'accepted-attack';
    family: 'transient'; // Type 3 can be an FX transient; do not claim instrument identity.
    strength: number; // Original engineering intensity, not probability.
    legacyType: BeatEvent['type'];
}

export interface MusicEventLayer {
    algorithm: 'accepted-visual-events-v1';
    source: 'accepted-visual';
    idScope: 'this-analysis';
    clock: FeatureClock;
    confidence: null;
    capabilities: { acousticOnset: 'unverified'; tonal: 'unsupported'; vocal: 'unsupported'; dominance: 'unknown' };
    events: TimedMusicEvent[];
}

/** No inference from melody/vocal scores, pitch changes, extrapolated beats or missing hits. */
export function projectAcceptedMusicEvents(events: readonly BeatEvent[], clock: FeatureClock): MusicEventLayer {
    if (!Number.isSafeInteger(clock.sampleRate) || clock.sampleRate < 1000 || clock.sampleRate > 384000
        || !Number.isSafeInteger(clock.sampleCount) || clock.sampleCount <= 0
        || !Number.isSafeInteger(clock.hopSize) || clock.hopSize < 4 || clock.hopSize > 65536
        || !Number.isInteger(Math.log2(clock.hopSize)) || clock.windowSize !== clock.hopSize
        || clock.originSample !== 0 || clock.timestamp !== 'window-start' || clock.tailPolicy !== 'zero-pad')
        throw new Error('Invalid music event clock');
    let previousTime = -1;
    const projected = events.map((event, index): TimedMusicEvent => {
        const sampleIndex = Math.round(event.time * clock.sampleRate);
        if (!Number.isFinite(event.time) || event.time <= previousTime || event.time < 0
            || event.time >= clock.sampleCount / clock.sampleRate || sampleIndex >= clock.sampleCount
            || Math.abs(event.time - sampleIndex / clock.sampleRate) > 1e-9
            || !Number.isFinite(event.intensity) || event.intensity < 0 || ![1, 2, 3].includes(event.type))
            throw new Error('Invalid accepted music event');
        previousTime = event.time;
        const start = Math.floor(sampleIndex / clock.hopSize) * clock.hopSize;
        const end = Math.min(clock.sampleCount, start + clock.windowSize);
        return { id: `accepted:${index}:${sampleIndex}`, acceptedEventIndex: index, sampleIndex, time: event.time,
            supportSamples: [start, end], uncertaintySamples: [start, end], phase: 'accepted-attack',
            family: 'transient', strength: event.intensity, legacyType: event.type };
    });
    return { algorithm: 'accepted-visual-events-v1', source: 'accepted-visual', idScope: 'this-analysis',
        clock: { ...clock }, confidence: null,
        capabilities: { acousticOnset: 'unverified', tonal: 'unsupported', vocal: 'unsupported', dominance: 'unknown' },
        events: projected };
}

/** Validate the entire sidecar and its association; malformed/unsupported layers fail closed. */
export function normalizeMusicEvents(value: MusicEventLayer | undefined, clock: FeatureClock | undefined,
    accepted?: readonly BeatEvent[]): MusicEventLayer | undefined {
    if (!value || !clock || value.algorithm !== 'accepted-visual-events-v1' || value.source !== 'accepted-visual'
        || value.idScope !== 'this-analysis' || value.confidence !== null || !Array.isArray(value.events)
        || !value.clock || Object.keys(clock).some(key => value.clock[key as keyof FeatureClock] !== clock[key as keyof FeatureClock])
        || value.capabilities?.acousticOnset !== 'unverified' || value.capabilities?.tonal !== 'unsupported'
        || value.capabilities?.vocal !== 'unsupported' || value.capabilities?.dominance !== 'unknown') return undefined;
    try {
        const result = projectAcceptedMusicEvents(accepted ?? value.events.map(e => ({ time: e.time, intensity: e.strength, type: e.legacyType })), clock);
        if (result.events.length !== value.events.length) return undefined;
        for (let i = 0; i < result.events.length; i++) {
            const a = result.events[i], b = value.events[i];
            if (!b || a.id !== b.id || a.acceptedEventIndex !== b.acceptedEventIndex || a.sampleIndex !== b.sampleIndex
                || a.time !== b.time || a.strength !== b.strength || a.legacyType !== b.legacyType
                || b.phase !== a.phase || b.family !== a.family
                || b.supportSamples?.length !== 2 || b.uncertaintySamples?.length !== 2
                || b.supportSamples[0] !== a.supportSamples[0] || b.supportSamples[1] !== a.supportSamples[1]
                || b.uncertaintySamples[0] !== a.uncertaintySamples[0] || b.uncertaintySamples[1] !== a.uncertaintySamples[1]) return undefined;
        }
        return result;
    } catch { return undefined; }
}
