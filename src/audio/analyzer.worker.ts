import type {
    AnalysisRequest,
    AudioFrame,
    BeatEvent,
    BarAnalysis,
    MusicPattern,
    PatternOccurrence,
    TrackAnalysis,
    TrackSection,
    TrackSectionLabel,
    VisualCueEvent,
    VisualCueKind,
    VisualFeatureFrame,
    TensionTrends
} from '../types';

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

function averageRange(values: number[], start: number, end: number) {
    let sum = 0;
    let count = 0;
    for (let i = start; i < end && i < values.length; i++) {
        sum += values[i];
        count++;
    }
    return count > 0 ? sum / count : 0;
}

function clampUnit(value: number) { return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)); }
function clampSigned(value: number) { return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0)); }

// --- SOLID ARCHITECTURE CLASSES ---

class FeatureExtractor {
    private channel: Float32Array;
    private hopSize: number;
    public totalFrames: number;
    public rmsT: Float32Array;
    public fluxT: Float32Array;
    public rawBassT: Float32Array;
    public rawMidT: Float32Array;
    public rawHighT: Float32Array;
    public centroidT: Float32Array;
    public flatnessT: Float32Array;
    public pitchConfidenceT: Float32Array;
    public typRms: number = 0;
    public typFlux: number = 0;

    constructor(channel: Float32Array, sampleRate: number, hopSize: number) {
        void sampleRate;
        this.channel = channel;
        this.hopSize = hopSize;
        this.totalFrames = Math.floor(channel.length / hopSize);
        this.rmsT = new Float32Array(this.totalFrames);
        this.fluxT = new Float32Array(this.totalFrames);
        this.rawBassT = new Float32Array(this.totalFrames);
        this.rawMidT = new Float32Array(this.totalFrames);
        this.rawHighT = new Float32Array(this.totalFrames);
        this.centroidT = new Float32Array(this.totalFrames);
        this.flatnessT = new Float32Array(this.totalFrames);
        this.pitchConfidenceT = new Float32Array(this.totalFrames);
    }

    public process(): void {
        const N = this.hopSize;
        const cosTable = new Float32Array(N / 2);
        const sinTable = new Float32Array(N / 2);
        for (let i = 0; i < N / 2; i++) {
            cosTable[i] = Math.cos((2 * Math.PI * i) / N);
            sinTable[i] = Math.sin((-2 * Math.PI * i) / N);
        }

        const windowMultiplier = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            windowMultiplier[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        }

        const re = new Float32Array(N);
        const im = new Float32Array(N);
        const prevMag = new Float32Array(N / 2);
        const processFFT = () => {
            let j = 0;
            for (let i = 0; i < N - 1; i++) {
                if (i < j) { let tr = re[j], ti = im[j]; re[j] = re[i]; im[j] = im[i]; re[i] = tr; im[i] = ti; }
                let k = N >> 1;
                while (k <= j) { j -= k; k >>= 1; }
                j += k;
            }
            for (let size = 2; size <= N; size *= 2) {
                let halfsize = size / 2;
                let tablestep = N / size;
                for (let i = 0; i < N; i += size) {
                    for (let j = i, k = 0; j < i + halfsize; j++, k += tablestep) {
                        let c = cosTable[k], s = sinTable[k];
                        let tr = re[j + halfsize] * c - im[j + halfsize] * s;
                        let ti = re[j + halfsize] * s + im[j + halfsize] * c;
                        re[j + halfsize] = re[j] - tr; im[j + halfsize] = im[j] - ti;
                        re[j] += tr; im[j] += ti;
                    }
                }
            }
        };

        for (let i = 0; i < this.totalFrames; i++) {
            let start = i * this.hopSize;
            let sumE = 0;
            for (let j = 0; j < this.hopSize; j++) {
                let sample = this.channel[start + j] || 0;
                sumE += sample * sample;
                re[j] = sample * windowMultiplier[j];
                im[j] = 0;
            }
            this.rmsT[i] = Math.sqrt(sumE / this.hopSize);

            processFFT();

            let sumMag = 0, sumFreqMag = 0, sumLogMag = 0;
            let currentFlux = 0, eB = 0, eM = 0, eH = 0;

            for (let k = 1; k < N / 2; k++) {
                let mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
                sumMag += mag;
                sumFreqMag += k * mag;
                sumLogMag += Math.log(mag + 1e-6);

                let fluxDiff = Math.max(0, mag - prevMag[k]);
                currentFlux += fluxDiff;
                prevMag[k] = mag;

                if (k <= 6) eB += mag;
                else if (k <= 93) eM += mag;
                else if (k <= 465) eH += mag;
            }

            this.fluxT[i] = currentFlux;
            let totalBand = eB + eM + eH + 1e-6;
            this.rawBassT[i] = eB / totalBand;
            this.rawMidT[i] = eM / totalBand;
            this.rawHighT[i] = eH / totalBand;
            
            this.centroidT[i] = sumMag > 0 ? (sumFreqMag / sumMag) / 512 : 0;
            this.flatnessT[i] = sumMag > 0 ? Math.exp(sumLogMag / 511) / (sumMag / 511) : 0;
            this.pitchConfidenceT[i] = Math.min(1, Math.max(0, 1 - this.flatnessT[i]));
        }

        const getTypicalMax = (arr: Float32Array) => {
            let sorted = new Float32Array(arr).sort();
            return sorted[Math.floor(sorted.length * 0.98)] || 0.001;
        };
        this.typRms = getTypicalMax(this.rmsT);
        this.typFlux = getTypicalMax(this.fluxT);
    }
}

class GridAligner {
    private features: FeatureExtractor;
    private sampleRate: number;
    private hopSize: number;
    public estimatedBPM: number = 120;
    public gridOffset: number = 0;
    public secondsPerBar: number = 2;
    public secondsPerBeat: number = 0.5;

    constructor(features: FeatureExtractor, sampleRate: number, hopSize: number) {
        this.features = features;
        this.sampleRate = sampleRate;
        this.hopSize = hopSize;
    }

    public calculate(): void {
        const { totalFrames, fluxT, rawBassT, typFlux } = this.features;
        const totalDuration = totalFrames * this.hopSize / this.sampleRate;

        // 1. ROBUST BPM DETECTION (Histogram based)
        let intervals: number[] = [];
        let tempLastBeat = 0;
        for (let i = 20; i < totalFrames - 20; i++) {
            let sum = 0; for(let j=i-20; j<=i+20; j++) sum += fluxT[j];
            let avg = sum / 41;
            if (fluxT[i] > avg * 1.5 && fluxT[i] > typFlux * 0.1) {
                if (fluxT[i] > fluxT[i-1] && fluxT[i] > fluxT[i+1]) {
                    let time = i * this.hopSize / this.sampleRate;
                    if (time - tempLastBeat > 0.3) {
                        intervals.push(Math.round(60 / (time - tempLastBeat)));
                        tempLastBeat = time;
                    }
                }
            }
        }

        if (intervals.length > 0) {
            let counts: Record<number, number> = {};
            let maxCount = 0;
            for (let b of intervals) {
                if (b >= 70 && b <= 180) {
                    counts[b] = (counts[b] || 0) + 1;
                    if (counts[b] > maxCount) { maxCount = counts[b]; this.estimatedBPM = b; }
                }
            }
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

            if (correlation > maxGlobalCorrelation) {
                maxGlobalCorrelation = correlation;
                bestBarOffset = testOffset;
            }
        }

        // 5. LOCK THE GLOBAL GRID OFFSET
        this.gridOffset = bestBarOffset % this.secondsPerBar;
        if (this.gridOffset < 0) this.gridOffset += this.secondsPerBar;
    }
}

class SectionAnalyzer {
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
        
        let firstBarStart = this.grid.gridOffset;
        while (firstBarStart > 0) firstBarStart -= this.grid.secondsPerBar;

        let barBlocks = [];
        for (let startSec = firstBarStart, barIndex = 0; startSec < totalDuration; startSec += this.grid.secondsPerBar, barIndex++) {
            let endSec = startSec + this.grid.secondsPerBar;
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
            let isAllowedCutPoint = (lengthBars % 8 === 0) || forceCut;
            let maxPhraseCut = lengthBars >= 16;

            if (maxPhraseCut || isAllowedCutPoint || isLastBar) {
                let startBar = barBlocks[currentSectionStartIdx];
                let endBar = barBlocks[i];
                let startIdx = startBar.startIdx;
                let endIdx = endBar.endIdx; // STRICT GRID. No micro-snapping.

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
                    start: startBar.startIdx * this.hopSize / this.sampleRate,
                    end: endBar.endIdx * this.hopSize / this.sampleRate,
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
}

class DramaturgyBuilder {
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
                    let type: 1|2|3 = this.features.rawHighT[i] > 0.55 ? 3 : this.features.rawBassT[i] > 0.35 ? 2 : 1;
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

// --- WORKER ENTRY POINT ---

self.onmessage = function(e: MessageEvent<AnalysisRequest>) {
    try {
        const { requestId, sampleRate, samples } = e.data;
        const channel = new Float32Array(samples);
        const hopSize = 1024;
        const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

        const features = new FeatureExtractor(channel, sampleRate, hopSize);
        features.process();

        const grid = new GridAligner(features, sampleRate, hopSize);
        grid.calculate();

        let outFrames: AudioFrame[] = new Array(features.totalFrames);
        let visualFeatures: VisualFeatureFrame[] = new Array(features.totalFrames);
        let sE=0, sMelody=0, sFx=0, sDensity=0, sBrightness=0, sTension=0;

        for (let i = 0; i < features.totalFrames; i++) {
            let normRms = Math.min(1.0, features.rmsT[i] / features.typRms);
            let normFlux = features.fluxT[i] / features.typFlux;
            let melodyTarget = Math.max(0, features.rawMidT[i] - 0.2) * 1.35;
            let fxTarget = features.rawHighT[i] * 1.45;

            sE += (normRms - sE) * 0.2;
            sDensity += (clamp01(normFlux) - sDensity) * 0.15;
            sMelody += (clamp01(melodyTarget) - sMelody) * 0.1;
            sFx += (clamp01(fxTarget) - sFx) * 0.15;
            sBrightness += (clamp01(features.centroidT[i] * 3.0) - sBrightness) * 0.1;
            sTension += (clamp01(sDensity * 0.5 + sBrightness * 0.5) - sTension) * 0.05;

            visualFeatures[i] = { melody: sMelody, vocal: sMelody * 0.8, fx: sFx, density: sDensity, brightness: sBrightness, tension: sTension };
            outFrames[i] = { e: sE, densityProj: sDensity, melodyProj: sMelody, fxProj: sFx, state: 'LOW', eRatio: sE };
        }

        const segmenter = new SectionAnalyzer(features, grid, sampleRate, hopSize);
        segmenter.calculate(visualFeatures);

        for (let i = 0; i < features.totalFrames; i++) {
            let time = i * hopSize / sampleRate;
            let bar = segmenter.barAnalyses.find(b => time >= b.start && time <= b.end);
            if (bar) {
                outFrames[i].state = bar.state;
                outFrames[i].eRatio = bar.energy;
                if (bar.state === 'HIGH' && outFrames[i].e < 0.35) outFrames[i].state = 'LOW_DROP';
            }
        }

        const dramaturgy = computeDramaturgyAnalysis(visualFeatures, outFrames, hopSize, sampleRate, Math.round(grid.secondsPerBar * sampleRate / hopSize * 8));
        const totalFrames = features.totalFrames;
        const featureFrames = visualFeatures;
        const spectralPivot = new Array<number>(totalFrames).fill(0);
        
        for (let i = 0; i < totalFrames; i++) {
            const eRatio = outFrames[i].eRatio;
            const buildup = dramaturgy.buildupConfidence[i] || 0;
            const state = outFrames[i].state;
            const sE = outFrames[i].e;
            if (sE > 0.04 && eRatio < 0.55 && (buildup > 0.1 || state === 'LOW_DROP')) {
                const compensation = (1.0 - eRatio) * Math.max(buildup, 0.25);
                const melodyGate = Math.max(0, featureFrames[i].melody - 0.05) * 1.1;
                const vocalGate = Math.max(0, featureFrames[i].vocal - 0.05) * 1.1;
                const fxGate = Math.max(0, featureFrames[i].fx - 0.05) * 1.1;
                const maxCeiling = Math.min(1.0, 0.35 + eRatio * 0.65 + buildup * 0.40);
                if (melodyGate > 0) featureFrames[i].melody = Math.min(maxCeiling, featureFrames[i].melody * (1.0 + compensation * 1.5 * melodyGate));
                if (vocalGate > 0) featureFrames[i].vocal = Math.min(maxCeiling, featureFrames[i].vocal * (1.0 + compensation * 1.5 * vocalGate));
                if (fxGate > 0) featureFrames[i].fx = Math.min(maxCeiling, featureFrames[i].fx * (1.0 + compensation * 2.2 * fxGate));
                featureFrames[i].tension = Math.min(maxCeiling, featureFrames[i].tension * (1.0 + compensation * 1.2));
                outFrames[i].melodyProj = featureFrames[i].melody;
                spectralPivot[i] = Math.min(1.0, compensation * Math.max(melodyGate, vocalGate, fxGate, 0.25));
            } else if (sE <= 0.04) {
                featureFrames[i].melody = 0; featureFrames[i].vocal = 0; featureFrames[i].fx = 0; featureFrames[i].tension = 0;
                outFrames[i].melodyProj = 0; outFrames[i].fxProj = 0; spectralPivot[i] = 0;
            }
        }

        const cueBuilder = new DramaturgyBuilder(features, grid, segmenter, sampleRate, hopSize);
        cueBuilder.calculate(featureFrames, outFrames);

        const trackAnalysis: TrackAnalysis = {
            duration: channel.length / sampleRate,
            bpm: grid.estimatedBPM,
            bars: segmenter.barAnalyses,
            sections: segmenter.trackSections,
            patterns: cueBuilder.musicPatterns,
            cues: cueBuilder.cues,
            significantMoments: cueBuilder.cues.filter(cue => cue.kind === 'impact' || cue.kind === 'break').slice(0, 32),
            features: featureFrames,
            buildupConfidence: dramaturgy.buildupConfidence,
            spectralPivot,
            tensionTrends: dramaturgy.tensionTrends,
            featureHopSize: hopSize,
            gridOffset: grid.gridOffset
        };

        self.postMessage({ type: 'analysis_done', requestId, bpm: grid.estimatedBPM, adaptiveThreshold: segmenter.adaptiveThreshold, frames: outFrames, events: cueBuilder.events, hopSize, trackAnalysis });
    } catch (error) {
        self.postMessage({ type: 'analysis_error', requestId: e.data.requestId, errorCode: 'ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Unknown error' });
    }
};
