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
    bpm: number;
    frames: AudioFrame[];
    events: BeatEvent[];
    hopSize: number;
}