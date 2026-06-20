import type { AnalysisReason, BarAnalysis, NoveltyPoint, SectionBoundaryCandidate, TrackSection, TrackSectionLabel, VisualCueKind, VisualFeatureFrame } from '../types';
import { FeatureExtractor } from './FeatureExtractor';
import { GridAligner } from './GridAligner';
import { clampUnit } from './utils';

// A novelty peak must clear this to actively drive (snap) an energy-reactive boundary.
const NOVELTY_SNAP_THRESHOLD = 0.3;

export class SectionAnalyzer {
    private features: FeatureExtractor;
    private grid: GridAligner;
    private sampleRate: number;
    private hopSize: number;
    private noveltyPeaks: NoveltyPoint[] = [];
    public barAnalyses: BarAnalysis[] = [];
    public trackSections: TrackSection[] = [];
    public boundaryCandidates: SectionBoundaryCandidate[] = [];
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
        precedingEnergy: number;
        precedingBass: number;
        avgDensity: number;
        avgBass: number;
        tension: number;
        dominantFeature: VisualCueKind | 'rhythm';
        isFirstSection: boolean;
        isLastSection: boolean;
        precededByBuildup: boolean;
        precededByBreak: boolean;
        precededByContext: boolean;
    }): { label: TrackSectionLabel; reasons: AnalysisReason[] } {
        const confidenceFloor = 0.28;
        const energyRise = clampUnit(Math.max(0, input.avgEnergy - input.previousEnergy) * 2.5);
        const energyFall = clampUnit(Math.max(0, input.previousEnergy - input.avgEnergy) * 2.5);
        const afterHighEnergy = this.scoreAbove(input.previousEnergy, 0.58, 0.28);
        const firstSection = input.isFirstSection ? 1 : 0;
        const lastSection = input.isLastSection ? 1 : 0;
        const featureAffinity = (features: Array<VisualCueKind | 'rhythm'>) => features.includes(input.dominantFeature) ? 1 : 0;

        // Multi-timeframe contrast: a drop is a high-energy ARRIVAL out of a quieter run of bars
        // (a break or a buildup), not merely a loud passage. Contrast against the preceding 4-8
        // bars plus an explicit buildup/break arrival bonus prevents a loud verse from reading as
        // a drop, while a real post-breakdown/post-buildup drop scores strongly.
        const dropContrast = clampUnit(Math.max(0, input.avgEnergy - input.precedingEnergy) * 2.2);
        const afterLowContext = this.scoreBelow(input.precedingEnergy, 0.45, 0.30);
        const bassReturn = clampUnit(Math.max(0, input.avgBass - input.precedingBass) * 2.2);
        // The energy-contrast arrival only counts once a real "before" exists (more than just the
        // intro), so the first groove out of a quiet intro is not mistaken for a drop. An explicit
        // preceding buildup or break section is itself sufficient prior context.
        const earlyDamp = input.precededByContext ? 1 : 0;
        const dropArrival = clampUnit(
            (input.precededByBuildup ? 0.6 : 0) +
            (input.precededByBreak ? 0.5 : 0) +
            dropContrast * afterLowContext * earlyDamp
        );

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
                [this.scoreAbove(input.avgEnergy, 0.52, 0.30), 0.24],
                [this.scoreAbove(input.avgBass, 0.34, 0.26), 0.18],
                [this.scoreAbove(input.avgDensity, 0.50, 0.32), 0.14],
                [dropArrival, 0.34],
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

        const label = bestScore >= confidenceFloor ? bestLabel : 'verse';

        // Justify the chosen label with the contrast evidence that drove it.
        const reasons: AnalysisReason[] = [];
        if (label === 'drop') {
            if (input.precededByBuildup) reasons.push('after-buildup');
            if (input.precededByBreak || afterLowContext > 0.5) reasons.push('energy-rise');
            if (bassReturn > 0.2) reasons.push('bass-return');
        } else if (label === 'build') {
            reasons.push('energy-rise');
            if (this.scoreAbove(input.tension, 0.46, 0.34) > 0.5) reasons.push('density-rise');
        } else if (label === 'break') {
            reasons.push('energy-drop');
            if (input.avgBass < input.precedingBass - 0.1) reasons.push('bass-drop');
        } else if (label === 'peak') {
            if (energyRise > 0.3) reasons.push('energy-rise');
        }
        if (input.isFirstSection || input.isLastSection) reasons.push('section-position');

        return { label, reasons };
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

    public calculate(visualFeatures: VisualFeatureFrame[], noveltyPeaks: NoveltyPoint[] = []): void {
        this.noveltyPeaks = noveltyPeaks;
        const { totalFrames, rmsT, rawBassT, rawMidT, rawHighT, typRms } = this.features;
        const totalDuration = totalFrames * this.hopSize / this.sampleRate;
        // Fall back to energy boundaries only when the tempo grid is critically unusable.
        const useEnergyReactiveBoundaries = this.grid.gridConfidence < 0.15 && this.grid.bpmConfidence < 0.20;

        // Surface the novelty-derived candidate boundaries: snapped to bars when the grid is
        // trusted, left at their raw novelty time (and flagged low-grid) when it is not.
        this.boundaryCandidates = noveltyPeaks.map(peak => this.toBoundaryCandidate(peak, useEnergyReactiveBoundaries));
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
                const boundary = this.resolveBoundary(endBar, useEnergyReactiveBoundaries, isLastBar);
                let endIdx = boundary.endIdx;
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
                const previousSection = this.trackSections.length > 0 ? this.trackSections[this.trackSections.length - 1] : null;
                // Multi-bar lookback: the preceding 4-8 bars before this section, for drop contrast.
                const lookbackStart = Math.max(0, currentSectionStartIdx - 8);
                let precedingEnergy = avgEnergy;
                let precedingBass = avgBass;
                if (currentSectionStartIdx > 0) {
                    let sumPrevE = 0, sumPrevBass = 0, prevCount = 0;
                    for (let k = lookbackStart; k < currentSectionStartIdx; k++) {
                        sumPrevE += this.barAnalyses[k].energy;
                        sumPrevBass += this.barAnalyses[k].bass;
                        prevCount++;
                    }
                    if (prevCount > 0) { precedingEnergy = sumPrevE / prevCount; precedingBass = sumPrevBass / prevCount; }
                }
                const precededByContext = this.trackSections.length >= 2;
                const precededByBuildup = previousSection?.label === 'build';
                const precededByBreak = previousSection?.label === 'break' || (precedingEnergy < 0.30 && precededByContext);
                const scored = this.scoreSectionLabel({
                    avgEnergy,
                    previousEnergy,
                    precedingEnergy,
                    precedingBass,
                    avgDensity,
                    avgBass,
                    tension,
                    dominantFeature: sectionDominantFeature,
                    isFirstSection: this.trackSections.length === 0,
                    isLastSection: isLastBar,
                    precededByBuildup,
                    precededByBreak,
                    precededByContext
                });
                let label = scored.label;

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
                    peakRms: rms.peakRms,
                    reasons: this.dedup([...boundary.reasons, ...scored.reasons])
                });

                currentSectionStartIdx = i + 1;
            }
        }
    }

    // Decides the frame index for a section's trailing boundary and explains the decision.
    // STRICT GRID stays bit-identical to the previous behavior (no boundary movement); only the
    // novelty-aware ENERGY-REACTIVE path may snap a boundary onto a strong novelty peak.
    private resolveBoundary(
        endBar: { startIdx: number; endIdx: number },
        useEnergyReactiveBoundaries: boolean,
        isLastBar: boolean
    ): { endIdx: number; timingMode: SectionBoundaryCandidate['timingMode']; reasons: AnalysisReason[] } {
        const secondsPerFrame = this.hopSize / this.sampleRate;

        if (!useEnergyReactiveBoundaries) {
            const endIdx = endBar.endIdx; // STRICT GRID. No micro-snapping.
            const reasons: AnalysisReason[] = ['bar-aligned'];
            const near = this.nearestPeak(endIdx * secondsPerFrame, this.grid.secondsPerBar * 0.5);
            if (near) for (const r of near.reasons) if (!reasons.includes(r)) reasons.push(r);
            if (isLastBar) reasons.push('section-position');
            return { endIdx, timingMode: 'bar-aligned', reasons };
        }

        const radiusFrames = Math.max(2, Math.floor((endBar.endIdx - endBar.startIdx) * 0.45));
        const candidateTime = endBar.endIdx * secondsPerFrame;
        const radiusSec = radiusFrames * secondsPerFrame;
        const peak = this.nearestPeak(candidateTime, radiusSec, NOVELTY_SNAP_THRESHOLD);

        if (peak) {
            const endIdx = Math.round(peak.time / secondsPerFrame);
            return { endIdx, timingMode: 'novelty', reasons: this.dedup(['low-grid-confidence', ...peak.reasons]) };
        }

        const endIdx = this.findEnergyReactiveBoundary(endBar.endIdx, radiusFrames);
        const reasons: AnalysisReason[] = ['low-grid-confidence', 'weak-evidence-fallback'];
        const direction = this.energyDirectionReason(endIdx);
        if (direction) reasons.push(direction);
        if (isLastBar) reasons.push('section-position');
        return { endIdx, timingMode: 'energy-reactive', reasons };
    }

    private toBoundaryCandidate(peak: NoveltyPoint, useEnergyReactiveBoundaries: boolean): SectionBoundaryCandidate {
        if (useEnergyReactiveBoundaries) {
            return {
                time: peak.time,
                confidence: clampUnit(peak.value),
                timingMode: 'novelty',
                reasons: this.dedup([...peak.reasons, 'low-grid-confidence'])
            };
        }
        return {
            time: this.snapToBar(peak.time),
            confidence: clampUnit(peak.value * this.grid.gridConfidence),
            timingMode: 'bar-aligned',
            reasons: peak.reasons.length ? peak.reasons.slice() : ['novelty-peak']
        };
    }

    private snapToBar(time: number): number {
        const spb = this.grid.secondsPerBar;
        if (!(spb > 0)) return time;
        const offset = this.grid.gridOffset || 0;
        return offset + Math.round((time - offset) / spb) * spb;
    }

    private nearestPeak(time: number, radiusSec: number, minValue = 0): NoveltyPoint | null {
        let best: NoveltyPoint | null = null;
        let bestDistance = Infinity;
        for (const peak of this.noveltyPeaks) {
            if (peak.value < minValue) continue;
            const distance = Math.abs(peak.time - time);
            if (distance <= radiusSec && distance < bestDistance) {
                bestDistance = distance;
                best = peak;
            }
        }
        return best;
    }

    private energyDirectionReason(frameIndex: number): AnalysisReason | null {
        const { rmsT, totalFrames } = this.features;
        const before = rmsT[Math.max(0, frameIndex - 2)] ?? 0;
        const after = rmsT[Math.min(totalFrames - 1, frameIndex + 2)] ?? 0;
        if (after - before > 0.05) return 'energy-rise';
        if (before - after > 0.05) return 'energy-drop';
        return null;
    }

    private dedup(reasons: AnalysisReason[]): AnalysisReason[] {
        const out: AnalysisReason[] = [];
        for (const r of reasons) if (!out.includes(r)) out.push(r);
        return out;
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

