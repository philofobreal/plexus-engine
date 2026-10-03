import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLoader } from './helpers/xr-loader.mjs';

function bitmap(label) { return { label, closed: false, close() { this.closed = true; } }; }

function proxyHarness(options = {}) {
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
    const load = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document });
    const { WormholeWorkerSource } = load('visuals/WormholeWorkerSource.ts');
    const source = new WormholeWorkerSource({ width: 768, height: 432, depthCue: 0.7, ...options });
    return { source, worker: workers[0], presenter };
}

const renders = worker => worker.posted.filter(m => m.type === 'render');

test('diagnostics: the proxy asks the worker to profile and exposes the stage times of the frame it shows', async () => {
    const { source, worker } = proxyHarness({ diagnostics: true });
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

test('the Canvas2D backend draws on an injected surface (worker OffscreenCanvas) instead of the DOM', () => {
    const contexts = [];
    const surface = (width, height) => ({ width, height, getContext: () => { const ctx = { lineCap: '' }; contexts.push(ctx); return ctx; } });
    const { Canvas2DRendererBackend } = createLoader()('visuals/Canvas2DRendererBackend.ts');
    const backend = new Canvas2DRendererBackend(640, 360, surface);
    assert.equal(backend.width, 640); assert.equal(backend.height, 360);
    assert.equal(contexts.length, 1);
});

test('off-thread adapter and proxy stay inside their bounded imports', () => {
    for (const file of ['WormholeWorkerSource.ts', 'wormholeRender.worker.ts']) {
        const source = readFileSync(join(process.cwd(), 'src', 'visuals', file), 'utf8');
        const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
        for (const specifier of imports) {
            assert.match(specifier, /^\.\.\/types\/(CanvasVisualSource|WormholeWorkerProtocol)$|^\.\/(WormholeCanvasSource|wormholeRender\.worker\.ts\?worker)$/,
                `${file} must not import ${specifier}`);
        }
        assert.doesNotMatch(source, /window\.location|\/state\/store/);
    }
});
