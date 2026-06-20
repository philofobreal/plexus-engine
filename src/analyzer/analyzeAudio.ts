import type { AnalysisResult, AudioFrame, TrackAnalysis, VisualFeatureFrame } from '../types';
import { DEFAULT_ANALYSIS_HOP_SIZE } from './constants';
import { DramaturgyBuilder, computeDramaturgyAnalysis } from './DramaturgyBuilder';
import { FeatureClassifier } from './FeatureClassifier';
import { FeatureExtractor, PERCEPTUAL_SPECTRUM_BAND_COUNT, PERCEPTUAL_SPECTRUM_MAX_HZ, PERCEPTUAL_SPECTRUM_MIN_HZ } from './FeatureExtractor';
import { normalizeArray } from './FeatureNormalizer';
import { GridAligner } from './GridAligner';
import { NoveltyAnalyzer } from './NoveltyAnalyzer';
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
    const perceptualSpectrum = buildPerceptualSpectrum(features);

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
        outFrames[i] = {
            e: energy[i],
            densityProj: density[i],
            melodyProj: melody[i],
            fxProj: fx[i],
            perceptualSpectrum: perceptualSpectrum[i],
            state: 'LOW',
            eRatio: energy[i]
        };
    }

    const novelty = new NoveltyAnalyzer(visualFeatures, outFrames, hopSize, sampleRate);
    const noveltyCurve = novelty.computeCurve();
    const noveltyPeaks = novelty.getPeaks();

    const segmenter = new SectionAnalyzer(features, grid, sampleRate, hopSize);
    segmenter.calculate(visualFeatures, noveltyPeaks);

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

    const cueBuilder = new DramaturgyBuilder(features, grid, segmenter, sampleRate, hopSize, noveltyPeaks);
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
        noveltyCurve,
        boundaryCandidates: segmenter.boundaryCandidates,
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

function buildPerceptualSpectrum(features: FeatureExtractor): number[][] {
    const typicalBands = new Float32Array(PERCEPTUAL_SPECTRUM_BAND_COUNT);

    for (let bandIndex = 0; bandIndex < PERCEPTUAL_SPECTRUM_BAND_COUNT; bandIndex++) {
        typicalBands[bandIndex] = getTypicalBandLevel(features.perceptualSpectrumT[bandIndex]);
    }

    const frames = new Array(features.totalFrames);
    for (let frameIndex = 0; frameIndex < features.totalFrames; frameIndex++) {
        const values = new Array(PERCEPTUAL_SPECTRUM_BAND_COUNT);
        for (let bandIndex = 0; bandIndex < PERCEPTUAL_SPECTRUM_BAND_COUNT; bandIndex++) {
            const hz = getPerceptualBandCenterHz(bandIndex);
            const floor = bandIndex < 8 ? 0.0035 : 0.008;
            const normalized = (features.perceptualSpectrumT[bandIndex][frameIndex] || 0) / Math.max(typicalBands[bandIndex] * 1.18, floor);
            const shaped = Math.pow(normalized / (normalized + 0.85), 0.72);
            values[bandIndex] = clampUnit(shaped * inversePerceptualCompensation(hz));
        }
        smoothLowPerceptualBands(values);
        frames[frameIndex] = values;
    }
    return frames;
}

function getPerceptualBandCenterHz(bandIndex: number): number {
    const position = (bandIndex + 0.5) / PERCEPTUAL_SPECTRUM_BAND_COUNT;
    return PERCEPTUAL_SPECTRUM_MIN_HZ * Math.pow(PERCEPTUAL_SPECTRUM_MAX_HZ / PERCEPTUAL_SPECTRUM_MIN_HZ, position);
}

function smoothLowPerceptualBands(values: number[]): void {
    const original = values.slice(0, 6);
    for (let i = 0; i < original.length; i++) {
        const prev = original[Math.max(0, i - 1)];
        const next = original[Math.min(original.length - 1, i + 1)];
        values[i] = clampUnit(original[i] * 0.82 + ((prev + next) * 0.5) * 0.18);
    }
}

function inversePerceptualCompensation(hz: number): number {
    const logHz = Math.log2(Math.max(PERCEPTUAL_SPECTRUM_MIN_HZ, hz));
    const presenceCenter = Math.log2(3200);
    const bassCompensation = hz < 40 ? 1.36
        : hz < 80 ? 1.28
        : hz < 160 ? 1.18
        : hz < 320 ? 1.08
        : 1.0;
    const presenceControl = 1 - 0.12 * Math.exp(-Math.pow((logHz - presenceCenter) / 0.95, 2));
    const highControl = hz > 9000 ? Math.max(0.82, 1 - (hz - 9000) / 7000 * 0.16) : 1;
    return bassCompensation * presenceControl * highControl;
}

function getTypicalBandLevel(input: Float32Array): number {
    if (input.length === 0) return 0.006;
    const sorted = new Float32Array(input);
    sorted.sort();
    const p88 = sorted[Math.floor(sorted.length * 0.88)] || 0;
    const p98 = sorted[Math.floor(sorted.length * 0.98)] || 0;
    return Math.max(p88, p98 * 0.35, 0.006);
}

function clampUnit(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
