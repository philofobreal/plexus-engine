import { projectRenderWorkerAnalysis } from '../types/CanvasVisualSource';
import type { CanvasVisualPresentation, VisualAnalysisSnapshot } from '../types/CanvasVisualSource';
import type { ExactWormholeSource, WormholeFrameIdentity, WormholeFrameLease } from '../types/WormholeExactFrame';
import { exactWormholeTime, sameWormholeFrame, WORMHOLE_EXACT_SAMPLER } from '../types/WormholeExactFrame';
import type { WormholeContextSeed } from '../types/WormholeContext';
import type { WormholeWorkerRequest, WormholeWorkerResponse } from '../types/WormholeWorkerProtocol';
import WormholeRenderWorker from './wormholeRender.worker.ts?worker';

interface Port {
    onmessage: ((event: MessageEvent<WormholeWorkerResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    onmessageerror?: ((event: MessageEvent) => void) | null;
    postMessage(message: WormholeWorkerRequest, transfer?: Transferable[]): void;
    terminate(): void;
}
export interface WormholeExactWorkerOptions {
    readonly contextId: string;
    readonly contextSeed?: WormholeContextSeed;
    readonly width?: number;
    readonly height?: number;
    readonly depthCue?: number;
    readonly externalMaterial?: boolean;
    readonly externalLines?: boolean;
    readonly webglRaster?: boolean;
    readonly createWorker?: () => Port;
}

/** Offline exact adapter. Never reads a preview canvas or substitutes the latest frame.
 * A v1 peer is an explicit capability failure; composition may choose the local exact adapter.
 */
export class WormholeExactWorkerSource implements ExactWormholeSource {
    private readonly worker: Port;
    private generation = 0;
    private serial = 0;
    private capability = false;
    private ready = false;
    private duration = 0;
    private raster: 'webgl' | 'canvas2d' | null = null;
    get rasterKind(): 'webgl' | 'canvas2d' | null { return this.raster; }
    private failure: Error | null = null;
    private preparing: { resolve(): void; reject(error: Error): void; prepared: boolean; cleanup(): void } | null = null;
    private pending: { identity: WormholeFrameIdentity; resolve(lease: WormholeFrameLease): void; reject(error: Error): void;
        cleanup(): void } | null = null;
    private lease: WormholeFrameLease | null = null;
    private readonly handshakeTimer: ReturnType<typeof setTimeout>;
    private readonly options: WormholeExactWorkerOptions;

    constructor(options: WormholeExactWorkerOptions) {
        this.options = { ...options };
        if (!options.contextId) throw new Error('Missing exact Wormhole context identity.');
        this.worker = options.createWorker?.() ?? new WormholeRenderWorker() as unknown as Port;
        this.worker.onmessage = event => this.receive(event.data);
        this.worker.onerror = event => this.fail(new Error(event.message || 'Exact Wormhole worker error.'));
        this.worker.onmessageerror = () => this.fail(new Error('Exact Wormhole worker message could not be decoded.'));
        this.handshakeTimer = setTimeout(() => this.fail(new Error('Exact Wormhole capability handshake timed out.')), 15000);
        try {
            this.worker.postMessage({ type: 'init', protocol: 2, contextId: options.contextId, contextSeed: options.contextSeed,
                width: options.width ?? 960, height: options.height ?? 540, depthCue: options.depthCue ?? 0,
                externalMaterial: options.externalMaterial, externalLines: options.externalLines, webglRaster: options.webglRaster });
        } catch (error) { this.fail(asError(error)); }
    }

    prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        if (this.failure) return Promise.reject(this.failure);
        this.ready = false; this.generation++;
        this.rejectPreparation(new Error('Exact Wormhole preparation superseded.'));
        this.rejectPending(new Error('Exact Wormhole request superseded.'));
        this.lease?.release();
        this.duration = analysis?.duration ?? 0;
        return new Promise((resolve, reject) => {
            const generation = this.generation;
            const timer = setTimeout(() => {
                if (this.generation === generation && this.preparing)
                    this.fail(new Error('Exact Wormhole preparation timed out.'));
            }, 15000);
            this.preparing = { resolve, reject, prepared: false, cleanup: () => clearTimeout(timer) };
            try { this.worker.postMessage({ type: 'prepare', generation: this.generation, analysis: analysis && projectRenderWorkerAnalysis(analysis) }); }
            catch (error) { this.fail(asError(error)); }
        });
    }

    requestFrame(frameIndex: number, fps: number, signal?: AbortSignal): Promise<WormholeFrameLease> {
        if (this.failure) return Promise.reject(this.failure);
        if (!this.ready || !this.capability) return Promise.reject(new Error('Exact Wormhole capability is not prepared.'));
        if (this.pending || this.lease) return Promise.reject(new Error('Release the current exact Wormhole frame before requesting another.'));
        let songTime: number;
        try { songTime = exactWormholeTime(frameIndex, fps); } catch (error) { return Promise.reject(asError(error)); }
        if (!Number.isFinite(this.duration) || this.duration < 0 || songTime > this.duration)
            return Promise.reject(new Error('Exact Wormhole time outside prepared track.'));
        if (signal?.aborted) return Promise.reject(new Error('Exact Wormhole request cancelled.'));
        const identity = { contextId: this.options.contextId, generation: this.generation, requestSerial: ++this.serial, frameIndex, fps, songTime };
        return new Promise((resolve, reject) => {
            const abort = () => this.fail(new Error('Exact Wormhole request cancelled.'));
            const timer = setTimeout(() => this.fail(new Error('Exact Wormhole frame timed out.')), 120000);
            signal?.addEventListener('abort', abort, { once: true });
            this.pending = { identity, resolve, reject, cleanup: () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); } };
            try { this.worker.postMessage({ type: 'render-exact', identity }); }
            catch (error) { this.fail(asError(error)); }
        });
    }

    setPresentation(presentation: CanvasVisualPresentation): void {
        if (this.failure) throw this.failure;
        if (this.pending || this.lease) throw new Error('Exact Wormhole context is busy.');
        try { this.worker.postMessage({ type: 'presentation', presentation }); }
        catch (error) { this.fail(asError(error)); throw asError(error); }
    }

    dispose(): void { this.fail(new Error('Exact Wormhole source disposed.')); }

    private receive(message: WormholeWorkerResponse): void {
        if (message.type === 'exact-frame') {
            const { identity, frame } = message;
            if (this.failure || !this.pending || !sameWormholeFrame(this.pending.identity, identity)) {
                frame.bitmap.close(); this.returnFrame(identity, frame.material?.data.buffer as ArrayBuffer | undefined); return;
            }
            if (frame.generation !== identity.generation || frame.time !== identity.songTime || (frame.spatial && frame.spatial.time !== identity.songTime)) {
                frame.bitmap.close(); this.returnFrame(identity, frame.material?.data.buffer as ArrayBuffer | undefined);
                this.fail(new Error('Exact Wormhole companion identity mismatch.')); return;
            }
            const pending = this.pending; this.pending = null; pending.cleanup();
            let released = false;
            const lease: WormholeFrameLease = { identity: Object.freeze({ ...identity }), bitmap: frame.bitmap,
                focalPoint: Object.freeze({ x: frame.focalX, y: frame.focalY }), material: frame.material ?? null,
                lines: frame.lines ?? null, spatial: frame.spatial ?? null,
                release: () => {
                    if (released) return; released = true;
                    frame.bitmap.close(); this.returnFrame(identity, frame.material?.data.buffer as ArrayBuffer | undefined);
                    if (this.lease === lease) this.lease = null;
                } };
            this.lease = lease; pending.resolve(lease); return;
        }
        if (this.failure) { if (message.type === 'frame') message.bitmap.close(); return; }
        switch (message.type) {
            case 'capabilities':
                if (message.protocol !== 2 || message.contextId !== this.options.contextId || message.sampler !== WORMHOLE_EXACT_SAMPLER) {
                    this.fail(new Error('Unsupported exact Wormhole capability.')); return;
                }
                this.capability = true; clearTimeout(this.handshakeTimer); this.settleReady(); return;
            case 'prepared':
                if (message.generation !== this.generation || !this.preparing) return;
                if (!this.capability) { this.fail(new Error('Worker did not negotiate exact Wormhole capability.')); return; }
                this.raster = message.raster ?? null;
                this.preparing.prepared = true; this.settleReady(); return;
            case 'prepare-error':
                if (message.generation !== this.generation) return;
                this.rejectPreparation(new Error(message.message)); return;
            case 'exact-error':
                if (this.pending && sameWormholeFrame(this.pending.identity, message.identity)) this.rejectPending(new Error(message.message));
                return;
            case 'failure': this.fail(new Error(message.message)); return;
            case 'frame': message.bitmap.close(); this.fail(new Error('Preview frame received by exact Wormhole adapter.')); return;
            case 'unchanged': this.fail(new Error('Unchanged preview response cannot satisfy an exact Wormhole request.')); return;
        }
    }
    private settleReady(): void {
        if (!this.capability || !this.preparing?.prepared) return;
        this.ready = true; const preparing = this.preparing; this.preparing = null; preparing.cleanup(); preparing.resolve();
    }
    private returnFrame(identity: WormholeFrameIdentity, buffer?: ArrayBuffer): void {
        if (this.failure) return;
        try { this.worker.postMessage({ type: 'release-exact', identity, buffer }, buffer ? [buffer] : []); }
        catch (error) { this.fail(asError(error)); }
    }
    private rejectPending(error: Error): void {
        const pending = this.pending; this.pending = null; pending?.cleanup(); pending?.reject(error);
    }
    private rejectPreparation(error: Error): void {
        const preparing = this.preparing; this.preparing = null; preparing?.cleanup(); preparing?.reject(error);
    }
    private fail(error: Error): void {
        if (this.failure) return;
        this.failure = error; this.ready = false; clearTimeout(this.handshakeTimer);
        this.rejectPreparation(error); this.rejectPending(error);
        this.lease?.release(); this.lease = null;
        this.worker.onmessage = null; this.worker.onerror = null; this.worker.onmessageerror = null; this.worker.terminate();
    }
}
function asError(error: unknown): Error { return error instanceof Error ? error : new Error(String(error)); }
