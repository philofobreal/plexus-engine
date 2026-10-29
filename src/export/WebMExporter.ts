import type { ExportBackend } from './ExportBackend';
import type { ExportConfig } from './ExportTypes';
import { ExportCapabilityDetector } from './ExportCapabilityDetector';
import { ExportBackendRegistry } from './ExportBackendRegistry';
import './WebCodecsBackend';

export type { ExportConfig } from './ExportTypes';

export class WebMExporter {
    // Reserve synchronously, including capability detection and asynchronous teardown.
    private activeJob: { backend: ExportBackend | null; command: 'stop' | 'cancel' | null } | null = null;
    private readonly p5Instance: any;
    private readonly canvas: HTMLCanvasElement;
    private readonly audioEngine: any;
    private readonly videoElement: HTMLVideoElement | null;

    constructor(
        p5Instance: any,
        canvas: HTMLCanvasElement,
        audioEngine: any,
        videoElement: HTMLVideoElement | null = null
    ) {
        this.p5Instance = p5Instance;
        this.canvas = canvas;
        this.audioEngine = audioEngine;
        this.videoElement = videoElement;
    }

    async startExport(config: ExportConfig, onProgress: (progress: number) => void): Promise<Blob> {
        if (this.activeJob) throw new Error('An export is already running.');
        const job = { backend: null as ExportBackend | null, command: null as 'stop' | 'cancel' | null };
        this.activeJob = job;
        const capturedConfig = { ...config };
        try {
            const backend = await this.createBackend(capturedConfig.trackName || 'Plexus Performance');
            if (job.command === 'cancel') throw new Error('Export cancelled.');
            if (job.command === 'stop') throw new Error('No video frames were captured before stopping.');
            job.backend = backend;
            const blob = await backend.start(capturedConfig, progress => {
                if (this.activeJob === job && job.command !== 'cancel') onProgress(progress);
            });
            // A backend completion already queued when Cancel arrived must not download.
            if (job.command === 'cancel') throw new Error('Export cancelled.');
            return blob;
        } finally {
            if (this.activeJob === job) this.activeJob = null;
        }
    }

    cancelExport(): void {
        const job = this.activeJob;
        if (!job || job.command === 'cancel') return;
        job.command = 'cancel';
        job.backend?.cancelExport();
    }

    stopAndSave(): void {
        const job = this.activeJob;
        if (!job || job.command) return;
        job.command = 'stop';
        job.backend?.stopAndSave();
    }

    private async createBackend(trackName: string): Promise<ExportBackend> {
        const capabilities = await ExportCapabilityDetector.detectCapabilities();
        return ExportBackendRegistry.getPreferred(this.p5Instance, this.canvas, this.audioEngine, trackName, capabilities, this.videoElement);
    }
}
