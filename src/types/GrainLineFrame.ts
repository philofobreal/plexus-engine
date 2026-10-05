// Shared layout of the Wormhole grain trail lines as plain data (ADR-009 Addendum AA). When the XR
// host draws them on the GPU, the producer (`src/visuals`) records each grain's line -- the stroke
// it would otherwise put on the Canvas2D raster -- and the XR line renderer (`src/xr/scene`) draws
// the list with the same coverage and source-over compositing. Plain data only.

/** Float32 values per line. */
export const GRAIN_LINE_STRIDE = 9;

/** Offsets inside one line record (raster pixel space, +y down, origin at the top-left). */
export const GRAIN_LINE = Object.freeze({
    X1: 0,
    Y1: 1,
    X2: 2,
    Y2: 3,
    /** Stroke width in raster pixels (Canvas2D `lineWidth`). */
    WIDTH: 4,
    /** Colour as Canvas2D stores it: 0-255 channels rounded to integers, divided by 255. */
    R: 5,
    G: 6,
    B: 7,
    /** Stroke alpha in [0, 1]. */
    A: 8
});

/** One frame's grain trail lines, drawn in record order (source-over, like the Canvas2D strokes). */
export interface GrainLineFrame {
    /** Raster size the lines are expressed in (the background canvas). */
    readonly width: number;
    readonly height: number;
    /** Square caps for every line of the frame (`wormholeGrainShape` 1), otherwise round caps. */
    readonly square: boolean;
    /** Valid lines in `data` (each `GRAIN_LINE_STRIDE` floats). */
    readonly count: number;
    readonly data: Float32Array;
}
