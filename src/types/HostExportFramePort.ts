/** Renderer-owned completion barrier; export owns the job, target and encoder timeline.
 * No p5, State, audio or concrete worker dependency crosses this boundary.
 */
export interface HostExportFrameConfig {
    readonly jobId: string;
    readonly width: number;
    readonly height: number;
    readonly fps: number;
}
export interface HostExportFramePort {
    /** False retains the existing synchronous renderer (including unsupported frame rates). */
    begin(config: HostExportFrameConfig): Promise<boolean>;
    /** Settles only after redraw AND all deferred identity/composite/PostFX writes quiesce. */
    renderFrame(frameIndex: number): Promise<void>;
    /** Invalidates late presentation and interrupts worker preparation/rendering. */
    cancel(): void;
    /** Called after the outstanding render settles, before removing its target. */
    dispose(): void;
}
