// Player-facing technical switches of the /xr/ host (ADR-009 Addenda X, Z, AA). Pure data: how the
// background's grain material and trail lines are rendered, how its redraws are paced, and whether
// the in-headset diagnostics line runs. They never change the chart, the score or what the presets
// author, only where the work happens.

/** GPU: the main WebGL context draws the grain material from the carrier list (Addendum W). CPU: the background thread rasterizes it. */
export type XrMaterialRenderer = 'gpu' | 'cpu';
/** Where the grain trail lines are drawn (Addendum AA): the background canvas (default) or the headset GPU. */
export type XrGrainLines = 'canvas' | 'gpu';
/** Background cadence (Addendum Z): the requested whole-frame divider, or widened to fit late worker frames. */
export type XrBackgroundPacing = 'fixed' | 'adaptive';

export interface XrSystemSettings {
    /** Requested grain material renderer; GPU falls back to CPU where half-float targets are unavailable. */
    readonly materialRenderer: XrMaterialRenderer;
    /** Background profiling and the fps / stage-time line on the menu's main and pause screens (Addendum U). */
    readonly diagnostics: boolean;
    /** GPU lines need the GPU material; with the CPU material they stay on the canvas. */
    readonly grainLines: XrGrainLines;
    readonly backgroundPacing: XrBackgroundPacing;
}

export const XR_MATERIAL_RENDERERS: readonly XrMaterialRenderer[] = ['gpu', 'cpu'];
export const XR_GRAIN_LINES: readonly XrGrainLines[] = ['canvas', 'gpu'];
export const XR_BACKGROUND_PACINGS: readonly XrBackgroundPacing[] = ['fixed', 'adaptive'];

/** GPU material, diagnostics off (ADR-009 Addendum X); canvas lines and fixed pacing (Addenda AA, Z). */
export const DEFAULT_XR_SYSTEM_SETTINGS: XrSystemSettings = Object.freeze({ materialRenderer: 'gpu', diagnostics: false,
    grainLines: 'canvas', backgroundPacing: 'fixed' });

export function normalizeSystemSettings(settings?: Partial<XrSystemSettings> | null): XrSystemSettings {
    const d = DEFAULT_XR_SYSTEM_SETTINGS;
    const renderer = settings?.materialRenderer;
    return {
        materialRenderer: renderer && XR_MATERIAL_RENDERERS.includes(renderer) ? renderer : d.materialRenderer,
        diagnostics: typeof settings?.diagnostics === 'boolean' ? settings.diagnostics : d.diagnostics,
        grainLines: settings?.grainLines && XR_GRAIN_LINES.includes(settings.grainLines) ? settings.grainLines : d.grainLines,
        backgroundPacing: settings?.backgroundPacing && XR_BACKGROUND_PACINGS.includes(settings.backgroundPacing) ? settings.backgroundPacing : d.backgroundPacing
    };
}
