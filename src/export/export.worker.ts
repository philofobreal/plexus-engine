export {};

type ExportWorkerRequest = StartExportMessage | EncodeFrameMessage | FinalizeExportMessage;

interface StartExportMessage {
    type: 'start_export';
    width: number;
    height: number;
    fps: number;
    sampleRate: number;
    hasAudio?: boolean;
    bitrate?: number;
    codec?: 'vp8' | 'vp09.00.10.08';
}

interface EncodeFrameMessage {
    type: 'encode_frame';
    frame: VideoFrameLike;
    timestampUs: number;
    audioPlanar?: Float32Array;
    audioSampleCount?: number;
}

interface FinalizeExportMessage {
    type: 'finalize_export';
}

interface VideoFrameLike {
    close(): void;
}

interface EncodedVideoChunkLike {
    readonly byteLength: number;
    readonly timestamp: number;
    readonly duration?: number | null;
    readonly type: 'key' | 'delta';
    copyTo(destination: Uint8Array): void;
}

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
    output: (chunk: EncodedVideoChunkLike) => void;
    error: (error: Error) => void;
}) => VideoEncoderLike;

type AudioEncoderConstructor = new (init: {
    output: (chunk: EncodedVideoChunkLike) => void;
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
    AudioEncoder?: AudioEncoderConstructor;
    AudioData?: AudioDataConstructor;
    onmessage: ((event: MessageEvent<ExportWorkerRequest>) => void) | null;
    postMessage(message: unknown, transfer?: Transferable[]): void;
};

let encoder: VideoEncoderLike | null = null;
let audioEncoder: AudioEncoderLike | null = null;
let muxer: WebMMuxer | null = null;
let exportSampleRate = 48_000;

workerScope.onmessage = (event) => {
    void handleMessage(event.data);
};

async function handleMessage(message: ExportWorkerRequest) {
    try {
        if (message.type === 'start_export') {
            startExport(message);
            return;
        }
        if (message.type === 'encode_frame') {
            encodeFrame(message);
            return;
        }
        await finalizeExport();
    } catch (error) {
        workerScope.postMessage({
            type: 'export_error',
            message: error instanceof Error ? error.message : String(error)
        });
    }
}

function startExport(message: StartExportMessage) {
    const Encoder = workerScope.VideoEncoder;
    if (!Encoder) throw new Error('WebCodecs VideoEncoder is not available in this worker.');

    encoder?.close();
    audioEncoder?.close();
    audioEncoder = null;
    exportSampleRate = Math.max(1, Math.round(message.sampleRate || 48_000));

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
        hasAudio: false
    });

    encoder = new Encoder({
        output: (chunk) => {
            if (!muxer) throw new Error('Muxer is not initialized.');
            muxer.addVideoChunk(chunk);
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
}

function encodeFrame(message: EncodeFrameMessage) {
    if (!encoder) throw new Error('Export encoder is not initialized.');
    const frame = message.frame;
    encoder.encode(frame);
    frame.close();

    if (!audioEncoder || !workerScope.AudioData || !message.audioPlanar || !message.audioSampleCount) return;

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
}

async function finalizeExport() {
    if (!encoder || !muxer) throw new Error('Export encoder is not initialized.');

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
    workerScope.postMessage({ type: 'export_done', blob });
}

function getDefaultBitrate(width: number, height: number) {
    const pixels = Math.max(1, width * height);
    const fullHdPixels = 1920 * 1080;
    const ultraHdPixels = 3840 * 2160;
    if (pixels >= ultraHdPixels * 0.75) return 20_000_000;
    if (pixels >= fullHdPixels * 0.75) return 6_000_000;
    return Math.max(2_000_000, Math.round(6_000_000 * pixels / fullHdPixels));
}

class WebMMuxer {
    private readonly clusters: Uint8Array[] = [];
    private currentClusterBlocks: Uint8Array[] = [];
    private readonly timecodeScale = 1_000_000;
    private readonly videoTrackNumber = 1;
    private readonly width: number;
    private readonly height: number;
    private readonly fps: number;
    private readonly codecId: string;
    private readonly sampleRate: number;
    private hasAudio: boolean;
    private clusterTimecode = 0;
    private clusterOpen = false;
    private durationMs = 0;

    constructor(config: { width: number; height: number; fps: number; codecId: string; sampleRate: number; hasAudio: boolean }) {
        this.width = config.width;
        this.height = config.height;
        this.fps = config.fps;
        this.codecId = config.codecId;
        this.sampleRate = config.sampleRate;
        this.hasAudio = config.hasAudio;
    }

    enableAudio() {
        this.hasAudio = true;
    }

    addVideoChunk(chunk: EncodedVideoChunkLike) {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);

        const timeMs = Math.round(chunk.timestamp / 1000);
        const durationMs = Math.max(1, Math.round((chunk.duration || 1_000_000 / this.fps) / 1000));
        this.durationMs = Math.max(this.durationMs, timeMs + durationMs);

        if (!this.clusterOpen || timeMs - this.clusterTimecode > 30_000 || chunk.type === 'key') {
            this.startCluster(timeMs);
        }

        this.currentClusterBlocks.push(ebmlElement(0xA3, this.createSimpleBlock(1, timeMs - this.clusterTimecode, chunk.type === 'key', data)));
    }

    addAudioChunk(chunk: EncodedVideoChunkLike) {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);

        const timeMs = Math.round(chunk.timestamp / 1000);
        const durationMs = Math.max(1, Math.round((chunk.duration || 0) / 1000));
        this.durationMs = Math.max(this.durationMs, timeMs + durationMs);

        if (!this.clusterOpen || timeMs - this.clusterTimecode > 30_000) {
            this.startCluster(timeMs);
        }

        this.currentClusterBlocks.push(ebmlElement(0xA3, this.createSimpleBlock(2, timeMs - this.clusterTimecode, false, data)));
    }

    finalize() {
        this.closeCurrentCluster();
        const parts = [
            ebmlElement(0x1A45DFA3, this.createEbmlHeader()),
            ebmlId(0x18538067),
            unknownSizeBytes(8),
            ebmlElement(0x1549A966, this.createInfo()),
            ebmlElement(0x1654AE6B, this.createTracks()),
            ...this.clusters
        ].map(toBlobPart);
        return new Blob(parts, { type: 'video/webm' });
    }

    private createEbmlHeader() {
        return concatBytes(
            ebmlUIntElement(0x4286, 1),
            ebmlUIntElement(0x42F7, 1),
            ebmlUIntElement(0x42F2, 4),
            ebmlUIntElement(0x42F3, 8),
            ebmlStringElement(0x4282, 'webm'),
            ebmlUIntElement(0x4287, 4),
            ebmlUIntElement(0x4285, 2)
        );
    }

    private createInfo() {
        return concatBytes(
            ebmlUIntElement(0x2AD7B1, this.timecodeScale),
            ebmlFloatElement(0x4489, this.durationMs),
            ebmlStringElement(0x4D80, 'Plexus Engine'),
            ebmlStringElement(0x5741, 'Plexus Engine Export Worker')
        );
    }

    private createTracks() {
        const videoTrack = ebmlElement(0xAE, concatBytes(
            ebmlUIntElement(0xD7, this.videoTrackNumber),
            ebmlUIntElement(0x73C5, this.videoTrackNumber),
            ebmlUIntElement(0x83, 1),
            ebmlStringElement(0x86, this.codecId),
            ebmlFloatElement(0x23E383, 1_000_000_000 / this.fps),
            ebmlElement(0xE0, concatBytes(
                ebmlUIntElement(0xB0, this.width),
                ebmlUIntElement(0xBA, this.height)
            ))
        ));

        if (!this.hasAudio) return videoTrack;

        const audioTrack = ebmlElement(0xAE, concatBytes(
            ebmlUIntElement(0xD7, 2),
            ebmlUIntElement(0x73C5, 2),
            ebmlUIntElement(0x83, 2),
            ebmlStringElement(0x86, 'A_OPUS'),
            ebmlUIntElement(0x56AA, 80_000_000),
            ebmlUIntElement(0x56BB, 80_000_000),
            ebmlElement(0x63A2, createOpusHead(this.sampleRate)),
            ebmlElement(0xE1, concatBytes(
                ebmlFloatElement(0xB5, this.sampleRate),
                ebmlUIntElement(0x9F, 2)
            ))
        ));

        return concatBytes(videoTrack, audioTrack);
    }

    private startCluster(timeMs: number) {
        this.closeCurrentCluster();
        this.clusterOpen = true;
        this.clusterTimecode = timeMs;
        this.currentClusterBlocks = [ebmlElement(0xE7, encodeUnsignedInteger(timeMs))];
    }

    private createSimpleBlock(trackNumber: number, relativeTimeMs: number, keyframe: boolean, frameData: Uint8Array) {
        const block = new Uint8Array(4 + frameData.length);
        block[0] = 0x80 | trackNumber;
        writeInt16(block, 1, relativeTimeMs);
        block[3] = keyframe ? 0x80 : 0x00;
        block.set(frameData, 4);
        return block;
    }

    private closeCurrentCluster() {
        if (!this.clusterOpen) return;
        this.clusters.push(ebmlElement(0x1F43B675, concatBytes(...this.currentClusterBlocks)));
        this.currentClusterBlocks = [];
        this.clusterOpen = false;
    }
}

function ebmlElement(id: number, data: Uint8Array) {
    return concatBytes(ebmlId(id), ebmlSize(data.length), data);
}

function ebmlUIntElement(id: number, value: number) {
    return ebmlElement(id, encodeUnsignedInteger(value));
}

function ebmlFloatElement(id: number, value: number) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, value, false);
    return ebmlElement(id, bytes);
}

function ebmlStringElement(id: number, value: string) {
    return ebmlElement(id, new TextEncoder().encode(value));
}

function createOpusHead(sampleRate: number) {
    const head = new Uint8Array(19);
    head.set(new TextEncoder().encode('OpusHead'), 0);
    head[8] = 1;
    head[9] = 2;
    head[10] = 0;
    head[11] = 0;
    const view = new DataView(head.buffer);
    view.setUint32(12, sampleRate, true);
    view.setUint16(16, 0, true);
    head[18] = 0;
    return head;
}

function ebmlId(id: number) {
    const length = id > 0xFFFFFF ? 4 : id > 0xFFFF ? 3 : id > 0xFF ? 2 : 1;
    const bytes = new Uint8Array(length);
    for (let i = length - 1; i >= 0; i--) {
        bytes[i] = id & 0xFF;
        id >>>= 8;
    }
    return bytes;
}

function ebmlSize(size: number) {
    for (let length = 1; length <= 8; length++) {
        const max = Math.pow(2, 7 * length) - 2;
        if (size <= max) {
            const bytes = new Uint8Array(length);
            let value = size;
            for (let i = length - 1; i >= 0; i--) {
                bytes[i] = value & 0xFF;
                value = Math.floor(value / 256);
            }
            bytes[0] |= 1 << (8 - length);
            return bytes;
        }
    }
    throw new Error('EBML element is too large.');
}

function unknownSizeBytes(length: number) {
    const bytes = new Uint8Array(length);
    bytes[0] = 1 << (8 - length);
    bytes.fill(0xFF, 1);
    return bytes;
}

function encodeUnsignedInteger(value: number) {
    const normalized = Math.max(0, Math.floor(value));
    let length = 1;
    while (length < 8 && normalized >= Math.pow(2, 8 * length)) length++;

    const bytes = new Uint8Array(length);
    let remaining = normalized;
    for (let i = length - 1; i >= 0; i--) {
        bytes[i] = remaining & 0xFF;
        remaining = Math.floor(remaining / 256);
    }
    return bytes;
}

function writeInt16(target: Uint8Array, offset: number, value: number) {
    const clamped = Math.max(-32768, Math.min(32767, value));
    new DataView(target.buffer, target.byteOffset, target.byteLength).setInt16(offset, clamped, false);
}

function concatBytes(...parts: Uint8Array[]) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return output;
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
