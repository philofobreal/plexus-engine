export interface EncodedChunkLike {
    readonly byteLength: number;
    readonly timestamp: number;
    readonly duration?: number | null;
    readonly type: 'key' | 'delta';
    copyTo(destination: Uint8Array): void;
}

export interface MuxerConfig {
    width: number;
    height: number;
    fps: number;
    codecId: string;
    sampleRate: number;
    hasAudio: boolean;
    onChunk?: (chunk: Uint8Array) => void;
}

export interface Muxer {
    enableAudio(): void;
    addVideoChunk(chunk: EncodedChunkLike): void;
    addAudioChunk(chunk: EncodedChunkLike): void;
    finalize(): Blob;
}
