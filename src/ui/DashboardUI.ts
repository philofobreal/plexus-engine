import type { AudioEngine } from '../audio/AudioEngine';
import { normalizeVisualTuningConfig, visualTuningControls, type VisualTuningKey } from '../config/visualTuning';
import { State } from '../state/store';
import type { RenderState } from '../types';
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
    private isDraggingThreshold = false;
    private draggingSectionIdx: number | null = null;
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
    private lastTriggeredSectionIdx = -1;
    private metricTooltip: HTMLDivElement;
    private activeMetricCard: HTMLElement | null = null;
    private tuningDragOffset = { x: 0, y: 0 };
    private els: Record<string, HTMLElement>;
    private engine: AudioEngine;
    private timelineCanvas!: TimelineCanvas;
    private gestureEngine!: GestureEngine;
    private timelineResizeObserver: ResizeObserver | null = null;

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
            toggleTimelineZoom: document.getElementById('toggle-timeline-zoom')!,
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
            this.lastTriggeredSectionIdx = -1;
            this.triggerSectionPresetAutomation();
        });

        this.engine.onAnalysisError = (message) => {
            this.els.status.innerText = "Hiba: " + message;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            (this.els.centerPlayBtn as HTMLButtonElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).disabled = true;
            (this.els.upload as HTMLInputElement).disabled = false;
            this.clearDramaturgyTimeline();
        };

        this.initBindings();
        this.initVisualTuningControls();
        this.metricTooltip = this.createDashboardMetricTooltip();
        this.timelineTooltip = this.createTimelineTooltip(); // JAVÍTVA: Timeline tooltip példányosítása
        this.initDashboardMetricTooltips();
        this.initDramaturgyTimeline();
        this.syncLoopUi();
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
                (this.els.upload as HTMLInputElement).disabled = false;
                this.els.timeTot.innerText = this.formatTime(State.duration);
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

        (this.els.visualMode as HTMLSelectElement).addEventListener('change', (e) => {
            const mode = (e.target as HTMLSelectElement).value;
            State.visualMode = mode === 'temporal' ? 'temporal' : 'classic';
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
            if (event.code !== 'KeyD' || this.isEditableEventTarget(event.target)) return;
            event.preventDefault();
            this.setTimelineDrawMode(!State.drawModeActive);
        });

        this.els.timelineDrawTarget.addEventListener('change', () => {
            this.syncTimelineDrawControls();
        });

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
        drawTarget.classList.toggle('is-hidden', !State.drawModeActive);
        presetBrush.classList.toggle('is-hidden', !State.drawModeActive || !isPresetBrush);
        this.els.toggleTimelineDraw.title = isPresetBrush ? 'Draw Preset Automation (D)' : 'Draw Sensitivity Envelope (D)';
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
            onDoubleClick: (focusX) => this.splitTimelineAtPercent(focusX)
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
        canvas.addEventListener('pointerleave', () => this.hideTimelineTooltip());
        canvas.addEventListener('mouseleave', () => this.hideTimelineTooltip());
        window.addEventListener('blur', () => this.hideTimelineTooltip());
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
            this.isDraggingThreshold = false;
            this.draggingSectionIdx = null;
            canvas.style.cursor = '';
            this.drawAutomationAtPointer(focusX, focusY);
            return true;
        }

        const thresholdHit = this.getTimelineThresholdHit(focusX, focusY, 12);
        if (button === 0 && thresholdHit) {
            this.draggingSectionIdx = thresholdHit.sectionIdx;
            this.isDraggingThreshold = true;
            this.isSeekingTimeline = false;
            this.isPanningTimeline = false;
            canvas.style.cursor = 'row-resize';
            return true;
        }

        if (button === 1 || shiftKey) {
            this.isPanningTimeline = true;
            this.isSeekingTimeline = false;
            this.isDraggingThreshold = false;
            canvas.classList.add('is-panning');
            return true;
        }

        if (button === 0) {
            this.isSeekingTimeline = true;
            this.isPanningTimeline = false;
            this.isDraggingThreshold = false;
            this.setScrubTime(this.getTimelineTimeAtPercent(focusX));
            return true;
        }

        return false;
    }

    private handleGestureEngineHover(focusX: number, focusY: number) {
        this.hoverTimeline(focusX, focusY);
    }

    private moveTimelineInteraction(focusX: number, focusY: number, deltaX: number) {
        if (State.isDrawingEnvelope) {
            this.drawAutomationAtPointer(focusX, focusY);
            return;
        }

        if (this.isDraggingThreshold && this.draggingSectionIdx !== null) {
            const metrics = this.getTimelineGraphMetrics();
            if (!metrics) return;
            const mouseY = focusY * metrics.rect.height;
            const normVal = this.clamp(1 - (mouseY - metrics.topPad) / metrics.graphHeight, 0.0, 1.0);
            const sensVal = 0.1 + normVal * 3.9;
            const key = `section-${this.draggingSectionIdx}`;
            if (!State.sectionOverrides[key]) {
                State.sectionOverrides[key] = { sensitivity: sensVal };
            } else {
                State.sectionOverrides[key].sensitivity = sensVal;
            }
            this.requestTimelineDraw();
            return;
        }

        if (this.isPanningTimeline) {
            this.panTimeline(deltaX);
            return;
        }

        if (this.isSeekingTimeline) {
            this.setScrubTime(this.getTimelineTimeAtPercent(focusX));
        }
    }

    private endTimelineInteraction() {
        if (State.isDrawingEnvelope) {
            State.isDrawingEnvelope = false;
        }
        if (this.isSeekingTimeline) {
            this.commitScrubTime();
        }

        this.isDraggingThreshold = false;
        this.draggingSectionIdx = null;
        this.isPanningTimeline = false;
        this.isSeekingTimeline = false;
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        canvas.classList.remove('is-panning');
        canvas.style.cursor = '';
        this.hideTimelineTooltip(); // JAVÍTVA: Elrejtés interakció után
    }

    private hoverTimeline(focusX: number, focusY: number) {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        if (State.duration <= 0) {
            canvas.style.cursor = '';
            this.hideTimelineTooltip();
            return;
        }

        if (State.drawModeActive) {
            canvas.style.cursor = 'cell';
            this.hideTimelineTooltip();
            return;
        }

        // JAVÍTVA: Elrejtjük a tooltipet, ha aktív csúszka-húzás, seekelés, átméretezés vagy panelés zajlik
        if (this.isSeekingTimeline || this.isDraggingThreshold || this.isPanningTimeline || this.isResizingTimeline) {
            this.hideTimelineTooltip();
            return;
        }

        canvas.style.cursor = this.getTimelineThresholdHit(focusX, focusY, 12) ? 'row-resize' : '';

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

    private splitTimelineAtPercent(timePercent: number) {
        if (State.duration <= 0) return;
        const hoverTime = this.getTimelineTimeAtPercent(timePercent);
        const sections = State.trackAnalysis.sections;
        const sectionIdx = sections.findIndex(section => hoverTime >= section.start && hoverTime <= section.end);
        if (sectionIdx === -1) return;

        const section = sections[sectionIdx];
        const splitTime = this.clamp(hoverTime, section.start + 0.1, section.end - 0.1);
        if (splitTime <= section.start || splitTime >= section.end) return;

        this.splitTimelineSection(sectionIdx, splitTime, hoverTime);
        this.requestTimelineDraw();
    }

    private drawAutomationAtPointer(focusX: number, focusY: number) {
        if (State.duration <= 0) return;
        const hoverTime = this.getTimelineTimeAtPercent(focusX);
        const sections = State.trackAnalysis.sections;
        let sectionIdx = sections.findIndex(section => hoverTime >= section.start && hoverTime <= section.end);
        if (sectionIdx === -1) return;

        const section = sections[sectionIdx];
        const secondsPerBar = State.bpm > 0 ? (60 / State.bpm) * 4 : 0;
        if (secondsPerBar > 0 && section.end - section.start > secondsPerBar) {
            const splitTime = this.getNearestBarSplitTime(hoverTime, section.start, section.end, secondsPerBar);
            if (splitTime !== null) {
                sectionIdx = this.splitTimelineSection(sectionIdx, splitTime, hoverTime);
            }
        }

        const drawTarget = (this.els.timelineDrawTarget as HTMLSelectElement).value;
        if (drawTarget === 'preset') {
            const presetName = (this.els.timelinePresetBrush as HTMLSelectElement).value;
            if (presetName) this.setSectionPresetOverride(sectionIdx, presetName);
        } else {
            const metrics = this.getTimelineGraphMetrics();
            if (!metrics) return;
            const mouseY = focusY * metrics.rect.height;
            const normVal = this.clamp(1 - (mouseY - metrics.topPad) / metrics.graphHeight, 0.0, 1.0);
            const sensVal = 0.1 + normVal * 3.9;
            this.setSectionSensitivityOverride(sectionIdx, sensVal);
        }
        this.requestTimelineDraw();
    }

    private getNearestBarSplitTime(time: number, sectionStart: number, sectionEnd: number, secondsPerBar: number) {
        if (!Number.isFinite(secondsPerBar) || secondsPerBar <= 0) return null;
        const splitTime = Math.round(time / secondsPerBar) * secondsPerBar;
        const minGap = Math.min(0.1, secondsPerBar * 0.05);
        if (splitTime <= sectionStart + minGap || splitTime >= sectionEnd - minGap) return null;
        return this.clamp(splitTime, sectionStart, sectionEnd);
    }

    private splitTimelineSection(sectionIdx: number, splitTime: number, focusTime: number) {
        const sections = State.trackAnalysis.sections;
        const section = sections[sectionIdx];
        if (!section) return sectionIdx;
        if (splitTime <= section.start || splitTime >= section.end) return sectionIdx;

        const oldKey = `section-${sectionIdx}`;
        const oldOverride = State.sectionOverrides[oldKey];
        const sensitivity = oldOverride ? oldOverride.sensitivity : State.visualTuning.audioSensitivity;
        const first = { ...section, end: splitTime };
        const second = { ...section, start: splitTime };
        sections.splice(sectionIdx, 1, first, second);

        const nextOverrides: typeof State.sectionOverrides = {};
        for (const [key, value] of Object.entries(State.sectionOverrides)) {
            const match = key.match(/^section-(\d+)$/);
            if (!match) continue;
            const idx = parseInt(match[1], 10);
            if (idx < sectionIdx) nextOverrides[key] = value;
            else if (idx > sectionIdx) nextOverrides[`section-${idx + 1}`] = value;
        }

        nextOverrides[`section-${sectionIdx}`] = { sensitivity, preset: oldOverride?.preset };
        nextOverrides[`section-${sectionIdx + 1}`] = { sensitivity, preset: oldOverride?.preset };
        State.sectionOverrides = nextOverrides;
        return focusTime >= splitTime ? sectionIdx + 1 : sectionIdx;
    }

    private setSectionSensitivityOverride(sectionIdx: number, sensitivity: number) {
        const key = `section-${sectionIdx}`;
        if (!State.sectionOverrides[key]) {
            State.sectionOverrides[key] = { sensitivity };
        } else {
            State.sectionOverrides[key].sensitivity = sensitivity;
        }
    }

    private setSectionPresetOverride(sectionIdx: number, preset: string) {
        const key = `section-${sectionIdx}`;
        if (!State.sectionOverrides[key]) {
            State.sectionOverrides[key] = { sensitivity: State.visualTuning.audioSensitivity, preset };
        } else {
            State.sectionOverrides[key].preset = preset;
        }
    }

    private getTimelineThresholdHit(focusX: number, focusY: number, tolerancePx: number) {
        const metrics = this.getTimelineGraphMetrics();
        if (!metrics) return null;

        const hoverTime = this.getTimelineTimeAtPercent(focusX);
        const sectionIdx = State.trackAnalysis.sections.findIndex(section => hoverTime >= section.start && hoverTime <= section.end);
        if (sectionIdx === -1) return null;

        const override = State.sectionOverrides[`section-${sectionIdx}`] || { sensitivity: State.visualTuning.audioSensitivity };
        const normVal = this.clamp((override.sensitivity - 0.1) / 3.9, 0.0, 1.0);
        const yThreshold = metrics.topPad + metrics.graphHeight * (1 - normVal);
        const mouseY = focusY * metrics.rect.height;
        return Math.abs(mouseY - yThreshold) <= tolerancePx ? { sectionIdx, yThreshold } : null;
    }

    private getTimelineGraphMetrics() {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;

        const topPad = rect.height >= 52 ? 18 : 4;
        const bottomPad = 5;
        const graphHeight = Math.max(8, rect.height - topPad - bottomPad);
        return { rect, topPad, graphHeight };
    }

    private followTimelinePlayhead() {
        if (!State.isPlaying || State.duration <= 0 || State.zoom <= 1.05) return;
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
        this.scrubTime = null;
        this.lastTriggeredSectionIdx = -1;
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
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
            sectionOverrides: State.sectionOverrides,
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

    private presetUrl(fileName: string) {
        return `${import.meta.env.BASE_URL}visual-tuning-presets/${encodeURIComponent(fileName)}`;
    }

    private applyPerformancePreset(payload: unknown) {
        Object.assign(State.targetTuning, normalizeVisualTuningConfig(payload, State.targetTuning));
        if (!payload || typeof payload !== 'object') return;

        const preset = payload as {
            visualMode?: unknown;
            morphProfile?: { durationSec?: unknown; curve?: unknown };
            dramaturgyProfile?: {
                buildupIntensity?: unknown;
                dropDampening?: unknown;
                breakRestraint?: unknown;
                vocalHighlight?: unknown;
                fxChaos?: unknown;
            };
        };
        if (preset.visualMode === 'classic' || preset.visualMode === 'temporal') {
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
            }
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

    private triggerSectionPresetAutomation() {
        if (State.duration <= 0) return;
        const sections = State.trackAnalysis.sections;
        const sectionIdx = sections.findIndex(section => State.currentTime >= section.start && State.currentTime < section.end);
        if (sectionIdx === this.lastTriggeredSectionIdx) return;

        this.lastTriggeredSectionIdx = sectionIdx;
        if (sectionIdx === -1) return;

        const override = State.sectionOverrides[`section-${sectionIdx}`];
        if (override?.preset) void this.loadVisualPreset(override.preset);
    }

    updateDashboard() {
        this.triggerSectionPresetAutomation();

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