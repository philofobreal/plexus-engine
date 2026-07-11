/** Deterministic emission envelope with no drawing state or per-frame allocation. */
export function wormholeEmissionGain(mode: number, seed: number, timeSec: number, rhythmicImpulse: number): number {
    const continuousMode = clamp(mode, 0, 2);
    const lowerMode = Math.floor(continuousMode);
    const upperMode = Math.ceil(continuousMode);
    const mix = continuousMode - lowerMode;
    const lowerGain = gainForMode(lowerMode, seed, timeSec, rhythmicImpulse);
    if (lowerMode === upperMode) return lowerGain;
    const upperGain = gainForMode(upperMode, seed, timeSec, rhythmicImpulse);
    return lowerGain + (upperGain - lowerGain) * mix;
}

function gainForMode(normalizedMode: number, seed: number, timeSec: number, rhythmicImpulse: number): number {
    if (normalizedMode === 0) return 1;

    const phase = timeSec * 9.6;
    const pulse = Math.max(clamp01(rhythmicImpulse), Math.pow(Math.max(0, Math.sin(phase)), 5));
    if (normalizedMode === 1) return 0.08 + pulse * 0.92;

    const burstIndex = Math.floor(timeSec * 5);
    return pseudoNoise(seed, burstIndex * 13.1) < 0.2 ? pulse : 0;
}

function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
