// Player-facing appearance of the targets (ADR-009 Addendum Q). Pure data: presentation only, the
// chart, judging and score never depend on it.

/** Classic: chamfered block with an arrow glyph. Shard: a crystal whose shape points along the cut. */
export type XrNoteDesign = 'classic' | 'shard';

export interface XrAppearanceSettings {
    readonly noteDesign: XrNoteDesign;
}

export const XR_NOTE_DESIGNS: readonly XrNoteDesign[] = ['classic', 'shard'];

export const DEFAULT_XR_APPEARANCE_SETTINGS: XrAppearanceSettings = Object.freeze({ noteDesign: 'classic' });

export function normalizeAppearanceSettings(settings?: Partial<XrAppearanceSettings> | null): XrAppearanceSettings {
    const design = settings?.noteDesign;
    return { noteDesign: design && XR_NOTE_DESIGNS.includes(design) ? design : DEFAULT_XR_APPEARANCE_SETTINGS.noteDesign };
}
