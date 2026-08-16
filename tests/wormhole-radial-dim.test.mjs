import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Lens-overhaul plan T7: exercise the production draw loop while capturing only the new
// dark-glass primitive. Other layers remain enabled enough to verify the actual draw ordering.
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

function makeBackend() {
  return {
    width: 960, height: 540, frameCount: 1, dims: [], commands: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {}, line() {},
    circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow() { this.commands.push('glow'); },
    radialDim(...args) {
      this.commands.push('dim');
      this.dims.push(JSON.parse(JSON.stringify(args)));
    },
    compositeRingTint() {}
  };
}

function lensFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0.55), state: 'HIGH'
  };
}

function setupState(State, featureFlags) {
  featureFlags.wormholeSkybox = false;
  State.sampleRate = 48000;
  State.hopSize = 1024;
  State.frames = Array.from({ length: 400 }, lensFrame);
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = lensFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
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
    wormholeWall: 0.8,
    wormholeWallRefraction: 0,
    wormholeWallCaustics: 0,
    wormholeWallWaves: 0,
    wormholeWallCracks: 0,
    wormholeLens: 0.7,
    wormholeLensRadius: 0.5,
    wormholeLensSwirl: 0.35
  });
}

function render(configure = () => {}) {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  configure(State, featureFlags);
  const backend = makeBackend();
  new CosmicWormholeIdentity().draw(backend, [], []);
  return backend;
}

test('dark-glass vignette gates on lens, wall, and chroma-key state', () => {
  assert.equal(render().dims.length, 1);
  assert.equal(render(State => { State.visualTuning.wormholeLens = 0; }).dims.length, 0);
  assert.equal(render(State => { State.visualTuning.wormholeWall = 0; }).dims.length, 0);
  assert.equal(render(State => { State.visualTuning.chromaKeyMode = 1; }).dims.length, 0);
});

test('dark-glass vignette follows the lens center and derives radii and alpha from lens/wall tuning', () => {
  const backend = render();
  assert.equal(backend.dims.length, 1);
  const lensRadius = 0.5 * Math.hypot(960, 540) * 0.5;
  assert.deepEqual(backend.dims[0], [
    480,
    270,
    lensRadius * 0.82,
    lensRadius * 2.35,
    0.7 * 0.8 * 0.58
  ]);
  assert.ok(
    backend.commands.indexOf('dim') < backend.commands.indexOf('glow'),
    'the vignette must darken the background before the Einstein-ring light is added'
  );
});

test('dark-glass vignette stays active on export and video-backplate render paths', () => {
  const exporting = render(State => {
    State.isExporting = true;
    State.exportTime = 4;
  });
  assert.equal(exporting.dims.length, 1);

  const videoBackplate = render(State => {
    State.videoBackplateActive = true;
  });
  assert.equal(videoBackplate.dims.length, 1);
});

test('P5 radialDim uses one inverse radial gradient fill on the active export target', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/P5RendererBackend.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };
  const State = { videoBackplateActive: false };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(request) {
      if (request === 'p5') return { default: class MockP5 {} };
      if (request === '../state/store') return { State };
      throw new Error(`Unexpected import: ${request}`);
    },
    Math,
    Number
  });

  const gradientCalls = [];
  const stops = [];
  const fills = [];
  const context = {
    fillStyle: null,
    createRadialGradient(...args) {
      gradientCalls.push(args);
      return { addColorStop(offset, color) { stops.push([offset, color]); } };
    },
    save() {},
    restore() {},
    fillRect(...args) { fills.push(args); }
  };
  const exportTarget = { width: 1280, height: 720, drawingContext: context };
  const host = {
    width: 960,
    height: 540,
    frameCount: 1,
    __plexusExportTarget: exportTarget
  };
  const { P5RendererBackend } = module.exports;
  const backend = new P5RendererBackend(host);
  backend.radialDim(640, 360, 120, 400, 0.45);

  assert.deepEqual(gradientCalls, [[640, 360, 120, 640, 360, 400]]);
  assert.deepEqual(stops, [
    [0, 'rgba(0, 0, 0, 0)'],
    [1, 'rgba(0, 0, 0, 0.45)']
  ]);
  assert.deepEqual(fills, [[0, 0, 1280, 720]]);
});
