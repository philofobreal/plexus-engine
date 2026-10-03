// User-facing generation settings for the XR score and their motor translation (ADR-009).
// Activity and Variation keep their Visual OS meanings (density axis, complexity axis); the hand
// settings are an orthogonal third axis describing how the two hands relate. Pure data only.

import type { DramaturgyActivityLevel, DramaturgyVariantMode } from '../types';

/** How the two hands relate to each other. */
export type HandPattern = 'alternate' | 'call-response' | 'together' | 'independent';
/** Which hand carries the primary events. */
export type HandLead = 'left' | 'even' | 'right';
/** Physical demand envelope: spacing floors, hand speed, density ceiling and hard-move budget. */
export type RhythmDifficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'ultra';
/** How the play space is shared: own half only, a shared center lane, or crossing into the other half. */
export type HandZones = 'split' | 'shared' | 'cross';
/**
 * How tall the play space is: the three standard rows, or Tall (wider row spacing plus a rare
 * overhead row on big moments, ADR-009 Addendum M).
 */
export type PlaySpace = 'standard' | 'tall';

export interface RhythmGenerationSettings {
    /** Player demand: how fast, how dense and how hard the physical sequences may get. */
    readonly difficulty: RhythmDifficulty;
    /** Density axis: how much the player has to do (Calm / Balanced / Active). */
    readonly activity: DramaturgyActivityLevel;
    /** Complexity axis: how varied the phrases are (Stable / Paired / Expressive). */
    readonly variation: DramaturgyVariantMode;
    readonly handPattern: HandPattern;
    readonly handLead: HandLead;
    readonly zones: HandZones;
    readonly playSpace: PlaySpace;
}

/** Reproduces the historical chart byte-for-byte. */
export const DEFAULT_RHYTHM_GENERATION_SETTINGS: RhythmGenerationSettings = Object.freeze({
    difficulty: 'normal', activity: 'balanced', variation: 'paired', handPattern: 'alternate', handLead: 'even', zones: 'split',
    playSpace: 'standard'
});

const ACTIVITIES: readonly DramaturgyActivityLevel[] = ['macro', 'balanced', 'active'];
const VARIATIONS: readonly DramaturgyVariantMode[] = ['stable', 'paired', 'expressive'];
export const HAND_PATTERNS: readonly HandPattern[] = ['alternate', 'call-response', 'together', 'independent'];
export const HAND_LEADS: readonly HandLead[] = ['left', 'even', 'right'];
export const DIFFICULTIES: readonly RhythmDifficulty[] = ['easy', 'normal', 'hard', 'expert', 'ultra'];
export const HAND_ZONES: readonly HandZones[] = ['split', 'shared', 'cross'];
export const PLAY_SPACES: readonly PlaySpace[] = ['standard', 'tall'];
/** Row spacing of the Tall play space; Standard keeps the configured spacing. */
export const TALL_ROW_SPACING_METERS = 0.4;

/**
 * The gameplay configuration of a play space: Standard returns `config` itself (the historical
 * chart and judging space), Tall widens the row spacing. Charts, rendering and judging all use it.
 */
export function playSpaceConfig<T extends { readonly rowSpacingMeters: number }>(config: T, space: PlaySpace): T {
    return space === 'tall' ? { ...config, rowSpacingMeters: TALL_ROW_SPACING_METERS } : config;
}

/** Unknown or missing fields fall back to the defaults. */
export function normalizeGenerationSettings(settings?: Partial<RhythmGenerationSettings>): RhythmGenerationSettings {
    const pick = <T>(value: T | undefined, allowed: readonly T[], fallback: T): T =>
        value !== undefined && allowed.includes(value) ? value : fallback;
    const d = DEFAULT_RHYTHM_GENERATION_SETTINGS;
    return {
        difficulty: pick(settings?.difficulty, DIFFICULTIES, d.difficulty),
        activity: pick(settings?.activity, ACTIVITIES, d.activity),
        variation: pick(settings?.variation, VARIATIONS, d.variation),
        handPattern: pick(settings?.handPattern, HAND_PATTERNS, d.handPattern),
        handLead: pick(settings?.handLead, HAND_LEADS, d.handLead),
        zones: pick(settings?.zones, HAND_ZONES, d.zones),
        playSpace: pick(settings?.playSpace, PLAY_SPACES, d.playSpace)
    };
}

export interface RhythmDifficultyProfile {
    /** Multipliers on the config's global floor, same-hand floor and hand travel speed. */
    readonly globalSpacingScale: number;
    readonly sameHandSpacingScale: number;
    readonly travelScale: number;
    /** Multiplies texture density ceilings (smaller = denser). */
    readonly ceilingScale: number;
    /** Maximum consecutive hard moves (crossings, full-height row jumps) for one hand. */
    readonly hardChain: number;
    /** Multiplier on musically motivated crossing propensity. */
    readonly crossRate: number;
    /** How long the other hand must be clear of the space before/after a crossing or center move. */
    readonly crossClearSec: number;
    /** Largest row change between consecutive single targets of one hand. */
    readonly maxRowStep: number;
    /** Weak onsets become free cuts (Easy). */
    readonly freeCutsOnWeakOnsets: boolean;
    /** A parity conflict reverses the cut instead of freeing it; an unready hand hands over (Hard+). */
    readonly strictSequences: boolean;
    /**
     * Density ceiling multiplier inside calm scenes (intro, breakdown, transition, outro: the
     * breath texture family). Equal to `ceilingScale` except on Ultra, whose calm scenes stay at
     * Normal density so its dense passages have structure (ADR-009 Addendum N).
     */
    readonly calmCeilingScale: number;
    /** Longest dense run (gaps under 0.9 beat) in beats before a one-beat breath; Infinity = no cap. */
    readonly maxRunBeats: number;
    /** Beats of silence before every published section change (0 = none). Fast tempos get two, slow one. */
    readonly sectionSilenceBeats: number;
    /** Single targets are always directional (no breathing dots); pairs may still free a conflicting cut. */
    readonly directionalSingles: boolean;
    /** Extra two-hand accents for every hand pattern (Together's accent windows, twice as long). */
    readonly extraPairs: boolean;
    /** Onsets this close before a two-hand accent are left out, so both hands arrive free. */
    readonly pairPrepSec: number;
    /** A two-hand accent needs both hands free for at least this long. */
    readonly pairClearSec: number;
}

/** Structure fields of every difficulty below Ultra: no structural change to the historical charts. */
const UNSTRUCTURED = { maxRunBeats: Infinity, sectionSilenceBeats: 0, directionalSingles: false, extraPairs: false, pairPrepSec: 0.8, pairClearSec: 0.75 } as const;

const DIFFICULTY_PROFILES: Record<RhythmDifficulty, RhythmDifficultyProfile> = {
    easy: { globalSpacingScale: 2, sameHandSpacingScale: 2, travelScale: 0.75, ceilingScale: 1.5, hardChain: 0,
        crossRate: 0.4, crossClearSec: 1, maxRowStep: 1, freeCutsOnWeakOnsets: true, strictSequences: false,
        calmCeilingScale: 1.5, ...UNSTRUCTURED },
    normal: { globalSpacingScale: 1, sameHandSpacingScale: 1, travelScale: 1, ceilingScale: 1, hardChain: 1,
        crossRate: 1, crossClearSec: 0.5, maxRowStep: 2, freeCutsOnWeakOnsets: false, strictSequences: false,
        calmCeilingScale: 1, ...UNSTRUCTURED },
    hard: { globalSpacingScale: 0.8, sameHandSpacingScale: 0.825, travelScale: 4 / 3, ceilingScale: 0.7, hardChain: 2,
        crossRate: 1.6, crossClearSec: 0.4, maxRowStep: 2, freeCutsOnWeakOnsets: false, strictSequences: true,
        calmCeilingScale: 0.7, ...UNSTRUCTURED },
    expert: { globalSpacingScale: 0.6, sameHandSpacingScale: 0.75, travelScale: 5 / 3, ceilingScale: 0.5, hardChain: 4,
        crossRate: 2.4, crossClearSec: 0.35, maxRowStep: 2, freeCutsOnWeakOnsets: false, strictSequences: true,
        calmCeilingScale: 0.5, ...UNSTRUCTURED },
    // Ultra (ADR-009 Addendum N): denser and faster than Expert where the music drives, with
    // structured pauses -- calm scenes at Normal density, dense runs capped at four bars, a
    // breath before every section change -- and directional singles throughout. Same timing windows.
    ultra: { globalSpacingScale: 0.45, sameHandSpacingScale: 0.55, travelScale: 2.2, ceilingScale: 0.3, hardChain: 6,
        crossRate: 3, crossClearSec: 0.3, maxRowStep: 2, freeCutsOnWeakOnsets: false, strictSequences: true,
        calmCeilingScale: 1, maxRunBeats: 16, sectionSilenceBeats: 2, directionalSingles: true, extraPairs: true, pairPrepSec: 0.5, pairClearSec: 0.45 }
};

export function difficultyProfile(difficulty: RhythmDifficulty): RhythmDifficultyProfile {
    return DIFFICULTY_PROFILES[difficulty];
}

export interface RhythmMotorProfile {
    /** Multiplies every texture's spacing ceiling (Activity owns total density). */
    readonly densityScale: number;
    /** Distinct textures a scene cycles through inside its family (Variation owns complexity). */
    readonly textureVocabulary: number;
    /** Phrases a texture is held for before developing. */
    readonly phrasesPerTexture: number;
    /** Phrase length in beats and its bounds in seconds. */
    readonly phraseBeats: number;
    readonly phraseMinSec: number;
    readonly phraseMaxSec: number;
    /** Cut-direction diversity: 0 vertical-first, 1 historical, 2 widest safe vocabulary. */
    readonly cutDiversity: 0 | 1 | 2;
}

const DENSITY: Record<DramaturgyActivityLevel, number> = { macro: 2, balanced: 1, active: 0.5 };

export function motorProfile(settings: RhythmGenerationSettings): RhythmMotorProfile {
    const densityScale = DENSITY[settings.activity];
    switch (settings.variation) {
        case 'stable':
            return { densityScale, textureVocabulary: 2, phrasesPerTexture: 2, phraseBeats: 16, phraseMinSec: 4, phraseMaxSec: 12, cutDiversity: 0 };
        case 'expressive':
            return { densityScale, textureVocabulary: 4, phrasesPerTexture: 1, phraseBeats: 8, phraseMinSec: 3, phraseMaxSec: 8, cutDiversity: 2 };
        default:
            return { densityScale, textureVocabulary: 4, phrasesPerTexture: 1, phraseBeats: 16, phraseMinSec: 4, phraseMaxSec: 12, cutDiversity: 1 };
    }
}
