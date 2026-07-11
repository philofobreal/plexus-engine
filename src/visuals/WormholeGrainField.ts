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

/** One authored bend spans many travel seconds; the turn field never expires at long song times. */
const ROUTE_ARC_LENGTH = 18000;
export const ROUTE_MAX_HEADING = 0.88;
export const ROUTE_CURVATURE = ROUTE_MAX_HEADING / ROUTE_ARC_LENGTH;
const ROUTE_CURVATURE_EASE_DISTANCE = 980;
/** Faster distance-domain response for continuous counter-steering and stopping. */
const ROUTE_COUNTER_EASE_DISTANCE = 180;
/** Distance over which the runtime steering controller aims the camera at a new authored heading. */
const ROUTE_HEADING_RESPONSE_DISTANCE = 900;
/** Numerical dead-zone: once both heading error and curvature are below these limits, snap cleanly. */
const ROUTE_HEADING_EPSILON = 1e-4;
/** Heading window that continuously raises recentring authority toward the straight target. */
const RECENTER_FLOOR_WINDOW = 0.2;
const ROUTE_INTEGRATION_MAX_STEP = 90;
const ROUTE_INTEGRATION_MAX_STEPS = 512;
const ROUTE_DISTANCE_EPSILON = 1e-5;
const ROUTE_ZERO_CURVATURE = 1e-8;
/** Explicit screen-readable gain for route centerline drift only; radial tube points stay unscaled. */
export const ROUTE_TURN_VISUAL_GAIN = 4;
const TWO_PI = Math.PI * 2;
const ROUTE_DEPTH_FADE_FLOOR = 0.78;

export interface WormholeRouteSample {
    offsetX: number;
    offsetY: number;
    tangentX: number;
    tangentY: number;
}

export interface WormholeRouteFrame {
    positionX: number;
    positionY: number;
    tangentX: number;
    tangentY: number;
    normalX: number;
    normalY: number;
    headingAngle: number;
    curvature: number;
    turnIntensity: number;
}

export interface WormholeRouteFrameWithDistance extends WormholeRouteFrame {
    distance: number;
    /** Runtime samples expose their authored steering target so look-ahead cannot over-turn. */
    targetHeading?: number;
}

export interface WormholeRouteState extends WormholeRouteFrameWithDistance {
    targetCurvature: number;
    targetHeading: number;
    initialized: boolean;
}

const routeOffsetFrameScratch: WormholeRouteFrame = {
    positionX: 0, positionY: 0,
    tangentX: 0, tangentY: 1,
    normalX: 1, normalY: 0,
    headingAngle: 0, curvature: 0, turnIntensity: 0
};

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
 * Samples the deterministic route centreline and its analytic local tangent. The route is a
 * sign-preserving long arc in distance space, not a hashed cell field or periodic meander; bend
 * scales only the sampled centreline amplitude and cannot introduce a separate route identity.
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
    const amount = clampSignedUnit(bend);
    if (amount === 0) {
        // Literal positive zero preserves the exact straight baseline, including after a prior
        // nonzero sample reused the same output object.
        result.offsetX = 0;
        result.offsetY = 0;
        result.tangentX = 0;
        result.tangentY = 0;
        return result;
    }
    return sampleWormholeRouteOffset(routeDistance, amount * wormholeRouteDepthScale(depthT), result);
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
    const amount = clampSignedUnit(bend);
    if (amount === 0) {
        result.offsetX = 0;
        result.offsetY = 0;
        result.tangentX = 0;
        result.tangentY = 0;
        return result;
    }
    return sampleWormholeRouteOffset(routeDistance, amount, result);
}

/**
 * Analytic route integration: heading follows a continuous constant-curvature turn field instead
 * of resolving into a finite one-shot arc. Position is the closed-form integral of that heading, so
 * route sampling stays continuous across preset morphs, seeks, and long playback times without a
 * history-dependent accumulator.
 */
function wormholeIntegratedRoute(
    distance: number,
    amount: number,
    out: WormholeRouteFrame
): void {
    const heading = wormholeRouteHeading(distance, amount);
    const curvature = amount * ROUTE_CURVATURE;
    if (Math.abs(heading) < 1e-4) {
        const h2 = heading * heading;
        out.positionX = distance * (heading * 0.5 - heading * h2 / 24);
        out.positionY = distance * (1 - h2 / 6 + h2 * h2 / 120);
    } else {
        out.positionX = (1 - Math.cos(heading)) / curvature;
        out.positionY = Math.sin(heading) / curvature;
    }
    out.headingAngle = heading;
}

/**
 * Samples the travelled wormhole route as a local frame. The position is the integrated path in a
 * top-down route plane; tangent/normal are normalized and heading is continuous. Renderers should
 * transform points through this frame instead of adding route offsets in screen space.
 */
export function sampleWormholeRouteFrame(
    routeDistance: number,
    bend: number,
    out?: WormholeRouteFrame
): WormholeRouteFrame {
    const result = out ?? {
        positionX: 0, positionY: 0,
        tangentX: 0, tangentY: 1,
        normalX: 1, normalY: 0,
        headingAngle: 0, curvature: 0, turnIntensity: 0
    };
    const distance = Math.max(0, Number.isFinite(routeDistance) ? routeDistance : 0);
    const amount = clampSignedUnit(bend);
    if (amount === 0 || distance <= 0) {
        result.positionX = 0;
        result.positionY = distance;
        result.tangentX = 0;
        result.tangentY = 1;
        result.normalX = 1;
        result.normalY = 0;
        result.headingAngle = 0;
        result.curvature = 0;
        result.turnIntensity = 0;
        return result;
    }

    wormholeIntegratedRoute(distance, amount, result);

    const heading = result.headingAngle;
    result.tangentX = Math.sin(heading);
    result.tangentY = Math.cos(heading);
    result.normalX = result.tangentY;
    result.normalY = -result.tangentX;
    result.curvature = wormholeRouteCurvature(distance, amount);
    const turnT = clamp01(distance / ROUTE_ARC_LENGTH);
    result.turnIntensity = Math.abs(amount) * (turnT * turnT * (3 - 2 * turnT));
    return result;
}

export function createWormholeRouteState(): WormholeRouteState {
    return {
        distance: 0,
        positionX: 0,
        positionY: 0,
        tangentX: 0,
        tangentY: 1,
        normalX: 1,
        normalY: 0,
        headingAngle: 0,
        curvature: 0,
        targetCurvature: 0,
        targetHeading: 0,
        turnIntensity: 0,
        initialized: false
    };
}

export function copyWormholeRouteFrame(
    source: WormholeRouteFrame,
    out?: WormholeRouteFrame
): WormholeRouteFrame {
    const result = out ?? {
        positionX: 0, positionY: 0,
        tangentX: 0, tangentY: 1,
        normalX: 1, normalY: 0,
        headingAngle: 0, curvature: 0, turnIntensity: 0
    };
    result.positionX = source.positionX;
    result.positionY = source.positionY;
    result.tangentX = source.tangentX;
    result.tangentY = source.tangentY;
    result.normalX = source.normalX;
    result.normalY = source.normalY;
    result.headingAngle = source.headingAngle;
    result.curvature = source.curvature;
    result.turnIntensity = source.turnIntensity;
    return result;
}

export function resetWormholeRouteState(
    state: WormholeRouteState,
    routeDistance: number,
    bend: number,
    out?: WormholeRouteFrame
): WormholeRouteFrame {
    const distance = safeRouteDistance(routeDistance);
    const targetHeading = wormholeBendToHeading(bend);
    const curvature = wormholeSteeringCurvature(0, targetHeading);
    state.distance = distance;
    state.positionX = 0;
    state.positionY = distance;
    state.headingAngle = 0;
    state.curvature = curvature;
    state.targetCurvature = curvature;
    state.targetHeading = targetHeading;
    state.initialized = true;
    updateWormholeRouteFrameBasis(state);
    return copyWormholeRouteFrame(state, out);
}

/**
 * Deterministic converged steering state for (distance, bend): the state a long stable playthrough
 * at this bend would already be in by `distance`, instead of the always-heading-0 straight baseline
 * `resetWormholeRouteState` uses. Pure function of (distance, bend); no history, no integration loop.
 *
 * Under constant bend the runtime steering integrator's asymptotic heading follows the pure route
 * heading (`amount * ROUTE_CURVATURE * distance`) until it reaches the bounded authored target
 * (`amount * ROUTE_MAX_HEADING`), after which heading holds at the target and curvature settles to
 * zero (the steering error is then zero). `sign` is carried separately so a future signed bend
 * (left/right turns) stays correct; today's bend is clamped to [0,1] so sign is always +.
 *
 * The absolute route position is irrelevant -- every consumer differentiates two sampled route
 * positions rather than reading position directly -- so position is set on the same straight-ahead
 * baseline as `resetWormholeRouteState` (positionX=0, positionY=distance).
 */
export function resetWormholeRouteStateConverged(
    state: WormholeRouteState,
    routeDistance: number,
    bend: number,
    out?: WormholeRouteFrame
): WormholeRouteFrame {
    const distance = safeRouteDistance(routeDistance);
    const sign = bend < 0 ? -1 : 1;
    const magnitude = clamp01(Math.abs(bend));
    const targetHeading = sign * magnitude * ROUTE_MAX_HEADING;
    const pureHeadingMagnitude = magnitude * ROUTE_CURVATURE * distance;
    const heading = sign * Math.min(magnitude * ROUTE_MAX_HEADING, pureHeadingMagnitude);
    const curvature = wormholeSteeringCurvature(heading, targetHeading);

    state.distance = distance;
    state.positionX = 0;
    state.positionY = distance;
    state.headingAngle = heading;
    state.curvature = curvature;
    state.targetCurvature = curvature;
    state.targetHeading = targetHeading;
    state.initialized = true;
    updateWormholeRouteFrameBasis(state);
    return copyWormholeRouteFrame(state, out);
}

export function advanceWormholeRouteState(
    state: WormholeRouteState,
    routeDistance: number,
    bend: number,
    out?: WormholeRouteFrame
): WormholeRouteFrame {
    const distance = safeRouteDistance(routeDistance);
    const targetHeading = wormholeBendToHeading(bend);
    if (!state.initialized || distance < state.distance - ROUTE_DISTANCE_EPSILON) {
        return resetWormholeRouteState(state, distance, bend, out);
    }

    state.targetHeading = targetHeading;
    const targetCurvature = wormholeSteeringCurvature(state.headingAngle, targetHeading);
    state.targetCurvature = targetCurvature;
    const deltaDistance = distance - state.distance;
    if (deltaDistance > ROUTE_DISTANCE_EPSILON) {
        integrateWormholeRouteState(state, deltaDistance, targetCurvature);
    } else {
        // A preset can change while song distance is momentarily stationary (paused manual
        // audition, a quantized clock frame, or the first automation frame). Publish the new
        // steering curvature immediately so look-ahead samples react without moving the camera.
        state.curvature = targetCurvature;
        if (
            Math.abs(state.targetHeading - state.headingAngle) < ROUTE_HEADING_EPSILON
            && Math.abs(state.curvature) < ROUTE_ZERO_CURVATURE
        ) {
            state.headingAngle = state.targetHeading;
            state.curvature = 0;
        }
        updateWormholeRouteFrameBasis(state);
    }

    return copyWormholeRouteFrame(state, out);
}

export function sampleWormholeRouteStateFrame(
    routeState: WormholeRouteFrameWithDistance,
    routeDistance: number,
    out?: WormholeRouteFrame
): WormholeRouteFrame {
    const result = out ?? {
        positionX: 0, positionY: 0,
        tangentX: 0, tangentY: 1,
        normalX: 1, normalY: 0,
        headingAngle: 0, curvature: 0, turnIntensity: 0
    };
    const distance = safeRouteDistance(routeDistance);
    const deltaDistance = distance - routeState.distance;
    const curvature = Math.abs(routeState.curvature) < ROUTE_ZERO_CURVATURE ? 0 : routeState.curvature;
    result.curvature = curvature;

    if (Math.abs(deltaDistance) <= ROUTE_DISTANCE_EPSILON) {
        return copyWormholeRouteFrame(routeState, result);
    }

    const targetHeading = Number.isFinite(routeState.targetHeading)
        ? routeState.targetHeading!
        : null;
    const distanceToTarget = targetHeading !== null && curvature !== 0
        ? (targetHeading - routeState.headingAngle) / curvature
        : Number.POSITIVE_INFINITY;

    if (curvature === 0) {
        result.positionX = routeState.positionX + routeState.tangentX * deltaDistance;
        result.positionY = routeState.positionY + routeState.tangentY * deltaDistance;
        result.headingAngle = routeState.headingAngle;
    } else if (deltaDistance > 0 && distanceToTarget >= 0 && distanceToTarget < deltaDistance) {
        // Follow the current arc only until the bounded authored heading is reached, then continue
        // straight along that tangent. Extrapolating current curvature through a 30k-unit galaxy
        // look-ahead would otherwise create a hidden multi-revolution route and screen teleports.
        const heading0 = routeState.headingAngle;
        const headingAtTarget = targetHeading!;
        const arcX = (Math.cos(heading0) - Math.cos(headingAtTarget)) / curvature;
        const arcY = (Math.sin(headingAtTarget) - Math.sin(heading0)) / curvature;
        const straightDistance = deltaDistance - distanceToTarget;
        result.positionX = routeState.positionX + arcX + Math.sin(headingAtTarget) * straightDistance;
        result.positionY = routeState.positionY + arcY + Math.cos(headingAtTarget) * straightDistance;
        result.headingAngle = headingAtTarget;
        result.curvature = 0;
    } else {
        const heading0 = routeState.headingAngle;
        const heading1 = heading0 + curvature * deltaDistance;
        result.positionX = routeState.positionX + (Math.cos(heading0) - Math.cos(heading1)) / curvature;
        result.positionY = routeState.positionY + (Math.sin(heading1) - Math.sin(heading0)) / curvature;
        result.headingAngle = heading1;
    }

    updateWormholeRouteFrameBasis(result);
    return result;
}

/** Returns the centerline-only drift gain used by foreground and background projections. */
export function wormholeRouteTurnVisualGain(bend: number): number {
    const amount = Math.abs(clampSignedUnit(bend));
    if (amount <= 0) return 0;
    return ROUTE_TURN_VISUAL_GAIN;
}

/** Compatibility scalar for callers that only need one centreline component. */
export function wormholePathOffset(routeDistance: number, depthT: number, bend: number, axis: 0 | 1): number {
    const sample = sampleWormholeRoute(routeDistance, depthT, bend);
    return axis === 0 ? sample.offsetX : sample.offsetY;
}

export interface WormholeTubeProjection {
    screenX: number;
    screenY: number;
}

export interface WormholeTransitionEnergy {
    angularOffset: number;
    radiusScale: number;
    alphaScale: number;
    strokeScale: number;
    amplitude: number;
}

/**
 * Projects a point on the wormhole tube's circular cross-section (`radius`, `theta`) at route
 * distance `distanceNow + z` into camera-local screen space, given the camera's own route frame at
 * `distanceNow`. Both circle axes get identical treatment: the grain's own radial contribution (what
 * actually draws the circle) is projected at full strength through the camera's normal/tangent
 * basis, and the vertical axis (`radialY`) never rotates with heading since the route only turns in
 * its own horizontal plane -- there is no camera roll. Only the route-curvature drift between the
 * point's route position and the camera's route position -- identical for every point at this depth
 * regardless of angle -- may be damped by `routeDriftWeight`, which keeps the tube's visual centroid
 * anchored through a turn without ever biasing the circle's shape (a uniform per-axis scale on the
 * combined radial+drift delta is what turned the circle into a fixed-ratio ellipse; splitting the
 * two terms and damping only the shared one cannot). `verticalDrift` is the optional, independent
 * screen-Y steering integrator's own centerline drift (Task 08): it never rotates the cross-section
 * either, it only adds a second, orthogonal drift term to `localY` under the same depth-damped
 * weight, so a diagonal (horizontal + vertical) bend still translates the whole circle rather than
 * shearing it.
 */
export function projectWormholeTubePoint(
    routeNow: WormholeRouteFrame,
    baseRouteNow: WormholeRouteFrame,
    z: number,
    theta: number,
    radius: number,
    routeDriftWeight: number,
    cx: number,
    cy: number,
    fov: number,
    verticalDrift: number = 0
): WormholeTubeProjection {
    const radialX = radius * Math.cos(theta);
    const radialY = radius * Math.sin(theta);
    const radialWorldX = radialX * routeNow.normalX;
    const radialWorldY = radialX * routeNow.normalY;
    const routeDriftX = routeNow.positionX - baseRouteNow.positionX;
    const routeDriftY = routeNow.positionY - baseRouteNow.positionY;
    const depthDriftWeight = routeDriftWeight * wormholeRouteProjectionDepthGain(z);
    const localX = radialWorldX * baseRouteNow.normalX + radialWorldY * baseRouteNow.normalY
        + (routeDriftX * baseRouteNow.normalX + routeDriftY * baseRouteNow.normalY) * depthDriftWeight;
    const localY = radialY + verticalDrift * depthDriftWeight;
    const deltaX = radialWorldX + routeDriftX;
    const deltaY = radialWorldY + routeDriftY;
    const localZ = Math.max(z * 0.68, deltaX * baseRouteNow.tangentX + deltaY * baseRouteNow.tangentY);
    return {
        screenX: cx + localX / localZ * fov,
        screenY: cy + localY / localZ * fov
    };
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
 * Ring compression is an authored "just emerged from the far plane" accent, not a persistent
 * structure across a grain's whole visible flight: it decays by travelled distance since release
 * exactly like kick/low-drop, so a fully ring-snapped preset still settles into smooth continuous
 * depth for the bulk of each grain's generation instead of showing discrete rings throughout.
 */
const RING_RELEASE_DECAY_DISTANCE = 220;

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

export function wormholeRingReleaseEnvelope(distanceSinceRelease: number): number {
    return wormholeReleaseEnvelope(distanceSinceRelease, RING_RELEASE_DECAY_DISTANCE);
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

/**
 * Per-grain local energy used only during preset/route morphs. It returns tube-local angular/radial
 * offsets plus material flicker scales; callers apply the geometry before route projection and apply
 * the material scales only to alpha/stroke. The seed controls every phase, so there is no shared
 * camera or whole-frame blink channel.
 */
export function wormholeTransitionEnergy(
    seed: number,
    timeSec: number,
    morphEnvelope: number,
    bandEnergy: number,
    depthT: number
): WormholeTransitionEnergy {
    const envelope = clamp01(morphEnvelope);
    const depthGain = Math.pow(1 - clamp01(depthT), 0.72);
    const spectralGain = 0.32 + clamp01(bandEnergy) * 0.68;
    const amplitude = envelope * spectralGain * depthGain;
    if (amplitude <= 1e-6) {
        return { angularOffset: 0, radiusScale: 1, alphaScale: 1, strokeScale: 1, amplitude: 0 };
    }

    const safeTime = Number.isFinite(timeSec) ? timeSec : 0;
    const phaseA = safeTime * (1.7 + pseudoNoise(seed, 151.1) * 2.3) + pseudoNoise(seed, 157.3) * TWO_PI;
    const phaseB = safeTime * (2.9 + pseudoNoise(seed, 163.7) * 3.1) + pseudoNoise(seed, 167.9) * TWO_PI;
    const phaseC = safeTime * (4.1 + pseudoNoise(seed, 173.5) * 2.7) + pseudoNoise(seed, 179.2) * TWO_PI;
    const swirl = Math.sin(phaseA) * 0.68 + Math.sin(phaseB) * 0.32;
    const radial = Math.sin(phaseB + phaseC * 0.23) * 0.72 + Math.sin(phaseC) * 0.28;
    const flicker = Math.sin(phaseC) * 0.62 + Math.sin(phaseA + phaseB * 0.17) * 0.38;

    return {
        angularOffset: swirl * 0.085 * amplitude,
        radiusScale: Math.max(0.72, 1 + radial * 0.12 * amplitude),
        alphaScale: Math.max(0.72, 1 + flicker * 0.22 * amplitude),
        strokeScale: Math.max(0.82, 1 + (radial * 0.55 + flicker * 0.45) * 0.14 * amplitude),
        amplitude
    };
}

function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function sampleWormholeRouteOffset(
    routeDistance: number,
    scale: number,
    out: WormholeRouteSample
): WormholeRouteSample {
    const frame = sampleWormholeRouteFrame(routeDistance, scale, routeOffsetFrameScratch);
    const distance = Math.max(0, Number.isFinite(routeDistance) ? routeDistance : 0);
    out.offsetX = frame.positionX;
    out.offsetY = frame.positionY - distance;
    out.tangentX = frame.tangentX;
    out.tangentY = frame.tangentY - 1;
    return out;
}

function wormholeRouteHeading(distance: number, amount: number): number {
    return amount * ROUTE_CURVATURE * Math.max(0, distance);
}

function wormholeRouteCurvature(distance: number, amount: number): number {
    if (distance <= 0) return 0;
    return amount * ROUTE_CURVATURE;
}

function wormholeBendToHeading(bend: number): number {
    return clampSignedUnit(bend) * ROUTE_MAX_HEADING;
}

/**
 * Converts an authored bend into bounded steering rather than an endless turn-rate command.
 * Positive bend aims toward a readable right-hand route heading; reducing bend produces the
 * opposite curvature needed to return to the new target. In particular bend=0 recentres to the
 * exact straight baseline instead of preserving a heading accumulated by an earlier preset.
 */
function wormholeSteeringCurvature(heading: number, targetHeading: number): number {
    const error = targetHeading - heading;
    if (Math.abs(error) < ROUTE_HEADING_EPSILON) return 0;
    const recenterFloor = 0.18 + 0.54 * (
        1 - clamp01(Math.abs(targetHeading) / RECENTER_FLOOR_WINDOW)
    );
    const authority = clamp01(Math.max(
        Math.abs(targetHeading) / ROUTE_MAX_HEADING,
        Math.abs(error) / ROUTE_MAX_HEADING,
        // Preserve enough counter-steering authority for a predictable exit from a hero turn.
        // Without this floor authority shrinks with the residual error and recentring takes an
        // effectively unbounded distance, which makes a later straight preset look broken.
        recenterFloor
    ));
    const maxCurvature = ROUTE_CURVATURE * authority;
    return Math.min(maxCurvature, Math.max(-maxCurvature, error / ROUTE_HEADING_RESPONSE_DISTANCE));
}

function integrateWormholeRouteState(
    state: WormholeRouteState,
    deltaDistance: number,
    _initialTargetCurvature: number
): void {
    const steps = Math.max(
        1,
        Math.min(ROUTE_INTEGRATION_MAX_STEPS, Math.ceil(deltaDistance / ROUTE_INTEGRATION_MAX_STEP))
    );
    const stepDistance = deltaDistance / steps;

    for (let i = 0; i < steps; i++) {
        const targetCurvature = wormholeSteeringCurvature(state.headingAngle, state.targetHeading);
        state.targetCurvature = targetCurvature;
        const curvature0 = state.curvature;
        const isCounterSteering = targetCurvature * curvature0 < 0
            || (targetCurvature === 0 && curvature0 !== 0);
        const curvatureEaseDistance = isCounterSteering
            ? ROUTE_COUNTER_EASE_DISTANCE
            : ROUTE_CURVATURE_EASE_DISTANCE;
        const curvatureEase = 1 - Math.exp(-stepDistance / curvatureEaseDistance);
        let curvature1 = curvature0 + (targetCurvature - curvature0) * curvatureEase;
        if (targetCurvature === 0 && Math.abs(curvature1) < ROUTE_ZERO_CURVATURE) curvature1 = 0;
        const heading0 = state.headingAngle;
        let segmentCurvature = (curvature0 + curvature1) * 0.5;
        let heading1 = heading0 + segmentCurvature * stepDistance;
        const error0 = state.targetHeading - heading0;
        const error1 = state.targetHeading - heading1;
        if (error0 !== 0 && error0 * error1 <= 0) {
            heading1 = state.targetHeading;
            curvature1 = 0;
            segmentCurvature = (heading1 - heading0) / stepDistance;
        }

        if (Math.abs(segmentCurvature) < ROUTE_ZERO_CURVATURE) {
            const headingMid = (heading0 + heading1) * 0.5;
            state.positionX += Math.sin(headingMid) * stepDistance;
            state.positionY += Math.cos(headingMid) * stepDistance;
        } else {
            state.positionX += (Math.cos(heading0) - Math.cos(heading1)) / segmentCurvature;
            state.positionY += (Math.sin(heading1) - Math.sin(heading0)) / segmentCurvature;
        }

        state.headingAngle = heading1;
        state.curvature = curvature1;
        state.distance += stepDistance;

        if (
            Math.abs(state.targetHeading - state.headingAngle) < ROUTE_HEADING_EPSILON
            && Math.abs(state.curvature) < ROUTE_ZERO_CURVATURE
        ) {
            state.headingAngle = state.targetHeading;
            state.curvature = 0;
            state.targetCurvature = 0;
        }
    }

    state.distance = safeRouteDistance(state.distance);
    updateWormholeRouteFrameBasis(state);
}

function updateWormholeRouteFrameBasis(frame: WormholeRouteFrame): void {
    if (Math.abs(frame.curvature) < ROUTE_ZERO_CURVATURE) frame.curvature = 0;
    const heading = frame.headingAngle;
    frame.tangentX = Math.sin(heading);
    frame.tangentY = Math.cos(heading);
    frame.normalX = frame.tangentY;
    frame.normalY = -frame.tangentX;
    frame.turnIntensity = ROUTE_CURVATURE > 0
        ? clamp01(Math.abs(frame.curvature) / ROUTE_CURVATURE)
        : 0;
}

function safeRouteDistance(routeDistance: number): number {
    return Math.max(0, Number.isFinite(routeDistance) ? routeDistance : 0);
}

function wormholeRouteDepthScale(depthT: number): number {
    const depth = clamp01(depthT);
    return ROUTE_DEPTH_FADE_FLOOR + (1 - ROUTE_DEPTH_FADE_FLOOR) * Math.sin(Math.PI * depth);
}

function wormholeRouteProjectionDepthGain(z: number): number {
    const t = clamp01((z - 2400) / 1000);
    const smooth = t * t * (3 - 2 * t);
    return 1 - smooth * 0.2;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/** Signed path-bend range: negative is left, positive is right, mirror-symmetric around zero. */
export function clampSignedUnit(value: number): number {
    return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
}

export interface WormholePathBendPair {
    bendH: number;
    bendV: number;
}

/**
 * Combines the independent horizontal/vertical path-bend integrators' authored intensities into a
 * diagonal turn: each is clamped to its own [-1, 1] range first, then if their combined magnitude
 * (`hypot`) exceeds 1 both are scaled down by the same factor so the overall turn intensity stays
 * comparable to any single-axis (1D) preset instead of compounding past it.
 */
export function combinedWormholePathBend(bendH: number, bendV: number): WormholePathBendPair {
    const h = clampSignedUnit(bendH);
    const v = clampSignedUnit(bendV);
    const magnitude = Math.hypot(h, v);
    if (magnitude <= 1) return { bendH: h, bendV: v };
    const scale = 1 / magnitude;
    return { bendH: h * scale, bendV: v * scale };
}
