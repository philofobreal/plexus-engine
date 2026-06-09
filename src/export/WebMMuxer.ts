import type { EncodedChunkLike, Muxer, MuxerConfig } from './Muxer';

interface WebMMuxerConfig extends MuxerConfig {}

export class WebMMuxer implements Muxer {
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
    private readonly onChunk?: (chunk: Uint8Array) => void;
    private headerEmitted = false;
    private clusterTimecode = 0;
    private clusterOpen = false;
    private durationMs = 0;

    constructor(config: WebMMuxerConfig) {
        this.width = config.width;
        this.height = config.height;
        this.fps = config.fps;
        this.codecId = config.codecId;
        this.sampleRate = config.sampleRate;
        this.hasAudio = config.hasAudio;
        this.onChunk = config.onChunk;
    }

    enableAudio(): void {
        this.hasAudio = true;
    }

    addVideoChunk(chunk: EncodedChunkLike): void {
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

    addAudioChunk(chunk: EncodedChunkLike): void {
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

    finalize(): Blob {
        this.closeCurrentCluster();
        if (this.onChunk) {
            this.emitHeader();
            return new Blob([], { type: 'video/webm' });
        }
        const parts: BlobPart[] = [
            ebmlElement(0x1A45DFA3, this.createEbmlHeader()),
            ebmlId(0x18538067),
            unknownSizeBytes(8),
            ebmlElement(0x1549A966, this.createInfo()),
            ebmlElement(0x1654AE6B, this.createTracks()),
            ...this.clusters
        ] as BlobPart[];
        return new Blob(parts, { type: 'video/webm' });
    }

    private createEbmlHeader(): Uint8Array {
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

    private createInfo(): Uint8Array {
        const baseInfo = [
            ebmlUIntElement(0x2AD7B1, this.timecodeScale),
            ebmlStringElement(0x4D80, 'Plexus Engine'),
            ebmlStringElement(0x5741, 'Plexus Engine Export Worker')
        ];
        if (!this.onChunk) {
            baseInfo.splice(1, 0, ebmlFloatElement(0x4489, this.durationMs));
        }
        return concatBytes(...baseInfo);
    }

    private createTracks(): Uint8Array {
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

    private startCluster(timeMs: number): void {
        this.emitHeader();
        this.closeCurrentCluster();
        this.clusterOpen = true;
        this.clusterTimecode = timeMs;
        this.currentClusterBlocks = [ebmlElement(0xE7, encodeUnsignedInteger(timeMs))];
    }

    private createSimpleBlock(trackNumber: number, relativeTimeMs: number, keyframe: boolean, frameData: Uint8Array): Uint8Array {
        const block = new Uint8Array(4 + frameData.length);
        block[0] = 0x80 | trackNumber;
        writeInt16(block, 1, relativeTimeMs);
        block[3] = keyframe ? 0x80 : 0x00;
        block.set(frameData, 4);
        return block;
    }

    private closeCurrentCluster(): void {
        if (!this.clusterOpen) return;
        const clusterBytes = ebmlElement(0x1F43B675, concatBytes(...this.currentClusterBlocks));
        this.currentClusterBlocks = [];
        this.clusterOpen = false;
        if (this.onChunk) {
            this.onChunk(clusterBytes);
            return;
        }
        this.clusters.push(clusterBytes);
    }

    private emitHeader(): void {
        if (!this.onChunk || this.headerEmitted) return;
        const headerBytes = concatBytes(
            ebmlElement(0x1A45DFA3, this.createEbmlHeader()),
            ebmlId(0x18538067),
            unknownSizeBytes(8),
            ebmlElement(0x1549A966, this.createInfo()),
            ebmlElement(0x1654AE6B, this.createTracks())
        );
        this.headerEmitted = true;
        this.onChunk(headerBytes);
    }
}

function ebmlElement(id: number, data: Uint8Array): Uint8Array {
    return concatBytes(ebmlId(id), ebmlSize(data.length), data);
}

function ebmlUIntElement(id: number, value: number): Uint8Array {
    return ebmlElement(id, encodeUnsignedInteger(value));
}

function ebmlFloatElement(id: number, value: number): Uint8Array {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, value, false);
    return ebmlElement(id, bytes);
}

function ebmlStringElement(id: number, value: string): Uint8Array {
    return ebmlElement(id, new TextEncoder().encode(value));
}

function createOpusHead(sampleRate: number): Uint8Array {
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

function ebmlId(id: number): Uint8Array {
    const length = id > 0xFFFFFF ? 4 : id > 0xFFFF ? 3 : id > 0xFF ? 2 : 1;
    const bytes = new Uint8Array(length);
    for (let i = length - 1; i >= 0; i--) {
        bytes[i] = id & 0xFF;
        id >>>= 8;
    }
    return bytes;
}

function ebmlSize(size: number): Uint8Array {
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

function unknownSizeBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    bytes[0] = 1 << (8 - length);
    bytes.fill(0xFF, 1);
    return bytes;
}

function encodeUnsignedInteger(value: number): Uint8Array {
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

function writeInt16(target: Uint8Array, offset: number, value: number): void {
    const clamped = Math.max(-32768, Math.min(32767, value));
    new DataView(target.buffer, target.byteOffset, target.byteLength).setInt16(offset, clamped, false);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return output;
}
