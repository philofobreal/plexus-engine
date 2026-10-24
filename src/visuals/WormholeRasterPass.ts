import type { VisualIdentity, VisualIdentityDrawContext } from './VisualIdentity';
import type { VisualRendererBackend } from './RendererBackend';
import type { Particle } from './Particle';
import type { Shockwave } from './Shockwave';
import { P5RendererBackend } from './P5RendererBackend';
import { WebGLRendererBackend } from './WebGLRendererBackend';
import type { Canvas2DSurfaceFactory } from './Canvas2DRendererBackend';

/** Renderer-owned GPU presentation of an already resolved host frame. Never advances another simulation. */
export class WormholeRasterPass {
    private backend: WebGLRendererBackend | null = null;
    private failed = false;
    private readonly lost = (event: Event) => { event.preventDefault(); this.failed = true; this.invalidate(); };
    private disposed = false;
    private kind: 'compatible' | 'webgl' | 'fallback' = 'compatible';
    get rasterKind() { return this.kind; }

    private readonly invalidate: () => void;
    private readonly createSurface: Canvas2DSurfaceFactory;
    constructor(invalidate: () => void = () => {},
        createSurface: Canvas2DSurfaceFactory = (width, height) => Object.assign(document.createElement('canvas'), { width, height })) {
        this.invalidate = invalidate; this.createSurface = createSurface;
    }

    draw(identity: VisualIdentity, destination: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[],
        context: VisualIdentityDrawContext | undefined, mode: 'compatible' | 'webgl', transparentBackground: boolean): void {
        if (this.disposed) return;
        if (mode !== 'webgl') { this.release(); this.failed = false; this.kind = 'compatible'; }
        if (identity.id !== 'cosmic-wormhole' || mode !== 'webgl' || !(destination instanceof P5RendererBackend)) {
            identity.draw(destination, particles, shockwaves, context); return;
        }
        if (!this.backend && !this.failed) {
            let canvas: HTMLCanvasElement | null = null;
            try {
                this.backend = new WebGLRendererBackend(destination.width, destination.height,
                    (w, h) => (canvas = this.createSurface(w, h)));
                this.backend.canvas.addEventListener?.('webglcontextlost', this.lost);
            } catch {
                this.failed = true;
                // A shader/link failure may occur after context creation, before a backend can be returned.
                (canvas as HTMLCanvasElement | null)?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
            }
        }
        if (this.backend?.contextLost) this.failed = true;
        if (this.failed || !this.backend) {
            this.release(); this.kind = 'fallback'; identity.draw(destination, particles, shockwaves, context); return;
        }
        const backend = this.backend;
        backend.setSize(destination.width, destination.height, destination.rasterPixelRatio);
        backend.frameCount = destination.frameCount;
        backend.compactMaterialPreview = destination.compactMaterialPreview;
        backend.transparentBackground = transparentBackground;
        identity.draw(backend, particles, shockwaves, context);
        backend.finish();
        destination.presentRaster(backend.canvas);
        this.kind = 'webgl';
    }

    private release(): void {
        const backend = this.backend; this.backend = null;
        if (!backend) return;
        backend.canvas.removeEventListener?.('webglcontextlost', this.lost);
        backend.dispose(); backend.canvas.width = backend.canvas.height = 1;
    }
    /** An off-thread host takes over; keep no unused main-thread GPU surface. */
    suspend(): void { this.release(); this.kind = 'compatible'; }
    dispose(): void { this.disposed = true; this.release(); }
}
