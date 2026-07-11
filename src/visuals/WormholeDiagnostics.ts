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
    readonly trailSamples: number;
    readonly trailCorrections: number;
    readonly trailCorrectionRate: number;
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
    private trailSamples = 0;
    private trailCorrections = 0;

    reset(): void {
        this.bins.fill(0);
        this.frames = 0;
        this.seeks = 0;
        this.lastSeekTimeSec = 0;
        this.densityCv = 0;
        this.peakDensityCv = 0;
        this.maxZ = 0;
        this.maxZDelta = 0;
        this.velocity = 0;
        this.sampleCount = 0;
        this.trailSamples = 0;
        this.trailCorrections = 0;
    }

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

    observeTrailCorrection(correction: number): void {
        this.trailSamples++;
        if (Number.isFinite(correction) && correction > 1e-12) this.trailCorrections++;
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
            velocity: this.velocity,
            trailSamples: this.trailSamples,
            trailCorrections: this.trailCorrections,
            trailCorrectionRate: this.trailSamples > 0 ? this.trailCorrections / this.trailSamples : 0
        };
    }
}

export const wormholeDepthDiagnostics = new WormholeDepthDiagnostics();
