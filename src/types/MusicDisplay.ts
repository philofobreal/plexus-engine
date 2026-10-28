/** Informational spectrum overlay: a viewer preference, independent of artistic presets. */
export interface MusicDisplaySettings {
    readonly mode: 'off' | 'spectrum';
    readonly size: number;
    readonly opacity: number;
}
export const DEFAULT_MUSIC_DISPLAY: Readonly<MusicDisplaySettings> = Object.freeze({mode:'off',size:.5,opacity:.5});
export function normalizeMusicDisplay(value?: Partial<MusicDisplaySettings> | null): Readonly<MusicDisplaySettings> {
    if (!value) return DEFAULT_MUSIC_DISPLAY;
    const unit=(v: unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.min(1,Math.max(0,v)):.5;
    return {mode:value.mode==='spectrum'?'spectrum':'off',size:unit(value.size),opacity:unit(value.opacity)};
}
export function isDefaultMusicDisplay(value: MusicDisplaySettings): boolean {
    return value.mode==='off'&&value.size===.5&&value.opacity===.5;
}
