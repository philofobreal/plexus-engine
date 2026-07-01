import { getBackgroundClearStyle, hueToRgbInto, shouldUseExpensiveGlow } from '../config/visualTuning';
import { featureFlags } from '../config/featureFlags';
import { State } from '../state/store';
import type { Particle } from './Particle';
import type { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';
import type { VisualIdentity } from './VisualIdentity';
import { wrapDepth } from './WormholeDepth';
import { WormholeAutomationTransition, wormholeEmissionGain } from './WormholeEmission';

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
const SKYBOX_PARALLAX_GAIN = 0.34;

/**
 * A single stardust grain living in cylinder space: a fixed angular position
 * (`theta`) on the tube wall, a band assignment for spectral reactivity, and a
 * running depth (`z`) that streams toward the camera. Screen position is derived
 * every frame via perspective division, so the object itself is never realloc'd.
 */
interface DustGrain {
    theta: number;
    z: number;
    bandIndex: number;
    seed: number;
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

class CosmicWormholeIdentity implements VisualIdentity {
    readonly id = 'cosmic-wormhole';
    readonly name = 'Cosmic Wormhole';

    private readonly pool: DustGrain[] = [];
    private readonly starPool: Star[] = [];
    private readonly galaxyPool: Galaxy[] = [];
    private readonly skyPool: SkyStar[] = [];
    private readonly lineColor: [number, number, number] = [0, 0, 0];
    private readonly galaxyColor: [number, number, number] = [0, 0, 0];
    /** Accumulated travel along Z; feeds the curvature phase so the tunnel snakes over time. */
    private cameraTravelDist = 0;
    /** Smoothed curve amplitude to avoid hard bends when the impulse fires. */
    private curveAmpSmooth = 0;
    /** Decaying surge that triggers a bend on each dramaturgy phase change (preset transition). */
    private curveImpulse = 0;
    /** Last seen director phase, to detect transitions. */
    private lastDirectorState = '';
    /** Automation response follows the preset morph instead of firing on its first frame. */
    private readonly automationTransition = new WormholeAutomationTransition();

    constructor() {
        for (let i = 0; i < POOL_SIZE; i++) {
            const bandIndex = i % BANDS;
            const layer = Math.floor(i / BANDS);
            const seed = (i + 1) * 12.9898;
            // Each band owns an angular sector; grains are spread inside it and staggered in depth.
            const theta = (bandIndex / BANDS) * TWO_PI + (pseudoNoise(seed, 1.7) / BANDS) * TWO_PI;
            const z = ((layer + pseudoNoise(seed, 3.1)) / DEPTH_LAYERS) * Z_REFERENCE;
            this.pool.push({ theta, z, bandIndex, seed });
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

    draw(backend: VisualRendererBackend, _particles: Particle[], _shockwaves: Shockwave[]): void {
        const tuning = State.visualTuning;
        const cx = backend.width / 2;
        const cy = backend.height / 2;
        // FOV bound to height (not width) so the tunnel always fits vertically on a 16:9 canvas.
        const fov = backend.height * 1.2;

        const impact = State.denseImpactFlash;
        const clear = getBackgroundClearStyle(tuning, impact * 10 + State.modulation.rhythmicImpulse * 6 + State.cueDecay * 4);
        backend.background(
            Math.min(clear.r + 1, 14),
            Math.min(clear.g + 1, 8),
            Math.min(clear.b + 6 + State.modulation.kineticTension * 6, 30),
            clear.a
        );

        // --- Dramaturgy / modulation inputs ---
        const momentum = State.modulation.macroMomentum;
        const density = State.modulation.densityDrive;
        const tension = State.modulation.kineticTension;
        const orbit = State.directorOutput.centripetalOrbit;
        const glitch = State.directorOutput.glitchIntensity;
        const vocal = State.currentFeatures.vocal;
        const melody = State.currentFeatures.melody;

        // --- Projection constants (task-specified) ---
        const maxZ = Z_REFERENCE * tuning.wormholeDepth;
        const vz = (tuning.wormholeSpeed * 10 + momentum * 30 + density * 20) * State.playbackFade;
        const radius = (50 + density * 40) * tuning.wormholeRadius;
        const warpK = 0.001 * tuning.wormholeWarp * (tension + orbit);
        // Fractional values are a crossfade coordinate between valid integer emission modes;
        // WormholeEmission resolves the two modes separately and blends their gains.
        const emissionMode = clamp(tuning.wormholeEmissionMode, 0, 2);
        const automationResponse = this.automationTransition.update(
            State.activeAutomationTransitionId,
            State.currentTime,
            State.targetTuning.morphDurationSec
        );
        this.curveImpulse = Math.max(this.curveImpulse, automationResponse * 0.65);

        // Advance camera. Automation curvature ramps over the configured morph duration, while
        // dramaturgy phase changes retain their deliberately fast performance impulse.
        // tension/orbit add a gentler continuous lean on top. The whole
        // amplitude is scaled by the dedicated `wormholeCurve` master (0..1) so the tuning panel can
        // force a perfectly straight tube (0) or full bends (1) regardless of preset content.
        this.cameraTravelDist += vz;
        const phase = State.directorOutput.state;
        if (phase !== this.lastDirectorState) {
            this.curveImpulse = 1;
            this.lastDirectorState = phase;
        }
        this.curveImpulse *= 0.96;
        const targetAmp = tuning.wormholeCurve * (this.curveImpulse * 700 + tension * 320 + orbit * 380);
        this.curveAmpSmooth = tuning.wormholeCurve <= 0
            ? 0
            : this.curveAmpSmooth + (targetAmp - this.curveAmpSmooth) * 0.05;
        const curveAmp = this.curveAmpSmooth;
        const camZ = this.cameraTravelDist;
        // Camera fix: keep the lens (z=0) point centered so we always fly *inside* the tube.
        const baseOffsetX = this.curveOffsetX(camZ, curveAmp);
        const baseOffsetY = this.curveOffsetY(camZ, curveAmp);
        // Previous-frame camera position drives the background parallax sweep.
        const prevBaseOffsetX = this.curveOffsetX(camZ - vz, curveAmp);
        const prevBaseOffsetY = this.curveOffsetY(camZ - vz, curveAmp);

        const lineAlpha = tuning.lineAlpha;
        const lineWeight = tuning.lineWeight;
        const frameTick = Math.floor(State.rotationPhase);

        if (featureFlags.wormholeSkybox) {
            const skyCamera = this.updateSkyboxCamera(baseOffsetX, baseOffsetY, backend.height);
            this.drawSkybox(backend, skyCamera.panX, skyCamera.panY, tuning.wormholeSkybox, impact, cx, cy, frameTick);
        }

        // --- Deepest layer: distant galaxies that wrap the whole scene. They sit far beyond the
        // stars in absolute world space and parallax with the camera, so the entire universe turns
        // as the tunnel bends. Amount is a general, preset-independent master (wormholeGalaxy). ---
        const galaxyAmount = tuning.wormholeGalaxy;
        if (galaxyAmount > 0 && shouldUseExpensiveGlow(tuning)) {
            const vzGalaxy = vz * GALAXY_SPEED_RATIO;
            for (let i = 0; i < this.galaxyPool.length; i++) {
                const galaxy = this.galaxyPool[i];
                galaxy.z -= vzGalaxy;
                if (galaxy.z <= 0) {
                    galaxy.z = MAX_GALAXY_Z;
                    galaxy.x = baseOffsetX + (pseudoNoise(galaxy.seed, camZ) * 2 - 1) * GALAXY_FIELD_HALF;
                    galaxy.y = baseOffsetY + (pseudoNoise(galaxy.seed + 2.7, camZ) * 2 - 1) * GALAXY_FIELD_HALF;
                }
                const gz = galaxy.z;
                const gx = cx + (galaxy.x - baseOffsetX) / gz * fov;
                const gy = cy + (galaxy.y - baseOffsetY) / gz * fov;
                const gNear = 1 - gz / MAX_GALAXY_Z;
                const gRadius = Math.max(8, (GALAXY_CORE / gz) * fov);
                const gAlpha = (0.018 + gNear * 0.05 + impact * 0.03) * galaxyAmount;
                this.galaxyColor[0] = galaxy.r;
                this.galaxyColor[1] = galaxy.g;
                this.galaxyColor[2] = galaxy.b;
                backend.radialGlow(gx, gy, gRadius, this.galaxyColor, gAlpha);
            }
        }

        // --- Background starfield: a universe in *absolute* world space. The camera follows the
        // curving tube, so subtracting the camera offset makes the stars sweep sideways whenever the
        // tunnel bends — the real parallax cue. Density is the general wormholeStarfield master. ---
        const starAmount = tuning.wormholeStarfield;
        const vzStar = vz * STAR_SPEED_RATIO;
        for (let i = 0; i < this.starPool.length; i++) {
            const star = this.starPool[i];
            star.z -= vzStar;
            if (star.z <= 0) {
                // Recycle to the far plane around the *current* camera position (GC-free).
                star.z = MAX_STAR_Z;
                star.x = baseOffsetX + (pseudoNoise(star.seed, camZ) * 2 - 1) * STAR_FIELD_HALF;
                star.y = baseOffsetY + (pseudoNoise(star.seed + 1.3, camZ) * 2 - 1) * STAR_FIELD_HALF;
            }
            const z = star.z;
            const prevZ = z + vzStar;
            const invZ = 1 / z;
            const invPrev = 1 / prevZ;
            // Subtract the camera offset (now vs. previous frame) from the absolute star position.
            const relX = star.x - baseOffsetX;
            const relY = star.y - baseOffsetY;
            const prevRelX = star.x - prevBaseOffsetX;
            const prevRelY = star.y - prevBaseOffsetY;
            const sx = cx + relX * invZ * fov;
            const sy = cy + relY * invZ * fov;
            const psx = cx + prevRelX * invPrev * fov;
            const psy = cy + prevRelY * invPrev * fov;

            // Proportional depth cue: near stars are bright, thick streaks; far ones faint specks.
            const sNear = 1 - z / MAX_STAR_Z;
            const sAlpha = (10 + sNear * sNear * 120 + impact * 60) * lineAlpha * starAmount;
            const sWeight = (0.4 + sNear * sNear * 2.2) * lineWeight;
            backend.stroke(star.r, star.g, star.b, sAlpha);
            backend.strokeWeight(sWeight);
            backend.line(psx, psy, sx, sy);
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
        const ring = tuning.wormholeRing;
        const ringStep = maxZ / DEPTH_LAYERS;
        const trailDepth = vz * tuning.wormholeContinuity;
        const jitter = clamp01(tuning.wormholeJitter);

        for (let i = 0; i < this.pool.length; i++) {
            const grain = this.pool[i];

            // Stream toward the camera; recycle past the lens back to the horizon. Modular wrap
            // (NOT a reset to exactly maxZ) preserves each grain's sub-step depth phase, so the
            // random spread never collapses into quantized rings after a full play-through + seek.
            grain.z = wrapDepth(grain.z - vz, maxZ);
            const emissionGain = wormholeEmissionGain(
                emissionMode,
                grain.seed,
                frameTick,
                State.modulation.rhythmicImpulse
            );
            if (emissionGain <= 0.001) continue;
            const z = ring > 0 ? ringBlend(grain.z, ringStep, ring) : grain.z;
            const previousDepth = wrapDepth(grain.z + trailDepth, maxZ);
            const prevZ = ring > 0 ? ringBlend(previousDepth, ringStep, ring) : previousDepth;

            // Spiral warp accumulates with depth; tension + orbit twist the whole tube.
            const thetaNow = grain.theta + z * warpK;
            const thetaPrev = grain.theta + prevZ * warpK;
            const invZ = 1 / z;
            const invPrev = 1 / prevZ;

            // Tunnel curvature: lateral offset as a function of world depth, recentered on the lens.
            const dx = this.curveOffsetX(camZ + z, curveAmp) - baseOffsetX;
            const dy = this.curveOffsetY(camZ + z, curveAmp) - baseOffsetY;

            let sx = cx + dx + radius * Math.cos(thetaNow) * invZ * fov;
            let sy = cy + dy + radius * Math.sin(thetaNow) * invZ * fov;
            let px = cx + dx + radius * Math.cos(thetaPrev) * invPrev * fov;
            let py = cy + dy + radius * Math.sin(thetaPrev) * invPrev * fov;

            // Glitch / camera shake: deterministic per-index offset under LOW_DROP.
            const shakeMagnitude = Math.min(24, glitch * 16 + jitter * (4 + State.modulation.rhythmicImpulse * 14));
            if (shakeMagnitude > 0) {
                const jitterTick = frameTick * (1 + jitter * 0.7);
                const ox = (pseudoNoise(i, jitterTick) * 2 - 1) * shakeMagnitude;
                const oy = (pseudoNoise(i, jitterTick + 7.3) * 2 - 1) * shakeMagnitude;
                sx += ox;
                sy += oy;
                px += ox;
                py += oy;
            }

            // Horizon fading: emerge from the far plane, fade out fast at the lens.
            const depthT = z / maxZ;
            const farFade = 1 - depthT * depthT;
            const nearFade = z < 50 ? z / 50 : 1;
            const fade = clamp01(farFade * nearFade);

            // Per-band spectral energy drives brightness and thickness; impact flashes the rim.
            const energy = grain.bandIndex < spectrumLen ? clamp01(spectrum[grain.bandIndex]) : 0;
            const alpha = (16 + energy * 188 + impact * 90) * fade * lineAlpha
                * emissionGain * (1 - jitter * 0.25);
            const weight = (0.4 + energy * 3.2 + impact * 2.6) * lineWeight;

            backend.stroke(r, g, b, alpha);
            backend.strokeWeight(weight);
            backend.line(px, py, sx, sy);
        }
    }

    /** Lateral tunnel displacement at a given world depth (summed sines for an organic snake). */
    private curveOffsetX(globalZ: number, amp: number): number {
        return Math.sin(globalZ * 0.0008) * amp + Math.sin(globalZ * 0.0003) * amp * 1.5;
    }

    private curveOffsetY(globalZ: number, amp: number): number {
        return Math.cos(globalZ * 0.0011) * amp;
    }


    private updateSkyboxCamera(
        baseOffsetX: number,
        baseOffsetY: number,
        canvasHeight: number
    ): { panX: number; panY: number } {
        const panScale = Math.max(1, canvasHeight);
        return {
            panX: clamp((-baseOffsetX / panScale) * SKYBOX_PARALLAX_GAIN, -0.28, 0.28),
            panY: clamp((-baseOffsetY / panScale) * SKYBOX_PARALLAX_GAIN, -0.28, 0.28)
        };
    }

    /**
     * Deepest layer: a dense astropicture-like sky plate. It uses the same camera-offset parallax
     * direction as the free-floating background stars, without any independent rotation.
     */
    private drawSkybox(
        backend: VisualRendererBackend,
        panX: number,
        panY: number,
        amount: number,
        impact: number,
        cx: number,
        cy: number,
        frameTick: number
    ): void {
        if (amount <= 0) return;
        const radius = Math.hypot(cx, cy) * SKYBOX_TILE_RADIUS;
        const panPx = panX * radius;
        const panPy = panY * radius;
        for (let i = 0; i < this.skyPool.length; i++) {
            const star = this.skyPool[i];
            const sx = cx + star.x * radius + panPx;
            const sy = cy + star.y * radius + panPy;
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

/** Deterministic hash-noise in [0, 1) — no Math.random, stable for identical inputs. */
function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export const cosmicWormholeIdentity: VisualIdentity = new CosmicWormholeIdentity();
