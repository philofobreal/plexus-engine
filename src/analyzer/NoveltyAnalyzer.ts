import type { AnalysisReason, AudioFrame, NoveltyPoint, VisualFeatureFrame } from '../types';
import { clampUnit } from './utils';

/**
 * Deterministic "change-evidence" detector.
 *
 * Works exclusively from precomputed offline frames (no realtime FFT, no audio buffer access):
 * it contrasts a trailing feature window against a leading feature window and reports how much
 * the musical surface changed at each frame. The result is a normalized 0..1 novelty curve (a
 * plain `number[]`, one value per frame) plus a sparse set of labeled peaks that SectionAnalyzer
 * can snap section boundaries to.
 *
 * The contrast window is time-based (not bar-based) so the curve stays meaningful for beatless or
 * low-grid-confidence material. Window means use per-channel prefix sums (O(1) per frame), and the
 * curve is tapered over the first/last window where the trailing/leading windows are truncated, so
 * track-edge fade-ins do not register as spurious novelty peaks / section boundaries.
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

type ChannelKey = keyof NoveltyChannels;

// Structural channels (energy / bass / density) dominate; timbral channels nudge.
const CHANNEL_WEIGHTS: Record<ChannelKey, number> = {
    e: 1.0,
    density: 0.9,
    bass: 1.0,
    fx: 0.7,
    melody: 0.5,
    brightness: 0.5,
    tension: 0.5
};
const CHANNEL_KEYS = Object.keys(CHANNEL_WEIGHTS) as ChannelKey[];

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

    private values: Float32Array | null = null;
    private channels: NoveltyChannels | null = null;
    private prefix: Record<ChannelKey, Float64Array> | null = null;

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

    // prefix[i] = sum of channel[0..i-1]; window mean over [from,to) is then O(1).
    private buildPrefix(channel: Float32Array): Float64Array {
        const prefix = new Float64Array(channel.length + 1);
        for (let i = 0; i < channel.length; i++) prefix[i + 1] = prefix[i] + channel[i];
        return prefix;
    }

    private windowMean(key: ChannelKey, from: number, to: number): number {
        const start = Math.max(0, from);
        const end = Math.min(this.totalFrames, to);
        if (end <= start) {
            const ch = this.channels![key];
            return ch[Math.max(0, Math.min(this.totalFrames - 1, from))] || 0;
        }
        const prefix = this.prefix![key];
        return (prefix[end] - prefix[start]) / (end - start);
    }

    // Builds (and caches) the normalized novelty curve plus the channel/prefix tables it derives.
    private compute(): Float32Array {
        if (this.values) return this.values;
        const n = this.totalFrames;
        if (n === 0) {
            this.values = new Float32Array(0);
            return this.values;
        }

        this.channels = this.buildChannels();
        this.prefix = {} as Record<ChannelKey, Float64Array>;
        for (const key of CHANNEL_KEYS) this.prefix[key] = this.buildPrefix(this.channels[key]);

        const w = this.windowFrames;
        const raw = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            let sumSq = 0;
            for (const key of CHANNEL_KEYS) {
                const trail = this.windowMean(key, i - w, i);
                const lead = this.windowMean(key, i, i + w);
                const weighted = (lead - trail) * CHANNEL_WEIGHTS[key];
                sumSq += weighted * weighted;
            }
            raw[i] = Math.sqrt(sumSq);
        }

        // Light smoothing, robust normalization (98th percentile), then an edge taper over the
        // first/last window where the contrast windows are truncated and unreliable.
        const smoothed = smooth(raw, 2);
        const norm = robustMax(smoothed);
        const values = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const taper = clampUnit(Math.min(i, n - 1 - i) / w);
            values[i] = clampUnit(smoothed[i] / norm) * taper;
        }
        this.values = values;
        return values;
    }

    /** Full per-frame novelty curve as plain numbers (one value per analysis frame, 0..1). */
    public getCurveValues(): number[] {
        return Array.from(this.compute());
    }

    private reasonsAt(i: number, w: number): AnalysisReason[] {
        const delta = (key: ChannelKey) => this.windowMean(key, i, i + w) - this.windowMean(key, i - w, i);
        const de = delta('e');
        const dDensity = delta('density');
        const dBass = delta('bass');
        const dFx = delta('fx');

        const reasons: AnalysisReason[] = ['novelty-peak'];
        if (de > DELTA_REASON_THRESHOLD) reasons.push('energy-rise');
        else if (de < -DELTA_REASON_THRESHOLD) reasons.push('energy-drop');
        if (dDensity > DELTA_REASON_THRESHOLD) reasons.push('density-rise');
        if (dBass > DELTA_REASON_THRESHOLD) reasons.push('bass-return');
        else if (dBass < -DELTA_REASON_THRESHOLD) reasons.push('bass-drop');
        if (dFx > DELTA_REASON_THRESHOLD) reasons.push('high-transient');
        return reasons;
    }

    /** Sparse, time-sorted novelty peaks (with reasons) for downstream boundary snapping. */
    public getPeaks(options: NoveltyPeakOptions = {}): NoveltyPoint[] {
        const values = this.compute();
        const minValue = options.minValue ?? PEAK_THRESHOLD;
        const minSpacingFrames = Math.max(1, Math.round((options.minSpacingSec ?? CONTRAST_WINDOW_SEC) * this.sampleRate / this.hopSize));
        const w = this.windowFrames;

        // Ignore the first/last window: there the trailing/leading contrast windows are truncated,
        // so a track-edge fade-in/out must not register as a peak (and thus as a section boundary).
        const edge = values.length > this.windowFrames * 3 ? this.windowFrames : 0;
        const candidates: number[] = [];
        for (let i = edge; i < values.length - edge; i++) {
            if (values[i] >= minValue && isLocalMax(values, i, w)) candidates.push(i);
        }
        // Greedy strongest-first suppression so close peaks collapse to the most salient one.
        candidates.sort((a, b) => values[b] - values[a]);
        const chosen: number[] = [];
        for (const index of candidates) {
            if (chosen.every(c => Math.abs(c - index) >= minSpacingFrames)) chosen.push(index);
        }
        chosen.sort((a, b) => a - b);
        return chosen.map(index => ({
            time: this.frameTime(index),
            value: values[index],
            reasons: this.reasonsAt(index, w)
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

function isLocalMax(values: Float32Array, i: number, radius: number): boolean {
    const start = Math.max(0, i - radius);
    const end = Math.min(values.length - 1, i + radius);
    for (let j = start; j <= end; j++) {
        if (j === i) continue;
        if (values[j] > values[i]) return false;
    }
    return true;
}
