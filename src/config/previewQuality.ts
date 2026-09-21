export type PreviewQualityMode = 'auto' | 'reduced';

/** Host preference, independent of artistic presets, audio and render history. */
export class PreviewQualityPreference {
    private readonly automaticCompact: boolean;
    private selectedMode: PreviewQualityMode;

    constructor(automaticCompact: boolean, savedMode: unknown = 'auto') {
        this.automaticCompact = automaticCompact;
        this.selectedMode = savedMode === 'reduced' ? 'reduced' : 'auto';
    }

    get mode(): PreviewQualityMode { return this.selectedMode; }
    setMode(mode: string): void { this.selectedMode = mode === 'reduced' ? 'reduced' : 'auto'; }
    get compactMaterialPreview(): boolean { return this.mode === 'reduced' || this.automaticCompact; }
    get pixelRatioCap(): number { return this.compactMaterialPreview ? 1.25 : 2; }
    get maxBackingLongEdge(): number { return this.compactMaterialPreview ? 1280 : 1920; }
}
