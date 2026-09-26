import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

function harness(width = 3840, height = 2160) {
    const window = Object.assign(new EventTarget(), { devicePixelRatio: 2 });
    const document = Object.assign(new EventTarget(), { hidden: false });
    const container = { clientWidth: width, clientHeight: height,
        appendChild(el) { el.parentElement = this; }, removeChild(el) { el.parentElement = null; } };
    const session = { async end() { renderer.xr.isPresenting = false; renderer.xr.dispatchEvent({ type: 'sessionend' }); } };
    class Renderer {
        constructor(options) {
            this.options = options; this.domElement = {}; this.renders = 0;
            this.xr = Object.assign(new THREE.EventDispatcher(), {
                isPresenting: false, setReferenceSpaceType() {}, getSession() { return this.isPresenting ? session : null; },
                async setSession() { this.isPresenting = true; this.dispatchEvent({ type: 'sessionstart' }); }
            });
        }
        setPixelRatio(value) { this.ratio = value; }
        setSize(w, h) { this.width = w * this.ratio; this.height = h * this.ratio; }
        setAnimationLoop(callback) { this.callback = callback; }
        render() { this.renders++; }
        dispose() { this.disposed = true; }
        tick(time, frame) { this.callback?.(time, frame); }
    }
    const load = createLoader({ three: { ...THREE, WebGLRenderer: Renderer } }, { window, document, navigator: { xr: { requestSession: async () => session } } });
    const runtime = new (load('xr/runtime/XrRuntime.ts').XrRuntime)(container);
    const renderer = runtime.renderer;
    return { runtime, renderer, window, document, container, session };
}

test('empty/paused desktop submits one frame then stops, with coalesced invalidation and bounded 4K pixels', () => {
    const { runtime, renderer, window, container } = harness();
    assert.equal(renderer.options.antialias, false);
    assert.ok(renderer.width * renderer.height <= 1920 * 1080 + 1);
    for (let i = 0; i < 240; i++) renderer.tick(i * 1000 / 120);
    assert.equal(renderer.renders, 1); assert.equal(renderer.callback, null);
    runtime.invalidate(); runtime.invalidate(); renderer.tick(3000);
    assert.equal(renderer.renders, 2); assert.equal(renderer.callback, null);
    container.clientWidth = 800; container.clientHeight = 600;
    window.dispatchEvent(new Event('resize')); renderer.tick(4000);
    assert.equal(renderer.renders, 3); assert.equal(renderer.width, 1000);
    runtime.dispose(); runtime.invalidate(); window.dispatchEvent(new Event('resize'));
    assert.equal(renderer.callback, null); assert.ok(renderer.disposed);
});

test('desktop caps 120/144/240Hz playback near 60fps, freezes hidden tabs, and wakes after pause/visibility', () => {
    for (const hz of [120, 144, 240]) {
        const { runtime, renderer, document } = harness();
        runtime.setPlaying(true);
        for (let i = 0; i < hz * 2; i++) renderer.tick(i * 1000 / hz);
        assert.ok(renderer.renders <= 121 && renderer.renders >= 119, `${hz}: ${renderer.renders}`);
        document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
        const before = renderer.renders;
        renderer.tick(3000); assert.equal(renderer.renders, before); assert.equal(renderer.callback, null);
        document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); renderer.tick(4000);
        assert.equal(renderer.renders, before + 1);
        runtime.setPlaying(false); renderer.tick(5000); renderer.tick(6000);
        assert.equal(renderer.renders, before + 2); assert.equal(renderer.callback, null);
        runtime.setPlaying(true); renderer.tick(7000); assert.equal(renderer.renders, before + 3);
        runtime.dispose();
    }
});

test('paused immersive mode keeps every headset frame; exit returns to on-demand desktop; failed entry recovers', async () => {
    const { runtime, renderer, session } = harness();
    renderer.tick(0); await runtime.requestImmersiveSession();
    runtime.setPlaying(false);
    for (let i = 0; i < 144; i++) renderer.tick(i * 1000 / 72, {});
    assert.equal(renderer.renders, 145); assert.ok(renderer.callback);
    renderer.tick(2500); assert.equal(renderer.renders, 145); // no duplicate desktop frame in XR
    await session.end(); renderer.tick(3000); assert.equal(renderer.callback, null);
    renderer.xr.setSession = async () => { throw new Error('session setup failed'); };
    await assert.rejects(runtime.requestImmersiveSession(), /session setup failed/);
    renderer.tick(4000); assert.equal(renderer.callback, null);
    runtime.dispose();
});

test('transport binding wakes renderer after play, seek, pause and natural end, and removes listeners', () => {
    const { runtime, renderer } = harness();
    const load = createLoader();
    const { RhythmGameSession } = load('gameplay/index.ts');
    const { XrPlaybackBinding } = load('xr/XrPlaybackBinding.ts');
    const game = new RhythmGameSession();
    game.loadChart([{ id: 'n', time: 5, lane: 0, row: 1, hand: 'left', strength: 1, source: 'event' }]);
    let event, ended;
    const binding = new XrPlaybackBinding({ addPlaybackStateListener(fn) { event = fn; return () => event = null; },
        addPlaybackEndedListener(fn) { ended = fn; return () => ended = null; } }, game, () => {}, () => runtime.setPlaying(game.getState() === 'playing'));
    renderer.tick(0); event('play', 0); renderer.tick(100); assert.ok(renderer.callback);
    event('pause', 0.1); renderer.tick(200); assert.equal(renderer.callback, null);
    event('seek', 3); renderer.tick(300); assert.equal(renderer.callback, null);
    event('play', 3); renderer.tick(400); assert.ok(renderer.callback);
    event('stop', 0); ended(); renderer.tick(500); assert.equal(renderer.callback, null);
    assert.equal(game.getState(), 'finished'); binding.dispose(); assert.equal(event, null); assert.equal(ended, null);
    runtime.dispose();
});

test('stationary notes do not upload buffers; Wormhole allocates lazily, uploads changed frames only, and skips all off-state work', async () => {
    const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }) };
    const load = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
    let allocations = 0, draws = 0, prepared = 0, disposed = false, lastTime = null;
    const scene = new (load('xr/scene/RhythmGameScene.ts').RhythmGameScene)(new THREE.Scene(), undefined, () => {
        allocations++;
        return { canvas: {}, async prepare() { prepared++; }, render(time) { draws++; const changed = time !== lastTime; lastTime = time; return changed; }, dispose() { disposed = true; } };
    });
    const state = { state: 'paused', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 };
    scene.update([], 2, state, 'Paused'); const version = scene.noteField.mesh.instanceMatrix.version;
    for (let i = 0; i < 72; i++) scene.update([], 2, state, 'Paused');
    assert.equal(scene.noteField.mesh.instanceMatrix.version, version);
    const children = scene.root.children.length;
    await scene.setWormholeEnabled(false); assert.equal(allocations, 0);
    await scene.setWormholeEnabled(true); const wormhole = scene.root.children.at(-1);
    assert.equal(allocations, 1); assert.equal(prepared, 1);
    scene.update([], 2.1, state, 'Paused'); const textureVersion = wormhole.material.map.version;
    scene.update([], 2.1, state, 'Paused'); assert.equal(wormhole.material.map.version, textureVersion);
    await scene.setWormholeEnabled(false); const before = draws;
    scene.update([], 3, state, 'Paused'); assert.equal(draws, before); assert.equal(wormhole.visible, false);
    await scene.setWormholeAnalysis(null); assert.equal(prepared, 1);
    await scene.setWormholeEnabled(true); assert.equal(prepared, 2); assert.equal(scene.root.children.length, children + 1);
    scene.dispose(); assert.ok(disposed);
});
