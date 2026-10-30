/** Names identify storage ownership, never a musical seed or render clock. */
let serial = 0;
// Document-local ownership only: never discover files from another tab/visit.
const finished = new Set<ExportStorageLease>();
export function getExportCacheSummary(): { files: number; cleanupPending: number; scope: string } {
    return { files: finished.size, cleanupPending: [...finished].filter(lease => lease.disposition === 'cleanup-pending').length,
        scope: 'Finished exports owned by this tab since its last reload; active jobs and other visits are excluded.' };
}
export async function clearFinishedExportCache(): Promise<{ removed: number; remaining: number }> {
    const candidates = [...finished];
    // Serial bounded cleanup avoids a burst of storage operations. New results are excluded.
    let removed = 0;
    for (const lease of candidates) { await lease.discard(); if (lease.disposition === 'removed') removed++; }
    return { removed, remaining: finished.size };
}
export function exportStorageName(): string {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID() : `${Date.now()}_${++serial}_${Math.random().toString(16).slice(2)}`;
    // Older cached workers swept temp_plexus_export_*. Keep new jobs outside that namespace.
    return `plexus_export_job_v1_${id}.webm`;
}
export function validExportStorageName(name: string): boolean {
    return /^(?:plexus_export_job_v1_|temp_plexus_export_)[a-zA-Z0-9_-]{1,100}\.webm$/.test(name);
}

/** Host-owned cleanup key survives worker termination. Never enumerate/delete other jobs.
 * Successful File results remain on disk: unlinking could invalidate their unread bytes.
 */
export class ExportStorageLease {
    readonly name = exportStorageName();
    disposition: 'pending' | 'retained-result' | 'removed' | 'cleanup-pending' = 'pending';
    private pending: Promise<void> | null = null;
    private readonly directory: () => Promise<{ removeEntry(name: string): Promise<void> }>;
    constructor(directory: () => Promise<{ removeEntry(name: string): Promise<void> }>) { this.directory = directory; }

    retain(): void { this.disposition = 'retained-result'; finished.add(this); }
    discard(): Promise<void> {
        if (this.disposition === 'removed') return Promise.resolve();
        if (this.pending) return this.pending;
        this.pending = this.remove().finally(() => { this.pending = null; });
        return this.pending;
    }
    private async remove(): Promise<void> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const work = async () => {
            const dir = await this.directory();
            for (let attempt = 0; attempt < 5; attempt++) {
                try { await dir.removeEntry(this.name); this.disposition = 'removed'; finished.delete(this); return; }
                catch (error) {
                    const name = (error as { name?: string })?.name;
                    if (name === 'NotFoundError') { this.disposition = 'removed'; finished.delete(this); return; }
                    if (name !== 'NoModificationAllowedError' && name !== 'InvalidStateError') throw error;
                    if (attempt === 4) throw error;
                    await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
                }
            }
        };
        try {
            await Promise.race([work(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Export storage cleanup timed out.')), 1500); })]);
        } catch { this.disposition = 'cleanup-pending'; finished.add(this); /* Retry only this ended job, never another file. */ }
        finally { if (timer !== undefined) clearTimeout(timer); }
    }
}
