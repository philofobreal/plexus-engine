import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

function createSourceLoader() {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module);
    const require = request => {
      const base = normalize(join(dirname(path), request));
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, {
      module, exports: module.exports, require, Math, Number, Array, Object, Map, Set,
      Uint16Array, Float64Array, Uint8Array
    });
    return module.exports;
  }
  return relative => load(join(SRC_ROOT, relative));
}

function frame() {
  return {
    e: 0.5, eRatio: 0.6, densityProj: 0.45, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0.35), state: 'HIGH'
  };
}

function setupState(State, featureFlags) {
  featureFlags.wormholeSkybox = false;
  State.sampleRate = 48000;
  State.hopSize = 1024;
  State.frames = Array.from({ length: 400 }, frame);
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = frame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.45, brightness: 0.5, tension: 0.4 };
  State.currentTime = 4;
  State.isPlaying = true;
  State.isExporting = false;
  State.exportTime = 0;
  State.playbackFade = 1;
  Object.assign(State.visualTuning, {
    wormholeOpticsEnabled: 1,
    performanceMode: 0,
    chromaKeyMode: 0,
    lineAlpha: 1,
    lineWeight: 1,
    wormholeDepth: 1.2,
    wormholeSpeed: 2,
    wormholeCurve: 0,
    wormholePathBend: 0,
    wormholePathBendVertical: 0,
    wormholeRing: 0,
    wormholeDepthCoherence: 0,
    wormholeJitter: 0,
    wormholeSkybox: 0,
    wormholeStarfield: 0,
    wormholeGalaxy: 0,
    wormholeWall: 0,
    wormholeWallWaves: 0,
    wormholeLens: 0.75,
    wormholeLensRadius: 0.5,
    wormholeLensSwirl: 0.35
  });
}

function makeBackend() {
  return {
    width: 960, height: 540, frameCount: 1, circles: [], currentFill: null,
    background() {}, noStroke() {}, noFill() {},
    fill(...args) { this.currentFill = JSON.parse(JSON.stringify(args)); },
    stroke() {}, strokeWeight() {}, line() {},
    circle(...args) { this.circles.push([...JSON.parse(JSON.stringify(args)), this.currentFill]); },
    triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}, radialDim() {},
    compositeRingTint() {}
  };
}

function createHarness() {
  const load = createSourceLoader();
  const module = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  return { ...module, State, featureFlags };
}

function drawAt(harness, identity, timeSec = 4) {
  harness.State.currentTime = timeSec;
  identity.pool.length = 0;
  const backend = makeBackend();
  identity.draw(backend, [], []);
  return backend.circles;
}

test('F6 allocates a fixed 800-point deep-field pool without changing global star/sky budgets', () => {
  const harness = createHarness();
  const identity = new harness.CosmicWormholeIdentity();
  assert.equal(harness.WORMHOLE_DEEP_FIELD_POINT_COUNT, 800);
  assert.equal(identity.deepFieldPool.length, 800);
  assert.equal(identity.starPool.length, 1800);
  assert.equal(identity.skyPool.length, 9000);
  const pool = identity.deepFieldPool;
  drawAt(harness, identity);
  assert.equal(identity.deepFieldPool, pool, 'draw must reuse the constructor-owned pool');
  assert.equal(identity.deepFieldPool.length, 800);
});

test('F6 draws only with an active opted-in lens and enforces the source-beta squared-distance gate', () => {
  const harness = createHarness();
  const active = new harness.CosmicWormholeIdentity();
  assert.equal(drawAt(harness, active).length, harness.WORMHOLE_DEEP_FIELD_POINT_COUNT);

  harness.State.visualTuning.wormholeLens = 0;
  assert.equal(drawAt(harness, new harness.CosmicWormholeIdentity()).length, 0);
  harness.State.visualTuning.wormholeLens = 0.75;
  harness.State.visualTuning.wormholeOpticsEnabled = 0;
  assert.equal(drawAt(harness, new harness.CosmicWormholeIdentity()).length, 0);

  harness.State.visualTuning.wormholeOpticsEnabled = 1;
  const outOfZone = new harness.CosmicWormholeIdentity();
  outOfZone.deepFieldPool[0].betaRatio = 2.51;
  assert.equal(
    drawAt(harness, outOfZone).length,
    harness.WORMHOLE_DEEP_FIELD_POINT_COUNT - 1,
    'a source beyond 2.5 thetaE must be rejected before drawing'
  );
});

test('F6 performance mode uses the fixed half-pool budget', () => {
  const harness = createHarness();
  harness.State.visualTuning.performanceMode = 1;
  const circles = drawAt(harness, new harness.CosmicWormholeIdentity());
  assert.equal(harness.WORMHOLE_DEEP_FIELD_PERFORMANCE_STRIDE, 2);
  assert.equal(circles.length, harness.WORMHOLE_DEEP_FIELD_POINT_COUNT / 2);
});

test('F6 output is deterministic for identical canonical state and after seek resynchronization', () => {
  const freshHarness = createHarness();
  const expectedIdentity = new freshHarness.CosmicWormholeIdentity();
  expectedIdentity.syncPosition(4);
  const expected = drawAt(freshHarness, expectedIdentity, 4);

  const historyHarness = createHarness();
  const historyIdentity = new historyHarness.CosmicWormholeIdentity();
  historyIdentity.syncPosition(1);
  drawAt(historyHarness, historyIdentity, 1);
  drawAt(historyHarness, historyIdentity, 9);
  historyIdentity.syncPosition(4);
  const afterSeek = drawAt(historyHarness, historyIdentity, 4);

  assert.deepEqual(afterSeek, expected);
});
