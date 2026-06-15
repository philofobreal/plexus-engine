import { State } from '../state/store';
import type { ExportBackend } from './ExportBackend';
import { ExportBackendRegistry, type ExportBackendFactory } from './ExportBackendRegistry';
import type { ExportCapabilities, ExportConfig, ExportWorkerResponse } from './ExportTypes';
import ExportWorker from './export.worker.ts?worker';
import type p5 from 'p5';

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
    private readonly videoElement: HTMLVideoElement | null;

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

    async start(config: ExportConfig, onProgress: (progress: number) => void): Promise<Blob> {
        if (this.worker) throw new Error('An export is already running.');
        if (typeof globalThis.createImageBitmap === 'undefined') throw new Error('createImageBitmap is not available in this browser.');

        this.cancelled = false;
        this.stoppedEarly = false;
        this.exportError = null;
        this.p5Instance.noLoop();

        const target = getExportDimensions(config);
        this.offscreenGraphics = this.p5Instance.createGraphics(target.width, target.height);
        if (typeof document !== 'undefined') {
            this.captureCanvas = document.createElement('canvas');
            this.captureCanvas.width = target.width;
            this.captureCanvas.height = target.height;
        }
        this.p5Instance.__plexusExportTarget = this.offscreenGraphics;
        const audioBuffer = this.audioEngine?.getAudioBuffer?.() as AudioBuffer | null | undefined;
        this.worker = new ExportWorker();

        try {
            const done = this.waitForExportDone(this.worker);
            void done.catch(() => undefined);
            this.worker.postMessage({
                type: 'start_export',
                width: target.width,
                height: target.height,
                fps: config.fps,
                sampleRate: audioBuffer?.sampleRate || 48_000,
                hasAudio: Boolean(audioBuffer)
            });

            await nextAnimationFrame();
            State.isExporting = true;
            State.exportTime = 0;

            const totalFrames = Math.floor(State.duration * config.fps);
            this.workerQueueDepth = 0;
            for (let i = 0; i < totalFrames; i++) {
                if (this.cancelled || this.stoppedEarly || !this.offscreenGraphics) break;

                while (this.workerQueueDepth >= 2 && !this.exportError && !this.cancelled && !this.stoppedEarly) {
                    await sleep(2);
                }
                if (this.exportError) throw this.exportError;

                State.exportTime = i / config.fps;
                await this.seekVideoFrame(State.exportTime);
                this.renderOffscreenFrame();

                await nextAnimationFrame();
                if (this.cancelled || this.stoppedEarly || !this.worker) {
                    break;
                }

                const bitmapSource = this.prepareBitmapSource(target.width, target.height, config.watermark === true);
                const timestampUs = Math.round((i * 1_000_000) / config.fps);
                const bitmap = await globalThis.createImageBitmap(bitmapSource);

                const audioPayload = audioBuffer ? this.getPlanarAudioFrame(audioBuffer, i, config.fps) : null;

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

                this.workerQueueDepth++; // Optimistic increment until worker replies
                if (i % 2 === 0) {
                    await sleep(1); // Yield to browser event loop so UI doesn't freeze
                }

                onProgress(totalFrames > 0 ? i / totalFrames : 1);
            }

            if (this.cancelled) throw new Error('Export cancelled.');

            this.worker.postMessage({ type: 'finalize_export' });
            const doneBlob = await done;
            onProgress(1);
            return doneBlob;
        } finally {
            this.cleanup();
        }
    }

    cancelExport(): void {
        this.cancelled = true;
        this.rejectExport?.(new Error('Export cancelled.'));
        this.cleanup();
    }

    stopAndSave(): void {
        this.stoppedEarly = true;
    }

    private waitForExportDone(worker: Worker): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this.rejectExport = reject;
            worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
                if (event.data.type === 'export_done') {
                    this.rejectExport = null;
                    resolve(event.data.blob);
                } else if (event.data.type === 'export_error') {
                    this.rejectExport = null;
                    this.exportError = new Error(event.data.message);
                    reject(this.exportError);
                } else if (event.data.type === 'queue_update') {
                    this.workerQueueDepth = (event.data as any).size;
                } else if (event.data.type === 'export_telemetry') {
                    const telemetry = event.data.telemetry;
                    console.info(`[Telemetry] Frames: ${telemetry.framesEncoded}, Avg Encode: ${telemetry.avgEncodeTimeMs.toFixed(2)} ms, Queue: ${telemetry.queueDepth}`);
                }
            };
            worker.onerror = (event) => {
                this.rejectExport = null;
                reject(new Error(event.message || 'Export worker failed.'));
            };
        });
    }

    private cleanup(): void {
        delete this.p5Instance.__plexusExportTarget;
        State.isExporting = false;
        State.exportTime = 0;
        this.p5Instance.loop();
        this.worker?.terminate();
        this.worker = null;
        this.rejectExport = null;
        if (this.offscreenGraphics) {
            this.offscreenGraphics.remove();
            this.offscreenGraphics = null;
        }
        this.captureCanvas = null;
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
        const pulse = State.beatDecay;

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

        if (State.bpm > 0) {
            const badgeText = `${State.bpm} BPM`;
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
            await new Promise<void>((resolve, reject) => {
                const cleanup = () => {
                    video.removeEventListener('seeked', onSeeked);
                    video.removeEventListener('error', onError);
                };
                const onSeeked = () => {
                    cleanup();
                    resolve();
                };
                const onError = () => {
                    cleanup();
                    reject(new Error('Video seek failed during export.'));
                };
                video.addEventListener('seeked', onSeeked, { once: true });
                video.addEventListener('error', onError, { once: true });
                video.currentTime = targetTime;
            });
        }

        await this.waitForVideoFrame(video);
    }

    private waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
                video.removeEventListener('error', onError);
            };
            const onLoadedMetadata = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error('Video metadata failed during export.'));
            };
            video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
            video.addEventListener('error', onError, { once: true });
        });
    }

    private waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                video.removeEventListener('loadeddata', onLoadedData);
                video.removeEventListener('error', onError);
            };
            const onLoadedData = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error('Video frame failed during export.'));
            };
            video.addEventListener('loadeddata', onLoadedData, { once: true });
            video.addEventListener('error', onError, { once: true });
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

    private getPlanarAudioFrame(audioBuffer: AudioBuffer, frameIndex: number, fps: number) {
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
        this.mixHeroBeepStem(audioPlanar, audioSampleCount, start, end);
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
