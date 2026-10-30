import type { ExportBackend } from './ExportBackend';
import type { ExportConfig } from './ExportTypes';
import type { ExportRuntime, ExportProfile } from '../types/ExportRenderJob';
import { ExportCapabilityDetector } from './ExportCapabilityDetector';
import { ExportBackendRegistry } from './ExportBackendRegistry';
import './WebCodecsBackend';

export type { ExportConfig } from './ExportTypes';

export class WebMExporter {
    // Reserve synchronously, including capability detection and asynchronous teardown.
    private activeJob: { backend: ExportBackend | null; command: 'stop' | 'cancel' | null; abort?: AbortController } | null = null;
    private readonly p5Instance: any;
    private readonly canvas: HTMLCanvasElement;
    private readonly audioEngine: any;
    private readonly videoElement: HTMLVideoElement | null;
    private readonly options;

    constructor(
        p5Instance: any,
        canvas: HTMLCanvasElement,
        audioEngine: any,
        videoElement: HTMLVideoElement | null = null,
        options?: { prepareRuntime: (config: ExportConfig, signal: AbortSignal) => Promise<ExportRuntime>; onProfile?: (profile: ExportProfile) => void }
    ) {
        this.p5Instance = p5Instance;
        this.canvas = canvas;
        this.audioEngine = audioEngine;
        this.videoElement = videoElement;
        this.options = options;
    }

    async startExport(config: ExportConfig, onProgress: (progress: number) => void): Promise<Blob> {
        if (this.activeJob) throw new Error('An export is already running.');
        const job = { backend: null as ExportBackend | null, command: null as 'stop' | 'cancel' | null, abort: undefined as AbortController | undefined };
        this.activeJob = job;
        let runtime: ExportRuntime | undefined;
        try {
            const capturedConfig = { ...config };
            if (capturedConfig.runtime === 'isolated-wormhole') {
                if (!this.options) throw new Error('Isolated Wormhole export is unavailable in this host.');
                job.abort = new AbortController();
                runtime = await this.options.prepareRuntime(capturedConfig, job.abort.signal);
            }
            const backend = await this.createBackend(capturedConfig.trackName || 'Plexus Performance');
            if (job.command === 'cancel') throw new Error('Export cancelled.');
            if (job.command === 'stop') throw new Error('No video frames were captured before stopping.');
            job.backend = backend;
            const blob = await backend.start(capturedConfig, progress => {
                if (this.activeJob === job && job.command !== 'cancel') onProgress(progress);
            }, runtime, this.options?.onProfile);
            // A backend completion already queued when Cancel arrived must not download.
            if (job.command === 'cancel') throw new Error('Export cancelled.');
            return blob;
        } catch (error) {
            if (job.command === 'cancel') try { await job.backend?.discardResult?.(); } catch { /* Cleanup must not replace Cancel. */ }
            if (job.command === 'cancel') throw new Error('Export cancelled.');
            if (job.command === 'stop' && !job.backend) throw new Error('No video frames were captured before stopping.');
            throw error;
        } finally {
            try { runtime?.dispose(); } finally { if (this.activeJob === job) this.activeJob = null; }
        }
    }

    cancelExport(): void {
        const job = this.activeJob;
        if (!job || job.command === 'cancel') return;
        job.command = 'cancel';
        job.abort?.abort();
        job.backend?.cancelExport();
    }

    stopAndSave(): void {
        const job = this.activeJob;
        if (!job || job.command) return;
        job.command = 'stop';
        if (!job.backend) job.abort?.abort();
        job.backend?.stopAndSave();
    }

    private async createBackend(trackName: string): Promise<ExportBackend> {
        const capabilities = await ExportCapabilityDetector.detectCapabilities();
        return ExportBackendRegistry.getPreferred(this.p5Instance, this.canvas, this.audioEngine, trackName, capabilities, this.videoElement);
    }
}
