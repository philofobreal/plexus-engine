// Resolves the XR spatial field's plain-data state from the Wormhole's own resolved, morphed tuning
// (`state.visualTuning` after presets, semantics, macros and boosts) and from what the identity
// drew. Pure and allocation-free: the caller owns one reusable record. No preset names, no plan
// interpretation: an automation role reaches the field only through the tuning values it morphed.

import type { VisualTuningConfig } from '../types';
import { hueToRgbInto } from '../config/visualTuning';
import { WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS, WORMHOLE_SPATIAL_MAX_TRAVEL_RATE, WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE,
    type MutableWormholeSpatialFrame } from '../types/WormholeSpatialFrame';

/**
 * What the identity drew for the frame: its travel (horizons), the coherent spiral it applied (turns),
 * the displayed grain hue and colour, and its depth-haze colour (0-255). Colours may be absent
 * (non-finite); the hue then stands in. A drive without a spiral draws none.
 */
export interface WormholeSpatialDrive {
    readonly travel: number;
    readonly travelRate: number;
    readonly spiralTurns?: number;
    readonly hue: number;
    readonly red?: number;
    readonly green?: number;
    readonly blue?: number;
    readonly hazeRed?: number;
    readonly hazeGreen?: number;
    readonly hazeBlue?: number;
}

/** Transient envelopes of the frame (already decayed for its song time). */
export interface WormholeSpatialTransients {
    readonly beatDecay: number;
    readonly denseImpactFlash: number;
}

/** Occupancy per emission mode (Continuous, Pulse, Sparse burst); fractional modes crossfade. */
const EMISSION_OCCUPANCY = [1, 0.7, 0.35] as const;
/**
 * Depth reading: the 2D image's projected tube scale is radius / depth (the near member of a role
 * pair is wider and shallower, the far member narrower and deeper). Scale 2^SCALE_LOG2_DEEP (or
 * less) reads fully deep, 2^SCALE_LOG2_NEAR (or more) fully near; log2 in between, so equal ratios
 * are equal steps. The range spans every role under the XR Depth macro from 0 to 100.
 */
const SCALE_LOG2_DEEP = -2;
const SCALE_LOG2_NEAR = 3.5;
/**
 * CosmicWormholeIdentity's grain projection: wall radius 50 x radius, horizon depth Z_REFERENCE (1000)
 * x depth, focal length 1.2 canvas heights. A wall grain h horizons away therefore appears
 * 50 x 1.2 / 1000 x (radius / depth) / h canvas heights from the vanishing point.
 */
const TUBE_WALL_SPREAD = 50 * 1.2 / 1000;
const MIN_RADIUS = 0.05;
const MIN_DEPTH = 1e-3;
/** Presence of a fully still image relative to the most active one. */
const PRESENCE_FLOOR = 0.5;
/** Stand-in when the drive carries no colour: the identity's own line colour law (no haze shift then). */
const FALLBACK_LINE_SATURATION = 0.82;
const FALLBACK_LINE_LIGHTNESS = 0.55;
const fallbackColor: [number, number, number] = [0, 0, 0];

function finite(value: number, fallback = 0): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Wraps into [0, period); a tiny negative input cannot round up to `period` itself. */
function wrap(value: number, period: number): number {
    const wrapped = value - Math.floor(value / period) * period;
    return wrapped >= period ? 0 : wrapped;
}

function emissionOccupancy(mode: number): number {
    const m = Math.min(2, Math.max(0, finite(mode)));
    const lower = Math.floor(m), upper = Math.min(2, lower + 1), t = m - lower;
    return EMISSION_OCCUPANCY[lower] + (EMISSION_OCCUPANCY[upper] - EMISSION_OCCUPANCY[lower]) * t;
}

export function createWormholeSpatialFrame(): MutableWormholeSpatialFrame {
    return { time: 0, travel: 0, travelRate: 0, amount: 0, density: 0, radius: 0, depth: 0, spiralTurns: 0, turbulence: 0,
        tubeSpread: WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE[0], streak: 0, wisp: 0, hue: 0, red: 0, green: 0, blue: 0, hazeRed: 0, hazeGreen: 0, hazeBlue: 0, pulse: 0, impact: 0 };
}

/** Writes the spatial state of one drawn frame into `out` (clamped, finite) and returns it. */
export function resolveWormholeSpatialFrame(out: MutableWormholeSpatialFrame, time: number, tuning: VisualTuningConfig,
    drive: WormholeSpatialDrive, transients: WormholeSpatialTransients): MutableWormholeSpatialFrame {
    out.time = Math.max(0, finite(time));
    out.travel = Math.max(0, finite(drive.travel));
    out.travelRate = Math.min(WORMHOLE_SPATIAL_MAX_TRAVEL_RATE, Math.max(0, finite(drive.travelRate)));
    // Line opacity is a presence gate only (the XR boosts drive it near its ceiling for every role); the
    // presence itself follows the image's activity: spiral warp, jitter and grain material. A still,
    // material-free role (a dissolve) keeps half, the most energetic ones the full presence.
    const activity = clamp01(0.4 * clamp01(finite(tuning.wormholeWarp) / 5) + 0.35 * clamp01(tuning.wormholeJitter)
        + 0.25 * Math.sqrt(clamp01(tuning.wormholeNebulaAmount)));
    out.amount = clamp01(tuning.lineAlpha) * (PRESENCE_FLOOR + (1 - PRESENCE_FLOOR) * activity);
    out.density = clamp01(emissionOccupancy(tuning.wormholeEmissionMode) * (0.6 + 0.4 * clamp01(tuning.wormholeGrainDensity)));
    out.radius = clamp01((finite(tuning.wormholeRadius) - 0.1) / 2.9);
    const scale = Math.max(MIN_RADIUS, finite(tuning.wormholeRadius, MIN_RADIUS)) / Math.max(MIN_DEPTH, finite(tuning.wormholeDepth, MIN_DEPTH));
    out.depth = 1 - clamp01((Math.log2(scale) - SCALE_LOG2_DEEP) / (SCALE_LOG2_NEAR - SCALE_LOG2_DEEP));
    out.tubeSpread = Math.min(WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE[1], Math.max(WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE[0], TUBE_WALL_SPREAD * scale));
    out.spiralTurns = Math.min(WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS, Math.max(0, finite(drive.spiralTurns ?? 0)));
    out.turbulence = clamp01(0.7 * clamp01(tuning.wormholeJitter) + 0.3 * clamp01(tuning.wormholeCurve));
    out.streak = clamp01(finite(tuning.wormholeContinuity) / 2);
    out.wisp = clamp01(Math.sqrt(clamp01(tuning.wormholeNebulaAmount)) * (0.4 + 0.6 * clamp01(tuning.wormholeNebulaWeave)));
    out.hue = wrap(finite(drive.hue, finite(tuning.circleHue)), 360);
    const drawn = Number.isFinite(drive.red) && Number.isFinite(drive.green) && Number.isFinite(drive.blue);
    if (!drawn) hueToRgbInto(fallbackColor, out.hue, FALLBACK_LINE_SATURATION, FALLBACK_LINE_LIGHTNESS);
    out.red = clamp01((drawn ? drive.red as number : fallbackColor[0]) / 255);
    out.green = clamp01((drawn ? drive.green as number : fallbackColor[1]) / 255);
    out.blue = clamp01((drawn ? drive.blue as number : fallbackColor[2]) / 255);
    const haze = Number.isFinite(drive.hazeRed) && Number.isFinite(drive.hazeGreen) && Number.isFinite(drive.hazeBlue);
    out.hazeRed = haze ? clamp01(drive.hazeRed as number / 255) : out.red;
    out.hazeGreen = haze ? clamp01(drive.hazeGreen as number / 255) : out.green;
    out.hazeBlue = haze ? clamp01(drive.hazeBlue as number / 255) : out.blue;
    out.pulse = clamp01(transients.beatDecay);
    out.impact = clamp01(transients.denseImpactFlash);
    return out;
}
