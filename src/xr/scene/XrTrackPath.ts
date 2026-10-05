// The single XR track-path projection authority (ADR-009). Canonical gameplay positions stay
// renderer-independent (`notePosition`); this XR-owned shear bends them toward the Wormhole's
// authoritative focal point. Rendering (notes, floor, rails) projects through it, and XR hit testing
// un-projects strike samples through it, so rendered and judged targets can never diverge.
//
// The shear is purely lateral/vertical and a function of forward distance only, so z extents (road
// length) are preserved and the inverse is exact. Near the player (closer than
// `trackBendStartMeters`) the offset is exactly zero: the hit plane, lanes and rows never move.
// Nothing here integrates over time; the path is a pure function of the current focal point.
//
// Static stage geometry (floor, rails) bends on the GPU: `TRACK_BEND_GLSL` is the vertex-shader
// twin of `trackBendWeight` / `trackPathOffset`, operation for operation, fed only by the
// `uTrackBend` uniform this module writes. A path change is then a four-float uniform update, never
// a vertex upload. CPU projection, strike un-projection and the GLSL twin share this one parameter
// authority; nothing else may carry its own curve.

import type * as THREE from 'three';
import { DEFAULT_STAGE_LAYOUT, SCENE_CONFIG, type XrStageLayout } from './SceneConfig';

export interface MutableVector3Like { x: number; y: number; z: number }
export interface TrackPathOffset { x: number; y: number }
export interface MutableVector4Like { x: number; y: number; z: number; w: number }

const BEND_START = SCENE_CONFIG.trackBendStartMeters;
/** Historical far end (the default stage); a longer runway moves it (Addendum I). */
const DEFAULT_BEND_END = -DEFAULT_STAGE_LAYOUT.runwayFrontZMeters;
/**
 * The curve offset(u) = A * u^2 has zero slope at the bend start and slope 2A/L at the far end.
 * Choosing A = F / (1 + 2 (D - end) / L) makes that far-end tangent aim exactly at the focal point
 * F on the backdrop at distance D, before saturation.
 */
function aimGain(bendEnd: number): number {
    return 1 / (1 + 2 * (SCENE_CONFIG.backdropDistanceMeters - bendEnd) / (bendEnd - BEND_START));
}

function finiteOrZero(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

/** Far-end displacement for a normalized focal coordinate; smoothly saturates at `maxBend`. */
export function trackBendAmplitude(focus: number, backdropHalfExtentMeters: number, maxBendMeters: number,
    bendEndMeters: number = DEFAULT_BEND_END): number {
    const raw = finiteOrZero(focus) * backdropHalfExtentMeters * aimGain(bendEndMeters);
    return maxBendMeters > 0 ? maxBendMeters * Math.tanh(raw / maxBendMeters) : 0;
}

/** Bend weight in [0, 1] for a stage-root z: 0 near the player, u^2 toward the far end. */
export function trackBendWeight(rootZ: number, bendEndMeters: number = DEFAULT_BEND_END): number {
    const u = Math.min(1, Math.max(0, (-rootZ - BEND_START) / (bendEndMeters - BEND_START)));
    return u * u;
}

/** Pure offset of a stage-root point at `rootZ` for the given far-end amplitudes. */
export function trackPathOffset(rootZ: number, amplitudeX: number, amplitudeY: number, out: TrackPathOffset,
    bendEndMeters: number = DEFAULT_BEND_END): TrackPathOffset {
    const weight = trackBendWeight(rootZ, bendEndMeters);
    out.x = amplitudeX * weight;
    out.y = amplitudeY * weight;
    return out;
}

/**
 * `uTrackBend` = (far-end amplitude x, far-end amplitude y, bend start, bend end), in meters; the
 * only input of `TRACK_BEND_GLSL`. Zero amplitudes are the exact straight track.
 */
export function writeTrackBendUniform(out: MutableVector4Like, amplitudeX = 0, amplitudeY = 0,
    bendEndMeters: number = DEFAULT_BEND_END): MutableVector4Like {
    out.x = amplitudeX; out.y = amplitudeY; out.z = BEND_START; out.w = bendEndMeters;
    return out;
}

/**
 * GLSL twin of `trackBendWeight` + `trackPathOffset` for a stage-root z. The straight zone clamps
 * `u` to exactly 0, so near vertices receive an exact zero offset (the hit plane never moves).
 */
export const TRACK_BEND_GLSL = /* glsl */ `
uniform vec4 uTrackBend;
vec2 xrTrackPathOffset( float rootZ ) {
    float u = clamp( ( -rootZ - uTrackBend.z ) / ( uTrackBend.w - uTrackBend.z ), 0.0, 1.0 );
    return uTrackBend.xy * ( u * u );
}`;

/** The vertex statement a stage-root mesh adds after `begin_vertex` (object space = stage-root space). */
export const TRACK_BEND_VERTEX_STATEMENT = 'transformed.xy += xrTrackPathOffset( transformed.z );';

/**
 * Bends a built-in material's vertices along the track on the GPU. For meshes whose object space is
 * the stage root (identity transform under it). `uniform` is shared live: writing it re-bends
 * every material it was installed on, with no recompilation and no buffer upload.
 */
export function installTrackBend(material: THREE.Material, uniform: { value: MutableVector4Like }, cacheKey: string): void {
    material.onBeforeCompile = shader => {
        shader.uniforms.uTrackBend = uniform;
        if (!shader.vertexShader.includes('#include <begin_vertex>')) throw new Error('Track bend: vertex shader has no begin_vertex chunk.');
        shader.vertexShader = `${TRACK_BEND_GLSL}\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', `#include <begin_vertex>\n\t${TRACK_BEND_VERTEX_STATEMENT}`);
    };
    material.customProgramCacheKey = () => cacheKey;
}

export class XrTrackPath {
    /** Increments whenever the projection changes, so dependents re-project only then. */
    revision = 0;
    private focusXValue = 0;
    private focusYValue = 0;
    private amplitudeXValue = 0;
    private amplitudeYValue = 0;
    private readonly scratch: TrackPathOffset = { x: 0, y: 0 };
    private layout: XrStageLayout = DEFAULT_STAGE_LAYOUT;
    private bendEnd = DEFAULT_BEND_END;

    get focusX(): number { return this.focusXValue; }
    get focusY(): number { return this.focusYValue; }
    get amplitudeX(): number { return this.amplitudeXValue; }
    get amplitudeY(): number { return this.amplitudeYValue; }

    /** Applies a normalized focal point (+x right, +y up). Returns true only when the path changed. */
    setFocus(x: number, y: number): boolean {
        const fx = finiteOrZero(x), fy = finiteOrZero(y);
        if (fx === this.focusXValue && fy === this.focusYValue) return false;
        this.focusXValue = fx; this.focusYValue = fy;
        this.recompute();
        return true;
    }

    /** New stage (hit-plane distance, runway length): the far tangent re-aims at the same focal point. */
    setLayout(layout: XrStageLayout): void {
        if (layout.playfieldForwardMeters === this.layout.playfieldForwardMeters
            && layout.runwayFrontZMeters === this.layout.runwayFrontZMeters) { this.layout = layout; return; }
        this.layout = layout;
        this.bendEnd = Math.max(BEND_START + 1, -layout.runwayFrontZMeters);
        this.recompute();
    }

    /** Far end of the bend zone (meters ahead of the player; follows the runway length). */
    get bendEndMeters(): number { return this.bendEnd; }

    /** Hit-plane distance: a playfield z maps to stage-root z `z - playfieldForwardMeters` (GPU projection of playfield points). */
    get playfieldForwardMeters(): number { return this.layout.playfieldForwardMeters; }

    /** Current projection as `TRACK_BEND_GLSL`'s `uTrackBend` (no allocation). */
    writeBendUniform(out: MutableVector4Like): MutableVector4Like {
        return writeTrackBendUniform(out, this.amplitudeXValue, this.amplitudeYValue, this.bendEnd);
    }

    /** Offset for a stage-root z (floor/rails live in root space). */
    offsetAtRootZ(rootZ: number, out: TrackPathOffset): TrackPathOffset {
        return trackPathOffset(rootZ, this.amplitudeXValue, this.amplitudeYValue, out, this.bendEnd);
    }

    /** Canonical playfield point -> rendered playfield point, in place. */
    projectPlayfieldPoint<T extends MutableVector3Like>(point: T): T {
        this.offsetAtRootZ(point.z - this.layout.playfieldForwardMeters, this.scratch);
        point.x += this.scratch.x; point.y += this.scratch.y;
        return point;
    }

    /** Rendered playfield point -> canonical playfield point, in place (exact inverse). */
    unprojectPlayfieldPoint<T extends MutableVector3Like>(point: T): T {
        this.offsetAtRootZ(point.z - this.layout.playfieldForwardMeters, this.scratch);
        point.x -= this.scratch.x; point.y -= this.scratch.y;
        return point;
    }

    private recompute(): void {
        this.amplitudeXValue = trackBendAmplitude(this.focusXValue, SCENE_CONFIG.backdropWidthMeters / 2, SCENE_CONFIG.trackMaxLateralBendMeters, this.bendEnd);
        this.amplitudeYValue = trackBendAmplitude(this.focusYValue, SCENE_CONFIG.backdropHeightMeters / 2, SCENE_CONFIG.trackMaxVerticalBendMeters, this.bendEnd);
        this.revision++;
    }

    /** Maps every sampled blade point of an XR strike attempt into canonical judging space. */
    unprojectStrike(attempt: { position: MutableVector3Like; previousPosition?: MutableVector3Like;
        basePosition?: MutableVector3Like; previousBasePosition?: MutableVector3Like }): void {
        this.unprojectPlayfieldPoint(attempt.position);
        if (attempt.previousPosition) this.unprojectPlayfieldPoint(attempt.previousPosition);
        if (attempt.basePosition) this.unprojectPlayfieldPoint(attempt.basePosition);
        if (attempt.previousBasePosition) this.unprojectPlayfieldPoint(attempt.previousBasePosition);
    }
}
