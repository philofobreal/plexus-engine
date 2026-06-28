import type { VisualMode } from '../types';

// generatorRouting - PURE, DOM-free routing decisions for the performance-plan generator
// (ADR-005). Extracted from DashboardUI so the "which generator runs" and "which style pack
// matches the visual mode" rules are unit-testable without a browser/DOM. No IO, no state.

// Visual OS is the generator for the 'dramaturgy' strategy only. This is an allowlist, not a
// denylist: 'strict'/'hero' and any unknown/typo/future strategy fall through to the legacy
// generator, and forceLegacyDramaturgy is a debug/legacy override that bypasses Visual OS.
export function shouldUseVisualOs(strategy: string, forceLegacyDramaturgy: boolean): boolean {
    return strategy === 'dramaturgy' && !forceLegacyDramaturgy;
}

// The top-right Visual Mode drives the default Visual OS style pack so the main visual styles
// replace the old temporal-substyle logic. Maps 1:1 to style-packs.json pack ids (the only
// non-identity case is 'temporal' -> 'base-temporal'). A mode with no mapping leaves the
// current pack untouched.
export const VISUAL_MODE_TO_STYLE_PACK: Record<VisualMode, string> = {
    classic: 'classic',
    temporal: 'base-temporal',
    'dark-techno': 'dark-techno',
    'organic-ambient': 'organic-ambient',
    cyberpunk: 'cyberpunk',
    'cosmic-wormhole': 'cosmic-wormhole',
    hero: 'hero'
};

export function stylePackForVisualMode(mode: string): string | undefined {
    return (VISUAL_MODE_TO_STYLE_PACK as Record<string, string>)[mode];
}
