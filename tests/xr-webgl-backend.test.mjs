// WebGL2 renderer backend for the Wormhole background (ADR-009 Addendum AF): batching, ordering and
// the Canvas2D-compatible state rules, against a recording WebGL double (no GPU in node). The pixel
// match with Canvas2D is checked in a browser (see the ADR).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLoader } from './helpers/xr-loader.mjs';

/** A WebGL2 context double: every call is logged; objects are plain tokens; compiles and links succeed. */
function fakeGl() {
    const log = [];
    const constants = { COMPILE_STATUS: 'COMPILE_STATUS', LINK_STATUS: 'LINK_STATUS', BLEND: 'BLEND', ONE: 'ONE', ONE_MINUS_SRC_ALPHA: 'ONE_MINUS_SRC_ALPHA',
        ONE_MINUS_SRC_COLOR: 'ONE_MINUS_SRC_COLOR', TRIANGLE_STRIP: 'TRIANGLE_STRIP', TRIANGLES: 'TRIANGLES', COLOR_BUFFER_BIT: 'COLOR_BUFFER_BIT' };
    let next = 0;
    let lastBuffer = null;
    const gl = new Proxy({}, {
        get(_, name) {
            if (name in constants) return constants[name];
            if (typeof name === 'string' && /^[A-Z_0-9]+$/.test(name)) return name;
            if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
            if (name === 'getAttribLocation') return (_p, attribute) => attribute === 'aCorner' ? 0 : ++next;
            if (name === 'getUniformLocation') return (_p, uniform) => ({ uniform });
            if (name === 'getExtension') return () => null;
            if (name === 'bufferData') return (target, data, usage) => { lastBuffer = data; log.push(['bufferData', data?.length, usage]); };
            if (typeof name === 'string' && name.startsWith('create')) return () => ({ token: `${name}#${++next}` });
            return (...args) => { log.push([name, ...args]); };
        }
    });
    return { gl, log, lastBuffer: () => lastBuffer };
}

function backend({ webgl = true } = {}) {
    const fake = fakeGl();
    const { WebGLRendererBackend, WEBGL_PRIMITIVE_STRIDE, PRIMITIVE_ROUND, PRIMITIVE_SQUARE, PRIMITIVE_RING } = createLoader()('visuals/WebGLRendererBackend.ts');
    const surface = (width, height) => ({ width, height, getContext: type => (type === 'webgl2' && webgl ? fake.gl : null) });
    return { ...fake, WebGLRendererBackend, surface, stride: WEBGL_PRIMITIVE_STRIDE, kinds: { PRIMITIVE_ROUND, PRIMITIVE_SQUARE, PRIMITIVE_RING },
        create: () => new WebGLRendererBackend(640, 360, surface) };
}

const draws = log => log.filter(([name]) => name === 'drawArraysInstanced' || name === 'drawArrays');

test('lines and filled circles are batched in painter\'s order into one instanced draw; any other primitive flushes the batch first', () => {
    const { create, log, lastBuffer, stride, kinds } = backend();
    const b = create();
    log.length = 0;
    b.background(14, 8, 30, 128);
    b.stroke(255, 128, 0, 255); b.strokeWeight(2);
    for (let i = 0; i < 3000; i++) b.line(i % 640, 10, (i + 5) % 640, 20);
    b.noStroke(); b.fill(10, 20, 30, 255); b.circle(100, 100, 6);
    b.stroke(1, 2, 3, 255); b.line(0, 0, 4, 4, 'square');
    assert.equal(b.pendingPrimitives, 3002, 'nothing drawn while batching');
    assert.equal(draws(log).length, 0);
    b.radialGlow(320, 180, 50, [255, 0, 0], 0.5);
    const calls = draws(log);
    assert.equal(calls.length, 2, 'the batch, then the gradient');
    assert.deepEqual(calls[0], ['drawArraysInstanced', 'TRIANGLE_STRIP', 0, 4, 3002], 'one instanced draw for 3002 primitives');
    assert.equal(calls[1][0], 'drawArrays');
    assert.equal(lastBuffer().length, 3002 * stride, 'exactly the batch is uploaded');
    // The batch's last records: the circle (a zero-length round line as wide as the circle) and the square line.
    assert.equal(lastBuffer()[3000 * stride + 9], kinds.PRIMITIVE_ROUND); assert.equal(lastBuffer()[3001 * stride + 9], kinds.PRIMITIVE_SQUARE);
    // finish() draws what is left and flushes the context.
    b.stroke(1, 1, 1, 255); b.line(0, 0, 1, 1); log.length = 0;
    b.finish();
    assert.equal(b.pendingPrimitives, 0);
    assert.deepEqual(log.map(([name]) => name).slice(-2), ['drawArraysInstanced', 'flush']);
});

test('the batched records: segment, width, straight colour 0-1 with alpha, kind; circles and rings', () => {
    const { create, log, stride, kinds } = backend();
    const b = create();
    const uploads = () => log.filter(([name]) => name === 'bufferData');
    b.stroke(255, 0, 127.6, 510); b.strokeWeight(3);
    b.line(1, 2, 3, 4);
    b.line(5, 6, 7, 8, 'square');
    b.noStroke(); b.fill(0, 255, 0, 128); b.circle(50, 60, 10);
    b.stroke(0, 0, 255, 255); b.strokeWeight(1); b.noFill(); b.circle(20, 20, 8);
    b.flush();
    assert.equal(uploads().at(-1)[1], 4 * stride, 'four records');
    // The staging array (white-box) holds them in order.
    const records = b.primitives;
    const at = i => Array.from(records.subarray(i * stride, (i + 1) * stride)).map(v => Math.round(v * 1000) / 1000);
    assert.deepEqual(at(0), [1, 2, 3, 4, 3, 1, 0, 0.502, 1, kinds.PRIMITIVE_ROUND], 'CSS rounding of channels, alpha clamped to 1');
    assert.deepEqual(at(1).slice(-1), [kinds.PRIMITIVE_SQUARE]);
    assert.deepEqual(at(2), [50, 60, 50, 60, 10, 0, 1, 0, 0.502, kinds.PRIMITIVE_ROUND], 'a filled circle: a zero-length round line as wide as it');
    assert.deepEqual(at(3), [20, 20, 4, 0, 1, 0, 0, 1, 1, kinds.PRIMITIVE_RING], 'an outlined circle: a ring of its radius');
});

test('Canvas2D state rules: transparent or non-finite strokes draw nothing; a bad width keeps the previous one; noStroke / noFill', () => {
    const { create, stride } = backend();
    const b = create();
    b.stroke(255, 255, 255, 0); b.line(0, 0, 10, 10);
    assert.equal(b.pendingPrimitives, 0, 'alpha 0 draws nothing');
    b.stroke(255, 255, 255, 255);
    b.line(Number.NaN, 0, 10, 10); b.line(0, 0, Number.POSITIVE_INFINITY, 10);
    assert.equal(b.pendingPrimitives, 0, 'non-finite coordinates are ignored, as a 2D path ignores them');
    b.strokeWeight(4); b.strokeWeight(Number.NaN); b.line(0, 0, 1, 1);
    assert.equal(b.primitives[4], 4, 'NaN keeps the previous width');
    b.strokeWeight(-3); b.line(0, 0, 1, 1);
    assert.equal(b.primitives[stride + 4], Math.fround(0.0001), 'a non-positive width is the 2D backend\'s minimum');
    b.noStroke(); b.line(0, 0, 1, 1);
    assert.equal(b.pendingPrimitives, 2);
    b.noFill(); b.circle(5, 5, 4);
    assert.equal(b.pendingPrimitives, 2, 'no fill, no stroke: nothing');
});

test('background clears to the premultiplied colour; ring tints copy the frame and blend without fixed-function blending', () => {
    const { create, log } = backend();
    const b = create();
    log.length = 0;
    b.background(255, 0, 0, 51);
    const clear = log.find(([name]) => name === 'clearColor');
    assert.deepEqual(clear.slice(1).map(v => Math.round(v * 1000) / 1000), [0.2, 0, 0, 0.2], 'clearRect + fillRect of rgba(255,0,0,0.2)');
    log.length = 0;
    b.stroke(255, 255, 255, 255); b.line(0, 0, 10, 10);
    b.compositeRingTint(320, 180, 40, 90, [200, 100, 50], 0.4, 'saturation', 0.5, 2);
    const names = log.map(([name]) => name);
    const drawn = names.indexOf('drawArraysInstanced'), copied = names.indexOf('copyTexSubImage2D');
    assert.ok(drawn >= 0 && copied > drawn, 'the batch is drawn before the frame is copied');
    const disabled = names.lastIndexOf('disable'), ring = names.lastIndexOf('drawArrays'), enabled = names.lastIndexOf('enable');
    assert.ok(disabled < ring && ring < enabled, 'blending off for the blend pass, on again after');
    const sector = log.filter(([name, location]) => name === 'uniform2f' && location?.uniform === 'uSector').at(-1);
    assert.deepEqual(sector.slice(2).map(v => Math.round(v * 1000) / 1000), [0.5, 1.5], 'the wedge: start and sweep');
    const mode = log.filter(([name, location]) => name === 'uniform1i' && location?.uniform === 'uMode').at(-1);
    assert.equal(mode[2], 0, 'saturation');
    b.compositeRingTint(320, 180, 40, 90, [200, 100, 50], 0.4, 'soft-light');
    const full = log.filter(([name, location]) => name === 'uniform1f' && location?.uniform === 'uSectorOn').at(-1);
    assert.equal(full[2], 0, 'no angles: the whole ring');
});

test('field rasters: the Canvas path\'s exact 8-bit pixels, premultiplied on upload, blended like the composite modes', () => {
    const { create, log } = backend();
    const b = create();
    assert.equal(b.beginFieldRaster(0, 0, 4), null, 'malformed');
    assert.equal(b.beginFieldRaster(0, 641, 361), null, 'over the pixel cap');
    const layer = b.beginFieldRaster(1, 4, 2);
    assert.equal(layer.length, 32);
    layer.fill(0.5);
    log.length = 0;
    b.drawFieldRaster(1, 0, 0, 640, 360, 1, 'screen');
    const upload = log.find(([name]) => name === 'texImage2D');
    const { writeFieldRasterPixels } = createLoader()('visuals/CanvasFieldRasterSurface.ts');
    const expected = new Uint8ClampedArray(32); writeFieldRasterPixels(layer, 4, 2, 1, expected);
    assert.deepEqual(Array.from(upload.at(-1)), Array.from(expected), 'the same dithered bytes as the Canvas2D surface');
    assert.ok(log.some(([name, ...args]) => name === 'blendFuncSeparate' && args[0] === 'ONE' && args[1] === 'ONE_MINUS_SRC_COLOR'), 'screen: cs + cb - cs cb');
    log.length = 0;
    b.drawFieldRaster(1, 0, 0, 640, 360, 1, 'lighter');
    assert.ok(log.some(([name, ...args]) => name === 'blendFunc' && args[0] === 'ONE' && args[1] === 'ONE'), 'lighter: additive');
    assert.deepEqual(log.filter(([name]) => name === 'blendFuncSeparate').at(-1).slice(1), ['ONE', 'ONE_MINUS_SRC_ALPHA', 'ONE', 'ONE_MINUS_SRC_ALPHA'], 'source-over again after');
    const pixelStore = readFileSync('src/visuals/WebGLRendererBackend.ts', 'utf8');
    assert.match(pixelStore, /pixelStorei\(gl\.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true\)/);
});

test('without WebGL2 the backend refuses; the source then rasterizes with Canvas2D and says so', async () => {
    const { WebGLRendererBackend, surface } = backend({ webgl: false });
    assert.throws(() => new WebGLRendererBackend(64, 36, surface), /WebGL2 is unavailable/);
    const context = new Proxy({}, { get: (_, name) => (name === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : name === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}) });
    const load = createLoader({}, { fetch: async () => ({ ok: true, json: async () => ({}) }) });
    const { WormholeCanvasSource } = load('visuals/WormholeCanvasSource.ts');
    const noWebgl = (width, height) => ({ width, height, getContext: type => (type === '2d' ? context : null) });
    const fallback = new WormholeCanvasSource({ width: 64, height: 36, createSurface: noWebgl, webglRaster: true });
    assert.equal(fallback.rasterKind, 'canvas2d');
    fallback.dispose();
    const fake = fakeGl();
    const withWebgl = (width, height) => ({ width, height, getContext: type => (type === 'webgl2' ? fake.gl : type === '2d' ? context : null) });
    const webgl = new WormholeCanvasSource({ width: 64, height: 36, createSurface: withWebgl, webglRaster: true });
    assert.equal(webgl.rasterKind, 'webgl');
    await webgl.prepare(null);
    fake.log.length = 0;
    assert.equal(webgl.render(0.5, true), true);
    assert.ok(fake.log.some(([name]) => name === 'clearColor'), 'the identity drew through WebGL');
    assert.equal(fake.log.at(-1)[0], 'flush', 'the frame is finished (batch drawn, commands flushed) before it is handed on');
    webgl.dispose();
    const plain = new WormholeCanvasSource({ width: 64, height: 36, createSurface: withWebgl });
    assert.equal(plain.rasterKind, 'canvas2d', 'Canvas2D unless asked');
    plain.dispose();
});

test('the worker creates its source with the WebGL raster when asked and reports what runs; the proxy exposes it', async () => {
    const posted = [], sources = [];
    class Source { constructor(options) { this.options = options; this.rasterKind = options.webglRaster ? 'webgl' : 'canvas2d'; sources.push(this); } async prepare() {} dispose() {} }
    const scope = { postMessage: message => posted.push(message), close() {}, onmessage: null };
    createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: Source } }, { self: scope, OffscreenCanvas: class {}, performance })('visuals/wormholeRender.worker.ts');
    scope.onmessage({ data: { type: 'init', protocol: 1, width: 64, height: 36, depthCue: 0, webglRaster: true } });
    assert.equal(sources[0].options.webglRaster, true);
    scope.onmessage({ data: { type: 'prepare', generation: 1, analysis: null } });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual({ ...posted.at(-1) }, { type: 'prepared', generation: 1, raster: 'webgl' });
    scope.onmessage({ data: { type: 'init', protocol: 1, width: 64, height: 36, depthCue: 0 } });
    assert.equal(sources[1].options.webglRaster, false);

    const workers = [];
    class FakeWorker { constructor() { this.posted = []; workers.push(this); } postMessage(m) { this.posted.push(m); } terminate() {} reply(data) { this.onmessage?.({ data }); } }
    const document = { body: { appendChild() {} }, createElement: () => ({ width: 0, height: 0, dataset: {}, getContext: () => ({ transferFromImageBitmap() {} }) }) };
    const { WormholeWorkerSource } = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } }, { document })('visuals/WormholeWorkerSource.ts');
    const proxy = new WormholeWorkerSource({ width: 64, height: 36, webglRaster: true });
    assert.equal(workers[0].posted[0].webglRaster, true);
    assert.equal(proxy.rasterKind, null, 'unknown until prepared');
    const ready = proxy.prepare(null); workers[0].reply({ type: 'prepared', generation: 1, raster: 'canvas2d' }); await ready;
    assert.equal(proxy.rasterKind, 'canvas2d', 'a fallback is reported');
    const plain = new WormholeWorkerSource({ width: 64, height: 36 });
    assert.equal('webglRaster' in workers[1].posted[0], false, 'additive: absent means Canvas2D');
    proxy.dispose(); plain.dispose();
});
