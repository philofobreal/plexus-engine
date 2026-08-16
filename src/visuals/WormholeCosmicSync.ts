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
/** Reference transport rate used only to normalize the visual smear response. The trail still
 * starts from the canonical world-units/sec rate; this bounded gain makes fast passages stretch
 * more decisively than slow ones without introducing a frame-rate dependency. */
export const WORMHOLE_SMEAR_RATE_REFERENCE = 240;
const WORMHOLE_SMEAR_RATE_GAIN_PER_REFERENCE = 0.35;
const WORMHOLE_SMEAR_RATE_MAX_GAIN = 2.2;
const WORMHOLE_LENS_SMEAR_MAX_GAIN = 1.65;
const WORMHOLE_LENS_SMEAR_FULL_RATE = 720;

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

/**
 * Bounded multiplier for the background streak separation. Multiplying the existing linear
 * separation by this monotonic gain gives fast sections their light-whip character while keeping
 * the canonical rate and the caller-owned layer ratio as the only motion inputs.
 */
export function wormholeSmearRateGain(canonicalRate: number): number {
    const rate = Math.max(0, finiteOr(canonicalRate, 0));
    return Math.min(
        WORMHOLE_SMEAR_RATE_MAX_GAIN,
        1 + (rate / WORMHOLE_SMEAR_RATE_REFERENCE) * WORMHOLE_SMEAR_RATE_GAIN_PER_REFERENCE
    );
}

/**
 * Extra screen-space streak gain inside the lens radius. Squared distance keeps the per-star hot
 * path free of square roots. The gain is one at/outside the ring and remains bounded at its center;
 * spectrum never enters this geometry channel.
 */
export function wormholeLensSmearGain(
    distanceSquared: number,
    lensRadius: number,
    canonicalRate: number
): number {
    const radius = Math.max(0, finiteOr(lensRadius, 0));
    if (radius <= 0) return 1;
    const radiusSquared = radius * radius;
    const safeDistanceSquared = Math.max(0, finiteOr(distanceSquared, radiusSquared));
    const proximity = clamp01(1 - safeDistanceSquared / radiusSquared);
    if (proximity <= 0) return 1;
    const rateDrive = clamp01(Math.max(0, finiteOr(canonicalRate, 0)) / WORMHOLE_LENS_SMEAR_FULL_RATE);
    return 1 + proximity * rateDrive * (WORMHOLE_LENS_SMEAR_MAX_GAIN - 1);
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
