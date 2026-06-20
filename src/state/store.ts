import { cloneDefaultVisualTuning } from '../config/visualTuning.ts';
import type { AudioFrame, BeatEvent, DirectorOutput, ModulationState, PerformanceAutomationPlan, TimelineLayers, TrackAnalysis, VideoDominantColor, VisualFeatureFrame, VisualCueKind, VisualMode, VisualTuningConfig } from '../types';

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
    bpm: 0,
    bpmConfidence: 0,
    gridConfidence: 0,
    downbeatConfidence: 0,
    tempoCandidates: [],
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
    noveltyCurve: [],
    noveltyPeaks: [],
    boundaryCandidates: [],
    featureHopSize: 1024,
    gridOffset: 0,
    tempo: 0,
    tempoConfidence: 0,
    beats: [],
    beatConfidence: 0,
    barStarts: [],
    alternativeTempos: [],
    timingConfidence: { tempo: 0, beat: 0, grid: 0, overall: 0 }
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

const emptyVideoDominantColor: VideoDominantColor = {
    r: 0,
    g: 0,
    b: 0
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
    availablePresets: [] as string[],
    preloadedPresets: {} as Record<string, Partial<VisualTuningConfig>>,
    performancePlan: null as PerformanceAutomationPlan | null,
    editedPerformancePlan: null as PerformanceAutomationPlan | null,
    hopSize: 1024,
    sampleRate: 44100,

    // Real-time visualization state
    visualMode: 'classic' as VisualMode,
    videoBackplateActive: false,
    loopPlayback: true,
    uiVisible: true,
    timelineLayers: {
        waveform: true,
        rms: false,
        buildup: false,
        cues: true,
        automation: true
    } as TimelineLayers,
    snapToGrid: true,
    followPlayhead: true,
    zoom: 1,
    pan: 0,
    drawModeActive: false,
    isDrawingEnvelope: false,
    playbackFade: 0.0,
    rotationPhase: 0,
    currentFrame: { e: 0, densityProj: 0, melodyProj: 0, fxProj: 0, perceptualSpectrum: new Array(24).fill(0), state: 'IDLE', eRatio: 0 } as AudioFrame,
    currentFeatures: { ...emptyFeatures } as VisualFeatureFrame,
    activeCueKind: null as VisualCueKind | null,
    activePatternId: null as string | null,
    cueDecay: 0,
    beatDecay: 0,
    denseImpactFlash: 0,
    modulation: { ...emptyModulation } as ModulationState,
    directorOutput: { ...emptyDirectorOutput } as DirectorOutput,
    videoDominantColor: { ...emptyVideoDominantColor } as VideoDominantColor,
    visualTuning: cloneDefaultVisualTuning(),
    targetTuning: cloneDefaultVisualTuning()
};
