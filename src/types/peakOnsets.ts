import type {DifferenceCandidate} from './differenceOnsets';

export interface PeakCandidate extends Omit<DifferenceCandidate, 'evidenceSource'> {
    evidenceSource: DifferenceCandidate['evidenceSource'] | 'peak-curvature-rise';
}

/** Direct research output; no worker/TrackAnalysis/schema promotion. */
export interface PeakOnsetAnalysis {
    algorithm: 'experimental-peak-curvature-v7';
    sampleRate: number;
    sampleCount: number;
    historySamples: number;
    hopSize: number;
    refinementSamples: number;
    lookaheadSamples: number;
    minimumSeparationSamples: number;
    directionalWindowSamples: number;
    directionalRiseRatio: number;
    contrastSamples: number;
    peakFloorMultiplier: number;
    directionalFilterCoefficients: number[];
    peakFilterCoefficients: number[];
    filterMemorySamples: 4;
    timestamp: 'refined-sample';
    localization: 'maximum-positive-innovation-power-step';
    selection: 'candidate-only';
    candidates: PeakCandidate[];
}
