// Typed boundary of the off-thread Wormhole renderer (ADR-009 Addendum G). The worker hosts one
// `WormholeCanvasSource` on an OffscreenCanvas; the main-thread proxy (`WormholeWorkerSource`)
// implements `CanvasVisualSource` over these messages. Plain data only.

import type { CanvasVisualPresentation, VisualAnalysisSnapshot } from './CanvasVisualSource';
import type { GrainMaterialFrame } from './GrainMaterialFrame';
import type { GrainLineFrame } from './GrainLineFrame';
import type { PerformanceAutomationPlan } from './index';

/** Bumped on any incompatible message change. */
export const WORMHOLE_WORKER_PROTOCOL_VERSION = 1;

export interface WormholeWorkerInit {
    readonly type: 'init';
    readonly protocol: number;
    readonly width: number;
    readonly height: number;
    readonly depthCue: number;
    /** Opt-in stage timing (`?xrDiagnostics=1`); frames then carry `stages`. */
    readonly profile?: boolean;
    /** Host-rendered grain material (ADR-009 Addendum W); frames then carry `material`. */
    readonly externalMaterial?: boolean;
    /** With `externalMaterial`: grain trail strokes as a line list (ADR-009 Addendum AA); frames then carry `lines`. Additive. */
    readonly externalLines?: boolean;
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

/**
 * Starts a new preparation generation from the analysis of the worker's last `prepare` with a new
 * performance plan. The host sends it only when everything but the plan is identical to what it
 * last sent in full (a regenerated plan), so only the plan is cloned instead of the per-hop
 * analysis. A worker without a prior analysis answers `prepare-error`. Additive (protocol version 1).
 */
export interface WormholeWorkerPreparePlan {
    readonly type: 'prepare-plan';
    readonly generation: number;
    readonly performancePlan: PerformanceAutomationPlan;
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

/**
 * Returns a frame's carrier buffer (`WormholeWorkerFrame.material.data.buffer`) to the worker's
 * bounded pool once the host no longer reads it; transferred back, never copied. Optional: a host
 * that never returns buffers only makes the worker allocate (additive, protocol version 1).
 */
export interface WormholeWorkerReleaseMaterial {
    readonly type: 'release-material';
    readonly buffer: ArrayBuffer;
}

export type WormholeWorkerRequest = WormholeWorkerInit | WormholeWorkerPrepare | WormholeWorkerPreparePlan | WormholeWorkerRender
    | WormholeWorkerPresentation | WormholeWorkerDispose | WormholeWorkerReleaseMaterial;

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
    /** Opt-in stage times in ms (profiling workers only): the source's stages plus `transfer`. */
    readonly stages?: Readonly<Record<string, number>>;
    /**
     * External material only: this frame's grain material as packed carriers. `data` views exactly
     * `count` records at the start of a pooled buffer that may be larger; the buffer is transferred
     * with the bitmap and belongs to the host until it sends it back (`release-material`).
     */
    readonly material?: GrainMaterialFrame;
    /**
     * External lines only, and only with `material`: the frame's grain trail strokes. `data` views
     * exactly `count` lines in the same pooled buffer, right after the carriers, so it is
     * transferred and returned with them (ADR-009 Addendum AA).
     */
    readonly lines?: GrainLineFrame;
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
