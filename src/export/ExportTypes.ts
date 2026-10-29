import type { ExportPreparationReport } from '../types/ExportRenderJob';
export type { ExportPreparationReport } from '../types/ExportRenderJob';
export type ExportResolution = '720p' | '1080p' | '4K';
export type ExportAspectRatio = '16:9' | '9:16' | '1:1';
export type ExportBackendId = 'webcodecs' | 'none';
export type ExportVideoCodec = 'vp8' | `vp09.00.${string}.08`;

export interface ExportConfig {
    /** Device/job policy, never a visual preset property. Omission preserves the existing backend. */
    runtime?: 'compatible' | 'isolated-wormhole';
    /** Optional explicit planning ceiling; omission is Auto, not a free-RAM claim. */
    memoryLimitMiB?: 512 | 1024 | 2048;
    /** Production MVP requests the worker-local probe; older direct callers remain compatible. */
    preflight?: boolean;
    resolution: ExportResolution;
    aspectRatio: ExportAspectRatio;
    fps: number;
    trackName?: string;
    watermark?: boolean;
}

export interface ExportCapabilities {
    webcodecsSupported: boolean;
    webcodecsCodecs: {
        vp9: boolean;
        vp8: boolean;
    };
    canExport4K: boolean;
    fourKRestriction?: 'device-heuristic';
    isMobile: boolean;
    preferredBackend: ExportBackendId;
    warnings: string[];
}

export type ExportCapabilityReport = ExportCapabilities;

export interface StartExportRequest {
    preflight?: boolean;
    profile?: boolean;
    type: 'start_export';
    width: number;
    height: number;
    fps: number;
    sampleRate: number;
    hasAudio?: boolean;
    bitrate?: number;
    codec?: ExportVideoCodec;
}

export interface EncodeFrameRequest {
    type: 'encode_frame';
    bitmap: ImageBitmap;
    timestampUs: number;
    audioPlanar?: Float32Array;
    audioSampleCount?: number;
}

export interface FinalizeExportRequest {
    type: 'finalize_export';
}

export type ExportWorkerRequest =
    | StartExportRequest
    | EncodeFrameRequest
    | FinalizeExportRequest;

export interface DoneResponse {
    timings?: Record<string, number>;
    type: 'export_done';
    blob: Blob;
}

export interface ChunkResponse {
    type: 'export_chunk';
    chunk: Uint8Array;
}

export interface ErrorResponse {
    type: 'export_error';
    message: string;
}

export interface AudioWarningResponse {
    type: 'export_audio_warning';
    message: string;
}

export interface FrameEncodedResponse {
    type: 'frame_encoded';
    timestampUs: number;
    audioBuffer?: Float32Array;
}

export interface QueueUpdateResponse {
    type: 'queue_update';
    size: number;
}

export interface ExportTelemetry {
    framesEncoded: number;
    encodedBytes: number;
    queueDepth: number;
    /** Legacy names: synchronous encoder submission cost, NOT asynchronous codec completion. */
    avgEncodeTimeMs: number;
    peakEncodeTimeMs: number;
}

export interface TelemetryResponse {
    type: 'export_telemetry';
    telemetry: ExportTelemetry;
}

export type ExportDoneMessage = DoneResponse;
export type ExportChunkMessage = ChunkResponse;
export type ExportErrorMessage = ErrorResponse;
export type ExportAudioWarningMessage = AudioWarningResponse;
export type FrameEncodedMessage = FrameEncodedResponse;
export type ExportTelemetryMessage = TelemetryResponse;

export type ExportWorkerResponse =
    | { type: 'export_prepared'; report: ExportPreparationReport }
    | DoneResponse
    | ChunkResponse
    | ErrorResponse
    | AudioWarningResponse
    | FrameEncodedResponse
    | QueueUpdateResponse
    | TelemetryResponse;
