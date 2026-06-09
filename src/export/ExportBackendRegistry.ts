import type { ExportBackend } from './ExportBackend';
import type { ExportBackendId, ExportCapabilities } from './ExportTypes';

export interface ExportBackendFactory {
    readonly id: Exclude<ExportBackendId, 'none'>;
    readonly priority: number;
    isSupported(capabilities?: ExportCapabilities): boolean;
    create(p5Instance: any, canvas: HTMLCanvasElement, audioEngine: any, trackName: string): ExportBackend;
}

export class ExportBackendRegistry {
    private static factories: ExportBackendFactory[] = [];

    static register(factory: ExportBackendFactory): void {
        this.factories.push(factory);
        this.factories.sort((a, b) => b.priority - a.priority);
    }

    static getPreferred(p5Instance: any, canvas: HTMLCanvasElement, audioEngine: any, trackName: string, capabilities?: ExportCapabilities): ExportBackend {
        if (capabilities?.preferredBackend === 'none') {
            throw new Error(capabilities.warnings[0] || 'No supported export backend found.');
        }
        if (capabilities) {
            const preferredFactory = this.factories.find((factory) => factory.id === capabilities.preferredBackend);
            if (preferredFactory?.isSupported(capabilities)) {
                return preferredFactory.create(p5Instance, canvas, audioEngine, trackName);
            }
        }
        for (const factory of this.factories) {
            if (factory.isSupported(capabilities)) {
                return factory.create(p5Instance, canvas, audioEngine, trackName);
            }
        }
        throw new Error('No supported export backend found.');
    }

    static clear(): void {
        this.factories = [];
    }
}
