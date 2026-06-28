/** Deterministic emission envelope with no drawing state or per-frame allocation. */
export function wormholeEmissionGain(mode: number, seed: number, frameTick: number, rhythmicImpulse: number): number {
    const normalizedMode = clamp(Math.round(mode), 0, 2);
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
