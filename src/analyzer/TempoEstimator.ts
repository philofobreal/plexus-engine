// Deterministic tempo estimation from an onset-strength envelope.
//
// Industry-standard approach (cf. Ellis 2007, "Beat Tracking by Dynamic Programming"):
//   1. Autocorrelate the onset envelope.
//   2. Apply a perceptual tempo prior (humans favour ~120 BPM).
//   3. Comb-filter across harmonics so the true pulse beats its own subdivisions.
//   4. Emit a ranked list of {bpm, confidence} candidates with half/double-time tagging.
//
// Pure Float32Array / Math only. No DOM, worker, RNG, or external DSP libraries.
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
}

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
    const framesPerSecond = sampleRate / hopSize;
    const n = onsetEnv.length;

    const empty: TempoEstimatorResult = { candidates: [], framesPerSecond };
    if (n < 8) return empty;

    // Mean-remove the envelope so silent stretches do not bias the autocorrelation.
    let mean = 0;
    for (let i = 0; i < n; i++) mean += onsetEnv[i];
    mean /= n;
    const env = new Float32Array(n);
    let energy = 0;
    for (let i = 0; i < n; i++) {
        const v = Math.max(0, onsetEnv[i] - mean);
        env[i] = v;
        energy += v * v;
    }
    if (energy <= 1e-9) return empty;

    const maxLag = Math.min(n - 1, Math.ceil((framesPerSecond * 60 / minBpm) * harmonics) + 2);
    const minLag = Math.max(1, Math.floor(framesPerSecond * 60 / maxBpm));
    if (maxLag <= minLag) return empty;

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
    const weighted = new Float32Array(bpmCount);
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
        weighted[b] = strength * tempoPrior(bpm);
    }

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
    if (peaks.length === 0) return empty;

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
        candidates: top.map((peak, index) => {
            const confidenceBase = index === 0
                ? contrast * 0.5 + separation * 0.2 + absoluteStrength * 0.3
                : clamp01(peak.weighted / (bestWeighted + 1e-9)) * absoluteStrength;
            return {
                bpm: peak.bpm,
                confidence: clamp01(confidenceBase),
                intervalSec: 60 / peak.bpm,
                lagFrames: framesPerSecond * 60 / peak.bpm,
                strength: peak.strength,
                isHalfTime: isMultiple(peak.bpm * 2, dominantBpm),
                isDoubleTime: isMultiple(peak.bpm / 2, dominantBpm)
            };
        })
    };
}
