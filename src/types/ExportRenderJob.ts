import type { VisualAnalysisSnapshot } from './CanvasVisualSource';
import type { WormholeContextSeed } from './WormholeContext';
import type { MusicDisplaySettings } from './MusicDisplay';

export interface ExportAudioSource {
    readonly sampleRate: number;
    readonly length: number;
    readonly numberOfChannels: number;
    getChannelData(channel: number): Float32Array;
}
export interface ExportRenderInput {
    readonly audioContentId: string;
    readonly analysis: VisualAnalysisSnapshot;
    readonly seed: WormholeContextSeed;
    readonly presets: Readonly<Record<string, unknown>>;
    readonly musicDisplay: MusicDisplaySettings;
    readonly skybox: boolean;
    readonly morphScale: number;
}
export interface ExportRenderSnapshot {
    readonly version: 1;
    readonly audioContentId: string;
    readonly analysisId: string;
    readonly presetIds: Readonly<Record<string, string>>;
    readonly input: ExportRenderInput;
    readonly width: number;
    readonly height: number;
    readonly fps: number;
    readonly output: Readonly<{ resolution: string; aspectRatio: string; fps: number; watermark: boolean; trackName: string }>;
    readonly estimatedBytes: number;
    readonly budgetBytes: number;
}
export interface ExportRuntime {
    readonly duration: number;
    readonly bpm: number;
    readonly audio: ExportAudioSource;
    readonly snapshot: ExportRenderSnapshot;
    readonly beatDecay: number;
    renderFrame(frameIndex: number, fps: number): Promise<HTMLCanvasElement>;
    dispose(): void;
}
export type ExportRuntimeFactory = (snapshot: ExportRenderSnapshot, audio: ExportAudioSource) => ExportRuntime;
export interface ExportPreparationReport {
    codec: string;
    width: number;
    height: number;
    fps: number;
    probeFrames: number;
    probeBytes: number;
}
export interface ExportProfile {
    readonly resources?: { audioBufferAllocations: number; audioBuffersReused: number; audioPoolLimitBytes: number;
        storage: 'unmanaged' | 'pending' | 'retained-result' | 'removed' | 'cleanup-pending' };
    readonly preflight?: ExportPreparationReport;
    readonly runtime: 'isolated-wormhole';
    readonly analysisId: string;
    readonly estimatedBytes: number;
    readonly budgetBytes: number;
    readonly stagesMs: Readonly<Record<string, number>>;
    readonly framesSubmitted: number;
    readonly outcome: 'completed' | 'cancelled' | 'failed';
    readonly scope: string;
}
