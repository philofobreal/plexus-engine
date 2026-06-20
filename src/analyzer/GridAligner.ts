import { FeatureExtractor } from './FeatureExtractor';
import { estimateTempo, type TempoEstimate } from './TempoEstimator';
import { trackBeats } from './BeatTracker';
import type { MusicalGrid, TempoCandidate, TimingConfidence } from '../types';

interface OnsetPeak {
    time: number;
    frame: number;
    strength: number;
    bass: number;
}

// Minimal structural contract GridAligner needs from a feature source. The production
// FeatureExtractor satisfies this; analyzer tests pass duck-typed mocks with the same
// shape (without onsetEnvT), which is why the onset envelope is derived defensively.
type FeatureSource = Pick<FeatureExtractor, 'totalFrames' | 'fluxT' | 'typFlux'> & {
    onsetEnvT?: ArrayLike<number>;
    typOnset?: number;
    rawBassT?: ArrayLike<number>;
    rawHighT?: ArrayLike<number>;
    rmsT?: ArrayLike<number>;
    typRms?: number;
};

/**
 * GridAligner is the single authoritative timing engine of Plexus.
 *
 * Pipeline: onset envelope -> TempoEstimator (autocorrelation/comb) -> half/double
 * resolution -> BeatTracker (DP) -> bar/downbeat alignment -> unified confidence.
 *
 * Legacy fields (estimatedBPM, gridOffset, secondsPerBar/Beat, *Confidence,
 * tempoCandidates) are preserved so SectionAnalyzer / DramaturgyBuilder are unaffected.
 * The new MusicalGrid / TimingConfidence model is the canonical contract going forward.
 */
export class GridAligner {
    private features: FeatureSource;
    private sampleRate: number;
    private hopSize: number;
    private framesPerSecond: number;

    // --- legacy contract (unchanged) ---
    public estimatedBPM: number = 120;
    public gridOffset: number = 0;
    public secondsPerBar: number = 2;
    public secondsPerBeat: number = 0.5;
    public bpmConfidence: number = 0;
    public gridConfidence: number = 0;
    public downbeatConfidence: number = 0;
    public tempoCandidates: TempoCandidate[] = [];

    // --- authoritative timing model ---
    public tempo: number = 120;
    public tempoConfidence: number = 0;
    public beats: number[] = [];
    public beatFrames: number[] = [];
    public beatConfidence: number = 0;
    public barStarts: number[] = [];
    public alternativeTempos: number[] = [];
    public timingConfidence: TimingConfidence = { tempo: 0, beat: 0, grid: 0, overall: 0 };

    private onsetEnv: Float32Array = new Float32Array(0);
    private onsetPeaks: OnsetPeak[] = [];

    constructor(features: FeatureSource, sampleRate: number, hopSize: number) {
        this.features = features;
        this.sampleRate = sampleRate;
        this.hopSize = hopSize;
        this.framesPerSecond = sampleRate / hopSize;
    }

    public calculate(): void {
        const totalFrames = this.features.totalFrames;
        if (!totalFrames || totalFrames < 2) {
            this.applyDefaults();
            return;
        }

        this.onsetEnv = this.buildOnsetEnvelope();
        this.onsetPeaks = this.detectOnsetPeaks(this.onsetEnv);

        // 1. TEMPO — autocorrelation/comb estimation with perceptual + metric resolution.
        const tempoResult = estimateTempo(this.onsetEnv, this.sampleRate, this.hopSize);
        const resolved = this.resolveTempo(tempoResult.candidates);
        const top = resolved[0];

        if (!top) {
            this.applyDefaults();
            return;
        }

        this.tempo = top.bpm;
        this.estimatedBPM = top.bpm;
        this.tempoConfidence = top.confidence;
        this.alternativeTempos = resolved.slice(1).map(c => c.bpm);
        this.tempoCandidates = this.toTempoCandidates(resolved);
        const secondsPerBeat = 60 / this.estimatedBPM;
        this.secondsPerBeat = secondsPerBeat;
        this.secondsPerBar = secondsPerBeat * 4;

        // 2. BEATS — dynamic-programming beat tracking locked to the chosen period.
        const periodFrames = this.framesPerSecond * 60 / this.estimatedBPM;
        const beatResult = trackBeats(this.onsetEnv, periodFrames, this.sampleRate, this.hopSize);
        this.beatFrames = beatResult.beats;
        this.beats = beatResult.beatTimes;

        // 3. GRID — bar/downbeat alignment and offset.
        const grid = this.buildBars();
        this.barStarts = grid.barStarts;
        this.gridOffset = grid.offset;

        // 4. CONFIDENCE — unified tempo/beat/grid model + legacy fields.
        this.computeConfidence(top);
    }

    /** Canonical musical grid contract. */
    public musicalGrid(): MusicalGrid {
        return {
            bpm: this.estimatedBPM,
            beatTimes: this.beats,
            barStarts: this.barStarts,
            offset: this.gridOffset,
            confidence: this.timingConfidence.overall
        };
    }

    // --- onset envelope -------------------------------------------------------------

    private buildOnsetEnvelope(): Float32Array {
        const n = this.features.totalFrames;
        const provided = this.features.onsetEnvT;
        if (provided && provided.length === n) {
            const env = new Float32Array(n);
            for (let i = 0; i < n; i++) env[i] = provided[i] || 0;
            return env;
        }
        // Fallback for duck-typed feature sources: band-weighted normalized flux.
        const env = new Float32Array(n);
        const typFlux = this.features.typFlux || 1;
        const bass = this.features.rawBassT;
        for (let i = 0; i < n; i++) {
            const flux = Math.max(0, (this.features.fluxT[i] || 0) / typFlux);
            const lowWeight = bass ? 0.6 + 0.8 * (bass[i] || 0) : 1;
            env[i] = flux * lowWeight;
        }
        return env;
    }

    private detectOnsetPeaks(env: Float32Array): OnsetPeak[] {
        const n = env.length;
        const peaks: OnsetPeak[] = [];
        const typ = this.percentile(env, 0.95) || 0.001;
        const minGapFrames = Math.max(1, Math.round(this.framesPerSecond * 0.12));
        const bass = this.features.rawBassT;
        let lastPeakFrame = -minGapFrames - 1;

        for (let i = 1; i < n - 1; i++) {
            const v = env[i];
            if (v <= 0) continue;
            let localSum = 0;
            let count = 0;
            for (let j = Math.max(0, i - 20); j <= Math.min(n - 1, i + 20); j++) {
                localSum += env[j];
                count++;
            }
            const localAvg = count > 0 ? localSum / count : 0;
            if (v > localAvg * 1.4 && v > typ * 0.18 && v >= env[i - 1] && v > env[i + 1]) {
                if (i - lastPeakFrame >= minGapFrames) {
                    peaks.push({ time: i / this.framesPerSecond, frame: i, strength: v, bass: bass ? (bass[i] || 0) : 0 });
                    lastPeakFrame = i;
                }
            }
        }
        return peaks;
    }

    // --- tempo resolution -----------------------------------------------------------

    // The estimator already applies a perceptual prior, but near-tied candidates produce a
    // classic octave/metric ambiguity (e.g. a ghost peak halfway between a real 2:1 pair).
    // We prefer candidates that belong to a genuine metric family (have an octave partner
    // in the list) and that the kick (low-band) evidence supports.
    private resolveTempo(candidates: TempoEstimate[]): TempoEstimate[] {
        if (candidates.length < 2) return candidates;
        const hasOctavePartner = (c: TempoEstimate) =>
            candidates.some(o => o !== c && this.isMetricRelative(o.bpm, c.bpm));

        let best = candidates[0];
        let bestScore = -Infinity;
        for (const candidate of candidates) {
            const partnerBonus = hasOctavePartner(candidate) ? 0.2 : 0;
            const score = this.metricScore(candidate) + partnerBonus;
            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        if (best === candidates[0]) return candidates;
        return [best, ...candidates.filter(c => c !== best)];
    }

    private metricScore(candidate: TempoEstimate): number {
        const kick = this.kickPeriodicity(candidate.bpm);
        const coverage = this.beatCoverage(candidate.bpm);
        return candidate.confidence * 0.45 + kick * 0.15 + coverage * 0.30 + candidate.strength * 0.10
            + this.fastTempoPreference(candidate.bpm, coverage);
    }

    // Resolves half/double ambiguity toward the actual beat rate (e.g. drum & bass at ~174,
    // not its 87 half-time feel) — but ONLY when the fast grid is genuinely fully populated.
    // If the faster reading would leave every other beat empty (coverage < 0.8), it is a true
    // double-time artefact and this preference does not apply, so slow tracks stay slow.
    private fastTempoPreference(bpm: number, coverage: number): number {
        if (coverage < 0.8) return 0;
        return this.clamp01((bpm - 100) / 85) * 0.18;
    }

    // Fraction of beat positions at the given BPM that actually carry an onset. This is what
    // distinguishes a true tempo from its double: at double-time, every other "beat" is empty,
    // so a double-time candidate scores ~0.5 here while the true tempo scores ~1.
    private beatCoverage(bpm: number): number {
        if (this.onsetPeaks.length === 0) return 0;
        const period = 60 / bpm;
        const tol = period * 0.18;
        let anchor = this.onsetPeaks[0];
        for (const p of this.onsetPeaks) if (p.strength > anchor.strength) anchor = p;
        const duration = this.features.totalFrames / this.framesPerSecond;
        const times = this.onsetPeaks.map(p => p.time);
        const hasOnset = (t: number) => times.some(pt => Math.abs(pt - t) <= tol);
        let matched = 0;
        let total = 0;
        for (let t = anchor.time; t < duration; t += period) { total++; if (hasOnset(t)) matched++; }
        for (let t = anchor.time - period; t >= 0; t -= period) { total++; if (hasOnset(t)) matched++; }
        return total > 0 ? matched / total : 0;
    }

    // Phase-invariant periodicity of the (kick-weighted) onsets at the given BPM: the mean
    // resultant length of onset phases on the unit circle. ~1 when onsets cluster at a single
    // consistent phase (a real pulse, regardless of offset), ~0 when scattered (a ghost tempo).
    private kickPeriodicity(bpm: number): number {
        if (this.onsetPeaks.length === 0) return 0;
        const periodSec = 60 / bpm;
        const bass = this.features.rawBassT;
        let sumCos = 0;
        let sumSin = 0;
        let totalWeight = 0;
        for (const peak of this.onsetPeaks) {
            const phase = 2 * Math.PI * ((peak.time % periodSec) / periodSec);
            const weight = Math.max(0.001, peak.strength) * (bass ? 0.3 + peak.bass : 1);
            sumCos += Math.cos(phase) * weight;
            sumSin += Math.sin(phase) * weight;
            totalWeight += weight;
        }
        if (totalWeight <= 0) return 0;
        return this.clamp01(Math.sqrt(sumCos * sumCos + sumSin * sumSin) / totalWeight);
    }

    private isMetricRelative(a: number, b: number): boolean {
        return this.isMultiple(a * 2, b) || this.isMultiple(a / 2, b)
            || this.isMultiple(b * 2, a) || this.isMultiple(b / 2, a);
    }

    private isMultiple(candidate: number, reference: number): boolean {
        return Math.abs(candidate - reference) <= Math.max(1, reference * 0.035);
    }

    private toTempoCandidates(resolved: TempoEstimate[]): TempoCandidate[] {
        const dominant = resolved[0]?.bpm ?? this.estimatedBPM;
        const maxStrength = Math.max(...resolved.map(c => c.strength), 1e-6);
        return resolved.slice(0, 5).map(c => ({
            bpm: c.bpm,
            score: this.clamp01(c.confidence),
            intervalSec: c.intervalSec,
            peakCount: Number((c.strength / maxStrength).toFixed(3)),
            isHalfTime: this.isMultiple(c.bpm * 2, dominant),
            isDoubleTime: this.isMultiple(c.bpm / 2, dominant)
        }));
    }

    // --- bar / downbeat alignment ---------------------------------------------------

    private buildBars(): { barStarts: number[]; offset: number } {
        const secondsPerBar = this.secondsPerBar;
        if (this.beats.length >= 4) {
            // Choose the bar phase (which beat is the downbeat). The downbeat is carried by the
            // kick: strong LOW-frequency energy, and crucially NOT the snare backbeat.
            let bestPhase = 0;
            let bestScore = -Infinity;
            for (let phase = 0; phase < 4; phase++) {
                const score = this.barPhaseScore(phase);
                if (score > bestScore) {
                    bestScore = score;
                    bestPhase = phase;
                }
            }
            const barStarts: number[] = [];
            for (let k = bestPhase; k < this.beats.length; k += 4) barStarts.push(this.beats[k]);
            const offset = barStarts.length > 0 ? this.mod(barStarts[0], secondsPerBar) : 0;
            this.downbeatPhaseScore = this.phaseDominance(bestPhase);
            return { barStarts, offset };
        }

        // Fallback when beat tracking yields too few beats: project from the strongest hit.
        let anchorTime = 0;
        let anchorScore = -1;
        for (const peak of this.onsetPeaks) {
            const score = peak.strength * (0.4 + peak.bass);
            if (score > anchorScore) {
                anchorScore = score;
                anchorTime = peak.time;
            }
        }
        const offset = this.mod(anchorTime, secondsPerBar);
        const totalDuration = this.features.totalFrames / this.framesPerSecond;
        const barStarts: number[] = [];
        for (let t = offset; t < totalDuration; t += secondsPerBar) barStarts.push(t);
        this.downbeatPhaseScore = 0.2;
        return { barStarts, offset };
    }

    private downbeatPhaseScore: number = 0;

    // Score a candidate bar phase by kick (bass) energy minus snare/hat (high) energy, summed
    // over a small window around each beat so sparse transients are not missed by exact-frame
    // sampling. A loud backbeat thus cannot masquerade as the downbeat.
    private barPhaseScore(phase: number): number {
        let score = 0;
        for (let k = phase; k < this.beats.length; k += 4) {
            const frame = this.beatFrames[k];
            const onset = this.windowSum(this.onsetEnv, frame);
            const bass = this.features.rawBassT ? this.windowSum(this.features.rawBassT, frame) : 0;
            const high = this.features.rawHighT ? this.windowSum(this.features.rawHighT, frame) : 0;
            score += onset * (0.2 + bass * 1.6 - high * 0.8);
        }
        return score;
    }

    private windowSum(arr: ArrayLike<number>, frame: number): number {
        let sum = 0;
        for (let i = frame - 2; i <= frame + 2; i++) {
            if (i >= 0 && i < this.features.totalFrames) sum += arr[i] || 0;
        }
        return sum;
    }

    private phaseDominance(bestPhase: number): number {
        const scores: number[] = [];
        for (let phase = 0; phase < 4; phase++) scores.push(this.barPhaseScore(phase));
        const best = scores[bestPhase];
        const others = scores.filter((_, i) => i !== bestPhase);
        const meanOther = others.reduce((s, v) => s + v, 0) / Math.max(1, others.length);
        return best > 0 ? this.clamp01((best - meanOther) / Math.max(best, 1e-6)) : 0;
    }

    // --- confidence -----------------------------------------------------------------

    private computeConfidence(top: TempoEstimate): void {
        const onsetCount = this.onsetPeaks.length;
        // Evidence ceiling: a couple of onsets cannot yield high confidence regardless of
        // how clean the autocorrelation looks. Saturates at ~12 onsets.
        const evidenceCap = this.clamp01(onsetCount / 12);
        const evidenceFactor = onsetCount >= 12 ? 1 : evidenceCap;
        // Percussive ceiling: a metric pulse must be carried by sharp low-frequency
        // transients. Quasi-periodic non-percussive material (e.g. speech) is capped here.
        const transientCap = this.kickTransientCap();

        const alignment = this.beatOnsetAlignment();

        // Legacy bpmConfidence: tempo salience + beat/onset alignment, ceilinged by evidence
        // and percussive transient support.
        const base = this.clamp01(0.1 + top.confidence * 0.45 + alignment.matchedRatio * 0.5);
        this.bpmConfidence = this.clamp01(base * evidenceFactor * transientCap);

        // Grid confidence: how precisely beats sit on onsets (timing accuracy), tempo-gated,
        // and held down by sparse evidence.
        this.gridConfidence = this.clamp01(
            alignment.matchedRatio * (1 - alignment.avgError * 0.4) * (0.45 + 0.55 * top.confidence) * evidenceFactor
        );

        // Beat confidence: alignment quality plus phase continuity of the tracked beats.
        this.beatConfidence = this.clamp01(alignment.matchedRatio * 0.6 + this.phaseContinuity() * 0.4);

        // Downbeat confidence is capped by the grid and bpm confidences it depends on.
        const rawDownbeat = this.clamp01(this.downbeatPhaseScore * 0.7 + this.gridConfidence * 0.3);
        this.downbeatConfidence = Math.min(rawDownbeat, this.gridConfidence, this.bpmConfidence * 1.2);

        const tempo = this.clamp01(this.bpmConfidence);
        const beat = this.beatConfidence;
        const grid = this.gridConfidence;
        this.timingConfidence = {
            tempo,
            beat,
            grid,
            overall: this.clamp01(tempo * 0.4 + beat * 0.3 + grid * 0.3)
        };
        this.tempoConfidence = tempo;
    }

    // A metric pulse must be carried by sharp low-frequency transients (kicks). This ceiling
    // collapses confidence for bass-light or soft-attack quasi-periodic material like speech.
    private kickTransientCap(): number {
        const rms = this.features.rmsT;
        if (this.onsetPeaks.length === 0 || !rms) return 0.5;
        const typRms = Math.max(1e-6, this.features.typRms || 1e-6);
        const ranked = [...this.onsetPeaks]
            .map(peak => ({ peak, rise: this.rmsRise(peak.frame, rms) }))
            .sort((a, b) => (b.peak.strength * b.peak.bass * Math.max(0, b.rise)) - (a.peak.strength * a.peak.bass * Math.max(0, a.rise)))
            .slice(0, Math.min(12, this.onsetPeaks.length));
        const avgBass = ranked.reduce((s, r) => s + this.clamp01(r.peak.bass), 0) / ranked.length;
        const avgRise = ranked.reduce((s, r) => s + Math.max(0, r.rise), 0) / ranked.length;
        const riseSupport = this.clamp01((avgRise / typRms) * 2.2);
        const bassSupport = this.clamp01(avgBass);
        return this.clamp01(riseSupport * bassSupport);
    }

    private rmsRise(frame: number, rms: ArrayLike<number>): number {
        const start = Math.max(0, frame - 8);
        let sum = 0;
        let count = 0;
        for (let i = start; i < frame; i++) {
            sum += rms[i] || 0;
            count++;
        }
        const previous = count > 0 ? sum / count : (rms[frame] || 0);
        return Math.max(0, (rms[frame] || 0) - previous);
    }

    private beatOnsetAlignment(): { matchedRatio: number; avgError: number } {
        if (this.beats.length === 0 || this.onsetPeaks.length === 0) return { matchedRatio: 0, avgError: 1 };
        const tolerance = Math.min(0.07, this.secondsPerBeat * 0.18);
        let matchedWeight = 0;
        let totalWeight = 0;
        let errorSum = 0;

        for (const peak of this.onsetPeaks) {
            // nearest beat to this onset
            let nearest = Infinity;
            for (const beat of this.beats) {
                const d = Math.abs(beat - peak.time);
                if (d < nearest) nearest = d;
                if (beat - peak.time > tolerance) break;
            }
            const weight = Math.max(0.001, peak.strength);
            totalWeight += weight;
            if (nearest <= tolerance) {
                matchedWeight += weight;
                errorSum += (nearest / tolerance) * weight;
            }
        }
        const matchedRatio = totalWeight > 0 ? matchedWeight / totalWeight : 0;
        const avgError = matchedWeight > 0 ? errorSum / matchedWeight : 1;
        return { matchedRatio, avgError };
    }

    private phaseContinuity(): number {
        if (this.beats.length < 3) return 0;
        const gaps: number[] = [];
        for (let i = 1; i < this.beats.length; i++) gaps.push(this.beats[i] - this.beats[i - 1]);
        const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        if (mean <= 0) return 0;
        let variance = 0;
        for (const g of gaps) variance += (g - mean) * (g - mean);
        const std = Math.sqrt(variance / gaps.length);
        return this.clamp01(1 - (std / mean) * 2);
    }

    // --- helpers --------------------------------------------------------------------

    private applyDefaults(): void {
        this.estimatedBPM = 120;
        this.tempo = 120;
        this.secondsPerBeat = 0.5;
        this.secondsPerBar = 2;
        this.bpmConfidence = 0.05;
        this.gridConfidence = 0.05;
        this.downbeatConfidence = 0.05;
        this.tempoConfidence = 0.05;
        this.beatConfidence = 0;
        this.tempoCandidates = [];
        this.beats = [];
        this.beatFrames = [];
        this.barStarts = [];
        this.alternativeTempos = [];
        this.timingConfidence = { tempo: 0.05, beat: 0, grid: 0.05, overall: 0.05 };
    }

    private percentile(arr: ArrayLike<number>, q: number): number {
        const n = arr.length;
        if (n === 0) return 0;
        const sorted = new Float32Array(n);
        for (let i = 0; i < n; i++) sorted[i] = arr[i];
        sorted.sort();
        return sorted[Math.min(n - 1, Math.floor(n * q))] || 0;
    }

    private mod(value: number, m: number): number {
        if (m <= 0) return 0;
        let r = value % m;
        if (r < 0) r += m;
        return r;
    }

    private clamp01(value: number): number {
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    }
}
