// Player-facing technical switches of the /xr/ host (ADR-009 Addenda X, Z, AA, AE, AF). Pure data: how the
// background's grain material and trail lines are rendered, how its redraws are paced, and whether
// the in-headset diagnostics line runs. They never change the chart, the score or what the presets
// author, only where the work happens.

/** GPU: the main WebGL context draws the grain material from the carrier list (Addendum W). CPU: the background thread rasterizes it. */
export type XrMaterialRenderer = 'gpu' | 'cpu';
/** Where the grain trail lines are drawn (Addendum AA): the background canvas (default) or the headset GPU. */
export type XrGrainLines = 'canvas' | 'gpu';
/** Background cadence (Addendum Z): the requested whole-frame divider, or widened to fit late worker frames. */
export type XrBackgroundPacing = 'fixed' | 'adaptive';
/**
 * How the background image is rasterized: by the browser's GPU canvas (Canvas2D, whose strokes replay
 * one by one on the GPU thread that also runs the headset's frame), in software on the background
 * thread (Addendum AE), or by WebGL2 on the background thread in a few batched draw calls (Addendum AF).
 */
export type XrBackgroundRaster = 'gpu' | 'cpu' | 'webgl';

export interface XrSystemSettings {
    /** Requested grain material renderer; GPU falls back to CPU where half-float targets are unavailable. */
    readonly materialRenderer: XrMaterialRenderer;
    /** Background profiling and the fps / stage-time line on the menu's main and pause screens (Addendum U). */
    readonly diagnostics: boolean;
    /** GPU lines need the GPU material; with the CPU material they stay on the canvas. */
    readonly grainLines: XrGrainLines;
    readonly backgroundPacing: XrBackgroundPacing;
    readonly backgroundRaster: XrBackgroundRaster;
}

export const XR_MATERIAL_RENDERERS: readonly XrMaterialRenderer[] = ['gpu', 'cpu'];
export const XR_GRAIN_LINES: readonly XrGrainLines[] = ['canvas', 'gpu'];
export const XR_BACKGROUND_PACINGS: readonly XrBackgroundPacing[] = ['fixed', 'adaptive'];
export const XR_BACKGROUND_RASTERS: readonly XrBackgroundRaster[] = ['gpu', 'cpu', 'webgl'];

/**
 * Authored 2026-10-11 (ADR-009 Addendum AC): GPU material, diagnostics on, GPU grain lines and adaptive
 * pacing (Addenda X, AA, Z); the batched WebGL background raster (Addendum AF; the Canvas2D GPU
 * raster replays thousands of strokes on the browser's GPU thread, and the CPU raster judders more often).
 */
export const DEFAULT_XR_SYSTEM_SETTINGS: XrSystemSettings = Object.freeze({ materialRenderer: 'gpu', diagnostics: true,
    grainLines: 'gpu', backgroundPacing: 'adaptive', backgroundRaster: 'webgl' });

export function normalizeSystemSettings(settings?: Partial<XrSystemSettings> | null): XrSystemSettings {
    const d = DEFAULT_XR_SYSTEM_SETTINGS;
    const renderer = settings?.materialRenderer;
    return {
        materialRenderer: renderer && XR_MATERIAL_RENDERERS.includes(renderer) ? renderer : d.materialRenderer,
        diagnostics: typeof settings?.diagnostics === 'boolean' ? settings.diagnostics : d.diagnostics,
        grainLines: settings?.grainLines && XR_GRAIN_LINES.includes(settings.grainLines) ? settings.grainLines : d.grainLines,
        backgroundPacing: settings?.backgroundPacing && XR_BACKGROUND_PACINGS.includes(settings.backgroundPacing) ? settings.backgroundPacing : d.backgroundPacing,
        backgroundRaster: settings?.backgroundRaster && XR_BACKGROUND_RASTERS.includes(settings.backgroundRaster) ? settings.backgroundRaster : d.backgroundRaster
    };
}
