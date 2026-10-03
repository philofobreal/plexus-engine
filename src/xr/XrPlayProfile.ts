// Note speed, saber length and the reach model that places the player (ADR-009 Addendum I), plus
// the play space's rows and frame (Addendum M). Pure: one function turns these settings into the
// gameplay configuration, the stage layout and the blade length, so rendering, judging and the
// saber always agree.
//
// Reach model: the farthest point the saber tip can touch is
//   reach = shoulder offset + arm (shoulder -> grip) + blade base offset + blade + forward lean.
// A target is judged once it is inside the early "good" window, i.e. at most `early * speed` beyond
// the hit plane. To leave no "touched but not sensed" zone, the hit plane distance P must satisfy
//   reach + half a target <= P + early * speed.
// P is clamped to a comfortable band; whatever the clamp leaves uncovered is closed by widening
// the early window, never by letting the player touch a target the judge cannot sense.

import { DEFAULT_RHYTHM_GAME_CONFIG, PLAY_SPACES, playSpaceConfig, type PlaySpace, type RhythmGameConfig } from '../gameplay';
import { SABER_CONFIG } from './runtime/SaberConfig';
import { SCENE_CONFIG, type XrStageLayout } from './scene/SceneConfig';

export type XrNoteSpeed = 'normal' | 'fast' | 'hyper';
/** `auto` follows the play space: Normal length, one step longer in the Tall space. */
export type XrSaberLength = 'short' | 'normal' | 'long' | 'auto';

export interface XrPlaySettings {
    readonly noteSpeed: XrNoteSpeed;
    readonly saberLength: XrSaberLength;
}

export const XR_NOTE_SPEEDS: readonly XrNoteSpeed[] = ['normal', 'fast', 'hyper'];
export const XR_SABER_LENGTHS: readonly XrSaberLength[] = ['short', 'normal', 'long', 'auto'];

export const DEFAULT_XR_PLAY_SETTINGS: XrPlaySettings = Object.freeze({ noteSpeed: 'normal', saberLength: 'normal' });

/** Travel speed and reaction time; spawn distance = speed x approach time. */
export const NOTE_SPEED_PRESETS: Readonly<Record<XrNoteSpeed, { readonly speedMps: number; readonly approachSec: number }>> = {
    normal: { speedMps: 4, approachSec: 2 },
    fast: { speedMps: 7, approachSec: 1.6 },
    hyper: { speedMps: 10, approachSec: 1.4 }
};

export const SABER_BLADE_LENGTHS: Readonly<Record<Exclude<XrSaberLength, 'auto'>, number>> = { short: 0.9, normal: 1, long: 1.1 };
/** Auto blade: Normal in the Standard space, +0.1 m in the Tall space (bigger, higher swings). */
export const AUTO_BLADE_LENGTHS: Readonly<Record<PlaySpace, number>> = { standard: 1, tall: 1.1 };

/** Blade length for a saber setting in a play space. */
export function bladeLengthFor(saberLength: XrSaberLength, playSpace: PlaySpace): number {
    return saberLength === 'auto' ? AUTO_BLADE_LENGTHS[playSpace] : SABER_BLADE_LENGTHS[saberLength];
}

/**
 * Rows, start frame and HUD of each play space, in playfield meters (y = 0 is the middle row).
 * The frame keeps the Standard margin (0.26 m beyond the outer row centers) around its rows:
 * Tall rows sit at -0.40 / 0 / 0.40 / 0.80 (overhead ~ eye + 0.25 m), so the frame spans
 * -0.66 .. 1.06 and the HUD moves beside the runway, out of the overhead row's sight line.
 */
export const PLAY_SPACE_STAGE: Readonly<Record<PlaySpace, Pick<XrStageLayout, 'rowCount' | 'frameCenterYMeters'
    | 'frameHalfHeightMeters' | 'hudPlacement'>>> = {
    standard: { rowCount: 3, frameCenterYMeters: 0, frameHalfHeightMeters: 0.6, hudPlacement: 'above' },
    tall: { rowCount: 4, frameCenterYMeters: 0.2, frameHalfHeightMeters: 0.86, hudPlacement: 'side' }
};

/** Average adult proportions, in meters (shoulder sits slightly behind the tracked eyes). */
export const REACH_MODEL = {
    shoulderOffsetMeters: -0.08,
    armMeters: 0.62,
    leanMeters: 0.1,
    minHitPlaneMeters: 0.85,
    maxHitPlaneMeters: 1.2,
    /** Runway beyond the spawn point, so targets emerge from the track instead of its edge. */
    runwayMarginMeters: 2.5,
    maxRunwayLengthMeters: 18,
    spawnFadeMeters: 1.5
} as const;

export interface XrPlayProfile {
    readonly settings: XrPlaySettings;
    readonly playSpace: PlaySpace;
    readonly config: RhythmGameConfig;
    readonly stage: XrStageLayout;
    readonly bladeLengthMeters: number;
    /** Farthest saber-tip reach from the player origin. */
    readonly reachMeters: number;
}

export function normalizePlaySettings(settings?: Partial<XrPlaySettings> | null): XrPlaySettings {
    const d = DEFAULT_XR_PLAY_SETTINGS;
    return {
        noteSpeed: settings?.noteSpeed && XR_NOTE_SPEEDS.includes(settings.noteSpeed) ? settings.noteSpeed : d.noteSpeed,
        saberLength: settings?.saberLength && XR_SABER_LENGTHS.includes(settings.saberLength) ? settings.saberLength : d.saberLength
    };
}

/** Saber-tip reach for a blade length. */
export function saberReachMeters(bladeLengthMeters: number): number {
    return REACH_MODEL.shoulderOffsetMeters + REACH_MODEL.armMeters + Math.abs(SABER_CONFIG.bladeBaseZMeters)
        + bladeLengthMeters + REACH_MODEL.leanMeters;
}

const profiles = new Map<string, XrPlayProfile>();

/**
 * The profile for play settings in a play space. Memoized: equal inputs return the identical
 * object, so a host can detect "nothing changed" by reference. Note speed and saber length never
 * touch chart-defining fields (spacing, rows, intensity floor); the play space sets the row spacing
 * the chart is generated with (`playSpaceConfig`), so the two always agree.
 */
export function resolvePlayProfile(settings?: Partial<XrPlaySettings> | null, space?: PlaySpace): XrPlayProfile {
    const play = normalizePlaySettings(settings);
    const playSpace: PlaySpace = space !== undefined && PLAY_SPACES.includes(space) ? space : 'standard';
    const key = `${play.noteSpeed}|${play.saberLength}|${playSpace}`;
    const cached = profiles.get(key);
    if (cached) return cached;
    const { speedMps, approachSec } = NOTE_SPEED_PRESETS[play.noteSpeed];
    const bladeLengthMeters = bladeLengthFor(play.saberLength, playSpace);
    const base = playSpaceConfig(DEFAULT_RHYTHM_GAME_CONFIG, playSpace);
    const reachMeters = saberReachMeters(bladeLengthMeters);
    const touchMeters = reachMeters + base.noteSizeMeters / 2;
    const playfieldForwardMeters = Math.min(REACH_MODEL.maxHitPlaneMeters,
        Math.max(REACH_MODEL.minHitPlaneMeters, touchMeters - base.goodWindowSec * speedMps));
    const earlyGoodWindowSec = Math.max(base.goodWindowSec, (touchMeters - playfieldForwardMeters) / speedMps);
    // Whole floor tiles (the stage behind the player is one tile too), so the pattern never seams.
    const tile = SCENE_CONFIG.runwayTileLengthMeters;
    const runwayLength = Math.min(REACH_MODEL.maxRunwayLengthMeters,
        Math.ceil((playfieldForwardMeters + speedMps * approachSec + REACH_MODEL.runwayMarginMeters) / tile - 1e-9) * tile);
    const profile: XrPlayProfile = Object.freeze({
        settings: play,
        playSpace,
        config: Object.freeze({ ...base, noteSpeedMps: speedMps, approachTimeSec: approachSec, earlyGoodWindowSec }),
        stage: Object.freeze({ playfieldForwardMeters, runwayFrontZMeters: -runwayLength, spawnFadeMeters: REACH_MODEL.spawnFadeMeters,
            ...PLAY_SPACE_STAGE[playSpace] }),
        bladeLengthMeters,
        reachMeters
    });
    profiles.set(key, profile);
    return profile;
}
