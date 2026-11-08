import { readExportPerformance, type ExportPerformanceReport } from './ExportPerformance';
import type { ExportConfig } from './ExportTypes';

export type CodecSupport = 'not-checked' | 'not-required' | 'supported' | 'unsupported' | 'unavailable' | 'error';
export type CodecProbeStage = 'api' | 'audio-query' | 'audio-encode' | 'encoder-query' | 'decoder-query' | 'encode' | 'decode' | 'container' | 'complete';
export interface ExportCodecDiagnostic {
    version: 1;
    /** A probed configuration, not a claim about the hardware implementation. */
    codec: string;
    width: number; height: number; fps: number; bitrate: number; bitDepth: 8 | 10;
    stage: CodecProbeStage;
    encoder: CodecSupport; decoder: CodecSupport;
    encodedFrames: number; decodedFrames: number;
    emittedCodec?: string;
    errorName?: string; message?: string;
}
export type ExportDiagnosticObserver = (report: ExportCodecDiagnostic) => void;
const support: CodecSupport[] = ['not-checked','not-required','supported','unsupported','unavailable','error'];
const stages: CodecProbeStage[] = ['api','audio-query','audio-encode','encoder-query','decoder-query','encode','decode','container','complete'];

/** Explicit flat allowlist at the worker boundary; never retain arbitrary payloads. */
export function readExportDiagnostic(value: unknown): ExportCodecDiagnostic | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as ExportCodecDiagnostic;
    if (v.version !== 1 || typeof v.codec !== 'string' || !v.codec || v.codec.length > 128
        || !Number.isSafeInteger(v.width) || v.width < 1 || v.width > 16384
        || !Number.isSafeInteger(v.height) || v.height < 1 || v.height > 16384
        || !Number.isFinite(v.fps) || v.fps <= 0 || v.fps > 240
        || !Number.isFinite(v.bitrate) || v.bitrate <= 0 || v.bitrate > 1e10
        || (v.bitDepth !== 8 && v.bitDepth !== 10) || !stages.includes(v.stage)
        || !support.includes(v.encoder) || !support.includes(v.decoder)
        || !Number.isSafeInteger(v.encodedFrames) || v.encodedFrames < 0 || v.encodedFrames > 1e6
        || !Number.isSafeInteger(v.decodedFrames) || v.decodedFrames < 0 || v.decodedFrames > 1e6) return null;
    for (const [key,limit] of [['message',1000],['errorName',64],['emittedCodec',128]] as const)
        if (v[key] !== undefined && (typeof v[key] !== 'string' || v[key]!.length > limit)) return null;
    return { version:1, codec:v.codec, width:v.width, height:v.height, fps:v.fps, bitrate:v.bitrate, bitDepth:v.bitDepth,
        stage:v.stage, encoder:v.encoder, decoder:v.decoder, encodedFrames:v.encodedFrames, decodedFrames:v.decodedFrames,
        ...(v.emittedCodec !== undefined ? {emittedCodec:v.emittedCodec} : {}),
        ...(v.errorName !== undefined ? {errorName:v.errorName} : {}), ...(v.message !== undefined ? {message:v.message} : {}) };
}
export function publishExportDiagnostic(observer: ExportDiagnosticObserver | undefined, report: ExportCodecDiagnostic): void {
    const owned = readExportDiagnostic(report);
    if (owned) try { observer?.(owned); } catch { /* Observation cannot alter an export's outcome. */ }
}
export function diagnosticFailure(report: ExportCodecDiagnostic, error: unknown): ExportCodecDiagnostic {
    const e = error as { name?: unknown; message?: unknown } | null;
    return { ...report, errorName: String(e?.name ?? 'Error').slice(0,64),
        message: String(e?.message ?? error).slice(0,1000) };
}
export function describeExportDiagnostic(report: ExportCodecDiagnostic): string {
    const codec = report.codec.startsWith('vp09') ? 'VP9' : report.codec.startsWith('avc') ? 'H.264' : report.codec.toUpperCase();
    return `Last codec check: ${codec} ${report.bitDepth}-bit, ${report.width}x${report.height} at ${report.fps} fps. Encoder: ${report.encoder}; decoder: ${report.decoder}. Stage: ${report.stage}. Probe frames: ${report.encodedFrames} encoded / ${report.decodedFrames} decoded.`;
}
export const EXPORT_FPS_KEY = 'plexus.export.fps';
export function normalizeExportFps(value: unknown): 30 | 60 { return value === 30 || value === '30' ? 30 : 60; }

/** One UI-owned attempt, bounded in memory. No persistence, audio bytes or automatic telemetry. */
export class ExportDiagnosticJournal {
    private requested: Partial<ExportConfig> | null = null;
    private events: ExportCodecDiagnostic[] = [];
    private performance: ExportPerformanceReport | null = null;
    private failure: { name: string; message: string } | null = null;
    begin(config: ExportConfig): void {
        const { resolution,aspectRatio,fps,watermark,format,mp4VideoCodec,webmBitDepth,preflight,videoBitrate, performanceMode } = config;
        this.requested = { resolution,aspectRatio,fps,watermark,format,mp4VideoCodec,webmBitDepth,preflight,videoBitrate,performanceMode };
        this.events = []; this.failure = null; this.performance = null;
    }
    record(value: unknown): void {
        const report = readExportDiagnostic(value); if (!report) return;
        this.events.push(report); if (this.events.length > 12) this.events.shift();
    }
    recordPerformance(value: unknown): void { this.performance = readExportPerformance(value); }
    fail(error: unknown): void {
        const e = error as { name?: unknown; message?: unknown } | null;
        this.failure = { name:String(e?.name ?? 'Error').slice(0,64), message:String(e?.message ?? error).slice(0,1000) };
    }
    snapshot() {
        return { version:1 as const, requested:this.requested ? {...this.requested} : null,
            events:this.events.map(e=>({...e})),
            performance:this.performance ? {...readExportPerformance(this.performance)!,scope:'Host/worker wall-clock stages overlap; do not sum them or infer GPU/CPU usage.'} : null, failure:this.failure ? {...this.failure} : null,
            scope:'Last attempt in this view. Probes describe codec support, not GPU/CPU assignment or long-export reliability.' };
    }
}
