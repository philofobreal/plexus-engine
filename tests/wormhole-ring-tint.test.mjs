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

function spectrumFrame() {
  return {
    e: 0.65,
    eRatio: 0.8,
    densityProj: 0.55,
    melodyProj: 0.2,
    fxProj: 0.15,
    perceptualSpectrum: Array.from({ length: 24 }, (_, index) => [0.2, 0.6, 1][index % 3]),
    state: 'HIGH'
  };
}

function setupState(State, featureFlags) {
  featureFlags.wormholeSkybox = false;
  State.sampleRate = 48000;
  State.hopSize = 1024;
  State.frames = Array.from({ length: 400 }, spectrumFrame);
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = spectrumFrame();
  State.currentFeatures = { melody: 0.2, vocal: 0.1, fx: 0.15, density: 0.55, brightness: 0.6, tension: 0.45 };
  State.currentTime = 4;
  State.isPlaying = true;
  State.isExporting = false;
  State.exportTime = 0;
  State.videoBackplateActive = false;
  State.playbackFade = 1;
  Object.assign(State.visualTuning, {
    wormholeOpticsEnabled: 1,
    performanceMode: 0,
    chromaKeyMode: 0,
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
    width: 960, height: 540, frameCount: 1, tints: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {}, line() {},
    circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}, radialDim() {},
    compositeRingTint(...args) { this.tints.push(JSON.parse(JSON.stringify(args))); }
  };
}

function render(configure = () => {}) {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  configure(State, featureFlags);
  const identity = new CosmicWormholeIdentity();
  identity.pool.length = 0;
  identity.syncPosition(State.isExporting ? State.exportTime : State.currentTime);
  const backend = makeBackend();
  identity.draw(backend, [], []);
  return backend.tints;
}

test('wormhole optics gate defaults Off and snaps discretely during tuning morphs', () => {
  const load = createSourceLoader();
  const { defaultVisualTuning, visualTuningControls, applyTuningMorph } = load('config/visualTuning.ts');
  assert.equal(defaultVisualTuning.wormholeOpticsEnabled, 0);
  const control = visualTuningControls.find(candidate => candidate.key === 'wormholeOpticsEnabled');
  assert.deepEqual(Array.from(control.options, option => [option.value, option.label]), [[0, 'Off'], [1, 'On']]);
  const current = { ...defaultVisualTuning, wormholeOpticsEnabled: 0 };
  const target = { ...defaultVisualTuning, wormholeOpticsEnabled: 1 };
  applyTuningMorph(current, target, 0.01, 1 / 60);
  assert.equal(current.wormholeOpticsEnabled, 1, 'the boolean-style gate must never interpolate through fractional states');
});

test('F5 emits one full exposure annulus plus three broad saturation sectors', () => {
  const tints = render();
  assert.equal(tints.length, 4);
  assert.equal(tints[0][6], 'screen');
  assert.equal(tints[0].length, 7, 'the exposure breath spans the complete annulus');
  assert.deepEqual(tints.slice(1).map(call => call[6]), ['saturation', 'saturation', 'saturation']);
  assert.ok(tints.slice(1).every(call => Number.isFinite(call[7]) && Number.isFinite(call[8]) && call[8] > call[7]));
  assert.ok(new Set(tints.slice(1).map(call => call[5])).size > 1, 'different band groups must produce different sector strengths');
});

test('F5 obeys optics/lens/chroma gates and retains the bounded two-sector performance path', () => {
  assert.equal(render(State => { State.visualTuning.wormholeOpticsEnabled = 0; }).length, 0);
  assert.equal(render(State => { State.visualTuning.wormholeLens = 0; }).length, 0);
  assert.equal(render(State => { State.visualTuning.chromaKeyMode = 1; }).length, 0);
  assert.equal(render(State => { State.visualTuning.chromaKeyMode = 2; }).length, 0);
  const performance = render(State => { State.visualTuning.performanceMode = 1; });
  assert.equal(performance.length, 3);
  assert.deepEqual(performance.map(call => call[6]), ['screen', 'saturation', 'saturation']);
});

test('F5 overlay is deterministic and stays active on export/video-backplate targets', () => {
  assert.deepEqual(render(), render());
  assert.equal(render(State => {
    State.isExporting = true;
    State.exportTime = 4;
  }).length, 4);
  assert.equal(render(State => { State.videoBackplateActive = true; }).length, 4);
});

test('P5 compositeRingTint clips the active export target and always restores source-over', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/P5RendererBackend.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  const State = { videoBackplateActive: false, visualTuning: { chromaKeyMode: 0 } };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(request) {
      if (request === 'p5') return { default: class MockP5 {} };
      if (request === '../state/store') return { State };
      if (request === './CanvasFieldRasterSurface') {
        return { CanvasFieldRasterSurface: class { beginFieldRaster() { return null; } drawFieldRaster() {} } };
      }
      throw new Error(`Unexpected import: ${request}`);
    },
    Math,
    Number
  });

  const gradientCalls = [];
  const stops = [];
  const fills = [];
  const operations = [];
  const context = {
    fillStyle: null,
    _operation: 'source-over',
    get globalCompositeOperation() { return this._operation; },
    set globalCompositeOperation(value) { this._operation = value; operations.push(value); },
    createRadialGradient(...args) {
      gradientCalls.push(args);
      return { addColorStop(offset, color) { stops.push([offset, color]); } };
    },
    save() {}, restore() {}, beginPath() {}, moveTo() {}, arc() {}, closePath() {}, clip() {},
    fillRect(...args) { fills.push(args); }
  };
  const exportTarget = { width: 1280, height: 720, drawingContext: context };
  const host = { width: 960, height: 540, frameCount: 1, __plexusExportTarget: exportTarget };
  const { P5RendererBackend } = module.exports;
  const backend = new P5RendererBackend(host);
  backend.compositeRingTint(640, 360, 120, 400, [20, 40, 60], 0.45, 'saturation', -1, 1);

  assert.deepEqual(gradientCalls, [[640, 360, 120, 640, 360, 400]]);
  assert.deepEqual(stops, [
    [0, 'rgba(0, 0, 0, 0)'],
    [0.38, 'rgba(20, 40, 60, 0.45)'],
    [0.68, 'rgba(20, 40, 60, 0.45)'],
    [1, 'rgba(0, 0, 0, 0)']
  ]);
  assert.deepEqual(fills, [[0, 0, 1280, 720]]);
  assert.deepEqual(operations, ['saturation', 'source-over']);
  assert.equal(context.globalCompositeOperation, 'source-over');

  State.visualTuning.chromaKeyMode = 1;
  backend.compositeRingTint(640, 360, 120, 400, [20, 40, 60], 0.45, 'screen');
  assert.equal(fills.length, 1, 'backend-level chroma guard must skip direct callers too');
});
