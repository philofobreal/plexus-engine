import p5 from 'p5';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import { drawClassicPlexusEffect } from './ClassicPlexusEffect';
import { drawTemporalMusicEffect } from './TemporalMusicEffect';
import { applyTuningMorph, computeModulationBus, tuneAudioValue } from '../config/visualTuning';
import { P5RendererBackend } from './P5RendererBackend';
import type { DashboardUI } from '../ui/DashboardUI';
import type { AudioEngine } from '../audio/AudioEngine';
import type { VisualCueKind } from '../types';

export function startPlexusRenderer(containerId: string, ui: DashboardUI, engine: AudioEngine) {
    new p5((p: p5) => {
        let particles: Particle[] = [];
        let shockwaves: Shockwave[] = [];
        let currentEventIdx = 0;
        let currentCueIdx = 0;
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
            applyTuningMorph(State.visualTuning, State.targetTuning, State.targetTuning.transitionSpeed);

            let ct = engine.getCurrentTime();
            State.currentTime = ct;

            if (State.isPlaying && State.frames.length > 0) {
                let frameIdx = Math.floor(ct * State.sampleRate / State.hopSize);
                publishCurrentAnalysisFrame(frameIdx);

                while (currentEventIdx < State.events.length && ct >= State.events[currentEventIdx].time) {
                    let ev = State.events[currentEventIdx];
                    State.beatDecay = 1.0;
                    if (ev.type === 2) State.snareFlash = 1.0;
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
                if (!State.isPlaying) currentEventIdx = State.events.findIndex(e => e.time >= engine.pausedAt);
                if (currentEventIdx === -1) currentEventIdx = State.events.length;
                if (!State.isPlaying) currentCueIdx = State.trackAnalysis.cues.findIndex(e => e.time >= engine.pausedAt);
                if (currentCueIdx === -1) currentCueIdx = State.trackAnalysis.cues.length;
            }

            State.beatDecay *= 0.88;
            State.snareFlash *= 0.85;
            State.cueDecay *= 0.9;
            if (State.cueDecay < 0.02) {
                State.activeCueKind = null;
                State.activePatternId = null;
            }

            State.modulation = computeModulationBus(
                State.currentFrame,
                State.currentFeatures,
                State.beatDecay,
                State.cueDecay,
                State.visualTuning
            );
            applyDramaturgyBoost();

            if (p.frameCount % 4 === 0) ui.updateDashboard();

            if (State.visualMode === 'temporal') {
                drawTemporalMusicEffect(backend, particles, shockwaves);
            } else {
                drawClassicPlexusEffect(backend, particles, shockwaves);
            }
        };

        p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
    });
}

function publishCurrentAnalysisFrame(frameIdx: number) {
    if (frameIdx >= 0 && frameIdx < State.frames.length) {
        State.currentFrame = State.frames[frameIdx];
    }
    if (frameIdx >= 0 && frameIdx < State.trackAnalysis.features.length) {
        State.currentFeatures = State.trackAnalysis.features[frameIdx];
    }
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
    State.snareFlash = 0;
    State.cueDecay = 0;
    State.modulation = {
        kineticTension: 0,
        lowFrequencyDrive: 0,
        spectralChaos: 0,
        rhythmicImpulse: 0,
        macroMomentum: 0
    };
    State.activeCueKind = null;
    State.activePatternId = null;
}

function applyDramaturgyBoost() {
    if (!State.trackAnalysis.buildupConfidence.length) return;

    const frameIdx = Math.floor(State.currentTime * State.sampleRate / State.hopSize);
    const buildup = State.trackAnalysis.buildupConfidence[frameIdx] || 0;
    State.modulation.kineticTension = Math.min(1, State.modulation.kineticTension + buildup * 0.18);
    State.modulation.macroMomentum = Math.max(State.modulation.macroMomentum, buildup * 0.35);
}

function cueTypeToShockwave(kind: VisualCueKind): number {
    if (kind === 'melody') return 4;
    if (kind === 'vocal') return 5;
    if (kind === 'fx') return 6;
    if (kind === 'break') return 7;
    if (kind === 'pattern') return 8;
    return 2;
}
