/** Names identify storage ownership, never a musical seed or render clock. */
let serial = 0;
export function exportStorageName(): string {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID() : `${Date.now()}_${++serial}_${Math.random().toString(16).slice(2)}`;
    return `temp_plexus_export_${id}.webm`;
}
export function validExportStorageName(name: string): boolean {
    return /^temp_plexus_export_[a-zA-Z0-9_-]{1,100}\.webm$/.test(name);
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

    retain(): void { this.disposition = 'retained-result'; }
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
                try { await dir.removeEntry(this.name); this.disposition = 'removed'; return; }
                catch (error) {
                    const name = (error as { name?: string })?.name;
                    if (name === 'NotFoundError') { this.disposition = 'removed'; return; }
                    if (name !== 'NoModificationAllowedError' && name !== 'InvalidStateError') throw error;
                    if (attempt === 4) throw error;
                    await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
                }
            }
        };
        try {
            await Promise.race([work(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Export storage cleanup timed out.')), 1500); })]);
        } catch { this.disposition = 'cleanup-pending'; /* Never hide the export outcome or touch another file. */ }
        finally { if (timer !== undefined) clearTimeout(timer); }
    }
}
