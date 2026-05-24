import type {
    AnalysisRequest,
    AudioFrame,
    BeatEvent,
    AnalysisResult,
    TrackAnalysis,
    TrackSection,
    TrackSectionLabel,
    VisualCueEvent,
    VisualCueKind,
    VisualFeatureFrame,
    MusicPattern,
    PatternOccurrence
} from '../types';

self.onmessage = function(e: MessageEvent<AnalysisRequest>) {
    try {
    const requestId = e.data.requestId;
    const channel = new Float32Array(e.data.samples);
    const sampleRate = e.data.sampleRate;
    const hopSize = 1024; 
    const totalFrames = Math.floor(channel.length / hopSize);
    
    let a_bass = Math.exp(-2 * Math.PI * 150 / sampleRate);
    let a_high = Math.exp(-2 * Math.PI * 4000 / sampleRate);
    let filterLow = 0, filterMidHigh = 0;

    let rmsT = new Float32Array(totalFrames);
    let rmsB = new Float32Array(totalFrames);
    let rmsM = new Float32Array(totalFrames);
    let rmsH = new Float32Array(totalFrames);
    
    let fluxB = new Float32Array(totalFrames); let pRmsB = 0;
    let fluxM = new Float32Array(totalFrames); let pRmsM = 0;
    let fluxH = new Float32Array(totalFrames); let pRmsH = 0;

    for (let i = 0; i < totalFrames; i++) {
        let start = i * hopSize; 
        let eT=0, eB=0, eM=0, eH=0;
        for (let j = 0; j < hopSize; j++) { 
            let s = channel[start + j];
            filterLow = a_bass * filterLow + (1 - a_bass) * s;
            filterMidHigh = a_high * filterMidHigh + (1 - a_high) * s;
            let b = filterLow; let m = filterMidHigh - filterLow; let h = s - filterMidHigh;
            eT += s*s; eB += b*b; eM += m*m; eH += h*h;
        }
        rmsT[i] = Math.sqrt(eT / hopSize); rmsB[i] = Math.sqrt(eB / hopSize);
        rmsM[i] = Math.sqrt(eM / hopSize); rmsH[i] = Math.sqrt(eH / hopSize);
        
        fluxB[i] = Math.max(0, rmsB[i] - pRmsB); pRmsB = rmsB[i];
        fluxM[i] = Math.max(0, rmsM[i] - pRmsM); pRmsM = rmsM[i];
        fluxH[i] = Math.max(0, rmsH[i] - pRmsH); pRmsH = rmsH[i];
    }

    function getTypicalMax(arr: Float32Array) {
        let sorted = new Float32Array(arr).sort();
        return sorted[Math.floor(sorted.length * 0.98)] || 0.001;
    }

    function clamp01(value: number) {
        return Math.min(1, Math.max(0, value));
    }

    function smoothstep(edge0: number, edge1: number, value: number) {
        let t = clamp01((value - edge0) / (edge1 - edge0));
        return t * t * (3 - 2 * t);
    }

    let typFluxB = getTypicalMax(fluxB); let typFluxM = getTypicalMax(fluxM); let typFluxH = getTypicalMax(fluxH);
    let typRmsT = getTypicalMax(rmsT); let typRmsB = getTypicalMax(rmsB); let typRmsM = getTypicalMax(rmsM); let typRmsH = getTypicalMax(rmsH);

    let intervals: number[] = []; let lastBeatTime = 0;
    for (let i = 20; i < totalFrames - 20; i++) {
        let sum = 0; for(let j=i-20; j<=i+20; j++) sum += fluxB[j];
        let avg = sum / 41;
        if (fluxB[i] > avg * 1.5 && fluxB[i] > typFluxB * 0.1) {
            if (fluxB[i] > fluxB[i-1] && fluxB[i] > fluxB[i+1]) {
                let time = i * hopSize / sampleRate;
                if (time - lastBeatTime > 0.3) {
                    intervals.push(Math.round(60 / (time - lastBeatTime)));
                    lastBeatTime = time;
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
    let secondsPerBlock = secondsPerBeat * 16;
    let blockFrames = Math.floor(secondsPerBlock * sampleRate / hopSize);
    if (blockFrames < 10) blockFrames = 100;
    
    let blocks: {startIdx: number, endIdx: number, avgE: number}[] = [];
    for (let i = 0; i < totalFrames; i += blockFrames) {
        let sumE = 0; let actualSize = Math.min(blockFrames, totalFrames - i);
        for (let j = i; j < i + actualSize; j++) sumE += rmsT[j];
        blocks.push({ startIdx: i, endIdx: i + actualSize, avgE: sumE / actualSize });
    }
    let gMinAvgE = Math.min(...blocks.map(b => b.avgE));
    let gMaxAvgE = Math.max(...blocks.map(b => b.avgE));

    let outFrames: AudioFrame[] = new Array(totalFrames);
    let outEvents: BeatEvent[] = [];
    let featureFrames: VisualFeatureFrame[] = new Array(totalFrames);
    let sE=0, sB=0, sM=0, sT=0; 
    let sMelody=0, sVocal=0, sFx=0, sDensity=0, sBrightness=0, sTension=0;
    
    lastBeatTime = 0;

    for (let i = 0; i < totalFrames; i++) {
        let time = i * hopSize / sampleRate;
        
        sE += (Math.min(rmsT[i]/typRmsT, 1) - sE) * 0.2;
        sB += (Math.min(rmsB[i]/typRmsB, 1) - sB) * 0.2;
        sM += (Math.min(rmsM[i]/typRmsM, 1) - sM) * 0.2;
        sT += (Math.min(rmsH[i]/typRmsH, 1) - sT) * 0.2;

        let blockIdx = Math.floor(i / blockFrames);
        let b = blocks[blockIdx];
        let energyRatio = (gMaxAvgE - gMinAvgE) > 0 ? (b.avgE - gMinAvgE) / (gMaxAvgE - gMinAvgE) : 0;
        
        let state: AudioFrame['state'] = energyRatio >= 0.45 ? 'HIGH' : 'LOW';
        
        if (state === 'HIGH') {
            if (sE < 0.35) state = 'LOW_DROP';
            else if (sE > 0.95) state = 'LOW_OVERLOAD';
        }

        outFrames[i] = { e: sE, b: sB, m: sM, t: sT, state: state, eRatio: energyRatio };

        let nB = fluxB[i] / typFluxB; let nM = fluxM[i] / typFluxM; let nH = fluxH[i] / typFluxH;
        let audibleEnergy = Math.min(rmsT[i] / typRmsT, 1);
        let featureGate = smoothstep(0.04, 0.18, audibleEnergy);
        let totalBand = rmsB[i] + rmsM[i] + rmsH[i] + 0.000001;
        let midRatio = featureGate > 0 ? rmsM[i] / totalBand : 0;
        let highRatio = featureGate > 0 ? rmsH[i] / totalBand : 0;
        let bassRatio = featureGate > 0 ? rmsB[i] / totalBand : 0;
        let rawFluxDensity = Math.min((nB + nM + nH) / 3, 1);
        let fluxDensity = rawFluxDensity * featureGate;
        let percussiveSuppression = 1 - clamp01(rawFluxDensity * 0.55 + Math.min(nB, 1) * 0.18 + Math.min(nH, 1) * 0.22);
        let bassSuppression = 1 - clamp01((bassRatio - 0.34) * 2.1);
        let brightnessSuppression = 1 - clamp01((highRatio - 0.42) * 2.4);
        let midFocus = smoothstep(0.3, 0.48, midRatio) * (1 - smoothstep(0.72, 0.9, midRatio));
        let sustainedMid = Math.max(0, midRatio - Math.min(nM, 1) * 0.18);
        let melodyConfidence = featureGate * percussiveSuppression * bassSuppression * brightnessSuppression;
        let melodyTarget = clamp01((sustainedMid - 0.3) * 2.35 + sM * 0.16) * melodyConfidence;
        let vocalBandShape = midFocus * (1 - Math.abs(highRatio - 0.24) * 1.65);
        let vocalConfidence = featureGate * percussiveSuppression * bassSuppression * (1 - clamp01(rawFluxDensity * 0.35));
        let vocalTarget = clamp01(vocalBandShape - bassRatio * 0.35 - Math.max(0, highRatio - 0.38) * 0.55) * vocalConfidence;
        let fxTarget = clamp01(highRatio * 1.35 + nH * 0.28 + fluxDensity * 0.25 - sB * 0.15) * featureGate;
        let densityTarget = clamp01(fluxDensity * 0.7 + sE * 0.3) * featureGate;
        let brightnessTarget = clamp01(highRatio * 1.45 + sT * 0.25) * featureGate;
        let tensionTarget = clamp01(energyRatio * 0.55 + densityTarget * 0.3 + brightnessTarget * 0.15) * featureGate;

        sMelody += (melodyTarget - sMelody) * 0.08;
        sVocal += (vocalTarget - sVocal) * 0.06;
        sFx += (fxTarget - sFx) * 0.14;
        sDensity += (densityTarget - sDensity) * 0.1;
        sBrightness += (brightnessTarget - sBrightness) * 0.1;
        sTension += (tensionTarget - sTension) * 0.07;

        featureFrames[i] = {
            melody: sMelody,
            vocal: sVocal,
            fx: sFx,
            density: sDensity,
            brightness: sBrightness,
            tension: sTension
        };
        
        let scoreKick = nB * (1.0 - (nH * 0.5));
        let scoreSnare = Math.min(nB, Math.min(nM, nH)) * 1.5;
        let scoreHat = nH * (1.0 - (nB * 0.8));
        
        let maxScore = Math.max(scoreKick, scoreSnare, scoreHat);
        let reqScore = state === 'HIGH' ? 0.3 : 0.3 + ((1.0 - energyRatio) * 0.6);

        if (maxScore > reqScore && maxScore > 0.1) {
            let isPeak = maxScore > (fluxB[i-1]/typFluxB) && maxScore > (fluxB[i+1]/typFluxB);
            if (isPeak && (time - lastBeatTime > 0.1)) {
                let type: 1|2|3 = maxScore === scoreKick ? 1 : (maxScore === scoreSnare ? 2 : 3);
                outEvents.push({ time: time, intensity: Math.min(maxScore, 1.0), type: type });
                lastBeatTime = time;
            }
        }
    }

    function averageFeature(startIdx: number, endIdx: number, pick: (f: VisualFeatureFrame) => number) {
        let sum = 0;
        let count = Math.max(1, endIdx - startIdx);
        for (let i = startIdx; i < endIdx && i < featureFrames.length; i++) sum += pick(featureFrames[i]);
        return sum / count;
    }

    function dominantFeature(startIdx: number, endIdx: number): VisualCueKind | 'rhythm' {
        let melody = averageFeature(startIdx, endIdx, f => f.melody);
        let vocal = averageFeature(startIdx, endIdx, f => f.vocal);
        let fx = averageFeature(startIdx, endIdx, f => f.fx);
        let density = averageFeature(startIdx, endIdx, f => f.density);
        let max = Math.max(melody, vocal, fx, density);
        if (max === vocal) return 'vocal';
        if (max === melody) return 'melody';
        if (max === fx) return 'fx';
        return 'rhythm';
    }

    let trackSections: TrackSection[] = blocks.map((block, idx) => {
        let energy = (gMaxAvgE - gMinAvgE) > 0 ? (block.avgE - gMinAvgE) / (gMaxAvgE - gMinAvgE) : 0;
        let density = averageFeature(block.startIdx, block.endIdx, f => f.density);
        let tension = averageFeature(block.startIdx, block.endIdx, f => f.tension);
        let label: TrackSectionLabel = 'verse';
        if (idx === 0 && energy < 0.5) label = 'intro';
        else if (idx === blocks.length - 1 && energy < 0.5) label = 'outro';
        else if (energy > 0.72 && density > 0.48) label = 'peak';
        else if (energy > 0.58 && tension > 0.58) label = 'drop';
        else if (energy > 0.42 && tension > 0.5) label = 'build';
        else if (energy < 0.28) label = 'break';

        return {
            start: block.startIdx * hopSize / sampleRate,
            end: block.endIdx * hopSize / sampleRate,
            label,
            energy,
            density,
            dominantFeature: dominantFeature(block.startIdx, block.endIdx)
        };
    });

    let visualCues: VisualCueEvent[] = [];
    let lastCueTimes: Record<VisualCueKind, number> = { melody: -999, vocal: -999, fx: -999, impact: -999, break: -999, pattern: -999 };

    function addCue(i: number, kind: VisualCueKind, intensity: number, confidence: number, minGap: number, duration: number, patternId?: string) {
        let time = i * hopSize / sampleRate;
        if (time - lastCueTimes[kind] < minGap) return;
        visualCues.push({
            time,
            duration,
            intensity: Math.min(Math.max(intensity, 0), 1),
            confidence: Math.min(Math.max(confidence, 0), 1),
            kind,
            patternId
        });
        lastCueTimes[kind] = time;
    }

    function bucket(value: number, buckets: number) {
        return Math.max(0, Math.min(buckets - 1, Math.floor(value * buckets)));
    }

    function patternSignature(section: TrackSection) {
        return [
            section.label,
            section.dominantFeature,
            `e${bucket(section.energy, 4)}`,
            `d${bucket(section.density, 4)}`
        ].join(':');
    }

    let patternGroups: Record<string, { sections: TrackSection[], indexes: number[] }> = {};
    for (let i = 0; i < trackSections.length; i++) {
        let section = trackSections[i];
        if (section.end - section.start < secondsPerBeat * 4) continue;
        let signature = patternSignature(section);
        patternGroups[signature] = patternGroups[signature] || { sections: [], indexes: [] };
        patternGroups[signature].sections.push(section);
        patternGroups[signature].indexes.push(i);
    }

    let musicPatterns: MusicPattern[] = Object.entries(patternGroups)
        .filter(([, group]) => group.sections.length >= 2)
        .map(([signature, group], patternIdx) => {
            let avgEnergy = group.sections.reduce((sum, section) => sum + section.energy, 0) / group.sections.length;
            let avgDensity = group.sections.reduce((sum, section) => sum + section.density, 0) / group.sections.length;
            let occurrences: PatternOccurrence[] = group.sections.map(section => ({
                start: section.start,
                end: section.end,
                intensity: clamp01(section.energy * 0.55 + section.density * 0.45),
                confidence: clamp01(0.45 + group.sections.length * 0.1)
            }));

            return {
                id: `pattern-${patternIdx + 1}`,
                signature,
                label: group.sections[0].label,
                dominantFeature: group.sections[0].dominantFeature,
                occurrences,
                averageEnergy: avgEnergy,
                averageDensity: avgDensity
            };
        })
        .sort((a, b) => b.occurrences.length - a.occurrences.length || (b.averageEnergy + b.averageDensity) - (a.averageEnergy + a.averageDensity))
        .slice(0, 12);

    for (let pattern of musicPatterns) {
        for (let occurrence of pattern.occurrences) {
            let frameIdx = Math.floor(occurrence.start * sampleRate / hopSize);
            addCue(frameIdx, 'pattern', occurrence.intensity, occurrence.confidence, secondsPerBeat * 2, occurrence.end - occurrence.start, pattern.id);
        }
    }

    for (let i = 2; i < totalFrames - 2; i++) {
        let f = featureFrames[i];
        let prev = featureFrames[i - 1];
        let next = featureFrames[i + 1];
        let evRatio = outFrames[i].eRatio;
        if (f.melody > 0.52 && f.melody >= prev.melody && f.melody > next.melody) {
            addCue(i, 'melody', f.melody, f.melody * (1 - Math.min(f.fx, 0.5)), 2.4, secondsPerBeat * 4);
        }
        if (f.vocal > 0.48 && f.vocal >= prev.vocal && f.vocal > next.vocal) {
            addCue(i, 'vocal', f.vocal, f.vocal * (1 - Math.min(f.fx, 0.45)), 3.2, secondsPerBeat * 8);
        }
        if (f.fx > 0.62 && f.fx >= prev.fx && f.fx > next.fx) {
            addCue(i, 'fx', f.fx, Math.min(1, f.brightness + f.density * 0.5), 1.2, secondsPerBeat * 2);
        }
        if (f.density > 0.72 && f.tension > 0.58 && evRatio > 0.5) {
            addCue(i, 'impact', Math.max(f.density, f.tension), Math.min(1, evRatio + f.density * 0.35), 1.8, secondsPerBeat);
        }
        if (outFrames[i].state === 'LOW_DROP' && outFrames[i - 1].state !== 'LOW_DROP') {
            addCue(i, 'break', 1 - f.density * 0.5, 0.85, 4.0, secondsPerBeat * 8);
        }
    }

    visualCues.sort((a, b) => a.time - b.time);
    let significantMoments = visualCues
        .filter(cue => cue.confidence >= 0.5 || cue.kind === 'impact' || cue.kind === 'break')
        .sort((a, b) => (b.intensity * b.confidence) - (a.intensity * a.confidence))
        .slice(0, 32)
        .sort((a, b) => a.time - b.time);

    const trackAnalysis: TrackAnalysis = {
        duration: channel.length / sampleRate,
        sections: trackSections,
        patterns: musicPatterns,
        cues: visualCues,
        significantMoments,
        features: featureFrames,
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
