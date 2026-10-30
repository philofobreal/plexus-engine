import type { ExportAudioSource, ExportRenderSnapshot, ExportRuntime } from '../types/ExportRenderJob';
import { WormholeCanvasSource } from './WormholeCanvasSource';
import { PostFxPipeline } from './PostFxPipeline';
import { CanvasPostFxSurface } from './CanvasPostFxSurface';
import { TemporalFragmentationEffect } from './TemporalFragmentationEffect';

/** Composition-created private renderer. No p5, AudioEngine, State mutation or preset IO. */
export class WormholeExportRuntime implements ExportRuntime {
    readonly snapshot: ExportRenderSnapshot;
    readonly audio: ExportAudioSource;
    private source: WormholeCanvasSource | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private context: CanvasRenderingContext2D | null = null;
    private post: PostFxPipeline | null = null;
    readonly duration: number;
    readonly bpm: number;
    get beatDecay(): number { return this.source?.exportState.beatDecay ?? 0; }

    constructor(snapshot: ExportRenderSnapshot, audio: ExportAudioSource) {
        this.snapshot = snapshot; this.audio = audio;
        this.duration = snapshot.input.analysis.duration; this.bpm = snapshot.input.analysis.bpm;
        try {
            this.canvas = Object.assign(document.createElement('canvas'), { width: snapshot.width, height: snapshot.height });
            this.context = this.canvas.getContext('2d');
            if (!this.context) throw new Error('Isolated export requires a Canvas2D output surface.');
            this.source = new WormholeCanvasSource({ contextSeed: snapshot.input.seed, width: snapshot.width, height: snapshot.height,
                depthCue: .6, skybox: snapshot.input.skybox });
            this.source.setPresentation({ musicDisplay: snapshot.input.musicDisplay });
            this.source.prepareExport(snapshot.input.analysis, new Map(Object.entries(snapshot.input.presets)));
            const owner = this;
            const view = { get visualTuning() { return owner.source!.exportState.visualTuning; },
                get directorOutput() { return owner.source!.exportState.directorOutput; },
                get modulation() { return owner.source!.exportState.modulation; }, isExporting: true, isPlaying: false };
            const state = () => view;
            this.post = new PostFxPipeline([new TemporalFragmentationEffect(state)], new CanvasPostFxSurface(), state);
        } catch (error) { this.dispose(); throw error; }
    }

    async renderFrame(frameIndex: number, fps: number): Promise<HTMLCanvasElement> {
        if (!this.source || !this.canvas || !this.context || !this.post) throw new Error('Isolated export renderer disposed.');
        if (fps !== this.snapshot.fps) throw new Error('Export frame clock differs from its snapshot.');
        this.source.renderExportFrame(frameIndex, fps);
        this.context.globalCompositeOperation = 'copy';
        this.context.drawImage(this.source.canvas, 0, 0);
        this.context.globalCompositeOperation = 'source-over';
        this.post.render({ drawingContext: this.context }, frameIndex / fps);
        return this.canvas;
    }

    dispose(): void {
        this.source?.dispose(); this.source = null; this.post?.dispose?.(); this.post = null; this.context = null;
        if (this.canvas) this.canvas.width = this.canvas.height = 1;
        this.canvas = null;
    }
}
