import { State } from '../state/store';
import { CanvasPostFxSurface, type PostFxSurfaceHost } from './CanvasPostFxSurface';
import { postFxChainIndex, type PostFxFrameContext, type PostProcessEffect } from './PostFxTypes';

/**
 * Renderer-owned orchestrator for the post chain (ADR-007).
 *
 * Runs at exactly one point: after the identity frame is finished, which means after the ADR-006
 * crossfade composite in an active transition and after the direct identity draw in steady state.
 * Either way the destination holds one complete frame, so the chain runs once per rendered frame,
 * never once per participating identity.
 *
 * Cost contract:
 * - Disabled (performance mode, paused/stopped): the state guards and nothing else, not even a
 *   target lookup.
 * - Enabled but inactive: a handful of property reads to resolve the target, then one `isActive()`
 *   probe per effect. No snapshot, no buffer allocation, no planning, no pixel write.
 * - Active: one full-frame snapshot blit shared by the whole chain, plus each effect's own writes.
 * - Zero per-frame allocation: the frame context and the active-effect list are preallocated.
 */
export class PostFxPipeline {
    private readonly effects: readonly PostProcessEffect[];
    private readonly surface: CanvasPostFxSurface;
    private readonly frame: PostFxFrameContext = { timeSec: 0, widthPx: 0, heightPx: 0 };
    private readonly activeEffects: PostProcessEffect[];
    private activeCount = 0;

    constructor(effects: readonly PostProcessEffect[], surface: CanvasPostFxSurface = new CanvasPostFxSurface()) {
        for (const effect of effects) {
            if (postFxChainIndex(effect.id) < 0) throw new Error(`Unknown post FX effect id '${effect.id}'`);
        }
        // Chain order is a property of the chain, not of composition order.
        this.effects = [...effects].sort((a, b) => postFxChainIndex(a.id) - postFxChainIndex(b.id));
        this.surface = surface;
        this.activeEffects = new Array<PostProcessEffect>(this.effects.length);
    }

    /**
     * `timeSec` is the renderer's canonical clock (`State.exportTime` while exporting, playback time
     * otherwise), so a given song time yields the same decisions live and in export.
     */
    render(host: PostFxSurfaceHost | null | undefined, timeSec: number): void {
        if (this.effects.length === 0) return;
        // Explicit low-latency bypass: performance mode removes the whole seam, including the
        // snapshot blit and any buffer allocation, rather than degrading it.
        if (State.visualTuning.performanceMode >= 0.5) return;
        // Explicit paused/stopped bypass: post accents belong to a running dramaturgy only, and a
        // still frame must stay bit-identical to what the identity drew.
        if (!State.isPlaying && !State.isExporting) return;
        if (!Number.isFinite(timeSec)) return;

        const target = this.surface.resolveTarget(host);
        if (!target) return;

        this.frame.timeSec = timeSec;
        this.frame.widthPx = target.canvas.width;
        this.frame.heightPx = target.canvas.height;
        if (this.frame.widthPx < 2 || this.frame.heightPx < 2) return;

        this.activeCount = 0;
        for (let i = 0; i < this.effects.length; i++) {
            const effect = this.effects[i];
            if (effect.isActive(this.frame)) this.activeEffects[this.activeCount++] = effect;
        }
        if (this.activeCount === 0) return;

        const snapshot = this.surface.captureSnapshot(target);
        if (!snapshot) return;

        for (let i = 0; i < this.activeCount; i++) {
            this.activeEffects[i].apply(target, snapshot, this.frame);
        }
    }
}
