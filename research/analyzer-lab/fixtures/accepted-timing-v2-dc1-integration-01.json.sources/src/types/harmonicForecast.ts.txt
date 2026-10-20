import type { AcousticEvidenceIdentity } from './acousticEvidence';

export interface HarmonicForecastModel {
    kind: 'stationary' | 'linear-envelope';
    coefficients: number[];
    fitResidualFraction: number;
}

/** Prefix identity never includes evaluation PCM. Neither model is selected using its suffix score. */
export interface HarmonicForecast {
    algorithm: 'experimental-prefix-harmonic-forecast-v1';
    identity: AcousticEvidenceIdentity;
    trainingSamples: number;
    evaluationSamples: number;
    frequencyHz: number | null;
    harmonics: number;
    trainingMean: number;
    status: 'available' | 'no-pitch' | 'rank-deficient';
    models: HarmonicForecastModel[];
    confidence: null;
    sourceIsolation: 'unverified-mixture';
    consumerUse: 'diagnostic-only';
    xrScoring: 'ineligible';
}
