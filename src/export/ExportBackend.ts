import type { ExportConfig } from './ExportTypes';

export interface ExportBackend {
    start(config: ExportConfig, onProgress: (progress: number) => void): Promise<Blob>;
    stopAndSave(): void;
    cancelExport(): void;
}
