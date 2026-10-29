import { State } from '../state/store';
import type { ExportBackend } from './ExportBackend';
import { ExportBackendRegistry, type ExportBackendFactory } from './ExportBackendRegistry';
import type { ExportCapabilities, ExportConfig, ExportWorkerResponse, ExportPreparationReport } from './ExportTypes';
import ExportWorker from './export.worker.ts?worker';
import type p5 from 'p5';
import type { ExportAudioSource, ExportRuntime, ExportProfile } from '../types/ExportRenderJob';

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
    private worker: Worker | null = null;
    private cancelled = false;
    private stoppedEarly = false;
    private rejectExport: ((error: Error) => void) | null = null;
    private exportError: Error | null = null;
    private offscreenGraphics: p5.Graphics | null = null;
    private captureCanvas: HTMLCanvasElement | null = null;
    private workerQueueDepth = 0;
    private outstandingFrames = 0;
    private running = false;
    private ownsLoop = false;
    private interruptWait: ((error: Error) => void) | null = null;
    private waitingForFrame = false;
    private readonly videoElement: HTMLVideoElement | null;
    private runtime: ExportRuntime | undefined;
    private workerTimings: Record<string, number> = {};
    private preparationReport: ExportPreparationReport | undefined;
    private resolvePrepared: (() => void) | null = null;

    constructor(
        p5Instance: any,
        canvas: HTMLCanvasElement,
        audioEngine: any,
        trackName: string,
        videoElement: HTMLVideoElement | null = null
    ) {
        void canvas;
        this.p5Instance = p5Instance;
        this.audioEngine = audioEngine;
        this.trackName = trackName;
        this.videoElement = videoElement;
    }

    async start(config: ExportConfig, onProgress: (progress: number) => void, runtime?: ExportRuntime,
        onProfile?: (profile: ExportProfile) => void): Promise<Blob> {
        if (this.running) throw new Error('An export is already running.');
        if (typeof globalThis.createImageBitmap === 'undefined') throw new Error('createImageBitmap is not available in this browser.');
        const duration = runtime?.duration ?? State.duration;
        if (!Number.isFinite(config.fps) || config.fps <= 0 || !Number.isFinite(duration)
            || Math.floor(duration * config.fps) < 1) throw new Error('Export requires a positive frame rate and at least one video frame.');
        if (config.runtime === 'isolated-wormhole' && !runtime) throw new Error('Isolated export runtime was not prepared.');
        this.runtime = runtime;
        this.workerTimings = {};
        this.preparationReport = undefined;
        const now = runtime ? () => performance.now() : () => 0, started = now();
        const stages = { renderRequest: 0, bitmap: 0, queueWait: 0, finalizeWait: 0, backendRequest: 0 };
        let submittedFrames = 0, outcome: ExportProfile['outcome'] = 'failed';

        this.running = true;
        this.cancelled = false;
        this.stoppedEarly = false;
        this.exportError = null;
        try {
            const target = getExportDimensions(config);
            if (!runtime) {
                this.p5Instance.noLoop(); this.ownsLoop = true;
                const exportGraphics: p5.Graphics = this.p5Instance.createGraphics(target.width, target.height);
                this.offscreenGraphics = exportGraphics;
            // Export dimensions are device pixels, independent of preview density.
                exportGraphics.pixelDensity(1);
                if (typeof document !== 'undefined') {
                    this.captureCanvas = document.createElement('canvas');
                    this.captureCanvas.width = target.width; this.captureCanvas.height = target.height;
                }
                this.p5Instance.__plexusExportTarget = exportGraphics;
            } else if (target.width !== runtime.snapshot.width || target.height !== runtime.snapshot.height || config.fps !== runtime.snapshot.fps) {
                throw new Error('Export settings differ from the frozen snapshot.');
            }
            const audioBuffer = runtime?.audio ?? this.audioEngine?.getAudioBuffer?.() as ExportAudioSource | null | undefined;
            this.worker = new ExportWorker();
            const prepared = config.preflight ? new Promise<void>(resolve => { this.resolvePrepared = resolve; }) : null;
            const done = this.waitForExportDone(this.worker);
            void done.catch(() => undefined);
            this.worker.postMessage({
                type: 'start_export',
                width: target.width,
                height: target.height,
                fps: config.fps,
                sampleRate: audioBuffer?.sampleRate || 48_000,
                hasAudio: Boolean(audioBuffer),
                ...(config.preflight ? { preflight: true } : {}),
                ...(runtime ? { profile: true } : {})
            });

            // No real frames/bitmaps are rendered or admitted while the worker probes.
            if (prepared) await this.waitForOperation(prepared);

            await this.waitForOperation(nextAnimationFrame());
            if (!runtime) { State.isExporting = true; State.exportTime = 0; }

            const totalFrames = Math.floor(duration * config.fps);
            this.workerQueueDepth = 0;
            this.outstandingFrames = 0;
            for (let i = 0; i < totalFrames; i++) {
                if (this.cancelled || this.stoppedEarly || (!this.offscreenGraphics && !runtime)) break;

                const queueWaitStarted = Date.now();
                const queueStageStarted = now();
                while ((this.workerQueueDepth >= 2 || this.outstandingFrames >= 2)
                    && !this.exportError && !this.cancelled && !this.stoppedEarly) {
                    if (Date.now() - queueWaitStarted >= 30_000) throw new Error('Export encoder queue timed out.');
                    await sleep(2);
                }
                stages.queueWait += now() - queueStageStarted;
                if (this.exportError) throw this.exportError;
                if (this.cancelled || this.stoppedEarly) break;

                if (!runtime) State.exportTime = i / config.fps;
                let bitmap: ImageBitmap;
                try {
                    let image: HTMLCanvasElement | undefined;
                    const renderStarted = now();
                    if (runtime) image = await this.waitForOperation(runtime.renderFrame(i, config.fps));
                    else {
                        await this.seekVideoFrame(State.exportTime);
                        if (this.cancelled || this.stoppedEarly) break;
                        this.renderOffscreenFrame();
                    }
                    stages.renderRequest += now() - renderStarted;
                    await this.waitForOperation(nextAnimationFrame());
                    if (this.cancelled || this.stoppedEarly || !this.worker) break;
                    if (!runtime) image = this.prepareBitmapSource(target.width, target.height, config.watermark === true);
                    if (!image) throw new Error('Export frame surface unavailable.');
                    if (runtime && config.watermark) {
                        const ctx = image.getContext('2d');
                        if (!ctx) throw new Error('Export metadata surface unavailable.');
                        this.drawMetadataCard(ctx, target.width, target.height);
                    }
                    const bitmapStarted = now();
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
                    const audioPayload = audioBuffer ? this.getPlanarAudioFrame(audioBuffer, i, config.fps) : null;
                    this.outstandingFrames++;
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
                } catch (error) {
                    bitmap.close();
                    throw error;
                }
                submittedFrames++;

                this.workerQueueDepth++; // Optimistic increment until worker replies
                if (i % 2 === 0) {
                    await sleep(1); // Yield to browser event loop so UI doesn't freeze
                }

                onProgress(totalFrames > 0 ? i / totalFrames : 1);
            }

            if (this.cancelled) throw new Error('Export cancelled.');
            if (this.exportError) throw this.exportError;
            if (submittedFrames === 0) throw new Error('No video frames were captured before stopping.');

            this.worker.postMessage({ type: 'finalize_export' });
            const finalizeStarted = now();
            const doneBlob = await this.waitForOperation(done, undefined, undefined, false);
            stages.finalizeWait = now() - finalizeStarted;
            if (this.cancelled) throw new Error('Export cancelled.');
            if (this.exportError) throw this.exportError;
            onProgress(1);
            if (this.cancelled) throw new Error('Export cancelled.');
            outcome = 'completed';
            return doneBlob;
        } finally {
            stages.backendRequest = now() - started;
            this.cleanup();
            if (runtime && onProfile) {
                try { onProfile({ runtime: 'isolated-wormhole', analysisId: runtime.snapshot.analysisId,
                    estimatedBytes: runtime.snapshot.estimatedBytes, budgetBytes: runtime.snapshot.budgetBytes,
                    stagesMs: { ...stages, ...this.workerTimings }, framesSubmitted: submittedFrames,
                    ...(this.preparationReport ? { preflight: this.preparationReport } : {}),
                    outcome: this.cancelled ? 'cancelled' : outcome,
                    scope: 'Host wall-clock waits; render includes simulation/raster/composition/PostFX. Worker intervals overlap the host. Never sum stages as a total or infer GPU/codec CPU time.' }); } catch { /* Diagnostics cannot change job completion. */ }
            }
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
        if (this.waitingForFrame) this.interruptWait?.(new Error('No video frames were captured before stopping.'));
    }

    private waitForExportDone(worker: Worker): Promise<Blob> {
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
                } else if (event.data.type === 'export_error') {
                    this.rejectExport = null;
                    this.exportError = new Error(event.data.message);
                    this.interruptWait?.(this.exportError);
                    reject(this.exportError);
                } else if (event.data.type === 'frame_encoded') {
                    this.outstandingFrames = Math.max(0, this.outstandingFrames - 1);
                } else if (event.data.type === 'export_audio_warning' && this.runtime) {
                    this.exportError = new Error(`Isolated export audio failed: ${event.data.message}`);
                    this.interruptWait?.(this.exportError);
                    reject(this.exportError);
                } else if (event.data.type === 'queue_update') {
                    this.workerQueueDepth = (event.data as any).size;
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

    private cleanup(): void {
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
        this.running = false;
        this.runtime = undefined;
    }

    /** Bound browser/encoder waits and release late bitmaps after Stop/Cancel. */
    private waitForOperation<T>(operation: Promise<T>, onLate?: (value: T) => void,
        onSettled?: () => void, frameWait = true): Promise<T> {
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
            if (typeof setTimeout === 'function') timer = setTimeout(() => finish(new Error('Export operation timed out.')), 30_000);
            operation.then(value => { if (settled) onLate?.(value); else finish(undefined, value); }, error => finish(error instanceof Error ? error : new Error(String(error))));
            if (this.cancelled) interrupt(new Error('Export cancelled.'));
            else if (frameWait && this.stoppedEarly) interrupt(new Error('No video frames were captured before stopping.'));
            else if (this.exportError) interrupt(this.exportError);
        });
    }

    private renderOffscreenFrame(): void {
        if (!this.offscreenGraphics) return;
        this.offscreenGraphics.clear();
        this.p5Instance.redraw();
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
        const audioPlanar = new Float32Array(requiredLength);

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
