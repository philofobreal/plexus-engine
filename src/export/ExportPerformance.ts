/** Export throughput is device/job policy, independent of visual presets and codecs. */
export type ExportPerformanceMode = 'economy' | 'turbo';
export const EXPORT_PERFORMANCE_KEY = 'plexus.export.performance.v1';
export function normalizeExportPerformance(value: unknown): ExportPerformanceMode {
    return value === 'turbo' ? 'turbo' : 'economy';
}

/** MP4 has not met the retained 15% throughput gate; keep its qualified path. */
export function resolveExportPerformance(value: unknown, format: 'webm' | 'mp4') {
    const requested = normalizeExportPerformance(value);
    return requested === 'turbo' && format === 'mp4'
        ? { requested, active: 'economy' as const, fallbackReason: 'mp4-throughput-unqualified' as const }
        : { requested, active: requested, fallbackReason: undefined };
}

export interface ExportPerformanceReport {
    version: 1;
    requested: ExportPerformanceMode;
    active: ExportPerformanceMode;
    fallbackReason?: 'mp4-throughput-unqualified';
    scheduling: 'display' | 'cooperative';
    frameSource: 'exact' | 'compatible' | 'isolated-research';
    outcome: 'completed' | 'failed' | 'cancelled';
    framesSubmitted: number;
    peakOutstandingFrames: number;
    audioPoolLimitBytes: number;
    hostMs: Record<string, number>;
    workerMs: Record<string, number>;
}
export type ExportPerformanceObserver = (report: ExportPerformanceReport) => void;

function readTimes(value: unknown): Record<string, number> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value);
    if (entries.length > 20 || entries.some(([key, ms]) => !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key)
        || typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0 || ms > 604_800_000)) return null;
    return Object.fromEntries(entries);
}

/** Bounded owned copy; counters describe overlap, never GPU/CPU attribution. */
export function readExportPerformance(value: unknown): ExportPerformanceReport | null {
    if (!value || typeof value !== 'object') return null;
    const r = value as ExportPerformanceReport;
    if (r.version !== 1 || !['economy', 'turbo'].includes(r.requested) || !['economy', 'turbo'].includes(r.active)
        || !['display', 'cooperative'].includes(r.scheduling) || !['exact', 'compatible', 'isolated-research'].includes(r.frameSource)
        || !['completed', 'failed', 'cancelled'].includes(r.outcome)
        || !Number.isSafeInteger(r.framesSubmitted) || r.framesSubmitted < 0 || r.framesSubmitted > 1e8
        || !Number.isSafeInteger(r.peakOutstandingFrames) || r.peakOutstandingFrames < 0 || r.peakOutstandingFrames > 2
        || !Number.isSafeInteger(r.audioPoolLimitBytes) || r.audioPoolLimitBytes < 0 || r.audioPoolLimitBytes > 128 * 1024 ** 2) return null;
    if ((r.fallbackReason !== undefined && r.fallbackReason !== 'mp4-throughput-unqualified')
        || (r.requested !== r.active && r.fallbackReason === undefined)
        || (r.fallbackReason !== undefined && (r.requested !== 'turbo' || r.active !== 'economy'))) return null;
    const hostMs = readTimes(r.hostMs), workerMs = readTimes(r.workerMs);
    if (!hostMs || !workerMs) return null;
    return { version: 1, requested: r.requested, active: r.active, scheduling: r.scheduling, frameSource: r.frameSource,
        ...(r.fallbackReason ? {fallbackReason:r.fallbackReason} : {}),
        outcome: r.outcome, framesSubmitted: r.framesSubmitted, peakOutstandingFrames: r.peakOutstandingFrames,
        audioPoolLimitBytes: r.audioPoolLimitBytes, hostMs, workerMs };
}

export function describeExportPerformance(r: ExportPerformanceReport): string {
    const seconds = (r.hostMs.total ?? r.hostMs.backendRequest ?? 0) / 1000;
    const fallback = r.fallbackReason ? ' (MP4 uses the qualified Economy path)' : '';
    return `${r.active === 'turbo' ? 'Turbo' : 'Economy'} export${fallback}: ${r.framesSubmitted} frames, ${seconds.toFixed(1)} s; ${r.frameSource} rendering. Quality settings unchanged.`;
}
