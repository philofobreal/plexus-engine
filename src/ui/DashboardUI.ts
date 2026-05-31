import type { AudioEngine } from '../audio/AudioEngine';
import { normalizeVisualTuningConfig, visualTuningControls, type VisualTuningKey } from '../config/visualTuning';
import { State } from '../state/store';
import { dashboardMetricMetadata, type DashboardMetricKey } from './metricMetadata';

interface VisualPresetManifest {
    presets?: string[];
}

interface TimelineViewport {
    start: number;
    end: number;
    duration: number;
}

export class DashboardUI {
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
    private timelineZoomLevel = 1;
    private timelineScrollOffsetTime = 0;
    private timelinePanStartX = 0;
    private timelinePanStartOffset = 0;
    private timelinePointerDownX = 0;
    private timelinePointerDownY = 0;
    private timelineDidDrag = false;
    private timelineTooltip: HTMLDivElement;
    private scrubTime: number | null = null;
    private lastTimelineAnalysisRef: unknown = null;
    private lastTimelineDrawTime = -Infinity;
    private lastTimelineDrawWidth = 0;
    private lastTimelineDrawHeight = 0;
    private lastTimelineDrawZoom = 1;
    private lastTimelineDrawScroll = 0;
    private lastTimelineDrawScrubTime: number | null = null;
    private metricTooltip: HTMLDivElement;
    private activeMetricCard: HTMLElement | null = null;
    private tuningDragOffset = { x: 0, y: 0 };
    private els: Record<string, HTMLElement>;
    private engine: AudioEngine;

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
            toggleTimelineZoom: document.getElementById('toggle-timeline-zoom')!,
            seekBar: document.getElementById('seek-bar')!,
            bpmBadge: document.getElementById('bpm-badge')!,
            timeCur: document.getElementById('time-current')!,
            timeTot: document.getElementById('time-total')!,
            valE: document.getElementById('val-energy')!,
            barE: document.getElementById('bar-energy')!,
            valB: document.getElementById('val-bass')!,
            barB: document.getElementById('bar-bass')!,
            valM: document.getElementById('val-mid')!,
            barM: document.getElementById('bar-mid')!,
            valT: document.getElementById('val-treble')!,
            barT: document.getElementById('bar-treble')!,
            valVocal: document.getElementById('val-vocal')!,
            barVocal: document.getElementById('bar-vocal')!,
            valFx: document.getElementById('val-fx')!,
            barFx: document.getElementById('bar-fx')!,
            valBeat: document.getElementById('val-beat')!,
            barBeat: document.getElementById('bar-beat')!,
            valProg: document.getElementById('val-prog')!,
            barProg: document.getElementById('bar-prog')!,
            valDyn: document.getElementById('val-dyn')!,
            barDyn: document.getElementById('bar-dyn')!
        };

        this.engine.addPlaybackEndedListener(() => {
            this.setPlaybackUi(false);
            (this.els.seekBar as HTMLInputElement).value = "0";
            this.updateDashboard();
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
        this.timelineTooltip = this.createTimelineTooltip();
        this.metricTooltip = this.createDashboardMetricTooltip();
        this.initDashboardMetricTooltips();
        this.initDramaturgyTimeline();
        this.syncLoopUi();
        this.applyPresentationModeFromUrl();
        this.initChromeAutoHide();
        void this.loadVisualPresetList();
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
            this.els.bpmBadge.style.display = "none";
            this.resetTimelineView();
            this.clearDramaturgyTimeline();

            this.engine.onAnalysisComplete = () => {
                if (State.bpm > 0) {
                    this.els.bpmBadge.innerText = State.bpm + " BPM";
                    this.els.bpmBadge.style.display = "inline-flex";
                }
                this.els.status.innerText = file.name;
                (this.els.playBtn as HTMLButtonElement).disabled = false;
                (this.els.centerPlayBtn as HTMLButtonElement).disabled = false;
                (this.els.seekBar as HTMLInputElement).disabled = false;
                (this.els.upload as HTMLInputElement).disabled = false;
                this.els.timeTot.innerText = this.formatTime(State.duration);
                this.setPlaybackUi(false);
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

    private createTimelineTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'timeline-tooltip';
        tooltip.className = 'timeline-tooltip is-hidden';
        document.body.appendChild(tooltip);
        return tooltip;
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
        const resizeHandle = this.els.timelineResizeHandle;
        const wrapper = canvas.parentElement as HTMLElement | null;

        zoomButton.addEventListener('click', () => {
            if (!wrapper) return;
            this.toggleTimelineOverlay(wrapper, zoomButton);
            this.animateTimelineResize();
        });

        canvas.addEventListener('pointerdown', (event) => {
            if (State.duration <= 0) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0) return;

            this.timelinePointerDownX = event.clientX;
            this.timelinePointerDownY = event.clientY;
            this.timelineDidDrag = false;

            const isPanAction = event.button === 1 || event.shiftKey;
            if (isPanAction) {
                this.isPanningTimeline = true;
                this.timelinePanStartX = event.clientX;
                this.timelinePanStartOffset = this.timelineScrollOffsetTime;
                canvas.classList.add('is-panning');
            } else if (event.button === 0) {
                this.isSeekingTimeline = true;
                this.seekTimelineFromPointer(event, rect);
            } else {
                return;
            }
            canvas.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        canvas.addEventListener('pointermove', (event) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0) return;

            if (this.isPanningTimeline) {
                const dragDistance = Math.abs(event.clientX - this.timelinePointerDownX) + Math.abs(event.clientY - this.timelinePointerDownY);
                this.timelineDidDrag = this.timelineDidDrag || dragDistance > 3;
                const visibleDuration = this.getTimelineVisibleDuration();
                const deltaSeconds = ((event.clientX - this.timelinePanStartX) / rect.width) * visibleDuration;
                this.timelineScrollOffsetTime = this.clampTimelineScroll(this.timelinePanStartOffset - deltaSeconds);
                this.requestTimelineDraw();
            } else if (this.isSeekingTimeline) {
                this.timelineDidDrag = true;
                this.seekTimelineFromPointer(event, rect);
            }

            this.updateTimelineTooltip(event, rect);
        });

        const endTimelinePointer = (event: PointerEvent) => {
            if (this.isSeekingTimeline && !this.timelineDidDrag) {
                const rect = canvas.getBoundingClientRect();
                this.seekTimelineFromPointer(event, rect);
            }
            if (this.isSeekingTimeline) {
                this.commitScrubTime();
            }
            this.isPanningTimeline = false;
            this.isSeekingTimeline = false;
            this.timelineDidDrag = false;
            canvas.classList.remove('is-panning');
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
        };
        canvas.addEventListener('pointerup', endTimelinePointer);
        canvas.addEventListener('pointercancel', endTimelinePointer);
        canvas.addEventListener('pointerleave', () => {
            if (!this.isPanningTimeline && !this.isSeekingTimeline) this.hideTimelineTooltip();
        });

        canvas.addEventListener('wheel', (event) => {
            this.zoomTimelineFromWheel(event);
        }, { passive: false });

        resizeHandle.addEventListener('pointerdown', (event) => {
            if (!wrapper) return;
            if (wrapper.classList.contains('is-fullscreen-overlay')) return;
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

        window.addEventListener('resize', () => {
            this.timelineScrollOffsetTime = this.clampTimelineScroll(this.timelineScrollOffsetTime);
            this.drawDramaturgyTimeline();
        });
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
            this.hideTimelineTooltip();
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

    private seekTimelineFromPointer(event: PointerEvent, rect: DOMRect) {
        if (State.duration <= 0 || rect.width <= 0) return;
        const mouseX = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
        const seekTime = this.getTimelineTimeAtX(mouseX, rect.width);
        this.setScrubTime(seekTime);
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
        this.engine.seek(targetTime);
        this.requestTimelineDraw();
    }

    private zoomTimelineFromWheel(event: WheelEvent) {
        if (State.duration <= 0) return;
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0) return;

        event.preventDefault();
        const mouseX = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
        const mouseTime = this.getTimelineTimeAtX(mouseX, rect.width);
        const zoomFactor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
        this.timelineZoomLevel = this.clamp(this.timelineZoomLevel * zoomFactor, 1, 16);

        const newVisibleDuration = this.getTimelineVisibleDuration();
        this.timelineScrollOffsetTime = this.clampTimelineScroll(mouseTime - (mouseX / rect.width) * newVisibleDuration);
        if (this.timelineZoomLevel <= 1.01) this.timelineScrollOffsetTime = 0;
        this.requestTimelineDraw();
        this.updateTimelineTooltip(event, rect);
    }

    private getTimelineVisibleDuration() {
        if (State.duration <= 0) return 0;
        return State.duration / this.timelineZoomLevel;
    }

    private getTimelineViewport(): TimelineViewport {
        const duration = this.getTimelineVisibleDuration();
        this.timelineScrollOffsetTime = this.clampTimelineScroll(this.timelineScrollOffsetTime);
        return {
            start: this.timelineScrollOffsetTime,
            end: Math.min(State.duration, this.timelineScrollOffsetTime + duration),
            duration
        };
    }

    private clampTimelineScroll(offset: number) {
        if (State.duration <= 0) return 0;
        const visibleDuration = this.getTimelineVisibleDuration();
        return this.clamp(offset, 0, Math.max(0, State.duration - visibleDuration));
    }

    private getTimelineTimeAtX(x: number, width: number) {
        const viewport = this.getTimelineViewport();
        return this.clamp(viewport.start + (x / Math.max(1, width)) * viewport.duration, 0, State.duration);
    }

    private getTimelineXAtTime(time: number, width: number, viewport: TimelineViewport) {
        return ((time - viewport.start) / Math.max(0.001, viewport.duration)) * width;
    }

    private followTimelinePlayhead() {
        if (!State.isPlaying || State.duration <= 0 || this.timelineZoomLevel <= 1.05) return;
        const viewport = this.getTimelineViewport();
        const relativePosition = (State.currentTime - viewport.start) / Math.max(0.001, viewport.duration);
        if (relativePosition > 0.75 || relativePosition < 0.15) {
            this.timelineScrollOffsetTime = this.clampTimelineScroll(State.currentTime - viewport.duration * 0.5);
        }
    }

    private updateTimelineTooltip(event: MouseEvent, rect: DOMRect) {
        if (State.duration <= 0 || rect.width <= 0) {
            this.hideTimelineTooltip();
            return;
        }

        const mouseX = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
        const hoverTime = this.getTimelineTimeAtX(mouseX, rect.width);
        const viewport = this.getTimelineViewport();
        const cueTolerance = Math.max(0.05, viewport.duration * 0.015);
        const section = State.trackAnalysis.sections.find(item => hoverTime >= item.start && hoverTime <= item.end);
        const bar = State.trackAnalysis.bars.find(item => hoverTime >= item.start && hoverTime <= item.end);
        const cue = State.trackAnalysis.significantMoments.find(item => Math.abs(item.time - hoverTime) <= cueTolerance);
        const trend = State.trackAnalysis.tensionTrends.segments.find(item => hoverTime >= item.start && hoverTime <= item.end);
        const buildupValue = this.getBuildupValueAtTime(hoverTime);

        const lines: string[] = [`${this.formatTime(hoverTime)} | Zoom ${this.timelineZoomLevel.toFixed(1)}x`];
        if (section) {
            lines.push(`${section.label.toUpperCase()} | Energy ${Math.round(section.energy * 100)}% | ${section.dominantFeature}`);
        }
        if (bar) {
            lines.push(`Bar ${bar.index + 1} | ${bar.state} | RMS ${this.formatDb(bar.avgRms)} | B/M/T ${Math.round(bar.bass * 100)}/${Math.round(bar.mid * 100)}/${Math.round(bar.treble * 100)}%`);
        }
        if (trend) {
            lines.push(`Tension ${trend.direction.toUpperCase()} | ${Math.round(trend.confidence * 100)}% confidence`);
        }
        lines.push(`Buildup ${Math.round(buildupValue * 100)}%`);
        if (cue) {
            lines.push(`${cue.kind.toUpperCase()} cue | ${Math.round(cue.confidence * 100)}% confidence`);
        }

        this.timelineTooltip.textContent = lines.join('\n');
        this.timelineTooltip.style.left = `${this.clamp(event.clientX + 14, 8, Math.max(8, window.innerWidth - 320))}px`;
        this.timelineTooltip.style.top = `${this.clamp(event.clientY + 14, 8, Math.max(8, window.innerHeight - 110))}px`;
        this.timelineTooltip.classList.remove('is-hidden');
    }

    private hideTimelineTooltip() {
        this.timelineTooltip.classList.add('is-hidden');
    }

    private resetTimelineView() {
        this.timelineZoomLevel = 1;
        this.timelineScrollOffsetTime = 0;
        this.scrubTime = null;
        this.hideTimelineTooltip();
    }

    private getBuildupValueAtTime(time: number) {
        const buildup = State.trackAnalysis.buildupConfidence;
        if (!buildup.length || State.duration <= 0) return 0;
        const index = Math.min(buildup.length - 1, Math.max(0, Math.floor((time / State.duration) * buildup.length)));
        return buildup[index] || 0;
    }

    private formatDb(value: number) {
        return `${(20 * Math.log10(Math.max(0.0001, value))).toFixed(1)}dB`;
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
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
        if (this.lastTimelineDrawZoom !== this.timelineZoomLevel || this.lastTimelineDrawScroll !== this.timelineScrollOffsetTime) return true;
        if (this.lastTimelineDrawScrubTime !== this.scrubTime) return true;

        const viewport = this.getTimelineViewport();
        const visibleSecondsPerPixel = viewport.duration / Math.max(1, rect.width);
        return Math.abs(State.currentTime - this.lastTimelineDrawTime) >= visibleSecondsPerPixel;
    }

    private rememberTimelineDrawState(rect: DOMRect) {
        this.lastTimelineAnalysisRef = State.trackAnalysis;
        this.lastTimelineDrawTime = State.currentTime;
        this.lastTimelineDrawWidth = rect.width;
        this.lastTimelineDrawHeight = rect.height;
        this.lastTimelineDrawZoom = this.timelineZoomLevel;
        this.lastTimelineDrawScroll = this.timelineScrollOffsetTime;
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
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const ratio = window.devicePixelRatio || 1;
        const targetWidth = Math.max(1, Math.floor(rect.width * ratio));
        const targetHeight = Math.max(1, Math.floor(rect.height * ratio));
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
        }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (State.duration <= 0) {
            this.rememberTimelineDrawState(rect);
            return;
        }

        this.followTimelinePlayhead();
        const viewport = this.getTimelineViewport();
        this.drawTimelineBackground(ctx, rect.width, rect.height);
        this.drawTimelineSections(ctx, rect.width, rect.height, viewport);
        this.drawTimelineGridlines(ctx, rect.width, rect.height, viewport);
        this.drawTimelineRms(ctx, rect.width, rect.height, viewport);
        this.drawTimelineBuildup(ctx, rect.width, rect.height, viewport);
        this.drawTimelineTrends(ctx, rect.width, rect.height, viewport);
        this.drawTimelineCueMarkers(ctx, rect.width, rect.height, viewport);
        this.drawTimelinePlayhead(ctx, rect.width, rect.height, viewport);
        this.rememberTimelineDrawState(rect);
    }

    private clearDramaturgyTimeline() {
        const canvas = this.els.dramaturgyTimeline as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    private drawTimelineBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(255,255,255,0.045)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    private drawTimelineSections(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: TimelineViewport) {
        ctx.font = '10px Inter, sans-serif';
        ctx.textBaseline = 'top';
        let labelRight = -Infinity;

        for (const section of State.trackAnalysis.sections) {
            if (section.end < viewport.start || section.start > viewport.end) continue;
            const startX = this.getTimelineXAtTime(section.start, width, viewport);
            const endX = this.getTimelineXAtTime(section.end, width, viewport);
            const blockWidth = Math.max(1, endX - startX);
            ctx.fillStyle = this.getSectionColor(section.label);
            ctx.fillRect(Math.max(0, startX), 0, Math.min(width, endX) - Math.max(0, startX), height);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX + 0.5, 0);
            ctx.lineTo(startX + 0.5, height);
            ctx.stroke();

            const label = section.label.toUpperCase();
            const labelWidth = ctx.measureText(label).width;
            const labelX = Math.max(0, startX) + 6;
            if (blockWidth >= labelWidth + 12 && labelX > labelRight + 8 && labelX + labelWidth < width && height >= 46) {
                ctx.fillStyle = 'rgba(255,255,255,0.58)';
                ctx.fillText(label, labelX, 7);
                labelRight = labelX + labelWidth;
            }
        }
    }

    private drawTimelineGridlines(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: TimelineViewport) {
        if (State.bpm <= 0 || State.duration <= 0) return;
        const secondsPerBar = (60 / State.bpm) * 4;
        if (!Number.isFinite(secondsPerBar) || secondsPerBar <= 0) return;

        ctx.save();
        ctx.setLineDash([2, 5]);
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 1;
        const firstBarTime = Math.max(0, Math.floor(viewport.start / secondsPerBar) * secondsPerBar);
        for (let time = firstBarTime; time <= viewport.end; time += secondsPerBar) {
            const x = Math.round(this.getTimelineXAtTime(time, width, viewport)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, height >= 48 ? 18 : 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        ctx.restore();
    }

    private drawTimelineRms(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: TimelineViewport) {
        const bars = State.trackAnalysis.bars;
        if (!bars.length) return;

        const topPad = height >= 52 ? 18 : 4;
        const bottomPad = 5;
        const graphHeight = Math.max(8, height - topPad - bottomPad);

        ctx.beginPath();
        let hasPath = false;
        for (const bar of bars) {
            if (bar.end < viewport.start || bar.start > viewport.end) continue;
            const midTime = (bar.start + bar.end) * 0.5;
            const x = this.getTimelineXAtTime(midTime, width, viewport);
            const y = topPad + graphHeight * (1 - Math.min(1, bar.avgRms));
            if (!hasPath) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            hasPath = true;
        }
        ctx.strokeStyle = 'rgba(213, 84, 172, 0.55)';
        ctx.lineWidth = height >= 72 ? 1.25 : 1;
        if (hasPath) ctx.stroke();

        for (const bar of bars) {
            if (bar.end < viewport.start || bar.start > viewport.end) continue;
            const startX = this.getTimelineXAtTime(bar.start, width, viewport);
            const endX = this.getTimelineXAtTime(bar.end, width, viewport);
            const peakHeight = Math.max(1, bar.peakRms * graphHeight * 0.28);
            const clippedStartX = Math.max(0, startX);
            const clippedEndX = Math.min(width, endX);
            ctx.fillStyle = bar.state === 'HIGH' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.032)';
            ctx.fillRect(clippedStartX, height - bottomPad - peakHeight, Math.max(1, clippedEndX - clippedStartX), peakHeight);
        }
    }

    private drawTimelineBuildup(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: TimelineViewport) {
        const buildup = State.trackAnalysis.buildupConfidence;
        if (!buildup.length) return;
        const topPad = height >= 52 ? 18 : 4;
        const bottomPad = 5;
        const graphHeight = Math.max(8, height - topPad - bottomPad);

        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x++) {
            const time = viewport.start + (x / Math.max(1, width)) * viewport.duration;
            const frameIdx = Math.min(buildup.length - 1, Math.max(0, Math.floor((time / State.duration) * buildup.length)));
            const value = buildup[frameIdx] || 0;
            const y = topPad + graphHeight * (1 - value);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height - bottomPad);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, topPad, 0, height);
        fill.addColorStop(0, 'rgba(0, 229, 255, 0.24)');
        fill.addColorStop(1, 'rgba(0, 229, 255, 0.025)');
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.beginPath();
        for (let x = 0; x <= width; x++) {
            const time = viewport.start + (x / Math.max(1, width)) * viewport.duration;
            const frameIdx = Math.min(buildup.length - 1, Math.max(0, Math.floor((time / State.duration) * buildup.length)));
            const value = buildup[frameIdx] || 0;
            const y = topPad + graphHeight * (1 - value);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.82)';
        ctx.lineWidth = height >= 72 ? 1.5 : 1;
        ctx.stroke();
    }

    private drawTimelineTrends(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: TimelineViewport) {
        for (const trend of State.trackAnalysis.tensionTrends.segments) {
            if (trend.end < viewport.start || trend.start > viewport.end) continue;
            const startX = this.getTimelineXAtTime(trend.start, width, viewport);
            const endX = this.getTimelineXAtTime(trend.end, width, viewport);
            ctx.strokeStyle = this.getTrendColor(trend.direction);
            ctx.lineWidth = Math.max(1, 1 + trend.confidence * 2);
            ctx.beginPath();
            ctx.moveTo(Math.max(0, startX), height - 3);
            ctx.lineTo(Math.min(width, endX), height - 3);
            ctx.stroke();
        }
    }

    private drawTimelineCueMarkers(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: TimelineViewport) {
        const significant = State.trackAnalysis.significantMoments.length
            ? State.trackAnalysis.significantMoments
            : State.trackAnalysis.cues.filter(cue => cue.kind === 'impact' || cue.kind === 'break');
        let labelRight = -Infinity;

        for (const cue of significant) {
            if (cue.kind !== 'impact' && cue.kind !== 'break') continue;
            if (cue.time < viewport.start || cue.time > viewport.end) continue;

            const x = this.getTimelineXAtTime(cue.time, width, viewport);
            const color = this.getCueColor(cue.kind);
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 2);
            ctx.lineTo(x - 4, 10);
            ctx.lineTo(x + 4, 10);
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 10);
            ctx.lineTo(x + 0.5, height);
            ctx.stroke();
            ctx.globalAlpha = 1;

            const label = cue.kind === 'impact' ? 'IMPACT' : 'BREAK';
            ctx.font = '9px Inter, sans-serif';
            const labelWidth = ctx.measureText(label).width;
            if (height >= 72 && x + 7 > labelRight + 8 && x + 7 + labelWidth < width) {
                ctx.fillStyle = 'rgba(255,255,255,0.64)';
                ctx.fillText(label, x + 7, 5);
                labelRight = x + 7 + labelWidth;
            }
        }
    }

    private drawTimelinePlayhead(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: TimelineViewport) {
        const currentTimeToDraw = this.scrubTime !== null ? this.scrubTime : State.currentTime;
        if (currentTimeToDraw < viewport.start || currentTimeToDraw > viewport.end) return;
        const playheadX = this.getTimelineXAtTime(currentTimeToDraw, width, viewport);
        ctx.strokeStyle = this.scrubTime !== null ? 'rgba(255, 220, 120, 0.98)' : 'rgba(255,255,255,0.94)';
        ctx.lineWidth = 1;
        ctx.shadowColor = this.scrubTime !== null ? '#ffd66f' : '#00e5ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(playheadX + 0.5, 0);
        ctx.lineTo(playheadX + 0.5, height);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = this.scrubTime !== null ? '#ffd66f' : '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(playheadX, 1);
        ctx.lineTo(playheadX - 4, 8);
        ctx.lineTo(playheadX + 4, 8);
        ctx.closePath();
        ctx.fill();
    }

    private getSectionColor(label: string): string {
        switch (label) {
            case 'intro': return 'rgba(0, 150, 255, 0.10)';
            case 'outro': return 'rgba(160, 160, 160, 0.08)';
            case 'build': return 'rgba(255, 170, 0, 0.14)';
            case 'drop': return 'rgba(255, 0, 170, 0.17)';
            case 'peak': return 'rgba(0, 229, 255, 0.16)';
            case 'break': return 'rgba(120, 0, 255, 0.10)';
            default: return 'rgba(255, 255, 255, 0.035)';
        }
    }

    private getTrendColor(direction: string): string {
        if (direction === 'rising') return 'rgba(255, 170, 0, 0.9)';
        if (direction === 'falling') return 'rgba(120, 0, 255, 0.75)';
        return 'rgba(255, 255, 255, 0.22)';
    }

    private getCueColor(kind: string): string {
        if (kind === 'impact') return 'rgba(255, 255, 255, 0.78)';
        if (kind === 'break') return 'rgba(120, 0, 255, 0.9)';
        return 'rgba(255, 0, 170, 0.58)';
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
            row.innerHTML = `
                <span class="tuning-label">${control.label}</span>
                <input
                    type="range"
                    min="${control.min}"
                    max="${control.max}"
                    step="${control.step}"
                    value="${value}"
                    data-tuning-key="${control.key}"
                    aria-label="${control.label}"
                >
                <output id="${valueId}" class="tuning-value">${this.formatTuningValue(value, control.unit)}</output>
            `;
            group.appendChild(row);
        }

        container.addEventListener('input', (event) => {
            const input = event.target as HTMLInputElement;
            const key = input.dataset.tuningKey as VisualTuningKey | undefined;
            if (!key) return;

            const value = Number(input.value);
            State.targetTuning[key] = value;
            const control = visualTuningControls.find(item => item.key === key);
            const output = document.getElementById(`visual-tuning-value-${key}`);
            if (output) output.textContent = this.formatTuningValue(value, control?.unit);
        });

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
            const defaultPreset = presets.find(fileName => fileName.toLowerCase() === 'default.json');
            if (defaultPreset) select.value = defaultPreset;
            select.disabled = presets.length === 0;
        } catch {
            select.innerHTML = `<option value="">No preset index</option>`;
            select.disabled = true;
        }
    }

    private async loadVisualPreset(fileName: string) {
        try {
            const response = await fetch(this.presetUrl(fileName), { cache: 'no-store' });
            if (!response.ok) throw new Error(`Preset ${response.status}`);

            Object.assign(State.targetTuning, normalizeVisualTuningConfig(await response.json()));
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

    private syncVisualTuningControls() {
        for (const control of visualTuningControls) {
            const value = State.targetTuning[control.key];
            const input = this.els.tuningControls.querySelector<HTMLInputElement>(`input[data-tuning-key="${control.key}"]`);
            const output = document.getElementById(`visual-tuning-value-${control.key}`);
            if (input) input.value = value.toString();
            if (output) output.textContent = this.formatTuningValue(value, control.unit);
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

    private async copyVisualConfig() {
        const payload = JSON.stringify({
            version: 1,
            visualTuning: State.targetTuning
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

    updateDashboard() {
        if (!this.isDraggingSlider && this.scrubTime === null) {
            const progress = State.duration > 0 ? (State.currentTime / State.duration) * 100 : 0;
            (this.els.seekBar as HTMLInputElement).value = progress.toString();
            this.els.timeCur.innerText = this.formatTime(State.currentTime);
        }

        this.els.valE.innerText = State.currentFrame.e.toFixed(2); this.els.barE.style.width = (State.currentFrame.e * 100) + "%";
        this.els.valB.innerText = State.currentFrame.b.toFixed(2); this.els.barB.style.width = (State.currentFrame.b * 100) + "%";
        this.els.valM.innerText = State.currentFrame.m.toFixed(2); this.els.barM.style.width = (State.currentFrame.m * 100) + "%";
        this.els.valT.innerText = State.currentFrame.t.toFixed(2); this.els.barT.style.width = (State.currentFrame.t * 100) + "%";
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

        if (State.duration > 0) {
            let progPercent = (State.currentTime / State.duration) * 100;
            this.els.valProg.innerText = Math.floor(progPercent) + "%";
            this.els.barProg.style.width = progPercent + "%";
        } else {
            this.els.valProg.innerText = "0%";
            this.els.barProg.style.width = "0%";
        }

        this.requestDashboardTimelineDraw();
    }
}
