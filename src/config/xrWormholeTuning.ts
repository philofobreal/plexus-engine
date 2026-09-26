import type { MvpMacroTuning } from './macroTuningMapper';
import { defaultAdvancedBoosts, type AdvancedBoosts } from './metaTuningBoost';

// User-authored MVP slider positions, not raw effect values. Applied through resolveMetaTuning.
export const XR_WORMHOLE_MACROS: Readonly<MvpMacroTuning> = Object.freeze({ intensity: 1, motion: 1, depth: 0.3, detail: 1 });
export const XR_WORMHOLE_BOOSTS: Readonly<AdvancedBoosts> = Object.freeze({
    ...defaultAdvancedBoosts(),
    wormholeNebulaAmount: 0, wormholeNebulaDetail: 0.5, wormholeNebulaBloom: 0.5, wormholeNebulaWeave: 0.5,
    wormholeSpiral: 0, wormholeSpiralArms: 0.5, wormholeGrainDensity: 1,
    postFxFragmentAmount: 0, postFxFragmentDisplacement: 0, postFxFragmentDensity: 0,
    lineAlpha: 1, lineWeight: 1, wormholeGrainShape: 1
});
