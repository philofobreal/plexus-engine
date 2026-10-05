// GPU grain material (ADR-009 Addendum W): the worker sends prepared carriers instead of rasterizing
// the Nebula, and the XR backdrop renders and composites it on the GPU. The GPU passes themselves
// need WebGL (verified in the browser against the CPU raster); these tests pin the data path.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({ three: THREE });
const { GRAIN_CARRIER, GRAIN_CARRIER_STRIDE } = load('types/GrainMaterialFrame.ts');
const raster = load('visuals/wormholeGrainMaterialRaster.ts');
const { GrainCarrierCollector } = load('visuals/GrainCarrierCollector.ts');
const { GrainMaterialRenderer, supportsGpuGrainMaterial, BLOOM_SIGMA_L1, BLOOM_SIGMA_L2 } = load('xr/scene/GrainMaterialRenderer.ts');
const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');

const carrier = (over = {}) => ({ headX: 640, headY: 300, tailX: 600, tailY: 280, alpha: 200, strokeWeight: 2, colorR: 180, colorG: 90, colorB: 220,
    seed: 12.5, generation: 7, materialPhase: 3.2, energy: 0.8, depth: 0.3, ...over });

test('the collector packs exactly the CPU raster\'s per-carrier constants in the shared layout', () => {
    const collector = new GrainCarrierCollector();
    assert.equal(collector.frame, null, 'no material before a frame begins');
    collector.begin(320, 180, 1280, 720, 0.75, 0.5, 1);
    collector.carrier(carrier());
    collector.carrier(carrier({ alpha: 0 })); // deposits nothing: skipped like the CPU raster
    collector.carrier(carrier({ weave: 1, headX: 650, headY: 290, depth: 0.6 }));
    const frame = collector.frame;
    assert.deepEqual([frame.cols, frame.rows, frame.amount, frame.bloom, frame.detail, frame.count], [320, 180, 0.5, 1, 0.75, 2]);
    const prepared = raster.createPreparedWormholeGrainCarrier();
    assert.ok(raster.prepareWormholeGrainCarrier(320, 180, 1280, 720, carrier(), 0.75, prepared));
    const d = frame.data;
    const close = (a, b) => Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));
    assert.ok(close(d[GRAIN_CARRIER.TAIL_X], prepared.tailX) && close(d[GRAIN_CARRIER.TAIL_Y], prepared.tailY));
    assert.ok(close(d[GRAIN_CARRIER.RADIUS], prepared.radius) && close(d[GRAIN_CARRIER.CORE_RADIUS], prepared.coreRadius));
    assert.ok(close(d[GRAIN_CARRIER.FLUX_GAIN], prepared.flux * prepared.depositGain));
    assert.ok(close(d[GRAIN_CARRIER.NEGLIGIBLE], prepared.negligible));
    const identity = ((d[GRAIN_CARRIER.IDENTITY_HI] << 16) | d[GRAIN_CARRIER.IDENTITY_LO]) | 0;
    assert.equal(identity, prepared.identity, 'the 32-bit identity survives the float split exactly');
    assert.equal(d[GRAIN_CARRIER.FLAGS], 2, 'a filamented grain');
    assert.equal(d[GRAIN_CARRIER_STRIDE + GRAIN_CARRIER.FLAGS] % 2, 1, 'the weave flag');
    for (let i = 0; i < 3000; i++) collector.carrier(carrier({ headX: 600 + (i % 50) }));
    assert.equal(collector.frame.count, 3002, 'the buffer grows');
    collector.reset();
    assert.equal(collector.frame, null);
});

test('the CPU deposit is unchanged by the split into prepare + per-pixel law', () => {
    const cols = 160, rows = 90, buffer = new Float32Array(cols * rows * 4);
    raster.accumulateWormholeGrainCarrier(buffer, cols, rows, 1280, 720, carrier(), 0.75);
    let sum = 0; for (let i = 3; i < buffer.length; i += 4) sum += buffer[i];
    assert.ok(sum > 0, 'the carrier deposits');
    const prepared = raster.createPreparedWormholeGrainCarrier();
    assert.equal(raster.prepareWormholeGrainCarrier(cols, rows, 1280, 720, carrier({ alpha: 0 }), 0.75, prepared), false);
    assert.equal(raster.prepareWormholeGrainCarrier(cols, rows, 1280, 720, carrier({ headX: -900, tailX: -950 }), 0.75, prepared), false, 'off-raster');
    assert.equal(raster.prepareWormholeGrainCarrier(cols, rows, 1280, 720, carrier(), 0.75, prepared), true);
});

test('an external-material source hands its frame\'s carriers over instead of compositing them', async () => {
    class Backend { constructor(width, height) { this.canvas = { width, height }; this.frameCount = 0; this.width = width; this.height = height; } background() {} }
    const sinks = [];
    class Identity {
        constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; }
        setMaterialSink(sink) { sinks.push(sink); this.sink = sink; } syncPosition() {} setDepthCue() {} setDepthLayers() {}
        draw() { this.sink?.begin(320, 180, 1280, 720, 1, 0.5, 1); this.sink?.carrier({ headX: 640, headY: 300, tailX: 600, tailY: 280, alpha: 200,
            strokeWeight: 2, colorR: 180, colorG: 90, colorB: 220, seed: 1, generation: 1, materialPhase: 0, energy: 1, depth: 0.2 }); }
    }
    const sourceLoad = createLoader({
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend },
        './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }
    }, { fetch: async () => ({ ok: true, json: async () => ({}) }), performance });
    const { WormholeCanvasSource } = sourceLoad('visuals/WormholeCanvasSource.ts');
    const plain = new WormholeCanvasSource({ width: 64, height: 36 });
    await plain.prepare(null); plain.render(1, false);
    assert.equal(plain.materialFrame, null);
    assert.equal(sinks.length, 0, 'the CPU raster unless asked');
    const external = new WormholeCanvasSource({ width: 64, height: 36, externalMaterial: true });
    await external.prepare(null); external.render(1, false);
    assert.ok(sinks.length >= 1, 'every fresh identity gets the collector');
    assert.equal(external.materialFrame.count, 1);
    plain.dispose(); external.dispose();
});

test('the render worker transfers exactly the valid carrier records with its frame; the proxy exposes them', async () => {
    const posted = [];
    const scope = { onmessage: null, postMessage(message, transfer) { posted.push({ message, transfer }); }, close() {} };
    const sources = [];
    class FakeSource {
        constructor(options) { this.options = options; this.focalPoint = { x: 0, y: 0 }; this.travel = 0; sources.push(this);
            this.canvas = { transferToImageBitmap: () => ({ close() {} }) }; }
        async prepare() {} render() { return true; } setPresentation() {} dispose() {}
        get stageTimes() { return null; }
        get materialFrame() { return this.options.externalMaterial ? { cols: 320, rows: 180, amount: 0.5, bloom: 1, detail: 1, count: 2, data: new Float32Array(1024 * GRAIN_CARRIER_STRIDE).fill(3) } : null; }
    }
    createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: FakeSource } },
        { self: scope, performance: { now: () => 0 }, OffscreenCanvas: class {} })('visuals/wormholeRender.worker.ts');
    const send = data => scope.onmessage({ data });
    send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0, externalMaterial: true });
    assert.equal(sources[0].options.externalMaterial, true);
    send({ type: 'prepare', generation: 1, analysis: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    send({ type: 'render', generation: 1, time: 1, playing: true });
    const { message, transfer } = posted.at(-1);
    assert.equal(message.material.count, 2);
    assert.equal(message.material.data.length, 2 * GRAIN_CARRIER_STRIDE, 'only the valid records travel');
    assert.ok(transfer.includes(message.material.data.buffer), 'transferred, not copied');

    const workers = [];
    class FakeWorker { constructor() { this.posted = []; workers.push(this); } postMessage(m) { this.posted.push(m); } terminate() {} reply(data) { this.onmessage?.({ data }); } }
    const presenter = { transferFromImageBitmap() {} };
    const document = { createElement: () => ({ width: 0, height: 0, dataset: {}, getContext: () => presenter }) };
    const { WormholeWorkerSource } = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document })('visuals/WormholeWorkerSource.ts');
    const proxy = new WormholeWorkerSource({ width: 640, height: 360, externalMaterial: true });
    const worker = workers[0];
    assert.equal(worker.posted[0].externalMaterial, true);
    const ready = proxy.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    proxy.render(1, true);
    worker.reply({ type: 'frame', generation: 1, time: 1, bitmap: { close() {} }, focalX: 0, focalY: 0, renderMs: 5, material: message.material });
    proxy.render(1.03, true);
    assert.equal(proxy.materialFrame, message.material);
    proxy.dispose();
});

// ---------------------------------------------------------------- pooled carrier buffers
const isArrayBuffer = value => Object.prototype.toString.call(value) === '[object ArrayBuffer]';

/** Worker harness whose posts really transfer (detach) carrier buffers, counting worker-side allocations. */
function pooledWorker(counts = [2]) {
    const posted = [], sources = [];
    let allocations = 0, frame = 0;
    class CountingArrayBuffer extends ArrayBuffer { constructor(length) { super(length); allocations++; } }
    const scope = { onmessage: null, closed: false, close() { this.closed = true; },
        postMessage(message, transfer = []) {
            // A real postMessage detaches transferred buffers; the sender's (now detached) view stays for inspection.
            const material = message.material ? structuredClone(message.material, { transfer: transfer.filter(isArrayBuffer) }) : undefined;
            posted.push({ message, material, transfer });
        } };
    class FakeSource {
        constructor(options) { this.options = options; this.focalPoint = { x: 0, y: 0 }; this.collected = new Float32Array(4096 * GRAIN_CARRIER_STRIDE); sources.push(this);
            this.canvas = { transferToImageBitmap: () => ({ close() {} }) }; }
        async prepare() {} render() { frame++; return true; } setPresentation() {} dispose() { this.disposed = true; }
        get stageTimes() { return null; }
        get materialFrame() {
            const count = counts[(frame - 1) % counts.length];
            if (count === null) return null;
            this.collected.fill(frame, 0, count * GRAIN_CARRIER_STRIDE);
            return { cols: 320, rows: 180, amount: 0.5, bloom: 1, detail: 1, count, data: this.collected };
        }
    }
    createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: FakeSource } },
        { self: scope, performance: { now: () => 0 }, OffscreenCanvas: class {}, ArrayBuffer: CountingArrayBuffer })('visuals/wormholeRender.worker.ts');
    const send = data => scope.onmessage({ data });
    return { posted, sources, send, scope, get allocations() { return allocations; } };
}

async function readyWorker(harness) {
    harness.send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0, externalMaterial: true });
    harness.send({ type: 'prepare', generation: 1, analysis: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    let time = 0;
    return () => { harness.send({ type: 'render', generation: 1, time: ++time, playing: true }); return harness.posted.at(-1); };
}

test('worker carrier buffers cycle through a bounded pool: transferred out, returned, reused, never written while lent', async () => {
    const worker = pooledWorker();
    const render = await readyWorker(worker);
    const first = render();
    assert.equal(worker.allocations, 1);
    assert.equal(first.material.count, 2);
    assert.equal(first.material.data.length, 2 * GRAIN_CARRIER_STRIDE, 'exactly the valid records');
    assert.ok(first.material.data.buffer.byteLength >= 2 * GRAIN_CARRIER_STRIDE * 4);
    assert.ok(first.material.data.every(value => value === 1), 'carriers of that frame');
    assert.ok(first.transfer.includes(first.message.material.data.buffer), 'transferred with the bitmap');
    assert.equal(first.message.material.data.byteLength, 0, 'the worker no longer holds the lent buffer');
    // Nothing returned yet: the next frame needs its own buffer (a lent one is never reused).
    const second = render();
    assert.equal(worker.allocations, 2);
    assert.ok(second.material.data.every(value => value === 2));
    // Returned buffers are reused: the steady state allocates nothing.
    worker.send({ type: 'release-material', buffer: first.material.data.buffer });
    worker.send({ type: 'release-material', buffer: second.material.data.buffer });
    const third = render(), fourth = render();
    assert.equal(worker.allocations, 2);
    assert.ok(third.material.data.every(value => value === 3) && fourth.material.data.every(value => value === 4));
    // Detached or malformed returns are ignored.
    worker.send({ type: 'release-material', buffer: first.material.data.buffer }); // detached again by the frame-3/4 transfer
    worker.send({ type: 'release-material', buffer: null });
    render();
    assert.equal(worker.allocations, 3);
});

test('the worker pool is bounded, keeps its largest buffers and grows only for larger frames', async () => {
    const worker = pooledWorker([2, 2, 2, 2, 2, 2, 2, 2, 2, 400, null, 2]);
    const render = await readyWorker(worker);
    const lent = Array.from({ length: 6 }, () => render());
    assert.equal(worker.allocations, 6);
    for (const frame of lent) worker.send({ type: 'release-material', buffer: frame.material.data.buffer });
    // Six returned, at most three kept: three frames reuse, the fourth allocates.
    render(); render(); render();
    assert.equal(worker.allocations, 6);
    const big = render(); // frame 10: 400 carriers, no pooled buffer fits
    assert.equal(worker.allocations, 7);
    assert.equal(big.material.count, 400);
    assert.ok(big.material.data.buffer.byteLength >= 400 * GRAIN_CARRIER_STRIDE * 4 * 1.2, 'allocated with headroom');
    const none = render(); // frame 11: no material
    assert.equal(none.message.material, undefined, 'frames without material stay without material');
    assert.equal(none.transfer.length, 1, 'only the bitmap travels');
    assert.equal(worker.allocations, 7);
    worker.send({ type: 'dispose' });
    assert.ok(worker.sources[0].disposed && worker.scope.closed);
});

test('the proxy returns each carrier buffer once: after the next frame, for stale frames and discarded ones; never after dispose', async () => {
    const workers = [];
    class FakeWorker {
        constructor() { this.posted = []; workers.push(this); }
        postMessage(m, transfer) { this.posted.push({ m, transfer }); } terminate() { this.terminated = true; }
        reply(data) { this.onmessage?.({ data }); }
        get releases() { return this.posted.filter(p => p.m.type === 'release-material'); }
    }
    const presenter = { transferFromImageBitmap() {} };
    const document = { createElement: () => ({ width: 0, height: 0, dataset: {}, getContext: () => presenter }) };
    const { WormholeWorkerSource } = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document })('visuals/WormholeWorkerSource.ts');
    const carriers = () => ({ cols: 320, rows: 180, amount: 0.5, bloom: 1, detail: 1, count: 1, data: new Float32Array(GRAIN_CARRIER_STRIDE) });
    const bitmap = () => ({ closed: false, close() { this.closed = true; } });
    const proxy = new WormholeWorkerSource({ width: 640, height: 360, externalMaterial: true });
    const worker = workers[0];
    let ready = proxy.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    const frame = (generation, material) => ({ type: 'frame', generation, time: 1, bitmap: bitmap(), focalX: 0, focalY: 0, renderMs: 1, ...(material ? { material } : {}) });

    const a = carriers(), b = carriers();
    proxy.render(1, true); worker.reply(frame(1, a));
    assert.equal(proxy.render(1.03, true), true); assert.equal(proxy.materialFrame, a);
    assert.equal(worker.releases.length, 0, 'the shown frame keeps its buffer');
    worker.reply(frame(1, b)); proxy.render(1.06, true);
    assert.equal(proxy.materialFrame, b);
    assert.equal(worker.releases.length, 1);
    assert.equal(worker.releases[0].m.buffer, a.data.buffer);
    assert.ok(worker.releases[0].transfer.length === 1 && worker.releases[0].transfer[0] === a.data.buffer, 'returned by transfer, not copy');

    // A frame without material releases the shown one; a second empty frame releases nothing.
    worker.reply(frame(1)); proxy.render(1.09, true);
    assert.equal(proxy.materialFrame, null); assert.equal(worker.releases.length, 2); assert.equal(worker.releases[1].m.buffer, b.data.buffer);
    worker.reply(frame(1)); proxy.render(1.12, true);
    assert.equal(worker.releases.length, 2);

    // A pending frame discarded by a new preparation, and a stale frame, both return their buffers.
    const pending = carriers(), stale = carriers();
    worker.reply(frame(1, pending));
    ready = proxy.prepare(null);
    assert.equal(worker.releases.at(-1).m.buffer, pending.data.buffer);
    const staleFrame = frame(1, stale); worker.reply(staleFrame);
    assert.ok(staleFrame.bitmap.closed); assert.equal(worker.releases.at(-1).m.buffer, stale.data.buffer);
    worker.reply({ type: 'prepared', generation: 2 }); await ready;
    assert.equal(worker.releases.length, 4);

    // Still at most one render request in flight.
    proxy.render(2, true); proxy.render(2.03, true);
    assert.equal(worker.posted.filter(p => p.m.type === 'render' && p.m.generation === 2).length, 1);

    // Dispose drops buffers instead of posting to a terminated worker.
    worker.reply(frame(2, carriers())); proxy.render(2.06, true);
    worker.reply(frame(2, carriers()));
    const before = worker.releases.length;
    proxy.dispose();
    assert.equal(worker.releases.length, before);
    assert.equal(proxy.materialFrame, null);
    assert.ok(worker.terminated);
});

test('after a worker failure carrier buffers are dropped, never posted', async () => {
    const workers = [];
    class FakeWorker { constructor() { this.posted = []; workers.push(this); } postMessage(m) { this.posted.push(m); } terminate() {} reply(data) { this.onmessage?.({ data }); } }
    const document = { createElement: () => ({ width: 0, height: 0, dataset: {}, getContext: () => ({ transferFromImageBitmap() {} }) }) };
    const { WormholeWorkerSource } = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document })('visuals/WormholeWorkerSource.ts');
    const proxy = new WormholeWorkerSource({ externalMaterial: true });
    const worker = workers[0];
    const ready = proxy.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    proxy.render(1, true);
    const material = { cols: 1, rows: 1, amount: 1, bloom: 0, detail: 0, count: 1, data: new Float32Array(GRAIN_CARRIER_STRIDE) };
    worker.reply({ type: 'frame', generation: 1, time: 1, bitmap: { close() {} }, focalX: 0, focalY: 0, renderMs: 1, material });
    let error = null; proxy.onError = message => { error = message; };
    worker.reply({ type: 'failure', message: 'boom' });
    assert.equal(error, 'boom');
    assert.equal(worker.posted.filter(m => m.type === 'release-material').length, 0);
    proxy.dispose();
});

test('the backdrop feeds each new frame\'s carriers to the GPU renderer and composites only frames with material', async () => {
    let material = { cols: 320, rows: 180, amount: 0.5, bloom: 1, detail: 1, count: 2, data: new Float32Array(2 * GRAIN_CARRIER_STRIDE) };
    const source = { canvas: { width: 1280, height: 720 }, async prepare() {}, render: () => true, setPresentation() {}, dispose() {},
        get materialFrame() { return material; } };
    const backdrop = new WormholeBackdrop(source, { gpuMaterial: true });
    await backdrop.prepare(null);
    const shader = { uniforms: {}, fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
    backdrop.root.material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /uniform sampler2D uMaterial0;/);
    assert.match(shader.fragmentShader, /sRGBTransferOETF/, 'composited in sRGB space like Canvas2D lighter');
    assert.equal(typeof backdrop.root.onBeforeRender, 'function');
    assert.equal(backdrop.root.frustumCulled, false);
    backdrop.update(1, true);
    assert.equal(shader.uniforms.uMaterialOn.value, 1);
    assert.ok(shader.uniforms.uMaterial0.value, 'the resolved layer texture is bound');
    material = null;
    backdrop.update(1.03, true);
    assert.equal(shader.uniforms.uMaterialOn.value, 0, 'a frame without material composites nothing');
    backdrop.dispose();
    const cpu = new WormholeBackdrop({ ...source, render: () => true });
    const cpuShader = { uniforms: {}, fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
    cpu.root.material.onBeforeCompile(cpuShader);
    assert.equal(cpuShader.uniforms.uMaterialOn.value, 0, 'the CPU path never composites');
    cpu.dispose();
});

test('the GPU renderer copies carriers, grows its instance buffer and keeps the CPU bloom spreads', () => {
    const renderer = new GrainMaterialRenderer();
    assert.equal(renderer.active, false);
    const data = new Float32Array(5000 * GRAIN_CARRIER_STRIDE).fill(1);
    renderer.setFrame({ cols: 320, rows: 180, amount: 0.5, bloom: 1, detail: 1, count: 5000, data });
    assert.equal(renderer.active, true); assert.equal(renderer.carrierCount, 5000);
    data.fill(9);
    assert.equal(renderer.carrierBuffer.array[0], 1, 'copied, so the source may reuse its buffer');
    renderer.setFrame(null);
    assert.equal(renderer.active, false);
    // Variance of the CPU IIR passes (forward + backward per pass, pole 1 - keep).
    assert.ok(Math.abs(BLOOM_SIGMA_L1 ** 2 - 3 * 2 * 0.5 / 0.25) < 1e-9 && Math.abs(BLOOM_SIGMA_L2 ** 2 - 5 * 2 * 0.6 / 0.16) < 1e-9);
    renderer.dispose();
});

test('the GPU material needs half-float render targets; otherwise the CPU raster stays', () => {
    const has = names => ({ has: name => names.includes(name) });
    assert.equal(supportsGpuGrainMaterial({ capabilities: { isWebGL2: true }, extensions: has(['EXT_color_buffer_float']) }), true);
    assert.equal(supportsGpuGrainMaterial({ capabilities: {}, extensions: has(['EXT_color_buffer_half_float']) }), true);
    assert.equal(supportsGpuGrainMaterial({ capabilities: { isWebGL2: true }, extensions: has([]) }), false);
    assert.equal(supportsGpuGrainMaterial({ capabilities: { isWebGL2: false }, extensions: has(['EXT_color_buffer_float']) }), false);
    assert.equal(supportsGpuGrainMaterial({}), false, 'a headless or fake renderer');
    assert.equal(supportsGpuGrainMaterial(null), false);
});

test('the scene creates GPU-material backgrounds only when the host enables it', async () => {
    const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }) };
    const sceneLoad = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
    const requests = [];
    const factory = options => { requests.push(options); return { canvas: { width: 64, height: 36 }, async prepare() {}, render: () => false, setPresentation() {}, dispose() {} }; };
    const { RhythmGameScene } = sceneLoad('xr/scene/RhythmGameScene.ts');
    const cpuScene = new RhythmGameScene(new THREE.Scene(), undefined, factory);
    await cpuScene.setWormholeEnabled(true);
    assert.equal(requests[0].externalMaterial, undefined);
    cpuScene.dispose();
    const gpuScene = new RhythmGameScene(new THREE.Scene(), undefined, factory);
    await gpuScene.setBackgroundPipeline({ gpuMaterial: true, profile: false });
    assert.equal(requests.length, 1, 'recorded only: no background yet');
    await gpuScene.setWormholeEnabled(true);
    assert.equal(requests[1].externalMaterial, true);
    assert.equal(requests[1].profile, undefined);
    assert.equal(gpuScene.gpuMaterialEnabled, true);
    // Switching the renderer or profiling rebuilds the shown background with the new options (Addendum X).
    await gpuScene.setBackgroundPipeline({ gpuMaterial: false, profile: true });
    assert.equal(requests.length, 3);
    assert.equal(requests[2].externalMaterial, undefined);
    assert.equal(requests[2].profile, true);
    assert.equal(gpuScene.gpuMaterialEnabled, false);
    await gpuScene.setBackgroundPipeline({ gpuMaterial: false, profile: true });
    assert.equal(requests.length, 3, 'an unchanged pipeline keeps the background');
    gpuScene.dispose();
});
