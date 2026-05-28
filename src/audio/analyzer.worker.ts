import type {
    AnalysisRequest,
    AudioFrame,
    BeatEvent,
    AnalysisResult,
    BarAnalysis,
    TrackAnalysis,
    TrackSection,
    TrackSectionLabel,
    VisualCueEvent,
    VisualCueKind,
    VisualFeatureFrame,
    MusicPattern,
    PatternOccurrence,
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

function clampUnit(value: number) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clampSigned(value: number) {
    return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
}

self.onmessage = function(e: MessageEvent<AnalysisRequest>) {
    try {
        const requestId = e.data.requestId;
        const channel = new Float32Array(e.data.samples);
        const sampleRate = e.data.sampleRate;
        const hopSize = 1024; 
        const totalFrames = Math.floor(channel.length / hopSize);
        const N = hopSize;

        // --- 1. FFT setup ---
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

        function processFFT(real: Float32Array, imag: Float32Array) {
            let j = 0;
            for (let i = 0; i < N - 1; i++) {
                if (i < j) {
                    let tr = real[j], ti = imag[j];
                    real[j] = real[i]; imag[j] = imag[i];
                    real[i] = tr; imag[i] = ti;
                }
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
                        let tr = real[j + halfsize] * c - imag[j + halfsize] * s;
                        let ti = real[j + halfsize] * s + imag[j + halfsize] * c;
                        real[j + halfsize] = real[j] - tr;
                        imag[j + halfsize] = imag[j] - ti;
                        real[j] += tr;
                        imag[j] += ti;
                    }
                }
            }
        }

        function getTypicalMax(arr: Float32Array) {
            let sorted = new Float32Array(arr).sort();
            return sorted[Math.floor(sorted.length * 0.98)] || 0.001;
        }

        function clamp01(value: number) {
            return Math.min(1, Math.max(0, value));
        }

        // --- 2. Pass 1: raw spectral data ---
        let rmsT = new Float32Array(totalFrames);
        let fluxT = new Float32Array(totalFrames);
        let rawBassT = new Float32Array(totalFrames);
        let rawMidT = new Float32Array(totalFrames);
        let rawHighT = new Float32Array(totalFrames);
        let flatnessT = new Float32Array(totalFrames);
        let centroidT = new Float32Array(totalFrames);
        let harmonicStabilityT = new Float32Array(totalFrames);
        let transientRatioT = new Float32Array(totalFrames);
        let pitchConfidenceT = new Float32Array(totalFrames);
        let formantRatioT = new Float32Array(totalFrames);

        let re = new Float32Array(N);
        let im = new Float32Array(N);
        let prevMag = new Float32Array(N / 2);
        const binHz = sampleRate / N;

        for (let i = 0; i < totalFrames; i++) {
            let start = i * hopSize; 
            let sumE = 0;

            for (let j = 0; j < hopSize; j++) { 
                let sample = channel[start + j] || 0;
                sumE += sample * sample;
                re[j] = sample * windowMultiplier[j];
                im[j] = 0;
            }
            rmsT[i] = Math.sqrt(sumE / hopSize);

            processFFT(re, im);

            let sumMag = 0, sumFreqMag = 0, sumLogMag = 0;
            let currentFlux = 0, eB = 0, eM = 0, eH = 0;
            let stableEnergy = 0, transientEnergy = 0, formantLow = 0, formantHigh = 0;
            let hpsBest = 0, hpsSum = 0;

            for (let k = 1; k < N / 2; k++) {
                let mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
                let freq = k * binHz;
                sumMag += mag;
                sumFreqMag += k * mag;
                sumLogMag += Math.log(mag + 1e-6);

                let fluxDiff = Math.max(0, mag - prevMag[k]);
                currentFlux += fluxDiff;
                stableEnergy += Math.min(mag, prevMag[k]);
                transientEnergy += fluxDiff;
                prevMag[k] = mag;

                if (k <= 6) eB += mag;
                else if (k <= 93) eM += mag;
                else if (k <= 465) eH += mag;

                if (freq >= 300 && freq <= 1000) formantLow += mag;
                if (freq >= 2000 && freq <= 4000) formantHigh += mag;
            }

            for (let k = Math.max(2, Math.ceil(80 / binHz)); k <= Math.min(Math.floor(2000 / binHz), Math.floor((N / 2 - 1) / 4)); k++) {
                let score = 0;
                let weight = 0;
                for (let harmonic = 1; harmonic <= 4; harmonic++) {
                    let harmonicBin = k * harmonic;
                    let harmonicWeight = 1 / harmonic;
                    let mag = Math.sqrt(re[harmonicBin] * re[harmonicBin] + im[harmonicBin] * im[harmonicBin]);
                    score += mag * harmonicWeight;
                    weight += harmonicWeight;
                }
                let normalizedScore = score / Math.max(weight, 1e-6);
                hpsBest = Math.max(hpsBest, normalizedScore);
                hpsSum += normalizedScore;
            }
            fluxT[i] = currentFlux;

            let totalBand = eB + eM + eH + 1e-6;
            rawBassT[i] = eB / totalBand;
            rawMidT[i] = eM / totalBand;
            rawHighT[i] = eH / totalBand;
            
            centroidT[i] = sumMag > 0 ? (sumFreqMag / sumMag) / 512 : 0;
            flatnessT[i] = sumMag > 0 ? Math.exp(sumLogMag / 511) / (sumMag / 511) : 0;
            harmonicStabilityT[i] = (stableEnergy + transientEnergy) > 0 ? stableEnergy / (stableEnergy + transientEnergy) : 0;
            transientRatioT[i] = sumMag > 0 ? transientEnergy / sumMag : 0;
            pitchConfidenceT[i] = hpsSum > 0 ? clamp01((hpsBest / (hpsSum / Math.max(1, Math.floor(2000 / binHz) - Math.ceil(80 / binHz)))) * 0.22) : 0;
            formantRatioT[i] = formantLow > 0 ? formantHigh / (formantLow + 1e-6) : 0;
        }

        // --- 3. Thresholds and macro blocks ---
        let typRms = getTypicalMax(rmsT);
        let typFlux = getTypicalMax(fluxT);

        let intervals: number[] = []; 
        let tempLastBeat = 0;
        for (let i = 20; i < totalFrames - 20; i++) {
            let sum = 0; for(let j=i-20; j<=i+20; j++) sum += fluxT[j];
            let avg = sum / 41;
            if (fluxT[i] > avg * 1.5 && fluxT[i] > typFlux * 0.1) {
                if (fluxT[i] > fluxT[i-1] && fluxT[i] > fluxT[i+1]) {
                    let time = i * hopSize / sampleRate;
                    if (time - tempLastBeat > 0.3) {
                        intervals.push(Math.round(60 / (time - tempLastBeat)));
                        tempLastBeat = time;
                    }
                }
            }
        }
        
        let estimatedBPM = 120;
        if(intervals.length > 0) {
            let counts: Record<number, number> = {}; let maxCount = 0;
            for(let b of intervals) {
                if(b >= 70 && b <= 180) {
                    counts[b] = (counts[b] || 0) + 1;
                    if(counts[b] > maxCount) { maxCount = counts[b]; estimatedBPM = b; }
                }
            }
        }

        let secondsPerBeat = 60 / estimatedBPM;
        let secondsPerBar = secondsPerBeat * 4;
        let barFrames = Math.max(1, Math.round(secondsPerBar * sampleRate / hopSize));
        
        let barBlocks: Array<{
            index: number;
            startIdx: number;
            endIdx: number;
            avgE: number;
            peakE: number;
            avgBass: number;
            avgMid: number;
            avgHigh: number;
        }> = [];
        for (let startIdx = 0, barIndex = 0; startIdx < totalFrames; startIdx += barFrames, barIndex++) {
            let endIdx = Math.min(totalFrames, startIdx + barFrames);
            let sumE = 0, peakE = 0, sumBass = 0, sumMid = 0, sumHigh = 0;
            let actualSize = Math.max(1, endIdx - startIdx);
            for (let j = startIdx; j < endIdx; j++) {
                sumE += rmsT[j];
                peakE = Math.max(peakE, rmsT[j]);
                sumBass += rawBassT[j];
                sumMid += rawMidT[j];
                sumHigh += rawHighT[j];
            }
            barBlocks.push({
                index: barIndex,
                startIdx,
                endIdx,
                avgE: sumE / actualSize,
                peakE,
                avgBass: sumBass / actualSize,
                avgMid: sumMid / actualSize,
                avgHigh: sumHigh / actualSize
            });
        }
        let gMinAvgE = Math.min(...barBlocks.map(b => b.avgE));
        let gMaxAvgE = Math.max(...barBlocks.map(b => b.avgE));


        // --- 4. Pass 2: smoothing and state machine ---
        let outFrames: AudioFrame[] = new Array(totalFrames);
        let outEvents: BeatEvent[] = [];
        let featureFrames: VisualFeatureFrame[] = new Array(totalFrames);
        
        let sE=0, sB=0, sM=0, sT=0; 
        let sMelody=0, sVocal=0, sFx=0, sDensity=0, sBrightness=0, sTension=0;
        let lastBeatTime = 0;

        for (let i = 0; i < totalFrames; i++) {
            let time = i * hopSize / sampleRate;
            let normRms = Math.min(1.0, rmsT[i] / typRms);
            let normFlux = fluxT[i] / typFlux;
            
            let flatness = flatnessT[i];
            let centroid = centroidT[i];
            let rawBass = rawBassT[i];
            let rawMid = rawMidT[i];
            let rawHigh = rawHighT[i];
            let harmonicStability = harmonicStabilityT[i];
            let transientRatio = transientRatioT[i];
            let pitchConfidence = pitchConfidenceT[i];
            let formantRatio = formantRatioT[i];

            let tonalFactor = clamp01((1.0 - Math.min(1.0, flatness * 1.8)) * 0.72 + harmonicStability * 0.28);
            let noiseFactor = Math.min(1.0, flatness * 2.5);
            let pitchedTransient = clamp01(pitchConfidence * Math.max(0, rawMid - 0.12) * Math.min(1, transientRatio * 4));
            let vocalFormant = clamp01((1 - Math.abs(formantRatio - 0.55) / 0.55) * rawMid * (1 - rawBass * 1.2));
            
            let melodyTarget = tonalFactor * Math.max(0, rawMid - 0.2) * 1.35 + pitchedTransient * 1.4;
            let vocalTarget = tonalFactor * vocalFormant * 1.55;
            let fxTarget = noiseFactor * rawHigh * 1.45 + normFlux * 0.18 * (1 - pitchConfidence);
            let brightnessTarget = centroid * 3.0;

            // Strong smoothing prevents jitter in render-facing signals.
            sE += (normRms - sE) * 0.2;
            sB += (rawBass - sB) * 0.2;
            sM += (rawMid - sM) * 0.2;
            sT += (rawHigh - sT) * 0.2;

            sMelody += (clamp01(melodyTarget) - sMelody) * 0.1;
            sVocal += (clamp01(vocalTarget) - sVocal) * 0.1;
            sFx += (clamp01(fxTarget) - sFx) * 0.15;
            sDensity += (clamp01(normFlux) - sDensity) * 0.15;
            sBrightness += (clamp01(brightnessTarget) - sBrightness) * 0.1;
            sTension += (clamp01(sDensity * 0.5 + sBrightness * 0.5) - sTension) * 0.05;

            featureFrames[i] = { melody: sMelody, vocal: sVocal, fx: sFx, density: sDensity, brightness: sBrightness, tension: sTension };

            // Macro state machine is bar-aligned; only local safety overrides react inside a bar.
            let blockIdx = Math.min(barBlocks.length - 1, Math.floor(i / barFrames));
            let b = barBlocks[blockIdx];
            let energyRatio = (gMaxAvgE - gMinAvgE) > 0 ? (b.avgE - gMinAvgE) / (gMaxAvgE - gMinAvgE) : 0;
            
            let state: AudioFrame['state'] = energyRatio >= 0.45 ? 'HIGH' : 'LOW';
            
            if (state === 'HIGH') {
                if (sE < 0.35) state = 'LOW_DROP';
                else if (sE > 0.95) state = 'LOW_OVERLOAD';
            }

            // Store smoothed, stable values on the playback timeline.
            outFrames[i] = { e: sE, b: sDensity, m: sMelody, t: sFx, state: state, eRatio: energyRatio };

            // Peak picking for beat events.
            let reqScore = state === 'HIGH' ? 0.3 : 0.4;
            if (normFlux > reqScore && normFlux > (fluxT[i-1]/typFlux) && normFlux > (fluxT[i+1]/typFlux)) {
                if (time - lastBeatTime > 0.1) {
                    let type: 1|2|3 = 1;
                    if (sFx > 0.6) type = 3; 
                    else if (sDensity > 0.7) type = 2; 
                    outEvents.push({ time: time, intensity: Math.min(normFlux, 1.0), type: type });
                    lastBeatTime = time;
                }
            }
        }

        // --- 5. Sections and recurring patterns ---
        function averageFeature(startIdx: number, endIdx: number, pick: (f: VisualFeatureFrame) => number) {
            let sum = 0; let count = Math.max(1, endIdx - startIdx);
            for (let i = startIdx; i < endIdx && i < featureFrames.length; i++) sum += pick(featureFrames[i]);
            return sum / count;
        }

        function dominantFeature(startIdx: number, endIdx: number): VisualCueKind | 'rhythm' {
            let melody = averageFeature(startIdx, endIdx, f => f.melody);
            let vocal = averageFeature(startIdx, endIdx, f => f.vocal);
            let fx = averageFeature(startIdx, endIdx, f => f.fx);
            let density = averageFeature(startIdx, endIdx, f => f.density);
            let maxF = Math.max(melody, vocal, fx, density);
            return maxF === vocal ? 'vocal' : maxF === melody ? 'melody' : maxF === fx ? 'fx' : 'rhythm';
        }

        function labelForRange(startIdx: number, endIdx: number, rangeIndex: number, rangeCount: number, energy: number, density: number, tension: number): TrackSectionLabel {
            if (rangeIndex === 0 && energy < 0.5) return 'intro';
            if (rangeIndex === rangeCount - 1 && energy < 0.5) return 'outro';
            if (energy > 0.72 && density > 0.48) return 'peak';
            if (energy > 0.58 && tension > 0.58) return 'drop';
            if (energy > 0.42 && tension > 0.5) return 'build';
            if (energy < 0.28) return 'break';
            if (averageFeature(startIdx, endIdx, f => f.vocal) > 0.46) return 'verse';
            return 'verse';
        }

        function rmsStats(startIdx: number, endIdx: number) {
            let sum = 0;
            let peak = 0;
            let count = Math.max(1, endIdx - startIdx);
            for (let i = startIdx; i < endIdx && i < rmsT.length; i++) {
                sum += rmsT[i];
                peak = Math.max(peak, rmsT[i]);
            }
            return {
                avgRms: clamp01((sum / count) / typRms),
                peakRms: clamp01(peak / typRms)
            };
        }

        let barAnalyses: BarAnalysis[] = barBlocks.map((bar) => {
            let energy = (gMaxAvgE - gMinAvgE) > 0 ? (bar.avgE - gMinAvgE) / (gMaxAvgE - gMinAvgE) : 0;
            let density = averageFeature(bar.startIdx, bar.endIdx, f => f.density);
            let rms = rmsStats(bar.startIdx, bar.endIdx);
            return {
                index: bar.index,
                start: bar.startIdx * hopSize / sampleRate,
                end: bar.endIdx * hopSize / sampleRate,
                energy,
                density,
                avgRms: rms.avgRms,
                peakRms: rms.peakRms,
                bass: clamp01(bar.avgBass),
                mid: clamp01(bar.avgMid),
                treble: clamp01(bar.avgHigh),
                state: energy >= 0.45 ? 'HIGH' : 'LOW',
                dominantFeature: dominantFeature(bar.startIdx, bar.endIdx)
            };
        });

        let phraseBars = 4;
        let phraseCount = Math.max(1, Math.ceil(barBlocks.length / phraseBars));
        let trackSections: TrackSection[] = [];
        for (let phraseIndex = 0; phraseIndex < phraseCount; phraseIndex++) {
            let phraseStartBar = phraseIndex * phraseBars;
            let phraseEndBar = Math.min(barBlocks.length, phraseStartBar + phraseBars);
            let firstBar = barBlocks[phraseStartBar];
            let lastBar = barBlocks[phraseEndBar - 1];
            if (!firstBar || !lastBar) continue;

            let avgEnergy = averageRange(barAnalyses.map(bar => bar.energy), phraseStartBar, phraseEndBar);
            let startIdx = firstBar.startIdx;
            let endIdx = lastBar.endIdx;
            let density = averageFeature(startIdx, endIdx, f => f.density);
            let tension = averageFeature(startIdx, endIdx, f => f.tension);
            let label = labelForRange(startIdx, endIdx, phraseIndex, phraseCount, avgEnergy, density, tension);
            let rms = rmsStats(startIdx, endIdx);

            trackSections.push({
                start: firstBar.startIdx * hopSize / sampleRate,
                end: lastBar.endIdx * hopSize / sampleRate,
                label,
                energy: avgEnergy,
                density,
                dominantFeature: dominantFeature(startIdx, endIdx),
                avgRms: rms.avgRms,
                peakRms: rms.peakRms
            });
        }

        let visualCues: VisualCueEvent[] = [];
        let lastCueTimes: Record<VisualCueKind, number> = { melody: -999, vocal: -999, fx: -999, impact: -999, break: -999, pattern: -999 };

        function addCue(i: number, kind: VisualCueKind, intensity: number, confidence: number, minGap: number, duration: number, patternId?: string) {
            let time = i * hopSize / sampleRate;
            if (time - lastCueTimes[kind] < minGap) return;
            visualCues.push({ time, duration, intensity: clamp01(intensity), confidence: clamp01(confidence), kind, patternId });
            lastCueTimes[kind] = time;
        }

        let patternGroups: Record<string, { sections: TrackSection[], indexes: number[] }> = {};
        for (let i = 0; i < trackSections.length; i++) {
            let section = trackSections[i];
            if (section.end - section.start < secondsPerBeat * 4) continue;
            let sig = `${section.label}:${section.dominantFeature}:e${Math.floor(section.energy*4)}:d${Math.floor(section.density*4)}`;
            patternGroups[sig] = patternGroups[sig] || { sections: [], indexes: [] };
            patternGroups[sig].sections.push(section);
            patternGroups[sig].indexes.push(i);
        }

        let musicPatterns: MusicPattern[] = Object.entries(patternGroups)
            .filter(([, group]) => group.sections.length >= 2)
            .map(([signature, group], patternIdx) => {
                let avgEnergy = group.sections.reduce((sum, s) => sum + s.energy, 0) / group.sections.length;
                let avgDensity = group.sections.reduce((sum, s) => sum + s.density, 0) / group.sections.length;
                let occurrences: PatternOccurrence[] = group.sections.map(s => ({ start: s.start, end: s.end, intensity: clamp01(s.energy * 0.55 + s.density * 0.45), confidence: clamp01(0.45 + group.sections.length * 0.1) }));
                return { id: `pattern-${patternIdx + 1}`, signature, label: group.sections[0].label, dominantFeature: group.sections[0].dominantFeature, occurrences, averageEnergy: avgEnergy, averageDensity: avgDensity };
            }).slice(0, 12);

        for (let pattern of musicPatterns) {
            for (let occurrence of pattern.occurrences) {
                let frameIdx = Math.floor(occurrence.start * sampleRate / hopSize);
                addCue(frameIdx, 'pattern', occurrence.intensity, occurrence.confidence, secondsPerBeat * 2, occurrence.end - occurrence.start, pattern.id);
            }
        }

        for (let i = 2; i < totalFrames - 2; i++) {
            let f = featureFrames[i]; let prev = featureFrames[i - 1]; let next = featureFrames[i + 1];
            if (f.melody > 0.52 && f.melody >= prev.melody && f.melody > next.melody) addCue(i, 'melody', f.melody, f.melody, 2.4, secondsPerBeat * 4);
            if (f.vocal > 0.48 && f.vocal >= prev.vocal && f.vocal > next.vocal) addCue(i, 'vocal', f.vocal, f.vocal, 3.2, secondsPerBeat * 8);
            if (f.fx > 0.62 && f.fx >= prev.fx && f.fx > next.fx) addCue(i, 'fx', f.fx, f.fx, 1.2, secondsPerBeat * 2);
            if (f.density > 0.72 && outFrames[i].eRatio > 0.5) addCue(i, 'impact', f.density, 1.0, 1.8, secondsPerBeat);
            if (outFrames[i].state === 'LOW_DROP' && outFrames[i - 1].state !== 'LOW_DROP') addCue(i, 'break', 1 - f.density * 0.5, 0.85, 4.0, secondsPerBeat * 8);
        }

        visualCues.sort((a, b) => a.time - b.time);

        const dramaturgy = computeDramaturgyAnalysis(featureFrames, outFrames, hopSize, sampleRate, barFrames);

        const trackAnalysis: TrackAnalysis = {
            duration: channel.length / sampleRate,
            bars: barAnalyses,
            sections: trackSections,
            patterns: musicPatterns,
            cues: visualCues,
            significantMoments: visualCues.filter(cue => cue.kind === 'impact' || cue.kind === 'break').slice(0, 32),
            features: featureFrames,
            buildupConfidence: dramaturgy.buildupConfidence,
            tensionTrends: dramaturgy.tensionTrends,
            featureHopSize: hopSize
        };

        const result: AnalysisResult = { requestId, bpm: estimatedBPM, frames: outFrames, events: outEvents, hopSize: hopSize, trackAnalysis };
        self.postMessage({ type: 'analysis_done', ...result });
    } catch (error) {
        self.postMessage({
            type: 'analysis_error',
            requestId: e.data.requestId,
            errorCode: 'ANALYSIS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown analysis error'
        });
    }
};
