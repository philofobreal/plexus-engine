/**
 * Renderer-owned post-process seam (ADR-007).
 *
 * This is deliberately NOT a general plugin framework: it is the minimum contract the planned
 * effect chain actually needs. A post effect receives the finished, already-composited identity
 * frame as an image plus the destination it must write back into, and nothing else. It never
 * learns about identities, particles, shared simulation, visual-mode transitions, or p5.
 *
 * Boundary notes:
 * - `P5RenderTargetCompositor` stays the exclusive property of the ADR-006 identity replacement
 *   crossfade. Post FX runs AFTER that composite, on the single finished frame, exactly once.
 * - Visual identities never see this contract; they keep receiving only `VisualRendererBackend`.
 * - All coordinates here are DEVICE pixels of the destination canvas, so the same effect code is
 *   correct for a HiDPI live canvas and for an offscreen export target of any resolution.
 */

/** The live canvas or the offscreen export target, resolved to raw canvas + 2D context. */
export interface PostFxRenderTarget {
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
}

/** Per-frame render facts. Reused across frames; effects must not retain it. */
export interface PostFxFrameContext {
    /** Canonical song time: live playback time or exact export time, identical to the render clock. */
    timeSec: number;
    widthPx: number;
    heightPx: number;
}

export interface PostProcessEffect {
    /** Must be one of `POST_FX_CHAIN_ORDER`; it fixes this effect's slot in the chain. */
    readonly id: PostFxEffectId;
    /**
     * Pure, allocation-free probe answering "would this effect change any pixel this frame?".
     * The pipeline stays on its zero-cost fast path (no snapshot, no buffer) while every effect
     * answers false, so an inactive chain must cost one boolean per effect and nothing else.
     */
    isActive(frame: PostFxFrameContext): boolean;
    /**
     * `snapshot` holds the untouched pixels of `target` as they were before the chain started.
     * Effects write into `target.ctx` and must leave its state as they found it (save/restore).
     */
    apply(target: PostFxRenderTarget, snapshot: HTMLCanvasElement, frame: PostFxFrameContext): void;
}

/**
 * The fixed dramaturgical order of the renderer post chain. Only `fragmentation` exists today;
 * the remaining ids are reserved so a later effect cannot silently reorder the chain. Effects are
 * sorted by this list, so registration order in composition is irrelevant.
 */
export const POST_FX_CHAIN_ORDER = [
    'fragmentation',
    'chromatic-aberration',
    'local-displacement',
    'temporal-echo',
    'spatial-glitch'
] as const;

export type PostFxEffectId = (typeof POST_FX_CHAIN_ORDER)[number];

export function postFxChainIndex(id: string): number {
    return (POST_FX_CHAIN_ORDER as readonly string[]).indexOf(id);
}
