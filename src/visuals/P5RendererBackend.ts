import p5 from 'p5';
import type { VisualRendererBackend } from './RendererBackend';

export class P5RendererBackend implements VisualRendererBackend {
    private readonly p: p5;
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

    constructor(p: p5) {
        this.p = p;
    }

    get width() {
        return this.p.width;
    }

    get height() {
        return this.p.height;
    }

    get frameCount() {
        return this.p.frameCount;
    }

    background(r: number, g: number, b: number, a = 255) {
        this.p.background(r, g, b, a);
    }

    noStroke() {
        if (this.strokeActive) {
            this.p.noStroke();
            this.strokeActive = false;
        }
    }

    noFill() {
        if (this.fillActive) {
            this.p.noFill();
            this.fillActive = false;
        }
    }

    fill(r: number, g: number, b: number, a = 255) {
        if (!this.fillActive || this.lastFillR !== r || this.lastFillG !== g || this.lastFillB !== b || this.lastFillA !== a) {
            this.p.fill(r, g, b, a);
            this.lastFillR = r;
            this.lastFillG = g;
            this.lastFillB = b;
            this.lastFillA = a;
            this.fillActive = true;
        }
    }

    stroke(r: number, g: number, b: number, a = 255) {
        if (!this.strokeActive || this.lastStrokeR !== r || this.lastStrokeG !== g || this.lastStrokeB !== b || this.lastStrokeA !== a) {
            this.p.stroke(r, g, b, a);
            this.lastStrokeR = r;
            this.lastStrokeG = g;
            this.lastStrokeB = b;
            this.lastStrokeA = a;
            this.strokeActive = true;
        }
    }

    strokeWeight(weight: number) {
        if (this.lastStrokeWeight !== weight) {
            this.p.strokeWeight(weight);
            this.lastStrokeWeight = weight;
        }
    }

    line(x1: number, y1: number, x2: number, y2: number) {
        this.p.line(x1, y1, x2, y2);
    }

    circle(x: number, y: number, diameter: number) {
        this.p.circle(x, y, diameter);
    }

    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
        this.p.triangle(x1, y1, x2, y2, x3, y3);
    }

    beginShape() {
        this.p.beginShape();
    }

    vertex(x: number, y: number) {
        this.p.vertex(x, y);
    }

    endShape() {
        this.p.endShape();
    }

    radialGlow(cx: number, cy: number, radius: number, color: [number, number, number], alpha: number) {
        const ctx = this.p.drawingContext as CanvasRenderingContext2D;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        glow.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
        glow.addColorStop(1, 'rgba(8, 5, 14, 0)');
        ctx.fillStyle = glow;
        this.noStroke();
        this.p.circle(cx, cy, radius * 2);
    }
}
