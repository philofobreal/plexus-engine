import type { CanvasVisualPresentation, VisualAnalysisSnapshot } from '../types/CanvasVisualSource';
import { exactWormholeTime, type ExactWormholeSource, type WormholeFrameLease } from '../types/WormholeExactFrame';
import { WormholeCanvasSource, type WormholeCanvasSourceOptions } from './WormholeCanvasSource';
import { GRAIN_CARRIER_STRIDE } from '../types/GrainMaterialFrame';
import { GRAIN_LINE_STRIDE } from '../types/GrainLineFrame';

/** Local exact-capable fallback, selected explicitly by composition when workers cannot negotiate
 * v2. It owns its private source; never wraps the live preview or exports a stale preview image.
 */
export class WormholeExactFrameSource implements ExactWormholeSource {
    private readonly source: WormholeCanvasSource;
    private generation = 0;
    private serial = 0;
    private ready = false;
    private disposed = false;
    private busy = false;
    private lease: WormholeFrameLease | null = null;
    get rasterKind(): 'webgl' | 'canvas2d' { return this.source.rasterKind; }
    private readonly contextId: string;
    constructor(contextId: string, options: WormholeCanvasSourceOptions = {}) {
        this.contextId = contextId;
        if (!contextId) throw new Error('Missing exact Wormhole context identity.');
        this.source = new WormholeCanvasSource(options);
    }
    async prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        if (this.disposed) throw new Error('Exact Wormhole source disposed.');
        const generation = ++this.generation;
        this.ready = false; this.lease?.release();
        await this.source.prepare(analysis);
        if (this.disposed || generation !== this.generation) throw new Error('Exact Wormhole preparation superseded.');
        this.ready = true;
    }
    async requestFrame(frameIndex: number, fps: number, signal?: AbortSignal): Promise<WormholeFrameLease> {
        if (!this.ready || this.disposed) throw new Error('Exact Wormhole source is not prepared.');
        if (this.busy || this.lease) throw new Error('Release the current exact Wormhole frame before requesting another.');
        const songTime = exactWormholeTime(frameIndex, fps), generation = this.generation;
        const identity = Object.freeze({ contextId: this.contextId, generation, requestSerial: ++this.serial, frameIndex, fps, songTime });
        const check = () => {
            if (signal?.aborted) throw new Error('Exact Wormhole request cancelled.');
            if (this.disposed || generation !== this.generation) throw new Error('Exact Wormhole request superseded.');
        };
        this.busy = true;
        let bitmap: ImageBitmap | null = null;
        try {
            await Promise.resolve(); check(); this.source.renderExact(songTime);
            const focalPoint = Object.freeze({ ...this.source.focalPoint });
            const material = this.source.materialFrame ? { ...this.source.materialFrame,
                data: this.source.materialFrame.data.slice(0, this.source.materialFrame.count * GRAIN_CARRIER_STRIDE) } : null;
            const lines = this.source.lineFrame ? { ...this.source.lineFrame,
                data: this.source.lineFrame.data.slice(0, this.source.lineFrame.count * GRAIN_LINE_STRIDE) } : null;
            const spatial = this.source.spatialFrame ? { ...this.source.spatialFrame } : null;
            bitmap = await createImageBitmap(this.source.canvas); check();
            let released = false;
            const image = bitmap;
            const lease: WormholeFrameLease = { identity, bitmap: image, focalPoint, material, lines, spatial,
                release: () => { if (released) return; released = true; image.close(); if (this.lease === lease) this.lease = null; } };
            this.lease = lease; bitmap = null; return lease;
        } finally { bitmap?.close(); this.busy = false; }
    }
    setPresentation(presentation: CanvasVisualPresentation): void {
        if (this.busy || this.lease) throw new Error('Exact Wormhole context is busy.');
        if (this.disposed) throw new Error('Exact Wormhole source disposed.');
        this.source.setPresentation(presentation);
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.ready = false; this.generation++;
        this.lease?.release(); this.source.dispose();
    }
}
