// Player switch for World Formation (ADR-010). Pure data, presentation scope: the world never
// changes the chart, judging or score, so switching it applies live. Off hides every world draw
// and the world UI (the original game); Reduced halves the mobile units and the flow particles.

export type XrWorldMode = 'off' | 'reduced' | 'full';

export interface XrWorldSettings {
    readonly mode: XrWorldMode;
}

export const XR_WORLD_MODES: readonly XrWorldMode[] = ['off', 'reduced', 'full'];

export const DEFAULT_XR_WORLD_SETTINGS: XrWorldSettings = Object.freeze({ mode: 'full' });

/** Unknown or missing values (older saved records) take the default. */
export function normalizeWorldSettings(settings?: Partial<XrWorldSettings> | null): XrWorldSettings {
    const mode = settings?.mode;
    return { mode: mode && XR_WORLD_MODES.includes(mode) ? mode : DEFAULT_XR_WORLD_SETTINGS.mode };
}
