/**
 * Pure, stateless evaluator for the wormhole wall's event-driven pressure waves (refractive
 * membrane-wall plan, Phase 5). For any canonical time it reconstructs the small set of qualifying
 * kick/LOW_DROP origins still active within a bounded lookback window, each as a Gaussian front that
 * has travelled a deterministic distance along normalized wall depth (`ringDepthPhase`, the same
 * domain `WormholeWallGeometry`'s rings use) since its own event time. Everything here is a pure
 * function of (events, frames, timeSec, sampleRate, hopSize) or of a gathered front's own fields --
 * seeking directly to a time reproduces exactly what frame-by-frame playback would have produced, the
 * same contract `wormholeKickEnvelopeAtTime`/`wormholeLowDropAtTime` already guarantee. A front only
 * ever contributes a bounded radius-offset bump on the same channel `wormholeWallRippleOffset` uses
 * (see `WALL_WAVE_MAX_TOTAL_AMPLITUDE`); it never drives a whole-tunnel pulse.
 */

import type { AudioFrame, BeatEvent } from '../types';
import { wormholeLowDropAtTime } from './WormholeTimeline';

/** Kick fronts fill remaining slots after one is reserved for a live LOW_DROP onset. */
export const WALL_WAVE_MAX_ACTIVE = 3;
/** Bounded lookback window; older qualifying events never spawn a front. */
export const WALL_WAVE_WINDOW_SEC = 2.5;
/** Hard cap on the summed contribution of every simultaneous front -- never a global pump. */
export const WALL_WAVE_MAX_TOTAL_AMPLITUDE = 0.05;

export const WALL_WAVE_KIND_KICK = 0;
export const WALL_WAVE_KIND_LOWDROP = 1;

/** Kick: narrow, fast-moving front. */
const KICK_SPEED_PER_SEC = 1 / 0.55;
const KICK_SIGMA = 0.055;
const KICK_DECAY_SEC = 0.4;
const KICK_MAX_AMPLITUDE = 0.035;

/** LOW_DROP: wide, slow compression that lingers longer than a kick. */
const LOWDROP_SPEED_PER_SEC = 1 / 1.9;
const LOWDROP_SIGMA_BASE = 0.2;
const LOWDROP_SIGMA_VARIANT_STEP = 0.02;
const LOWDROP_DECAY_SEC = 1.2;
const LOWDROP_MAX_AMPLITUDE = 0.05;

export interface WormholeWallWaveFront {
    kind: 0 | 1;
    ageSec: number;
    /** Qualifying strength at the event's own onset, before this module's own age decay. */
    intensity: number;
    /** LOW_DROP local-behaviour variant (see `deterministicVariant`); always 0 for a kick front. */
    variant: number;
}

/** Constructor-time scratch pool for `wormholeWallGatherWaveFronts` -- zero allocation in draw(). */
export function createWormholeWallWaveFrontPool(): WormholeWallWaveFront[] {
    return Array.from({ length: WALL_WAVE_MAX_ACTIVE }, () => ({ kind: 0 as const, ageSec: 0, intensity: 0, variant: 0 }));
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/** Mirrors `WormholeTimeline`'s private helper of the same name -- kept local since it isn't exported. */
function weightedLowSupport(spectrum: readonly number[]): number {
    let sum = 0;
    let weights = 0;
    for (let index = 0; index < Math.min(8, spectrum.length); index++) {
        const weight = 8 - index;
        sum += clamp01(spectrum[index]) * weight;
        weights += weight;
    }
    return weights > 0 ? sum / weights : 0;
}

/**
 * Fills `outFronts` (caller-owned, from `createWormholeWallWaveFrontPool`) with every qualifying
 * pressure-wave origin active at `timeSec` and returns how many were written. One slot is reserved for
 * a live LOW_DROP onset -- reusing `wormholeLowDropAtTime`'s pure onset reconstruction rather than a
 * new event pool, per the membrane-wall plan -- and the remaining slots fill with the most recent
 * qualifying kick events, walked backward from `timeSec` exactly the way `wormholeKickEnvelopeAtTime`
 * walks them (type 3/high-transient-only hits and low-frequency-support-starved hits never qualify),
 * except collecting several instead of stopping at the first. No attack ramp and no envelope value are
 * borrowed from either source lookup: this module owns the front's entire temporal decay itself (see
 * `wormholeWallWaveFrontPeakAmplitude`), so a front's strength never compounds two independent decay
 * curves.
 */
export function wormholeWallGatherWaveFronts(
    events: readonly BeatEvent[],
    frames: readonly AudioFrame[],
    timeSec: number,
    sampleRate: number,
    hopSize: number,
    outFronts: WormholeWallWaveFront[]
): number {
    const safeTime = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
    let count = 0;

    const lowDrop = wormholeLowDropAtTime(frames, safeTime, sampleRate, hopSize);
    if (lowDrop && lowDrop.ageSec <= WALL_WAVE_WINDOW_SEC && count < outFronts.length) {
        const front = outFronts[count];
        front.kind = 1;
        front.ageSec = lowDrop.ageSec;
        front.intensity = 1;
        front.variant = lowDrop.variant;
        count++;
    }

    let low = 0;
    let high = events.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (events[middle].time <= safeTime) low = middle + 1;
        else high = middle;
    }
    const safeRate = Math.max(1, Number.isFinite(sampleRate) ? sampleRate : 1);
    const safeHop = Math.max(1, Number.isFinite(hopSize) ? hopSize : 1);
    for (let index = low - 1; index >= 0 && count < outFronts.length; index--) {
        const event = events[index];
        const age = safeTime - event.time;
        if (age < 0) continue;
        if (age > WALL_WAVE_WINDOW_SEC) break;
        if (event.type === 3) continue;
        const frameIndex = Math.max(0, Math.min(frames.length - 1, Math.round(event.time * safeRate / safeHop)));
        const spectrum = frames[frameIndex]?.perceptualSpectrum ?? [];
        const lowSupport = weightedLowSupport(spectrum);
        if (lowSupport < 0.12) continue;
        const front = outFronts[count];
        front.kind = 0;
        front.ageSec = age;
        front.intensity = clamp01(event.intensity * lowSupport);
        front.variant = 0;
        count++;
    }

    return count;
}

/**
 * Normalized wall-depth position ([0, 1] domain, matching `ringDepthPhase`) a front has reached
 * `ageSec` after its own event. A front is born at the horizon (depthPhase 1, `ageSec` 0) and
 * travels toward the camera (depthPhase 0) as it ages -- the same direction every other wall
 * material element advects in, never the opposite (a live event must never look like it erupts
 * near the camera and pushes outward into the tunnel). LOW_DROP fronts travel slower than kick
 * fronts, matching the plan's "narrow-fast kick vs wide-slow LOW_DROP compression" character
 * split. Clamped to [0,1] instead of overshooting past the camera once fully aged out; pure
 * function of (ageSec, kind) only.
 */
export function wormholeWallWaveFrontDepthPhase(ageSec: number, kind: 0 | 1): number {
    const safeAge = Math.max(0, Number.isFinite(ageSec) ? ageSec : 0);
    const speed = kind === 1 ? LOWDROP_SPEED_PER_SEC : KICK_SPEED_PER_SEC;
    return clamp01(1 - safeAge * speed);
}

function wormholeWallWaveFrontSigma(kind: 0 | 1, variant: number): number {
    if (kind === 1) {
        const safeVariant = Number.isFinite(variant) ? Math.floor(Math.abs(variant)) : 0;
        return LOWDROP_SIGMA_BASE + (safeVariant % 3) * LOWDROP_SIGMA_VARIANT_STEP;
    }
    return KICK_SIGMA;
}

/**
 * A front's own peak strength at age `ageSec`, independent of where any ring samples it -- the
 * amplitude a ring positioned exactly on the front's current leading edge would see. This is the
 * quantity that must decay monotonically with age regardless of `kind`; the Gaussian spatial term in
 * `wormholeWallWaveFrontAmplitude` only ever attenuates it further, never restores it.
 */
export function wormholeWallWaveFrontPeakAmplitude(front: WormholeWallWaveFront): number {
    const safeAge = Math.max(0, Number.isFinite(front.ageSec) ? front.ageSec : 0);
    const decay = front.kind === 1 ? LOWDROP_DECAY_SEC : KICK_DECAY_SEC;
    const maxAmplitude = front.kind === 1 ? LOWDROP_MAX_AMPLITUDE : KICK_MAX_AMPLITUDE;
    return clamp01(front.intensity) * Math.exp(-safeAge / decay) * maxAmplitude;
}

/**
 * One front's radius-offset contribution at a given ring depth phase: a Gaussian bump centered on the
 * front's current position (`wormholeWallWaveFrontDepthPhase`), scaled by its peak amplitude. Rings
 * far from the front's leading edge receive an exponentially negligible contribution instead of a
 * uniform pulse across the whole tunnel.
 */
export function wormholeWallWaveFrontAmplitude(front: WormholeWallWaveFront, ringDepthPhase: number): number {
    const depthPhase = clamp01(Number.isFinite(ringDepthPhase) ? ringDepthPhase : 0);
    const frontPhase = wormholeWallWaveFrontDepthPhase(front.ageSec, front.kind);
    const sigma = wormholeWallWaveFrontSigma(front.kind, front.variant);
    const delta = depthPhase - frontPhase;
    const spatial = Math.exp(-(delta * delta) / (2 * sigma * sigma));
    return spatial * wormholeWallWaveFrontPeakAmplitude(front);
}

/**
 * Sums every active front's contribution at one ring, bounded to `WALL_WAVE_MAX_TOTAL_AMPLITUDE` so
 * several simultaneous fronts can never add up to a global pump -- callers add this straight into the
 * same radius-offset fraction `wormholeWallRippleOffset` produces. Zero fronts (or an empty pool)
 * always yields exactly zero.
 */
export function wormholeWallWaveOffset(
    fronts: readonly WormholeWallWaveFront[],
    frontCount: number,
    ringDepthPhase: number
): number {
    const count = Math.max(0, Math.min(fronts.length, Math.floor(Number.isFinite(frontCount) ? frontCount : 0)));
    let sum = 0;
    for (let i = 0; i < count; i++) sum += wormholeWallWaveFrontAmplitude(fronts[i], ringDepthPhase);
    return Math.min(WALL_WAVE_MAX_TOTAL_AMPLITUDE, sum);
}
