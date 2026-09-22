import type { AudioEngine } from '../../audio/AudioEngine';
import type { ExportConfig } from '../../export/ExportTypes';
import type { DramaturgyActivityLevel, DramaturgyVariantMode, VisualTuningConfig } from '../../types';
import { State } from '../../state/store';
import { MvpVisualController } from './MvpVisualController';
import { PreviewStage } from './PreviewStage';
import { TransportBar } from './TransportBar';
import { JourneyTimeline } from './JourneyTimeline';
import { MomentInspector, TRANSITION_PRESETS, intensityFromStrengthPercent } from './MomentInspector';
import { MacroControls } from './MacroControls';
import { AdvancedTuningPanel } from './AdvancedTuningPanel';
import { QuickTuningDrawer } from './QuickTuningDrawer';
import { TimelineToolbar } from './TimelineToolbar';
import { IntentInfoPanel } from './IntentInfoPanel';
import { ExportDialog } from './ExportDialog';
import { FirstRunScreen } from './FirstRunScreen';
import { AnalyzingScreen } from './AnalyzingScreen';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { HistoryInput } from './HistoryInput';
import type { WorkspaceSnapshot } from './sessionCheckpoint';
import type { createPreviewQualityControl } from '../PreviewQualityControl';

const DESKTOP_QUERY = '(min-width: 1024px)';

type PrefixedFullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type PrefixedFullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const EYE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.03 20.03 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.02 20.02 0 0 1-3.22 4.44M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';

/**
 * Top-level MVP shell: builds the DOM skeleton, switches between first-run / analyzing / ready,
 * and owns every subcomponent. Implements the structural PlexusRendererHost interface
 * (updateDashboard/setExportTarget) so it can be passed to the same startPlexusRenderer the
 * advanced dashboard uses.
 */
export class MvpUI {
    readonly root: HTMLElement;

    private readonly controller: MvpVisualController;
    private readonly previewCol: HTMLElement;
    private readonly stageFrame: HTMLElement;
    private readonly previewStage: PreviewStage;
    private readonly transport: TransportBar;
    private readonly journey: JourneyTimeline;
    private readonly timelineToggleBtn: HTMLButtonElement;
    private readonly momentInspector: MomentInspector;
    private readonly macroControls: MacroControls;
    private readonly advancedTuning: AdvancedTuningPanel;
    private readonly quickDrawer: QuickTuningDrawer;
    private readonly timelineToolbar: TimelineToolbar;
    private readonly intentInfoPanel: IntentInfoPanel;
    private readonly exportDialog: ExportDialog;
    private readonly firstRun: FirstRunScreen;
    private readonly analyzing: AnalyzingScreen;
    private readonly unsavedChangesDialog: UnsavedChangesDialog;
    private readonly unsavedChangesGuard: UnsavedChangesGuard;

    private readonly workspaceEl: HTMLElement;
    private readonly sideCol: HTMLElement;
    private readonly sheetScrim: HTMLElement;
    private readonly sheet: HTMLElement;
    private readonly sheetBody: HTMLElement;
    private readonly trackMetaEl: HTMLElement;
    private readonly trackTitleEl: HTMLElement;
    private readonly trackBpmEl: HTMLElement;
    private readonly exportBtn: HTMLButtonElement;
    private readonly toastEl: HTMLElement;

    private readonly desktopQuery = window.matchMedia(DESKTOP_QUERY);
    private selectedMomentId: string | null = null;
    private hasAutoSelected = false;
    private currentFileName = '';
    private timelineHidden = false;
    private toastTimer: number | null = null;
    private viewKey = '';
    private readonly previewQualityControl?: ReturnType<typeof createPreviewQualityControl>;

    constructor(engine: AudioEngine, hasTimeBasedSemanticPlan: () => boolean = () => false,
        previewQualityControl?: ReturnType<typeof createPreviewQualityControl>) {
        this.previewQualityControl = previewQualityControl;
        this.root = document.createElement('div');
        this.root.className = 'mvp-shell';

        const topbar = this.buildTopbar();
        const main = document.createElement('main');
        main.className = 'mvp-main';

        this.firstRun = new FirstRunScreen((file) => this.handleFile(file));
        this.analyzing = new AnalyzingScreen();
        this.analyzing.root.classList.add('mvp-hidden');

        this.workspaceEl = document.createElement('div');
        this.workspaceEl.className = 'mvp-workspace mvp-hidden';

        this.previewCol = document.createElement('div');
        this.previewCol.className = 'mvp-preview-col';
        this.previewStage = new PreviewStage({
            onTogglePlay: () => this.togglePlay(),
            onFullscreen: () => this.toggleFullscreen()
        });
        this.transport = new TransportBar({
            onPlayToggle: () => this.togglePlay(),
            onRestart: () => this.controller.commitScrub(0),
            onScrub: (time) => { this.controller.scrub(time); this.transport.setTime(time); this.journey.setPlayhead(time); },
            onScrubCommit: () => this.controller.commitScrub(this.controller.getCurrentTime())
        });
        // .mvp-stage-frame is the shared positioning box for the video itself and the quick
        // tuning drawer (appended below, once constructed): both are positioned absolute against
        // this one frame, which is sized/centered identically to the actual 16:9 video box in
        // both the normal layout and native Fullscreen (where previewCol becomes 100vw/100vh and
        // letterboxes a narrower frame inside itself). Keeping the drawer out of
        // .mvp-preview-stage itself (rather than making the stage the shared box directly)
        // matters because the stage has overflow:hidden for canvas containment, which would clip
        // the drawer's slide-out panel.
        this.stageFrame = document.createElement('div');
        this.stageFrame.className = 'mvp-stage-frame';
        this.stageFrame.appendChild(this.previewStage.root);
        this.previewCol.appendChild(this.stageFrame);
        this.previewCol.appendChild(this.transport.root);

        this.sideCol = document.createElement('div');
        this.sideCol.className = 'mvp-side-col';
        this.momentInspector = new MomentInspector({
            onTimeChange: (id, time) => this.controller.updateMoment(id, { time }),
            onPresetChange: (id, fileName) => this.controller.updateMoment(id, { preset: fileName }),
            onStrengthChange: (id, pct) => this.controller.updateMoment(id, { intensity: intensityFromStrengthPercent(pct) }),
            onTransitionChange: (id, preset) => {
                const mapped = TRANSITION_PRESETS[preset];
                this.controller.updateMoment(id, { morphDurationSec: mapped.morphDurationSec, morphCurve: mapped.morphCurve });
            },
            onNudge: (id, delta) => this.controller.nudgeMoment(id, delta),
            onDelete: (id) => { this.controller.removeMoment(id); this.deselectMoment(); }
        });
        this.advancedTuning = new AdvancedTuningPanel({
            onChange: (key, fraction) => this.controller.setAdvancedBoost(key, fraction),
            onReset: () => { this.controller.resetAdvancedBoosts(); this.advancedTuning.setValues(this.controller.getAdvancedBoosts()); },
            onSave: () => this.controller.saveMetaTuningForTrack()
        });
        if (previewQualityControl) this.advancedTuning.root.prepend(previewQualityControl.root);
        this.macroControls = new MacroControls({
            onChange: (macros) => this.controller.setMacros(macros),
            onOpenAdvanced: () => { this.advancedTuning.setValues(this.controller.getAdvancedBoosts()); this.quickDrawer.toggle('tuning'); }
        });
        // Lives inside .mvp-stage-frame (not sideCol) so both panels stay reachable in native
        // Fullscreen, which only keeps previewCol's own descendants visible, and stay positioned
        // against the same box as the fullscreen button instead of previewCol's full (and in
        // fullscreen, letterboxed-wider) bounds; see QuickTuningDrawer's docs for the full
        // reasoning.
        this.quickDrawer = new QuickTuningDrawer(
            { character: this.macroControls.root, tuning: this.advancedTuning.root },
            (tab) => { if (tab === 'tuning') this.advancedTuning.setValues(this.controller.getAdvancedBoosts()); }
        );
        this.stageFrame.appendChild(this.quickDrawer.root);

        const journeyWrap = document.createElement('div');
        journeyWrap.className = 'mvp-journey';
        const journeyPanel = document.createElement('div');
        journeyPanel.className = 'mvp-journey-panel';
        journeyPanel.innerHTML = `
            <div class="mvp-journey-header">
                <div>
                    <p class="mvp-journey-title">Musical Journey</p>
                    <p class="mvp-journey-sub">Shape the arc. Guide the experience.</p>
                </div>
                <div class="mvp-journey-header-actions">
                    <button type="button" class="mvp-journey-toggle-btn" aria-pressed="false" aria-label="Hide timeline" title="Hide timeline">${EYE_ICON}</button>
                    <button type="button" class="mvp-btn mvp-add-moment-inline">+ Add Moment</button>
                </div>
            </div>
        `;
        this.timelineToggleBtn = journeyPanel.querySelector('.mvp-journey-toggle-btn')!;
        this.timelineToggleBtn.addEventListener('click', () => this.toggleTimelineVisibility());
        this.journey = new JourneyTimeline({
            onScrub: (time) => { this.controller.scrub(time); this.transport.setTime(time); },
            onScrubCommit: (time) => this.controller.commitScrub(time),
            onSelectMoment: (id) => this.selectMoment(id),
            onMoveMomentCommit: (id, time) => this.controller.moveMoment(id, time),
            onCreateMomentAt: (time) => this.handleAddMoment(time),
            onSelectIntentSegment: (intent, anchor) => this.intentInfoPanel.show(intent, anchor, !this.desktopQuery.matches)
        });
        journeyPanel.appendChild(this.journey.root);
        const addMomentBlock = document.createElement('button');
        addMomentBlock.type = 'button';
        addMomentBlock.className = 'mvp-add-moment-block';
        addMomentBlock.textContent = '+ Add Moment';
        addMomentBlock.addEventListener('click', () => this.handleAddMoment());
        journeyPanel.appendChild(addMomentBlock);
        journeyPanel.querySelector('.mvp-add-moment-inline')!.addEventListener('click', () => this.handleAddMoment());

        this.timelineToolbar = new TimelineToolbar({
            onToggleSnap: (value) => this.journey.setSnapEnabled(value),
            onToggleFollow: (value) => this.journey.setFollowEnabled(value),
            onToggleDraw: (value) => this.journey.setDrawModeActive(value),
            onToggleZoom: (value) => this.journey.setZoomed(value),
            onMorphScaleChange: (scale) => { this.controller.setMorphScale(scale); this.refreshJourney(); },
            onToggleLayer: (layer, value) => this.journey.setLayers({ ...State.timelineLayers, [layer]: value }),
            onRegenerate: (activity, variant) => void this.regenerateJourney(activity, variant),
            onSave: () => this.controller.saveJourneyForTrack(),
            onUndo: () => this.applyHistory(false),
            onRedo: () => this.applyHistory(true),
            onHistoryScopeChange: (scope) => this.controller.setHistoryScope(scope)
        });
        journeyPanel.appendChild(this.timelineToolbar.root);
        journeyWrap.appendChild(journeyPanel);

        this.intentInfoPanel = new IntentInfoPanel();

        this.workspaceEl.appendChild(this.previewCol);
        this.workspaceEl.appendChild(this.sideCol);
        this.workspaceEl.appendChild(journeyWrap);

        main.appendChild(this.firstRun.root);
        main.appendChild(this.analyzing.root);
        main.appendChild(this.workspaceEl);

        this.sheetScrim = document.createElement('div');
        this.sheetScrim.className = 'mvp-sheet-scrim';
        this.sheetScrim.addEventListener('click', () => this.closeSheet());
        this.sheet = document.createElement('div');
        this.sheet.className = 'mvp-sheet';
        this.sheet.innerHTML = `
            <div class="mvp-sheet-handle"></div>
            <div class="mvp-sheet-header">
                <p class="mvp-sheet-title">Edit Moment</p>
                <button type="button" class="mvp-sheet-done">Done</button>
            </div>
            <div class="mvp-sheet-body"></div>
        `;
        this.sheetBody = this.sheet.querySelector('.mvp-sheet-body')!;
        this.sheet.querySelector('.mvp-sheet-done')!.addEventListener('click', () => this.closeSheet());

        this.toastEl = document.createElement('div');
        this.toastEl.className = 'mvp-toast mvp-hidden';

        this.exportDialog = new ExportDialog({
            onStart: (config) => void this.runExport(config),
            onStop: () => this.controller.stopAndSaveExport(),
            onCancel: () => { this.controller.cancelExport(); this.exportDialog.setActive(false); }
        });

        this.root.appendChild(topbar);
        this.root.appendChild(main);
        this.root.appendChild(this.sheetScrim);
        this.root.appendChild(this.sheet);
        this.root.appendChild(this.toastEl);
        this.root.appendChild(this.intentInfoPanel.root);
        this.root.appendChild(this.exportDialog.root);
        this.unsavedChangesDialog = new UnsavedChangesDialog(
            (choice) => choice === 'journey' ? this.controller.saveJourneyForTrack()
                : choice === 'tuning' ? this.controller.saveMetaTuningForTrack()
                : this.controller.saveUnsavedChangesForTrack(),
            () => this.controller.getUnsavedChanges(),
            () => this.controller.discardSession(),
            choice => choice === 'history' || choice === 'all' ? this.controller.getSessionSaveError() : null
        );
        this.root.appendChild(this.unsavedChangesDialog.root);
        this.unsavedChangesGuard = new UnsavedChangesGuard(window, {
            hasChanges: () => this.controller.hasUnsavedChanges(),
            confirm: (continuing) => this.unsavedChangesDialog.confirm(continuing)
        });

        this.trackMetaEl = topbar.querySelector('.mvp-track-meta')!;
        this.trackTitleEl = topbar.querySelector('.mvp-track-title')!;
        this.trackBpmEl = topbar.querySelector('.mvp-track-bpm')!;
        this.exportBtn = topbar.querySelector('.mvp-export-btn')!;
        this.exportBtn.addEventListener('click', () => {
            if (!this.controller.canExport()) { this.showToast('Load a track before exporting.'); return; }
            this.exportDialog.open();
        });

        this.desktopQuery.addEventListener('change', (e) => this.applyLayout(e.matches));
        this.applyLayout(this.desktopQuery.matches);

        // Native Fullscreen only keeps previewCol (and its descendants) visible — the journey
        // timeline lives outside it and already disappears visually, but its rAF-driven redraw
        // loop wouldn't otherwise know to stop, so it's told explicitly via setVisible below.
        document.addEventListener('fullscreenchange', () => this.updateTimelineVisibility());
        document.addEventListener('webkitfullscreenchange', () => this.updateTimelineVisibility());
        this.updateTimelineVisibility();

        this.controller = new MvpVisualController(engine, hasTimeBasedSemanticPlan, {
            onLoadStart: (fileName) => { this.currentFileName = fileName; this.hasAutoSelected = false; this.showAnalyzing(fileName); },
            onProgress: (progress) => this.analyzing.setProgress(progress),
            onAnalysisComplete: () => this.showReady(),
            onAnalysisError: (message) => { this.showToast(message); this.showFirstRun(); },
            onPlaybackStateChange: (isPlaying) => { this.previewStage.setPlaying(isPlaying); this.transport.setPlaying(isPlaying); },
            onPositionChange: (time) => {
                if (!this.transport.isDragging()) { this.transport.setTime(time); this.journey.setPlayhead(time); }
            },
            onPlaybackEnded: () => { this.previewStage.setPlaying(false); this.transport.setPlaying(false); },
            onPlanChanged: () => this.refreshJourney(),
            onHistoryChanged: () => this.timelineToolbar.setHistoryState(this.controller.getHistoryStatus(), this.controller.canUseHistory()),
            onSaveStateChanged: () => {
                this.timelineToolbar.setSaveState(this.controller.hasUnsavedJourneyChanges(), this.controller.canSaveJourney());
                this.advancedTuning.setSaveState(this.controller.hasUnsavedTuningChanges(), this.controller.canSaveJourney());
                this.unsavedChangesDialog.updateChanges(this.controller.getUnsavedChanges());
                this.unsavedChangesGuard.sync();
            },
            onMetaTuningRestored: () => {
                this.macroControls.setValues(this.controller.getMacros());
                this.advancedTuning.setValues(this.controller.getAdvancedBoosts());
            },
            getWorkspaceSnapshot: () => this.captureWorkspace(),
            onSessionNotice: message => this.showToast(message),
            onWorkspaceRestored: workspace => this.restoreWorkspace(workspace)
        });

        new HistoryInput(window, {
            undo: () => this.applyHistory(false), redo: () => this.applyHistory(true),
            beginGesture: () => this.controller.beginHistoryGesture(),
            endGesture: () => this.controller.endHistoryGesture(),
            blocked: () => this.historyBlocked()
        });
        void MvpVisualController.detectExportCapabilities().then((report) => this.exportDialog.applyCapabilityReport(report));
        // Compare small view settings only after UI events, never in the render/audio loop.
        for (const event of ['click', 'change', 'pointerup', 'keyup', 'fullscreenchange']) {
            window.addEventListener(event, () => queueMicrotask(() => {
                if (!this.controller.canSaveJourney()) return;
                const key = this.workspaceViewKey();
                if (key !== this.viewKey) { this.viewKey = key; this.controller.markSessionChanged(); }
            }));
        }
        this.root.querySelector('[data-session-save]')!.addEventListener('click', () => {
            if (!this.controller.canSaveJourney()) return;
            this.momentInspector.commitPendingTime();
            this.controller.markSessionChanged();
            void this.unsavedChangesDialog.confirm(false);
        });
        void this.controller.resumeSession().then(available => {
            if (available) this.showToast('Saved history is available. Load the same audio file to restore it.');
        });
    }

    private buildTopbar(): HTMLElement {
        const topbar = document.createElement('header');
        topbar.className = 'mvp-topbar';
        topbar.innerHTML = `
            <div class="mvp-brand">
                <div class="mvp-brand-mark"></div>
                <div class="mvp-brand-text">
                    <span class="mvp-brand-name">PLEXUS</span>
                    <span class="mvp-brand-sub">Audio-Visual Engine</span>
                </div>
                <div class="mvp-track-meta mvp-hidden">
                    <span class="mvp-track-title"></span>
                    <span class="mvp-track-bpm"></span>
                </div>
            </div>
            <div class="mvp-topbar-actions">
                <button type="button" class="mvp-btn" data-session-save title="Save history and workspace for the next reload. Audio is never stored; select the same file again to restore.">Save session</button>
                <label class="mvp-btn mvp-load-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/></svg>
                    Load Track
                    <input type="file" class="mvp-file-input" accept="audio/*,video/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska">
                </label>
                <button type="button" class="mvp-btn mvp-btn-accent mvp-export-btn" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    Export
                </button>
            </div>
        `;
        const fileInput = topbar.querySelector('.mvp-file-input') as HTMLInputElement;
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            fileInput.value = '';
            if (file) this.handleFile(file);
        });
        return topbar;
    }

    // ─── File lifecycle ─────────────────────────────────────────────────────

    private handleFile(file: File): void {
        void this.unsavedChangesGuard.run(() => { void this.controller.loadFile(file); });
    }

    private showAnalyzing(fileName: string): void {
        this.analyzing.setTrackName(fileName);
        this.analyzing.setProgress(0);
        this.firstRun.root.classList.add('mvp-hidden');
        this.workspaceEl.classList.add('mvp-hidden');
        this.analyzing.root.classList.remove('mvp-hidden');
        this.trackMetaEl.classList.add('mvp-hidden');
        this.exportBtn.disabled = true;
        this.deselectMoment();
    }

    private showReady(): void {
        this.analyzing.root.classList.add('mvp-hidden');
        this.workspaceEl.classList.remove('mvp-hidden');
        this.trackMetaEl.classList.remove('mvp-hidden');
        this.trackTitleEl.textContent = this.currentFileName;
        this.trackBpmEl.textContent = State.bpm > 0 ? `${Math.round(State.bpm)} BPM` : '';

        this.transport.setEnabled(true);
        this.transport.setDuration(State.duration);
        this.transport.setTime(0);
        this.journey.setTrackData(State.trackAnalysis, State.duration);
        const buffer = this.controller.getAudioBuffer();
        if (buffer) this.journey.setAudioBuffer(buffer);
        this.journey.setSnapEnabled(State.snapToGrid);
        this.journey.setFollowEnabled(State.followPlayhead);
        this.journey.setDrawModeActive(State.drawModeActive);
        this.timelineToolbar.setToggles({
            snap: State.snapToGrid,
            follow: State.followPlayhead,
            draw: State.drawModeActive,
            zoomed: false
        });
        this.timelineToolbar.setLayers(State.timelineLayers);
        this.timelineToolbar.setGenerationSelection(this.controller.getActivityLevel(), this.controller.getVariantMode());
        this.macroControls.setValues(this.controller.getMacros());
        this.advancedTuning.setValues(this.controller.getAdvancedBoosts());
        this.exportBtn.disabled = !this.controller.canExport();
        this.viewKey = this.workspaceViewKey();
    }

    private captureWorkspace(): WorkspaceSnapshot {
        return { position: this.controller.getCurrentTime(), wasPlaying: State.isPlaying, fullscreen: this.isNativeFullscreen(),
            selectedMomentId: this.selectedMomentId, timelineHidden: this.timelineHidden,
            snap: State.snapToGrid, follow: State.followPlayhead, draw: State.drawModeActive,
            zoom: State.zoom, pan: State.pan, layers: { ...State.timelineLayers }, drawer: this.quickDrawer.getOpenTab(),
            sheetOpen: this.sheet.classList.contains('is-open'), previewQuality: this.previewQualityControl?.preference.mode ?? 'auto',
            exportResolution: this.exportDialog.getResolution(), loopPlayback: State.loopPlayback,
            targetTuning: { ...State.targetTuning } };
    }

    private workspaceViewKey(): string {
        const { position: _position, wasPlaying: _playing, targetTuning: _target, ...view } = this.captureWorkspace();
        return JSON.stringify(view);
    }

    private restoreWorkspace(w: WorkspaceSnapshot): void {
        this.timelineHidden = w.timelineHidden;
        this.updateTimelineVisibility();
        this.journey.setSnapEnabled(w.snap);
        this.journey.setFollowEnabled(w.follow);
        this.journey.setDrawModeActive(w.draw);
        this.journey.setLayers(w.layers);
        this.journey.restoreViewport(w.zoom, w.pan);
        this.timelineToolbar.setLayers(w.layers);
        this.timelineToolbar.setToggles({ snap: w.snap, follow: w.follow, draw: w.draw, zoomed: w.zoom > 1 });
        this.quickDrawer.close();
        if (w.drawer) this.quickDrawer.toggle(w.drawer);
        if (w.selectedMomentId) this.selectMoment(w.selectedMomentId, false); else this.deselectMoment();
        if (w.sheetOpen && !this.desktopQuery.matches) this.openSheet(); else this.closeSheet();
        this.previewQualityControl?.setMode(w.previewQuality);
        this.exportDialog.restoreResolution(w.exportResolution);
        this.transport.setTime(w.position);
        this.journey.setPlayhead(w.position);
        this.viewKey = this.workspaceViewKey();
        this.showToast(w.fullscreen ? 'Session restored, paused. Use Fullscreen to re-enter full screen.' : 'Session restored, paused. Save again to keep it for the next reload.');
    }

    private showFirstRun(): void {
        this.analyzing.root.classList.add('mvp-hidden');
        this.workspaceEl.classList.add('mvp-hidden');
        this.firstRun.root.classList.remove('mvp-hidden');
    }

    private refreshJourney(): void {
        const points = this.controller.getPlan()?.points ?? [];
        // The timeline renders the morph-scaled view (bar widths reflect the current Morph Scale
        // slider) while selection/editing below still targets the base (unscaled) plan.
        this.journey.setPoints(this.controller.getAutomationPlanView()?.points ?? points);
        this.journey.setIntentPlan(State.dramaturgicalIntent);
        this.timelineToolbar.setMorphScale(this.controller.getMorphScale(), this.controller.getMaxMorphScale());
        this.timelineToolbar.setGenerationSelection(this.controller.getActivityLevel(), this.controller.getVariantMode());

        if (this.selectedMomentId && !points.some((p) => p.id === this.selectedMomentId)) {
            this.deselectMoment();
            return;
        }
        if (this.selectedMomentId) {
            const point = points.find((p) => p.id === this.selectedMomentId)!;
            this.momentInspector.show(point, State.availablePresets);
            return;
        }
        if (!this.hasAutoSelected && points.length > 0) {
            this.hasAutoSelected = true;
            const best = points.reduce((a, b) => (b.intensity > a.intensity ? b : a));
            // Auto-selecting the standout moment right after load must not pop the mobile Edit
            // Moment sheet open on its own — only an explicit pick on the timeline should do that.
            this.selectMoment(best.id, false);
        }
    }

    // ─── Moment selection ───────────────────────────────────────────────────

    private historyBlocked(): boolean {
        return !this.controller.canUseHistory() || Boolean(document.querySelector('dialog[open]'))
            || !this.exportDialog.root.classList.contains('mvp-hidden');
    }

    private applyHistory(redo: boolean): void {
        if (this.historyBlocked()) return;
        this.momentInspector.commitPendingTime();
        this.controller.endHistoryGesture();
        this.journey.cancelMomentDrag();
        if (redo) this.controller.redo(); else this.controller.undo();
    }

    private selectMoment(id: string, openSheetIfMobile = true): void {
        const point = this.controller.getPlan()?.points.find((p) => p.id === id);
        if (!point) return;
        this.selectedMomentId = id;
        this.momentInspector.show(point, State.availablePresets);
        this.journey.setSelected(id);
        if (openSheetIfMobile && !this.desktopQuery.matches) this.openSheet();
    }

    private deselectMoment(): void {
        this.selectedMomentId = null;
        this.momentInspector.clear();
        this.journey.setSelected(null);
        this.closeSheet();
    }

    private handleAddMoment(time?: number): void {
        const point = time === undefined ? this.controller.addMomentAtCurrentTime() : this.controller.addMomentAtTime(time);
        if (point) this.selectMoment(point.id);
        else this.showToast("Can't add a moment there — too close to an existing one.");
    }

    private async regenerateJourney(activity: DramaturgyActivityLevel, variant: DramaturgyVariantMode): Promise<void> {
        this.hasAutoSelected = false;
        this.deselectMoment();
        await this.controller.regeneratePlan(activity, variant);
    }

    // ─── Responsive layout (moment inspector: side column vs bottom sheet) ─

    private applyLayout(isDesktop: boolean): void {
        if (isDesktop) {
            this.closeSheet();
            this.sideCol.appendChild(this.momentInspector.root);
        } else {
            this.sheetBody.appendChild(this.momentInspector.root);
        }
    }

    private openSheet(): void {
        this.sheetScrim.classList.add('is-open');
        this.sheet.classList.add('is-open');
    }

    private closeSheet(): void {
        this.sheetScrim.classList.remove('is-open');
        this.sheet.classList.remove('is-open');
    }

    // ─── Playback / fullscreen ──────────────────────────────────────────────

    private togglePlay(): void {
        if (this.controller.isPlaying()) this.controller.pause();
        else this.controller.play();
    }

    // Requests fullscreen on previewCol (preview + transport + the quick tuning drawer, not just
    // the canvas) so playback controls and Visual character / Advanced tuning all stay reachable
    // in fullscreen instead of being left behind outside it.
    // -webkit-prefixed fallbacks cover Safari desktop/iPadOS, which still don't expose the
    // unprefixed Fullscreen API methods; everywhere else the standard method is used, so the
    // behavior is the same cross-platform rather than degrading silently on one engine.
    private toggleFullscreen(): void {
        const doc = document as PrefixedFullscreenDoc;
        const el = this.previewCol as PrefixedFullscreenEl;

        if (document.fullscreenElement || doc.webkitFullscreenElement) {
            void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
            return;
        }
        void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    }

    private isNativeFullscreen(): boolean {
        const doc = document as PrefixedFullscreenDoc;
        return !!(document.fullscreenElement || doc.webkitFullscreenElement);
    }

    // ─── Musical Journey timeline visibility (hide button + fullscreen gate) ──

    private toggleTimelineVisibility(): void {
        this.timelineHidden = !this.timelineHidden;
        this.updateTimelineVisibility();
    }

    // Effective visibility is "not hidden by the button" AND "not in native Fullscreen" (the
    // timeline lives outside previewCol, so Fullscreen already hides it visually; this also stops
    // its rAF redraw loop, and restores whichever state the button left it in on exiting
    // Fullscreen, rather than always coming back visible).
    private updateTimelineVisibility(): void {
        const visible = !this.timelineHidden && !this.isNativeFullscreen();
        this.journey.setVisible(visible);
        this.timelineToggleBtn.classList.toggle('is-active', this.timelineHidden);
        this.timelineToggleBtn.setAttribute('aria-pressed', String(this.timelineHidden));
        const label = this.timelineHidden ? 'Show timeline' : 'Hide timeline';
        this.timelineToggleBtn.setAttribute('aria-label', label);
        this.timelineToggleBtn.title = label;
        this.timelineToggleBtn.innerHTML = this.timelineHidden ? EYE_OFF_ICON : EYE_ICON;
    }

    // ─── Export ─────────────────────────────────────────────────────────────

    private async runExport(config: ExportConfig): Promise<void> {
        this.exportDialog.setActive(true);
        try {
            const blob = await this.controller.startExport(config, (progress) => this.exportDialog.setProgress(progress));
            this.downloadBlob(blob, 'plexus-visual.webm');
            this.exportDialog.setStatus('Done — check your downloads.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('cancelled')) this.exportDialog.setStatus('Export failed.');
        } finally {
            this.exportDialog.setActive(false);
        }
    }

    private downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // ─── Toast ──────────────────────────────────────────────────────────────

    private showToast(message: string): void {
        this.toastEl.textContent = message;
        this.toastEl.classList.remove('mvp-hidden');
        if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('mvp-hidden'), 3200);
    }

    // ─── PlexusRendererHost (see visuals/PlexusRenderer.ts) ────────────────

    updateDashboard(): void {
        this.controller.tick();
        const time = this.controller.getCurrentTime();
        if (!this.transport.isDragging()) {
            this.transport.setTime(time);
            this.journey.setPlayhead(time);
        }
    }

    setExportTarget(p5Instance: unknown, canvas: HTMLCanvasElement): void {
        this.controller.setExportTarget(p5Instance, canvas);
        this.exportBtn.disabled = !this.controller.canExport();
    }

    getPreviewSize(): { width: number; height: number } {
        return this.previewStage.getPreviewSize();
    }

    /** See PlexusRendererHost.getTuningForMorph: layers Visual character / Advanced tuning boosts
     *  on top of the raw preset/automation/dramaturgy-authored tuning, fresh every render frame. */
    getTuningForMorph(rawTuning: VisualTuningConfig): VisualTuningConfig {
        return this.controller.getBoostedTuning(rawTuning);
    }
}
