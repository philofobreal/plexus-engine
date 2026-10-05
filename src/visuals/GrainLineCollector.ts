// Records the grain trail lines of one Wormhole frame as plain data instead of Canvas2D strokes
// (ADR-009 Addendum AA). The values are exactly what `Canvas2DRendererBackend` would have put on
// the context -- colour channels rounded and clamped like a CSS colour, alpha clamped like
// `rgba()`, the backend's minimum width -- so the GPU draw sees the same strokes.

import { GRAIN_LINE, GRAIN_LINE_STRIDE, type GrainLineFrame } from '../types/GrainLineFrame';
import type { WormholeLineSink } from './CosmicWormholeIdentity';

const INITIAL_CAPACITY = 2048;

const channel = (value: number): number => (value > 0 ? Math.min(255, Math.round(value)) : 0) / 255;

export class GrainLineCollector implements WormholeLineSink {
    private data = new Float32Array(INITIAL_CAPACITY * GRAIN_LINE_STRIDE);
    private count = 0;
    private square = false;
    private width = 1;
    private height = 1;

    /** Starts a frame on a raster of the given size (no lines yet). */
    reset(width: number, height: number): void {
        this.count = 0; this.square = false;
        this.width = Math.max(1, Math.floor(width)); this.height = Math.max(1, Math.floor(height));
    }

    /** One stroke, in the backend's units: 0-255 colour channels and alpha. */
    line(x1: number, y1: number, x2: number, y2: number, weight: number, r: number, g: number, b: number, alpha: number, square: boolean): void {
        const a = alpha / 255;
        if (!(a > 0)) return; // a transparent stroke paints nothing
        if ((this.count + 1) * GRAIN_LINE_STRIDE > this.data.length) {
            const grown = new Float32Array(this.data.length * 2);
            grown.set(this.data);
            this.data = grown;
        }
        const o = this.count * GRAIN_LINE_STRIDE, d = this.data;
        d[o + GRAIN_LINE.X1] = x1; d[o + GRAIN_LINE.Y1] = y1; d[o + GRAIN_LINE.X2] = x2; d[o + GRAIN_LINE.Y2] = y2;
        d[o + GRAIN_LINE.WIDTH] = Math.max(0.0001, weight);
        d[o + GRAIN_LINE.R] = channel(r); d[o + GRAIN_LINE.G] = channel(g); d[o + GRAIN_LINE.B] = channel(b);
        d[o + GRAIN_LINE.A] = Math.min(1, a);
        this.square = square;
        this.count++;
    }

    /** The recorded frame (its `data` is reused by the next frame: copy or transfer it first). */
    get frame(): GrainLineFrame {
        return { width: this.width, height: this.height, square: this.square, count: this.count, data: this.data };
    }
}
