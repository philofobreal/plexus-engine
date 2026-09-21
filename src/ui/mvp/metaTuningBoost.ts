import { visualTuningControls, type VisualTuningKey } from '../../config/visualTuning';

/**
 * The MVP's "meta tuning" layer (Visual character macros + Advanced tuning per-parameter sliders):
 * both panels are boost/cut knobs layered on top of whatever the currently active preset,
 * automation point, or dramaturgy layer authors for a key -- never a value baked into or replacing
 * that authored signal. A slider always reads as a *gain* applied to "whatever is already
 * happening", not as an absolute number, so it stays meaningful across every preset/moment
 * instead of only the one that happened to be active when the panel was opened.
 *
 * `fraction` is the slider's own position, 0..1, matching the 0-100 range inputs both panels use
 * (0.5 = the physical center = neutral, no change).
 * - Above center: a genuine multiply, ramping linearly from 1x up to BOOST_GAIN_MAX x.
 * - Below center: a linear fade down to a literal 0x at the very bottom -- deliberately not an
 *   asymptotic divide, so "take it away completely" (0x) is an actually reachable slider position,
 *   not a limit you can only approach.
 */
export const BOOST_GAIN_MAX = 4;
export const NEUTRAL_BOOST = 0.5;

export function boostFactor(fraction: number): number {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : NEUTRAL_BOOST));
    const t = (clamped - NEUTRAL_BOOST) * 2; // -1..+1
    return t >= 0 ? 1 + t * (BOOST_GAIN_MAX - 1) : 1 + t;
}

const controlBoundsByKey = new Map(visualTuningControls.map((control) => [control.key, control]));

export function clampToControlBounds(key: VisualTuningKey, value: number): number {
    const control = controlBoundsByKey.get(key);
    return control ? Math.min(control.max, Math.max(control.min, value)) : value;
}

export interface AdvancedBoostGroup {
    title: string;
    keys: VisualTuningKey[];
}

// The fine-grained per-parameter boosts the Advanced tuning panel exposes (design doc guidance:
// expose grain material in full; Post FX and Lines per the attached screenshots). lineHue/
// lineDistance stay excluded -- CosmicWormholeIdentity never reads either one, so on the MVP's
// locked-to-Wormhole surface they'd be dead sliders.
export const ADVANCED_BOOST_GROUPS: AdvancedBoostGroup[] = [
    {
        title: 'Grain material',
        keys: [
            'wormholeNebulaAmount', 'wormholeNebulaDetail', 'wormholeNebulaBloom', 'wormholeNebulaWeave',
            'wormholeSpiral', 'wormholeSpiralArms', 'wormholeGrainDensity'
        ]
    },
    {
        title: 'Post FX',
        keys: ['postFxFragmentAmount', 'postFxFragmentDisplacement', 'postFxFragmentDensity']
    },
    {
        title: 'Lines',
        keys: ['lineAlpha', 'lineWeight', 'wormholeGrainShape']
    }
];

export const advancedBoostKeys: VisualTuningKey[] = ADVANCED_BOOST_GROUPS.flatMap((group) => group.keys);

export type AdvancedBoosts = Record<VisualTuningKey, number>;

/** Selectors are absolute choices; continuous controls retain their boost/cut semantics.
 *  Both share the existing per-track Save/Reset payload. Missing legacy choices use option 0. */
export function resolveAdvancedTuningValue(key: VisualTuningKey, value: number, base: number): number {
    const control = controlBoundsByKey.get(key);
    if (control?.options) {
        return control.options.find((option) => option.value === value)?.value ?? control.options[0].value;
    }
    return clampToControlBounds(key, base * boostFactor(value));
}

export function defaultAdvancedBoosts(): AdvancedBoosts {
    const out = {} as AdvancedBoosts;
    for (const key of advancedBoostKeys) out[key] = controlBoundsByKey.get(key)?.options?.[0].value ?? NEUTRAL_BOOST;
    return out;
}
