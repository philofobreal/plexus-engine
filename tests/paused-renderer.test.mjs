import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function createHarness(applyAutomatedSpiral, createWormholeWorker, gain) {
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
    createCanvas(w, h) { this.width = w; this.height = h; this.canvas={dataset:{}}; return { parent() {}, elt: this.canvas }; }
    remove() {}
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
  const identity = { id: createWormholeWorker ? 'cosmic-wormhole' : 'test', draw() { draws++; }, syncPosition() {} };
  startPlexusRenderer('preview', {
    setExportTarget() {}, updateDashboard() { updates++; },
    applyAutomatedSpiral,
    getTuningForMorph(target) { Object.assign(boost, target, overrides); gain?.(boost, target); return boost; }
  }, {
    getCurrentTime: () => time,
    addPositionChangedListener(listener) { position = listener; },
    addPlaybackEndedListener() {}, syncMetronomeState() {}
  }, { get: () => identity, forEach: fn => fn(identity) }, undefined, { previewQuality: preference, createWormholeWorker });
  const overrides = {};
  return {
    State, p, preference, overrides, flags: load(resolve('src/config/featureFlags.ts')).featureFlags,
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

test('actual MVP/dashboard renderer follows semantic time once with aliased gains, pause and plan removal',()=>{
 const h=createHarness(undefined,undefined,(out,target)=>{out.wormholeSpeed=target.wormholeSpeed*2;});
 h.State.visualMode='cosmic-wormhole';h.State.duration=8;
 const base={...h.State.targetTuning,wormholeSpeed:.35,transitionSpeed:0};
 h.State.targetTuning={...base};h.State.semanticBaseTuning={...base};h.State.visualTuning={...base,wormholeSpeed:.7};
 const f=(time,progress)=>({time,motifId:'a',actions:{accelerate:progress},activeOperators:[],motifIntensity:0,motifDensity:0,motifMotion:0,novelty:0,
  transition:{behavior:'morph',progress,preserve:[],fromMotif:'void-minimal',toMotif:'tunnel-drive'}});
 const plan={version:1,frames:[f(2,0),f(3,.5),f(3.999999,1)],score:{version:1,motifs:[],transitions:[{fromMotifId:'a',toMotifId:'b',startTime:2,duration:2,behavior:'morph',curve:'linear',preserve:[]}]}};
 h.State.visualChoreography=plan;h.seek(2.5);h.tick();
 assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.2)<1e-10,'base.7 + gained semantic1.5 exactly once');
 const canonical=h.State.currentChoreography,token=h.State.activeVisualTransitionId;
 h.seek(2.75);h.tick();assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.95)<1e-10);
 assert.equal(h.State.currentChoreography,canonical);assert.equal(h.State.activeVisualTransitionId,token);
 h.tick(120);assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.95)<1e-10);
 h.seek(2.5);h.tick();assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.2)<1e-10);
 h.State.visualChoreography=null;h.tick();assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-.7)<1e-10);
 assert.equal(h.State.targetTuning.wormholeSpeed,.35);
 h.State.visualChoreography=plan;h.tick();h.flags.semanticResolver=false;h.tick();
 assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-.7)<1e-10);assert.equal(h.State.targetTuning.wormholeSpeed,.35);
});

test('the host spiral channel runs once after tuning with the canonical live/export time, including seeks', () => {
  const calls = [];
  const anchor = { id: 'automation:p', time: 2 };
  const h = createHarness((time, tuning) => { calls.push(time); tuning.wormholeSpiralDirection = -.5; return anchor; });
  h.State.isPlaying = true;
  h.seek(2.5); h.tick();
  assert.equal(calls.at(-1), 2.5); assert.equal(h.State.visualTuning.wormholeSpiralDirection, -.5);
  assert.equal(h.State.spiralTransitionAnchor, anchor);
  h.State.isExporting = true; h.State.exportTime = 7.25; h.tick();
  assert.equal(calls.at(-1), 7.25, 'the export clock is used even though live transport is elsewhere');
  h.State.isExporting = false; h.seek(.1); h.tick();
  assert.equal(calls.at(-1), .1); assert.equal(calls.length, h.draws, 'one application per identity frame');
});

test('low-frequency frame publication agrees across playback, seek and export without mutating analysis', () => {
  const h = createHarness();
  h.State.duration = 4; h.State.sampleRate = 1024; h.State.hopSize = 1024;
  h.State.frames = Array.from({ length: 4 }, (_, i) => Object.freeze({ e: 0.3, eRatio: 0.3,
    densityProj: 0, melodyProj: 0, fxProj: 0, perceptualSpectrum: new Array(24).fill(0), state: 'LOW',
    subEnergy: i * 0.2, bassEnergy: i * 0.1, subFlux: i * 0.05, bassFlux: i * 0.08 }));
  h.State.trackAnalysis.features = Array.from({ length: 4 }, () => ({ melody: 0, vocal: 0, fx: 0, density: 0, brightness: 0, tension: 0 }));
  h.State.visualTuning.audioSensitivity = h.State.targetTuning.audioSensitivity = 1;
  const keys = ['subEnergy','bassEnergy','subFlux','bassFlux'];
  const values = () => keys.map(k => h.State.modulation[k]);
  h.State.isPlaying = true; h.seek(2); h.tick();
  const live = values(); assert.deepEqual(live, keys.map(k => h.State.frames[2][k]));
  h.seek(0); h.tick(); assert.ok(values().every(v => v === 0));
  h.seek(2); h.tick(); assert.deepEqual(values(), live);
  h.State.isPlaying = false; h.State.isExporting = true; h.State.exportTime = 2; h.tick();
  assert.deepEqual(values(), live);
  assert.equal(h.State.frames[2].subEnergy, 0.4);
  h.State.frames[1] = { e: 0, eRatio: 0, densityProj: 0, melodyProj: 0, fxProj: 0, perceptualSpectrum: new Array(24).fill(0), state: 'LOW' };
  h.State.exportTime = 1; h.tick(); assert.ok(values().every(v => v === 0));
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


test('real renderer factory uses worker preview, invalidates paused frames, resets on seek and bypasses async frames for export', () => {
  const sources=[];let invalidation;
  const h=createHarness(undefined, invalidate=>{
    invalidation=invalidate;const source={draws:0,resets:0,disposed:0,rasterKind:'offscreen-webgl',
      draw(state,target,depth,transparent,playing){this.draws++;this.time=state.currentTime;return true;},
      reset(){this.resets++;},dispose(){this.disposed++;}};sources.push(source);return source;
  });
  h.preference.wormholeRenderer='offscreen';h.tick();
  assert.equal(sources.length,1);assert.equal(sources[0].draws,1);assert.equal(h.draws,0);
  h.tick(30);assert.equal(sources[0].draws,1);
  invalidation();h.tick();assert.equal(sources[0].draws,2);
  h.seek(4);h.tick();assert.equal(sources[0].resets,1);assert.equal(sources[0].time,4);
  h.State.isExporting=true;h.State.exportTime=7.25;h.tick();
  assert.equal(h.draws,1);assert.equal(sources[0].draws,3);assert.equal(sources[0].disposed,1);
  assert.equal(h.p.canvas.dataset.wormholeRaster,'compatible');
  h.State.isExporting=false;h.tick();assert.equal(sources.length,2);
  h.preference.wormholeRenderer='compatible';h.tick();assert.equal(sources[1].disposed,1);
  h.preference.wormholeRenderer='offscreen';h.tick();assert.equal(sources.length,3);
  h.p.remove();assert.equal(sources[2].disposed,1);
});
