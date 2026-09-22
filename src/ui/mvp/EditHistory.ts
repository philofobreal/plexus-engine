export type HistoryDomain = 'journey' | 'tuning';
export type HistoryScope = 'journey' | 'all';
export interface HistorySnapshot { key: string; data: string }
export interface HistoryEntry {
    domain: HistoryDomain;
    label: string;
    before: HistorySnapshot;
    after: HistorySnapshot;
    group: number | null;
}
export interface HistoryStatus {
    scope: HistoryScope;
    undoLabel: string | null;
    redoLabel: string | null;
    undoCount: number;
    redoCount: number;
}
export interface HistoryArchive {
    version: 1;
    scope: HistoryScope;
    snapshots: Array<{ domain: HistoryDomain; data: string }>;
    past: Array<{ domain: HistoryDomain; label: string; before: number; after: number }>;
    future: Array<{ domain: HistoryDomain; label: string; before: number; after: number }>;
}

/** Independent document domains share one ordered journal. Scope filters commands, never
 * whole-app snapshots: undoing a journey cannot overwrite tuning edited in another scope.
 * Immutable serialized snapshots cannot alias live plans. Only committed user edits enter.
 */
export class EditHistory {
    private past: HistoryEntry[] = [];
    private future: HistoryEntry[] = [];
    private scope: HistoryScope = 'journey';
    private group: number | null = null;
    private nextGroup = 0;
    readonly limit: number;

    constructor(limit = 300) {
        if (!Number.isInteger(limit) || limit < 1) throw new Error('History limit must be a positive integer.');
        this.limit = limit;
    }

    clear(): void { this.past = []; this.future = []; this.endGroup(); }
    setScope(scope: HistoryScope): void { this.endGroup(); this.scope = scope; }
    beginGroup(): void { this.group ??= ++this.nextGroup; }
    endGroup(): void { this.group = null; }

    record(domain: HistoryDomain, before: HistorySnapshot, after: HistorySnapshot, label: string): void {
        if (before.key === after.key) return;
        // A new edit creates one new branch, including redo hidden by the current scope.
        this.future = [];
        const last = this.past.at(-1);
        if (this.group !== null && last?.group === this.group && last.domain === domain) {
            last.after = after;
            if (last.before.key === after.key) this.past.pop(); // A drag back to its origin is no edit.
        } else this.past.push({ domain, before, after, label, group: this.group });
        if (this.past.length > this.limit) this.past.splice(0, this.past.length - this.limit);
    }

    private eligible(entry: HistoryEntry): boolean { return this.scope === 'all' || entry.domain === 'journey'; }
    private lastEligible(entries: HistoryEntry[]): number {
        for (let i = entries.length - 1; i >= 0; i--) if (this.eligible(entries[i])) return i;
        return -1;
    }

    undo(): HistoryEntry | null { return this.transfer(this.past, this.future); }
    redo(): HistoryEntry | null { return this.transfer(this.future, this.past); }
    private transfer(from: HistoryEntry[], to: HistoryEntry[]): HistoryEntry | null {
        this.endGroup();
        const index = this.lastEligible(from);
        if (index < 0) return null;
        const [entry] = from.splice(index, 1);
        to.push(entry);
        return entry;
    }

    getStatus(): HistoryStatus {
        return {
            scope: this.scope,
            undoLabel: this.past[this.lastEligible(this.past)]?.label ?? null,
            redoLabel: this.future[this.lastEligible(this.future)]?.label ?? null,
            undoCount: this.past.filter(entry => this.eligible(entry)).length,
            redoCount: this.future.filter(entry => this.eligible(entry)).length
        };
    }

    /** Snapshot interning avoids storing the same plan twice for adjacent commands. */
    exportArchive(): HistoryArchive {
        const snapshots: HistoryArchive['snapshots'] = [], indexes = new Map<string, number>();
        const index = (domain: HistoryDomain, snapshot: HistorySnapshot): number => {
            const key = domain + snapshot.data;
            if (!indexes.has(key)) { indexes.set(key, snapshots.length); snapshots.push({ domain, data: snapshot.data }); }
            return indexes.get(key)!;
        };
        const entries = (list: HistoryEntry[]) => list.map(e => ({ domain: e.domain, label: e.label,
            before: index(e.domain, e.before), after: index(e.domain, e.after) }));
        const past = entries(this.past), future = entries(this.future);
        return { version: 1, scope: this.scope, snapshots, past, future };
    }

    /** Untrusted archives are validated fully before replacing live history. The normalizer
     * derives keys from known state fields; stored comparison keys are never trusted. */
    importArchive(value: unknown, current: Record<HistoryDomain, HistorySnapshot>,
        normalize: (domain: HistoryDomain, data: string) => HistorySnapshot | null): boolean {
        try {
            const v = value as HistoryArchive;
            if (!v || v.version !== 1 || !['journey', 'all'].includes(v.scope)
                || !Array.isArray(v.past) || !Array.isArray(v.future) || !Array.isArray(v.snapshots)
                || v.past.length + v.future.length > this.limit || v.snapshots.length > this.limit * 2) return false;
            const snapshots = v.snapshots.map(s => {
                if (!s || !['journey', 'tuning'].includes(s.domain) || typeof s.data !== 'string') throw Error('Invalid snapshot');
                const result = normalize(s.domain, s.data);
                if (!result) throw Error('Invalid state');
                return result;
            });
            const entries = (list: HistoryArchive['past']): HistoryEntry[] => list.map(e => {
                if (!e || !['journey', 'tuning'].includes(e.domain) || typeof e.label !== 'string' || e.label.length > 100
                    || !Number.isInteger(e.before) || !Number.isInteger(e.after)
                    || v.snapshots[e.before]?.domain !== e.domain || v.snapshots[e.after]?.domain !== e.domain) throw Error('Invalid entry');
                return { domain: e.domain, label: e.label, before: snapshots[e.before], after: snapshots[e.after], group: null };
            });
            const past = entries(v.past), future = entries(v.future);
            for (const [list, redo] of [[past, false], [future, true]] as const) {
                const keys = { journey: current.journey.key, tuning: current.tuning.key };
                for (const e of [...list].reverse()) {
                    if (keys[e.domain] !== (redo ? e.before : e.after).key) return false;
                    keys[e.domain] = (redo ? e.after : e.before).key;
                }
            }
            this.past = past; this.future = future; this.scope = v.scope; this.endGroup();
            return true;
        } catch { return false; }
    }
}
