import type { AnalysisResult, AudioFrame, TrackAnalysis, VisualFeatureFrame } from '../types';
import { DEFAULT_ANALYSIS_HOP_SIZE } from './constants';
import { DramaturgyBuilder, computeDramaturgyAnalysis } from './DramaturgyBuilder';
import { FeatureClassifier } from './FeatureClassifier';
import { FeatureExtractor } from './FeatureExtractor';
import { normalizeArray } from './FeatureNormalizer';
import { GridAligner } from './GridAligner';
import { SectionAnalyzer } from './SectionAnalyzer';
import { applySpectralPivot } from './SpectralPivot';
import { estimateSpectralCalibration } from './SpectralCalibration';
import { applyEMA } from './TemporalSmoother';
import type { AnalyzeAudioInput } from './types';

export function analyzeAudio(input: AnalyzeAudioInput): AnalysisResult {
    const { samples, sampleRate, options, onProgress } = input;
    const channel = samples;
    const hopSize = options?.hopSize ?? DEFAULT_ANALYSIS_HOP_SIZE;
    const requestId = options?.requestId ?? 0;

    const calibration = estimateSpectralCalibration(channel, sampleRate, hopSize);
    const features = new FeatureExtractor(channel, sampleRate, hopSize, calibration);
    features.process((p) => {
        onProgress?.(p, 'Analyzing music...');
    });

    const grid = new GridAligner(features, sampleRate, hopSize);
    grid.calculate();

    const normRms = normalizeArray(features.rmsT, features.typRms);
    const normFlux = normalizeArray(features.fluxT, features.typFlux);
    const classifier = new FeatureClassifier({
        rms: normRms,
        rawRms: features.rmsT,
        flux: normFlux,
        sub: features.subT,
        bass: features.bassT,
        lowMid: features.lowMidT,
        mid: features.midT,
        presence: features.presenceT,
        brilliance: features.brillianceT,
        air: features.airT,
        high: features.rawHighT,
        centroid: features.centroidT,
        flatness: features.flatnessT,
        zcr: features.zcrT,
        rolloff: features.spectralRolloffT,
        crest: features.spectralCrestT,
        calibration
    });
    const classified = classifier.classifyFrames();
    const energy = applyEMA(normRms, 0.2);
    const density = applyEMA(classified.densityRaw, 0.15);
    const melody = applyEMA(classified.melodyRaw, 0.1);
    const vocal = applyEMA(classified.vocalRaw, 0.1);
    const fx = applyEMA(classified.fxRaw, 0.15);
    const brightness = applyEMA(classified.brightnessRaw, 0.1);
    const tension = applyEMA(classified.tensionRaw, 0.05);

    let outFrames: AudioFrame[] = new Array(features.totalFrames);
    let visualFeatures: VisualFeatureFrame[] = new Array(features.totalFrames);
    for (let i = 0; i < features.totalFrames; i++) {
        visualFeatures[i] = {
            melody: melody[i],
            vocal: vocal[i],
            fx: fx[i],
            density: density[i],
            brightness: brightness[i],
            tension: tension[i]
        };
        outFrames[i] = { e: energy[i], densityProj: density[i], melodyProj: melody[i], fxProj: fx[i], state: 'LOW', eRatio: energy[i] };
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
    const spectralPivot = applySpectralPivot(featureFrames, outFrames, dramaturgy.buildupConfidence, totalFrames);

    const cueBuilder = new DramaturgyBuilder(features, grid, segmenter, sampleRate, hopSize);
    cueBuilder.calculate(featureFrames, outFrames);

    const trackAnalysis: TrackAnalysis = {
        duration: channel.length / sampleRate,
        bpm: grid.estimatedBPM,
        bpmConfidence: grid.bpmConfidence,
        gridConfidence: grid.gridConfidence,
        downbeatConfidence: grid.downbeatConfidence,
        tempoCandidates: grid.tempoCandidates,
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
        gridOffset: grid.gridOffset,
        tempo: grid.tempo,
        tempoConfidence: grid.tempoConfidence,
        beats: grid.beats,
        beatConfidence: grid.beatConfidence,
        barStarts: grid.barStarts,
        alternativeTempos: grid.alternativeTempos,
        timingConfidence: grid.timingConfidence
    };

    return {
        requestId,
        bpm: grid.estimatedBPM,
        bpmConfidence: grid.bpmConfidence,
        gridConfidence: grid.gridConfidence,
        downbeatConfidence: grid.downbeatConfidence,
        tempoCandidates: grid.tempoCandidates,
        adaptiveThreshold: segmenter.adaptiveThreshold, frames: outFrames, events: cueBuilder.events, hopSize,
        beats: grid.beats,
        barStarts: grid.barStarts,
        timingConfidence: grid.timingConfidence,
        trackAnalysis
    };
}
