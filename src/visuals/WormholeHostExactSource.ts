import HostWorker from './wormholeHostRender.worker.ts?worker';
import { projectRenderWorkerAnalysis } from '../types/CanvasVisualSource';
import { assertWormholeRenderFrameStamp, sameWormholeRenderFrame } from '../types/WormholeRenderFrame';
import { assertWormholeHostExactConfig, assertWormholeHostExactFrame, sameWormholeHostExactConfig,
    type WormholeHostAnalysis, type WormholeHostExactConfig, type WormholeHostExactLease,
    type WormholeHostExactStamp, type WormholeHostFrame, type WormholeHostResponse } from '../types/WormholeHostFrame';
import type { HostWorkerPort } from './WormholeHostWorkerSource';
import { copyWormholeHostFrame } from './VisualFramePreparation';

type Pending = { kind: 'prepare'; resolve(): void; reject(error: Error): void }
    | { kind: 'frame'; stamp: WormholeHostExactStamp; frame: WormholeHostFrame;
        resolve(lease: WormholeHostExactLease): void; reject(error: Error): void };
let nextExactContext = 0;

/** Job-owned resolved-input broker. One request OR one leased image; no latest-wins queue,
 * rate cap, display wait, preview density, resolver or audio access. The export coordinator
 * supplies every required frame and retains ownership of the complete job/encoder timeline.
 */
export class WormholeHostExactSource {
    private readonly contextId = 'host-exact-' + ++nextExactContext;
    private readonly generation = 1;
    private serial = 0;
    private lastIndex = -1;
    private revision = 0;
    private presentation = '';
    private worker: HostWorkerPort | null = null;
    private config: WormholeHostExactConfig | null = null;
    private pending: Pending | null = null;
    private lease: WormholeHostExactLease | null = null;
    private deadline: ReturnType<typeof setTimeout> | null = null;
    private detachAbort: (() => void) | null = null;
    private ready = false;
    private failure: Error | null = null;
    private disposed = false;
    private readonly createWorker: () => HostWorkerPort;
    private readonly schedule: (task: () => void) => void;

    constructor(createWorker: () => HostWorkerPort = () => new HostWorker(),
        schedule: (task: () => void) => void = task => queueMicrotask(task)) {
        this.createWorker = createWorker; this.schedule = schedule;
    }

    prepare(analysis: WormholeHostAnalysis, config: WormholeHostExactConfig, signal?: AbortSignal): Promise<void> {
        try {
            assertWormholeHostExactConfig(config);
            if (this.config || this.disposed || this.failure) throw Error('Exact host source cannot be prepared again');
        } catch (error) { return Promise.reject(error); }
        this.config = { ...config };
        return new Promise((resolve, reject) => {
            this.pending = { kind: 'prepare', resolve, reject };
            this.arm(signal, 15_000);
            this.schedule(() => {
                if (!this.pending || this.failure || this.disposed) return;
                try {
                    const worker = this.createWorker(); this.worker = worker;
                    worker.onmessage = event => this.receive(event.data);
                    worker.onerror = worker.onmessageerror = () => {
                        if (this.worker === worker) this.fail(Error('Exact host worker failed'));
                    };
                    worker.postMessage({ type: 'prepare', contextId: this.contextId, generation: this.generation,
                        exact: this.config!, analysis: projectRenderWorkerAnalysis(analysis) });
                } catch (error) { this.fail(error); }
            });
        });
    }

    requestFrame(frameIndex: number, frame: WormholeHostFrame, signal?: AbortSignal): Promise<WormholeHostExactLease> {
        let stamp: WormholeHostExactStamp, owned: WormholeHostFrame;
        try {
            if (!this.ready || !this.config || this.disposed || this.failure) throw this.failure ?? Error('Exact host source is not ready');
            if (this.pending || this.lease) throw Error('Release the exact host frame before requesting another');
            stamp = { protocol: 1, contextId: this.contextId, generation: this.generation, requestSerial: this.serial + 1,
                presentationRevision: this.revision, mode: 'exact', jobId: this.config.jobId, frameIndex,
                fps: this.config.fps, songTime: frameIndex / this.config.fps,
                timestampUs: Math.round(frameIndex * 1_000_000 / this.config.fps) };
            assertWormholeHostExactFrame(frame, stamp, this.config);
            if (frameIndex < this.lastIndex) throw Error('Exact host frames cannot move backwards');
            owned = copyWormholeHostFrame(frame);
            const presentation = [frame.transparent, frame.depthCue, frame.skybox,
                frame.musicDisplay?.mode, frame.musicDisplay?.size, frame.musicDisplay?.opacity].join('/');
            if (presentation !== this.presentation) { this.presentation = presentation; this.revision++; }
            stamp = { ...stamp, presentationRevision: this.revision };
        } catch (error) { return Promise.reject(error); }
        this.serial = stamp.requestSerial; this.lastIndex = frameIndex;
        return new Promise((resolve, reject) => {
            this.pending = { kind: 'frame', stamp, frame: owned, resolve, reject };
            this.arm(signal, 30_000);
            this.schedule(() => {
                if (this.pending?.kind !== 'frame' || this.pending.stamp !== stamp || this.failure || this.disposed) return;
                try { this.worker!.postMessage({ type: 'render', generation: this.generation,
                    serial: stamp.requestSerial, stamp, frame: owned }); }
                catch (error) { this.fail(error); }
            });
        });
    }

    private arm(signal: AbortSignal | undefined, timeout: number): void {
        this.deadline = setTimeout(() => this.fail(Error('Exact host worker timed out')), timeout);
        if (signal) {
            const abort = () => this.fail(Error('Exact host request cancelled'));
            this.detachAbort = () => signal.removeEventListener('abort', abort);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
        }
    }
    private takePending(): Pending | null {
        if (this.deadline !== null) clearTimeout(this.deadline);
        this.deadline = null; this.detachAbort?.(); this.detachAbort = null;
        const pending = this.pending; this.pending = null; return pending;
    }
    private receive(message: WormholeHostResponse): void {
        const close = () => { if (message.type === 'frame') message.bitmap.close(); };
        if (this.disposed || this.failure || ('generation' in message && message.generation !== this.generation)
            || ('contextId' in message && message.contextId !== this.contextId)) { close(); return; }
        if (message.type === 'failure') { this.fail(Error(message.message)); return; }
        if (message.type === 'ready') {
            if (this.pending?.kind !== 'prepare') return;
            try {
                assertWormholeHostExactConfig(message.exact);
                if (message.contextId !== this.contextId || !sameWormholeHostExactConfig(message.exact, this.config!))
                    throw Error('Exact host negotiation mismatch');
            } catch (error) { this.fail(error); return; }
            const pending = this.takePending(); this.ready = true;
            if (pending?.kind === 'prepare') pending.resolve();
            return;
        }
        const pending = this.pending;
        try { assertWormholeRenderFrameStamp(message.stamp); }
        catch { close(); return; }
        if (pending?.kind !== 'frame' || message.serial !== pending.stamp.requestSerial
            || !sameWormholeRenderFrame(message.stamp, pending.stamp)) { close(); return; }
        if (message.bitmap.width !== this.config!.width || message.bitmap.height !== this.config!.height
            || !['gpu-material','webgl','canvas2d'].includes(message.raster) || !Number.isFinite(message.renderMs) || message.renderMs < 0) {
            close(); this.fail(Error('Invalid exact host image')); return;
        }
        this.takePending();
        let released = false;
        const lease: WormholeHostExactLease = { stamp: pending.stamp, frame: pending.frame,
            bitmap: message.bitmap, raster: message.raster, release: () => {
                if (released) return; released = true; message.bitmap.close();
                if (this.lease === lease) this.lease = null;
            } };
        this.lease = lease; pending.resolve(lease);
    }
    private fail(error: unknown): void {
        if (this.failure || this.disposed) return;
        this.failure = error instanceof Error ? error : Error(String(error)); this.ready = false;
        this.takePending()?.reject(this.failure); this.lease?.release();
        this.worker?.terminate(); this.worker = null;
    }
    dispose(): void {
        if (this.disposed) return;
        this.fail(Error('Exact host source disposed')); this.disposed = true; this.config = null;
    }
}
