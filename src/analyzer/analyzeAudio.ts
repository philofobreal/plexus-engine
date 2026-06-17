import type { AnalysisResult, AudioFrame, TrackAnalysis, VisualFeatureFrame } from '../types';
import { DEFAULT_ANALYSIS_HOP_SIZE } from './constants';
import { DramaturgyBuilder, computeDramaturgyAnalysis } from './DramaturgyBuilder';
import { FeatureExtractor } from './FeatureExtractor';
import { GridAligner } from './GridAligner';
import { SectionAnalyzer } from './SectionAnalyzer';
import type { AnalyzeAudioInput } from './types';

export function analyzeAudio(input: AnalyzeAudioInput): AnalysisResult {
    const { samples, sampleRate, options, onProgress } = input;
    const channel = samples;
    const hopSize = options?.hopSize ?? DEFAULT_ANALYSIS_HOP_SIZE;
    const requestId = options?.requestId ?? 0;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

    const features = new FeatureExtractor(channel, sampleRate, hopSize);
    features.process((p) => {
        onProgress?.(p, 'Analyzing music...');
    });

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

    return { requestId, bpm: grid.estimatedBPM, adaptiveThreshold: segmenter.adaptiveThreshold, frames: outFrames, events: cueBuilder.events, hopSize, trackAnalysis };
}

