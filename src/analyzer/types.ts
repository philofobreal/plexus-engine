import type { AnalysisResult, AudioFrame, TempoCandidate, TrackAnalysis } from '../types';

export interface AnalyzerOptions {
    algorithmVersion?: number;
    phraseSize?: number;
    requestId?: number;
    hopSize?: number;
}

export interface AnalyzeAudioInput {
    samples: Float32Array;
    sampleRate: number;
    options?: AnalyzerOptions;
    onProgress?: (progress: number, stage: string) => void;
}

export type { AnalysisResult, AudioFrame, TempoCandidate, TrackAnalysis };
