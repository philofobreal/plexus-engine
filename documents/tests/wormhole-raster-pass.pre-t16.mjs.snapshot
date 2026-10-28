import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function harness({ fail = false } = {}) {
    const attempts = [], draws = [], presented = []; let invalidations = 0;
    class Target {
        width = 320; height = 180; frameCount = 17; rasterPixelRatio = 2; compactMaterialPreview = false;
        presentRaster(canvas) { presented.push(canvas); }
    }
    class Gpu {
        contextLost = false; disposed = 0; finished = 0;
        constructor(w, h, create) { attempts.push(this); if (fail) throw Error('No GPU'); this.canvas = create(w, h); }
        setSize(w, h, ratio) { this.width = w; this.height = h; this.ratio = ratio; }
        finish() { this.finished++; } dispose() { this.disposed++; }
    }
    const load = createLoader({ './P5RendererBackend': { P5RendererBackend: Target }, './WebGLRendererBackend': { WebGLRendererBackend: Gpu } });
    const { WormholeRasterPass } = load('visuals/WormholeRasterPass.ts');
    const listeners = new Map(), create = (width, height) => ({ width, height, getContext: () => null,
        addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) });
    const pass = new WormholeRasterPass(() => invalidations++, create), target = new Target();
    const context = { timeSec: 7.25, advanceSharedSimulation: true };
    const identity = { id: 'cosmic-wormhole', draw(backend, particles, shocks, received) { draws.push({ backend, particles, shocks, context: received }); } };
    const particles = [], shocks = [];
    const draw = (mode = 'webgl', transparent = false, who = identity, destination = target) =>
        pass.draw(who, destination, particles, shocks, context, mode, transparent);
    return { pass, target, context, identity, draws, presented, attempts, listeners, draw, get invalidations() { return invalidations; } };
}

test('GPU presentation draws the existing identity once with unchanged clock, pools and context; resources are reused', () => {
    const h = harness(); h.draw();
    assert.equal(h.attempts.length, 1); const gpu = h.attempts[0];
    assert.equal(h.draws.length, 1); assert.equal(h.draws[0].context, h.context);
    assert.equal(h.draws[0].backend, gpu); assert.equal(h.presented[0], gpu.canvas);
    assert.equal(gpu.frameCount, 17); assert.equal(gpu.ratio, 2); assert.equal(gpu.width, 320);
    assert.equal(gpu.compactMaterialPreview, false); assert.equal(gpu.finished, 1);
    h.target.width = 640; h.target.rasterPixelRatio = 1.25; h.target.compactMaterialPreview = true; h.draw('webgl', true);
    assert.equal(h.attempts.length, 1); assert.equal(gpu.width, 640); assert.equal(gpu.ratio, 1.25);
    assert.equal(gpu.compactMaterialPreview, true); assert.equal(gpu.transparentBackground, true);
    h.pass.dispose(); h.pass.dispose(); assert.equal(gpu.disposed, 1); assert.equal(h.listeners.size, 0);
    h.draw(); assert.equal(h.draws.length, 2, 'disposed pass cannot draw');
});

test('Compatible and other identities use the existing target without allocating a GPU context', () => {
    const h = harness(); h.draw('compatible'); h.draw('webgl', false, { ...h.identity, id: 'classic' });
    assert.equal(h.attempts.length, 0); assert.equal(h.draws.length, 2);
    assert.ok(h.draws.every(d => d.backend === h.target)); assert.equal(h.presented.length, 0);
});

test('unavailable WebGL falls back once, never retries per frame, and explicit Compatible enables a later retry', () => {
    const h = harness({ fail: true }); for (let i = 0; i < 100; i++) h.draw();
    assert.equal(h.attempts.length, 1); assert.equal(h.draws.length, 100); assert.equal(h.pass.rasterKind, 'fallback');
    assert.ok(h.draws.every(d => d.backend === h.target));
    h.draw('compatible'); h.draw(); assert.equal(h.attempts.length, 2);
});

test('context loss invalidates a paused preview and falls back without redrawing/simulating the frame twice', () => {
    const h = harness(); h.draw(); const gpu = h.attempts[0];
    let prevented = false; h.listeners.get('webglcontextlost')({ preventDefault() { prevented = true; } });
    h.draw(); assert.equal(h.invalidations, 1); assert.equal(prevented, true);
    assert.equal(h.draws.length, 2); assert.equal(h.draws[1].backend, h.target);
    assert.equal(gpu.disposed, 1); assert.equal(h.pass.rasterKind, 'fallback');
    h.draw('compatible'); h.draw(); assert.equal(h.attempts.length, 2); assert.equal(h.pass.rasterKind, 'webgl');
});

test('the transition controller presents each participant once and leaves shared simulation with one owner', () => {
    const load = createLoader(), { State } = load('state/store.ts');
    const { IdentityTransitionController } = load('visuals/IdentityTransitionController.ts');
    const incoming = { id: 'cosmic-wormhole' }, outgoing = { id: 'classic', usesSharedSimulation: true };
    State.visualMode = incoming.id; State.visualModeTransition = { from: outgoing.id, to: incoming.id,
        startTimeSec: 2, durationSec: 2, generation: 1 };
    const calls = [], weights = [];
    const targets = { incomingBackend: { name: 'incoming' }, outgoingBackend: { name: 'outgoing' }, beginFrame() {}, composite: a => weights.push(a) };
    new IdentityTransitionController().draw(3, {}, targets, { get: id => id === incoming.id ? incoming : outgoing }, [], [],
        (identity, backend, _particles, _shocks, context) => calls.push({ id: identity.id, backend, ...context }));
    assert.equal(calls.length, 2); assert.equal(calls[0].id, 'classic');
    assert.equal(calls[0].advanceSharedSimulation, true); assert.equal(calls[1].advanceSharedSimulation, false);
    assert.ok(calls.every(c => c.timeSec === 3)); assert.deepEqual(weights, [.5]);
});

test('real p5 presentation clears and copies to live/export targets in backing pixels, preserving context state', () => {
    const load = createLoader({ p5: {} }), { P5RendererBackend } = load('visuals/P5RendererBackend.ts');
    const make = (w, h, density) => { const log = [], ctx = { canvas: { width: w * density, height: h * density },
        save: () => log.push('save'), restore: () => log.push('restore'), setTransform: (...a) => log.push(['transform', ...a]),
        clearRect: (...a) => log.push(['clear', ...a]), drawImage: (...a) => log.push(['image', ...a]) };
    return { width: w, height: h, pixelDensity: () => density, drawingContext: ctx, log }; };
    const p = make(320, 180, 2), backend = new P5RendererBackend(p), canvas = {};
    backend.presentRaster(canvas); assert.equal(backend.rasterPixelRatio, 2);
    assert.deepEqual(p.log.at(-2), ['image', canvas, 0, 0, 640, 360]); assert.equal(p.log.at(-1), 'restore');
    assert.equal(p.drawingContext.globalCompositeOperation, 'source-over');
    const exported = p.__plexusExportTarget = make(1920, 1080, 1);
    backend.presentRaster(canvas); assert.equal(backend.width, 1920); assert.equal(backend.rasterPixelRatio, 1);
    assert.deepEqual(exported.log.at(-2), ['image', canvas, 0, 0, 1920, 1080]);
    assert.equal(p.log.filter(x => Array.isArray(x) && x[0] === 'image').length, 1, 'export cannot write to live canvas');
});

test('preview renderer setting is normalized, independent of quality and defaults to Compatible', () => {
    const { PreviewQualityPreference } = createLoader()('config/previewQuality.ts');
    const p = new PreviewQualityPreference(false, 'reduced', 'webgl');
    assert.equal(p.wormholeRenderer, 'webgl'); p.setMode('auto'); assert.equal(p.wormholeRenderer, 'webgl');
    p.setRendererMode('bad'); assert.equal(p.wormholeRenderer, 'compatible');
    assert.equal(new PreviewQualityPreference(false).wormholeRenderer, 'compatible');
});

test('preview menu saves and copies the device renderer selection without mutating artwork', async () => {
    class Element {
        children = []; listeners = {}; value = ''; textContent = '';
        style = {};
        select() {} remove() {}
        append(...nodes) { this.children.push(...nodes); }
        setAttribute(key, value) { this[key] = value; }
        addEventListener(type, fn) { this.listeners[type] = fn; }
    }
    const saved = new Map(), copied = [];
    const load = createLoader({ './previewQualityControl.css': {} }, { document: { createElement: () => new Element() },
        window: { localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } },
        navigator: { clipboard: { writeText: async text => copied.push(JSON.parse(text)) } } });
    const { createPreviewQualityControl } = load('ui/PreviewQualityControl.ts');
    const control = createPreviewQualityControl(false), select = control.root.children[2].children[0], copy = control.root.children[4];
    select.value = 'webgl'; select.listeners.change(); await copy.listeners.click();
    assert.equal(saved.get('plexus.wormholeRenderer'), 'webgl');
    assert.equal(copied[0].wormholeRenderer, 'webgl'); assert.equal(copied[0].previewQuality, 'auto');
    assert.equal(createPreviewQualityControl(false).preference.wormholeRenderer, 'webgl', 'reload');
});

test('preview Copy supports the synchronous browser fallback without async clipboard permissions', async () => {
    const nodes = [], copied = [];
    const make = () => { const element = { style: {}, children: [], listeners: {}, value: '', append(...a) { this.children.push(...a); },
        setAttribute() {}, addEventListener(k, fn) { this.listeners[k] = fn; }, select() {}, remove() {} };nodes.push(element);return element; };
    const load = createLoader({ './previewQualityControl.css': {} }, { document: { createElement: make,
        body: { appendChild(area) { copied.push(area); } }, execCommand: () => true },
        window: { localStorage: { getItem: () => 'webgl' } }, navigator: {} });
    const { createPreviewQualityControl } = load('ui/PreviewQualityControl.ts');
    const control = createPreviewQualityControl(false);await control.root.children[4].listeners.click();
    assert.equal(JSON.parse(copied[0].value).wormholeRenderer, 'webgl');
    assert.equal(control.root.children[4].textContent, 'Copied preview settings');
});
