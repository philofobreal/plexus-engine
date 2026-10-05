import type { AudioFrame, BeatEvent, TrackAnalysis, PerformanceAutomationPlan } from './index';
import type { GrainMaterialFrame } from './GrainMaterialFrame';
import type { GrainLineFrame } from './GrainLineFrame';

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
/** Longest song-time step that may still count as uninterrupted playback (one slow frame), in seconds. */
export const CONTINUOUS_PLAYBACK_MAX_STEP_SEC = 1;
/** How far the song-time step may differ from the elapsed wall-clock time and still be playback, in seconds. */
export const CONTINUOUS_PLAYBACK_TOLERANCE_SEC = 0.1;
/**
 * True when a playing step of `songStep` seconds is uninterrupted playback rather than a seek: the
 * song advanced (at most `CONTINUOUS_PLAYBACK_MAX_STEP_SEC`) by about as much as the wall clock did
 * (`wallStep` seconds). A seek moves song time without wall time passing. The wall clock only
 * classifies the step; positions always come from song time (never a second song clock).
 */
export function isContinuousPlaybackStep(songStep: number, wallStep: number): boolean {
    return Number.isFinite(songStep) && Number.isFinite(wallStep) && songStep >= 0
        && songStep <= CONTINUOUS_PLAYBACK_MAX_STEP_SEC && Math.abs(songStep - wallStep) <= CONTINUOUS_PLAYBACK_TOLERANCE_SEC;
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
    /**
     * Returns true only when the canvas changed, so its texture needs one upload. `continuous`
     * (optional) is the caller's classification of the step since the previous call: true for
     * uninterrupted playback (`isContinuousPlaybackStep`), which the source then morphs through
     * however long the step is; omitted, the source classifies the step itself.
     */
    render(songTime: number, playing: boolean, continuous?: boolean): boolean;
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
    /**
     * Asynchronous sources only: smoothed wall-clock time from requesting a frame to receiving it, in
     * milliseconds (0 until measured). A host redrawing on a fixed cadence widens it to whole frames
     * that fit, instead of a late frame missing a redraw and waiting a whole extra interval.
     */
    readonly frameLatencyMs?: number;
    /**
     * Opt-in diagnostics: wall-clock stage times of the last redraw in milliseconds (names are the
     * source's own), or null when the source does not profile.
     */
    readonly stageTimes?: Readonly<Record<string, number>> | null;
    /**
     * Host-rendered grain material of the frame currently on `canvas` (sources created with
     * `externalMaterial`; ADR-009 Addendum W), or null when that frame has none. The canvas then
     * holds everything except the material, which the host composites additively on top.
     */
    readonly materialFrame?: GrainMaterialFrame | null;
    /**
     * The grain trail strokes of the frame currently shown, as a line list (`externalLines`; ADR-009
     * Addendum AA), or null when that frame stroked them itself. The canvas then lacks exactly these
     * strokes; the host draws them over it before anything else. Valid until the next `render`.
     */
    readonly lineFrame?: GrainLineFrame | null;
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
    /**
     * MVP Advanced "Grain material" slider positions in [0, 1] (0.5 = neutral gain on the authored
     * value), with the same Advanced boost semantics as `lineStroke`.
     */
    readonly grainMaterial?: Readonly<Partial<Record<GrainMaterialBoostKey, number>>>;
}
/** The MVP Advanced tuning panel's "Grain material" group, by tuning key (ADR-009 Addendum V). */
export type GrainMaterialBoostKey = 'wormholeNebulaAmount' | 'wormholeNebulaDetail' | 'wormholeNebulaBloom' | 'wormholeNebulaWeave'
    | 'wormholeSpiral' | 'wormholeSpiralArms' | 'wormholeGrainDensity';
/** Construction-time raster size; omitted fields keep the source's default. */
export interface CanvasVisualSourceOptions {
    readonly width?: number;
    readonly height?: number;
    /** Hand the grain material to the host as carriers (`materialFrame`) instead of rasterizing it. */
    readonly externalMaterial?: boolean;
    /** With `externalMaterial`: hand the grain trail strokes to the host as lines (`lineFrame`) instead of stroking them. */
    readonly externalLines?: boolean;
    /** Measure per-stage redraw times (`stageTimes`) for the host's diagnostics. */
    readonly profile?: boolean;
}
export type CanvasVisualSourceFactory = (options?: CanvasVisualSourceOptions) => CanvasVisualSource;
