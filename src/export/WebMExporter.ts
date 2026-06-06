import { State } from '../state/store';
import ExportWorker from './export.worker.ts?worker';

export interface ExportConfig {
    resolution: '720p' | '1080p' | '4K';
    aspectRatio: '16:9' | '9:16' | '1:1';
    fps: number;
    trackName?: string;
}

interface ExportDoneMessage {
    type: 'export_done';
    blob: Blob;
}

interface ExportErrorMessage {
    type: 'export_error';
    message: string;
}

interface ExportAudioWarningMessage {
    type: 'export_audio_warning';
    message: string;
}

type ExportWorkerResponse = ExportDoneMessage | ExportErrorMessage | ExportAudioWarningMessage;

type TransferableVideoFrame = Transferable & {
    close(): void;
};

type VideoFrameConstructor = new (
    source: HTMLCanvasElement,
    init: { timestamp: number }
) => TransferableVideoFrame;

const VideoFrameClass = globalThis as unknown as { VideoFrame?: VideoFrameConstructor };

export class WebMExporter {
    private p5Instance: any;
    private canvas: HTMLCanvasElement;
    private audioEngine: any;
    private worker: Worker | null = null;
    private cancelled = false;
    private stoppedEarly = false;
    private originalWidth = 0;
    private originalHeight = 0;
    private rejectExport: ((error: Error) => void) | null = null;
    private trackName: string = '';

    constructor(p5Instance: any, canvas: HTMLCanvasElement, audioEngine: any) {
        this.p5Instance = p5Instance;
        this.canvas = canvas;
        this.audioEngine = audioEngine;
    }

    async startExport(config: ExportConfig, onProgress: (progress: number) => void): Promise<Blob> {
        if (this.worker) throw new Error('An export is already running.');
        if (!VideoFrameClass.VideoFrame) throw new Error('WebCodecs VideoFrame is not available in this browser.');

        this.trackName = config.trackName || 'Plexus Performance';
        this.cancelled = false;
        this.stoppedEarly = false;
        this.originalWidth = this.p5Instance.width;
        this.originalHeight = this.p5Instance.height;
        this.p5Instance.noLoop();

        const target = getExportDimensions(config);
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

            this.p5Instance.resizeCanvas(target.width, target.height);
            await nextAnimationFrame();
            State.isExporting = true;
            State.exportTime = 0;

            const totalFrames = Math.floor(State.duration * config.fps);
            for (let i = 0; i < totalFrames; i++) {
                if (this.cancelled || this.stoppedEarly) break;

                State.exportTime = i / config.fps;
                this.p5Instance.redraw();
                this.drawMetadataCard(target.width, target.height);

                const timestampUs = Math.round((i * 1_000_000) / config.fps);
                const videoFrame = new VideoFrameClass.VideoFrame(this.canvas, { timestamp: timestampUs });

                await nextAnimationFrame();
                if (this.cancelled || this.stoppedEarly || !this.worker) {
                    videoFrame.close();
                    break;
                }

                const audioPayload = audioBuffer ? getPlanarAudioFrame(audioBuffer, i, config.fps) : null;

                if (audioPayload) {
                    this.worker.postMessage({
                        type: 'encode_frame',
                        frame: videoFrame,
                        timestampUs,
                        audioPlanar: audioPayload.audioPlanar,
                        audioSampleCount: audioPayload.audioSampleCount
                    }, [videoFrame, audioPayload.audioPlanar.buffer]);
                } else {
                    this.worker.postMessage({ type: 'encode_frame', frame: videoFrame, timestampUs }, [videoFrame]);
                }

                onProgress(totalFrames > 0 ? i / totalFrames : 1);
            }

            if (this.cancelled) throw new Error('Export cancelled.');

            this.worker.postMessage({ type: 'finalize_export' });
            const blob = await done;
            onProgress(1);
            return blob;
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
                    reject(new Error(event.data.message));
                }
            };
            worker.onerror = (event) => {
                this.rejectExport = null;
                reject(new Error(event.message || 'Export worker failed.'));
            };
        });
    }

    private cleanup() {
        if (this.originalWidth > 0 && this.originalHeight > 0) {
            this.p5Instance.resizeCanvas(this.originalWidth, this.originalHeight);
        }
        State.isExporting = false;
        State.exportTime = 0;
        this.p5Instance.loop();
        this.worker?.terminate();
        this.worker = null;
        this.rejectExport = null;
    }

    private drawMetadataCard(width: number, height: number): void {
        const ctx = this.canvas.getContext('2d');
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

    private fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
        if (ctx.measureText(text).width <= maxWidth) return text;
        const suffix = '...';
        let trimmed = text;
        while (trimmed.length > 0 && ctx.measureText(trimmed + suffix).width > maxWidth) {
            trimmed = trimmed.slice(0, -1);
        }
        return trimmed ? trimmed + suffix : suffix;
    }
}

function getExportDimensions(config: ExportConfig) {
    const base = config.resolution === '720p' ? 720 : config.resolution === '1080p' ? 1080 : 2160;
    if (config.aspectRatio === '16:9') return { width: Math.round(base * 16 / 9), height: base };
    if (config.aspectRatio === '9:16') return { width: base, height: Math.round(base * 16 / 9) };
    return { width: base, height: base };
}

function nextAnimationFrame() {
    return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
    });
}

function getPlanarAudioFrame(audioBuffer: AudioBuffer, frameIndex: number, fps: number) {
    const start = Math.floor(frameIndex * audioBuffer.sampleRate / fps);
    const end = Math.min(audioBuffer.length, Math.floor((frameIndex + 1) * audioBuffer.sampleRate / fps));
    const audioSampleCount = end - start;
    if (audioSampleCount <= 0) return null;

    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
    const audioPlanar = new Float32Array(audioSampleCount * 2);
    audioPlanar.set(left.subarray(start, end), 0);
    audioPlanar.set(right.subarray(start, end), audioSampleCount);
    return { audioPlanar, audioSampleCount };
}
