import p5 from 'p5';
import type { RenderTargetCompositor, VisualRendererBackend } from './RendererBackend';
import { P5RendererBackend } from './P5RendererBackend';

type P5WithExportTarget = p5 & { __plexusExportTarget?: p5.Graphics };
type GraphicsWithCanvas = p5.Graphics & { elt: HTMLCanvasElement };

export class P5RenderTargetCompositor implements RenderTargetCompositor {
    private readonly p: p5;
    private readonly outgoing: p5.Graphics;
    private readonly incoming: p5.Graphics;
    readonly outgoingBackend: VisualRendererBackend;
    readonly incomingBackend: VisualRendererBackend;

    constructor(p: p5) {
        this.p = p;
        this.outgoing = p.createGraphics(Math.max(1, p.width), Math.max(1, p.height));
        this.incoming = p.createGraphics(Math.max(1, p.width), Math.max(1, p.height));
        this.outgoingBackend = new P5RendererBackend(this.outgoing);
        this.incomingBackend = new P5RendererBackend(this.incoming);
    }

    beginFrame(_generation: number, width: number, height: number): void {
        const safeWidth = Math.max(1, Math.floor(width));
        const safeHeight = Math.max(1, Math.floor(height));
        if (this.outgoing.width !== safeWidth || this.outgoing.height !== safeHeight) {
            this.outgoing.resizeCanvas(safeWidth, safeHeight);
            this.incoming.resizeCanvas(safeWidth, safeHeight);
        }
        // Transition targets never retain prior-frame pixels. This keeps transparent,
        // chroma-key, and video-backplate composition free from buffer ghosting.
        this.outgoing.clear();
        this.incoming.clear();
    }

    composite(alpha: number): void {
        const target = (this.p as P5WithExportTarget).__plexusExportTarget ?? this.p;
        const canvas = (target as p5 | GraphicsWithCanvas).drawingContext.canvas as HTMLCanvasElement;
        const ctx = target.drawingContext as CanvasRenderingContext2D;
        const mix = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1 - mix;
        ctx.drawImage((this.outgoing as GraphicsWithCanvas).elt, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = mix;
        ctx.drawImage((this.incoming as GraphicsWithCanvas).elt, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}
