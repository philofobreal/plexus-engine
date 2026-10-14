// GPU grain trail lines (ADR-009 Addendum AA): the source records the crossfade strokes as a line
// list, the worker ships it in the frame's pooled carrier buffer, the proxy exposes it with the
// material's lifetime, and the backdrop draws it over the canvas before showing it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({ three: THREE });
const { GRAIN_LINE, GRAIN_LINE_STRIDE } = load('types/GrainLineFrame.ts');
const { GRAIN_CARRIER_STRIDE } = load('types/GrainMaterialFrame.ts');

test('the line collector records exactly what Canvas2D would have stroked', () => {
    const { GrainLineCollector } = load('visuals/GrainLineCollector.ts');
    const collector = new GrainLineCollector();
    collector.reset(640.7, 360);
    collector.line(1, 2, 3, 4, 2.5, 12.4, 300, -5, 128, false);
    collector.line(5, 6, 7, 8, 0, 0, 0, 0, 0, false); // transparent: paints nothing
    collector.line(5, 6, 7, 8, -1, 100.5, 0, 0, Number.NaN, false); // NaN alpha: paints nothing
    collector.line(9, 10, 11, 12, -3, 255, 255, 255, 999, true);
    const frame = collector.frame;
    assert.deepEqual([frame.width, frame.height, frame.count, frame.square], [640, 360, 2, true]);
    const record = i => Array.from(frame.data.subarray(i * GRAIN_LINE_STRIDE, (i + 1) * GRAIN_LINE_STRIDE));
    const [first, second] = [record(0), record(1)];
    assert.deepEqual(first.slice(0, 5), [1, 2, 3, 4, 2.5]);
    assert.deepEqual(first.slice(GRAIN_LINE.R, GRAIN_LINE.A).map(v => Math.round(v * 255)), [12, 255, 0], 'channels rounded and clamped like a CSS colour');
    assert.ok(Math.abs(first[GRAIN_LINE.A] - 128 / 255) < 1e-7);
    assert.ok(Math.abs(second[GRAIN_LINE.WIDTH] - 0.0001) < 1e-9, 'the backend\'s minimum width');
    assert.equal(second[GRAIN_LINE.A], 1, 'an over-range alpha clamps like rgba()');
    // Growth keeps every record.
    collector.reset(10, 10);
    for (let i = 0; i < 5000; i++) collector.line(i, 0, i, 1, 1, 1, 1, 1, 255, false);
    assert.equal(collector.frame.count, 5000);
    assert.equal(collector.frame.data[4999 * GRAIN_LINE_STRIDE], 4999);
});

test('a source records lines only with external material and only alongside a material frame', async () => {
    class Backend { constructor(width, height) { this.canvas = { width, height }; this.frameCount = 0; this.width = width; this.height = height; } background() {} }
    let material = true;
    class Identity {
        constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.frameDrive = { travel: 0, travelRate: 0, hue: 0 }; }
        setMaterialSink(sink) { this.sink = sink; } setLineSink(sink) { this.lineSink = sink; }
        syncPosition() {} setDepthCue() {} setDepthLayers() {}
        draw() {
            if (!material) return;
            this.sink?.begin(320, 180, 64, 36, 1, 0.5, 1);
            this.lineSink?.line(1, 2, 3, 4, 2, 10, 20, 30, 255, false);
        }
    }
    const { WormholeCanvasSource } = createLoader({
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend },
        './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }
    }, { fetch: async () => ({ ok: true, json: async () => ({}) }), performance })('visuals/WormholeCanvasSource.ts');
    const linesOnly = new WormholeCanvasSource({ width: 64, height: 36, externalLines: true });
    await linesOnly.prepare(null); linesOnly.render(1, false);
    assert.equal(linesOnly.lineFrame, null, 'no lines without external material');
    const source = new WormholeCanvasSource({ width: 64, height: 36, externalMaterial: true, externalLines: true });
    await source.prepare(null); source.render(1, false);
    assert.deepEqual([source.lineFrame.count, source.lineFrame.width, source.lineFrame.height], [1, 64, 36]);
    material = false;
    source.render(2, true);
    assert.equal(source.lineFrame, null, 'a frame without material strokes its lines itself');
    linesOnly.dispose(); source.dispose();
});

test('the worker ships the lines right after the carriers in the same transferred buffer; the proxy exposes them with the material', async () => {
    const posted = [];
    const scope = { onmessage: null, postMessage(message, transfer) { posted.push({ message, transfer }); }, close() {} };
    const sources = [];
    class FakeSource {
        constructor(options) { this.options = options; this.focalPoint = { x: 0, y: 0 }; sources.push(this);
            this.canvas = { transferToImageBitmap: () => ({ close() {} }) }; }
        async prepare() {} render() { return true; } setPresentation() {} dispose() {}
        get stageTimes() { return null; }
        get materialFrame() { return { cols: 320, rows: 180, amount: 0.5, bloom: 1, detail: 1, count: 2, data: new Float32Array(64 * GRAIN_CARRIER_STRIDE).fill(3) }; }
        get lineFrame() { return this.options.externalLines ? { width: 640, height: 360, square: true, count: 3, data: new Float32Array(64 * GRAIN_LINE_STRIDE).fill(7) } : null; }
    }
    createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: FakeSource } },
        { self: scope, performance: { now: () => 0 }, OffscreenCanvas: class {} })('visuals/wormholeRender.worker.ts');
    const send = data => scope.onmessage({ data });
    send({ type: 'init', protocol: 1, width: 640, height: 360, depthCue: 0, externalMaterial: true, externalLines: true });
    assert.equal(sources[0].options.externalLines, true);
    send({ type: 'prepare', generation: 1, analysis: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    send({ type: 'render', generation: 1, time: 1, playing: true });
    const { message, transfer } = posted.at(-1);
    assert.equal(message.material.data.length, 2 * GRAIN_CARRIER_STRIDE);
    assert.deepEqual([message.lines.count, message.lines.square, message.lines.width, message.lines.data.length], [3, true, 640, 3 * GRAIN_LINE_STRIDE]);
    assert.equal(message.lines.data.buffer, message.material.data.buffer, 'one pooled buffer');
    assert.equal(message.lines.data.byteOffset, 2 * GRAIN_CARRIER_STRIDE * 4, 'right after the carriers');
    assert.equal(message.lines.data[0], 7);
    assert.equal(transfer.filter(item => item === message.material.data.buffer).length, 1, 'transferred once');

    const workers = [];
    class FakeWorker { constructor() { this.posted = []; workers.push(this); } postMessage(m) { this.posted.push(m); } terminate() {} reply(data) { this.onmessage?.({ data }); } }
    const presenter = { transferFromImageBitmap() {} };
    const document = { createElement: () => ({ width: 0, height: 0, dataset: {}, getContext: () => presenter }) };
    const { WormholeWorkerSource } = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document })('visuals/WormholeWorkerSource.ts');
    const withoutMaterial = new WormholeWorkerSource({ externalLines: true });
    assert.equal('externalLines' in workers[0].posted[0], false, 'lines are only requested with external material');
    withoutMaterial.dispose();
    const proxy = new WormholeWorkerSource({ externalMaterial: true, externalLines: true });
    const worker = workers[1];
    assert.equal(worker.posted[0].externalLines, true);
    const ready = proxy.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    proxy.render(1, true);
    worker.reply({ type: 'frame', generation: 1, time: 1, bitmap: { close() {} }, focalX: 0, focalY: 0, renderMs: 5, material: message.material, lines: message.lines });
    assert.equal(proxy.lineFrame, null, 'nothing shown yet');
    proxy.render(1.03, true);
    assert.equal(proxy.lineFrame, message.lines);
    worker.reply({ type: 'frame', generation: 1, time: 1.06, bitmap: { close() {} }, focalX: 0, focalY: 0, renderMs: 5, material: message.material });
    proxy.render(1.06, true);
    assert.equal(proxy.lineFrame, null, 'a frame without lines clears them');
    proxy.dispose();
    assert.equal(proxy.lineFrame, null);
});

/** Records what the line renderer asks of the renderer (no WebGL). */
function fakeRenderer() {
    const log = [];
    let target = 'screen', xr = true;
    return {
        log,
        xr: { get enabled() { return xr; }, set enabled(value) { log.push(['xr', value]); xr = value; } },
        autoClear: true,
        getRenderTarget: () => target,
        setRenderTarget(next) { target = next; log.push(['target', next]); },
        getClearAlpha: () => 1, getClearColor(color) { return color; }, setClearColor() {},
        clear() { log.push(['clear', target]); },
        initTexture(texture) { log.push(['upload', texture, texture.image]); },
        getContext: () => ({ flush() { log.push(['flush']); } }),
        render(scene) { log.push(['render', target, scene.children[0].geometry.instanceCount]); },
        state: { viewport(v) { log.push(['viewport', v]); } }
    };
}

test('the line renderer draws a frame once, always re-composites the canvas, and restores the renderer', () => {
    const { GrainLineRenderer } = load('xr/scene/GrainLineRenderer.ts');
    const canvasTexture = new THREE.Texture();
    const plain = new GrainLineRenderer(canvasTexture, 640, 360);
    assert.equal(plain.output.texture.colorSpace, THREE.SRGBColorSpace, 'decoded on sampling, like the canvas texture');
    assert.deepEqual([plain.output.width, plain.output.height, plain.output.texture.generateMipmaps], [640, 360, false]);
    const mipmapped = new GrainLineRenderer(canvasTexture, 2560, 1440, { mipmaps: true });
    assert.deepEqual([mipmapped.output.texture.generateMipmaps, mipmapped.output.texture.minFilter], [true, THREE.LinearMipmapLinearFilter]);
    mipmapped.dispose();

    const renderer = fakeRenderer();
    plain.render(renderer);
    assert.equal(renderer.log.length, 0, 'nothing before the first frame');
    const data = new Float32Array(3 * GRAIN_LINE_STRIDE).fill(1);
    plain.setFrame({ width: 640, height: 360, square: true, count: 3, data });
    plain.render(renderer, { viewport: 'eye' });
    const renders = renderer.log.filter(([kind]) => kind === 'render');
    assert.equal(renders.length, 2, 'lines, then the composite');
    assert.equal(renders[0][2], 3, 'one instance per line');
    assert.equal(renders[1][1], plain.output, 'the composite fills the plane texture');
    assert.equal(renderer.getRenderTarget(), 'screen', 'the render target is restored');
    assert.equal(renderer.xr.enabled, true, 'XR camera handling is restored');
    assert.deepEqual(renderer.log.at(-1), ['viewport', 'eye']);
    renderer.log.length = 0;
    plain.render(renderer);
    assert.equal(renderer.log.length, 0, 'once per frame');
    // A frame without lines still lays the new canvas into the output (no line pass).
    plain.setFrame(null);
    plain.render(renderer);
    assert.deepEqual(renderer.log.filter(([kind]) => kind === 'render').map(([, target]) => target), [plain.output]);
    assert.equal(plain.lineCount, 0);
    // More lines than the buffer holds grow it.
    plain.setFrame({ width: 640, height: 360, square: false, count: 5000, data: new Float32Array(5000 * GRAIN_LINE_STRIDE) });
    assert.equal(plain.lineCount, 5000);
    assert.equal(plain.renderedFrames, 2);
    plain.dispose();
});

test('the backdrop shows the line composite and feeds it every new frame; without the GPU material there are no GPU lines', () => {
    const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');
    const lineFrame = { width: 64, height: 36, square: false, count: 1, data: new Float32Array(GRAIN_LINE_STRIDE) };
    const source = { canvas: { width: 64, height: 36 }, lineFrame, materialFrame: null, async prepare() {}, render: () => true, dispose() {} };
    const backdrop = new WormholeBackdrop(source, { gpuMaterial: true, gpuLines: true });
    const map = backdrop.root.material.map;
    assert.ok(map.isRenderTargetTexture, 'the plane samples the composite, not the canvas');
    const plain = new WormholeBackdrop({ ...source }, { gpuLines: true });
    assert.ok(!plain.root.material.map.isRenderTargetTexture, 'GPU lines need the GPU material');
    assert.equal(typeof backdrop.root.onBeforeRender, 'function');
    backdrop.dispose(); plain.dispose();
});

test('a new frame\'s upload and off-screen passes run before the eye pass, never inside it (Addendum AE)', async () => {
    const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');
    const lineFrame = { width: 64, height: 36, square: false, count: 2, data: new Float32Array(2 * GRAIN_LINE_STRIDE) };
    let fresh = false;
    const source = { canvas: { width: 64, height: 36 }, lineFrame, materialFrame: null, async prepare() {}, render: () => fresh, dispose() {} };
    const backdrop = new WormholeBackdrop(source, { gpuMaterial: true, gpuLines: true });
    await backdrop.prepare(null);
    const renderer = fakeRenderer();
    backdrop.prerender(renderer);
    assert.equal(renderer.log.length, 0, 'nothing before the first frame');
    fresh = true; backdrop.update(1, false);
    backdrop.prerender(renderer);
    const kinds = renderer.log.filter(([kind]) => kind === 'upload' || kind === 'render');
    assert.equal(kinds[0][0], 'upload', 'the new canvas is uploaded first');
    assert.deepEqual(kinds.slice(1).map(([kind]) => kind), ['render', 'render'], 'then the lines and the composite');
    assert.equal(renderer.getRenderTarget(), 'screen', 'the frame\'s own target is restored for the eye pass');
    // The eye pass itself: the plane's fallback finds nothing left, and no second prerender repeats it.
    renderer.log.length = 0;
    backdrop.root.onBeforeRender(renderer, null, { viewport: 'eye' });
    backdrop.prerender(renderer);
    assert.deepEqual(renderer.log, [], 'no render target switch inside the eye pass');
    // A frame between background redraws does nothing.
    fresh = false; backdrop.update(1 + 1 / 72, false); backdrop.prerender(renderer);
    assert.deepEqual(renderer.log, []);
    backdrop.dispose();
    // The host runs it between the scene update and the render.
    const controller = readFileSync('src/xr/XrAppController.ts', 'utf8');
    assert.match(controller, /this\.scene\.update\([^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*this\.scene\.prerender\(this\.runtime\.renderer\);/);
});

test('a frame from the worker is uploaded and composited ahead, when it arrives, into targets not shown; presenting it only switches (Addendum AE)', async () => {
    const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');
    const lineFrame = { width: 64, height: 36, square: false, count: 1, data: new Float32Array(GRAIN_LINE_STRIDE) };
    // An asynchronous source double: a received frame waits (stagedImage / stagedSerial) until render presents it.
    const makeSource = () => ({ canvas: { width: 64, height: 36 }, lineFrame, materialFrame: null, onFrameReady: null,
        staged: null, serial: 0, shownSerial: 0,
        get stagedImage() { return this.staged?.bitmap ?? null; }, get stagedSerial() { return this.staged?.serial ?? 0; },
        get stagedLineFrame() { return this.staged ? lineFrame : null; }, stagedMaterialFrame: null,
        arrive(bitmap) { this.staged = { bitmap, serial: ++this.serial }; this.onFrameReady?.(); },
        render() { if (!this.staged) return false; this.shownSerial = this.staged.serial; this.staged = null; return true; },
        async prepare() {}, dispose() {} });
    const source = makeSource();
    const backdrop = new WormholeBackdrop(source, { gpuMaterial: true, gpuLines: true });
    await backdrop.prepare(null);
    const renderer = fakeRenderer();
    const uploads = () => renderer.log.filter(([kind]) => kind === 'upload');
    // Before the first drawn frame there is no renderer to upload with: the first frame takes the canvas path.
    source.arrive({ id: 'a' });
    backdrop.update(1, true); backdrop.prerender(renderer);
    assert.equal(backdrop.uploadedAhead, false, 'the first frame: canvas upload in the headset frame');
    assert.equal(uploads().length, 1);
    // From now on a frame is uploaded and composited the moment it arrives, and flushed.
    renderer.log.length = 0;
    source.arrive({ id: 'b' });
    assert.equal(uploads().length, 1, 'uploaded on arrival');
    const [, first, image] = uploads()[0];
    assert.equal(image.id, 'b'); assert.equal(first.flipY, false, 'an ImageBitmap uploads unflipped'); assert.equal(first.colorSpace, THREE.NoColorSpace, 'raw bytes');
    const renders = renderer.log.filter(([kind]) => kind === 'render');
    assert.equal(renders.length, 2, 'its lines and composite are rendered on arrival too');
    const composite = renders[1][1];
    assert.notEqual(composite.texture, backdrop.root.material.map, 'into the composite not shown');
    assert.deepEqual(renderer.log.at(-1), ['flush'], 'flushed, so the browser runs it before the next headset frame');
    renderer.log.length = 0;
    backdrop.update(1 + 1 / 24, true); backdrop.prerender(renderer);
    backdrop.root.onBeforeRender(renderer, null, { viewport: 'eye' });
    assert.deepEqual(renderer.log, [], 'presenting it uploads and renders nothing: it only switches');
    assert.equal(backdrop.root.material.map, composite.texture, 'the plane shows the composite made on arrival');
    assert.equal(backdrop.uploadedAhead, true); assert.equal(backdrop.framesUploadedAhead, 1);
    // The next frame goes into the other texture (the shown one is never re-uploaded).
    renderer.log.length = 0;
    source.arrive({ id: 'c' });
    const [, second] = uploads()[0];
    assert.notEqual(second, first, 'double buffered');
    backdrop.update(1 + 2 / 24, true);
    source.arrive({ id: 'd' });
    assert.equal(uploads()[1][1], first, 'and back again');
    // A frame replaced before it was shown is simply overwritten in the back texture.
    source.arrive({ id: 'e' });
    assert.equal(uploads()[2][1], first);
    backdrop.update(1 + 3 / 24, true);
    assert.equal(backdrop.uploadedAhead, true); assert.equal(backdrop.framesUploadedAhead, 3);
    // Hidden: no upload ahead (the canvas path takes over when shown again).
    backdrop.root.visible = false; renderer.log.length = 0;
    source.arrive({ id: 'f' });
    assert.equal(uploads().length, 0);
    backdrop.dispose();
    // Without GPU lines (no raw composite) or with a synchronous source, nothing is prepared ahead.
    const plainSource = makeSource();
    const plain = new WormholeBackdrop(plainSource, { gpuMaterial: true, gpuLines: false });
    await plain.prepare(null); plain.prerender(renderer); renderer.log.length = 0;
    plainSource.arrive({ id: 'g' });
    assert.equal(uploads().length, 0, 'the canvas path only');
    plain.dispose();
});

test('the composite reads a frame uploaded ahead as the canvas texture would hold it: unflipped rows, un-premultiplied', () => {
    const shader = readFileSync('src/xr/scene/GrainLineRenderer.ts', 'utf8');
    assert.match(shader, /textureSize\(uCanvas, 0\)\.y - 1 - p\.y/, 'top row first: flipped back');
    assert.match(shader, /raw\.a > 0\.0 \? min\(raw\.rgb \/ raw\.a, vec3\(1\.0\)\) : vec3\(0\.0\)/, 'un-premultiplied, in the encoded bytes');
    const { GrainLineRenderer } = load('xr/scene/GrainLineRenderer.ts');
    const canvasTexture = new THREE.Texture(), aheadTexture = new THREE.Texture();
    const lines = new GrainLineRenderer(canvasTexture, 8, 4);
    lines.setCanvas(aheadTexture, true);
    const renderer = fakeRenderer(); lines.setFrame(null); lines.render(renderer);
    assert.equal(renderer.log.filter(([kind]) => kind === 'render').length, 1, 'composited');
    lines.setCanvas(canvasTexture, false);
    lines.dispose();
});

test('the worker proxy numbers received frames and exposes the waiting one for an upload ahead (Addendum AE)', async () => {
    const workers = [];
    class FakeWorker { constructor() { this.posted = []; workers.push(this); } postMessage(m) { this.posted.push(m); } terminate() {} reply(data) { this.onmessage?.({ data }); } }
    const presenter = { shown: [], transferFromImageBitmap(b) { this.shown.push(b); } };
    const document = { body: { appendChild() {} }, createElement: () => ({ width: 0, height: 0, dataset: {}, getContext: () => presenter }) };
    const proxyLoad = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document });
    const proxy = new (proxyLoad('visuals/WormholeWorkerSource.ts').WormholeWorkerSource)({ width: 64, height: 36 });
    const worker = workers[0];
    const ready = proxy.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    assert.deepEqual([proxy.stagedImage, proxy.stagedSerial, proxy.shownSerial], [null, 0, 0]);
    let woke = null;
    proxy.onFrameReady = () => { woke = [proxy.stagedImage, proxy.stagedSerial]; };
    proxy.render(1, true);
    const bitmap = { close() {} };
    worker.reply({ type: 'frame', generation: 1, time: 1, bitmap, focalX: 0, focalY: 0, renderMs: 1 });
    assert.deepEqual(woke, [bitmap, 1], 'staged when the host is woken');
    assert.equal(proxy.render(1.03, true), true);
    assert.deepEqual([proxy.stagedImage, proxy.stagedSerial, proxy.shownSerial], [null, 0, 1], 'presented');
    assert.equal(presenter.shown[0], bitmap, 'the canvas still receives it');
    proxy.dispose();
});

test('the scene asks the factory for lines only with the GPU material', async () => {
    const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }) };
    const sceneLoad = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
    const requests = [];
    const scene = new (sceneLoad('xr/scene/RhythmGameScene.ts').RhythmGameScene)(new THREE.Scene(), undefined, options => {
        requests.push(options);
        return { options, canvas: { width: 1, height: 1 }, async prepare() {}, render: () => false, setPresentation() {}, dispose() {} };
    });
    await scene.setBackgroundPipeline({ gpuMaterial: false, profile: false, gpuLines: true });
    await scene.setWormholeEnabled(true);
    assert.equal(requests.at(-1).externalLines, undefined);
    assert.equal(scene.gpuLinesEnabled, false);
    await scene.setBackgroundPipeline({ gpuMaterial: true, profile: false, gpuLines: true });
    assert.deepEqual([requests.at(-1).externalMaterial, requests.at(-1).externalLines], [true, true], 'the plane is rebuilt with lines');
    assert.equal(scene.gpuLinesEnabled, true);
    await scene.setBackgroundPipeline({ gpuMaterial: true, profile: false, gpuLines: false });
    assert.equal(requests.at(-1).externalLines, undefined);
    scene.dispose();
});

test('a double-buffered line composite (Addendum AE): render draws the one not shown, present shows it', () => {
    const { GrainLineRenderer } = load('xr/scene/GrainLineRenderer.ts');
    const lines = new GrainLineRenderer(new THREE.Texture(), 64, 36, { doubleBuffered: true });
    const renderer = fakeRenderer();
    const shown = lines.output;
    lines.setFrame(null);
    assert.equal(lines.render(renderer), true);
    const target = renderer.log.filter(([kind]) => kind === 'render').at(-1)[1];
    assert.notEqual(target, shown, 'into the composite not shown');
    assert.equal(lines.output, shown);
    lines.present();
    assert.equal(lines.output, target);
    assert.equal(lines.render(renderer), false, 'once per frame');
    lines.setFrame(null); lines.render(renderer); lines.present();
    assert.equal(lines.output, shown, 'and back');
    lines.dispose();
    const single = new GrainLineRenderer(new THREE.Texture(), 64, 36);
    const only = single.output; single.setFrame(null); single.render(renderer); single.present();
    assert.equal(single.output, only, 'one composite: present changes nothing');
    single.dispose();
});
