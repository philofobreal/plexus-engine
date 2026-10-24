import type { VisualAnalysisSnapshot, VisualFocalPoint, CanvasVisualPresentation } from './CanvasVisualSource';
import type { GrainMaterialFrame } from './GrainMaterialFrame';
import type { GrainLineFrame } from './GrainLineFrame';
import type { WormholeSpatialFrame } from './WormholeSpatialFrame';

export const WORMHOLE_EXACT_SAMPLER = 'fixed-song-60-v1' as const;
export interface WormholeFrameIdentity {
    readonly contextId: string;
    readonly generation: number;
    readonly requestSerial: number;
    readonly frameIndex: number;
    readonly fps: number;
    readonly songTime: number;
}
/** All companions and the image belong to this identity. Read only until release(). */
export interface WormholeFrameLease {
    readonly identity: WormholeFrameIdentity;
    readonly bitmap: ImageBitmap;
    readonly focalPoint: VisualFocalPoint;
    readonly material: GrainMaterialFrame | null;
    readonly lines: GrainLineFrame | null;
    readonly spatial: WormholeSpatialFrame | null;
    /** Idempotent. Closes the bitmap and returns transferred carrier ownership. */
    release(): void;
}
export interface ExactWormholeSource {
    readonly rasterKind: 'webgl' | 'canvas2d' | null;
    prepare(analysis: VisualAnalysisSnapshot | null): Promise<void>;
    requestFrame(frameIndex: number, fps: number, signal?: AbortSignal): Promise<WormholeFrameLease>;
    setPresentation(presentation: CanvasVisualPresentation): void;
    dispose(): void;
}
export function exactWormholeTime(frameIndex: number, fps: number): number {
    if (!Number.isSafeInteger(frameIndex) || frameIndex < 0 || !Number.isFinite(fps) || fps <= 0 || fps > 240)
        throw new Error('Invalid exact Wormhole frame index or fps.');
    const time = frameIndex / fps;
    if (!Number.isFinite(time)) throw new Error('Invalid exact Wormhole song time.');
    return time;
}
export function sameWormholeFrame(a: WormholeFrameIdentity, b: WormholeFrameIdentity): boolean {
    return a.contextId === b.contextId && a.generation === b.generation && a.requestSerial === b.requestSerial
        && a.frameIndex === b.frameIndex && a.fps === b.fps && a.songTime === b.songTime;
}
