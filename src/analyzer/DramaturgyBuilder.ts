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

    private buildBeatEvents(): void {
        const minGap = Math.max(0.1, (60 / this.grid.estimatedBPM) * 0.25);
        let lastBeatTime = -999;
        for (let i = 1; i < this.features.totalFrames - 1; i++) {
            let normFlux = this.features.fluxT[i] / this.features.typFlux;
            if (normFlux > 0.35 && this.features.fluxT[i] > this.features.fluxT[i - 1] && this.features.fluxT[i] > this.features.fluxT[i + 1]) {
                let time = i * this.hopSize / this.sampleRate;
                if (time - lastBeatTime > minGap) {
                    let type: 1|2|3 = mapToPublicType(classifyBeat(i, this.features));
                    this.events.push({ time, intensity: Math.min(normFlux, 1.0), type });
                    lastBeatTime = time;
                }
            }
        }
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

