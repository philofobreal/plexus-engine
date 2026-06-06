import { cloneDefaultVisualTuning } from '../config/visualTuning';
import type { AudioFrame, BeatEvent, DirectorOutput, ModulationState, SectionOverride, TrackAnalysis, VisualFeatureFrame, VisualCueKind, VisualMode } from '../types';

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
    bars: [],
    sections: [],
    patterns: [],
    cues: [],
    significantMoments: [],
    features: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: {
        globalSlope: 0,
        peakTime: 0,
        peakValue: 0,
        segments: []
    },
    featureHopSize: 1024
};

const emptyModulation: ModulationState = {
    kineticTension: 0,
    densityDrive: 0,
    spectralChaos: 0,
    rhythmicImpulse: 0,
    macroMomentum: 0
};

const emptyDirectorOutput: DirectorOutput = {
    state: 'IDLE',
    centripetalOrbit: 0,
    glitchIntensity: 0,
    invertBackground: false
};

export const State = {
    isPlaying: false,
    isExporting: false,
    exportTime: 0,
    duration: 0,
    currentTime: 0,
    bpm: 0,
    
    // Offline pre-computed data
    frames: [] as AudioFrame[],
    events: [] as BeatEvent[],
    trackAnalysis: emptyTrackAnalysis as TrackAnalysis,
    sectionOverrides: {} as Record<string, SectionOverride>,
    hopSize: 1024,
    sampleRate: 44100,

    // Real-time visualization state
    visualMode: 'classic' as VisualMode,
    loopPlayback: true,
    uiVisible: true,
    zoom: 1,
    pan: 0,
    drawModeActive: false,
    isDrawingEnvelope: false,
    playbackFade: 0.0,
    rotationPhase: 0,
    currentFrame: { e: 0, b: 0, m: 0, t: 0, state: 'IDLE', eRatio: 0 } as AudioFrame,
    currentFeatures: { ...emptyFeatures } as VisualFeatureFrame,
    activeCueKind: null as VisualCueKind | null,
    activePatternId: null as string | null,
    cueDecay: 0,
    beatDecay: 0,
    denseImpactFlash: 0,
    modulation: { ...emptyModulation } as ModulationState,
    directorOutput: { ...emptyDirectorOutput } as DirectorOutput,
    visualTuning: cloneDefaultVisualTuning(),
    targetTuning: cloneDefaultVisualTuning()
};
