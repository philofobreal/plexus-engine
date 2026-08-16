/**
 * Pure material response for the wormhole refractive membrane wall layer: Fresnel-style edge
 * brightness, spectral sector energy mapping, and the chromatic refraction fringe offset. Every
 * function here is a deterministic function of its numeric arguments; none allocates, none reads
 * route/camera state, and the spectrum channel drives only alpha/refraction/ripple-speed -- never
 * radius (radius is owned exclusively by `WormholeWallGeometry`'s ripple and, later, pressure waves).
 */

import { wormholeNearPlaneVisibility } from './WormholeGrainField';

const TWO_PI = Math.PI * 2;

/** Same 24-sector convention the grain field uses, so the wall lights up in lockstep with it. */
const DEFAULT_BAND_COUNT = 24;

/** Chromatic fringe only appears on the brightest ~20-30% of intensity, per the membrane-wall plan. */
const CHROMATIC_INTENSITY_THRESHOLD = 0.72;

/** Threshold/soft-edge for `wormholeWallClumpGain`: calibrated (see the geometry-overhaul plan,
 *  T2) so roughly 40-60% of the (theta, advected-depth) domain is fully extinguished, with a
 *  narrow smoothstep transition so the surviving segments read as soft-edged light clumps instead
 *  of hard-edged cutouts. */
const CLUMP_THRESHOLD = 0.5;
const CLUMP_SOFT_EDGE = 0.04;

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function wrap01(value: number): number {
    const safe = Number.isFinite(value) ? value : 0;
    return ((safe % 1) + 1) % 1;
}

/**
 * Depth-only edge-brightness falloff: 1 at the camera, monotonically decreasing to 0 at the
 * horizon. Deliberately excludes the near-plane cull ramp (that safety guard is
 * `wormholeNearPlaneVisibility`, reused as-is below) so this piece stays a single monotone curve.
 */
export function wormholeWallDepthEdgeGain(z: number, maxZ: number): number {
    const horizon = Math.max(1, Number.isFinite(maxZ) ? maxZ : 1);
    const depthT = clamp01((Number.isFinite(z) ? z : 0) / horizon);
    return Math.pow(1 - depthT, 1.4);
}

/**
 * Fresnel-style material brightness: near-plane safety cull/ramp (reused from the grain field)
 * times the depth edge-brightness falloff above. Near, large-projected-radius rings read brighter;
 * the far wall fades toward the horizon.
 */
export function wormholeWallFresnel(z: number, maxZ: number): number {
    return wormholeNearPlaneVisibility(z, maxZ) * wormholeWallDepthEdgeGain(z, maxZ);
}

/**
 * Maps a wall angular position to the same spectral band index the grain field uses
 * (`bandIndex = floor(theta / 2*PI * bandCount)`), so wall sector brightness lines up bit-exactly
 * with the grain circular spectrograph instead of drifting out of phase with it.
 */
export function wormholeWallBandIndex(theta: number, bandCount: number = DEFAULT_BAND_COUNT): number {
    const count = Math.max(1, Math.floor(Number.isFinite(bandCount) ? bandCount : DEFAULT_BAND_COUNT));
    const normalized = wrap01((Number.isFinite(theta) ? theta : 0) / TWO_PI);
    // A tiny epsilon nudge absorbs the floating-point error that otherwise lands an exact band
    // boundary (e.g. theta = TWO_PI/24 * 2) one index low (1.9999999999999998 instead of 2).
    return Math.min(count - 1, Math.floor(normalized * count + 1e-9));
}

export interface WormholeWallSectorResponse {
    alphaGain: number;
    refractionGain: number;
    rippleSpeedGain: number;
}

/**
 * Shapes the alpha, chromatic-refraction, and ripple-scroll-speed channels from a sector's live
 * band energy. Radius is never touched here -- ripple/wave amplitude is owned entirely by
 * `WormholeWallGeometry`/`WormholeWallWaves`, so a bright sector cannot pump the tube outward.
 */
export function wormholeWallSectorResponse(bandEnergy: number): WormholeWallSectorResponse {
    const energy = clamp01(bandEnergy);
    return {
        alphaGain: 0.35 + energy * 0.65,
        refractionGain: 0.4 + energy * 0.6,
        rippleSpeedGain: 0.8 + energy * 0.6
    };
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
    if (!(edge1 > edge0)) return x < edge0 ? 0 : 1;
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

/**
 * Deterministic, spatially-coherent field over (theta, advected-depth-phase) in [0,1]: three fixed
 * sine harmonics at different angular/depth frequencies, weighted to sum to unity so the field
 * never leaves [0,1]. Unlike per-segment independent noise, this varies smoothly across
 * neighbouring segments and rings, so thresholding it (`wormholeWallClumpGain`) produces
 * soft-edged clumps of several contiguous segments -- "light smeared across glass" -- instead of a
 * flickering static texture. Takes the *advected* depth phase (the same one
 * `WormholeWallGeometry`'s ripple/caustics use), so the clump pattern flows with the wall instead
 * of sitting still while everything else moves. Every depth-phase frequency is an integer
 * multiple of `TWO_PI`, so the field (and the gate built on it) is exactly periodic with period 1
 * in `advectedDepthPhase` -- consistent with `wormholeWallAdvectedPhase` itself wrapping every
 * one full `WALL_ADVECTION_HORIZON` of travel.
 */
export function wormholeWallClumpField(theta: number, advectedDepthPhase: number): number {
    const safeTheta = Number.isFinite(theta) ? theta : 0;
    const safePhase = Number.isFinite(advectedDepthPhase) ? advectedDepthPhase : 0;
    const a = Math.sin(safeTheta * 5 + safePhase * TWO_PI * 3 + 1.3);
    const b = Math.sin(safeTheta * 2 + safePhase * TWO_PI * 1 + 4.7);
    const c = Math.sin(safeTheta * 8 + safePhase * TWO_PI * 5 + 2.1);
    const field = a * 0.5 + b * 0.32 + c * 0.18;
    return field * 0.5 + 0.5;
}

/**
 * Gate derived from `wormholeWallClumpField`: 0 across roughly 40-60% of the (theta,
 * advected-depth) domain (fully extinguished segments), smoothly ramping to 1 elsewhere. Spectrum
 * energy must only scale the brightness of an already-lit segment (via `wormholeWallSectorResponse`
 * multiplying alpha *after* this gate) -- it must never shift where the clumps themselves sit, or
 * the wall would flicker with the beat instead of reading as a stable-but-flowing material.
 */
export function wormholeWallClumpGain(theta: number, advectedDepthPhase: number): number {
    const field = wormholeWallClumpField(theta, advectedDepthPhase);
    return smoothstep01(CLUMP_THRESHOLD - CLUMP_SOFT_EDGE, CLUMP_THRESHOLD + CLUMP_SOFT_EDGE, field);
}

export interface WormholeWallChromaticOffset {
    warmX: number;
    warmY: number;
    coolX: number;
    coolY: number;
}

/**
 * Gates the chromatic fringe to intensity-threshold-gated points only (roughly the brightest
 * 20-30%) and to a nonzero authored refraction amount. Returns 0 whenever `wormholeWallRefraction`
 * is 0, regardless of intensity.
 */
export function wormholeWallChromaticGain(intensity: number, refraction: number): number {
    const safeRefraction = clamp01(refraction);
    if (safeRefraction <= 0) return 0;
    const safeIntensity = clamp01(intensity);
    if (safeIntensity <= CHROMATIC_INTENSITY_THRESHOLD) return 0;
    const gated = (safeIntensity - CHROMATIC_INTENSITY_THRESHOLD) / (1 - CHROMATIC_INTENSITY_THRESHOLD);
    return gated * safeRefraction;
}

/**
 * Splits a projected wall point into a warm/cool chromatic pair along its own radial screen
 * direction from the ring center (the ring center is the same point's `radius=0` projection,
 * sampled once per ring by the caller). `offsetPixels` should already include
 * `wormholeWallChromaticGain` and any near-plane/stroke-weight caps; a degenerate (zero-length or
 * non-positive) direction collapses back to the source point instead of producing NaN offsets.
 */
export function wormholeWallChromaticOffset(
    screenX: number,
    screenY: number,
    centerX: number,
    centerY: number,
    offsetPixels: number
): WormholeWallChromaticOffset {
    const safeScreenX = Number.isFinite(screenX) ? screenX : 0;
    const safeScreenY = Number.isFinite(screenY) ? screenY : 0;
    const safeCenterX = Number.isFinite(centerX) ? centerX : 0;
    const safeCenterY = Number.isFinite(centerY) ? centerY : 0;
    const safeOffset = Number.isFinite(offsetPixels) ? offsetPixels : 0;
    const dx = safeScreenX - safeCenterX;
    const dy = safeScreenY - safeCenterY;
    const length = Math.hypot(dx, dy);
    if (!(length > 1e-6) || !(safeOffset > 0)) {
        return { warmX: safeScreenX, warmY: safeScreenY, coolX: safeScreenX, coolY: safeScreenY };
    }
    const nx = dx / length;
    const ny = dy / length;
    return {
        warmX: safeScreenX + nx * safeOffset,
        warmY: safeScreenY + ny * safeOffset,
        coolX: safeScreenX - nx * safeOffset,
        coolY: safeScreenY - ny * safeOffset
    };
}
