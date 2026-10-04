// Player-facing technical switches of the /xr/ host (ADR-009 Addendum X). Pure data: how the
// background's grain material is rendered and whether the in-headset diagnostics line runs. They
// never change the chart, the score or what the presets author, only where the work happens.

/** GPU: the main WebGL context draws the grain material from the carrier list (Addendum W). CPU: the background thread rasterizes it. */
export type XrMaterialRenderer = 'gpu' | 'cpu';

export interface XrSystemSettings {
    /** Requested grain material renderer; GPU falls back to CPU where half-float targets are unavailable. */
    readonly materialRenderer: XrMaterialRenderer;
    /** Background profiling and the fps / stage-time line on the menu's main and pause screens (Addendum U). */
    readonly diagnostics: boolean;
}

export const XR_MATERIAL_RENDERERS: readonly XrMaterialRenderer[] = ['gpu', 'cpu'];

/** GPU material, diagnostics off (ADR-009 Addendum X). */
export const DEFAULT_XR_SYSTEM_SETTINGS: XrSystemSettings = Object.freeze({ materialRenderer: 'gpu', diagnostics: false });

export function normalizeSystemSettings(settings?: Partial<XrSystemSettings> | null): XrSystemSettings {
    const d = DEFAULT_XR_SYSTEM_SETTINGS;
    const renderer = settings?.materialRenderer;
    return {
        materialRenderer: renderer && XR_MATERIAL_RENDERERS.includes(renderer) ? renderer : d.materialRenderer,
        diagnostics: typeof settings?.diagnostics === 'boolean' ? settings.diagnostics : d.diagnostics
    };
}
