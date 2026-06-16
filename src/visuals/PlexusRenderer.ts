import p5 from 'p5';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import { featureFlags } from '../config/featureFlags';
import { applyTuningMorph, tuneAudioValue, writeModulationBus } from '../config/visualTuning';
import { P5RendererBackend } from './P5RendererBackend';
import type { DashboardUI } from '../ui/DashboardUI';
import type { AudioEngine } from '../audio/AudioEngine';
import type { AudioFrame, VisualCueKind, VisualFeatureFrame } from '../types';
import { VisualDirectorFSM } from './VisualDirectorFSM';
import type { StyleRegistry } from './StyleRegistry';

export function startPlexusRenderer(containerId: string, ui: DashboardUI, engine: AudioEngine, styleRegistry: StyleRegistry) {
    new p5((p: p5) => {
        let particles: Particle[] = [];
        let shockwaves: Shockwave[] = [];
        let currentEventIdx = 0;
        let currentCueIdx = 0;
        let currentTargetFrameRate = 60;
        const backend = new P5RendererBackend(p);
        const visualDirector = new VisualDirectorFSM();

        p.setup = () => {
            const renderer = p.createCanvas(p.windowWidth, p.windowHeight);
            renderer.parent(containerId);
            p.frameRate(60);
            for (let i = 0; i < 75; i++) particles.push(new Particle(p));
            ui.setExportTarget(p, (renderer as unknown as { elt: HTMLCanvasElement }).elt);
        };

        const syncEventIndex = (time: number) => {
            currentEventIdx = State.events.findIndex(e => e.time >= time);
            if (currentEventIdx === -1) currentEventIdx = State.events.length;
            currentCueIdx = State.trackAnalysis.cues.findIndex(e => e.time >= time);
            if (currentCueIdx === -1) currentCueIdx = State.trackAnalysis.cues.length;
            resetTransientVisualState();
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

            const fadeStep = 1 / targetFrameRate;
            if (State.isPlaying || State.isExporting) {
                State.playbackFade = Math.min(1.0, State.playbackFade + fadeStep);
            } else {
                State.playbackFade = Math.max(0.0, State.playbackFade - fadeStep);
            }
            State.rotationPhase += State.playbackFade;

            applyTuningMorph(State.visualTuning, State.targetTuning, State.targetTuning.transitionSpeed);

            let ct = State.isExporting ? State.exportTime : engine.getCurrentTime();
            State.currentTime = ct;

            if ((State.isPlaying || State.isExporting) && State.frames.length > 0) {
                let frameIdx = Math.floor(ct * State.sampleRate / State.hopSize);
                publishCurrentAnalysisFrame(frameIdx);

                while (currentEventIdx < State.events.length && ct >= State.events[currentEventIdx].time) {
                    let ev = State.events[currentEventIdx];
                    State.beatDecay = 1.0;
                    if (ev.type === 2) State.denseImpactFlash = 1.0;
                    shockwaves.push(new Shockwave(p, tuneAudioValue(ev.intensity, State.visualTuning), State.currentFrame.state, ev.type));
                    currentEventIdx++;
                }

                while (currentCueIdx < State.trackAnalysis.cues.length && ct >= State.trackAnalysis.cues[currentCueIdx].time) {
                    let cue = State.trackAnalysis.cues[currentCueIdx];
                    let cueIntensity = tuneAudioValue(cue.intensity, State.visualTuning);
                    State.cueDecay = Math.max(State.cueDecay, cueIntensity);
                    State.activeCueKind = cue.kind;
                    State.activePatternId = cue.kind === 'pattern' ? cue.patternId || null : State.activePatternId;
                    shockwaves.push(new Shockwave(p, cueIntensity, State.currentFrame.state, cueTypeToShockwave(cue.kind)));
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

            const visualIdentity = styleRegistry.get(State.visualMode);
            visualIdentity.draw(backend, particles, shockwaves);
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
