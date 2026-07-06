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
    createWormholeGrainCharacter,
    sampleWormholeBackgroundViewerFrame,
    wormholeBackgroundWorldRelative,
    wormholeBackwardTrailCorrection,
    wormholeGrainFlowAngle,
    wormholeKickReleaseEnvelope,
    wormholeKickSwarmGain,
    wormholeLowDropGain,
    wormholeLowDropMaterialGain,
    wormholeLowDropReleaseEnvelope,
    wormholeNearPlaneVisibility,
    wormholeProjectedStrokeWeight,
    wormholeProjectedTrailScale,
    sampleWormholeRoute,
    type WormholeRouteSample,
    type WormholeScreenPoint,
    type WormholeViewerFrame,
    wormholeViewerRelativeRoute,
    wormholeVisibilityFloor
} from './WormholeGrainField';
import { computeWormholeMotionProfile } from './WormholeMotionProfile';
import {
    canonicalWormholeTime,
    WormholeAuthoredSpeedTimeline,
    WormholeTransport,
    wormholeKickEnvelopeAtTime,
    wormholeLowDropAtTime
} from './WormholeTimeline';

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
/**
 * Single master strength knob for the background route-follow world transform. The shared
 * `WormholeViewerFrame` carries the canonical arc's lateral offset and tangent; every background
 * layer applies that same translated frame before its own perspective divide, so stars, galaxies,
 * and the skybox flow with the wormhole instead of receiving independent pans or route samples.
 * Layers keep their own relative weight below; this scales all of them together.
 */
const BACKGROUND_ROUTE_FOLLOW_SCALE = 22;
/** World-unit lateral translate applied to the near starfield. */
const STAR_ROUTE_WORLD_SCALE = 220 * BACKGROUND_ROUTE_FOLLOW_SCALE;
/** Galaxies bank softer and drift over a wider world scale than the near starfield. */
const GALAXY_ROUTE_WORLD_SCALE = 150 * BACKGROUND_ROUTE_FOLLOW_SCALE;
/** The skybox is a single flat, infinitely-distant plate: no depth to divide by, so its translate
 * is expressed as a small fraction of its own tile radius instead of a world-unit scale. */
const SKYBOX_ROUTE_WORLD_FRACTION = 0.04 * BACKGROUND_ROUTE_FOLLOW_SCALE;
const VIEWER_ROUTE_LOOKAHEAD = 1100;
const VIEWER_ROUTE_DEPTH_T = 0.5;
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
    releasePathBend: number;
    releaseRing: number;
    releaseDepthCoherence: number;
    releaseContinuity: number;
    releaseSpeed: number;
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

export class CosmicWormholeIdentity implements VisualIdentity {
    readonly id = 'cosmic-wormhole';
    readonly name = 'Cosmic Wormhole';

    private readonly pool: DustGrain[] = [];
    private readonly starPool: Star[] = [];
    private readonly galaxyPool: Galaxy[] = [];
    private readonly skyPool: SkyStar[] = [];
    private readonly lineColor: [number, number, number] = [0, 0, 0];
    private readonly galaxyColor: [number, number, number] = [0, 0, 0];
    /** Grain-only, route-relative frame: keeps the foreground tube ahead of the viewer (core stabilization). */
    private readonly routeNow: WormholeRouteSample = { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    private readonly routePrev: WormholeRouteSample = { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    private readonly viewerRouteNow: WormholeRouteSample = { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    private readonly viewerRoutePrev: WormholeRouteSample = { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    private readonly routeRelativeNow: WormholeRouteSample = { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    private readonly routeRelativePrev: WormholeRouteSample = { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 };
    /** Background-only world-transform scratch: reused across stars/galaxies/skybox, never by grains. */
    private readonly rotatedPoint: WormholeScreenPoint = { x: 0, y: 0 };
    /** The viewer's own current/previous lateral position in the background route field, sampled
     * once per frame from live tuning (never a grain's frozen `releasePathBend`), and shared by every
     * background object so the whole field reads as one coherent world instead of per-object noise. */
    private readonly backgroundViewerNow: WormholeViewerFrame = { offsetX: 0, offsetY: 0, headingX: 0, headingY: 0, turnAngle: 0 };
    private readonly backgroundViewerPrev: WormholeViewerFrame = { offsetX: 0, offsetY: 0, headingX: 0, headingY: 0, turnAngle: 0 };
    private readonly transport = new WormholeTransport();
    private readonly authoredSpeedTimeline = new WormholeAuthoredSpeedTimeline();
    private travelPhase = 0;

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
                releasePathBend: 0,
                releaseRing: 0,
                releaseDepthCoherence: 0,
                releaseContinuity: 1,
                releaseSpeed: 1,
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
            this.snapshotGrainGeometry(grain, State.visualTuning);
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
        const automationResponse = this.automationResponseAt(timeSec);
        const effectivePathBend = clamp01(tuning.wormholePathBend * (1 + automationResponse * 0.35));
        const effectiveSpeed = Math.max(0.1, tuning.wormholeSpeed * (1 + automationResponse * 0.18));
        const effectiveContinuity = Math.max(0, tuning.wormholeContinuity * (1 + automationResponse * 0.25));
        const vz = effectiveSpeed * 10 * motion.travelSpeed;
        if (featureFlags.wormholeDiagnostics) wormholeDepthDiagnostics.beginFrame(diagnosticMaxZ, vz);
        // Fractional values are a crossfade coordinate between valid integer emission modes;
        // WormholeEmission resolves the two modes separately and blends their gains.
        const emissionMode = clamp(tuning.wormholeEmissionMode, 0, 2);
        const camZ = travelDistance;

        const lineAlpha = tuning.lineAlpha;
        const lineWeight = tuning.lineWeight;
        const frameTick = timeSec;
        const pathScale = backend.height * 0.22;
        // Background layers get a genuine viewer route frame, not a screen-space rotation: the
        // viewer's own lateral world offset and route tangent are sampled once per frame -- at the
        // camera's own travel distance, never at each object's own depth -- so every star, galaxy,
        // and skybox tile shares exactly the same world transform and reads as one coherent world
        // instead of per-object noise (see documents/audits/wormhole-travel-and-path-bend-plan.md).
        // This always reads live `tuning.wormholePathBend`, never a grain's frozen
        // `releasePathBend`, so the background cue never waits for a grain generation release.
        // Current and previous star endpoints sample two different viewer positions/headings
        // (`camZ` and one representative step behind it), so the streak motion vector itself carries
        // the turn, not just a shared in-place rotation of the existing radial streak. This is
        // scoped to background layers only: the foreground core keeps its own, unrelated
        // grainRouteRelative stabilization below and never reads these frames.
        sampleWormholeBackgroundViewerFrame(camZ, effectivePathBend, this.backgroundViewerNow);
        sampleWormholeBackgroundViewerFrame(
            Math.max(0, camZ - vz), effectivePathBend, this.backgroundViewerPrev
        );

        if (featureFlags.wormholeSkybox) {
            this.drawSkybox(
                backend, this.backgroundViewerNow,
                tuning.wormholeSkybox * lineAlpha, impact, cx, cy, frameTick
            );
        }

        // Deep galaxies bank into the turn over a wider, softer world scale than the near starfield.
        const galaxyAmount = tuning.wormholeGalaxy;
        if (galaxyAmount > 0 && shouldUseExpensiveGlow(tuning)) {
            for (let i = 0; i < this.galaxyPool.length; i++) {
                const galaxy = this.galaxyPool[i];
                const gz = depthFromPhase(
                    (i + 0.5) / GALAXY_COUNT,
                    wrapDepthPhase(camZ * GALAXY_SPEED_RATIO / MAX_GALAXY_Z),
                    MAX_GALAXY_Z
                );
                const gNearVisibility = wormholeNearPlaneVisibility(gz, MAX_GALAXY_Z);
                const gNear = 1 - gz / MAX_GALAXY_Z;
                const gProjZ = Math.max(gz, GALAXY_PROJECTION_Z_FLOOR);
                wormholeBackgroundWorldRelative(
                    galaxy.x, galaxy.y, this.backgroundViewerNow,
                    GALAXY_ROUTE_WORLD_SCALE, this.rotatedPoint
                );
                const gx = cx + (this.rotatedPoint.x / gProjZ) * fov;
                const gy = cy + (this.rotatedPoint.y / gProjZ) * fov;
                const gRadius = Math.max(8, (GALAXY_CORE / gProjZ) * fov);
                const gAlpha = (0.018 + gNear * 0.05 + impact * 0.03) * galaxyAmount * lineAlpha * gNearVisibility;
                this.galaxyColor[0] = galaxy.r;
                this.galaxyColor[1] = galaxy.g;
                this.galaxyColor[2] = galaxy.b;
                backend.radialGlow(gx, gy, gRadius, this.galaxyColor, gAlpha);
            }
        }

        // Stars carry the strongest route-follow cue. Near/far falloff is not a manual gain table:
        // the world-space translate happens before the perspective divide below, so near stars
        // (small z) automatically sweep further across the screen than distant ones for the exact
        // same world-unit offset.
        const starAmount = tuning.wormholeStarfield;
        if (starAmount > 0) {
            const vzStar = vz * STAR_SPEED_RATIO;
            for (let i = 0; i < this.starPool.length; i++) {
                const star = this.starPool[i];
                const z = depthFromPhase(
                    pseudoNoise(star.seed, 33.3),
                    wrapDepthPhase(camZ * STAR_SPEED_RATIO / MAX_STAR_Z),
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
                const prevZ = z + vzStar;
                const invZ = 1 / Math.max(z, STAR_PROJECTION_Z_FLOOR);
                const invPrev = 1 / Math.max(prevZ, STAR_PROJECTION_Z_FLOOR);
                // Proportional depth cue: near stars are bright, thick streaks; far ones faint specks.
                const sNear = 1 - z / MAX_STAR_Z;
                wormholeBackgroundWorldRelative(
                    star.x, star.y, this.backgroundViewerNow,
                    STAR_ROUTE_WORLD_SCALE, this.rotatedPoint
                );
                const sx = cx + this.rotatedPoint.x * invZ * fov;
                const sy = cy + this.rotatedPoint.y * invZ * fov;
                wormholeBackgroundWorldRelative(
                    star.x, star.y, this.backgroundViewerPrev,
                    STAR_ROUTE_WORLD_SCALE, this.rotatedPoint
                );
                const psx = cx + this.rotatedPoint.x * invPrev * fov;
                const psy = cy + this.rotatedPoint.y * invPrev * fov;

                const sAlpha = (10 + sNear * sNear * 120 + impact * 60) * lineAlpha * starAmount * nearVisibility;
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
            if (!grain.releaseGeometryInitialized) this.snapshotGrainGeometry(grain, State.visualTuning);

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
                this.snapshotGrainGeometry(grain, State.visualTuning);
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
            const z = grain.releaseRing > 0 ? ringBlend(grainDepth, ringStep, grain.releaseRing) : grainDepth;

            // The trail's tail is a real earlier travel sample, not a velocity-estimated guess:
            // an explicit earlier distance is projected the same way as the current one.
            const distanceNow = travelDistance;
            const trailDepth = effectiveSpeed * 10 * motion.travelSpeed * effectiveContinuity;
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
                : grain.releaseRing > 0 ? ringBlend(previousDepth, ringStep, grain.releaseRing) : previousDepth;
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
            let sx = cx + radius * Math.cos(thetaNow) * invZ * fov;
            let sy = cy + radius * Math.sin(thetaNow) * invZ * fov;
            let px = cx + radius * Math.cos(thetaPrev) * invPrev * fov;
            let py = cy + radius * Math.sin(thetaPrev) * invPrev * fov;

            // Sample the same world route for the grain and viewer, then express both endpoints in
            // the viewer-local frame. This keeps the core ahead of the lens instead of translating
            // the entire tube as a screen-space object.
            sampleWormholeRoute(distanceNow + z, depthT, effectivePathBend, this.routeNow);
            sampleWormholeRoute(distancePrev + prevZ, prevDepthT, effectivePathBend, this.routePrev);
            sampleWormholeRoute(
                distanceNow + VIEWER_ROUTE_LOOKAHEAD,
                VIEWER_ROUTE_DEPTH_T,
                effectivePathBend,
                this.viewerRouteNow
            );
            sampleWormholeRoute(
                distancePrev + VIEWER_ROUTE_LOOKAHEAD,
                VIEWER_ROUTE_DEPTH_T,
                effectivePathBend,
                this.viewerRoutePrev
            );
            wormholeViewerRelativeRoute(
                this.routeNow,
                this.viewerRouteNow,
                z - VIEWER_ROUTE_LOOKAHEAD,
                this.routeRelativeNow
            );
            wormholeViewerRelativeRoute(
                this.routePrev,
                this.viewerRoutePrev,
                prevZ - VIEWER_ROUTE_LOOKAHEAD,
                this.routeRelativePrev
            );
            const routeNowX = this.routeRelativeNow.offsetX * pathScale;
            const routeNowY = this.routeRelativeNow.offsetY * pathScale;
            const routePrevX = this.routeRelativePrev.offsetX * pathScale;
            const routePrevY = this.routeRelativePrev.offsetY * pathScale;
            sx += routeNowX;
            sy += routeNowY;
            px += routePrevX;
            py += routePrevY;

            let materialGain = 1;
            if (lowDropReleaseGain > 0.0005) {
                materialGain = wormholeLowDropMaterialGain(lowDropReleaseGain, grain.releaseVariant);
            }

            // Evaluate the safety invariant in the route-local tube cross-section. Measuring from
            // the fixed lens would misclassify legitimate centerline turns as backward grain flow.
            // The rendered tail still comes from its real previous route sample above.
            const headX = sx - cx - routeNowX;
            const headY = sy - cy - routeNowY;
            const tailX = px - cx - routePrevX;
            const tailY = py - cy - routePrevY;
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
            const alpha = lineAlpha * fade * emissionGain * Math.max(visibilityFloor, reactiveGrainAlpha);
            const weight = wormholeProjectedStrokeWeight(
                (0.4 + energy * 3.2) * lineWeight * grain.weightScale * materialGain * (1 + kickGain * 0.3)
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

    /** Freeze all position-affecting tuning for one grain generation. */
    private snapshotGrainGeometry(grain: DustGrain, tuning: VisualTuningConfig): void {
        grain.releaseRadius = Math.max(0.1, finiteOr(tuning.wormholeRadius, 1));
        grain.releaseDepth = Math.max(0.1, finiteOr(tuning.wormholeDepth, 1));
        grain.releaseWarp = Math.max(0, finiteOr(tuning.wormholeWarp, 0));
        grain.releaseCurve = clamp01(tuning.wormholeCurve);
        grain.releasePathBend = clamp01(tuning.wormholePathBend);
        grain.releaseRing = clamp01(tuning.wormholeRing);
        grain.releaseDepthCoherence = clamp01(tuning.wormholeDepthCoherence);
        grain.releaseContinuity = Math.max(0, finiteOr(tuning.wormholeContinuity, 1));
        grain.releaseSpeed = Math.max(0.1, finiteOr(tuning.wormholeSpeed, 1));
        grain.releaseGeometryInitialized = true;
    }

    private automationResponseAt(timeSec: number): number {
        const plan = State.editedPerformancePlan ?? State.performancePlan;
        if (!plan?.points.length || !Number.isFinite(timeSec)) return 0;
        let active: { time: number; morphDurationSec: number } | null = null;
        for (const point of plan.points) {
            if (point.time > timeSec) break;
            active = point;
        }
        if (!active) return 0;
        const duration = Math.max(0.1, active.morphDurationSec);
        const age = timeSec - active.time;
        if (age < 0 || age > duration) return 0;
        const t = clamp01(age / duration);
        return 1 - t * t * (3 - 2 * t);
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
    /**
     * Deepest layer: a dense astropicture-like sky plate, the slowest and flattest of the three
     * background layers. It has no independent per-star depth to divide by, so its world-space
     * translate is expressed as a small fraction of its own tile radius (`SKYBOX_ROUTE_WORLD_FRACTION`)
     * instead of a world-unit scale, giving it a faint but genuine lateral parallax cue rather than a
     * fully static plate.
     */
    private drawSkybox(
        backend: VisualRendererBackend,
        viewerFrame: WormholeViewerFrame,
        amount: number,
        impact: number,
        cx: number,
        cy: number,
        frameTick: number
    ): void {
        if (amount <= 0) return;
        const radius = Math.hypot(cx, cy) * SKYBOX_TILE_RADIUS;
        const worldScale = radius * SKYBOX_ROUTE_WORLD_FRACTION;
        for (let i = 0; i < this.skyPool.length; i++) {
            const star = this.skyPool[i];
            wormholeBackgroundWorldRelative(
                star.x * radius, star.y * radius, viewerFrame,
                worldScale, this.rotatedPoint
            );
            const sx = cx + this.rotatedPoint.x;
            const sy = cy + this.rotatedPoint.y;
            const tw = 0.88 + 0.12 * Math.sin(frameTick * 0.035 + star.twPhase);
            const dustAlpha = star.haze * 34 * tw * amount;
            if (dustAlpha > 0.2) {
                backend.stroke(star.r, star.g, star.b, dustAlpha);
                backend.strokeWeight(star.size * 2.2);
                backend.line(sx, sy, sx, sy);
            }
            const alpha = ((5 + star.mag * 150) * tw + impact * star.mag * 58) * amount;
            backend.stroke(star.r, star.g, star.b, alpha);
            backend.strokeWeight(star.size);
            backend.line(sx, sy, sx, sy);
        }
    }

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

function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export const cosmicWormholeIdentity: VisualIdentity = new CosmicWormholeIdentity();
