import type { AudioFrame, BeatEvent, MusicPattern, PatternOccurrence, TensionTrends, TrackSection, VisualCueEvent, VisualCueKind, VisualFeatureFrame } from '../types';
import { classifyBeat, mapToPublicType } from './BeatEventClassifier';
import { FeatureExtractor } from './FeatureExtractor';
import { GridAligner } from './GridAligner';
import { SectionAnalyzer } from './SectionAnalyzer';
import { averageRange, clampSigned, clampUnit } from './utils';

export function computeDramaturgyAnalysis(
    featureFrames: VisualFeatureFrame[],
    frames: AudioFrame[],
    hopSize: number,
    sampleRate: number,
    alignmentFrameCount?: number
): { buildupConfidence: number[], tensionTrends: TensionTrends } {
    const count = Math.min(featureFrames.length, frames.length);
    const pressure = new Array<number>(count);

    for (let i = 0; i < count; i++) {
        const feature = featureFrames[i];
        const frame = frames[i];
        pressure[i] = clampUnit(
            feature.tension * 0.34 +
            feature.density * 0.28 +
            frame.e * 0.22 +
            frame.eRatio * 0.16
        );
    }

    const windowSize = Math.max(4, Math.floor(sampleRate / hopSize));
    const buildupConfidence = new Array<number>(count);
    for (let i = 0; i < count; i++) {
        const previous = averageRange(pressure, Math.max(0, i - windowSize), i);
        const current = averageRange(pressure, Math.max(0, i - Math.floor(windowSize / 2)), i + 1);
        const slope = current - previous;
        buildupConfidence[i] = clampUnit(slope * 4 + current * 0.18);
    }

    let peakValue = 0;
    let peakIndex = 0;
    for (let i = 0; i < pressure.length; i++) {
        if (pressure[i] > peakValue) {
            peakValue = pressure[i];
            peakIndex = i;
        }
    }

    if (alignmentFrameCount && alignmentFrameCount > 0) {
        for (let startIdx = 0; startIdx < count; startIdx += alignmentFrameCount) {
            const endIdx = Math.min(count, startIdx + alignmentFrameCount);
            const barValue = averageRange(buildupConfidence, startIdx, endIdx);
            for (let i = startIdx; i < endIdx; i++) buildupConfidence[i] = barValue;
        }
    }

    const segmentFrames = Math.max(alignmentFrameCount || windowSize * 4, 1);
    const segments: TensionTrends['segments'] = [];
    for (let startIdx = 0; startIdx < count; startIdx += segmentFrames) {
        const endIdx = Math.min(count, startIdx + segmentFrames);
        const startValue = pressure[startIdx] || 0;
        const endValue = pressure[Math.max(startIdx, endIdx - 1)] || 0;
        const delta = endValue - startValue;
        const direction = Math.abs(delta) < 0.03 ? 'stable' : delta > 0 ? 'rising' : 'falling';
        segments.push({
            start: startIdx * hopSize / sampleRate,
            end: endIdx * hopSize / sampleRate,
            startValue,
            endValue,
            direction,
            confidence: clampUnit(Math.abs(delta) * 2.5)
        });
    }

    const first = pressure[0] || 0;
    const last = pressure[pressure.length - 1] || first;

    return {
        buildupConfidence,
        tensionTrends: {
            globalSlope: clampSigned(last - first),
            peakTime: peakIndex * hopSize / sampleRate,
            peakValue,
            segments
        }
    };
}


export class DramaturgyBuilder {
    private features: FeatureExtractor;
    private grid: GridAligner;
    private segmenter: SectionAnalyzer;
    private sampleRate: number;
    private hopSize: number;
    public events: BeatEvent[] = [];
    public cues: VisualCueEvent[] = [];
    public musicPatterns: MusicPattern[] = [];

    constructor(features: FeatureExtractor, grid: GridAligner, segmenter: SectionAnalyzer, sampleRate: number, hopSize: number) {
        this.features = features;
        this.grid = grid;
        this.segmenter = segmenter;
        this.sampleRate = sampleRate;
        this.hopSize = hopSize;
    }

    public calculate(featureFrames: VisualFeatureFrame[], outFrames: AudioFrame[]): void {
        this.buildBeatEvents();
        this.buildCues(featureFrames, outFrames);
        this.buildPatterns();
    }

    // Beat events are derived from percussive onsets near the authoritative grid
    // (GridAligner.beats), so downstream consumers share the timing model without letting
    // extrapolated beats or sustained bass create visual impulses. Each event is typed and
    // weighted from the percussive peak frame, not from raw bass or broad flux alone.
    //
    // The DP beat tracker intentionally extrapolates the grid through silent breakdowns to
    // keep musical timing continuous, but a silent beat has no transient to react to. We
    // therefore suppress the *visual* event on beats whose local onset energy is negligible,
    // so breakdowns do not flood the renderer with phantom beat flashes. The grid itself
    // (grid.beats / grid.barStarts) still spans the silence.
    private buildBeatEvents(): void {
        const beats = this.grid.beats;
        if (beats.length > 0) {
            const percussiveFloor = this.adaptivePercussiveFloor();
            const sustainLimit = 0.82;
            const searchRadius = this.beatSearchRadiusFrames();
            const duplicateGap = Math.max(1, Math.floor(searchRadius / 2));
            let lastEventFrame = -999;
            for (const time of beats) {
                const frame = Math.max(0, Math.min(this.features.totalFrames - 1, Math.round(time * this.sampleRate / this.hopSize)));
                const peak = this.localPercussivePeak(frame, searchRadius);
                if (!peak) continue;
                if (peak.value < percussiveFloor) continue; // extrapolated beat in a silent/ambient region
                const sustain = this.features.bassSustainT[peak.frame] || 0;
                if (sustain >= sustainLimit && peak.value < Math.max(0.28, percussiveFloor * 1.55)) continue;
                if (this.isBasslineOnlyPeak(peak.frame)) continue;
                if (peak.frame - lastEventFrame < duplicateGap) continue;
                const intensity = Math.min(1, Math.max(0.05, peak.value));
                const type: 1 | 2 | 3 = mapToPublicType(classifyBeat(peak.frame, this.features));
                this.events.push({ time: peak.frame * this.hopSize / this.sampleRate, intensity, type });
                lastEventFrame = peak.frame;
            }
            this.addSupplementalPercussivePeaks(percussiveFloor);
            return;
        }

        // Fallback only when the grid produced no beats (e.g. silence): degrade to a
        // conservative percussive peak-picker so visuals still receive transient events.
        const minGap = Math.max(0.1, (60 / this.grid.estimatedBPM) * 0.25);
        const percussiveFloor = this.adaptivePercussiveFloor();
        let lastBeatTime = -999;
        for (let i = 1; i < this.features.totalFrames - 1; i++) {
            const percussiveScore = this.features.percussiveT[i] || 0;
            const bassSustainPenalty = this.features.bassSustainT[i] || 0;
            if (percussiveScore > percussiveFloor && (bassSustainPenalty < 0.82 || percussiveScore >= Math.max(0.28, percussiveFloor * 1.55)) && this.isPercussiveLocalMax(i)) {
                if (this.isBasslineOnlyPeak(i)) continue;
                let time = i * this.hopSize / this.sampleRate;
                if (time - lastBeatTime > minGap) {
                    let type: 1|2|3 = mapToPublicType(classifyBeat(i, this.features));
                    this.events.push({ time, intensity: Math.min(percussiveScore, 1.0), type });
                    lastBeatTime = time;
                }
            }
        }
    }

    private adaptivePercussiveFloor(): number {
        const peaks: number[] = [];
        for (let i = 1; i < this.features.totalFrames - 1; i++) {
            if (this.isPercussiveLocalMax(i)) peaks.push(this.features.percussiveT[i] || 0);
        }
        if (peaks.length === 0) return 0.18;
        peaks.sort((a, b) => a - b);
        const p50 = peaks[Math.floor(peaks.length * 0.50)] || 0;
        const p80 = peaks[Math.floor(peaks.length * 0.80)] || p50;
        return Math.max(0.10, Math.min(0.30, p50 * 0.45 + p80 * 0.20));
    }

    private beatSearchRadiusFrames(): number {
        const framesPerBeat = Math.max(1, this.grid.secondsPerBeat * this.sampleRate / this.hopSize);
        return Math.max(3, Math.min(6, Math.round(framesPerBeat * 0.18)));
    }

    // Peak percussive onset around a beat, so a real transient near the beat is captured
    // even if the grid frame is a few analysis hops off, while sustained bass reads as low.
    private localPercussivePeak(frame: number, radius: number): { frame: number; value: number } | null {
        let peakFrame = -1;
        let peakValue = 0;
        for (let i = frame - radius; i <= frame + radius; i++) {
            if (i >= 0 && i < this.features.totalFrames && this.isPercussiveLocalMax(i)) {
                const value = this.features.percussiveT[i] || 0;
                if (value > peakValue) {
                    peakValue = value;
                    peakFrame = i;
                }
            }
        }
        return peakFrame >= 0 ? { frame: peakFrame, value: peakValue } : null;
    }

    private isPercussiveLocalMax(frame: number): boolean {
        const current = this.features.percussiveT[frame] || 0;
        const previous = frame > 0 ? (this.features.percussiveT[frame - 1] || 0) : -Infinity;
        const next = frame < this.features.totalFrames - 1 ? (this.features.percussiveT[frame + 1] || 0) : -Infinity;
        return current > previous && current >= next;
    }

    private addSupplementalPercussivePeaks(percussiveFloor: number): void {
        const minGapSec = Math.max(0.06, Math.min(0.14, this.grid.secondsPerBeat * 0.25));
        const threshold = Math.max(0.22, percussiveFloor * 1.15);
        for (let i = 1; i < this.features.totalFrames - 1; i++) {
            const score = this.features.percussiveT[i] || 0;
            if (score < threshold || !this.isPercussiveLocalMax(i)) continue;
            const sustain = this.features.bassSustainT[i] || 0;
            if (sustain >= 0.82 && score < Math.max(0.32, percussiveFloor * 1.65)) continue;
            if (this.isBasslineOnlyPeak(i)) continue;
            const time = i * this.hopSize / this.sampleRate;
            if (this.events.some(event => Math.abs(event.time - time) < minGapSec)) continue;
            const type: 1 | 2 | 3 = mapToPublicType(classifyBeat(i, this.features));
            this.events.push({ time, intensity: Math.min(1, Math.max(0.05, score)), type });
        }
        this.events.sort((a, b) => a.time - b.time);
    }

    private isBasslineOnlyPeak(frame: number): boolean {
        const low = this.features.fluxLowT[frame] || 0;
        const midHigh = (this.features.fluxMidT[frame] || 0) + (this.features.fluxHighT[frame] || 0);
        const lowShare = low / (low + midHigh + 1e-6);
        if (midHigh > this.trackMidHighFluxP90() * 2.5) return false;
        return (this.features.rawBassT[frame] || 0) > 0.94
            && lowShare > 0.90
            && (this.features.rawHighT[frame] || 0) < 0.08
            && this.trackMidHighFluxRatio() < 0.18;
    }

    private cachedTrackMidHighFluxRatio: number | null = null;
    private cachedTrackMidHighFluxP90: number | null = null;

    private trackMidHighFluxRatio(): number {
        if (this.cachedTrackMidHighFluxRatio !== null) return this.cachedTrackMidHighFluxRatio;
        const low = this.percentileFlux(this.features.fluxLowT, 0.90);
        const midHigh = this.percentileCombinedFlux(this.features.fluxMidT, this.features.fluxHighT, 0.90);
        this.cachedTrackMidHighFluxRatio = midHigh / Math.max(low, 1e-6);
        return this.cachedTrackMidHighFluxRatio;
    }

    private trackMidHighFluxP90(): number {
        if (this.cachedTrackMidHighFluxP90 !== null) return this.cachedTrackMidHighFluxP90;
        this.cachedTrackMidHighFluxP90 = this.percentileCombinedFlux(this.features.fluxMidT, this.features.fluxHighT, 0.90);
        return this.cachedTrackMidHighFluxP90;
    }

    private percentileFlux(values: Float32Array, q: number): number {
        if (values.length === 0) return 0;
        const sorted = new Float32Array(values);
        sorted.sort();
        return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0;
    }

    private percentileCombinedFlux(a: Float32Array, b: Float32Array, q: number): number {
        const n = Math.min(a.length, b.length);
        if (n === 0) return 0;
        const combined = new Float32Array(n);
        for (let i = 0; i < n; i++) combined[i] = (a[i] || 0) + (b[i] || 0);
        combined.sort();
        return combined[Math.min(n - 1, Math.floor(n * q))] || 0;
    }

    private buildCues(featureFrames: VisualFeatureFrame[], outFrames: AudioFrame[]): void {
        const lastCueTimes: Record<VisualCueKind, number> = { melody: -999, vocal: -999, fx: -999, impact: -999, break: -999, pattern: -999 };
        const addCue = (frameIdx: number, kind: VisualCueKind, intensity: number, confidence: number, minGap: number, duration: number) => {
            let time = frameIdx * this.hopSize / this.sampleRate;
            if (time - lastCueTimes[kind] < minGap) return;
            this.cues.push({ time, duration, intensity: Math.min(1, Math.max(0, intensity)), confidence: Math.min(1, Math.max(0, confidence)), kind });
            lastCueTimes[kind] = time;
        };

        const secondsPerBeat = this.grid.secondsPerBar / 4;
        for (let i = 2; i < this.features.totalFrames - 2; i++) {
            let f = featureFrames[i];
            let prev = featureFrames[i - 1];
            let next = featureFrames[i + 1];
            if (f.melody > 0.52 && f.melody >= prev.melody && f.melody > next.melody) addCue(i, 'melody', f.melody, f.melody, 2.4, secondsPerBeat * 4);
            if (f.vocal > 0.48 && f.vocal >= prev.vocal && f.vocal > next.vocal) addCue(i, 'vocal', f.vocal, f.vocal, 3.2, secondsPerBeat * 8);
            if (f.fx > 0.62 && f.fx >= prev.fx && f.fx > next.fx) addCue(i, 'fx', f.fx, f.fx, 1.2, secondsPerBeat * 2);
            if (f.density > 0.72 && outFrames[i].eRatio > 0.5) addCue(i, 'impact', f.density, 1.0, 1.8, secondsPerBeat);
            if (outFrames[i].state === 'LOW_DROP' && outFrames[i - 1].state !== 'LOW_DROP') addCue(i, 'break', 1 - f.density * 0.5, 0.85, 4.0, secondsPerBeat * 8);
        }
    }

    private sectionPatternDistance(section: TrackSection, group: { centroidEnergy: number; centroidDensity: number; dominantFeature: VisualCueKind | 'rhythm' }): number {
        const energyDelta = section.energy - group.centroidEnergy;
        const densityDelta = section.density - group.centroidDensity;
        const featureDelta = section.dominantFeature === group.dominantFeature ? 0 : 0.36;
        return Math.sqrt(energyDelta * energyDelta + densityDelta * densityDelta + featureDelta * featureDelta);
    }

    private patternSignature(group: { sections: TrackSection[]; dominantFeature: VisualCueKind | 'rhythm'; centroidEnergy: number; centroidDensity: number }): string {
        const label = group.sections[0]?.label || 'verse';
        const energyBucket = Math.round(group.centroidEnergy * 10);
        const densityBucket = Math.round(group.centroidDensity * 10);
        return `${label}:${group.dominantFeature}:e${energyBucket}:d${densityBucket}`;
    }

    private buildPatterns(): void {
        const matchThreshold = 0.32;
        let patternGroups: Array<{
            sections: TrackSection[];
            indexes: number[];
            centroidEnergy: number;
            centroidDensity: number;
            dominantFeature: VisualCueKind | 'rhythm';
        }> = [];

        for (let i = 0; i < this.segmenter.trackSections.length; i++) {
            let section = this.segmenter.trackSections[i];
            if (section.end - section.start < this.grid.secondsPerBar) continue;

            let bestGroup: typeof patternGroups[number] | null = null;
            let bestDistance = Infinity;
            for (const group of patternGroups) {
                const distance = this.sectionPatternDistance(section, group);
                if (distance < bestDistance) {
                    bestGroup = group;
                    bestDistance = distance;
                }
            }

            if (!bestGroup || bestDistance > matchThreshold) {
                patternGroups.push({
                    sections: [section],
                    indexes: [i],
                    centroidEnergy: section.energy,
                    centroidDensity: section.density,
                    dominantFeature: section.dominantFeature
                });
                continue;
            }

            bestGroup.sections.push(section);
            bestGroup.indexes.push(i);
            const count = bestGroup.sections.length;
            bestGroup.centroidEnergy += (section.energy - bestGroup.centroidEnergy) / count;
            bestGroup.centroidDensity += (section.density - bestGroup.centroidDensity) / count;
        }

        this.musicPatterns = patternGroups
            .filter(group => group.sections.length >= 2)
            .map((group, patternIdx) => {
                let occurrences: PatternOccurrence[] = group.sections.map((section, occurrenceIdx) => ({
                    start: section.start, end: section.end,
                    intensity: Math.min(1, Math.max(0, section.energy)),
                    confidence: Math.min(1, 0.6 + occurrenceIdx * 0.05)
                }));
                let averageEnergy = group.sections.reduce((sum, section) => sum + section.energy, 0) / group.sections.length;
                let averageDensity = group.sections.reduce((sum, section) => sum + section.density, 0) / group.sections.length;
                return {
                    id: `pattern-${patternIdx}`, signature: this.patternSignature(group), label: group.sections[0].label,
                    dominantFeature: group.sections[0].dominantFeature, occurrences, averageEnergy, averageDensity
                };
            });
    }
}

