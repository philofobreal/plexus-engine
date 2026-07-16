/**
 * Canonical-time LFO math for the wormhole radius/depth tuning path. Its phase is a pure function
 * of the render clock; the effective value is sampled by the existing grain release/sync geometry
 * path exactly where a manually morphed radius/depth control is sampled.
 */

const TWO_PI = Math.PI * 2;

export const WORMHOLE_DEPTH_LFO_PHASE_OFFSET = 0.5;
export const WORMHOLE_RANDOM_GLIDE_STEPS = 8;
export const MAX_WORMHOLE_LFO_AMOUNT = 0.9;

function wrap01(value: number): number {
    return ((value % 1) + 1) % 1;
}

function hash01(n: number): number {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
}

/** Eight hash values, centered and amplitude-normalized as a set so the interpolated curve stays
 *  within [-1,1] and reads as zero-mean, computed once at module load. */
const RANDOM_GLIDE_VALUES: ReadonlyArray<number> = Object.freeze((() => {
    const raw: number[] = [];
    for (let i = 0; i < WORMHOLE_RANDOM_GLIDE_STEPS; i++) raw.push(hash01(i));
    const mean = raw.reduce((sum, v) => sum + v, 0) / raw.length;
    const centered = raw.map(v => v - mean);
    const maxAbs = centered.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
    return maxAbs > 0 ? centered.map(v => v / maxAbs) : centered;
})());

function randomGlideValue(phase01: number): number {
    const scaled = phase01 * WORMHOLE_RANDOM_GLIDE_STEPS;
    const index0 = Math.floor(scaled) % WORMHOLE_RANDOM_GLIDE_STEPS;
    const index1 = (index0 + 1) % WORMHOLE_RANDOM_GLIDE_STEPS;
    const t = scaled - Math.floor(scaled);
    const smooth = t * t * (3 - 2 * t);
    return RANDOM_GLIDE_VALUES[index0] + (RANDOM_GLIDE_VALUES[index1] - RANDOM_GLIDE_VALUES[index0]) * smooth;
}

const PLUCK_MEAN = (1 - Math.exp(-5)) / 5;
const PLUCK_AMPLITUDE = 1 - PLUCK_MEAN;

/**
 * 0 Off, 1 Sine, 2 Saw, 3 Triangle, 4 Square, 5 Random Glide, 6 Pluck, 7 Organic. Returns a value in
 * [-1,1]; Off and any invalid/out-of-range waveform index return 0. `phase` wraps internally, and
 * NaN/Infinity are treated as phase 0 (defensive, matches the `finiteOr`-style handling used
 * elsewhere in this codebase).
 */
export function evaluateWormholeLfo(waveform: number, phase: number): number {
    const safePhase = Number.isFinite(phase) ? phase : 0;
    const phase01 = wrap01(safePhase);
    switch (waveform) {
        case 1: // Sine
            return Math.sin(TWO_PI * phase01);
        case 2: // Saw
            return 2 * phase01 - 1;
        case 3: // Triangle
            return 4 * Math.abs(phase01 - 0.5) - 1;
        case 4: // Square
            return phase01 < 0.5 ? 1 : -1;
        case 5: // Random Glide
            return randomGlideValue(phase01);
        case 6: { // Pluck
            const raw = Math.exp(-5 * phase01);
            return (raw - PLUCK_MEAN) / PLUCK_AMPLITUDE;
        }
        case 7: { // Organic
            const phi = TWO_PI * phase01;
            return (Math.sin(phi) + 0.5 * Math.sin(2 * phi + 1.7) + 0.25 * Math.sin(3 * phi + 0.4)) / 1.75;
        }
        default: // 0 Off, or any invalid/out-of-range index
            return 0;
    }
}

/**
 * A continuous phase from the renderer's canonical song/export time. `rateHz` is cycles per
 * second; optional phase offset is expressed in cycles. Invalid values resolve deterministically.
 */
export function wormholeGeometryLfoPhase(timeSec: number, rateHz: number, phaseOffset = 0): number {
    const safeTime = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
    const safeRate = Number.isFinite(rateHz) ? Math.max(0, rateHz) : 0;
    const safeOffset = Number.isFinite(phaseOffset) ? phaseOffset : 0;
    return wrap01(safeTime * safeRate + safeOffset);
}

export function wormholeGeometryLfoMultiplier(waveform: number, phase: number, amount: number): number {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.min(MAX_WORMHOLE_LFO_AMOUNT, amount)) : 0;
    return 1 + evaluateWormholeLfo(waveform, phase) * safeAmount;
}

/** Computes the effective authored parameter value sampled by the grain tuning path. */
export function effectiveWormholeGeometryValue(
    authoredValue: number,
    waveform: number,
    timeSec: number,
    rateHz: number,
    amount: number,
    phaseOffset = 0
): number {
    const authored = Number.isFinite(authoredValue) ? authoredValue : 1;
    const phase = wormholeGeometryLfoPhase(timeSec, rateHz, phaseOffset);
    return Math.max(0.1, authored * wormholeGeometryLfoMultiplier(waveform, phase, amount));
}
