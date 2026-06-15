import type { ExportBackend } from './ExportBackend';
import type { ExportConfig } from './ExportTypes';
import { ExportCapabilityDetector } from './ExportCapabilityDetector';
import { ExportBackendRegistry } from './ExportBackendRegistry';
import './WebCodecsBackend';

export type { ExportConfig } from './ExportTypes';

export class WebMExporter {
    private backend: ExportBackend | null = null;
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
        if (this.backend) throw new Error('An export is already running.');

        const trackName = config.trackName || 'Plexus Performance';
        this.backend = await this.createBackend(trackName);
        try {
            return await this.backend.start(config, onProgress);
        } finally {
            this.backend = null;
        }
    }

    cancelExport(): void {
        this.backend?.cancelExport();
        this.backend = null;
    }

    stopAndSave(): void {
        this.backend?.stopAndSave();
    }

    private async createBackend(trackName: string): Promise<ExportBackend> {
        const capabilities = await ExportCapabilityDetector.detectCapabilities();
        return ExportBackendRegistry.getPreferred(this.p5Instance, this.canvas, this.audioEngine, trackName, capabilities, this.videoElement);
    }
}
