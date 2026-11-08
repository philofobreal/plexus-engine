import HostWorker from './wormholeHostRender.worker.ts?worker';
import { projectRenderWorkerAnalysis } from '../types/CanvasVisualSource';
import type { WormholeHostAnalysis, WormholeHostFrame, WormholeHostRequest, WormholeHostResponse, WormholeHostRasterSource, WormholeHostTarget, WormholeHostPairing } from '../types/WormholeHostFrame';
import { assertWormholeRenderFrameStamp, sameWormholeRenderFrame, type WormholeRenderFrameStamp } from '../types/WormholeRenderFrame';
import type { WormholeRenderState } from './CosmicWormholeIdentity';
import { featureFlags } from '../config/featureFlags';
import { borrowResolvedWormholeFrame } from './VisualFramePreparation';
import { PausedPreviewGate } from './PausedPreviewGate';
import { isDefaultMusicDisplay, type MusicDisplaySettings } from '../types/MusicDisplay';

export interface HostWorkerPort {
    onmessage: ((event: MessageEvent<WormholeHostResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    onmessageerror: ((event: MessageEvent) => void) | null;
    postMessage(message: WormholeHostRequest): void;
    terminate(): void;
}
let nextContext = 0;
/** Preview broker: one flight, one latest desired snapshot, one retained image. Submission and
 * worker construction run in a microtask outside p5 draw; draw only snapshots/presents synchronously.
 */
export class WormholeHostWorkerSource implements WormholeHostRasterSource {
    private worker: HostWorkerPort | null = null;
    private analysis: WormholeHostAnalysis | null = null;
    private generation = 0; private serial = 0; private presentationRevision = 0;
    private readonly contextId = 'host-preview-' + ++nextContext;
    private ready = false; private flight: WormholeRenderFrameStamp | null = null;
    private pending: WormholeHostFrame | null = null;
    private control: 'prepare' | 'reset' | null = null;
    private scheduled = false;
    private deadline: ReturnType<typeof setTimeout> | null = null;
    private bitmap: ImageBitmap | null = null;
    private flightFrame: WormholeHostFrame | null = null;
    private bitmapFrame: WormholeHostFrame | null = null;
    private pairingKey: string | null = null;
    private awaitingPresentation = false;
    private inputRevision = 0; private queuedRevision = -1;
    get presentedFrame(): Readonly<WormholeHostFrame> | null { return this.bitmapFrame; }
    private failed = false; private disposed = false; private needsReset = true;
    private lastTime = -Infinity; private sentTime = -Infinity;
    private readonly changed = new PausedPreviewGate();
    private readonly presentation = new PausedPreviewGate();
    private hasPresentation = false;
    private kind = 'offscreen-pending';
    get rasterKind(): string { return this.failed ? 'fallback' : this.kind; }
    lastRenderMs = 0; framesReceived = 0;
    private readonly invalidate: () => void;
    private readonly createWorker: () => HostWorkerPort;
    private readonly schedule: (task: () => void) => void;
    constructor(invalidate: () => void, createWorker: () => HostWorkerPort = () => new HostWorker(),
        schedule: (task: () => void) => void = task => queueMicrotask(task)) {
        this.invalidate = invalidate; this.createWorker = createWorker; this.schedule = schedule;
    }
    private armDeadline(): void { this.clearDeadline(); this.deadline = setTimeout(() => this.fail(), 15000); }
    private clearDeadline(): void { if (this.deadline !== null) clearTimeout(this.deadline); this.deadline = null; }
    private closeImage(): void { this.bitmap?.close(); this.bitmap = null; this.bitmapFrame = null; this.awaitingPresentation = false; }
    private fail(): void {
        if (this.failed || this.disposed) return;
        this.failed = true; this.ready = false; this.pending = null; this.flight = null; this.flightFrame = null;
        this.clearDeadline(); this.closeImage(); this.worker?.terminate(); this.worker = null; this.invalidate();
    }
    reset(): void {
        if (this.disposed || this.failed) return;
        this.generation++; this.ready = false; this.flight = null; this.flightFrame = null; this.pending = null; this.needsReset = true;
        this.changed.invalidate(); this.lastTime = this.sentTime = -Infinity; this.closeImage();
        if (this.control !== 'prepare') this.control = 'reset';
        this.enqueue(); this.invalidate();
    }
    private enqueue(): void {
        if (this.scheduled || this.disposed || this.failed) return;
        this.scheduled = true;
        this.schedule(() => { this.scheduled = false; if (!this.disposed && !this.failed) try { this.pump(); } catch { this.fail(); } });
    }
    private connect(): void {
        const worker = this.createWorker(); this.worker = worker;
        worker.onerror = worker.onmessageerror = () => { if (worker === this.worker) this.fail(); };
        worker.onmessage = event => {
            const m = event.data;
            if (this.disposed || this.failed || worker !== this.worker || ('generation' in m && m.generation !== this.generation)
                || ('contextId' in m && m.contextId !== this.contextId)) { if (m.type === 'frame') m.bitmap.close(); return; }
            if (m.type === 'failure') { this.fail(); return; }
            if (m.type === 'ready') {
                if (m.contextId !== this.contextId) { this.fail(); return; }
                this.clearDeadline(); this.ready = true; this.enqueue(); this.invalidate(); return;
            }
            try { assertWormholeRenderFrameStamp(m.stamp); }
            catch { m.bitmap.close(); return; }
            if (!this.flight || m.serial !== this.flight.requestSerial || !sameWormholeRenderFrame(m.stamp, this.flight)) { m.bitmap.close(); return; }
            const expected = this.flightFrame!;
            if (m.bitmap.width !== Math.max(1,Math.round(expected.width*expected.density))
                || m.bitmap.height !== Math.max(1,Math.round(expected.height*expected.density))
                || !['gpu-material','webgl','canvas2d'].includes(m.raster) || !Number.isFinite(m.renderMs) || m.renderMs < 0) {
                m.bitmap.close(); this.fail(); return;
            }
            this.clearDeadline(); this.flight = null; this.closeImage(); this.bitmap = m.bitmap;
            this.bitmapFrame = this.flightFrame; this.flightFrame = null;
            this.awaitingPresentation = this.pairingKey !== null;
            this.framesReceived++; this.kind = 'offscreen-' + m.raster; this.lastRenderMs = m.renderMs;
            this.enqueue(); this.invalidate();
        };
    }
    acknowledgePresented(frame: Readonly<WormholeHostFrame>): void {
        if (frame === this.bitmapFrame && this.awaitingPresentation) { this.awaitingPresentation = false; this.invalidate(); }
    }
    private pump(): void {
        if (!this.analysis) return;
        if (!this.worker) { this.connect(); this.control = 'prepare'; }
        if (this.control) {
            const control = this.control; this.control = null; this.ready = false; this.armDeadline();
            if (control === 'prepare') this.worker!.postMessage({ type: 'prepare', generation: this.generation,
                contextId: this.contextId, analysis: projectRenderWorkerAnalysis(this.analysis) });
            else this.worker!.postMessage({ type: 'reset', generation: this.generation, contextId: this.contextId });
            return;
        }
        if (!this.ready || this.flight || !this.pending) return;
        const frame = this.pending; this.pending = null;
        frame.reset = this.needsReset; this.needsReset = false;
        const stamp: WormholeRenderFrameStamp = { protocol: 1, contextId: this.contextId, generation: this.generation,
            requestSerial: ++this.serial, presentationRevision: this.presentationRevision, songTime: frame.currentTime, mode: 'preview' };
        this.flight = stamp; this.flightFrame = frame; this.sentTime = frame.currentTime; this.armDeadline();
        this.worker!.postMessage({ type: 'render', generation: this.generation, serial: stamp.requestSerial, stamp, frame });
    }
    draw(state: WormholeRenderState, target: WormholeHostTarget, depthCue: number, transparent: boolean, playing = false, musicDisplay?: MusicDisplaySettings, pairing?: WormholeHostPairing): boolean {
        if (this.failed || this.disposed) return false;
        try {
            const pairKey = pairing?.key ?? null;
            if (pairKey !== this.pairingKey) {
                // Enter/re-arm a pair before any capture. Leaving for a pure Wormhole may reuse
                // its already valid image; discarding it would flash black at transition end.
                if (pairKey !== null) this.reset();
                this.pairingKey = pairKey; this.awaitingPresentation = false; this.changed.invalidate();
            }
            const a = this.analysis;
            if (!a || a.frames !== state.frames || a.events !== state.events || a.trackAnalysis !== state.trackAnalysis
                || a.sampleRate !== state.sampleRate || a.hopSize !== state.hopSize || a.bpm !== state.bpm) {
                this.analysis = { frames: state.frames, events: state.events, trackAnalysis: state.trackAnalysis,
                    sampleRate: state.sampleRate, hopSize: state.hopSize, bpm: state.bpm };
                this.control = 'prepare'; this.reset();
            }
            this.presentation.begin();
            for (const value of [target.width,target.height,target.rasterPixelRatio,target.compactMaterialPreview,transparent,depthCue,
                featureFlags.wormholeSkybox,musicDisplay?.mode,musicDisplay?.size,musicDisplay?.opacity]) this.presentation.watch(value);
            if (this.presentation.shouldDraw()) {
                this.presentationRevision++;
                if (this.hasPresentation) this.reset();
                this.hasPresentation = true;
            }
            if (state.currentTime < this.lastTime) this.reset();
            this.lastTime = state.currentTime;
            if (!Number.isFinite(state.currentTime) || state.currentTime < 0) return true;
            const resolved = borrowResolvedWormholeFrame(state).values;
            const frame: WormholeHostFrame = {
                ...(musicDisplay&&!isDefaultMusicDisplay(musicDisplay)?{musicDisplay}:{}),
                width: target.width, height: target.height,
                density: Math.min(target.rasterPixelRatio, (target.compactMaterialPreview ? 640 : 960) / Math.max(target.width, target.height)),
                compact: target.compactMaterialPreview, depthCue, transparent, skybox: featureFlags.wormholeSkybox,
                frameCount: target.frameCount, reset: false, currentTime: resolved.currentTime, isExporting: false, exportTime: 0,
                visualTuning: resolved.visualTuning, targetTuning: resolved.targetTuning, currentFrame: resolved.currentFrame,
                currentFeatures: resolved.currentFeatures, modulation: resolved.modulation, beatDecay: resolved.beatDecay,
                denseImpactFlash: resolved.denseImpactFlash, directorOutput: resolved.directorOutput,
                activeVisualTransitionId: resolved.activeVisualTransitionId, spiralTransitionAnchor: resolved.spiralTransitionAnchor, playbackFade: resolved.playbackFade
            };
            // Compare bounded scalar values, not JSON strings or immutable full analysis.
            this.changed.begin();
            const watch = (record: object): void => { for (const key in record) {
                if (key === 'frameCount') continue;
                const value = (record as Record<string, unknown>)[key]; this.changed.watch(key);
                if (value && typeof value === 'object') watch(value); else this.changed.watch(value);
            } };
            watch(frame); this.changed.watch(pairing?.revision);
            if (this.changed.shouldDraw()) this.inputRevision++;
            if (this.inputRevision !== this.queuedRevision
                && (!pairing || (this.ready && !this.flight && !this.pending && !this.awaitingPresentation))
                && (!playing || this.needsReset || frame.currentTime - this.sentTime >= 1 / 30 - .001)) {
                // Copy borrowed live values now: the deferred broker must never observe a later draw.
                this.pending = { ...frame, visualTuning: { ...frame.visualTuning }, targetTuning: { ...frame.targetTuning },
                    currentFrame: { ...frame.currentFrame, perceptualSpectrum: [...frame.currentFrame.perceptualSpectrum] },
                    currentFeatures: { ...frame.currentFeatures }, modulation: { ...frame.modulation }, directorOutput: { ...frame.directorOutput },
                    spiralTransitionAnchor: frame.spiralTransitionAnchor ? { ...frame.spiralTransitionAnchor } : null,
                    ...(frame.musicDisplay ? { musicDisplay: { ...frame.musicDisplay } } : {}) };
                pairing?.capture(this.pending);
                this.queuedRevision = this.inputRevision;
                this.enqueue();
            }
            if (this.failed) return false;
            if (this.bitmap) target.presentRaster(this.bitmap); else target.background(0, 0, 0);
            return true;
        } catch { this.fail(); return false; }
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.pending = null; this.flight = null; this.flightFrame = null; this.clearDeadline(); this.closeImage();
        this.worker?.terminate(); this.worker = null; this.analysis = null;
    }
}
