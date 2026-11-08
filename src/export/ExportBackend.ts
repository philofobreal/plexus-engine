import type { ExportPerformanceObserver } from './ExportPerformance';
import type { ExportDiagnosticObserver } from './ExportDiagnostics';
import type { ExportConfig } from './ExportTypes';
import type { ExportRuntime, ExportProfile } from '../types/ExportRenderJob';

export interface ExportBackend {
    start(config: ExportConfig, onProgress: (progress: number) => void, runtime?: ExportRuntime, onProfile?: (profile: ExportProfile) => void, onDiagnostic?: ExportDiagnosticObserver, onPerformance?: ExportPerformanceObserver): Promise<Blob>;
    stopAndSave(): void;
    cancelExport(): void;
    /** Discard an unpublished result (e.g. Cancel won a queued completion). */
    discardResult?(): Promise<void>;
}
