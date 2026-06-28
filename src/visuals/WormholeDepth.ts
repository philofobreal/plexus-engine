const DEPTH_EPSILON = 1e-3;

/** Keep a depth inside the current live horizon, including after depth morphs or preset changes. */
export function wrapDepth(z: number, maxZ: number): number {
    if (!Number.isFinite(z) || !Number.isFinite(maxZ) || maxZ <= DEPTH_EPSILON) return DEPTH_EPSILON;
    const wrapped = ((z % maxZ) + maxZ) % maxZ;
    return Math.max(DEPTH_EPSILON, wrapped);
}
