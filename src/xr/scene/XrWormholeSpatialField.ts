// The Wormhole's spatial field (decorative, never gameplay): sparse luminous particles in the real XR
// space around the route, so the Wormhole's tunnel continues into the room and streams past the
// player. One `THREE.Points` draw over a fixed geometry of deterministic seeds.
//
// Motion is the 2D Wormhole's grain law, in real depth. A 2D grain is released on the tube wall at
// the far end of the tunnel and approaches at normalized depth u (1 at release, falling by one per
// horizon of travel), appearing `tubeSpread / u` canvas heights from the vanishing point. Seen from
// the player, the backdrop shows a canvas height across `BACKDROP_TAN_PER_HEIGHT` of tangent, so the
// grains emerge on a circle of tangent `BACKDROP_TAN_PER_HEIGHT x tubeSpread` and then race outward as
// 1 / u. A spatial particle released at distance d0 on that circle (radius r = tangent x d0 around
// the route) and moved to distance d0 x u, with the grains' own u, appears on exactly the same circle
// at release, moves with the image's flow and accelerates toward the edges exactly like it, then
// passes beside and behind the player (u < 0).
//
// Like a 2D grain, a particle samples the frame once at its release -- the circle (tube spread), its
// release distance, its own flow current and occupancy -- and keeps them for the whole flight, so a
// particle in flight never sways or pops with the music. The coherent spiral is live, as in the 2D
// image: the twist grows with forward progress (1 - u) at the frame's spiral turns. The image's
// angles grow clockwise on the canvas (y down); the field mirrors them for its y-up space so both turn
// the same way on screen. Brightness, colour and streaks follow the displayed frame live.
//
// Time: the displayed background frame carries the travel (`WormholeSpatialFrame.travel`, at
// `frame.time`); `XrFrameSignal` continues it (and the spiral) to the canonical song time drawn and
// crossfades into each new frame, so the field moves smoothly at headset rate while the background
// redraws slower. Travel only moves forward between fresh starts. Pause freezes it. A seek, a gap or
// a re-shown field releases every particle anew from the current frame, so the same song time and
// frame give the same placement after any seek.
//
// Space: stage-root coordinates (the field lives under the scene root like the floor). The route
// center is the playfield's middle height plus the track path's offset, continued past the runway
// along its far tangent and onto the Wormhole's focal point (`TRACK_BEND_EXTENDED_GLSL`), so the field
// centers on the image's vanishing point even where the runway's own bend saturates: one path
// authority, no curve of its own.

import * as THREE from 'three';
import type { WormholeSpatialFrame } from '../../types/WormholeSpatialFrame';
import { XrFrameSignal } from './XrFrameSignal';
import { SPATIAL_MOTION_GLSL, spatialEmergenceTangent, spatialFieldEmergeRange, spatialRelease, XrSpatialFlights,
    type SpatialRelease } from './XrSpatialFlights';
import { writeTrackBendUniform, type XrTrackPath } from './XrTrackPath';
import { XrWormholeWisps } from './XrWormholeWisps';

// The emergence law the particles and wisps share (see XrSpatialFlights).
export { BACKDROP_TAN_PER_HEIGHT, SPATIAL_FIELD_EMERGE_SHARE, SPATIAL_FIELD_MAX_SPEED_MPS, SPATIAL_FIELD_MIN_EMERGE_METERS, SPATIAL_MOTION_GLSL,
    spatialEmergenceTangent, spatialFieldEmergeRange, spatialRelease, type SpatialRelease } from './XrSpatialFlights';

/** Player choice (System > Spatial field): no field, particles only, or particles and wisps. */
export type XrSpatialFieldMode = 'off' | 'particles' | 'full';

/** Primary particles (fixed buffer; occupancy gates how many draw). */
export const SPATIAL_FIELD_PARTICLES = 80;
/** Particles fly past the player and fade out this far behind them. */
export const SPATIAL_FIELD_BEHIND_METERS = 6;
/** Fully visible until this far behind the player (they leave the view beside the player first). */
const BEHIND_FADE_START_METERS = 1;
/** Share of the flight (in u) over which a released particle fades in on the emergence circle. */
const EMERGE_SHARE = 0.12;
/**
 * Radial clearance around the route center: outside the start frame, the note corridor and the
 * runway rails (~2 m from the center), so no particle ever crosses a target's path or the player.
 */
export const SPATIAL_FIELD_MIN_RADIUS_METERS = 2.4;
/** Widest radius a particle may take (a wide, shallow tunnel's circle at a far release). */
export const SPATIAL_FIELD_MAX_RADIUS_METERS = 16;
/** Longest extrapolation from the displayed frame; a stale frame (seek) holds instead of racing ahead. */
export const MAX_EXTRAPOLATION_SEC = 0.25;
/** A song-time jump larger than this (or any step back) is a seek: every particle is released anew. */
export const SPATIAL_FIELD_SEEK_SEC = 1;
/**
 * A frame whose travel is this many horizons below the last frame's starts the flow over (a restart):
 * frames never step back in travel within one playthrough, and this exceeds any overshoot the
 * extrapolation holds (WORMHOLE_SPATIAL_MAX_TRAVEL_RATE x MAX_EXTRAPOLATION_SEC = 1).
 */
export const SPATIAL_FIELD_TRAVEL_RESTART = 1.5;
/**
 * World-space sprite diameter (core plus halo) and its on-screen clamp: near particles never become
 * giant billboards (22 px is about one degree of a Quest 3 eye buffer), far ones keep a visible core.
 */
const PARTICLE_SIZE_METERS = 0.16;
const MIN_POINT_PX = 2.5;
const MAX_POINT_PX = 22;
/** Peak opacity: the field stays well below the targets' brightness. */
const PEAK_ALPHA = 0.6;
/**
 * Material (one analytic sprite, no texture): a whitened core and a soft halo in the Wormhole's grain
 * colour that reaches zero exactly at the sprite edge. Far particles turn softer, dimmer and hazier
 * (toward the Wormhole's own depth haze), near ones crisp, so stereo depth reads at a glance.
 */
export const SPATIAL_CORE_WHITEN = 0.55;
/** Halo gain for the shallowest and the deepest Wormhole (deep roles read softer). */
const HALO_GAIN_RANGE = [0.4, 0.75] as const;
const CORE_SHARPNESS_NEAR = 20;
const CORE_SHARPNESS_FAR = 9;
const FAR_HAZE = 0.35;
const FAR_DIM = 0.35;
/**
 * Flow: each particle's own angular current (rate and direction from its seed, as the 2D grains'
 * flow), at most this many radians over a flight at full turbulence. Monotonic: never a wave.
 */
export const SPATIAL_FLOW_RADIANS = 0.9;
/** A shallow Wormhole fades its far particles by up to this much; a deep one keeps them. */
const SHALLOW_FAR_FADE = 1;
/** Beat / dense-impact transients lift the brightness by at most this share. */
const PULSE_GAIN = 0.25;
/**
 * Streaks (the same particles, not a second system): the trail is the particle's own recent path, as
 * long as the 2D grain trails -- the travel of continuity x 1/24 s (WORMHOLE_TRAIL_REFERENCE_SEC);
 * streak = continuity / 2, so the exposure is streak x 2/24 s of travel. Slow roles stay short, fast
 * ones stretch; bounded in meters and on screen. A long streak dims its peak and fades toward its tail.
 */
export const SPATIAL_STREAK_EXPOSURE_SEC = 2 / 24;
export const SPATIAL_MAX_STREAK_METERS = 0.9;
export const SPATIAL_MAX_STREAK_PX = 40;
const MAX_STREAK_PX = SPATIAL_MAX_STREAK_PX;
const STREAK_DIM = 0.7;
const STREAK_TAIL = 0.3;
/** After the backdrop planes (-100..-98), before the floor and all stage linework (-10 and up). */
export const SPATIAL_FIELD_RENDER_ORDER = -20;

/** [0, 1] clamp that maps non-finite input to 0. */
function unit(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Integer hash -> [0, 1): deterministic seeds, no runtime randomness. */
function hash01(index: number, salt: number): number {
    let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Seeds, generated once: angle and flight phase from the R2 low-discrepancy sequence (even spacing,
 * no clumps), release-distance seed, occupancy rank, size and signed flow rate from a hash. Stored as
 * `position` (angle, release seed, flight phase) and `aSeed` (occupancy rank, size), all in [0, 1);
 * `flow` (CPU only) in [-1, -0.6] or [0.6, 1].
 */
export function createSpatialFieldSeeds(count: number = SPATIAL_FIELD_PARTICLES): {
    readonly position: Float32Array; readonly seed: Float32Array; readonly flow: Float64Array;
} {
    const g = 1.32471795724474602596, a1 = 1 / g, a2 = 1 / (g * g);
    const position = new Float32Array(count * 3), seed = new Float32Array(count * 2), flow = new Float64Array(count);
    for (let i = 0; i < count; i++) {
        position[i * 3] = (0.5 + a1 * i) % 1;
        position[i * 3 + 1] = hash01(i, 1);
        position[i * 3 + 2] = (0.5 + a2 * i) % 1;
        // Occupancy rank: a ladder in sequence order, so a density of d shows the first ~d x count
        // particles, and any prefix of the R2 sequence is itself evenly spread.
        seed[i * 2] = ((i + 0.5) / count + hash01(i, 2) * 0.5 / count) % 1;
        seed[i * 2 + 1] = hash01(i, 3);
        flow[i] = (0.6 + 0.4 * hash01(i, 4)) * (hash01(i, 5) < 0.5 ? -1 : 1);
    }
    return { position, seed, flow };
}

const VERTEX = /* glsl */ `${SPATIAL_MOTION_GLSL}
attribute vec2 aSeed;
attribute vec4 aRelease;
attribute float aDepth;
uniform float uFarRef;
uniform float uAmount;
uniform float uPixelScale;
uniform float uDepth;
uniform float uPulse;
uniform float uTrailDu;
varying float vAlpha;
varying float vFar;
varying vec2 vAxis;
varying vec2 vShape;
void main() {
    // position = (angle seed, release seed, flight phase); aDepth = the grains' normalized depth u.
    float u = aDepth;
    vec3 p = xrSpatialPoint( aRelease, position.x, u );
    vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
    vec4 clipHead = projectionMatrix * mvPosition;
    // Emerges on the circle, stays until it has passed the player, fades out behind them.
    float fade = ( 1.0 - smoothstep( ${(1 - EMERGE_SHARE).toFixed(2)}, 1.0, u ) )
        * ( 1.0 - smoothstep( ${BEHIND_FADE_START_METERS.toFixed(1)}, ${SPATIAL_FIELD_BEHIND_METERS.toFixed(1)}, p.z ) );
    float shown = aRelease.w * fade * uAmount;
    // 0 at the player, 1 at the farthest release (eased like the Wormhole's own depth cue).
    vFar = pow( clamp( -p.z / uFarRef, 0.0, 1.0 ), 1.5 );
    vAlpha = ${PEAK_ALPHA.toFixed(2)} * shown * ( 0.6 + 0.4 * aSeed.y ) * ( 1.0 - ${FAR_DIM.toFixed(2)} * vFar )
        * ( 1.0 - ${SHALLOW_FAR_FADE.toFixed(2)} * ( 1.0 - uDepth ) * vFar ) * ( 1.0 + ${PULSE_GAIN.toFixed(2)} * uPulse );
    float depth = max( -mvPosition.z, 0.1 );
    float dotPx = clamp( ${PARTICLE_SIZE_METERS.toFixed(3)} * ( 0.7 + 0.6 * aSeed.y ) * projectionMatrix[ 1 ][ 1 ] * uPixelScale / depth,
        ${MIN_POINT_PX.toFixed(1)}, ${MAX_POINT_PX.toFixed(1)} );
    // Streak: where the particle was one exposure ago (farther along its own flight), projected;
    // bounded in meters; screen pixels per NDC unit on each axis.
    vec2 pxPerNdc = vec2( uPixelScale * projectionMatrix[ 1 ][ 1 ] / projectionMatrix[ 0 ][ 0 ], uPixelScale );
    vec2 headNdc = clipHead.xy / clipHead.w;
    vec2 trail = vec2( 0.0 );
    if ( uTrailDu > 0.0 && clipHead.w > 0.1 ) {
        float du = min( uTrailDu, ${SPATIAL_MAX_STREAK_METERS.toFixed(2)} / max( aRelease.x, 1.0 ) );
        vec4 clipTail = projectionMatrix * ( modelViewMatrix * vec4( xrSpatialPoint( aRelease, position.x, min( u + du, 1.0 ) ), 1.0 ) );
        if ( clipTail.w > 0.1 ) trail = ( headNdc - clipTail.xy / clipTail.w ) * pxPerNdc;
    }
    float trailPx = length( trail );
    // Bounded on screen: a near particle never becomes a long bar across the view.
    if ( trailPx > ${MAX_STREAK_PX.toFixed(1)} ) { trail *= ${MAX_STREAK_PX.toFixed(1)} / trailPx; trailPx = ${MAX_STREAK_PX.toFixed(1)}; }
    float side = dotPx + trailPx;
    // Sprite space (gl_PointCoord, +y down): unit axis toward the head; trail half-length and dot
    // radius relative to the sprite half-side (a still particle is exactly the round sprite).
    vAxis = trailPx > 0.01 ? vec2( trail.x, -trail.y ) / trailPx : vec2( 1.0, 0.0 );
    vShape = vec2( trailPx / side, dotPx / side );
    // The same light spread along a streak: a restrained peak.
    vAlpha *= mix( 1.0, ${STREAK_DIM.toFixed(2)}, vShape.x );
    // Hidden or behind the eye: no fragments.
    gl_PointSize = shown > 0.0 && clipHead.w > 0.1 ? side : 0.0;
    // The sprite is centered between tail and head so it holds the whole capsule (depth stays the head's).
    vec2 centerNdc = headNdc - 0.5 * trail / pxPerNdc;
    gl_Position = vec4( vec3( centerNdc, clipHead.z / clipHead.w ) * clipHead.w, clipHead.w );
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uHalo;
uniform vec3 uHaze;
uniform float uHaloGain;
varying float vAlpha;
varying float vFar;
varying vec2 vAxis;
varying vec2 vShape;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    // Distance to the trail segment (a capsule), in dot radii: a point when the trail is empty.
    float along = clamp( dot( c, vAxis ), -vShape.x, vShape.x );
    vec2 q = ( c - vAxis * along ) / max( vShape.y, 0.001 );
    float r2 = dot( q, q );
    float halo = max( 1.0 - r2, 0.0 );
    halo *= halo * halo;
    float core = exp( -r2 * mix( ${CORE_SHARPNESS_NEAR.toFixed(1)}, ${CORE_SHARPNESS_FAR.toFixed(1)}, vFar ) );
    // Bright head, fading tail: the streak reads as travel direction.
    float taper = vShape.x > 0.0 ? mix( ${STREAK_TAIL.toFixed(2)}, 1.0, 0.5 + 0.5 * along / vShape.x ) : 1.0;
    vec3 haloColor = mix( uHalo, uHaze, ${FAR_HAZE.toFixed(2)} * vFar );
    gl_FragColor = vec4( ( uCore * core + haloColor * ( halo * uHaloGain ) ) * taper, vAlpha );
    #include <colorspace_fragment>
}`;

export class XrWormholeSpatialField {
    /** The field's layers, in stage-root space (identity transform under the scene root). */
    readonly root = new THREE.Group();
    readonly points: THREE.Points;
    /** Sparse soft wisps (second and last draw), sharing this field's path, motion, colours and travel. */
    readonly wisps: XrWormholeWisps;
    readonly uniforms = {
        uTrackBend: { value: writeTrackBendUniform(new THREE.Vector4()) as THREE.Vector4 },
        uTrackFarAim: { value: new THREE.Vector4() },
        uCenterY: { value: 0 },
        uTwist: { value: 0 },
        uFarRef: { value: spatialFieldEmergeRange(Number.NaN)[1] },
        uAmount: { value: 0 },
        uPixelScale: { value: 540 },
        uDepth: { value: 0 },
        uPulse: { value: 0 },
        uTrailDu: { value: 0 },
        uHaloGain: { value: HALO_GAIN_RANGE[0] as number },
        uCore: { value: new THREE.Color() },
        uHalo: { value: new THREE.Color() },
        uHaze: { value: new THREE.Color() }
    };
    private modeValue: XrSpatialFieldMode = 'full';
    private pathRevision = -1;
    private readonly drawingBuffer = new THREE.Vector2();
    private readonly seeds = createSpatialFieldSeeds();
    private readonly flights: XrSpatialFlights;
    private readonly release: THREE.BufferAttribute;
    private readonly depth: THREE.BufferAttribute;
    /** Every particle is released anew on the next update (first frame, seek, re-shown, moved backdrop). */
    private fresh = true;
    private lastSongTime = Number.NaN;
    private lastFrameTime = Number.NaN;
    private lastFrameTravel = Number.NaN;
    /** The displayed frame's travel and spiral, continued to the song time drawn. */
    private readonly travelSignal = new XrFrameSignal(MAX_EXTRAPOLATION_SEC);
    private readonly twistSignal = new XrFrameSignal();
    /** Travel shown last (horizons): the field never steps back between fresh starts. */
    private travel = 0;
    private emergeRange: readonly [number, number] = spatialFieldEmergeRange(Number.NaN);
    /** The frame a release samples (set for the duration of one update; releases happen only then). */
    private releaseFrame: WormholeSpatialFrame | null = null;
    private readonly scratch: SpatialRelease = { distance: 0, radius: 0, shown: false };
    /** A release was written during this update (one upload, however many particles restarted). */
    private released = false;
    private readonly releaseParticle = (i: number): number => this.releaseOne(i);

    constructor() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.seeds.position, 3));
        geometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds.seed, 2));
        // Release (distance, radius, own flow, shown): written only when a particle starts a new flight.
        this.release = new THREE.BufferAttribute(new Float32Array(SPATIAL_FIELD_PARTICLES * 4), 4).setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aRelease', this.release);
        // Normalized depth u of every particle: 80 floats per frame (the CPU keeps travel in double precision).
        this.depth = new THREE.BufferAttribute(new Float32Array(SPATIAL_FIELD_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aDepth', this.depth);
        const phases = new Float64Array(SPATIAL_FIELD_PARTICLES);
        for (let i = 0; i < SPATIAL_FIELD_PARTICLES; i++) phases[i] = this.seeds.position[i * 3 + 2];
        this.flights = new XrSpatialFlights(phases);
        const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: this.uniforms,
            transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false });
        this.points = new THREE.Points(geometry, material);
        this.wisps = new XrWormholeWisps(this.uniforms);
        this.root.name = 'wormholeSpatial';
        this.root.add(this.wisps.mesh, this.points);
        this.points.name = 'wormholeSpatialField';
        this.points.renderOrder = SPATIAL_FIELD_RENDER_ORDER;
        // The vertex shader places every particle; the seed geometry's bounds mean nothing.
        this.points.frustumCulled = false;
        this.points.visible = false;
        // Point sizes follow the eye buffer's height (the XR framebuffer while presenting).
        this.points.onBeforeRender = renderer => {
            const height = renderer.getDrawingBufferSize(this.drawingBuffer).y;
            if (height > 0) this.uniforms.uPixelScale.value = height * 0.5;
        };
    }

    get mode(): XrSpatialFieldMode { return this.modeValue; }

    /** System > Spatial field: off (no draw at all), particles only, or particles and wisps. */
    setMode(mode: XrSpatialFieldMode): void {
        this.modeValue = mode === 'off' || mode === 'particles' ? mode : 'full';
        if (this.modeValue === 'off') this.hide();
    }

    /** Route center height in stage-root meters (the playfield's middle row), set per viewer placement. */
    setCenterHeight(heightMeters: number): void {
        if (Number.isFinite(heightMeters)) this.uniforms.uCenterY.value = heightMeters;
    }

    /** Normalized depth u of each particle after the last update (diagnostics and tests). */
    get particleDepths(): ArrayLike<number> { return this.flights.u; }

    /**
     * Places the field for `songTime` from the displayed Wormhole frame (null: no background, hidden)
     * and the current track path. Uniform writes, the particles' depths, plus the release of particles
     * that start a new flight (a few floats, never a reallocation).
     */
    update(songTime: number, frame: WormholeSpatialFrame | null, path: XrTrackPath): void {
        const amount = frame ? frame.amount : 0;
        if (this.modeValue === 'off' || !frame || !(amount > 0) || !Number.isFinite(songTime)) { this.hide(); return; }
        if (!Number.isFinite(frame.travel)) { this.hide(); return; }
        // The image's travel started over: a frame from earlier in the song than the last one, or a
        // travel drop beyond any extrapolation overshoot. After a restart the old playthrough's stale
        // frame is shown until the first new one arrives; holding its larger travel would freeze the
        // flow until the song caught up with it. Start over from the new frame instead (no blend).
        if (frame.time < this.lastFrameTime - 1e-6 || frame.travel < this.lastFrameTravel - SPATIAL_FIELD_TRAVEL_RESTART) {
            this.fresh = true; this.travelSignal.reset(); this.twistSignal.reset();
        }
        this.lastFrameTime = frame.time;
        this.lastFrameTravel = frame.travel;
        const rate = Number.isFinite(frame.travelRate) ? frame.travelRate : 0;
        let travel = this.travelSignal.sample(songTime, frame.time, frame.travel, rate);
        const twist = this.twistSignal.sample(songTime, frame.time, Number.isFinite(frame.spiralTurns) ? frame.spiralTurns : 0);
        const u = this.uniforms;
        const range = spatialFieldEmergeRange(path.backdropDistanceMeters);
        if (range[0] !== this.emergeRange[0] || range[1] !== this.emergeRange[1]) { this.emergeRange = range; this.fresh = true; }
        u.uFarRef.value = range[1];
        // A seek (any step back, or a jump) releases every particle from the current frame.
        if (!(songTime >= this.lastSongTime - 1e-6 && songTime <= this.lastSongTime + SPATIAL_FIELD_SEEK_SEC)) this.fresh = true;
        this.lastSongTime = songTime;
        // Travel never steps back between fresh starts: a crossfade's small overshoot is held.
        if (!this.fresh && travel < this.travel) travel = this.travel;
        this.travel = travel;
        const fresh = this.fresh;
        this.releaseFrame = frame;
        this.released = false;
        this.flights.advance(travel, fresh, this.releaseParticle);
        if (this.released) this.release.needsUpdate = true;
        const depths = this.depth.array as Float32Array, flightDepths = this.flights.u;
        for (let i = 0; i < SPATIAL_FIELD_PARTICLES; i++) depths[i] = flightDepths[i];
        this.depth.needsUpdate = true;
        this.fresh = false;
        u.uTwist.value = 2 * Math.PI * twist;
        u.uAmount.value = Math.min(1, amount);
        const depth = unit(frame.depth);
        u.uDepth.value = depth;
        u.uHaloGain.value = HALO_GAIN_RANGE[0] + (HALO_GAIN_RANGE[1] - HALO_GAIN_RANGE[0]) * depth;
        u.uPulse.value = unit(0.6 * unit(frame.pulse) + 0.6 * unit(frame.impact));
        // Exposure in u (horizons of travel); the shader bounds each streak in meters.
        u.uTrailDu.value = unit(frame.streak) * SPATIAL_STREAK_EXPOSURE_SEC * Math.max(0, rate);
        // The Wormhole's own grain and haze colours (sRGB), never a palette of the field's own.
        const red = unit(frame.red), green = unit(frame.green), blue = unit(frame.blue), w = SPATIAL_CORE_WHITEN;
        u.uHalo.value.setRGB(red, green, blue, THREE.SRGBColorSpace);
        u.uCore.value.setRGB(red + (1 - red) * w, green + (1 - green) * w, blue + (1 - blue) * w, THREE.SRGBColorSpace);
        u.uHaze.value.setRGB(unit(frame.hazeRed), unit(frame.hazeGreen), unit(frame.hazeBlue), THREE.SRGBColorSpace);
        if (path.revision !== this.pathRevision) {
            path.writeBendUniform(u.uTrackBend.value); path.writeFarAimUniform(u.uTrackFarAim.value); this.pathRevision = path.revision;
        }
        this.points.visible = true;
        if (this.modeValue === 'full') this.wisps.update(travel, fresh, frame, range);
        else this.wisps.hide();
        this.releaseFrame = null;
    }

    /**
     * Release snapshot (the 2D grains' law): a particle starting a new flight samples the frame once
     * -- the emergence circle, its release distance, its own flow current and occupancy -- and keeps
     * them until it is released again. Returns the flight's span in u (down to behind the player).
     */
    private releaseOne(i: number): number {
        const frame = this.releaseFrame;
        const out = this.release.array as Float32Array;
        this.released = true;
        if (!frame) { out[i * 4 + 3] = 0; return 1; }
        const { position, seed, flow } = this.seeds;
        const release = spatialRelease(position[i * 3 + 1], spatialEmergenceTangent(frame.tubeSpread), this.emergeRange, frame.travelRate,
            SPATIAL_FIELD_MIN_RADIUS_METERS, SPATIAL_FIELD_MAX_RADIUS_METERS, this.scratch);
        out[i * 4] = release.distance;
        out[i * 4 + 1] = release.radius;
        out[i * 4 + 2] = SPATIAL_FLOW_RADIANS * unit(frame.turbulence) * flow[i];
        out[i * 4 + 3] = release.shown && seed[i * 2] <= unit(frame.density) ? 1 : 0;
        return 1 + SPATIAL_FIELD_BEHIND_METERS / release.distance;
    }

    private hide(): void {
        this.points.visible = false;
        this.wisps.hide();
        this.fresh = true;
        this.lastFrameTime = Number.NaN;
        this.lastFrameTravel = Number.NaN;
        this.travelSignal.reset();
        this.twistSignal.reset();
    }

    dispose(): void {
        this.points.geometry.dispose();
        (this.points.material as THREE.Material).dispose();
        this.wisps.dispose();
        this.root.removeFromParent();
    }
}
