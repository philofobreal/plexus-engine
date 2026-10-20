// Flight bookkeeping of the Wormhole spatial field's entities (particles, wisps), in the 2D grains'
// own depth law. A 2D grain sits at normalized depth u (1 = released at the tunnel's far end, 0 = at
// the camera) and u falls by exactly one per horizon of Wormhole travel. Each spatial entity keeps the
// same u, so it emerges, approaches and accelerates toward the edges exactly like the grains of the
// image. Its flight may run past u = 0 (beside and behind the player), so every flight has its own
// span in u, fixed when it is released.
//
// Pure in travel: no clock, no frame delta. The same travel after a fresh start gives the same u.
//
// Also home of what the particles and the wisps share: the emergence circle, the release law and
// the motion GLSL (one module, so neither layer imports the other).

import { SCENE_CONFIG } from './SceneConfig';
import { TRACK_BEND_EXTENDED_GLSL } from './XrTrackPath';

/** Most flights one entity may finish in a single step; beyond that it is restarted (a jump). */
const MAX_FLIGHTS_PER_STEP = 8;

export class XrSpatialFlights {
    /** Current normalized depth of each entity (1 = just released, falling with travel). */
    readonly u: Float64Array;
    private readonly phase: ArrayLike<number>;
    private readonly start: Float64Array;
    private readonly span: Float64Array;

    /** `phase` (one per entity, in [0, 1)) spreads the entities along their flights after a fresh start. */
    constructor(phase: ArrayLike<number>) {
        this.phase = phase;
        this.u = new Float64Array(phase.length);
        this.start = new Float64Array(phase.length);
        this.span = new Float64Array(phase.length);
    }

    get count(): number { return this.u.length; }

    /**
     * Advances every entity to `travel` (horizons, never decreasing between fresh starts). `release(i)`
     * snapshots entity i's new flight and returns its span in u (> 0: from u = 1 down to 1 - span).
     * A fresh start releases every entity at its phase of a flight, from the current state.
     */
    advance(travel: number, fresh: boolean, release: (index: number) => number): void {
        for (let i = 0; i < this.u.length; i++) {
            if (fresh) {
                const span = this.safeSpan(release(i));
                this.span[i] = span;
                this.start[i] = travel - (this.phase[i] % 1) * span;
            } else {
                let flights = 0;
                while (travel - this.start[i] >= this.span[i]) {
                    if (++flights > MAX_FLIGHTS_PER_STEP) { this.start[i] = travel; this.span[i] = this.safeSpan(release(i)); break; }
                    this.start[i] += this.span[i];
                    this.span[i] = this.safeSpan(release(i));
                }
            }
            this.u[i] = 1 - (travel - this.start[i]);
        }
    }

    private safeSpan(span: number): number {
        return Number.isFinite(span) && span > 1e-3 ? span : 1;
    }
}

/**
 * Tangent of the view angle across one canvas height of the backdrop (its height over its distance;
 * the plane scales with its distance, so this holds at every Background distance).
 */
export const BACKDROP_TAN_PER_HEIGHT = SCENE_CONFIG.backdropHeightMeters / SCENE_CONFIG.backdropDistanceMeters;
/**
 * Release distances, as shares of the backdrop distance (and never nearer than the minimum): far
 * enough that the particles emerge out of the image, in front of its plane.
 */
export const SPATIAL_FIELD_EMERGE_SHARE = [0.25, 0.8] as const;
export const SPATIAL_FIELD_MIN_EMERGE_METERS = 12;
/**
 * Comfort cap on the along-route speed (release distance x travel rate), in meters per second. It
 * narrows the release distances; it yields only where a particle could not otherwise stay outside
 * the clearance on the circle.
 */
export const SPATIAL_FIELD_MAX_SPEED_MPS = 30;

function unit(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Tangent of the circle the image's grains emerge on (`BACKDROP_TAN_PER_HEIGHT` x tube spread; 0 if none). */
export function spatialEmergenceTangent(tubeSpread: number): number {
    return Number.isFinite(tubeSpread) && tubeSpread > 0 ? BACKDROP_TAN_PER_HEIGHT * tubeSpread : 0;
}

/** Release distance bounds (meters ahead) for a backdrop distance. */
export function spatialFieldEmergeRange(backdropDistanceMeters: number): readonly [number, number] {
    const distance = Number.isFinite(backdropDistanceMeters) && backdropDistanceMeters > 0 ? backdropDistanceMeters : SCENE_CONFIG.backdropDistanceMeters;
    const far = Math.max(SPATIAL_FIELD_MIN_EMERGE_METERS, distance * SPATIAL_FIELD_EMERGE_SHARE[1]);
    return [Math.min(far, Math.max(SPATIAL_FIELD_MIN_EMERGE_METERS, distance * SPATIAL_FIELD_EMERGE_SHARE[0])), far];
}

/** One release on the emergence circle: distance ahead and radius around the route, or hidden. */
export interface SpatialRelease { distance: number; radius: number; shown: boolean }

/**
 * Where a particle with radial seed `q` in [0, 1) is released on the emergence circle of `tangent`:
 * its distance lies within the emerge range, keeps the radius between `minRadius` and `maxRadius` and,
 * where it can, the along-route speed at `travelRate` under the comfort cap. When no distance in range
 * keeps the clearance (a very narrow, deep tunnel), the release is hidden.
 */
export function spatialRelease(q: number, tangent: number, range: readonly [number, number], travelRate: number,
    minRadius: number, maxRadius: number, out: SpatialRelease): SpatialRelease {
    const [nearest, farthest] = range;
    if (!(tangent > 0) || minRadius / tangent > farthest) { out.distance = farthest; out.radius = minRadius; out.shown = false; return out; }
    const low = Math.max(nearest, minRadius / tangent);
    const rate = Number.isFinite(travelRate) && travelRate > 0 ? travelRate : 0;
    const high = Math.max(low, Math.min(farthest, maxRadius / tangent, rate > 0 ? SPATIAL_FIELD_MAX_SPEED_MPS / rate : farthest));
    out.distance = low + (high - low) * unit(q);
    out.radius = tangent * out.distance;
    out.shown = true;
    return out;
}

/**
 * GLSL of the field's motion, shared by the particles and the wisps: the route offset continued past
 * the runway, and a release's point at normalized depth u. `release` = (distance, radius, own flow,
 * shown); the angle seed is in turns. The screen angle grows with forward progress like the image's
 * spiral (clockwise on the canvas), mirrored for y up.
 */
export const SPATIAL_MOTION_GLSL = /* glsl */ `${TRACK_BEND_EXTENDED_GLSL}
uniform float uCenterY;
uniform float uTwist;
vec3 xrSpatialPoint( vec4 release, float angleSeed, float u ) {
    float rootZ = -release.x * u;
    float progress = clamp( 1.0 - u, 0.0, 1.0 );
    float angle = -( angleSeed * 6.28318530718 + ( release.z + uTwist ) * progress );
    vec2 center = xrTrackPathOffsetExtended( rootZ ) + vec2( 0.0, uCenterY );
    return vec3( center + release.y * vec2( cos( angle ), sin( angle ) ), rootZ );
}`;
