export interface BeatEvent {
    time: number;
    intensity: number;
    type: 1 | 2 | 3; // 1: Kick, 2: Snare/Drop, 3: Hi-hat
}

export type AutoState = 'IDLE' | 'HIGH' | 'LOW' | 'LOW_DROP' | 'LOW_OVERLOAD';

export interface AudioFrame {
    e: number;
    b: number;
    m: number;
    t: number;
    state: AutoState;
    eRatio: number;
}

export interface AnalysisResult {
    requestId: number;
    bpm: number;
    frames: AudioFrame[];
    events: BeatEvent[];
    hopSize: number;
}

export interface AnalysisRequest {
    requestId: number;
    algorithmVersion: number;
    samples: ArrayBuffer;
    sampleRate: number;
}

export interface AnalysisSuccessMessage extends AnalysisResult {
    type: 'analysis_done';
}

export interface AnalysisErrorMessage {
    type: 'analysis_error';
    requestId: number;
    errorCode: string;
    message: string;
}

export type AnalysisWorkerMessage = AnalysisSuccessMessage | AnalysisErrorMessage;
