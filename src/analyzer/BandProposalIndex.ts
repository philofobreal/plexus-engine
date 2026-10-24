/**
 * Append proposals in their existing priority order, exactly like the previous linear scan.
 * A point closer than one bucket width can only occupy this bucket or an adjacent one.
 * Integer sample comparisons, strict boundary and original object references stay unchanged.
 */
export function appendSeparatedBandProposals<T extends { sampleIndex: number }>(
    candidates: T[], proposals: readonly T[], separation: number
): void {
    if (!Number.isSafeInteger(separation) || separation < 1) throw new Error('Positive sample separation required');
    const buckets = new Map<number, number[]>();
    const add = (sample: number) => {
        const key = Math.floor(sample / separation), bucket = buckets.get(key);
        if (bucket) bucket.push(sample); else buckets.set(key, [sample]);
    };
    for (const candidate of candidates) add(candidate.sampleIndex);
    for (const proposal of proposals) {
        const sample = proposal.sampleIndex, key = Math.floor(sample / separation);
        let occupied = false;
        for (let neighbour = key - 1; neighbour <= key + 1 && !occupied; neighbour++) {
            const bucket = buckets.get(neighbour);
            if (bucket) for (const prior of bucket) if (Math.abs(prior - sample) < separation) { occupied = true; break; }
        }
        if (!occupied) { candidates.push(proposal); add(sample); }
    }
}
