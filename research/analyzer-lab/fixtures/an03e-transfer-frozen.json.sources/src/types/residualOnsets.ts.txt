import {normalizeAdaptiveOnsets} from './adaptiveOnsets';
import type {AdaptiveOnsetAnalysis} from './adaptiveOnsets';
import type {PredictiveCandidate} from './predictiveOnsets';

export interface ResidualCandidate extends PredictiveCandidate {
    backgroundModel: 'clean-block' | 'rolling';
    /** Eligible local fits, not a confidence or independent sample count. */
    modelBlockCount: number;
    predictorSupportStartSample: number;
    predictorSupportEndSample: number;
}

export interface ResidualOnsetAnalysis extends Omit<AdaptiveOnsetAnalysis, 'algorithm' | 'candidates'> {
    algorithm: 'residual-innovation-v4';
    backgroundEstimator: 'clean-block-or-rolling';
    candidates: ResidualCandidate[];
}

export function normalizeResidualOnsets(value: ResidualOnsetAnalysis | undefined, duration: number,
    clock?: {sampleRate: number; sampleCount: number}): ResidualOnsetAnalysis | undefined {
    if (!value || value.algorithm !== 'residual-innovation-v4' || value.backgroundEstimator !== 'clean-block-or-rolling') return undefined;
    const normalized = normalizeAdaptiveOnsets({...value, algorithm: 'adaptive-innovation-v3'}, duration, clock);
    if (!normalized) return undefined;
    const maxBlocks = Math.floor(value.historySamples / value.hopSize);
    for (const c of value.candidates) {
        if (!['clean-block', 'rolling'].includes(c.backgroundModel)
            || !Number.isSafeInteger(c.modelBlockCount) || c.modelBlockCount < 0 || c.modelBlockCount > maxBlocks
            || c.modelBlockCount > Math.min(maxBlocks, c.proposalSample / value.hopSize)
            || !Number.isSafeInteger(c.predictorSupportStartSample) || !Number.isSafeInteger(c.predictorSupportEndSample)) return undefined;
        if (c.backgroundModel === 'rolling') {
            if (c.predictorSupportStartSample !== c.supportStartSample || c.predictorSupportEndSample !== c.proposalSample) return undefined;
        } else if (c.modelBlockCount < 3 || c.predictorSupportEndSample < value.hopSize
            || c.predictorSupportEndSample > c.proposalSample || c.predictorSupportEndSample % value.hopSize !== 0
            || c.predictorSupportEndSample - value.hopSize < Math.max(0, c.proposalSample - maxBlocks * value.hopSize)
            || c.predictorSupportStartSample !== Math.max(0, c.predictorSupportEndSample - value.hopSize - 2)) return undefined;
    }
    return {algorithm: value.algorithm, sampleRate: normalized.sampleRate, sampleCount: normalized.sampleCount,
        historySamples: normalized.historySamples, lookaheadSamples: normalized.lookaheadSamples, hopSize: normalized.hopSize,
        contrastSamples: normalized.contrastSamples, minimumSeparationSamples: normalized.minimumSeparationSamples,
        backgroundEstimator: value.backgroundEstimator, timestamp: normalized.timestamp, localization: normalized.localization,
        selection: normalized.selection, candidates: normalized.candidates.map((c, i) => ({...c,
            backgroundModel: value.candidates[i].backgroundModel, modelBlockCount: value.candidates[i].modelBlockCount,
            predictorSupportStartSample: value.candidates[i].predictorSupportStartSample,
            predictorSupportEndSample: value.candidates[i].predictorSupportEndSample}))};
}
