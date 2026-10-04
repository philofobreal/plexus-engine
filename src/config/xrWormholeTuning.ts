import type { MvpMacroTuning } from './macroTuningMapper';
import { defaultAdvancedBoosts, type AdvancedBoosts } from './metaTuningBoost';

// User-authored MVP slider positions, not raw effect values. Applied through resolveMetaTuning.
// Also the defaults of the XR menu's Visual character sliders (ADR-009 Addendum T: Depth 10).
export const XR_WORMHOLE_MACROS: Readonly<MvpMacroTuning> = Object.freeze({ intensity: 1, motion: 1, depth: 0.1, detail: 1 });
// XR host defaults authored by the user on 2026-10-03 (Nebula on at half amount with full detail,
// bloom and weave; a hint of spiral; half grain density). `lineWeight` is also the default of the
// player's Line stroke slider (XrBackgroundSettings): 34 since ADR-009 Addendum T.
export const XR_WORMHOLE_BOOSTS: Readonly<AdvancedBoosts> = Object.freeze({
    ...defaultAdvancedBoosts(),
    wormholeNebulaAmount: 0.5, wormholeNebulaDetail: 1, wormholeNebulaBloom: 1, wormholeNebulaWeave: 1,
    wormholeSpiral: 0.04, wormholeSpiralArms: 0.5, wormholeGrainDensity: 0.5,
    postFxFragmentAmount: 0, postFxFragmentDisplacement: 0, postFxFragmentDensity: 0,
    lineAlpha: 1, lineWeight: 0.34, wormholeGrainShape: 1
});
