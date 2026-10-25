import HostWorker from './wormholeHostRender.worker.ts?worker';
import { projectRenderWorkerAnalysis } from '../types/CanvasVisualSource';
import type { WormholeHostAnalysis, WormholeHostFrame, WormholeHostRequest, WormholeHostResponse, WormholeHostRasterSource, WormholeHostTarget } from '../types/WormholeHostFrame';
import type { WormholeRenderState } from './CosmicWormholeIdentity';
import { featureFlags } from '../config/featureFlags';

export interface HostWorkerPort {
    onmessage: ((event: MessageEvent<WormholeHostResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    onmessageerror: ((event: MessageEvent) => void) | null;
    postMessage(message: WormholeHostRequest): void;
    terminate(): void;
}

/** One worker, one in-flight request and one retained bitmap. Full analysis crosses once per load.
 * The main thread resolves controls/audio; ALL Wormhole geometry/material/raster work runs off-thread.
 */
export class WormholeHostWorkerSource implements WormholeHostRasterSource {
    private worker: HostWorkerPort | null = null;
    private analysis: WormholeHostAnalysis | null = null;
    private generation = 0;
    private serial = 0;
    private ready = false;
    private flight = 0;
    private deadline: ReturnType<typeof setTimeout> | null = null;
    private bitmap: ImageBitmap | null = null;
    private failed = false;
    private disposed = false;
    private needsReset = true;
    private lastKey = '';
    private lastTime = -Infinity;
    private dimensions = '';
    private sentTime = -Infinity;
    private kind = 'offscreen-pending';
    get rasterKind(): string { return this.failed ? 'fallback' : this.kind; }
    lastRenderMs = 0;
    framesReceived = 0;
    private readonly invalidate: () => void;
    private readonly createWorker: () => HostWorkerPort;
    constructor(invalidate: () => void, createWorker: () => HostWorkerPort = () => new HostWorker()) {
        this.invalidate = invalidate; this.createWorker = createWorker;
    }

    private armDeadline(): void {
        this.clearDeadline();
        this.deadline = setTimeout(() => this.fail(), 15000);
    }
    private clearDeadline(): void { if (this.deadline !== null) clearTimeout(this.deadline); this.deadline = null; }
    private closeImage(): void { this.bitmap?.close(); this.bitmap = null; }
    private fail(): void {
        this.failed = true; this.ready = false; this.clearDeadline(); this.closeImage();
        this.worker?.terminate(); this.worker = null; this.invalidate();
    }
    reset(): void {
        if (this.disposed || this.failed) return;
        this.generation++; this.ready = false; this.flight = 0; this.needsReset = true;
        this.lastKey = ''; this.lastTime = -Infinity; this.closeImage();
        if (this.worker) try {
            this.armDeadline(); this.worker.postMessage({ type: 'reset', generation: this.generation });
        } catch { this.fail(); }
        this.invalidate();
    }
    private start(analysis: WormholeHostAnalysis): void {
        this.worker ??= this.createWorker();
        const worker = this.worker;
        worker.onerror = worker.onmessageerror = () => this.fail();
        worker.onmessage = event => {
            const message = event.data;
            if (this.disposed || this.failed || worker !== this.worker) { if (message.type === 'frame') message.bitmap.close(); return; }
            if (message.type === 'failure') { this.fail(); return; }
            if (message.generation !== this.generation) { if (message.type === 'frame') message.bitmap.close(); return; }
            if (message.type === 'ready') { this.clearDeadline(); this.ready = true; this.invalidate(); return; }
            if (message.serial !== this.flight) { message.bitmap.close(); return; }
            this.clearDeadline(); this.flight = 0; this.closeImage(); this.bitmap = message.bitmap;
            this.framesReceived++; this.kind = 'offscreen-' + message.raster; this.lastRenderMs = message.renderMs; this.invalidate();
        };
        this.generation++; this.ready = false; this.flight = 0; this.needsReset = true;
        this.closeImage(); this.lastKey = ''; this.lastTime = -Infinity;
        this.analysis = analysis; this.armDeadline();
        worker.postMessage({ type: 'prepare', generation: this.generation, analysis: projectRenderWorkerAnalysis(analysis) });
    }
    draw(state: WormholeRenderState, target: WormholeHostTarget, depthCue: number, transparent: boolean, playing = false): boolean {
        if (this.failed || this.disposed) return false;
        try {
            const a = this.analysis;
            if (!a || a.frames !== state.frames || a.events !== state.events || a.trackAnalysis !== state.trackAnalysis
                || a.sampleRate !== state.sampleRate || a.hopSize !== state.hopSize || a.bpm !== state.bpm) {
                this.start({ frames: state.frames, events: state.events, trackAnalysis: state.trackAnalysis,
                    sampleRate: state.sampleRate, hopSize: state.hopSize, bpm: state.bpm });
            }
            const dimensions = `${target.width}/${target.height}/${target.rasterPixelRatio}/${target.compactMaterialPreview}/${transparent}`;
            if (this.dimensions && dimensions !== this.dimensions) this.reset();
            this.dimensions = dimensions;
            if (state.currentTime < this.lastTime) this.reset();
            this.lastTime = state.currentTime;
            const frame: WormholeHostFrame = {
                width: target.width, height: target.height,
                density: Math.min(target.rasterPixelRatio, (target.compactMaterialPreview ? 640 : 960) / Math.max(target.width, target.height)),
                compact: target.compactMaterialPreview, depthCue, transparent, skybox: featureFlags.wormholeSkybox,
                frameCount: 0, reset: false, currentTime: state.currentTime, isExporting: false, exportTime: 0,
                visualTuning: state.visualTuning, targetTuning: state.targetTuning, currentFrame: state.currentFrame,
                currentFeatures: state.currentFeatures, modulation: state.modulation, beatDecay: state.beatDecay,
                denseImpactFlash: state.denseImpactFlash, directorOutput: state.directorOutput,
                activeVisualTransitionId: state.activeVisualTransitionId, spiralTransitionAnchor: state.spiralTransitionAnchor,
                playbackFade: state.playbackFade
            };
            const key = JSON.stringify(frame);
            if (this.ready && !this.flight && key !== this.lastKey && (!playing || this.needsReset || state.currentTime - this.sentTime >= 1 / 30 - .001)) {
                this.sentTime = state.currentTime; frame.frameCount = target.frameCount; frame.reset = this.needsReset;
                this.needsReset = false; this.lastKey = key; this.flight = ++this.serial;
                this.armDeadline(); this.worker!.postMessage({ type: 'render', generation: this.generation, serial: this.flight, frame });
            }
            if (this.bitmap) target.presentRaster(this.bitmap);
            else target.background(0, 0, 0);
            return true;
        } catch { this.fail(); return false; }
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.clearDeadline(); this.closeImage();
        this.worker?.terminate(); this.worker = null; this.analysis = null;
    }
}
