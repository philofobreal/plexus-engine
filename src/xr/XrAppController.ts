// Composition/coordination facade for the /xr/ page (ADR-009), equivalent in role to
// DashboardUI/MvpVisualController: it wires AudioEngine, the gameplay session, the Three.js scene,
// and the launch/HUD DOM, but AudioEngine remains the sole playback clock and lifecycle owner.
// This is the ONLY module under src/xr/ that reads the shared State store, and only reads it (the
// existing analysis-publication fields AudioEngine already writes there for the dashboard/MVP).
// It is also the only src/xr/ module that may prepare the offline automation plan
// (`automation/prepareWormholePerformance`); gameplay and the background receive it as plain data.

import * as THREE from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG, RhythmGameSession, scoreRank, type RhythmGameConfig } from '../gameplay';
import { State } from '../state/store';
import { detectImmersiveVrSupport, type ImmersiveVrSupport } from './runtime/XrCapabilityDetector';
import { XrInputAdapter, type ControllerHand } from './runtime/XrInputAdapter';
import { applyConservativeFoveation, applyTargetFrameRate } from './runtime/XrPerformanceProfile';
import type { XrDiagnosticsOptions, XrRuntime } from './runtime/XrRuntime';
import { RhythmGameScene } from './scene/RhythmGameScene';
import { buildSectionTimeline } from './scene/XrSectionCallout';
import { buildScoreOverview } from './scene/XrScoreOverview';
import { XrMenuPanel } from './scene/XrMenuPanel';
import {
    activateMenuItem, DEFAULT_MENU_STATE, menuHomeScreen, menuResults, moveMenuFocus, switchMenuTab,
    type XrMenuCommand, type XrMenuContext, type XrMenuScreen, type XrMenuState
} from './XrMenuModel';
import { BackgroundDiagnostics } from './BackgroundDiagnostics';
import { XrPlaybackBinding } from './XrPlaybackBinding';
import { DesktopInputAdapter, desktopStrikeForRay, type DesktopMenuKey } from './DesktopInputAdapter';
import { XrCommandDrawer } from './XrCommandDrawer';
import { normalizeXrSettings, resolvePlayFromSettings, type XrSettings, type XrSettingScope } from './XrSettings';
import type { XrPlayProfile } from './XrPlayProfile';
import { MEMORY_ONLY_SETTINGS_STORE, type XrSettingsStore } from './XrSettingsStore';
import type { CanvasVisualSourceFactory, VisualAnalysisSnapshot } from '../types/CanvasVisualSource';
import type { PerformanceAutomationPlan } from '../types';
import { prepareWormholePerformance } from '../automation/prepareWormholePerformance';

const HANDS: readonly ControllerHand[] = ['left', 'right'];
/** Thumbstick deflection that flips a Settings tab, and the rest position that re-arms it. */
const THUMB_FLICK = 0.7;
const THUMB_REST = 0.3;

export interface XrAppControllerOptions extends XrDiagnosticsOptions {
    /** Per-viewer settings persistence, injected by the composition root (memory-only when absent). */
    readonly settingsStore?: XrSettingsStore;
}

/** Immutable analyzer publication captured once per load; regeneration never re-reads or re-analyzes. */
type PublishedAnalysis = Omit<VisualAnalysisSnapshot, 'performancePlan'>;
interface PreparedPlan { readonly key: string; readonly plan: PerformanceAutomationPlan; readonly fallback: boolean }

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
    private readonly session: RhythmGameSession;
    private readonly worldToPlayfield = new THREE.Matrix4();
    private readonly viewerForward = new THREE.Vector3();
    private readonly viewerRotation = new THREE.Quaternion();
    private readonly playback: XrPlaybackBinding;
    private readonly desktopInput: DesktopInputAdapter;
    private readonly desktopRay = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private loading = false;
    /** Invalidates stale async work for both file loads and generation-setting changes. */
    private loadGeneration = 0;
    /** Every player setting (Addendum H); restored from the store at startup, saved on each change. */
    private settings: XrSettings;
    /** Gameplay configuration implied by the session-scope settings. */
    private gameConfig: RhythmGameConfig;
    /** Note speed + saber length -> config, stage layout and blade length (Addendum I). */
    private playProfile: XrPlayProfile;
    private readonly settingsStore: XrSettingsStore;
    private published: PublishedAnalysis | null = null;
    private preparedPlan: PreparedPlan | null = null;
    /** The current track's section timeline still has to reach the scene (set by whichever compose publishes first). */
    private sectionTimelinePending = false;
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

    // Game menu in the canvas (Addendums O and S): open whenever the song is not playing, in the
    // headset (laser + trigger) and on the desktop (mouse / keyboard).
    private readonly menuPanel: XrMenuPanel;
    private menuState: XrMenuState = DEFAULT_MENU_STATE;
    private menuOpen = false;
    /** The panel is placed in front of the head on the next tracked frame. */
    private menuPlacementPending = false;
    /** The hand that last pulled its trigger leads hovering. */
    private menuHand: ControllerHand = 'right';
    private readonly menuHits: Record<ControllerHand, string | null> = { left: null, right: null };
    private readonly thumbArmed: Record<ControllerHand, boolean> = { left: true, right: true };
    private readonly pointerRay = new THREE.Ray();
    private readonly menuRaycaster = new THREE.Raycaster();
    /** Desktop mouse over the canvas (NDC), and whether it moved since the last menu frame. */
    private readonly desktopPointer = new THREE.Vector2();
    private desktopPointerInside = false;
    private desktopPointerMoved = false;
    /** The Wormhole background state last requested from the scene (follows the setting). */
    private wormholeShown = false;

    // DOM
    private readonly drawer: XrCommandDrawer;
    private readonly overlay: HTMLDivElement;
    private readonly fileInput: HTMLInputElement;
    private readonly trackTitleEl: HTMLParagraphElement;
    private readonly progressEl: HTMLParagraphElement;
    private readonly errorEl: HTMLParagraphElement;
    private readonly trackInfoEl: HTMLParagraphElement;
    private readonly capabilityEl: HTMLParagraphElement;
    private readonly enterVrButton: HTMLButtonElement;
    private readonly previewButton: HTMLButtonElement;

    private readonly diagnostics: boolean;
    private diagnosticPathRevision = -1;
    private diagnosticBackgroundMs = -1;
    /** Opt-in background profiling summary for headset runs (menu line + overlay dataset). */
    private readonly backgroundDiagnostics = new BackgroundDiagnostics();

    constructor(engine: AudioEngine, runtime: XrRuntime, hostContainer: HTMLElement, wormholeFactory?: CanvasVisualSourceFactory,
        options: XrAppControllerOptions = {}) {
        this.diagnostics = options.diagnostics === true;
        this.engine = engine;
        this.runtime = runtime;
        this.settingsStore = options.settingsStore ?? MEMORY_ONLY_SETTINGS_STORE;
        // Normalized again: an injected store may predate newer setting groups.
        this.settings = normalizeXrSettings(this.settingsStore.load());
        this.playProfile = resolvePlayFromSettings(this.settings);
        this.gameConfig = this.playProfile.config;
        this.session = new RhythmGameSession(this.gameConfig);
        this.scene = new RhythmGameScene(runtime.scene, this.gameConfig, wormholeFactory);
        this.scene.setStageLayout(this.playProfile.stage);
        // Restored presentation applies before any background is created.
        void this.scene.setBackgroundSettings(this.settings.background);
        this.scene.setNoteDesign(this.settings.appearance.noteDesign);
        this.inputAdapter = new XrInputAdapter(runtime.renderer, runtime.scene);
        this.inputAdapter.setBladeLength(this.playProfile.bladeLengthMeters);
        this.menuPanel = new XrMenuPanel();
        runtime.scene.add(this.menuPanel.root);
        this.playback = new XrPlaybackBinding(engine, this.session, () => this.inputAdapter.resetMotion(),
            () => this.handleTransportChanged());
        this.desktopInput = new DesktopInputAdapter(runtime.renderer.domElement);
        this.desktopInput.onTogglePlayback = () => this.toggleDesktopPlayback();
        this.desktopInput.onPointerMove = (x, y) => {
            this.desktopPointerInside = x !== null && y !== null;
            if (x !== null && y !== null) this.desktopPointer.set(x, y);
            this.desktopPointerMoved = true;
            if (this.menuOpen) this.runtime.invalidate();
        };
        this.desktopInput.onMenuKey = key => this.handleMenuKey(key);
        this.desktopInput.onStrike = (hand, x, y) => {
            if (this.runtime.isPresenting()) return;
            // While the game menu is open a left click chooses the item under the mouse.
            if (this.menuOpen) {
                this.desktopInput.onPointerMove?.(x, y);
                this.updateMenu(null);
                if (hand === 'left' && this.menuState.hover) this.activateMenu(this.menuState.hover);
                return;
            }
            if (this.session.getState() !== 'playing') return;
            const time = this.engine.getCurrentTime();
            this.pointer.set(x, y);
            this.desktopRay.setFromCamera(this.pointer, this.runtime.camera);
            this.desktopRay.ray.applyMatrix4(this.scene.getWorldToPlayfield(this.worldToPlayfield));
            const strike = desktopStrikeForRay(this.desktopRay.ray, this.session.getActiveNotes(time), time, hand, this.scene.path, this.gameConfig);
            if (strike) this.session.attemptStrike(strike);
        };

        const dom = new XrCommandDrawer();
        this.drawer = dom;
        this.overlay = dom.panel;
        this.fileInput = dom.fileInput;
        this.trackTitleEl = dom.trackTitleEl;
        this.progressEl = dom.progressEl;
        this.errorEl = dom.errorEl;
        this.trackInfoEl = dom.trackInfoEl;
        this.capabilityEl = dom.capabilityEl;
        this.enterVrButton = dom.enterVrButton;
        this.previewButton = dom.previewButton;
        dom.onGameMenu = () => this.toggleGameMenu();
        // An off-thread background finishing a frame while paused needs one more desktop frame.
        this.scene.onBackgroundFrame = () => this.runtime.invalidate();
        this.scene.onBackgroundError = message => this.handleWormholeError(new Error(message));
        hostContainer.appendChild(dom.root);

        this.wireAudioEngine();
        this.wireInput();
        this.wireDom();
        this.runtime.setUpdateCallback((frame, deltaSec) => this.handleFrame(frame, deltaSec));
        this.runtime.onSessionStart = () => this.handleSessionStart();
        this.runtime.onSessionEnd = () => this.handleSessionEnd();

        void this.refreshCapability();
        this.refreshLaunchState();
        // A restored "Wormhole on" applies at startup; the desktop starts on the title screen.
        this.applyWormholeSetting();
        this.openMenu('main');
    }

    private wireAudioEngine(): void {
        this.engine.onProgress = (progress, stage) => {
            this.progressEl.textContent = `Analyzing: ${stage} (${Math.round(progress * 100)}%)`;
            this.errorEl.textContent = '';
        };
        this.engine.onAnalysisComplete = async () => {
            if (this.disposed || !this.loading) return;
            this.published = { events: State.events, frames: State.frames, trackAnalysis: State.trackAnalysis,
                sampleRate: State.sampleRate, hopSize: State.hopSize, bpm: State.bpm, duration: State.duration };
            this.preparedPlan = null;
            this.sectionTimelinePending = true;
            await this.composeChoreography(this.loadGeneration, true);
        };
        this.engine.onAnalysisError = (message) => {
            if (this.disposed) return;
            this.loading = false;
            this.showError(`Analysis failed: ${message}`);
            this.progressEl.textContent = '';
            this.refreshLaunchState();
        };
    }

    /**
     * Builds the chart for the current generation settings from the captured analysis. Activity
     * and Variation also select the Visual OS plan (same meanings as the MVP), which is prepared
     * only when they change and is shared by gameplay and the Wormhole. Hand settings reuse the
     * prepared plan. Stale results (newer load or setting change) are discarded.
     */
    private async composeChoreography(generation: number, fromLoad: boolean): Promise<void> {
        const published = this.published;
        if (!published) return;
        const settings = this.settings.generation;
        const key = `${settings.activity}|${settings.variation}`;
        let prepared = this.preparedPlan;
        const planChanged = !prepared || prepared.key !== key;
        if (!prepared || planChanged) {
            this.progressEl.textContent = fromLoad ? 'Composing musical patterns...' : 'Recomposing choreography...';
            let fallback = false;
            let plan: PerformanceAutomationPlan;
            try {
                plan = await prepareWormholePerformance(published.trackAnalysis, published.duration,
                    { activityLevel: settings.activity, variantMode: settings.variation });
            } catch { fallback = true; plan = { version: 1, source: 'auto', points: [] }; }
            if (this.disposed || generation !== this.loadGeneration || !this.loading) return;
            prepared = { key, plan, fallback };
        }
        if (this.disposed || generation !== this.loadGeneration || !this.loading) return;
        // One offline plan, passed as plain data to both gameplay and the optional background.
        const analysis: VisualAnalysisSnapshot = { ...published, performancePlan: prepared.plan };
        const chart = buildRhythmChart(
            { events: analysis.events, durationSec: analysis.duration, beats: analysis.trackAnalysis.beats,
                barStarts: analysis.trackAnalysis.barStarts, timingConfidence: analysis.trackAnalysis.timingConfidence?.overall,
                performancePlan: analysis.performancePlan, sectionStarts: analysis.trackAnalysis.sections.map(section => section.start) },
            // Chart-defining fields are never player settings: note speed and saber length leave the chart unchanged.
            DEFAULT_RHYTHM_GAME_CONFIG, settings
        );
        this.preparedPlan = prepared;
        // Published sections weight the score by dramaturgy (plain data; Addendum J).
        this.session.loadChart(chart, published.trackAnalysis.sections);
        this.scene.setScoreOverview(buildScoreOverview(this.session.getScoringPlan(), published.duration));
        if (this.sectionTimelinePending) {
            this.sectionTimelinePending = false;
            this.scene.setSectionTimeline(buildSectionTimeline(published.trackAnalysis.sections,
                published.trackAnalysis.beats, published.trackAnalysis.timingConfidence?.overall ?? 0, published.duration));
        }
        if (fromLoad || planChanged) this.updateWormholeAnalysis(analysis);
        this.loading = false;
        const fallback = prepared.fallback;
        this.progressEl.textContent = chart.length ? (fallback ? 'Analysis complete. Basic patterns (visual plan unavailable).'
            : fromLoad ? 'Analysis complete. Musical choreography ready.' : 'Choreography updated. Press Play to start.')
            : 'No playable percussive events found. Choose another track.';
        this.trackInfoEl.textContent =
            `BPM ${Math.round(State.bpm)} - Duration ${formatTime(State.duration)} - ${chart.length} notes - ` +
            `${chart.filter(n => n.cutDirection && n.cutDirection !== 'any').length} arrows - ${chart.filter(n => n.pairId).length / 2} pairs`;
        if (this.diagnostics) {
            this.overlay.dataset.xrScore = JSON.stringify({ confidence: analysis.trackAnalysis.timingConfidence,
                sections: analysis.trackAnalysis.sections.map(section => [section.start, section.label]),
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
    }

    /**
     * A player setting changed (always saved). The descriptor's scope decides the effect:
     * `chart` regenerates, `session` swaps the game configuration, `presentation` applies live.
     */
    private handleSettingsChange(settings: XrSettings, scope: XrSettingScope): void {
        if (this.disposed) return;
        this.settings = settings;
        this.settingsStore.save(settings);
        if (scope === 'presentation') this.applyPresentation();
        else if (scope === 'session') this.applySessionConfig();
        else {
            // A chart setting may also reshape the stage (the play space's rows, frame and saber).
            this.applySessionConfig();
            this.regenerateChart();
        }
    }

    /**
     * Session-scope change: the chart stays, the gameplay configuration changes. A score under the
     * old configuration is meaningless, so playback rewinds; nothing is regenerated or re-analyzed.
     */
    private applySessionConfig(): void {
        const profile = resolvePlayFromSettings(this.settings);
        if (profile === this.playProfile) return;
        this.pauseGame();
        if (this.session.getState() !== 'idle') this.engine.stop(true);
        this.playProfile = profile;
        this.gameConfig = profile.config;
        this.scene.setGameConfig(profile.config);
        this.scene.setStageLayout(profile.stage);
        this.inputAdapter.setBladeLength(profile.bladeLengthMeters);
        this.session.setConfig(profile.config);
        this.refreshLaunchState();
        this.runtime.invalidate();
    }

    /**
     * Chart-scope change. Without an analyzed track it applies to the next load. With one,
     * playback stops and rewinds (the old score is meaningless for a new chart), and the chart is
     * regenerated from the captured analysis: no re-analysis, reload or new AudioEngine state.
     */
    private regenerateChart(): void {
        if (!this.published) return;
        this.pauseGame();
        this.engine.stop(true);
        const generation = ++this.loadGeneration;
        this.loading = true;
        this.inputAdapter.resetMotion();
        this.errorEl.textContent = '';
        this.refreshLaunchState();
        void this.composeChoreography(generation, false).catch(error => {
            if (this.disposed || generation !== this.loadGeneration) return;
            this.loading = false;
            this.showError(`Could not regenerate the chart: ${error instanceof Error ? error.message : String(error)}`);
            this.refreshLaunchState();
        });
    }

    /** Presentation only: never touches the chart, plan, score or playback. */
    private applyPresentation(): void {
        this.scene.setNoteDesign(this.settings.appearance.noteDesign);
        this.applyWormholeSetting();
        void this.scene.setBackgroundSettings(this.settings.background).then(() => this.runtime.invalidate())
            .catch(error => this.handleWormholeError(error));
        this.runtime.invalidate();
    }

    private updateWormholeAnalysis(analysis: VisualAnalysisSnapshot | null): void {
        void this.scene.setWormholeAnalysis(analysis).then(() => this.runtime.invalidate()).catch(error => this.handleWormholeError(error));
    }

    /** Shows or hides the Wormhole to match the setting (only on a change). */
    private applyWormholeSetting(): void {
        const wanted = this.settings.background.wormhole;
        if (wanted === this.wormholeShown) return;
        this.wormholeShown = wanted;
        void this.scene.setWormholeEnabled(wanted).then(() => this.runtime.invalidate()).catch(error => this.handleWormholeError(error));
        this.runtime.invalidate();
    }

    private handleWormholeError(error: unknown): void {
        if (this.disposed) return;
        this.showError(`Wormhole: ${error instanceof Error ? error.message : String(error)}`);
        // The failure turns the setting off (and is remembered), so the next start is not stuck on it.
        this.settings = { ...this.settings, background: { ...this.settings.background, wormhole: false } };
        this.settingsStore.save(this.settings);
        this.wormholeShown = false;
        void this.scene.setWormholeEnabled(false);
        this.runtime.invalidate();
        this.refreshLaunchState();
    }

    /** Errors always surface in the command drawer, reopening it if the player had closed it. */
    private showError(message: string): void {
        this.errorEl.textContent = message;
        this.drawer.open();
    }

    /**
     * Transport changes wake the renderer. Playing hands the view to the scene (the game menu and
     * the desktop track panel close); a pause or the song's end brings the game menu back with its
     * home screen, in the headset and on the desktop alike.
     */
    private handleTransportChanged(): void {
        const state = this.session.getState();
        this.runtime.setPlaying(state === 'playing');
        if (state === 'playing') {
            this.closeMenu();
            if (!this.runtime.isPresenting()) this.drawer.close();
            return;
        }
        if (!this.menuOpen || (state === 'finished' && this.menuState.screen !== 'settings')) this.openMenu(menuHomeScreen(state));
    }

    private wireInput(): void {
        this.inputAdapter.onTriggerPress = (hand) => this.handleTriggerPress(hand);
        this.inputAdapter.onPausePress = () => this.handleGripPress();
    }

    private wireDom(): void {
        this.fileInput.addEventListener('change', () => {
            const file = this.fileInput.files?.[0];
            if (!file || this.loading) return;
            const generation = ++this.loadGeneration;
            this.loading = true;
            this.published = null;
            this.preparedPlan = null;
            this.session.clear();
            this.scene.setSectionTimeline([]);
            this.scene.setScoreOverview(null);
            this.updateWormholeAnalysis(null);
            this.inputAdapter.resetMotion();
            this.refreshLaunchState();
            this.errorEl.textContent = '';
            this.progressEl.textContent = 'Decoding audio...';
            this.trackInfoEl.textContent = '';
            this.trackTitleEl.textContent = file.name.replace(/\.[^.]+$/, '');
            void this.engine.loadFile(file).catch(error => {
                if (this.disposed || generation !== this.loadGeneration) return;
                this.loading = false;
                this.showError(String(error));
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
        this.drawer.setStatus(this.loading ? 'busy' : this.errorEl.textContent ? 'error' : chartReady ? 'ready' : 'idle');
    }

    private async enterVr(): Promise<void> {
        if (this.xrSupport !== 'supported' || this.loading || this.runtime.isPresenting()) return;
        this.enterVrButton.disabled = true;
        try {
            const session = await this.runtime.requestImmersiveSession();
            await applyTargetFrameRate(session);
            applyConservativeFoveation(this.runtime.renderer.xr);
            // Background redraws pace against the actual headset cadence (72 Hz when unreported).
            this.scene.setDisplayFrameRate(session.frameRate ?? 72);
        } catch (error) {
            this.showError(error instanceof Error ? error.message : 'Could not start the VR session.');
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
        this.drawer.setVisible(false);
        this.openMenu(menuHomeScreen(this.session.getState()));
        // The desktop panel placement is replaced by one in front of the headset.
        this.menuPlacementPending = true;
    }

    private handleSessionEnd(): void {
        this.pauseGame();
        this.scene.placeForViewer(0, 1.65, 0, 0);
        this.scene.setDisplayFrameRate(null);
        this.activeXrSession?.removeEventListener('visibilitychange', this.handleVisibility);
        this.referenceSpace?.removeEventListener('reset', this.handleReferenceReset);
        this.activeXrSession = null;
        this.referenceSpace = null;
        this.drawer.setVisible(true);
        this.headsetHeightSampled = false;
        this.closeMenu();
        // Back on the desktop: the game menu returns in front of the page camera.
        if (!this.disposed) this.openMenu(menuHomeScreen(this.session.getState()));
    }

    /** Trigger: chooses the menu item that hand points at (never a gameplay action by itself). */
    private handleTriggerPress(hand: ControllerHand): void {
        if (!this.runtime.isPresenting()) return;
        if (!this.menuOpen) {
            if (this.session.getState() !== 'playing') this.openMenu(menuHomeScreen(this.session.getState()));
            return;
        }
        this.menuHand = hand;
        const id = this.menuHits[hand];
        if (!id || !this.headsetHeightSampled) return;
        this.inputAdapter.pulseHaptics(hand, 0.45, 18);
        this.activateMenu(id);
    }

    /** Chooses a menu item (laser, mouse or keyboard): navigation stays in the menu, the rest runs. */
    private activateMenu(id: string): void {
        const context = this.menuContext();
        const result = activateMenuItem(this.menuState, context, this.menuPanel.update(this.menuState, context), id);
        this.menuState = result.state;
        if (result.command) this.runMenuCommand(result.command);
        this.runtime.invalidate();
    }

    /** The game menu button: opens the menu (pausing a playing song) or closes it. */
    private toggleGameMenu(): void {
        if (this.runtime.isPresenting()) return;
        if (this.menuOpen) { this.closeMenu(); this.runtime.invalidate(); return; }
        if (this.session.getState() === 'playing') this.pauseGame();
        this.openMenu(menuHomeScreen(this.session.getState()));
    }

    /**
     * Desktop keys (games' convention): Escape opens the menu (pausing), goes back from Settings,
     * resumes from Pause and otherwise closes it; arrows move the focus, Enter chooses (Tab stays
     * the page's focus key).
     * Returns whether the menu used the key.
     */
    private handleMenuKey(key: DesktopMenuKey): boolean {
        if (this.runtime.isPresenting()) return false;
        if (key === 'escape') {
            if (!this.menuOpen) this.toggleGameMenu();
            else if (this.menuState.screen === 'settings') this.menuState = { ...this.menuState, screen: menuHomeScreen(this.session.getState()) };
            else if (this.menuState.screen === 'pause' && this.session.getState() === 'paused') this.runMenuCommand({ type: 'resume' });
            else this.closeMenu();
            this.runtime.invalidate();
            return true;
        }
        if (!this.menuOpen) return false;
        if (key === 'enter') {
            if (this.menuState.hover) this.activateMenu(this.menuState.hover);
            else this.menuState = moveMenuFocus(this.menuState, this.menuPanel.update(this.menuState, this.menuContext()), 'next');
        } else {
            this.menuState = moveMenuFocus(this.menuState, this.menuPanel.update(this.menuState, this.menuContext()), key);
        }
        this.runtime.invalidate();
        return true;
    }

    /** Grip: pauses the song and opens the menu; inside Settings it goes back. */
    private handleGripPress(): void {
        if (!this.runtime.isPresenting()) { this.pauseGame(); return; }
        if (this.session.getState() === 'playing') {
            this.pauseGame();
            this.openMenu('pause');
        } else if (this.menuOpen && this.menuState.screen === 'settings') {
            this.menuState = { ...this.menuState, screen: menuHomeScreen(this.session.getState()) };
        } else if (!this.menuOpen) {
            this.openMenu(menuHomeScreen(this.session.getState()));
        }
    }

    private runMenuCommand(command: XrMenuCommand): void {
        switch (command.type) {
            case 'start':
                if (this.loading || this.session.getState() !== 'ready') return;
                this.session.start();
                this.engine.play(0);
                return;
            case 'resume':
                if (this.session.getState() !== 'paused') return;
                this.session.resume();
                this.engine.play();
                return;
            case 'restart':
                if (this.loading || this.session.getState() === 'idle') return;
                if (this.session.getState() === 'paused') this.engine.stop(true);
                this.session.restart();
                this.engine.play(0);
                return;
            case 'exit-vr':
                this.runtime.endActiveSession();
                return;
            case 'settings-changed':
                this.handleSettingsChange(command.settings, command.scope);
                return;
        }
    }

    private openMenu(screen: XrMenuScreen): void {
        this.menuState = { ...this.menuState, screen, hover: null };
        if (!this.menuOpen) this.menuPlacementPending = true;
        this.menuOpen = true;
        this.menuHits.left = null; this.menuHits.right = null;
        this.menuPanel.setVisible(true);
        this.inputAdapter.setPointerMode(true);
        this.drawer.setGameMenuOpen(true);
        if (!this.runtime.isPresenting()) this.placeMenuForDesktop();
        this.runtime.invalidate();
    }

    private closeMenu(): void {
        if (!this.menuOpen) return;
        this.menuOpen = false;
        this.menuPanel.setVisible(false);
        this.inputAdapter.setPointerMode(false);
        this.drawer.setGameMenuOpen(false);
        this.runtime.renderer.domElement.dataset.menuHover = 'false';
    }

    /** On the desktop the panel floats in front of the page camera (the same distance as in VR). */
    private placeMenuForDesktop(): void {
        const camera = this.runtime.camera;
        camera.updateMatrixWorld();
        camera.getWorldDirection(this.viewerForward);
        this.menuPanel.placeFacing(camera.position.x, camera.position.y, camera.position.z, Math.atan2(-this.viewerForward.x, -this.viewerForward.z));
        this.menuPlacementPending = false;
    }

    /** What the menu shows, from the host's own state (plain data). */
    private menuContext(): XrMenuContext {
        const state = this.session.getState();
        return { settings: this.settings, sessionState: state, trackTitle: this.trackTitleEl.textContent ?? '', busy: this.loading,
            canStart: state !== 'idle' && this.session.getSnapshot().totalNotes > 0,
            status: this.loading ? this.progressEl.textContent ?? '' : '',
            results: state === 'finished' ? menuResults(this.session.getSnapshot()) : null,
            input: this.runtime.isPresenting() ? 'vr' : 'desktop',
            ...(this.diagnostics && this.backgroundDiagnostics.summary ? { diagnostics: this.backgroundDiagnostics.summary } : {}) };
    }

    /**
     * Per-frame menu work while it is open. Desktop: the mouse ray hovers items (only when the mouse
     * moved, so keyboard focus is kept). VR: place it in front of the head once, hit-test both
     * controller rays, size the lasers, flip tabs with a thumbstick flick. Redraws only on change.
     */
    private updateMenu(frame: XRFrame | null): void {
        if (!this.runtime.isPresenting()) {
            if (this.desktopPointerMoved) {
                this.desktopPointerMoved = false;
                let hover: string | null = null;
                if (this.desktopPointerInside) {
                    this.menuRaycaster.setFromCamera(this.desktopPointer, this.runtime.camera);
                    const hit = this.menuPanel.hitTest(this.menuRaycaster.ray);
                    hover = hit?.item && !hit.item.disabled ? hit.item.id : null;
                }
                this.menuState = { ...this.menuState, hover };
                this.runtime.renderer.domElement.dataset.menuHover = String(hover !== null);
            }
            this.menuPanel.update(this.menuState, this.menuContext());
            return;
        }
        if (this.menuPlacementPending && frame) {
            const space = this.runtime.renderer.xr.getReferenceSpace();
            const pose = space ? frame.getViewerPose(space) : null;
            if (pose) {
                const { position, orientation } = pose.transform;
                this.viewerRotation.set(orientation.x, orientation.y, orientation.z, orientation.w);
                this.viewerForward.set(0, 0, -1).applyQuaternion(this.viewerRotation);
                this.menuPanel.placeFacing(position.x, position.y, position.z, Math.atan2(-this.viewerForward.x, -this.viewerForward.z));
                this.menuPlacementPending = false;
            }
        }
        // One context per frame: the panel's second update below is then free unless hover changed.
        const context = this.menuContext();
        for (const hand of HANDS) {
            const x = this.inputAdapter.getThumbstickX(hand);
            if (Math.abs(x) < THUMB_REST) this.thumbArmed[hand] = true;
            else if (Math.abs(x) > THUMB_FLICK && this.thumbArmed[hand]) {
                this.thumbArmed[hand] = false;
                this.menuState = switchMenuTab(this.menuState, x > 0 ? 1 : -1);
            }
        }
        // Layout of the current state (hover is applied below and redraws only if it changed).
        this.menuPanel.update(this.menuState, context);
        for (const hand of HANDS) {
            const hit = this.inputAdapter.getPointerRay(hand, this.pointerRay) ? this.menuPanel.hitTest(this.pointerRay) : null;
            this.menuHits[hand] = hit?.item && !hit.item.disabled ? hit.item.id : null;
            this.inputAdapter.setPointerLength(hand, hit ? hit.distance : null);
        }
        const other: ControllerHand = this.menuHand === 'left' ? 'right' : 'left';
        const hover = this.menuHits[this.menuHand] ?? this.menuHits[other];
        if (hover !== this.menuState.hover) {
            if (hover) this.inputAdapter.pulseHaptics(this.menuHits[this.menuHand] ? this.menuHand : other, 0.15, 10);
            this.menuState = { ...this.menuState, hover };
        }
        this.menuPanel.update(this.menuState, context);
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
            if (this.session.getState() === 'finished') return `${this.resultLine()} Space to restart.`;
        }
        switch (this.session.getState()) {
            case 'idle':
                return 'Select a track to begin.';
            case 'ready':
                return 'Point at Start and pull a trigger.';
            case 'playing':
                return 'Cut along arrows. Dots: any direction. Grip: pause.';
            case 'paused':
                return 'Paused. Choose Resume in the menu.';
            case 'finished':
                return `${this.resultLine()} Play again from the menu.`;
            default:
                return '';
        }
    }

    /** Final rank and accuracy, e.g. "Rank S - 91.4%.". */
    private resultLine(): string {
        const { score, maxScore } = this.session.getSnapshot();
        const accuracy = maxScore ? score / maxScore : 0;
        return `Rank ${scoreRank(accuracy)} - ${(accuracy * 100).toFixed(1)}%.`;
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
        this.inputAdapter.update(deltaSec, songTime, tracked && !this.menuOpen);
        if (this.menuOpen) this.updateMenu(frame);

        this.scene.getWorldToPlayfield(this.worldToPlayfield);
        for (const hand of HANDS) {
            const attempt = this.inputAdapter.getStrikeAttempt(hand, songTime, this.worldToPlayfield);
            if (!attempt) continue;
            // Blade samples are in rendered playfield space; judge them in canonical space.
            this.scene.path.unprojectStrike(attempt);
            const result = this.session.attemptStrike(attempt);
            if (result) this.inputAdapter.pulseHaptics(hand, result.grade === 'perfect' ? 1 : 0.55, 35);
        }
        this.session.update(songTime);

        const activeNotes = this.session.getActiveNotes(songTime);
        this.scene.update(activeNotes, songTime, this.session.getSnapshot(), this.currentInstruction());
        if (this.diagnostics && this.scene.path.revision !== this.diagnosticPathRevision) {
            const path = this.scene.path;
            this.diagnosticPathRevision = path.revision;
            this.overlay.dataset.xrTrackPath = JSON.stringify({ focusX: path.focusX, focusY: path.focusY,
                bendX: path.amplitudeX, bendY: path.amplitudeY });
        }
        if (this.diagnostics && this.scene.backgroundRenderMs !== this.diagnosticBackgroundMs) {
            this.diagnosticBackgroundMs = this.scene.backgroundRenderMs;
            this.overlay.dataset.xrBackgroundMs = this.diagnosticBackgroundMs.toFixed(2);
        }
        if (this.diagnostics) {
            const { quality, rateHz } = this.settings.background;
            // A worker frame reports its bitmap transfer as a stage ('xfer'); the in-thread source does not.
            const label = this.settings.background.wormhole ? `${quality}, ${rateHz} Hz` : 'Wormhole off';
            if (this.backgroundDiagnostics.record(deltaSec, this.session.getState() === 'playing', this.scene.backgroundFramesShown,
                this.scene.backgroundRenderMs, this.scene.backgroundStageTimes, label)) {
                this.overlay.dataset.xrBackgroundStages = this.backgroundDiagnostics.summary;
            }
        }
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
        this.menuPanel.dispose();
        this.scene.dispose();
        this.drawer.dispose();
    }
}
