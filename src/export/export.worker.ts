import type { EncodedChunkLike, Muxer } from './Muxer';
import { WebMMuxer } from './WebMMuxer';
import type { EncodeFrameRequest, ExportWorkerRequest, StartExportRequest } from './ExportTypes';

interface VideoFrameLike {
    close(): void;
}

type VideoFrameConstructor = new (source: ImageBitmap, init: { timestamp: number }) => VideoFrameLike;

interface AudioDataLike {
    close(): void;
}

interface VideoEncoderConfigLike {
    codec: string;
    width: number;
    height: number;
    bitrate: number;
    framerate: number;
    latencyMode: 'quality' | 'realtime';
}

interface VideoEncoderLike {
    configure(config: VideoEncoderConfigLike): void;
    encode(frame: VideoFrameLike): void;
    flush(): Promise<void>;
    close(): void;
}

interface AudioEncoderConfigLike {
    codec: 'opus';
    sampleRate: number;
    numberOfChannels: 2;
}

interface AudioEncoderLike {
    configure(config: AudioEncoderConfigLike): void;
    encode(data: AudioDataLike): void;
    flush(): Promise<void>;
    close(): void;
}

type VideoEncoderConstructor = new (init: {
    output: (chunk: EncodedChunkLike) => void;
    error: (error: Error) => void;
}) => VideoEncoderLike;

type AudioEncoderConstructor = new (init: {
    output: (chunk: EncodedChunkLike) => void;
    error: (error: Error) => void;
}) => AudioEncoderLike;

type AudioDataConstructor = new (init: {
    format: 'f32-planar';
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: 2;
    timestamp: number;
    data: Float32Array;
}) => AudioDataLike;

const workerScope = self as unknown as {
    VideoEncoder?: VideoEncoderConstructor;
    VideoFrame?: VideoFrameConstructor;
    AudioEncoder?: AudioEncoderConstructor;
    AudioData?: AudioDataConstructor;
    onmessage: ((event: MessageEvent<ExportWorkerRequest>) => void) | null;
    postMessage(message: unknown, transfer?: Transferable[]): void;
};

let opfsFileHandle: FileSystemFileHandle | null = null;
let opfsAccessHandle: any = null; // FileSystemSyncAccessHandle
let encoder: VideoEncoderLike | null = null;
let audioEncoder: AudioEncoderLike | null = null;
let muxer: Muxer | null = null;
let exportSampleRate = 48_000;
let framesEncodedCount = 0;
let totalEncodedBytes = 0;
let totalEncodeTimeMs = 0;
let peakEncodeTimeMs = 0;
let queueCheckInterval: ReturnType<typeof setInterval> | null = null;

workerScope.onmessage = (event) => {
    void handleMessage(event.data);
};

async function handleMessage(message: ExportWorkerRequest) {
    try {
        if (message.type === 'start_export') {
            await startExport(message);
            return;
        }
        if (message.type === 'encode_frame') {
            encodeFrame(message);
            return;
        }
        await finalizeExport();
    } catch (error) {
        if (queueCheckInterval) {
            clearInterval(queueCheckInterval);
            queueCheckInterval = null;
        }
        workerScope.postMessage({
            type: 'export_error',
            message: error instanceof Error ? error.message : String(error)
        });
    }
}

async function startExport(message: StartExportRequest) {
    const Encoder = workerScope.VideoEncoder;
    if (!Encoder) throw new Error('WebCodecs VideoEncoder is not available in this worker.');

    encoder?.close();
    audioEncoder?.close();
    audioEncoder = null;
    framesEncodedCount = 0;
    totalEncodedBytes = 0;
    totalEncodeTimeMs = 0;
    peakEncodeTimeMs = 0;
    exportSampleRate = Math.max(1, Math.round(message.sampleRate || 48_000));
    const dir = await navigator.storage.getDirectory();
    for await (const [name] of (dir as any).entries()) {
        if (name.startsWith('temp_plexus_export_')) {
            await dir.removeEntry(name);
        }
    }
    const uniqueFileName = `temp_plexus_export_${Date.now()}.webm`;
    opfsFileHandle = await dir.getFileHandle(uniqueFileName, { create: true });
    opfsAccessHandle = await (opfsFileHandle as any).createSyncAccessHandle();
    opfsAccessHandle.truncate(0);

    const config: VideoEncoderConfigLike = {
        codec: message.codec || 'vp09.00.10.08',
        width: Math.max(1, Math.floor(message.width)),
        height: Math.max(1, Math.floor(message.height)),
        bitrate: message.bitrate || getDefaultBitrate(message.width, message.height),
        framerate: Math.max(1, Math.round(message.fps)),
        latencyMode: 'quality'
    };

    muxer = new WebMMuxer({
        width: config.width,
        height: config.height,
        fps: config.framerate,
        codecId: config.codec === 'vp8' ? 'V_VP8' : 'V_VP9',
        sampleRate: exportSampleRate,
        hasAudio: false,
        onChunk: (chunk) => {
            opfsAccessHandle.write(chunk);
        }
    });

    encoder = new Encoder({
        output: (chunk) => {
            if (!muxer) throw new Error('Muxer is not initialized.');
            muxer.addVideoChunk(chunk);
            framesEncodedCount++;
            totalEncodedBytes += chunk.byteLength;
            if (framesEncodedCount % 30 === 0) {
                workerScope.postMessage({
                    type: 'export_telemetry',
                    telemetry: {
                        framesEncoded: framesEncodedCount,
                        encodedBytes: totalEncodedBytes,
                        queueDepth: encoder ? (encoder as VideoEncoderLike & { encodeQueueSize?: number }).encodeQueueSize || 0 : 0,
                        avgEncodeTimeMs: totalEncodeTimeMs / framesEncodedCount,
                        peakEncodeTimeMs
                    }
                });
            }
        },
        error: (error) => {
            workerScope.postMessage({ type: 'export_error', message: error.message });
        }
    });
    encoder.configure(config);

    if (message.hasAudio) {
        try {
            const AudioEncoder = workerScope.AudioEncoder;
            if (!AudioEncoder || !workerScope.AudioData) throw new Error('WebCodecs AudioEncoder is not available.');

            audioEncoder = new AudioEncoder({
                output: (chunk) => {
                    if (!muxer) throw new Error('Muxer is not initialized.');
                    muxer.addAudioChunk(chunk);
                },
                error: (error) => {
                    audioEncoder = null;
                    workerScope.postMessage({ type: 'export_audio_warning', message: error.message });
                }
            });
            audioEncoder.configure({
                codec: 'opus',
                sampleRate: exportSampleRate,
                numberOfChannels: 2
            });
            muxer.enableAudio();
        } catch (error) {
            audioEncoder = null;
            workerScope.postMessage({
                type: 'export_audio_warning',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    if (queueCheckInterval) clearInterval(queueCheckInterval);
    queueCheckInterval = setInterval(() => {
        if (encoder) {
            workerScope.postMessage({ type: 'queue_update', size: (encoder as any).encodeQueueSize || 0 });
        }
    }, 50);
}

function encodeFrame(message: EncodeFrameRequest) {
    if (!encoder) {
        message.bitmap.close();
        postFrameEncoded(message.timestampUs, message.audioPlanar);
        return;
    }
    const VideoFrame = workerScope.VideoFrame;
    if (!VideoFrame) {
        message.bitmap.close();
        postFrameEncoded(message.timestampUs, message.audioPlanar);
        throw new Error('VideoFrame is not supported in worker scope.');
    }

    let frame: VideoFrameLike | null = null;
    try {
        frame = new VideoFrame(message.bitmap, { timestamp: message.timestampUs });
        const encodeStartMs = performance.now();
        encoder.encode(frame);
        const encodeTimeMs = performance.now() - encodeStartMs;
        totalEncodeTimeMs += encodeTimeMs;
        peakEncodeTimeMs = Math.max(peakEncodeTimeMs, encodeTimeMs);
    } finally {
        frame?.close();
        message.bitmap.close();
    }

    if (!audioEncoder || !workerScope.AudioData || !message.audioPlanar || !message.audioSampleCount) {
        postFrameEncoded(message.timestampUs, message.audioPlanar);
        return;
    }

    const audioData = new workerScope.AudioData({
        format: 'f32-planar',
        sampleRate: exportSampleRate,
        numberOfFrames: message.audioSampleCount,
        numberOfChannels: 2,
        timestamp: message.timestampUs,
        data: message.audioPlanar
    });
    audioEncoder.encode(audioData);
    audioData.close();
    postFrameEncoded(message.timestampUs, message.audioPlanar);
}

function postFrameEncoded(timestampUs: number, audioBuffer?: Float32Array): void {
    if (audioBuffer) {
        workerScope.postMessage({
            type: 'frame_encoded',
            timestampUs,
            audioBuffer
        }, [audioBuffer.buffer]);
        return;
    }
    workerScope.postMessage({ type: 'frame_encoded', timestampUs });
}

async function finalizeExport() {
    if (queueCheckInterval) {
        clearInterval(queueCheckInterval);
        queueCheckInterval = null;
    }
    if (!encoder || !muxer) throw new Error('Export encoder is not initialized.');
    if (!opfsFileHandle || !opfsAccessHandle) throw new Error('OPFS export file is not initialized.');

    await encoder.flush();
    if (audioEncoder) {
        await audioEncoder.flush();
        audioEncoder.close();
        audioEncoder = null;
    }
    encoder.close();
    encoder = null;

    const blob = muxer.finalize();
    muxer = null;
    if (blob) {
        opfsAccessHandle.write(new Uint8Array(await blob.arrayBuffer()));
    }
    opfsAccessHandle.flush();
    opfsAccessHandle.close();
    opfsAccessHandle = null;
    const finalFile = await opfsFileHandle.getFile();
    opfsFileHandle = null;
    workerScope.postMessage({ type: 'export_done', blob: finalFile });
}

function getDefaultBitrate(width: number, height: number) {
    const pixels = Math.max(1, width * height);
    const fullHdPixels = 1920 * 1080;
    const ultraHdPixels = 3840 * 2160;
    if (pixels >= ultraHdPixels * 0.75) return 20_000_000;
    if (pixels >= fullHdPixels * 0.75) return 6_000_000;
    return Math.max(2_000_000, Math.round(6_000_000 * pixels / fullHdPixels));
}
