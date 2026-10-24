export type PreviewQualityMode = 'auto' | 'reduced';
export type WormholeRendererMode = 'compatible' | 'webgl' | 'offscreen';

/** Host preference, independent of artistic presets, audio and render history. */
export class PreviewQualityPreference {
    private readonly automaticCompact: boolean;
    private selectedMode: PreviewQualityMode;
    private renderer: WormholeRendererMode;

    constructor(automaticCompact: boolean, savedMode: unknown = 'auto', renderer: unknown = 'compatible') {
        this.automaticCompact = automaticCompact;
        this.selectedMode = savedMode === 'reduced' ? 'reduced' : 'auto';
        this.renderer = renderer === 'offscreen' || renderer === 'webgl' ? renderer : 'compatible';
    }

    get mode(): PreviewQualityMode { return this.selectedMode; }
    get wormholeRenderer(): WormholeRendererMode { return this.renderer; }
    setRendererMode(mode: string): void { this.renderer = mode === 'offscreen' || mode === 'webgl' ? mode : 'compatible'; }
    setMode(mode: string): void { this.selectedMode = mode === 'reduced' ? 'reduced' : 'auto'; }
    get compactMaterialPreview(): boolean { return this.mode === 'reduced' || this.automaticCompact; }
    get pixelRatioCap(): number { return this.compactMaterialPreview ? 1.25 : 2; }
    get maxBackingLongEdge(): number { return this.compactMaterialPreview ? 1280 : 1920; }
}
