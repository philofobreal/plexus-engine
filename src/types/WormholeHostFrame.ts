import type { WormholeRenderFrameStamp } from './WormholeRenderFrame';
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
/** WH-03a internal view version, separate from existing preview-v1/exact-v2 wire versions.
 * The producer must synchronously clone/post values before advancing its mutable state.
 */
export interface ResolvedWormholeFrameView {
    readonly version: 1;
    readonly tuningStage: 'resolved';
    readonly ownership: 'borrowed-until-clone';
    /** visualTuning is resolved; targetTuning retains the authored raw target. Nested data is borrowed. */
    readonly values: Readonly<Omit<WormholeRenderState, keyof WormholeHostAnalysis>>;
}
export type WormholeHostFrame = Omit<WormholeRenderState, keyof WormholeHostAnalysis> & {
    musicDisplay?: import('./MusicDisplay').MusicDisplaySettings;
    width: number; height: number; density: number; compact: boolean; depthCue: number;
    transparent: boolean; skybox: boolean; frameCount: number; reset: boolean;
};
export type WormholeHostRequest =
    | { type: 'prepare'; generation: number; contextId?: string; analysis: WormholeHostAnalysis }
    | { type: 'reset'; generation: number; contextId?: string }
    | { type: 'render'; generation: number; serial: number; stamp?: WormholeRenderFrameStamp; frame: WormholeHostFrame };
export type WormholeHostResponse =
    | { type: 'ready'; generation: number; contextId?: string }
    | { type: 'frame'; generation: number; serial: number; stamp?: WormholeRenderFrameStamp; bitmap: ImageBitmap; raster: 'webgl' | 'canvas2d' | 'gpu-material'; renderMs: number }
    | { type: 'failure'; generation?: number; contextId?: string; message: string };
export interface WormholeHostPairing {
    readonly key: string;
    readonly revision?: string;
    /** Synchronous owned counterpart capture, before the deferred request is submitted. */
    capture(frame: Readonly<WormholeHostFrame>): void;
}
export interface WormholeHostRasterSource {
    readonly rasterKind: string;
    /** Private immutable snapshot belonging to the currently retained image; never live State. */
    readonly presentedFrame?: Readonly<WormholeHostFrame> | null;
    draw(state: WormholeRenderState, target: WormholeHostTarget, depthCue: number, transparent: boolean, playing?: boolean,
        musicDisplay?: import('./MusicDisplay').MusicDisplaySettings, pairing?: WormholeHostPairing): boolean;
    acknowledgePresented?(frame: Readonly<WormholeHostFrame>): void;
    reset(): void;
    dispose(): void;
}
