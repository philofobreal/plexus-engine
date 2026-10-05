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
    scene.update([], 2, state, 'Paused'); const version = scene.noteField.mesh.geometry.getAttribute('aNoteBase').version, writes = scene.noteField.writes;
    for (let i = 0; i < 72; i++) scene.update([], 2, state, 'Paused');
    assert.equal(scene.noteField.mesh.geometry.getAttribute('aNoteBase').version, version);
    assert.equal(scene.noteField.writes, writes);
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

// ---------------------------------------------------------------- bounded instance uploads
const instanceLoad = (() => {
    const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }) };
    return createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
})();
// Targets move on the GPU: their instance data are event-scope attributes (aNote*), written once per
// changed drawn set; instance matrices are never uploaded.
const NOTE_ATTRIBUTES = ['aNoteBase', 'aNoteStyle'];
const uploadState = mesh => [mesh.instanceMatrix, ...NOTE_ATTRIBUTES.map(n => mesh.geometry.getAttribute(n))]
    .map(a => ({ version: a.version, ranges: a.updateRanges.map(r => ({ ...r })) }));
const settle = mesh => { for (const n of NOTE_ATTRIBUTES) mesh.geometry.getAttribute(n).clearUpdateRanges(); }; // what an upload does
const targetNote = (id, time, extra = {}) => ({ id, time, lane: 1, row: 1, hand: 'right', intensity: 1, sourceType: 1, cutDirection: 'down', ...extra });

test('note pools stream only the drawn prefix; empty batches and unchanged states upload nothing', () => {
    const { RhythmNoteField } = instanceLoad('xr/scene/RhythmNoteField.ts');
    const { DEFAULT_RHYTHM_GAME_CONFIG: config } = instanceLoad('gameplay/index.ts');
    const field = new RhythmNoteField(config), meshes = [field.mesh, field.markers, field.arrows];
    const capacity = config.maxActiveNotes;
    for (const mesh of meshes) for (const n of NOTE_ATTRIBUTES) {
        assert.equal(mesh.geometry.getAttribute(n).usage, THREE.DynamicDrawUsage);
        assert.equal(mesh.geometry.getAttribute(n).count, capacity, 'preallocated at full capacity');
    }
    const arrays = meshes.map(m => NOTE_ATTRIBUTES.map(n => m.geometry.getAttribute(n).array));
    const before = meshes.map(uploadState);
    for (let i = 0; i < 30; i++) field.update([], 1 + i / 60, config);
    assert.deepEqual(meshes.map(uploadState), before, 'no targets: no uploads at all');

    const notes = [1, 2, 3].map(i => ({ note: targetNote(`n${i}`, 3 + i * 0.2), status: 'pending', judgement: null }));
    field.update(notes, 2, config);
    assert.equal(field.mesh.count, 3); assert.equal(field.arrows.count, 3); assert.equal(field.markers.count, 0);
    assert.deepEqual(field.mesh.geometry.getAttribute('aNoteBase').updateRanges, [{ start: 0, count: 3 * 4 }]);
    assert.deepEqual(field.mesh.geometry.getAttribute('aNoteStyle').updateRanges, [{ start: 0, count: 3 * 4 }]);
    assert.deepEqual(field.arrows.geometry.getAttribute('aNoteBase').updateRanges, [{ start: 0, count: 3 * 4 }]);
    assert.deepEqual(uploadState(field.markers), before[1], 'unused glyph batch untouched');
    // A second write before the next render replaces the pending range instead of piling up.
    field.update(notes.slice(0, 2), 2.01, config);
    assert.deepEqual(field.mesh.geometry.getAttribute('aNoteBase').updateRanges, [{ start: 0, count: 2 * 4 }]);
    for (const mesh of meshes) settle(mesh);
    const drawn = meshes.map(uploadState);
    // The same targets travelling on: only the song-time uniform moves.
    for (let i = 1; i < 30; i++) field.update(notes.slice(0, 2), 2.01 + i / 72, config);
    assert.deepEqual(meshes.map(uploadState), drawn, 'travel re-uploads nothing');
    field.update([], 2.6, config);
    assert.deepEqual(meshes.map(uploadState), drawn, 'emptied batches are not re-sent');
    assert.ok(meshes.every((m, i) => NOTE_ATTRIBUTES.every((n, j) => m.geometry.getAttribute(n).array === arrays[i][j])), 'pools never reallocate');
    field.dispose();
});

// Slices move on the GPU: their instance data are event-scope attributes (aSlice*), written once per
// changed slice set; instance matrices are never uploaded.
const SLICE_ATTRIBUTES = ['aSliceOrigin', 'aSliceMotion', 'aSliceHand'];
const sliceUploadState = mesh => [mesh.instanceMatrix, ...SLICE_ATTRIBUTES.map(n => mesh.geometry.getAttribute(n))]
    .map(a => ({ version: a.version, ranges: a.updateRanges.map(r => ({ ...r })) }));
const settleSlices = mesh => { for (const n of SLICE_ATTRIBUTES) mesh.geometry.getAttribute(n).clearUpdateRanges(); };

test('slice pools upload only a changed set of live slices and nothing on the many frames without one', () => {
    const { XrSliceEffect, SLICE_EFFECT_SEC, SPARKS_PER_SLICE, MAX_SLICES } = instanceLoad('xr/scene/XrSliceEffect.ts');
    const { DEFAULT_RHYTHM_GAME_CONFIG: config } = instanceLoad('gameplay/index.ts');
    const effect = new XrSliceEffect(config.noteSizeMeters), meshes = [effect.halves, effect.sparks];
    for (const mesh of meshes) for (const n of SLICE_ATTRIBUTES) assert.equal(mesh.geometry.getAttribute(n).usage, THREE.DynamicDrawUsage);
    const capacities = meshes.map(m => m.geometry.getAttribute('aSliceOrigin').count);
    const idle = meshes.map(sliceUploadState);
    const pending = [{ note: targetNote('p', 9), status: 'pending', judgement: null }];
    for (let i = 0; i < 120; i++) effect.update(pending, 1 + i / 72, config);
    assert.deepEqual(meshes.map(sliceUploadState), idle, 'no slice: no upload');
    const hit = [{ note: targetNote('h', 5), status: 'hit', judgement: 'perfect', resolvedAt: 5 }];
    effect.update(hit, 5 + SLICE_EFFECT_SEC / 4, config);
    assert.deepEqual(effect.halves.geometry.getAttribute('aSliceOrigin').updateRanges, [{ start: 0, count: 2 * 4 }]);
    assert.deepEqual(effect.sparks.geometry.getAttribute('aSliceHand').updateRanges, [{ start: 0, count: SPARKS_PER_SLICE * 3 }]);
    for (const mesh of meshes) settleSlices(mesh);
    const live = meshes.map(sliceUploadState);
    // The slice keeps flying for many frames: only the song-time uniform moves.
    for (let i = 1; i < 15; i++) effect.update(hit, 5 + SLICE_EFFECT_SEC / 4 + i / 72, config);
    assert.deepEqual(meshes.map(sliceUploadState), live, 'a live slice re-uploads nothing per frame');
    effect.update(hit, 5 + SLICE_EFFECT_SEC + 0.01, config);
    assert.equal(effect.activeSlices, 0);
    assert.deepEqual(meshes.map(sliceUploadState), live, 'expired: nothing uploaded');
    assert.deepEqual(meshes.map(m => m.geometry.getAttribute('aSliceOrigin').count), capacities);
    assert.deepEqual(capacities, [MAX_SLICES * 2, MAX_SLICES * SPARKS_PER_SLICE]);
    effect.dispose();
});

test('a paused scene with targets and a live slice re-uploads no instance buffer', () => {
    const { RhythmGameScene } = instanceLoad('xr/scene/RhythmGameScene.ts');
    const scene = new RhythmGameScene(new THREE.Scene());
    const notes = [{ note: targetNote('a', 6), status: 'pending', judgement: null },
        { note: targetNote('b', 5, { cutDirection: 'any' }), status: 'hit', judgement: 'good', resolvedAt: 5 }];
    const snapshot = { state: 'paused', score: 10, combo: 1, maxCombo: 1, hitCount: 1, missCount: 0, totalNotes: 2 };
    scene.update(notes, 5.1, snapshot, 'Paused');
    const meshes = [scene.noteField.mesh, scene.noteField.markers, scene.noteField.arrows], slices = [scene.sliceEffect.halves, scene.sliceEffect.sparks];
    assert.ok(scene.sliceEffect.activeSlices === 1 && scene.noteField.mesh.count === 1);
    const versions = meshes.map(uploadState), sliceVersions = slices.map(sliceUploadState), time = scene.sliceEffect.uniforms.uSliceTime.value;
    for (let i = 0; i < 72; i++) scene.update(notes, 5.1, snapshot, 'Paused');
    assert.deepEqual(meshes.map(uploadState), versions);
    assert.deepEqual(slices.map(sliceUploadState), sliceVersions);
    assert.equal(scene.sliceEffect.uniforms.uSliceTime.value, time, 'paused: the slice image is frozen');
    scene.dispose();
});

// ---------------------------------------------------------------- per-frame state projection (Task 6)
test('the session snapshot is reused while unchanged and replaced, frozen, on every change', () => {
    const gameplay = instanceLoad('gameplay/index.ts');
    const config = gameplay.DEFAULT_RHYTHM_GAME_CONFIG;
    const chart = [targetNote('a', 2, { cutDirection: 'any' }), targetNote('b', 3, { cutDirection: 'any' })];
    const session = new gameplay.RhythmGameSession(config);
    session.loadChart(chart);
    const ready = session.getSnapshot();
    assert.equal(session.getSnapshot(), ready, 'same state, same object: no per-frame allocation');
    assert.ok(Object.isFrozen(ready));
    assert.throws(() => { 'use strict'; ready.score = 5; }, TypeError, 'consumers cannot mutate a shared snapshot');
    session.start();
    const playing = session.getSnapshot();
    assert.notEqual(playing, ready); assert.equal(playing.state, 'playing'); assert.equal(ready.state, 'ready', 'older snapshots stay as they were');
    for (let i = 0; i < 30; i++) { session.update(1 + i / 72); assert.equal(session.getSnapshot(), playing); }
    const hit = session.attemptStrike({ songTime: 2, hand: 'right', speed: 3, position: gameplay.notePosition(chart[0], 2, { x: 0, y: 0, z: 0 }, config) });
    assert.ok(hit, 'a real hit');
    const scored = session.getSnapshot();
    assert.notEqual(scored, playing);
    assert.deepEqual([scored.hitCount, scored.combo, scored.score > 0], [1, 1, true]);
    assert.equal(scored.sections, playing.sections, 'section results stay the live read-only array of the run');
    session.update(3 + config.missWindowSec + 0.01);
    const missed = session.getSnapshot();
    assert.notEqual(missed, scored); assert.equal(missed.missCount, 1); assert.equal(missed.combo, 0);
    session.seek(0.5);
    const sought = session.getSnapshot();
    assert.notEqual(sought, missed); assert.notEqual(sought.sections, missed.sections, 'a seek starts a new run');
    assert.deepEqual([sought.score, sought.hitCount, sought.missCount], [0, 0, 0]);
    session.pause(); assert.equal(session.getSnapshot().state, 'paused');
});

test('ring section arcs are re-projected only when a note resolves or a new run starts', () => {
    const gameplay = instanceLoad('gameplay/index.ts');
    const { XrProgressRing } = instanceLoad('xr/scene/XrProgressRing.ts');
    const { buildScoreOverview } = instanceLoad('xr/scene/XrScoreOverview.ts');
    const config = gameplay.DEFAULT_RHYTHM_GAME_CONFIG;
    const chart = [targetNote('a', 2, { cutDirection: 'any' }), targetNote('b', 12, { cutDirection: 'any' })];
    const session = new gameplay.RhythmGameSession(config);
    session.loadChart(chart, [{ start: 0, end: 10, label: 'intro', energy: 0.3 }, { start: 10, end: 20, label: 'drop', energy: 0.9 }]);
    session.start();
    const ring = new XrProgressRing();
    ring.setOverview(buildScoreOverview(session.getScoringPlan(), 20));
    const arcs = ring.uniforms.uSections.value;
    ring.update(1, session.getSnapshot());
    // A sentinel survives unchanged frames: the per-section projection is skipped.
    arcs[0].w = 99;
    for (let i = 0; i < 20; i++) ring.update(1 + i / 72, session.getSnapshot());
    assert.equal(arcs[0].w, 99);
    assert.equal(ring.uniforms.uProgress.value, (1 + 19 / 72) / 20, 'time-driven uniforms still follow every frame');
    // A hit completes the first section: the arcs are projected again.
    assert.ok(session.attemptStrike({ songTime: 2, hand: 'right', speed: 3, position: gameplay.notePosition(chart[0], 2, { x: 0, y: 0, z: 0 }, config) }));
    ring.update(2, session.getSnapshot());
    assert.notEqual(arcs[0].w, 99); assert.ok(arcs[0].w > 0, 'completed section shows its outcome');
    // A restart (new results array, same counts as a fresh run) re-projects too.
    arcs[0].w = 99;
    session.restart(); ring.update(0.1, session.getSnapshot());
    assert.equal(arcs[0].w, 0, 'pending again after restart');
    ring.dispose();
});

test('the song map caption key is numeric and redraws only on a caption change', () => {
    const gameplay = instanceLoad('gameplay/index.ts');
    const { XrSongMap } = instanceLoad('xr/scene/XrSongMap.ts');
    const { buildScoreOverview } = instanceLoad('xr/scene/XrScoreOverview.ts');
    const session = new gameplay.RhythmGameSession(gameplay.DEFAULT_RHYTHM_GAME_CONFIG);
    session.loadChart([targetNote('a', 2), targetNote('b', 12)], [{ start: 0, end: 10, label: 'intro', energy: 0.3 }, { start: 10, end: 20, label: 'drop', energy: 0.9 }]);
    session.start();
    const map = new XrSongMap();
    map.setOverview(buildScoreOverview(session.getScoringPlan(), 20));
    let draws = 0; map.drawCaption = () => { draws++; }; // count only (the caption raster is covered elsewhere)
    for (let i = 0; i < 72; i++) map.update(1 + i / 72, session.getSnapshot());
    assert.equal(draws, 1, 'one caption for the whole section');
    assert.equal(typeof map.lastKey, 'number');
    map.update(10.5, session.getSnapshot());
    assert.equal(draws, 2, 'the next section redraws once');
    map.dispose();
});
