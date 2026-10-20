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
//
// Decorative depth beyond the runway (the Wormhole spatial field) continues the same curve along its
// far-end tangent (`trackBendWeightExtended` / `TRACK_BEND_EXTENDED_GLSL`), which by construction
// reaches the focal point on the backdrop while the bend is unsaturated. The runway's bend saturates
// for comfort (`trackMax*BendMeters`), so a focal point near the image's edge would leave the
// tangent far short of it: a far-aim term (`trackFarAimWeight`, zero value and slope at the runway's
// end) carries the remainder, so the extension always lands on the focal point at the backdrop's
// distance. With an unsaturated bend that remainder is zero. Gameplay never uses the extension.

import type * as THREE from 'three';
import { backdropScale, DEFAULT_STAGE_LAYOUT, SCENE_CONFIG, type XrStageLayout } from './SceneConfig';

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
function aimGain(bendEnd: number, backdropDistance: number): number {
    return 1 / (1 + 2 * (backdropDistance - bendEnd) / (bendEnd - BEND_START));
}

function finiteOrZero(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

/** Far-end displacement for a normalized focal coordinate; smoothly saturates at `maxBend`. */
export function trackBendAmplitude(focus: number, backdropHalfExtentMeters: number, maxBendMeters: number,
    bendEndMeters: number = DEFAULT_BEND_END, backdropDistanceMeters: number = SCENE_CONFIG.backdropDistanceMeters): number {
    const raw = finiteOrZero(focus) * backdropHalfExtentMeters * aimGain(bendEndMeters, backdropDistanceMeters);
    return maxBendMeters > 0 ? maxBendMeters * Math.tanh(raw / maxBendMeters) : 0;
}

/** Bend weight in [0, 1] for a stage-root z: 0 near the player, u^2 toward the far end. */
export function trackBendWeight(rootZ: number, bendEndMeters: number = DEFAULT_BEND_END): number {
    const u = Math.min(1, Math.max(0, (-rootZ - BEND_START) / (bendEndMeters - BEND_START)));
    return u * u;
}

/**
 * `trackBendWeight` continued past the bend end along its far-end tangent: u^2 up to u = 1, then
 * 2u - 1 (equal value and slope at u = 1). Decorative depth only; gameplay uses `trackBendWeight`.
 */
export function trackBendWeightExtended(rootZ: number, bendEndMeters: number = DEFAULT_BEND_END): number {
    const u = Math.max(0, (-rootZ - BEND_START) / (bendEndMeters - BEND_START));
    return u <= 1 ? u * u : 2 * u - 1;
}

/**
 * Weight of the far-aim remainder at `rootZ`: 0 up to the runway's end, then ((d - end) / (backdrop -
 * end))^2, so it starts with zero value and slope (the extension stays C1) and reaches 1 at the backdrop.
 */
export function trackFarAimWeight(rootZ: number, bendEndMeters: number, backdropDistanceMeters: number): number {
    const span = backdropDistanceMeters - bendEndMeters;
    if (!(span > 0)) return 0;
    const q = Math.max(0, (-rootZ - bendEndMeters) / span);
    return q * q;
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

/**
 * `TRACK_BEND_GLSL` plus the GLSL twin of `trackBendWeightExtended` (same `uTrackBend` uniform) and
 * the far-aim remainder (`uTrackFarAim` = remainder x, y, backdrop distance): the route continued past
 * the runway along its far-end tangent and onto the focal point, for decorative depth layers.
 */
export const TRACK_BEND_EXTENDED_GLSL = /* glsl */ `${TRACK_BEND_GLSL}
uniform vec4 uTrackFarAim;
vec2 xrTrackPathOffsetExtended( float rootZ ) {
    float u = max( ( -rootZ - uTrackBend.z ) / ( uTrackBend.w - uTrackBend.z ), 0.0 );
    float q = uTrackFarAim.z > uTrackBend.w ? max( ( -rootZ - uTrackBend.w ) / ( uTrackFarAim.z - uTrackBend.w ), 0.0 ) : 0.0;
    return uTrackBend.xy * ( u <= 1.0 ? u * u : 2.0 * u - 1.0 ) + uTrackFarAim.xy * ( q * q );
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
    /** What the far tangent misses of the focal point at the backdrop (decorative extension only). */
    private farAimXValue = 0;
    private farAimYValue = 0;
    /** Distance of the backdrop the far tangent aims at (the player's Background distance). */
    private backdropDistance: number = SCENE_CONFIG.backdropDistanceMeters;

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

    /**
     * The backdrop moved (Background distance): the far tangent re-aims at the same focal point on
     * the moved, proportionally scaled plane. Returns true only when the path changed.
     */
    setBackdropDistance(distanceMeters: number): boolean {
        const distance = Number.isFinite(distanceMeters) && distanceMeters > this.bendEnd ? distanceMeters : SCENE_CONFIG.backdropDistanceMeters;
        if (distance === this.backdropDistance) return false;
        this.backdropDistance = distance;
        this.recompute();
        return true;
    }

    get backdropDistanceMeters(): number { return this.backdropDistance; }

    /** Far end of the bend zone (meters ahead of the player; follows the runway length). */
    get bendEndMeters(): number { return this.bendEnd; }

    /** Hit-plane distance: a playfield z maps to stage-root z `z - playfieldForwardMeters` (GPU projection of playfield points). */
    get playfieldForwardMeters(): number { return this.layout.playfieldForwardMeters; }

    /** Current projection as `TRACK_BEND_GLSL`'s `uTrackBend` (no allocation). */
    writeBendUniform(out: MutableVector4Like): MutableVector4Like {
        return writeTrackBendUniform(out, this.amplitudeXValue, this.amplitudeYValue, this.bendEnd);
    }

    /** The extension's far-aim uniform (`uTrackFarAim`): remainder x, y and the backdrop distance. */
    writeFarAimUniform(out: MutableVector4Like): MutableVector4Like {
        out.x = this.farAimXValue; out.y = this.farAimYValue; out.z = this.backdropDistance; out.w = 0;
        return out;
    }

    /** Offset for a stage-root z (floor/rails live in root space). */
    offsetAtRootZ(rootZ: number, out: TrackPathOffset): TrackPathOffset {
        return trackPathOffset(rootZ, this.amplitudeXValue, this.amplitudeYValue, out, this.bendEnd);
    }

    /** Offset continued past the runway along the far tangent (`TRACK_BEND_EXTENDED_GLSL`'s CPU twin; decorative only). */
    offsetAtRootZExtended(rootZ: number, out: TrackPathOffset): TrackPathOffset {
        const weight = trackBendWeightExtended(rootZ, this.bendEnd);
        const aim = trackFarAimWeight(rootZ, this.bendEnd, this.backdropDistance);
        out.x = this.amplitudeXValue * weight + this.farAimXValue * aim;
        out.y = this.amplitudeYValue * weight + this.farAimYValue * aim;
        return out;
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
        // The plane scales with its distance, so its half extents do too (the focal angle is unchanged).
        const scale = backdropScale(this.backdropDistance);
        this.amplitudeXValue = trackBendAmplitude(this.focusXValue, scale * SCENE_CONFIG.backdropWidthMeters / 2, SCENE_CONFIG.trackMaxLateralBendMeters,
            this.bendEnd, this.backdropDistance);
        this.amplitudeYValue = trackBendAmplitude(this.focusYValue, scale * SCENE_CONFIG.backdropHeightMeters / 2, SCENE_CONFIG.trackMaxVerticalBendMeters,
            this.bendEnd, this.backdropDistance);
        // The focal point on the (scaled) plane, and what the saturated far tangent leaves of it there.
        const tangentAtBackdrop = trackBendWeightExtended(-this.backdropDistance, this.bendEnd);
        const reaches = this.backdropDistance > this.bendEnd;
        this.farAimXValue = reaches ? this.focusXValue * scale * SCENE_CONFIG.backdropWidthMeters / 2 - this.amplitudeXValue * tangentAtBackdrop : 0;
        this.farAimYValue = reaches ? this.focusYValue * scale * SCENE_CONFIG.backdropHeightMeters / 2 - this.amplitudeYValue * tangentAtBackdrop : 0;
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
