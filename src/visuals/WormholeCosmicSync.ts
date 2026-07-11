/**
 * Pure reactivity policy for the cosmic-wormhole background layers: given the current
 * canonical travel rate and turn state, how strongly should a layer respond. Route/turn geometry
 * primitives (route sampling, `turnIntensity`) stay owned by `WormholeGrainField.ts`; the canonical
 * rate itself (transport + authored speed) stays owned by `WormholeTimeline.ts`. This module only
 * turns those already-computed scalars into per-layer trail-separation distances and parallax
 * multipliers, so every layer's cosmos-sync behaviour is derived from exactly one shared place
 * instead of each layer inventing its own. No wall-clock, no frame-count, no per-layer speed
 * constant of its own -- each layer differs only by the ratio its caller already owns.
 */

/** Skybox is the most distant, "infinitely far" layer; its reactivity is deliberately bounded so it
 * can never become a major moving object, only a minimal parallax cue. */
export const SKYBOX_TRAVEL_RATE_CAP = 6;
/** How much a layer's existing lateral-parallax scale may amplify while the route is actively
 * turning, on top of its own fixed scale constant. Bounded and symmetric -- not a corrective or
 * heading-shear term, just "sharper turns read as stronger sideways parallax". */
const PARALLAX_TURN_GAIN = 0.6;
/** The trail cue reads as roughly one ~24fps frame's worth of motion blur behind the canonical
 * rate. One constant shared by every layer -- no per-layer manual multiplier. */
export const WORMHOLE_TRAIL_REFERENCE_SEC = 1 / 24;

/**
 * Trail separation (world units) implied by the canonical rate over one reference interval.
 * `canonicalRate` is the true distance rate (world units/sec) a layer is moving at; `layerRatio` is
 * the same parallax ratio the caller already scales position drift by, so the trail cue and the
 * actual travel it depicts stay proportional at every speed.
 */
export function wormholeTrailSeparation(
    canonicalRate: number,
    layerRatio: number,
    referenceSec: number = WORMHOLE_TRAIL_REFERENCE_SEC
): number {
    const rate = Math.max(0, finiteOr(canonicalRate, 0));
    const ratio = finiteOr(layerRatio, 0);
    const reference = Math.max(0, finiteOr(referenceSec, WORMHOLE_TRAIL_REFERENCE_SEC));
    return rate * ratio * reference;
}

/** Bounded amplitude boost for a layer's existing lateral-scale constant while the route is
 * actively turning. `turnIntensity` is 0 on a straight segment and up to `bend` at the sharpest
 * part of a turn (`sampleWormholeRouteFrame`). */
export function wormholeParallaxStrength(turnIntensity: number): number {
    return 1 + clamp01(turnIntensity) * PARALLAX_TURN_GAIN;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}
