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
import { DEFAULT_XR_BACKGROUND_SETTINGS, normalizeBackgroundSettings, type XrBackgroundSettings, type XrGrainMaterial,
    type XrVisualCharacter } from './XrBackgroundSettings';
import { DEFAULT_XR_APPEARANCE_SETTINGS, normalizeAppearanceSettings, type XrAppearanceSettings } from './XrAppearanceSettings';
import { DEFAULT_XR_PLAY_SETTINGS, normalizePlaySettings, resolvePlayProfile, type XrPlayProfile, type XrPlaySettings } from './XrPlayProfile';
import { DEFAULT_XR_SYSTEM_SETTINGS, normalizeSystemSettings, type XrSystemSettings } from './XrSystemSettings';

export interface XrSettings {
    /** Note speed and saber length (session scope: the chart stays, the stage and judging change). */
    readonly play: XrPlaySettings;
    /** Chart generation (Difficulty, Activity, Variation, hands, zones). */
    readonly generation: RhythmGenerationSettings;
    /** Wormhole background presentation. */
    readonly background: XrBackgroundSettings;
    /** Target style (Addendum Q). */
    readonly appearance: XrAppearanceSettings;
    /** Material renderer and diagnostics (Addendum X). */
    readonly system: XrSystemSettings;
}

export type XrSettingScope = 'chart' | 'session' | 'presentation';
/** Strongest first: a change set is handled by its strongest scope. */
const SCOPE_ORDER: readonly XrSettingScope[] = ['chart', 'session', 'presentation'];

export type XrSettingSectionId = 'gameplay' | 'choreography' | 'background' | 'character' | 'material' | 'cosmos' | 'wall' | 'cockpit' | 'system';

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
    { id: 'character', title: 'Character', prefix: 'xr-character' },
    // The MVP Advanced tuning panel's "Grain material" group (Addendum V).
    { id: 'material', title: 'Material', prefix: 'xr-material' },
    { id: 'cosmos', title: 'Cosmos', prefix: 'xr-cosmos' },
    { id: 'wall', title: 'Wall', prefix: 'xr-wall' },
    { id: 'cockpit', title: 'Cockpit', prefix: 'xr-cockpit' },
    // Where the grain material is rendered, and the in-headset diagnostics line (Addendum X).
    { id: 'system', title: 'System', prefix: 'xr-system' }
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
        read: settings => String(settings.generation[id] ?? (id === 'motionSafety' || id === 'chartProfile' ? 'legacy' : '')),
        write: (settings, value) => ({ ...settings, generation: normalizeGenerationSettings({ ...settings.generation,
            // Musical includes Guarded. Choosing Legacy movement explicitly returns to Classic.
            ...(id === 'motionSafety' && value === 'legacy' ? { chartProfile: 'legacy' as const } : {}),
            [id]: value }, DEFAULT_XR_GENERATION_SETTINGS) }) };
}

function playChoice(id: keyof XrPlaySettings, label: string, choices: readonly XrSettingChoice[]): XrChoiceSetting {
    return { id, section: 'gameplay', label, scope: 'session', kind: 'choice', choices,
        read: settings => settings.play[id],
        write: (settings, value) => ({ ...settings, play: normalizePlaySettings({ ...settings.play, [id]: value }) }) };
}

function backgroundChoice(id: 'quality' | 'rateHz' | 'distanceMeters', label: string, choices: readonly XrSettingChoice[]): XrChoiceSetting {
    return { id, section: 'background', label, scope: 'presentation', kind: 'choice', choices,
        read: settings => String(settings.background[id]),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background,
            [id]: id === 'quality' ? value : Number(value) } as Partial<XrBackgroundSettings>) }) };
}

/** One MVP Advanced "Grain material" slider; ids are prefixed so they stay unique across tabs. */
function cosmosRange(field: keyof XrBackgroundSettings['cosmos'], label: string, max: number): XrRangeSetting {
    return {id:`cosmos${field[0].toUpperCase()}${field.slice(1)}`,section:'cosmos',label,scope:'presentation',kind:'range',min:0,max,step:5,
        hint:'User-global background amount (%). Zero hides this layer; preset motion and geometry stay authored. Applies to Hybrid and Native.',
        read:settings=>Math.round((settings.background.cosmos?.[field]??(field==='sky'?0:1))*100),
        write:(settings,value)=>({...settings,background:normalizeBackgroundSettings({...settings.background,
            cosmos:{...settings.background.cosmos,[field]:value/100}})})};
}
function grainRange(field: keyof XrGrainMaterial, label: string, hint: string): XrRangeSetting {
    return { id: `grain${field[0].toUpperCase()}${field.slice(1)}`, section: 'material', label, scope: 'presentation', kind: 'range',
        min: 0, max: 100, step: 1, hint: `${hint} 50 is neutral (the presets as authored).`,
        read: settings => Math.round(settings.background.grain[field] * 100),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background,
            grain: { ...settings.background.grain, [field]: value / 100 } }) }) };
}
function wallRange(field:'amount'|'fringe'|'caustics'|'waves'|'cracks',label:string,hint:string):XrRangeSetting{
    return{id:`wall${field[0].toUpperCase()}${field.slice(1)}`,section:'wall',label,scope:'presentation',kind:'range',min:0,max:100,step:1,
        hint:hint+' 50 is neutral on the authored value; 0 removes it.',read:s=>Math.round((s.background.wall?.[field]??.5)*100),
        write:(s,value)=>({...s,background:normalizeBackgroundSettings({...s.background,wall:{...s.background.wall,[field]:value/100}})})};
}

function characterRange(id: keyof XrVisualCharacter, label: string, hint: string): XrRangeSetting {
    return { id, section: 'character', label, scope: 'presentation', kind: 'range', min: 0, max: 100, step: 1,
        hint: `${hint} 50 is neutral (the presets as authored).`,
        read: settings => Math.round(settings.background.character[id] * 100),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background,
            character: { ...settings.background.character, [id]: value / 100 } }) }) };
}

export const XR_SETTINGS: readonly XrSettingDescriptor[] = [
    { id: 'cockpit', section: 'cockpit', label: 'Cockpit', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'off', label: 'Off', hint: 'Open stage without the cabin frame or title.' },
            { value: 'reduced', label: 'Reduced', hint: 'Panoramic frame and title; fewer ribs and floor returns.' },
            { value: 'full', label: 'Full', hint: 'Panoramic cabin, side and overhead ribs, cyan/magenta light strips. Unlit materials.' }],
        read: s => s.appearance.cockpit,
        write: (s, value) => ({ ...s, appearance: normalizeAppearanceSettings({ ...s.appearance, cockpit: value as XrAppearanceSettings['cockpit'] }) }) },
    { id: 'cockpitTitle', section: 'cockpit', label: 'Track title', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'off', label: 'Off', hint: 'Hide the filename caption.' },
            { value: 'static', label: 'Static', hint: 'Filename stays in its fixed-width window; long text is clipped.' },
            { value: 'scroll', label: 'Scroll', hint: 'Filename scrolls inside a fixed-width top panel, following song time. Pausing holds its position.' }],
        read: s => s.appearance.cockpitTitle,
        write: (s, value) => ({ ...s, appearance: normalizeAppearanceSettings({ ...s.appearance, cockpitTitle: value as XrAppearanceSettings['cockpitTitle'] }) }) },
    {id:'wallMode',section:'wall',label:'Wall',scope:'presentation',kind:'choice',choices:[
        {value:'off',label:'Off',hint:'Skip the wall completely. The legacy default.'},
        {value:'preset',label:'Preset',hint:'Follow the preset optics gate, wall amount and material. Presets with no wall stay empty.'},
        {value:'on',label:'On',hint:'Preview the wall even when the preset disables it. Uses authored amount, or unit base if zero. Lens is independent.'}],
        read:s=>s.background.wall?.mode??'off',write:(s,value)=>({...s,background:normalizeBackgroundSettings({...s.background,wall:{...s.background.wall,mode:value as XrBackgroundSettings['wall']['mode']}})})},
    {id:'wallMaterial',section:'wall',label:'Wall material',scope:'presentation',kind:'choice',choices:[
        {value:'preset',label:'Preset',hint:'The preset selects the original membrane or mosaic material.'},
        {value:'membrane',label:'Membrane',hint:'Rippled clumps of wall light and authored caustic helices.'},
        {value:'mosaic',label:'Mosaic',hint:'Discrete spectral ticks and pressure-wave shifts. No caustic helices in this material.'}],
        read:s=>s.background.wall?.material??'preset',write:(s,value)=>({...s,background:normalizeBackgroundSettings({...s.background,wall:{...s.background.wall,material:value as XrBackgroundSettings['wall']['material']}})})},
    wallRange('amount','Wall amount','Gain on wall light. On mode supplies a unit base when the preset authors zero.'),
    wallRange('fringe','Fringe','Coloured edge-light split, not background refraction.'),
    wallRange('caustics','Caustics','Brighter analytic helices in Membrane material.'),
    wallRange('waves','Pressure waves','Existing kick/LOW_DROP fronts deform the wall; no new beat detector.'),
    wallRange('cracks','Cracks','Short flashes on the original fracture paths under qualifying fronts.'),
    cosmosRange('stars','Stars',200),cosmosRange('galaxies','Galaxies',200),cosmosRange('sky','Sky',100),
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
    generationChoice('chartProfile', 'Chart profile', [
        { value: 'legacy', label: 'Classic', hint: 'The previous chart vocabulary; Movement chooses its motor policy.' },
        { value: 'musical-v1', label: 'Musical', hint: 'Sections shape the phrases: compact calm parts, developing builds, wider peaks. Uses accepted onsets and Guarded movement. Missing section context falls back to Classic with Guarded movement.' }]),
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
    generationChoice('motionSafety', 'Movement', [
        { value: 'legacy', label: 'Legacy', hint: 'The previous authored movement policy and note sequence. Also returns Chart profile to Classic.' },
        { value: 'guarded', label: 'Guarded', hint: 'Reserve stroke recovery, hand clearance and overhead rest. Simplify unsafe placement, then omit infeasible groups. Regenerates the chart.' }]),
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
        write: (settings, value) => ({ ...settings, appearance: normalizeAppearanceSettings({ ...settings.appearance, noteDesign: value as XrAppearanceSettings['noteDesign'] }) }) },
    { id: 'noteHalos', section: 'background', label: 'Note halos', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'off', label: 'Off', hint: 'Keep targets without an extra ring.' },
            { value: 'phrase', label: 'Phrase', hint: 'White rings mark phrase-start targets. Accepted hits briefly expand the ring; scoring stays the same.' },
            { value: 'music', label: 'Music', hint: 'Gold arcs: accent. White brackets: phrase. Violet ring: section. Keep following the target hand and cut; no extra points.' }],
        read: settings => settings.appearance.noteHalos,
        write: (settings, value) => ({ ...settings, appearance: normalizeAppearanceSettings({ ...settings.appearance, noteHalos: value as XrAppearanceSettings['noteHalos'] }) }) },
    backgroundChoice('quality', 'Background quality', [
        { value: 'performance', label: 'Performance', hint: '640 x 360 raster: lightest, softest image.' },
        { value: 'balanced', label: 'Balanced', hint: '768 x 432 raster: the recommended headset setting.' },
        { value: 'high', label: 'High', hint: '960 x 540 raster: sharper, heavier on the CPU.' },
        { value: 'ultra', label: 'Ultra', hint: '1280 x 720 raster: a sharp image in the headset, heavy on the CPU (drawn off the main thread).' },
        { value: 'crystal', label: 'Crystal', hint: '1920 x 1080 raster: crisp lines (1.5x Ultra) at almost the same headset cost.' },
        { value: 'max', label: 'Max', hint: '2560 x 1440 raster, mipmapped: fine lines (2x Ultra), with more GPU memory and upload per frame.' },
        { value: '4k', label: '4K', hint: '3840 x 2160 raster, mipmapped: the highest background resolution, with the most GPU memory and upload per frame.' }]),
    backgroundChoice('rateHz', 'Background update', [
        { value: '24', label: '24 Hz', hint: 'Every third headset frame: the lightest, steadiest load.' },
        { value: '36', label: '36 Hz', hint: 'Every second headset frame: more fluid motion, higher cost.' }]),
    // Applies live; the plane scales with its distance, so image size, sharpness and cost stay the same.
    backgroundChoice('distanceMeters', 'Background distance', [
        { value: '40', label: '40 m', hint: 'The original distance: the image keeps a slight stereo depth and parallax.' },
        { value: '100', label: '100 m', hint: 'Deep space: the image reads as far away, behind everything else.' },
        { value: '200', label: '200 m', hint: 'Practically at infinity: no stereo depth or parallax left in the image.' },
        { value: '500', label: '500 m', hint: 'The deepest background: the same image size and resolution, with even less head-motion parallax.' }]),
    { id: 'lineStroke', section: 'background', label: 'Line stroke', scope: 'presentation', kind: 'range', min: 0, max: 100, step: 1,
        read: settings => Math.round(settings.background.lineStroke * 100),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background, lineStroke: value / 100 }) }) },
    characterRange('intensity', 'Intensity', 'How strongly the Wormhole reacts to and glows with the music.'),
    characterRange('motion', 'Motion', 'Flight speed, warp and turbulence of the Wormhole.'),
    characterRange('depth', 'Depth', 'Sense of distance: depth, galaxy, starfield and ring.'),
    characterRange('detail', 'Detail', 'The grain material end to end: amount, detail, bloom, weave, spiral and density.'),
    // Labels and descriptions follow the MVP Advanced tuning panel (src/config/visualTuning.ts).
    grainRange('amount', 'Grain material', 'Crossfades the grain trails from lines into continuous filament material; 0 skips the raster work.'),
    grainRange('detail', 'Material detail', 'Carrier breakup, micro-detail, kernel character and the raster quality tier (the heaviest on the CPU).'),
    grainRange('bloom', 'Material bloom', 'Strength of the bloom derived from the grain material.'),
    grainRange('weave', 'Material weave', 'Connective filaments between neighbouring grains along a spiral arm and around a depth ring.'),
    grainRange('spiral', 'Spiral twist', 'Coherent twist that organises the grains onto shared spiral arms.'),
    { id: 'spiralDirection', section: 'material', label: 'Spiral direction', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'auto', label: 'Auto', hint: 'Follow the authored preset or automation pair direction.' },
            { value: 'left', label: 'Left', hint: 'Left-handed grain and arm twist. Keeps the path and lens direction.' },
            { value: 'right', label: 'Right', hint: 'Right-handed grain and arm twist. Keeps the path and lens direction.' }],
        read: settings => settings.appearance.spiralDirection,
        write: (settings, value) => ({ ...settings, appearance: normalizeAppearanceSettings({ ...settings.appearance,
            spiralDirection: value as XrAppearanceSettings['spiralDirection'] }) }) },
    grainRange('arms', 'Spiral arms', 'Number of density-wave arms brightening the grains on their crest.'),
    grainRange('density', 'Grain density', 'Additional grain copies for a denser tunnel.'),
    { id: 'presentationMode', section: 'system', label: 'Wormhole mode', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'hybrid', label: 'Hybrid', hint: 'Complete background image with the selected spatial field. Quality controls raster resolution; distance places the image.' },
            { value: 'native-grains', label: 'Native grains (experimental)', hint: '3D grains/weave/material, Cosmos and optional Wall light paths. Canvas-free geometry worker with native main fallback. Quality limits geometry/fill; distance bounds depth. Optical lens/refraction is a later feature.' }],
        read: settings => settings.background.presentationMode,
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background,
            presentationMode: value as XrBackgroundSettings['presentationMode'] }) }) },
    { id: 'sharpness', section: 'background', label: 'Sharpness', scope: 'presentation', kind: 'range', min: 0, max: 100, step: 1,
        read: settings => Math.round(settings.background.sharpness * 100),
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background, sharpness: value / 100 }) }) },
    // Both switches rebuild the background plane, like a Background quality change (Addendum X).
    { id: 'materialRenderer', section: 'system', label: 'Material renderer', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'gpu', label: 'GPU', hint: 'The headset GPU draws the grain material from the background\'s carrier list: full frame rate with any Material setting. Falls back to CPU where the GPU cannot.' },
            { value: 'cpu', label: 'CPU', hint: 'The background thread rasterizes the grain material (the original path, heavy on the headset CPU). For comparison.' }],
        read: settings => settings.system.materialRenderer,
        write: (settings, value) => ({ ...settings, system: normalizeSystemSettings({ ...settings.system, materialRenderer: value as XrSystemSettings['materialRenderer'] }) }) },
    { id: 'diagnostics', section: 'system', label: 'Diagnostics', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'off', label: 'Off', hint: 'No profiling: the background measures nothing.' },
            { value: 'on', label: 'On', hint: 'Display fps, background fps and cost per stage, averaged over two seconds of play, on the main and pause screens.' }],
        read: settings => (settings.system.diagnostics ? 'on' : 'off'),
        write: (settings, value) => ({ ...settings, system: normalizeSystemSettings({ ...settings.system, diagnostics: value === 'on' }) }) },
    // Rebuilds the background plane (the worker is created with or without the line list; Addendum AA).
    { id: 'grainLines', section: 'system', label: 'Grain lines', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'canvas', label: 'Canvas', hint: 'The background thread strokes the grain trails into its image (the original path).' },
            { value: 'gpu', label: 'GPU', hint: 'The headset GPU draws the grain trails from a line list instead of the background thread. Needs the GPU material renderer.' }],
        read: settings => settings.system.grainLines,
        write: (settings, value) => ({ ...settings, system: normalizeSystemSettings({ ...settings.system, grainLines: value as XrSystemSettings['grainLines'] }) }) },
    // Applies live (Addendum Z).
    { id: 'backgroundPacing', section: 'system', label: 'Background pacing', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'fixed', label: 'Fixed', hint: 'Redraws on the requested whole-frame cadence; a late frame waits for the next one.' },
            { value: 'adaptive', label: 'Adaptive', hint: 'Widens the cadence to fit late frames (24 Hz instead of 18): smoother, but more background work for the headset GPU.' }],
        read: settings => settings.system.backgroundPacing,
        write: (settings, value) => ({ ...settings, system: normalizeSystemSettings({ ...settings.system, backgroundPacing: value as XrSystemSettings['backgroundPacing'] }) }) },
    // Rebuilds the background plane (the worker's surfaces are created for one raster; Addenda AE, AF).
    { id: 'backgroundRaster', section: 'system', label: 'Background raster', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'gpu', label: 'GPU', hint: 'The browser draws the background image on the GPU, stroke by stroke (Canvas2D, the original path).' },
            { value: 'cpu', label: 'CPU', hint: 'The background thread draws its image in software, off the GPU. Busier on the headset CPU. For comparison.' },
            { value: 'webgl', label: 'WebGL', hint: 'The background thread draws its image with WebGL in a few batched draw calls instead of thousands of strokes. Falls back to GPU where WebGL is unavailable.' }],
        read: settings => settings.system.backgroundRaster,
        write: (settings, value) => ({ ...settings, system: normalizeSystemSettings({ ...settings.system, backgroundRaster: value as XrSystemSettings['backgroundRaster'] }) }) },
    // Applies live: the Wormhole's particles (and wisps) in the space around the runway, one draw each.
    // A cost switch beside the other headset-load switches; stored with the Visuals (background) settings.
    { id: 'spatialField', section: 'system', label: 'Spatial field', scope: 'presentation', kind: 'choice',
        choices: [
            { value: 'off', label: 'Off', hint: 'Only the background image: no Wormhole particles around the runway (the lightest).' },
            { value: 'particles', label: 'Particles', hint: 'The Wormhole\'s particles stream past you around the runway (one light draw).' },
            { value: 'full', label: 'Full', hint: 'Particles plus soft wisps of the Wormhole\'s nebula (two draws; the wisps cost the most fill).' }],
        read: settings => settings.background.spatialField,
        write: (settings, value) => ({ ...settings, background: normalizeBackgroundSettings({ ...settings.background,
            spatialField: value as XrBackgroundSettings['spatialField'] }) }) }
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
    appearance: DEFAULT_XR_APPEARANCE_SETTINGS,
    system: DEFAULT_XR_SYSTEM_SETTINGS
});

/** Any partial or hostile input becomes a complete, valid settings object. */
export function normalizeXrSettings(settings?: { play?: Partial<XrPlaySettings>; generation?: Partial<RhythmGenerationSettings>;
    background?: Partial<XrBackgroundSettings>; appearance?: Partial<XrAppearanceSettings>; system?: Partial<XrSystemSettings> } | null): XrSettings {
    const source = settings && typeof settings === 'object' ? settings : {};
    return {
        play: normalizePlaySettings(source.play && typeof source.play === 'object' ? source.play : undefined),
        generation: normalizeGenerationSettings(source.generation && typeof source.generation === 'object' ? source.generation : undefined,
            DEFAULT_XR_GENERATION_SETTINGS),
        background: normalizeBackgroundSettings(source.background && typeof source.background === 'object' ? source.background : undefined),
        appearance: normalizeAppearanceSettings(source.appearance && typeof source.appearance === 'object' ? source.appearance : undefined),
        system: normalizeSystemSettings(source.system && typeof source.system === 'object' ? source.system : undefined)
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
