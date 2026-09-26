import type { VisualTuningConfig } from '../types';
import { mapMvpMacrosToTuning, type MvpMacroTuning } from './macroTuningMapper';
import { advancedBoostKeys, resolveAdvancedTuningValue, type AdvancedBoosts } from './metaTuningBoost';

/** One coarse/fine gain pipeline for MVP and embedded Wormhole previews. Never compounds. */
export function resolveMetaTuning(raw: VisualTuningConfig, macros: MvpMacroTuning, boosts: AdvancedBoosts, out: VisualTuningConfig): VisualTuningConfig {
    Object.assign(out, raw);
    mapMvpMacrosToTuning(macros, raw, out);
    for (const key of advancedBoostKeys) out[key] = resolveAdvancedTuningValue(key, boosts[key], out[key]);
    return out;
}
