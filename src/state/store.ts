import type { AudioFrame, BeatEvent } from '../types';

export const State = {
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    bpm: 0,
    
    // Offline pre-computed data
    frames: [] as AudioFrame[],
    events: [] as BeatEvent[],
    hopSize: 1024,
    sampleRate: 44100,

    // Real-time visualization state
    currentFrame: { e: 0, b: 0, m: 0, t: 0, state: 'IDLE', eRatio: 0 } as AudioFrame,
    beatDecay: 0,
    snareFlash: 0
};