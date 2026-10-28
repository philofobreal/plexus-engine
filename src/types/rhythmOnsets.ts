import type { BeatEvent } from './index';
import type { FeatureClock } from './featureClock';

/** Existing percussive acceptance gates, before visual grid/proximity suppression.
 * Frame-window timestamps and engineering intensity, never drum/source identity or probability.
 */
export interface RhythmOnsetPool {
    algorithm: 'percussive-pool-v1';
    clock: FeatureClock;
    events: BeatEvent[];
}

/** A pool is usable only on the exact publication clock and with every legacy hit intact. */
export function normalizeRhythmOnsets(value: RhythmOnsetPool | undefined, duration: number,
    clock?: FeatureClock, legacy?: readonly BeatEvent[]): RhythmOnsetPool | undefined {
    const c = value?.clock;
    if (!value || value.algorithm !== 'percussive-pool-v1' || !c || !clock
        || !Number.isFinite(duration) || duration <= 0 || !Number.isSafeInteger(c.sampleRate) || c.sampleRate < 1000 || c.sampleRate > 384000
        || !Number.isSafeInteger(c.sampleCount) || c.sampleCount <= 0 || Math.abs(c.sampleCount / c.sampleRate - duration) > 1e-9
        || !Number.isSafeInteger(c.hopSize) || c.hopSize < 4 || c.hopSize > 65536 || !Number.isInteger(Math.log2(c.hopSize))
        || c.windowSize !== c.hopSize || c.originSample !== 0 || c.timestamp !== 'window-start' || c.tailPolicy !== 'zero-pad'
        || (['sampleRate', 'sampleCount', 'hopSize', 'windowSize', 'originSample', 'timestamp', 'tailPolicy'] as const).some(k => c[k] !== clock[k])
        || !Array.isArray(value.events) || value.events.length > Math.ceil(c.sampleCount / c.hopSize)) return undefined;
    let previous = -1, previousFrame = -1;
    const byTime = new Map<number, BeatEvent>();
    for (const event of value.events) {
        const frame = Math.round(event?.time * c.sampleRate / c.hopSize);
        if (!event || !Number.isFinite(event.time) || event.time <= previous || event.time < 0 || event.time >= duration || frame <= previousFrame
            || !Number.isFinite(event.intensity) || event.intensity < .05 || event.intensity > 1 || ![1, 2, 3].includes(event.type)
            || Math.abs(event.time * c.sampleRate / c.hopSize - Math.round(event.time * c.sampleRate / c.hopSize)) > 1e-7) return undefined;
        previous = event.time; previousFrame = frame; byTime.set(event.time, event);
    }
    if (legacy && legacy.some(event => {
        const matched = byTime.get(event.time);
        return !matched || matched.type !== event.type || matched.intensity !== event.intensity;
    })) return undefined;
    return { algorithm: value.algorithm, clock: { ...c }, events: value.events.map(e => ({ time: e.time, intensity: e.intensity, type: e.type })) };
}
