import type { VisualTuningKey } from '../../config/visualTuning';
import type { VisualTuningConfig } from '../../types';
import { boostFactor, clampToControlBounds } from './metaTuningBoost';

/** The MVP's four consumer-facing macro knobs, each normalized 0..1 (0.5 = neutral/no change). */
export interface MvpMacroTuning {
    intensity: number;
    motion: number;
    depth: number;
    detail: number;
}

export const defaultMvpMacroTuning: MvpMacroTuning = {
    intensity: 0.5,
    motion: 0.5,
    depth: 0.5,
    detail: 0.5
};

interface MacroKeyMapping {
    key: VisualTuningKey;
    /** True for a key whose *lower* authored value means "more" of what the macro represents
     *  (e.g. dropDampening: less dampening = a harder-hitting drop = more Intensity), so the
     *  macro's boost is applied against the mirrored (1 - fraction) position instead of the
     *  fraction itself -- pushing Intensity up still visibly pushes this key the same perceptual
     *  direction as every other key in its group, instead of backwards. */
    invert?: boolean;
}

const MACRO_KEY_GROUPS: Record<keyof MvpMacroTuning, MacroKeyMapping[]> = {
    // Intensity: how strongly the visuals react to and glow with the music.
    intensity: [
        { key: 'audioSensitivity' },
        { key: 'buildupIntensity' },
        { key: 'dropDampening', invert: true }
    ],
    // Motion: the wormhole's flight/turbulence character.
    motion: [
        { key: 'wormholeSpeed' },
        { key: 'wormholeWarp' },
        { key: 'wormholeJitter' },
        { key: 'wormholeRadiusLfoAmount' },
        { key: 'transitionSpeed' }
    ],
    // Depth: sense of spatial distance and layering.
    depth: [
        { key: 'wormholeDepth' },
        { key: 'wormholeDepthCoherence' },
        { key: 'wormholeGalaxy' },
        { key: 'wormholeStarfield' },
        { key: 'wormholeRing' }
    ],
    // Detail: the grain material family end-to-end -- every knob the advanced tuning panel
    // exposes for it (Grain material/Material detail/bloom/weave, Spiral twist/arms, Grain
    // density), plus the Post FX fragment amount, not just a subset.
    detail: [
        { key: 'wormholeNebulaAmount' },
        { key: 'wormholeNebulaDetail' },
        { key: 'wormholeNebulaBloom' },
        { key: 'wormholeNebulaWeave' },
        { key: 'wormholeSpiral' },
        { key: 'wormholeSpiralArms' },
        { key: 'wormholeGrainDensity' },
        { key: 'postFxFragmentAmount' }
    ]
};

const MACRO_KEYS = Object.keys(MACRO_KEY_GROUPS) as (keyof MvpMacroTuning)[];

/** Every VisualTuningConfig key any macro can touch, flattened -- kept for callers that need the
 *  full set (e.g. deciding which keys a "whole track" save should cover). */
export const mvpMacroTuningKeys: VisualTuningKey[] = Object.values(MACRO_KEY_GROUPS).flatMap((mappings) =>
    mappings.map((m) => m.key)
);

/**
 * Multiplies `base[key]` -- the preset/automation/dramaturgy layer's own *currently live* value,
 * read fresh every call -- by each macro's boost factor, for every key that macro's group covers.
 * Pure and stateless: there is no anchor here to go stale across preset or automation-point
 * changes (that was the previous "blend toward an authored pole, anchored on a one-time snapshot"
 * design's failure mode -- a preset that didn't redefine a given key let that snapshot silently
 * inherit an already-boosted value, and repeated slider moves would then compound against it
 * instead of the track's own dramaturgy). Callers are responsible for merging the result into
 * wherever it belongs (see MvpVisualController.getBoostedTuning) -- this must never be used to
 * write State directly.
 */
// A host may supply its own scratch output; it must be distinct from the raw base tuning.
// Omitted output preserves the independent partial-result API used by other callers.
export function mapMvpMacrosToTuning(
    macros: MvpMacroTuning, base: VisualTuningConfig, out: Partial<VisualTuningConfig> = {}
): Partial<VisualTuningConfig> {
    for (const macroKey of MACRO_KEYS) {
        const fraction = macros[macroKey];
        for (const { key, invert } of MACRO_KEY_GROUPS[macroKey]) {
            const factor = boostFactor(invert ? 1 - fraction : fraction);
            out[key] = clampToControlBounds(key, base[key] * factor);
        }
    }
    return out;
}
