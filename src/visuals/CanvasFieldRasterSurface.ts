import type { FieldRasterBlendMode } from './RendererBackend';

/**
 * Renderer-private buffer ownership for the corrected grain-material gate's retained W4 seam.
 * Modeled directly on `CanvasPostFxSurface`: DOM-optional via an injected canvas
 * factory, lazy allocation on first real use, resize only on an actual dimension change, and
 * allocation/resize counters for testability.
 *
 * Owns renderer buffers, ImageData, offscreen canvases, blit, and resize for three independent
 * material layers (0/1/2). Zero material math lives here -
 * this class only converts an already-filled RGBA float buffer into pixels and blits it.
 */

const FIELD_RASTER_LAYER_COUNT = 3;
/** Hostile-identity guard: refuse any request above the measured 640x360 ceiling. */
export const MAX_FIELD_RASTER_PIXELS = 640 * 360;

const DITHER_SIZE = 8;
const DITHER_MASK = DITHER_SIZE - 1;

/**
 * Ordered 8x8 Bayer thresholds in [-0.5, 0.5), built once at module load.
 *
 * A broad, low-amplitude haze layer lands in the first few 8-bit codes, where plain rounding turns
 * a smooth field into visible contour steps that read as blocks once the small raster is upscaled
 * to the viewport. An ordered threshold is a fixed function of pixel position, so it removes that
 * banding without introducing any frame-dependent or random state.
 */
const DITHER_THRESHOLDS = buildDitherThresholds();

function buildDitherThresholds(): Float32Array {
    const thresholds = new Float32Array(DITHER_SIZE * DITHER_SIZE);
    for (let y = 0; y < DITHER_SIZE; y++) {
        for (let x = 0; x < DITHER_SIZE; x++) {
            const mixed = x ^ y;
            let value = 0;
            for (let bit = 2; bit >= 0; bit--) {
                value = (value << 1) | ((y >> bit) & 1);
                value = (value << 1) | ((mixed >> bit) & 1);
            }
            thresholds[y * DITHER_SIZE + x] = value / (DITHER_SIZE * DITHER_SIZE) - 0.5;
        }
    }
    return thresholds;
}

export type FieldRasterCanvasFactory = () => HTMLCanvasElement;

function defaultFieldRasterCanvasFactory(): HTMLCanvasElement {
    if (typeof document === 'undefined') throw new Error('Field raster surface requires a DOM canvas factory.');
    return document.createElement('canvas');
}

interface FieldRasterLayerState {
    cols: number;
    rows: number;
    buffer: Float32Array | null;
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    imageData: ImageData | null;
    allocationCount: number;
    resizeCount: number;
}

function createLayerState(): FieldRasterLayerState {
    return {
        cols: 0,
        rows: 0,
        buffer: null,
        canvas: null,
        ctx: null,
        imageData: null,
        allocationCount: 0,
        resizeCount: 0
    };
}

export class CanvasFieldRasterSurface {
    private readonly createCanvas: FieldRasterCanvasFactory;
    private readonly layers: FieldRasterLayerState[];

    constructor(createCanvas: FieldRasterCanvasFactory = defaultFieldRasterCanvasFactory) {
        this.createCanvas = createCanvas;
        this.layers = [];
        for (let i = 0; i < FIELD_RASTER_LAYER_COUNT; i++) this.layers.push(createLayerState());
    }

    /** Diagnostics only: proves single lazy allocation per layer. */
    bufferAllocationCount(layer: 0 | 1 | 2): number {
        return this.layers[layer].allocationCount;
    }

    /** Diagnostics only: proves resize-only-on-real-dimension-change per layer. */
    bufferResizeCount(layer: 0 | 1 | 2): number {
        return this.layers[layer].resizeCount;
    }

    /**
     * Returns the renderer-owned, reused Float32Array scratch for one layer, allocating or
     * resizing it (and its paired offscreen canvas) only when needed. Returns null and allocates
     * nothing when the request is malformed or exceeds the per-layer pixel cap.
     */
    beginFieldRaster(layer: 0 | 1 | 2, cols: number, rows: number): Float32Array | null {
        const safeCols = Math.floor(cols);
        const safeRows = Math.floor(rows);
        if (!(safeCols > 0) || !(safeRows > 0)) return null;
        if (safeCols * safeRows > MAX_FIELD_RASTER_PIXELS) return null;

        const state = this.layers[layer];
        const isFirstAllocation = !state.buffer || !state.canvas;
        const dimensionsChanged = state.cols !== safeCols || state.rows !== safeRows;

        if (isFirstAllocation) {
            state.buffer = new Float32Array(safeCols * safeRows * 4);
            state.canvas = this.createCanvas();
            state.canvas.width = safeCols;
            state.canvas.height = safeRows;
            state.ctx = state.canvas.getContext('2d');
            state.imageData = state.ctx ? state.ctx.createImageData(safeCols, safeRows) : null;
            state.allocationCount++;
            state.resizeCount++;
            state.cols = safeCols;
            state.rows = safeRows;
        } else if (dimensionsChanged) {
            state.buffer = new Float32Array(safeCols * safeRows * 4);
            state.canvas!.width = safeCols;
            state.canvas!.height = safeRows;
            // Resizing a canvas element resets its 2D context state in real browsers; refresh it.
            state.ctx = state.canvas!.getContext('2d');
            state.imageData = state.ctx ? state.ctx.createImageData(safeCols, safeRows) : null;
            state.resizeCount++;
            state.cols = safeCols;
            state.rows = safeRows;
        }

        return state.buffer;
    }

    /**
     * Converts the current float buffer for `layer` into 8-bit pixels (gain-scaled, clamped) and
     * blits it into `dstX/dstY/dstW/dstH` on `targetCtx`, using the bilinear upscale itself as the
     * blur for the carrier-derived bloom layers. No-op when the layer was never filled or the
     * destination rect is degenerate. Always restores `globalCompositeOperation` to
     * 'source-over' and leaves no other dirty context state, even mid-way through a throw.
     */
    drawFieldRaster(
        layer: 0 | 1 | 2,
        targetCtx: CanvasRenderingContext2D,
        dstX: number,
        dstY: number,
        dstW: number,
        dstH: number,
        gain: number,
        blend: FieldRasterBlendMode
    ): void {
        const state = this.layers[layer];
        if (!state.buffer || !state.canvas || !state.ctx || !state.imageData) return;
        if (!(dstW > 0) || !(dstH > 0)) return;
        if (!Number.isFinite(dstX) || !Number.isFinite(dstY)) return;

        const safeGain = Number.isFinite(gain) ? gain : 0;
        const src = state.buffer;
        const pixels = state.imageData.data;
        let index = 0;
        for (let y = 0; y < state.rows; y++) {
            const ditherRow = (y & DITHER_MASK) * DITHER_SIZE;
            for (let x = 0; x < state.cols; x++) {
                // The threshold stays below half a code, so an exactly zero channel still rounds to
                // 0 and a fully cleared layer stays fully transparent.
                const threshold = DITHER_THRESHOLDS[ditherRow + (x & DITHER_MASK)];
                for (let channel = 0; channel < 4; channel++) {
                    // Uint8ClampedArray assignment clamps NaN -> 0 and +-Infinity -> 0/255 per spec,
                    // so malformed source channels cannot leak a NaN pixel even without a guard.
                    pixels[index] = src[index] * safeGain * 255 + threshold;
                    index++;
                }
            }
        }
        state.ctx.putImageData(state.imageData, 0, 0);

        const safeBlend: FieldRasterBlendMode =
            blend === 'screen' || blend === 'lighter' || blend === 'source-over' ? blend : 'source-over';

        targetCtx.save();
        try {
            targetCtx.imageSmoothingEnabled = true;
            targetCtx.globalCompositeOperation = safeBlend;
            targetCtx.drawImage(state.canvas, 0, 0, state.cols, state.rows, dstX, dstY, dstW, dstH);
        } finally {
            targetCtx.restore();
            // Same discipline as compositeRingTint: every primitive returns the shared target to
            // the canonical source-over state rather than restoring an arbitrary prior mode.
            targetCtx.globalCompositeOperation = 'source-over';
        }
    }
}
