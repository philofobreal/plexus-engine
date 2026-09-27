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
    dispose(): void;
}
export type CanvasVisualSourceFactory = () => CanvasVisualSource;
