import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Lens-overhaul plan T6 (spot gating/placement/determinism), re-based by true-lens plan F3 (every
// spot now shares one aggregate, whole-spectrum brightness instead of a per-band lookup -- no
// per-spot flashing). Exercises the production draw loop with background and wall layers isolated,
// so captured radialGlow calls are exactly the Einstein-ring spots.
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
    width: 960, height: 540, frameCount: 1, glows: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {}, line() {},
    circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow(...args) { this.glows.push(JSON.parse(JSON.stringify(args))); },
    radialDim() {}, compositeRingTint() {}
  };
}

function lensFrame(energy = 0.55) {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(energy), state: 'HIGH'
  };
}

function setupEinsteinState(State, featureFlags) {
  featureFlags.wormholeSkybox = false;
  State.sampleRate = 48000;
  State.hopSize = 1024;
  State.frames = Array.from({ length: 400 }, () => lensFrame());
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = lensFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.isExporting = false;
  State.isPlaying = true;
  State.playbackFade = 1;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;
  State.visualTuning.wormholeDepth = 1.2;
  State.visualTuning.wormholeSpeed = 2;
  State.visualTuning.wormholeCurve = 0;
  State.visualTuning.wormholePathBend = 0;
  State.visualTuning.wormholePathBendVertical = 0;
  State.visualTuning.wormholeRing = 0;
  State.visualTuning.wormholeDepthCoherence = 0;
  State.visualTuning.wormholeJitter = 0;
  State.visualTuning.wormholeSkybox = 0;
  State.visualTuning.wormholeStarfield = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.visualTuning.wormholeOpticsEnabled = 1;
  State.visualTuning.wormholeWall = 0;
  State.visualTuning.wormholeLens = 0.7;
  State.visualTuning.wormholeLensRadius = 0.5;
  State.visualTuning.wormholeLensSwirl = 0.35;
}

function render(configure = () => {}, timeSec = 4) {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupEinsteinState(State, featureFlags);
  configure(State, featureFlags);
  const identity = new CosmicWormholeIdentity();
  State.currentTime = timeSec;
  const backend = makeBackend();
  identity.draw(backend, [], []);
  return { backend, identity, State };
}

test('Einstein-ring glow gates skip disabled lenses and keep the bounded performance-mode path', () => {
  const disabled = render(State => { State.visualTuning.wormholeLens = 0; });
  assert.equal(disabled.backend.glows.length, 0, 'wormholeLens<=0 must skip the entire ring layer');

  const normal = render();
  assert.equal(normal.backend.glows.length, 12, 'normal quality renders the deterministic 12-spot ring');

  const performance = render(State => { State.visualTuning.performanceMode = 1; });
  assert.equal(performance.backend.glows.length, 4, 'performance mode keeps exactly four bounded spots');

  const chromaKey = render(State => { State.visualTuning.chromaKeyMode = 1; });
  assert.equal(chromaKey.backend.glows.length, 0, 'the shouldUseExpensiveGlow chroma-key exclusion remains intact');
});

test('Einstein-ring glows are deterministic after different draw histories and a seek', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupEinsteinState(State, featureFlags);
  State.visualTuning.wormholePathBend = 0.65;

  const first = new CosmicWormholeIdentity();
  const second = new CosmicWormholeIdentity();
  for (let index = 0; index < 4; index++) {
    State.currentTime = 1 + index * 0.4;
    first.draw(makeBackend(), [], []);
  }
  for (let index = 0; index < 15; index++) {
    State.currentTime = 1 + index * 0.09;
    second.draw(makeBackend(), [], []);
  }

  State.currentTime = 6.4;
  first.syncPosition(6.4);
  second.syncPosition(6.4);
  const firstBackend = makeBackend();
  const secondBackend = makeBackend();
  first.draw(firstBackend, [], []);
  second.draw(secondBackend, [], []);
  assert.deepEqual(firstBackend.glows, secondBackend.glows);
});

test('Einstein-ring glow centers lie on the lens radius, perturbed within the wall-as-refraction-field bound', () => {
  // true-lens plan F4: each spot sits on its own azimuth's *perturbed* radius (see
  // `perturbedLensRadius`), not the raw lens radius exactly -- this residual glow wobbles in
  // lockstep with the real lensed points around it. The perturbation is bounded to
  // +-LENS_WALL_PERTURBATION_MAX (8%), so every glow distance must fall within that band.
  const { backend } = render();
  assert.equal(backend.glows.length, 12);
  const lensRadius = 0.5 * Math.hypot(960, 540) * 0.5;
  const maxPerturbation = 0.08;
  for (const [x, y] of backend.glows) {
    const dist = Math.hypot(x - 480, y - 270);
    assert.ok(
      Math.abs(dist - lensRadius) <= lensRadius * maxPerturbation + 1e-6,
      `glow (${x}, ${y}) at distance ${dist} must stay within +-${maxPerturbation * 100}% of the lens radius ${lensRadius}`
    );
  }
});

test('true-lens plan F3: every spot shares the exact same aggregate-driven alpha -- no per-band flashing', () => {
  // A sharply uneven spectrum (only the first few bands hot, the rest silent) is exactly the case
  // that would expose per-spot band-energy flashing if it still existed: each spot's own crossed
  // band would then carry wildly different brightness. F3 replaces that per-band lookup with a
  // single whole-spectrum average shared by every spot, so all twelve alphas must be identical.
  const unevenSpectrum = new Array(24).fill(0);
  unevenSpectrum[0] = 1;
  unevenSpectrum[1] = 0.9;
  unevenSpectrum[2] = 0.8;
  const { backend } = render((State) => {
    State.currentFrame = { ...State.currentFrame, perceptualSpectrum: unevenSpectrum };
    State.frames = Array.from({ length: 400 }, () => ({ ...State.currentFrame, perceptualSpectrum: unevenSpectrum }));
  });
  assert.equal(backend.glows.length, 12);
  const alphas = backend.glows.map(([, , , , alpha]) => alpha);
  const first = alphas[0];
  for (const alpha of alphas) assert.equal(alpha, first, 'every ring spot must share the exact same alpha regardless of which specific bands are hot');
  assert.ok(first > 0, 'the uneven-but-nonzero spectrum must still produce a visible, nonzero aggregate glow');
});

test('true-lens plan F3: aggregate energy tracks the whole-spectrum average, not any single band', () => {
  const lowEnergyGlow = render((State) => {
    const spectrum = new Array(24).fill(0.1);
    State.currentFrame = { ...State.currentFrame, perceptualSpectrum: spectrum };
    State.frames = Array.from({ length: 400 }, () => ({ ...State.currentFrame, perceptualSpectrum: spectrum }));
  }).backend.glows[0][4];
  const highEnergyGlow = render((State) => {
    const spectrum = new Array(24).fill(0.9);
    State.currentFrame = { ...State.currentFrame, perceptualSpectrum: spectrum };
    State.frames = Array.from({ length: 400 }, () => ({ ...State.currentFrame, perceptualSpectrum: spectrum }));
  }).backend.glows[0][4];
  assert.ok(highEnergyGlow > lowEnergyGlow, 'a higher whole-spectrum average must read as a brighter ring breath');
});
