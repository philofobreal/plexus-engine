import type { ExportConfig } from './ExportTypes';
import type { ExportRuntime, ExportProfile } from '../types/ExportRenderJob';

export interface ExportBackend {
    start(config: ExportConfig, onProgress: (progress: number) => void, runtime?: ExportRuntime, onProfile?: (profile: ExportProfile) => void): Promise<Blob>;
    stopAndSave(): void;
    cancelExport(): void;
}
