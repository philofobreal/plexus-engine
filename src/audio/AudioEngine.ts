import AnalyzerWorker from './analyzer.worker.ts?worker';
import { State } from '../state/store';
import type { AnalysisWorkerMessage, TrackAnalysis, VisualFeatureFrame } from '../types';

const ANALYSIS_ALGORITHM_VERSION = 2;
const EMPTY_FEATURES: VisualFeatureFrame = { melody: 0, vocal: 0, fx: 0, density: 0, brightness: 0, tension: 0 };
const EMPTY_TRACK_ANALYSIS: TrackAnalysis = {
    duration: 0,
    bars: [],
    sections: [],
    patterns: [],
    cues: [],
    significantMoments: [],
    features: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    featureHopSize: 1024,
    gridOffset: 0
};

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    private activeWorker: Worker | null = null;
    private currentAnalysisRequestId = 0;

    private playStartTime = 0;
    private playOffset = 0;
    public pausedAt = 0;

    public onAnalysisComplete?: () => void;
    public onAnalysisError?: (message: string) => void;
    public onPlaybackEnded?: () => void;
    private playbackEndedListeners: Array<() => void> = [];
    private positionChangedListeners: Array<(time: number) => void> = [];

    addPlaybackEndedListener(listener: () => void) { this.playbackEndedListeners.push(listener); }
    addPositionChangedListener(listener: (time: number) => void) { this.positionChangedListeners.push(listener); }
    getAudioBuffer(): AudioBuffer | null { return this.buffer; }

    private emitPlaybackEnded() {
        if (this.onPlaybackEnded) this.onPlaybackEnded();
        for (const listener of this.playbackEndedListeners) listener();
    }

    private emitPositionChanged(time: number) {
        for (const listener of this.positionChangedListeners) listener(time);
    }

    private clearAnalysisState() {
        State.duration = 0;
        State.bpm = 0;
        State.frames = [];
        State.events = [];
        State.trackAnalysis = JSON.parse(JSON.stringify(EMPTY_TRACK_ANALYSIS)); // Deep copy to prevent reference pollution
        State.performancePlan = null;
        State.editedPerformancePlan = null;
        State.hopSize = 1024;
        State.currentFrame = { e: 0, b: 0, m: 0, t: 0, state: 'IDLE', eRatio: 0 };
        State.currentFeatures = { ...EMPTY_FEATURES };
        State.modulation = { kineticTension: 0, densityDrive: 0, spectralChaos: 0, rhythmicImpulse: 0, macroMomentum: 0 };
        State.activeCueKind = null;
        State.activePatternId = null;
        State.cueDecay = 0;
        State.beatDecay = 0;
        State.denseImpactFlash = 0;
    }

    private terminateActiveWorker() {
        if (this.activeWorker) {
            this.activeWorker.terminate();
            this.activeWorker = null;
        }
    }

    async loadFile(file: File) {
        this.stop(true);
        this.terminateActiveWorker();
        const requestId = ++this.currentAnalysisRequestId;
        this.clearAnalysisState();
        this.buffer = null;

        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await file.arrayBuffer();
            this.buffer = await this.ctx.decodeAudioData(arrayBuffer);

            State.duration = this.buffer.duration;
            State.sampleRate = this.buffer.sampleRate;

            const worker = new AnalyzerWorker();
            this.activeWorker = worker;

            const channelData = this.buffer.getChannelData(0);
            const analysisSamples = new Float32Array(channelData.length);
            analysisSamples.set(channelData);

            worker.postMessage({
                requestId,
                algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
                samples: analysisSamples.buffer,
                sampleRate: State.sampleRate,
                phraseSize: State.targetTuning.phraseSize
            }, [analysisSamples.buffer]);

            worker.onmessage = (e: MessageEvent<AnalysisWorkerMessage>) => {
                if (e.data.requestId !== this.currentAnalysisRequestId) return;
                this.terminateActiveWorker();

                if (e.data.type === 'analysis_done') {
                    State.bpm = e.data.bpm;
                    State.targetTuning.dynamicsThreshold = e.data.adaptiveThreshold;
                    State.visualTuning.dynamicsThreshold = e.data.adaptiveThreshold;
                    State.frames = e.data.frames;
                    State.events = e.data.events;
                    // Strict normalization mapping incoming generic objects to rigorous domain models
                    State.trackAnalysis = normalizeTrackAnalysis(e.data.trackAnalysis);
                    State.hopSize = e.data.hopSize;
                    if (this.onAnalysisComplete) this.onAnalysisComplete();
                    return;
                }

                this.clearAnalysisState();
                if (this.onAnalysisError) this.onAnalysisError(e.data.message);
            };

            worker.onerror = (error) => {
                if (requestId !== this.currentAnalysisRequestId) return;
                this.terminateActiveWorker();
                this.clearAnalysisState();
                if (this.onAnalysisError) this.onAnalysisError(error.message || 'Worker analysis failed');
            };
        } catch (error) {
            if (requestId !== this.currentAnalysisRequestId) return;
            this.terminateActiveWorker();
            this.clearAnalysisState();
            if (this.onAnalysisError) this.onAnalysisError(error instanceof Error ? error.message : 'Audio load failed');
        }
    }

    play(offset: number = this.pausedAt) {
        if (!this.ctx || !this.buffer) return;
        if (this.source) this.stop(false);
        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.playOffset = Math.max(0, Math.min(offset, State.duration));
        this.pausedAt = this.playOffset;
        this.playStartTime = this.ctx.currentTime;

        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.ctx.destination);

        this.source.onended = () => {
            if (this.getCurrentTime() >= State.duration - 0.1) {
                if (State.loopPlayback) {
                    this.stop(true);
                    this.play(0);
                } else {
                    this.stop(true);
                    this.emitPlaybackEnded();
                }
            }
        };

        this.source.start(0, this.playOffset);
        State.isPlaying = true;
        State.currentTime = this.playOffset;
        this.emitPositionChanged(this.playOffset);
    }

    seek(time: number) {
        const clampedTime = Math.max(0, Math.min(time, State.duration));
        const shouldResume = State.isPlaying;
        if (this.source) this.stop(false);

        this.pausedAt = clampedTime;
        State.currentTime = clampedTime;
        this.emitPositionChanged(clampedTime);

        if (shouldResume) this.play(clampedTime);
    }

    stop(reset: boolean = false) {
        const stoppedAt = this.getCurrentTime();
        if (this.source) {
            this.source.onended = null;
            try { this.source.stop(); } catch(e){}
            this.source.disconnect();
            this.source = null;
        }

        State.isPlaying = false;
        if (reset) {
            this.pausedAt = 0;
            State.currentTime = 0;
            this.emitPositionChanged(0);
        } else {
            this.pausedAt = Math.max(0, Math.min(stoppedAt, State.duration));
            State.currentTime = this.pausedAt;
        }
    }

    getCurrentTime(): number {
        if (!State.isPlaying || !this.ctx) return this.pausedAt;
        const latency = (this.ctx.outputLatency || 0.02) + 0.01;
        return Math.max(0, this.playOffset + (this.ctx.currentTime - this.playStartTime) - latency);
    }
}

function normalizeTrackAnalysis(trackAnalysis: TrackAnalysis): TrackAnalysis {
    return {
        ...EMPTY_TRACK_ANALYSIS,
        ...trackAnalysis,
        bars: (trackAnalysis.bars || []).map(bar => ({ ...bar, avgRms: bar.avgRms ?? 0, peakRms: bar.peakRms ?? 0, bass: bar.bass ?? 0, mid: bar.mid ?? 0, treble: bar.treble ?? 0 })),
        sections: (trackAnalysis.sections || []).map(section => ({ ...section, avgRms: section.avgRms ?? 0, peakRms: section.peakRms ?? 0 })),
        spectralPivot: trackAnalysis.spectralPivot || [],
        tensionTrends: trackAnalysis.tensionTrends || EMPTY_TRACK_ANALYSIS.tensionTrends,
        featureHopSize: trackAnalysis.featureHopSize || 1024,
        gridOffset: trackAnalysis.gridOffset || 0
    };
}
