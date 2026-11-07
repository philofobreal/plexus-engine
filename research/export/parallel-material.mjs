import MaterialWorker from './parallel-material.worker.ts?worker';
import { CARRIER_FIELDS, MAX_CARRIERS } from './parallel-material-data.mjs';
import { resolveWormholeGrainMaterial } from '../../src/visuals/wormholeGrainMaterialRaster';

/** Loopback prototype. One host simulation feeds an ordered carrier list to independent row tiles. */
export function createParallelMaterial(workerCount = 2, onPending) {
    if (![2, 4].includes(workerCount)) throw Error('The material experiment supports two or four workers');
    let serial = 0, closed = false, frame, count = 0;
    let data = new Float64Array(2048 * CARRIER_FIELDS.length);
    let setupMs = 0, ready = false;
    const frames = [], slots = [];
    function dispose(error = Error('Parallel material cancelled')) {
        if (closed) return;
        closed = true;
        for (const slot of slots) {
            slot.worker.terminate();
            clearTimeout(slot.timeout);
            slot.pending?.reject(error);
            slot.pending = undefined;
        }
    }
    for (let index = 0; index < workerCount; index++) {
        let worker;
        try { worker = new MaterialWorker(); }
        catch (error) { dispose(error); throw error; }
        const slot = { worker, input: null, raster: null, pending: null, timeout: null };
        slot.ready = new Promise((resolve, reject) => { slot.pending = { type: 'ready', resolve, reject }; });
        void slot.ready.catch(() => {});
        slot.timeout = setTimeout(() => dispose(Error('Material worker initialization timed out')), 15000);
        slot.worker.onerror = slot.worker.onmessageerror = () => dispose(Error('Material worker failed'));
        slot.worker.onmessage = ({ data: reply }) => {
            if (closed) return;
            if (!reply || typeof reply !== 'object') {
                dispose(Error('Invalid material worker reply'));
                return;
            }
            const pending = slot.pending;
            if (!pending || reply.type === 'failure') {
                dispose(Error(reply.message ?? 'Unexpected material worker message'));
                return;
            }
            if (reply.type !== pending.type || (reply.type === 'tile' && (reply.serial !== serial
                || reply.firstRow !== pending.firstRow || reply.rowCount !== pending.rowCount || reply.count !== count
                || !(reply.carriers instanceof ArrayBuffer) || reply.carriers.byteLength !== pending.inputBytes
                || !(reply.raster instanceof ArrayBuffer) || reply.raster.byteLength !== frame.cols * reply.rowCount * 16
                || !Number.isFinite(reply.elapsedMs) || reply.elapsedMs < 0))) {
                dispose(Error('Invalid or stale material tile reply'));
                return;
            }
            clearTimeout(slot.timeout);
            slot.pending = null;
            if (reply.type === 'tile') { slot.input = reply.carriers; slot.raster = reply.raster; }
            pending.resolve(reply);
        };
        slots.push(slot);
    }
    const sink = {
        begin(cols, rows, width, height, detail, amount, bloom) {
            if (frame) throw Error('Overlapping material frames');
            frame = { cols, rows, width, height, detail, amount, bloom };
            count = 0;
        },
        carrier(carrier) {
            if (!frame || count >= MAX_CARRIERS) throw Error('Material carrier capacity exceeded');
            const required = (count + 1) * CARRIER_FIELDS.length;
            if (required > data.length) {
                const grown = new Float64Array(Math.min(MAX_CARRIERS * CARRIER_FIELDS.length, data.length * 2));
                grown.set(data); data = grown;
            }
            for (let key = 0; key < CARRIER_FIELDS.length; key++) data[count * CARRIER_FIELDS.length + key] = carrier[CARRIER_FIELDS[key]] ?? 0;
            count++;
        },
    };
    async function complete(target, time) {
        if (!frame) {
            frames.push({ time, cols: 0, rows: 0, count: 0, workerCount, roundTripMs: 0,
                workerMs: [], resolveAndPresentMs: 0, transferredBytes: 0 });
            return;
        }
        const { cols, rows, width, height, detail, amount, bloom } = frame;
        const started = performance.now();
        const inputBytes = count * CARRIER_FIELDS.length * 8;
        serial++;
        const completion = Promise.all(slots.map((slot, index) => {
            const firstRow = Math.floor(index * rows / slots.length);
            const rowCount = Math.floor((index + 1) * rows / slots.length) - firstRow;
            if (!slot.input || slot.input.byteLength !== inputBytes) slot.input = new ArrayBuffer(inputBytes);
            new Float64Array(slot.input).set(data.subarray(0, count * CARRIER_FIELDS.length));
            const carriers = slot.input, raster = slot.raster;
            slot.input = null; slot.raster = null;
            const promise = new Promise((resolve, reject) => {
                slot.pending = { type: 'tile', firstRow, rowCount, inputBytes, resolve, reject };
                slot.timeout = setTimeout(() => dispose(Error('Material tile timed out')), 15000);
                try {
                    slot.worker.postMessage({ serial, cols, rows, width, height, detail, firstRow, rowCount, count, carriers, raster },
                        raster ? [carriers, raster] : [carriers]);
                } catch (error) { dispose(error); }
            });
            return promise;
        }));
        onPending?.(time);
        const results = await completion;
        const arrived = performance.now();
        const l0 = target.beginFieldRaster(0, cols, rows);
        const cols1 = Math.max(1, Math.round(cols / 3)), rows1 = Math.max(1, Math.round(rows / 3));
        const cols2 = Math.max(1, Math.round(cols / 8)), rows2 = Math.max(1, Math.round(rows / 8));
        const l1 = target.beginFieldRaster(1, cols1, rows1), l2 = target.beginFieldRaster(2, cols2, rows2);
        if (!l0 || !l1 || !l2) throw Error('Parallel material output surface unavailable');
        for (const reply of results) l0.set(new Float32Array(reply.raster), reply.firstRow * cols * 4);
        resolveWormholeGrainMaterial(l0, cols, rows, l1, cols1, rows1, l2, cols2, rows2, amount, bloom);
        target.drawFieldRaster(2, 0, 0, width, height, 1, 'lighter');
        target.drawFieldRaster(1, 0, 0, width, height, 1, 'lighter');
        target.drawFieldRaster(0, 0, 0, width, height, 1, 'lighter');
        frames.push({ time, cols, rows, count, workerCount, roundTripMs: arrived - started,
            workerMs: results.map(reply => reply.elapsedMs), resolveAndPresentMs: performance.now() - arrived,
            transferredBytes: inputBytes * workerCount * 2 + cols * rows * 16 });
    }
    return {
        frames,
        get setupMs() { return setupMs; },
        async draw(state, target, identity, draw) {
            if (closed) throw Error('Parallel material is disposed');
            if (state.visualMode !== 'cosmic-wormhole' || state.visualModeTransition || state.videoBackplateActive)
                throw Error('Parallel material fixture requires a steady Wormhole without a backplate');
            if (!ready) {
                const started = performance.now();
                await Promise.all(slots.map(slot => slot.ready));
                setupMs = performance.now() - started; ready = true;
            }
            const display = identity.musicDisplay;
            const originalDisplay = display.draw;
            let displayArgs;
            display.draw = (...args) => { displayArgs = args; };
            identity.setMaterialSink(sink);
            try {
                draw();
                await complete(target, state.exportTime);
                if (displayArgs) originalDisplay.apply(display, displayArgs);
            } finally {
                display.draw = originalDisplay;
                identity.setMaterialSink(null);
                frame = undefined;
            }
        },
        dispose,
    };
}
