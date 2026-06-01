import p5 from 'p5';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import { drawClassicPlexusEffect } from './ClassicPlexusEffect';
import { drawTemporalMusicEffect } from './TemporalMusicEffect';
import { applyTuningMorph, tuneAudioValue, writeModulationBus } from '../config/visualTuning';
import { P5RendererBackend } from './P5RendererBackend';
import type { DashboardUI } from '../ui/DashboardUI';
import type { AudioEngine } from '../audio/AudioEngine';
import type { AudioFrame, VisualCueKind, VisualFeatureFrame } from '../types';

export function startPlexusRenderer(containerId: string, ui: DashboardUI, engine: AudioEngine) {
    new p5((p: p5) => {
        let particles: Particle[] = [];
        let shockwaves: Shockwave[] = [];
        let currentEventIdx = 0;
        let currentCueIdx = 0;
        let currentTargetFrameRate = 60;
        const backend = new P5RendererBackend(p);

        p.setup = () => {
            p.createCanvas(p.windowWidth, p.windowHeight).parent(containerId);
            p.frameRate(60);
            for (let i = 0; i < 75; i++) particles.push(new Particle(p));
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
            if (State.isPlaying) {
                State.playbackFade = Math.min(1.0, State.playbackFade + fadeStep);
            } else {
                State.playbackFade = Math.max(0.0, State.playbackFade - fadeStep);
            }
            State.rotationPhase += State.playbackFade;

            applyTuningMorph(State.visualTuning, State.targetTuning, State.targetTuning.transitionSpeed);

            let ct = engine.getCurrentTime();
            State.currentTime = ct;

            const sections = State.trackAnalysis.sections;
            const sectionIdx = sections.findIndex(s => ct >= s.start && ct < s.end);
            let activeSensitivity = State.visualTuning.audioSensitivity;
            if (sectionIdx !== -1) {
                const override = State.sectionOverrides[`section-${sectionIdx}`];
                if (override) activeSensitivity = override.sensitivity;
            }

            const originalGlobalSensitivity = State.visualTuning.audioSensitivity;
            State.visualTuning.audioSensitivity = activeSensitivity;

            if (State.isPlaying && State.frames.length > 0) {
                let frameIdx = Math.floor(ct * State.sampleRate / State.hopSize);
                publishCurrentAnalysisFrame(frameIdx);
                applyDynamicThresholds();

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
            applyStateDampening();
            applyDropAnticipation(ct);
            applyDramaturgyBoost();

            if (p.frameCount % 4 === 0) ui.updateDashboard();

            if (State.visualMode === 'temporal') {
                drawTemporalMusicEffect(backend, particles, shockwaves);
            } else {
                drawClassicPlexusEffect(backend, particles, shockwaves);
            }

            State.visualTuning.audioSensitivity = originalGlobalSensitivity;
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
    target.b = source.b;
    target.m = source.m;
    target.t = source.t;
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

function applyDynamicThresholds() {
    const frame = State.currentFrame;
    const dynamicsThreshold = State.visualTuning.dynamicsThreshold;
    const dropThreshold = State.visualTuning.dropThreshold;

    frame.state = frame.eRatio >= dynamicsThreshold ? 'HIGH' : 'LOW';
    if (frame.state === 'HIGH') {
        if (frame.e < dropThreshold) frame.state = 'LOW_DROP';
        else if (frame.e > 0.95) frame.state = 'LOW_OVERLOAD';
    }
}

function applyStateDampening() {
    if (!State.currentFrame.state.startsWith('LOW')) return;
    const restraint = State.visualTuning.breakRestraint;
    State.modulation.densityDrive *= 0.15 * restraint;
    State.modulation.kineticTension *= 0.20 * restraint;
    State.modulation.macroMomentum *= 0.10 * restraint;

    // Dampen active feature copies so direct reads in Temporal mode scale down instantly.
    State.currentFeatures.melody *= 0.20 * restraint;
    State.currentFeatures.vocal *= 0.20 * restraint;
    State.currentFeatures.fx *= 0.15 * restraint;
}

function applyDropAnticipation(currentTime: number) {
    const anticipation = State.visualTuning.dropAnticipation;
    if (anticipation <= 0 || !State.isPlaying || State.frames.length === 0) return;

    const futureTime = currentTime + anticipation;
    const futureIdx = Math.floor(futureTime * State.sampleRate / State.hopSize);
    if (futureIdx < 0 || futureIdx >= State.frames.length) return;
    const futureFrame = State.frames[futureIdx];
    if (!futureFrame || (futureFrame.state !== 'LOW' && futureFrame.state !== 'LOW_DROP')) return;

    const damp = State.visualTuning.dropDampening;
    const scale = futureFrame.state === 'LOW_DROP' ? 0.72 * damp : 0.86 * damp;
    State.modulation.kineticTension *= scale;
    State.modulation.densityDrive *= scale;
}

function decayCurrentAnalysisFrame() {
    State.currentFrame.e *= 0.9;
    State.currentFrame.b *= 0.9;
    State.currentFrame.m *= 0.9;
    State.currentFrame.t *= 0.9;
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
    State.activeCueKind = null;
    State.activePatternId = null;
}

function applyDramaturgyBoost() {
    if (!State.trackAnalysis.buildupConfidence.length) return;

    const frameIdx = Math.floor(State.currentTime * State.sampleRate / State.hopSize);
    const buildup = State.trackAnalysis.buildupConfidence[frameIdx] || 0;
    const intensity = State.visualTuning.buildupIntensity;
    State.modulation.kineticTension = Math.min(1, State.modulation.kineticTension + buildup * 0.18 * intensity);
    State.modulation.macroMomentum = Math.max(State.modulation.macroMomentum, buildup * 0.35 * intensity);
}

function cueTypeToShockwave(kind: VisualCueKind): number {
    if (kind === 'melody') return 4;
    if (kind === 'vocal') return 5;
    if (kind === 'fx') return 6;
    if (kind === 'break') return 7;
    if (kind === 'pattern') return 8;
    return 2;
}
