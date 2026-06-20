import type { AudioEngine } from '../audio/AudioEngine';
import { generatePerformancePlan, type GeneratorOptions } from '../automation/performancePlanGenerator';
import { featureFlags } from '../config/featureFlags';
import { normalizeVisualTuningConfig } from '../config/visualTuning';
import { ExportCapabilityDetector } from '../export/ExportCapabilityDetector';
import { WebMExporter, type ExportConfig } from '../export/WebMExporter';
import type { ExportCapabilities } from '../export/ExportTypes';
import { State } from '../state/store';
import type { MorphCurve, PerformanceAutomationPlan, PerformanceAutomationPoint, RenderState, TimelineLayers, VisualMode, VisualTuningConfig } from '../types';
import { GestureEngine } from './GestureEngine';
import { dashboardMetricMetadata, type DashboardMetricKey } from './metricMetadata';
import { TimelineCanvas } from './TimelineCanvas';
import { PlaybackController } from './controllers/PlaybackController';
import { TuningController } from './controllers/TuningController';
import { ExportController } from './controllers/ExportController';

interface VisualPresetManifest {
    presets?: string[];
}

const VIDEO_FILE_EXTENSION_RE = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv)$/i;

export class DashboardUI {
    private presetCache = new Map<string, unknown>();
    private timelineTooltip: HTMLDivElement;
    private isResizingTimeline = false;
    private isPanningTimeline = false;
    private isSeekingTimeline = false;
    private chromeHideTimer: number | null = null;
    private timelineResizeFrame: number | null = null;
    private timelineResizeStartY = 0;
    private timelineResizeStartHeight = 0;
    private lastExpandedTimelineHeight = 220;
    private scrubTime: number | null = null;
    private lastTimelineAnalysisRef: unknown = null;
    private lastTimelineDrawTime = -Infinity;
    private lastTimelineDrawWidth = 0;
    private lastTimelineDrawHeight = 0;
    private lastTimelineDrawZoom = 1;
    private lastTimelineDrawScroll = 0;
    private lastTimelineDrawScrubTime: number | null = null;
    private lastTriggeredAutomationPointId: string | null = null;
    private selectedAutomationPoint: PerformanceAutomationPoint | null = null;
    private hoveredPoint: PerformanceAutomationPoint | null = null;
    private hoveredHandleType: 'start' | 'end' | 'sensitivity' | 'curve' | null = null;
    private draggingAutomationPoint: PerformanceAutomationPoint | null = null;
    private draggingSensitivityPoint: PerformanceAutomationPoint | null = null;
    private draggingFullZone: PerformanceAutomationPoint | null = null;
    private dragStartOffsetSec = 0;
    private resizingMorphPoint: PerformanceAutomationPoint | null = null;
    private timelineDragShiftKey = false;
    private metricTooltip: HTMLDivElement;
    private activeMetricCard: HTMLElement | null = null;
    private els: Record<string, HTMLElement>;
    private engine: AudioEngine;
    private timelineCanvas!: TimelineCanvas;
    private gestureEngine!: GestureEngine;
    private timelineResizeObserver: ResizeObserver | null = null;
    private spectrumResizeObserver: ResizeObserver | null = null;
    private spectrumPeakHold = new Array(24).fill(0);
    private exportP5Instance: any = null;
    private exportCanvas: HTMLCanvasElement | null = null;
    private currentExporter: WebMExporter | null = null;
    private exportCapabilities: ExportCapabilities | null = null;
    private isUiLockedVisible = false;
    private videoElement: HTMLVideoElement;
    private videoObjectUrl: string | null = null;
    private videoSampleCanvas: HTMLCanvasElement | null = null;
    private videoSampleCtx: CanvasRenderingContext2D | null = null;
    private videoSampleTick = 0;
    private videoRateSmoother = 1.0;

    // Sub-controllers (FÁZIS 1)
    private playbackCtrl!: PlaybackController;
    private tuningCtrl!: TuningController;
    private exportCtrl!: ExportController;


    constructor(engine: AudioEngine) {
        this.engine = engine;
        this.els = {
            status: document.getElementById('status-text')!,
            canvasContainer: document.getElementById('canvas-container')!,
            centerPlayBtn: document.getElementById('center-play-btn')!,
            playBtn: document.getElementById('play-btn')!,
            visualMode: document.getElementById('visual-mode')!,
            upload: document.getElementById('audio-upload')!,
            fsBtn: document.getElementById('fullscreen-btn')!,
            tuningPanel: document.getElementById('visual-tuning-panel')!,
            tuningDragHandle: document.getElementById('visual-tuning-drag-handle')!,
            toggleTuningPanel: document.getElementById('toggle-tuning-panel')!,
            toggleLoop: document.getElementById('toggle-loop')!,
            toggleMetrics: document.getElementById('toggle-metrics')!,
            tuningControls: document.getElementById('visual-tuning-controls')!,
            presetList: document.getElementById('visual-preset-list')!,
            copyVisualConfig: document.getElementById('copy-visual-config')!,
            copyConfigStatus: document.getElementById('copy-config-status')!,
            metricsGrid: document.getElementById('metrics-grid')!,
            dramaturgyTimeline: document.getElementById('dramaturgy-timeline')!,
            timelineResizeHandle: document.getElementById('timeline-resize-handle')!,
            timelineDrawTarget: document.getElementById('timeline-draw-target')!,
            timelinePresetBrush: document.getElementById('timeline-preset-brush')!,
            clearAutomationBtn: document.getElementById('clear-automation-btn')!,
            generatorStrategy: document.getElementById('generator-strategy')!,
            generatePlanBtn: document.getElementById('generate-plan-btn')!,
            strictGeneratorSettings: document.getElementById('strict-generator-settings')!,
            strictP1: document.getElementById('strict-p1')!,
            strictP2: document.getElementById('strict-p2')!,
            strictP3: document.getElementById('strict-p3')!,
            strictP4: document.getElementById('strict-p4')!,
            strictBars: document.getElementById('strict-bars')!,
            strictMorph: document.getElementById('strict-morph')!,
            toggleTimelineDraw: document.getElementById('toggle-timeline-draw')!,
            toggleTimelineSnap: document.getElementById('toggle-timeline-snap')!,
            toggleTimelineFollow: document.getElementById('toggle-timeline-follow')!,
            toggleTimelineZoom: document.getElementById('toggle-timeline-zoom')!,
            layerToggleWaveform: document.getElementById('layer-toggle-waveform')!,
            layerToggleRms: document.getElementById('layer-toggle-rms')!,
            layerToggleBuildup: document.getElementById('layer-toggle-buildup')!,
            layerToggleAutomation: document.getElementById('layer-toggle-automation')!,
            automationInspector: document.getElementById('automation-inspector')!,
            inspectorTime: document.getElementById('inspector-time')!,
            inspectorPreset: document.getElementById('inspector-preset')!,
            inspectorDuration: document.getElementById('inspector-duration')!,
            inspectorCurve: document.getElementById('inspector-curve')!,
            inspectorAddBtn: document.getElementById('inspector-add-btn')!,
            inspectorDeleteBtn: document.getElementById('inspector-delete-btn')!,
            exportResolution: document.getElementById('export-resolution')!,
            exportAspect: document.getElementById('export-aspect')!,
            exportVideoBtn: document.getElementById('export-video-btn')!,
            stopExportBtn: document.getElementById('stop-export-btn')!,
            cancelExportBtn: document.getElementById('cancel-export-btn')!,
            seekBar: document.getElementById('seek-bar')!,
            bpmHeaderBadge: document.getElementById('bpm-header-badge')!,
            timeCur: document.getElementById('time-current')!,
            timeTot: document.getElementById('time-total')!,
            valE: document.getElementById('val-energy')!,
            barE: document.getElementById('bar-energy')!,
            valB: document.getElementById('val-bass')!,
            barB: document.getElementById('bar-bass')!,
            valM: document.getElementById('val-mid')!,
            barM: document.getElementById('bar-mid')!,
            valVocal: document.getElementById('val-vocal')!,
            barVocal: document.getElementById('bar-vocal')!,
            valFx: document.getElementById('val-fx')!,
            barFx: document.getElementById('bar-fx')!,
            valBeat: document.getElementById('val-beat')!,
            barBeat: document.getElementById('bar-beat')!,
            valDyn: document.getElementById('val-dyn')!,
            barDyn: document.getElementById('bar-dyn')!,
            perceptualSpectrumCanvas: document.getElementById('perceptual-spectrum-canvas')!,
            mediaLoaderOverlay: document.getElementById('media-loader-overlay')!,
            mediaLoaderText: document.getElementById('media-loader-text')!,
            mediaLoaderBar: document.getElementById('media-loader-bar')!,
        };
        this.videoElement = document.getElementById('video-backplate') as HTMLVideoElement;
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;
        this.videoSampleCanvas = document.createElement('canvas');
        this.videoSampleCanvas.width = 4;
        this.videoSampleCanvas.height = 4;
        this.videoSampleCtx = this.videoSampleCanvas.getContext('2d', { willReadFrequently: true });

        this.initControllers();

        this.engine.addPlaybackEndedListener(() => {
            this.playbackCtrl.onPlaybackEnded();
            this.updateDashboard();
        });

        this.engine.addPositionChangedListener(() => {
            this.lastTriggeredAutomationPointId = null;
            this.triggerPerformanceAutomation();
        });

        this.engine.addPlaybackStateListener((event, time) => {
            this.syncVideoPlayback(event, time);
        });

        this.engine.onProgress = (progress, stage) => {
            this.playbackCtrl.updateProgress(progress, stage);
        };

        this.engine.onAnalysisError = (message) => {
            this.clearVideoBackplate();
            this.playbackCtrl.onError('Hiba: ' + message);
            (this.els.exportVideoBtn as HTMLButtonElement).disabled = true;
            this.clearDramaturgyTimeline();
        };

        void this.initExportCapabilityUi();
        this.metricTooltip = this.createDashboardMetricTooltip();
        this.timelineTooltip = this.createTimelineTooltip();
        this.initDashboardMetricTooltips();
        this.initPerceptualSpectrumCanvas();
        this.initDramaturgyTimeline();
        this.initTimelineControls();
        this.playbackCtrl.syncLoopUi();
        this.syncTimelineSnapControl();
        this.syncTimelineFollowControl();
        this.applyPresentationModeFromUrl();
        this.initChromeAutoHide();
        void this.loadVisualPresetList();
    }

    // ─── Controller initialisation ───────────────────────────────────────────

    private initControllers(): void {
        this.playbackCtrl = new PlaybackController(
            {
                upload: this.els.upload,
                playBtn: this.els.playBtn,
                centerPlayBtn: this.els.centerPlayBtn,
                toggleLoop: this.els.toggleLoop,
                seekBar: this.els.seekBar,
                fsBtn: this.els.fsBtn,
                canvasContainer: this.els.canvasContainer,
                status: this.els.status,
                timeCur: this.els.timeCur,
                timeTot: this.els.timeTot,
                bpmHeaderBadge: this.els.bpmHeaderBadge,
                mediaLoaderOverlay: this.els.mediaLoaderOverlay,
                mediaLoaderText: this.els.mediaLoaderText,
                mediaLoaderBar: this.els.mediaLoaderBar,
            },
            {
                onFileSelected: (file) => { void this.handleFileSelected(file); },
                onPlay: () => { this.engine.play(); this.playbackCtrl.setPlaybackUi(true); },
                onStop: () => { this.engine.stop(false); this.playbackCtrl.setPlaybackUi(false); },
                onSeekScrub: (time) => { this.setScrubTime(time); },
                onSeekCommit: () => { this.commitScrubTime(); },
                onLoopToggle: () => {
                    State.loopPlayback = !State.loopPlayback;
                    this.playbackCtrl.syncLoopUi();
                },
                onFullscreen: () => { this.toggleFullscreen(); },
                onUiLockToggle: () => { this.toggleUiLock(); },
                onCanvasDoubleClick: () => {
                    if (State.isPlaying) {
                        this.engine.stop(false);
                        this.playbackCtrl.setPlaybackUi(false);
                    } else {
                        this.engine.play();
                        this.playbackCtrl.setPlaybackUi(true);
                    }
                },
                onSeekRelative: (delta) => { this.seekRelative(delta); },
                onKeyDown: (code) => { this.handleGlobalKeyDown(code); },
            }
        );

        this.tuningCtrl = new TuningController(
            {
                tuningPanel: this.els.tuningPanel,
                tuningDragHandle: this.els.tuningDragHandle,
                toggleTuningPanel: this.els.toggleTuningPanel,
                tuningControls: this.els.tuningControls,
                presetList: this.els.presetList,
                copyVisualConfig: this.els.copyVisualConfig,
                copyConfigStatus: this.els.copyConfigStatus,
                timelinePresetBrush: this.els.timelinePresetBrush,
                toggleMetrics: this.els.toggleMetrics,
                metricsGrid: this.els.metricsGrid,
                visualMode: this.els.visualMode,
                strictP1: this.els.strictP1,
                strictP2: this.els.strictP2,
                strictP3: this.els.strictP3,
                strictP4: this.els.strictP4,
            },
            {
                onTuningChange: (key, value) => { State.targetTuning[key] = value; },
                onPresetLoad: (fileName) => { void this.loadVisualPreset(fileName); },
                onPresetBrushChange: (_fileName) => { /* brush used during draw via getSelectedAutomationPreset */ },
                onCopyConfig: () => { void this.copyVisualConfig(); },
                onMetricsToggle: () => {
                    const isHidden = this.els.metricsGrid.classList.toggle('is-hidden');
                    this.els.toggleMetrics.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
                },
                onVisualModeChange: (mode) => {
                    if (isVisualMode(mode)) State.visualMode = mode;
                    else (this.els.visualMode as HTMLSelectElement).value = State.visualMode;
                },
            }
        );
        this.tuningCtrl.initVisualTuningControls();

        this.exportCtrl = new ExportController(
            {
                exportResolution: this.els.exportResolution,
                exportAspect: this.els.exportAspect,
                exportWatermark: document.getElementById('export-watermark')!,
                exportVideoBtn: this.els.exportVideoBtn,
                stopExportBtn: this.els.stopExportBtn,
                cancelExportBtn: this.els.cancelExportBtn,
                status: this.els.status,
            },
            {
                onExportStart: (config) => { void this.startVideoExport(config); },
                onExportStop: () => { this.currentExporter?.stopAndSave(); },
                onExportCancel: () => { this.currentExporter?.cancelExport(); this.exportCtrl.resetExportUi(); },
            }
        );
    }

    // ─── File handling ────────────────────────────────────────────────────────

    private async handleFileSelected(file: File): Promise<void> {
        this.engine.stop(true);
        this.configureVideoBackplate(file);
        this.playbackCtrl.onFileLoadStart(file.name);
        this.exportCtrl.setCanExport(false);
        this.resetTimelineView();
        this.clearDramaturgyTimeline();

        this.engine.onAnalysisComplete = () => {
            this.playbackCtrl.onAnalysisComplete(State.duration, State.bpm, file.name);
            this.exportCtrl.setCanExport(this.canExport());
            void (async () => {
                const plan = await generatePerformancePlan(State.trackAnalysis, State.availablePresets, State.duration, this.buildGeneratorOptions());
                State.performancePlan = plan;
                State.editedPerformancePlan = JSON.parse(JSON.stringify(plan));
                void this.preloadPresetsForPlan(plan);
                const buffer = this.engine.getAudioBuffer();
                if (buffer) this.timelineCanvas.setAudioBuffer(buffer);
                this.drawDramaturgyTimeline();
            })();
        };

        try {
            await this.engine.loadFile(file);
        } catch {
            this.clearVideoBackplate();
            this.playbackCtrl.onError('Hiba: nem sikerult betolteni a fajlt');
            this.exportCtrl.setCanExport(false);
            this.clearDramaturgyTimeline();
        }
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    private async initExportCapabilityUi(): Promise<void> {
        const report = await ExportCapabilityDetector.detectCapabilities();
        this.exportCapabilities = report;
        this.exportCtrl.applyCapabilityReport(report);
    }

    private async startVideoExport(config: ExportConfig): Promise<void> {
        const report = this.exportCapabilities ?? ExportCapabilityDetector.getReport();
        if (!this.canExport() || report.preferredBackend === 'none' || this.currentExporter) return;
        if (State.isPlaying) {
            this.engine.stop(false);
            this.playbackCtrl.setPlaybackUi(false);
        }
        this.resetVideoPlaybackRate();

        this.playbackCtrl.setEnabled(false);
        this.playbackCtrl.setUploadEnabled(false);
        this.exportCtrl.setExportActive(true);

        const exporter = new WebMExporter(
            this.exportP5Instance,
            this.exportCanvas!,
            this.engine,
            State.videoBackplateActive ? this.videoElement : null
        );
        this.currentExporter = exporter;

        try {
            const blob = await exporter.startExport(
                { ...config, trackName: this.els.status.innerText },
                (progress) => { this.exportCtrl.setExportProgress(progress); }
            );
            this.downloadBlob(blob, 'plexus-visual.webm');
        } catch (error) {
            if (!String(error instanceof Error ? error.message : error).includes('cancelled')) {
                this.els.status.innerText = 'Hiba: export sikertelen';
            }
        } finally {
            if (this.currentExporter === exporter) this.currentExporter = null;
            this.els.cancelExportBtn.classList.add('is-hidden');
            this.exportCtrl.resetExportUi();
            this.playbackCtrl.setEnabled(State.duration > 0);
            this.playbackCtrl.setUploadEnabled(true);
        }
    }

    private canExport(): boolean {
        return State.duration > 0
            && Boolean(this.exportP5Instance && this.exportCanvas)
            && this.exportCapabilities?.preferredBackend !== 'none';
    }

    setExportTarget(p5Instance: any, canvas: HTMLCanvasElement): void {
        this.exportP5Instance = p5Instance;
        this.exportCanvas = canvas;
        this.exportCtrl.setCanExport(this.canExport());
    }

    private downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
    }

    // ─── Playback helpers ─────────────────────────────────────────────────────

    private seekRelative(deltaSeconds: number): void {
        if (State.duration <= 0) return;
        this.engine.seek(State.currentTime + deltaSeconds);
        this.updateDashboard();
    }

    private handleGlobalKeyDown(code: string): void {
        if (code === 'KeyD') {
            this.setTimelineDrawMode(!State.drawModeActive);
        } else if (code === 'KeyS') {
            this.toggleTimelineSnapMode();
        } else if (code === 'KeyF') {
            this.toggleTimelineFollowMode();
        }
    }

    private toggleFullscreen(): void {
        const doc = window.document as any;
        const docEl = doc.documentElement;
        const reqFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        const exitFS = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
        if (!doc.fullscreenElement) { reqFS?.call(docEl); } else { exitFS?.call(doc); }
    }

    private toggleUiLock(): void {
        this.isUiLockedVisible = !this.isUiLockedVisible;
        if (this.isUiLockedVisible) {
            this.clearChromeHideTimer();
            document.body.classList.remove('chrome-idle');
        } else {
            this.scheduleChromeHide(400);
        }
    }

    // ─── Scrub time ───────────────────────────────────────────────────────────

    private setScrubTime(time: number): void {
        this.scrubTime = this.clamp(time, 0, State.duration);
        this.els.timeCur.innerText = this.formatTime(this.scrubTime);
        if (State.duration > 0) {
            (this.els.seekBar as HTMLInputElement).value = ((this.scrubTime / State.duration) * 100).toString();
        }
        this.requestTimelineDraw();
    }

    private commitScrubTime(): void {
        if (this.scrubTime === null) return;
        const targetTime = this.scrubTime;
        this.scrubTime = null;
        State.currentTime = targetTime;
        this.engine.seek(targetTime);
        this.requestTimelineDraw();
    }

    // ─── Timeline controls (snap, follow, draw, layers) ──────────────────────

    private initTimelineControls(): void {
        this.els.timelineDrawTarget.addEventListener('change', () => {
            this.syncTimelineDrawControls();
        });
        this.els.toggleTimelineSnap.addEventListener('click', () => {
            this.toggleTimelineSnapMode();
        });
        this.els.toggleTimelineFollow.addEventListener('click', () => {
            this.toggleTimelineFollowMode();
        });
        this.els.clearAutomationBtn.addEventListener('click', () => {
            this.clearAutomationWithConfirmation();
        });
        this.els.generatorStrategy.addEventListener('change', () => {
            const isStrict = (this.els.generatorStrategy as HTMLSelectElement).value === 'strict';
            this.els.strictGeneratorSettings.classList.toggle('is-hidden', !isStrict);
        });
        this.els.generatePlanBtn.addEventListener('click', () => {
            if (!window.confirm('Overwrite current automation plan?')) return;
            void (async () => {
                const plan = await generatePerformancePlan(State.trackAnalysis, State.availablePresets, State.duration, this.buildGeneratorOptions());
                State.editedPerformancePlan = JSON.parse(JSON.stringify(plan));
                this.requestTimelineDraw();
            })();
        });
        this.initAutomationInspectorControls();
        this.initTimelineLayerControls();
    }

    private buildGeneratorOptions(): GeneratorOptions {
        const raw = (this.els.generatorStrategy as HTMLSelectElement).value;
        const strategy: GeneratorOptions['strategy'] =
            raw === 'hero' && featureFlags.heroEffect ? 'hero' : raw === 'strict' ? 'strict' : 'dramaturgy';
        if (raw === 'hero' && !featureFlags.heroEffect) {
            (this.els.generatorStrategy as HTMLSelectElement).value = 'dramaturgy';
            this.els.strictGeneratorSettings.classList.add('is-hidden');
        }
        return {
            strategy,
            presetMetadata: State.preloadedPresets as Record<string, any>,
            strictPresets: this.getStrictPresets(),
            strictBars: Math.max(1, Math.min(128, parseInt((this.els.strictBars as HTMLInputElement).value, 10) || 8)),
            strictMorph: Math.max(0.1, Math.min(20, parseFloat((this.els.strictMorph as HTMLInputElement).value) || 1.0))
        };
    }

    private getStrictPresets(): string[] {
        return [
            (this.els.strictP1 as HTMLSelectElement).value,
            (this.els.strictP2 as HTMLSelectElement).value,
            (this.els.strictP3 as HTMLSelectElement).value,
            (this.els.strictP4 as HTMLSelectElement).value,
        ].filter(Boolean);
    }

    private clearAutomationWithConfirmation(): void {
        if (!window.confirm('Are you sure you want to delete all automation points? This cannot be undone.')) return;
        const plan = this.ensureEditedPerformancePlan();
        plan.points = [];
        plan.source = 'edited';
        this.hideAutomationInspector();
        this.selectedAutomationPoint = null;
        this.requestTimelineDraw();
    }

    private setTimelineDrawMode(isActive: boolean): void {
        State.drawModeActive = isActive;
        if (!isActive) State.isDrawingEnvelope = false;
        this.els.toggleTimelineDraw.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        this.els.toggleTimelineDraw.classList.toggle('is-active', isActive);
        this.els.dramaturgyTimeline.classList.toggle('draw-active', isActive);
        this.syncTimelineDrawControls();
    }

    private syncTimelineDrawControls(): void {
        const drawTarget = this.els.timelineDrawTarget as HTMLSelectElement;
        const presetBrush = this.els.timelinePresetBrush as HTMLSelectElement;
        const isPresetBrush = drawTarget.value === 'preset';
        drawTarget.disabled = !State.drawModeActive;
        drawTarget.style.opacity = State.drawModeActive ? '1' : '0.35';
        drawTarget.style.pointerEvents = State.drawModeActive ? 'auto' : 'none';
        const enablePresetBrush = State.drawModeActive && isPresetBrush;
        presetBrush.disabled = !enablePresetBrush;
        presetBrush.style.opacity = enablePresetBrush ? '1' : '0.35';
        presetBrush.style.pointerEvents = enablePresetBrush ? 'auto' : 'none';
        this.els.toggleTimelineDraw.title = isPresetBrush ? 'Draw Preset Automation (D)' : 'Draw Sensitivity Envelope (D)';
    }

    private toggleTimelineSnapMode(): void {
        State.snapToGrid = !State.snapToGrid;
        this.syncTimelineSnapControl();
    }

    private syncTimelineSnapControl(): void {
        this.els.toggleTimelineSnap.classList.toggle('is-active', State.snapToGrid);
        this.els.toggleTimelineSnap.setAttribute('aria-pressed', State.snapToGrid ? 'true' : 'false');
    }

    private toggleTimelineFollowMode(): void {
        State.followPlayhead = !State.followPlayhead;
        this.syncTimelineFollowControl();
    }

    private syncTimelineFollowControl(): void {
        this.els.toggleTimelineFollow.classList.toggle('is-active', State.followPlayhead);
        this.els.toggleTimelineFollow.setAttribute('aria-pressed', State.followPlayhead ? 'true' : 'false');
    }

    private initAutomationInspectorControls(): void {
        this.els.inspectorPreset.addEventListener('change', () => {
            if (!this.selectedAutomationPoint) return;
            this.selectedAutomationPoint.preset = (this.els.inspectorPreset as HTMLSelectElement).value;
            this.requestTimelineDraw();
        });

        this.els.inspectorDuration.addEventListener('input', () => {
            if (!this.selectedAutomationPoint) return;
            const value = parseFloat((this.els.inspectorDuration as HTMLInputElement).value);
            this.selectedAutomationPoint.morphDurationSec = this.constrainMorphDuration(this.selectedAutomationPoint, value);
            this.requestTimelineDraw();
        });

        this.els.inspectorCurve.addEventListener('change', () => {
            if (!this.selectedAutomationPoint) return;
            const value = (this.els.inspectorCurve as HTMLSelectElement).value;
            if (!this.isMorphCurve(value)) return;
            this.selectedAutomationPoint.morphCurve = value;
            this.requestTimelineDraw();
        });

        this.els.inspectorAddBtn.addEventListener('click', () => {
            this.createAutomationPointAtTime(State.currentTime);
        });

        this.els.inspectorDeleteBtn.addEventListener('click', () => {
            const point = this.selectedAutomationPoint;
            if (!point || !State.editedPerformancePlan) return;
            State.editedPerformancePlan.points = State.editedPerformancePlan.points.filter(c => c !== point);
            this.selectedAutomationPoint = null;
            this.draggingAutomationPoint = null;
            this.hideAutomationInspector();
            this.requestTimelineDraw();
        });
    }

    private initTimelineLayerControls(): void {
        const controls: Array<[keyof TimelineLayers, HTMLElement]> = [
            ['waveform', this.els.layerToggleWaveform],
            ['rms', this.els.layerToggleRms],
            ['buildup', this.els.layerToggleBuildup],
            ['automation', this.els.layerToggleAutomation]
        ];
        for (const [layer, button] of controls) {
            this.syncTimelineLayerButton(button, State.timelineLayers[layer]);
            button.addEventListener('click', () => {
                State.timelineLayers[layer] = !State.timelineLayers[layer];
                this.syncTimelineLayerButton(button, State.timelineLayers[layer]);
                this.requestTimelineDraw();
            });
        }
    }

    private syncTimelineLayerButton(button: HTMLElement, active: boolean): void {
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    // ─── Timeline canvas interaction ──────────────────────────────────────────

    private createTimelineTooltip(): HTMLDivElement {
        let tooltip = document.getElementById('timeline-tooltip') as HTMLDivElement | null;
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'timeline-tooltip';
            tooltip.className = 'timeline-tooltip is-hidden';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    private hideTimelineTooltip(): void {
        this.timelineTooltip.classList.add('is-hidden');
    }

    private initDramaturgyTimeline(): void {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const zoomButton = this.els.toggleTimelineZoom as HTMLButtonElement;
        const drawButton = this.els.toggleTimelineDraw as HTMLButtonElement;
        const resizeHandle = this.els.timelineResizeHandle;
        const wrapper = canvas.parentElement as HTMLElement | null;

        this.timelineCanvas = new TimelineCanvas(canvas);
        this.gestureEngine = new GestureEngine(canvas, {
            onStart: (focusX, focusY, button, shiftKey) => this.startTimelineInteraction(focusX, focusY, button, shiftKey),
            onMove: (focusX, focusY, deltaX) => this.moveTimelineInteraction(focusX, focusY, deltaX),
            onEnd: () => this.endTimelineInteraction(),
            onZoom: (delta, focusX) => this.zoomTimeline(delta, focusX),
            onHover: (focusX, focusY) => this.hoverTimeline(focusX, focusY),
            onDoubleClick: (focusX, focusY) => this.doubleClickTimeline(focusX, focusY)
        });

        drawButton.addEventListener('click', () => {
            this.setTimelineDrawMode(!State.drawModeActive);
        });

        zoomButton.addEventListener('click', () => {
            if (!wrapper) return;
            this.toggleTimelineOverlay(wrapper, zoomButton);
            this.animateTimelineResize();
        });

        resizeHandle.addEventListener('pointerdown', (event) => {
            if (!wrapper || wrapper.classList.contains('is-fullscreen-overlay')) return;
            this.isResizingTimeline = true;
            this.timelineResizeStartY = event.clientY;
            this.timelineResizeStartHeight = this.getTimelineHeight(wrapper);
            wrapper.classList.add('is-resizing');
            resizeHandle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        resizeHandle.addEventListener('pointermove', (event) => {
            if (!this.isResizingTimeline || !wrapper) return;
            const delta = this.timelineResizeStartY - event.clientY;
            const nextHeight = this.clampTimelineHeight(this.timelineResizeStartHeight + delta);
            this.setTimelineHeight(wrapper, nextHeight, false);
            if (nextHeight > 40) this.lastExpandedTimelineHeight = nextHeight;
            zoomButton.setAttribute('aria-pressed', nextHeight > 40 ? 'true' : 'false');
        });

        const endResize = (event: PointerEvent) => {
            if (!this.isResizingTimeline || !wrapper) return;
            this.isResizingTimeline = false;
            wrapper.classList.remove('is-resizing');
            const isExpanded = this.getTimelineHeight(wrapper) > 40;
            wrapper.classList.toggle('is-expanded', isExpanded);
            zoomButton.setAttribute('aria-pressed', isExpanded ? 'true' : 'false');
            if (resizeHandle.hasPointerCapture(event.pointerId)) {
                resizeHandle.releasePointerCapture(event.pointerId);
            }
            this.requestTimelineDraw();
        };
        resizeHandle.addEventListener('pointerup', endResize);
        resizeHandle.addEventListener('pointercancel', endResize);

        if (typeof ResizeObserver !== 'undefined') {
            this.timelineResizeObserver = new ResizeObserver(() => {
                State.pan = this.clampTimelinePan(State.pan);
                this.timelineCanvas.resize();
                this.requestTimelineDraw();
            });
            this.timelineResizeObserver.observe(wrapper || canvas);
        }

        const clearTimelineHover = () => {
            this.setTimelineHover(null, null);
            this.hideTimelineTooltip();
        };
        canvas.addEventListener('pointerleave', clearTimelineHover);
        canvas.addEventListener('mouseleave', clearTimelineHover);
        window.addEventListener('blur', clearTimelineHover);
    }

    private toggleTimelineOverlay(wrapper: HTMLElement, zoomButton: HTMLButtonElement): void {
        const isFullscreen = wrapper.classList.contains('is-fullscreen-overlay');
        if (isFullscreen) {
            wrapper.classList.remove('is-fullscreen-overlay');
            wrapper.parentElement?.classList.remove('timeline-overlay-active');
            document.body.classList.remove('timeline-overlay-open');
            this.setTimelineHeight(wrapper, this.lastExpandedTimelineHeight, true);
            zoomButton.setAttribute('aria-pressed', 'false');
            zoomButton.setAttribute('aria-label', 'Open timeline overlay');
            zoomButton.title = 'Open Timeline';
            return;
        }
        const currentHeight = this.getTimelineHeight(wrapper);
        if (currentHeight > 40) this.lastExpandedTimelineHeight = currentHeight;
        wrapper.style.height = '';
        wrapper.classList.add('is-expanded', 'is-fullscreen-overlay');
        wrapper.parentElement?.classList.add('timeline-overlay-active');
        document.body.classList.add('timeline-overlay-open');
        zoomButton.setAttribute('aria-pressed', 'true');
        zoomButton.setAttribute('aria-label', 'Close timeline overlay');
        zoomButton.title = 'Close Timeline';
        this.requestTimelineDraw();
    }

    private setTimelineHover(point: PerformanceAutomationPoint | null, handleType: 'start' | 'end' | 'sensitivity' | 'curve' | null): void {
        if (this.hoveredPoint?.id === point?.id && this.hoveredHandleType === handleType) return;
        this.hoveredPoint = point;
        this.hoveredHandleType = handleType;
        this.requestTimelineDraw();
    }

    private startTimelineInteraction(focusX: number, focusY: number, button: number, shiftKey: boolean): boolean | void {
        this.hideTimelineTooltip();
        if (State.duration <= 0) return false;
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;

        if (State.drawModeActive && button === 0) {
            State.isDrawingEnvelope = true;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            canvas.style.cursor = '';
            this.drawAutomationAtPointer(focusX, focusY);
            return true;
        }

        this.timelineDragShiftKey = shiftKey;
        if (button === 0 && this.hoveredPoint && this.hoveredHandleType) {
            const point = this.selectEditableAutomationPoint(this.hoveredPoint);
            this.selectedAutomationPoint = point;
            this.draggingAutomationPoint = !point.locked && this.hoveredHandleType === 'start' ? point : null;
            this.resizingMorphPoint = !point.locked && this.hoveredHandleType === 'end' ? point : null;
            this.draggingSensitivityPoint = !point.locked && this.hoveredHandleType === 'sensitivity' ? point : null;
            this.draggingFullZone = !point.locked && this.hoveredHandleType === 'curve' ? point : null;
            if (this.draggingFullZone) this.dragStartOffsetSec = this.getTimelineTimeAtPercent(focusX) - point.time;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            this.showAutomationInspector(point);
            return true;
        }

        const morphHandlePoint = button === 0 ? this.getAutomationMorphHandleHit(focusX, focusY, 6) : null;
        if (morphHandlePoint) {
            const point = this.selectEditableAutomationPoint(morphHandlePoint);
            this.selectedAutomationPoint = point;
            this.resizingMorphPoint = point.locked ? null : point;
            this.draggingAutomationPoint = null;
            this.draggingSensitivityPoint = null;
            this.draggingFullZone = null;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            this.showAutomationInspector(point);
            return true;
        }

        const startHandlePoint = button === 0 ? this.getAutomationPointHit(focusX, focusY, 8) : null;
        if (startHandlePoint) {
            const point = this.selectEditableAutomationPoint(startHandlePoint);
            this.selectedAutomationPoint = point;
            this.draggingAutomationPoint = point.locked ? null : point;
            this.draggingSensitivityPoint = null;
            this.draggingFullZone = null;
            this.resizingMorphPoint = null;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            this.showAutomationInspector(point);
            return true;
        }

        const sensitivityPoint = button === 0 ? this.getAutomationSensitivityHit(focusX, focusY) : null;
        if (sensitivityPoint) {
            const point = this.selectEditableAutomationPoint(sensitivityPoint);
            this.selectedAutomationPoint = point;
            this.draggingSensitivityPoint = point.locked ? null : point;
            this.draggingAutomationPoint = null;
            this.draggingFullZone = null;
            this.resizingMorphPoint = null;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            this.showAutomationInspector(point);
            return true;
        }

        const zoneMovePoint = button === 0 ? this.getAutomationZoneMoveHit(focusX, focusY) : null;
        if (zoneMovePoint) {
            const point = this.selectEditableAutomationPoint(zoneMovePoint);
            this.selectedAutomationPoint = point;
            this.draggingFullZone = point.locked ? null : point;
            this.draggingAutomationPoint = null;
            this.draggingSensitivityPoint = null;
            this.resizingMorphPoint = null;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            this.showAutomationInspector(point);
            return true;
        }

        const automationPoint = button === 0 ? this.getAutomationPointHit(focusX, focusY, 10) : null;
        if (automationPoint) {
            const point = this.selectEditableAutomationPoint(automationPoint);
            this.selectedAutomationPoint = point;
            this.draggingAutomationPoint = point.locked ? null : point;
            this.draggingSensitivityPoint = null;
            this.draggingFullZone = null;
            this.resizingMorphPoint = null;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            this.showAutomationInspector(point);
            return true;
        }

        if (button === 0 && this.isAutomationLaneHit(focusY)) {
            this.selectedAutomationPoint = null;
            this.draggingAutomationPoint = null;
            this.draggingSensitivityPoint = null;
            this.draggingFullZone = null;
            this.resizingMorphPoint = null;
            this.hideAutomationInspector();
        }

        if (button === 1 || shiftKey) {
            this.isPanningTimeline = true;
            this.isSeekingTimeline = false;
            canvas.classList.add('is-panning');
            return true;
        }

        if (button === 0) {
            this.timelineDragShiftKey = shiftKey;
            this.isSeekingTimeline = true;
            this.isPanningTimeline = false;
            this.setScrubTime(this.getSnappedTimelineTimeAtPercent(focusX, shiftKey));
            return true;
        }

        return false;
    }

    private moveTimelineInteraction(focusX: number, focusY: number, deltaX: number): void {
        if (this.draggingAutomationPoint) {
            const rawTime = this.getSnappedTimelineTimeAtPercent(focusX, this.timelineDragShiftKey);
            const newTime = this.constrainPointTime(this.draggingAutomationPoint, rawTime);
            this.draggingAutomationPoint.time = newTime;
            this.els.inspectorTime.innerText = this.formatTime(newTime);
            this.requestTimelineDraw();
            return;
        }
        if (this.draggingSensitivityPoint) {
            this.draggingSensitivityPoint.intensity = this.getAutomationIntensityAtPercent(focusY);
            this.requestTimelineDraw();
            return;
        }
        if (this.draggingFullZone) {
            const rawTime = this.getSnappedTimelineTimeAtPercent(focusX, this.timelineDragShiftKey) - this.dragStartOffsetSec;
            const newTime = this.constrainPointTime(this.draggingFullZone, rawTime);
            this.draggingFullZone.time = newTime;
            this.els.inspectorTime.innerText = this.formatTime(newTime);
            this.requestTimelineDraw();
            return;
        }
        if (this.resizingMorphPoint) {
            const rawEnd = this.getTimelineTimeAtPercent(focusX);
            const rawDuration = rawEnd - this.resizingMorphPoint.time;
            const newDuration = this.constrainMorphDuration(this.resizingMorphPoint, rawDuration);
            this.resizingMorphPoint.morphDurationSec = newDuration;
            (this.els.inspectorDuration as HTMLInputElement).value = newDuration.toFixed(1);
            this.requestTimelineDraw();
            return;
        }
        if (State.isDrawingEnvelope) {
            this.drawAutomationAtPointer(focusX, focusY);
            return;
        }
        if (this.isPanningTimeline) {
            this.panTimeline(deltaX);
            return;
        }
        if (this.isSeekingTimeline) {
            this.setScrubTime(this.getSnappedTimelineTimeAtPercent(focusX, this.timelineDragShiftKey));
        }
    }

    private endTimelineInteraction(): void {
        if (this.draggingAutomationPoint || this.draggingSensitivityPoint || this.draggingFullZone || this.resizingMorphPoint) {
            this.draggingAutomationPoint = null;
            this.draggingSensitivityPoint = null;
            this.draggingFullZone = null;
            this.resizingMorphPoint = null;
            this.timelineDragShiftKey = false;
            State.editedPerformancePlan?.points.sort((a, b) => a.time - b.time);
            this.requestTimelineDraw();
        }
        if (State.isDrawingEnvelope) State.isDrawingEnvelope = false;
        if (this.isSeekingTimeline) this.commitScrubTime();
        this.isPanningTimeline = false;
        this.isSeekingTimeline = false;
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        canvas.classList.remove('is-panning');
        canvas.style.cursor = '';
        this.hideTimelineTooltip();
    }

    // ─── Automation hit detection ─────────────────────────────────────────────

    private getAutomationPointHit(focusX: number, _focusY: number, tolerancePx: number): PerformanceAutomationPoint | null {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.height < 80) return null;
        const points = (State.editedPerformancePlan ?? State.performancePlan)?.points;
        if (!points?.length) return null;
        const x = focusX * rect.width;
        let closestPoint: PerformanceAutomationPoint | null = null;
        let closestDistance = tolerancePx;
        for (const point of points) {
            const pointX = this.getTimelineXForTime(point.time, rect.width);
            const distance = Math.abs(pointX - x);
            if (distance <= closestDistance) { closestPoint = point; closestDistance = distance; }
        }
        return closestPoint;
    }

    private getAutomationMorphHandleHit(focusX: number, focusY: number, tolerancePx: number): PerformanceAutomationPoint | null {
        if (!this.isAutomationLaneHit(focusY)) return null;
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.height < 80) return null;
        const points = (State.editedPerformancePlan ?? State.performancePlan)?.points;
        if (!points?.length) return null;
        const x = focusX * rect.width;
        let closestPoint: PerformanceAutomationPoint | null = null;
        let closestDistance = tolerancePx;
        for (const point of points) {
            const handleX = this.getTimelineXForTime(point.time + point.morphDurationSec, rect.width);
            const distance = Math.abs(handleX - x);
            if (distance <= closestDistance) { closestPoint = point; closestDistance = distance; }
        }
        return closestPoint;
    }

    private getAutomationSensitivityHit(focusX: number, focusY: number): PerformanceAutomationPoint | null {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.height < 80) return null;
        const points = this.getSortedAutomationPoints();
        if (!points.length) return null;
        const x = focusX * rect.width;
        const y = focusY * rect.height;
        const { topPad, graphBottom } = this.getAutomationGraphMetrics(rect.height);
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const zoneStart = this.getTimelineXForTime(point.time, rect.width);
            const zoneEnd = i + 1 < points.length ? this.getTimelineXForTime(points[i + 1].time, rect.width) : rect.width;
            const lineY = this.getAutomationYForIntensity(point.intensity, topPad, graphBottom);
            if (x >= zoneStart && x <= zoneEnd && Math.abs(y - lineY) <= 8) return point;
        }
        return null;
    }

    private getAutomationZoneMoveHit(focusX: number, focusY: number): PerformanceAutomationPoint | null {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.height < 80) return null;
        const points = this.getSortedAutomationPoints();
        if (!points.length) return null;
        const x = focusX * rect.width;
        const y = focusY * rect.height;
        const { topPad } = this.getAutomationGraphMetrics(rect.height);
        if (y < topPad || y > topPad + 14) return null;
        for (let i = 0; i < points.length; i++) {
            const zoneStart = this.getTimelineXForTime(points[i].time, rect.width);
            const zoneEnd = i + 1 < points.length ? this.getTimelineXForTime(points[i + 1].time, rect.width) : rect.width;
            if (x >= zoneStart && x <= zoneEnd) return points[i];
        }
        return null;
    }

    private getAutomationCurveHit(focusX: number, focusY: number): PerformanceAutomationPoint | null {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.height < 80) return null;
        const points = this.getSortedAutomationPoints();
        if (!points.length) return null;
        const x = focusX * rect.width;
        const y = focusY * rect.height;
        const { topPad, graphBottom } = this.getAutomationGraphMetrics(rect.height);
        if (y < topPad || y > graphBottom) return null;
        for (const point of points) {
            const startX = this.getTimelineXForTime(point.time, rect.width);
            const endX = this.getTimelineXForTime(point.time + point.morphDurationSec, rect.width);
            if (endX <= startX || x < startX || x > endX) continue;
            return point;
        }
        return null;
    }

    private getSortedAutomationPoints(): PerformanceAutomationPoint[] {
        const points = (State.editedPerformancePlan ?? State.performancePlan)?.points ?? [];
        return [...points].sort((a, b) => a.time - b.time);
    }

    private isAutomationLaneHit(focusY: number): boolean {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.height < 80) return false;
        const { topPad, graphBottom } = this.getAutomationGraphMetrics(rect.height);
        const y = focusY * rect.height;
        return y >= topPad && y <= graphBottom;
    }

    private doubleClickTimeline(focusX: number, focusY: number): void {
        if (this.isAutomationLaneHit(focusY)) {
            this.createAutomationPointAtTime(this.getTimelineTimeAtPercent(focusX));
        }
    }

    private createAutomationPointAtTime(time: number): PerformanceAutomationPoint | null {
        if (State.duration <= 0) return null;
        const plan = this.ensureEditedPerformancePlan();
        if (!plan) return null;
        const pointTime = this.clamp(time, 0, State.duration);
        for (const existing of plan.points) {
            if (pointTime >= existing.time && pointTime < existing.time + existing.morphDurationSec) return null;
        }
        const defaultDuration = State.targetTuning.morphDurationSec;
        let allowedDuration = defaultDuration;
        for (const existing of plan.points) {
            if (existing.time > pointTime) {
                allowedDuration = Math.min(allowedDuration, existing.time - pointTime);
            }
        }
        allowedDuration = Math.max(0.1, allowedDuration);
        const sectionIdx = Math.max(0, State.trackAnalysis.sections.findIndex(s => pointTime >= s.start && pointTime <= s.end));
        const section = State.trackAnalysis.sections[sectionIdx];
        const preset = this.getSelectedAutomationPreset();
        const point: PerformanceAutomationPoint = {
            id: `manual-${Date.now().toString(36)}-${Math.round(pointTime * 1000).toString(36)}`,
            time: pointTime,
            sectionId: section ? `${sectionIdx}:${section.label}:${pointTime.toFixed(3).replace('.', '-')}` : `manual:${pointTime.toFixed(3).replace('.', '-')}`,
            preset,
            confidence: 1,
            intensity: this.getDefaultAutomationIntensity(),
            reason: 'manual',
            morphDurationSec: allowedDuration,
            morphCurve: this.getMorphCurveName(State.targetTuning.morphCurveValue)
        };
        plan.points.push(point);
        plan.points.sort((a, b) => a.time - b.time);
        this.selectedAutomationPoint = point;
        this.showAutomationInspector(point);
        this.requestTimelineDraw();
        return point;
    }

    private ensureEditedPerformancePlan(): PerformanceAutomationPlan {
        const plan: PerformanceAutomationPlan = State.editedPerformancePlan
            ?? (State.performancePlan ? JSON.parse(JSON.stringify(State.performancePlan)) : { version: 1, source: 'edited', points: [] });
        plan.source = 'edited';
        State.editedPerformancePlan = plan;
        return plan;
    }

    private getSelectedAutomationPreset(): string {
        const brush = (this.els.timelinePresetBrush as HTMLSelectElement).value;
        return brush || (this.els.presetList as HTMLSelectElement).value || State.availablePresets[0] || 'default.json';
    }

    private getNearestEditableAutomationPoint(time: number, toleranceSec: number): PerformanceAutomationPoint | null {
        const plan = this.ensureEditedPerformancePlan();
        let nearestPoint: PerformanceAutomationPoint | null = null;
        let nearestDistance = toleranceSec;
        for (const point of plan.points) {
            const distance = Math.abs(point.time - time);
            if (distance <= nearestDistance) { nearestPoint = point; nearestDistance = distance; }
        }
        return nearestPoint;
    }

    private getDefaultAutomationIntensity(): number {
        const sensitivity = State.visualTuning?.audioSensitivity;
        return this.clamp(Number.isFinite(sensitivity) ? sensitivity : 1.0, 0.1, 4.0);
    }

    private getAutomationIntensityAtPercent(focusY: number): number {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const { topPad, graphHeight } = this.getAutomationGraphMetrics(rect.height);
        const y = focusY * rect.height;
        const normalized = this.clamp(1 - (y - topPad) / graphHeight, 0, 1);
        return 0.1 + normalized * 3.9;
    }

    private getAutomationGraphMetrics(height: number): { topPad: number; bottomPad: number; graphBottom: number; graphHeight: number } {
        const topPad = height >= 52 ? 18 : 4;
        const bottomPad = 5;
        const graphBottom = height - bottomPad;
        const graphHeight = Math.max(8, graphBottom - topPad);
        return { topPad, bottomPad, graphBottom, graphHeight };
    }

    private getAutomationYForIntensity(intensity: number, topPad: number, graphBottom: number): number {
        const normalized = this.clamp((intensity - 0.1) / 3.9, 0, 1);
        return graphBottom - normalized * (graphBottom - topPad);
    }

    private getSnappedTimelineTimeAtPercent(focusX: number, shiftKey: boolean): number {
        const time = this.getTimelineTimeAtPercent(focusX);
        const shouldSnap = State.snapToGrid ? !shiftKey : shiftKey;
        return shouldSnap ? this.snapTimeToNearestGrid(time) : time;
    }

    private snapTimeToNearestGrid(time: number): number {
        const bars = State.trackAnalysis.bars;
        if (bars.length < 2) return time;
        const secondsPerBar = bars[1].start - bars[0].start;
        const secondsPerBeat = secondsPerBar / 4;
        const firstBar = bars[0].start;
        const beatIndex = Math.round((time - firstBar) / secondsPerBeat);
        return this.clamp(firstBar + beatIndex * secondsPerBeat, 0, State.duration);
    }


    private selectEditableAutomationPoint(point: PerformanceAutomationPoint): PerformanceAutomationPoint {
        if (!State.editedPerformancePlan && State.performancePlan) {
            State.editedPerformancePlan = JSON.parse(JSON.stringify(State.performancePlan));
        }
        return State.editedPerformancePlan?.points.find(c => c.id === point.id) ?? point;
    }

    private showAutomationInspector(point: PerformanceAutomationPoint): void {
        this.els.inspectorTime.innerText = this.formatTime(point.time);
        const presetSelect = this.els.inspectorPreset as HTMLSelectElement;
        const presetOptions = State.availablePresets.includes(point.preset)
            ? State.availablePresets
            : [point.preset, ...State.availablePresets];
        presetSelect.innerHTML = presetOptions.length
            ? presetOptions.map(f => `<option value="${this.escapeHtml(f)}">${this.escapeHtml(this.formatPresetName(f))}</option>`).join('')
            : `<option value="${this.escapeHtml(point.preset)}">${this.escapeHtml(this.formatPresetName(point.preset))}</option>`;
        presetSelect.value = point.preset;
        (this.els.inspectorDuration as HTMLInputElement).value = point.morphDurationSec.toFixed(1);
        (this.els.inspectorCurve as HTMLSelectElement).value = point.morphCurve;
        this.els.automationInspector.style.opacity = '1';
        this.els.automationInspector.style.pointerEvents = 'auto';
        (this.els.inspectorPreset as HTMLSelectElement).disabled = false;
        (this.els.inspectorDuration as HTMLInputElement).disabled = false;
        (this.els.inspectorCurve as HTMLSelectElement).disabled = false;
        (this.els.inspectorDeleteBtn as HTMLButtonElement).disabled = false;
        (this.els.inspectorAddBtn as HTMLButtonElement).disabled = false;
    }

    private hideAutomationInspector(): void {
        this.els.automationInspector.style.opacity = '0.35';
        this.els.automationInspector.style.pointerEvents = 'none';
        (this.els.inspectorPreset as HTMLSelectElement).disabled = true;
        (this.els.inspectorDuration as HTMLInputElement).disabled = true;
        (this.els.inspectorCurve as HTMLSelectElement).disabled = true;
        (this.els.inspectorDeleteBtn as HTMLButtonElement).disabled = true;
        (this.els.inspectorAddBtn as HTMLButtonElement).disabled = true;
        this.els.inspectorTime.innerText = '0:00';
    }

    // ─── Timeline geometry helpers ────────────────────────────────────────────

    private getTimelineXForTime(time: number, width: number): number {
        const visibleDuration = this.getTimelineVisibleDuration();
        State.pan = this.clampTimelinePan(State.pan);
        return ((time - State.pan) / Math.max(0.001, visibleDuration)) * width;
    }

    private getTimelineVisibleDuration(): number {
        if (State.duration <= 0) return 0;
        return State.duration / this.clamp(State.zoom, 1, 16);
    }

    private getTimelineTimeAtPercent(percent: number): number {
        const visibleDuration = this.getTimelineVisibleDuration();
        State.pan = this.clampTimelinePan(State.pan);
        return this.clamp(State.pan + this.clamp(percent, 0, 1) * visibleDuration, 0, State.duration);
    }

    private clampTimelinePan(offset: number): number {
        if (State.duration <= 0) return 0;
        const visibleDuration = this.getTimelineVisibleDuration();
        return this.clamp(offset, 0, Math.max(0, State.duration - visibleDuration));
    }

    private getTimelineHeight(wrapper: HTMLElement): number {
        return wrapper.getBoundingClientRect().height || 28;
    }

    private clampTimelineHeight(height: number): number {
        return Math.min(400, Math.max(24, height));
    }

    private setTimelineHeight(wrapper: HTMLElement, height: number, animate: boolean): void {
        const nextHeight = this.clampTimelineHeight(height);
        wrapper.classList.toggle('is-expanded', nextHeight > 40);
        wrapper.style.height = `${nextHeight}px`;
        wrapper.classList.toggle('is-resizing', !animate && this.isResizingTimeline);
        this.timelineCanvas.resize();
        this.requestTimelineDraw();
    }

    private constrainPointTime(movingPoint: PerformanceAutomationPoint, proposedTime: number): number {
        const plan = State.editedPerformancePlan ?? State.performancePlan;
        const dur = movingPoint.morphDurationSec;
        const totalDur = State.duration;
        if (!plan?.points.length) return this.clamp(proposedTime, 0, Math.max(0, totalDur - dur));
        const others = plan.points.filter(p => p.id !== movingPoint.id).sort((a, b) => a.time - b.time);
        if (!others.length) return this.clamp(proposedTime, 0, Math.max(0, totalDur - dur));
        let minStart = 0;
        let maxEnd = totalDur;
        for (const other of others) {
            const os = other.time;
            const oe = other.time + other.morphDurationSec;
            if (oe <= proposedTime) {
                minStart = Math.max(minStart, oe);
            } else if (os >= proposedTime + dur) {
                maxEnd = Math.min(maxEnd, os);
            } else {
                const distLeft = Math.abs(proposedTime - (os - dur));
                const distRight = Math.abs(proposedTime - oe);
                if (distLeft <= distRight) { maxEnd = Math.min(maxEnd, os); }
                else { minStart = Math.max(minStart, oe); }
            }
        }
        const lo = minStart;
        const hi = Math.max(lo, maxEnd - dur);
        return this.clamp(proposedTime, lo, hi);
    }

    private constrainMorphDuration(point: PerformanceAutomationPoint, proposedDuration: number): number {
        const plan = State.editedPerformancePlan ?? State.performancePlan;
        if (!plan?.points.length) return this.clamp(proposedDuration, 0.1, 20);
        let maxDuration = Math.min(20, Math.max(0.1, State.duration - point.time));
        for (const other of plan.points) {
            if (other.id !== point.id && other.time > point.time) {
                maxDuration = Math.min(maxDuration, other.time - point.time);
            }
        }
        return this.clamp(proposedDuration, 0.1, Math.max(0.1, maxDuration));
    }

    private hoverTimeline(focusX: number, focusY: number): void {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        if (State.duration <= 0) {
            canvas.style.cursor = '';
            this.setTimelineHover(null, null);
            this.hideTimelineTooltip();
            return;
        }
        if (State.drawModeActive) {
            canvas.style.cursor = 'cell';
            this.setTimelineHover(null, null);
            this.hideTimelineTooltip();
            return;
        }
        if (this.isSeekingTimeline || this.isPanningTimeline || this.isResizingTimeline) {
            this.setTimelineHover(null, null);
            this.hideTimelineTooltip();
            return;
        }
        const startPoint = this.getAutomationPointHit(focusX, focusY, 8);
        const endPoint = this.getAutomationMorphHandleHit(focusX, focusY, 6);
        const sensitivityPoint = this.getAutomationSensitivityHit(focusX, focusY);
        const curvePoint = this.getAutomationCurveHit(focusX, focusY);
        if (startPoint) {
            canvas.style.cursor = 'ew-resize';
            this.setTimelineHover(startPoint, 'start');
        } else if (endPoint) {
            canvas.style.cursor = 'col-resize';
            this.setTimelineHover(endPoint, 'end');
        } else if (sensitivityPoint) {
            canvas.style.cursor = 'ns-resize';
            this.setTimelineHover(sensitivityPoint, 'sensitivity');
        } else if (curvePoint) {
            canvas.style.cursor = 'move';
            this.setTimelineHover(curvePoint, 'curve');
        } else {
            canvas.style.cursor = '';
            this.setTimelineHover(null, null);
        }
        const hoverTime = this.getTimelineTimeAtPercent(focusX);
        const bars = State.trackAnalysis.bars;
        const bar = bars.find(b => hoverTime >= b.start && hoverTime <= b.end);
        const section = State.trackAnalysis.sections.find(s => hoverTime >= s.start && hoverTime <= s.end);
        let content = `Idő: ${this.formatTime(hoverTime)} (Zoom: ${State.zoom.toFixed(1)}x)`;
        const analysis = State.trackAnalysis;
        if (featureFlags.analyzerDebugOverlay && (analysis.bpmConfidence > 0 || analysis.gridConfidence > 0 || analysis.downbeatConfidence > 0)) {
            content += `\nBPM conf: ${this.formatPercent(analysis.bpmConfidence)} | Grid: ${this.formatPercent(analysis.gridConfidence)} | Downbeat: ${this.formatPercent(analysis.downbeatConfidence)}`;
            const alternatives = analysis.tempoCandidates
                .filter(candidate => candidate.bpm !== analysis.bpm)
                .slice(0, 2)
                .map(candidate => `${candidate.bpm} BPM ${this.formatPercent(candidate.score)}`);
            if (alternatives.length) content += `\nAlt tempo: ${alternatives.join(', ')}`;
        }
        if (section) content += `\nSzekció: ${section.label.toUpperCase()} (${section.dominantFeature})`;
        if (featureFlags.analyzerDebugOverlay) {
            if (section?.reasons?.length) content += `\nOkok: ${section.reasons.join(', ')}`;
            const nearbyCue = [...analysis.significantMoments, ...analysis.cues]
                .filter(cue => cue.reasons?.length)
                .reduce<{ cue: typeof analysis.cues[number]; distance: number } | null>((closest, cue) => {
                    const distance = Math.abs(cue.time - hoverTime);
                    return distance <= 1.5 && (!closest || distance < closest.distance) ? { cue, distance } : closest;
                }, null);
            if (nearbyCue) content += `\nCue ${nearbyCue.cue.kind.toUpperCase()}: ${nearbyCue.cue.reasons!.join(', ')}`;
        }
        if (bar) {
            content += `\nÜtem: #${bar.index + 1} [${bar.state}] | RMS: ${bar.avgRms.toFixed(2)}`;
            content += `\nBass: ${bar.bass.toFixed(2)} | Mid: ${bar.mid.toFixed(2)} | Treble: ${bar.treble.toFixed(2)}`;
        }
        const frameIdx = Math.floor(hoverTime * State.sampleRate / State.hopSize);
        const buildup = State.trackAnalysis.buildupConfidence[frameIdx] || 0;
        if (buildup > 0.01) content += `\nBuildup: ${(buildup * 100).toFixed(0)}%`;
        const rect = canvas.getBoundingClientRect();
        const tooltipX = rect.left + focusX * rect.width + 15;
        const tooltipY = rect.top + focusY * rect.height + 15;
        this.timelineTooltip.textContent = content;
        this.timelineTooltip.classList.remove('is-hidden');
        const tooltipRect = this.timelineTooltip.getBoundingClientRect();
        const left = Math.min(tooltipX, window.innerWidth - tooltipRect.width - 15);
        const top = Math.min(tooltipY, window.innerHeight - tooltipRect.height - 15);
        this.timelineTooltip.style.left = `${left}px`;
        this.timelineTooltip.style.top = `${top}px`;
    }

    private zoomTimeline(delta: number, focusX: number): void {
        if (State.duration <= 0) return;
        const normalizedFocus = this.clamp(focusX, 0, 1);
        const focusTime = this.getTimelineTimeAtPercent(normalizedFocus);
        const zoomFactor = delta > 0 ? 1.18 : 1 / 1.18;
        State.zoom = this.clamp(State.zoom * zoomFactor, 1, 16);
        const nextVisibleDuration = this.getTimelineVisibleDuration();
        State.pan = this.clampTimelinePan(focusTime - normalizedFocus * nextVisibleDuration);
        if (State.zoom <= 1.01) State.pan = 0;
        this.requestTimelineDraw();
    }

    private panTimeline(deltaX: number): void {
        if (State.duration <= 0) return;
        const visibleDuration = this.getTimelineVisibleDuration();
        const deltaSeconds = deltaX * visibleDuration;
        State.pan = this.clampTimelinePan(State.pan - deltaSeconds);
        this.requestTimelineDraw();
    }

    private drawAutomationAtPointer(focusX: number, focusY: number): void {
        if (State.duration <= 0) return;
        const MIN_DRAW_DISTANCE_SEC = 2.0;
        const hoverTime = this.getTimelineTimeAtPercent(focusX);
        const drawTarget = (this.els.timelineDrawTarget as HTMLSelectElement).value;
        const existingPoint = this.getNearestEditableAutomationPoint(hoverTime, MIN_DRAW_DISTANCE_SEC);
        const presetName = this.getSelectedAutomationPreset();
        if (existingPoint && !existingPoint.locked) {
            if (drawTarget === 'preset') { existingPoint.preset = presetName; }
            else { existingPoint.intensity = this.getAutomationIntensityAtPercent(focusY); }
            this.selectedAutomationPoint = existingPoint;
            this.showAutomationInspector(existingPoint);
            this.requestTimelineDraw();
            return;
        }
        if (drawTarget === 'preset') { this.createAutomationPointAtTime(hoverTime); return; }
        const point = this.createAutomationPointAtTime(hoverTime);
        if (!point || point.locked) return;
        point.intensity = this.getAutomationIntensityAtPercent(focusY);
        this.selectedAutomationPoint = point;
        this.showAutomationInspector(point);
        this.requestTimelineDraw();
    }

    private followTimelinePlayhead(): void {
        if (!State.followPlayhead || !State.isPlaying || State.duration <= 0 || State.zoom <= 1.05) return;
        const viewportStart = this.clampTimelinePan(State.pan);
        const visibleDuration = this.getTimelineVisibleDuration();
        const relativePosition = (State.currentTime - viewportStart) / Math.max(0.001, visibleDuration);
        if (relativePosition > 0.75 || relativePosition < 0.15) {
            State.pan = this.clampTimelinePan(State.currentTime - visibleDuration * 0.5);
        }
    }

    private resetTimelineView(): void {
        State.zoom = 1;
        State.pan = 0;
        State.followPlayhead = true;
        this.syncTimelineFollowControl();
        this.scrubTime = null;
        this.lastTriggeredAutomationPointId = null;
        this.selectedAutomationPoint = null;
        this.draggingAutomationPoint = null;
        this.draggingSensitivityPoint = null;
        this.draggingFullZone = null;
        this.resizingMorphPoint = null;
        this.timelineDragShiftKey = false;
        this.hideAutomationInspector();
    }

    private requestTimelineDraw(): void {
        if (this.timelineResizeFrame !== null) return;
        this.timelineResizeFrame = window.requestAnimationFrame(() => {
            this.timelineResizeFrame = null;
            this.drawDramaturgyTimeline();
        });
    }

    private requestDashboardTimelineDraw(): void {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (!this.shouldDrawTimelineForDashboard(rect)) return;
        this.rememberTimelineDrawState(rect);
        this.requestTimelineDraw();
    }

    private shouldDrawTimelineForDashboard(rect: DOMRect): boolean {
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (State.duration <= 0) return this.lastTimelineDrawWidth !== rect.width || this.lastTimelineDrawHeight !== rect.height;
        if (this.lastTimelineAnalysisRef !== State.trackAnalysis) return true;
        if (this.lastTimelineDrawWidth !== rect.width || this.lastTimelineDrawHeight !== rect.height) return true;
        if (this.lastTimelineDrawZoom !== State.zoom || this.lastTimelineDrawScroll !== State.pan) return true;
        if (this.lastTimelineDrawScrubTime !== this.scrubTime) return true;
        const visibleSecondsPerPixel = this.getTimelineVisibleDuration() / Math.max(1, rect.width);
        return Math.abs(State.currentTime - this.lastTimelineDrawTime) >= visibleSecondsPerPixel;
    }

    private rememberTimelineDrawState(rect: DOMRect): void {
        this.lastTimelineAnalysisRef = State.trackAnalysis;
        this.lastTimelineDrawTime = State.currentTime;
        this.lastTimelineDrawWidth = rect.width;
        this.lastTimelineDrawHeight = rect.height;
        this.lastTimelineDrawZoom = State.zoom;
        this.lastTimelineDrawScroll = State.pan;
        this.lastTimelineDrawScrubTime = this.scrubTime;
    }

    private animateTimelineResize(): void {
        let frames = 0;
        const redraw = () => {
            this.drawDramaturgyTimeline();
            frames++;
            if (frames < 20) window.requestAnimationFrame(redraw);
        };
        window.requestAnimationFrame(redraw);
    }

    private drawDramaturgyTimeline(): void {
        this.followTimelinePlayhead();
        this.timelineCanvas.render(this.getRenderState());
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        this.rememberTimelineDrawState(canvas.getBoundingClientRect());
    }

    private clearDramaturgyTimeline(): void {
        this.timelineCanvas?.render({ ...this.getRenderState(), duration: 0, currentTime: 0, scrubTime: null });
    }

    private getRenderState(): RenderState {
        return {
            isPlaying: State.isPlaying,
            isExporting: State.isExporting,
            exportTime: State.exportTime,
            currentTime: State.currentTime,
            duration: State.duration,
            zoom: State.zoom,
            pan: State.pan,
            bpm: State.bpm,
            sampleRate: State.sampleRate,
            hopSize: State.hopSize,
            frames: State.frames,
            sections: State.trackAnalysis.sections,
            bars: State.trackAnalysis.bars,
            cues: State.trackAnalysis.cues,
            significantMoments: State.trackAnalysis.significantMoments,
            buildupConfidence: State.trackAnalysis.buildupConfidence,
            spectralPivot: State.trackAnalysis.spectralPivot,
            tensionTrends: State.trackAnalysis.tensionTrends,
            noveltyCurve: State.trackAnalysis.noveltyCurve,
            boundaryCandidates: State.trackAnalysis.boundaryCandidates,
            showAnalyzerDebugOverlay: featureFlags.analyzerDebugOverlay,
            performancePlan: State.editedPerformancePlan ?? State.performancePlan,
            timelineLayers: State.timelineLayers,
            snapToGrid: State.snapToGrid,
            selectedPointId: this.selectedAutomationPoint?.id || null,
            followPlayhead: State.followPlayhead,
            hoveredPointId: this.hoveredPoint?.id || null,
            hoveredHandleType: this.hoveredHandleType,
            audioSensitivity: State.visualTuning.audioSensitivity,
            dropAnticipation: State.visualTuning.dropAnticipation,
            videoDominantColor: State.videoDominantColor,
            scrubTime: this.scrubTime,
            gridOffset: State.trackAnalysis.gridOffset
        };
    }

    // ─── Metric tooltips ──────────────────────────────────────────────────────

    private createDashboardMetricTooltip(): HTMLDivElement {
        const tooltip = document.createElement('div');
        tooltip.id = 'dashboard-metric-tooltip';
        tooltip.className = 'metric-tooltip is-hidden';
        tooltip.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltip);
        return tooltip;
    }

    private initDashboardMetricTooltips(): void {
        const getMetricCard = (target: EventTarget | null): HTMLElement | null => {
            const el = target instanceof Element ? target : null;
            const card = el?.closest('[data-metric-key]') as HTMLElement | null;
            return card && this.els.metricsGrid.contains(card) ? card : null;
        };
        this.els.metricsGrid.addEventListener('pointerover', (e) => {
            if (e.pointerType === 'touch') return;
            const card = getMetricCard(e.target);
            if (card) this.showMetricTooltip(card);
        });
        this.els.metricsGrid.addEventListener('pointerout', (e) => {
            if (!this.activeMetricCard) return;
            const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
            if (related && this.activeMetricCard.contains(related)) return;
            this.hideMetricTooltip();
        });
        this.els.metricsGrid.addEventListener('focusin', (e) => {
            const card = getMetricCard(e.target);
            if (card) this.showMetricTooltip(card);
        });
        this.els.metricsGrid.addEventListener('focusout', (e) => {
            const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
            if (related && this.els.metricsGrid.contains(related)) return;
            this.hideMetricTooltip();
        });
        this.els.metricsGrid.addEventListener('click', (e) => {
            const card = getMetricCard(e.target);
            if (!card) return;
            if (this.activeMetricCard === card && !this.metricTooltip.classList.contains('is-hidden')) {
                this.hideMetricTooltip();
            } else {
                this.showMetricTooltip(card);
            }
        });
        this.els.metricsGrid.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.hideMetricTooltip();
        });
        document.addEventListener('pointerdown', (e) => {
            if (!this.activeMetricCard) return;
            const target = e.target instanceof Node ? e.target : null;
            if (target && (this.activeMetricCard.contains(target) || this.metricTooltip.contains(target))) return;
            this.hideMetricTooltip();
        });
    }

    private showMetricTooltip(card: HTMLElement): void {
        const key = card.dataset.metricKey as DashboardMetricKey | undefined;
        if (!key) return;
        const metadata = dashboardMetricMetadata[key];
        if (!metadata) return;
        this.activeMetricCard = card;
        this.metricTooltip.textContent = metadata.tooltip;
        this.metricTooltip.classList.remove('is-hidden');
        this.positionMetricTooltip(card);
    }

    private positionMetricTooltip(card: HTMLElement): void {
        const gap = 8;
        const rect = card.getBoundingClientRect();
        const tooltipRect = this.metricTooltip.getBoundingClientRect();
        const maxLeft = window.innerWidth - tooltipRect.width - gap;
        const left = Math.max(gap, Math.min(rect.left, maxLeft));
        const aboveTop = rect.top - tooltipRect.height - gap;
        const belowTop = rect.bottom + gap;
        const top = aboveTop >= gap ? aboveTop : Math.min(belowTop, window.innerHeight - tooltipRect.height - gap);
        this.metricTooltip.style.left = `${left}px`;
        this.metricTooltip.style.top = `${Math.max(gap, top)}px`;
    }

    private hideMetricTooltip(): void {
        this.activeMetricCard = null;
        this.metricTooltip.classList.add('is-hidden');
    }

    // ─── Chrome auto-hide ─────────────────────────────────────────────────────

    private initChromeAutoHide(): void {
        const interactiveChrome = [
            this.els.tuningPanel, this.els.metricsGrid, this.els.toggleMetrics,
            this.els.seekBar, this.els.dramaturgyTimeline
        ];
        const reveal = () => this.revealChromeTemporarily();
        window.addEventListener('mousemove', reveal);
        window.addEventListener('pointerdown', reveal);
        window.addEventListener('keydown', reveal);
        window.addEventListener('touchstart', reveal, { passive: true });
        for (const element of interactiveChrome) {
            element.addEventListener('mouseenter', () => this.clearChromeHideTimer());
            element.addEventListener('mouseleave', () => this.scheduleChromeHide());
            element.addEventListener('focusin', () => this.clearChromeHideTimer());
            element.addEventListener('focusout', () => this.scheduleChromeHide());
        }
        this.revealChromeTemporarily();
    }

    private revealChromeTemporarily(): void {
        if (!State.uiVisible) return;
        document.body.classList.remove('chrome-idle');
        this.scheduleChromeHide();
    }

    private scheduleChromeHide(delay = 2600): void {
        this.clearChromeHideTimer();
        if (this.isUiLockedVisible) return;
        this.chromeHideTimer = window.setTimeout(() => {
            if (this.isChromeHovered()) { this.scheduleChromeHide(2600); return; }
            document.body.classList.add('chrome-idle');
        }, delay);
    }

    private clearChromeHideTimer(): void {
        if (this.chromeHideTimer !== null) {
            window.clearTimeout(this.chromeHideTimer);
            this.chromeHideTimer = null;
        }
    }

    private isChromeHovered(): boolean {
        return ['.top-row:hover', '.tuning-panel:hover', '.bottom-section:hover', '.center-play-btn:hover']
            .some(sel => Boolean(document.querySelector(sel)));
    }

    // ─── Preset loading ───────────────────────────────────────────────────────

    private async loadVisualPresetList(): Promise<void> {
        try {
            const response = await fetch(this.presetUrl('index.json'), { cache: 'no-store' });
            if (!response.ok) throw new Error(`Preset manifest ${response.status}`);
            const manifest = await response.json() as VisualPresetManifest;
            const presets = (manifest.presets || [])
                .filter(f => /^[\w .-]+\.json$/i.test(f))
                .filter(f => f.toLowerCase() !== 'index.json');
            State.availablePresets = presets;
            this.tuningCtrl.updatePresetList(presets);
        } catch {
            this.tuningCtrl.updatePresetList([]);
        }
    }

    private async loadVisualPreset(fileName: string): Promise<void> {
        try {
            let presetData = this.presetCache.get(fileName);
            if (!presetData) {
                const response = await fetch(this.presetUrl(fileName), { cache: 'no-store' });
                if (!response.ok) throw new Error(`Preset ${response.status}`);
                presetData = await response.json();
                this.presetCache.set(fileName, presetData);
            }
            this.cachePreloadedPreset(fileName, presetData);
            this.applyPerformancePreset(presetData);
            this.tuningCtrl.syncVisualTuningControls();
        } catch {
            this.tuningCtrl.showCopyStatus(`Could not load ${fileName}`, 1800);
        }
    }

    private async preloadPresetsForPlan(plan: PerformanceAutomationPlan | null): Promise<void> {
        if (!plan?.points.length) return;
        const uniquePresets = [...new Set(plan.points.map(p => p.preset))];
        await Promise.all(uniquePresets.map(async (preset) => {
            if (this.presetCache.has(preset)) return this.cachePreloadedPreset(preset, this.presetCache.get(preset));
            try {
                const response = await fetch(this.presetUrl(preset), { cache: 'no-store' });
                if (!response.ok) throw new Error(`Preset ${response.status}`);
                const payload = await response.json();
                this.presetCache.set(preset, payload);
                this.cachePreloadedPreset(preset, payload);
            } catch { /* opportunistic */ }
        }));
    }

    private presetUrl(fileName: string): string {
        return `${import.meta.env.BASE_URL}visual-tuning-presets/${encodeURIComponent(fileName)}`;
    }

    private cachePreloadedPreset(fileName: string, payload: unknown): void {
        State.preloadedPresets[fileName] = (payload && typeof payload === 'object')
            ? payload as Partial<VisualTuningConfig>
            : {};
    }

    private applyPerformancePreset(payload: unknown): void {
        Object.assign(State.targetTuning, normalizeVisualTuningConfig(payload, State.targetTuning));
        if (!payload || typeof payload !== 'object') return;
        const preset = payload as {
            visualMode?: unknown;
            performancePlan?: unknown;
            morphProfile?: { durationSec?: unknown; curve?: unknown };
            dramaturgyProfile?: {
                buildupIntensity?: unknown;
                dropDampening?: unknown;
                breakRestraint?: unknown;
                vocalHighlight?: unknown;
                fxChaos?: unknown;
            };
        };
        if (this.isPerformanceAutomationPlan(preset.performancePlan)) {
            State.performancePlan = preset.performancePlan;
            State.editedPerformancePlan = JSON.parse(JSON.stringify(preset.performancePlan));
            void this.preloadPresetsForPlan(preset.performancePlan);
            this.lastTriggeredAutomationPointId = null;
        }
        if (typeof preset.visualMode === 'string' && isVisualMode(preset.visualMode)) {
            State.visualMode = preset.visualMode;
            (this.els.visualMode as HTMLSelectElement).value = State.visualMode;
        }
        if (preset.morphProfile) {
            if (typeof preset.morphProfile.durationSec === 'number') State.targetTuning.morphDurationSec = preset.morphProfile.durationSec;
            if (preset.morphProfile.curve === 'linear') State.targetTuning.morphCurveValue = 0;
            else if (preset.morphProfile.curve === 'easeInOut') State.targetTuning.morphCurveValue = 1;
            else if (preset.morphProfile.curve === 'exponential') State.targetTuning.morphCurveValue = 2;
        }
        if (preset.dramaturgyProfile) {
            const p = preset.dramaturgyProfile;
            if (typeof p.buildupIntensity === 'number') State.targetTuning.buildupIntensity = p.buildupIntensity;
            if (typeof p.dropDampening === 'number') State.targetTuning.dropDampening = p.dropDampening;
            if (typeof p.breakRestraint === 'number') State.targetTuning.breakRestraint = p.breakRestraint;
            if (typeof p.vocalHighlight === 'number') State.targetTuning.vocalHighlight = p.vocalHighlight;
            if (typeof p.fxChaos === 'number') State.targetTuning.fxChaos = p.fxChaos;
        }
    }

    private isPerformanceAutomationPlan(value: unknown): value is PerformanceAutomationPlan {
        if (!value || typeof value !== 'object') return false;
        const plan = value as { version?: unknown; source?: unknown; points?: unknown };
        if (plan.version !== 1) return false;
        if (plan.source !== 'auto' && plan.source !== 'edited') return false;
        if (!Array.isArray(plan.points)) return false;
        return plan.points.every(point => {
            if (!point || typeof point !== 'object') return false;
            const candidate = point as Record<string, unknown>;
            return typeof candidate.id === 'string'
                && typeof candidate.time === 'number'
                && typeof candidate.sectionId === 'string'
                && typeof candidate.preset === 'string'
                && typeof candidate.confidence === 'number'
                && typeof candidate.intensity === 'number'
                && this.isPerformanceAutomationReason(candidate.reason)
                && typeof candidate.morphDurationSec === 'number'
                && this.isMorphCurve(candidate.morphCurve)
                && (candidate.analysisConfidence === undefined || typeof candidate.analysisConfidence === 'number')
                && (candidate.timingMode === undefined || candidate.timingMode === 'bar-aligned' || candidate.timingMode === 'energy-reactive' || candidate.timingMode === 'novelty')
                && (candidate.locked === undefined || typeof candidate.locked === 'boolean');
        });
    }

    private isPerformanceAutomationReason(value: unknown): value is PerformanceAutomationPoint['reason'] {
        return value === 'intro' || value === 'verse' || value === 'build' || value === 'drop'
            || value === 'break' || value === 'peak' || value === 'outro' || value === 'harmonicShift' || value === 'manual';
    }

    private isMorphCurve(value: unknown): value is MorphCurve {
        return value === 'linear' || value === 'easeInOut' || value === 'exponential';
    }

    // ─── Performance automation trigger ──────────────────────────────────────

    private triggerPerformanceAutomation(): void {
        const plan = State.editedPerformancePlan ?? State.performancePlan;
        if (!plan?.points.length) return;
        let activePoint: PerformanceAutomationPoint | null = null;
        for (const point of plan.points) {
            if (point.time > State.currentTime) break;
            activePoint = point;
        }
        if (!activePoint || activePoint.id === this.lastTriggeredAutomationPointId) return;
        this.lastTriggeredAutomationPointId = activePoint.id;
        State.targetTuning.audioSensitivity = activePoint.intensity;
        State.targetTuning.morphDurationSec = activePoint.morphDurationSec;
        State.targetTuning.morphCurveValue = activePoint.morphCurve === 'linear' ? 0
            : activePoint.morphCurve === 'exponential' ? 2 : 1;
        void this.loadVisualPreset(activePoint.preset);
    }

    // ─── Config copy ──────────────────────────────────────────────────────────

    private async copyVisualConfig(): Promise<void> {
        const payload = JSON.stringify({
            version: 2,
            name: 'Current Performance',
            visualMode: State.visualMode,
            visualTuning: State.targetTuning,
            morphProfile: {
                durationSec: State.targetTuning.morphDurationSec,
                curve: this.getMorphCurveName(State.targetTuning.morphCurveValue),
                preserveEnergy: true
            },
            dramaturgyProfile: {
                buildupIntensity: State.targetTuning.buildupIntensity,
                dropDampening: State.targetTuning.dropDampening,
                breakRestraint: State.targetTuning.breakRestraint,
                vocalHighlight: State.targetTuning.vocalHighlight,
                fxChaos: State.targetTuning.fxChaos
            },
            performancePlan: State.editedPerformancePlan ?? State.performancePlan
        }, null, 2);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(payload);
            } else {
                this.copyTextFallback(payload);
            }
            this.tuningCtrl.showCopyStatus('Copied');
        } catch {
            this.copyTextFallback(payload);
            this.tuningCtrl.showCopyStatus('Copied');
        }
    }

    private copyTextFallback(value: string): void {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.setAttribute('readonly', 'true');
        textArea.className = 'copy-fallback-input';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
    }

    // ─── Presentation mode ────────────────────────────────────────────────────

    private applyPresentationModeFromUrl(): void {
        const params = new URLSearchParams(window.location.search);
        if (params.get('presentation') !== 'true') return;
        State.uiVisible = false;
        document.body.classList.add('presentation-mode', 'chrome-idle');
        this.els.toggleMetrics.setAttribute('aria-expanded', 'false');
        this.els.metricsGrid.classList.add('is-hidden');
        this.tuningCtrl.setTuningPanelOpen(false);
    }

    // ─── Public dashboard update ──────────────────────────────────────────────

    updateDashboard() {
        this.triggerPerformanceAutomation();
        this.updateReactiveVideoBackplate();

        if (!this.playbackCtrl.isDraggingSlider && this.scrubTime === null) {
            const progress = State.duration > 0 ? (State.currentTime / State.duration) * 100 : 0;
            this.playbackCtrl.updateSeekBar(progress);
            this.els.timeCur.innerText = this.formatTime(State.currentTime);
        }

        this.els.valE.innerText = State.currentFrame.e.toFixed(2); this.els.barE.style.width = (State.currentFrame.e * 100) + '%';
        this.els.valB.innerText = State.currentFrame.densityProj.toFixed(2); this.els.barB.style.width = (State.currentFrame.densityProj * 100) + '%';
        this.els.valM.innerText = State.currentFrame.melodyProj.toFixed(2); this.els.barM.style.width = (State.currentFrame.melodyProj * 100) + '%';
        this.els.valVocal.innerText = State.currentFeatures.vocal.toFixed(2); this.els.barVocal.style.width = (State.currentFeatures.vocal * 100) + '%';
        this.els.valFx.innerText = State.currentFeatures.fx.toFixed(2); this.els.barFx.style.width = (State.currentFeatures.fx * 100) + '%';
        this.els.valBeat.innerText = State.beatDecay.toFixed(2); this.els.barBeat.style.width = (State.beatDecay * 100) + '%';
        this.drawPerceptualSpectrum(State.currentFrame.perceptualSpectrum);

        let dynText = 'IDLE';
        if (State.isPlaying) {
            if (State.currentFrame.state === 'HIGH') dynText = 'HIGH';
            else if (State.currentFrame.state === 'LOW') dynText = 'LOW';
            else if (State.currentFrame.state === 'LOW_DROP') dynText = 'LOW [DROP]';
            else if (State.currentFrame.state === 'LOW_OVERLOAD') dynText = 'LOW [OVERLOAD]';
        }
        this.els.valDyn.innerText = dynText;
        this.els.barDyn.style.width = (State.currentFrame.eRatio * 100) + '%';

        this.playbackCtrl.updateBpmBadge(State.bpm);
        this.requestDashboardTimelineDraw();
    }

    private drawPerceptualSpectrum(values: number[]): void {
        const canvas = this.els.perceptualSpectrumCanvas as HTMLCanvasElement;
        this.resizePerceptualSpectrumCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.clientWidth || 1;
        const height = canvas.clientHeight || 1;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const columnCount = 24;
        const gap = 3;
        const columnWidth = Math.max(1, Math.floor((width - gap * (columnCount - 1)) / columnCount));
        for (let i = 0; i < columnCount; i++) {
            const value = this.clamp(values?.[i] ?? 0, 0, 1);
            if (value > this.spectrumPeakHold[i]) this.spectrumPeakHold[i] = value;
            else this.spectrumPeakHold[i] = Math.max(value, this.spectrumPeakHold[i] - 0.024);

            const barHeight = Math.max(2, value * (height - 4));
            const x = i * (columnWidth + gap);
            const y = height - barHeight;
            const alpha = 0.32 + value * 0.58;
            ctx.fillStyle = `rgba(232, 232, 226, ${alpha.toFixed(3)})`;
            ctx.fillRect(x, y, columnWidth, barHeight);

            const peakY = Math.max(1, height - this.spectrumPeakHold[i] * (height - 4));
            ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
            ctx.fillRect(x, peakY, columnWidth, 1.5);
        }
    }

    private initPerceptualSpectrumCanvas(): void {
        const canvas = this.els.perceptualSpectrumCanvas as HTMLCanvasElement;
        const card = canvas.closest('.spectrum-card') as HTMLElement | null;
        this.resizePerceptualSpectrumCanvas(canvas);
        if (typeof ResizeObserver === 'undefined') return;
        this.spectrumResizeObserver = new ResizeObserver(() => {
            this.resizePerceptualSpectrumCanvas(canvas);
            this.drawPerceptualSpectrum(State.currentFrame.perceptualSpectrum);
        });
        this.spectrumResizeObserver.observe(card ?? canvas);
    }

    private resizePerceptualSpectrumCanvas(canvas: HTMLCanvasElement): void {
        const rect = canvas.getBoundingClientRect();
        const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 144));
        const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || 72));
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const targetWidth = Math.round(cssWidth * dpr);
        const targetHeight = Math.round(cssHeight * dpr);
        if (canvas.width !== targetWidth) canvas.width = targetWidth;
        if (canvas.height !== targetHeight) canvas.height = targetHeight;
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    destroy(): void {
        this.gestureEngine.destroy();
        this.clearVideoBackplate();
        this.timelineResizeObserver?.disconnect();
        this.spectrumResizeObserver?.disconnect();
        if (this.timelineResizeFrame !== null) {
            window.cancelAnimationFrame(this.timelineResizeFrame);
            this.timelineResizeFrame = null;
        }
        this.clearChromeHideTimer();
    }

    // ─── Utilities ────────────────────────────────────────────────────────────

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }

    private formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    private formatPercent(value: number): string {
        return `${Math.round(this.clamp(value, 0, 1) * 100)}%`;
    }

    private getMorphCurveName(value: number): MorphCurve {
        const curve = Math.round(Number.isFinite(value) ? value : 1);
        if (curve <= 0) return 'linear';
        if (curve >= 2) return 'exponential';
        return 'easeInOut';
    }

    private escapeHtml(value: string): string {
        return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
    }

    private formatPresetName(fileName: string): string {
        return fileName.replace(/\.json$/i, '');
    }

    private configureVideoBackplate(file: File): void {
        this.clearVideoBackplate();
        if (!this.isVideoFile(file)) return;
        const objectUrl = URL.createObjectURL(file);
        this.videoObjectUrl = objectUrl;
        this.videoElement.src = objectUrl;
        try {
            this.videoElement.currentTime = 0;
        } catch {
            // Metadata may not be available yet; playback/export sync will seek after it loads.
        }
        this.videoElement.muted = true;
        this.videoElement.classList.add('is-active');
        State.videoBackplateActive = true;
    }

    private clearVideoBackplate(): void {
        this.videoElement.pause();
        this.resetVideoPlaybackRate();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
        this.videoElement.classList.remove('is-active');
        State.videoBackplateActive = false;
        State.videoDominantColor = { r: 0, g: 0, b: 0 };
        if (this.videoObjectUrl) {
            URL.revokeObjectURL(this.videoObjectUrl);
            this.videoObjectUrl = null;
        }
    }

    private syncVideoPlayback(event: 'play' | 'pause' | 'stop' | 'seek', time: number): void {
        if (!State.videoBackplateActive) return;
        this.videoElement.muted = true;
        const clampedTime = this.clamp(time, 0, Math.max(0, this.videoElement.duration || State.duration));
        if (Number.isFinite(clampedTime)) {
            try {
                if (Math.abs(this.videoElement.currentTime - clampedTime) > 0.08 || event === 'seek' || event === 'stop') {
                    this.videoElement.currentTime = clampedTime;
                }
            } catch {
                // Some browsers reject early seeks before metadata is ready; the next playback event will resync.
            }
        }
        if (event === 'play') {
            void this.videoElement.play().catch(() => undefined);
        } else if (event === 'pause' || event === 'stop') {
            this.videoElement.pause();
            this.resetVideoPlaybackRate();
        }
    }

    private updateReactiveVideoBackplate(): void {
        if (!State.videoBackplateActive) return;
        this.updateVideoDominantColor();
        if (State.isExporting) return;

        const targetRate = State.isPlaying
            ? this.clamp(0.88 + State.modulation.macroMomentum * 0.62 + State.modulation.rhythmicImpulse * 0.50, 0.5, 2.0)
            : 1.0;
        this.videoRateSmoother += (targetRate - this.videoRateSmoother) * 0.18;
        const playbackRate = this.clamp(this.videoRateSmoother, 0.5, 2.0);
        if (Math.abs(this.videoElement.playbackRate - playbackRate) > 0.01) {
            this.videoElement.playbackRate = playbackRate;
        }
    }

    private resetVideoPlaybackRate(): void {
        this.videoRateSmoother = 1.0;
        if (this.videoElement.playbackRate !== 1.0) {
            this.videoElement.playbackRate = 1.0;
        }
    }

    private updateVideoDominantColor(): void {
        this.videoSampleTick++;
        if (this.videoSampleTick % 3 !== 0) return;
        if (this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        if (this.videoElement.videoWidth <= 0 || this.videoElement.videoHeight <= 0) return;

        const ctx = this.videoSampleCtx;
        if (!ctx) return;

        try {
            ctx.drawImage(this.videoElement, 0, 0, 4, 4);
            const pixels = ctx.getImageData(0, 0, 4, 4).data;
            let r = 0, g = 0, b = 0;
            const count = pixels.length / 4;
            for (let i = 0; i < pixels.length; i += 4) {
                r += pixels[i];
                g += pixels[i + 1];
                b += pixels[i + 2];
            }
            State.videoDominantColor = {
                r: Math.round(r / count),
                g: Math.round(g / count),
                b: Math.round(b / count)
            };
        } catch {
            // Cross-origin or not-yet-decoded frames can reject canvas reads; keep the last usable color.
        }
    }

    private isVideoFile(file: File): boolean {
        return file.type.startsWith('video/') || VIDEO_FILE_EXTENSION_RE.test(file.name);
    }
}

function isVisualMode(value: string): value is VisualMode {
    return value === 'classic' || value === 'temporal' || value === 'dark-techno'
        || value === 'organic-ambient' || value === 'cyberpunk'
        || (featureFlags.heroEffect && value === 'hero');
}
