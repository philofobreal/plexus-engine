import type { WormholeHostAnalysis, WormholeHostRequest, WormholeHostResponse } from '../types/WormholeHostFrame';
import { CosmicWormholeIdentity, type WormholeRenderState } from './CosmicWormholeIdentity';
import { Canvas2DRendererBackend } from './Canvas2DRendererBackend';
import { WebGLRendererBackend } from './WebGLRendererBackend';
import { featureFlags } from '../config/featureFlags';

const scope = self as unknown as {
    onmessage: ((event: MessageEvent<WormholeHostRequest>) => void) | null;
    postMessage(message: WormholeHostResponse, transfer?: Transferable[]): void;
};
let analysis: WormholeHostAnalysis | null = null, state: WormholeRenderState | null = null;
let identity: CosmicWormholeIdentity | null = null, generation = 0;
let backend: WebGLRendererBackend | Canvas2DRendererBackend | null = null;
const createSurface = (w: number, h: number) => new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;
scope.onmessage = event => {
    const message = event.data;
    try {
        if (message.type === 'prepare' || message.type === 'reset') {
            generation = message.generation;
            if (message.type === 'prepare') { analysis = message.analysis; state = null; identity = null; }
            scope.postMessage({ type: 'ready', generation }); return;
        }
        if (message.generation !== generation || !analysis) return;
        const frame = message.frame;
        if (!state) state = { ...analysis, ...frame };
        else Object.assign(state, frame);
        identity ??= new CosmicWormholeIdentity(state);
        if (!backend) {
            try { backend = new WebGLRendererBackend(frame.width, frame.height, createSurface); }
            catch { backend = new Canvas2DRendererBackend(frame.width, frame.height, createSurface); }
        }
        if (backend instanceof WebGLRendererBackend && backend.contextLost) throw Error('Worker WebGL context lost');
        const started = performance.now();
        if (backend instanceof WebGLRendererBackend) {
            backend.setSize(frame.width, frame.height, frame.density);
            backend.compactMaterialPreview = frame.compact; backend.transparentBackground = frame.transparent;
        } else {
            // Same logical coordinates/material budget as the host; scale only the backing raster.
            backend.setPreviewSize(frame.width, frame.height, frame.density, frame.compact, frame.transparent);
        }
        backend.frameCount = frame.frameCount;
        featureFlags.wormholeSkybox = frame.skybox;
        identity.setDepthCue(frame.depthCue);
        if (frame.reset) identity.syncPosition(frame.currentTime);
        identity.draw(backend, [], []);
        if (backend instanceof WebGLRendererBackend) backend.finish();
        const bitmap = (backend.canvas as unknown as OffscreenCanvas).transferToImageBitmap();
        scope.postMessage({ type: 'frame', generation, serial: message.serial, bitmap,
            raster: backend instanceof WebGLRendererBackend ? 'webgl' : 'canvas2d', renderMs: performance.now() - started }, [bitmap]);
    } catch (error) {
        backend instanceof WebGLRendererBackend && backend.dispose(); backend = null;
        scope.postMessage({ type: 'failure', message: error instanceof Error ? error.message : String(error) });
    }
};
