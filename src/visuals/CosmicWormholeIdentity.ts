import { getBackgroundClearStyle, hueToRgbInto } from '../config/visualTuning';
import { State } from '../state/store';
import type { Particle } from './Particle';
import type { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';
import type { VisualIdentity } from './VisualIdentity';

const TWO_PI = Math.PI * 2;
const BANDS = 24;
const DEPTH_LAYERS = 15;
/** Fixed dust pool: one grain per (band, depth layer). Allocated once in the constructor (GC-safe). */
const POOL_SIZE = BANDS * DEPTH_LAYERS;
/** Reference horizon distance at depth = 1; the live horizon is this scaled by wormholeDepth. */
const Z_REFERENCE = 1000;

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

class CosmicWormholeIdentity implements VisualIdentity {
    readonly id = 'cosmic-wormhole';
    readonly name = 'Cosmic Wormhole';

    private readonly pool: DustGrain[] = [];
    private readonly lineColor: [number, number, number] = [0, 0, 0];

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

        // --- Color: GC-free, shifted by vocal (+) and melody (-) ---
        const hue = tuning.circleHue + vocal * 40 - melody * 30;
        hueToRgbInto(this.lineColor, hue, 0.82, Math.min(0.85, 0.55 + impact * 0.18));
        const r = this.lineColor[0];
        const g = this.lineColor[1];
        const b = this.lineColor[2];

        const lineAlpha = tuning.lineAlpha;
        const lineWeight = tuning.lineWeight;
        const frameTick = Math.floor(State.rotationPhase);
        const spectrum = State.currentFrame.perceptualSpectrum;
        const spectrumLen = spectrum ? spectrum.length : 0;

        for (let i = 0; i < this.pool.length; i++) {
            const grain = this.pool[i];

            // Stream toward the camera; recycle past the lens back to the horizon.
            grain.z -= vz;
            if (grain.z <= 0) grain.z = maxZ;
            const z = grain.z;
            const prevZ = z + vz;

            // Spiral warp accumulates with depth; tension + orbit twist the whole tube.
            const thetaNow = grain.theta + z * warpK;
            const thetaPrev = grain.theta + prevZ * warpK;
            const invZ = 1 / z;
            const invPrev = 1 / prevZ;

            let sx = cx + radius * Math.cos(thetaNow) * invZ * fov;
            let sy = cy + radius * Math.sin(thetaNow) * invZ * fov;
            let px = cx + radius * Math.cos(thetaPrev) * invPrev * fov;
            let py = cy + radius * Math.sin(thetaPrev) * invPrev * fov;

            // Glitch / camera shake: deterministic per-index offset under LOW_DROP.
            if (glitch > 0) {
                const ox = (pseudoNoise(i, frameTick) * 2 - 1) * glitch * 28;
                const oy = (pseudoNoise(i, frameTick + 7.3) * 2 - 1) * glitch * 28;
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
            const alpha = (16 + energy * 188 + impact * 90) * fade * lineAlpha;
            const weight = (0.4 + energy * 3.2 + impact * 2.6) * lineWeight;

            backend.stroke(r, g, b, alpha);
            backend.strokeWeight(weight);
            backend.line(px, py, sx, sy);
        }
    }
}

/** Deterministic hash-noise in [0, 1) — no Math.random, stable for identical inputs. */
function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export const cosmicWormholeIdentity: VisualIdentity = new CosmicWormholeIdentity();
