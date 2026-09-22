// Deterministic tempo estimation from an onset-strength envelope.
//
// Industry-standard approach (cf. Ellis 2007, "Beat Tracking by Dynamic Programming"):
//   1. Short-time autocorrelation of the positive spectral-flux envelope (12 s / 6 s hop).
//   2. Apply a perceptual tempo prior (humans favour ~120 BPM).
//   3. Comb-filter across harmonics so the true pulse beats its own subdivisions.
//   4. Pool normalized local evidence, not whole-song energy; retain competing tempos.
//   5. Emit candidates with confidence and half/double-time tagging.
// See documents/features/analyzer-local-tempo.md for references and limits.
//
// Pure typed arrays / Math only. No DOM, worker, RNG, or external DSP libraries.
// Identical input -> identical output.

export interface TempoEstimate {
    bpm: number;
    confidence: number;
    intervalSec: number;
    lagFrames: number;
    strength: number;
    isHalfTime: boolean;
    isDoubleTime: boolean;
}

export interface TempoEstimatorOptions {
    minBpm?: number;
    maxBpm?: number;
    maxCandidates?: number;
    harmonics?: number;
}

export interface TempoEstimatorResult {
    candidates: TempoEstimate[];
    framesPerSecond: number;
    windows: TempoEvidenceWindow[];
}

/** Internal DSP evidence only; never added to worker payloads or persisted. */
export interface TempoEvidenceWindow {
    startFrame: number;
    endFrame: number;
    weight: number;
}

export const TEMPO_WINDOW_SECONDS = 12;

const DEFAULTS = { minBpm: 70, maxBpm: 185, maxCandidates: 5, harmonics: 4 };

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

// Perceptual weighting peaked near 120 BPM, falling off toward the extremes. Keeps the
// estimator from latching onto out-of-range subdivisions while still allowing 70 / 175.
function tempoPrior(bpm: number): number {
    const logRatio = Math.log2(bpm / 120);
    return Math.exp(-(logRatio * logRatio) / (2 * 0.5 * 0.5));
}

function isMultiple(candidate: number, reference: number): boolean {
    return Math.abs(candidate - reference) <= Math.max(1, reference * 0.035);
}

export function estimateTempo(
    onsetEnv: ArrayLike<number>,
    sampleRate: number,
    hopSize: number,
    options?: TempoEstimatorOptions
): TempoEstimatorResult {
    const minBpm = options?.minBpm ?? DEFAULTS.minBpm;
    const maxBpm = options?.maxBpm ?? DEFAULTS.maxBpm;
    const maxCandidates = options?.maxCandidates ?? DEFAULTS.maxCandidates;
    const harmonics = options?.harmonics ?? DEFAULTS.harmonics;
    const framesPerSecond = sampleRate > 0 && hopSize > 0 && Number.isFinite(sampleRate / hopSize)
        ? sampleRate / hopSize : 0;
    const n = onsetEnv.length;

    const empty: TempoEstimatorResult = { candidates: [], framesPerSecond, windows: [] };
    if (n < 8 || framesPerSecond <= 0 || framesPerSecond > 2000
        || !Number.isInteger(minBpm) || !Number.isInteger(maxBpm) || minBpm < 30 || maxBpm > 300 || maxBpm < minBpm
        || !Number.isInteger(harmonics) || harmonics < 1 || harmonics > 8
        || !Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 32) return empty;

    const windowFrames = Math.max(8, Math.round(TEMPO_WINDOW_SECONDS * framesPerSecond));
    const step = Math.max(1, Math.floor(windowFrames / 2));
    const bpmCount = maxBpm - minBpm + 1;
    const strengthSum = new Float64Array(bpmCount);
    const supportSum = new Float64Array(bpmCount);
    const priors = new Float64Array(bpmCount);
    for (let b = 0; b < bpmCount; b++) priors[b] = tempoPrior(minBpm + b);
    const windows: TempoEvidenceWindow[] = [];
    let totalWeight = 0;
    for (let start = 0; start < n; start += step) {
        const end = Math.min(n, start + windowFrames);
        const scores = scoreWindow(onsetEnv, start, end, framesPerSecond, minBpm, maxBpm, harmonics);
        if (scores) {
            let best = 0;
            let bestWeighted = 0;
            let sum = 0;
            for (let b = 0; b < bpmCount; b++) {
                best = Math.max(best, scores[b]); sum += scores[b];
                bestWeighted = Math.max(bestWeighted, scores[b] * priors[b]);
            }
            // A broad/noisy tempogram carries little periodic evidence; amplitude is irrelevant.
            const contrast = clamp01((best - sum / bpmCount) / (best + 1e-9));
            const reliability = contrast * clamp01(best * 3);
            const weight = reliability * reliability;
            if (weight > 1e-6) {
                windows.push({ startFrame: start, endFrame: end, weight });
                totalWeight += weight;
                for (let b = 0; b < bpmCount; b++) {
                    strengthSum[b] += scores[b] * weight;
                    // Neighbour tolerance avoids penalizing frame-quantized nearby tempo peaks.
                    let local = 0;
                    for (let j = Math.max(0, b - 2); j <= Math.min(bpmCount - 1, b + 2); j++) local = Math.max(local, scores[j] * priors[j]);
                    supportSum[b] += clamp01(local / (bestWeighted + 1e-9)) * weight;
                }
            }
        }
        // A final partial window is included once; never create a series of tiny tail votes.
        if (end === n) break;
    }
    if (totalWeight === 0) return empty;

    const weighted = new Float32Array(bpmCount);
    const rawStrength = new Float32Array(bpmCount);
    for (let b = 0; b < bpmCount; b++) {
        rawStrength[b] = strengthSum[b] / totalWeight;
        weighted[b] = rawStrength[b] * priors[b];
    }

    return rankCandidates(rawStrength, weighted, supportSum, totalWeight, windows, framesPerSecond, minBpm, maxCandidates);
}

function scoreWindow(
    input: ArrayLike<number>, start: number, end: number, framesPerSecond: number,
    minBpm: number, maxBpm: number, harmonics: number
): Float32Array | null {
    const n = end - start;
    const env = new Float32Array(n);
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
        const value = input[start + i];
        env[i] = Number.isFinite(value) && value > 0 ? value : 0;
    }
    // Robust cap uses local maxima, not all frames (sparse pulse trains contain many zeros).
    // Four separated attacks are the minimum evidence for a recurring pattern.
    let lastPeak = -Infinity;
    const minGap = Math.max(1, Math.round(framesPerSecond * 0.12));
    for (let i = 0; i < n; i++) {
        if (env[i] > 0 && env[i] >= (env[i - 1] ?? 0) && env[i] > (env[i + 1] ?? 0) && i - lastPeak >= minGap) {
            peaks.push(env[i]);
            lastPeak = i;
        }
    }
    if (peaks.length < 4) return null;
    peaks.sort((a, b) => a - b);
    // Preserve recurring kick accents even among many quiet hats/tails. An amplitude
    // needs at least four attacks to define the scale; isolated crashes cannot define it.
    const cap = peaks[peaks.length - 4] * 4;

    // Local mean removal and local energy normalization: quiet recurring sections get a vote.
    let mean = 0;
    for (let i = 0; i < n; i++) { env[i] = Math.min(cap, env[i]); mean += env[i]; }
    mean /= n;
    // A positive background/last-frame plateau is not another attack. Require four
    // distinct peaks to survive baseline removal as well as the initial peak count.
    if (peaks.filter(peak => Math.min(peak, cap) > mean).length < 4) return null;
    let energy = 0;
    for (let i = 0; i < n; i++) {
        const v = Math.max(0, env[i] - mean);
        env[i] = v;
        energy += v * v;
    }
    if (energy <= 1e-9) return null;

    const maxLag = Math.min(n - 1, Math.ceil((framesPerSecond * 60 / minBpm) * harmonics) + 2);
    const minLag = Math.max(1, Math.floor(framesPerSecond * 60 / maxBpm));
    if (maxLag <= minLag) return null;

    // Unbiased-ish normalized autocorrelation at integer lags.
    const acf = new Float32Array(maxLag + 1);
    const norm0 = energy / n;
    for (let lag = 1; lag <= maxLag; lag++) {
        let sum = 0;
        const count = n - lag;
        for (let i = 0; i < count; i++) sum += env[i] * env[i + lag];
        acf[lag] = count > 0 ? (sum / count) / (norm0 + 1e-12) : 0;
    }

    const acfAt = (x: number): number => {
        if (x < 1 || x > maxLag) return 0;
        const lo = Math.floor(x);
        const hi = Math.min(maxLag, lo + 1);
        const frac = x - lo;
        return acf[lo] * (1 - frac) + acf[hi] * frac;
    };

    // Comb score per integer BPM: reinforce the fundamental with decaying harmonics.
    const bpmCount = maxBpm - minBpm + 1;
    const rawStrength = new Float32Array(bpmCount);
    for (let b = 0; b < bpmCount; b++) {
        const bpm = minBpm + b;
        const period = framesPerSecond * 60 / bpm;
        let comb = 0;
        let wsum = 0;
        for (let h = 1; h <= harmonics; h++) {
            const w = 1 / h;
            comb += w * acfAt(h * period);
            wsum += w;
        }
        const strength = wsum > 0 ? comb / wsum : 0;
        rawStrength[b] = strength;
    }
    return rawStrength;
}

function rankCandidates(
    rawStrength: Float32Array, weighted: Float32Array, supportSum: Float64Array, totalWeight: number,
    windows: TempoEvidenceWindow[], framesPerSecond: number, minBpm: number, maxCandidates: number
): TempoEstimatorResult {
    const bpmCount = weighted.length;
    // Non-maximum suppression: keep local maxima of the weighted tempo salience.
    let sumWeighted = 0;
    for (let b = 0; b < bpmCount; b++) sumWeighted += weighted[b];
    const meanWeighted = sumWeighted / bpmCount;

    const peaks: { bpm: number; strength: number; weighted: number }[] = [];
    for (let b = 0; b < bpmCount; b++) {
        const left = b > 0 ? weighted[b - 1] : -Infinity;
        const right = b < bpmCount - 1 ? weighted[b + 1] : -Infinity;
        if (weighted[b] >= left && weighted[b] >= right && weighted[b] > meanWeighted) {
            peaks.push({ bpm: minBpm + b, strength: rawStrength[b], weighted: weighted[b] });
        }
    }
    if (peaks.length === 0) return { candidates: [], framesPerSecond, windows: [] };

    peaks.sort((a, b) => b.weighted - a.weighted || a.bpm - b.bpm);
    const top = peaks.slice(0, maxCandidates);
    const dominantBpm = top[0].bpm;

    // Confidence: contrast of the winner against the field (how peaked the tempo salience
    // is), tempered by absolute autocorrelation strength so weak/ambiguous signals stay low.
    const bestWeighted = top[0].weighted;
    const secondWeighted = top[1]?.weighted ?? 0;
    const contrast = clamp01((bestWeighted - meanWeighted) / (bestWeighted + 1e-9));
    const separation = clamp01((bestWeighted - secondWeighted) / (bestWeighted + 1e-9));
    const absoluteStrength = clamp01(top[0].strength);

    return {
        framesPerSecond,
        windows,
        candidates: top.map((peak, index) => {
            const confidenceBase = index === 0
                ? contrast * 0.5 + separation * 0.2 + absoluteStrength * 0.3
                : clamp01(peak.weighted / (bestWeighted + 1e-9)) * absoluteStrength;
            return {
                bpm: peak.bpm,
                confidence: clamp01(confidenceBase * (windows.length > 1
                    ? 0.35 + 0.65 * supportSum[peak.bpm - minBpm] / totalWeight : 1)),
                intervalSec: 60 / peak.bpm,
                lagFrames: framesPerSecond * 60 / peak.bpm,
                strength: peak.strength,
                isHalfTime: isMultiple(peak.bpm * 2, dominantBpm),
                isDoubleTime: isMultiple(peak.bpm / 2, dominantBpm)
            };
        })
    };
}
