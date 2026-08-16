/**
 * Pure geometry for the wormhole refractive membrane wall layer: ring/segment layout, the
 * rippling membrane grid, and the analytic caustic helix curves. Every value here is a
 * deterministic function of (theta, ring index, travelDistance); nothing reads or writes route
 * heading, camera state, or wall-clock time, and nothing allocates. `CosmicWormholeIdentity` owns
 * every scratch buffer and route/camera frame -- this module only turns those inputs into numbers.
 */

const TWO_PI = Math.PI * 2;

export const WALL_SEGMENTS = 48;
export const WALL_RINGS = 16;
export const WALL_SEGMENTS_PERFORMANCE = 24;
export const WALL_RINGS_PERFORMANCE = 10;

/** 4-6 analytic caustic helices per the membrane-wall plan; 5 gives a readable, non-mechanical set. */
export const WALL_CAUSTIC_COUNT = 5;

/** Ripple stays subtle (<=3% of tube radius) so it reads as glass-like waver, not a wobbling tube. */
export const WALL_RIPPLE_MAX_AMPLITUDE = 0.03;

/**
 * Reference horizon for the wall material's advection: matches `Z_REFERENCE` (the grain
 * generation horizon) in `CosmicWormholeIdentity.ts`, duplicated here the same way the wall's
 * band-count convention is duplicated in `WormholeWallMaterial.ts` (`DEFAULT_BAND_COUNT`). One
 * full horizon of travelDistance must advect the wall material through exactly one full
 * depth-phase cycle, so a fixed ring's material always reads as flowing at the same rate a grain
 * crosses the tube -- never slower, never on an independently tuned clock.
 */
export const WALL_ADVECTION_HORIZON = 1000;

function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function wrap01(value: number): number {
    const safe = Number.isFinite(value) ? value : 0;
    return ((safe % 1) + 1) % 1;
}

/**
 * The material-identity phase of whatever wall texture currently occupies a fixed ring
 * (`ringDepthPhase`) at `travelDistance`. Mirrors `depthFromPhase`'s own
 * `wrapDepthPhase(grainPhase - travelPhase)` relationship in `WormholeDepth.ts`, inverted to solve
 * for the phase given a fixed world position instead of a fixed grain identity: a texture
 * element's identity phase grows with travelDistance, so at a fixed ring it appears to arrive from
 * the far plane (depthPhase 1) and advect toward the camera (depthPhase 0) as travelDistance
 * grows -- the same direction, and over one full `WALL_ADVECTION_HORIZON` the same rate, a grain's
 * own world position advances. Exported so sibling wall modules (e.g. the clump-mask gate in
 * `WormholeWallMaterial.ts`) can share the exact same advected phase a ring's ripple/caustics
 * already use, instead of re-deriving it or drifting out of sync with it.
 */
export function wormholeWallAdvectedPhase(ringDepthPhase: number, travelDistance: number): number {
    const safeDepthPhase = Number.isFinite(ringDepthPhase) ? ringDepthPhase : 0;
    const safeTravel = Number.isFinite(travelDistance) ? travelDistance : 0;
    return wrap01(safeDepthPhase + safeTravel / WALL_ADVECTION_HORIZON);
}

export function wormholeWallSegmentCount(performanceMode: boolean): number {
    return performanceMode ? WALL_SEGMENTS_PERFORMANCE : WALL_SEGMENTS;
}

export function wormholeWallRingCount(performanceMode: boolean): number {
    return performanceMode ? WALL_RINGS_PERFORMANCE : WALL_RINGS;
}

/** Segment index -> fixed angular position, theta=0 at segment 0, evenly spaced around the tube. */
export function wormholeWallSegmentTheta(segmentIndex: number, segmentCount: number): number {
    const count = Math.max(1, Math.floor(Number.isFinite(segmentCount) ? segmentCount : 1));
    const index = Number.isFinite(segmentIndex) ? segmentIndex : 0;
    return (index / count) * TWO_PI;
}

/** Ring index -> immutable normalized depth phase in (0,1]; ring identity never wraps or recycles. */
export function wormholeWallRingDepthPhase(ringIndex: number, ringCount: number): number {
    const count = Math.max(1, Math.floor(Number.isFinite(ringCount) ? ringCount : 1));
    const safeIndex = Number.isFinite(ringIndex) ? Math.floor(ringIndex) : 0;
    const index = Math.max(0, Math.min(count - 1, safeIndex));
    return (index + 0.5) / count;
}

/**
 * Ring index -> fixed camera-space depth. Unlike grains, wall rings never travel: their z stays
 * pinned to this phase-of-horizon position every frame. The flowing-wall impression comes only from
 * the ripple/caustic phase terms below scrolling with `travelDistance`, so no ring ever needs
 * regeneration or reuse bookkeeping the way the grain pool does.
 */
export function wormholeWallRingZ(ringIndex: number, ringCount: number, maxZ: number): number {
    const horizon = Math.max(1, Number.isFinite(maxZ) ? maxZ : 1);
    return wormholeWallRingDepthPhase(ringIndex, ringCount) * horizon;
}

/**
 * Small-amplitude two-component sine ripple, returned as a signed fraction of tube radius bounded
 * to +-`WALL_RIPPLE_MAX_AMPLITUDE`. A pure function of (theta, ringDepthPhase, travelDistance); it
 * never reads or writes route heading, and it is the only sanctioned radius channel besides pressure
 * waves -- material layers must not feed spectrum energy into radius. Both harmonics advect through
 * the fixed ring stack at the same `WALL_ADVECTION_HORIZON`-anchored rate (`wormholeWallAdvectedPhase`)
 * and share the same theta-rotation sign, so they reinforce a single wave travelling toward the
 * camera instead of two harmonics spinning against each other into a standing-wave wobble. Both
 * depth-frequency multipliers (2 and 3) are deliberately whole numbers: `wormholeWallAdvectedPhase`
 * wraps at integer boundaries, and `Math.sin` is exactly `TWO_PI`-periodic, so a wrap discontinuity
 * only ever cancels out cleanly when it lands on an integer multiple of a full turn -- a fractional
 * multiplier here would turn that same wrap into a real, visible angular tear (see the caustic
 * twist term below, which cannot avoid a fractional rate and so must stay unwrapped instead).
 */
export function wormholeWallRippleOffset(theta: number, ringDepthPhase: number, travelDistance: number): number {
    const safeTheta = Number.isFinite(theta) ? theta : 0;
    const advectedPhase = wormholeWallAdvectedPhase(ringDepthPhase, travelDistance);
    const phaseA = safeTheta * 3 + advectedPhase * TWO_PI * 2;
    const phaseB = safeTheta * 5 + advectedPhase * TWO_PI * 3;
    const wave = Math.sin(phaseA) * 0.62 + Math.sin(phaseB) * 0.38;
    return wave * WALL_RIPPLE_MAX_AMPLITUDE;
}

interface WormholeWallCausticParams {
    readonly baseTheta: number;
    readonly twistRate: number;
    readonly driftRate: number;
}

/**
 * Upper bound on a caustic helix's twist, in full turns across the whole depth horizon
 * (geometry-overhaul plan T3). The membrane-wall plan's original 1.4-3.6 turn range was tuned for
 * a smooth analytic curve but was only ever *sampled* at the 16 coarse membrane rings, so it read
 * as a jagged few-point polygon rather than a spiral. Capping the authored twist keeps every
 * dense-sampled helix (see `CosmicWormholeIdentity`'s `drawCaustics`) visually readable even
 * before considering sample density.
 */
export const WALL_CAUSTIC_MAX_TURNS = 1.5;
const WALL_CAUSTIC_MIN_TURNS = 0.5;

/** Seeded once from the caustic's own index, at module load -- no Math.random, no shared mutable state. */
const CAUSTIC_PARAMS: ReadonlyArray<WormholeWallCausticParams> = Object.freeze(
    Array.from({ length: WALL_CAUSTIC_COUNT }, (_unused, index) => {
        const seed = index + 1;
        const direction = pseudoNoise(seed, 23.1) < 0.5 ? -1 : 1;
        const turns = WALL_CAUSTIC_MIN_TURNS
            + pseudoNoise(seed, 17.9) * (WALL_CAUSTIC_MAX_TURNS - WALL_CAUSTIC_MIN_TURNS);
        return Object.freeze({
            baseTheta: pseudoNoise(seed, 11.3) * TWO_PI,
            twistRate: turns * direction * TWO_PI,
            driftRate: 0.00025 + pseudoNoise(seed, 29.7) * 0.00045
        });
    })
);

function clampCausticIndex(causticIndex: number): number {
    const safeIndex = Number.isFinite(causticIndex) ? Math.floor(causticIndex) : 0;
    return Math.max(0, Math.min(WALL_CAUSTIC_COUNT - 1, safeIndex));
}

/**
 * Caustic helix theta as a pure function of (depthPhase, travelDistance) for a caustic index in
 * [0, WALL_CAUSTIC_COUNT). Each helix's base phase, twist rate, and sign are seeded once from its
 * index so the set reads as visually distinct while every value stays reproducible from the index
 * alone, matching the analytic-not-simulated helix requirement in the membrane-wall plan. The
 * twist term's dominant motion is the same camera-ward material advection every other wall layer
 * shares, but computed *unwrapped* here rather than through `wormholeWallAdvectedPhase`: the twist
 * rate is a deliberately fractional multiple of `TWO_PI` (`WALL_CAUSTIC_MIN/MAX_TURNS` is not a
 * whole number, for a smooth spiral rather than a whole-turn one), so wrapping the phase first --
 * safe for the ripple's integer-frequency harmonics, see `wormholeWallRippleOffset` -- would
 * introduce a real, visible angular tear once per generation wherever the wrap boundary happens to
 * fall. `Math.cos`/`Math.sin` downstream in `projectWormholeTubePoint` are exactly periodic for
 * any real theta, so an unbounded-growing phase is every bit as continuous as a wrapped one, with
 * no tear. `driftRate` only adds a slow, independent whole-helix rotation on top, never the
 * primary motion cue.
 */
export function wormholeWallCausticTheta(causticIndex: number, depthPhase: number, travelDistance: number): number {
    const params = CAUSTIC_PARAMS[clampCausticIndex(causticIndex)];
    const safeDepthPhase = Number.isFinite(depthPhase) ? depthPhase : 0;
    const safeTravel = Number.isFinite(travelDistance) ? travelDistance : 0;
    const advectedPhase = safeDepthPhase + safeTravel / WALL_ADVECTION_HORIZON;
    return params.baseTheta + params.twistRate * advectedPhase + params.driftRate * safeTravel;
}
