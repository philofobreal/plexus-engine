export interface WormholeGrainCharacter {
    /** Stable rank used to admit only a small subset into a kick-reactive swarm. */
    swarmRank: number;
    /** Shared phase groups nearby reactions without moving the whole field as one plate. */
    swarmPhase: number;
    /** Independent LOW_DROP cohort rank; it must not alias the kick cohort. */
    lowDropRank: number;
    lowDropPhase: number;
    /** Per-grain flow identity; prevents a shared angular transform of the tunnel. */
    flowPhase: number;
    flowRate: number;
    flowDirection: number;
    alphaScale: number;
    weightScale: number;
    trailScale: number;
}

/** Constructor-time authoring of a heterogeneous but deterministic dust population. */
export function createWormholeGrainCharacter(seed: number): WormholeGrainCharacter {
    const kind = pseudoNoise(seed, 71.3);
    const nuance = pseudoNoise(seed, 79.1);
    let alphaScale: number;
    let weightScale: number;
    let trailScale: number;

    if (kind < 0.56) {
        // Fine dust: most of the field remains quiet and lightweight.
        alphaScale = 0.52 + nuance * 0.3;
        weightScale = 0.5 + nuance * 0.28;
        trailScale = 0.68 + nuance * 0.28;
    } else if (kind < 0.9) {
        // Body grains carry the readable tunnel structure.
        alphaScale = 0.86 + nuance * 0.34;
        weightScale = 0.82 + nuance * 0.38;
        trailScale = 0.9 + nuance * 0.38;
    } else {
        // Sparse sparks punctuate the field without turning every grain into a highlight.
        alphaScale = 1.22 + nuance * 0.42;
        weightScale = 1.3 + nuance * 0.55;
        trailScale = 0.46 + nuance * 0.28;
    }

    const cohort = Math.floor(pseudoNoise(seed, 83.7) * 9);
    return {
        swarmRank: pseudoNoise(seed, 91.9),
        swarmPhase: cohort * 0.93 + pseudoNoise(seed, 97.1) * 0.48,
        lowDropRank: pseudoNoise(seed, 131.7),
        lowDropPhase: pseudoNoise(seed, 137.9) * Math.PI * 2,
        flowPhase: pseudoNoise(seed, 103.3) * Math.PI * 2,
        flowRate: 0.004 + pseudoNoise(seed, 109.7) * 0.012,
        flowDirection: pseudoNoise(seed, 113.9) < 0.5 ? -1 : 1,
        alphaScale,
        weightScale,
        trailScale
    };
}

/** Dominant route arc radius in world-distance units. Larger values produce broader, slower turns. */
const ARC_RADIUS = 9000;
const VIEWER_HEADING_DISTANCE = 2600;
const VIEWER_HEADING_GAIN = 0.24;
const VIEWER_HEADING_PROGRESS_LIMIT = 0.7;
const VIEWER_RELATIVE_OFFSET_LIMIT = 0.8;
const VIEWER_RELATIVE_TANGENT_LIMIT = 0.7;
const TWO_PI = Math.PI * 2;
const ROUTE_DEPTH_FADE_FLOOR = 0.78;

export interface WormholeRouteSample {
    offsetX: number;
    offsetY: number;
    tangentX: number;
    tangentY: number;
}

/**
 * Individual angular advection. Warp controls the spread of trajectories, not a
 * shared rotation matrix, so the field reads as a current made of independent grains.
 * The phase advances with how far the grain has travelled toward the camera (depth), never
 * with wall-clock time, so a grain holding roughly the same depth never wobbles back and forth.
 */
export function wormholeGrainFlowAngle(
    character: WormholeGrainCharacter,
    depthT: number,
    authoredWarp: number,
    authoredCurve: number,
    bassWarp: number
): number {
    const curve = clamp01(authoredCurve);
    if (curve <= 0) return 0;
    const forwardProgress = 1 - clamp01(depthT);
    const warp = clamp01(authoredWarp / 2.6);
    const characterRate = 1.25 + character.flowRate * 60 + character.flowPhase / TWO_PI * 0.35;
    const signedRate = characterRate * character.flowDirection;
    const amplitude = curve * (0.04 + warp * 0.12 + clamp01(bassWarp) * 0.08);
    return forwardProgress * signedRate * amplitude;
}

/**
 * Samples the deterministic route centreline and its analytic local tangent. The route is a single
 * smooth arc segment in distance space, not a hashed cell field; bend scales only the sampled
 * centreline amplitude and cannot change the route's curvature cadence.
 *
 * `out` is intentionally optional: callers outside the render loop get the requested three-argument
 * object API, while the renderer supplies preallocated storage and remains allocation-free.
 */
export function sampleWormholeRoute(
    routeDistance: number,
    depthT: number,
    bend: number,
    out?: WormholeRouteSample
): WormholeRouteSample {
    const result = out ?? { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    const amount = clamp01(bend);
    if (amount <= 0) {
        // Literal positive zero preserves the exact straight baseline, including after a prior
        // nonzero sample reused the same output object.
        result.offsetX = 0;
        result.offsetY = 0;
        result.tangentX = 0;
        result.tangentY = 0;
        return result;
    }
    return sampleWormholeRouteWithScale(routeDistance, amount * wormholeRouteDepthScale(depthT), result);
}

/**
 * Samples the same deterministic centerline without the tunnel's mild foreground depth fade.
 * Deep backgrounds therefore retain the full route cue instead of weakening at the lens/horizon.
 */
export function sampleWormholeBackgroundRoute(
    routeDistance: number,
    bend: number,
    out?: WormholeRouteSample
): WormholeRouteSample {
    const result = out ?? { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    const amount = clamp01(bend);
    if (amount <= 0) {
        result.offsetX = 0;
        result.offsetY = 0;
        result.tangentX = 0;
        result.tangentY = 0;
        return result;
    }
    return sampleWormholeRouteWithScale(routeDistance, amount, result);
}

/** Compatibility scalar for callers that only need one centreline component. */
export function wormholePathOffset(routeDistance: number, depthT: number, bend: number, axis: 0 | 1): number {
    const sample = sampleWormholeRoute(routeDistance, depthT, bend);
    return axis === 0 ? sample.offsetX : sample.offsetY;
}

/**
 * Expresses a world-route sample in the viewer's local route frame. Subtracting the viewer sample
 * removes whole-tube screen drift; the bounded first-order tangent term aligns the visible tunnel
 * with the viewer heading without camera roll, horizon motion, or a global screen transform.
 */
export function wormholeViewerRelativeRoute(
    route: WormholeRouteSample,
    viewerRoute: WormholeRouteSample,
    routeDistanceDelta: number,
    out?: WormholeRouteSample
): WormholeRouteSample {
    const result = out ?? { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    const distance = Number.isFinite(routeDistanceDelta) ? routeDistanceDelta : 0;
    const headingProgress = clamp(
        distance / VIEWER_HEADING_DISTANCE,
        -VIEWER_HEADING_PROGRESS_LIMIT,
        VIEWER_HEADING_PROGRESS_LIMIT
    );
    const headingScale = headingProgress * VIEWER_HEADING_GAIN;
    result.offsetX = clamp(
        route.offsetX - viewerRoute.offsetX - viewerRoute.tangentX * headingScale,
        -VIEWER_RELATIVE_OFFSET_LIMIT,
        VIEWER_RELATIVE_OFFSET_LIMIT
    );
    result.offsetY = clamp(
        route.offsetY - viewerRoute.offsetY - viewerRoute.tangentY * headingScale,
        -VIEWER_RELATIVE_OFFSET_LIMIT,
        VIEWER_RELATIVE_OFFSET_LIMIT
    );
    result.tangentX = clamp(
        route.tangentX - viewerRoute.tangentX,
        -VIEWER_RELATIVE_TANGENT_LIMIT,
        VIEWER_RELATIVE_TANGENT_LIMIT
    );
    result.tangentY = clamp(
        route.tangentY - viewerRoute.tangentY,
        -VIEWER_RELATIVE_TANGENT_LIMIT,
        VIEWER_RELATIVE_TANGENT_LIMIT
    );
    return result;
}

export interface WormholeScreenPoint {
    x: number;
    y: number;
}

/** How far ahead of the viewer's own position the background route is sampled to derive the
 * viewer's own lateral world offset. Matches the grain-side viewer lookahead so both systems agree
 * on where "ahead" means. */
const BACKGROUND_VIEWER_LOOKAHEAD = 1100;

export interface WormholeViewerFrame {
    /** The viewer's own lateral world offset (unitless route units, not yet screen-scaled). */
    offsetX: number;
    offsetY: number;
    headingX: number;
    headingY: number;
    /** Kept for compatibility/diagnostics; backgrounds no longer rotate the whole world. */
    turnAngle: number;
}

const backgroundRouteScratch: WormholeRouteSample = { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };

/**
 * The viewer's own lateral position in the background route field at a given travel distance: a
 * pure function of `routeDistance` and `bend`, so identical inputs always reproduce the identical
 * frame and scrubbing to any timestamp needs no replay. Sampling this once per frame -- not once
 * per background object -- is what makes every star/galaxy/skybox tile move as a single coherent
 * world instead of each object reading its own noisy, uncorrelated route sample (see
 * documents/audits/wormhole-travel-and-path-bend-plan.md).
 *
 * The frame carries both the viewer's arc position and the same arc's local tangent. Backgrounds use
 * that tangent for trail correlation/debugging, while the actual image motion comes from translating
 * world coordinates before projection. There is deliberately no whole-world roll/rotation.
 */
export function sampleWormholeBackgroundViewerFrame(
    routeDistance: number,
    bend: number,
    out?: WormholeViewerFrame
): WormholeViewerFrame {
    const result = out ?? { offsetX: 0, offsetY: 0, headingX: 0, headingY: 0, turnAngle: 0 };
    if (clamp01(bend) <= 0) {
        result.offsetX = 0;
        result.offsetY = 0;
        result.headingX = 0;
        result.headingY = 0;
        result.turnAngle = 0;
        return result;
    }
    const routeSample = sampleWormholeBackgroundRoute(
        routeDistance + BACKGROUND_VIEWER_LOOKAHEAD,
        bend,
        backgroundRouteScratch
    );
    result.offsetX = routeSample.offsetX;
    result.offsetY = routeSample.offsetY;
    result.headingX = routeSample.tangentX;
    result.headingY = routeSample.tangentY;
    result.turnAngle = 0;
    return result;
}

/**
 * Projects a fixed world position into the viewer's route-following frame by applying the viewer's
 * canonical arc offset in raw world units before the caller's own perspective divide. This keeps the
 * cosmos flowing with the route parallax without rotating the entire sky as a screen/world plate.
 */
export function wormholeBackgroundWorldRelative(
    worldX: number,
    worldY: number,
    viewerFrame: WormholeViewerFrame,
    worldScale: number,
    out?: WormholeScreenPoint
): WormholeScreenPoint {
    const result = out ?? { x: 0, y: 0 };
    result.x = worldX + viewerFrame.offsetX * worldScale;
    result.y = worldY + viewerFrame.offsetY * worldScale;
    return result;
}

/** Wider near-plane guard: cull the closest zone, then smoothstep to full visibility. */
export function wormholeNearPlaneVisibility(depth: number, maxDepth: number): number {
    const horizon = Math.max(1, Number.isFinite(maxDepth) ? maxDepth : 1);
    const nearCull = Math.max(60, horizon * 0.015);
    const nearFull = Math.max(nearCull + 1, horizon * 0.055);
    const progress = clamp01((depth - nearCull) / (nearFull - nearCull));
    return progress * progress * (3 - 2 * progress);
}

/** Hard ceiling for projected grain thickness, including kick/material amplification. */
export function wormholeProjectedStrokeWeight(weight: number): number {
    return Math.min(4.5, Math.max(0, Number.isFinite(weight) ? weight : 0));
}

/** Scale for a projected trail vector; avoids unbounded near-plane screen streaks. */
export function wormholeProjectedTrailScale(dx: number, dy: number, viewportHeight: number): number {
    const length = Math.hypot(dx, dy);
    const maxLength = Math.max(24, Math.max(1, viewportHeight) * 0.22);
    return length > maxLength ? maxLength / length : 1;
}

/**
 * Fraction of the route-local head radial vector that must be removed from a trail tail so grain
 * flow cannot reverse inside the tube cross-section. Returns zero for a valid trail.
 */
export function wormholeBackwardTrailCorrection(
    headX: number,
    headY: number,
    tailX: number,
    tailY: number
): number {
    const headLengthSq = headX * headX + headY * headY;
    if (headLengthSq <= 1e-9) return 0;
    const backwardProjection = (tailX - headX) * headX + (tailY - headY) * headY;
    return backwardProjection > 0 ? backwardProjection / headLengthSq : 0;
}

/**
 * Selects a discontinuous kick-reactive cohort. Authored jitter controls how many
 * grains may join; zero jitter means no swarm reaction, and no kick means no motion.
 */
export function wormholeKickSwarmGain(
    character: WormholeGrainCharacter,
    kickJitter: number,
    authoredJitter: number
): number {
    const kick = clamp01(kickJitter);
    const participation = clamp01(authoredJitter) * 0.34;
    if (kick < 0.04 || participation <= 0 || character.swarmRank >= participation) return 0;
    const rankShape = 1 - character.swarmRank / participation;
    return kick * (0.45 + rankShape * 0.55);
}

/** Travel distance (not time) over which a release impulse settles back to baseline. */
const KICK_RELEASE_DECAY_DISTANCE = 46;
/** LOW_DROP fractures linger longer than a kick, but still decay by distance, never by clock time. */
const LOWDROP_RELEASE_DECAY_DISTANCE = 170;

/**
 * Monotonic decay keyed to travel distance since a grain's release. It only ever shrinks as the
 * grain moves forward, so a released grain settles once and never wobbles back and forth.
 */
export function wormholeReleaseEnvelope(distanceSinceRelease: number, decayDistance: number): number {
    const distance = Math.max(0, Number.isFinite(distanceSinceRelease) ? distanceSinceRelease : 0);
    return Math.exp(-distance / Math.max(1, decayDistance));
}

export function wormholeKickReleaseEnvelope(distanceSinceRelease: number): number {
    return wormholeReleaseEnvelope(distanceSinceRelease, KICK_RELEASE_DECAY_DISTANCE);
}

export function wormholeLowDropReleaseEnvelope(distanceSinceRelease: number): number {
    return wormholeReleaseEnvelope(distanceSinceRelease, LOWDROP_RELEASE_DECAY_DISTANCE);
}

/** Admission for the LOW_DROP family, deliberately disjoint from the kick cohort. */
export function wormholeLowDropGain(character: WormholeGrainCharacter, envelope: number): number {
    const gain = clamp01(envelope);
    if (gain <= 0 || character.lowDropRank >= 0.28 || character.swarmRank < 0.34) return 0;
    return gain * (1 - character.lowDropRank / 0.28);
}

/** Variant-specific material response; capped so the family stays local and readable. */
export function wormholeLowDropMaterialGain(gain: number, variant: number): number {
    const value = clamp01(gain);
    if (variant % 6 === 3) return 1 + value * 0.8; // trail snap
    if (variant % 6 === 5) return Math.max(0, 1 - value * 0.82); // emission fracture
    return 1;
}

/** Continuous depth visibility profile: zero at horizon/lens and strongest mid-flight. */
export function wormholeVisibilityFloor(depthT: number): number {
    const t = clamp01(depthT);
    return 8 * Math.pow(Math.sin(Math.PI * t), 1.35);
}

function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function sampleWormholeRouteWithScale(
    routeDistance: number,
    scale: number,
    out: WormholeRouteSample
): WormholeRouteSample {
    const distance = Math.max(0, Number.isFinite(routeDistance) ? routeDistance : 0);
    const theta = distance / ARC_RADIUS;
    out.offsetX = (1 - Math.cos(theta)) * scale;
    out.offsetY = Math.sin(theta) * scale;
    out.tangentX = Math.sin(theta) * scale;
    out.tangentY = Math.cos(theta) * scale;
    return out;
}

function wormholeRouteDepthScale(depthT: number): number {
    const depth = clamp01(depthT);
    return ROUTE_DEPTH_FADE_FLOOR + (1 - ROUTE_DEPTH_FADE_FLOOR) * Math.sin(Math.PI * depth);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
