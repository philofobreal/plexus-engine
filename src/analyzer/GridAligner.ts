import { FeatureExtractor } from './FeatureExtractor';
import type { TempoCandidate } from '../types';

interface OnsetPeak {
    time: number;
    flux: number;
    bass: number;
    rmsRise: number;
}

export class GridAligner {
    private features: FeatureExtractor;
    private sampleRate: number;
    private hopSize: number;
    public estimatedBPM: number = 120;
    public gridOffset: number = 0;
    public secondsPerBar: number = 2;
    public secondsPerBeat: number = 0.5;
    public bpmConfidence: number = 0;
    public gridConfidence: number = 0;
    public downbeatConfidence: number = 0;
    public tempoCandidates: TempoCandidate[] = [];
    private onsetPeaks: OnsetPeak[] = [];

    constructor(features: FeatureExtractor, sampleRate: number, hopSize: number) {
        this.features = features;
        this.sampleRate = sampleRate;
        this.hopSize = hopSize;
    }

    public calculate(): void {
        const { totalFrames, fluxT, rawBassT, rmsT, typFlux } = this.features;
        const totalDuration = totalFrames * this.hopSize / this.sampleRate;

        // 1. ROBUST BPM DETECTION (Histogram based)
        let intervals: number[] = [];
        let tempLastBeat = 0;
        let onsetPeaks: OnsetPeak[] = [];
        for (let i = 20; i < totalFrames - 20; i++) {
            let sum = 0; for(let j=i-20; j<=i+20; j++) sum += fluxT[j];
            let avg = sum / 41;
            if (fluxT[i] > avg * 1.5 && fluxT[i] > typFlux * 0.1) {
                if (fluxT[i] > fluxT[i-1] && fluxT[i] > fluxT[i+1]) {
                    let time = i * this.hopSize / this.sampleRate;
                    if (time - tempLastBeat > 0.3) {
                        intervals.push(Math.round(60 / (time - tempLastBeat)));
                        tempLastBeat = time;
                        onsetPeaks.push({ time, flux: fluxT[i], bass: rawBassT[i], rmsRise: this.computeRmsRise(i, rmsT) });
                    }
                }
            }
        }
        this.onsetPeaks = onsetPeaks;

        let counts: Record<number, number> = {};
        if (intervals.length > 0) {
            let maxCount = 0;
            for (let b of intervals) {
                if (b >= 70 && b <= 180) {
                    for (let delta = -2; delta <= 2; delta++) {
                        const smoothedBpm = b + delta;
                        if (smoothedBpm < 70 || smoothedBpm > 180) continue;
                        const weight = delta === 0 ? 1 : delta === -1 || delta === 1 ? 0.66 : 0.33;
                        counts[smoothedBpm] = (counts[smoothedBpm] || 0) + weight;
                    }
                    if (counts[b] > maxCount) { maxCount = counts[b]; this.estimatedBPM = b; }
                }
            }
        }

        this.tempoCandidates = this.buildTempoCandidates(counts);
        this.bpmConfidence = this.computeBpmConfidence(counts, intervals.length);
        if (this.tempoCandidates.length > 0) {
            this.estimatedBPM = this.tempoCandidates[0].bpm;
        } else {
            this.estimatedBPM = 120;
            this.bpmConfidence = 0.05;
        }

        this.secondsPerBeat = 60 / this.estimatedBPM;
        const secondsPerBeat = this.secondsPerBeat;
        this.secondsPerBar = secondsPerBeat * 4;

        // 2. THE "GROUND TRUTH" ANCHOR PROJECTOR
        // Find the single hardest-hitting percussive moment in the ENTIRE track (The Main Drop Kick)
        let maxHitScore = 0;
        let masterAnchorTime = 0;
        for (let i = 0; i < totalFrames; i++) {
            // Spectral flux (transient sharpness) multiplied by raw bass (kick drum weight)
            let score = fluxT[i] * rawBassT[i];
            if (score > maxHitScore) {
                maxHitScore = score;
                masterAnchorTime = i * this.hopSize / this.sampleRate;
            }
        }

        // 3. EXTRACT EXACT BEAT PHASE
        // We now know exactly where a beat is. We project this phase backward to 0.000s.
        let exactBeatPhase = masterAnchorTime % this.secondsPerBeat;
        if (exactBeatPhase < 0) exactBeatPhase += this.secondsPerBeat;

        // 4. FIND THE DOWNBEAT (1.1.1)
        // A beat can be the 1st, 2nd, 3rd, or 4th quarter note of a bar.
        // We project a grid for each of the 4 possibilities across the ENTIRE track
        // and see which one aligns with the most bass transients (kick drums).
        let bestBarOffset = exactBeatPhase;
        let maxGlobalCorrelation = -1;
        let correlationSum = 0;
        let correlationMaxCount = 0;

        for (let i = 0; i < 4; i++) {
            let testOffset = exactBeatPhase + i * this.secondsPerBeat;
            let correlation = 0;

            // Sample the entire track exactly on this projected grid
            for (let t = testOffset; t < totalDuration; t += this.secondsPerBar) {
                let frame = Math.floor(t * this.sampleRate / this.hopSize);
                if (frame >= 0 && frame < totalFrames) {
                    correlation += fluxT[frame] * rawBassT[frame];
                }
            }

            correlationSum += correlation;
            if (correlation > 0) correlationMaxCount++;
            if (correlation > maxGlobalCorrelation) {
                maxGlobalCorrelation = correlation;
                bestBarOffset = testOffset;
            }
        }

        // 5. LOCK THE GLOBAL GRID OFFSET
        this.gridOffset = bestBarOffset % this.secondsPerBar;
        if (this.gridOffset < 0) this.gridOffset += this.secondsPerBar;
        this.gridConfidence = this.computeGridConfidence();
        if (this.tempoCandidates.length > 0) {
            const evidenceCap = this.computeEvidenceCap(intervals.length);
            const transientCap = this.computeKickTransientEvidenceCap();
            this.bpmConfidence = Math.min(this.bpmConfidence + this.gridConfidence * 0.15, evidenceCap, transientCap);
        }
        this.downbeatConfidence = this.computeDownbeatConfidence(maxGlobalCorrelation, correlationSum, correlationMaxCount);
    }

    private buildTempoCandidates(counts: Record<number, number>): TempoCandidate[] {
        const entries = Object.entries(counts)
            .map(([bpm, peakCount]) => ({ bpm: Number(bpm), peakCount: Number(peakCount.toFixed(3)) }))
            .filter(entry => Number.isFinite(entry.bpm) && entry.peakCount > 0)
            .sort((a, b) => b.peakCount - a.peakCount || a.bpm - b.bpm)
            .slice(0, 5);

        const maxPeak = entries[0]?.peakCount || 0;
        const dominantBpm = entries[0]?.bpm || this.estimatedBPM;
        const candidates = entries.map(entry => ({
            bpm: entry.bpm,
            score: this.clamp01(entry.peakCount / Math.max(1, maxPeak)),
            intervalSec: 60 / entry.bpm,
            peakCount: entry.peakCount,
            isHalfTime: this.isTempoMultiple(entry.bpm * 2, dominantBpm),
            isDoubleTime: this.isTempoMultiple(entry.bpm / 2, dominantBpm)
        }));
        return this.resolveTempoAmbiguity(candidates);
    }

    private computeBpmConfidence(counts: Record<number, number>, intervalCount: number): number {
        const peaks = Object.values(counts).sort((a, b) => b - a);
        if (peaks.length === 0 || intervalCount === 0) return 0.05;

        const dominant = peaks[0];
        const noiseMean = peaks.length > 1
            ? peaks.slice(1).reduce((sum, value) => sum + value, 0) / (peaks.length - 1)
            : 0;
        const dominance = dominant / Math.max(dominant + noiseMean, 0.000001);
        const support = this.clamp01(dominant / 6);
        const coverage = this.clamp01(intervalCount / 16);
        const rawConfidence = this.clamp01(0.12 + dominance * 0.64 + support * 0.18 + coverage * 0.06);
        return rawConfidence * Math.min(this.computeEvidenceCap(intervalCount), this.computeKickTransientEvidenceCap());
    }

    private computeGridConfidence(): number {
        if (this.onsetPeaks.length < 3 || this.bpmConfidence < 0.1) return 0.05;

        const tolerance = Math.min(0.08, this.secondsPerBeat * 0.18);
        let matchedWeight = 0;
        let totalWeight = 0;
        let errorSum = 0;

        for (const peak of this.onsetPeaks) {
            const beatIndex = Math.round((peak.time - this.gridOffset) / this.secondsPerBeat);
            const gridTime = this.gridOffset + beatIndex * this.secondsPerBeat;
            const error = Math.abs(peak.time - gridTime);
            const weight = Math.max(0.001, peak.flux);
            totalWeight += weight;
            if (error <= tolerance) {
                matchedWeight += weight;
                errorSum += (error / tolerance) * weight;
            }
        }

        if (totalWeight <= 0 || matchedWeight <= 0) return 0.05;
        const matchedRatio = matchedWeight / totalWeight;
        const averageError = errorSum / matchedWeight;
        // Grid quality is timing precision, not low-end transient loudness.
        const bpmWeight = 0.25 + this.bpmConfidence * 0.75;
        const rawGridConfidence = matchedRatio * (1 - averageError * 0.45) * bpmWeight;
        return this.clamp01(Math.min(rawGridConfidence, 0.25 + this.bpmConfidence * 1.4));
    }

    private computeDownbeatConfidence(best: number, sum: number, positiveCount: number): number {
        if (positiveCount <= 1 || best <= 0 || this.gridConfidence < 0.1) return 0.05;
        const meanOther = (sum - best) / Math.max(1, positiveCount - 1);
        const dominance = (best - meanOther) / Math.max(best, 0.000001);
        const rawDownbeat = this.clamp01(dominance * 0.75 + this.gridConfidence * 0.25);
        return Math.min(rawDownbeat, this.gridConfidence, this.bpmConfidence * 1.2);
    }

    private isTempoMultiple(candidate: number, reference: number): boolean {
        return Math.abs(candidate - reference) <= Math.max(1, reference * 0.035);
    }

    private resolveTempoAmbiguity(candidates: TempoCandidate[]): TempoCandidate[] {
        if (candidates.length < 2) return candidates;

        const top = candidates[0];
        let selected = top;
        let selectedScore = this.scoreTempoCandidate(top);

        for (const candidate of candidates.slice(1)) {
            const isAlias = this.isTempoMultiple(candidate.bpm * 2, top.bpm)
                || this.isTempoMultiple(candidate.bpm / 2, top.bpm)
                || this.isTempoMultiple(top.bpm * 2, candidate.bpm)
                || this.isTempoMultiple(top.bpm / 2, candidate.bpm);
            if (!isAlias) continue;
            if (top.score - candidate.score > 0.18) continue;

            const candidateScore = this.scoreTempoCandidate(candidate);
            if (candidateScore > selectedScore + 0.01) {
                selected = candidate;
                selectedScore = candidateScore;
            }
        }

        if (selected === top) return candidates;
        return [selected, ...candidates.filter(candidate => candidate !== selected)];
    }

    private scoreTempoCandidate(candidate: TempoCandidate): number {
        return candidate.score * 0.75 + this.musicalTempoPrior(candidate.bpm) * 0.25;
    }

    private musicalTempoPrior(bpm: number): number {
        if (bpm >= 90 && bpm <= 150) return 1;
        if (bpm >= 70 && bpm < 90) return 0.72 + (bpm - 70) / 20 * 0.18;
        if (bpm > 150 && bpm <= 180) return 0.82 - (bpm - 150) / 30 * 0.30;
        return 0.35;
    }

    private computeEvidenceCap(intervalCount: number): number {
        return this.clamp01(intervalCount / 12);
    }

    private computeKickTransientEvidenceCap(): number {
        if (this.onsetPeaks.length === 0) return 0.05;
        const sorted = [...this.onsetPeaks]
            .sort((a, b) => (b.flux * b.bass * Math.max(0, b.rmsRise)) - (a.flux * a.bass * Math.max(0, a.rmsRise)))
            .slice(0, Math.min(12, this.onsetPeaks.length));
        const avgBass = sorted.reduce((sum, peak) => sum + this.clamp01(peak.bass), 0) / sorted.length;
        const avgRise = sorted.reduce((sum, peak) => sum + Math.max(0, peak.rmsRise), 0) / sorted.length;
        const typRms = Math.max(0.000001, this.features.typRms || 0.000001);
        const riseSupport = this.clamp01((avgRise / typRms) * 3.0);
        const bassSupport = this.clamp01(avgBass * 0.78);
        return this.clamp01(Math.sqrt(riseSupport * bassSupport));
    }

    private computeRmsRise(index: number, rmsT: ArrayLike<number>): number {
        const start = Math.max(0, index - 8);
        let sum = 0;
        let count = 0;
        for (let i = start; i < index; i++) {
            sum += rmsT[i] || 0;
            count++;
        }
        const previous = count > 0 ? sum / count : rmsT[index] || 0;
        return Math.max(0, (rmsT[index] || 0) - previous);
    }

    private clamp01(value: number): number {
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    }
}

