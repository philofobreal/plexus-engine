export interface BeatEvent {
    time: number;
    intensity: number;
    type: 1 | 2 | 3; // 1: default spectral-flux hit, 2: dense impact hit, 3: fx/high-transient hit
}

export type AutoState = 'IDLE' | 'HIGH' | 'LOW' | 'LOW_DROP' | 'LOW_OVERLOAD';

export type VisualMode = 'classic' | 'temporal';

export interface VisualTuningConfig {
    audioSensitivity: number;
    transitionSpeed: number;
    chromaKeyMode: number;
    performanceMode: number;
    backgroundRed: number;
    backgroundGreen: number;
    backgroundBlue: number;
    particleIdleSpeed: number;
    particleEnergySpeed: number;
    particleBeatSpeed: number;
    particleBoundaryPull: number;
    particleActivityTurn: number;
    shockwaveRadius: number;
    shockwaveSpeed: number;
    shockwaveAlpha: number;
    shockwaveThickness: number;
    shockwaveExpansion: number;
    shockwaveDecay: number;
    circleBackgroundHue: number;
    circleBackgroundAlpha: number;
    circleHue: number;
    circleAlpha: number;
    circleSize: number;
    circleLineWeight: number;
    lineHue: number;
    lineAlpha: number;
    lineDistance: number;
    lineWeight: number;
    polygonHue: number;
    polygonAlpha: number;
    polygonSize: number;
    polygonFlash: number;
    temporalRingSize: number;
    temporalRingAlpha: number;
    temporalRingSpeed: number;
    temporalNetworkDistance: number;
    temporalPolygonAlpha: number;
}

export interface ModulationState {
    kineticTension: number;
    densityDrive: number;
    spectralChaos: number;
    rhythmicImpulse: number;
    macroMomentum: number;
}

export interface AudioFrame {
    /** Normalized RMS energy. */
    e: number;
    /** Legacy compatibility field: density projection, not bass. */
    b: number;
    /** Legacy compatibility field: melody-presence projection, not mid band. */
    m: number;
    /** Legacy compatibility field: FX-presence projection, not treble. */
    t: number;
    state: AutoState;
    eRatio: number;
}

export type VisualCueKind = 'melody' | 'vocal' | 'fx' | 'impact' | 'break' | 'pattern';

export type TrackSectionLabel = 'intro' | 'verse' | 'build' | 'drop' | 'break' | 'peak' | 'outro';

export interface VisualFeatureFrame {
    melody: number;
    vocal: number;
    fx: number;
    density: number;
    brightness: number;
    tension: number;
}

export interface VisualCueEvent {
    time: number;
    duration: number;
    intensity: number;
    confidence: number;
    kind: VisualCueKind;
    patternId?: string;
}

export interface TrackSection {
    start: number;
    end: number;
    label: TrackSectionLabel;
    energy: number;
    density: number;
    dominantFeature: VisualCueKind | 'rhythm';
    avgRms: number;
    peakRms: number;
}

export interface BarAnalysis {
    index: number;
    start: number;
    end: number;
    energy: number;
    density: number;
    avgRms: number;
    peakRms: number;
    bass: number;
    mid: number;
    treble: number;
    state: Extract<AutoState, 'HIGH' | 'LOW'>;
    dominantFeature: VisualCueKind | 'rhythm';
}

export interface PatternOccurrence {
    start: number;
    end: number;
    intensity: number;
    confidence: number;
}

export interface MusicPattern {
    id: string;
    signature: string;
    label: TrackSectionLabel;
    dominantFeature: VisualCueKind | 'rhythm';
    occurrences: PatternOccurrence[];
    averageEnergy: number;
    averageDensity: number;
}

export interface TensionTrendSegment {
    start: number;
    end: number;
    startValue: number;
    endValue: number;
    direction: 'rising' | 'falling' | 'stable';
    confidence: number;
}

export interface TensionTrends {
    globalSlope: number;
    peakTime: number;
    peakValue: number;
    segments: TensionTrendSegment[];
}

export interface TrackAnalysis {
    duration: number;
    bars: BarAnalysis[];
    sections: TrackSection[];
    patterns: MusicPattern[];
    cues: VisualCueEvent[];
    significantMoments: VisualCueEvent[];
    features: VisualFeatureFrame[];
    buildupConfidence: number[];
    tensionTrends: TensionTrends;
    featureHopSize: number;
}

export interface AnalysisResult {
    requestId: number;
    bpm: number;
    frames: AudioFrame[];
    events: BeatEvent[];
    hopSize: number;
    trackAnalysis: TrackAnalysis;
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
