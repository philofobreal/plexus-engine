import { GestureEngine } from '../GestureEngine';
import { TimelineCanvas } from '../TimelineCanvas';
import { snapTimeToNearestGrid } from '../../automation/automationPlanEditing';
import { featureFlags } from '../../config/featureFlags';
import { State } from '../../state/store';
import type { DramaturgicalIntentPlan, IntentPoint, PerformanceAutomationPoint, RenderState, TimelineLayers, TrackAnalysis } from '../../types';

export interface JourneyTimelineCallbacks {
    onScrub: (time: number) => void;
    onScrubCommit: (time: number) => void;
    onSelectMoment: (id: string) => void;
    onMoveMomentCommit: (id: string, time: number) => void;
    onCreateMomentAt: (time: number) => void;
    onSelectIntentSegment: (intent: string, anchor: { x: number; y: number }) => void;
}

const POINT_HIT_RADIUS_PX = 14;
// Mirrors TimelineCanvas's own drawIntentLane geometry exactly (bandHeight/height gate) so a tap
// lands on the same pixels the band is actually drawn on.
const INTENT_BAND_HEIGHT_PX = 14;
const INTENT_BAND_MIN_CANVAS_HEIGHT_PX = 60;

/**
 * The MVP's "Musical Journey": the *same* TimelineCanvas renderer the advanced dashboard's
 * dramaturgy panel uses (waveform, sections, buildup, cues, automation lane, gridlines,
 * dramaturgical-intent lane, playhead) — not a re-implementation — wrapped with a lighter,
 * touch-first interaction layer (scrub / select / drag a moment / draw-to-place / tap an intent
 * segment) so it stays in perfect sync with the canvas's own zoom/pan viewport instead of a
 * separately-positioned overlay.
 *
 * Owns State.zoom / State.pan / State.snapToGrid / State.followPlayhead / State.timelineLayers
 * directly: the same viewport + editing fields the advanced dashboard's TimelineCanvas already
 * reads, so this is one domain model, not a second one.
 */
export class JourneyTimeline {
    readonly root: HTMLElement;
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: TimelineCanvas;
    private readonly gesture: GestureEngine;
    private readonly callbacks: JourneyTimelineCallbacks;

    private duration = 0;
    private points: PerformanceAutomationPoint[] = [];
    private intentPlan: DramaturgicalIntentPlan | null = null;
    private selectedId: string | null = null;
    private playheadTime = 0;
    private draggingPointId: string | null = null;
    private dragPreviewTime = 0;
    private isSeekDragging = false;
    private drawModeActive = false;
    private rafHandle: number | null = null;
    private visible = true;

    // Last-drawn state, mirroring DashboardUI's shouldDrawTimelineForDashboard gate: a full
    // TimelineCanvas.render() redraws the waveform, sections, gridlines, automation and intent
    // lanes, so skip it when nothing visible actually changed instead of repainting on every
    // rAF-coalesced setPlayhead tick (up to ~15/sec during playback) regardless of whether the
    // playhead moved by even a sub-pixel amount.
    private lastDrawWidth = -1;
    private lastDrawHeight = -1;
    private lastDrawZoom = -1;
    private lastDrawPan = -1;
    private lastDrawDuration = -1;
    private lastDrawTime = -1;
    private lastDrawDragPreviewTime = -1;
    private lastDrawPointsRef: PerformanceAutomationPoint[] | null = null;
    private lastDrawIntentRef: DramaturgicalIntentPlan | null = null;
    private lastDrawSelectedId: string | null = null;
    private lastDrawDraggingId: string | null = null;
    private lastDrawAnalysisRef: TrackAnalysis | null = null;
    private lastDrawLayers: TimelineLayers | null = null;

    constructor(callbacks: JourneyTimelineCallbacks) {
        this.callbacks = callbacks;
        this.root = document.createElement('div');
        this.root.className = 'mvp-journey-timeline';

        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'mvp-journey-canvas-wrap';
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'mvp-journey-canvas';
        canvasWrap.appendChild(this.canvas);
        this.renderer = new TimelineCanvas(this.canvas);

        this.root.appendChild(canvasWrap);

        this.gesture = new GestureEngine(this.canvas, {
            onStart: (focusX, focusY) => this.handleStart(focusX, focusY),
            onMove: (focusX) => this.handleMove(focusX),
            onEnd: () => this.handleEnd(),
            onDoubleClick: (focusX) => this.callbacks.onCreateMomentAt(this.timeAtPercent(focusX))
        });

        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => this.requestDraw()).observe(canvasWrap);
        }
        window.addEventListener('resize', () => this.requestDraw());
    }

    /** trackAnalysis itself is read from State.trackAnalysis inside buildRenderState() each
     *  frame; only duration is cached locally for the viewport/interaction math below. */
    setTrackData(_trackAnalysis: TrackAnalysis, duration: number): void {
        this.duration = duration;
        State.zoom = 1;
        State.pan = 0;
        this.requestDraw();
    }

    setAudioBuffer(buffer: AudioBuffer): void {
        this.renderer.setAudioBuffer(buffer);
        this.requestDraw();
    }

    setPoints(points: PerformanceAutomationPoint[]): void {
        this.points = points;
        this.requestDraw();
    }

    setSelected(id: string | null): void {
        this.selectedId = id;
        this.requestDraw();
    }

    setPlayhead(time: number): void {
        this.playheadTime = time;
        this.followPlayheadIfNeeded();
        this.requestDraw();
    }

    /** Dramaturgical-intent lane data (ESTABLISH / RECOVER / EXPAND / ...): drawn baked into the
     *  canvas itself (TimelineCanvas.drawIntentLane), so it pans/zooms with everything else
     *  instead of drifting out of sync as a separately-positioned overlay. Tapping the band is
     *  handled by hitTestIntentSegment below, using the exact same geometry. */
    setIntentPlan(plan: DramaturgicalIntentPlan | null | undefined): void {
        this.intentPlan = plan ?? null;
        this.requestDraw();
    }

    setLayers(layers: TimelineLayers): void {
        State.timelineLayers = { ...layers };
        this.requestDraw();
    }

    setSnapEnabled(value: boolean): void { State.snapToGrid = value; }
    setFollowEnabled(value: boolean): void {
        State.followPlayhead = value;
        this.followPlayheadIfNeeded();
        this.requestDraw();
    }
    setDrawModeActive(value: boolean): void { this.drawModeActive = value; State.drawModeActive = value; }

    /** Hides the timeline's own root (the "Hide timeline" button, and the Fullscreen gate in
     *  MvpUI) and, while hidden, stops scheduling the rAF redraw loop entirely rather than relying
     *  on shouldRedraw's zero-size bailout, so a hidden timeline costs nothing per frame instead
     *  of a rAF callback + getBoundingClientRect on every tick. */
    setVisible(visible: boolean): void {
        this.visible = visible;
        this.root.classList.toggle('mvp-hidden', !visible);
        if (visible) this.requestDraw();
    }

    setZoomed(value: boolean): void {
        if (value) {
            const visible = Math.min(this.duration, 45);
            State.zoom = visible > 0 ? Math.max(1, this.duration / visible) : 1;
            State.pan = this.clampPan(this.playheadTime - visible / 2);
        } else {
            State.zoom = 1;
            State.pan = 0;
        }
        this.requestDraw();
    }

    destroy(): void {
        this.gesture.destroy();
        if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    }

    // ─── Viewport math (mirrors DashboardUI's timeline viewport formulas 1:1 so both surfaces
    // read State.zoom / State.pan the same way) ────────────────────────────────────────────────

    private getVisibleDuration(): number {
        if (this.duration <= 0) return 0;
        const maxZoom = Math.max(16, this.duration / 5);
        return this.duration / this.clamp(State.zoom, 1, maxZoom);
    }

    private clampPan(offset: number): number {
        if (this.duration <= 0) return 0;
        return this.clamp(offset, 0, Math.max(0, this.duration - this.getVisibleDuration()));
    }

    private timeAtPercent(focusX: number): number {
        const visible = this.getVisibleDuration();
        State.pan = this.clampPan(State.pan);
        return this.clamp(State.pan + this.clamp(focusX, 0, 1) * visible, 0, this.duration);
    }

    private xForTime(time: number, width: number): number {
        const visible = this.getVisibleDuration();
        State.pan = this.clampPan(State.pan);
        return ((time - State.pan) / Math.max(0.001, visible)) * width;
    }

    private followPlayheadIfNeeded(): void {
        if (!State.followPlayhead || !State.isPlaying || this.duration <= 0 || State.zoom <= 1.05) return;
        const viewportStart = this.clampPan(State.pan);
        const visible = this.getVisibleDuration();
        const relative = (this.playheadTime - viewportStart) / Math.max(0.001, visible);
        if (relative > 0.75 || relative < 0.15) {
            State.pan = this.clampPan(this.playheadTime - visible / 2);
        }
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }

    private snapIfEnabled(time: number): number {
        return State.snapToGrid ? snapTimeToNearestGrid(time, State.trackAnalysis.bars, this.duration) : time;
    }

    // ─── Interaction ────────────────────────────────────────────────────────────────────────

    private hitTestPoint(focusX: number): PerformanceAutomationPoint | null {
        if (this.duration <= 0) return null;
        const rect = this.canvas.getBoundingClientRect();
        const px = focusX * rect.width;
        let nearest: PerformanceAutomationPoint | null = null;
        let nearestDist = POINT_HIT_RADIUS_PX;
        for (const point of this.points) {
            const dist = Math.abs(px - this.xForTime(point.time, rect.width));
            if (dist <= nearestDist) { nearest = point; nearestDist = dist; }
        }
        return nearest;
    }

    /** Same band geometry as TimelineCanvas.drawIntentLane (bottom bandHeight px, gated on
     *  canvas height), so a tap lands on exactly the pixels the lane is drawn on. */
    private hitTestIntentSegment(focusX: number, focusY: number): IntentPoint | null {
        const points = this.intentPlan?.points;
        if (!points?.length || this.duration <= 0) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.height < INTENT_BAND_MIN_CANVAS_HEIGHT_PX) return null;
        const bandTop = rect.height - INTENT_BAND_HEIGHT_PX;
        if (focusY * rect.height < bandTop) return null;

        const time = this.timeAtPercent(focusX);
        const sorted = [...points].sort((a, b) => a.time - b.time);
        for (let i = 0; i < sorted.length; i++) {
            const next = sorted[i + 1];
            const endTime = next ? next.time : this.duration;
            if (time >= sorted[i].time && time < endTime) return sorted[i];
        }
        return sorted[sorted.length - 1] ?? null;
    }

    private handleStart(focusX: number, focusY: number): boolean {
        const intentHit = this.hitTestIntentSegment(focusX, focusY);
        if (intentHit) {
            const rect = this.canvas.getBoundingClientRect();
            this.callbacks.onSelectIntentSegment(intentHit.intent, {
                x: rect.left + focusX * rect.width,
                y: rect.top + focusY * rect.height
            });
            return false;
        }
        const hit = this.hitTestPoint(focusX);
        if (hit) {
            this.draggingPointId = hit.id;
            this.dragPreviewTime = hit.time;
            this.callbacks.onSelectMoment(hit.id);
            return true;
        }
        const time = this.timeAtPercent(focusX);
        if (this.drawModeActive) {
            this.callbacks.onCreateMomentAt(this.snapIfEnabled(time));
            return false;
        }
        this.isSeekDragging = true;
        this.callbacks.onScrub(time);
        return true;
    }

    private handleMove(focusX: number): void {
        if (this.draggingPointId) {
            this.dragPreviewTime = this.snapIfEnabled(this.timeAtPercent(focusX));
            this.requestDraw();
            return;
        }
        if (this.isSeekDragging) {
            this.callbacks.onScrub(this.timeAtPercent(focusX));
        }
    }

    private handleEnd(): void {
        if (this.draggingPointId) {
            this.callbacks.onMoveMomentCommit(this.draggingPointId, this.dragPreviewTime);
            this.draggingPointId = null;
            return;
        }
        if (this.isSeekDragging) {
            this.isSeekDragging = false;
            this.callbacks.onScrubCommit(this.playheadTime);
        }
    }

    // ─── Render ─────────────────────────────────────────────────────────────────────────────

    private requestDraw(): void {
        if (!this.visible) return;
        if (this.rafHandle !== null) return;
        this.rafHandle = requestAnimationFrame(() => {
            this.rafHandle = null;
            this.draw();
        });
    }

    private draw(): void {
        const rect = this.canvas.getBoundingClientRect();
        if (!this.shouldRedraw(rect)) return;
        this.renderer.render(this.buildRenderState());
        this.rememberDrawState(rect);
    }

    private shouldRedraw(rect: DOMRect): boolean {
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (this.duration <= 0) return this.lastDrawWidth !== rect.width || this.lastDrawHeight !== rect.height;
        if (this.lastDrawWidth !== rect.width || this.lastDrawHeight !== rect.height) return true;
        if (this.lastDrawZoom !== State.zoom || this.lastDrawPan !== State.pan) return true;
        if (this.lastDrawDuration !== this.duration) return true;
        if (this.lastDrawAnalysisRef !== State.trackAnalysis) return true;
        if (this.lastDrawPointsRef !== this.points) return true;
        if (this.lastDrawIntentRef !== this.intentPlan) return true;
        if (this.lastDrawSelectedId !== this.selectedId) return true;
        if (this.lastDrawDraggingId !== this.draggingPointId) return true;
        if (this.draggingPointId && this.lastDrawDragPreviewTime !== this.dragPreviewTime) return true;
        if (!this.layersEqual(this.lastDrawLayers, State.timelineLayers)) return true;
        const visibleSecondsPerPixel = this.getVisibleDuration() / Math.max(1, rect.width);
        return Math.abs(this.playheadTime - this.lastDrawTime) >= visibleSecondsPerPixel;
    }

    // Value comparison, not reference: TimelineToolbar's setLayers() always replaces the object
    // ({...layers}), but DashboardUI's own layer buttons mutate State.timelineLayers in place, so
    // a reference check would miss that source and reintroduce the same stale-timeline bug.
    private layersEqual(a: TimelineLayers | null, b: TimelineLayers): boolean {
        if (!a) return false;
        return a.waveform === b.waveform && a.rms === b.rms && a.buildup === b.buildup
            && a.cues === b.cues && a.automation === b.automation;
    }

    private rememberDrawState(rect: DOMRect): void {
        this.lastDrawWidth = rect.width;
        this.lastDrawHeight = rect.height;
        this.lastDrawZoom = State.zoom;
        this.lastDrawPan = State.pan;
        this.lastDrawDuration = this.duration;
        this.lastDrawAnalysisRef = State.trackAnalysis;
        this.lastDrawPointsRef = this.points;
        this.lastDrawIntentRef = this.intentPlan;
        this.lastDrawSelectedId = this.selectedId;
        this.lastDrawDraggingId = this.draggingPointId;
        this.lastDrawDragPreviewTime = this.dragPreviewTime;
        this.lastDrawLayers = { ...State.timelineLayers };
        this.lastDrawTime = this.playheadTime;
    }

    private buildRenderState(): RenderState {
        const points = this.draggingPointId
            ? this.points.map((p) => (p.id === this.draggingPointId ? { ...p, time: this.dragPreviewTime } : p))
            : this.points;
        return {
            isPlaying: State.isPlaying,
            isExporting: State.isExporting,
            exportTime: State.exportTime,
            currentTime: this.playheadTime,
            duration: this.duration,
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
            performancePlan: points.length ? { version: 1, source: 'edited', points } : null,
            automationMorphScale: State.automationMorphScale,
            dramaturgicalIntent: this.intentPlan,
            timelineLayers: State.timelineLayers,
            snapToGrid: State.snapToGrid,
            selectedPointId: this.selectedId,
            followPlayhead: State.followPlayhead,
            hoveredPointId: null,
            hoveredHandleType: null,
            audioSensitivity: State.visualTuning.audioSensitivity,
            dropAnticipation: State.visualTuning.dropAnticipation,
            videoDominantColor: State.videoDominantColor,
            scrubTime: null,
            gridOffset: State.trackAnalysis.gridOffset
        };
    }
}
