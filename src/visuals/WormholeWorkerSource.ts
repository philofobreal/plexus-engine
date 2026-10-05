// Main-thread proxy for the off-thread Wormhole renderer (ADR-009 Addendum G). Implements the
// synchronous `CanvasVisualSource` contract over the typed worker protocol: the host keeps calling
// `render(time, playing)` on its own cadence; each call presents the newest finished frame (zero-copy
// `ImageBitmap` transfer into a `bitmaprenderer` canvas) and asks the worker for the next one.
//
// Backpressure: at most one render request is in flight; a slow frame is never queued behind
// another. Generations: every `prepare` starts a new generation, and frames/answers from an older
// one are dropped (their bitmaps closed). While playing, a request targets the time at which its
// frame will be shown (one host interval ahead), so the background stays in sync with the music
// despite the asynchronous hop. The analysis is copied (structured clone), never transferred, and
// only once per published analysis: a regenerated plan over it is sent alone (`prepare-plan`).
//
// Carrier buffers (external material) are lent by the worker's pool: the proxy owns a frame's
// buffer while that frame is pending or shown, and transfers it back (`release-material`) when the
// next frame replaces it, when the frame is stale or discarded. The host copies carriers out
// synchronously after `render` (`GrainMaterialRenderer.setFrame`), so `materialFrame` is valid only
// until the next frame is presented. After dispose or a failure buffers are simply dropped.

import type { CanvasVisualPresentation, CanvasVisualSource, VisualAnalysisSnapshot, VisualFocalPoint } from '../types/CanvasVisualSource';
import type { GrainMaterialFrame } from '../types/GrainMaterialFrame';
import type { GrainLineFrame } from '../types/GrainLineFrame';
import { WORMHOLE_WORKER_PROTOCOL_VERSION, type WormholeWorkerRequest, type WormholeWorkerResponse } from '../types/WormholeWorkerProtocol';
import WormholeRenderWorker from './wormholeRender.worker.ts?worker';

/** The subset of `Worker` the proxy uses (tests inject a double). */
export interface WormholeWorkerPort {
    onmessage: ((event: MessageEvent<WormholeWorkerResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage(message: WormholeWorkerRequest, transfer?: Transferable[]): void;
    terminate(): void;
}

export interface WormholeWorkerSourceOptions {
    readonly width?: number;
    readonly height?: number;
    readonly depthCue?: number;
    /** Opt-in debug surface (`?xrDiagnostics=1`), decided by the composition root. */
    readonly diagnostics?: boolean;
    /** The worker measures per-stage redraw times (`stageTimes`; ADR-009 Addenda U and X). */
    readonly profile?: boolean;
    /** Host-rendered grain material: frames carry carriers (`materialFrame`; ADR-009 Addendum W). */
    readonly externalMaterial?: boolean;
    /** With `externalMaterial`: grain trail strokes as a line list (`lineFrame`; ADR-009 Addendum AA). */
    readonly externalLines?: boolean;
    readonly createWorker?: () => WormholeWorkerPort;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;
const DEFAULT_FRAME_RATE_HZ = 30;
/** Smoothing of the measured request latency and presentation lead (per received / shown frame). */
const LATENCY_SMOOTHING = 0.25;
const LEAD_SMOOTHING = 0.3;
const latencyClock: { now(): number } | null = typeof performance !== 'undefined' ? performance : null;

/**
 * True when this browser can run the off-thread path: module workers, OffscreenCanvas with
 * `transferToImageBitmap`, and a `bitmaprenderer` context (probed on a throwaway canvas).
 */
export function wormholeWorkerSupported(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || !doc) return false;
    if (typeof OffscreenCanvas.prototype.transferToImageBitmap !== 'function') return false;
    try { return !!doc.createElement('canvas').getContext('bitmaprenderer'); } catch { return false; }
}

/** True when two snapshots differ at most in their performance plan (same published analysis). */
function sameAnalysisData(a: VisualAnalysisSnapshot, b: VisualAnalysisSnapshot | null): boolean {
    return b !== null && a.frames === b.frames && a.events === b.events && a.trackAnalysis === b.trackAnalysis
        && a.sampleRate === b.sampleRate && a.hopSize === b.hopSize && a.bpm === b.bpm && a.duration === b.duration;
}

interface PendingPrepare {
    readonly generation: number;
    readonly resolve: () => void;
    readonly reject: (error: Error) => void;
}

export class WormholeWorkerSource implements CanvasVisualSource {
    readonly canvas: HTMLCanvasElement;
    onFrameReady: (() => void) | null = null;
    onError: ((message: string) => void) | null = null;
    private readonly presenter: ImageBitmapRenderingContext;
    private readonly worker: WormholeWorkerPort;
    private readonly focus = { x: 0, y: 0 };
    private readonly diagnostics: boolean;
    private generation = 0;
    private preparedGeneration = -1;
    private preparing: PendingPrepare | null = null;
    /** The analysis last posted in full (`prepare`); the worker keeps its copy of it. */
    private sentAnalysis: VisualAnalysisSnapshot | null = null;
    private pending: { bitmap: ImageBitmap; focalX: number; focalY: number; renderMs: number; stages: Readonly<Record<string, number>> | null;
        material: GrainMaterialFrame | null; lines: GrainLineFrame | null; requestedSongTime: number; requestedPlaying: boolean } | null = null;
    private stages: Readonly<Record<string, number>> | null = null;
    private material: GrainMaterialFrame | null = null;
    /** Trail lines of the frame shown; they share the material's pooled buffer (released with it). */
    private lines: GrainLineFrame | null = null;
    private inFlight = false;
    private lastTime = Number.NaN;
    private lastPlaying = false;
    private presentationDirty = false;
    private leadSec = 1 / DEFAULT_FRAME_RATE_HZ;
    /** The request in flight: when it was posted (wall clock) and the song time it was asked at. */
    private requestedAt = 0;
    private requestedSongTime = Number.NaN;
    private requestedPlaying = false;
    private latencyMs = 0;
    private renderMs = 0;
    private shownFrames = 0;
    private failure: string | null = null;
    private disposed = false;

    constructor(options: WormholeWorkerSourceOptions = {}) {
        this.diagnostics = options.diagnostics === true;
        const width = Math.round(options.width ?? DEFAULT_WIDTH), height = Math.round(options.height ?? DEFAULT_HEIGHT);
        this.canvas = document.createElement('canvas');
        this.canvas.width = width; this.canvas.height = height;
        const presenter = this.canvas.getContext('bitmaprenderer');
        if (!presenter) throw new Error('ImageBitmap presentation is unavailable.');
        this.presenter = presenter;
        this.worker = options.createWorker ? options.createWorker() : new WormholeRenderWorker() as unknown as WormholeWorkerPort;
        this.worker.onmessage = event => this.receive(event.data);
        this.worker.onerror = event => this.fail(event.message || 'Wormhole worker error.');
        this.worker.postMessage({ type: 'init', protocol: WORMHOLE_WORKER_PROTOCOL_VERSION, width, height, depthCue: options.depthCue ?? 0,
            ...(options.profile ? { profile: true } : {}), ...(options.externalMaterial ? { externalMaterial: true } : {}),
            ...(options.externalMaterial && options.externalLines ? { externalLines: true } : {}) });
        if (this.diagnostics) {
            this.canvas.hidden = true;
            this.canvas.dataset.xrWormhole = 'worker';
            document.body.appendChild(this.canvas);
        }
    }

    /** Focal point of the frame currently shown (it travels with the frame from the worker). */
    get focalPoint(): VisualFocalPoint { return this.focus; }

    /** Smoothed request -> frame time in milliseconds (0 until measured); the host paces redraws with it. */
    get frameLatencyMs(): number { return this.latencyMs; }

    /** Worker-side raster time of the frame currently shown, in milliseconds. */
    get lastRenderMs(): number { return this.renderMs; }

    /** The grain material carriers of the frame currently shown (external material only). */
    get materialFrame(): GrainMaterialFrame | null { return this.material; }

    /** The grain trail lines of the frame currently shown (external lines only; same lifetime as `materialFrame`). */
    get lineFrame(): GrainLineFrame | null { return this.lines; }

    /** Worker-side stage times of the frame currently shown (diagnostics only, else null). */
    get stageTimes(): Readonly<Record<string, number>> | null { return this.stages; }

    prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        if (this.disposed) return Promise.resolve();
        if (this.failure) return Promise.reject(new Error(this.failure));
        const generation = ++this.generation;
        // A superseded preparation settles quietly, exactly like the in-thread source.
        this.preparing?.resolve();
        this.preparing = null;
        this.discardPending();
        this.inFlight = false;
        this.lastTime = Number.NaN;
        // A regenerated plan over the same published analysis sends the plan alone (`prepare-plan`).
        const planUpdate = analysis !== null && sameAnalysisData(analysis, this.sentAnalysis) ? analysis.performancePlan : null;
        return new Promise<void>((resolve, reject) => {
            this.preparing = { generation, resolve, reject };
            try {
                if (planUpdate) this.worker.postMessage({ type: 'prepare-plan', generation, performancePlan: planUpdate });
                else { this.sentAnalysis = null; this.worker.postMessage({ type: 'prepare', generation, analysis }); this.sentAnalysis = analysis; }
            } catch (error) { this.preparing = null; reject(error instanceof Error ? error : new Error(String(error))); }
        });
    }

    render(time: number, playing: boolean): boolean {
        if (this.disposed || this.failure) return false;
        let changed = false;
        const frame = this.pending;
        if (frame) {
            this.pending = null;
            this.presenter.transferFromImageBitmap(frame.bitmap);
            this.focus.x = frame.focalX; this.focus.y = frame.focalY;
            this.renderMs = frame.renderMs;
            this.stages = frame.stages;
            // The previous frame's carriers were copied when it was shown; its buffer goes back to the pool.
            const previous = this.material;
            this.material = frame.material;
            this.lines = frame.lines;
            if (previous !== frame.material) this.releaseMaterial(previous);
            if (this.diagnostics) this.canvas.dataset.frames = String(++this.shownFrames);
            // The lead follows how much later a requested frame actually reaches the screen (whole host
            // intervals, longer when the host widens its cadence), so the image matches the music.
            const shownAfter = time - frame.requestedSongTime;
            if (playing && frame.requestedPlaying && shownAfter > 0 && shownAfter < 0.5) this.leadSec += (shownAfter - this.leadSec) * LEAD_SMOOTHING;
            changed = true;
        }
        if (!this.inFlight && this.preparedGeneration === this.generation && Number.isFinite(time)) {
            // Steady pauses ask once; the worker answers "unchanged" for anything it would skip.
            const repeat = !playing && !this.lastPlaying && time === this.lastTime && !this.presentationDirty;
            if (!repeat) {
                this.inFlight = true;
                this.lastTime = time; this.lastPlaying = playing; this.presentationDirty = false;
                this.requestedAt = latencyClock ? latencyClock.now() : 0;
                this.requestedSongTime = time; this.requestedPlaying = playing;
                this.worker.postMessage({ type: 'render', generation: this.generation, time: playing ? time + this.leadSec : time, playing });
            }
        }
        return changed;
    }

    setPresentation(presentation: CanvasVisualPresentation): void {
        if (this.disposed) return;
        const rate = presentation.maxFrameRateHz;
        if (rate !== undefined && Number.isFinite(rate) && rate > 0) this.leadSec = 1 / rate;
        this.presentationDirty = true;
        this.worker.postMessage({ type: 'presentation', presentation });
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.preparing?.resolve();
        this.preparing = null;
        this.discardPending();
        this.material = null;
        this.lines = null;
        this.onFrameReady = null;
        this.onError = null;
        this.worker.onmessage = null;
        this.worker.onerror = null;
        try { this.worker.postMessage({ type: 'dispose' }); } catch { /* already gone */ }
        this.worker.terminate();
        this.canvas.width = this.canvas.height = 1;
        if (this.diagnostics) this.canvas.remove();
    }

    private receive(message: WormholeWorkerResponse): void {
        if (this.disposed) {
            if (message.type === 'frame') message.bitmap.close();
            return;
        }
        switch (message.type) {
            case 'prepared':
                if (this.preparing?.generation !== message.generation) return;
                this.preparedGeneration = message.generation;
                this.preparing.resolve();
                this.preparing = null;
                return;
            case 'prepare-error':
                if (this.preparing?.generation !== message.generation) return;
                this.preparing.reject(new Error(message.message));
                this.preparing = null;
                return;
            case 'frame':
                if (message.generation !== this.generation) {
                    message.bitmap.close();
                    this.releaseMaterial(message.material ?? null);
                    return;
                }
                this.inFlight = false;
                this.discardPending();
                if (latencyClock) {
                    const latency = latencyClock.now() - this.requestedAt;
                    this.latencyMs = this.latencyMs > 0 ? this.latencyMs + (latency - this.latencyMs) * LATENCY_SMOOTHING : latency;
                }
                this.pending = { bitmap: message.bitmap, focalX: message.focalX, focalY: message.focalY, renderMs: message.renderMs,
                    stages: message.stages ?? null, material: message.material ?? null, lines: message.lines ?? null,
                    requestedSongTime: this.requestedSongTime, requestedPlaying: this.requestedPlaying };
                this.onFrameReady?.();
                return;
            case 'unchanged':
                if (message.generation === this.generation) this.inFlight = false;
                return;
            case 'failure':
                this.fail(message.message);
                return;
        }
    }

    /** Unrecoverable: the background stops updating and the next `prepare` reports the error. */
    private fail(message: string): void {
        if (this.failure) return;
        this.failure = message;
        // A failed render worker is terminated at once (worker-communication: terminate on error).
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.terminate();
        this.discardPending();
        const preparing = this.preparing;
        this.preparing = null;
        // A failure during preparation surfaces through the rejected promise; later ones through onError.
        if (preparing) preparing.reject(new Error(message));
        else this.onError?.(message);
    }

    private discardPending(): void {
        this.pending?.bitmap.close();
        this.releaseMaterial(this.pending?.material ?? null);
        this.pending = null;
    }

    /** Transfers a carrier buffer back to the worker's pool (dropped once the worker is gone). */
    private releaseMaterial(frame: GrainMaterialFrame | null): void {
        const buffer = frame?.data.buffer;
        if (!buffer || !(buffer.byteLength > 0) || this.disposed || this.failure) return;
        try { this.worker.postMessage({ type: 'release-material', buffer: buffer as ArrayBuffer }, [buffer as ArrayBuffer]); }
        catch { /* the worker is gone; the buffer is garbage collected */ }
    }
}
