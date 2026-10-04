// The /xr/ settings as they were before the authored player defaults (ADR-009 Addendum T): the
// gameplay library's historical generation settings, Normal speed with the Normal saber, Classic
// targets and the Wormhole off at Balanced / 24 Hz. Tests about mechanics (menus, scopes, pacing,
// regeneration) start from this fixed baseline so they do not depend on the shipped defaults.
export function historicalXrSettings(load) {
    const { normalizeXrSettings } = load('xr/XrSettings.ts');
    const { DEFAULT_RHYTHM_GENERATION_SETTINGS } = load('gameplay/index.ts');
    return normalizeXrSettings({
        play: { noteSpeed: 'normal', saberLength: 'normal' },
        generation: DEFAULT_RHYTHM_GENERATION_SETTINGS,
        background: { wormhole: false, quality: 'balanced', rateHz: 24, lineStroke: 0.98, sharpness: 0.5,
            character: { intensity: 1, motion: 1, depth: 0.3, detail: 1 } },
        appearance: { noteDesign: 'classic' }
    });
}
