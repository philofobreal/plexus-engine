import { getBackgroundClearStyle, hueToRgbInto, shouldUseExpensiveGlow } from '../config/visualTuning';
import { featureFlags } from '../config/featureFlags';
import { State } from '../state/store';
import type { VisualTuningConfig } from '../types';
import type { Particle } from './Particle';
import type { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';
import type { VisualIdentity } from './VisualIdentity';
import { depthFromPhase, depthWithCoherence, wrapDepthPhase } from './WormholeDepth';
import { wormholeEmissionGain } from './WormholeEmission';
import { wormholeDepthDiagnostics } from './WormholeDiagnostics';
import {
    advanceWormholeRouteState,
    combinedWormholePathBend,
    copyWormholeRouteFrame,
    createWormholeRouteState,
    createWormholeGrainCharacter,
    wormholeBackwardTrailCorrection,
    wormholeGrainFlowAngle,
    wormholeKickReleaseEnvelope,
    wormholeKickSwarmGain,
    wormholeLowDropGain,
    wormholeLowDropMaterialGain,
    wormholeLowDropReleaseEnvelope,
    wormholeRingReleaseEnvelope,
    wormholeNearPlaneVisibility,
    wormholeProjectedStrokeWeight,
    wormholeProjectedTrailScale,
    wormholeRouteTurnVisualGain,
    wormholeTransitionEnergy,
    projectWormholeTubePoint,
    ROUTE_CURVATURE,
    ROUTE_MAX_HEADING,
    resetWormholeRouteState,
    resetWormholeRouteStateConverged,
    sampleWormholeRouteStateFrame,
    type WormholeRouteFrame,
    type WormholeRouteFrameWithDistance,
    wormholeVisibilityFloor
} from './WormholeGrainField';
import { computeWormholeMotionProfile } from './WormholeMotionProfile';
import {
    effectiveWormholeGeometryValue,
    WORMHOLE_DEPTH_LFO_PHASE_OFFSET,
} from './WormholeGeometryLfo';
import {
    canonicalWormholeTime,
    WormholeAuthoredSpeedTimeline,
    WormholeTransport,
    wormholeKickEnvelopeAtTime,
    wormholeLowDropAtTime
} from './WormholeTimeline';
import {
    wormholeLensSmearGain,
    wormholeParallaxStrength,
    wormholeSmearRateGain,
    wormholeTrailSeparation,
    SKYBOX_TRAVEL_RATE_CAP
} from './WormholeCosmicSync';
import {
    WALL_CAUSTIC_COUNT,
    WALL_RINGS,
    wormholeWallSegmentCount,
    wormholeWallRingCount,
    wormholeWallSegmentTheta,
    wormholeWallRingDepthPhase,
    wormholeWallRingZ,
    wormholeWallRippleOffset,
    wormholeWallCausticTheta,
    wormholeWallAdvectedPhase
} from './WormholeWallGeometry';
import {
    wormholeWallFresnel,
    wormholeWallBandIndex,
    wormholeWallSectorResponse,
    wormholeWallChromaticGain,
    wormholeWallChromaticOffset,
    wormholeWallClumpGain
} from './WormholeWallMaterial';
import {
    createWormholeWallWaveFrontPool,
    wormholeWallGatherWaveFronts,
    wormholeWallWaveOffset,
    type WormholeWallWaveFront
} from './WormholeWallWaves';
import {
    WALL_CRACK_COUNT,
    wormholeWallCrackPointCount,
    wormholeWallCrackPoint,
    wormholeWallCrackEmission
} from './WormholeWallCracks';
import {
    MOSAIC_SEGMENTS,
    wormholeMosaicRingCount,
    wormholeMosaicTickHalfWidth
} from './WormholeWallMosaic';
import {
    wormholeLensWarpPoint,
    wormholeLensMagnificationGain,
    wormholeLensNearAxisVisibility,
    wormholeLensSecondaryPoint,
    wormholeLensSecondaryGain,
    type WormholeLensWarpPoint
} from './WormholeLensWarp';
import {
    accumulateWormholeGrainCarrier,
    clearWormholeGrainMaterialBuffers,
    resolveWormholeGrainMaterial,
    resolveWormholeGrainMaterialRasterSize,
    type ResolvedWormholeGrainCarrier,
    type WormholeGrainMaterialRasterSize
} from './wormholeGrainMaterialRaster';

const TWO_PI = Math.PI * 2;
const BANDS = 24;
const DEPTH_LAYERS = 15;
/** One grain per (band, depth layer) in one copy of the field. */
const COPY_SIZE = BANDS * DEPTH_LAYERS;
/**
 * Opt-in density copies (spiral material plan S5). Copy 0 occupies pool indices `0..COPY_SIZE-1`
 * with the unchanged seed/theta/depth-phase formulas, so the default active set is exactly the
 * historical field. Higher `wormholeGrainDensity` activates further copies; the draw loop is
 * bounded by the active count, so the default path does no extra work.
 */
const GRAIN_COPIES_MAX = 4;
/** Fixed dust pool, allocated once in the constructor (GC-safe). */
const POOL_SIZE = COPY_SIZE * GRAIN_COPIES_MAX;
/** Density-wave shaping constants for the spiral arms (plan S2). */
const ARM_TWIST_RATIO = 0.7;
const ARM_CONTRAST = 0.55;
const ARM_SHARPNESS = 1.7;
/** Weave neighbour caps (plan S4): screen length cap and Hermite subdivision of one arm link. */
const WEAVE_MAX_LENGTH_FRACTION = 0.14;
const WEAVE_BEND = 0.45;
const WEAVE_SEGMENTS = 2;
/** Ring neighbours only read as a ring in the deeper strata, where grains are close together. */
const WEAVE_RING_MIN_DEPTH = 0.25;
/** Resolved-head record stride: x, y, alpha, weight, r, g, b, depth, seed, generation, phase, energy,
 *  plus the grain's own resolved trail tangent, which is the local arm direction. */
const WEAVE_STRIDE = 14;
/** Reference horizon distance at depth = 1; the live horizon is this scaled by wormholeDepth. */
const Z_REFERENCE = 1000;
/** Membrane wall (Phase 4 of the refractive membrane wall plan): same base tube radius as grains. */
const WALL_BASE_RADIUS = 50;
/** Base alpha stays low; the Fresnel edge (near-camera brightness) is what carries the read. Kept
 *  lower than the pre-clump-mask value (geometry-overhaul plan T2): with the wireframe gone, the
 *  clump-gated arcs themselves carry the read, and a low base keeps them reading as smeared light
 *  rather than a still-visible faint outline. */
const WALL_ALPHA_SCALE = 120;
const WALL_CHROMATIC_HUE_SHIFT = 18;
const WALL_CHROMATIC_MAX_OFFSET_PX = 3;
/** Caustic hero layer (Phase 6 of the wall plan): brighter/thicker than the base membrane grid. */
const WALL_CAUSTIC_ALPHA_SCALE = 200;
const WALL_CAUSTIC_WEIGHT_SCALE = 1.3;
/** Performance mode keeps only the brightest couple of helices instead of the full analytic set. */
const WALL_CAUSTIC_PERFORMANCE_COUNT = 2;
/** Einstein-ring light pooling (lens-overhaul plan T6): a stable, seeded set of soft highlights
 * around the lens radius. Performance mode retains only four spots, while the normal path stays
 * within the plan's 8-16 spot budget. */
const EINSTEIN_RING_GLOW_COUNT = 12;
const EINSTEIN_RING_GLOW_COUNT_PERFORMANCE = 4;
const EINSTEIN_RING_SEED = 71.93;
const EINSTEIN_RING_ADVECTION_PER_HORIZON = 0.16;
const EINSTEIN_RING_CANONICAL_DRIFT = 0.025;
const EINSTEIN_RING_ALPHA_SCALE = 0.18;
const EINSTEIN_RING_RADIUS_MIN_PX = 5;
const EINSTEIN_RING_RADIUS_FRACTION = 0.075;
/** Secondary-image pass (true-lens plan F2): `wormholeLensSecondaryGain` is bounded to
 *  `[0, 1.2]` (a plain multiplier), which is far below the stroke-alpha scale (0-255-ish, matching
 *  p5's default color mode) every other line()-based layer in this file uses -- `stroke()`
 *  ultimately routes through p5's own alpha channel, not `radialGlow`'s raw CSS 0-1 alpha, so this
 *  scale must land in the same 0-255-ish range the star loop's own `sAlpha` peaks around (~190) for
 *  the secondary image to read as genuinely present, if fainter, rather than sub-perceptual. */
const LENS_SECONDARY_ALPHA_SCALE = 90;
/** Wall-as-refraction-field (true-lens plan F4): hard ceiling on the combined azimuthal ripple
 *  (`wormholeWallRippleOffset`, capped +-3%) and temporal kick/LOW_DROP swell (`wormholeWallWaveOffset`,
 *  capped +-5%) that perturbs the lens's own Einstein radius per source point. The two evaluators'
 *  own caps already sum to exactly this ceiling; this clamp makes the +-8% invariant explicit and
 *  directly testable rather than an implicit consequence of two unrelated constants elsewhere. */
const LENS_WALL_PERTURBATION_MAX = 0.08;
/** True-lens plan F5: three broad chroma sectors plus one full-annulus exposure breath. */
const LENS_TINT_SECTOR_COUNT = 3;
const LENS_TINT_SECTOR_COUNT_PERFORMANCE = 2;
const LENS_TINT_SMOOTHING_FRAMES = 8;
const LENS_TINT_SATURATION_ALPHA = 0.22;
const LENS_TINT_EXPOSURE_ALPHA = 0.14;
/**
 * Caustic dense-sampling (geometry-overhaul plan T3): a helix's twist is a smooth analytic curve,
 * but the old code only ever sampled it at the 16 (10 in performance mode) coarse membrane rings,
 * so up to 3.6 turns of twist collapsed into a jagged few-point polygon. Sampling far more densely
 * along depth -- independent of the membrane ring count -- keeps the same Nyquist-safe margin the
 * `WALL_CAUSTIC_MAX_TURNS` cap was chosen for (see `WormholeWallGeometry`'s own test) while adding
 * only ~160-200 lines total, well inside the budget the connector removal (T2) freed up.
 */
const WALL_CAUSTIC_SAMPLE_COUNT = 48;
const WALL_CAUSTIC_SAMPLE_COUNT_PERFORMANCE = 32;
/** Peak-only crack flashes (Phase 8 of the wall plan): brighter and thicker than the base membrane. */
const WALL_CRACK_ALPHA_SCALE = 210;
const WALL_CRACK_WEIGHT_SCALE = 1.2;
const WALL_CRACK_CHROMATIC_MAX_OFFSET_PX = 2.4;
/** Pixel-mosaic material mode (Phase 8): converts the shared wave-offset fraction into a per-cell
 *  angular shift instead of a radius bump -- discrete cells have no ripple concept. */
const MOSAIC_SHIFT_RADIANS_PER_UNIT = 2.5;
/** Background parallax universe (near star layer). */
const STAR_COUNT = 1800;
const MAX_STAR_Z = 8000;
const STAR_FIELD_HALF = 6000;
/** True-lens plan F6: extra source material only around the lens axis. The pool is allocated once,
 *  kept separate from the global sky/star pools, and halved by a fixed stride in performance mode. */
export const WORMHOLE_DEEP_FIELD_POINT_COUNT = 800;
export const WORMHOLE_DEEP_FIELD_PERFORMANCE_STRIDE = 2;
const DEEP_FIELD_MAX_BETA_RATIO = 2.5;
const DEEP_FIELD_ADVECTION_PER_HORIZON = 0.022;
const DEEP_FIELD_CANONICAL_DRIFT = 0.006;
/** Star colour-temperature palette (icy blue / white / warm amber / faint cyan) for depth variety. */
const STAR_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
    [180, 205, 255],
    [236, 240, 250],
    [255, 222, 184],
    [172, 230, 240]
];
/** Stars drift at a fraction of the tunnel speed: distant, yet fast enough to read as travel. */
const STAR_SPEED_RATIO = 0.4;
/** Deep galaxy layer: a handful of huge, slow, faint glows that wrap the whole scene. */
const GALAXY_COUNT = 9;
const MAX_GALAXY_Z = 30000;
const GALAXY_FIELD_HALF = 16000;
const GALAXY_SPEED_RATIO = 0.05;
const GALAXY_CORE = 5200;
/**
 * Same near-cull ratio `wormholeNearPlaneVisibility` uses internally. Flooring the *projection*
 * depth (not the depth used for alpha/fade) at this fraction keeps `1/z` finite and bounded through
 * the near-plane zone, where alpha has already faded to zero anyway, instead of letting invisible
 * frames compute an astronomically large (if harmless) screen position.
 */
const NEAR_PROJECTION_FLOOR_RATIO = 0.015;
const STAR_PROJECTION_Z_FLOOR = MAX_STAR_Z * NEAR_PROJECTION_FLOOR_RATIO;
const GALAXY_PROJECTION_Z_FLOOR = MAX_GALAXY_Z * NEAR_PROJECTION_FLOOR_RATIO;
/** Route-drift parallax gain for the near starfield before perspective projection. */
const STAR_ROUTE_WORLD_SCALE = 1;
/** Galaxies use the same route-local frame with a softer route-drift gain. */
const GALAXY_ROUTE_WORLD_SCALE = 0.65;
/** The skybox is a single flat, infinitely-distant plate: no depth to divide by, so its translate
 * is expressed as a small fraction of its own tile radius instead of a world-unit scale. */
const SKYBOX_ROUTE_WORLD_FRACTION = 0.035;
/** Skybox heading pan saturates smoothly instead of hard-clamping, so it keeps following the route
 * through the full authored heading range instead of visibly stopping mid-turn. */
const SKYBOX_PAN_MAX_HEADING = ROUTE_MAX_HEADING;
const SKYBOX_PAN_SOFTNESS = 0.45;
/** Unity slope at heading=0 (matches the old clamp's near-zero behaviour), saturating at this
 * radius instead of `SKYBOX_PAN_MAX_HEADING` itself: `pannedHeading = A * tanh(heading / A)`. */
const SKYBOX_PAN_SATURATION_RADIUS = SKYBOX_PAN_MAX_HEADING * SKYBOX_PAN_SOFTNESS;
/** Bend=0 still gives the skybox a faint, capped, rate-proportional forward streak instead of a
 * perfectly static plate: `k` shrinks the trail start toward the screen center by this fraction. */
export const SKYBOX_FORWARD_CUE_CAP = 0.004;
/**
 * How strongly a grain's *material* (alpha/stroke weight, never its geometry) tracks its own band's
 * live spectrum energy each frame, vs. staying anchored to the value sampled once at its own release.
 * Each grain owns a fixed `bandIndex` mapped to a fixed angular sector (`BANDS` sectors around the
 * tube), so this is not a global pulse: a live spectral peak lights up only the sector(s) whose bands
 * are actually active, and that bright arc migrates around the tube as the active band changes,
 * reading as a circular spectrograph. This is intentionally dominant (not a subtle shimmer): the
 * per-grain *position* (theta, depth, flow) stays release-snapshotted regardless, so the tube's shape
 * cannot pump or breathe with the beat -- only which grains are lit does.
 */
const LIVE_GRAIN_SHIMMER = 0.88;
const GALAXY_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
    [120, 90, 220],
    [60, 120, 220],
    [40, 180, 190],
    [210, 90, 180],
    [220, 150, 90]
];
/** Dense procedural sky plate: faint stars and dust fixed on the distant background. */
const SKYBOX_STAR_COUNT = 9000;
const SKYBOX_TILE_RADIUS = 1.35;
const TRANSITION_DISTURBANCE_DURATION_SEC = 0.72;
const ROUTE_HISTORY_CAPACITY = 360;
const ROUTE_HISTORY_MIN_DISTANCE = 0.05;
const ROUTE_HISTORY_DISTANCE_EPSILON = 1e-5;
/** Must stay within the route history's roughly 1440-unit coverage. */
const ROUTE_TURN_SMOOTHING_DISTANCE = 600;
/**
 * Backward slack tolerated by `IntegratedWormholeRoute.advance` before treating a distance
 * decrease as a seek. 24 units is about a 0.1s seek-jump at the reference travel rate; smaller
 * regressions are rate arithmetic (silent audio + minimum authored speed can make the summed
 * travel rate briefly negative), not a seek. Genuine seeks are handled by `syncPosition`/`reset`.
 */
const ROUTE_BACKWARD_RESET_THRESHOLD = 24;

/**
 * A single stardust grain living in cylinder space: a fixed angular position
 * (`theta`) on the tube wall, a band assignment for spectral reactivity, and a
 * immutable normalized depth phase. Screen position is derived every frame via
 * perspective division, so the object itself is never realloc'd.
 */
interface DustGrain {
    theta: number;
    readonly depthPhase: number;
    bandIndex: number;
    seed: number;
    readonly swarmRank: number;
    readonly swarmPhase: number;
    readonly lowDropRank: number;
    readonly lowDropPhase: number;
    readonly alphaScale: number;
    readonly weightScale: number;
    readonly trailScale: number;
    readonly flowPhase: number;
    readonly flowRate: number;
    readonly flowDirection: number;
    /**
     * Release-time state. `releaseGeneration` is the absolute floor of the grain's unwrapped
     * travel-distance position (`travelDistance / horizon - depthPhase`), so it is a pure function
     * of current distance, never a frame-to-frame delta: an arbitrarily large time step between
     * two draw calls still yields the exact correct generation count, and a generation can never
     * be skipped or miscounted. When it increases, the grain has re-emerged at the far plane and
     * starts a new generation, and the current musical state is sampled once and held fixed until
     * the next crossing. Rendering always reads these plus a distance-since-release decay, never
     * later kick/bass state. Live spectrum is limited to a bounded 12% material shimmer; the main
     * brightness character remains the release-time snapshot.
     */
    releaseGeneration: number;
    releaseDistance: number;
    releaseKick: number;
    releaseBass: number;
    releaseDensity: number;
    releaseBandEnergy: number;
    releaseJitter: number;
    releaseEmission: number;
    releaseVariant: number;
    releaseTrailScale: number;
    releaseRadius: number;
    releaseDepth: number;
    releaseWarp: number;
    releaseCurve: number;
    releaseRing: number;
    releaseDepthCoherence: number;
    releaseGeometryInitialized: boolean;
}

/** A free-floating background star in absolute world space (not bound to the tube). */
interface Star {
    x: number;
    y: number;
    z: number;
    seed: number;
    r: number;
    g: number;
    b: number;
}

/**
 * Lightweight, screen-space source point for the true-lens deep field (F6). `betaRatio` is the
 * unwarped source distance in Einstein-radius units, so a lens-radius morph keeps the whole pool
 * inside the same bounded optical zone without rebuilding or reallocating it.
 */
interface DeepFieldPoint {
    readonly theta: number;
    readonly betaRatio: number;
    readonly driftScale: number;
    readonly size: number;
    readonly alphaScale: number;
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

/** A distant galaxy: a huge, faint, very slow glow in absolute world space far beyond the stars. */
interface Galaxy {
    x: number;
    y: number;
    z: number;
    seed: number;
    r: number;
    g: number;
    b: number;
}

/** A skybox star or dust fleck fixed on the repeated distant sky plate. */
interface SkyStar {
    x: number;
    y: number;
    r: number;
    g: number;
    b: number;
    mag: number;
    size: number;
    haze: number;
    twPhase: number;
}

/**
 * Smooth, monotonic, sign-symmetric replacement for the old hard heading clamp: near-zero heading
 * behaves like a (steeper) linear pan, then saturates continuously toward `SKYBOX_PAN_SATURATION_RADIUS`
 * instead of holding flat once `heading` crosses a fixed threshold. Pure and exported so its shape can
 * be verified directly (monotonicity/continuity) without driving the full renderer.
 */
export function wormholeSkyboxPanHeading(heading: number): number {
    return SKYBOX_PAN_SATURATION_RADIUS * Math.tanh(heading / SKYBOX_PAN_SATURATION_RADIUS);
}

export class CosmicWormholeIdentity implements VisualIdentity {
    readonly id = 'cosmic-wormhole';
    readonly name = 'Cosmic Wormhole';

    private readonly pool: DustGrain[] = [];
    private readonly starPool: Star[] = [];
    private readonly deepFieldPool: DeepFieldPoint[] = [];
    private readonly galaxyPool: Galaxy[] = [];
    private readonly skyPool: SkyStar[] = [];
    private readonly lineColor: [number, number, number] = [0, 0, 0];
    private readonly galaxyColor: [number, number, number] = [0, 0, 0];
    /** Membrane wall (Phase 4): warm/cool chromatic-fringe colors, recomputed once per frame. */
    private readonly wallWarmColor: [number, number, number] = [0, 0, 0];
    private readonly wallCoolColor: [number, number, number] = [0, 0, 0];
    /** Caustic hero layer (Phase 6): bright/low-saturation tint, recomputed once per frame. */
    private readonly causticColor: [number, number, number] = [0, 0, 0];
    /** Einstein-ring light pooling (lens-overhaul plan T6): recomputed once per frame. */
    private readonly einsteinRingColor: [number, number, number] = [0, 0, 0];
    /** F5 annular overlay scratch colors; constructor-owned to keep draw allocation-free. */
    private readonly ringTintColorA: [number, number, number] = [0, 0, 0];
    private readonly ringTintColorB: [number, number, number] = [0, 0, 0];
    private readonly ringTintColorC: [number, number, number] = [0, 0, 0];
    private readonly ringExposureColor: [number, number, number] = [0, 0, 0];
    /** Per-helix previous-sample screen point, so each caustic draws as a continuous polyline. */
    private readonly causticPrevX = new Float64Array(WALL_CAUSTIC_COUNT);
    private readonly causticPrevY = new Float64Array(WALL_CAUSTIC_COUNT);
    private readonly causticPrevValid = new Uint8Array(WALL_CAUSTIC_COUNT);
    /**
     * Membrane ring route-frame cache (geometry-overhaul plan T3): every membrane ring's own
     * already-sampled route frame, kept around after the ring loop so the dense caustic pass can
     * interpolate between them instead of issuing its own `sampleSmoothedLookahead` call per fine
     * depth sample. Sized to `WALL_RINGS` (the largest ring count across performance modes);
     * `drawMembraneGrid` only fills and `drawCaustics` only reads the first `ringCount` entries.
     */
    private readonly wallRingFrames: WormholeRouteFrame[] = Array.from({ length: WALL_RINGS }, createRouteFrame);
    private readonly wallRingVerticalDrift = new Float64Array(WALL_RINGS);
    private readonly wallRingDepthPhase = new Float64Array(WALL_RINGS);
    /** Scratch for the caustic pass's own interpolated (never route-sampled) frame. */
    private readonly causticFrame: WormholeRouteFrame = createRouteFrame();
    /** Event-driven pressure-wave fronts (Phase 5/7): gathered once per frame, read per ring. */
    private readonly waveFronts: WormholeWallWaveFront[] = createWormholeWallWaveFrontPool();
    /** Grain, background, and camera route frames reused in the draw loop. */
    private readonly routeNow: WormholeRouteFrame = createRouteFrame();
    private readonly routePrev: WormholeRouteFrame = createRouteFrame();
    private readonly baseRouteNow: WormholeRouteFrame = createRouteFrame();
    private readonly baseRoutePrev: WormholeRouteFrame = createRouteFrame();
    private readonly routePath = new IntegratedWormholeRoute();
    /**
     * Task 08: a second, independent 2D steering integrator whose lateral axis is the screen-Y axis
     * (instead of the horizontal integrator's screen-X), adding a diagonal drift component without
     * ever rotating the camera (no roll) or touching the horizontal route's forward/z axis. Reuses
     * the exact same scratch-frame-per-section pattern as the horizontal route/background frames
     * above: allocated once, resampled in place across the skybox/galaxy/star/grain sections below.
     */
    private readonly routeNowV: WormholeRouteFrame = createRouteFrame();
    private readonly routePrevV: WormholeRouteFrame = createRouteFrame();
    private readonly baseRouteNowV: WormholeRouteFrame = createRouteFrame();
    private readonly baseRoutePrevV: WormholeRouteFrame = createRouteFrame();
    private readonly routePathVertical = new IntegratedWormholeRoute();
    /**
     * Gravitational lens warp (lens-overhaul plan T5). `lensHorizonFrame`/`lensHorizonFrameV` are
     * dedicated scratch frames for projecting the lens center at the horizon depth once per frame --
     * distinct from `routeNow`/`baseRouteNow` etc. above so this projection never clobbers state
     * those background sections still need later in the same `draw()` call. `lensWarpPointA`/`B` are
     * the reusable, caller-owned output points every per-point `wormholeLensWarpPoint` call below
     * writes into (zero allocation); a single point's own warp uses only `A`, while a two-endpoint
     * streak (prev->now) uses both simultaneously.
     */
    private readonly lensHorizonFrame: WormholeRouteFrame = createRouteFrame();
    private readonly lensHorizonFrameV: WormholeRouteFrame = createRouteFrame();
    private readonly lensWarpPointA: WormholeLensWarpPoint = { x: 0, y: 0 };
    private readonly lensWarpPointB: WormholeLensWarpPoint = { x: 0, y: 0 };
    /**
     * Secondary-image cache (true-lens plan F2): every star's own unwarped now/trail screen
     * position, recorded once per star during the main star loop below so the separate secondary-
     * image pass afterward can read them back without a second route-sampling pass. The main loop's
     * own "exactly one line() call per star, at a stable pool index" invariant must never be
     * touched by F2, so the secondary image draws in its own appended loop instead of interleaving
     * an extra line into the main one.
     */
    private readonly starSxCache = new Float64Array(STAR_COUNT);
    private readonly starSyCache = new Float64Array(STAR_COUNT);
    private readonly starTrailPsxCache = new Float64Array(STAR_COUNT);
    private readonly starTrailPsyCache = new Float64Array(STAR_COUNT);
    private readonly transport = new WormholeTransport();
    private readonly authoredSpeedTimeline = new WormholeAuthoredSpeedTimeline();
    private travelPhase = 0;
    private transitionPulseId: string | null = null;
    private transitionPulseStartedAt = 0;
    /** Single constructor-owned handoff reused by both the legacy line and material accumulator. */
    private readonly grainMaterialCarrier: ResolvedWormholeGrainCarrier = {
        headX: 0, headY: 0, tailX: 0, tailY: 0,
        alpha: 0, strokeWeight: 0,
        colorR: 0, colorG: 0, colorB: 0,
        seed: 0, generation: 0, materialPhase: 0, energy: 0, depth: 0, weave: 0
    };
    /** Second constructor-owned handoff, used only by the weave pass (plan S4). */
    private readonly grainWeaveCarrier: ResolvedWormholeGrainCarrier = {
        headX: 0, headY: 0, tailX: 0, tailY: 0,
        alpha: 0, strokeWeight: 0,
        colorR: 0, colorG: 0, colorB: 0,
        seed: 0, generation: 0, materialPhase: 0, energy: 0, depth: 0, weave: 1
    };
    /**
     * Resolved head record per grain for the weave pass. Filled from the values the grain loop has
     * already produced, so the weave never projects, samples the route, or reads tuning geometry.
     */
    private readonly grainWeaveHeads = new Float32Array(POOL_SIZE * WEAVE_STRIDE);
    private readonly grainWeaveVisible = new Uint8Array(POOL_SIZE);
    /** Highest grain-density copy count materialised so far; the pool never shrinks by itself. */
    private grainCopiesAllocated = 0;
    /** Caller-owned output for viewport raster sizing; avoids a per-frame dimensions object. */
    private readonly grainMaterialRasterSize: WormholeGrainMaterialRasterSize = { cols: 0, rows: 0 };

    constructor() {
        this.growGrainPool(1);
        for (let i = 0; i < STAR_COUNT; i++) {
            const seed = (i + 1) * 7.3148;
            const tint = STAR_PALETTE[Math.floor(pseudoNoise(seed, 44.4) * STAR_PALETTE.length) % STAR_PALETTE.length];
            this.starPool.push({
                x: (pseudoNoise(seed, 11.1) * 2 - 1) * STAR_FIELD_HALF,
                y: (pseudoNoise(seed, 22.2) * 2 - 1) * STAR_FIELD_HALF,
                z: pseudoNoise(seed, 33.3) * MAX_STAR_Z,
                seed,
                r: tint[0],
                g: tint[1],
                b: tint[2]
            });
        }
        for (let i = 0; i < WORMHOLE_DEEP_FIELD_POINT_COUNT; i++) {
            const seed = (i + 1) * 23.417;
            const tint = STAR_PALETTE[
                Math.floor(pseudoNoise(seed, 91.7) * STAR_PALETTE.length) % STAR_PALETTE.length
            ];
            // Bias source material toward the axis: the forward mapping sends these near-axis
            // sources to thetaE, so their aggregate image becomes a dense, continuous light arc.
            // A tiny positive floor avoids the directionless exact beta=0 sample.
            const betaDistribution = Math.pow(pseudoNoise(seed, 37.1), 2.2);
            this.deepFieldPool.push({
                theta: pseudoNoise(seed, 14.3) * TWO_PI,
                betaRatio: 0.04 + betaDistribution * (DEEP_FIELD_MAX_BETA_RATIO - 0.04),
                driftScale: 0.72 + pseudoNoise(seed, 52.6) * 0.56,
                size: 0.45 + pseudoNoise(seed, 68.2) * 1.15,
                alphaScale: 0.45 + pseudoNoise(seed, 79.4) * 0.55,
                r: tint[0],
                g: tint[1],
                b: tint[2]
            });
        }
        for (let i = 0; i < GALAXY_COUNT; i++) {
            const seed = (i + 1) * 19.733;
            const tint = GALAXY_PALETTE[Math.floor(pseudoNoise(seed, 55.5) * GALAXY_PALETTE.length) % GALAXY_PALETTE.length];
            this.galaxyPool.push({
                x: (pseudoNoise(seed, 12.4) * 2 - 1) * GALAXY_FIELD_HALF,
                y: (pseudoNoise(seed, 21.8) * 2 - 1) * GALAXY_FIELD_HALF,
                z: (i + 0.5) / GALAXY_COUNT * MAX_GALAXY_Z,
                seed,
                r: tint[0],
                g: tint[1],
                b: tint[2]
            });
        }
        for (let i = 0; i < SKYBOX_STAR_COUNT; i++) {
            const seed = (i + 1) * 5.219;
            const tint = STAR_PALETTE[Math.floor(pseudoNoise(seed, 66.6) * STAR_PALETTE.length) % STAR_PALETTE.length];
            // Magnitude skewed toward faint specks, with a sparse brighter haze/dust component.
            const mag = Math.pow(pseudoNoise(seed, 77.7), 2.7);
            const haze = Math.pow(pseudoNoise(seed, 88.8), 5.4);
            this.skyPool.push({
                x: pseudoNoise(seed, 1.9) * 2 - 1,
                y: pseudoNoise(seed, 2.8) * 2 - 1,
                r: tint[0],
                g: tint[1],
                b: tint[2],
                mag,
                size: 0.35 + mag * 1.8 + haze * 3.2,
                haze,
                twPhase: pseudoNoise(seed, 3.7) * TWO_PI
            });
        }
    }

    /**
     * Grows the dust pool to `target` grains (spiral material plan S5).
     *
     * Copy 0 is created in the constructor with the historical seed/theta/depth-phase formulas, so
     * the default population, its identities, and its draw order are unchanged. Higher densities
     * append further copies once, on the frame the density first reaches them -- never per frame,
     * and never during a draw at a density the pool already covers.
     */
    private growGrainPool(copies: number): void {
        const bounded = Math.min(GRAIN_COPIES_MAX, Math.max(1, Math.floor(copies)));
        // Allocation is tracked by copy count, not by `pool.length`: a caller that empties the
        // pool (diagnostics, isolation tests) must stay empty rather than being silently refilled.
        if (bounded <= this.grainCopiesAllocated) return;
        const target = bounded * COPY_SIZE;
        for (let i = this.pool.length; i < target; i++) {
            const withinCopy = i % COPY_SIZE;
            const bandIndex = withinCopy % BANDS;
            const layer = Math.floor(withinCopy / BANDS);
            const seed = (i + 1) * 12.9898;
            // Each band owns an angular sector; grains are spread inside it and staggered in depth.
            const theta = (bandIndex / BANDS) * TWO_PI + (pseudoNoise(seed, 1.7) / BANDS) * TWO_PI;
            const depthPhase = (layer + pseudoNoise(seed, 3.1)) / DEPTH_LAYERS;
            const character = createWormholeGrainCharacter(seed);
            this.pool.push({
                theta, depthPhase, bandIndex, seed, ...character,
                releaseGeneration: 0,
                releaseDistance: 0,
                releaseKick: 0,
                releaseBass: 0,
                releaseDensity: 0,
                releaseBandEnergy: -1,
                releaseJitter: 0,
                releaseEmission: 0,
                releaseVariant: 0,
                releaseTrailScale: character.trailScale,
                releaseRadius: 1,
                releaseDepth: 1,
                releaseWarp: 0,
                releaseCurve: 0,
                releaseRing: 0,
                releaseDepthCoherence: 0,
                releaseGeometryInitialized: false
            });
        }
        this.grainCopiesAllocated = bounded;
    }

    syncPosition(timeSec: number): void {
        const safeTime = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
        const analysisChanged = this.transport.sync(
            State.frames,
            State.sampleRate,
            State.hopSize,
            State.events,
            State.trackAnalysis.features,
            State.bpm,
            State.trackAnalysis.timingConfidence?.overall
        );
        if (analysisChanged) this.authoredSpeedTimeline.reset(safeTime, this.currentAuthoredTravelRate());
        const horizon = this.generationHorizon();
        const travelDistanceNow = this.travelDistanceAt(safeTime);
        const { bendH: syncBendH, bendV: syncBendV } = combinedWormholePathBend(
            State.visualTuning.wormholePathBend, State.visualTuning.wormholePathBendVertical
        );
        this.routePath.resetConverged(travelDistanceNow, syncBendH);
        this.routePathVertical.resetConverged(travelDistanceNow, syncBendV);
        this.travelPhase = wrapDepthPhase(travelDistanceNow / horizon);
        // A seek is not an organic release: clear every grain's release state so no stale
        // pre-seek kick/LOW_DROP reaction lingers. `releaseGeneration` is set to the grain's true
        // absolute generation at the new position (not reset to 0), so the very next draw call
        // does not misread the seek jump itself as a fresh generation crossing.
        for (let i = 0; i < this.pool.length; i++) {
            const grain = this.pool[i];
            grain.releaseGeneration = generationIndexAt(travelDistanceNow, grain.depthPhase, horizon);
            grain.releaseDistance = travelDistanceNow;
            grain.releaseKick = 0;
            grain.releaseBass = 0;
            grain.releaseDensity = 0;
            const spectrum = State.currentFrame.perceptualSpectrum;
            grain.releaseBandEnergy = grain.bandIndex < spectrum.length ? clamp01(spectrum[grain.bandIndex]) : 0;
            grain.releaseJitter = 0;
            grain.releaseEmission = 0;
            grain.releaseVariant = 0;
            grain.releaseTrailScale = grain.trailScale;
            this.snapshotGrainGeometry(grain, State.visualTuning, safeTime);
        }
        if (featureFlags.wormholeDiagnostics) wormholeDepthDiagnostics.noteSeek(safeTime);
    }

    /** Fixed canonical generation horizon. Preset depth morphs cannot change release cadence. */
    private generationHorizon(): number {
        return Z_REFERENCE;
    }

    draw(backend: VisualRendererBackend, _particles: Particle[], _shockwaves: Shockwave[]): void {
        const tuning = State.visualTuning;
        const timeSec = canonicalWormholeTime(State.currentTime, State.isExporting, State.exportTime);
        const analysisChanged = this.transport.sync(
            State.frames,
            State.sampleRate,
            State.hopSize,
            State.events,
            State.trackAnalysis.features,
            State.bpm,
            State.trackAnalysis.timingConfidence?.overall
        );
        if (analysisChanged) this.authoredSpeedTimeline.reset(timeSec, this.currentAuthoredTravelRate());
        const travelDistance = this.travelDistanceAt(timeSec);
        const kickEnvelope = wormholeKickEnvelopeAtTime(
            State.events, State.frames, timeSec, State.sampleRate, State.hopSize
        );
        const impact = kickEnvelope;
        const clear = getBackgroundClearStyle(tuning, impact * 10);
        backend.background(
            Math.min(clear.r + 1, 14),
            Math.min(clear.g + 1, 8),
            Math.min(clear.b + 6 + State.currentFeatures.tension * 6, 30),
            clear.a
        );

        // --- Dramaturgy / modulation inputs ---
        const vocal = State.currentFeatures.vocal;
        const melody = State.currentFeatures.melody;

        const motion = computeWormholeMotionProfile({
            bpm: State.bpm,
            currentFrame: State.currentFrame,
            currentFeatures: State.currentFeatures,
            perceptualSpectrum: State.currentFrame.perceptualSpectrum,
            beatDecay: State.beatDecay,
            denseImpactFlash: State.denseImpactFlash,
            directorOutput: State.directorOutput,
            timingConfidence: State.trackAnalysis.timingConfidence?.overall,
            timeSec,
            bars: State.trackAnalysis.bars,
            kickEnvelope
        });
        const lowDrop = wormholeLowDropAtTime(State.frames, timeSec, State.sampleRate, State.hopSize);
        const authoredJitter = clamp01(tuning.wormholeJitter);
        // The lens stays fixed. Kick/bass motion belongs to selected dust cohorts at their own
        // release moment, never a whole-image or whole-tunnel transform.
        const cx = backend.width / 2;
        const cy = backend.height / 2;
        // Geometry stays stable: no bar-scale or per-frame term may breathe the
        // perspective, horizon, and radius. No live kick/bass/density impulse may pump them —
        // that per-frame "whole field breathes with the beat" coupling is the regression this
        // fixes. `perspectiveCompression` and `depthPulse` remain part of the motion profile (and
        // still drive the release snapshot below) but are no longer read here.
        const fov = backend.height * 1.2;

        // The live authored horizon is diagnostics-only; in-flight grains own snapshotted depth.
        const diagnosticMaxZ = Z_REFERENCE * tuning.wormholeDepth;
        // Every generation uses one fixed reference horizon; preset morphs cannot rewind phase.
        this.travelPhase = wrapDepthPhase(travelDistance / Z_REFERENCE);
        // These already glide continuously from the previous active value toward the new preset
        // via `applyTuningMorph` (see `src/config/visualTuning.ts`) every frame -- no extra
        // automation-triggered boost here, which used to spike them the instant a point activated.
        const { bendH: effectivePathBend, bendV: effectivePathBendVertical } = combinedWormholePathBend(
            tuning.wormholePathBend, tuning.wormholePathBendVertical
        );
        const effectiveContinuity = Math.max(0, tuning.wormholeContinuity);
        const canonicalRate = this.travelRateAt(timeSec);
        const smearRateGain = wormholeSmearRateGain(canonicalRate);
        const vz = wormholeTrailSeparation(canonicalRate, 1);
        if (featureFlags.wormholeDiagnostics) wormholeDepthDiagnostics.beginFrame(diagnosticMaxZ, vz);
        // Fractional values are a crossfade coordinate between valid integer emission modes;
        // WormholeEmission resolves the two modes separately and blends their gains.
        const emissionMode = clamp(tuning.wormholeEmissionMode, 0, 2);
        const camZ = travelDistance;

        const lineAlpha = tuning.lineAlpha;
        const lineWeight = tuning.lineWeight;
        const frameTick = timeSec;
        const transitionEnvelope = this.transitionDisturbanceEnvelope(
            State.visualTuning,
            State.targetTuning,
            State.activeVisualTransitionId,
            timeSec
        );
        // The fixed lens projects camera-local route coordinates. The camera frame follows the
        // route tangent without roll; foreground and background points are transformed into it.
        this.routePath.advance(camZ, effectivePathBend);
        this.routePath.sample(camZ, this.baseRouteNow);
        this.routePathVertical.advance(camZ, effectivePathBendVertical);
        this.routePathVertical.sample(camZ, this.baseRouteNowV);
        // The integrated route itself decides whether any centerline drift exists. Do not gate this
        // on the live preset bend: doing so would erase a still-easing turn during curved->straight.
        const routeTurnVisualGain = wormholeRouteTurnVisualGain(1);
        const performanceMode = tuning.performanceMode > 0;

        // Gravitational lens warp (lens-overhaul plan T5): a screen-space, post-projection transform
        // applied only to the background layers below (skybox/starfield/galaxy) -- it never writes
        // route heading, travelPhase, camera, or the grain tunnel interior. `lensActive` gates every
        // warp call site directly so `wormholeLens <= 0` skips the extra per-point work entirely
        // rather than relying only on `wormholeLensWarpPoint`'s own internal identity pass-through.
        // Discrete, default-off opt-in requested for the complete membrane/lens parameter family.
        // Keeping the gate here makes Off a true render bypass: none of the authored sub-values can
        // leak into wall lines, refraction-field perturbation, lens geometry, vignette, or overlays.
        const opticsEnabled = tuning.wormholeOpticsEnabled >= 0.5;
        const wallStrength = opticsEnabled ? tuning.wormholeWall : 0;
        const lensStrength = opticsEnabled ? tuning.wormholeLens : 0;
        const lensActive = lensStrength > 0;
        const lensSwirl = tuning.wormholeLensSwirl;
        let lensCenterX = cx;
        let lensCenterY = cy;
        let lensRadiusPx = 0;
        if (lensActive) {
            // The lens center follows the route exactly like every other background layer's
            // parallax does: projected from the smoothed-lookahead frame at the horizon depth, so a
            // turning route bends the lens center with the tunnel instead of pinning it to center.
            this.routePath.sampleSmoothedLookahead(camZ + Z_REFERENCE, this.lensHorizonFrame);
            this.routePathVertical.sampleSmoothedLookahead(camZ + Z_REFERENCE, this.lensHorizonFrameV);
            const lensVerticalDrift = this.lensHorizonFrameV.positionX - this.baseRouteNowV.positionX;
            const lensCenterProjection = projectWormholeTubePoint(
                this.lensHorizonFrame, this.baseRouteNow, Z_REFERENCE, 0, 0, routeTurnVisualGain,
                cx, cy, fov, lensVerticalDrift
            );
            lensCenterX = lensCenterProjection.screenX;
            lensCenterY = lensCenterProjection.screenY;
            lensRadiusPx = tuning.wormholeLensRadius * Math.hypot(backend.width, backend.height) * 0.5;
        }
        // Wall-as-refraction-field (true-lens plan F4): gathered once here -- whenever either the
        // lens perturbation below or the (now legacy, off-by-default) drawn wall further down needs
        // it -- so neither path re-gathers the same fronts a second time. Independent of `lensActive`
        // alone: a wormholeWall>0, wormholeLens=0 configuration (the pre-F4 legacy look) must still
        // see its own wave fronts exactly as before.
        let waveFrontCount = 0;
        if (opticsEnabled && tuning.wormholeWallWaves > 0 && (lensActive || wallStrength > 0)) {
            waveFrontCount = wormholeWallGatherWaveFronts(
                State.events, State.frames, timeSec, State.sampleRate, State.hopSize, this.waveFronts
            );
        }
        // Uniform (theta-independent) refraction-impulse term: a kick/LOW_DROP pressure front
        // reaching the throat's near-plane reference (depthPhase 0) swells the lens radius briefly,
        // reusing the exact same evaluator/channel the (optional) drawn wall's own pressure bump
        // uses -- never a second, independently authored pulse source.
        const lensWallWaveOffset = lensActive && waveFrontCount > 0
            ? wormholeWallWaveOffset(this.waveFronts, waveFrontCount, 0)
            : 0;
        // Performance mode drops only the skybox warp (its plate has the most points); stars and
        // galaxies keep warping since they carry most of the lensed silhouette read.
        const applySkyboxLens = lensActive && !performanceMode;

        if (featureFlags.wormholeSkybox) {
            const skyboxTravelRate = Math.min(
                SKYBOX_TRAVEL_RATE_CAP,
                wormholeTrailSeparation(canonicalRate, SKYBOX_ROUTE_WORLD_FRACTION) * smearRateGain
            );
            const skyboxPrevCamZ = Math.max(0, camZ - skyboxTravelRate);
            this.routePath.sample(skyboxPrevCamZ, this.routePrev);
            this.routePathVertical.sample(skyboxPrevCamZ, this.routePrevV);
            const skyboxTurnSmooth = combinedTurnIntensity(
                this.routePath.smoothedTurnIntensity(camZ),
                this.routePathVertical.smoothedTurnIntensity(camZ)
            );
            const skyboxTurnSmoothPrev = combinedTurnIntensity(
                this.routePath.smoothedTurnIntensity(skyboxPrevCamZ),
                this.routePathVertical.smoothedTurnIntensity(skyboxPrevCamZ)
            );
            this.drawSkybox(
                backend, this.baseRouteNow, this.routePrev, this.baseRouteNowV, this.routePrevV,
                skyboxTurnSmooth, skyboxTurnSmoothPrev,
                routeTurnVisualGain, tuning.wormholeSkybox * lineAlpha, impact, cx, cy, frameTick,
                skyboxTravelRate, canonicalRate, applySkyboxLens, lensCenterX, lensCenterY, lensRadiusPx,
                lensStrength, lensSwirl, camZ, lensWallWaveOffset
            );
        }

        // Deep galaxies bank into the turn over a wider, softer world scale than the near starfield.
        const galaxyAmount = tuning.wormholeGalaxy;
        if (galaxyAmount > 0 && shouldUseExpensiveGlow(tuning)) {
            const galaxyDepthTravel = camZ * GALAXY_SPEED_RATIO;
            const galaxyTravelRate = wormholeTrailSeparation(canonicalRate, GALAXY_SPEED_RATIO);
            const galaxyPrevCamZ = Math.max(0, camZ - galaxyTravelRate);
            this.routePath.sample(galaxyPrevCamZ, this.baseRoutePrev);
            this.routePathVertical.sample(galaxyPrevCamZ, this.baseRoutePrevV);
            const galaxyTurnSmooth = combinedTurnIntensity(
                this.routePath.smoothedTurnIntensity(camZ),
                this.routePathVertical.smoothedTurnIntensity(camZ)
            );
            const galaxyTurnSmoothPrev = combinedTurnIntensity(
                this.routePath.smoothedTurnIntensity(galaxyPrevCamZ),
                this.routePathVertical.smoothedTurnIntensity(galaxyPrevCamZ)
            );
            const galaxyParallax = wormholeParallaxStrength(galaxyTurnSmooth);
            const galaxyParallaxPrev = wormholeParallaxStrength(galaxyTurnSmoothPrev);
            for (let i = 0; i < this.galaxyPool.length; i++) {
                const galaxy = this.galaxyPool[i];
                const gz = depthFromPhase(
                    (i + 0.5) / GALAXY_COUNT,
                    wrapDepthPhase(galaxyDepthTravel / MAX_GALAXY_Z),
                    MAX_GALAXY_Z
                );
                const gNearVisibility = wormholeNearPlaneVisibility(gz, MAX_GALAXY_Z);
                const gNear = 1 - gz / MAX_GALAXY_Z;
                this.routePath.sampleSmoothedLookahead(camZ + gz, this.routeNow);
                this.routePathVertical.sampleSmoothedLookahead(camZ + gz, this.routeNowV);
                const gRouteDriftX = this.routeNow.positionX - this.baseRouteNow.positionX;
                const gRouteDriftY = this.routeNow.positionY - this.baseRouteNow.positionY;
                const gRouteDriftV = this.routeNowV.positionX - this.baseRouteNowV.positionX;
                // The authored cosmos is a rigid background plate at each depth. Turning may
                // translate that plate through route parallax, but it must not rotate/scale the
                // galaxy's own x/y coordinates or feed lateral route motion back into projection
                // depth. Those couplings stretched the background whenever bend changed.
                const gRouteLocalX =
                    gRouteDriftX * this.baseRouteNow.normalX + gRouteDriftY * this.baseRouteNow.normalY;
                const gLocalX = galaxy.x
                    + gRouteLocalX * GALAXY_ROUTE_WORLD_SCALE * galaxyParallax * routeTurnVisualGain;
                const gLocalZ = Math.max(GALAXY_PROJECTION_Z_FLOOR, gz * 0.72);
                const gx = cx + (gLocalX / gLocalZ) * fov;
                const gy = cy + (
                    galaxy.y
                    + gRouteDriftV * GALAXY_ROUTE_WORLD_SCALE * galaxyParallax * routeTurnVisualGain
                ) / gLocalZ * fov;
                const gRadius = Math.max(8, (GALAXY_CORE / gLocalZ) * fov);
                const gAlpha = (0.018 + gNear * 0.05 + impact * 0.03) * galaxyAmount * lineAlpha * gNearVisibility;
                this.galaxyColor[0] = galaxy.r;
                this.galaxyColor[1] = galaxy.g;
                this.galaxyColor[2] = galaxy.b;
                let lineGx = gx;
                let lineGy = gy;
                let gMagnification = 1;
                if (lensActive) {
                    const dxLens = gx - lensCenterX;
                    const dyLens = gy - lensCenterY;
                    // Wall-as-refraction-field (true-lens plan F4): see `perturbedLensRadius`.
                    const theta = Math.atan2(dyLens, dxLens);
                    const perturbedRadius = this.perturbedLensRadius(theta, lensRadiusPx, camZ, lensWallWaveOffset);
                    gMagnification = 1 + wormholeLensMagnificationGain(
                        dxLens * dxLens + dyLens * dyLens, perturbedRadius, lensStrength
                    );
                    wormholeLensWarpPoint(
                        gx, gy, lensCenterX, lensCenterY, perturbedRadius, lensStrength, lensSwirl,
                        this.lensWarpPointA
                    );
                    lineGx = this.lensWarpPointA.x;
                    lineGy = this.lensWarpPointA.y;
                }
                backend.radialGlow(lineGx, lineGy, gRadius, this.galaxyColor, gAlpha * gMagnification);

                // Bounded drift cue: a fainter, smaller echo at this galaxy's own previous-frame
                // position (same prev/current pattern already used for grains and stars), whose
                // separation from the current glow scales with the shared travel rate.
                const gzPrev = Math.min(MAX_GALAXY_Z, gz + galaxyTravelRate);
                this.routePath.samplePreviousSmoothedLookahead(galaxyPrevCamZ + gzPrev, this.routePrev);
                this.routePathVertical.samplePreviousSmoothedLookahead(galaxyPrevCamZ + gzPrev, this.routePrevV);
                const gRouteDriftXPrev = this.routePrev.positionX - this.baseRoutePrev.positionX;
                const gRouteDriftYPrev = this.routePrev.positionY - this.baseRoutePrev.positionY;
                const gRouteDriftVPrev = this.routePrevV.positionX - this.baseRoutePrevV.positionX;
                const gRouteLocalXPrev =
                    gRouteDriftXPrev * this.baseRoutePrev.normalX + gRouteDriftYPrev * this.baseRoutePrev.normalY;
                const gLocalXPrev = galaxy.x
                    + gRouteLocalXPrev * GALAXY_ROUTE_WORLD_SCALE * galaxyParallaxPrev * routeTurnVisualGain;
                const gLocalZPrev = Math.max(GALAXY_PROJECTION_Z_FLOOR, gzPrev * 0.72);
                const gxPrev = cx + (gLocalXPrev / gLocalZPrev) * fov;
                const gyPrev = cy + (
                    galaxy.y
                    + gRouteDriftVPrev * GALAXY_ROUTE_WORLD_SCALE * galaxyParallaxPrev * routeTurnVisualGain
                ) / gLocalZPrev * fov;
                let lineGxPrev = gxPrev;
                let lineGyPrev = gyPrev;
                let gMagnificationPrev = 1;
                if (lensActive) {
                    const dxLensPrev = gxPrev - lensCenterX;
                    const dyLensPrev = gyPrev - lensCenterY;
                    // Wall-as-refraction-field (true-lens plan F4): see `perturbedLensRadius`.
                    const thetaPrev = Math.atan2(dyLensPrev, dxLensPrev);
                    const perturbedRadiusPrev = this.perturbedLensRadius(thetaPrev, lensRadiusPx, camZ, lensWallWaveOffset);
                    gMagnificationPrev = 1 + wormholeLensMagnificationGain(
                        dxLensPrev * dxLensPrev + dyLensPrev * dyLensPrev, perturbedRadiusPrev, lensStrength
                    );
                    wormholeLensWarpPoint(
                        gxPrev, gyPrev, lensCenterX, lensCenterY, perturbedRadiusPrev, lensStrength, lensSwirl,
                        this.lensWarpPointA
                    );
                    lineGxPrev = this.lensWarpPointA.x;
                    lineGyPrev = this.lensWarpPointA.y;
                }
                backend.radialGlow(
                    lineGxPrev, lineGyPrev, gRadius * 0.7, this.galaxyColor, gAlpha * 0.4 * gMagnificationPrev
                );
            }
        }

        // Stars carry the strongest route-follow cue. Near/far falloff is not a manual gain table:
        // the world-space translate happens before the perspective divide below, so near stars
        // (small z) automatically sweep further across the screen than distant ones for the exact
        // same world-unit offset.
        const starAmount = tuning.wormholeStarfield;
        if (starAmount > 0) {
            const starDepthTravel = camZ * STAR_SPEED_RATIO;
            const vzStar = wormholeTrailSeparation(canonicalRate, STAR_SPEED_RATIO) * smearRateGain;
            const starPrevCamZ = Math.max(0, camZ - vzStar);
            this.routePath.sample(starPrevCamZ, this.baseRoutePrev);
            this.routePathVertical.sample(starPrevCamZ, this.baseRoutePrevV);
            const starTurnSmooth = combinedTurnIntensity(
                this.routePath.smoothedTurnIntensity(camZ),
                this.routePathVertical.smoothedTurnIntensity(camZ)
            );
            const starTurnSmoothPrev = combinedTurnIntensity(
                this.routePath.smoothedTurnIntensity(starPrevCamZ),
                this.routePathVertical.smoothedTurnIntensity(starPrevCamZ)
            );
            const starParallax = wormholeParallaxStrength(starTurnSmooth);
            const starParallaxPrev = wormholeParallaxStrength(starTurnSmoothPrev);
            for (let i = 0; i < this.starPool.length; i++) {
                const star = this.starPool[i];
                const z = depthFromPhase(
                    pseudoNoise(star.seed, 33.3),
                    wrapDepthPhase(starDepthTravel / MAX_STAR_Z),
                    MAX_STAR_Z
                );
                // Near-plane guard: as a star's cyclical depth approaches the lens, 1/z diverges
                // (a pre-existing singularity, unrelated to the route-follow transform above, since
                // it is inherent to `star.x * invZ * fov` alone). Grains already cull this zone via
                // `wormholeNearPlaneVisibility`; stars previously had no such guard and instead grew
                // *brighter* right as their projected position blew up, reading as a jarring flash.
                // This fades alpha rather than skipping the draw call outright, so every star still
                // contributes exactly one `backend.line()` per frame at a stable pool index.
                const nearVisibility = wormholeNearPlaneVisibility(z, MAX_STAR_Z);
                // Stars span a much wider world radius than tunnel grains, so the shared near-plane
                // fade alone can leave a still-visible star moving hundreds of pixels in one frame.
                // Extend only the star material fade (never its geometry/index) through 4%..12% of
                // the horizon to hide the perspective singularity before it reads as a teleport.
                const starNearVisibility = nearVisibility
                    * clamp01((z / MAX_STAR_Z - 0.04) / 0.08);
                const prevZ = z + vzStar;
                // Proportional depth cue: near stars are bright, thick streaks; far ones faint specks.
                const sNear = 1 - z / MAX_STAR_Z;
                this.routePath.sampleSmoothedLookahead(camZ + z, this.routeNow);
                this.routePathVertical.sampleSmoothedLookahead(camZ + z, this.routeNowV);
                const starRouteDriftX = this.routeNow.positionX - this.baseRouteNow.positionX;
                const starRouteDriftY = this.routeNow.positionY - this.baseRouteNow.positionY;
                const starRouteDriftV = this.routeNowV.positionX - this.baseRouteNowV.positionX;
                // The star's world-route distance is fixed across the trail:
                // (camZ - vzStar) + (z + vzStar) === camZ + z. Its route geometry still has to be
                // evaluated from the previous integrated state: during a bend morph, extrapolating
                // both endpoints from the latest curvature hides a look-ahead rearrangement from
                // the motion-safety gate.
                this.routePath.samplePreviousSmoothedLookahead(camZ + z, this.routePrev);
                this.routePathVertical.samplePreviousSmoothedLookahead(camZ + z, this.routePrevV);
                const prevStarRouteDriftX = this.routePrev.positionX - this.baseRoutePrev.positionX;
                const prevStarRouteDriftY = this.routePrev.positionY - this.baseRoutePrev.positionY;
                const prevStarRouteDriftV = this.routePrevV.positionX - this.baseRoutePrevV.positionX;
                const starRouteLocalX =
                    starRouteDriftX * this.baseRouteNow.normalX + starRouteDriftY * this.baseRouteNow.normalY;
                const prevStarRouteLocalX =
                    prevStarRouteDriftX * this.baseRoutePrev.normalX + prevStarRouteDriftY * this.baseRoutePrev.normalY;
                // Keep the star plate rigid: bend scales only its shared route translation. The
                // star's own x/y and projection depth remain independent of turn intensity.
                const localX = star.x
                    + starRouteLocalX * STAR_ROUTE_WORLD_SCALE * starParallax * routeTurnVisualGain;
                const prevLocalX = star.x
                    + prevStarRouteLocalX * STAR_ROUTE_WORLD_SCALE * starParallaxPrev * routeTurnVisualGain;
                const localZ = Math.max(STAR_PROJECTION_Z_FLOOR, z * 0.72);
                const prevLocalZ = Math.max(STAR_PROJECTION_Z_FLOOR, prevZ * 0.72);
                const localY = star.y
                    + starRouteDriftV * STAR_ROUTE_WORLD_SCALE * starParallax * routeTurnVisualGain;
                const prevLocalY = star.y
                    + prevStarRouteDriftV * STAR_ROUTE_WORLD_SCALE * starParallaxPrev * routeTurnVisualGain;
                const sx = cx + localX / localZ * fov;
                const sy = cy + localY / localZ * fov;
                const psx = cx + prevLocalX / prevLocalZ * fov;
                const psy = cy + prevLocalY / prevLocalZ * fov;

                // Smear character (lens-overhaul plan T8): fast canonical travel already lengthens
                // `vzStar` above. Points inside the throat receive one additional bounded, purely
                // screen-space tail stretch; the head stays fixed and the existing post-warp
                // motion-safety fade below remains the final guard.
                let trailPsx = psx;
                let trailPsy = psy;
                if (lensActive) {
                    const smearDx = sx - lensCenterX;
                    const smearDy = sy - lensCenterY;
                    const lensSmearGain = wormholeLensSmearGain(
                        smearDx * smearDx + smearDy * smearDy, lensRadiusPx, canonicalRate
                    );
                    if (lensSmearGain > 1) {
                        trailPsx = sx + (psx - sx) * lensSmearGain;
                        trailPsy = sy + (psy - sy) * lensSmearGain;
                    }
                }
                // Cached for the secondary-image pass after this loop (true-lens plan F2): the
                // unwarped now/trail position, so that pass never re-samples the route.
                this.starSxCache[i] = sx;
                this.starSyCache[i] = sy;
                this.starTrailPsxCache[i] = trailPsx;
                this.starTrailPsyCache[i] = trailPsy;

                // Gravitational lens warp (lens-overhaul plan T5): magnification is read from each
                // star's own pre-warp distance to the lens center -- the source point's screen-space
                // impact parameter -- before the point itself is bent toward the lens.
                let lineSx = sx;
                let lineSy = sy;
                let linePsx = trailPsx;
                let linePsy = trailPsy;
                let starMagnification = 1;
                if (lensActive) {
                    const dxLens = sx - lensCenterX;
                    const dyLens = sy - lensCenterY;
                    const d2Lens = dxLens * dxLens + dyLens * dyLens;
                    // Wall-as-refraction-field (true-lens plan F4): see `perturbedLensRadius`.
                    const theta = Math.atan2(dyLens, dxLens);
                    const perturbedRadius = this.perturbedLensRadius(theta, lensRadiusPx, camZ, lensWallWaveOffset);
                    const starAxisVisibility = wormholeLensNearAxisVisibility(Math.sqrt(d2Lens), perturbedRadius);
                    starMagnification = (1 + wormholeLensMagnificationGain(d2Lens, perturbedRadius, lensStrength))
                        * starAxisVisibility;
                    wormholeLensWarpPoint(
                        sx, sy, lensCenterX, lensCenterY, perturbedRadius, lensStrength, lensSwirl,
                        this.lensWarpPointA
                    );
                    wormholeLensWarpPoint(
                        trailPsx, trailPsy, lensCenterX, lensCenterY, perturbedRadius, lensStrength, lensSwirl,
                        this.lensWarpPointB
                    );
                    lineSx = this.lensWarpPointA.x;
                    lineSy = this.lensWarpPointA.y;
                    linePsx = this.lensWarpPointB.x;
                    linePsy = this.lensWarpPointB.y;
                }

                // Motion-safety gate: a very near/wide star can still have a finite position while
                // crossing an implausibly large screen distance in one frame. Fade that material
                // before drawing instead of clipping geometry or changing stable pool indexing.
                // Reads the (possibly lens-warped) line endpoints, since a warp can itself introduce
                // a large jump near the lens core that this same gate must catch.
                const projectedMotion = Math.hypot(lineSx - linePsx, lineSy - linePsy);
                const starMotionVisibility = 1 - clamp01((projectedMotion - 120) / 180);
                const marginX = Math.max(1, backend.width * 0.1);
                const marginY = Math.max(1, backend.height * 0.1);
                const viewportVisibility = Math.min(
                    clamp01((lineSx + marginX) / marginX),
                    clamp01((backend.width + marginX - lineSx) / marginX),
                    clamp01((lineSy + marginY) / marginY),
                    clamp01((backend.height + marginY - lineSy) / marginY)
                );
                const sAlpha = (10 + sNear * sNear * 120 + impact * 60)
                    * lineAlpha * starAmount * starNearVisibility * starMotionVisibility * viewportVisibility
                    * starMagnification;
                const sWeight = (0.4 + sNear * sNear * 2.2) * lineWeight;
                backend.stroke(star.r, star.g, star.b, sAlpha);
                backend.strokeWeight(sWeight);
                backend.line(linePsx, linePsy, lineSx, lineSy);
            }

            // Secondary-image pass (true-lens plan F2): fills the throat's interior with the point-
            // mass lens's fainter, counter-rotating second image instead of leaving it empty --
            // "looking back through the wormhole" instead of into a void. Budget-gated to a fixed,
            // frame-invariant half of the pool (every other index) rather than a beta-based cutoff:
            // conditionally skipping individual stars by their current (frame-varying) distance from
            // the axis would itself vary this loop's own line() count frame to frame, exactly the
            // class of bug the main loop's own "stable pool index" comment above warns against.
            // `wormholeLensSecondaryGain` already fades to ~0 far from the axis, so drawing every
            // eligible star unconditionally costs a few effectively-invisible calls rather than
            // risking that bug -- and reads the now/trail cache the main loop just populated, so
            // this never re-samples the route.
            if (lensActive && !performanceMode) {
                for (let i = 0; i < this.starPool.length; i += 2) {
                    const star = this.starPool[i];
                    const secSx = this.starSxCache[i];
                    const secSy = this.starSyCache[i];
                    const secTrailPsx = this.starTrailPsxCache[i];
                    const secTrailPsy = this.starTrailPsyCache[i];
                    const dxLens = secSx - lensCenterX;
                    const dyLens = secSy - lensCenterY;
                    // Wall-as-refraction-field (true-lens plan F4): see `perturbedLensRadius`.
                    const secTheta = Math.atan2(dyLens, dxLens);
                    const secPerturbedRadius = this.perturbedLensRadius(secTheta, lensRadiusPx, camZ, lensWallWaveOffset);
                    const secondaryGain = wormholeLensSecondaryGain(
                        dxLens * dxLens + dyLens * dyLens, secPerturbedRadius, lensStrength
                    );
                    wormholeLensSecondaryPoint(
                        secSx, secSy, lensCenterX, lensCenterY, secPerturbedRadius, lensStrength, lensSwirl,
                        this.lensWarpPointA
                    );
                    wormholeLensSecondaryPoint(
                        secTrailPsx, secTrailPsy, lensCenterX, lensCenterY, secPerturbedRadius, lensStrength, lensSwirl,
                        this.lensWarpPointB
                    );
                    const secondaryAlpha = secondaryGain * LENS_SECONDARY_ALPHA_SCALE * lineAlpha * starAmount;
                    backend.stroke(star.r, star.g, star.b, secondaryAlpha);
                    backend.strokeWeight(lineWeight * 0.6);
                    backend.line(
                        this.lensWarpPointB.x, this.lensWarpPointB.y, this.lensWarpPointA.x, this.lensWarpPointA.y
                    );
                }
            }
        }

        // True-lens plan F6: a dedicated, constructor-owned deep-field pool supplies enough real
        // background light for the forward mapping to form a rich Einstein arc. This is deliberately
        // separate from (and does not increase) the global skybox/star pools. The helper owns the
        // lens-active and cheap source-d2 gates; performance mode samples a fixed half-pool stride.
        if (lensActive) {
            this.drawLensDeepField(
                backend, lensCenterX, lensCenterY, lensRadiusPx, lensStrength, lensSwirl,
                travelDistance, timeSec, performanceMode, lineAlpha, lensWallWaveOffset
            );
        }

        // --- Color: GC-free, shifted by vocal (+) and melody (-) ---
        const hue = tuning.circleHue + vocal * 40 - melody * 30;
        hueToRgbInto(this.lineColor, hue, 0.82, Math.min(0.85, 0.55 + impact * 0.18));
        const r = this.lineColor[0];
        const g = this.lineColor[1];
        const b = this.lineColor[2];

        const spectrum = State.currentFrame.perceptualSpectrum;
        const spectrumLen = spectrum ? spectrum.length : 0;

        // Dark-glass vignette (lens-overhaul plan T7): dim the background plate outside the
        // transparent throat before adding the Einstein ring and wall highlights. Chroma-key mode
        // must remain untouched so the inverse radial gradient cannot contaminate the key color.
        // Export and video-backplate rendering deliberately use the same path: P5RendererBackend
        // resolves their active target before issuing this single gradient fill.
        if (lensActive && wallStrength > 0 && tuning.chromaKeyMode === 0) {
            const dimAlpha = clamp01(lensStrength * wallStrength) * 0.58;
            backend.radialDim(
                lensCenterX,
                lensCenterY,
                lensRadiusPx * 0.82,
                lensRadiusPx * 2.35,
                dimAlpha
            );
        }

        // True-lens plan F5: audio energy now breathes through a continuous annular composite,
        // never through flashing points. Band groups are averaged over a canonical eight-frame
        // analysis window (seek/export deterministic, no frame-delta state), then mapped to two or
        // three broad azimuth sectors. A fourth, full-ring screen pass carries overall exposure.
        if (lensActive && tuning.chromaKeyMode === 0) {
            this.drawLensRingTint(
                backend, lensCenterX, lensCenterY, lensRadiusPx, lensStrength, hue,
                timeSec, performanceMode, spectrum, spectrumLen
            );
        }

        // Einstein-ring light pooling (lens-overhaul plan T6): this is a separate, deliberately
        // sparse soft-light layer on the already-computed screen-space lens radius. It does not
        // warp or alter route/tunnel geometry. `shouldUseExpensiveGlow` normally owns this gate;
        // performance mode retains a bounded four-spot version (rather than its regular twelve)
        // while preserving the chroma-key exclusion that the shared gate enforces.
        const expensiveGlowAllowed = shouldUseExpensiveGlow(tuning);
        const einsteinRingEnabled = lensActive && (
            expensiveGlowAllowed || (performanceMode && tuning.chromaKeyMode === 0)
        );
        if (einsteinRingEnabled) {
            hueToRgbInto(this.einsteinRingColor, hue + 8, 0.3, 0.99);
            this.drawEinsteinRing(
                backend, lensCenterX, lensCenterY, lensRadiusPx, lensStrength, travelDistance, timeSec,
                performanceMode, lineAlpha, spectrum, spectrumLen, lensWallWaveOffset
            );
        }

        // Membrane wall (refractive membrane wall plan, Phase 4): drawn after the background
        // layers and before the grain field, so dust floats in front of the wall it frames. Reuses
        // this frame's already-sampled `baseRouteNow`/`baseRouteNowV` camera frames untouched.
        if (wallStrength > 0) {
            hueToRgbInto(this.wallWarmColor, hue - WALL_CHROMATIC_HUE_SHIFT, 0.85, 0.6);
            hueToRgbInto(this.wallCoolColor, hue + WALL_CHROMATIC_HUE_SHIFT, 0.85, 0.6);
            // Low saturation, near-max brightness: reads as a hot highlight distinct from the
            // membrane grid's own base hue instead of just a brighter copy of it.
            hueToRgbInto(this.causticColor, hue, 0.4, 0.98);
            // Event-driven pressure waves (Phase 5/7): reuses the fronts already gathered above
            // (true-lens plan F4) -- this legacy, off-by-default line-material layer must never
            // gather its own second, potentially-inconsistent copy.
            this.drawWall(
                backend, tuning, camZ, cx, cy, fov, lineAlpha, routeTurnVisualGain, travelDistance,
                r, g, b, spectrum, spectrumLen, waveFrontCount
            );
        }

        // Ring vs. dispersion feature: 0 = the natural random spread, 1 = grains snapped to discrete
        // concentric depth rings (the look the wrap bug used to force — now an opt-in parameter).
        const jitter = authoredJitter;
        const generationHorizon = this.generationHorizon();

        // Corrected Nebula architecture gate: the material is a viewport raster conditioned only by
        // the final foreground grain carriers below. Amount zero and performance mode bypass every
        // raster request. All three buffers are acquired before the grain loop so a refusal can fall
        // back to the exact legacy line path for the whole frame, never a partially-rasterized frame.
        const grainMaterialAmount = performanceMode ? 0 : clamp01(tuning.wormholeNebulaAmount);
        const grainMaterialDetail = clamp01(tuning.wormholeNebulaDetail);
        const grainWeaveAmount = grainMaterialAmount > 0 ? clamp01(tuning.wormholeNebulaWeave) : 0;
        // Spiral geometry, arm density wave, and grain density (plan S1/S2/S5) are conditioning for
        // the Nebula material, exactly like the weave: they stay at the historical zero/one-copy
        // field whenever the material is inactive (amount 0 or performance mode), so legacy frames
        // -- the overwhelming default across the app -- are byte-identical to before this plan. Once
        // the material is active they default to the tuned "optimal" look instead of a bare zero, so
        // turning the master Amount on gives the intended read without five additional knob turns.
        const spiralTurns = grainMaterialAmount > 0 ? Math.max(0, finiteOr(tuning.wormholeSpiral, 0)) : 0;
        const spiralArms = grainMaterialAmount > 0
            ? Math.round(clamp(finiteOr(tuning.wormholeSpiralArms, 0), 0, 6))
            : 0;
        const armTwist = spiralTurns * ARM_TWIST_RATIO * TWO_PI;
        const activeCopies = grainMaterialAmount > 0
            ? 1 + Math.round(clamp01(tuning.wormholeGrainDensity) * (GRAIN_COPIES_MAX - 1))
            : 1;
        if (activeCopies > 1) this.growGrainPool(activeCopies);
        const activeGrainCount = Math.min(this.pool.length, COPY_SIZE * activeCopies);
        let grainMaterialActive = false;
        let grainMaterialL0: Float32Array | null = null;
        let grainMaterialL1: Float32Array | null = null;
        let grainMaterialL2: Float32Array | null = null;
        let grainMaterialL0Cols = 0;
        let grainMaterialL0Rows = 0;
        let grainMaterialL1Cols = 0;
        let grainMaterialL1Rows = 0;
        let grainMaterialL2Cols = 0;
        let grainMaterialL2Rows = 0;

        if (grainMaterialAmount > 0) {
            resolveWormholeGrainMaterialRasterSize(
                backend.width,
                backend.height,
                grainMaterialDetail,
                State.isExporting,
                this.grainMaterialRasterSize
            );
            grainMaterialL0Cols = this.grainMaterialRasterSize.cols;
            grainMaterialL0Rows = this.grainMaterialRasterSize.rows;
            grainMaterialL1Cols = Math.max(1, Math.round(grainMaterialL0Cols / 3));
            grainMaterialL1Rows = Math.max(1, Math.round(grainMaterialL0Rows / 3));
            grainMaterialL2Cols = Math.max(1, Math.round(grainMaterialL0Cols / 8));
            grainMaterialL2Rows = Math.max(1, Math.round(grainMaterialL0Rows / 8));

            grainMaterialL0 = backend.beginFieldRaster(0, grainMaterialL0Cols, grainMaterialL0Rows);
            grainMaterialL1 = backend.beginFieldRaster(1, grainMaterialL1Cols, grainMaterialL1Rows);
            grainMaterialL2 = backend.beginFieldRaster(2, grainMaterialL2Cols, grainMaterialL2Rows);
            if (grainMaterialL0 && grainMaterialL1 && grainMaterialL2) {
                clearWormholeGrainMaterialBuffers(grainMaterialL0, grainMaterialL1, grainMaterialL2);
                grainMaterialActive = true;
            }
        }

        if (grainMaterialActive && grainWeaveAmount > 0) this.grainWeaveVisible.fill(0);

        for (let i = 0; i < activeGrainCount; i++) {
            const grain = this.pool[i];
            const liveEnergy = grain.bandIndex < spectrumLen ? clamp01(spectrum[grain.bandIndex]) : 0;
            if (grain.releaseBandEnergy < 0) grain.releaseBandEnergy = liveEnergy;
            if (!grain.releaseGeometryInitialized) this.snapshotGrainGeometry(grain, State.visualTuning, timeSec);

            // Release-time sampling: the grain's generation is an absolute function of current
            // travel distance (see `generationIndexAt`), never a frame-to-frame delta, so an
            // arbitrarily large gap between draw calls still yields the exact right generation and
            // never skips or double-fires one. When it increases, the grain has just re-emerged at
            // the far plane and starts a new generation: the current musical state is snapshotted
            // once, right here. Every later frame reuses these stored scalars plus a
            // distance-since-release decay, so a grain already in flight never gets a fresh tug
            // from a later, unrelated kick/bass/LOW_DROP hit.
            const generationNow = generationIndexAt(travelDistance, grain.depthPhase, generationHorizon);
            if (generationNow > grain.releaseGeneration) {
                grain.releaseGeneration = generationNow;
                grain.releaseDistance = travelDistance;
                grain.releaseKick = wormholeKickSwarmGain(grain, motion.kickJitter, jitter);
                grain.releaseBass = motion.bassWarp;
                grain.releaseDensity = motion.densityFill;
                grain.releaseBandEnergy = grain.bandIndex < spectrumLen ? clamp01(spectrum[grain.bandIndex]) : 0;
                grain.releaseJitter = jitter;
                grain.releaseEmission = lowDrop ? wormholeLowDropGain(grain, lowDrop.envelope) : 0;
                grain.releaseVariant = lowDrop ? lowDrop.variant : 0;
                grain.releaseTrailScale = grain.trailScale * (1 + grain.releaseKick * 0.5 + grain.releaseBass * 0.2);
                this.snapshotGrainGeometry(grain, State.visualTuning, timeSec);
            }

            const distanceSinceRelease = Math.max(0, travelDistance - grain.releaseDistance);
            const releaseFreshness = wormholeKickReleaseEnvelope(distanceSinceRelease);
            const kickGain = grain.releaseKick * releaseFreshness;
            const lowDropFreshness = wormholeLowDropReleaseEnvelope(distanceSinceRelease);
            const lowDropReleaseGain = grain.releaseEmission * lowDropFreshness;
            const effectiveTrailScale = grain.trailScale
                + (grain.releaseTrailScale - grain.trailScale) * releaseFreshness;

            const grainMaxZ = Z_REFERENCE * grain.releaseDepth;
            const ringStep = grainMaxZ / DEPTH_LAYERS;
            // The grain phase and its projection profile are immutable for one generation.
            const grainDepth = depthWithCoherence(
                grain.depthPhase,
                this.travelPhase,
                grainMaxZ,
                grain.releaseDepthCoherence,
                DEPTH_LAYERS
            );
            if (featureFlags.wormholeDiagnostics) wormholeDepthDiagnostics.observeDepth(grainDepth);
            const emissionGain = wormholeEmissionGain(
                emissionMode,
                grain.seed,
                frameTick,
                kickEnvelope
            );
            if (emissionGain <= 0.001) continue;
            const ringFreshness = wormholeRingReleaseEnvelope(distanceSinceRelease);
            const effectiveRing = grain.releaseRing * ringFreshness;
            const z = effectiveRing > 0 ? ringBlend(grainDepth, ringStep, effectiveRing) : grainDepth;

            // The trail's tail is a real earlier travel sample, not a velocity-estimated guess:
            // an explicit earlier distance is projected the same way as the current one.
            const distanceNow = travelDistance;
            const trailDepth = vz * effectiveContinuity;
            const distancePrev = Math.max(0, distanceNow - trailDepth * effectiveTrailScale);
            const previousGeneration = generationIndexAt(distancePrev, grain.depthPhase, generationHorizon);
            const crossedReleasePlane = previousGeneration < generationNow;
            const previousDepth = crossedReleasePlane
                ? grainMaxZ
                : depthWithCoherence(
                    grain.depthPhase,
                    wrapDepthPhase(distancePrev / Z_REFERENCE),
                    grainMaxZ,
                    grain.releaseDepthCoherence,
                    DEPTH_LAYERS
                );
            const prevZ = crossedReleasePlane
                ? grainMaxZ
                : effectiveRing > 0 ? ringBlend(previousDepth, ringStep, effectiveRing) : previousDepth;
            const depthT = z / grainMaxZ;
            const prevDepthT = clamp01(prevZ / grainMaxZ);
            const nearFade = wormholeNearPlaneVisibility(z, grainMaxZ);
            if (nearFade <= 0) continue;

            // Every grain owns a distinct trajectory. Curve and warp tune its flow envelope;
            // neither value rotates the field or camera as a shared transform. The bass term uses
            // this grain's stable release-time snapshot, not the live bass level, so the whole tube
            // cannot visibly "breathe" together on every bass frame or reverse as the bass decays.
            const flowNow = wormholeGrainFlowAngle(
                grain, depthT, grain.releaseWarp, grain.releaseCurve, grain.releaseBass, spiralTurns
            );
            const flowPrev = wormholeGrainFlowAngle(
                grain, prevDepthT, grain.releaseWarp, grain.releaseCurve, grain.releaseBass, spiralTurns
            );
            const thetaNow = grain.theta + flowNow;
            const thetaPrev = grain.theta + flowPrev;
            const invZ = 1 / z;
            const invPrev = 1 / prevZ;

            const radius = 50 * grain.releaseRadius;
            const transitionEnergyNow = wormholeTransitionEnergy(
                grain.seed, frameTick, transitionEnvelope, liveEnergy, depthT
            );
            const transitionEnergyPrev = wormholeTransitionEnergy(
                grain.seed, frameTick, transitionEnvelope, liveEnergy, prevDepthT
            );
            const projectedThetaNow = thetaNow + transitionEnergyNow.angularOffset;
            const projectedThetaPrev = thetaPrev + transitionEnergyPrev.angularOffset;
            const projectedRadiusNow = radius * transitionEnergyNow.radiusScale;
            const projectedRadiusPrev = radius * transitionEnergyPrev.radiusScale;
            let sx = cx + projectedRadiusNow * Math.cos(projectedThetaNow) * invZ * fov;
            let sy = cy + projectedRadiusNow * Math.sin(projectedThetaNow) * invZ * fov;
            let px = cx + projectedRadiusPrev * Math.cos(projectedThetaPrev) * invPrev * fov;
            let py = cy + projectedRadiusPrev * Math.sin(projectedThetaPrev) * invPrev * fov;

            // Project route-local tube points through the camera's route frame: a pure camera-local
            // change of basis, no heading-shear compensation. The route only turns in its own
            // horizontal plane, so the tube's vertical (radialY) axis never rotates with heading --
            // it needs no transform of its own, only the same perspective divide as the lateral axis.
            // The independent vertical steering integrator (Task 08) adds only a drift term on top,
            // never a rotation, so the cross-section stays circular under a diagonal bend too.
            // A bend retarget changes future steering, not already-visible tunnel geometry in one
            // frame. Project both endpoints from the distance-smoothed route history so curvature
            // enters the visible volume only as the camera actually travels through it.
            this.routePath.sampleSmoothedLookahead(distanceNow + z, this.routeNow);
            this.routePath.samplePreviousSmoothedLookahead(distancePrev + prevZ, this.routePrev);
            this.routePath.sample(distanceNow, this.baseRouteNow);
            this.routePath.sample(distancePrev, this.baseRoutePrev);
            this.routePathVertical.sampleSmoothedLookahead(distanceNow + z, this.routeNowV);
            this.routePathVertical.samplePreviousSmoothedLookahead(distancePrev + prevZ, this.routePrevV);
            this.routePathVertical.sample(distanceNow, this.baseRouteNowV);
            this.routePathVertical.sample(distancePrev, this.baseRoutePrevV);
            const verticalDriftNow = this.routeNowV.positionX - this.baseRouteNowV.positionX;
            const verticalDriftPrev = this.routePrevV.positionX - this.baseRoutePrevV.positionX;
            const nowProjection = projectWormholeTubePoint(
                this.routeNow, this.baseRouteNow, z, projectedThetaNow, projectedRadiusNow, routeTurnVisualGain, cx, cy, fov,
                verticalDriftNow
            );
            const prevProjection = projectWormholeTubePoint(
                this.routePrev, this.baseRoutePrev, prevZ, projectedThetaPrev, projectedRadiusPrev, routeTurnVisualGain, cx, cy, fov,
                verticalDriftPrev
            );
            sx = nowProjection.screenX;
            sy = nowProjection.screenY;
            px = prevProjection.screenX;
            py = prevProjection.screenY;

            let materialGain = 1;
            if (lowDropReleaseGain > 0.0005) {
                materialGain = wormholeLowDropMaterialGain(lowDropReleaseGain, grain.releaseVariant);
            }

            // Evaluate the safety invariant in the route-local tube cross-section. Measuring from
            // the fixed lens would misclassify legitimate centerline turns as backward grain flow.
            // The rendered tail still comes from its real previous route sample above.
            const headX = projectedRadiusNow * Math.cos(projectedThetaNow) * invZ * fov;
            const headY = projectedRadiusNow * Math.sin(projectedThetaNow) * invZ * fov;
            const tailX = projectedRadiusPrev * Math.cos(projectedThetaPrev) * invPrev * fov;
            const tailY = projectedRadiusPrev * Math.sin(projectedThetaPrev) * invPrev * fov;
            const correction = wormholeBackwardTrailCorrection(headX, headY, tailX, tailY);
            if (featureFlags.wormholeDiagnostics) wormholeDepthDiagnostics.observeTrailCorrection(correction);
            if (correction > 0) {
                px -= headX * correction;
                py -= headY * correction;
            }

            // Horizon fading: emerge from the far plane, fade out fast at the lens.
            const farFade = 1 - depthT * depthT;
            const fade = clamp01(farFade * nearFade);

            // Live band energy dominates brightness/weight (`LIVE_GRAIN_SHIMMER`): this is the
            // circular-spectrograph material response, not a geometry change. The grain's own
            // release-time snapshot supplies a small grounding term so a grain never goes fully dark
            // between spectrum frames, and its own alpha/weight *scale* (fine dust vs. body vs. spark)
            // keeps grains heterogeneous even under identical live energy. Release density/kick remain
            // one-shot lifts that decay with travelled distance, layered on top of this live term.
            const energy = grain.releaseBandEnergy * (1 - LIVE_GRAIN_SHIMMER) + liveEnergy * LIVE_GRAIN_SHIMMER;
            const releaseLift = 1 + grain.releaseDensity * 0.25 * releaseFreshness + kickGain * 0.4;
            // Spiral arm density wave (plan S2): a brightness ridge whose crest angle rotates with
            // depth, so it reads as a spiral arm rather than a radial spoke. It scales an already
            // resolved material response; it never moves a grain.
            const armFactor = spiralArms > 0
                ? (1 - ARM_CONTRAST) + ARM_CONTRAST * Math.pow(
                    0.5 + 0.5 * Math.cos(spiralArms * projectedThetaNow - armTwist * (1 - depthT)),
                    ARM_SHARPNESS
                )
                : 1;
            const reactiveGrainAlpha = (12 + energy * 188) * grain.alphaScale * materialGain * releaseLift * armFactor;
            const visibilityFloor = wormholeVisibilityFloor(depthT);
            const alpha = lineAlpha * fade * emissionGain * Math.max(visibilityFloor, reactiveGrainAlpha)
                * transitionEnergyNow.alphaScale;
            const weight = wormholeProjectedStrokeWeight(
                (0.4 + energy * 3.2) * lineWeight * grain.weightScale * materialGain * (1 + kickGain * 0.3)
                * transitionEnergyNow.strokeScale * (spiralArms > 0 ? 0.55 + 0.45 * armFactor : 1)
            );
            const trailScale = wormholeProjectedTrailScale(px - sx, py - sy, backend.height);
            if (trailScale < 1) {
                px = sx + (px - sx) * trailScale;
                py = sy + (py - sy) * trailScale;
            }

            // Disabled, performance, and refusal frames retain the exact legacy hot path without
            // even populating the material scratch object.
            if (!grainMaterialActive || !grainMaterialL0) {
                backend.stroke(r, g, b, alpha);
                backend.strokeWeight(weight);
                backend.line(px, py, sx, sy);
                continue;
            }

            // This is the sole material handoff point: both active consumers receive the already-
            // resolved endpoint pair after route projection, backward correction, trail cap,
            // transition, spectral response, fade, and material scaling. The raster module cannot
            // reproduce or reinterpret any of that geometry.
            const carrier = this.grainMaterialCarrier;
            carrier.headX = sx;
            carrier.headY = sy;
            carrier.tailX = px;
            carrier.tailY = py;
            carrier.alpha = alpha;
            carrier.strokeWeight = weight;
            carrier.colorR = r;
            carrier.colorG = g;
            carrier.colorB = b;
            carrier.seed = grain.seed;
            carrier.generation = generationNow;
            carrier.materialPhase = grain.flowPhase + generationNow * 0.61803398875
                + distanceSinceRelease / Math.max(1, grainMaxZ);
            carrier.energy = energy;
            // The one scalar the material was missing: where in the tunnel this carrier is. Every
            // depth-stratified material law (kernel size, halo reach, extinction, detail frequency,
            // atmospheric tint) is derived from it, and it is already resolved here.
            carrier.depth = depthT;

            // Record the resolved head for the weave pass. This is storage of values the loop has
            // already produced -- no projection, no route sample, no tuning geometry read.
            if (grainWeaveAmount > 0) {
                const slot = i * WEAVE_STRIDE;
                const heads = this.grainWeaveHeads;
                heads[slot] = sx;
                heads[slot + 1] = sy;
                heads[slot + 2] = alpha;
                heads[slot + 3] = weight;
                heads[slot + 4] = r;
                heads[slot + 5] = g;
                heads[slot + 6] = b;
                heads[slot + 7] = depthT;
                heads[slot + 8] = grain.seed;
                heads[slot + 9] = generationNow;
                heads[slot + 10] = carrier.materialPhase;
                heads[slot + 11] = energy;
                // The already-resolved trail direction doubles as the local arm tangent, which is
                // what lets a weave link bend along the arm instead of cutting across it as a chord.
                const trailDX = sx - px;
                const trailDY = sy - py;
                const trailLength = Math.sqrt(trailDX * trailDX + trailDY * trailDY);
                heads[slot + 12] = trailLength > 1e-4 ? trailDX / trailLength : 0;
                heads[slot + 13] = trailLength > 1e-4 ? trailDY / trailLength : 0;
                this.grainWeaveVisible[i] = 1;
            }

            accumulateWormholeGrainCarrier(
                grainMaterialL0,
                grainMaterialL0Cols,
                grainMaterialL0Rows,
                backend.width,
                backend.height,
                carrier,
                grainMaterialDetail
            );

            // During a valid partial material frame the same carrier is crossfaded, without another
            // geometry evaluation or retained segment list.
            if (grainMaterialAmount < 1) {
                backend.stroke(carrier.colorR, carrier.colorG, carrier.colorB, carrier.alpha * (1 - grainMaterialAmount));
                backend.strokeWeight(carrier.strokeWeight);
                backend.line(carrier.tailX, carrier.tailY, carrier.headX, carrier.headY);
            }
        }

        if (grainMaterialActive && grainMaterialL0 && grainMaterialL1 && grainMaterialL2 && grainWeaveAmount > 0) {
            this.drawGrainWeave(
                grainMaterialL0, grainMaterialL0Cols, grainMaterialL0Rows,
                backend.width, backend.height, grainMaterialDetail,
                grainWeaveAmount, activeGrainCount
            );
        }

        if (grainMaterialActive && grainMaterialL0 && grainMaterialL1 && grainMaterialL2) {
            resolveWormholeGrainMaterial(
                grainMaterialL0, grainMaterialL0Cols, grainMaterialL0Rows,
                grainMaterialL1, grainMaterialL1Cols, grainMaterialL1Rows,
                grainMaterialL2, grainMaterialL2Cols, grainMaterialL2Rows,
                grainMaterialAmount, tuning.wormholeNebulaBloom
            );
            // Broad haze first, medium bloom second, sharp carrier material last. All three cover
            // the viewport and occupy the foreground grain slot after the wall.
            backend.drawFieldRaster(2, 0, 0, backend.width, backend.height, 1, 'lighter');
            backend.drawFieldRaster(1, 0, 0, backend.width, backend.height, 1, 'lighter');
            backend.drawFieldRaster(0, 0, 0, backend.width, backend.height, 1, 'lighter');
        }
        if (featureFlags.wormholeDiagnostics) wormholeDepthDiagnostics.endFrame();
    }

    /**
     * Connective weave between neighbouring grains (spiral material plan S4).
     *
     * Runs after the grain loop over the heads that loop already resolved. It performs no
     * projection, no route sampling, and no tuning geometry read: a weave carrier is a pure
     * function of two recorded heads. Neighbours are the pool's own structure -- `i` and
     * `i + BANDS` share an angular sector one depth layer apart (the arm direction), `i` and the
     * next band in the same layer close a ring. Material-only: with the raster inactive, or with
     * `wormholeNebulaWeave` at zero, this never runs and the legacy line output is untouched.
     */
    private drawGrainWeave(
        l0: Float32Array,
        cols: number,
        rows: number,
        viewportWidth: number,
        viewportHeight: number,
        detail: number,
        weaveAmount: number,
        activeGrainCount: number
    ): void {
        const maxLength = Math.max(1, viewportHeight) * WEAVE_MAX_LENGTH_FRACTION;
        for (let i = 0; i < activeGrainCount; i++) {
            if (this.grainWeaveVisible[i] === 0) continue;
            const withinCopy = i % COPY_SIZE;
            const band = withinCopy % BANDS;
            const layer = (withinCopy - band) / BANDS;
            const copyBase = i - withinCopy;
            if (layer + 1 < DEPTH_LAYERS) {
                this.weaveNeighbour(
                    l0, cols, rows, viewportWidth, viewportHeight, detail, weaveAmount,
                    i, i + BANDS, true, maxLength
                );
            }
            this.weaveNeighbour(
                l0, cols, rows, viewportWidth, viewportHeight, detail, weaveAmount,
                i, copyBase + layer * BANDS + (band + 1) % BANDS, false, maxLength
            );
        }
    }

    /** Emits one weave connection, as a Hermite arc along an arm or a straight chord around a ring. */
    private weaveNeighbour(
        l0: Float32Array,
        cols: number,
        rows: number,
        viewportWidth: number,
        viewportHeight: number,
        detail: number,
        weaveAmount: number,
        indexA: number,
        indexB: number,
        alongArm: boolean,
        maxLength: number
    ): void {
        if (indexA === indexB || this.grainWeaveVisible[indexB] === 0) return;

        const heads = this.grainWeaveHeads;
        const a = indexA * WEAVE_STRIDE;
        const b = indexB * WEAVE_STRIDE;
        const ax = heads[a];
        const ay = heads[a + 1];
        const bx = heads[b];
        const by = heads[b + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.sqrt(dx * dx + dy * dy);
        // Perspective spreads neighbouring depth layers far apart near the camera; past the cap a
        // link would be an invented streak rather than connective material.
        if (!(length > 0.5) || length > maxLength) return;

        const depth = (heads[a + 7] + heads[b + 7]) * 0.5;
        if (!alongArm && depth < WEAVE_RING_MIN_DEPTH) return;
        // Never brighter than its dimmer end: the weave cannot invent emission between two grains
        // that have none.
        const alpha = Math.min(heads[a + 2], heads[b + 2]) * weaveAmount;
        if (alpha < 2) return;

        const carrier = this.grainWeaveCarrier;
        carrier.alpha = alpha;
        carrier.strokeWeight = Math.min(heads[a + 3], heads[b + 3]) * 0.72;
        carrier.colorR = (heads[a + 4] + heads[b + 4]) * 0.5;
        carrier.colorG = (heads[a + 5] + heads[b + 5]) * 0.5;
        carrier.colorB = (heads[a + 6] + heads[b + 6]) * 0.5;
        carrier.depth = depth;
        carrier.seed = heads[a + 8] + heads[b + 8];
        carrier.generation = heads[a + 9];
        carrier.materialPhase = (heads[a + 10] + heads[b + 10]) * 0.5;
        carrier.energy = (heads[a + 11] + heads[b + 11]) * 0.5;

        const tangentAX = heads[a + 12];
        const tangentAY = heads[a + 13];
        const tangentBX = heads[b + 12];
        const tangentBY = heads[b + 13];
        const bendable = alongArm
            && (tangentAX !== 0 || tangentAY !== 0)
            && (tangentBX !== 0 || tangentBY !== 0);

        if (!bendable) {
            carrier.tailX = ax;
            carrier.tailY = ay;
            carrier.headX = bx;
            carrier.headY = by;
            accumulateWormholeGrainCarrier(l0, cols, rows, viewportWidth, viewportHeight, carrier, detail);
            return;
        }

        // Both tangents point the way the grain travels; the link runs the other way, deeper into
        // the tunnel, so the Hermite tangents are their negatives.
        const scale = length * WEAVE_BEND;
        const startX = -tangentAX * scale;
        const startY = -tangentAY * scale;
        const endX = -tangentBX * scale;
        const endY = -tangentBY * scale;
        let previousX = ax;
        let previousY = ay;
        for (let step = 1; step <= WEAVE_SEGMENTS; step++) {
            const t = step / WEAVE_SEGMENTS;
            const t2 = t * t;
            const t3 = t2 * t;
            const basisStart = 2 * t3 - 3 * t2 + 1;
            const basisStartTangent = t3 - 2 * t2 + t;
            const basisEnd = -2 * t3 + 3 * t2;
            const basisEndTangent = t3 - t2;
            const x = basisStart * ax + basisStartTangent * startX + basisEnd * bx + basisEndTangent * endX;
            const y = basisStart * ay + basisStartTangent * startY + basisEnd * by + basisEndTangent * endY;
            carrier.tailX = previousX;
            carrier.tailY = previousY;
            carrier.headX = x;
            carrier.headY = y;
            accumulateWormholeGrainCarrier(l0, cols, rows, viewportWidth, viewportHeight, carrier, detail);
            previousX = x;
            previousY = y;
        }
    }

    /**
     * Dense but lightweight lensed source field (true-lens plan F6). Every point is drawn only when
     * its *unwarped* source beta is within 2.5 thetaE, checked with squared distance before invoking
     * the lens math. Placement is a pure function of constructor seed, travel distance, and canonical
     * time: no frame-delta state, twinkle, or draw-loop allocation can make the ring flicker after a
     * seek/export. The existing skybox/star densities remain untouched.
     */
    private drawLensDeepField(
        backend: VisualRendererBackend,
        lensCenterX: number,
        lensCenterY: number,
        lensRadiusPx: number,
        lensStrength: number,
        lensSwirl: number,
        travelDistance: number,
        canonicalTime: number,
        performanceMode: boolean,
        lineAlpha: number,
        lensWallWaveOffset: number
    ): void {
        if (lensStrength <= 0 || lensRadiusPx <= 0) return;
        const stride = performanceMode ? WORMHOLE_DEEP_FIELD_PERFORMANCE_STRIDE : 1;
        const maxBeta = lensRadiusPx * DEEP_FIELD_MAX_BETA_RATIO;
        const maxBetaD2 = maxBeta * maxBeta;
        const sharedDrift = travelDistance / Z_REFERENCE * DEEP_FIELD_ADVECTION_PER_HORIZON
            + canonicalTime * DEEP_FIELD_CANONICAL_DRIFT;

        backend.noStroke();
        for (let i = 0; i < this.deepFieldPool.length; i += stride) {
            const point = this.deepFieldPool[i];
            const theta = point.theta + sharedDrift * point.driftScale;
            const beta = point.betaRatio * lensRadiusPx;
            const sourceDx = Math.cos(theta) * beta;
            const sourceDy = Math.sin(theta) * beta;
            const sourceD2 = sourceDx * sourceDx + sourceDy * sourceDy;
            if (sourceD2 > maxBetaD2) continue;

            const perturbedRadius = this.perturbedLensRadius(
                theta, lensRadiusPx, travelDistance, lensWallWaveOffset
            );
            const axisVisibility = wormholeLensNearAxisVisibility(beta, perturbedRadius);
            const magnificationGain = wormholeLensMagnificationGain(
                sourceD2, perturbedRadius, lensStrength
            );
            wormholeLensWarpPoint(
                lensCenterX + sourceDx,
                lensCenterY + sourceDy,
                lensCenterX,
                lensCenterY,
                perturbedRadius,
                lensStrength,
                lensSwirl,
                this.lensWarpPointA
            );

            const alpha = (7 + point.alphaScale * 19) * lineAlpha * lensStrength
                * axisVisibility * (1 + magnificationGain * 0.82);
            const diameter = point.size * (1 + magnificationGain * 0.28);
            backend.fill(point.r, point.g, point.b, alpha);
            backend.circle(this.lensWarpPointA.x, this.lensWarpPointA.y, diameter);
        }
    }

    /**
     * Audio-reactive annular overlay (true-lens plan F5). The exposure pass spans the complete
     * lens zone; saturation is divided into a fixed two/three-sector budget. The backend clips the
     * same radial annulus to each broad wedge, so these remain continuous color fields rather than
     * a new chain of glow spots. All energy lookup is canonical-time indexed and history-free.
     */
    private drawLensRingTint(
        backend: VisualRendererBackend,
        lensCenterX: number,
        lensCenterY: number,
        lensRadiusPx: number,
        lensStrength: number,
        hue: number,
        canonicalTime: number,
        performanceMode: boolean,
        fallbackSpectrum: number[],
        fallbackSpectrumLen: number
    ): void {
        const sectorCount = performanceMode ? LENS_TINT_SECTOR_COUNT_PERFORMANCE : LENS_TINT_SECTOR_COUNT;
        let aggregateEnergy = 0;
        for (let sectorIndex = 0; sectorIndex < sectorCount; sectorIndex++) {
            aggregateEnergy += this.smoothedLensTintSectorEnergy(
                sectorIndex, sectorCount, canonicalTime, fallbackSpectrum, fallbackSpectrumLen
            );
        }
        aggregateEnergy /= sectorCount;

        hueToRgbInto(this.ringExposureColor, hue + 6, 0.18, 0.96);
        backend.compositeRingTint(
            lensCenterX,
            lensCenterY,
            lensRadiusPx * 0.7,
            lensRadiusPx * 1.58,
            this.ringExposureColor,
            clamp01(aggregateEnergy * lensStrength) * LENS_TINT_EXPOSURE_ALPHA,
            'screen'
        );

        const sectorWidth = TWO_PI / sectorCount;
        const halfVisibleWidth = sectorWidth * 0.47;
        // A very slow canonical drift keeps broad color regions alive without coupling their
        // position to spectrum energy (spectrum remains a light/color input, never geometry).
        const sectorDrift = canonicalTime * 0.035;
        for (let sectorIndex = 0; sectorIndex < sectorCount; sectorIndex++) {
            const energy = this.smoothedLensTintSectorEnergy(
                sectorIndex, sectorCount, canonicalTime, fallbackSpectrum, fallbackSpectrumLen
            );
            const color = sectorIndex === 0
                ? this.ringTintColorA
                : sectorIndex === 1
                    ? this.ringTintColorB
                    : this.ringTintColorC;
            const hueOffset = (sectorIndex - (sectorCount - 1) * 0.5) * 34;
            hueToRgbInto(color, hue + hueOffset, 0.9, 0.58);
            const centerAngle = -Math.PI * 0.5 + sectorIndex * sectorWidth + sectorDrift;
            backend.compositeRingTint(
                lensCenterX,
                lensCenterY,
                lensRadiusPx * 0.76,
                lensRadiusPx * 1.46,
                color,
                clamp01(energy * lensStrength) * LENS_TINT_SATURATION_ALPHA,
                'saturation',
                centerAngle - halfVisibleWidth,
                centerAngle + halfVisibleWidth
            );
        }
    }

    /** Causal, canonical-time window average: deterministic after seek/export and allocation-free. */
    private smoothedLensTintSectorEnergy(
        sectorIndex: number,
        sectorCount: number,
        canonicalTime: number,
        fallbackSpectrum: number[],
        fallbackSpectrumLen: number
    ): number {
        const frames = State.frames;
        const frameStep = State.hopSize > 0 && State.sampleRate > 0
            ? State.sampleRate / State.hopSize
            : 0;
        let total = 0;
        let sampleCount = 0;

        if (frames.length > 0 && frameStep > 0) {
            const endFrame = Math.min(frames.length - 1, Math.max(0, Math.floor(canonicalTime * frameStep)));
            const startFrame = Math.max(0, endFrame - LENS_TINT_SMOOTHING_FRAMES + 1);
            for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
                const spectrum = frames[frameIndex].perceptualSpectrum;
                const spectrumLen = spectrum ? spectrum.length : 0;
                for (let bandIndex = sectorIndex; bandIndex < spectrumLen; bandIndex += sectorCount) {
                    total += clamp01(spectrum[bandIndex]);
                    sampleCount++;
                }
            }
        }

        if (sampleCount === 0) {
            for (let bandIndex = sectorIndex; bandIndex < fallbackSpectrumLen; bandIndex += sectorCount) {
                total += clamp01(fallbackSpectrum[bandIndex]);
                sampleCount++;
            }
        }

        const average = sampleCount > 0 ? clamp01(total / sampleCount) : 0;
        // Smoothstep suppresses low-level flicker while retaining a bounded, monotonic response.
        return average * average * (3 - 2 * average);
    }

    /**
     * Wall-as-refraction-field (true-lens plan F4): the wall's presence is no longer drawn as
     * lines -- it is read entirely through a small, bounded perturbation of the Einstein radius a
     * given source point's own azimuth (`theta`, its angle around the lens center) sees. Reuses the
     * exact same `wormholeWallRippleOffset` evaluator every drawn wall material already shared
     * (never a second, independently authored distortion source): its own two-harmonic sine wave,
     * advected at the same `WALL_ADVECTION_HORIZON` rate every other wall texture flows at, using a
     * fixed `ringDepthPhase=0` reference (the throat's near-plane -- there is no depth-stack of
     * "lens rings" the way the drawn wall has, only this one screen-space radius). `waveOffset` is
     * the theta-independent kick/LOW_DROP swell computed once per frame by the caller (same value
     * for every point this frame, unlike the per-point ripple) so a pressure front reads as the
     * whole ring briefly swelling, not a directional bump. Bounded to `+-LENS_WALL_PERTURBATION_MAX`.
     */
    private perturbedLensRadius(
        theta: number,
        lensRadiusPx: number,
        travelDistance: number,
        waveOffset: number
    ): number {
        const ripple = wormholeWallRippleOffset(theta, 0, travelDistance);
        const perturbation = clamp(ripple + waveOffset, -LENS_WALL_PERTURBATION_MAX, LENS_WALL_PERTURBATION_MAX);
        return lensRadiusPx * (1 + perturbation);
    }

    /**
     * Einstein-ring residual glow (true-lens plan F3). The ring itself now emerges from real
     * lensed starlight (F1's forward mapping) and the secondary image (F2); this layer only adds a
     * faint, uniform brightness breath on top, not a second light source. Every spot around the
     * ring shares the exact same brightness (aggregate, whole-spectrum energy, never a per-band
     * lookup), so the ring breathes together instead of the old per-spot 24-band flashing chain --
     * that stroboscopic dot-chain read is exactly what this task removes. The seeded phase offsets
     * and slow travel/canonical-time advection stay only to keep the spot placement organic (not a
     * mechanical, perfectly regular polygon); with every spot now equally bright, the advection
     * itself is close to imperceptible under the ring's own rotational symmetry, but costs nothing
     * to keep for placement variety across presets/seeds.
     */
    private drawEinsteinRing(
        backend: VisualRendererBackend,
        lensCenterX: number,
        lensCenterY: number,
        lensRadiusPx: number,
        lensStrength: number,
        travelDistance: number,
        canonicalTime: number,
        performanceMode: boolean,
        lineAlpha: number,
        spectrum: number[],
        spectrumLen: number,
        lensWallWaveOffset: number
    ): void {
        const spotCount = performanceMode ? EINSTEIN_RING_GLOW_COUNT_PERFORMANCE : EINSTEIN_RING_GLOW_COUNT;
        const ringGain = wormholeLensMagnificationGain(
            lensRadiusPx * lensRadiusPx, lensRadiusPx, lensStrength
        );
        if (ringGain <= 0) return;

        let aggregateEnergy = 0;
        for (let bandIndex = 0; bandIndex < spectrumLen; bandIndex++) aggregateEnergy += spectrum[bandIndex];
        aggregateEnergy = spectrumLen > 0 ? clamp01(aggregateEnergy / spectrumLen) : 0;
        const brightness = ringGain * aggregateEnergy;
        if (brightness <= 0) return;
        const glowAlpha = brightness * lineAlpha * EINSTEIN_RING_ALPHA_SCALE;

        const advectedTheta = travelDistance / Z_REFERENCE * EINSTEIN_RING_ADVECTION_PER_HORIZON
            + canonicalTime * EINSTEIN_RING_CANONICAL_DRIFT;
        for (let spotIndex = 0; spotIndex < spotCount; spotIndex++) {
            const seed = EINSTEIN_RING_SEED + spotIndex * 19.19;
            const seededPhase = pseudoNoise(seed, 4.7) * TWO_PI;
            const theta = (spotIndex / spotCount) * TWO_PI + seededPhase * 0.28 + advectedTheta;
            const spotRadius = Math.max(
                EINSTEIN_RING_RADIUS_MIN_PX,
                lensRadiusPx * (EINSTEIN_RING_RADIUS_FRACTION + pseudoNoise(seed, 8.3) * 0.045)
            );
            // Wall-as-refraction-field (true-lens plan F4): each spot sits on its own azimuth's
            // perturbed radius, so this residual glow wobbles in lockstep with the real lensed
            // points around it instead of tracing a perfectly circular contour on top of them.
            const perturbedSpotRadius = this.perturbedLensRadius(theta, lensRadiusPx, travelDistance, lensWallWaveOffset);
            backend.radialGlow(
                lensCenterX + Math.cos(theta) * perturbedSpotRadius,
                lensCenterY + Math.sin(theta) * perturbedSpotRadius,
                spotRadius,
                this.einsteinRingColor,
                glowAlpha
            );
        }
    }

    /**
     * Wall dispatcher (Phase 8 of the wall plan): computes the shared setup every wall material needs
     * and picks exactly one base material -- the default rippling membrane grid (`drawMembraneGrid`)
     * or the discrete, opt-in pixel-mosaic tick grid (`drawMosaicGrid`) -- then always layers the
     * peak-only crack accent (`drawCracks`) on top regardless of material, since a crack is wall
     * damage, not a property of one specific material.
     */
    private drawWall(
        backend: VisualRendererBackend,
        tuning: VisualTuningConfig,
        camZ: number,
        cx: number,
        cy: number,
        fov: number,
        lineAlpha: number,
        routeTurnVisualGain: number,
        travelDistance: number,
        r: number,
        g: number,
        b: number,
        spectrum: number[],
        spectrumLen: number,
        waveFrontCount: number
    ): void {
        const wallAmount = tuning.wormholeWall;
        const performanceMode = tuning.performanceMode > 0;
        const wallMaxZ = Z_REFERENCE * tuning.wormholeDepth;
        const wallRadius = WALL_BASE_RADIUS * Math.max(0.05, tuning.wormholeRadius);

        if (tuning.wormholeWallMode === 1) {
            this.drawMosaicGrid(
                backend, tuning, camZ, cx, cy, fov, lineAlpha, routeTurnVisualGain, wallAmount,
                wallMaxZ, wallRadius, performanceMode, r, g, b, spectrum, spectrumLen, waveFrontCount
            );
        } else {
            this.drawMembraneGrid(
                backend, tuning, camZ, cx, cy, fov, lineAlpha, routeTurnVisualGain, travelDistance,
                wallAmount, performanceMode, wallMaxZ, wallRadius, r, g, b, spectrum, spectrumLen, waveFrontCount
            );
        }

        this.drawCracks(
            backend, tuning, camZ, cx, cy, fov, routeTurnVisualGain, wallAmount, performanceMode,
            wallMaxZ, wallRadius, lineAlpha, waveFrontCount
        );
    }

    /**
     * Membrane wall (refractive membrane wall plan, Phases 4, 6 & 7): a rippling ring/segment grid
     * framing the tunnel, a small set of brighter analytic caustic helices layered on top, and
     * event-driven kick/LOW_DROP pressure-wave bumps sharing the ripple's own radius channel. Every
     * ring sits at a *fixed* camera-space depth (unlike grains, it never travels or regenerates); the
     * flowing look comes only from the ripple/caustic phase terms scrolling with `travelDistance` plus
     * the wave fronts' own age-based position. Sector brightness reuses the grain field's exact
     * `bandIndex` mapping so both the membrane and the caustics light up in lockstep with the circular
     * spectrograph instead of drifting from it. Spectrum energy drives only
     * alpha/refraction/caustic-brightness (`WormholeWallMaterial`), never radius -- radius comes only
     * from `wormholeWallRippleOffset` and `wormholeWallWaveOffset` (`WormholeWallWaves`), summed once
     * per ring, never per segment. Caustics reuse each ring's already-sampled route frame from the
     * membrane pass above them; they never sample the route a second time.
     */
    private drawMembraneGrid(
        backend: VisualRendererBackend,
        tuning: VisualTuningConfig,
        camZ: number,
        cx: number,
        cy: number,
        fov: number,
        lineAlpha: number,
        routeTurnVisualGain: number,
        travelDistance: number,
        wallAmount: number,
        performanceMode: boolean,
        wallMaxZ: number,
        wallRadius: number,
        r: number,
        g: number,
        b: number,
        spectrum: number[],
        spectrumLen: number,
        waveFrontCount: number
    ): void {
        const segmentCount = wormholeWallSegmentCount(performanceMode);
        const ringCount = wormholeWallRingCount(performanceMode);
        // Performance mode drops the chromatic pass entirely (plan Phase 4 gate).
        const refraction = performanceMode ? 0 : tuning.wormholeWallRefraction;
        // Shares the ripple's own radius channel (plan Phase 5): never scaled by the wallAmount
        // master, exactly like ripple isn't -- only this sub-layer's own authored intensity.
        const wavesAmount = waveFrontCount > 0 ? clamp01(tuning.wormholeWallWaves) : 0;

        for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
            const ringDepthPhase = wormholeWallRingDepthPhase(ringIndex, ringCount);
            const ringZ = wormholeWallRingZ(ringIndex, ringCount, wallMaxZ);

            // Always sample and cache this ring's route frame and vertical drift (geometry-overhaul
            // plan T3), regardless of whether the membrane itself ends up visible here: the dense
            // caustic pass below reuses every ring's frame as an interpolation bracket, so a gap in
            // the cache would leave a hole in caustic coverage even where a caustic's own fresnel
            // gate says it should still be visible.
            this.routePath.sampleSmoothedLookahead(camZ + ringZ, this.wallRingFrames[ringIndex]);
            this.routePathVertical.sampleSmoothedLookahead(camZ + ringZ, this.routeNowV);
            this.wallRingVerticalDrift[ringIndex] = this.routeNowV.positionX - this.baseRouteNowV.positionX;
            this.wallRingDepthPhase[ringIndex] = ringDepthPhase;

            const fresnel = wormholeWallFresnel(ringZ, wallMaxZ);
            if (fresnel <= 0.001) continue;

            const routeNow = this.wallRingFrames[ringIndex];
            const verticalDrift = this.wallRingVerticalDrift[ringIndex];

            // Pressure-wave radius bump is a function of ringDepthPhase only (not theta/segment), so
            // it is evaluated once per ring, exactly like fresnel/ringZ above.
            const waveOffset = wavesAmount > 0
                ? wormholeWallWaveOffset(this.waveFronts, waveFrontCount, ringDepthPhase) * wavesAmount
                : 0;

            const center = projectWormholeTubePoint(
                routeNow, this.baseRouteNow, ringZ, 0, 0, routeTurnVisualGain, cx, cy, fov, verticalDrift
            );
            // Clump gate (geometry-overhaul plan T2): a ring sits at one fixed depth, so the clump
            // field's depth-phase argument is the same advected phase the ripple already reads for
            // every segment on this ring -- computed once here, not per segment.
            const advectedDepthPhase = wormholeWallAdvectedPhase(ringDepthPhase, travelDistance);

            let firstX = 0;
            let firstY = 0;
            let firstAlpha = 0;
            let firstWeight = 0;
            let firstClump = 0;
            let prevX = 0;
            let prevY = 0;

            for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
                const theta = wormholeWallSegmentTheta(segmentIndex, segmentCount);
                const ripple = wormholeWallRippleOffset(theta, ringDepthPhase, travelDistance);
                const radius = wallRadius * (1 + ripple + waveOffset);
                const bandIndex = wormholeWallBandIndex(theta);
                const bandEnergy = bandIndex < spectrumLen ? clamp01(spectrum[bandIndex]) : 0;
                const sector = wormholeWallSectorResponse(bandEnergy);
                const clump = wormholeWallClumpGain(theta, advectedDepthPhase);

                const projection = projectWormholeTubePoint(
                    routeNow, this.baseRouteNow, ringZ, theta, radius, routeTurnVisualGain, cx, cy, fov,
                    verticalDrift
                );
                const sx = projection.screenX;
                const sy = projection.screenY;
                // The wall no longer draws a full closed wireframe ring: `clump` extinguishes
                // roughly 40-60% of segments and smoothsteps the rest, so the membrane reads as
                // soft, drifting patches of light on glass instead of a visible polygonal cage.
                const alpha = wallAmount * lineAlpha * fresnel * sector.alphaGain * clump * WALL_ALPHA_SCALE;
                const weight = wormholeProjectedStrokeWeight((0.4 + sector.alphaGain * 0.5) * tuning.lineWeight);

                if (segmentIndex === 0) {
                    firstX = sx;
                    firstY = sy;
                    firstAlpha = alpha;
                    firstWeight = weight;
                    firstClump = clump;
                } else if (clump > 0.001) {
                    backend.stroke(r, g, b, alpha);
                    backend.strokeWeight(weight);
                    backend.line(prevX, prevY, sx, sy);

                    if (refraction > 0) {
                        const chromaticGain = wormholeWallChromaticGain(sector.alphaGain, refraction);
                        if (chromaticGain > 0) {
                            const offsetPixels = chromaticGain * WALL_CHROMATIC_MAX_OFFSET_PX;
                            const chroma = wormholeWallChromaticOffset(sx, sy, center.screenX, center.screenY, offsetPixels);
                            const dxWarm = chroma.warmX - sx;
                            const dyWarm = chroma.warmY - sy;
                            const chromaAlpha = alpha * chromaticGain * 0.6;
                            const chromaWeight = weight * 0.7;
                            backend.stroke(this.wallWarmColor[0], this.wallWarmColor[1], this.wallWarmColor[2], chromaAlpha);
                            backend.strokeWeight(chromaWeight);
                            backend.line(prevX + dxWarm, prevY + dyWarm, sx + dxWarm, sy + dyWarm);
                            backend.stroke(this.wallCoolColor[0], this.wallCoolColor[1], this.wallCoolColor[2], chromaAlpha);
                            backend.strokeWeight(chromaWeight);
                            backend.line(prevX - dxWarm, prevY - dyWarm, sx - dxWarm, sy - dyWarm);
                        }
                    }
                }
                prevX = sx;
                prevY = sy;
            }

            // Close the ring loop the same way the loop would have connected the last segment to a
            // wrapped-around segment 0: gated by segment 0's own clump value, never unconditionally.
            if (firstClump > 0.001) {
                backend.stroke(r, g, b, firstAlpha);
                backend.strokeWeight(firstWeight);
                backend.line(prevX, prevY, firstX, firstY);
            }
        }

        // Caustic hero layer (Phases 6 & T3): its own intensity knob on top of the wall master, and
        // its own performance-mode cap (fewer helices, no glow companion) independent of the
        // segment/ring halving above. Densely sampled along depth (see `drawCaustics`), reusing the
        // ring cache just populated above instead of any further route-lookahead calls.
        const causticsAmount = tuning.wormholeWallCaustics;
        const causticCount = causticsAmount > 0
            ? (performanceMode ? Math.min(WALL_CAUSTIC_PERFORMANCE_COUNT, WALL_CAUSTIC_COUNT) : WALL_CAUSTIC_COUNT)
            : 0;
        if (causticCount > 0) {
            this.drawCaustics(
                backend, tuning, cx, cy, fov, routeTurnVisualGain, wallAmount, causticsAmount, causticCount,
                performanceMode, wallMaxZ, wallRadius, travelDistance, ringCount, spectrum, spectrumLen
            );
        }
    }

    /**
     * Caustic hero helices (geometry-overhaul plan T3): samples each helix far more densely along
     * depth than the membrane's own ring stack (`WALL_CAUSTIC_SAMPLE_COUNT`, independent of
     * `ringCount`), so up to `WALL_CAUSTIC_MAX_TURNS` turns of analytic twist read as a smooth
     * spiral instead of the old few-point jagged polygon. Never calls `sampleSmoothedLookahead`
     * itself: every fine depth sample's route frame is a linear interpolation between the two
     * bracketing membrane rings' already-cached frames (`wallRingFrames`/`wallRingVerticalDrift`,
     * populated by the ring loop in `drawMembraneGrid` just above). Sector brightness reuses the
     * same `bandIndex` mapping the membrane segments use, so a caustic brightens in lockstep with
     * the circular spectrograph instead of running on its own independent light source.
     */
    private drawCaustics(
        backend: VisualRendererBackend,
        tuning: VisualTuningConfig,
        cx: number,
        cy: number,
        fov: number,
        routeTurnVisualGain: number,
        wallAmount: number,
        causticsAmount: number,
        causticCount: number,
        performanceMode: boolean,
        wallMaxZ: number,
        wallRadius: number,
        travelDistance: number,
        ringCount: number,
        spectrum: number[],
        spectrumLen: number
    ): void {
        for (let slot = 0; slot < WALL_CAUSTIC_COUNT; slot++) this.causticPrevValid[slot] = 0;

        const sampleCount = performanceMode ? WALL_CAUSTIC_SAMPLE_COUNT_PERFORMANCE : WALL_CAUSTIC_SAMPLE_COUNT;
        // Two-pointer bracket search: both the cached coarse rings and the fine samples are
        // monotonically increasing in depth phase, so `bracketLo` only ever advances forward.
        let bracketLo = 0;

        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
            const fineDepthPhase = wormholeWallRingDepthPhase(sampleIndex, sampleCount);
            const fineZ = fineDepthPhase * wallMaxZ;
            const fresnel = wormholeWallFresnel(fineZ, wallMaxZ);

            while (
                bracketLo < ringCount - 1
                && this.wallRingDepthPhase[bracketLo + 1] <= fineDepthPhase
            ) bracketLo++;
            const bracketHi = Math.min(ringCount - 1, bracketLo + 1);
            const loPhase = this.wallRingDepthPhase[bracketLo];
            const hiPhase = this.wallRingDepthPhase[bracketHi];
            const span = hiPhase - loPhase;
            const bracketT = span > 1e-9 ? clamp01((fineDepthPhase - loPhase) / span) : 0;
            lerpWormholeRouteFrame(
                this.wallRingFrames[bracketLo], this.wallRingFrames[bracketHi], bracketT, this.causticFrame
            );
            const verticalDrift = lerp(
                this.wallRingVerticalDrift[bracketLo], this.wallRingVerticalDrift[bracketHi], bracketT
            );

            for (let causticIndex = 0; causticIndex < causticCount; causticIndex++) {
                if (fresnel <= 0.001) {
                    this.causticPrevValid[causticIndex] = 0;
                    continue;
                }
                const causticTheta = wormholeWallCausticTheta(causticIndex, fineDepthPhase, travelDistance);
                const causticBandIndex = wormholeWallBandIndex(causticTheta);
                const causticBandEnergy = causticBandIndex < spectrumLen ? clamp01(spectrum[causticBandIndex]) : 0;
                const causticSector = wormholeWallSectorResponse(causticBandEnergy);
                const causticProjection = projectWormholeTubePoint(
                    this.causticFrame, this.baseRouteNow, fineZ, causticTheta, wallRadius, routeTurnVisualGain,
                    cx, cy, fov, verticalDrift
                );
                const csx = causticProjection.screenX;
                const csy = causticProjection.screenY;
                const causticAlpha = wallAmount * causticsAmount * tuning.lineAlpha * fresnel
                    * causticSector.alphaGain * WALL_CAUSTIC_ALPHA_SCALE;
                const causticWeight = wormholeProjectedStrokeWeight(
                    (0.5 + causticSector.alphaGain * 0.6) * tuning.lineWeight * WALL_CAUSTIC_WEIGHT_SCALE
                );

                if (this.causticPrevValid[causticIndex]) {
                    backend.stroke(this.causticColor[0], this.causticColor[1], this.causticColor[2], causticAlpha);
                    backend.strokeWeight(causticWeight);
                    backend.line(this.causticPrevX[causticIndex], this.causticPrevY[causticIndex], csx, csy);
                }
                this.causticPrevX[causticIndex] = csx;
                this.causticPrevY[causticIndex] = csy;
                this.causticPrevValid[causticIndex] = 1;
            }
        }
    }

    /**
     * Pixel-mosaic wall material (Phase 8 of the wall plan): a coarser depth x angle grid of short,
     * unfilled tick marks instead of the rippling membrane grid, selected only via the discrete
     * `wormholeWallMode` = 1 switch. Spectrum energy drives only tick brightness (the exact same
     * `bandIndex`/`sectorResponse` mapping the membrane uses); an active pressure-wave front drives
     * only a bounded per-cell *angular* shift (the same `wormholeWallWaveOffset` fraction the membrane
     * reads, reinterpreted as an angle) -- discrete cells have no ripple/radius concept, so the wave
     * layer never touches radius here. Caustics are deliberately not layered on this material: smooth
     * analytic helices would read as inconsistent against a blocky digital grid.
     */
    private drawMosaicGrid(
        backend: VisualRendererBackend,
        tuning: VisualTuningConfig,
        camZ: number,
        cx: number,
        cy: number,
        fov: number,
        lineAlpha: number,
        routeTurnVisualGain: number,
        wallAmount: number,
        wallMaxZ: number,
        wallRadius: number,
        performanceMode: boolean,
        r: number,
        g: number,
        b: number,
        spectrum: number[],
        spectrumLen: number,
        waveFrontCount: number
    ): void {
        const ringCount = wormholeMosaicRingCount(performanceMode);
        const segmentCount = MOSAIC_SEGMENTS;
        const tickHalfWidth = wormholeMosaicTickHalfWidth(segmentCount);
        const wavesAmount = waveFrontCount > 0 ? clamp01(tuning.wormholeWallWaves) : 0;

        for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
            const ringDepthPhase = wormholeWallRingDepthPhase(ringIndex, ringCount);
            const ringZ = wormholeWallRingZ(ringIndex, ringCount, wallMaxZ);
            const fresnel = wormholeWallFresnel(ringZ, wallMaxZ);
            if (fresnel <= 0.001) continue;

            this.routePath.sampleSmoothedLookahead(camZ + ringZ, this.routeNow);
            this.routePathVertical.sampleSmoothedLookahead(camZ + ringZ, this.routeNowV);
            const verticalDrift = this.routeNowV.positionX - this.baseRouteNowV.positionX;

            const cellShift = wavesAmount > 0
                ? wormholeWallWaveOffset(this.waveFronts, waveFrontCount, ringDepthPhase) * wavesAmount * MOSAIC_SHIFT_RADIANS_PER_UNIT
                : 0;

            for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
                const cellTheta = wormholeWallSegmentTheta(segmentIndex, segmentCount) + cellShift;
                const bandIndex = wormholeWallBandIndex(cellTheta);
                const bandEnergy = bandIndex < spectrumLen ? clamp01(spectrum[bandIndex]) : 0;
                const sector = wormholeWallSectorResponse(bandEnergy);

                const pointA = projectWormholeTubePoint(
                    this.routeNow, this.baseRouteNow, ringZ, cellTheta - tickHalfWidth, wallRadius,
                    routeTurnVisualGain, cx, cy, fov, verticalDrift
                );
                const pointB = projectWormholeTubePoint(
                    this.routeNow, this.baseRouteNow, ringZ, cellTheta + tickHalfWidth, wallRadius,
                    routeTurnVisualGain, cx, cy, fov, verticalDrift
                );

                const alpha = wallAmount * lineAlpha * fresnel * sector.alphaGain * WALL_ALPHA_SCALE;
                const weight = wormholeProjectedStrokeWeight((0.4 + sector.alphaGain * 0.5) * tuning.lineWeight);
                backend.stroke(r, g, b, alpha);
                backend.strokeWeight(weight);
                backend.line(pointA.screenX, pointA.screenY, pointB.screenX, pointB.screenY);
            }
        }
    }

    /**
     * Peak-only crack flashes (Phase 8 of the wall plan): a small, pre-generated, deterministic crack
     * pool (`WormholeWallCracks`) that only lights up under an active kick/LOW_DROP pressure front --
     * reusing the very same fronts `drawMembraneGrid`/`drawMosaicGrid` already read, never a second
     * event source. Fully disabled in performance mode. Each visible crack point samples its own route
     * frame (its fixed depth differs from every ring), then the whole crack is drawn as one warm/cool
     * chromatically-split polyline, reusing the wall's own `wallWarmColor`/`wallCoolColor` and the
     * `wormholeWallRefraction` dial that already gates the membrane's own chromatic fringe.
     */
    private drawCracks(
        backend: VisualRendererBackend,
        tuning: VisualTuningConfig,
        camZ: number,
        cx: number,
        cy: number,
        fov: number,
        routeTurnVisualGain: number,
        wallAmount: number,
        performanceMode: boolean,
        wallMaxZ: number,
        wallRadius: number,
        lineAlpha: number,
        waveFrontCount: number
    ): void {
        if (performanceMode) return;
        const cracksAmount = tuning.wormholeWallCracks;
        if (cracksAmount <= 0) return;
        const refraction = tuning.wormholeWallRefraction;

        for (let crackIndex = 0; crackIndex < WALL_CRACK_COUNT; crackIndex++) {
            const emission = wormholeWallCrackEmission(crackIndex, this.waveFronts, waveFrontCount);
            if (emission <= 0.001) continue;

            const pointCount = wormholeWallCrackPointCount(crackIndex);
            let prevSx = 0;
            let prevSy = 0;
            let havePrev = false;

            for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
                const point = wormholeWallCrackPoint(crackIndex, pointIndex);
                const z = point.depthPhase * wallMaxZ;
                const fresnel = wormholeWallFresnel(z, wallMaxZ);

                this.routePath.sampleSmoothedLookahead(camZ + z, this.routeNow);
                this.routePathVertical.sampleSmoothedLookahead(camZ + z, this.routeNowV);
                const verticalDrift = this.routeNowV.positionX - this.baseRouteNowV.positionX;
                const projection = projectWormholeTubePoint(
                    this.routeNow, this.baseRouteNow, z, point.theta, wallRadius, routeTurnVisualGain, cx, cy, fov,
                    verticalDrift
                );
                const sx = projection.screenX;
                const sy = projection.screenY;

                if (havePrev && fresnel > 0.001) {
                    const alpha = wallAmount * cracksAmount * lineAlpha * fresnel * emission * WALL_CRACK_ALPHA_SCALE;
                    const weight = wormholeProjectedStrokeWeight(
                        (0.5 + emission * 0.8) * tuning.lineWeight * WALL_CRACK_WEIGHT_SCALE
                    );
                    backend.stroke(this.causticColor[0], this.causticColor[1], this.causticColor[2], alpha);
                    backend.strokeWeight(weight);
                    backend.line(prevSx, prevSy, sx, sy);

                    if (refraction > 0) {
                        const center = projectWormholeTubePoint(
                            this.routeNow, this.baseRouteNow, z, 0, 0, routeTurnVisualGain, cx, cy, fov, verticalDrift
                        );
                        const offsetPixels = emission * WALL_CRACK_CHROMATIC_MAX_OFFSET_PX;
                        const chroma = wormholeWallChromaticOffset(sx, sy, center.screenX, center.screenY, offsetPixels);
                        const dxWarm = chroma.warmX - sx;
                        const dyWarm = chroma.warmY - sy;
                        const chromaAlpha = alpha * 0.7;
                        const chromaWeight = weight * 0.7;
                        backend.stroke(this.wallWarmColor[0], this.wallWarmColor[1], this.wallWarmColor[2], chromaAlpha);
                        backend.strokeWeight(chromaWeight);
                        backend.line(prevSx + dxWarm, prevSy + dyWarm, sx + dxWarm, sy + dyWarm);
                        backend.stroke(this.wallCoolColor[0], this.wallCoolColor[1], this.wallCoolColor[2], chromaAlpha);
                        backend.strokeWeight(chromaWeight);
                        backend.line(prevSx - dxWarm, prevSy - dyWarm, sx - dxWarm, sy - dyWarm);
                    }
                }
                prevSx = sx;
                prevSy = sy;
                havePrev = true;
            }
        }
    }

    /**
     * Snapshot the same rendered radius/depth values a live slider adjustment would expose through
     * `State.visualTuning`. The LFO sits directly behind those authored controls: it changes the
     * effective parameter sampled by a newly released grain, while the grain keeps that geometry
     * for the rest of its generation just like any other radius/depth tuning change.
     */
    private snapshotGrainGeometry(grain: DustGrain, tuning: VisualTuningConfig, timeSec: number): void {
        grain.releaseRadius = effectiveWormholeGeometryValue(
            tuning.wormholeRadius,
            tuning.wormholeRadiusLfoWaveform,
            timeSec,
            tuning.wormholeRadiusLfoRate,
            tuning.wormholeRadiusLfoAmount
        );
        grain.releaseDepth = effectiveWormholeGeometryValue(
            tuning.wormholeDepth,
            tuning.wormholeDepthLfoWaveform,
            timeSec,
            tuning.wormholeDepthLfoRate,
            tuning.wormholeDepthLfoAmount,
            WORMHOLE_DEPTH_LFO_PHASE_OFFSET
        );
        grain.releaseWarp = Math.max(0, finiteOr(tuning.wormholeWarp, 0));
        grain.releaseCurve = clamp01(tuning.wormholeCurve);
        grain.releaseRing = clamp01(tuning.wormholeRing);
        grain.releaseDepthCoherence = clamp01(tuning.wormholeDepthCoherence);
        grain.releaseGeometryInitialized = true;
    }

    private travelDistanceAt(timeSec: number): number {
        const baseDistance = this.transport.distanceAt(timeSec);
        const authoredOffset = this.authoredSpeedTimeline.offsetAt(
            timeSec,
            this.currentAuthoredTravelRate(),
            State.targetTuning.morphDurationSec
        );
        return Math.max(0, baseDistance + authoredOffset);
    }

    private currentAuthoredTravelRate(): number {
        const playbackAuthority = State.isExporting ? 1 : clamp01(State.playbackFade);
        return 1 + (State.targetTuning.wormholeSpeed - 1) * playbackAuthority;
    }

    /** Canonical instantaneous distance rate (world units/sec): transport + authored offset. */
    private travelRateAt(timeSec: number): number {
        return Math.max(0, this.transport.rateAt(timeSec) + this.authoredSpeedTimeline.rateAt(timeSec));
    }

    private transitionDisturbanceEnvelope(
        current: VisualTuningConfig,
        target: VisualTuningConfig,
        activeTransitionId: string | null,
        timeSec: number
    ): number {
        if (!activeTransitionId) {
            this.transitionPulseId = null;
            return 0;
        }
        if (this.transitionPulseId !== activeTransitionId) {
            this.transitionPulseId = activeTransitionId;
            this.transitionPulseStartedAt = timeSec;
        }
        return wormholeTransitionMorphEnvelope(
            current,
            target,
            activeTransitionId,
            timeSec - this.transitionPulseStartedAt
        );
    }

    /**
     * Deepest layer: a dense astropicture-like sky plate, the slowest and flattest of the three
     * background layers. It has no independent per-star depth to divide by, so its world-space
     * translate is expressed as a small fraction of its own tile radius (`SKYBOX_ROUTE_WORLD_FRACTION`)
     * instead of a world-unit scale, giving it a faint but genuine lateral parallax cue rather than a
     * fully static plate. `baseRoutePrev` is a single shared previous-frame sample (computed once by
     * the caller, not per star) that turns the previously static point draw into a short, bounded
     * trail whose length scales with the shared cosmos travel rate -- the same reactivity every other
     * layer gets, just capped small since this is the most distant layer.
     */
    private drawSkybox(
        backend: VisualRendererBackend,
        baseRoute: WormholeRouteFrame,
        baseRoutePrev: WormholeRouteFrame,
        baseRouteV: WormholeRouteFrame,
        baseRoutePrevV: WormholeRouteFrame,
        turnSmooth: number,
        turnSmoothPrev: number,
        routeTurnVisualGain: number,
        amount: number,
        impact: number,
        cx: number,
        cy: number,
        frameTick: number,
        skyboxSeparation: number,
        canonicalRate: number,
        applyLens: boolean,
        lensCenterX: number,
        lensCenterY: number,
        lensRadiusPx: number,
        lensStrength: number,
        lensSwirl: number,
        travelDistance: number,
        lensWallWaveOffset: number
    ): void {
        if (amount <= 0) return;
        const radius = Math.hypot(cx, cy) * SKYBOX_TILE_RADIUS;
        const parallax = wormholeParallaxStrength(turnSmooth);
        const prevParallax = wormholeParallaxStrength(turnSmoothPrev);
        const routePan = wormholeSkyboxPanHeading(baseRoute.headingAngle) * radius * SKYBOX_ROUTE_WORLD_FRACTION * parallax * routeTurnVisualGain;
        const prevRoutePan = wormholeSkyboxPanHeading(baseRoutePrev.headingAngle) * radius * SKYBOX_ROUTE_WORLD_FRACTION * prevParallax * routeTurnVisualGain;
        // Vertical mirror (Task 08): the independent vertical steering integrator's own heading pans
        // the plate along screen-Y with the same tanh-saturated formula and the same combined
        // (H+V) parallax strength -- no camera roll, just a second orthogonal pan term.
        const routePanV = wormholeSkyboxPanHeading(baseRouteV.headingAngle) * radius * SKYBOX_ROUTE_WORLD_FRACTION * parallax * routeTurnVisualGain;
        const prevRoutePanV = wormholeSkyboxPanHeading(baseRoutePrevV.headingAngle) * radius * SKYBOX_ROUTE_WORLD_FRACTION * prevParallax * routeTurnVisualGain;
        // Minimal, canonical-rate-derived forward cue: even on a dead-straight route (bend=0) the
        // plate still shows a short, capped zoom-streak toward the current point instead of an
        // exactly static line -- `skyboxSeparation` is the same shared, capped travel rate every
        // other background layer already uses, just rescaled into a tiny fraction of the plate radius.
        const baseForwardShrink = skyboxSeparation / radius;
        for (let i = 0; i < this.skyPool.length; i++) {
            const star = this.skyPool[i];
            const sx = cx + star.x * radius + routePan;
            const sy = cy + star.y * radius + routePanV;
            const lensDx = sx - lensCenterX;
            const lensDy = sy - lensCenterY;
            const lensSmearGain = lensStrength > 0
                ? wormholeLensSmearGain(lensDx * lensDx + lensDy * lensDy, lensRadiusPx, canonicalRate)
                : 1;
            // The pre-existing forward-cue ceiling remains authoritative even after the local lens
            // emphasis. Route-pan separation is independently bounded by SKYBOX_TRAVEL_RATE_CAP.
            const forwardShrink = Math.min(SKYBOX_FORWARD_CUE_CAP, baseForwardShrink * lensSmearGain);
            const prevSx = cx + star.x * radius + prevRoutePan
                + forwardShrink * (cx - sx);
            const prevSy = cy + star.y * radius + prevRoutePanV
                + forwardShrink * (cy - sy);

            let lineSx = sx;
            let lineSy = sy;
            let linePrevSx = prevSx;
            let linePrevSy = prevSy;
            let magnification = 1;
            if (applyLens) {
                const dxLens = sx - lensCenterX;
                const dyLens = sy - lensCenterY;
                const d2Lens = dxLens * dxLens + dyLens * dyLens;
                // Wall-as-refraction-field (true-lens plan F4): this point's own local Einstein
                // radius, perturbed by its azimuth around the lens center -- computed once and
                // reused for the warp, magnification, and near-axis fade below so all three stay
                // consistent for this one point.
                const theta = Math.atan2(dyLens, dxLens);
                const perturbedRadius = this.perturbedLensRadius(theta, lensRadiusPx, travelDistance, lensWallWaveOffset);
                // Near-axis fade (true-lens plan F1): a source passing close to the lens axis
                // sweeps around the Einstein ring at an angular rate that blows up as its true
                // distance from center shrinks -- a discrete tile can only render that as a
                // frame-to-frame jump, so fade it out in that narrow band instead.
                const axisVisibility = wormholeLensNearAxisVisibility(Math.sqrt(d2Lens), perturbedRadius);
                magnification = (1 + wormholeLensMagnificationGain(d2Lens, perturbedRadius, lensStrength))
                    * axisVisibility;
                wormholeLensWarpPoint(
                    sx, sy, lensCenterX, lensCenterY, perturbedRadius, lensStrength, lensSwirl,
                    this.lensWarpPointA
                );
                wormholeLensWarpPoint(
                    prevSx, prevSy, lensCenterX, lensCenterY, perturbedRadius, lensStrength, lensSwirl,
                    this.lensWarpPointB
                );
                lineSx = this.lensWarpPointA.x;
                lineSy = this.lensWarpPointA.y;
                linePrevSx = this.lensWarpPointB.x;
                linePrevSy = this.lensWarpPointB.y;
            }

            // Motion-safety gate (mirrors the starfield loop's own gate below): a lens-warped
            // point near the axis can jump a long screen distance between the streak's two
            // endpoints even after the fade above. Reads the warped endpoints, since the warp
            // itself -- not just world/route motion -- can introduce the jump this catches.
            const skyboxProjectedMotion = Math.hypot(lineSx - linePrevSx, lineSy - linePrevSy);
            const skyboxMotionVisibility = 1 - clamp01((skyboxProjectedMotion - 120) / 180);

            const tw = 0.88 + 0.12 * Math.sin(frameTick * 0.035 + star.twPhase);
            const dustAlpha = star.haze * 34 * tw * amount * magnification * skyboxMotionVisibility;
            if (dustAlpha > 0.2) {
                backend.stroke(star.r, star.g, star.b, dustAlpha);
                backend.strokeWeight(star.size * 2.2);
                backend.line(linePrevSx, linePrevSy, lineSx, lineSy);
            }
            const alpha = ((5 + star.mag * 150) * tw + impact * star.mag * 58)
                * amount * magnification * skyboxMotionVisibility;
            backend.stroke(star.r, star.g, star.b, alpha);
            backend.strokeWeight(star.size);
            backend.line(linePrevSx, linePrevSy, lineSx, lineSy);
        }
    }

}

interface RouteHistorySample extends WormholeRouteFrameWithDistance {}

export class IntegratedWormholeRoute {
    private readonly state = createWormholeRouteState();
    private readonly history: RouteHistorySample[] = Array.from(
        { length: ROUTE_HISTORY_CAPACITY },
        createRouteHistorySample
    );
    private historyHead = -1;
    private historyCount = 0;
    private readonly turnNow = createRouteFrame();
    private readonly turnPast = createRouteFrame();
    private readonly lookaheadState = createRouteHistorySample();

    reset(distance: number, bend: number): void {
        resetWormholeRouteState(this.state, distance, bend);
        this.historyHead = -1;
        this.historyCount = 0;
        this.pushCurrent();
    }

    /** Seek/backstop reset: reconstructs the converged (distance, bend) steering state instead of
     *  the always-heading-0 straight baseline `reset` uses, so the post-seek frame matches what
     *  continuous playback at this bend would already look like. */
    resetConverged(distance: number, bend: number): void {
        resetWormholeRouteStateConverged(this.state, distance, bend);
        this.historyHead = -1;
        this.historyCount = 0;
        this.pushCurrent();
    }

    advance(distance: number, bend: number): void {
        const safeDistance = routeDistanceOrZero(distance);
        if (!this.state.initialized || safeDistance < this.state.distance - ROUTE_BACKWARD_RESET_THRESHOLD) {
            this.resetConverged(safeDistance, bend);
            return;
        }
        // Within tolerance: hold the camera instead of integrating backward. Clamping the
        // incoming distance to the current state distance makes `advanceWormholeRouteState`
        // take its existing stationary (deltaDistance <= epsilon) branch.
        const clampedDistance = Math.max(safeDistance, this.state.distance);

        const previous = this.historyHead >= 0 ? this.history[this.historyHead] : null;
        advanceWormholeRouteState(this.state, clampedDistance, bend);
        if (
            !previous
            || Math.abs(this.state.distance - previous.distance) >= ROUTE_HISTORY_MIN_DISTANCE
            || Math.abs(this.state.headingAngle - previous.headingAngle) > 1e-8
            || Math.abs(this.state.curvature - previous.curvature) > 1e-10
        ) {
            this.pushCurrent();
        }
    }

    sample(distance: number, out: WormholeRouteFrame): WormholeRouteFrame {
        const safeDistance = routeDistanceOrZero(distance);
        if (!this.state.initialized) this.reset(safeDistance, 0);
        if (safeDistance >= this.state.distance - ROUTE_HISTORY_DISTANCE_EPSILON) {
            return sampleWormholeRouteStateFrame(this.state, safeDistance, out);
        }
        return this.sampleHistory(safeDistance, out);
    }

    /** Distance-windowed, continuous turn measure: |heading(d) - heading(d-W)| / (kmax*W), clamped. */
    smoothedTurnIntensity(
        distance: number,
        windowDistance: number = ROUTE_TURN_SMOOTHING_DISTANCE
    ): number {
        const safeDistance = routeDistanceOrZero(distance);
        const safeWindow = routeDistanceOrZero(windowDistance);
        if (safeWindow <= ROUTE_HISTORY_DISTANCE_EPSILON || ROUTE_CURVATURE <= 0) return 0;
        this.sample(safeDistance, this.turnNow);
        this.sample(Math.max(0, safeDistance - safeWindow), this.turnPast);
        return clamp01(
            Math.abs(this.turnNow.headingAngle - this.turnPast.headingAngle)
            / (ROUTE_CURVATURE * safeWindow)
        );
    }

    /** Uses the same distance window to keep far background look-ahead geometry continuous. */
    sampleSmoothedLookahead(distance: number, out: WormholeRouteFrame): WormholeRouteFrame {
        if (!this.state.initialized) return this.sample(distance, out);
        return this.sampleSmoothedLookaheadFrom(this.state, distance, out);
    }

    /** Previous integrated-state variant used by allocation-free trail/motion checks. */
    samplePreviousSmoothedLookahead(distance: number, out: WormholeRouteFrame): WormholeRouteFrame {
        if (this.historyCount <= 0) return this.sample(distance, out);
        const previousOffset = this.historyCount > 1 ? 1 : 0;
        return this.sampleSmoothedLookaheadFrom(this.historyAt(previousOffset), distance, out);
    }

    private sampleHistory(distance: number, out: WormholeRouteFrame): WormholeRouteFrame {
        if (this.historyCount <= 0) {
            return sampleWormholeRouteStateFrame(this.state, distance, out);
        }

        let newer = this.historyAt(0);
        if (distance >= newer.distance) {
            return sampleWormholeRouteStateFrame(newer, distance, out);
        }

        for (let offset = 1; offset < this.historyCount; offset++) {
            const older = this.historyAt(offset);
            if (distance >= older.distance && distance <= newer.distance) {
                return interpolateRouteHistoryFrame(older, newer, distance, out);
            }
            newer = older;
        }

        return sampleWormholeRouteStateFrame(this.historyAt(this.historyCount - 1), distance, out);
    }

    private sampleSmoothedLookaheadFrom(
        anchor: WormholeRouteFrameWithDistance,
        distance: number,
        out: WormholeRouteFrame
    ): WormholeRouteFrame {
        const safeDistance = routeDistanceOrZero(distance);
        if (safeDistance <= anchor.distance + ROUTE_HISTORY_DISTANCE_EPSILON) {
            return this.sample(safeDistance, out);
        }
        const pastDistance = Math.max(0, anchor.distance - ROUTE_TURN_SMOOTHING_DISTANCE);
        this.sampleHistory(pastDistance, this.turnPast);
        const averageCurvature = (
            anchor.headingAngle - this.turnPast.headingAngle
        ) / ROUTE_TURN_SMOOTHING_DISTANCE;
        this.lookaheadState.distance = anchor.distance;
        this.lookaheadState.targetHeading = anchor.headingAngle
            + averageCurvature * ROUTE_TURN_SMOOTHING_DISTANCE;
        copyWormholeRouteFrame(anchor, this.lookaheadState);
        this.lookaheadState.curvature = averageCurvature;
        return sampleWormholeRouteStateFrame(this.lookaheadState, safeDistance, out);
    }

    private historyAt(offsetFromNewest: number): RouteHistorySample {
        const index = (this.historyHead - offsetFromNewest + ROUTE_HISTORY_CAPACITY) % ROUTE_HISTORY_CAPACITY;
        return this.history[index];
    }

    private pushCurrent(): void {
        this.historyHead = (this.historyHead + 1) % ROUTE_HISTORY_CAPACITY;
        const sample = this.history[this.historyHead];
        sample.distance = this.state.distance;
        sample.targetHeading = this.state.targetHeading;
        copyWormholeRouteFrame(this.state, sample);
        this.historyCount = Math.min(ROUTE_HISTORY_CAPACITY, this.historyCount + 1);
    }
}

function wormholeTransitionMorphEnvelope(
    current: VisualTuningConfig,
    target: VisualTuningConfig,
    activeTransitionId: string | null,
    elapsedSec: number
): number {
    if (!activeTransitionId) return 0;
    // Route bend already has two continuity layers: tuning morph and distance-domain steering.
    // Feeding that same delta into a per-grain distortion pulse made a bend change look like a
    // geometry jump even when the route itself was continuous. Transition energy remains available
    // for local material/tube-character changes, never for route retargeting alone.
    const diff =
        Math.abs(current.wormholeWarp - target.wormholeWarp) * 0.16
        + Math.abs(current.wormholeCurve - target.wormholeCurve) * 0.42
        + Math.abs(current.wormholeRadius - target.wormholeRadius) * 0.28
        + Math.abs(current.wormholeDepth - target.wormholeDepth) * 0.12
        + Math.abs(current.wormholeEmissionMode - target.wormholeEmissionMode) * 0.18;
    const t = clamp01(diff);
    const diffEnvelope = t * t * (3 - 2 * t);
    const age = clamp01(elapsedSec / TRANSITION_DISTURBANCE_DURATION_SEC);
    const pulse = Math.sin(Math.PI * age);
    return diffEnvelope * pulse * pulse;
}

/** Blend a dispersed depth toward the centre of its discrete layer ring (mid-layer, always > 0). */
function ringBlend(z: number, step: number, amount: number): number {
    const ringZ = (Math.floor(z / step) + 0.5) * step;
    return z + (ringZ - z) * amount;
}

/**
 * Absolute generation index for a grain: a pure function of current travel distance, the grain's
 * fixed depth phase, and the reference horizon. `0` means "not yet released"; it increases by
 * exactly one full crossing per generation, but jumps straight to the correct value regardless of
 * how large the gap since the last observation was, so no distance/FPS-independent bookkeeping
 * (frame-to-frame delta detection) is needed to avoid skipping a generation.
 */
function generationIndexAt(travelDistance: number, depthPhase: number, horizon: number): number {
    const safeHorizon = Math.max(1, horizon);
    return Math.floor(travelDistance / safeHorizon - depthPhase) + 1;
}

/** Deterministic hash-noise in [0, 1) — no Math.random, stable for identical inputs. */
function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * Task 08: combines the horizontal and vertical steering integrators' independently smoothed turn
 * intensities into one diagonal-aware measure that every background layer's parallax call reads,
 * instead of each layer picking one axis. `hypot(h, 0) === h`, so a vertical-bend of exactly zero
 * (the default) reproduces the pre-Task-08 horizontal-only value bit-for-bit.
 */
function combinedTurnIntensity(horizontal: number, vertical: number): number {
    return clamp01(Math.hypot(horizontal, vertical));
}

function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function routeDistanceOrZero(distance: number): number {
    return Math.max(0, Number.isFinite(distance) ? distance : 0);
}

function createRouteHistorySample(): RouteHistorySample {
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
        turnIntensity: 0,
        targetHeading: 0
    };
}

function interpolateRouteHistoryFrame(
    older: RouteHistorySample,
    newer: RouteHistorySample,
    distance: number,
    out: WormholeRouteFrame
): WormholeRouteFrame {
    const span = Math.max(ROUTE_HISTORY_DISTANCE_EPSILON, newer.distance - older.distance);
    const t = clamp((distance - older.distance) / span, 0, 1);
    out.positionX = lerp(older.positionX, newer.positionX, t);
    out.positionY = lerp(older.positionY, newer.positionY, t);
    out.headingAngle = lerp(older.headingAngle, newer.headingAngle, t);
    out.curvature = lerp(older.curvature, newer.curvature, t);
    out.turnIntensity = lerp(older.turnIntensity, newer.turnIntensity, t);
    out.tangentX = Math.sin(out.headingAngle);
    out.tangentY = Math.cos(out.headingAngle);
    out.normalX = out.tangentY;
    out.normalY = -out.tangentX;
    return out;
}

/**
 * Linear interpolation between two already-sampled route frames (geometry-overhaul plan T3): used
 * by the dense caustic pass to approximate a route frame at a fine depth between two coarse
 * membrane rings, without an extra `sampleSmoothedLookahead` call. Re-derives tangent/normal from
 * the lerped `headingAngle` (never lerps the raw vectors themselves) so the result stays a valid
 * unit tangent/normal pair, exactly like `interpolateRouteHistoryFrame` above.
 */
function lerpWormholeRouteFrame(
    a: WormholeRouteFrame,
    b: WormholeRouteFrame,
    t: number,
    out: WormholeRouteFrame
): WormholeRouteFrame {
    out.positionX = lerp(a.positionX, b.positionX, t);
    out.positionY = lerp(a.positionY, b.positionY, t);
    out.headingAngle = lerp(a.headingAngle, b.headingAngle, t);
    out.curvature = lerp(a.curvature, b.curvature, t);
    out.turnIntensity = lerp(a.turnIntensity, b.turnIntensity, t);
    out.tangentX = Math.sin(out.headingAngle);
    out.tangentY = Math.cos(out.headingAngle);
    out.normalX = out.tangentY;
    out.normalY = -out.tangentX;
    return out;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function createRouteFrame(): WormholeRouteFrame {
    return {
        positionX: 0,
        positionY: 0,
        tangentX: 0,
        tangentY: 1,
        normalX: 1,
        normalY: 0,
        headingAngle: 0,
        curvature: 0,
        turnIntensity: 0
    };
}

export const cosmicWormholeIdentity: VisualIdentity = new CosmicWormholeIdentity();
