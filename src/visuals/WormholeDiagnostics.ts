const BIN_COUNT = 24;

export interface WormholeDiagnosticsSnapshot {
    readonly frames: number;
    readonly seeks: number;
    readonly lastSeekTimeSec: number;
    readonly densityCv: number;
    readonly peakDensityCv: number;
    readonly maxZ: number;
    readonly maxZDelta: number;
    readonly velocity: number;
}

/** Development-only, fixed-storage density instrumentation. */
export class WormholeDepthDiagnostics {
    private readonly bins = new Uint16Array(BIN_COUNT);
    private frames = 0;
    private seeks = 0;
    private lastSeekTimeSec = 0;
    private densityCv = 0;
    private peakDensityCv = 0;
    private maxZ = 0;
    private maxZDelta = 0;
    private velocity = 0;
    private sampleCount = 0;

    beginFrame(maxZ: number, velocity: number): void {
        this.bins.fill(0);
        this.sampleCount = 0;
        this.maxZDelta = Math.abs(maxZ - this.maxZ);
        this.maxZ = maxZ;
        this.velocity = velocity;
    }

    observeDepth(depth: number): void {
        if (!Number.isFinite(depth) || !Number.isFinite(this.maxZ) || this.maxZ <= 0) return;
        const index = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(depth / this.maxZ * BIN_COUNT)));
        this.bins[index]++;
        this.sampleCount++;
    }

    endFrame(): void {
        if (this.sampleCount === 0) return;
        const mean = this.sampleCount / BIN_COUNT;
        let variance = 0;
        for (let index = 0; index < BIN_COUNT; index++) variance += (this.bins[index] - mean) ** 2;
        this.densityCv = Math.sqrt(variance / BIN_COUNT) / mean;
        this.peakDensityCv = Math.max(this.peakDensityCv, this.densityCv);
        this.frames++;
    }

    noteSeek(timeSec: number): void {
        this.seeks++;
        this.lastSeekTimeSec = Number.isFinite(timeSec) ? timeSec : 0;
    }

    snapshot(): WormholeDiagnosticsSnapshot {
        return {
            frames: this.frames,
            seeks: this.seeks,
            lastSeekTimeSec: this.lastSeekTimeSec,
            densityCv: this.densityCv,
            peakDensityCv: this.peakDensityCv,
            maxZ: this.maxZ,
            maxZDelta: this.maxZDelta,
            velocity: this.velocity
        };
    }
}

export const wormholeDepthDiagnostics = new WormholeDepthDiagnostics();
