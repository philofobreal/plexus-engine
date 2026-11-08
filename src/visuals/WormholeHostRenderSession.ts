import type { WormholeHostAnalysis, WormholeHostFrame } from '../types/WormholeHostFrame';
import type { GrainLineFrame } from '../types/GrainLineFrame';
import { CosmicWormholeIdentity, type WormholeRenderState } from './CosmicWormholeIdentity';
import { Canvas2DRendererBackend } from './Canvas2DRendererBackend';
import { WebGLRendererBackend } from './WebGLRendererBackend';
import { GrainCarrierCollector } from './GrainCarrierCollector';
import { WormholeGpuRaster } from './gpu/WormholeGpuRaster';
import { featureFlags } from '../config/featureFlags';

const surface = (w: number, h: number) => new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;

/** Resolved-input session. No host globals, tuning resolution, director or second song clock.
 * Owns identity history and every surface. The worker adapter owns messaging and bitmap leases.
 */
export class WormholeHostRenderSession {
    private state: WormholeRenderState | null = null;
    private identity: CosmicWormholeIdentity | null = null;
    private backend: Canvas2DRendererBackend | WebGLRendererBackend | null = null;
    private overlay: Canvas2DRendererBackend | null = null;
    private gpu: WormholeGpuRaster | null = null;
    private readonly collector = new GrainCarrierCollector();
    private readonly noLines: { -readonly [K in keyof GrainLineFrame]: GrainLineFrame[K] } = { width: 1, height: 1, count: 0, square: false, data: new Float32Array(0) };
    private gpuFailed = false;
    private resetPending = true;
    private disposed = false;
    private exactOutput: OffscreenCanvas | null = null;
    private exactRaster: 'gpu-material' | 'canvas2d' | null = null;
    private exactHasFrame = false;
    private exactError: Error | null = null;
    private readonly analysis: WormholeHostAnalysis;
    private readonly gpuMaterial: boolean;
    constructor(analysis: WormholeHostAnalysis, gpuMaterial = true) { this.analysis = analysis; this.gpuMaterial = gpuMaterial; }
    reset(): void { this.resetPending = true; this.exactRaster = null; }

    render(frame: WormholeHostFrame, exact = false): { bitmap: ImageBitmap; raster: 'gpu-material' | 'webgl' | 'canvas2d' } {
        if (this.disposed) throw Error('Wormhole session disposed');
        if (exact && this.exactError) throw this.exactError;
        this.exactRaster = null;
        if (![frame.width, frame.height, frame.density].every(n => Number.isFinite(n) && n > 0)
            || frame.width > 16384 || frame.height > 16384 || frame.density > 4
            || Math.round(frame.width * frame.density) * Math.round(frame.height * frame.density) > 3840 * 2160)
            throw Error('Invalid Wormhole preview surface');
        if (!this.state) this.state = { ...this.analysis, ...frame };
        else Object.assign(this.state, frame);
        this.identity ??= new CosmicWormholeIdentity(this.state);
        if (!this.backend) {
            if (this.gpuMaterial && !this.gpuFailed) {
                // Actual shader/FBO/draw probe, not an extension-name-only capability claim.
                try {
                    this.backend = new Canvas2DRendererBackend(1, 1, surface);
                    this.gpu = new WormholeGpuRaster(new OffscreenCanvas(1, 1), exact ? 'float32' : 'float16');
                    this.gpu.render(1, 1, null, { cols: 1, rows: 1, amount: 0, bloom: 0, detail: 0,
                        count: 0, data: new Float32Array(0) }, this.noLines, this.backend.canvas as unknown as OffscreenCanvas);
                } catch { this.gpu?.dispose(); this.gpu = null; this.backend = null; this.gpuFailed = true; }
            }
            if (!this.backend) {
                if (exact) this.backend = new Canvas2DRendererBackend(frame.width, frame.height, surface);
                else {
                    try { this.backend = new WebGLRendererBackend(frame.width, frame.height, surface); }
                    catch { this.backend = new Canvas2DRendererBackend(frame.width, frame.height, surface); }
                }
            }
        }
        const backend = this.backend;
        if (backend instanceof WebGLRendererBackend) {
            if (backend.contextLost) throw Error('Worker WebGL context lost');
            backend.setSize(frame.width, frame.height, frame.density);
            backend.compactMaterialPreview = frame.compact; backend.transparentBackground = frame.transparent;
        } else backend.setPreviewSize(frame.width, frame.height, frame.density, frame.compact, frame.transparent);
        backend.frameCount = frame.frameCount;
        featureFlags.wormholeSkybox = frame.skybox;
        this.identity.setDepthCue(frame.depthCue); this.identity.setMusicDisplay?.(frame.musicDisplay);
        this.collector.reset(); this.identity.setMaterialSink?.(this.gpu ? this.collector : null);
        if (this.gpu && frame.musicDisplay?.mode === 'spectrum') {
            this.overlay ??= new Canvas2DRendererBackend(1, 1, surface);
            this.overlay.setPreviewSize(frame.width, frame.height, frame.density, frame.compact, true);
            this.overlay.background(0, 0, 0);
            this.identity.setMusicDisplayBackend(this.overlay);
        } else this.identity.setMusicDisplayBackend?.(null);
        if (frame.reset || this.resetPending) this.identity.syncPosition(frame.currentTime);
        this.resetPending = false;
        this.identity.draw(backend, [], []);
        if (this.gpu) {
            try {
                const w = backend.canvas.width, h = backend.canvas.height;
                this.noLines.width = w; this.noLines.height = h;
                if (exact) {
                    this.gpu.compositeExactMaterial(this.collector.frame,backend.canvas as unknown as OffscreenCanvas);
                    if(frame.musicDisplay?.mode==='spectrum'){
                        const ctx=backend.canvas.getContext('2d')!;ctx.save();
                        try{ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(this.overlay!.canvas,0,0);}
                        finally{ctx.restore();}
                    }
                    this.exactRaster='gpu-material';this.exactHasFrame=true;return this.repeat();
                }
                this.gpu.render(w, h, null, this.collector.frame, this.noLines,
                    backend.canvas as unknown as OffscreenCanvas,
                    frame.musicDisplay?.mode === 'spectrum' ? this.overlay!.canvas as unknown as OffscreenCanvas : undefined);
                return { bitmap: (this.gpu.canvas as OffscreenCanvas).transferToImageBitmap(), raster: 'gpu-material' };
            } catch {
                // Release every GPU target. Re-enter the compatible worker path at an explicit
                // seek anchor; never silently display a base image with its material missing.
                this.gpu.dispose(); this.gpu = null; this.gpuFailed = true;
                if(exact && this.exactHasFrame){
                    this.exactError=Error('Exact GPU rendering failed; retry as a new compatible job');
                    throw this.exactError;
                }
                this.identity.setMaterialSink(null); this.identity.setMusicDisplayBackend(null);
                this.identity.syncPosition(frame.currentTime); this.identity.draw(backend, [], []);
            }
        }
        if (backend instanceof WebGLRendererBackend) backend.finish();
        if (exact) {
            if (backend instanceof WebGLRendererBackend) throw Error('Exact session must use a fresh resolved-frame context');
            this.exactRaster='canvas2d';this.exactHasFrame=true;return this.repeat();
        }
        return { bitmap: (backend.canvas as unknown as OffscreenCanvas).transferToImageBitmap(),
            raster: backend instanceof WebGLRendererBackend ? 'webgl' : 'canvas2d' };
    }
    /** Replay the completed image, without advancing identity/material state again. */
    repeat(): { bitmap: ImageBitmap; raster: 'gpu-material' | 'canvas2d' } {
        if(this.disposed || this.exactError || !this.exactRaster)throw Error('Exact frame unavailable');
        const canvas=this.backend!.canvas;
        this.exactOutput ??= new OffscreenCanvas(canvas.width,canvas.height);
        if(this.exactOutput.width!==canvas.width || this.exactOutput.height!==canvas.height){this.exactOutput.width=canvas.width;this.exactOutput.height=canvas.height;}
        const ctx=this.exactOutput.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(canvas,0,0);
        return {bitmap:this.exactOutput.transferToImageBitmap(),raster:this.exactRaster};
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.gpu?.dispose(); this.gpu = null;
        if (this.backend instanceof WebGLRendererBackend) this.backend.dispose();
        for (const b of [this.backend, this.overlay]) if (b) b.canvas.width = b.canvas.height = 1;
        if(this.exactOutput)this.exactOutput.width=this.exactOutput.height=1;this.exactOutput=null;this.exactRaster=null;
        this.backend = null; this.overlay = null; this.identity = null; this.state = null;
    }
}
