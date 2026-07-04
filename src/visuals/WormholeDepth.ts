const DEPTH_EPSILON = 1e-3;
const SEEK_REFERENCE_SPEED = 60;
const SEEK_REFERENCE_DEPTH = 1000;

/** Keep a depth inside the current live horizon, including after depth morphs or preset changes. */
export function wrapDepth(z: number, maxZ: number): number {
    if (!Number.isFinite(z) || !Number.isFinite(maxZ) || maxZ <= DEPTH_EPSILON) return DEPTH_EPSILON;
    const wrapped = ((z % maxZ) + maxZ) % maxZ;
    return Math.max(DEPTH_EPSILON, wrapped);
}

/** Wrap a normalized phase without coupling it to the current horizon length. */
export function wrapDepthPhase(phase: number): number {
    if (!Number.isFinite(phase)) return 0;
    return ((phase % 1) + 1) % 1;
}

/** Advance the shared travel phase. Grain phases remain immutable. */
export function advanceDepthPhase(phase: number, velocity: number, maxZ: number): number {
    if (!Number.isFinite(maxZ) || maxZ <= DEPTH_EPSILON) return wrapDepthPhase(phase);
    const safeVelocity = Number.isFinite(velocity) ? velocity : 0;
    return wrapDepthPhase(phase + safeVelocity / maxZ);
}

/** Derive live depth from immutable grain phase and the shared travel phase. */
export function depthFromPhase(grainPhase: number, travelPhase: number, maxZ: number): number {
    if (!Number.isFinite(maxZ) || maxZ <= DEPTH_EPSILON) return DEPTH_EPSILON;
    const normalized = wrapDepthPhase(grainPhase - travelPhase);
    return Math.max(DEPTH_EPSILON, normalized * maxZ);
}

/**
 * Adds an authored, seek-safe cohort character without restoring mutable grain depths.
 * Zero is identical to the continuous phase-space model; one compresses each immutable
 * depth cohort into a softly moving rib.
 */
export function depthWithCoherence(
    grainPhase: number,
    travelPhase: number,
    maxZ: number,
    coherence: number,
    layerCount: number
): number {
    const amount = Math.max(0, Math.min(1, Number.isFinite(coherence) ? coherence : 0));
    const layers = Math.max(1, Math.floor(Number.isFinite(layerCount) ? layerCount : 1));
    if (amount <= 0) return depthFromPhase(grainPhase, travelPhase, maxZ);

    const scaledPhase = wrapDepthPhase(grainPhase) * layers;
    const cohort = Math.min(layers - 1, Math.floor(scaledPhase));
    const localPhase = scaledPhase - cohort;
    const compression = 1 - amount * 0.86;
    const cohortSeed = deterministicUnit(cohort + 1, layers + 7.31);
    const wobble = Math.sin(travelPhase * Math.PI * 2 + cohortSeed * Math.PI * 2) * amount * 0.16;
    const authoredPhase = (cohort + 0.5 + (localPhase - 0.5) * compression + wobble) / layers;
    return depthFromPhase(authoredPhase, travelPhase, maxZ);
}

/** Deterministic seek anchor. Full speed integration remains a future LUT milestone. */
export function depthPhaseAtTime(timeSec: number): number {
    const safeTime = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
    return wrapDepthPhase(safeTime * SEEK_REFERENCE_SPEED / SEEK_REFERENCE_DEPTH);
}

function deterministicUnit(a: number, b: number): number {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
}
