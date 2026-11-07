import { accumulateWormholeGrainCarrier, MAX_GRAIN_MATERIAL_RASTER_PIXELS } from '../../src/visuals/wormholeGrainMaterialRaster';
import type { ResolvedWormholeGrainCarrier } from '../../src/visuals/wormholeGrainMaterialRaster';
import { CARRIER_FIELDS, MAX_CARRIERS } from './parallel-material-data.mjs';

interface MaterialTileRequest {
    serial: number;
    cols: number;
    rows: number;
    width: number;
    height: number;
    detail: number;
    firstRow: number;
    rowCount: number;
    count: number;
    carriers: ArrayBuffer;
    raster?: ArrayBuffer;
}

type MaterialReply = { type: 'ready' } | { type: 'failure'; message: string } | {
    type: 'tile';
    serial: number;
    firstRow: number;
    rowCount: number;
    count: number;
    elapsedMs: number;
    carriers: ArrayBuffer;
    raster: ArrayBuffer;
};

// Research-only worker. It owns a disjoint row range and visits carriers in their original order.
const scope = self as unknown as {
    onmessage: (event: MessageEvent<MaterialTileRequest>) => void;
    postMessage(message: MaterialReply, transfer?: Transferable[]): void;
};
scope.onmessage = ({ data }) => {
    try {
        const { serial, cols, rows, width, height, detail, firstRow, rowCount, count, carriers, raster } = data;
        if (![serial, cols, rows, firstRow, rowCount, count].every(Number.isSafeInteger)
            || serial < 1 || cols < 1 || rows < 1 || cols * rows > MAX_GRAIN_MATERIAL_RASTER_PIXELS
            || firstRow < 0 || rowCount < 1 || firstRow + rowCount > rows || count < 0 || count > MAX_CARRIERS
            || ![width, height, detail].every(Number.isFinite) || width <= 0 || height <= 0
            || !(carriers instanceof ArrayBuffer) || carriers.byteLength % 8 !== 0
            || carriers.byteLength < count * CARRIER_FIELDS.length * 8
            || carriers.byteLength > MAX_CARRIERS * CARRIER_FIELDS.length * 8) throw Error('Invalid material tile input');
        const input = new Float64Array(carriers);
        const elements = cols * rowCount * 4;
        const output = raster instanceof ArrayBuffer && raster.byteLength === elements * 4
            ? new Float32Array(raster) : new Float32Array(elements);
        output.fill(0);
        const carrier = {} as Record<string, number>;
        const tile = { firstRow, rowCount };
        const started = performance.now();
        for (let i = 0; i < count; i++) {
            const offset = i * CARRIER_FIELDS.length;
            for (let key = 0; key < CARRIER_FIELDS.length; key++) carrier[CARRIER_FIELDS[key]] = input[offset + key];
            accumulateWormholeGrainCarrier(output, cols, rows, width, height, carrier as unknown as ResolvedWormholeGrainCarrier, detail, tile);
        }
        scope.postMessage({ type: 'tile', serial, firstRow, rowCount, count,
            elapsedMs: performance.now() - started, carriers, raster: output.buffer }, [carriers, output.buffer]);
    } catch (error) {
        scope.postMessage({ type: 'failure', message: error instanceof Error ? error.message : String(error) });
    }
};
scope.postMessage({ type: 'ready' });
