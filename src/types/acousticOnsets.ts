/** Optional acoustic evidence. No field is a probability, instrument class or accepted target. */
export interface AcousticOnsetCandidate {
    time: number;
    sampleIndex: number;
    strength: number;
    powerRatio: number;
    spectralFlatness: number;
    supportStartSample: number;
    supportEndSample: number;
    endpointAmbiguous: boolean;
}

export interface AcousticOnsetAnalysis {
    algorithm: 'overlap-energy-rise-v1';
    sampleRate: number;
    sampleCount: number;
    windowSize: number;
    hopSize: number;
    timestamp: 'refined-sample';
    localization: 'maximum-positive-sample-power-step';
    selection: 'candidate-only';
    candidates: AcousticOnsetCandidate[];
}

export interface AcousticOnsetOptions {
    windowSize?: number;
    hopSize?: number;
}

/** Invalid evidence is unavailable; legacy payloads need no invented candidate stream. */
export function normalizeAcousticOnsets(value: AcousticOnsetAnalysis | undefined, duration: number,
    clock?: {sampleRate: number; sampleCount: number}): AcousticOnsetAnalysis | undefined {
    if (!value || value.algorithm !== 'overlap-energy-rise-v1' || value.timestamp !== 'refined-sample'
        || value.localization !== 'maximum-positive-sample-power-step' || value.selection !== 'candidate-only'
        || !Number.isSafeInteger(value.sampleRate) || value.sampleRate < 1000 || value.sampleRate > 384000
        || !Number.isSafeInteger(value.sampleCount) || value.sampleCount <= 0
        || !Number.isSafeInteger(value.windowSize) || value.windowSize < 4 || value.windowSize > 65536
        || !Number.isInteger(Math.log2(value.windowSize)) || !Number.isSafeInteger(value.hopSize)
        || value.hopSize < 4 || !Number.isInteger(Math.log2(value.hopSize))
        || (value.windowSize !== 2 * value.hopSize && value.windowSize !== 4 * value.hopSize)
        || !Number.isFinite(duration) || Math.abs(value.sampleCount / value.sampleRate - duration) > 1e-9
        || !Array.isArray(value.candidates)
        || (clock && (clock.sampleRate !== value.sampleRate || clock.sampleCount !== value.sampleCount))) return undefined;
    let previous = -1;
    const energySamples = Math.max(1, Math.round(value.sampleRate * 0.030));
    for (const c of value.candidates) {
        if (!c || typeof c !== 'object') return undefined;
        if (!Number.isSafeInteger(c.sampleIndex) || c.sampleIndex <= previous || c.sampleIndex >= value.sampleCount
            || !Number.isFinite(c.time) || Math.abs(c.time - c.sampleIndex / value.sampleRate) > 1e-9
            || !Number.isFinite(c.strength) || c.strength <= 0 || !Number.isFinite(c.powerRatio) || c.powerRatio < 2
            || !Number.isFinite(c.spectralFlatness) || c.spectralFlatness < 0 || c.spectralFlatness > 1
            || !Number.isSafeInteger(c.supportStartSample) || c.supportStartSample < 0 || c.supportStartSample > c.sampleIndex
            || !Number.isSafeInteger(c.supportEndSample) || c.supportEndSample <= c.sampleIndex || c.supportEndSample > value.sampleCount
            || c.supportEndSample - c.supportStartSample > value.windowSize
            || typeof c.endpointAmbiguous !== 'boolean'
            || c.endpointAmbiguous !== (c.sampleIndex < energySamples || value.sampleCount - c.sampleIndex < energySamples)) return undefined;
        previous = c.sampleIndex;
    }
    return { algorithm: value.algorithm, sampleRate: value.sampleRate, sampleCount: value.sampleCount,
        windowSize: value.windowSize, hopSize: value.hopSize, timestamp: value.timestamp,
        localization: value.localization, selection: value.selection,
        candidates: value.candidates.map(c => ({ time: c.time, sampleIndex: c.sampleIndex, strength: c.strength,
            powerRatio: c.powerRatio, spectralFlatness: c.spectralFlatness, supportStartSample: c.supportStartSample,
            supportEndSample: c.supportEndSample, endpointAmbiguous: c.endpointAmbiguous })) };
}
