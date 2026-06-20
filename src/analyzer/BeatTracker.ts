// Dynamic-programming beat tracking (Ellis 2007, "Beat Tracking by Dynamic Programming";
// the same core used by librosa.beat.beat_track).
//
// Given an onset-strength envelope and a target tempo period (in frames), it finds the
// globally optimal sequence of beat frames that maximizes onset alignment while penalizing
// inter-beat intervals that deviate from the target period. Because the transition cost
// favours continuing at the target period, the grid is naturally EXTRAPOLATED through
// silent / ambient regions that contain no onsets.
//
// Pure Float32Array / Math only. Deterministic: identical input -> identical beats.

export interface BeatTrackOptions {
    tightness?: number; // penalty stiffness for tempo deviation (Ellis default ~100)
    trim?: boolean;     // drop weak leading/trailing beats
}

export interface BeatTrackResult {
    beats: number[];      // beat frame indices
    beatTimes: number[];  // beat times in seconds
    periodFrames: number; // target period actually used
}

function localMaxMask(values: Float32Array): Uint8Array {
    const n = values.length;
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const left = i > 0 ? values[i - 1] : -Infinity;
        const right = i < n - 1 ? values[i + 1] : -Infinity;
        if (values[i] > left && values[i] >= right) mask[i] = 1;
    }
    return mask;
}

export function trackBeats(
    onsetEnv: ArrayLike<number>,
    periodFrames: number,
    sampleRate: number,
    hopSize: number,
    options?: BeatTrackOptions
): BeatTrackResult {
    const n = onsetEnv.length;
    const period = Math.max(1, Math.round(periodFrames));
    const tightness = options?.tightness ?? 100;
    const trim = options?.trim ?? true;
    const empty: BeatTrackResult = { beats: [], beatTimes: [], periodFrames: period };
    if (n < 2 || !Number.isFinite(periodFrames) || periodFrames < 1) return empty;

    // Local score: standardized onset envelope (zero mean, unit std). Negative values are
    // retained so silent regions actively discourage placing a beat there.
    let mean = 0;
    for (let i = 0; i < n; i++) mean += onsetEnv[i];
    mean /= n;
    let variance = 0;
    for (let i = 0; i < n; i++) {
        const d = onsetEnv[i] - mean;
        variance += d * d;
    }
    const std = Math.sqrt(variance / n) || 1;
    const localscore = new Float32Array(n);
    let maxLocal = 0;
    for (let i = 0; i < n; i++) {
        localscore[i] = (onsetEnv[i] - mean) / std;
        if (localscore[i] > maxLocal) maxLocal = localscore[i];
    }

    // Predecessor search window: [-2*period, -period/2]. Transition cost is a squared-log
    // penalty so the best predecessor is exactly one period back.
    const windowStart = Math.round(-2 * period);
    const windowEnd = Math.round(-period / 2);
    const windowLen = windowEnd - windowStart + 1;
    const txcost = new Float32Array(windowLen);
    for (let w = 0; w < windowLen; w++) {
        const offset = windowStart + w; // negative
        const ratio = -offset / period;
        const lg = Math.log(ratio);
        txcost[w] = -tightness * lg * lg;
    }

    const cumscore = new Float32Array(n);
    const backlink = new Int32Array(n).fill(-1);
    const firstBeatThreshold = 0.01 * maxLocal;
    let started = false;

    for (let i = 0; i < n; i++) {
        let bestScore = -Infinity;
        let bestLoc = -1;
        for (let w = 0; w < windowLen; w++) {
            const loc = i + windowStart + w;
            if (loc < 0) continue;
            const score = cumscore[loc] + txcost[w];
            if (score > bestScore) {
                bestScore = score;
                bestLoc = loc;
            }
        }
        if (bestLoc < 0) bestScore = 0;
        cumscore[i] = localscore[i] + bestScore;

        // A frame can be a fresh starting beat only while we have not committed to a chain
        // and its onset is negligible; otherwise link to the best predecessor.
        if (!started && localscore[i] < firstBeatThreshold) {
            backlink[i] = -1;
        } else {
            backlink[i] = bestLoc;
            if (bestLoc >= 0) started = true;
        }
    }

    // Choose the final beat: latest local maximum of the cumulative score above half the
    // mean cumulative score over local maxima.
    const localmax = localMaxMask(cumscore);
    let sumMax = 0;
    let countMax = 0;
    for (let i = 0; i < n; i++) {
        if (localmax[i]) {
            sumMax += cumscore[i];
            countMax++;
        }
    }
    if (countMax === 0) return empty;
    const threshold = 0.5 * (sumMax / countMax);
    let tail = -1;
    for (let i = n - 1; i >= 0; i--) {
        if (localmax[i] && cumscore[i] >= threshold) {
            tail = i;
            break;
        }
    }
    if (tail < 0) return empty;

    // Backtrace through the chain.
    const reversed: number[] = [];
    let cursor = tail;
    let guard = 0;
    while (cursor >= 0 && guard <= n) {
        reversed.push(cursor);
        cursor = backlink[cursor];
        guard++;
    }
    let beats = reversed.reverse();

    if (trim && beats.length > 2) {
        beats = trimWeakEdges(beats, localscore);
    }

    const secondsPerFrame = hopSize / sampleRate;
    return {
        beats,
        beatTimes: beats.map(frame => frame * secondsPerFrame),
        periodFrames: period
    };
}

// Drop leading/trailing beats whose onset support is far below the beat-set's typical
// support (spurious edge beats produced by the DP warm-up / cool-down).
function trimWeakEdges(beats: number[], localscore: Float32Array): number[] {
    const support = beats.map(frame => Math.max(0, localscore[frame]));
    const sorted = [...support].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const threshold = 0.25 * median;
    let lo = 0;
    let hi = beats.length - 1;
    while (lo < hi && support[lo] < threshold) lo++;
    while (hi > lo && support[hi] < threshold) hi--;
    return beats.slice(lo, hi + 1);
}
