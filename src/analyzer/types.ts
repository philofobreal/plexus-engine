import type { AnalysisResult, AudioFrame, TempoCandidate, TrackAnalysis } from '../types';

export interface AnalyzerOptions {
    /** Additional chart pool under existing percussive gates; legacy visual events stay unchanged. */
    rhythmOnsets?: boolean;
    algorithmVersion?: number;
    phraseSize?: number;
    requestId?: number;
    hopSize?: number;
    /** Opt-in acoustic candidates, independent from accepted events/grid. */
    acousticOnsets?: import('../types/acousticOnsets').AcousticOnsetOptions;
    predictiveOnsets?: boolean;
    /** Optional v3 candidate evidence; defaults to the unchanged legacy output. */
    adaptiveOnsets?: boolean;
    /** Explicit v4 selection; absent preserves the established v3 stream. */
    adaptiveOnsetVersion?: 4 | 5;
    /** Experimental accepted-frame localization; absent preserves algorithm-7 event times. */
    eventTiming?: 'local-band-v1' | 'local-band-v2';
}

export interface AnalyzeAudioInput {
    samples: Float32Array;
    /** Pure request-local numeric dependency; omitted retains the TS reference. */
    fftKernelFactory?: import('./math/FFT').FftKernelFactory;
    sampleRate: number;
    options?: AnalyzerOptions;
    onProgress?: (progress: number, stage: string) => void;
}

export type { AnalysisResult, AudioFrame, TempoCandidate, TrackAnalysis };
