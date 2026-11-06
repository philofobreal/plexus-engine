import { State } from '../state/store';
import type { ExportBackend } from './ExportBackend';
import { ExportBackendRegistry, type ExportBackendFactory } from './ExportBackendRegistry';
import type { ExportCapabilities, ExportConfig, ExportWorkerResponse, ExportPreparationReport } from './ExportTypes';
import ExportWorker from './export.worker.ts?worker';
import { ExportStorageLease } from './ExportStorageLease';
import type p5 from 'p5';
import type { ExportAudioSource, ExportRuntime, ExportProfile } from '../types/ExportRenderJob';

export interface Mp4StageProfile {
    framesSubmitted: number;
    peakOutstandingFrames: number;
    hostMs: Record<string, number>;
    workerMs: Record<string, number>;
    outcome: ExportProfile['outcome'];
}

const sleep = (ms: number) => new Promise(resolve => {
    if (typeof setTimeout === 'function') {
        setTimeout(resolve, ms);
    } else {
        resolve(undefined);
    }
});

export class WebCodecsBackend implements ExportBackend {
    private readonly p5Instance: any;
    private readonly audioEngine: any;
    private readonly trackName: string;
    private readonly scheduling: 'display' | 'cooperative';
    private worker: Worker | null = null;
    private cancelled = false;
    private stoppedEarly = false;
    private rejectExport: ((error: Error) => void) | null = null;
    private exportError: Error | null = null;
    private offscreenGraphics: p5.Graphics | null = null;
    private captureCanvas: HTMLCanvasElement | null = null;
    private workerQueueDepth = 0;
    private outstandingFrames = 0;
    private resumeQueueWait: (() => void) | null = null;
    private running = false;
    private ownsLoop = false;
    private interruptWait: ((error: Error) => void) | null = null;
    private waitingForFrame = false;
    private readonly videoElement: HTMLVideoElement | null;
    private runtime: ExportRuntime | undefined;
    private workerTimings: Record<string, number> = {};
    private preparationReport: ExportPreparationReport | undefined;
    private resolvePrepared: (() => void) | null = null;
    private storageLease: ExportStorageLease | null = null;
    private storageDiscard: Promise<void> | null = null;
    private audioPool: Float32Array[] = [];
    private audioCapacity = 0;
    private audioAllocations = 0;
    private audioReuses = 0;
    private readonly Mp4Worker?: new () => Worker;
    private readonly onMp4Profile?: (profile: Mp4StageProfile) => void;

    constructor(
        p5Instance: any,
        canvas: HTMLCanvasElement,
        audioEngine: any,
        trackName: string,
        videoElement: HTMLVideoElement | null = null,
        // The production factory uses display scheduling. The browser benchmark injects the candidate.
        scheduling: 'display' | 'cooperative' = 'display',
        Mp4Worker?: new () => Worker,
        onMp4Profile?: (profile: Mp4StageProfile) => void,
    ) {
        void canvas;
        this.p5Instance = p5Instance;
        this.audioEngine = audioEngine;
        this.trackName = trackName;
        this.videoElement = videoElement;
        this.scheduling = scheduling;
        this.Mp4Worker = Mp4Worker;
        this.onMp4Profile = onMp4Profile;
    }

    async start(config: ExportConfig, onProgress: (progress: number) => void, runtime?: ExportRuntime,
        onProfile?: (profile: ExportProfile) => void): Promise<Blob> {
        if (this.running) throw new Error('An export is already running.');
        // A new request must never discard the previous, already published result.
        this.storageLease = null; this.storageDiscard = null;
        if (typeof globalThis.createImageBitmap === 'undefined') throw new Error('createImageBitmap is not available in this browser.');
        const duration = runtime?.duration ?? State.duration;
        const mp4 = config.format === 'mp4';
        const highPrecisionWebM = !mp4 && config.webmBitDepth === 10;
        const webmPreflight = config.preflight === true || highPrecisionWebM;
        const needsPreflight = mp4 || webmPreflight;
        if (!Number.isFinite(config.fps) || config.fps <= 0 || !Number.isFinite(duration)
            || Math.floor(duration * config.fps) < 1) throw new Error('Export requires a positive frame rate and at least one video frame.');
        if (config.runtime === 'isolated-wormhole' && !runtime) throw new Error('Isolated export runtime was not prepared.');
        this.runtime = runtime;
        this.workerTimings = {};
        this.preparationReport = undefined;
        this.audioPool = []; this.audioAllocations = 0; this.audioReuses = 0; this.audioCapacity = 0;
        this.storageLease = typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
            ? new ExportStorageLease(() => navigator.storage.getDirectory(), mp4 ? 'mp4' : 'webm') : null;
        if (mp4 && (!this.Mp4Worker || !this.storageLease)) {
            throw new Error('MP4 requires browser-local export storage. Choose WebM or try another browser.');
        }
        const mp4Profile = mp4 && this.onMp4Profile;
        const now = runtime || mp4Profile ? () => performance.now() : () => 0, started = now();
        const mp4Candidate = mp4 && !runtime && this.scheduling === 'cooperative';
        const cooperative = (Boolean(runtime) || mp4Candidate) && this.scheduling === 'cooperative';
        const stages = { renderRequest: 0, animationFrameWait: 0, mainThreadYield: 0,
            bitmap: 0, queueWait: 0, finalizeWait: 0, backendRequest: 0 };
        const mp4Stages = { preflight: 0, captureSetup: 0, composition: 0, transferSubmit: 0 };
        let submittedFrames = 0, peakOutstandingFrames = 0, outcome: ExportProfile['outcome'] = 'failed';
        const totalFrames = Math.floor(duration * config.fps);

        this.running = true;
        this.cancelled = false;
        this.stoppedEarly = false;
        this.exportError = null;
        try {
            const target = getExportDimensions(config);
            if (!runtime && !needsPreflight) this.prepareCaptureTarget(target.width, target.height);
            if (runtime && (target.width !== runtime.snapshot.width || target.height !== runtime.snapshot.height || config.fps !== runtime.snapshot.fps)) {
                throw new Error('Export settings differ from the frozen snapshot.');
            }
            const audioBuffer = runtime?.audio ?? this.audioEngine?.getAudioBuffer?.() as ExportAudioSource | null | undefined;
            this.audioCapacity = audioBuffer ? Math.ceil(audioBuffer.sampleRate / config.fps) * 2 : 0;
            this.worker = mp4 && this.Mp4Worker ? new this.Mp4Worker() : new ExportWorker();
            const prepared = needsPreflight ? new Promise<void>(resolve => { this.resolvePrepared = resolve; }) : null;
            const done = this.waitForExportDone(this.worker, webmPreflight);
            void done.catch(() => undefined);
            this.worker.postMessage({
                type: 'start_export',
                width: target.width,
                height: target.height,
                fps: config.fps,
                sampleRate: audioBuffer?.sampleRate || 48_000,
                hasAudio: Boolean(audioBuffer),
                ...(mp4 ? { frames: totalFrames, sourceSamples: audioBuffer?.length ?? 0 } : {}),
                ...(!mp4 && config.videoBitrate !== undefined ? { bitrate: config.videoBitrate } : {}),
                ...(highPrecisionWebM ? { webmBitDepth: 10 } : {}),
                ...(this.storageLease ? { storageFile: this.storageLease.name } : {}),
                ...(webmPreflight ? { preflight: true } : {}),
                ...(runtime || mp4Profile ? { profile: true } : {})
            });

            // Allocate real render surfaces only after the worker's temporary probe is released.
            if (prepared) {
                await this.waitForOperation(prepared);
                if (this.cancelled) throw new Error('Export cancelled.');
                if (this.stoppedEarly) throw new Error('No video frames were captured before stopping.');
                if (mp4Profile) mp4Stages.preflight = now() - started;
                if (!runtime) this.prepareCaptureTarget(target.width, target.height);
                if (mp4Profile) mp4Stages.captureSetup = now() - started - mp4Stages.preflight;
            }

            if (!cooperative || mp4Candidate) {
                const animationFrameStarted = now();
                await this.waitForOperation(nextAnimationFrame());
                stages.animationFrameWait += now() - animationFrameStarted;
            }
            if (!runtime) { State.isExporting = true; State.exportTime = 0; }

            this.workerQueueDepth = 0;
            this.outstandingFrames = 0;
            let lastYield = mp4Candidate ? performance.now() : 0;
            for (let i = 0; i < totalFrames; i++) {
                if (this.cancelled || this.stoppedEarly || (!this.offscreenGraphics && !runtime)) break;

                const queueStageStarted = now();
                if (cooperative) {
                    if (!this.hasQueueCapacity()) await this.waitForQueueCapacity();
                } else {
                    const queueWaitStarted = Date.now();
                    while (!this.hasQueueCapacity() && !this.exportError && !this.cancelled && !this.stoppedEarly) {
                        if (Date.now() - queueWaitStarted >= 30_000) throw new Error('Export encoder queue timed out.');
                        await sleep(2);
                    }
                }
                stages.queueWait += now() - queueStageStarted;
                if (this.exportError) throw this.exportError;
                if (this.cancelled || this.stoppedEarly) break;

                if (!runtime) State.exportTime = i / config.fps;
                let bitmap: ImageBitmap;
                try {
                    let image: HTMLCanvasElement | undefined;
                    let displayFrame: Promise<void> | undefined;
                    const renderStarted = now();
                    if (runtime) image = await this.waitForOperation(runtime.renderFrame(i, config.fps));
                    else {
                        await this.seekVideoFrame(State.exportTime);
                        if (this.cancelled || this.stoppedEarly) break;
                        const redraw = this.renderOffscreenFrame();
                        if (!cooperative) displayFrame = nextAnimationFrame();
                        // A display callback may arrive before p5 finishes the export frame.
                        // Keep its target alive until redraw settles, including on cancellation.
                        await redraw;
                    }
                    stages.renderRequest += now() - renderStarted;
                    if (!cooperative) {
                        const animationFrameStarted = now();
                        await this.waitForOperation(displayFrame ?? nextAnimationFrame());
                        stages.animationFrameWait += now() - animationFrameStarted;
                    }
                    if (this.cancelled || this.stoppedEarly || !this.worker) break;
                    if (this.exportError) throw this.exportError;
                    const compositionStarted = mp4Profile ? now() : 0;
                    if (!runtime) image = this.prepareBitmapSource(target.width, target.height, config.watermark === true);
                    if (!image) throw new Error('Export frame surface unavailable.');
                    if (runtime && config.watermark) {
                        const ctx = image.getContext('2d');
                        if (!ctx) throw new Error('Export metadata surface unavailable.');
                        this.drawMetadataCard(ctx, target.width, target.height);
                    }
                    const bitmapStarted = now();
                    if (mp4Profile) mp4Stages.composition += bitmapStarted - compositionStarted;
                    bitmap = await this.waitForOperation(globalThis.createImageBitmap(image), late => late.close());
                    stages.bitmap += now() - bitmapStarted;
                } catch (error) {
                    if (this.cancelled) throw new Error('Export cancelled.');
                    if (this.stoppedEarly && !this.exportError) break;
                    throw error;
                }
                if (this.cancelled || this.stoppedEarly || !this.worker) { bitmap.close(); break; }
                const timestampUs = Math.round((i * 1_000_000) / config.fps);
                try {
                    const transferStarted = mp4Profile ? now() : 0;
                    const audioPayload = audioBuffer ? this.getPlanarAudioFrame(audioBuffer, i, config.fps) : null;
                    this.outstandingFrames++;
                    if (runtime || mp4Profile) peakOutstandingFrames = Math.max(peakOutstandingFrames, this.outstandingFrames);
                    if (audioPayload) {
                        this.worker.postMessage({
                            type: 'encode_frame',
                            bitmap,
                            timestampUs,
                            audioPlanar: audioPayload.audioPlanar,
                            audioSampleCount: audioPayload.audioSampleCount
                        }, [bitmap, audioPayload.audioPlanar.buffer]);
                    } else {
                        this.worker.postMessage({ type: 'encode_frame', bitmap, timestampUs }, [bitmap]);
                    }
                    if (mp4Profile) mp4Stages.transferSubmit += now() - transferStarted;
                } catch (error) {
                    bitmap.close();
                    throw error;
                }
                submittedFrames++;

                this.workerQueueDepth++; // Optimistic increment until worker replies
                if (mp4Candidate ? performance.now() - lastYield >= 12 : i % 2 === 0) {
                    const yieldStarted = now();
                    await sleep(1); // Allow input and worker messages even without a display frame.
                    stages.mainThreadYield += now() - yieldStarted;
                    if (mp4Candidate) lastYield = performance.now();
                }

                onProgress(mp4 ? .9 * i / totalFrames : (totalFrames > 0 ? i / totalFrames : 1));
            }

            if (this.cancelled) throw new Error('Export cancelled.');
            if (this.exportError) throw this.exportError;
            if (submittedFrames === 0) throw new Error('No video frames were captured before stopping.');

            this.worker.postMessage({ type: 'finalize_export' });
            if (mp4) onProgress(.9);
            const finalizeStarted = now();
            const doneBlob = await this.waitForOperation(done, undefined, undefined, false,
                mp4 ? Math.min(900_000, Math.max(90_000, submittedFrames / config.fps * 1000 + 30_000)) : 30_000);
            stages.finalizeWait = now() - finalizeStarted;
            if (this.cancelled) throw new Error('Export cancelled.');
            if (this.exportError) throw this.exportError;
            onProgress(1);
            if (this.cancelled) throw new Error('Export cancelled.');
            outcome = 'completed';
            return doneBlob;
        } finally {
            stages.backendRequest = now() - started;
            await this.cleanup(outcome === 'completed');
            if (mp4Profile) {
                try {
                    mp4Profile({ framesSubmitted: submittedFrames, peakOutstandingFrames,
                        hostMs: { ...stages, ...mp4Stages, cleanup: now() - started - stages.backendRequest },
                        workerMs: this.workerTimings, outcome: this.cancelled ? 'cancelled' : outcome });
                } catch { /* Diagnostics cannot change job completion. */ }
            }
            if (runtime && onProfile) {
                try { onProfile({ runtime: 'isolated-wormhole', analysisId: runtime.snapshot.analysisId,
                    estimatedBytes: runtime.snapshot.estimatedBytes, budgetBytes: runtime.snapshot.budgetBytes,
                    stagesMs: { ...stages, ...this.workerTimings }, framesSubmitted: submittedFrames,
                    ...(this.preparationReport ? { preflight: this.preparationReport } : {}),
                    scheduling: cooperative ? 'cooperative' : 'display',
                    resources: { audioBufferAllocations: this.audioAllocations, audioBuffersReused: this.audioReuses,
                        audioPoolLimitBytes: this.audioCapacity * 4 * 2, peakOutstandingFrames,
                        storage: this.storageLease?.disposition ?? 'unmanaged' },
                    outcome: this.cancelled ? 'cancelled' : outcome,
                    scope: 'Host wall-clock waits; render includes simulation/raster/composition/PostFX. Worker intervals overlap the host. Never sum stages as a total or infer GPU/codec CPU time.' }); } catch { /* Diagnostics cannot change job completion. */ }
            }
            if (this.cancelled && outcome === 'completed') { await this.discardResult(); throw new Error('Export cancelled.'); }
        }
    }

    cancelExport(): void {
        if (!this.running || this.cancelled) return;
        this.cancelled = true;
        const error = new Error('Export cancelled.');
        this.interruptWait?.(error);
        this.rejectExport?.(error);
        if (this.worker) {
            this.worker.onmessage = null;
            this.worker.onerror = null;
            this.worker.terminate();
            this.worker = null;
        }
    }

    stopAndSave(): void {
        if (!this.running || this.cancelled || this.stoppedEarly) return;
        this.stoppedEarly = true;
        this.resumeQueueWait?.();
        if (this.waitingForFrame) this.interruptWait?.(new Error('No video frames were captured before stopping.'));
    }

    private hasQueueCapacity(): boolean {
        return this.workerQueueDepth < 2 && this.outstandingFrames < 2;
    }

    private waitForQueueCapacity(): Promise<void> {
        const ready = new Promise<void>(resolve => { this.resumeQueueWait = resolve; });
        // Stop wakes this wait directly. Cancel, worker errors and the watchdog interrupt it.
        return this.waitForOperation(ready, undefined, () => { this.resumeQueueWait = null; }, false);
    }

    async discardResult(): Promise<void> {
        this.storageDiscard ??= this.storageLease?.discard() ?? Promise.resolve();
        await this.storageDiscard;
    }

    private waitForExportDone(worker: Worker, requireAudio: boolean): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this.rejectExport = reject;
            worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
                if (this.worker !== worker || this.cancelled) return;
                if (event.data.type === 'export_done') {
                    this.workerTimings = event.data.timings ?? {};
                    this.rejectExport = null;
                    resolve(event.data.blob);
                } else if (event.data.type === 'export_prepared') {
                    this.preparationReport = event.data.report;
                    this.resolvePrepared?.(); this.resolvePrepared = null;
                } else if (event.data.type === 'export_ready') {
                    this.resolvePrepared?.(); this.resolvePrepared = null;
                } else if (event.data.type === 'export_error') {
                    this.rejectExport = null;
                    this.exportError = new Error(event.data.message);
                    this.interruptWait?.(this.exportError);
                    reject(this.exportError);
                } else if (event.data.type === 'frame_encoded') {
                    this.outstandingFrames = Math.max(0, this.outstandingFrames - 1);
                    const returned = event.data.audioBuffer;
                    if (returned instanceof Float32Array && returned.buffer.byteLength > 0
                        && returned.buffer.byteLength <= this.audioCapacity * 4 && this.audioPool.length < 2
                        && !this.audioPool.some(item => item.buffer === returned.buffer)) this.audioPool.push(new Float32Array(returned.buffer));
                    if (this.resumeQueueWait && this.hasQueueCapacity()) this.resumeQueueWait();
                } else if (event.data.type === 'export_audio_warning' && (this.runtime || requireAudio)) {
                    this.exportError = new Error(`${this.runtime ? 'Isolated export' : 'Export'} audio failed: ${event.data.message}`);
                    this.interruptWait?.(this.exportError);
                    reject(this.exportError);
                } else if (event.data.type === 'queue_update') {
                    this.workerQueueDepth = event.data.size;
                    if (this.resumeQueueWait && this.hasQueueCapacity()) this.resumeQueueWait();
                } else if (event.data.type === 'export_telemetry') {
                    const telemetry = event.data.telemetry;
                    console.info(`[Telemetry] Frames: ${telemetry.framesEncoded}, Avg submission: ${telemetry.avgEncodeTimeMs.toFixed(2)} ms, Queue: ${telemetry.queueDepth}`);
                }
            };
            worker.onerror = (event) => {
                if (this.worker !== worker || this.cancelled) return;
                this.rejectExport = null;
                this.exportError = new Error(event.message || 'Export worker failed.');
                this.interruptWait?.(this.exportError);
                reject(this.exportError);
            };
        });
    }

    private async cleanup(completed = false): Promise<void> {
        if (!this.running) return;
        if (this.ownsLoop) {
            delete this.p5Instance.__plexusExportTarget;
            State.isExporting = false;
            State.exportTime = 0;
            this.p5Instance.loop();
            this.ownsLoop = false;
        }
        if (this.worker) { this.worker.onmessage = null; this.worker.onerror = null; }
        this.worker?.terminate();
        this.worker = null;
        this.rejectExport = null;
        this.resolvePrepared = null;
        if (this.offscreenGraphics) {
            this.offscreenGraphics.remove();
            this.offscreenGraphics = null;
        }
        this.captureCanvas = null;
        this.audioPool = [];
        this.runtime = undefined;
        try {
            if (completed && !this.cancelled) this.storageLease?.retain();
            else await this.discardResult();
        } finally { this.running = false; }
    }

    /** Bound browser/encoder waits and release late bitmaps after Stop/Cancel. */
    private waitForOperation<T>(operation: Promise<T>, onLate?: (value: T) => void,
        onSettled?: () => void, frameWait = true, timeoutMs = 30_000): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const finish = (error?: Error, value?: T) => {
                if (settled) return;
                settled = true;
                if (timer !== undefined) clearTimeout(timer);
                if (this.interruptWait === interrupt) { this.interruptWait = null; this.waitingForFrame = false; }
                onSettled?.();
                if (error) reject(error); else resolve(value as T);
            };
            const interrupt = (error: Error) => finish(error);
            this.interruptWait = interrupt;
            this.waitingForFrame = frameWait;
            if (typeof setTimeout === 'function') timer = setTimeout(() => finish(new Error('Export operation timed out.')), timeoutMs);
            operation.then(value => { if (settled) onLate?.(value); else finish(undefined, value); }, error => finish(error instanceof Error ? error : new Error(String(error))));
            if (this.cancelled) interrupt(new Error('Export cancelled.'));
            else if (frameWait && this.stoppedEarly) interrupt(new Error('No video frames were captured before stopping.'));
            else if (this.exportError) interrupt(this.exportError);
        });
    }

    private prepareCaptureTarget(width: number, height: number): void {
        this.p5Instance.noLoop();
        this.ownsLoop = true;
        const graphics: p5.Graphics = this.p5Instance.createGraphics(width, height);
        this.offscreenGraphics = graphics;
        graphics.pixelDensity(1);
        if (typeof document !== 'undefined') {
            this.captureCanvas = document.createElement('canvas');
            this.captureCanvas.width = width;
            this.captureCanvas.height = height;
        }
        this.p5Instance.__plexusExportTarget = graphics;
    }

    private renderOffscreenFrame(): void | Promise<void> {
        if (!this.offscreenGraphics) return;
        this.offscreenGraphics.clear();
        return this.p5Instance.redraw();
    }

    private composeCaptureFrame(width: number, height: number, watermark: boolean): void {
        if (!this.offscreenGraphics || !this.captureCanvas) return;
        const ctx = this.captureCanvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        if (this.videoElement && State.videoBackplateActive) {
            this.drawVideoFrame(ctx, width, height);
        }
        ctx.drawImage((this.offscreenGraphics as p5.Graphics & { elt: HTMLCanvasElement }).elt, 0, 0, width, height);
        if (watermark) this.drawMetadataCard(ctx, width, height);
    }

    private prepareBitmapSource(width: number, height: number, watermark: boolean): HTMLCanvasElement {
        if (!this.offscreenGraphics) throw new Error('Export graphics target is unavailable.');
        const overlayCanvas = (this.offscreenGraphics as p5.Graphics & { elt: HTMLCanvasElement }).elt;
        if (this.captureCanvas) {
            this.composeCaptureFrame(width, height, watermark);
            return this.captureCanvas;
        }

        const ctx = overlayCanvas.getContext('2d');
        if (ctx && watermark) this.drawMetadataCard(ctx, width, height);
        return overlayCanvas;
    }

    private drawMetadataCard(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (!ctx) return;

        ctx.save();
        const scale = Math.min(width / 1920, height / 1080);
        const x = 40 * scale;
        const y = 40 * scale;
        const w = 640 * scale;
        const h = 130 * scale;
        const radius = 24 * scale;
        const pulse = this.runtime?.beatDecay ?? State.beatDecay;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, radius);
        } else {
            ctx.rect(x, y, w, h);
        }
        ctx.fillStyle = 'rgba(8, 5, 14, 0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = Math.max(1, scale);
        ctx.stroke();

        ctx.shadowBlur = (10 + pulse * 25) * scale;
        ctx.shadowColor = '#00e5ff';
        ctx.beginPath();
        ctx.arc(x + 40 * scale, y + 42 * scale, (6 + pulse * 5) * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${22 * scale}px Inter, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText('PLEXUS ENGINE', x + 62 * scale, y + 42 * scale);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `400 ${16 * scale}px Inter, sans-serif`;
        ctx.fillText(this.fitText(ctx, this.trackName, w - 80 * scale), x + 40 * scale, y + 92 * scale);

        const bpm = this.runtime?.bpm ?? State.bpm;
        if (bpm > 0) {
            const badgeText = `${bpm} BPM`;
            ctx.font = `700 ${14 * scale}px Inter, sans-serif`;
            const textWidth = ctx.measureText(badgeText).width;
            const badgeW = textWidth + 24 * scale;
            const badgeH = 28 * scale;
            const badgeX = x + w - badgeW - 26 * scale;
            const badgeY = y + 28 * scale;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8 * scale);
            } else {
                ctx.rect(badgeX, badgeY, badgeW, badgeH);
            }
            ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
            ctx.stroke();
            ctx.fillStyle = '#00e5ff';
            ctx.fillText(badgeText, badgeX + 12 * scale, badgeY + badgeH / 2);
        }

        ctx.restore();
    }

    private async seekVideoFrame(time: number): Promise<void> {
        const video = this.videoElement;
        if (!video || !State.videoBackplateActive) return;
        video.muted = true;
        video.pause();
        await this.waitForVideoMetadata(video);

        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : State.duration;
        const targetTime = Math.max(0, Math.min(time, Math.max(0, duration - 0.001)));
        if (Math.abs(video.currentTime - targetTime) > 0.001 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            await this.waitForVideoEvent(video, 'seeked', 'Video seek failed during export.', () => { video.currentTime = targetTime; });
        }

        await this.waitForVideoFrame(video);
    }

    private waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
        return this.waitForVideoEvent(video, 'loadedmetadata', 'Video metadata failed during export.');
    }

    private waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
        return this.waitForVideoEvent(video, 'loadeddata', 'Video frame failed during export.');
    }

    private waitForVideoEvent(video: HTMLVideoElement, type: string, errorMessage: string, action?: () => void): Promise<void> {
        let onReady: () => void = () => {};
        let onError: () => void = () => {};
        const operation = new Promise<void>((resolve, reject) => {
            onReady = resolve;
            onError = () => reject(new Error(errorMessage));
            video.addEventListener(type, onReady, { once: true });
            video.addEventListener('error', onError, { once: true });
            action?.();
        });
        return this.waitForOperation(operation, undefined, () => {
            video.removeEventListener(type, onReady);
            video.removeEventListener('error', onError);
        });
    }

    private drawVideoFrame(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const video = this.videoElement;
        if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
        const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
        const drawWidth = video.videoWidth * scale;
        const drawHeight = video.videoHeight * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;
        ctx.drawImage(video, x, y, drawWidth, drawHeight);
    }

    private fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
        if (ctx.measureText(text).width <= maxWidth) return text;
        const suffix = '...';
        let trimmed = text;
        while (trimmed.length > 0 && ctx.measureText(trimmed + suffix).width > maxWidth) {
            trimmed = trimmed.slice(0, -1);
        }
        return trimmed ? trimmed + suffix : suffix;
    }

    private getPlanarAudioFrame(audioBuffer: ExportAudioSource, frameIndex: number, fps: number) {
        const start = Math.floor(frameIndex * audioBuffer.sampleRate / fps);
        const end = Math.min(audioBuffer.length, Math.floor((frameIndex + 1) * audioBuffer.sampleRate / fps));
        const audioSampleCount = end - start;
        if (audioSampleCount <= 0) return null;

        const requiredLength = audioSampleCount * 2;
        let buffer = this.audioPool.pop();
        if (!buffer || buffer.length < requiredLength || buffer.buffer.byteLength === 0) {
            buffer = new Float32Array(requiredLength); this.audioAllocations++;
        } else this.audioReuses++;
        const audioPlanar = buffer.length === requiredLength ? buffer : buffer.subarray(0, requiredLength);

        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
        audioPlanar.set(left.subarray(start, end), 0);
        audioPlanar.set(right.subarray(start, end), audioSampleCount);
        if (!this.runtime) this.mixHeroBeepStem(audioPlanar, audioSampleCount, start, end);
        return { audioPlanar, audioSampleCount };
    }

    private mixHeroBeepStem(audioPlanar: Float32Array, audioSampleCount: number, start: number, end: number): void {
        if (State.visualMode !== 'hero') return;
        const mode = Math.round(Number.isFinite(State.visualTuning.heroBeepMode) ? State.visualTuning.heroBeepMode : 0);
        if (mode < 1 || mode > 4) return;
        const volume = Math.max(0, Math.min(1, Number.isFinite(State.visualTuning.heroBeepVolume) ? State.visualTuning.heroBeepVolume : 0));
        if (volume <= 0) return;
        const beepBuffer = this.audioEngine?.beepBuffers?.[mode - 1] as AudioBuffer | undefined;
        if (!beepBuffer) return;

        const source = beepBuffer.getChannelData(0);
        const sliceEnd = Math.min(end, source.length);
        for (let sampleIndex = start; sampleIndex < sliceEnd; sampleIndex++) {
            const beep = source[sampleIndex] * volume;
            const frameOffset = sampleIndex - start;
            audioPlanar[frameOffset] = clampAudio(audioPlanar[frameOffset] + beep);
            audioPlanar[frameOffset + audioSampleCount] = clampAudio(audioPlanar[frameOffset + audioSampleCount] + beep);
        }
    }
}

function clampAudio(value: number): number {
    return Math.max(-1, Math.min(1, value));
}

function getExportDimensions(config: ExportConfig) {
    const base = config.resolution === '720p' ? 720 : config.resolution === '1080p' ? 1080 : 2160;
    if (config.aspectRatio === '16:9') return { width: Math.round(base * 16 / 9), height: base };
    if (config.aspectRatio === '9:16') return { width: base, height: Math.round(base * 16 / 9) };
    return { width: base, height: base };
}

function nextAnimationFrame() {
    return new Promise<void>((resolve) => {
        if (typeof document !== 'undefined' && document.hidden) {
            window.setTimeout(() => resolve(), 16);
            return;
        }
        window.requestAnimationFrame(() => resolve());
    });
}

export const WebCodecsBackendFactory: ExportBackendFactory = {
    id: 'webcodecs',
    priority: 100,
    isSupported(capabilities?: ExportCapabilities): boolean {
        if (capabilities) {
            return capabilities.preferredBackend === 'webcodecs' && capabilities.webcodecsSupported;
        }
        return typeof globalThis.VideoFrame !== 'undefined' && typeof globalThis.VideoEncoder !== 'undefined';
    },
    create(p5Instance: any, canvas: HTMLCanvasElement, audioEngine: any, trackName: string, videoElement?: HTMLVideoElement | null): ExportBackend {
        return new WebCodecsBackend(p5Instance, canvas, audioEngine, trackName, videoElement ?? null);
    }
};

ExportBackendRegistry.register(WebCodecsBackendFactory);
