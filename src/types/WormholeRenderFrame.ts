import { exactWormholeTime, type WormholeFrameIdentity } from './WormholeExactFrame';

/** WH-01 common frame identity. Existing preview v1 / exact v2 wires are unchanged. */
export const WORMHOLE_RENDER_FRAME_PROTOCOL = 1 as const;
interface FrameStampBase extends Pick<WormholeFrameIdentity, 'contextId' | 'generation' | 'requestSerial' | 'songTime'> {
    readonly protocol: typeof WORMHOLE_RENDER_FRAME_PROTOCOL;
    /** Changes with dimensions, quality, backend, transparency or display preferences. */
    readonly presentationRevision: number;
}
export type WormholeRenderFrameStamp = FrameStampBase & (
    | { readonly mode: 'preview' }
    | { readonly mode: 'exact'; readonly jobId: string; readonly frameIndex: number;
        readonly fps: 30 | 60; readonly timestampUs: number }
);

/** Validate before accepting companion data or an image; timestamps never use a tolerance. */
export function assertWormholeRenderFrameStamp(value: unknown): asserts value is WormholeRenderFrameStamp {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid Wormhole frame stamp');
    const v = value as Record<string, unknown>;
    const id = (x: unknown) => typeof x === 'string' && x.trim().length > 0 && x.length <= 128;
    const integer = (x: unknown, min: number) => typeof x === 'number' && Number.isSafeInteger(x) && x >= min;
    const base = ['protocol', 'contextId', 'generation', 'requestSerial', 'songTime', 'presentationRevision', 'mode'];
    if (v.protocol !== WORMHOLE_RENDER_FRAME_PROTOCOL || !id(v.contextId)
        || !integer(v.generation, 0) || !integer(v.requestSerial, 1) || !integer(v.presentationRevision, 0)
        || typeof v.songTime !== 'number' || !Number.isFinite(v.songTime) || v.songTime < 0)
        throw Error('Invalid Wormhole frame stamp');
    if (v.mode === 'exact') {
        base.push('jobId', 'frameIndex', 'fps', 'timestampUs');
        if (!id(v.jobId) || !integer(v.frameIndex, 0) || (v.fps !== 30 && v.fps !== 60)
            || !integer(v.timestampUs, 0) || v.songTime !== exactWormholeTime(v.frameIndex as number, v.fps)
            || v.timestampUs !== Math.round((v.frameIndex as number) * 1_000_000 / v.fps))
            throw Error('Invalid exact Wormhole frame clock');
    } else if (v.mode !== 'preview') throw Error('Invalid Wormhole frame mode');
    if (base.some(key => !Object.hasOwn(v, key)) || Object.keys(v).some(key => !base.includes(key)))
        throw Error('Unknown or missing Wormhole frame stamp field');
}

/** Inputs must already have passed the boundary validator. */
export function sameWormholeRenderFrame(a: WormholeRenderFrameStamp, b: WormholeRenderFrameStamp): boolean {
    return a.protocol === b.protocol && a.contextId === b.contextId && a.generation === b.generation
        && a.requestSerial === b.requestSerial && a.presentationRevision === b.presentationRevision
        && a.songTime === b.songTime && a.mode === b.mode
        && (a.mode !== 'exact' || (b.mode === 'exact' && a.jobId === b.jobId
            && a.frameIndex === b.frameIndex && a.fps === b.fps && a.timestampUs === b.timestampUs));
}
