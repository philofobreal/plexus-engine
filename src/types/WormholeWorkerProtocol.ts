// Typed boundary of the off-thread Wormhole renderer (ADR-009 Addendum G). The worker hosts one
// `WormholeCanvasSource` on an OffscreenCanvas; the main-thread proxy (`WormholeWorkerSource`)
// implements `CanvasVisualSource` over these messages. Plain data only.

import type { CanvasVisualPresentation, VisualAnalysisSnapshot } from './CanvasVisualSource';

/** Bumped on any incompatible message change. */
export const WORMHOLE_WORKER_PROTOCOL_VERSION = 1;

export interface WormholeWorkerInit {
    readonly type: 'init';
    readonly protocol: number;
    readonly width: number;
    readonly height: number;
    readonly depthCue: number;
}

/**
 * Starts a new preparation generation. The analysis is structured-cloned (copied, never
 * transferred): the host keeps using its immutable published snapshot.
 */
export interface WormholeWorkerPrepare {
    readonly type: 'prepare';
    readonly generation: number;
    readonly analysis: VisualAnalysisSnapshot | null;
}

/** At most one render request is in flight; the host never queues a second one. */
export interface WormholeWorkerRender {
    readonly type: 'render';
    readonly generation: number;
    readonly time: number;
    readonly playing: boolean;
}

export interface WormholeWorkerPresentation {
    readonly type: 'presentation';
    readonly presentation: CanvasVisualPresentation;
}

export interface WormholeWorkerDispose {
    readonly type: 'dispose';
}

export type WormholeWorkerRequest = WormholeWorkerInit | WormholeWorkerPrepare | WormholeWorkerRender
    | WormholeWorkerPresentation | WormholeWorkerDispose;

export interface WormholeWorkerPrepared {
    readonly type: 'prepared';
    readonly generation: number;
}

export interface WormholeWorkerPrepareError {
    readonly type: 'prepare-error';
    readonly generation: number;
    readonly message: string;
}

/** A changed frame. `bitmap` is transferred (ownership moves to the host, which consumes it once). */
export interface WormholeWorkerFrame {
    readonly type: 'frame';
    readonly generation: number;
    readonly time: number;
    readonly bitmap: ImageBitmap;
    /** The identity's focal point for exactly this frame (+x right, +y up). */
    readonly focalX: number;
    readonly focalY: number;
    /** Worker-side raster time of this frame, in milliseconds (diagnostics). */
    readonly renderMs: number;
}

/** The source had nothing new to draw (steady pause or rate cap); the request slot is free again. */
export interface WormholeWorkerUnchanged {
    readonly type: 'unchanged';
    readonly generation: number;
}

/** Unrecoverable worker failure (init/render); the host disables the background. */
export interface WormholeWorkerFailure {
    readonly type: 'failure';
    readonly message: string;
}

export type WormholeWorkerResponse = WormholeWorkerPrepared | WormholeWorkerPrepareError | WormholeWorkerFrame
    | WormholeWorkerUnchanged | WormholeWorkerFailure;
