import type { SessionCheckpoint } from './sessionCheckpoint';

/** Budget for expanded snapshots, independent of the smaller localStorage record budget. */
export const MAX_EXPANDED_CHECKPOINT_CHARS = 32_000_000;
const ENCODING = 'history-delta-v1';
interface Delta { base: number; prefix: number; suffix: number; insert: string }

/** Lossless string deltas: a slider edit usually changes only a few characters of a plan.
 * Encoding runs only on explicit save. It never changes or truncates the in-memory journal.
 */
export function encodeCheckpoint(checkpoint: SessionCheckpoint): unknown {
    const previous = new Map<string, number>();
    const snapshots = checkpoint.history.snapshots.map((snapshot, index, all) => {
        const base = previous.get(snapshot.domain);
        previous.set(snapshot.domain, index);
        if (base === undefined) return snapshot;
        const before = all[base].data, after = snapshot.data;
        let prefix = 0, suffix = 0;
        while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
        while (suffix < before.length - prefix && suffix < after.length - prefix
            && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
        const data: Delta = { base, prefix, suffix, insert: after.slice(prefix, after.length - suffix) };
        return JSON.stringify(data).length < JSON.stringify(after).length ? { domain: snapshot.domain, data } : snapshot;
    });
    return { ...checkpoint, encoding: ENCODING, history: { ...checkpoint.history, snapshots } };
}

/** Only backwards, same-domain references are accepted; expansion is bounded before allocation.
 * Schema and history continuity still belong to normalizeCheckpoint after decoding.
 */
export function decodeCheckpoint(value: unknown): unknown | null {
    if (!value || typeof value !== 'object') return null;
    const wire = value as Record<string, any>;
    if (wire.encoding === undefined) return value; // Existing unencoded v1 checkpoints.
    if (wire.encoding !== ENCODING || !Array.isArray(wire.history?.snapshots)
        || wire.history.snapshots.length > 600) return null;
    const snapshots: Array<{ domain: string; data: string }> = [];
    let expandedChars = 0;
    for (const snapshot of wire.history.snapshots) {
        if (!snapshot || !['journey', 'tuning'].includes(snapshot.domain)) return null;
        let data = snapshot.data;
        if (typeof data !== 'string') {
            const d = data as Delta;
            if (!d || !Number.isSafeInteger(d.base) || d.base < 0 || d.base >= snapshots.length
                || snapshots[d.base].domain !== snapshot.domain || !Number.isSafeInteger(d.prefix)
                || !Number.isSafeInteger(d.suffix) || d.prefix < 0 || d.suffix < 0 || typeof d.insert !== 'string') return null;
            const base = snapshots[d.base].data;
            if (d.prefix + d.suffix > base.length
                || expandedChars + d.prefix + d.suffix + d.insert.length > MAX_EXPANDED_CHECKPOINT_CHARS) return null;
            data = base.slice(0, d.prefix) + d.insert + base.slice(base.length - d.suffix);
        }
        expandedChars += data.length;
        if (expandedChars > MAX_EXPANDED_CHECKPOINT_CHARS) return null;
        snapshots.push({ domain: snapshot.domain, data });
    }
    const { encoding: _encoding, ...checkpoint } = wire;
    return { ...checkpoint, history: { ...wire.history, snapshots } };
}
