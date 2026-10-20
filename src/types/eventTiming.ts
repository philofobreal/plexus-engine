/** Experimental localization of existing accepted events, not new target eligibility. */
export interface EventTimingObservation {
    eventIndex: number;
    originalTime: number;
    time: number;
    status: 'refined' | 'ambiguous' | 'no-candidate' | 'insufficient-support' | 'below-floor' | 'gradual-attack';
    sampleIndex: number | null;
    supportStartSample: number;
    supportEndSample: number;
    candidateCount: number;
}

export interface EventTimingAnalysis {
    algorithm: 'accepted-frame-band-timing-v1' | 'accepted-frame-band-timing-v2' | 'accepted-frame-band-timing-v2-dc1';
    policy: 'experimental-opt-in';
    sampleRate: number;
    sampleCount: number;
    hopSize: number;
    observations: EventTimingObservation[];
}

/** Drop the entire untrusted report on a bad clock, association, status or support. */
export function normalizeEventTiming(value: EventTimingAnalysis | undefined, duration: number,
    clock?: { sampleRate: number; sampleCount: number; hopSize: number },
    publishedEvents?: readonly { time: number }[]): EventTimingAnalysis | undefined {
    if (!value || !['accepted-frame-band-timing-v1', 'accepted-frame-band-timing-v2', 'accepted-frame-band-timing-v2-dc1'].includes(value.algorithm) || value.policy !== 'experimental-opt-in'
        || !Number.isSafeInteger(value.sampleRate) || value.sampleRate < 1000 || value.sampleRate > 384000
        || !Number.isSafeInteger(value.sampleCount) || value.sampleCount <= 0
        || !Number.isSafeInteger(value.hopSize) || value.hopSize < 4 || value.hopSize > 65536
        || !Number.isInteger(Math.log2(value.hopSize))
        || !clock || value.sampleRate !== clock.sampleRate || value.sampleCount !== clock.sampleCount
        || value.hopSize !== clock.hopSize || !Number.isFinite(duration)
        || Math.abs(duration - value.sampleCount / value.sampleRate) > 1e-9
        || !Array.isArray(value.observations)
        || (publishedEvents && value.observations.length !== publishedEvents.length)) return undefined;
    let priorTime = -1, priorOriginal = -1;
    for (const [index, o] of value.observations.entries()) {
        if (!o || o.eventIndex !== index || !Number.isFinite(o.originalTime) || o.originalTime <= priorOriginal
            || o.originalTime < 0 || o.originalTime >= duration || !Number.isFinite(o.time) || o.time <= priorTime
            || !Number.isSafeInteger(o.candidateCount) || o.candidateCount < 0
            || !Number.isSafeInteger(o.supportStartSample) || !Number.isSafeInteger(o.supportEndSample)
            || o.supportStartSample < 0 || o.supportEndSample > value.sampleCount
            || o.supportEndSample <= o.supportStartSample
            || (o.status === 'ambiguous' && o.candidateCount < 2)
            || (['no-candidate', 'insufficient-support', 'below-floor'].includes(o.status) && o.candidateCount !== 0)
            || !['refined', 'ambiguous', 'no-candidate', 'insufficient-support', 'below-floor', 'gradual-attack'].includes(o.status)
            || (o.status === 'gradual-attack' && (value.algorithm === 'accepted-frame-band-timing-v1' || o.candidateCount < 1))
            || (publishedEvents && publishedEvents[index]?.time !== o.time)) return undefined;
        const frameStart = Math.round(o.originalTime * value.sampleRate);
        if (Math.abs(frameStart / value.sampleRate - o.originalTime) > 1e-9 || frameStart % value.hopSize !== 0
            || frameStart < 0 || frameStart >= value.sampleCount
            || (o.status !== 'refined' && (o.supportStartSample > frameStart || o.supportEndSample <= frameStart))) return undefined;
        if (o.status === 'refined') {
            if (!Number.isSafeInteger(o.sampleIndex) || o.sampleIndex! < frameStart
                || o.sampleIndex! >= Math.min(value.sampleCount, frameStart + value.hopSize,
                    frameStart + Math.ceil(.03 * value.sampleRate))
                || o.sampleIndex! < o.supportStartSample || o.sampleIndex! >= o.supportEndSample
                || o.candidateCount < 1 || o.time !== o.sampleIndex! / value.sampleRate) return undefined;
        } else if (o.sampleIndex !== null || o.time !== o.originalTime) return undefined;
        priorTime = o.time; priorOriginal = o.originalTime;
    }
    return { algorithm: value.algorithm, policy: value.policy, sampleRate: value.sampleRate,
        sampleCount: value.sampleCount, hopSize: value.hopSize,
        observations: value.observations.map(o => ({ ...o })) };
}
