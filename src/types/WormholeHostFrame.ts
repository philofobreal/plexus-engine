import { assertWormholeRenderFrameStamp, type WormholeRenderFrameStamp } from './WormholeRenderFrame';
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
    | { type: 'prepare'; generation: number; contextId?: string; exact?: WormholeHostExactConfig; analysis: WormholeHostAnalysis }
    | { type: 'reset'; generation: number; contextId?: string }
    | { type: 'render'; generation: number; serial: number; stamp?: WormholeRenderFrameStamp; frame: WormholeHostFrame };
export type WormholeHostResponse =
    | { type: 'ready'; generation: number; contextId?: string; exact?: WormholeHostExactConfig }
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

/** Job-bound resolved-frame transport, separate from embedded exact-v2 and preview pacing. */
export interface WormholeHostExactConfig {
    readonly jobId: string;
    readonly fps: 30 | 60;
    readonly width: number;
    readonly height: number;
}
export type WormholeHostExactStamp = Extract<WormholeRenderFrameStamp, { mode: 'exact' }>;
export type WormholeHostRasterKind = 'gpu-material' | 'webgl' | 'canvas2d';
export interface WormholeHostExactLease {
    readonly stamp: WormholeHostExactStamp;
    readonly frame: Readonly<WormholeHostFrame>;
    readonly bitmap: ImageBitmap;
    readonly raster: WormholeHostRasterKind;
    /** Idempotent. The source owns this image until release, failure or disposal. */
    release(): void;
}
export function assertWormholeHostExactConfig(value: unknown): asserts value is WormholeHostExactConfig {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid exact host configuration');
    const v = value as Record<string, unknown>, keys = ['jobId','fps','width','height'];
    if (keys.some(k => !Object.hasOwn(v,k)) || Object.keys(v).some(k => !keys.includes(k))
        || typeof v.jobId !== 'string' || !v.jobId.trim() || v.jobId.length > 128 || (v.fps !== 30 && v.fps !== 60)
        || !Number.isSafeInteger(v.width) || !Number.isSafeInteger(v.height)
        || (v.width as number) < 2 || (v.height as number) < 2 || (v.width as number) > 16384 || (v.height as number) > 16384
        || (v.width as number) % 2 !== 0 || (v.height as number) % 2 !== 0
        || (v.width as number) * (v.height as number) > 3840 * 2160) throw Error('Invalid exact host configuration');
}
export function sameWormholeHostExactConfig(a: WormholeHostExactConfig, b: WormholeHostExactConfig): boolean {
    return a.jobId === b.jobId && a.fps === b.fps && a.width === b.width && a.height === b.height;
}
export function assertWormholeHostExactFrame(frame: WormholeHostFrame, stamp: WormholeRenderFrameStamp,
    config: WormholeHostExactConfig): asserts stamp is WormholeHostExactStamp {
    assertWormholeRenderFrameStamp(stamp);
    if (stamp.mode !== 'exact' || stamp.jobId !== config.jobId || stamp.fps !== config.fps
        || frame.currentTime !== stamp.songTime || frame.exportTime !== stamp.songTime || frame.isExporting !== true
        || frame.width !== config.width || frame.height !== config.height || frame.density !== 1 || frame.compact !== false
        || frame.frameCount !== stamp.frameIndex + 1) throw Error('Mismatched exact host frame');
}

/** Repeated exact requests must retain every input. Bounded scalar comparison; never full-analysis JSON. */
export function sameWormholeHostFrame(a: WormholeHostFrame, b: WormholeHostFrame): boolean {
    let budget = 4096;
    const equal = (x: unknown, y: unknown, depth: number): boolean => {
        if (--budget < 0) return false;
        if (Object.is(x,y)) return true;
        if (depth === 0 || !x || !y || typeof x !== 'object' || typeof y !== 'object') return false;
        const keys = Object.keys(x);
        if (keys.length !== Object.keys(y).length || keys.length > budget) return false;
        return keys.every(key => Object.hasOwn(y,key) && equal((x as Record<string,unknown>)[key],(y as Record<string,unknown>)[key],depth-1));
    };
    return equal(a,b,4);
}
