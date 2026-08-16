import type { PostFxRenderTarget } from './PostFxTypes';

/**
 * Renderer-private buffer ownership for the post chain (ADR-007).
 *
 * Deliberately separate from `P5RenderTargetCompositor`: that class owns the two ADR-006 identity
 * crossfade targets and must not become a general post-process surface. This one owns exactly one
 * persistent snapshot buffer, allocated LAZILY on the first active post frame, so a session that
 * never triggers an effect pays zero bytes and zero blits.
 *
 * The buffer is a plain canvas sized in DEVICE pixels (not a `p5.Graphics`): nothing here is ever
 * drawn with p5 primitives, and a raw canvas keeps the buffer free of p5's pixel-density transform,
 * which is what lets the effect math be identical for a HiDPI live canvas and an export target.
 */

/** Structural view of the p5 sketch: the live surface, plus the offscreen export target when set. */
export interface PostFxSurfaceHost {
    readonly drawingContext?: unknown;
    readonly __plexusExportTarget?: { readonly drawingContext?: unknown } | null;
}

export type PostFxCanvasFactory = () => HTMLCanvasElement;

function defaultCanvasFactory(): HTMLCanvasElement {
    if (typeof document === 'undefined') throw new Error('Post FX surface requires a DOM canvas factory.');
    return document.createElement('canvas');
}

export class CanvasPostFxSurface {
    private readonly createCanvas: PostFxCanvasFactory;
    private snapshot: HTMLCanvasElement | null = null;
    private snapshotCtx: CanvasRenderingContext2D | null = null;
    private readonly target: { canvas: HTMLCanvasElement | null; ctx: CanvasRenderingContext2D | null } = { canvas: null, ctx: null };
    /** Diagnostics only: proves lazy single allocation and resize-on-change in tests. */
    private allocationCount = 0;
    private resizeCount = 0;

    constructor(createCanvas: PostFxCanvasFactory = defaultCanvasFactory) {
        this.createCanvas = createCanvas;
    }

    get bufferAllocationCount(): number {
        return this.allocationCount;
    }

    get bufferResizeCount(): number {
        return this.resizeCount;
    }

    /**
     * Resolves the destination the identity frame was just drawn into. `__plexusExportTarget` is the
     * same export redirection `P5RendererBackend` honours, so live and export share one seam.
     * Returns a reused object; callers must not retain it.
     */
    resolveTarget(host: PostFxSurfaceHost | null | undefined): PostFxRenderTarget | null {
        if (!host) return null;
        const surface = host.__plexusExportTarget ?? host;
        const ctx = surface?.drawingContext as CanvasRenderingContext2D | undefined;
        const canvas = ctx?.canvas as HTMLCanvasElement | undefined;
        if (!ctx || !canvas || typeof ctx.drawImage !== 'function') return null;
        if (!(canvas.width > 0) || !(canvas.height > 0)) return null;
        this.target.canvas = canvas;
        this.target.ctx = ctx;
        return this.target as PostFxRenderTarget;
    }

    /**
     * Copies the finished frame into the persistent buffer. The buffer is created once and resized
     * only when the destination dimensions actually change (window resize, export start/stop).
     * `copy` composition guarantees an exact pixel/alpha replica, so transparent and chroma-key
     * output cannot pick up ghost pixels from an earlier, larger frame.
     */
    captureSnapshot(target: PostFxRenderTarget): HTMLCanvasElement | null {
        const width = target.canvas.width;
        const height = target.canvas.height;
        if (!(width > 0) || !(height > 0)) return null;

        if (!this.snapshot) {
            this.snapshot = this.createCanvas();
            this.snapshotCtx = null;
            this.allocationCount++;
        }
        const snapshot = this.snapshot;
        if (snapshot.width !== width || snapshot.height !== height) {
            snapshot.width = width;
            snapshot.height = height;
            this.snapshotCtx = null;
            this.resizeCount++;
        }
        if (!this.snapshotCtx) {
            this.snapshotCtx = snapshot.getContext('2d');
            if (!this.snapshotCtx) return null;
        }

        const ctx = this.snapshotCtx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(target.canvas, 0, 0);
        ctx.restore();
        return snapshot;
    }
}
