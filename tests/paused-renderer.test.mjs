import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function createHarness() {
  let p;
  let time = 0;
  let draws = 0;
  let updates = 0;
  let position;
  const cache = new Map();
  const preference = { compactMaterialPreview: false, pixelRatioCap: 2, maxBackingLongEdge: 1920 };
  const boost = {};
  class FakeP5 {
    constructor(sketch) {
      p = this;
      this.windowWidth = this.width = 1280;
      this.windowHeight = this.height = 720;
      this.frameCount = 0;
      this.density = 2;
      sketch(this);
      this.setup();
    }
    createCanvas(w, h) { this.width = w; this.height = h; return { parent() {}, elt: {} }; }
    createGraphics(width, height) { return { width, height, pixelDensity: () => this.density }; }
    pixelDensity(value) { if (value !== undefined) this.density = value; return this.density; }
    resizeCanvas(w, h) { this.width = w; this.height = h; }
    frameRate() {}
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, {
      exports, window: { devicePixelRatio: 2 },
      require(id) {
        if (id === 'p5') return FakeP5;
        if (id === './Particle') return { Particle: class {} };
        const base = resolve(dirname(file), id);
        return load(existsSync(base) && base.endsWith('.ts') ? base : existsSync(base + '.ts') ? base + '.ts' : resolve(base, 'index.ts'));
      }
    });
    return exports;
  }
  const { State } = load(resolve('src/state/store.ts'));
  const { startPlexusRenderer } = load(resolve('src/visuals/PlexusRenderer.ts'));
  const identity = { draw() { draws++; }, syncPosition() {} };
  startPlexusRenderer('preview', {
    setExportTarget() {}, updateDashboard() { updates++; },
    getTuningForMorph(target) { Object.assign(boost, target, overrides); return boost; }
  }, {
    getCurrentTime: () => time,
    addPositionChangedListener(listener) { position = listener; },
    addPlaybackEndedListener() {}, syncMetronomeState() {}
  }, { get: () => identity, forEach: fn => fn(identity) }, undefined, { previewQuality: preference });
  const overrides = {};
  return {
    State, p, preference, overrides,
    get draws() { return draws; }, get updates() { return updates; },
    tick(count = 1) { for (let i = 0; i < count; i++) { p.frameCount++; p.draw(); } },
    seek(value) { time = value; position(value); },
    advance(value) { time += value; }
  };
}

test('unchanged welcome and paused previews do not redraw identities or dashboard canvases', () => {
  const h = createHarness();
  h.tick(600);
  assert.equal(h.draws, 1);
  assert.equal(h.updates, 1);
  h.State.duration = 8;
  h.tick(1);
  const draws = h.draws, updates = h.updates;
  h.tick(600);
  assert.equal(h.draws, draws);
  assert.equal(h.updates, updates);
});

test('pause settles once, resume and every export frame bypass the idle gate', () => {
  const h = createHarness();
  h.State.duration = 8;
  h.State.isPlaying = true;
  h.tick(60);
  assert.equal(h.draws, 60);
  h.State.isPlaying = false;
  h.tick(90);
  assert.equal(h.State.playbackFade, 0);
  const settled = h.draws;
  h.tick(600);
  assert.equal(h.draws, settled);
  h.State.isPlaying = true;
  h.tick(1);
  assert.equal(h.draws, settled + 1);
  h.State.isPlaying = false;
  h.State.playbackFade = 0;
  h.State.isExporting = true;
  for (let i = 0; i < 5; i++) { h.State.exportTime = i / 60; h.tick(); }
  assert.equal(h.draws, settled + 6);
});

test('in-place tuning, reused MVP boost results, seek, mode, quality and resize invalidate paused pixels', () => {
  const h = createHarness();
  h.tick(3);
  const actions = [
    () => { h.State.visualTuning.lineWeight += 1; },
    () => { h.State.targetTuning.wormholeGrainShape = 1; },
    () => { h.overrides.wormholeGrainShape = 0; },
    () => { h.seek(0); }, // Explicit same-position reset must also refresh.
    () => { h.seek(4); },
    () => { h.State.visualMode = 'classic'; },
    () => { h.preference.pixelRatioCap = 1.25; h.preference.maxBackingLongEdge = 1280; h.preference.compactMaterialPreview = true; },
    () => { h.p.windowWidth = 1600; h.p.windowResized(); },
    () => { h.State.trackAnalysis = { ...h.State.trackAnalysis }; }
  ];
  for (const action of actions) {
    const before = h.draws;
    action();
    h.tick(3);
    assert.ok(h.draws > before, 'changed input must refresh paused preview');
    const after = h.draws;
    h.tick(120);
    assert.equal(h.draws, after, 'changed input must settle back to zero repeated draws');
  }
});
