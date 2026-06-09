import type { AudioEngine } from '../audio/AudioEngine';
import { generatePerformancePlan } from '../automation/performancePlanGenerator';
import { normalizeVisualTuningConfig, visualTuningControls, type VisualTuningKey } from '../config/visualTuning';
import { ExportCapabilityDetector } from '../export/ExportCapabilityDetector';
import { WebMExporter, type ExportConfig } from '../export/WebMExporter';
import type { ExportCapabilities } from '../export/ExportTypes';
import { State } from '../state/store';
import type { MorphCurve, PerformanceAutomationPlan, PerformanceAutomationPoint, RenderState, TimelineLayers, VisualMode } from '../types';
import { GestureEngine } from './GestureEngine';
import { dashboardMetricMetadata, type DashboardMetricKey } from './metricMetadata';
import { TimelineCanvas } from './TimelineCanvas';

interface VisualPresetManifest {
    presets?: string[];
}

export class DashboardUI {
    private presetCache = new Map<string, unknown>();
    private timelineTooltip: HTMLDivElement; // JAVÍTVA: Timeline tooltip példányhelye
    private isDraggingSlider = false;
    private isResizingTimeline = false;
    private isPanningTimeline = false;
    private isSeekingTimeline = false;
    private lastSurfaceClickAt = 0;
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
    private tuningDragOffset = { x: 0, y: 0 };
    private els: Record<string, HTMLElement>;
    private engine: AudioEngine;
    private timelineCanvas!: TimelineCanvas;
    private gestureEngine!: GestureEngine;
    private timelineResizeObserver: ResizeObserver | null = null;
    private exportP5Instance: any = null;
    private exportCanvas: HTMLCanvasElement | null = null;
    private currentExporter: WebMExporter | null = null;
    private exportCapabilities: ExportCapabilities | null = null;

    // UI visibility lock state.
    private isUiLockedVisible = false;
    private singleClickTimer: number | null = null;

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
            barDyn: document.getElementById('bar-dyn')!
        };

        this.engine.addPlaybackEndedListener(() => {
            this.setPlaybackUi(false);
            (this.els.seekBar as HTMLInputElement).value = "0";
            this.updateDashboard();
        });

        this.engine.addPositionChangedListener(() => {
            this.lastTriggeredAutomationPointId = null;
            this.triggerPerformanceAutomation();
        });

        this.engine.onAnalysisError = (message) => {
            this.els.status.innerText = "Hiba: " + message;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            (this.els.centerPlayBtn as HTMLButtonElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).disabled = true;
            (this.els.exportVideoBtn as HTMLButtonElement).disabled = true;
            (this.els.upload as HTMLInputElement).disabled = false;
            this.clearDramaturgyTimeline();
        };

        this.initBindings();
        void this.initExportCapabilityUi();
        this.initVisualTuningControls();
        this.metricTooltip = this.createDashboardMetricTooltip();
        this.timelineTooltip = this.createTimelineTooltip(); // JAVÍTVA: Timeline tooltip példányosítása
        this.initDashboardMetricTooltips();
        this.initDramaturgyTimeline();
        this.syncLoopUi();
        this.syncTimelineSnapControl();
        this.syncTimelineFollowControl();
        this.applyPresentationModeFromUrl();
        this.initChromeAutoHide();
        void this.loadVisualPresetList();
    }

    private createTimelineTooltip() {
        let tooltip = document.getElementById('timeline-tooltip') as HTMLDivElement | null;
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'timeline-tooltip';
            tooltip.className = 'timeline-tooltip is-hidden';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    private hideTimelineTooltip() {
        this.timelineTooltip.classList.add('is-hidden');
    }

    private formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return "0:00";
        let min = Math.floor(seconds / 60);
        let sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    private initBindings() {
        (this.els.upload as HTMLInputElement).addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            this.engine.stop(true);
            this.els.status.innerText = file.name;
            (this.els.upload as HTMLInputElement).disabled = true;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).value = "0";
            this.setPlaybackUi(false);
            this.els.timeCur.innerText = "0:00";
            this.els.timeTot.innerText = "0:00";
            this.els.bpmHeaderBadge.style.display = "none";
            this.resetTimelineView();
            this.clearDramaturgyTimeline();

            this.engine.onAnalysisComplete = () => {
                if (State.bpm > 0) {
                    this.els.bpmHeaderBadge.innerText = State.bpm + " BPM";
                    this.els.bpmHeaderBadge.style.display = "inline-flex";
                }
                this.els.status.innerText = file.name;
                (this.els.playBtn as HTMLButtonElement).disabled = false;
                (this.els.centerPlayBtn as HTMLButtonElement).disabled = false;
                (this.els.seekBar as HTMLInputElement).disabled = false;
                (this.els.exportVideoBtn as HTMLButtonElement).disabled = !this.canExport();
                (this.els.upload as HTMLInputElement).disabled = false;
                this.els.timeTot.innerText = this.formatTime(State.duration);
                const plan = generatePerformancePlan(State.trackAnalysis, State.availablePresets, State.duration);
                State.performancePlan = plan;
                State.editedPerformancePlan = JSON.parse(JSON.stringify(plan));
                void this.preloadPresetsForPlan(plan);
                this.setPlaybackUi(false);
                const buffer = this.engine.getAudioBuffer();
                if (buffer) this.timelineCanvas.setAudioBuffer(buffer);
                this.drawDramaturgyTimeline();
            };

            try {
                await this.engine.loadFile(file);
            } catch {
                this.els.status.innerText = "Hiba: nem sikerult betolteni a fajlt";
                (this.els.playBtn as HTMLButtonElement).disabled = true;
                (this.els.centerPlayBtn as HTMLButtonElement).disabled = true;
                (this.els.seekBar as HTMLInputElement).disabled = true;
                (this.els.exportVideoBtn as HTMLButtonElement).disabled = true;
                (this.els.upload as HTMLInputElement).disabled = false;
                this.clearDramaturgyTimeline();
            }
        });

        this.els.playBtn.addEventListener('click', () => {
            this.togglePlayback();
        });

        this.els.centerPlayBtn.addEventListener('click', () => {
            this.togglePlayback();
            this.els.canvasContainer.focus();
        });

        this.els.exportVideoBtn.addEventListener('click', () => {
            void this.startVideoExport();
        });

        this.els.stopExportBtn.addEventListener('click', () => {
            this.currentExporter?.stopAndSave();
            (this.els.stopExportBtn as HTMLButtonElement).disabled = true;
            (this.els.exportVideoBtn as HTMLButtonElement).innerText = 'Finalizing...';
        });

        this.els.cancelExportBtn.addEventListener('click', () => {
            this.currentExporter?.cancelExport();
            this.resetExportUi();
        });

        (this.els.visualMode as HTMLSelectElement).addEventListener('change', (e) => {
            const mode = (e.target as HTMLSelectElement).value;
            if (isVisualMode(mode)) State.visualMode = mode;
        });

        this.els.toggleTuningPanel.addEventListener('click', () => {
            this.setTuningPanelOpen(this.els.tuningPanel.classList.contains('is-hidden'));
        });

        this.els.toggleLoop.addEventListener('click', () => {
            State.loopPlayback = !State.loopPlayback;
            this.syncLoopUi();
        });

        this.els.toggleMetrics.addEventListener('click', () => {
            const isHidden = this.els.metricsGrid.classList.toggle('is-hidden');
            this.els.toggleMetrics.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
        });

        this.els.canvasContainer.addEventListener('click', () => {
            if (State.isExporting) return;
            this.els.canvasContainer.focus();

            const now = window.performance.now();
            
            if (now - this.lastSurfaceClickAt <= 320) {
                // Double click toggles playback.
                if (this.singleClickTimer !== null) {
                    window.clearTimeout(this.singleClickTimer);
                    this.singleClickTimer = null;
                }
                this.togglePlayback();
                this.lastSurfaceClickAt = 0;
            } else {
                // Single click is delayed so double click can take precedence.
                this.lastSurfaceClickAt = now;
                this.singleClickTimer = window.setTimeout(() => {
                    this.toggleUiLock(); // Lock or unlock the UI.
                    this.singleClickTimer = null;
                }, 350);
            }
        });

        this.els.canvasContainer.addEventListener('keydown', (event) => {
            if (State.isExporting) return;
            if (document.activeElement !== this.els.canvasContainer) return;
            if (event.code === 'Space') {
                event.preventDefault();
                this.togglePlayback();
            } else if (event.code === 'ArrowLeft') {
                event.preventDefault();
                this.seekRelative(-5);
            } else if (event.code === 'ArrowRight') {
                event.preventDefault();
                this.seekRelative(5);
            }
        });

        window.addEventListener('keydown', (event) => {
            if (State.isExporting) return;
            if (this.isEditableEventTarget(event.target)) return;
            if (event.code === 'KeyD') {
                event.preventDefault();
                this.setTimelineDrawMode(!State.drawModeActive);
            } else if (event.code === 'KeyS') {
                event.preventDefault();
                this.toggleTimelineSnapMode();
            } else if (event.code === 'KeyF') {
                event.preventDefault();
                this.toggleTimelineFollowMode();
            }
        });

        this.els.timelineDrawTarget.addEventListener('change', () => {
            this.syncTimelineDrawControls();
        });
        this.els.toggleTimelineSnap.addEventListener('click', () => {
            this.toggleTimelineSnapMode();
        });
        this.els.toggleTimelineFollow.addEventListener('click', () => {
            this.toggleTimelineFollowMode();
        });
        this.initAutomationInspectorControls();
        this.initTimelineLayerControls();

        this.initTuningPanelDrag();

        const seek = this.els.seekBar as HTMLInputElement;
        seek.addEventListener('mousedown', () => this.isDraggingSlider = true);
        seek.addEventListener('touchstart', () => this.isDraggingSlider = true);
        seek.addEventListener('input', (e) => {
            if (State.duration > 0) {
                let seekTime = (parseFloat((e.target as HTMLInputElement).value) / 100) * State.duration;
                this.setScrubTime(seekTime);
            }
        });
        seek.addEventListener('change', () => {
            this.commitScrubTime();
            this.isDraggingSlider = false;
        });
        seek.addEventListener('touchend', () => {
            this.commitScrubTime();
            this.isDraggingSlider = false;
        });

        this.els.fsBtn.addEventListener('click', () => {
            let doc = window.document as any;
            let docEl = doc.documentElement;
            let reqFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
            let exitFS = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
            if(!doc.fullscreenElement) { reqFS?.call(docEl); } else { exitFS?.call(doc); }
        });
    }

    private async initExportCapabilityUi(): Promise<void> {
        const report = await ExportCapabilityDetector.detectCapabilities();
        this.exportCapabilities = report;
        this.applyExportCapabilityUi(report);
    }

    private applyExportCapabilityUi(report: ExportCapabilities): void {
        const resolutionSelect = this.els.exportResolution as HTMLSelectElement;

        if (report.preferredBackend === 'none') {
            (this.els.exportVideoBtn as HTMLButtonElement).disabled = true;
            this.els.status.innerText = report.warnings[0] || 'Video export is not supported in this browser.';
        }

        if (report.warnings.length > 0) {
            const warning = document.createElement('div');
            warning.className = 'export-capability-warning';
            warning.style.color = '#ffd166';
            warning.style.fontSize = '12px';
            warning.style.marginTop = '6px';
            warning.textContent = `\u26A0\uFE0F ${report.warnings.join(' ')}`;
            this.els.exportVideoBtn.insertAdjacentElement('afterend', warning);
            console.warn(report.warnings.join(' '));
        }

        if (!report.isMobile) return;

        const fourKOption = Array.from(resolutionSelect.options).find(option => option.value === '4K');
        if (fourKOption) {
            fourKOption.disabled = true;
            fourKOption.hidden = true;
        }

        const fullHdOption = Array.from(resolutionSelect.options).find(option => option.value === '1080p');
        if (fullHdOption && !fullHdOption.textContent?.includes('Not recommended on mobile')) {
            fullHdOption.textContent = `${fullHdOption.textContent || '1080p'} (Not recommended on mobile)`;
        }

        if (resolutionSelect.value === '4K') {
            resolutionSelect.value = '1080p';
        }
    }

    private toggleUiLock() {
        this.isUiLockedVisible = !this.isUiLockedVisible;
        
        if (this.isUiLockedVisible) {
            // Locked UI stays visible.
            this.clearChromeHideTimer();
            document.body.classList.remove('chrome-idle');
        } else {
            // After intentional background unlock, hide quickly for visible feedback.
            this.scheduleChromeHide(400);
        }
    }

    setExportTarget(p5Instance: any, canvas: HTMLCanvasElement) {
        this.exportP5Instance = p5Instance;
        this.exportCanvas = canvas;
        (this.els.exportVideoBtn as HTMLButtonElement).disabled = !this.canExport();
    }

    private setTuningPanelOpen(isOpen: boolean) {
        this.els.tuningPanel.classList.toggle('is-hidden', !isOpen);
        this.els.toggleTuningPanel.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    private setTimelineDrawMode(isActive: boolean) {
        State.drawModeActive = isActive;
        if (!isActive) State.isDrawingEnvelope = false;
        this.els.toggleTimelineDraw.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        this.els.toggleTimelineDraw.classList.toggle('is-active', isActive);
        this.els.dramaturgyTimeline.classList.toggle('draw-active', isActive);
        this.syncTimelineDrawControls();
    }

    private syncTimelineDrawControls() {
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

    private toggleTimelineSnapMode() {
        State.snapToGrid = !State.snapToGrid;
        this.syncTimelineSnapControl();
    }

    private syncTimelineSnapControl() {
        this.els.toggleTimelineSnap.classList.toggle('is-active', State.snapToGrid);
        this.els.toggleTimelineSnap.setAttribute('aria-pressed', State.snapToGrid ? 'true' : 'false');
    }

    private toggleTimelineFollowMode() {
        State.followPlayhead = !State.followPlayhead;
        this.syncTimelineFollowControl();
    }

    private syncTimelineFollowControl() {
        this.els.toggleTimelineFollow.classList.toggle('is-active', State.followPlayhead);
        this.els.toggleTimelineFollow.setAttribute('aria-pressed', State.followPlayhead ? 'true' : 'false');
    }

    private initAutomationInspectorControls() {
        this.els.inspectorPreset.addEventListener('change', () => {
            if (!this.selectedAutomationPoint) return;
            this.selectedAutomationPoint.preset = (this.els.inspectorPreset as HTMLSelectElement).value;
            this.requestTimelineDraw();
        });

        this.els.inspectorDuration.addEventListener('input', () => {
            if (!this.selectedAutomationPoint) return;
            const value = parseFloat((this.els.inspectorDuration as HTMLInputElement).value);
            this.selectedAutomationPoint.morphDurationSec = this.constrainMorphDuration(
                this.selectedAutomationPoint, value
            );
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
            State.editedPerformancePlan.points = State.editedPerformancePlan.points.filter(candidate => candidate !== point);
            this.selectedAutomationPoint = null;
            this.draggingAutomationPoint = null;
            this.hideAutomationInspector();
            this.requestTimelineDraw();
        });
    }

    private initTimelineLayerControls() {
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

    private syncTimelineLayerButton(button: HTMLElement, active: boolean) {
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    private setTimelineHover(point: PerformanceAutomationPoint | null, handleType: 'start' | 'end' | 'sensitivity' | 'curve' | null) {
        if (this.hoveredPoint?.id === point?.id && this.hoveredHandleType === handleType) return;
        this.hoveredPoint = point;
        this.hoveredHandleType = handleType;
        this.requestTimelineDraw();
    }

    private isEditableEventTarget(target: EventTarget | null) {
        if (!(target instanceof HTMLElement)) return false;
        return Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
    }

    private togglePlayback() {
        if ((this.els.playBtn as HTMLButtonElement).disabled || State.duration <= 0) return;

        if (State.isPlaying) {
            this.engine.stop(false);
            this.setPlaybackUi(false);
        } else {
            this.engine.play();
            this.setPlaybackUi(true);
        }
    }

    private async startVideoExport() {
        const report = this.exportCapabilities ?? ExportCapabilityDetector.getReport();
        if (!this.canExport() || report.preferredBackend === 'none' || this.currentExporter) return;
        if (State.isPlaying) {
            this.engine.stop(false);
            this.setPlaybackUi(false);
        }

        const exportButton = this.els.exportVideoBtn as HTMLButtonElement;
        const cancelButton = this.els.cancelExportBtn as HTMLButtonElement;
        const config = this.getExportConfig();

        const exporter = new WebMExporter(this.exportP5Instance, this.exportCanvas!, this.engine);
        this.currentExporter = exporter;
        this.setExportUiActive(true);

        try {
            const blob = await exporter.startExport({ ...config, trackName: this.els.status.innerText }, (progress) => {
                exportButton.innerText = `Exporting: ${Math.round(progress * 100)}%`;
            });
            this.downloadBlob(blob, 'plexus-visual.webm');
        } catch (error) {
            if (!String(error instanceof Error ? error.message : error).includes('cancelled')) {
                this.els.status.innerText = "Hiba: export sikertelen";
            }
        } finally {
            if (this.currentExporter === exporter) this.currentExporter = null;
            cancelButton.classList.add('is-hidden');
            this.resetExportUi();
        }
    }

    private canExport() {
        return State.duration > 0
            && Boolean(this.exportP5Instance && this.exportCanvas)
            && this.exportCapabilities?.preferredBackend !== 'none';
    }

    private getExportConfig(): ExportConfig {
        const resolution = (this.els.exportResolution as HTMLSelectElement).value as ExportConfig['resolution'];
        const aspectRatio = (this.els.exportAspect as HTMLSelectElement).value as ExportConfig['aspectRatio'];
            return { resolution, aspectRatio, fps: 60 };
    }

    private setExportUiActive(isActive: boolean) {
        (this.els.playBtn as HTMLButtonElement).disabled = isActive;
        (this.els.centerPlayBtn as HTMLButtonElement).disabled = isActive;
        (this.els.seekBar as HTMLInputElement).disabled = isActive;
        (this.els.upload as HTMLInputElement).disabled = isActive;
        (this.els.exportResolution as HTMLSelectElement).disabled = isActive;
        (this.els.exportAspect as HTMLSelectElement).disabled = isActive;
        (this.els.exportVideoBtn as HTMLButtonElement).disabled = isActive;
        (this.els.stopExportBtn as HTMLButtonElement).disabled = !isActive;
        (this.els.cancelExportBtn as HTMLButtonElement).disabled = !isActive;
        this.els.stopExportBtn.classList.toggle('is-hidden', !isActive);
        this.els.cancelExportBtn.classList.toggle('is-hidden', !isActive);
    }

    private resetExportUi() {
        const canExport = this.canExport();
        (this.els.playBtn as HTMLButtonElement).disabled = State.duration <= 0;
        (this.els.centerPlayBtn as HTMLButtonElement).disabled = State.duration <= 0;
        (this.els.seekBar as HTMLInputElement).disabled = State.duration <= 0;
        (this.els.upload as HTMLInputElement).disabled = false;
        (this.els.exportResolution as HTMLSelectElement).disabled = false;
        (this.els.exportAspect as HTMLSelectElement).disabled = false;
        (this.els.exportVideoBtn as HTMLButtonElement).disabled = !canExport;
        (this.els.exportVideoBtn as HTMLButtonElement).innerText = 'Export';
        (this.els.stopExportBtn as HTMLButtonElement).disabled = true;
        this.els.stopExportBtn.classList.add('is-hidden');
        (this.els.cancelExportBtn as HTMLButtonElement).disabled = true;
        this.els.cancelExportBtn.classList.add('is-hidden');
    }

    private downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    private setPlaybackUi(isPlaying: boolean) {
        this.els.playBtn.innerText = isPlaying ? "Pause" : "Play";
        this.els.centerPlayBtn.classList.toggle('is-playing', isPlaying);
        this.els.centerPlayBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }

    private syncLoopUi() {
        this.els.toggleLoop.classList.toggle('is-active', State.loopPlayback);
        this.els.toggleLoop.setAttribute('aria-pressed', State.loopPlayback ? 'true' : 'false');
        this.els.toggleLoop.innerText = State.loopPlayback ? 'Loop' : 'Once';
    }

    private createDashboardMetricTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'dashboard-metric-tooltip';
        tooltip.className = 'metric-tooltip is-hidden';
        tooltip.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltip);
        return tooltip;
    }

    private initDashboardMetricTooltips() {
        const getMetricCard = (target: EventTarget | null): HTMLElement | null => {
            const element = target instanceof Element ? target : null;
            const card = element?.closest('[data-metric-key]') as HTMLElement | null;
            return card && this.els.metricsGrid.contains(card) ? card : null;
        };

        this.els.metricsGrid.addEventListener('pointerover', (event) => {
            if (event.pointerType === 'touch') return;
            const card = getMetricCard(event.target);
            if (card) this.showMetricTooltip(card);
        });

        this.els.metricsGrid.addEventListener('pointerout', (event) => {
            if (!this.activeMetricCard) return;
            const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
            if (related && this.activeMetricCard.contains(related)) return;
            this.hideMetricTooltip();
        });

        this.els.metricsGrid.addEventListener('focusin', (event) => {
            const card = getMetricCard(event.target);
            if (card) this.showMetricTooltip(card);
        });

        this.els.metricsGrid.addEventListener('focusout', (event) => {
            const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
            if (related && this.els.metricsGrid.contains(related)) return;
            this.hideMetricTooltip();
        });

        this.els.metricsGrid.addEventListener('click', (event) => {
            const card = getMetricCard(event.target);
            if (!card) return;
            if (this.activeMetricCard === card && !this.metricTooltip.classList.contains('is-hidden')) {
                this.hideMetricTooltip();
            } else {
                this.showMetricTooltip(card);
            }
        });

        this.els.metricsGrid.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.hideMetricTooltip();
            }
        });

        document.addEventListener('pointerdown', (event) => {
            if (!this.activeMetricCard) return;
            const target = event.target instanceof Node ? event.target : null;
            if (target && (this.activeMetricCard.contains(target) || this.metricTooltip.contains(target))) return;
            this.hideMetricTooltip();
        });
    }

    private showMetricTooltip(card: HTMLElement) {
        const key = card.dataset.metricKey as DashboardMetricKey | undefined;
        if (!key) return;

        const metadata = dashboardMetricMetadata[key];
        if (!metadata) return;

        this.activeMetricCard = card;
        this.metricTooltip.textContent = metadata.tooltip;
        this.metricTooltip.classList.remove('is-hidden');
        this.positionMetricTooltip(card);
    }

    private positionMetricTooltip(card: HTMLElement) {
        const gap = 8;
        const rect = card.getBoundingClientRect();
        const tooltipRect = this.metricTooltip.getBoundingClientRect();
        const maxLeft = window.innerWidth - tooltipRect.width - gap;
        const left = Math.max(gap, Math.min(rect.left, maxLeft));
        const aboveTop = rect.top - tooltipRect.height - gap;
        const belowTop = rect.bottom + gap;
        const top = aboveTop >= gap
            ? aboveTop
            : Math.min(belowTop, window.innerHeight - tooltipRect.height - gap);

        this.metricTooltip.style.left = `${left}px`;
        this.metricTooltip.style.top = `${Math.max(gap, top)}px`;
    }

    private hideMetricTooltip() {
        this.activeMetricCard = null;
        this.metricTooltip.classList.add('is-hidden');
    }

    private initDramaturgyTimeline() {
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

        // JAVÍTVA: Robusztus leiratkozási biztosítékok a timeline elhagyásakor (ipari sztenderd)
        const clearTimelineHover = () => {
            this.setTimelineHover(null, null);
            this.hideTimelineTooltip();
        };
        canvas.addEventListener('pointerleave', clearTimelineHover);
        canvas.addEventListener('mouseleave', clearTimelineHover);
        window.addEventListener('blur', clearTimelineHover);
    }

    private toggleTimelineOverlay(wrapper: HTMLElement, zoomButton: HTMLButtonElement) {
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

    private startTimelineInteraction(focusX: number, focusY: number, button: number, shiftKey: boolean) {
        this.hideTimelineTooltip(); // JAVÍTVA: Azonnali elrejtés interakció kezdetekor
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

    private moveTimelineInteraction(focusX: number, focusY: number, deltaX: number) {
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

    private endTimelineInteraction() {
        if (this.draggingAutomationPoint || this.draggingSensitivityPoint || this.draggingFullZone || this.resizingMorphPoint) {
            this.draggingAutomationPoint = null;
            this.draggingSensitivityPoint = null;
            this.draggingFullZone = null;
            this.resizingMorphPoint = null;
            this.timelineDragShiftKey = false;
            State.editedPerformancePlan?.points.sort((a, b) => a.time - b.time);
            this.requestTimelineDraw();
        }

        if (State.isDrawingEnvelope) {
            State.isDrawingEnvelope = false;
        }
        if (this.isSeekingTimeline) {
            this.commitScrubTime();
        }

        this.isPanningTimeline = false;
        this.isSeekingTimeline = false;
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        canvas.classList.remove('is-panning');
        canvas.style.cursor = '';
        this.hideTimelineTooltip(); // JAVÍTVA: Elrejtés interakció után
    }

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
            if (distance <= closestDistance) {
                closestPoint = point;
                closestDistance = distance;
            }
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
            if (distance <= closestDistance) {
                closestPoint = point;
                closestDistance = distance;
            }
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

    private isAutomationLaneHit(focusY: number) {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.height < 80) return false;
        const { topPad, graphBottom } = this.getAutomationGraphMetrics(rect.height);
        const y = focusY * rect.height;
        return y >= topPad && y <= graphBottom;
    }

    private doubleClickTimeline(focusX: number, focusY: number) {
        if (this.isAutomationLaneHit(focusY)) {
            this.createAutomationPointAtTime(this.getTimelineTimeAtPercent(focusX));
        }
    }

    private createAutomationPointAtTime(time: number): PerformanceAutomationPoint | null {
        if (State.duration <= 0) return null;
        const plan = this.ensureEditedPerformancePlan();
        if (!plan) return null;

        const pointTime = this.clamp(time, 0, State.duration);

        // Refuse to create inside an existing zone — the cursor is inside a morph area.
        for (const existing of plan.points) {
            if (pointTime >= existing.time && pointTime < existing.time + existing.morphDurationSec) {
                return null;
            }
        }

        // Cap the morph duration so the new zone does not reach the next point.
        const defaultDuration = State.targetTuning.morphDurationSec;
        let allowedDuration = defaultDuration;
        for (const existing of plan.points) {
            if (existing.time > pointTime) {
                allowedDuration = Math.min(allowedDuration, existing.time - pointTime);
                break; // sorted after push+sort; pre-scan finds the next point
            }
        }
        // Also cap against all points in one pass (plan may not be sorted yet).
        for (const existing of plan.points) {
            if (existing.time > pointTime) {
                allowedDuration = Math.min(allowedDuration, existing.time - pointTime);
            }
        }
        allowedDuration = Math.max(0.1, allowedDuration);

        const sectionIdx = Math.max(0, State.trackAnalysis.sections.findIndex(section => pointTime >= section.start && pointTime <= section.end));
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

    private ensureEditedPerformancePlan() {
        const plan: PerformanceAutomationPlan = State.editedPerformancePlan
            ?? (State.performancePlan ? JSON.parse(JSON.stringify(State.performancePlan)) : { version: 1, source: 'edited', points: [] });
        plan.source = 'edited';
        State.editedPerformancePlan = plan;
        return plan;
    }

    private getSelectedAutomationPreset() {
        const brush = (this.els.timelinePresetBrush as HTMLSelectElement).value;
        const selected = brush || (this.els.presetList as HTMLSelectElement).value || State.availablePresets[0] || 'default.json';
        return selected;
    }

    private getNearestEditableAutomationPoint(time: number, toleranceSec: number): PerformanceAutomationPoint | null {
        const plan = this.ensureEditedPerformancePlan();
        let nearestPoint: PerformanceAutomationPoint | null = null;
        let nearestDistance = toleranceSec;
        for (const point of plan.points) {
            const distance = Math.abs(point.time - time);
            if (distance <= nearestDistance) {
                nearestPoint = point;
                nearestDistance = distance;
            }
        }
        return nearestPoint;
    }

    private getDefaultAutomationIntensity() {
        const sensitivity = State.visualTuning?.audioSensitivity;
        return this.clamp(Number.isFinite(sensitivity) ? sensitivity : 1.0, 0.1, 4.0);
    }

    private getAutomationIntensityAtPercent(focusY: number) {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const { topPad, graphHeight } = this.getAutomationGraphMetrics(rect.height);
        const y = focusY * rect.height;
        const normalized = this.clamp(1 - (y - topPad) / graphHeight, 0, 1);
        return 0.1 + normalized * 3.9;
    }

    private getAutomationGraphMetrics(height: number) {
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
        return shouldSnap ? this.snapTimeToNearestBar(time) : time;
    }

    private snapTimeToNearestBar(time: number): number {
        const bars = State.trackAnalysis.bars;
        if (!bars.length) return time;
        let closest = bars[0];
        let closestDistance = Math.abs(closest.start - time);
        for (const bar of bars) {
            const distance = Math.abs(bar.start - time);
            if (distance < closestDistance) {
                closest = bar;
                closestDistance = distance;
            }
        }
        return this.clamp(closest.start, 0, State.duration);
    }

    private selectEditableAutomationPoint(point: PerformanceAutomationPoint): PerformanceAutomationPoint {
        if (!State.editedPerformancePlan && State.performancePlan) {
            State.editedPerformancePlan = JSON.parse(JSON.stringify(State.performancePlan));
        }
        const editablePoint = State.editedPerformancePlan?.points.find(candidate => candidate.id === point.id);
        return editablePoint ?? point;
    }

    private showAutomationInspector(point: PerformanceAutomationPoint) {
        this.els.inspectorTime.innerText = this.formatTime(point.time);

        const presetSelect = this.els.inspectorPreset as HTMLSelectElement;
        const presetOptions = State.availablePresets.includes(point.preset)
            ? State.availablePresets
            : [point.preset, ...State.availablePresets];
        presetSelect.innerHTML = presetOptions.length
            ? presetOptions.map(fileName => `<option value="${this.escapeHtml(fileName)}">${this.escapeHtml(this.formatPresetName(fileName))}</option>`).join('')
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

    private hideAutomationInspector() {
        this.els.automationInspector.style.opacity = '0.35';
        this.els.automationInspector.style.pointerEvents = 'none';
        (this.els.inspectorPreset as HTMLSelectElement).disabled = true;
        (this.els.inspectorDuration as HTMLInputElement).disabled = true;
        (this.els.inspectorCurve as HTMLSelectElement).disabled = true;
        (this.els.inspectorDeleteBtn as HTMLButtonElement).disabled = true;
        (this.els.inspectorAddBtn as HTMLButtonElement).disabled = true;
        this.els.inspectorTime.innerText = '0:00';
    }

    private getTimelineXForTime(time: number, width: number) {
        const visibleDuration = this.getTimelineVisibleDuration();
        State.pan = this.clampTimelinePan(State.pan);
        return ((time - State.pan) / Math.max(0.001, visibleDuration)) * width;
    }

    private isMorphCurve(value: unknown): value is MorphCurve {
        return value === 'linear' || value === 'easeInOut' || value === 'exponential';
    }

    private hoverTimeline(focusX: number, focusY: number) {
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

        // JAVÍTVA: Elrejtjük a tooltipet, ha aktív csúszka-húzás, seekelés, átméretezés vagy panelés zajlik
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

        // JAVÍTVA: Tooltip adatok dinamikus összeállítása egerezéskor
        const hoverTime = this.getTimelineTimeAtPercent(focusX);
        const bars = State.trackAnalysis.bars;
        const bar = bars.find(b => hoverTime >= b.start && hoverTime <= b.end);
        const sections = State.trackAnalysis.sections;
        const section = sections.find(s => hoverTime >= s.start && hoverTime <= s.end);

        let content = `Idő: ${this.formatTime(hoverTime)} (Zoom: ${State.zoom.toFixed(1)}x)`;
        if (section) {
            content += `\nSzekció: ${section.label.toUpperCase()} (${section.dominantFeature})`;
        }
        if (bar) {
            content += `\nÜtem: #${bar.index + 1} [${bar.state}] | RMS: ${bar.avgRms.toFixed(2)}`;
            content += `\nBass: ${bar.bass.toFixed(2)} | Mid: ${bar.mid.toFixed(2)} | Treble: ${bar.treble.toFixed(2)}`;
        }

        const frameIdx = Math.floor(hoverTime * State.sampleRate / State.hopSize);
        const buildup = State.trackAnalysis.buildupConfidence[frameIdx] || 0;
        if (buildup > 0.01) {
            content += `\nBuildup: ${(buildup * 100).toFixed(0)}%`;
        }

        // Tooltip pozicionálása a kurzor mellé
        const rect = canvas.getBoundingClientRect();
        const tooltipX = rect.left + focusX * rect.width + 15;
        const tooltipY = rect.top + focusY * rect.height + 15;

        this.timelineTooltip.textContent = content;
        this.timelineTooltip.classList.remove('is-hidden');
        
        // viewport korlátok között tartás
        const tooltipRect = this.timelineTooltip.getBoundingClientRect();
        const left = Math.min(tooltipX, window.innerWidth - tooltipRect.width - 15);
        const top = Math.min(tooltipY, window.innerHeight - tooltipRect.height - 15);

        this.timelineTooltip.style.left = `${left}px`;
        this.timelineTooltip.style.top = `${top}px`;
    }

    private setScrubTime(time: number) {
        this.scrubTime = this.clamp(time, 0, State.duration);
        this.els.timeCur.innerText = this.formatTime(this.scrubTime);
        if (State.duration > 0) {
            (this.els.seekBar as HTMLInputElement).value = ((this.scrubTime / State.duration) * 100).toString();
        }
        this.requestTimelineDraw();
    }

    private commitScrubTime() {
        if (this.scrubTime === null) return;
        const targetTime = this.scrubTime;
        this.scrubTime = null;
        State.currentTime = targetTime;
        this.engine.seek(targetTime);
        this.requestTimelineDraw();
    }

    private zoomTimeline(delta: number, focusX: number) {
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

    private panTimeline(deltaX: number) {
        if (State.duration <= 0) return;
        const visibleDuration = this.getTimelineVisibleDuration();
        const deltaSeconds = deltaX * visibleDuration;
        State.pan = this.clampTimelinePan(State.pan - deltaSeconds);
        this.requestTimelineDraw();
    }

    private drawAutomationAtPointer(focusX: number, focusY: number) {
        if (State.duration <= 0) return;
        const MIN_DRAW_DISTANCE_SEC = 2.0;
        const hoverTime = this.getTimelineTimeAtPercent(focusX);
        const drawTarget = (this.els.timelineDrawTarget as HTMLSelectElement).value;
        const existingPoint = this.getNearestEditableAutomationPoint(hoverTime, MIN_DRAW_DISTANCE_SEC);
        const presetName = this.getSelectedAutomationPreset();

        if (existingPoint && !existingPoint.locked) {
            if (drawTarget === 'preset') {
                existingPoint.preset = presetName;
            } else {
                existingPoint.intensity = this.getAutomationIntensityAtPercent(focusY);
            }
            this.selectedAutomationPoint = existingPoint;
            this.showAutomationInspector(existingPoint);
            this.requestTimelineDraw();
            return;
        }

        if (drawTarget === 'preset') {
            this.createAutomationPointAtTime(hoverTime);
            return;
        }

        const point = this.createAutomationPointAtTime(hoverTime);
        if (!point || point.locked) return;
        point.intensity = this.getAutomationIntensityAtPercent(focusY);
        this.selectedAutomationPoint = point;
        this.showAutomationInspector(point);
        this.requestTimelineDraw();
    }

    private followTimelinePlayhead() {
        if (!State.followPlayhead || !State.isPlaying || State.duration <= 0 || State.zoom <= 1.05) return;
        const viewportStart = this.clampTimelinePan(State.pan);
        const visibleDuration = this.getTimelineVisibleDuration();
        const relativePosition = (State.currentTime - viewportStart) / Math.max(0.001, visibleDuration);
        if (relativePosition > 0.75 || relativePosition < 0.15) {
            State.pan = this.clampTimelinePan(State.currentTime - visibleDuration * 0.5);
        }
    }

    private resetTimelineView() {
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

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }

    /**
     * Clamps proposedTime so the moving point's zone [proposedTime, proposedTime + dur]
     * does not overlap any other point's zone. Handles snap and non-snap identically
     * because snapping is applied BEFORE this call (the raw snapped value is passed in).
     *
     * Edge cases handled:
     * - Proposed position inside an existing zone: pushed to the nearest clear side.
     * - Multiple zones on both sides: tightest constraint wins.
     * - Zone duration larger than the available gap: clamped to minStart (point can't fit).
     */
    private constrainPointTime(
        movingPoint: PerformanceAutomationPoint,
        proposedTime: number
    ): number {
        const plan = State.editedPerformancePlan ?? State.performancePlan;
        const dur = movingPoint.morphDurationSec;
        const totalDur = State.duration;
        if (!plan?.points.length) return this.clamp(proposedTime, 0, Math.max(0, totalDur - dur));

        const others = plan.points
            .filter(p => p.id !== movingPoint.id)
            .sort((a, b) => a.time - b.time);

        if (!others.length) return this.clamp(proposedTime, 0, Math.max(0, totalDur - dur));

        let minStart = 0;       // P.time must be >= minStart
        let maxEnd = totalDur;  // P.time + dur must be <= maxEnd

        for (const other of others) {
            const os = other.time;
            const oe = other.time + other.morphDurationSec;

            if (oe <= proposedTime) {
                // Other zone is fully to the left of proposed start.
                minStart = Math.max(minStart, oe);
            } else if (os >= proposedTime + dur) {
                // Other zone is fully to the right of proposed end.
                maxEnd = Math.min(maxEnd, os);
            } else {
                // Overlap: find the nearest clean exit.
                // Exit-left: place P just before other starts → P.end = os → P.start = os - dur
                // Exit-right: place P just after other ends → P.start = oe
                const distLeft = Math.abs(proposedTime - (os - dur));
                const distRight = Math.abs(proposedTime - oe);
                if (distLeft <= distRight) {
                    maxEnd = Math.min(maxEnd, os);
                } else {
                    minStart = Math.max(minStart, oe);
                }
            }
        }

        const lo = minStart;
        const hi = Math.max(lo, maxEnd - dur);
        return this.clamp(proposedTime, lo, hi);
    }

    /**
     * Caps proposedDuration so the resizing point's zone does not reach the next zone.
     */
    private constrainMorphDuration(
        point: PerformanceAutomationPoint,
        proposedDuration: number
    ): number {
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

    private getTimelineVisibleDuration() {
        if (State.duration <= 0) return 0;
        return State.duration / this.clamp(State.zoom, 1, 16);
    }

    private getTimelineTimeAtPercent(percent: number) {
        const visibleDuration = this.getTimelineVisibleDuration();
        State.pan = this.clampTimelinePan(State.pan);
        return this.clamp(State.pan + this.clamp(percent, 0, 1) * visibleDuration, 0, State.duration);
    }

    private clampTimelinePan(offset: number) {
        if (State.duration <= 0) return 0;
        const visibleDuration = this.getTimelineVisibleDuration();
        return this.clamp(offset, 0, Math.max(0, State.duration - visibleDuration));
    }

    private getTimelineHeight(wrapper: HTMLElement) {
        return wrapper.getBoundingClientRect().height || 28;
    }

    private clampTimelineHeight(height: number) {
        return Math.min(400, Math.max(24, height));
    }

    private setTimelineHeight(wrapper: HTMLElement, height: number, animate: boolean) {
        const nextHeight = this.clampTimelineHeight(height);
        wrapper.classList.toggle('is-expanded', nextHeight > 40);
        wrapper.style.height = `${nextHeight}px`;
        wrapper.classList.toggle('is-resizing', !animate && this.isResizingTimeline);
        this.timelineCanvas.resize();
        this.requestTimelineDraw();
    }

    private requestTimelineDraw() {
        if (this.timelineResizeFrame !== null) return;
        this.timelineResizeFrame = window.requestAnimationFrame(() => {
            this.timelineResizeFrame = null;
            this.drawDramaturgyTimeline();
        });
    }

    private requestDashboardTimelineDraw() {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (!this.shouldDrawTimelineForDashboard(rect)) return;
        this.rememberTimelineDrawState(rect);
        this.requestTimelineDraw();
    }

    private shouldDrawTimelineForDashboard(rect: DOMRect) {
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (State.duration <= 0) return this.lastTimelineDrawWidth !== rect.width || this.lastTimelineDrawHeight !== rect.height;
        if (this.lastTimelineAnalysisRef !== State.trackAnalysis) return true;
        if (this.lastTimelineDrawWidth !== rect.width || this.lastTimelineDrawHeight !== rect.height) return true;
        if (this.lastTimelineDrawZoom !== State.zoom || this.lastTimelineDrawScroll !== State.pan) return true;
        if (this.lastTimelineDrawScrubTime !== this.scrubTime) return true;

        const visibleSecondsPerPixel = this.getTimelineVisibleDuration() / Math.max(1, rect.width);
        return Math.abs(State.currentTime - this.lastTimelineDrawTime) >= visibleSecondsPerPixel;
    }

    private rememberTimelineDrawState(rect: DOMRect) {
        this.lastTimelineAnalysisRef = State.trackAnalysis;
        this.lastTimelineDrawTime = State.currentTime;
        this.lastTimelineDrawWidth = rect.width;
        this.lastTimelineDrawHeight = rect.height;
        this.lastTimelineDrawZoom = State.zoom;
        this.lastTimelineDrawScroll = State.pan;
        this.lastTimelineDrawScrubTime = this.scrubTime;
    }

    private animateTimelineResize() {
        let frames = 0;
        const redraw = () => {
            this.drawDramaturgyTimeline();
            frames++;
            if (frames < 20) window.requestAnimationFrame(redraw);
        };
        window.requestAnimationFrame(redraw);
    }

    private drawDramaturgyTimeline() {
        this.followTimelinePlayhead();
        this.timelineCanvas.render(this.getRenderState());
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        this.rememberTimelineDrawState(canvas.getBoundingClientRect());
    }

    private clearDramaturgyTimeline() {
        this.timelineCanvas.render({ ...this.getRenderState(), duration: 0, currentTime: 0, scrubTime: null });
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
            performancePlan: State.editedPerformancePlan ?? State.performancePlan,
            timelineLayers: State.timelineLayers,
            snapToGrid: State.snapToGrid,
            selectedPointId: this.selectedAutomationPoint?.id || null,
            followPlayhead: State.followPlayhead,
            hoveredPointId: this.hoveredPoint?.id || null,
            hoveredHandleType: this.hoveredHandleType,
            audioSensitivity: State.visualTuning.audioSensitivity,
            dropAnticipation: State.visualTuning.dropAnticipation,
            scrubTime: this.scrubTime
        };
    }

    destroy() {
        this.gestureEngine.destroy();
        this.timelineResizeObserver?.disconnect();
        if (this.timelineResizeFrame !== null) {
            window.cancelAnimationFrame(this.timelineResizeFrame);
            this.timelineResizeFrame = null;
        }
        this.clearChromeHideTimer();
    }
    private applyPresentationModeFromUrl() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('presentation') !== 'true') return;

        State.uiVisible = false;
        document.body.classList.add('presentation-mode', 'chrome-idle');
        this.els.toggleMetrics.setAttribute('aria-expanded', 'false');
        this.els.metricsGrid.classList.add('is-hidden');
        this.setTuningPanelOpen(false);
    }

    private seekRelative(deltaSeconds: number) {
        if (State.duration <= 0) return;
        this.engine.seek(State.currentTime + deltaSeconds);
        this.updateDashboard();
    }

    private initTuningPanelDrag() {
        this.els.tuningDragHandle.addEventListener('pointerdown', (event) => {
            const target = event.target as HTMLElement;
            if (target.closest('button, input, select, textarea, label')) return;

            const panel = this.els.tuningPanel;
            const rect = panel.getBoundingClientRect();
            this.tuningDragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            panel.classList.add('is-dragging');
            panel.style.position = 'fixed';
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.marginTop = '0';
            this.els.tuningDragHandle.setPointerCapture(event.pointerId);
        });

        this.els.tuningDragHandle.addEventListener('pointermove', (event) => {
            if (!this.els.tuningPanel.classList.contains('is-dragging')) return;
            const panel = this.els.tuningPanel;
            const rect = panel.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            const left = Math.min(Math.max(0, event.clientX - this.tuningDragOffset.x), maxLeft);
            const top = Math.min(Math.max(0, event.clientY - this.tuningDragOffset.y), maxTop);
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        });

        const endDrag = (event: PointerEvent) => {
            if (!this.els.tuningPanel.classList.contains('is-dragging')) return;
            this.els.tuningPanel.classList.remove('is-dragging');
            if (this.els.tuningDragHandle.hasPointerCapture(event.pointerId)) {
                this.els.tuningDragHandle.releasePointerCapture(event.pointerId);
            }
        };
        this.els.tuningDragHandle.addEventListener('pointerup', endDrag);
        this.els.tuningDragHandle.addEventListener('pointercancel', endDrag);
    }

    private initChromeAutoHide() {
        const interactiveChrome = [this.els.tuningPanel, this.els.metricsGrid, this.els.toggleMetrics, this.els.seekBar, this.els.dramaturgyTimeline];
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

    private revealChromeTemporarily() {
        if (!State.uiVisible) return;
        document.body.classList.remove('chrome-idle');
        this.scheduleChromeHide();
    }

    private scheduleChromeHide(delay = 2600) {
        this.clearChromeHideTimer();
        
        // Do not start an idle timer while the UI is locked visible.
        if (this.isUiLockedVisible) {
            return;
        }

        this.chromeHideTimer = window.setTimeout(() => {
            if (this.isChromeHovered()) {
                this.scheduleChromeHide(2600);
                return;
            }
            document.body.classList.add('chrome-idle');
        }, delay);
    }

    private clearChromeHideTimer() {
        if (this.chromeHideTimer !== null) {
            window.clearTimeout(this.chromeHideTimer);
            this.chromeHideTimer = null;
        }
    }

    private isChromeHovered() {
        return [
            '.top-row:hover',
            '.tuning-panel:hover',
            '.bottom-section:hover',
            '.center-play-btn:hover'
        ].some(selector => Boolean(document.querySelector(selector)));
    }

    private initVisualTuningControls() {
        const container = this.els.tuningControls;
        container.innerHTML = "";
        const groups = new Map<string, HTMLElement>();

        for (const control of visualTuningControls) {
            let group = groups.get(control.group);
            if (!group) {
                group = document.createElement('section');
                group.className = 'tuning-group';
                group.innerHTML = `<h2>${control.group}</h2>`;
                groups.set(control.group, group);
                container.appendChild(group);
            }

            const row = document.createElement('label');
            row.className = 'tuning-control';
            const valueId = `visual-tuning-value-${control.key}`;
            const value = State.targetTuning[control.key];
            const controlMarkup = control.options
                ? `
                <select data-tuning-key="${control.key}" aria-label="${control.label}">
                    ${control.options.map(option => `<option value="${option.value}"${option.value === value ? ' selected' : ''}>${this.escapeHtml(option.label)}</option>`).join('')}
                </select>
                `
                : `
                <input
                    type="range"
                    min="${control.min}"
                    max="${control.max}"
                    step="${control.step}"
                    value="${value}"
                    data-tuning-key="${control.key}"
                    aria-label="${control.label}"
                >
                `;
            row.innerHTML = `
                <span class="tuning-label">${control.label}</span>
                ${controlMarkup}
                <output id="${valueId}" class="tuning-value">${this.formatControlValue(value, control)}</output>
            `;
            group.appendChild(row);
        }

        const updateTuningValue = (event: Event) => {
            const input = event.target as HTMLInputElement | HTMLSelectElement;
            const key = input.dataset.tuningKey as VisualTuningKey | undefined;
            if (!key) return;

            const value = Number(input.value);
            State.targetTuning[key] = value;
            const control = visualTuningControls.find(item => item.key === key);
            const output = document.getElementById(`visual-tuning-value-${key}`);
            if (output && control) output.textContent = this.formatControlValue(value, control);
        };
        container.addEventListener('input', updateTuningValue);
        container.addEventListener('change', updateTuningValue);

        this.els.copyVisualConfig.addEventListener('click', () => {
            this.copyVisualConfig();
        });

        const loadSelectedPreset = () => {
            const fileName = (this.els.presetList as HTMLSelectElement).value;
            if (fileName) void this.loadVisualPreset(fileName);
        };
        this.els.presetList.addEventListener('input', loadSelectedPreset);
        this.els.presetList.addEventListener('change', loadSelectedPreset);
    }

    private async loadVisualPresetList() {
        const select = this.els.presetList as HTMLSelectElement;

        try {
            const response = await fetch(this.presetUrl('index.json'), { cache: 'no-store' });
            if (!response.ok) throw new Error(`Preset manifest ${response.status}`);

            const manifest = await response.json() as VisualPresetManifest;
            const presets = (manifest.presets || [])
                .filter(fileName => /^[\w .-]+\.json$/i.test(fileName))
                .filter(fileName => fileName.toLowerCase() !== 'index.json');
            State.availablePresets = presets;

            select.innerHTML = presets.length
                ? presets.map(fileName => `<option value="${this.escapeHtml(fileName)}">${this.escapeHtml(this.formatPresetName(fileName))}</option>`).join('')
                : `<option value="">No presets</option>`;
            this.els.timelinePresetBrush.innerHTML = select.innerHTML;
            const defaultPreset = presets.find(fileName => fileName.toLowerCase() === 'default.json');
            if (defaultPreset) {
                select.value = defaultPreset;
                (this.els.timelinePresetBrush as HTMLSelectElement).value = defaultPreset;
            }
            select.disabled = presets.length === 0;
            (this.els.timelinePresetBrush as HTMLSelectElement).disabled = presets.length === 0;
        } catch {
            select.innerHTML = `<option value="">No preset index</option>`;
            this.els.timelinePresetBrush.innerHTML = `<option value="">No preset index</option>`;
            select.disabled = true;
            (this.els.timelinePresetBrush as HTMLSelectElement).disabled = true;
        }
    }

    private async loadVisualPreset(fileName: string) {
        try {
            let presetData = this.presetCache.get(fileName);
            
            // Ha mĂ©g nincs a memĂłriĂˇban, letĂ¶ltjĂĽk egyszer, majd elmentjĂĽk
            if (!presetData) {
                const response = await fetch(this.presetUrl(fileName), { cache: 'no-store' });
                if (!response.ok) throw new Error(`Preset ${response.status}`);
                presetData = await response.json();
                this.presetCache.set(fileName, presetData);
            }

            this.applyPerformancePreset(presetData);
            this.syncVisualTuningControls();
        } catch {
            this.els.copyConfigStatus.innerText = `Could not load ${fileName}`;
            window.setTimeout(() => {
                this.els.copyConfigStatus.innerText = "";
            }, 1800);
        }
    }

    private async preloadPresetsForPlan(plan: PerformanceAutomationPlan | null): Promise<void> {
        if (!plan?.points.length) return;
        const uniquePresets = [...new Set(plan.points.map(p => p.preset))];

        await Promise.all(uniquePresets.map(async (preset) => {
            if (this.presetCache.has(preset)) return;
            try {
                const response = await fetch(this.presetUrl(preset), { cache: 'no-store' });
                if (!response.ok) throw new Error(`Preset ${response.status}`);
                const payload = await response.json();
                this.presetCache.set(preset, payload);
            } catch {
                // Preloading is opportunistic; loadVisualPreset still handles runtime failures.
            }
        }));
    }

    private presetUrl(fileName: string) {
        return `${import.meta.env.BASE_URL}visual-tuning-presets/${encodeURIComponent(fileName)}`;
    }

    private applyPerformancePreset(payload: unknown) {
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
            const profile = preset.dramaturgyProfile;
            if (typeof profile.buildupIntensity === 'number') State.targetTuning.buildupIntensity = profile.buildupIntensity;
            if (typeof profile.dropDampening === 'number') State.targetTuning.dropDampening = profile.dropDampening;
            if (typeof profile.breakRestraint === 'number') State.targetTuning.breakRestraint = profile.breakRestraint;
            if (typeof profile.vocalHighlight === 'number') State.targetTuning.vocalHighlight = profile.vocalHighlight;
            if (typeof profile.fxChaos === 'number') State.targetTuning.fxChaos = profile.fxChaos;
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
                && (candidate.locked === undefined || typeof candidate.locked === 'boolean');
        });
    }

    private isPerformanceAutomationReason(value: unknown): value is PerformanceAutomationPoint['reason'] {
        return value === 'intro'
            || value === 'build'
            || value === 'drop'
            || value === 'break'
            || value === 'peak'
            || value === 'harmonicShift'
            || value === 'manual';
    }

    private syncVisualTuningControls() {
        for (const control of visualTuningControls) {
            const value = State.targetTuning[control.key];
            const input = this.els.tuningControls.querySelector<HTMLInputElement>(`input[data-tuning-key="${control.key}"]`);
            const select = this.els.tuningControls.querySelector<HTMLSelectElement>(`select[data-tuning-key="${control.key}"]`);
            const output = document.getElementById(`visual-tuning-value-${control.key}`);
            if (input) input.value = value.toString();
            if (select) select.value = value.toString();
            if (output) output.textContent = this.formatControlValue(value, control);
        }
    }

    private escapeHtml(value: string) {
        return value.replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char] || char);
    }

    private formatPresetName(fileName: string) {
        return fileName.replace(/\.json$/i, '');
    }

    private formatTuningValue(value: number, unit?: string) {
        const decimals = value >= 10 || Number.isInteger(value) ? 0 : 2;
        return `${value.toFixed(decimals)}${unit || ""}`;
    }

    private formatControlValue(value: number, control: { unit?: string; options?: Array<{ value: number; label: string }> }) {
        const option = control.options?.find(item => item.value === value);
        return option ? option.label : this.formatTuningValue(value, control.unit);
    }

    private async copyVisualConfig() {
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
            this.els.copyConfigStatus.innerText = "Copied";
        } catch {
            this.copyTextFallback(payload);
            this.els.copyConfigStatus.innerText = "Copied";
        }

        window.setTimeout(() => {
            this.els.copyConfigStatus.innerText = "";
        }, 1600);
    }

    private getMorphCurveName(value: number) {
        const curve = Math.round(Number.isFinite(value) ? value : 1);
        if (curve <= 0) return 'linear';
        if (curve >= 2) return 'exponential';
        return 'easeInOut';
    }

    private copyTextFallback(value: string) {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.setAttribute('readonly', 'true');
        textArea.className = 'copy-fallback-input';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
    }

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
        State.targetTuning.morphCurveValue = activePoint.morphCurve === 'linear'
            ? 0
            : activePoint.morphCurve === 'exponential'
                ? 2
                : 1;
        void this.loadVisualPreset(activePoint.preset);
    }

    updateDashboard() {
        this.triggerPerformanceAutomation();

        if (!this.isDraggingSlider && this.scrubTime === null) {
            const progress = State.duration > 0 ? (State.currentTime / State.duration) * 100 : 0;
            (this.els.seekBar as HTMLInputElement).value = progress.toString();
            this.els.timeCur.innerText = this.formatTime(State.currentTime);
        }

        this.els.valE.innerText = State.currentFrame.e.toFixed(2); this.els.barE.style.width = (State.currentFrame.e * 100) + "%";
        this.els.valB.innerText = State.currentFrame.b.toFixed(2); this.els.barB.style.width = (State.currentFrame.b * 100) + "%";
        this.els.valM.innerText = State.currentFrame.m.toFixed(2); this.els.barM.style.width = (State.currentFrame.m * 100) + "%";
        this.els.valVocal.innerText = State.currentFeatures.vocal.toFixed(2); this.els.barVocal.style.width = (State.currentFeatures.vocal * 100) + "%";
        this.els.valFx.innerText = State.currentFeatures.fx.toFixed(2); this.els.barFx.style.width = (State.currentFeatures.fx * 100) + "%";
        this.els.valBeat.innerText = State.beatDecay.toFixed(2); this.els.barBeat.style.width = (State.beatDecay * 100) + "%";

        let dynText = "IDLE";
        if (State.isPlaying) {
            if (State.currentFrame.state === 'HIGH') dynText = "HIGH";
            else if (State.currentFrame.state === 'LOW') dynText = "LOW";
            else if (State.currentFrame.state === 'LOW_DROP') dynText = "LOW [DROP]";
            else if (State.currentFrame.state === 'LOW_OVERLOAD') dynText = "LOW [OVERLOAD]";
        }

        this.els.valDyn.innerText = dynText;
        this.els.barDyn.style.width = (State.currentFrame.eRatio * 100) + "%";

        if (State.bpm > 0) {
            this.els.bpmHeaderBadge.innerText = State.bpm + " BPM";
            this.els.bpmHeaderBadge.style.display = "inline-flex";
        } else {
            this.els.bpmHeaderBadge.style.display = "none";
        }

        this.requestDashboardTimelineDraw();
    }
}

function isVisualMode(value: string): value is VisualMode {
    return value === 'classic' ||
        value === 'temporal' ||
        value === 'dark-techno' ||
        value === 'organic-ambient' ||
        value === 'cyberpunk';
}
