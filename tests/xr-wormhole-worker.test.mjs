import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLoader } from './helpers/xr-loader.mjs';

function bitmap(label) { return { label, closed: false, close() { this.closed = true; } }; }

function proxyHarness(options = {}, globals = {}) {
    const workers = [];
    class FakeWorker {
        constructor() { this.posted = []; this.terminated = false; this.onmessage = null; this.onerror = null; workers.push(this); }
        postMessage(message) { this.posted.push(message); }
        terminate() { this.terminated = true; }
        reply(data) { this.onmessage?.({ data }); }
    }
    const presenter = { shown: [], transferFromImageBitmap(b) { this.shown.push(b); } };
    const document = { body: { appendChild() {} },
        createElement: () => ({ width: 0, height: 0, dataset: {}, remove() {}, getContext: kind => (kind === 'bitmaprenderer' ? presenter : null) }) };
    const load = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document, ...globals });
    const { WormholeWorkerSource } = load('visuals/WormholeWorkerSource.ts');
    const source = new WormholeWorkerSource({ width: 768, height: 432, depthCue: 0.7, ...options });
    return { source, worker: workers[0], presenter };
}

const renders = worker => worker.posted.filter(m => m.type === 'render');

test('profile: the proxy asks the worker to profile and exposes the stage times of the frame it shows', async () => {
    const { source, worker } = proxyHarness({ profile: true });
    assert.equal(worker.posted[0].profile, true);
    assert.equal(source.stageTimes, null);
    const ready = source.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    source.render(1, true);
    worker.reply({ type: 'frame', generation: 1, time: 1, bitmap: bitmap('p'), focalX: 0, focalY: 0, renderMs: 30,
        stages: { grains: 14, resolve: 6, transfer: 0.4 } });
    source.render(1.05, true);
    assert.equal(JSON.stringify(source.stageTimes), JSON.stringify({ grains: 14, resolve: 6, transfer: 0.4 }));
    source.dispose();
    const plain = proxyHarness();
    assert.equal('profile' in plain.worker.posted[0], false, 'normal runs never profile');
    plain.source.dispose();
    // The debug surface and profiling are separate: the System > Diagnostics switch asks for profiling alone (Addendum X).
    const debug = proxyHarness({ diagnostics: true });
    assert.equal('profile' in debug.worker.posted[0], false);
    debug.source.dispose();
});

test('proxy initializes the worker once and settles preparations by generation (superseded ones quietly)', async () => {
    const { source, worker } = proxyHarness();
    assert.equal(JSON.stringify(worker.posted[0]), JSON.stringify({ type: 'init', protocol: 1, width: 768, height: 432, depthCue: 0.7 }));
    assert.equal(source.canvas.width, 768);
    const first = source.prepare(null);
    const analysis = { frames: [], events: [], duration: 1 };
    const second = source.prepare(analysis);
    await first;
    const prepares = worker.posted.filter(m => m.type === 'prepare');
    assert.deepEqual(prepares.map(m => m.generation), [1, 2]);
    assert.equal(prepares[1].analysis, analysis, 'the snapshot is handed to structured clone (copied), never transferred');
    worker.reply({ type: 'prepared', generation: 1 });
    assert.equal(source.render(0, false), false);
    assert.equal(renders(worker).length, 0, 'no render request before the current generation is prepared');
    worker.reply({ type: 'prepare-error', generation: 1, message: 'stale' });
    worker.reply({ type: 'prepared', generation: 2 });
    await second;
    source.render(0, false);
    assert.equal(renders(worker).length, 1);
    source.dispose();
});

test('one request in flight; a finished frame wakes the host, is presented zero-copy and carries its focal point', async () => {
    const { source, worker, presenter } = proxyHarness();
    let wakes = 0;
    source.onFrameReady = () => wakes++;
    const ready = source.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    assert.equal(source.render(5, false), false);
    assert.equal(source.render(5, false), false);
    assert.equal(renders(worker).length, 1, 'backpressure: no second request while one is in flight');
    const frame = bitmap('a');
    worker.reply({ type: 'frame', generation: 1, time: 5, bitmap: frame, focalX: 0.2, focalY: -0.1, renderMs: 7.5 });
    assert.equal(wakes, 1, 'an idle (paused) host is asked for one more frame');
    assert.equal(source.render(5, false), true);
    assert.deepEqual(presenter.shown, [frame]);
    assert.equal(source.focalPoint.x, 0.2); assert.equal(source.focalPoint.y, -0.1);
    assert.equal(source.lastRenderMs, 7.5);
    assert.equal(renders(worker).length, 1, 'a steady pause does not ask again');
    const macros = { intensity: 1, motion: 0.5, depth: 0.1, detail: 1 };
    source.setPresentation({ lineStroke: 0.4, maxFrameRateHz: 24, macros });
    assert.equal(JSON.stringify(worker.posted.at(-1)), JSON.stringify({ type: 'presentation', presentation: { lineStroke: 0.4, maxFrameRateHz: 24, macros } }),
        'Line stroke, rate and the Visual character cross the boundary as plain data');
    source.render(5, false);
    assert.equal(renders(worker).length, 2, 'a presentation change reaches a paused background');
    worker.reply({ type: 'unchanged', generation: 1 });
    source.render(10, true);
    const request = renders(worker).at(-1);
    assert.ok(Math.abs(request.time - (10 + 1 / 24)) < 1e-12, 'playing requests target the time they will be shown');
    assert.equal(request.playing, true);
    source.dispose();
});

test('frames from an older generation or after dispose are closed, never shown', async () => {
    const { source, worker, presenter } = proxyHarness();
    const ready = source.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    source.render(1, true);
    const next = source.prepare(null);
    const stale = bitmap('stale');
    worker.reply({ type: 'frame', generation: 1, time: 1, bitmap: stale, focalX: 0, focalY: 0, renderMs: 1 });
    assert.ok(stale.closed);
    worker.reply({ type: 'prepared', generation: 2 }); await next;
    source.render(2, true);
    const superseded = bitmap('superseded'), newest = bitmap('newest');
    worker.reply({ type: 'frame', generation: 2, time: 2, bitmap: superseded, focalX: 0, focalY: 0, renderMs: 1 });
    worker.reply({ type: 'frame', generation: 2, time: 2, bitmap: newest, focalX: 0, focalY: 0, renderMs: 1 });
    assert.ok(superseded.closed, 'an unshown frame is released when a newer one arrives');
    source.render(3, true);
    assert.deepEqual(presenter.shown, [newest]);
    source.dispose();
    assert.ok(worker.terminated);
    assert.equal(worker.posted.at(-1).type, 'dispose');
    const late = bitmap('late');
    worker.onmessage?.({ data: { type: 'frame', generation: 2, time: 3, bitmap: late, focalX: 0, focalY: 0, renderMs: 1 } });
    assert.equal(source.render(4, true), false);
});

test('worker failures reject a pending preparation, otherwise surface through onError; the source then stays inert', async () => {
    const { source, worker } = proxyHarness();
    const pending = source.prepare(null);
    worker.reply({ type: 'failure', message: 'init exploded' });
    await assert.rejects(pending, /init exploded/);
    assert.ok(worker.terminated, 'a failed worker is terminated immediately');
    await assert.rejects(source.prepare(null), /init exploded/);
    assert.equal(source.render(1, true), false);
    source.dispose();

    const second = proxyHarness();
    const errors = [];
    second.source.onError = message => errors.push(message);
    const ready = second.source.prepare(null); second.worker.reply({ type: 'prepared', generation: 1 }); await ready;
    second.worker.onerror({ message: 'lost context' });
    assert.deepEqual(errors, ['lost context']);
    assert.equal(second.source.render(1, true), false);
    second.source.dispose();
});

function workerHarness(renderResult = true) {
    const posted = [];
    const scope = { onmessage: null, closed: false, postMessage(message, transfer) { posted.push({ message, transfer }); }, close() { this.closed = true; } };
    const sources = [];
    class FakeSource {
        constructor(options) { this.options = options; this.presentations = []; this.focalPoint = { x: 0.3, y: 0.4 };
            this.canvas = { transferToImageBitmap: () => bitmap('frame') }; sources.push(this); }
        async prepare(analysis) { this.analysis = analysis; if (analysis === 'bad') throw new Error('preset missing'); }
        render(time, playing) { this.lastRender = [time, playing]; return renderResult; }
        get stageTimes() { return this.options.profile ? { tune: 1, grains: 12, draw: 20 } : null; }
        setPresentation(p) { this.presentations.push(p); }
        dispose() { this.disposed = true; }
    }
    createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: FakeSource } },
        { self: scope, performance: { now: () => 0 }, OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; } } })('visuals/wormholeRender.worker.ts');
    const send = data => scope.onmessage({ data });
    return { scope, posted, sources, send };
}

test('worker adapter: version check, OffscreenCanvas surfaces, generation-filtered preparation', async () => {
    const { posted, sources, send } = workerHarness();
    send({ type: 'init', protocol: 99, width: 640, height: 360, depthCue: 0 });
    assert.equal(posted[0].message.type, 'failure');
    send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0.7 });
    const options = sources[0].options;
    assert.equal(options.width, 640); assert.equal(options.depthCue, 0.7);
    const surface = options.createSurface(8, 4);
    assert.equal(surface.constructor.name, 'OffscreenCanvas'); assert.equal(surface.width, 8);
    send({ type: 'prepare', generation: 1, analysis: null });
    send({ type: 'prepare', generation: 2, analysis: 'bad' });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(JSON.stringify(posted.slice(1).map(p => p.message)), JSON.stringify([{ type: 'prepare-error', generation: 2, message: 'preset missing' }]),
        'only the newest generation answers');
});

test('a regenerated plan over the same analysis crosses to the worker alone; any other change sends the analysis', async () => {
    const { source, worker } = proxyHarness();
    const prepares = () => worker.posted.filter(m => m.type === 'prepare' || m.type === 'prepare-plan');
    const published = { frames: [{ rms: 1 }], events: [], trackAnalysis: { features: [] }, sampleRate: 44100, hopSize: 1024, bpm: 128, duration: 90 };
    const planA = { version: 1, source: 'auto', points: [] }, planB = { version: 1, source: 'auto', points: [{ id: 'b' }] };
    source.prepare({ ...published, performancePlan: planA });
    // Activity / Variation: a new snapshot object, same published data, new plan.
    const regenerated = source.prepare({ ...published, performancePlan: planB });
    assert.deepEqual(prepares().map(m => [m.type, m.generation]), [['prepare', 1], ['prepare-plan', 2]]);
    assert.equal('analysis' in prepares()[1], false, 'the per-hop analysis is not cloned again');
    assert.equal(prepares()[1].performancePlan, planB);
    worker.reply({ type: 'prepared', generation: 2 }); await regenerated;
    source.render(0, false);
    assert.equal(renders(worker).length, 1, 'a plan update settles like any preparation');
    // A new track (different published data) and a cleared analysis go in full.
    const other = { ...published, frames: [{ rms: 2 }], performancePlan: planA };
    source.prepare(other);
    source.prepare(null);
    source.prepare({ ...other, performancePlan: planB });
    assert.deepEqual(prepares().slice(2).map(m => [m.type, m.generation]), [['prepare', 3], ['prepare', 4], ['prepare', 5]],
        'after a null preparation the worker holds no analysis, so the next one is sent in full');
    source.prepare({ ...other, duration: 91, performancePlan: planB });
    assert.equal(prepares().at(-1).type, 'prepare', 'any differing analysis field sends the analysis');
    source.dispose();
    // A preparation that could not be posted leaves no analysis on the worker to update.
    const failing = proxyHarness();
    const post = failing.worker.postMessage.bind(failing.worker);
    failing.worker.postMessage = message => { if (message.type === 'prepare') throw new Error('DataCloneError'); post(message); };
    await assert.rejects(failing.source.prepare({ ...published, performancePlan: planA }), /DataCloneError/);
    failing.worker.postMessage = post;
    failing.source.prepare({ ...published, performancePlan: planB });
    assert.equal(failing.worker.posted.at(-1).type, 'prepare');
    failing.source.dispose();
});

test('worker adapter: a plan update re-prepares from the kept analysis copy; without one it is a preparation error', async () => {
    const { posted, sources, send } = workerHarness();
    send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0 });
    send({ type: 'prepare-plan', generation: 1, performancePlan: { points: [] } });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(posted.at(-1).message.type, 'prepare-error', 'nothing to update before a full preparation');
    const analysis = { frames: [{ rms: 1 }], events: [], trackAnalysis: { features: [] }, duration: 90, performancePlan: { points: [] } };
    send({ type: 'prepare', generation: 2, analysis });
    const plan = { points: [{ id: 'b' }] };
    send({ type: 'prepare-plan', generation: 3, performancePlan: plan });
    await new Promise(resolve => setTimeout(resolve, 0));
    const prepared = sources[0].analysis;
    assert.notEqual(prepared, analysis, 'a new snapshot for the source');
    assert.equal(prepared.performancePlan, plan);
    assert.equal(prepared.frames, analysis.frames, 'the kept copy is reused, not re-received');
    assert.equal(prepared.trackAnalysis, analysis.trackAnalysis);
    assert.equal(JSON.stringify(posted.slice(-1).map(p => p.message)), JSON.stringify([{ type: 'prepared', generation: 3 }]),
        'only the newest generation answers');
    send({ type: 'prepare', generation: 4, analysis: null });
    send({ type: 'prepare-plan', generation: 5, performancePlan: plan });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(posted.at(-1).message.type, 'prepare-error', 'a cleared analysis cannot be updated');
});

test('worker adapter: changed frames transfer their bitmap with the focal point; skipped or stale requests answer unchanged', async () => {
    const changed = workerHarness(true);
    changed.send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0 });
    changed.send({ type: 'prepare', generation: 3, analysis: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    changed.send({ type: 'render', generation: 3, time: 2.5, playing: true });
    const frame = changed.posted.at(-1);
    assert.equal(frame.message.type, 'frame');
    assert.deepEqual([frame.message.focalX, frame.message.focalY, frame.message.time], [0.3, 0.4, 2.5]);
    assert.ok(frame.transfer.length === 1 && frame.transfer[0] === frame.message.bitmap, 'the bitmap is transferred, not copied');
    assert.equal(frame.message.stages, undefined, 'no stage times unless profiling');
    changed.send({ type: 'render', generation: 2, time: 3, playing: true });
    assert.equal(JSON.stringify(changed.posted.at(-1).message), JSON.stringify({ type: 'unchanged', generation: 2 }));

    const profiled = workerHarness(true);
    profiled.send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0, profile: true });
    assert.equal(profiled.sources[0].options.profile, true);
    profiled.send({ type: 'prepare', generation: 1, analysis: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    profiled.send({ type: 'render', generation: 1, time: 1, playing: true });
    const stages = profiled.posted.at(-1).message.stages;
    assert.deepEqual([stages.tune, stages.grains, stages.draw], [1, 12, 20]);
    assert.ok(Number.isFinite(stages.transfer), 'the bitmap transfer is timed too');
    changed.send({ type: 'presentation', presentation: { lineStroke: 0.2, macros: { intensity: 1, motion: 1, depth: 0.1, detail: 0.5 } } });
    assert.deepEqual(changed.sources[0].presentations, [{ lineStroke: 0.2, macros: { intensity: 1, motion: 1, depth: 0.1, detail: 0.5 } }],
        'the worker hands the Visual character to its source');
    changed.send({ type: 'dispose' });
    assert.ok(changed.sources[0].disposed); assert.ok(changed.scope.closed);

    const idle = workerHarness(false);
    idle.send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0 });
    idle.send({ type: 'prepare', generation: 1, analysis: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    idle.send({ type: 'render', generation: 1, time: 1, playing: false });
    assert.equal(JSON.stringify(idle.posted.at(-1).message), JSON.stringify({ type: 'unchanged', generation: 1 }));
});

test('the proxy measures request -> frame latency and calibrates its lead to when frames really reach the screen', async () => {
    let now = 0;
    const { source, worker } = proxyHarness({}, { performance: { now: () => now } });
    assert.equal(source.frameLatencyMs, 0, 'unknown until a frame arrives');
    const ready = source.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    source.setPresentation({ maxFrameRateHz: 36 });
    const frame = (generation, time) => ({ type: 'frame', generation, time, bitmap: bitmap('f'), focalX: 0, focalY: 0, renderMs: 1 });
    // Request at song time 1 (lead one 36 Hz interval); the frame takes 31 ms and is shown three 72 Hz frames later.
    source.render(1, true);
    assert.ok(Math.abs(renders(worker).at(-1).time - (1 + 1 / 36)) < 1e-12, 'initial lead: one requested interval');
    now = 31; worker.reply(frame(1, 1 + 1 / 36));
    assert.equal(source.frameLatencyMs, 31);
    source.render(1 + 3 / 72, true);
    const lead = renders(worker).at(-1).time - (1 + 3 / 72);
    assert.ok(lead > 1 / 36 && lead < 3 / 72, 'the lead moves toward the real 3-frame delay');
    // Smoothing: one outlier does not replace the estimate.
    now = 31 + 80; worker.reply(frame(1, 2));
    assert.ok(source.frameLatencyMs > 31 && source.frameLatencyMs < 80);
    // Paused frames and seeks never calibrate the lead.
    source.render(5, false);
    const paused = renders(worker).at(-1);
    assert.equal(paused.time, 5, 'paused requests ask for the exact time');
    source.dispose();
});

test('the Canvas2D backend draws on an injected surface (worker OffscreenCanvas) instead of the DOM', () => {
    const contexts = [];
    const surface = (width, height) => ({ width, height, getContext: () => { const ctx = { lineCap: '' }; contexts.push(ctx); return ctx; } });
    const { Canvas2DRendererBackend } = createLoader()('visuals/Canvas2DRendererBackend.ts');
    const backend = new Canvas2DRendererBackend(640, 360, surface);
    assert.equal(backend.width, 640); assert.equal(backend.height, 360);
    assert.equal(contexts.length, 1);
});

test('Canvas2D strokes set one opaque style per colour and carry alpha in globalAlpha; fills and composites draw opaque', () => {
    const log = [];
    const ctx = new Proxy({ globalAlpha: 1 }, {
        set(target, key, value) { log.push([key, value]); target[key] = value; return true; },
        get(target, key) { return key in target ? target[key] : () => { log.push([key]); return { addColorStop() {} }; }; }
    });
    const surface = (width, height) => ({ width, height, getContext: () => ctx });
    const { Canvas2DRendererBackend } = createLoader()('visuals/Canvas2DRendererBackend.ts');
    const backend = new Canvas2DRendererBackend(64, 32, surface);
    log.length = 0;
    const assigned = key => log.filter(([k, v]) => k === key && v !== undefined).map(([, v]) => v);
    for (const a of [255, 128, 64]) { backend.stroke(10, 20, 30, a); backend.strokeWeight(2); backend.line(0, 0, 5, 5); }
    assert.deepEqual(assigned('strokeStyle'), ['rgb(10,20,30)'], 'one style string for one colour');
    assert.deepEqual(assigned('globalAlpha'), [128 / 255, 64 / 255], 'alpha per line (1 is already current)');
    assert.equal(log.filter(([k]) => k === 'stroke').length, 3);
    assert.equal(assigned('lineCap').length, 0, 'the round cap is already set');
    backend.stroke(10, 20, 31, 999); backend.line(0, 0, 1, 1, 'square');
    assert.deepEqual(assigned('strokeStyle').at(-1), 'rgb(10,20,31)');
    assert.equal(ctx.globalAlpha, 1, 'an over-range alpha clamps like rgba() would');
    assert.deepEqual(assigned('lineCap'), ['square']);
    backend.stroke(1, 2, 3, 30); backend.line(0, 0, 1, 1);
    assert.ok(ctx.globalAlpha < 1);
    // Every non-stroke primitive draws at full alpha.
    backend.fill(1, 2, 3, 255); backend.noStroke(); backend.circle(5, 5, 4);
    assert.equal(ctx.globalAlpha, 1, 'fills');
    backend.stroke(1, 2, 3, 30); backend.line(0, 0, 1, 1); backend.radialGlow(1, 1, 3, [1, 2, 3], 0.5);
    assert.equal(ctx.globalAlpha, 1, 'gradients');
    backend.stroke(1, 2, 3, 30); backend.line(0, 0, 1, 1); backend.background(0, 0, 0);
    assert.equal(ctx.globalAlpha, 1, 'the frame clear');
    backend.stroke(1, 2, 3, Number.NaN); backend.line(0, 0, 1, 1);
    assert.equal(ctx.globalAlpha, 0, 'a NaN alpha draws nothing instead of keeping a stale alpha');
});

test('off-thread adapter and proxy stay inside their bounded imports', () => {
    for (const file of ['WormholeWorkerSource.ts', 'wormholeRender.worker.ts']) {
        const source = readFileSync(join(process.cwd(), 'src', 'visuals', file), 'utf8');
        const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
        for (const specifier of imports) {
            assert.match(specifier, /^\.\.\/types\/(CanvasVisualSource|WormholeWorkerProtocol|GrainMaterialFrame|GrainLineFrame)$|^\.\/(WormholeCanvasSource|wormholeRender\.worker\.ts\?worker)$/,
                `${file} must not import ${specifier}`);
        }
        assert.doesNotMatch(source, /window\.location|\/state\/store/);
    }
});
