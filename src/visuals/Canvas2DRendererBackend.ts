import { CanvasFieldRasterSurface } from './CanvasFieldRasterSurface';
import type { FieldRasterBlendMode, RingTintCompositeMode, VisualRendererBackend } from './RendererBackend';

/** Canvas primitive adapter for embedded identities; no p5 instance or independent render loop. */
export class Canvas2DRendererBackend implements VisualRendererBackend {
    readonly canvas: HTMLCanvasElement;
    readonly compactMaterialPreview = true;
    frameCount = 0;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly raster = new CanvasFieldRasterSurface();
    private strokeActive = true;
    private fillActive = true;
    private firstVertex = true;
    constructor(width: number, height: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width; this.canvas.height = height;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Wormhole canvas is unavailable.');
        this.ctx = ctx; ctx.lineCap = 'round';
    }
    get width(): number { return this.canvas.width; }
    get height(): number { return this.canvas.height; }
    background(r: number, g: number, b: number, a = 255): void {
        this.ctx.save(); this.ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
        this.ctx.clearRect(0, 0, this.width, this.height); this.ctx.fillRect(0, 0, this.width, this.height); this.ctx.restore();
    }
    noStroke(): void { this.strokeActive = false; }
    noFill(): void { this.fillActive = false; }
    fill(r: number, g: number, b: number, a = 255): void { this.fillActive = true; this.ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`; }
    stroke(r: number, g: number, b: number, a = 255): void { this.strokeActive = true; this.ctx.strokeStyle = `rgba(${r},${g},${b},${a / 255})`; }
    strokeWeight(weight: number): void { this.ctx.lineWidth = Math.max(0.0001, weight); }
    line(x1: number, y1: number, x2: number, y2: number, cap?: 'round' | 'square'): void {
        if (!this.strokeActive) return;
        this.ctx.lineCap = cap ?? 'round'; this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke();
    }
    private paint(): void { if (this.fillActive) this.ctx.fill(); if (this.strokeActive) this.ctx.stroke(); }
    circle(x: number, y: number, diameter: number): void { this.ctx.beginPath(); this.ctx.arc(x, y, Math.max(0, diameter / 2), 0, Math.PI * 2); this.paint(); }
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.lineTo(x3, y3); this.ctx.closePath(); this.paint();
    }
    beginShape(): void { this.ctx.beginPath(); this.firstVertex = true; }
    vertex(x: number, y: number): void { if (this.firstVertex) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y); this.firstVertex = false; }
    endShape(): void { this.paint(); }
    radialGlow(cx: number, cy: number, radius: number, color: [number, number, number], alpha: number): void {
        const glow = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        glow.addColorStop(0, `rgba(${color.join(',')},${alpha})`); glow.addColorStop(1, 'rgba(8,5,14,0)');
        this.ctx.save(); this.ctx.fillStyle = glow; this.ctx.beginPath(); this.ctx.arc(cx, cy, radius, 0, Math.PI * 2); this.ctx.fill(); this.ctx.restore();
    }
    radialDim(cx: number, cy: number, inner: number, outer: number, alpha: number): void {
        const dim = this.ctx.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, Math.max(inner + 1, outer));
        dim.addColorStop(0, 'rgba(0,0,0,0)'); dim.addColorStop(1, `rgba(0,0,0,${Math.min(1, Math.max(0, alpha))})`);
        this.ctx.save(); this.ctx.fillStyle = dim; this.ctx.fillRect(0, 0, this.width, this.height); this.ctx.restore();
    }
    compositeRingTint(cx: number, cy: number, inner: number, outer: number, color: [number, number, number], alpha: number,
        mode: RingTintCompositeMode, start?: number, end?: number): void {
        const tint = this.ctx.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, Math.max(inner + 1, outer));
        const rgba = `rgba(${color.join(',')},${Math.min(1, Math.max(0, alpha))})`;
        tint.addColorStop(0, 'rgba(0,0,0,0)'); tint.addColorStop(0.38, rgba); tint.addColorStop(0.68, rgba); tint.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.save();
        try {
            this.ctx.globalCompositeOperation = mode; this.ctx.fillStyle = tint;
            if (start !== undefined && end !== undefined && end > start) {
                this.ctx.beginPath(); this.ctx.moveTo(cx, cy); this.ctx.arc(cx, cy, Math.hypot(this.width, this.height) * 1.5, start, end); this.ctx.closePath(); this.ctx.clip();
            }
            this.ctx.fillRect(0, 0, this.width, this.height);
        } finally { this.ctx.restore(); this.ctx.globalCompositeOperation = 'source-over'; }
    }
    beginFieldRaster(layer: 0 | 1 | 2, cols: number, rows: number): Float32Array | null { return this.raster.beginFieldRaster(layer, cols, rows); }
    drawFieldRaster(layer: 0 | 1 | 2, x: number, y: number, w: number, h: number, gain: number, blend: FieldRasterBlendMode): void {
        this.raster.drawFieldRaster(layer, this.ctx, x, y, w, h, gain, blend);
    }
}
