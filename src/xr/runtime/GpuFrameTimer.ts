// Opt-in GPU time of the main WebGL context's frames (diagnostics only): one TIME_ELAPSED query
// around each render call, read back a few frames later without stalling (results are polled,
// never waited for). Needs `EXT_disjoint_timer_query_webgl2`; browsers that hide it (often for
// privacy) get no timer, and the diagnostics line says so. A disjoint event (GPU reset, clock
// change) drops the pending results instead of reporting nonsense.
//
// It times only this context's commands inside the render call: the scene's draws (and any upload or
// background pass the backdrop still does there). Since ADR-009 Addendum AE the background's uploads
// and passes run before the render or when a frame arrives, so they are not included; neither are the
// worker's raster and the headset compositor.

/** In-flight queries at most; a GPU this far behind skips timing frames instead of piling them up. */
export const GPU_TIMER_MAX_PENDING = 6;

interface TimerQueryExtension {
    readonly TIME_ELAPSED_EXT: number;
    readonly GPU_DISJOINT_EXT: number;
}

export class GpuFrameTimer {
    private readonly gl: WebGL2RenderingContext;
    private readonly ext: TimerQueryExtension;
    private readonly pending: WebGLQuery[] = [];
    private readonly free: WebGLQuery[] = [];
    private active: WebGLQuery | null = null;

    private constructor(gl: WebGL2RenderingContext, ext: TimerQueryExtension) {
        this.gl = gl;
        this.ext = ext;
    }

    /** A timer for this context, or null when the browser exposes no GPU timer queries. */
    static create(gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined): GpuFrameTimer | null {
        if (!gl || typeof (gl as WebGL2RenderingContext).createQuery !== 'function') return null;
        let ext: TimerQueryExtension | null = null;
        try { ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExtension | null; } catch { ext = null; }
        return ext ? new GpuFrameTimer(gl as WebGL2RenderingContext, ext) : null;
    }

    /** Starts timing a frame's commands (skipped while too many results are still in flight). */
    begin(): void {
        if (this.active || this.pending.length >= GPU_TIMER_MAX_PENDING) return;
        const query = this.free.pop() ?? this.gl.createQuery();
        if (!query) return;
        this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
        this.active = query;
    }

    end(): void {
        if (!this.active) return;
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.pending.push(this.active);
        this.active = null;
    }

    /**
     * Collects finished results, oldest first, into `out` (milliseconds; cleared first). Results of a
     * disjoint period are dropped.
     */
    poll(out: number[]): void {
        out.length = 0;
        const gl = this.gl;
        const disjoint = !!gl.getParameter(this.ext.GPU_DISJOINT_EXT);
        while (this.pending.length) {
            const query = this.pending[0];
            if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
            const ns = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
            this.pending.shift();
            this.free.push(query);
            if (!disjoint && Number.isFinite(ns)) out.push(ns / 1e6);
        }
        if (disjoint) { while (this.pending.length) this.free.push(this.pending.shift()!); }
    }

    dispose(): void {
        if (this.active) { this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.free.push(this.active); this.active = null; }
        for (const query of [...this.pending, ...this.free]) this.gl.deleteQuery(query);
        this.pending.length = 0; this.free.length = 0;
    }
}
