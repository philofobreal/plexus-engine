import p5 from 'p5';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import { featureFlags } from '../config/featureFlags';
import { applyTuningMorph, tuneAudioValue, tuningMorphDeltaSec, writeModulationBus } from '../config/visualTuning';
import { P5RendererBackend } from './P5RendererBackend';
import type { DashboardUI } from '../ui/DashboardUI';
import type { AudioEngine } from '../audio/AudioEngine';
import type { AudioFrame, MotifChoreographyFrame as ChoreographyFrame, VisualChoreographyPlan, VisualCueKind, VisualFeatureFrame, VisualMode, VisualTuningConfig } from '../types';
import { VisualDirectorFSM } from './VisualDirectorFSM';
import { resolveSemanticState } from '../semantics';
import type { StyleRegistry } from './StyleRegistry';
import type { SemanticRuntimeAdapter } from '../semantics';
import { ShockwaveLifecycle } from './ShockwaveLifecycle';
import type { ChoreographyFrame as SemanticScoreFrame } from '../types/semantics';
import { motifTransitionId, semanticScoreTransitionId } from './VisualTransitionIdentity';
import { setActiveVisualTransitionComponent } from '../state/visualTransitionState';
import { IdentityTransitionController } from './IdentityTransitionController';
import { P5RenderTargetCompositor } from './P5RenderTargetCompositor';

export class SemanticRendererBridge {
    private semanticAdapter?: SemanticRuntimeAdapter;
    private lastFrame: SemanticScoreFrame | null = null;
    private activeTransitionId: string | null = null;

    setSemanticAdapter(adapter: SemanticRuntimeAdapter | undefined): void {
        this.semanticAdapter = adapter;
        this.lastFrame = null;
        this.activeTransitionId = null;
    }

    hasPlan(): boolean {
        return this.semanticAdapter?.hasPlan() ?? false;
    }

    updateSemantic(timeSec: number, targetTuning: VisualTuningConfig): string | null {
        if (!this.semanticAdapter) return null;
        const frame = this.semanticAdapter.update(timeSec, targetTuning);
        if (frame !== this.lastFrame) {
            this.lastFrame = frame;
            this.activeTransitionId = semanticScoreTransitionId(frame);
        }
        return this.activeTransitionId;
    }
}

export function startPlexusRenderer(
    containerId: string,
    ui: DashboardUI,
    engine: AudioEngine,
    styleRegistry: StyleRegistry,
    semanticBridge: SemanticRendererBridge = new SemanticRendererBridge()
) {
    new p5((p: p5) => {
        let particles: Particle[] = [];
        const shockwaveLifecycle = new ShockwaveLifecycle<Shockwave>(State.visualMode);
        const shockwaves = shockwaveLifecycle.items;
        let currentEventIdx = 0;
        let currentCueIdx = 0;
        let currentTargetFrameRate = 60;
        let lastTuningTime: number | null = null;
        let lastTuningClockWasExport = State.isExporting;
        const backend = new P5RendererBackend(p);
        const visualDirector = new VisualDirectorFSM();
        const identityTransitionController = new IdentityTransitionController();
        let compositor: P5RenderTargetCompositor | null = null;

        // Semantic resolver (ADR-003): a monotonic cursor over the choreography frames plus a
        // memo so the resolver only recomputes when the active frame, style, or base changes —
        // not 60x/sec over an unchanged section.
        let choreoCursor = 0;
        let lastChoreoTime = -1;
        let lastResolvedChoreography: ChoreographyFrame | null = null;
        let lastResolvedStyle: VisualMode | null = null;
        let lastResolvedBase: VisualTuningConfig | null = null;
        let lastChoreoPlanRef: VisualChoreographyPlan | null = null;

        p.setup = () => {
            const renderer = p.createCanvas(p.windowWidth, p.windowHeight);
            renderer.parent(containerId);
            p.frameRate(60);
            for (let i = 0; i < 75; i++) particles.push(new Particle(p));
            compositor = new P5RenderTargetCompositor(p);
            ui.setExportTarget(p, (renderer as unknown as { elt: HTMLCanvasElement }).elt);
        };

        const syncEventIndex = (time: number) => {
            currentEventIdx = State.events.findIndex(e => e.time >= time);
            if (currentEventIdx === -1) currentEventIdx = State.events.length;
            currentCueIdx = State.trackAnalysis.cues.findIndex(e => e.time >= time);
            if (currentCueIdx === -1) currentCueIdx = State.trackAnalysis.cues.length;
            resetTransientVisualState();
            styleRegistry.forEach(identity => identity.syncPosition?.(time));
        };

        engine.addPositionChangedListener(syncEventIndex);

        engine.addPlaybackEndedListener(() => {
            currentEventIdx = 0;
            currentCueIdx = 0;
            resetTransientVisualState();
            State.currentFrame.state = 'IDLE';
            ui.updateDashboard();
        });

        p.draw = () => {
            const targetFrameRate = State.isPlaying ? 60 : State.duration > 0 ? 30 : 15;
            if (currentTargetFrameRate !== targetFrameRate) {
                currentTargetFrameRate = targetFrameRate;
                p.frameRate(targetFrameRate);
            }

            shockwaveLifecycle.syncMode(State.visualMode);

            const fadeStep = 1 / targetFrameRate;
            if (State.isPlaying || State.isExporting) {
                State.playbackFade = Math.min(1.0, State.playbackFade + fadeStep);
            } else {
                State.playbackFade = Math.max(0.0, State.playbackFade - fadeStep);
            }
            State.rotationPhase += State.playbackFade;

            let ct = State.isExporting ? State.exportTime : engine.getCurrentTime();
            State.currentTime = ct;
            const tuningClockChanged = lastTuningClockWasExport !== State.isExporting;
            const tuningDeltaSec = tuningMorphDeltaSec(ct, lastTuningTime, tuningClockChanged);
            lastTuningTime = ct;
            lastTuningClockWasExport = State.isExporting;
            applyTuningMorph(
                State.visualTuning,
                State.targetTuning,
                State.targetTuning.transitionSpeed,
                tuningDeltaSec
            );

            const hasTimeBasedSemanticPlan = semanticBridge.hasPlan();
            const isTimeBasedSemanticActive = featureFlags.semanticChoreography && hasTimeBasedSemanticPlan;
            if (featureFlags.semanticChoreography) {
                const semanticTransitionId = semanticBridge.updateSemantic(ct, State.targetTuning);
                setActiveVisualTransitionComponent(
                    'semantic-score',
                    isTimeBasedSemanticActive ? semanticTransitionId : null
                );
            } else {
                setActiveVisualTransitionComponent('semantic-score', null);
            }

            // Semantic dramaturgy layer (ADR-003): when enabled, the resolved choreography
            // owns targetTuning (the slow param channel). The VisualDirectorFSM and the
            // modulation bus below are untouched — they remain the fast audio-reactive channel.
            if (!isTimeBasedSemanticActive && featureFlags.semanticResolver && State.visualChoreography) {
                // A recompute / dramaturgy load swaps the plan object: the old cursor and memo now
                // index a stale frames array (wrong slice, or out of bounds). Reset everything.
                if (State.visualChoreography !== lastChoreoPlanRef) {
                    lastChoreoPlanRef = State.visualChoreography;
                    choreoCursor = 0;
                    lastChoreoTime = -1;
                    lastResolvedChoreography = null;
                    lastResolvedStyle = null;
                    lastResolvedBase = null;
                }

                const frames = State.visualChoreography.frames;
                if (ct < lastChoreoTime) choreoCursor = 0; // seek / loop rewind
                lastChoreoTime = ct;
                while (choreoCursor + 1 < frames.length && frames[choreoCursor + 1].time <= ct) choreoCursor++;
                const activeFrame = frames.length > 0 && frames[choreoCursor].time <= ct ? frames[choreoCursor] : null;
                State.currentChoreography = activeFrame;

                const base = State.semanticBaseTuning;
                // Only re-resolve (and re-allocate a tuning config) when something actually changed.
                if (activeFrame !== lastResolvedChoreography || State.visualMode !== lastResolvedStyle || base !== lastResolvedBase) {
                    if (activeFrame !== lastResolvedChoreography) {
                        setActiveVisualTransitionComponent('motif', motifTransitionId(activeFrame));
                    }
                    lastResolvedChoreography = activeFrame;
                    lastResolvedStyle = State.visualMode;
                    lastResolvedBase = base;
                    const presets = base ? { [State.visualMode]: base } : {};
                    Object.assign(State.targetTuning, resolveSemanticState(activeFrame, State.visualMode, presets));
                }
            } else {
                setActiveVisualTransitionComponent('motif', null);
            }

            if ((State.isPlaying || State.isExporting) && State.frames.length > 0) {
                let frameIdx = Math.floor(ct * State.sampleRate / State.hopSize);
                publishCurrentAnalysisFrame(frameIdx);

                while (currentEventIdx < State.events.length && ct >= State.events[currentEventIdx].time) {
                    let ev = State.events[currentEventIdx];
                    State.beatDecay = 1.0;
                    if (ev.type === 2) State.denseImpactFlash = 1.0;
                    shockwaveLifecycle.emit(State.visualMode, () =>
                        new Shockwave(p, tuneAudioValue(ev.intensity, State.visualTuning), State.currentFrame.state, ev.type)
                    );
                    currentEventIdx++;
                }

                while (currentCueIdx < State.trackAnalysis.cues.length && ct >= State.trackAnalysis.cues[currentCueIdx].time) {
                    let cue = State.trackAnalysis.cues[currentCueIdx];
                    let cueIntensity = tuneAudioValue(cue.intensity, State.visualTuning);
                    State.cueDecay = Math.max(State.cueDecay, cueIntensity);
                    State.activeCueKind = cue.kind;
                    State.activePatternId = cue.kind === 'pattern' ? cue.patternId || null : State.activePatternId;
                    shockwaveLifecycle.emit(State.visualMode, () =>
                        new Shockwave(p, cueIntensity, State.currentFrame.state, cueTypeToShockwave(cue.kind))
                    );
                    currentCueIdx++;
                }
            } else {
                decayCurrentAnalysisFrame();
            }

            State.beatDecay *= 0.88;
            State.denseImpactFlash *= 0.85;
            State.cueDecay *= 0.9;
            if (State.cueDecay < 0.02) {
                State.activeCueKind = null;
                State.activePatternId = null;
            }

            writeModulationBus(
                State.modulation,
                State.currentFrame,
                State.currentFeatures,
                State.beatDecay,
                State.cueDecay,
                State.visualTuning
            );
            const directorOutput = visualDirector.update(
                ct,
                State.currentFrame,
                State.currentFeatures,
                getBuildupValueAtCurrentFrame(),
                getPivotValueAtCurrentFrame(),
                State.visualTuning,
                State.modulation,
                getDropAnticipationFrame(ct)
            );
            State.directorOutput.state = directorOutput.state;
            State.directorOutput.centripetalOrbit = directorOutput.centripetalOrbit;
            State.directorOutput.glitchIntensity = directorOutput.glitchIntensity;
            State.directorOutput.invertBackground = directorOutput.invertBackground;

            if (p.frameCount % 4 === 0) ui.updateDashboard();

            if (compositor) {
                identityTransitionController.draw(ct, backend, compositor, styleRegistry, particles, shockwaves);
            } else {
                styleRegistry.get(State.visualMode).draw(backend, particles, shockwaves);
            }
            engine.syncMetronomeState(featureFlags.heroEffect && State.visualMode === 'hero', State.visualTuning.heroBeepMode, State.visualTuning.heroBeepVolume);

        };

        p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
    });
}

function publishCurrentAnalysisFrame(frameIdx: number) {
    if (frameIdx >= 0 && frameIdx < State.frames.length) {
        copyAudioFrame(State.frames[frameIdx], State.currentFrame);
    }
    if (frameIdx >= 0 && frameIdx < State.trackAnalysis.features.length) {
        copyVisualFeatures(State.trackAnalysis.features[frameIdx], State.currentFeatures);
    }
}

function copyAudioFrame(source: AudioFrame, target: AudioFrame) {
    target.e = source.e;
    target.densityProj = source.densityProj;
    target.melodyProj = source.melodyProj;
    target.fxProj = source.fxProj;
    target.perceptualSpectrum = source.perceptualSpectrum;
    target.state = source.state;
    target.eRatio = source.eRatio;
}

function copyVisualFeatures(source: VisualFeatureFrame, target: VisualFeatureFrame) {
    target.melody = source.melody;
    target.vocal = source.vocal;
    target.fx = source.fx;
    target.density = source.density;
    target.brightness = source.brightness;
    target.tension = source.tension;
}

function getDropAnticipationFrame(currentTime: number): AudioFrame | undefined {
    const anticipation = State.visualTuning.dropAnticipation;
    if (anticipation <= 0 || (!State.isPlaying && !State.isExporting) || State.frames.length === 0) return undefined;

    const futureTime = currentTime + anticipation;
    const futureIdx = Math.floor(futureTime * State.sampleRate / State.hopSize);
    if (futureIdx < 0 || futureIdx >= State.frames.length) return undefined;
    return State.frames[futureIdx];
}

function decayCurrentAnalysisFrame() {
    State.currentFrame.e *= 0.9;
    State.currentFrame.densityProj *= 0.9;
    State.currentFrame.melodyProj *= 0.9;
    State.currentFrame.fxProj *= 0.9;
    State.currentFrame.perceptualSpectrum = State.currentFrame.perceptualSpectrum.map(value => value * 0.9);
    State.currentFrame.eRatio *= 0.9;
    State.currentFeatures.melody *= 0.9;
    State.currentFeatures.vocal *= 0.9;
    State.currentFeatures.fx *= 0.9;
    State.currentFeatures.density *= 0.9;
    State.currentFeatures.brightness *= 0.9;
    State.currentFeatures.tension *= 0.9;
}

function resetTransientVisualState() {
    State.beatDecay = 0;
    State.denseImpactFlash = 0;
    State.cueDecay = 0;
    State.modulation.kineticTension = 0;
    State.modulation.densityDrive = 0;
    State.modulation.spectralChaos = 0;
    State.modulation.rhythmicImpulse = 0;
    State.modulation.macroMomentum = 0;
    State.directorOutput.state = 'IDLE';
    State.directorOutput.centripetalOrbit = 0;
    State.directorOutput.glitchIntensity = 0;
    State.directorOutput.invertBackground = false;
    State.currentChoreography = null;
    State.activeCueKind = null;
    State.activePatternId = null;
}

function getBuildupValueAtCurrentFrame() {
    const frameIdx = Math.floor(State.currentTime * State.sampleRate / State.hopSize);
    return State.trackAnalysis.buildupConfidence[frameIdx] || 0;
}

function getPivotValueAtCurrentFrame() {
    const frameIdx = Math.floor(State.currentTime * State.sampleRate / State.hopSize);
    return State.trackAnalysis.spectralPivot[frameIdx] || 0;
}

function cueTypeToShockwave(kind: VisualCueKind): number {
    if (kind === 'melody') return 4;
    if (kind === 'vocal') return 5;
    if (kind === 'fx') return 6;
    if (kind === 'break') return 7;
    if (kind === 'pattern') return 8;
    return 2;
}
