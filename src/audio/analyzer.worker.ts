import type { AudioFrame, BeatEvent, AnalysisResult } from '../types';

self.onmessage = function(e: MessageEvent<{samples: ArrayBuffer, sampleRate: number}>) {
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
    let sE=0, sB=0, sM=0, sT=0; 
    
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

    const result: AnalysisResult = { bpm: estimatedBPM, frames: outFrames, events: outEvents, hopSize: hopSize };
    self.postMessage({ type: 'analysis_done', ...result });
};