// Thin worker adapter around `WormholeCanvasSource` (ADR-009 Addendum G): the same identity,
// tuning and plan consumption as the in-thread source, rasterized on an OffscreenCanvas so the
// headset's main-thread frame loop never waits for Canvas2D. Owns only message destructuring,
// generation filtering, frame transfer and error formatting.
//
// Carrier buffers (external material) cycle through a small pool instead of being allocated per
// frame: a pooled buffer is filled and transferred with its frame (the host owns it), and the host
// transfers it back (`release-material`) once it has copied the carriers. A buffer is therefore
// in exactly one place -- this pool, the host, or in transit -- and is written only while pooled
// here. The pool never holds more than `MATERIAL_POOL_LIMIT` buffers.
//
// The analysis of the last `prepare` is kept, so a regenerated plan (`prepare-plan`) crosses the
// boundary alone instead of re-cloning the per-hop analysis.

import type { VisualAnalysisSnapshot } from '../types/CanvasVisualSource';
import type { WormholeWorkerRequest, WormholeWorkerResponse } from '../types/WormholeWorkerProtocol';
import { GRAIN_CARRIER_STRIDE, type GrainMaterialFrame } from '../types/GrainMaterialFrame';
import { GRAIN_LINE_STRIDE, type GrainLineFrame } from '../types/GrainLineFrame';
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
/** The worker's copy of the last `prepare` analysis (`prepare-plan` swaps only its plan). */
let analysis: VisualAnalysisSnapshot | null = null;
/** Buffers returned by the host (frame shown + frame pending + one in flight is the steady state). */
const MATERIAL_POOL_LIMIT = 3;
const materialPool: ArrayBuffer[] = [];

/** A view of exactly `floats` values on a pooled buffer, or on a new one with headroom when none fits. */
function takeMaterialView(floats: number): Float32Array {
    const bytes = floats * Float32Array.BYTES_PER_ELEMENT;
    for (let i = 0; i < materialPool.length; i++) {
        const buffer = materialPool[i];
        if (buffer.byteLength < bytes) continue;
        materialPool[i] = materialPool[materialPool.length - 1];
        materialPool.pop();
        return new Float32Array(buffer, 0, floats);
    }
    // Headroom absorbs frame-to-frame carrier count changes without reallocating.
    const capacity = Math.ceil(floats * 1.25 / GRAIN_CARRIER_STRIDE) * GRAIN_CARRIER_STRIDE;
    return new Float32Array(new ArrayBuffer(capacity * Float32Array.BYTES_PER_ELEMENT), 0, floats);
}

/** Keeps a returned buffer (bounded: a full pool keeps its largest buffers). */
function returnMaterialBuffer(buffer: ArrayBuffer): void {
    if (!buffer || !(buffer.byteLength > 0)) return;
    if (materialPool.length < MATERIAL_POOL_LIMIT) { materialPool.push(buffer); return; }
    let smallest = 0;
    for (let i = 1; i < materialPool.length; i++) if (materialPool[i].byteLength < materialPool[smallest].byteLength) smallest = i;
    if (materialPool[smallest].byteLength < buffer.byteLength) materialPool[smallest] = buffer;
}

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
                    createSurface: offscreenSurface, profile: message.profile === true, externalMaterial: message.externalMaterial === true,
                    externalLines: message.externalLines === true });
                break;
            case 'prepare':
            case 'prepare-plan': {
                if (!source) throw new Error('Wormhole worker used before init.');
                const requested = generation = message.generation;
                let prepared: Promise<void>;
                if (message.type === 'prepare') prepared = source.prepare(analysis = message.analysis);
                else if (!analysis) prepared = Promise.reject(new Error('Wormhole plan update without a prepared analysis.'));
                // The kept copy is reused unchanged (the source never mutates it); only the plan is new.
                else prepared = source.prepare(analysis = { ...analysis, performancePlan: message.performancePlan });
                prepared.then(
                    () => { if (requested === generation) post({ type: 'prepared', generation: requested }); },
                    error => { if (requested === generation) post({ type: 'prepare-error', generation: requested, message: errorMessage(error) }); });
                break;
            }
            case 'presentation':
                source?.setPresentation(message.presentation);
                break;
            case 'render': {
                if (!source || message.generation !== generation) { post({ type: 'unchanged', generation: message.generation }); break; }
                const started = performance.now();
                if (!source.render(message.time, message.playing, message.continuous === true)) { post({ type: 'unchanged', generation: message.generation }); break; }
                const transferStarted = performance.now();
                // Canvas2D may defer raster work until the bitmap is taken, so its time is a stage too.
                const bitmap = (source.canvas as unknown as OffscreenCanvas).transferToImageBitmap();
                const focus = source.focalPoint;
                // The carriers (and external trail lines, right after them) travel with their frame in one
                // pooled buffer (transferred; the host returns it).
                const collected = source.materialFrame, strokes = collected ? source.lineFrame : null;
                let material: GrainMaterialFrame | undefined;
                let lines: GrainLineFrame | undefined;
                if (collected) {
                    const floats = collected.count * GRAIN_CARRIER_STRIDE, lineFloats = strokes ? strokes.count * GRAIN_LINE_STRIDE : 0;
                    const pooled = takeMaterialView(floats + lineFloats);
                    const data = pooled.subarray(0, floats);
                    data.set(collected.data.subarray(0, floats));
                    material = { ...collected, data };
                    if (strokes) {
                        const lineData = pooled.subarray(floats, floats + lineFloats);
                        lineData.set(strokes.data.subarray(0, lineFloats));
                        lines = { ...strokes, data: lineData };
                    }
                }
                const stages = source.stageTimes ? { ...source.stageTimes, transfer: performance.now() - transferStarted } : undefined;
                post({ type: 'frame', generation: message.generation, time: message.time, bitmap, focalX: focus.x, focalY: focus.y,
                    renderMs: performance.now() - started, ...(stages ? { stages } : {}), ...(material ? { material } : {}), ...(lines ? { lines } : {}) },
                    material ? [bitmap, material.data.buffer] : [bitmap]);
                break;
            }
            case 'release-material':
                returnMaterialBuffer(message.buffer);
                break;
            case 'dispose':
                source?.dispose();
                source = null;
                analysis = null;
                materialPool.length = 0;
                scope.close();
                break;
        }
    } catch (error) {
        post({ type: 'failure', message: errorMessage(error) });
    }
};
