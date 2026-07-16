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
    wormholeParallaxStrength,
    wormholeTrailSeparation,
    SKYBOX_TRAVEL_RATE_CAP
} from './WormholeCosmicSync';

const TWO_PI = Math.PI * 2;
const BANDS = 24;
const DEPTH_LAYERS = 15;
/** Fixed dust pool: one grain per (band, depth layer). Allocated once in the constructor (GC-safe). */
const POOL_SIZE = BANDS * DEPTH_LAYERS;
/** Reference horizon distance at depth = 1; the live horizon is this scaled by wormholeDepth. */
const Z_REFERENCE = 1000;
/** Background parallax universe (near star layer). */
const STAR_COUNT = 1800;
const MAX_STAR_Z = 8000;
const STAR_FIELD_HALF = 6000;
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
    private readonly galaxyPool: Galaxy[] = [];
    private readonly skyPool: SkyStar[] = [];
    private readonly lineColor: [number, number, number] = [0, 0, 0];
    private readonly galaxyColor: [number, number, number] = [0, 0, 0];
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
    private readonly transport = new WormholeTransport();
    private readonly authoredSpeedTimeline = new WormholeAuthoredSpeedTimeline();
    private travelPhase = 0;
    private transitionPulseId: string | null = null;
    private transitionPulseStartedAt = 0;

    constructor() {
        for (let i = 0; i < POOL_SIZE; i++) {
            const bandIndex = i % BANDS;
            const layer = Math.floor(i / BANDS);
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

        if (featureFlags.wormholeSkybox) {
            const skyboxTravelRate = Math.min(
                SKYBOX_TRAVEL_RATE_CAP,
                wormholeTrailSeparation(canonicalRate, SKYBOX_ROUTE_WORLD_FRACTION)
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
                skyboxTravelRate
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
                backend.radialGlow(gx, gy, gRadius, this.galaxyColor, gAlpha);

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
                backend.radialGlow(gxPrev, gyPrev, gRadius * 0.7, this.galaxyColor, gAlpha * 0.4);
            }
        }

        // Stars carry the strongest route-follow cue. Near/far falloff is not a manual gain table:
        // the world-space translate happens before the perspective divide below, so near stars
        // (small z) automatically sweep further across the screen than distant ones for the exact
        // same world-unit offset.
        const starAmount = tuning.wormholeStarfield;
        if (starAmount > 0) {
            const starDepthTravel = camZ * STAR_SPEED_RATIO;
            const vzStar = wormholeTrailSeparation(canonicalRate, STAR_SPEED_RATIO);
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

                // Motion-safety gate: a very near/wide star can still have a finite position while
                // crossing an implausibly large screen distance in one frame. Fade that material
                // before drawing instead of clipping geometry or changing stable pool indexing.
                const projectedMotion = Math.hypot(sx - psx, sy - psy);
                const starMotionVisibility = 1 - clamp01((projectedMotion - 120) / 180);
                const marginX = Math.max(1, backend.width * 0.1);
                const marginY = Math.max(1, backend.height * 0.1);
                const viewportVisibility = Math.min(
                    clamp01((sx + marginX) / marginX),
                    clamp01((backend.width + marginX - sx) / marginX),
                    clamp01((sy + marginY) / marginY),
                    clamp01((backend.height + marginY - sy) / marginY)
                );
                const sAlpha = (10 + sNear * sNear * 120 + impact * 60)
                    * lineAlpha * starAmount * starNearVisibility * starMotionVisibility * viewportVisibility;
                const sWeight = (0.4 + sNear * sNear * 2.2) * lineWeight;
                backend.stroke(star.r, star.g, star.b, sAlpha);
                backend.strokeWeight(sWeight);
                backend.line(psx, psy, sx, sy);
            }
        }

        // --- Color: GC-free, shifted by vocal (+) and melody (-) ---
        const hue = tuning.circleHue + vocal * 40 - melody * 30;
        hueToRgbInto(this.lineColor, hue, 0.82, Math.min(0.85, 0.55 + impact * 0.18));
        const r = this.lineColor[0];
        const g = this.lineColor[1];
        const b = this.lineColor[2];

        const spectrum = State.currentFrame.perceptualSpectrum;
        const spectrumLen = spectrum ? spectrum.length : 0;
        // Ring vs. dispersion feature: 0 = the natural random spread, 1 = grains snapped to discrete
        // concentric depth rings (the look the wrap bug used to force — now an opt-in parameter).
        const jitter = authoredJitter;
        const generationHorizon = this.generationHorizon();

        for (let i = 0; i < this.pool.length; i++) {
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
                grain, depthT, grain.releaseWarp, grain.releaseCurve, grain.releaseBass
            );
            const flowPrev = wormholeGrainFlowAngle(
                grain, prevDepthT, grain.releaseWarp, grain.releaseCurve, grain.releaseBass
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
            const reactiveGrainAlpha = (12 + energy * 188) * grain.alphaScale * materialGain * releaseLift;
            const visibilityFloor = wormholeVisibilityFloor(depthT);
            const alpha = lineAlpha * fade * emissionGain * Math.max(visibilityFloor, reactiveGrainAlpha)
                * transitionEnergyNow.alphaScale;
            const weight = wormholeProjectedStrokeWeight(
                (0.4 + energy * 3.2) * lineWeight * grain.weightScale * materialGain * (1 + kickGain * 0.3)
                * transitionEnergyNow.strokeScale
            );
            const trailScale = wormholeProjectedTrailScale(px - sx, py - sy, backend.height);
            if (trailScale < 1) {
                px = sx + (px - sx) * trailScale;
                py = sy + (py - sy) * trailScale;
            }

            backend.stroke(r, g, b, alpha);
            backend.strokeWeight(weight);
            backend.line(px, py, sx, sy);
        }
        if (featureFlags.wormholeDiagnostics) wormholeDepthDiagnostics.endFrame();
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
        skyboxSeparation: number
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
        const forwardShrink = Math.min(SKYBOX_FORWARD_CUE_CAP, skyboxSeparation / radius);
        for (let i = 0; i < this.skyPool.length; i++) {
            const star = this.skyPool[i];
            const sx = cx + star.x * radius + routePan;
            const sy = cy + star.y * radius + routePanV;
            const prevSx = cx + star.x * radius + prevRoutePan
                + forwardShrink * (cx - sx);
            const prevSy = cy + star.y * radius + prevRoutePanV
                + forwardShrink * (cy - sy);
            const tw = 0.88 + 0.12 * Math.sin(frameTick * 0.035 + star.twPhase);
            const dustAlpha = star.haze * 34 * tw * amount;
            if (dustAlpha > 0.2) {
                backend.stroke(star.r, star.g, star.b, dustAlpha);
                backend.strokeWeight(star.size * 2.2);
                backend.line(prevSx, prevSy, sx, sy);
            }
            const alpha = ((5 + star.mag * 150) * tw + impact * star.mag * 58) * amount;
            backend.stroke(star.r, star.g, star.b, alpha);
            backend.strokeWeight(star.size);
            backend.line(prevSx, prevSy, sx, sy);
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
