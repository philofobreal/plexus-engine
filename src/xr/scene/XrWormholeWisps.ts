// Sparse volumetric-looking wisps of the Wormhole spatial field (decorative; not volumetric rendering):
// a handful of camera-facing soft quads in one instanced draw, farther from the route than the
// particles. They are the Nebula's soft volume, carried by the same tunnel: like the particles they
// emerge on the image's emergence circle, approach at the grains' own normalized depth u (so they
// accelerate toward the edges with the image) and turn with its live spiral. Unlike the particles,
// they dissolve before they reach the player, so no large soft quad ever washes over the view.
// They share the field's authorities by reference: the track path uniform (one curve), the route
// center height, the spiral, and the Wormhole's grain and haze colours.
// With no wisp tendency every quad collapses to a point (no fragments), but the draw stays submitted
// while the field shows, so its shader is compiled when the field first appears, never as a hitch in
// the middle of a song.

import * as THREE from 'three';
import type { WormholeSpatialFrame } from '../../types/WormholeSpatialFrame';
import { SPATIAL_MOTION_GLSL, spatialEmergenceTangent, spatialRelease, XrSpatialFlights, type SpatialRelease } from './XrSpatialFlights';

/** Instances (fixed); the wisp tendency shows up to all of them, the last one fading in continuously. */
export const SPATIAL_WISPS = 8;
/** Radius range around the route center (the circle's radius at release, kept within it). */
export const WISP_RADIUS_RANGE_METERS = [4.4, 12] as const;
/** Half-size of a wisp's quad (camera-facing). */
export const WISP_HALF_SIZE_RANGE_METERS = [1.3, 2] as const;
/**
 * Clearance from the route center that no part of a wisp crosses (nearest center minus largest
 * half-size): the particles' clearance, so a line of sight to any target never passes through a wisp.
 */
export const WISP_CLEARANCE_METERS = WISP_RADIUS_RANGE_METERS[0] - WISP_HALF_SIZE_RANGE_METERS[1];
/** A wisp's flight ends this far ahead of the player; it dissolves over the last `WISP_DISSOLVE_METERS`. */
export const WISP_END_METERS = 8;
export const WISP_DISSOLVE_METERS = 10;
/** Share of the flight (in u) over which a released wisp fades in. */
const WISP_EMERGE_SHARE = 0.2;
/** Low contrast: a wisp's peak opacity. */
const WISP_PEAK_ALPHA = 0.12;
/** Wisps sit toward the Wormhole's haze: softer than the particles' halo. */
const WISP_HAZE_MIX = 0.45;
/** Each wisp's own slow angular drift over a flight (radians, signed by its seed), on top of the spiral. */
const WISP_DRIFT_RADIANS = 0.35;
/**
 * A wisp's body is an ellipse this many times longer than wide. Its quad is exactly the ellipse's
 * box (rotated with it), so no fragment is shaded outside the body: additive fill is the field's
 * main GPU cost on Quest.
 */
export const WISP_ELONGATION = 1.6;
/** Wisps fade out below the runway floor's level (stage-root y), over this many meters. */
const WISP_FLOOR_FADE_METERS = 2;
/** After the backdrop planes, before the particles (-20) and the stage. */
export const WISP_RENDER_ORDER = -22;

/** Integer hash -> [0, 1): deterministic seeds, no runtime randomness. */
function hash01(index: number, salt: number): number {
    let h = Math.imul(index + 1, 0x2c1b3c6d) ^ Math.imul(salt + 1, 0x297a2d39);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Seeds, generated once: `aWisp` = (angle in turns, release seed, flight phase, rank) and `aShape` =
 * (size, rotation, breakup phase). Angles and phases are evenly spread (stratified with a hashed
 * jitter) so even three visible wisps never clump; rank k shows when the count exceeds k.
 */
export function createWispSeeds(count: number = SPATIAL_WISPS): { readonly wisp: Float32Array; readonly shape: Float32Array } {
    const wisp = new Float32Array(count * 4), shape = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
        wisp[k * 4] = ((k * 0.381966 + hash01(k, 1) * 0.12) % 1 + 1) % 1;
        wisp[k * 4 + 1] = hash01(k, 2);
        wisp[k * 4 + 2] = ((k * 0.618034 + hash01(k, 3) * 0.08) % 1 + 1) % 1;
        wisp[k * 4 + 3] = k;
        shape[k * 3] = hash01(k, 4);
        shape[k * 3 + 1] = hash01(k, 5);
        shape[k * 3 + 2] = hash01(k, 6);
    }
    return { wisp, shape };
}

const VERTEX = /* glsl */ `${SPATIAL_MOTION_GLSL}
attribute vec4 aWisp;
attribute vec3 aShape;
attribute vec4 aWispRelease;
attribute float aWispDepth;
uniform float uWispCount;
uniform float uWispPresence;
varying vec2 vUv;
varying float vAlpha;
varying float vPhase;
void main() {
    float u = aWispDepth;
    vec3 center = xrSpatialPoint( aWispRelease, aWisp.x, u );
    // Fades in on the circle, dissolves before the player, never shows under the floor.
    float fade = ( 1.0 - smoothstep( ${(1 - WISP_EMERGE_SHARE).toFixed(2)}, 1.0, u ) )
        * smoothstep( ${WISP_END_METERS.toFixed(1)}, ${(WISP_END_METERS + WISP_DISSOLVE_METERS).toFixed(1)}, -center.z )
        * smoothstep( ${(-WISP_FLOOR_FADE_METERS).toFixed(1)}, 0.0, center.y );
    // Rank k shows once the count passes k; the last one fades in with the fraction (continuous).
    float shown = clamp( uWispCount - aWisp.w, 0.0, 1.0 ) * fade * uWispPresence * aWispRelease.w;
    vAlpha = ${WISP_PEAK_ALPHA.toFixed(2)} * shown;
    // A hidden wisp collapses to a point: no fragments at all.
    float halfSize = shown > 0.0 ? mix( ${WISP_HALF_SIZE_RANGE_METERS[0].toFixed(2)}, ${WISP_HALF_SIZE_RANGE_METERS[1].toFixed(2)}, aShape.x ) : 0.0;
    vec4 mvPosition = modelViewMatrix * vec4( center, 1.0 );
    // Camera-facing in view space (each eye's view keeps the same orientation). The quad is the body's
    // own box: body space (unit circle = edge of the body) narrowed across the long axis, then turned
    // by the wisp's rotation.
    float a = aShape.y * 6.28318530718;
    vec2 local = vec2( position.x / ${WISP_ELONGATION.toFixed(2)}, position.y );
    mvPosition.xy += mat2( cos( a ), -sin( a ), sin( a ), cos( a ) ) * local * halfSize;
    vUv = position.xy;
    vPhase = aShape.z;
    gl_Position = projectionMatrix * mvPosition;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uHalo;
uniform vec3 uHaze;
uniform float uWispPhase;
varying vec2 vUv;
varying float vAlpha;
varying float vPhase;
void main() {
    // An elongated soft body (the quad carries its rotation and elongation, so here it is a disc in
    // body space), with a cheap two-wave breakup that drifts with the Wormhole's travel (no noise
    // texture, no octaves).
    vec2 p = vUv;
    float body = max( 1.0 - dot( p, p ), 0.0 );
    body *= body;
    float phase = 6.28318530718 * ( vPhase + uWispPhase );
    float breakup = 0.6 + 0.4 * sin( p.x * 3.1 + phase ) * sin( p.y * 2.3 - phase * 0.7 );
    gl_FragColor = vec4( mix( uHalo, uHaze, ${WISP_HAZE_MIX.toFixed(2)} ), vAlpha * body * breakup );
    #include <colorspace_fragment>
}`;

/** Uniform objects the wisps read from the spatial field (shared by reference, written by the field). */
export interface SharedSpatialUniforms {
    readonly uTrackBend: { value: THREE.Vector4 };
    readonly uTrackFarAim: { value: THREE.Vector4 };
    readonly uCenterY: { value: number };
    readonly uTwist: { value: number };
    readonly uHalo: { value: THREE.Color };
    readonly uHaze: { value: THREE.Color };
}

export class XrWormholeWisps {
    readonly mesh: THREE.Mesh;
    readonly uniforms: SharedSpatialUniforms & {
        readonly uWispCount: { value: number };
        readonly uWispPresence: { value: number };
        readonly uWispPhase: { value: number };
    };
    private readonly seeds = createWispSeeds();
    private readonly flights: XrSpatialFlights;
    private readonly release: THREE.InstancedBufferAttribute;
    private readonly depth: THREE.InstancedBufferAttribute;
    private fresh = true;
    private releaseFrame: WormholeSpatialFrame | null = null;
    private releaseRange: readonly [number, number] = [0, 0];
    private readonly scratch: SpatialRelease = { distance: 0, radius: 0, shown: false };
    private released = false;
    private readonly releaseWisp = (k: number): number => this.releaseOne(k);

    constructor(shared: SharedSpatialUniforms) {
        this.uniforms = { ...shared, uWispCount: { value: 0 }, uWispPresence: { value: 0 }, uWispPhase: { value: 0 } };
        const geometry = new THREE.InstancedBufferGeometry();
        // One unit quad in [-1, 1]^2; every instance is placed and sized by the vertex shader.
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        geometry.setAttribute('aWisp', new THREE.InstancedBufferAttribute(this.seeds.wisp, 4));
        geometry.setAttribute('aShape', new THREE.InstancedBufferAttribute(this.seeds.shape, 3));
        // Release (distance, radius, own drift, shown) per flight, and the depth u per frame (8 floats).
        this.release = new THREE.InstancedBufferAttribute(new Float32Array(SPATIAL_WISPS * 4), 4).setUsage(THREE.DynamicDrawUsage);
        this.depth = new THREE.InstancedBufferAttribute(new Float32Array(SPATIAL_WISPS), 1).setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aWispRelease', this.release);
        geometry.setAttribute('aWispDepth', this.depth);
        geometry.instanceCount = SPATIAL_WISPS;
        const phases = new Float64Array(SPATIAL_WISPS);
        for (let k = 0; k < SPATIAL_WISPS; k++) phases[k] = this.seeds.wisp[k * 4 + 2];
        this.flights = new XrSpatialFlights(phases);
        const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT,
            uniforms: this.uniforms as unknown as Record<string, THREE.IUniform>,
            transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = 'wormholeSpatialWisps';
        this.mesh.renderOrder = WISP_RENDER_ORDER;
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
    }

    /** Normalized depth u of each wisp after the last update (tests). */
    get wispDepths(): ArrayLike<number> { return this.flights.u; }

    /**
     * `travel` is the field's travel (horizons) for this song time, `fresh` restarts every flight (as
     * the field's particles), `frame` the displayed frame, `range` the release distances. With no wisp
     * called for, the quads collapse (no fragments) while the draw stays warm.
     */
    update(travel: number, fresh: boolean, frame: WormholeSpatialFrame, range: readonly [number, number]): void {
        const presence = frame.amount;
        if (!(presence > 0) || !Number.isFinite(travel)) { this.hide(); return; }
        this.mesh.visible = true;
        this.releaseFrame = frame; this.releaseRange = range;
        this.released = false;
        this.flights.advance(travel, fresh || this.fresh, this.releaseWisp);
        if (this.released) this.release.needsUpdate = true;
        this.fresh = false;
        this.releaseFrame = null;
        const depths = this.depth.array as Float32Array;
        for (let k = 0; k < SPATIAL_WISPS; k++) depths[k] = this.flights.u[k];
        this.depth.needsUpdate = true;
        const u = this.uniforms;
        // Breakup drift: a slow phase of the same travel (pause freezes it, a seek reproduces it).
        const phase = travel * 0.35;
        u.uWispPhase.value = phase - Math.floor(phase);
        // A negligible tendency is none: every quad collapses (no near-transparent fill).
        const count = SPATIAL_WISPS * (Number.isFinite(frame.wisp) ? Math.min(1, Math.max(0, frame.wisp)) : 0);
        u.uWispCount.value = count > 0.01 ? count : 0;
        u.uWispPresence.value = Math.min(1, presence);
    }

    /** No draw; the next shown update releases every wisp anew. */
    hide(): void {
        this.mesh.visible = false;
        this.fresh = true;
    }

    /** Release on the emergence circle, outside the particles; the flight ends before the player. */
    private releaseOne(k: number): number {
        const frame = this.releaseFrame, out = this.release.array as Float32Array;
        this.released = true;
        if (!frame) { out[k * 4 + 3] = 0; return 1; }
        const release = spatialRelease(this.seeds.wisp[k * 4 + 1], spatialEmergenceTangent(frame.tubeSpread), this.releaseRange, frame.travelRate,
            WISP_RADIUS_RANGE_METERS[0], WISP_RADIUS_RANGE_METERS[1], this.scratch);
        const reachable = release.shown && release.distance > WISP_END_METERS + WISP_DISSOLVE_METERS;
        out[k * 4] = release.distance;
        out[k * 4 + 1] = release.radius;
        out[k * 4 + 2] = WISP_DRIFT_RADIANS * (hash01(k, 7) < 0.5 ? -1 : 1);
        out[k * 4 + 3] = reachable ? 1 : 0;
        return reachable ? 1 - WISP_END_METERS / release.distance : 1;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.removeFromParent();
    }
}
