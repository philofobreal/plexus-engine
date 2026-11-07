import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createLoader } from './helpers/xr-loader.mjs';
import { CARRIER_FIELDS, MAX_CARRIERS } from '../research/export/parallel-material-data.mjs';

const layout = { CARRIER_FIELDS, MAX_CARRIERS };
const math = createLoader()('visuals/wormholeGrainMaterialRaster.ts');
function harness(alter = value => value, constructorFailureAt = -1) {
    const workers = [], requests = [];
    class Worker {
        constructor() {
            if (workers.length === constructorFailureAt) throw Error('Worker startup refused');
            workers.push(this);
            this.scope = { postMessage: (message, transfer = []) => {
                const data = alter(structuredClone(message, { transfer }));
                queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data }); });
            } };
            createLoader({ './parallel-material-data.mjs': layout }, {
                self: this.scope, performance, ArrayBuffer, Float32Array, Float64Array,
            })('../research/export/parallel-material.worker.ts');
        }
        postMessage(message, transfer) {
            requests.push({ serial: message.serial, hasRaster: message.raster instanceof ArrayBuffer });
            const data = structuredClone(message, { transfer });
            queueMicrotask(() => { if (!this.terminated) this.scope.onmessage({ data }); });
        }
        terminate() { this.terminated = true; }
    }
    const { createParallelMaterial } = createLoader({
        './parallel-material.worker.ts?worker': { __esModule: true, default: Worker },
        './parallel-material-data.mjs': layout,
    }, { performance, setTimeout, clearTimeout, ArrayBuffer, Float32Array, Float64Array })('../research/export/parallel-material.mjs');
    return { createParallelMaterial, workers, requests };
}
const carrier = { headX: 70, headY: 42, tailX: 30, tailY: 29, alpha: 200, strokeWeight: 4,
    colorR: 30, colorG: 120, colorB: 240, seed: 4.337, generation: 2, materialPhase: .54, energy: .8, depth: .3, weave: 0 };
function frame() {
    const buffers = new Map(), calls = [];
    const target = {
        beginFieldRaster(layer, cols, rows) {
            const buffer = new Float32Array(cols * rows * 4);
            buffers.set(layer, buffer);
            return buffer;
        },
        drawFieldRaster(layer) { calls.push(layer); },
    };
    const display = { draw() { calls.push('display'); } };
    const identity = { musicDisplay: display, setMaterialSink(sink) { this.sink = sink; } };
    const draw = () => {
        identity.sink.begin(128, 73, 128, 73, .8, .7, .6);
        identity.sink.carrier(carrier);
        identity.sink.carrier({ ...carrier, seed: 8.61, weave: 1 });
        identity.musicDisplay.draw();
    };
    return { identity, target, draw, buffers, calls };
}

test('parallel material transfers reusable tiles and keeps scalar pixels and painter order', async () => {
    for (const parts of [2, 4]) {
        const h = harness(), raster = h.createParallelMaterial(parts);
        try {
            for (let i = 0; i < 2; i++) {
                const f = frame(), reference = new Float32Array(128 * 73 * 4);
                for (const item of [carrier, { ...carrier, seed: 8.61, weave: 1 }])
                    math.accumulateWormholeGrainCarrier(reference, 128, 73, 128, 73, item, .8);
                const l1 = new Float32Array(43 * 24 * 4), l2 = new Float32Array(16 * 9 * 4);
                math.resolveWormholeGrainMaterial(reference, 128, 73, l1, 43, 24, l2, 16, 9, .7, .6);
                await raster.draw({ visualMode: 'cosmic-wormhole', exportTime: i / 60 }, f.target, f.identity, f.draw);
                assert.deepEqual(Buffer.from(f.buffers.get(0).buffer), Buffer.from(reference.buffer));
                assert.deepEqual(Buffer.from(f.buffers.get(1).buffer), Buffer.from(l1.buffer));
                assert.deepEqual(Buffer.from(f.buffers.get(2).buffer), Buffer.from(l2.buffer));
                assert.deepEqual(f.calls, [2, 1, 0, 'display']);
                assert.equal(f.identity.sink, null);
            }
            assert.equal(raster.frames.length, 2);
            assert.ok(h.requests.slice(0, parts).every(row => !row.hasRaster));
            assert.ok(h.requests.slice(parts).every(row => row.hasRaster));
        } finally { raster.dispose(); }
        assert.ok(h.workers.every(worker => worker.terminated));
    }
});

test('a stale parallel tile rejects the frame, restores drawing and terminates the whole worker pool', async () => {
    const h = harness(message => message.type === 'tile' ? { ...message, serial: message.serial + 1 } : message);
    const raster = h.createParallelMaterial(2), f = frame(), originalDisplay = f.identity.musicDisplay.draw;
    await assert.rejects(raster.draw({ visualMode: 'cosmic-wormhole', exportTime: 0 }, f.target, f.identity, f.draw), /stale material tile/);
    assert.ok(h.workers.every(worker => worker.terminated));
    assert.equal(f.identity.musicDisplay.draw, originalDisplay);
    assert.equal(f.identity.sink, null);
    assert.deepEqual(f.calls, []);
});

test('cancel during pending tiles rejects the frame and releases all workers', async () => {
    const h = harness(), f = frame();
    let raster;
    raster = h.createParallelMaterial(2, () => raster.dispose(Error('cancelled')));
    await assert.rejects(raster.draw({ visualMode: 'cosmic-wormhole', exportTime: 0 }, f.target, f.identity, f.draw), /cancelled/);
    assert.ok(h.workers.every(worker => worker.terminated));
    assert.equal(f.identity.sink, null);
    assert.deepEqual(f.calls, []);
});

test('worker startup failure releases workers already created', () => {
    const h = harness(undefined, 1);
    assert.throws(() => h.createParallelMaterial(2), /startup refused/);
    assert.equal(h.workers.length, 1);
    assert.ok(h.workers.every(worker => worker.terminated));
});

test('malformed output and worker failure never publish partial material', async () => {
    for (const alter of [
        message => message.type === 'tile' ? null : message,
        message => message.type === 'tile' ? { ...message, raster: new ArrayBuffer(4) } : message,
        message => message.type === 'tile' ? { type: 'failure', message: 'Raster failed' } : message,
    ]) {
        const h = harness(alter), raster = h.createParallelMaterial(2), f = frame();
        await assert.rejects(raster.draw({ visualMode: 'cosmic-wormhole', exportTime: 0 }, f.target, f.identity, f.draw),
            /Invalid material worker reply|stale material tile|Raster failed/);
        assert.ok(h.workers.every(worker => worker.terminated));
        assert.equal(f.identity.sink, null);
        assert.deepEqual(f.calls, []);
    }
});
