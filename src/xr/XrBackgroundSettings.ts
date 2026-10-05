// Player-facing presentation settings for the XR Wormhole background (ADR-009). Pure data: these
// never change the shared plan, presets or tuning keys, only how the one background plane is
// rasterized, paced, stroked and sharpened on the GPU.

import { XR_WORMHOLE_BOOSTS, XR_WORMHOLE_MACROS } from '../config/xrWormholeTuning';
import type { GrainMaterialBoostKey } from '../types/CanvasVisualSource';

/** Raster resolution of the single background plane. */
export type XrBackgroundQuality = 'performance' | 'balanced' | 'high' | 'ultra' | 'crystal' | 'max';
/** Background redraws per second while playing; both divide the 72 Hz headset rate evenly. */
export type XrBackgroundRate = 24 | 36;

/** MVP "Visual character" macro slider positions in [0, 1] (0.5 = neutral, no change). */
export interface XrVisualCharacter {
    readonly intensity: number;
    readonly motion: number;
    readonly depth: number;
    readonly detail: number;
}

export const XR_VISUAL_CHARACTER_KEYS: readonly (keyof XrVisualCharacter)[] = ['intensity', 'motion', 'depth', 'detail'];

/**
 * The MVP Advanced tuning panel's "Grain material" sliders in [0, 1] (0.5 = neutral gain on what the
 * preset authors; ADR-009 Addendum V).
 */
export interface XrGrainMaterial {
    readonly amount: number;
    readonly detail: number;
    readonly bloom: number;
    readonly weave: number;
    readonly spiral: number;
    readonly arms: number;
    readonly density: number;
}

/** Each slider's Advanced boost key, in the MVP panel's order. */
export const XR_GRAIN_MATERIAL_KEYS: Readonly<Record<keyof XrGrainMaterial, GrainMaterialBoostKey>> = Object.freeze({
    amount: 'wormholeNebulaAmount', detail: 'wormholeNebulaDetail', bloom: 'wormholeNebulaBloom', weave: 'wormholeNebulaWeave',
    spiral: 'wormholeSpiral', arms: 'wormholeSpiralArms', density: 'wormholeGrainDensity'
});

/** The Grain material sliders as Advanced boosts by tuning key (the source's presentation). */
export function grainMaterialBoosts(grain: XrGrainMaterial): Record<GrainMaterialBoostKey, number> {
    const out = {} as Record<GrainMaterialBoostKey, number>;
    for (const [id, key] of Object.entries(XR_GRAIN_MATERIAL_KEYS) as [keyof XrGrainMaterial, GrainMaterialBoostKey][]) out[key] = grain[id];
    return out;
}

export interface XrBackgroundSettings {
    /** The Wormhole background is shown (on by default; it is the heaviest part of the frame). */
    readonly wormhole: boolean;
    readonly quality: XrBackgroundQuality;
    readonly rateHz: XrBackgroundRate;
    /** MVP Advanced "Line stroke" slider position in [0, 1] (0.5 = neutral gain, 1 = maximum boost). */
    readonly lineStroke: number;
    /**
     * GPU sharpening of the magnified background in [0, 1] (0 = off). The plane spans ~106 degrees,
     * so even 1280 px give ~12 px per degree against a ~20 px/degree headset: the texture is always
     * magnified, and a halo-limited unsharp mask restores the line edges (ADR-009 Addendum P).
     */
    readonly sharpness: number;
    /** Visual character of the Wormhole (ADR-009 Addendum R); defaults to the XR host's authored macros. */
    readonly character: XrVisualCharacter;
    /** MVP Advanced "Grain material" sliders (ADR-009 Addendum V); defaults to the authored XR boosts. */
    readonly grain: XrGrainMaterial;
}

/** Strongest unsharp-mask gain (sharpness 1). */
export const MAX_BACKGROUND_SHARPEN = 1.5;

export const XR_BACKGROUND_QUALITIES: readonly XrBackgroundQuality[] = ['performance', 'balanced', 'high', 'ultra', 'crystal', 'max'];
export const XR_BACKGROUND_RATES: readonly XrBackgroundRate[] = [24, 36];

export const XR_BACKGROUND_RESOLUTION: Readonly<Record<XrBackgroundQuality, { readonly width: number; readonly height: number }>> = {
    performance: { width: 640, height: 360 },
    balanced: { width: 768, height: 432 },
    high: { width: 960, height: 540 },
    ultra: { width: 1280, height: 720 },
    // Optional (ADR-009 Addendum Y): ~12.6 px/degree straight ahead (Ultra ~8.4), still below the ~20
    // px/degree eye buffer; a larger raster would minify the unmipmapped texture off-axis and shimmer.
    crystal: { width: 1920, height: 1080 },
    // ~16.9 px/degree straight ahead: denser than the eye buffer beyond ~25 degrees off axis, so this
    // tier is mipmapped (`XR_BACKGROUND_MIPMAPPED`; ADR-009 Addendum Z).
    max: { width: 2560, height: 1440 }
};

/** Qualities whose plane texture is mipmapped (minified off axis; trilinear filtering keeps lines from shimmering). */
export const XR_BACKGROUND_MIPMAPPED: ReadonlySet<XrBackgroundQuality> = new Set(['max']);

/**
 * Player defaults (ADR-009 Addendum T): the Wormhole on at Ultra / 36 Hz with full sharpening.
 * Line stroke and the Visual character come from the XR host's authored tuning, so the source's
 * starting state and the menu's defaults are one set of values.
 */
export const DEFAULT_XR_BACKGROUND_SETTINGS: XrBackgroundSettings = Object.freeze({
    wormhole: true, quality: 'ultra', rateHz: 36, lineStroke: XR_WORMHOLE_BOOSTS.lineWeight, sharpness: 1,
    character: Object.freeze({ intensity: XR_WORMHOLE_MACROS.intensity, motion: XR_WORMHOLE_MACROS.motion,
        depth: XR_WORMHOLE_MACROS.depth, detail: XR_WORMHOLE_MACROS.detail }),
    grain: Object.freeze(Object.fromEntries((Object.entries(XR_GRAIN_MATERIAL_KEYS) as [keyof XrGrainMaterial, GrainMaterialBoostKey][])
        .map(([id, key]) => [id, XR_WORMHOLE_BOOSTS[key]])) as unknown as XrGrainMaterial)
});

/** Unknown or missing fields fall back to the defaults; Line stroke and sharpness are clamped to [0, 1]. */
export function normalizeBackgroundSettings(settings?: Partial<XrBackgroundSettings>): XrBackgroundSettings {
    const d = DEFAULT_XR_BACKGROUND_SETTINGS;
    const stroke = Number(settings?.lineStroke), sharpness = Number(settings?.sharpness);
    const unit = (value: unknown, fallback: number) => {
        const n = Number(value);
        return value !== undefined && value !== null && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
    };
    const character = settings?.character && typeof settings.character === 'object' ? settings.character : undefined;
    const grain = settings?.grain && typeof settings.grain === 'object' ? settings.grain : undefined;
    return {
        wormhole: typeof settings?.wormhole === 'boolean' ? settings.wormhole : d.wormhole,
        quality: settings?.quality && XR_BACKGROUND_QUALITIES.includes(settings.quality) ? settings.quality : d.quality,
        rateHz: settings?.rateHz && XR_BACKGROUND_RATES.includes(settings.rateHz) ? settings.rateHz : d.rateHz,
        lineStroke: Number.isFinite(stroke) ? Math.min(1, Math.max(0, stroke)) : d.lineStroke,
        sharpness: settings?.sharpness !== undefined && Number.isFinite(sharpness) ? Math.min(1, Math.max(0, sharpness)) : d.sharpness,
        character: {
            intensity: unit(character?.intensity, d.character.intensity), motion: unit(character?.motion, d.character.motion),
            depth: unit(character?.depth, d.character.depth), detail: unit(character?.detail, d.character.detail)
        },
        grain: Object.fromEntries((Object.keys(XR_GRAIN_MATERIAL_KEYS) as (keyof XrGrainMaterial)[])
            .map(id => [id, unit(grain?.[id], d.grain[id])])) as unknown as XrGrainMaterial
    };
}

/**
 * Whole number of display frames between background redraws: never faster than the requested rate,
 * and an exact divisor of the display cadence so every redraw lands on the same frame phase
 * (72 Hz: 24 -> every 3rd frame, 36 -> every 2nd).
 */
export function backgroundFrameDivider(displayHz: number, rateHz: number): number {
    if (!(displayHz > 0) || !(rateHz > 0)) return 1;
    return Math.max(1, Math.ceil(displayHz / rateHz - 1e-6));
}
