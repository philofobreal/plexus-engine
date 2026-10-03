// Thin worker adapter around `WormholeCanvasSource` (ADR-009 Addendum G): the same identity,
// tuning and plan consumption as the in-thread source, rasterized on an OffscreenCanvas so the
// headset's main-thread frame loop never waits for Canvas2D. Owns only message destructuring,
// generation filtering, frame transfer and error formatting.

import type { WormholeWorkerRequest, WormholeWorkerResponse } from '../types/WormholeWorkerProtocol';
import { WORMHOLE_WORKER_PROTOCOL_VERSION } from '../types/WormholeWorkerProtocol';
import { WormholeCanvasSource } from './WormholeCanvasSource';

interface WorkerScope {
    onmessage: ((event: MessageEvent<WormholeWorkerRequest>) => void) | null;
    postMessage(message: WormholeWorkerResponse, transfer?: Transferable[]): void;
    close(): void;
}

const scope = self as unknown as WorkerScope;
let source: WormholeCanvasSource | null = null;
let generation = 0;

function post(message: WormholeWorkerResponse, transfer?: Transferable[]): void {
    scope.postMessage(message, transfer ?? []);
}

/** Works for any thrown shape, including DOMException and errors from another realm. */
function errorMessage(error: unknown): string {
    const message = typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : undefined;
    return typeof message === 'string' && message ? message : String(error);
}

/** OffscreenCanvas implements every canvas member the Canvas2D backend and field raster use. */
const offscreenSurface = (width: number, height: number) => new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;

scope.onmessage = event => {
    const message = event.data;
    try {
        switch (message.type) {
            case 'init':
                if (message.protocol !== WORMHOLE_WORKER_PROTOCOL_VERSION) throw new Error(`Unsupported Wormhole worker protocol ${message.protocol}`);
                source?.dispose();
                source = new WormholeCanvasSource({ width: message.width, height: message.height, depthCue: message.depthCue,
                    createSurface: offscreenSurface });
                break;
            case 'prepare': {
                if (!source) throw new Error('Wormhole worker used before init.');
                const requested = generation = message.generation;
                source.prepare(message.analysis).then(
                    () => { if (requested === generation) post({ type: 'prepared', generation: requested }); },
                    error => { if (requested === generation) post({ type: 'prepare-error', generation: requested, message: errorMessage(error) }); });
                break;
            }
            case 'presentation':
                source?.setPresentation(message.presentation);
                break;
            case 'render':
            case 'keyframe': {
                if (!source || message.generation !== generation) { post({ type: 'unchanged', generation: message.generation }); break; }
                const started = performance.now();
                // A keyframe always draws its exact time; a render may be skipped by the redraw cap.
                const drawn = message.type === 'keyframe' ? source.requestFrame(message.time, message.playing) && !!source.takeFrame()
                    : source.render(message.time, message.playing);
                if (!drawn) { post({ type: 'unchanged', generation: message.generation }); break; }
                const bitmap = (source.canvas as unknown as OffscreenCanvas).transferToImageBitmap();
                const focus = source.focalPoint;
                post({ type: 'frame', generation: message.generation, time: message.time, bitmap, focalX: focus.x, focalY: focus.y,
                    travel: source.travel, renderMs: performance.now() - started }, [bitmap]);
                break;
            }
            case 'dispose':
                source?.dispose();
                source = null;
                scope.close();
                break;
        }
    } catch (error) {
        post({ type: 'failure', message: errorMessage(error) });
    }
};
