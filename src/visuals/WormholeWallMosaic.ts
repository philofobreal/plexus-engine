/**
 * Pure geometry for the wormhole wall's optional pixel-mosaic material mode (refractive
 * membrane-wall plan, Phase 8): a coarser depth x angle grid of short, unfilled tick marks instead of
 * the default rippling membrane grid, selected only via the discrete `wormholeWallMode` = 1 switch.
 * Cell *placement* reuses `WormholeWallGeometry`'s exact ring/segment layout functions (no duplicated
 * layout math, just a coarser cell count); cell *displacement* under an active pressure wave reuses
 * `WormholeWallWaves`' existing `wormholeWallWaveOffset` at the call site. This module only adds the
 * mosaic-specific grid sizing and the per-cell tick shape.
 */

export const MOSAIC_RINGS = 12;
export const MOSAIC_RINGS_PERFORMANCE = 6;
/** One cell column per spectral band: every cell maps to exactly one live band, no aliasing. */
export const MOSAIC_SEGMENTS = 24;

export function wormholeMosaicRingCount(performanceMode: boolean): number {
    return performanceMode ? MOSAIC_RINGS_PERFORMANCE : MOSAIC_RINGS;
}

/** Fixed fraction of a cell's own angular span, well short of a neighboring cell's tick. */
const TICK_SPAN_FRACTION = 0.32;

/**
 * Angular half-width of one cell's tick mark. A pure function of `segmentCount` alone: more segments
 * -> narrower cells -> narrower ticks, always comfortably short of `cellSpan / 2` so adjacent ticks
 * never touch or merge into a continuous ring.
 */
export function wormholeMosaicTickHalfWidth(segmentCount: number): number {
    const count = Math.max(1, Math.floor(Number.isFinite(segmentCount) ? segmentCount : 1));
    const cellSpan = (Math.PI * 2) / count;
    return cellSpan * TICK_SPAN_FRACTION;
}
