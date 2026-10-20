import type { MvpMacroTuning } from './macroTuningMapper';
import { defaultAdvancedBoosts, type AdvancedBoosts } from './metaTuningBoost';

// User-authored MVP slider positions, not raw effect values. Applied through resolveMetaTuning.
// Also the defaults of the XR menu's Visual character sliders (ADR-009 Addendum T; Depth 30 since Addendum AC).
export const XR_WORMHOLE_MACROS: Readonly<MvpMacroTuning> = Object.freeze({ intensity: 1, motion: 1, depth: 0.3, detail: 1 });
// XR host defaults authored by the user (revised 2026-10-16): Nebula and spiral twist at 30%,
// full detail, bloom, weave, spiral arms and grain density. `lineWeight` also supplies the
// player's Line stroke default (XrBackgroundSettings): 30%.
export const XR_WORMHOLE_BOOSTS: Readonly<AdvancedBoosts> = Object.freeze({
    ...defaultAdvancedBoosts(),
    wormholeNebulaAmount: 0.3, wormholeNebulaDetail: 1, wormholeNebulaBloom: 1, wormholeNebulaWeave: 1,
    wormholeSpiral: 0.3, wormholeSpiralArms: 1, wormholeGrainDensity: 1,
    postFxFragmentAmount: 0, postFxFragmentDisplacement: 0, postFxFragmentDensity: 0,
    lineAlpha: 1, lineWeight: 0.3, wormholeGrainShape: 1
});
