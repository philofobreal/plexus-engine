import type { BarAnalysis, TrackSection, TrackSectionLabel, VisualCueKind, VisualFeatureFrame } from '../types';
import { FeatureExtractor } from './FeatureExtractor';
import { GridAligner } from './GridAligner';
import { clampUnit } from './utils';

export class SectionAnalyzer {
    private features: FeatureExtractor;
    private grid: GridAligner;
    private sampleRate: number;
    private hopSize: number;
    public barAnalyses: BarAnalysis[] = [];
    public trackSections: TrackSection[] = [];
    public adaptiveThreshold: number = 0.5;

    constructor(features: FeatureExtractor, grid: GridAligner, sampleRate: number, hopSize: number) {
        this.features = features;
        this.grid = grid;
        this.sampleRate = sampleRate;
        this.hopSize = hopSize;
    }

    private scoreSectionLabel(input: {
        avgEnergy: number;
        previousEnergy: number;
        avgDensity: number;
        avgBass: number;
        tension: number;
        dominantFeature: VisualCueKind | 'rhythm';
        isFirstSection: boolean;
        isLastSection: boolean;
    }): TrackSectionLabel {
        const confidenceFloor = 0.28;
        const energyRise = clampUnit(Math.max(0, input.avgEnergy - input.previousEnergy) * 2.5);
        const energyFall = clampUnit(Math.max(0, input.previousEnergy - input.avgEnergy) * 2.5);
        const afterLowEnergy = this.scoreBelow(input.previousEnergy, 0.42, 0.28);
        const afterHighEnergy = this.scoreAbove(input.previousEnergy, 0.58, 0.28);
        const firstSection = input.isFirstSection ? 1 : 0;
        const lastSection = input.isLastSection ? 1 : 0;
        const featureAffinity = (features: Array<VisualCueKind | 'rhythm'>) => features.includes(input.dominantFeature) ? 1 : 0;

        // Tune these weights instead of adding rigid threshold branches. Each factor is already normalized to 0..1.
        const scores: Record<TrackSectionLabel, number> = {
            intro: this.weightedScore([
                [this.scoreBelow(input.avgEnergy, 0.42, 0.30), 0.32],
                [this.scoreBelow(input.avgDensity, 0.45, 0.30), 0.20],
                [this.scoreBelow(input.avgBass, 0.38, 0.28), 0.14],
                [firstSection, 0.22],
                [featureAffinity(['melody', 'vocal', 'rhythm']), 0.12]
            ]),
            verse: this.weightedScore([
                [this.scoreNear(input.avgEnergy, 0.46, 0.34), 0.32],
                [this.scoreNear(input.avgDensity, 0.50, 0.36), 0.24],
                [this.scoreBelow(input.tension, 0.65, 0.36), 0.16],
                [featureAffinity(['vocal', 'melody', 'rhythm']), 0.18],
                [this.scoreNear(energyRise, 0.50, 0.36), 0.10]
            ]),
            build: this.weightedScore([
                [this.scoreAbove(input.tension, 0.46, 0.34), 0.34],
                [this.scoreAbove(input.avgDensity, 0.48, 0.34), 0.18],
                [this.scoreNear(input.avgEnergy, 0.55, 0.34), 0.18],
                [energyRise, 0.18],
                [this.scoreBelow(input.avgBass, 0.50, 0.32), 0.12]
            ]),
            drop: this.weightedScore([
                [this.scoreAbove(input.avgEnergy, 0.50, 0.30), 0.30],
                [this.scoreAbove(input.avgBass, 0.34, 0.26), 0.20],
                [this.scoreAbove(input.avgDensity, 0.50, 0.32), 0.18],
                [energyRise * afterLowEnergy, 0.22],
                [featureAffinity(['rhythm', 'impact', 'fx']), 0.10]
            ]),
            break: this.weightedScore([
                [this.scoreBelow(input.avgEnergy, 0.48, 0.32), 0.30],
                [this.scoreBelow(input.avgBass, 0.36, 0.28), 0.18],
                [this.scoreBelow(input.avgDensity, 0.46, 0.32), 0.18],
                [energyFall * afterHighEnergy, 0.22],
                [featureAffinity(['break', 'melody', 'vocal']), 0.12]
            ]),
            peak: this.weightedScore([
                [this.scoreAbove(input.avgEnergy, 0.62, 0.24), 0.34],
                [this.scoreAbove(input.avgBass, 0.42, 0.24), 0.18],
                [this.scoreAbove(input.avgDensity, 0.62, 0.26), 0.20],
                [this.scoreAbove(input.tension, 0.56, 0.30), 0.16],
                [featureAffinity(['fx', 'impact', 'rhythm']), 0.12]
            ]),
            outro: this.weightedScore([
                [this.scoreBelow(input.avgEnergy, 0.42, 0.30), 0.30],
                [this.scoreBelow(input.avgDensity, 0.44, 0.30), 0.18],
                [this.scoreBelow(input.avgBass, 0.36, 0.28), 0.14],
                [lastSection, 0.26],
                [energyFall, 0.12]
            ])
        };

        let bestLabel: TrackSectionLabel = 'verse';
        let bestScore = scores.verse;
        for (const label of ['intro', 'verse', 'build', 'drop', 'break', 'peak', 'outro'] as TrackSectionLabel[]) {
            if (scores[label] > bestScore) {
                bestLabel = label;
                bestScore = scores[label];
            }
        }

        return bestScore >= confidenceFloor ? bestLabel : 'verse';
    }

    private weightedScore(factors: Array<[number, number]>): number {
        let weightedSum = 0;
        let totalWeight = 0;
        for (const [value, weight] of factors) {
            weightedSum += clampUnit(value) * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? clampUnit(weightedSum / totalWeight) : 0;
    }

    private scoreAbove(value: number, knee: number, width: number): number {
        return clampUnit((value - knee) / Math.max(width, 0.001));
    }

    private scoreBelow(value: number, knee: number, width: number): number {
        return clampUnit((knee - value) / Math.max(width, 0.001));
    }

    private scoreNear(value: number, target: number, width: number): number {
        return clampUnit(1 - Math.abs(value - target) / Math.max(width, 0.001));
    }

    public calculate(visualFeatures: VisualFeatureFrame[]): void {
        const { totalFrames, rmsT, rawBassT, rawMidT, rawHighT, typRms } = this.features;
        const totalDuration = totalFrames * this.hopSize / this.sampleRate;
        // Fall back to energy boundaries only when the tempo grid is critically unusable.
        const useEnergyReactiveBoundaries = this.grid.gridConfidence < 0.15 && this.grid.bpmConfidence < 0.20;
        const analysisStepSec = useEnergyReactiveBoundaries
            ? Math.min(4, Math.max(1, totalDuration / 24))
            : this.grid.secondsPerBar;

        let firstBarStart = useEnergyReactiveBoundaries ? 0 : this.grid.gridOffset;
        while (firstBarStart > 0) firstBarStart -= analysisStepSec;

        let barBlocks = [];
        for (let startSec = firstBarStart, barIndex = 0; startSec < totalDuration; startSec += analysisStepSec, barIndex++) {
            let endSec = startSec + analysisStepSec;
            let startIdx = Math.max(0, Math.floor(startSec * this.sampleRate / this.hopSize));
            let endIdx = Math.min(totalFrames, Math.floor(endSec * this.sampleRate / this.hopSize));
            if (startIdx >= totalFrames) break;
            if (endIdx <= startIdx) continue;

            let sumE = 0, peakE = 0, sumBass = 0, sumMid = 0, sumHigh = 0;
            let count = endIdx - startIdx;
            for (let j = startIdx; j < endIdx; j++) {
                sumE += rmsT[j];
                peakE = Math.max(peakE, rmsT[j]);
                sumBass += rawBassT[j];
                sumMid += rawMidT[j];
                sumHigh += rawHighT[j];
            }
            barBlocks.push({
                index: barIndex, startIdx, endIdx,
                avgE: sumE / count, peakE,
                avgBass: sumBass / count, avgMid: sumMid / count, avgHigh: sumHigh / count
            });
        }

        if(barBlocks.length === 0) return;

        let gMinAvgE = Math.min(...barBlocks.map(b => b.avgE));
        let gMaxAvgE = Math.max(...barBlocks.map(b => b.avgE));
        const sortedEnergies = barBlocks.map(b => b.avgE).sort((a, b) => a - b);
        const medianEnergy = sortedEnergies[Math.floor(sortedEnergies.length / 2)] || 0.45;
        this.adaptiveThreshold = Math.min(0.6, Math.max(0.3, (gMaxAvgE - gMinAvgE) > 0 ? (medianEnergy - gMinAvgE) / (gMaxAvgE - gMinAvgE) : 0.45));

        const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
        const averageFeature = (sIdx: number, eIdx: number, pick: (f: VisualFeatureFrame) => number) => {
            let sum = 0, count = Math.max(1, eIdx - sIdx);
            for (let i = sIdx; i < eIdx && i < visualFeatures.length; i++) sum += pick(visualFeatures[i]);
            return sum / count;
        };

        const dominantFeature = (sIdx: number, eIdx: number): VisualCueKind | 'rhythm' => {
            let melody = averageFeature(sIdx, eIdx, f => f.melody);
            let vocal = averageFeature(sIdx, eIdx, f => f.vocal);
            let fx = averageFeature(sIdx, eIdx, f => f.fx);
            let density = averageFeature(sIdx, eIdx, f => f.density);
            let maxF = Math.max(melody, vocal, fx, density);
            return maxF === vocal ? 'vocal' : maxF === melody ? 'melody' : maxF === fx ? 'fx' : 'rhythm';
        };

        this.barAnalyses = barBlocks.map(bar => {
            let energy = (gMaxAvgE - gMinAvgE) > 0 ? (bar.avgE - gMinAvgE) / (gMaxAvgE - gMinAvgE) : 0;
            return {
                index: bar.index,
                start: bar.startIdx * this.hopSize / this.sampleRate,
                end: bar.endIdx * this.hopSize / this.sampleRate,
                energy,
                density: averageFeature(bar.startIdx, bar.endIdx, f => f.density),
                avgRms: clamp01(bar.avgE / typRms),
                peakRms: clamp01(bar.peakE / typRms),
                bass: clamp01(bar.avgBass),
                mid: clamp01(bar.avgMid),
                treble: clamp01(bar.avgHigh),
                state: energy >= this.adaptiveThreshold ? 'HIGH' : 'LOW',
                dominantFeature: dominantFeature(bar.startIdx, bar.endIdx)
            };
        });

        let currentSectionStartIdx = 0;

        for (let i = 0; i < this.barAnalyses.length; i++) {
            let isLastBar = i === this.barAnalyses.length - 1;
            let currentBar = this.barAnalyses[i];
            let nextBar = i < this.barAnalyses.length - 1 ? this.barAnalyses[i + 1] : null;
            let lengthBars = i - currentSectionStartIdx + 1;

            // DERIVATIVE EDGE DETECTION: Significant structural changes
            let isBassDrop = nextBar && (nextBar.bass - currentBar.bass > 0.25) && nextBar.energy > 0.45;
            let isEnergyDrop = nextBar && (currentBar.energy - nextBar.energy > 0.25) && nextBar.bass < 0.35;
            let isExplosion = nextBar && (nextBar.energy - currentBar.energy > 0.3);

            let forceCut = isBassDrop || isEnergyDrop || isExplosion;
            let isAllowedCutPoint = useEnergyReactiveBoundaries
                ? forceCut || lengthBars >= 4
                : (lengthBars % 8 === 0) || forceCut;
            let maxPhraseCut = useEnergyReactiveBoundaries ? lengthBars >= 8 : lengthBars >= 16;

            if (maxPhraseCut || isAllowedCutPoint || isLastBar) {
                let startBar = barBlocks[currentSectionStartIdx];
                let endBar = barBlocks[i];
                let startIdx = startBar.startIdx;
                let endIdx = useEnergyReactiveBoundaries
                    ? this.findEnergyReactiveBoundary(endBar.endIdx, Math.max(2, Math.floor((endBar.endIdx - endBar.startIdx) * 0.45)))
                    : endBar.endIdx; // STRICT GRID. No micro-snapping.
                if (this.trackSections.length > 0 && useEnergyReactiveBoundaries) {
                    startIdx = Math.floor(this.trackSections[this.trackSections.length - 1].end * this.sampleRate / this.hopSize);
                }
                endIdx = Math.max(startIdx + 1, Math.min(totalFrames, endIdx));

                let sumEnergy = 0, sumBass = 0;
                for(let k = currentSectionStartIdx; k <= i; k++) {
                    sumEnergy += this.barAnalyses[k].energy;
                    sumBass += this.barAnalyses[k].bass;
                }
                let avgEnergy = sumEnergy / lengthBars;
                let avgBass = sumBass / lengthBars;

                let tension = averageFeature(startIdx, endIdx, f => f.tension);
                let avgDensity = averageFeature(startIdx, endIdx, f => f.density);
                let sectionDominantFeature = dominantFeature(startIdx, endIdx);
                let previousEnergy = this.trackSections.length > 0 ? this.trackSections[this.trackSections.length - 1].energy : avgEnergy;
                let label = this.scoreSectionLabel({
                    avgEnergy,
                    previousEnergy,
                    avgDensity,
                    avgBass,
                    tension,
                    dominantFeature: sectionDominantFeature,
                    isFirstSection: this.trackSections.length === 0,
                    isLastSection: isLastBar
                });

                let rms = {
                    avgRms: clamp01(avgEnergy),
                    peakRms: clamp01(Math.max(...barBlocks.slice(currentSectionStartIdx, i+1).map(b=>b.peakE))/typRms)
                };

                this.trackSections.push({
                    start: startIdx * this.hopSize / this.sampleRate,
                    end: endIdx * this.hopSize / this.sampleRate,
                    label,
                    energy: avgEnergy,
                    density: avgDensity,
                    dominantFeature: sectionDominantFeature,
                    avgRms: rms.avgRms,
                    peakRms: rms.peakRms
                });

                currentSectionStartIdx = i + 1;
            }
        }
    }

    private findEnergyReactiveBoundary(centerIdx: number, radiusFrames: number): number {
        const { totalFrames, rmsT, fluxT } = this.features;
        const start = Math.max(1, centerIdx - radiusFrames);
        const end = Math.min(totalFrames - 2, centerIdx + radiusFrames);
        let bestIdx = Math.max(1, Math.min(totalFrames - 1, centerIdx));
        let bestScore = -Infinity;

        for (let i = start; i <= end; i++) {
            const prev = rmsT[i - 1] || 0;
            const next = rmsT[i + 1] || 0;
            const energyEdge = Math.abs(next - prev);
            const localFlux = fluxT[i] || 0;
            const centerPenalty = Math.abs(i - centerIdx) / Math.max(1, radiusFrames);
            const score = energyEdge * 0.65 + localFlux * 0.35 - centerPenalty * 0.08;
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        return bestIdx;
    }
}

