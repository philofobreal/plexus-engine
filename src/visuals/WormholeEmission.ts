/** Deterministic emission envelope with no drawing state or per-frame allocation. */
export function wormholeEmissionGain(mode: number, seed: number, frameTick: number, rhythmicImpulse: number): number {
    const continuousMode = clamp(mode, 0, 2);
    const lowerMode = Math.floor(continuousMode);
    const upperMode = Math.ceil(continuousMode);
    const mix = continuousMode - lowerMode;
    const lowerGain = gainForMode(lowerMode, seed, frameTick, rhythmicImpulse);
    if (lowerMode === upperMode) return lowerGain;
    const upperGain = gainForMode(upperMode, seed, frameTick, rhythmicImpulse);
    return lowerGain + (upperGain - lowerGain) * mix;
}

function gainForMode(normalizedMode: number, seed: number, frameTick: number, rhythmicImpulse: number): number {
    if (normalizedMode === 0) return 1;

    const phase = frameTick * 0.16;
    const pulse = Math.max(clamp01(rhythmicImpulse), Math.pow(Math.max(0, Math.sin(phase)), 5));
    if (normalizedMode === 1) return 0.08 + pulse * 0.92;

    const burstIndex = Math.floor(frameTick / 12);
    return pseudoNoise(seed, burstIndex * 13.1) < 0.2 ? pulse : 0;
}

/** Tracks explicit visual-owner changes without deriving identity from morphing tuning floats. */
export class WormholeTransitionTracker {
    private lastId: string | null = null;

    update(activeId: string | null): boolean {
        const changed = activeId !== null && activeId !== this.lastId;
        this.lastId = activeId;
        return changed;
    }
}

/** Morph-duration-aware response for automation-owned wormhole character changes. */
export class WormholeAutomationTransition {
    private readonly tracker = new WormholeTransitionTracker();
    private startTime = 0;
    private durationSec = 0.2;
    private active = false;

    update(activeId: string | null, currentTime: number, durationSec: number): number {
        if (this.tracker.update(activeId)) {
            this.startTime = finiteOr(currentTime, 0);
            this.durationSec = Math.max(0.2, finiteOr(durationSec, 0.2));
            this.active = true;
            return 0;
        }
        if (!this.active) return 0;

        const progress = clamp01((finiteOr(currentTime, this.startTime) - this.startTime) / this.durationSec);
        if (progress >= 1) this.active = false;
        // Smoothstep: zero slope at both ends, so the first rendered frame cannot hard-surge.
        return progress * progress * (3 - 2 * progress);
    }
}

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

function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}
