import type { AnalysisReason, AudioFrame, NoveltyPoint, VisualFeatureFrame } from '../types';
import { clampUnit } from './utils';

/**
 * Deterministic "change-evidence" detector.
 *
 * Works exclusively from precomputed offline frames (no realtime FFT, no audio buffer access):
 * it contrasts a trailing feature window against a leading feature window and reports how much
 * the musical surface changed at each frame. The result is a normalized 0..1 novelty curve plus
 * a sparse set of labeled peaks that SectionAnalyzer can snap section boundaries to.
 *
 * The contrast window is time-based (not bar-based) so the curve stays meaningful for beatless or
 * low-grid-confidence material where no reliable bar grid exists.
 */

interface NoveltyChannels {
    e: Float32Array;
    density: Float32Array;
    bass: Float32Array;
    fx: Float32Array;
    melody: Float32Array;
    brightness: Float32Array;
    tension: Float32Array;
}

// Structural channels (energy / bass / density) dominate; timbral channels nudge.
const CHANNEL_WEIGHTS = {
    e: 1.0,
    density: 0.9,
    bass: 1.0,
    fx: 0.7,
    melody: 0.5,
    brightness: 0.5,
    tension: 0.5
} as const;

const CONTRAST_WINDOW_SEC = 0.7;
const DELTA_REASON_THRESHOLD = 0.08;
const PEAK_THRESHOLD = 0.25;
const BASS_LOW_BAND_COUNT = 4;

export interface NoveltyPeakOptions {
    /** Minimum normalized novelty value for a frame to qualify as a peak (default PEAK_THRESHOLD). */
    minValue?: number;
    /** Minimum spacing in seconds between accepted peaks (default the contrast window). */
    minSpacingSec?: number;
}

export class NoveltyAnalyzer {
    private readonly visualFeatures: VisualFeatureFrame[];
    private readonly audioFrames: AudioFrame[];
    private readonly hopSize: number;
    private readonly sampleRate: number;
    private readonly totalFrames: number;
    private readonly windowFrames: number;

    private curve: NoveltyPoint[] | null = null;

    constructor(visualFeatures: VisualFeatureFrame[], audioFrames: AudioFrame[], hopSize: number, sampleRate: number) {
        this.visualFeatures = visualFeatures;
        this.audioFrames = audioFrames;
        this.hopSize = hopSize;
        this.sampleRate = sampleRate;
        this.totalFrames = Math.min(visualFeatures.length, audioFrames.length);
        const framesPerSec = sampleRate / hopSize;
        this.windowFrames = Math.max(4, Math.round(CONTRAST_WINDOW_SEC * framesPerSec));
    }

    private frameTime(index: number): number {
        return index * this.hopSize / this.sampleRate;
    }

    private buildChannels(): NoveltyChannels {
        const n = this.totalFrames;
        const channels: NoveltyChannels = {
            e: new Float32Array(n),
            density: new Float32Array(n),
            bass: new Float32Array(n),
            fx: new Float32Array(n),
            melody: new Float32Array(n),
            brightness: new Float32Array(n),
            tension: new Float32Array(n)
        };
        for (let i = 0; i < n; i++) {
            const vf = this.visualFeatures[i];
            const af = this.audioFrames[i];
            channels.e[i] = clampUnit(af.e);
            channels.density[i] = clampUnit(vf.density);
            channels.bass[i] = clampUnit(this.frameBass(af));
            channels.fx[i] = clampUnit(vf.fx);
            channels.melody[i] = clampUnit(vf.melody);
            channels.brightness[i] = clampUnit(vf.brightness);
            channels.tension[i] = clampUnit(vf.tension);
        }
        return channels;
    }

    private frameBass(frame: AudioFrame): number {
        const spectrum = frame.perceptualSpectrum;
        if (!spectrum || spectrum.length === 0) return 0;
        const bandCount = Math.min(BASS_LOW_BAND_COUNT, spectrum.length);
        let sum = 0;
        for (let b = 0; b < bandCount; b++) sum += spectrum[b] || 0;
        return sum / bandCount;
    }

    private windowMean(channel: Float32Array, from: number, to: number): number {
        const start = Math.max(0, from);
        const end = Math.min(this.totalFrames, to);
        if (end <= start) return channel[Math.max(0, Math.min(this.totalFrames - 1, from))] || 0;
        let sum = 0;
        for (let i = start; i < end; i++) sum += channel[i];
        return sum / (end - start);
    }

    /** Full per-frame novelty curve, normalized 0..1, with reasons attached only on local peaks. */
    public computeCurve(): NoveltyPoint[] {
        if (this.curve) return this.curve;
        const n = this.totalFrames;
        const curve: NoveltyPoint[] = new Array(n);
        if (n === 0) {
            this.curve = curve;
            return curve;
        }

        const channels = this.buildChannels();
        const w = this.windowFrames;
        const raw = new Float32Array(n);

        // Per-frame trailing-vs-leading window contrast magnitude (weighted Euclidean distance).
        for (let i = 0; i < n; i++) {
            let sumSq = 0;
            for (const key of Object.keys(CHANNEL_WEIGHTS) as Array<keyof NoveltyChannels>) {
                const ch = channels[key];
                const trail = this.windowMean(ch, i - w, i);
                const lead = this.windowMean(ch, i, i + w);
                const weighted = (lead - trail) * CHANNEL_WEIGHTS[key];
                sumSq += weighted * weighted;
            }
            raw[i] = Math.sqrt(sumSq);
        }

        // Light smoothing then robust normalization against the 98th percentile (outlier-safe).
        const smoothed = smooth(raw, 2);
        const norm = robustMax(smoothed);
        for (let i = 0; i < n; i++) {
            curve[i] = { time: this.frameTime(i), value: clampUnit(smoothed[i] / norm), reasons: [] };
        }

        // Attach reasons on local maxima above threshold.
        for (let i = 0; i < n; i++) {
            if (!isLocalMax(curve, i, w) || curve[i].value < PEAK_THRESHOLD) continue;
            curve[i].reasons = this.reasonsAt(channels, i, w);
        }

        this.curve = curve;
        return curve;
    }

    private reasonsAt(channels: NoveltyChannels, i: number, w: number): AnalysisReason[] {
        const delta = (ch: Float32Array) => this.windowMean(ch, i, i + w) - this.windowMean(ch, i - w, i);
        const de = delta(channels.e);
        const dDensity = delta(channels.density);
        const dBass = delta(channels.bass);
        const dFx = delta(channels.fx);

        const reasons: AnalysisReason[] = ['novelty-peak'];
        if (de > DELTA_REASON_THRESHOLD) reasons.push('energy-rise');
        else if (de < -DELTA_REASON_THRESHOLD) reasons.push('energy-drop');
        if (dDensity > DELTA_REASON_THRESHOLD) reasons.push('density-rise');
        if (dBass > DELTA_REASON_THRESHOLD) reasons.push('bass-return');
        else if (dBass < -DELTA_REASON_THRESHOLD) reasons.push('bass-drop');
        if (dFx > DELTA_REASON_THRESHOLD) reasons.push('high-transient');
        return reasons;
    }

    /** Sparse, time-sorted novelty peaks for downstream boundary snapping (Task 4 consumer). */
    public getPeaks(options: NoveltyPeakOptions = {}): NoveltyPoint[] {
        const curve = this.computeCurve();
        const minValue = options.minValue ?? PEAK_THRESHOLD;
        const minSpacingFrames = Math.max(1, Math.round((options.minSpacingSec ?? CONTRAST_WINDOW_SEC) * this.sampleRate / this.hopSize));
        const w = this.windowFrames;

        const candidates: Array<{ index: number; point: NoveltyPoint }> = [];
        for (let i = 0; i < curve.length; i++) {
            if (curve[i].value >= minValue && isLocalMax(curve, i, w)) candidates.push({ index: i, point: curve[i] });
        }
        // Greedy strongest-first suppression so close peaks collapse to the most salient one.
        candidates.sort((a, b) => b.point.value - a.point.value);
        const chosen: Array<{ index: number; point: NoveltyPoint }> = [];
        for (const candidate of candidates) {
            if (chosen.every(c => Math.abs(c.index - candidate.index) >= minSpacingFrames)) chosen.push(candidate);
        }
        chosen.sort((a, b) => a.index - b.index);
        return chosen.map(c => ({
            time: c.point.time,
            value: c.point.value,
            reasons: c.point.reasons.length ? c.point.reasons : (['novelty-peak'] as AnalysisReason[])
        }));
    }
}

function smooth(values: Float32Array, radius: number): Float32Array {
    if (radius <= 0 || values.length === 0) return values;
    const out = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
        let sum = 0, count = 0;
        for (let k = -radius; k <= radius; k++) {
            const j = i + k;
            if (j < 0 || j >= values.length) continue;
            sum += values[j];
            count++;
        }
        out[i] = count > 0 ? sum / count : values[i];
    }
    return out;
}

function robustMax(values: Float32Array): number {
    if (values.length === 0) return 1;
    const sorted = Float32Array.from(values).sort();
    const p98 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))] || 0;
    return Math.max(p98, 1e-6);
}

function isLocalMax(curve: NoveltyPoint[], i: number, radius: number): boolean {
    const start = Math.max(0, i - radius);
    const end = Math.min(curve.length - 1, i + radius);
    for (let j = start; j <= end; j++) {
        if (j === i) continue;
        if (curve[j].value > curve[i].value) return false;
    }
    return true;
}
