// Collects one frame's Wormhole grain material as packed carrier records for a host that renders
// the material on the GPU (ADR-009 Addendum W). Per carrier it runs only the per-carrier setup of
// the CPU raster (`prepareWormholeGrainCarrier`, the same function the CPU deposit uses) and packs
// the result in the shared `GRAIN_CARRIER` layout; the per-pixel work moves to the host.

import { GRAIN_CARRIER, GRAIN_CARRIER_STRIDE, type GrainMaterialFrame } from '../types/GrainMaterialFrame';
import {
    createPreparedWormholeGrainCarrier, prepareWormholeGrainCarrier, type ResolvedWormholeGrainCarrier, type WormholeMaterialSink
} from './wormholeGrainMaterialRaster';

const INITIAL_CAPACITY = 1024;

export class GrainCarrierCollector implements WormholeMaterialSink {
    private data = new Float32Array(INITIAL_CAPACITY * GRAIN_CARRIER_STRIDE);
    private count = 0;
    private active = false;
    private cols = 0;
    private rows = 0;
    private viewportWidth = 0;
    private viewportHeight = 0;
    private detail = 0;
    private amount = 0;
    private bloom = 0;
    private readonly prepared = createPreparedWormholeGrainCarrier();

    /** Before each draw: no material until the identity begins one. */
    reset(): void {
        this.active = false;
        this.count = 0;
    }

    begin(cols: number, rows: number, viewportWidth: number, viewportHeight: number, detail: number, amount: number, bloom: number): void {
        this.active = true;
        this.count = 0;
        this.cols = Math.max(1, Math.floor(cols)); this.rows = Math.max(1, Math.floor(rows));
        this.viewportWidth = viewportWidth; this.viewportHeight = viewportHeight;
        this.detail = detail; this.amount = amount; this.bloom = bloom;
    }

    carrier(carrier: ResolvedWormholeGrainCarrier): void {
        if (!this.active) return;
        const p = this.prepared;
        if (!prepareWormholeGrainCarrier(this.cols, this.rows, this.viewportWidth, this.viewportHeight, carrier, this.detail, p)) return;
        if ((this.count + 1) * GRAIN_CARRIER_STRIDE > this.data.length) {
            const grown = new Float32Array(this.data.length * 2);
            grown.set(this.data);
            this.data = grown;
        }
        const o = this.count * GRAIN_CARRIER_STRIDE, d = this.data;
        d[o + GRAIN_CARRIER.TAIL_X] = p.tailX;
        d[o + GRAIN_CARRIER.TAIL_Y] = p.tailY;
        d[o + GRAIN_CARRIER.TANGENT_X] = p.tangentX;
        d[o + GRAIN_CARRIER.TANGENT_Y] = p.tangentY;
        d[o + GRAIN_CARRIER.LENGTH] = p.length;
        d[o + GRAIN_CARRIER.RADIUS] = p.radius;
        d[o + GRAIN_CARRIER.CORE_RADIUS] = p.coreRadius;
        d[o + GRAIN_CARRIER.FLUX_GAIN] = p.flux * p.depositGain;
        d[o + GRAIN_CARRIER.COLOR_R] = p.colorR;
        d[o + GRAIN_CARRIER.COLOR_G] = p.colorG;
        d[o + GRAIN_CARRIER.COLOR_B] = p.colorB;
        d[o + GRAIN_CARRIER.HALO_GAIN] = p.haloGain;
        d[o + GRAIN_CARRIER.IDENTITY_HI] = (p.identity >>> 16) & 0xffff;
        d[o + GRAIN_CARRIER.IDENTITY_LO] = p.identity & 0xffff;
        d[o + GRAIN_CARRIER.PHASE] = p.phase;
        d[o + GRAIN_CARRIER.FILAMENT_PHASE] = p.filamentPhase;
        d[o + GRAIN_CARRIER.FIBRE_PHASE] = p.fibrePhase;
        d[o + GRAIN_CARRIER.FILAMENT_FREQUENCY] = p.filamentFrequency;
        d[o + GRAIN_CARRIER.FIBRE_ACROSS] = p.fibreAcross;
        d[o + GRAIN_CARRIER.FIBRE_ALONG] = p.fibreAlong;
        d[o + GRAIN_CARRIER.FILAMENT_BIAS] = p.filamentBias;
        d[o + GRAIN_CARRIER.FILAMENT_FLOOR] = p.filamentFloor;
        d[o + GRAIN_CARRIER.FLAGS] = (p.isWeave ? 1 : 0) + (p.filamented ? 2 : 0);
        d[o + GRAIN_CARRIER.NEGLIGIBLE] = p.negligible;
        this.count++;
    }

    /** The collected frame (its `data` is the collector's own buffer: copy before the next draw), or null. */
    get frame(): GrainMaterialFrame | null {
        if (!this.active) return null;
        return { cols: this.cols, rows: this.rows, amount: this.amount, bloom: this.bloom, detail: this.detail,
            count: this.count, data: this.data };
    }
}
