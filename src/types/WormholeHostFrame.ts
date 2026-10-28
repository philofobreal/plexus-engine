import type { AudioFrame, BeatEvent, TrackAnalysis, VisualTuningConfig, VisualFeatureFrame, ModulationState, DirectorOutput, VisualTransitionAnchor } from './index';

/** Explicit per-host identity inputs, independent of the mutable application store. */
export interface WormholeRenderState {
    frames: AudioFrame[]; events: BeatEvent[]; sampleRate: number; hopSize: number; bpm: number; trackAnalysis: TrackAnalysis;
    visualTuning: VisualTuningConfig; targetTuning: VisualTuningConfig;
    currentFrame: AudioFrame; currentFeatures: VisualFeatureFrame; modulation: ModulationState; directorOutput: DirectorOutput;
    currentTime: number; isExporting: boolean; exportTime: number; playbackFade: number;
    beatDecay: number; denseImpactFlash: number; activeVisualTransitionId: string | null;
    spiralTransitionAnchor?: VisualTransitionAnchor | null;
}
export interface WormholeHostTarget {
    readonly width: number; readonly height: number; readonly frameCount: number;
    readonly rasterPixelRatio: number; readonly compactMaterialPreview: boolean;
    presentRaster(image: CanvasImageSource): void;
    background(r: number, g: number, b: number): void;
}

/** Already resolved host input. No second director, preset/gain resolver or audio clock. */
export type WormholeHostAnalysis = Pick<WormholeRenderState, 'frames' | 'events' | 'sampleRate' | 'hopSize' | 'bpm' | 'trackAnalysis'>;
export type WormholeHostFrame = Omit<WormholeRenderState, keyof WormholeHostAnalysis> & {
    musicDisplay?: import('./MusicDisplay').MusicDisplaySettings;
    width: number; height: number; density: number; compact: boolean; depthCue: number;
    transparent: boolean; skybox: boolean; frameCount: number; reset: boolean;
};
export type WormholeHostRequest =
    | { type: 'prepare'; generation: number; analysis: WormholeHostAnalysis }
    | { type: 'reset'; generation: number }
    | { type: 'render'; generation: number; serial: number; frame: WormholeHostFrame };
export type WormholeHostResponse =
    | { type: 'ready'; generation: number }
    | { type: 'frame'; generation: number; serial: number; bitmap: ImageBitmap; raster: 'webgl' | 'canvas2d'; renderMs: number }
    | { type: 'failure'; message: string };
export interface WormholeHostRasterSource {
    readonly rasterKind: string;
    draw(state: WormholeRenderState, target: WormholeHostTarget, depthCue: number, transparent: boolean, playing?: boolean,
        musicDisplay?: import('./MusicDisplay').MusicDisplaySettings): boolean;
    reset(): void;
    dispose(): void;
}
