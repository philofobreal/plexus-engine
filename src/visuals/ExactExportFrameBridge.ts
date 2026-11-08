import type { HostExportFrameConfig, HostExportFramePort } from '../types/HostExportFramePort';
import type { WormholeHostAnalysis, WormholeHostExactConfig, WormholeHostExactLease, WormholeHostFrame } from '../types/WormholeHostFrame';

export interface ExactFrameSource {
    prepare(analysis: WormholeHostAnalysis, config: WormholeHostExactConfig): Promise<void>;
    requestFrame(index: number, frame: WormholeHostFrame): Promise<WormholeHostExactLease>;
    dispose(): void;
}
interface Job {
    source: ExactFrameSource;
    cancelled: boolean;
    index: number | null;
    lastIndex: number;
    pending: Promise<void> | null;
    drawClaimed: boolean;
}

/** Keeps p5.draw synchronous. It captures/queues one resolved request; only this
 * outer port awaits redraw and the complete image. The source defers worker I/O.
 * No live State is read or swapped here. Native-only frames complete via redraw.
 */
export class ExactExportFrameBridge implements HostExportFramePort {
    private job: Job | null = null;
    private ready = false;
    private readonly createSource: () => ExactFrameSource | null;
    private readonly readAnalysis: () => WormholeHostAnalysis;
    private readonly redraw: () => void | Promise<void>;
    private readonly report: (kind: string) => void;
    private readonly releaseSurfaces: () => void;

    constructor(createSource: () => ExactFrameSource | null, readAnalysis: () => WormholeHostAnalysis,
        redraw: () => void | Promise<void>, report: (kind: string) => void = () => {}, releaseSurfaces: () => void = () => {}) {
        this.createSource = createSource; this.readAnalysis = readAnalysis;
        this.redraw = redraw; this.report = report;
        this.releaseSurfaces = releaseSurfaces;
    }
    get frameIndex(): number | null { return this.ready && !this.job?.cancelled ? this.job?.index ?? null : null; }

    /** p5 can redraw on resize even while noLoop is active. One draw may claim the
     * export-owned slot; unsolicited callbacks must not advance State or a native pool.
     */
    allowDraw(): boolean {
        const job = this.job;
        if (!job) return true;
        if (!this.ready || job.cancelled || job.index === null || job.drawClaimed) return false;
        job.drawClaimed = true; return true;
    }

    async begin(config: HostExportFrameConfig): Promise<boolean> {
        if (this.job) throw Error('An exact render job is already active');
        if (config.fps !== 30 && config.fps !== 60) return false;
        const source = this.createSource();
        if (!source) return false;
        const job: Job = { source, cancelled: false, index: null, lastIndex: -1, pending: null, drawClaimed: false };
        this.job = job;
        try {
            await source.prepare(this.readAnalysis(), { ...config, fps: config.fps });
            if (job.cancelled || this.job !== job) throw Error('Exact export cancelled');
            this.ready = true; this.report('exact-ready'); return true;
        } catch (error) {
            source.dispose();
            if (job.cancelled || this.job !== job) throw error;
            this.job = null; this.ready = false;
            // Startup failure can use the original renderer before any pixels are submitted.
            this.report('compatible-fallback'); return false;
        }
    }

    async renderFrame(index: number): Promise<void> {
        const job = this.job;
        if (!this.ready || !job || job.cancelled) throw Error('Exact export is not ready');
        if (job.index !== null || !Number.isSafeInteger(index) || index !== job.lastIndex + 1)
            throw Error('Exact export requires one contiguous frame at a time');
        job.index = index; job.pending = null; job.drawClaimed = false;
        try {
            // Await even on cancellation: p5 may still be executing its own redraw callback.
            await this.redraw();
            if (job.pending) await job.pending;
            if (job.cancelled || this.job !== job) throw Error('Exact export cancelled');
            job.lastIndex = index;
        } catch (error) {
            job.cancelled = true; this.ready = false; job.source.dispose();
            this.report('exact-failed');
            throw error;
        } finally {
            // A redraw exception must also quiesce an already queued worker completion.
            const pending = job.pending as Promise<void> | null;
            if (pending) await pending.catch(() => undefined);
            job.index = null; job.pending = null;
        }
    }

    /** Called synchronously by draw. Source clones all bounded inputs before returning. */
    submit(frame: WormholeHostFrame, present: (lease: WormholeHostExactLease) => void): void {
        const job = this.job;
        if (!this.ready || !job || job.cancelled || job.index === null || job.pending)
            throw Error('No available exact export frame slot');
        job.pending = job.source.requestFrame(job.index, frame).then(lease => {
            try {
                if (job.cancelled || this.job !== job) throw Error('Exact export cancelled');
                present(lease);
                this.report('exact-' + lease.raster);
            } finally { lease.release(); }
        });
        // It may reject while p5.redraw is still pending; renderFrame remains the error owner.
        void job.pending.catch(() => undefined);
    }
    cancel(): void {
        if (!this.job) return;
        this.job.cancelled = true; this.ready = false; this.job.source.dispose();
    }
    dispose(): void {
        const hadJob = this.job !== null;
        this.cancel(); this.job = null;
        if (hadJob) this.releaseSurfaces();
    }
}
