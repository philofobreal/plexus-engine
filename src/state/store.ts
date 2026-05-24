import type { AudioFrame, BeatEvent, TrackAnalysis, VisualFeatureFrame, VisualCueKind, VisualMode } from '../types';

const emptyFeatures: VisualFeatureFrame = {
    melody: 0,
    vocal: 0,
    fx: 0,
    density: 0,
    brightness: 0,
    tension: 0
};

const emptyTrackAnalysis: TrackAnalysis = {
    duration: 0,
    sections: [],
    patterns: [],
    cues: [],
    significantMoments: [],
    features: [],
    featureHopSize: 1024
};

export const State = {
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    bpm: 0,
    
    // Offline pre-computed data
    frames: [] as AudioFrame[],
    events: [] as BeatEvent[],
    trackAnalysis: emptyTrackAnalysis as TrackAnalysis,
    hopSize: 1024,
    sampleRate: 44100,

    // Real-time visualization state
    visualMode: 'classic' as VisualMode,
    currentFrame: { e: 0, b: 0, m: 0, t: 0, state: 'IDLE', eRatio: 0 } as AudioFrame,
    currentFeatures: { ...emptyFeatures } as VisualFeatureFrame,
    activeCueKind: null as VisualCueKind | null,
    activePatternId: null as string | null,
    cueDecay: 0,
    beatDecay: 0,
    snareFlash: 0
};
