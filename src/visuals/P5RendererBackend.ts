import p5 from 'p5';
import type { FieldRasterBlendMode, RingTintCompositeMode, VisualRendererBackend } from './RendererBackend';
import { State } from '../state/store';
import { CanvasFieldRasterSurface } from './CanvasFieldRasterSurface';

export class P5RendererBackend implements VisualRendererBackend {
    private readonly p: p5 | p5.Graphics;
    private readonly fieldRasterSurface = new CanvasFieldRasterSurface();
    private lastStrokeR = NaN;
    private lastStrokeG = NaN;
    private lastStrokeB = NaN;
    private lastStrokeA = NaN;
    private lastFillR = NaN;
    private lastFillG = NaN;
    private lastFillB = NaN;
    private lastFillA = NaN;
    private lastStrokeWeight = -1;
    private strokeActive = true;
    private fillActive = true;
    private lastTarget: p5 | p5.Graphics | null = null;

    constructor(p: p5 | p5.Graphics) {
        this.p = p;
    }

    private get target(): p5 | p5.Graphics {
        const target = ((this.p as p5 & { __plexusExportTarget?: p5.Graphics }).__plexusExportTarget || this.p);
        if (target !== this.lastTarget) {
            this.resetCachedState();
            this.lastTarget = target;
        }
        return target;
    }

    private resetCachedState(): void {
        this.lastStrokeR = NaN;
        this.lastStrokeG = NaN;
        this.lastStrokeB = NaN;
        this.lastStrokeA = NaN;
        this.lastFillR = NaN;
        this.lastFillG = NaN;
        this.lastFillB = NaN;
        this.lastFillA = NaN;
        this.lastStrokeWeight = -1;
        this.strokeActive = true;
        this.fillActive = true;
    }

    get width() {
        return this.target.width;
    }

    get height() {
        return this.target.height;
    }

    get frameCount() {
        return this.p.frameCount;
    }

    background(r: number, g: number, b: number, a = 255) {
        if (State.videoBackplateActive) {
            this.target.clear();
            return;
        }
        this.target.background(r, g, b, a);
    }

    noStroke() {
        if (this.strokeActive) {
            this.target.noStroke();
            this.strokeActive = false;
        }
    }

    noFill() {
        if (this.fillActive) {
            this.target.noFill();
            this.fillActive = false;
        }
    }

    fill(r: number, g: number, b: number, a = 255) {
        if (!this.fillActive || this.lastFillR !== r || this.lastFillG !== g || this.lastFillB !== b || this.lastFillA !== a) {
            this.target.fill(r, g, b, a);
            this.lastFillR = r;
            this.lastFillG = g;
            this.lastFillB = b;
            this.lastFillA = a;
            this.fillActive = true;
        }
    }

    stroke(r: number, g: number, b: number, a = 255) {
        if (!this.strokeActive || this.lastStrokeR !== r || this.lastStrokeG !== g || this.lastStrokeB !== b || this.lastStrokeA !== a) {
            this.target.stroke(r, g, b, a);
            this.lastStrokeR = r;
            this.lastStrokeG = g;
            this.lastStrokeB = b;
            this.lastStrokeA = a;
            this.strokeActive = true;
        }
    }

    strokeWeight(weight: number) {
        if (this.lastStrokeWeight !== weight) {
            this.target.strokeWeight(weight);
            this.lastStrokeWeight = weight;
        }
    }

    line(x1: number, y1: number, x2: number, y2: number) {
        this.target.line(x1, y1, x2, y2);
    }

    circle(x: number, y: number, diameter: number) {
        this.target.circle(x, y, diameter);
    }

    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
        this.target.triangle(x1, y1, x2, y2, x3, y3);
    }

    beginShape() {
        this.target.beginShape();
    }

    vertex(x: number, y: number) {
        this.target.vertex(x, y);
    }

    endShape() {
        this.target.endShape();
    }

    radialGlow(cx: number, cy: number, radius: number, color: [number, number, number], alpha: number) {
        const target = this.target;
        const ctx = target.drawingContext as CanvasRenderingContext2D;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        glow.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
        glow.addColorStop(1, 'rgba(8, 5, 14, 0)');
        ctx.fillStyle = glow;
        this.noStroke();
        target.circle(cx, cy, radius * 2);
    }

    radialDim(cx: number, cy: number, innerRadius: number, outerRadius: number, alpha: number) {
        const target = this.target;
        const ctx = target.drawingContext as CanvasRenderingContext2D;
        const safeInnerRadius = Math.max(0, innerRadius);
        const safeOuterRadius = Math.max(safeInnerRadius + 1, outerRadius);
        const safeAlpha = Math.max(0, Math.min(1, alpha));
        const dim = ctx.createRadialGradient(
            cx, cy, safeInnerRadius,
            cx, cy, safeOuterRadius
        );
        dim.addColorStop(0, 'rgba(0, 0, 0, 0)');
        dim.addColorStop(1, `rgba(0, 0, 0, ${safeAlpha})`);
        ctx.save();
        ctx.fillStyle = dim;
        ctx.fillRect(0, 0, target.width, target.height);
        ctx.restore();
    }

    compositeRingTint(
        cx: number,
        cy: number,
        innerRadius: number,
        outerRadius: number,
        color: [number, number, number],
        alpha: number,
        mode: RingTintCompositeMode,
        startAngle?: number,
        endAngle?: number
    ) {
        // Chroma outputs must remain an untouched key color/alpha plate. This defensive backend
        // gate complements the identity-side skip and also protects future direct callers.
        if (State.visualTuning.chromaKeyMode !== 0) return;

        const target = this.target;
        const ctx = target.drawingContext as CanvasRenderingContext2D;
        const safeInnerRadius = Math.max(0, Number.isFinite(innerRadius) ? innerRadius : 0);
        const safeOuterRadius = Math.max(
            safeInnerRadius + 1,
            Number.isFinite(outerRadius) ? outerRadius : safeInnerRadius + 1
        );
        const safeAlpha = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
        if (safeAlpha <= 0) return;

        const tint = ctx.createRadialGradient(
            cx, cy, safeInnerRadius,
            cx, cy, safeOuterRadius
        );
        const rgba = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${safeAlpha})`;
        tint.addColorStop(0, 'rgba(0, 0, 0, 0)');
        tint.addColorStop(0.38, rgba);
        tint.addColorStop(0.68, rgba);
        tint.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        try {
            ctx.globalCompositeOperation = mode;
            ctx.fillStyle = tint;
            if (Number.isFinite(startAngle) && Number.isFinite(endAngle) && (endAngle as number) > (startAngle as number)) {
                const clipRadius = Math.hypot(target.width, target.height) * 1.5;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, clipRadius, startAngle as number, endAngle as number);
                ctx.closePath();
                ctx.clip();
            }
            ctx.fillRect(0, 0, target.width, target.height);
        } finally {
            ctx.restore();
            // The renderer contract deliberately does not restore an arbitrary previous mode:
            // every primitive returns the shared target to the canonical source-over state.
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    beginFieldRaster(layer: 0 | 1 | 2, cols: number, rows: number): Float32Array | null {
        return this.fieldRasterSurface.beginFieldRaster(layer, cols, rows);
    }

    drawFieldRaster(
        layer: 0 | 1 | 2,
        dstX: number, dstY: number, dstW: number, dstH: number,
        gain: number,
        blend: FieldRasterBlendMode
    ) {
        const target = this.target;
        const ctx = target.drawingContext as CanvasRenderingContext2D;
        this.fieldRasterSurface.drawFieldRaster(layer, ctx, dstX, dstY, dstW, dstH, gain, blend);
    }
}
