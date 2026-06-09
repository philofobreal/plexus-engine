import p5 from 'p5';
import type { VisualRendererBackend } from './RendererBackend';

export class P5RendererBackend implements VisualRendererBackend {
    private readonly p: p5 | p5.Graphics;
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
}
