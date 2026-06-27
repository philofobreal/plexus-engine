import AnalyzerWorker from './analyzer.worker.ts?worker';
import { ANALYSIS_ALGORITHM_VERSION, EMPTY_TRACK_ANALYSIS, normalizeTrackAnalysis } from '../analyzer';
import { featureFlags } from '../config/featureFlags';
import { State } from '../state/store';
import type { AnalysisWorkerMessage, VisualFeatureFrame } from '../types';
import { HeroMetronome } from './HeroMetronome';

const EMPTY_FEATURES: VisualFeatureFrame = { melody: 0, vocal: 0, fx: 0, density: 0, brightness: 0, tension: 0 };

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    public beepBuffers: AudioBuffer[] = [];
    private beepSources: AudioBufferSourceNode[] = [];
    private beepGains: GainNode[] = [];
    private activeWorker: Worker | null = null;
    private currentAnalysisRequestId = 0;

    private playStartTime = 0;
    private playOffset = 0;
    public pausedAt = 0;

    public onAnalysisComplete?: () => void;
    public onAnalysisError?: (message: string) => void;
    public onProgress?: (progress: number, stage: string) => void;
    public onPlaybackEnded?: () => void;
    private playbackEndedListeners: Array<() => void> = [];
    private positionChangedListeners: Array<(time: number) => void> = [];
    private playbackStateListeners: Array<(event: 'play' | 'pause' | 'stop' | 'seek', time: number) => void> = [];

    addPlaybackEndedListener(listener: () => void) { this.playbackEndedListeners.push(listener); }
    addPositionChangedListener(listener: (time: number) => void) { this.positionChangedListeners.push(listener); }
    addPlaybackStateListener(listener: (event: 'play' | 'pause' | 'stop' | 'seek', time: number) => void) { this.playbackStateListeners.push(listener); }
    getAudioBuffer(): AudioBuffer | null { return this.buffer; }

    private emitPlaybackEnded() {
        if (this.onPlaybackEnded) this.onPlaybackEnded();
        for (const listener of this.playbackEndedListeners) listener();
    }

    private emitPositionChanged(time: number) {
        for (const listener of this.positionChangedListeners) listener(time);
    }

    private emitPlaybackState(event: 'play' | 'pause' | 'stop' | 'seek', time: number) {
        for (const listener of this.playbackStateListeners) listener(event, time);
    }

    private clearAnalysisState() {
        this.stopBeepSources();
        this.beepBuffers = [];
        State.duration = 0;
        State.bpm = 0;
        State.frames = [];
        State.events = [];
        State.trackAnalysis = JSON.parse(JSON.stringify(EMPTY_TRACK_ANALYSIS)); // Deep copy to prevent reference pollution
        State.performancePlan = null;
        State.editedPerformancePlan = null;
        // Semantic dramaturgy layer (ADR-003): offline plans + realtime lookup are per-track.
        State.semanticNarrative = null;
        State.dramaturgicalIntent = null;
        State.visualScorePlan = null;
        State.visualChoreography = null;
        State.currentChoreography = null;
        State.semanticBaseTuning = null;
        State.hopSize = 1024;
        State.currentFrame = { e: 0, densityProj: 0, melodyProj: 0, fxProj: 0, perceptualSpectrum: new Array(24).fill(0), state: 'IDLE', eRatio: 0 };
        State.currentFeatures = { ...EMPTY_FEATURES };
        State.modulation.kineticTension = 0;
        State.modulation.densityDrive = 0;
        State.modulation.spectralChaos = 0;
        State.modulation.rhythmicImpulse = 0;
        State.modulation.macroMomentum = 0;
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

            if (this.onProgress) this.onProgress(0.1, 'Decoding audio...');

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

                if (e.data.type === 'analysis_progress') {
                    if (this.onProgress) this.onProgress(0.2 + e.data.progress * 0.8, e.data.stage);
                    return;
                }

                this.terminateActiveWorker();

                if (e.data.type === 'analysis_done') {
                    State.bpm = e.data.bpm;
                    State.targetTuning.dynamicsThreshold = e.data.adaptiveThreshold;
                    State.visualTuning.dynamicsThreshold = e.data.adaptiveThreshold;
                    State.frames = e.data.frames;
                    State.events = e.data.events;
                    // Strict normalization mapping incoming generic objects to rigorous domain models
                    State.trackAnalysis = normalizeTrackAnalysis(e.data.trackAnalysis, State.bpm);
                    State.trackAnalysis.bpm = e.data.bpm;
                    State.hopSize = e.data.hopSize;
                    this.beepBuffers = this.ctx ? HeroMetronome.generateStems(this.ctx, State.trackAnalysis) : [];
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
        this.startBeepSources(this.playOffset);

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
        for (const source of this.beepSources) source.start(0, this.playOffset);
        State.isPlaying = true;
        State.currentTime = this.playOffset;
        this.emitPositionChanged(this.playOffset);
        this.syncMetronomeState(featureFlags.heroEffect && State.visualMode === 'hero', State.visualTuning.heroBeepMode, State.visualTuning.heroBeepVolume);
        this.emitPlaybackState('play', this.playOffset);
    }

    seek(time: number) {
        const clampedTime = Math.max(0, Math.min(time, State.duration));
        const shouldResume = State.isPlaying;
        if (this.source) this.stop(false);

        this.pausedAt = clampedTime;
        State.currentTime = clampedTime;
        this.emitPositionChanged(clampedTime);
        this.emitPlaybackState('seek', clampedTime);

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
        this.stopBeepSources();

        State.isPlaying = false;
        if (reset) {
            this.pausedAt = 0;
            State.currentTime = 0;
            this.emitPositionChanged(0);
            this.emitPlaybackState('stop', 0);
        } else {
            this.pausedAt = Math.max(0, Math.min(stoppedAt, State.duration));
            State.currentTime = this.pausedAt;
            this.emitPlaybackState('pause', this.pausedAt);
        }
    }

    getCurrentTime(): number {
        if (!State.isPlaying || !this.ctx) return this.pausedAt;
        const latency = (this.ctx.outputLatency || 0.02) + 0.01;
        return Math.max(0, this.playOffset + (this.ctx.currentTime - this.playStartTime) - latency);
    }

    syncMetronomeState(isActive: boolean, beepMode: number, volume: number) {
        if (!this.ctx || this.beepGains.length === 0) return;
        const activeIndex = Math.round(Number.isFinite(beepMode) ? beepMode : 0) - 1;
        const activeVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
        for (let i = 0; i < this.beepGains.length; i++) {
            const target = isActive && i === activeIndex ? activeVolume : 0.0;
            this.beepGains[i].gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
        }
    }

    private startBeepSources(_offset: number) {
        if (!this.ctx) return;
        this.stopBeepSources();
        this.beepSources = [];
        this.beepGains = [];
        for (const buffer of this.beepBuffers) {
            const source = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();
            gain.gain.value = 0;
            source.buffer = buffer;
            source.connect(gain);
            gain.connect(this.ctx.destination);
            this.beepSources.push(source);
            this.beepGains.push(gain);
        }
    }

    private stopBeepSources() {
        for (const source of this.beepSources) {
            source.onended = null;
            try { source.stop(); } catch(e){}
            source.disconnect();
        }
        for (const gain of this.beepGains) {
            gain.disconnect();
        }
        this.beepSources = [];
        this.beepGains = [];
    }
}
