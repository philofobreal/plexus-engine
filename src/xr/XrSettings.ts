// The single description of every player setting on the /xr/ page (ADR-009 Addendum H). Pure data:
// the desktop command drawer (and later the in-VR menu) render from `XR_SETTINGS`, and each
// descriptor declares its *scope* -- what a change has to do to the running game:
//
// - `chart`        the chart is regenerated from the captured analysis and playback rewinds;
// - `session`      the chart stays, but the game configuration changes, so playback rewinds;
// - `presentation` applied live, even mid-song (the score and the chart are untouched).
//
// Adding a setting means adding one descriptor here; no menu or controller code changes.

import {
    normalizeGenerationSettings, type PlaySpace, type RhythmGameConfig, type RhythmGenerationSettings
} from '../gameplay';
import { DEFAULT_XR_BACKGROUND_SETTINGS, normalizeBackgroundSettings, type XrBackgroundSettings, type XrVisualCharacter } from './XrBackgroundSettings';
import { DEFAULT_XR_APPEARANCE_SETTINGS, normalizeAppearanceSettings, type XrAppearanceSettings } from './XrAppearanceSettings';
import { DEFAULT_XR_PLAY_SETTINGS, normalizePlaySettings, resolvePlayProfile, type XrPlayProfile, type XrPlaySettings } from './XrPlayProfile';

export interface XrSettings {
    /** Note speed and saber length (session scope: the chart stays, the stage and judging change). */
    readonly play: XrPlaySettings;
    /** Chart generation (Difficulty, Activity, Variation, hands, zones). */
    readonly generation: RhythmGenerationSettings;
    /** Wormhole background presentation. */
    readonly background: XrBackgroundSettings;
    /** Target style (Addendum Q). */
    readonly appearance: XrAppearanceSettings;
}

export type XrSettingScope = 'chart' | 'session' | 'presentation';
/** Strongest first: a change set is handled by its strongest scope. */
const SCOPE_ORDER: readonly XrSettingScope[] = ['chart', 'session', 'presentation'];

export type XrSettingSectionId = 'gameplay' | 'choreography' | 'background' | 'character';

export interface XrSettingSection {
    readonly id: XrSettingSectionId;
    readonly title: string;
    /** DOM name prefix of the section's controls (stable for tests and assistive tech). */
    readonly prefix: string;
}

export const XR_SETTING_SECTIONS: readonly XrSettingSection[] = [
    { id: 'gameplay', title: 'Gameplay', prefix: 'xr-play' },
    { id: 'choreography', title: 'Choreography', prefix: 'xr-generation' },
    // "Visuals": the Wormhole background and the target style (DOM names keep the historical prefix).
    { id: 'background', title: 'Visuals', prefix: 'xr-background' },
    // The MVP's "Visual character" macros for the Wormhole (Addendum R).
    { id: 'character', title: 'Character', prefix: 'xr-character' }
];

export interface XrSettingChoice {
    readonly value: string;
    readonly label: string;
    readonly hint: string;
}

interface XrSettingBase {
    /** Unique within its section; also the control name suffix. */
    readonly id: string;
    readonly section: XrSettingSectionId;
    readonly label: string;
    readonly scope: XrSettingScope;
}

/** A segmented single choice; values are strings in the UI. */
export interface XrChoiceSetting extends XrSettingBase {
    readonly kind: 'choice';
    readonly choices: readonly XrSettingChoice[];
    read(settings: XrSettings): string;
    write(settings: XrSettings, value: string): XrSettings;
}

/** A continuous slider; `read`/`write` use the displayed (slider) units. */
export interface XrRangeSetting extends XrSettingBase {
    readonly kind: 'range';
    readonly min: number;
    readonly max: number;
    readonly step: number;
    /** What the slider does (shown with its value). */
    readonly hint?: string;
    read(settings: XrSettings): number;
    write(settings: XrSettings, value: number): XrSettings;
}

export type XrSettingDescriptor = XrChoiceSetting | XrRangeSetting;

type GenerationKey = keyof RhythmGenerationSettings;

function generationChoice(id: GenerationKey, label: string, choices: readonly XrSettingChoice[]): XrChoiceSetting {
    return { id, section: 'choreography', label, scope: 'chart', kind: 'choice', choices,
        read: settings => String(settings.generation[id]),
        write: (settings, value) => ({ ...settings, generation: normalizeGenerationSettings({ ...settings.generation, [id]: value }, DEFAULT_XR_GENERATION_SETTINGS) }) };
}

function playChoice(id: keyof XrPlaySettings, label: string, choices: readonly XrSettingChoice[]): XrChoiceSetting {
    return { id, section: 'gameplay', label, scope: 'session', kind: 'choice', choices,
        read: settings => settings.play[id],
        write: (settings, value) => ({ ...settings, play: normalizePlaySettings({ ...settings.play, [id]: value }) }) };
}

function backgroundChoice(id: 'quality' | 'rateHz', label: string, choices: readonly XrSettingChoice[]): XrChoiceSetting {
    return { id, section: 'background', label, scope: 'presentation', kind: 'choice', choices,
        read: settings => String(settings.background[id]),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background,
            [id]: id === 'rateHz' ? Number(value) : value } as Partial<XrBackgroundSettings>) }) };
}

function characterRange(id: keyof XrVisualCharacter, label: string, hint: string): XrRangeSetting {
    return { id, section: 'character', label, scope: 'presentation', kind: 'range', min: 0, max: 100, step: 1,
        hint: `${hint} 50 is neutral (the presets as authored).`,
        read: settings => Math.round(settings.background.character[id] * 100),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background,
            character: { ...settings.background.character, [id]: value / 100 } }) }) };
}

export const XR_SETTINGS: readonly XrSettingDescriptor[] = [
    // Play space shapes the chart (overhead row) as well as the stage, so it regenerates.
    { id: 'playSpace', section: 'gameplay', label: 'Play space', scope: 'chart', kind: 'choice',
        choices: [
            { value: 'standard', label: 'Standard', hint: 'Three rows around chest height.' },
            { value: 'tall', label: 'Tall', hint: 'Wider rows plus a rare overhead row on big moments: reach up and chop down. The start frame grows and the score moves beside the runway.' }],
        read: settings => settings.generation.playSpace,
        write: (settings, value) => ({ ...settings, generation: normalizeGenerationSettings({ ...settings.generation, playSpace: value as PlaySpace }, DEFAULT_XR_GENERATION_SETTINGS) }) },
    playChoice('noteSpeed', 'Note speed', [
        { value: 'normal', label: 'Normal', hint: '4 m/s from 8 m away: two seconds to read each target.' },
        { value: 'fast', label: 'Fast', hint: '7 m/s from 11 m away: 1.6 s to react, a longer runway.' },
        { value: 'hyper', label: 'Hyper', hint: '10 m/s from 14 m away: 1.4 s to react, the full-length runway.' }]),
    playChoice('saberLength', 'Saber length', [
        { value: 'short', label: 'Short', hint: '0.9 m blade (the original length).' },
        { value: 'normal', label: 'Normal', hint: '1.0 m blade. The start frame moves back so the whole reach is judged.' },
        { value: 'long', label: 'Long', hint: '1.1 m blade for long reaches; the stage adapts its distance.' },
        { value: 'auto', label: 'Auto', hint: 'Follows the play space: 1.0 m, or 1.1 m in the Tall space.' }]),
    generationChoice('difficulty', 'Difficulty', [
        { value: 'easy', label: 'Easy', hint: 'Slow and spacious: fewer targets, more free cuts, gentle moves.' },
        { value: 'normal', label: 'Normal', hint: 'The standard challenge.' },
        { value: 'hard', label: 'Hard', hint: 'Denser streams, faster hand moves, strictly directional cuts.' },
        { value: 'expert', label: 'Expert', hint: 'Maximum density and speed, chains of hard moves on big moments.' },
        { value: 'ultra', label: 'Ultra', hint: 'Beyond Expert: dense, fast, always directional runs where the music drives, with structured breathers in calm parts and before every section change.' }]),
    generationChoice('activity', 'Activity', [
        { value: 'macro', label: 'Calm', hint: 'Fewer targets, more room to breathe.' },
        { value: 'balanced', label: 'Balanced', hint: 'Standard target density.' },
        { value: 'active', label: 'Active', hint: 'As dense as the music and safe spacing allow.' }]),
    generationChoice('variation', 'Variation', [
        { value: 'stable', label: 'Stable', hint: 'Few repeating patterns, mostly vertical cuts.' },
        { value: 'paired', label: 'Paired', hint: 'Two to three pattern families per scene.' },
        { value: 'expressive', label: 'Expressive', hint: 'Shorter phrases and the widest cut vocabulary.' }]),
    generationChoice('handPattern', 'Hands', [
        { value: 'alternate', label: 'Alternate', hint: 'The hands take turns.' },
        { value: 'call-response', label: 'Call & Response', hint: 'One hand calls a bar, the other answers.' },
        { value: 'together', label: 'Together', hint: 'More two-hand accents on strong beats.' },
        { value: 'independent', label: 'Independent', hint: 'Each hand follows its own musical stream.' }]),
    generationChoice('handLead', 'Lead', [
        { value: 'left', label: 'Left', hint: 'The left hand carries more primary beats.' },
        { value: 'even', label: 'Even', hint: 'Both hands share the work evenly.' },
        { value: 'right', label: 'Right', hint: 'The right hand carries more primary beats.' }]),
    generationChoice('zones', 'Zones', [
        { value: 'split', label: 'Own side', hint: 'Each saber stays in its own half.' },
        { value: 'shared', label: 'Shared center', hint: 'Both sabers may also use the center lane.' },
        { value: 'cross', label: 'Crossover', hint: 'On energetic moments a saber reaches into the other half.' }]),
    { id: 'wormhole', section: 'background', label: 'Wormhole', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'off', label: 'Off', hint: 'Plain dark space: the lightest frame.' },
            { value: 'on', label: 'On', hint: 'The music-driven Wormhole behind the runway (the heaviest part of the frame).' }],
        read: settings => (settings.background.wormhole ? 'on' : 'off'),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background, wormhole: value === 'on' }) }) },
    { id: 'noteDesign', section: 'background', label: 'Note design', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'classic', label: 'Classic', hint: 'Chamfered blocks with an arrow to follow; dots allow any direction.' },
            { value: 'shard', label: 'Shard', hint: 'Crystals whose tip points the way to cut, with a glowing cut line; round gems allow any direction.' }],
        read: settings => settings.appearance.noteDesign,
        write: (settings, value) => ({ ...settings, appearance: normalizeAppearanceSettings({ noteDesign: value as XrAppearanceSettings['noteDesign'] }) }) },
    backgroundChoice('quality', 'Background quality', [
        { value: 'performance', label: 'Performance', hint: '640 x 360 raster: lightest, softest image.' },
        { value: 'balanced', label: 'Balanced', hint: '768 x 432 raster: the recommended headset setting.' },
        { value: 'high', label: 'High', hint: '960 x 540 raster: sharper, heavier on the CPU.' },
        { value: 'ultra', label: 'Ultra', hint: '1280 x 720 raster: the sharpest image in the headset, the heaviest on the CPU (drawn off the main thread).' }]),
    backgroundChoice('rateHz', 'Background update', [
        { value: '24', label: '24 Hz', hint: 'Every third headset frame: the lightest, steadiest load.' },
        { value: '36', label: '36 Hz', hint: 'Every second headset frame: more fluid motion, higher cost.' }]),
    { id: 'lineStroke', section: 'background', label: 'Line stroke', scope: 'presentation', kind: 'range', min: 0, max: 100, step: 1,
        read: settings => Math.round(settings.background.lineStroke * 100),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background, lineStroke: value / 100 }) }) },
    characterRange('intensity', 'Intensity', 'How strongly the Wormhole reacts to and glows with the music.'),
    characterRange('motion', 'Motion', 'Flight speed, warp and turbulence of the Wormhole.'),
    characterRange('depth', 'Depth', 'Sense of distance: depth, galaxy, starfield and ring.'),
    characterRange('detail', 'Detail', 'The grain material end to end: amount, detail, bloom, weave, spiral and density.'),
    { id: 'sharpness', section: 'background', label: 'Sharpness', scope: 'presentation', kind: 'range', min: 0, max: 100, step: 1,
        read: settings => Math.round(settings.background.sharpness * 100),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background, sharpness: value / 100 }) }) }
];

/**
 * The /xr/ player's default choreography (ADR-009 Addendum T): Ultra, Active, Expressive,
 * Alternate, Even, Crossover in the Tall play space. The gameplay library keeps its historical
 * defaults (`DEFAULT_RHYTHM_GENERATION_SETTINGS`), so the pinned default chart is unchanged.
 */
export const DEFAULT_XR_GENERATION_SETTINGS: RhythmGenerationSettings = Object.freeze({
    difficulty: 'ultra', activity: 'active', variation: 'expressive', handPattern: 'alternate', handLead: 'even', zones: 'cross',
    playSpace: 'tall'
});

export const DEFAULT_XR_SETTINGS: XrSettings = Object.freeze({
    play: DEFAULT_XR_PLAY_SETTINGS,
    generation: DEFAULT_XR_GENERATION_SETTINGS,
    background: DEFAULT_XR_BACKGROUND_SETTINGS,
    appearance: DEFAULT_XR_APPEARANCE_SETTINGS
});

/** Any partial or hostile input becomes a complete, valid settings object. */
export function normalizeXrSettings(settings?: { play?: Partial<XrPlaySettings>; generation?: Partial<RhythmGenerationSettings>;
    background?: Partial<XrBackgroundSettings>; appearance?: Partial<XrAppearanceSettings> } | null): XrSettings {
    const source = settings && typeof settings === 'object' ? settings : {};
    return {
        play: normalizePlaySettings(source.play && typeof source.play === 'object' ? source.play : undefined),
        generation: normalizeGenerationSettings(source.generation && typeof source.generation === 'object' ? source.generation : undefined,
            DEFAULT_XR_GENERATION_SETTINGS),
        background: normalizeBackgroundSettings(source.background && typeof source.background === 'object' ? source.background : undefined),
        appearance: normalizeAppearanceSettings(source.appearance && typeof source.appearance === 'object' ? source.appearance : undefined)
    };
}

/** True when a descriptor shows a different value in `a` and `b`. */
function differs(descriptor: XrSettingDescriptor, a: XrSettings, b: XrSettings): boolean {
    return descriptor.read(a) !== descriptor.read(b);
}

/** The strongest scope among the settings that differ, or null when nothing changed. */
export function changeScope(previous: XrSettings, next: XrSettings): XrSettingScope | null {
    let strongest: XrSettingScope | null = null;
    for (const descriptor of XR_SETTINGS) {
        if (!differs(descriptor, previous, next)) continue;
        if (strongest === null || SCOPE_ORDER.indexOf(descriptor.scope) < SCOPE_ORDER.indexOf(strongest)) strongest = descriptor.scope;
    }
    return strongest;
}

/** Gameplay configuration, stage layout and blade length implied by the play settings and play space (memoized). */
export function resolvePlayFromSettings(settings: XrSettings): XrPlayProfile {
    return resolvePlayProfile(settings.play, settings.generation.playSpace);
}

/** The gameplay configuration a settings object implies (judging, note travel and the play space's rows). */
export function resolveGameConfig(settings: XrSettings): RhythmGameConfig {
    return resolvePlayFromSettings(settings).config;
}
