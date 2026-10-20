// Maximum cardinality one-to-one matching; independent of detector peak selection.
export function matchOnsets(truth, estimated, tolerance) {
    if (!Number.isFinite(tolerance) || tolerance < 0 || [...truth, ...estimated].some(t => !Number.isFinite(t) || t < 0))
        throw new Error('Invalid event matching input');
    const owners = new Map();
    function augment(i, seen) {
        for (let j = 0; j < estimated.length; j++) {
            if (seen.has(j) || Math.abs(truth[i] - estimated[j]) > tolerance) continue;
            seen.add(j);
            if (!owners.has(j) || augment(owners.get(j), seen)) { owners.set(j, i); return true; }
        }
        return false;
    }
    for (let i = 0; i < truth.length; i++) augment(i, new Set());
    return {matchedCount: owners.size, misses: truth.length - owners.size, falsePositives: estimated.length - owners.size};
}
