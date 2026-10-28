// Player-facing appearance of the targets (ADR-009 Addendum Q). Pure data: presentation only, the
// chart, judging and score never depend on it.
import { normalizeHudStyle, type HudStyle } from '../presentation/InstrumentDesign';
import { normalizeMusicDisplay, isDefaultMusicDisplay, type MusicDisplaySettings } from '../types/MusicDisplay';

/** Classic: chamfered block with an arrow glyph. Shard: a crystal whose shape points along the cut. */
export type XrNoteDesign = 'classic' | 'shard';
export type XrNoteHalos = 'off' | 'phrase' | 'music';
export type XrSpiralDirection = 'auto' | 'left' | 'right';
export type XrCockpitMode = 'off' | 'reduced' | 'full';
export type XrCockpitTitleMode = 'off' | 'static' | 'scroll';

export interface XrAppearanceSettings {
    readonly musicDisplay?: MusicDisplaySettings;
    /** Omitted in historical/current-look records; new styles remain version-1 compatible. */
    readonly hudStyle?: HudStyle;
    readonly noteDesign: XrNoteDesign;
    /** Optional phrase preview or musical roles; no scoring or chart change. */
    readonly noteHalos: XrNoteHalos;
    readonly spiralDirection: XrSpiralDirection;
    readonly cockpit: XrCockpitMode;
    readonly cockpitTitle: XrCockpitTitleMode;
}

export const XR_NOTE_DESIGNS: readonly XrNoteDesign[] = ['classic', 'shard'];
export const XR_NOTE_HALOS: readonly XrNoteHalos[] = ['off', 'phrase', 'music'];
export const XR_SPIRAL_DIRECTIONS: readonly XrSpiralDirection[] = ['auto', 'left', 'right'];

/** Shard crystals by default (ADR-009 Addendum T). */
export const DEFAULT_XR_APPEARANCE_SETTINGS: XrAppearanceSettings = Object.freeze({ noteDesign: 'shard', noteHalos: 'off', spiralDirection: 'auto',
    cockpit: 'off', cockpitTitle: 'scroll' });

export function normalizeAppearanceSettings(settings?: Partial<XrAppearanceSettings> | null): XrAppearanceSettings {
    const design = settings?.noteDesign;
    const halos = settings?.noteHalos;
    const hudStyle = normalizeHudStyle(settings?.hudStyle);
    const musicDisplay=normalizeMusicDisplay(settings?.musicDisplay);
    return { ...(!isDefaultMusicDisplay(musicDisplay)?{musicDisplay}:{}), ...(hudStyle !== 'classic' ? { hudStyle } : {}), noteDesign: design && XR_NOTE_DESIGNS.includes(design) ? design : DEFAULT_XR_APPEARANCE_SETTINGS.noteDesign,
        noteHalos: halos && XR_NOTE_HALOS.includes(halos) ? halos : DEFAULT_XR_APPEARANCE_SETTINGS.noteHalos,
        spiralDirection: settings?.spiralDirection && XR_SPIRAL_DIRECTIONS.includes(settings.spiralDirection)
            ? settings.spiralDirection : DEFAULT_XR_APPEARANCE_SETTINGS.spiralDirection,
        cockpit: settings?.cockpit === 'off' || settings?.cockpit === 'reduced' || settings?.cockpit === 'full'
            ? settings.cockpit : DEFAULT_XR_APPEARANCE_SETTINGS.cockpit,
        cockpitTitle: settings?.cockpitTitle === 'off' || settings?.cockpitTitle === 'static' ? settings.cockpitTitle : 'scroll' };
}
