import type { AudioFrame, BeatEvent, TrackAnalysis, PerformanceAutomationPlan } from './index';

/** Immutable analyzer publication, passed explicitly across the XR/visuals composition seam. */
export interface VisualAnalysisSnapshot {
    frames: AudioFrame[];
    events: BeatEvent[];
    trackAnalysis: TrackAnalysis;
    sampleRate: number;
    hopSize: number;
    bpm: number;
    duration: number;
    /** Prepared once, offline, by the host facade; consumers never regenerate it. */
    performancePlan: PerformanceAutomationPlan;
}
/**
 * Read-only apparent vanishing point of the rendered image, normalized to the canvas half-extent:
 * (0, 0) is the canvas center, +x is right, +y is up. The source owns and mutates it in place.
 */
export interface VisualFocalPoint {
    readonly x: number;
    readonly y: number;
}
export interface CanvasVisualSource {
    readonly canvas: HTMLCanvasElement;
    /** Optional authoritative focal point of the last rendered frame; hosts never derive it from pixels. */
    readonly focalPoint?: VisualFocalPoint;
    /**
     * Optional fixed multi-plane (2.5D) output of the same projection, ordered far -> near. The
     * first entry is `canvas`; later entries hold nearer content on black and are composited
     * additively. All planes change together whenever `render` returns true.
     */
    readonly layers?: readonly HTMLCanvasElement[];
    prepare(analysis: VisualAnalysisSnapshot | null): Promise<void>;
    /** Returns true only when the canvas changed, so its texture needs one upload. */
    render(songTime: number, playing: boolean): boolean;
    /** Optional host presentation controls; applied from the next `render` (which then redraws). */
    setPresentation?(presentation: CanvasVisualPresentation): void;
    /**
     * Asynchronous sources only: set by the host and called when a new frame became available
     * outside `render` (e.g. while paused), so an idle host can schedule one more frame.
     */
    onFrameReady?: (() => void) | null;
    /** Asynchronous sources only: unrecoverable failure outside `prepare` (the source stops updating). */
    onError?: ((message: string) => void) | null;
    /** Optional cost of the last redraw, in milliseconds, when the source measures it itself. */
    readonly lastRenderMs?: number;
    dispose(): void;
}
/**
 * Host-owned presentation of an embedded source. Never a tuning-key, preset or plan change: the
 * source keeps resolving its own tuning and only layers these on top.
 */
export interface CanvasVisualPresentation {
    /** MVP Advanced "Line stroke" slider position in [0, 1] (0.5 = neutral gain). */
    readonly lineStroke?: number;
    /** Upper bound on canvas redraws per second while playing. */
    readonly maxFrameRateHz?: number;
    /**
     * MVP "Visual character" macro slider positions in [0, 1] (0.5 = neutral): Intensity, Motion,
     * Depth and Detail, applied through the shared macro -> clamp -> advanced order.
     */
    readonly macros?: Readonly<Record<'intensity' | 'motion' | 'depth' | 'detail', number>>;
}
/** Construction-time raster size; omitted fields keep the source's default. */
export interface CanvasVisualSourceOptions {
    readonly width?: number;
    readonly height?: number;
}
export type CanvasVisualSourceFactory = (options?: CanvasVisualSourceOptions) => CanvasVisualSource;
