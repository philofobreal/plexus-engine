// Composition/coordination facade for the /xr/ page (ADR-009), equivalent in role to
// DashboardUI/MvpVisualController: it wires AudioEngine, the gameplay session, the Three.js scene,
// and the launch/HUD DOM, but AudioEngine remains the sole playback clock and lifecycle owner.
// This is the ONLY module under src/xr/ that reads the shared State store, and only reads it (the
// existing analysis-publication fields AudioEngine already writes there for the dashboard/MVP).
// It is also the only src/xr/ module that may prepare the offline automation plan
// (`automation/prepareWormholePerformance`); gameplay and the background receive it as plain data.

import * as THREE from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG, RhythmGameSession } from '../gameplay';
import { State } from '../state/store';
import { detectImmersiveVrSupport, type ImmersiveVrSupport } from './runtime/XrCapabilityDetector';
import { XrInputAdapter, type ControllerHand } from './runtime/XrInputAdapter';
import { applyConservativeFoveation, applyTargetFrameRate } from './runtime/XrPerformanceProfile';
import type { XrDiagnosticsOptions, XrRuntime } from './runtime/XrRuntime';
import { RhythmGameScene } from './scene/RhythmGameScene';
import { XrPlaybackBinding } from './XrPlaybackBinding';
import { DesktopInputAdapter, desktopStrikeForRay } from './DesktopInputAdapter';
import type { CanvasVisualSourceFactory, VisualAnalysisSnapshot } from '../types/CanvasVisualSource';
import type { PerformanceAutomationPlan } from '../types';
import { prepareWormholePerformance } from '../automation/prepareWormholePerformance';

const HANDS: readonly ControllerHand[] = ['left', 'right'];

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export class XrAppController {
    private readonly engine: AudioEngine;
    private readonly runtime: XrRuntime;
    private readonly scene: RhythmGameScene;
    private readonly inputAdapter: XrInputAdapter;
    private readonly session = new RhythmGameSession();
    private readonly worldToPlayfield = new THREE.Matrix4();
    private readonly viewerForward = new THREE.Vector3();
    private readonly viewerRotation = new THREE.Quaternion();
    private readonly playback: XrPlaybackBinding;
    private readonly desktopInput: DesktopInputAdapter;
    private readonly desktopRay = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private loading = false;
    private loadGeneration = 0;
    private disposed = false;
    private activeXrSession: XRSession | null = null;
    private referenceSpace: XRReferenceSpace | null = null;
    private readonly handleVisibility = () => {
        if (this.activeXrSession?.visibilityState !== 'visible') this.pauseGame();
    };
    private readonly handleReferenceReset = () => {
        this.pauseGame();
        this.headsetHeightSampled = false;
    };

    private xrSupport: ImmersiveVrSupport = 'unknown';
    private headsetHeightSampled = false;

    // DOM
    private readonly overlay: HTMLDivElement;
    private readonly fileInput: HTMLInputElement;
    private readonly progressEl: HTMLParagraphElement;
    private readonly errorEl: HTMLParagraphElement;
    private readonly trackInfoEl: HTMLParagraphElement;
    private readonly capabilityEl: HTMLParagraphElement;
    private readonly enterVrButton: HTMLButtonElement;
    private readonly previewButton: HTMLButtonElement;
    private readonly wormholeToggle: HTMLInputElement;

    private readonly diagnostics: boolean;

    constructor(engine: AudioEngine, runtime: XrRuntime, hostContainer: HTMLElement, wormholeFactory?: CanvasVisualSourceFactory,
        options: XrDiagnosticsOptions = {}) {
        this.diagnostics = options.diagnostics === true;
        this.engine = engine;
        this.runtime = runtime;
        this.scene = new RhythmGameScene(runtime.scene, DEFAULT_RHYTHM_GAME_CONFIG, wormholeFactory);
        this.inputAdapter = new XrInputAdapter(runtime.renderer, runtime.scene);
        this.playback = new XrPlaybackBinding(engine, this.session, () => this.inputAdapter.resetMotion(),
            () => this.runtime.setPlaying(this.session.getState() === 'playing'));
        this.desktopInput = new DesktopInputAdapter(runtime.renderer.domElement);
        this.desktopInput.onTogglePlayback = () => this.toggleDesktopPlayback();
        this.desktopInput.onStrike = (hand, x, y) => {
            if (this.runtime.isPresenting() || this.session.getState() !== 'playing') return;
            const time = this.engine.getCurrentTime();
            this.pointer.set(x, y);
            this.desktopRay.setFromCamera(this.pointer, this.runtime.camera);
            this.desktopRay.ray.applyMatrix4(this.scene.getWorldToPlayfield(this.worldToPlayfield));
            const strike = desktopStrikeForRay(this.desktopRay.ray, this.session.getActiveNotes(time), time, hand);
            if (strike) this.session.attemptStrike(strike);
        };

        const dom = buildLaunchOverlay();
        this.overlay = dom.overlay;
        this.fileInput = dom.fileInput;
        this.progressEl = dom.progressEl;
        this.errorEl = dom.errorEl;
        this.trackInfoEl = dom.trackInfoEl;
        this.capabilityEl = dom.capabilityEl;
        this.enterVrButton = dom.enterVrButton;
        this.previewButton = dom.previewButton;
        this.wormholeToggle = dom.wormholeToggle;
        dom.wormholeToggle.addEventListener('change', () => {
            void this.scene.setWormholeEnabled(dom.wormholeToggle.checked).then(() => this.runtime.invalidate()).catch(error => this.handleWormholeError(error));
            this.runtime.invalidate();
        });
        hostContainer.appendChild(this.overlay);

        this.wireAudioEngine();
        this.wireInput();
        this.wireDom();
        this.runtime.setUpdateCallback((frame, deltaSec) => this.handleFrame(frame, deltaSec));
        this.runtime.onSessionStart = () => this.handleSessionStart();
        this.runtime.onSessionEnd = () => this.handleSessionEnd();

        void this.refreshCapability();
        this.refreshLaunchState();
    }

    private wireAudioEngine(): void {
        this.engine.onProgress = (progress, stage) => {
            this.progressEl.textContent = `Analyzing: ${stage} (${Math.round(progress * 100)}%)`;
            this.errorEl.textContent = '';
        };
        this.engine.onAnalysisComplete = async () => {
            if (this.disposed || !this.loading) return;
            const generation = this.loadGeneration;
            const published = { events: State.events, frames: State.frames, trackAnalysis: State.trackAnalysis,
                sampleRate: State.sampleRate, hopSize: State.hopSize, bpm: State.bpm, duration: State.duration };
            this.progressEl.textContent = 'Composing musical patterns...';
            let fallback = false;
            let performancePlan: PerformanceAutomationPlan;
            try { performancePlan = await prepareWormholePerformance(published.trackAnalysis, published.duration); }
            catch { fallback = true; performancePlan = { version: 1, source: 'auto', points: [] }; }
            if (this.disposed || generation !== this.loadGeneration || !this.loading) return;
            // One offline plan, passed as plain data to both gameplay and the optional background.
            const analysis: VisualAnalysisSnapshot = { ...published, performancePlan };
            const chart = buildRhythmChart(
                { events: analysis.events, durationSec: analysis.duration, beats: analysis.trackAnalysis.beats,
                    barStarts: analysis.trackAnalysis.barStarts, timingConfidence: analysis.trackAnalysis.timingConfidence?.overall,
                    performancePlan: analysis.performancePlan },
                DEFAULT_RHYTHM_GAME_CONFIG
            );
            this.session.loadChart(chart);
            this.updateWormholeAnalysis(analysis);
            this.loading = false;
            this.progressEl.textContent = chart.length ? (fallback ? 'Analysis complete. Basic patterns (visual plan unavailable).' : 'Analysis complete. Musical choreography ready.') : 'No playable percussive events found. Choose another track.';
            this.trackInfoEl.textContent =
                `BPM ${Math.round(State.bpm)} - Duration ${formatTime(State.duration)} - ${chart.length} notes - ` +
                `${chart.filter(n => n.cutDirection && n.cutDirection !== 'any').length} arrows - ${chart.filter(n => n.pairId).length / 2} pairs`;
            if (this.diagnostics) {
                this.overlay.dataset.xrScore = JSON.stringify({ confidence: analysis.trackAnalysis.timingConfidence,
                    cues: analysis.trackAnalysis.cues, points: analysis.performancePlan?.points,
                    alignment: analysis.performancePlan?.cueAlignmentReport,
                    phrases: [...new Set(chart.map(n => n.phrase))].map(phrase => {
                        const notes = chart.filter(n => n.phrase === phrase);
                        return { phrase, start: notes[0]?.time, end: notes.at(-1)?.time, texture: notes[0]?.texture,
                            automationId: notes[0]?.automationId, arrows: notes.filter(n => n.cutDirection !== 'any').length,
                            pairs: notes.filter(n => n.pairId).length / 2, rows: [...new Set(notes.map(n => n.row))] };
                    }) });
            }
            this.refreshLaunchState();
        };
        this.engine.onAnalysisError = (message) => {
            if (this.disposed) return;
            this.loading = false;
            this.errorEl.textContent = `Analysis failed: ${message}`;
            this.progressEl.textContent = '';
            this.refreshLaunchState();
        };
    }

    private updateWormholeAnalysis(analysis: VisualAnalysisSnapshot | null): void {
        void this.scene.setWormholeAnalysis(analysis).then(() => this.runtime.invalidate()).catch(error => this.handleWormholeError(error));
    }

    private handleWormholeError(error: unknown): void {
        if (this.disposed) return;
        this.errorEl.textContent = `Wormhole: ${error instanceof Error ? error.message : String(error)}`;
        this.wormholeToggle.checked = false;
        void this.scene.setWormholeEnabled(false);
        this.runtime.invalidate();
    }

    private wireInput(): void {
        this.inputAdapter.onTriggerPress = (hand) => this.handleTriggerPress(hand);
        this.inputAdapter.onPausePress = () => this.pauseGame();
    }

    private wireDom(): void {
        this.fileInput.addEventListener('change', () => {
            const file = this.fileInput.files?.[0];
            if (!file || this.loading) return;
            const generation = ++this.loadGeneration;
            this.loading = true;
            this.session.clear();
            this.updateWormholeAnalysis(null);
            this.inputAdapter.resetMotion();
            this.refreshLaunchState();
            this.errorEl.textContent = '';
            this.progressEl.textContent = 'Decoding audio...';
            this.trackInfoEl.textContent = '';
            void this.engine.loadFile(file).catch(error => {
                if (this.disposed || generation !== this.loadGeneration) return;
                this.loading = false;
                this.errorEl.textContent = String(error);
                this.refreshLaunchState();
            });
            this.fileInput.value = '';
        });

        this.enterVrButton.addEventListener('click', () => {
            void this.enterVr();
        });
        this.previewButton.addEventListener('click', () => {
            this.toggleDesktopPlayback();
            this.previewButton.blur();
        });
    }

    private toggleDesktopPlayback(): void {
        if (this.runtime.isPresenting() || this.loading || this.session.getState() === 'idle' || !this.session.getSnapshot().totalNotes) return;
        if (this.session.getState() === 'playing') this.pauseGame();
        else if (this.session.getState() === 'paused') this.engine.play();
        else this.engine.play(0);
    }

    private async refreshCapability(): Promise<void> {
        this.xrSupport = await detectImmersiveVrSupport();
        if (this.disposed) return;
        switch (this.xrSupport) {
            case 'supported':
                this.capabilityEl.textContent = 'WebXR immersive-vr: supported.';
                break;
            case 'unsupported':
                this.capabilityEl.textContent = 'WebXR immersive-vr is not supported on this device/browser.';
                break;
            case 'no-webxr':
                this.capabilityEl.textContent = 'WebXR is not available in this browser.';
                break;
            default:
                this.capabilityEl.textContent = 'Checking WebXR support...';
        }
        this.refreshLaunchState();
    }

    private refreshLaunchState(): void {
        this.runtime.setPlaying(this.session.getState() === 'playing');
        const chartReady = this.session.getState() !== 'idle' && this.session.getSnapshot().totalNotes > 0;
        this.fileInput.disabled = this.loading;
        this.previewButton.disabled = this.loading || !chartReady;
        this.enterVrButton.disabled = this.loading || !(this.xrSupport === 'supported' && chartReady);
    }

    private async enterVr(): Promise<void> {
        if (this.xrSupport !== 'supported' || this.loading || this.runtime.isPresenting()) return;
        this.enterVrButton.disabled = true;
        try {
            const session = await this.runtime.requestImmersiveSession();
            await applyTargetFrameRate(session);
            applyConservativeFoveation(this.runtime.renderer.xr);
        } catch (error) {
            this.errorEl.textContent = error instanceof Error ? error.message : 'Could not start the VR session.';
        } finally {
            this.refreshLaunchState();
        }
    }

    private handleSessionStart(): void {
        this.pauseGame();
        this.headsetHeightSampled = false;
        this.inputAdapter.resetMotion();
        this.activeXrSession = this.runtime.renderer.xr.getSession();
        this.activeXrSession?.addEventListener('visibilitychange', this.handleVisibility);
        this.referenceSpace = this.runtime.renderer.xr.getReferenceSpace();
        this.referenceSpace?.addEventListener('reset', this.handleReferenceReset);
        this.overlay.style.display = 'none';
    }

    private handleSessionEnd(): void {
        this.pauseGame();
        this.scene.placeForViewer(0, 1.65, 0, 0);
        this.activeXrSession?.removeEventListener('visibilitychange', this.handleVisibility);
        this.referenceSpace?.removeEventListener('reset', this.handleReferenceReset);
        this.activeXrSession = null;
        this.referenceSpace = null;
        this.overlay.style.display = '';
        this.headsetHeightSampled = false;
    }

    private handleTriggerPress(_hand: ControllerHand): void {
        if (this.loading || !this.headsetHeightSampled) return;
        switch (this.session.getState()) {
            case 'ready':
                this.session.start();
                this.engine.play(0);
                break;
            case 'playing':
                break;
            case 'paused':
                this.session.resume();
                this.engine.play();
                break;
            case 'finished':
                this.session.restart();
                this.engine.play(0);
                break;
            default:
                break;
        }
    }

    private pauseGame(): void {
        if (this.session.getState() === 'playing') {
            this.session.pause();
            this.engine.stop(false);
        }
        this.inputAdapter.resetMotion();
    }

    private sampleHeadsetHeightIfNeeded(frame: XRFrame | null): void {
        if (this.headsetHeightSampled || !frame) return;
        const referenceSpace = this.runtime.renderer.xr.getReferenceSpace();
        if (!referenceSpace) return;
        const pose = frame.getViewerPose(referenceSpace);
        if (!pose) return;
        const { position, orientation } = pose.transform;
        this.viewerRotation.set(orientation.x, orientation.y, orientation.z, orientation.w);
        this.viewerForward.set(0, 0, -1).applyQuaternion(this.viewerRotation);
        const yaw = Math.atan2(-this.viewerForward.x, -this.viewerForward.z);
        this.scene.placeForViewer(position.x, position.y, position.z, yaw);
        this.headsetHeightSampled = true;
    }

    private currentInstruction(): string {
        if (!this.runtime.isPresenting()) {
            if (this.session.getState() === 'playing') return 'Blue: left click. Pink: right click. Space: pause.';
            if (this.session.getState() === 'paused') return 'Paused. Space to resume.';
            if (this.session.getState() === 'ready') return 'Space or Play to start.';
            if (this.session.getState() === 'finished') return 'Finished! Space to restart.';
        }
        switch (this.session.getState()) {
            case 'idle':
                return 'Select a track to begin.';
            case 'ready':
                return 'Pull a trigger to start.';
            case 'playing':
                return 'Cut along arrows. Dots: any direction. Grip: pause.';
            case 'paused':
                return 'Paused. Trigger to resume.';
            case 'finished':
                return 'Finished! Trigger to restart.';
            default:
                return '';
        }
    }

    private handleFrame(frame: XRFrame | null, deltaSec: number): void {
        this.sampleHeadsetHeightIfNeeded(frame);
        // Controller velocity only; never used to decide song/chart position.
        // Canonical song clock, read once per frame and passed explicitly into gameplay/scene updates.
        const audioTime = this.engine.getCurrentTime();
        const songTime = this.session.getState() === 'finished' ? State.duration : audioTime;
        const space = this.runtime.renderer.xr.getReferenceSpace();
        const tracked = !!frame && !!space && !!frame.getViewerPose(space);
        if (frame && !tracked) this.pauseGame();
        this.inputAdapter.update(deltaSec, songTime, tracked);

        this.scene.getWorldToPlayfield(this.worldToPlayfield);
        for (const hand of HANDS) {
            const attempt = this.inputAdapter.getStrikeAttempt(hand, songTime, this.worldToPlayfield);
            if (!attempt) continue;
            const result = this.session.attemptStrike(attempt);
            if (result) this.inputAdapter.pulseHaptics(hand, result.grade === 'perfect' ? 1 : 0.55, 35);
        }
        this.session.update(songTime);

        const activeNotes = this.session.getActiveNotes(songTime);
        this.scene.update(activeNotes, songTime, this.session.getSnapshot(), this.currentInstruction());
        const previewLabel = this.session.getState() === 'playing' ? 'Pause'
            : this.session.getState() === 'paused' ? 'Resume'
            : this.session.getState() === 'finished' ? 'Restart' : 'Play';
        if (this.previewButton.textContent !== previewLabel) this.previewButton.textContent = previewLabel;
    }

    dispose(): void {
        this.disposed = true;
        this.loadGeneration++;
        this.handleSessionEnd();
        this.playback.dispose();
        this.desktopInput.dispose();
        this.engine.onProgress = undefined;
        this.engine.onAnalysisComplete = undefined;
        this.engine.onAnalysisError = undefined;
        this.runtime.setUpdateCallback(null);
        this.runtime.onSessionStart = null;
        this.runtime.onSessionEnd = null;
        this.inputAdapter.dispose();
        this.scene.dispose();
        this.overlay.remove();
    }
}

interface LaunchOverlayDom {
    overlay: HTMLDivElement;
    fileInput: HTMLInputElement;
    progressEl: HTMLParagraphElement;
    errorEl: HTMLParagraphElement;
    trackInfoEl: HTMLParagraphElement;
    capabilityEl: HTMLParagraphElement;
    enterVrButton: HTMLButtonElement;
    previewButton: HTMLButtonElement;
    wormholeToggle: HTMLInputElement;
}

function buildLaunchOverlay(): LaunchOverlayDom {
    const overlay = document.createElement('div');
    overlay.className = 'xr-launch-overlay';

    const title = document.createElement('h1');
    title.textContent = 'Plexus XR';
    title.className = 'xr-launch-title';

    const instructions = document.createElement('p');
    instructions.className = 'xr-launch-instructions';
    instructions.textContent = 'Desktop: blue = left click, pink = right click; cut direction is assisted. Space: play / pause. VR: follow the arrows with the matching saber; dots allow any direction. Paired targets share a beat. Trigger: start / resume. Grip: pause.';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.setAttribute('aria-label', 'Choose audio track');
    fileInput.className = 'xr-file-input';

    const progressEl = document.createElement('p');
    progressEl.className = 'xr-progress';

    const errorEl = document.createElement('p');
    errorEl.className = 'xr-error';

    const trackInfoEl = document.createElement('p');
    trackInfoEl.className = 'xr-track-info';

    const capabilityEl = document.createElement('p');
    capabilityEl.className = 'xr-capability';
    capabilityEl.textContent = 'Checking WebXR support...';

    const enterVrButton = document.createElement('button');
    enterVrButton.type = 'button';
    enterVrButton.className = 'xr-enter-button';
    enterVrButton.textContent = 'Enter VR';
    enterVrButton.disabled = true;

    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'xr-preview-button';
    previewButton.textContent = 'Play';
    previewButton.disabled = true;
    const actions = document.createElement('div');
    actions.className = 'xr-actions';
    actions.append(enterVrButton, previewButton);
    const wormholeToggle = document.createElement('input');
    wormholeToggle.type = 'checkbox';
    const wormholeLabel = document.createElement('label');
    wormholeLabel.className = 'xr-wormhole-toggle';
    wormholeLabel.append(wormholeToggle, document.createTextNode(' Wormhole background'));
    overlay.append(title, instructions, fileInput, progressEl, errorEl, trackInfoEl, capabilityEl, actions, wormholeLabel);

    return { overlay, fileInput, progressEl, errorEl, trackInfoEl, capabilityEl, enterVrButton, previewButton, wormholeToggle };
}
