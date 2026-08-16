/**
 * Pure, pre-generated crack pool for the wormhole wall's peak-only fracture accent (refractive
 * membrane-wall plan, Phase 8). Every crack's path (a short jagged polyline in the same
 * (theta, depthPhase) space `WormholeWallGeometry`'s rings use) is fixed at module load from its own
 * index -- no `Math.random`, no per-frame regeneration, and no dependence on `travelDistance`: cracks
 * are static fractures in the wall, not something that scrolls or breathes with travel. Only a
 * crack's *emission* (how brightly it glows) is time-varying, and that is driven entirely by the same
 * `WormholeWallWaveFront[]` pool `WormholeWallWaves` already gathers each frame -- this module adds no
 * second event source, per the plan's "no new event pool" rule. A crack with no qualifying front
 * nearby emits exactly zero.
 */

import type { WormholeWallWaveFront } from './WormholeWallWaves';

const TWO_PI = Math.PI * 2;

export const WALL_CRACK_COUNT = 7;
export const WALL_CRACK_MIN_POINTS = 4;
export const WALL_CRACK_MAX_POINTS = 8;

/** Kick-only, LOW_DROP-only, or either -- fixed per crack, so the family reacts heterogeneously. */
export const WALL_CRACK_ELIGIBLE_KICK = 0;
export const WALL_CRACK_ELIGIBLE_LOWDROP = 1;
export const WALL_CRACK_ELIGIBLE_BOTH = 2;

/** Very short, snappy flash for a kick-triggered crack. */
const CRACK_KICK_DECAY_SEC = 0.22;
/** LOW_DROP-triggered cracks linger a little longer, matching the heavier event character. */
const CRACK_LOWDROP_DECAY_SEC = 0.55;

function pseudoNoise(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export interface WormholeWallCrackPoint {
    readonly theta: number;
    readonly depthPhase: number;
}

interface WormholeWallCrackDef {
    readonly points: ReadonlyArray<WormholeWallCrackPoint>;
    readonly eligibleKind: 0 | 1 | 2;
    /** Front strength (0..1, post-decay) a qualifying front must clear before this crack lights at all. */
    readonly activationRank: number;
}

function buildCrackDef(index: number): WormholeWallCrackDef {
    const seed = index + 1;
    const pointCount = WALL_CRACK_MIN_POINTS
        + Math.floor(pseudoNoise(seed, 5.1) * (WALL_CRACK_MAX_POINTS - WALL_CRACK_MIN_POINTS + 1));
    let theta = pseudoNoise(seed, 11.3) * TWO_PI;
    // Starts somewhere in the near-to-mid depth band and only ever moves deeper point-to-point, so a
    // crack never doubles back toward the camera along its own path.
    let depthPhase = 0.15 + pseudoNoise(seed, 17.9) * 0.35;
    const points: WormholeWallCrackPoint[] = [];
    for (let p = 0; p < pointCount; p++) {
        points.push(Object.freeze({ theta, depthPhase: Math.min(0.96, depthPhase) }));
        theta += (pseudoNoise(seed, 23.7 + p * 7.1) - 0.5) * 0.6;
        depthPhase += 0.04 + pseudoNoise(seed, 29.3 + p * 3.7) * 0.08;
    }
    const kindRoll = pseudoNoise(seed, 41.3);
    const eligibleKind: 0 | 1 | 2 = kindRoll < 0.45 ? 0 : kindRoll < 0.8 ? 1 : 2;
    // A wide admission spread: some cracks flash on almost any qualifying front, others need a
    // strong, fresh one, so the family doesn't all light up in lockstep on every single event.
    const activationRank = 0.15 + pseudoNoise(seed, 47.7) * 0.55;
    return Object.freeze({ points: Object.freeze(points), eligibleKind, activationRank });
}

const CRACK_DEFS: ReadonlyArray<WormholeWallCrackDef> = Object.freeze(
    Array.from({ length: WALL_CRACK_COUNT }, (_unused, index) => buildCrackDef(index))
);

function clampCrackIndex(crackIndex: number): number {
    const safeIndex = Number.isFinite(crackIndex) ? Math.floor(crackIndex) : 0;
    return Math.max(0, Math.min(WALL_CRACK_COUNT - 1, safeIndex));
}

export function wormholeWallCrackPointCount(crackIndex: number): number {
    return CRACK_DEFS[clampCrackIndex(crackIndex)].points.length;
}

export function wormholeWallCrackEligibleKind(crackIndex: number): 0 | 1 | 2 {
    return CRACK_DEFS[clampCrackIndex(crackIndex)].eligibleKind;
}

export function wormholeWallCrackActivationRank(crackIndex: number): number {
    return CRACK_DEFS[clampCrackIndex(crackIndex)].activationRank;
}

/** Fixed, never-allocating accessor: the same (crackIndex, pointIndex) always returns the same point. */
export function wormholeWallCrackPoint(crackIndex: number, pointIndex: number): WormholeWallCrackPoint {
    const def = CRACK_DEFS[clampCrackIndex(crackIndex)];
    const safeIndex = Number.isFinite(pointIndex) ? Math.floor(pointIndex) : 0;
    const clampedIndex = Math.max(0, Math.min(def.points.length - 1, safeIndex));
    return def.points[clampedIndex];
}

/**
 * A single front's short-lived flash strength, independent of `WormholeWallWaves`' own radius-bump
 * amplitude scaling -- this module owns its own (much shorter) decay so a crack reads as a snap
 * flash, not a lingering glow.
 */
function crackFrontStrength(front: WormholeWallWaveFront): number {
    const decay = front.kind === 1 ? CRACK_LOWDROP_DECAY_SEC : CRACK_KICK_DECAY_SEC;
    const safeAge = Math.max(0, Number.isFinite(front.ageSec) ? front.ageSec : 0);
    return clamp01(front.intensity) * Math.exp(-safeAge / decay);
}

/**
 * Emission (0..1) for one crack given the frame's already-gathered wave fronts. Zero whenever no
 * eligible-kind front is active, or every eligible front's strength still sits at or below this
 * crack's own activation threshold -- the "peak-only" gate the plan requires. Once past the
 * threshold, the remaining headroom is rescaled to (0,1] so a just-triggered crack still reads as a
 * visible flash instead of a near-invisible sliver.
 */
export function wormholeWallCrackEmission(
    crackIndex: number,
    fronts: readonly WormholeWallWaveFront[],
    frontCount: number
): number {
    const def = CRACK_DEFS[clampCrackIndex(crackIndex)];
    const count = Math.max(0, Math.min(fronts.length, Math.floor(Number.isFinite(frontCount) ? frontCount : 0)));
    let strongest = 0;
    for (let i = 0; i < count; i++) {
        const front = fronts[i];
        if (def.eligibleKind !== WALL_CRACK_ELIGIBLE_BOTH && def.eligibleKind !== front.kind) continue;
        const strength = crackFrontStrength(front);
        if (strength > strongest) strongest = strength;
    }
    if (strongest <= def.activationRank) return 0;
    return (strongest - def.activationRank) / (1 - def.activationRank);
}
