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
export interface CanvasVisualSource {
    readonly canvas: HTMLCanvasElement;
    prepare(analysis: VisualAnalysisSnapshot | null): Promise<void>;
    /** Returns true only when the canvas changed, so its texture needs one upload. */
    render(songTime: number, playing: boolean): boolean;
    dispose(): void;
}
export type CanvasVisualSourceFactory = () => CanvasVisualSource;
