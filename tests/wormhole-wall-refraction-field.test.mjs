import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// True-lens plan F4: the wall is no longer drawn as lines by default -- its presence reads
// entirely through a bounded perturbation of the lens's own Einstein radius, reusing the exact
// same ripple/wave evaluators the (now legacy, opt-in) drawn wall materials always used. These
// tests exercise the real draw() loop, never re-derive the perturbation math independently.

const ROOT = process.cwd();
const PRESET_ROOT = join(ROOT, 'public', 'visual-tuning-presets');
const LENS_WALL_PERTURBATION_MAX = 0.08;

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
  return relative => load(join(ROOT, 'src', relative));
}

function makeBackend() {
  return {
    width: 960, height: 540, frameCount: 1, lines: [], glows: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow(...args) { this.glows.push(args); },
    radialDim() {}, compositeRingTint() {}
  };
}

function kickTestFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(0.9), ...new Array(16).fill(0.1)],
    state: 'HIGH'
  };
}

function setupState(State, featureFlags) {
  featureFlags.wormholeSkybox = true;
  State.sampleRate = 1000;
  State.hopSize = 100;
  State.frames = Array.from({ length: 400 }, kickTestFrame);
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = kickTestFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.isExporting = false;
  State.isPlaying = true;
  State.playbackFade = 1;
  State.visualTuning.wormholeOpticsEnabled = 1;
}

// -- preset defaults -----------------------------------------------------------------------------

test('factory default tuning sets wormholeWall to 0 (line materials are legacy/opt-in)', () => {
  const load = createSourceLoader();
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  assert.equal(defaultVisualTuning.wormholeOpticsEnabled, 0);
  assert.equal(defaultVisualTuning.wormholeWall, 0);
});

test('the default-off optics gate bypasses authored wall and lens values as one family', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  Object.assign(State.visualTuning, {
    wormholeOpticsEnabled: 0,
    wormholeWall: 1,
    wormholeWallRefraction: 1,
    wormholeWallCaustics: 1,
    wormholeWallWaves: 1,
    wormholeWallCracks: 1,
    wormholeWallMode: 1,
    wormholeLens: 1,
    wormholeLensRadius: 0.8,
    wormholeLensSwirl: 1.4,
    wormholeSkybox: 0,
    wormholeStarfield: 0,
    wormholeGalaxy: 0,
    performanceMode: 0,
    chromaKeyMode: 0
  });
  const identity = new CosmicWormholeIdentity();
  identity.pool.length = 0;
  identity.syncPosition(3);
  State.currentTime = 3;
  const backend = makeBackend();
  identity.draw(backend, [], []);
  assert.equal(backend.lines.length, 0);
  assert.equal(backend.glows.length, 0);
});

test('every factory wormhole preset explicitly authors wormholeWall as 0', () => {
  const presetFiles = readdirSync(PRESET_ROOT).filter(name => /^vos-wh-.*\.json$/.test(name));
  assert.equal(presetFiles.length, 10, 'expected all 10 factory wormhole presets');
  for (const name of presetFiles) {
    const tuning = JSON.parse(readFileSync(join(PRESET_ROOT, name), 'utf8')).visualTuning;
    assert.equal(tuning.wormholeWall, 0, `${name}: wormholeWall must be 0`);
  }
});

// -- extinguished line layers ---------------------------------------------------------------------

test('default tuning draws zero membrane/caustic/crack/mosaic lines even with the lens active', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  // Isolate the wall/grain stream: background layers off, grain pool trimmed to zero so any
  // remaining line() call can only come from the wall dispatcher.
  State.visualTuning.wormholeSkybox = 0;
  State.visualTuning.wormholeStarfield = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.visualTuning.wormholeLens = 0.7;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;
  const identity = new CosmicWormholeIdentity();
  identity.pool.length = 0;
  identity.syncPosition(3);
  State.currentTime = 3;
  const backend = makeBackend();
  identity.draw(backend, [], []);
  assert.equal(backend.lines.length, 0, 'wormholeWall defaults to 0, so drawWall() must never be called');
});

test('explicitly re-enabling wormholeWall still draws its legacy line materials (opt-in preserved)', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  State.visualTuning.wormholeSkybox = 0;
  State.visualTuning.wormholeStarfield = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.visualTuning.wormholeLens = 0.7;
  State.visualTuning.wormholeWall = 0.5;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;
  const identity = new CosmicWormholeIdentity();
  identity.pool.length = 0;
  identity.syncPosition(3);
  State.currentTime = 3;
  const backend = makeBackend();
  identity.draw(backend, [], []);
  assert.ok(backend.lines.length > 0, 'wormholeWall>0 must still render its legacy line materials when explicitly re-enabled');
});

// -- perturbation bound ----------------------------------------------------------------------------

test('the refraction-field perturbation never moves the Einstein-ring residual glow beyond +-8% of the lens radius', () => {
  // Reuses the Einstein-ring layer as a direct probe of `perturbedLensRadius`: every spot's
  // distance from the lens center is exactly `perturbedLensRadius(theta, ...)` for that spot's
  // own theta (see CosmicWormholeIdentity.drawEinsteinRing), so this is a decisive, not-reimplemented
  // check of the F4 perturbation bound against the real production code path.
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  State.visualTuning.wormholeSkybox = 0;
  State.visualTuning.wormholeStarfield = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.visualTuning.wormholeLens = 0.7;
  State.visualTuning.wormholeLensRadius = 0.5;
  State.visualTuning.wormholeWallWaves = 0.6;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;
  const identity = new CosmicWormholeIdentity();
  identity.pool.length = 0;
  const lensRadius = 0.5 * Math.hypot(960, 540) * 0.5;

  // Sweep several travel positions (and, implicitly, kick-front ages) so the temporal wave term
  // is exercised too, not just the azimuthal ripple.
  for (let step = 0; step < 20; step++) {
    identity.syncPosition(2 + step * 0.35);
    State.currentTime = 2 + step * 0.35;
    const backend = makeBackend();
    identity.draw(backend, [], []);
    for (const [x, y] of backend.glows) {
      const dist = Math.hypot(x - 480, y - 270);
      assert.ok(
        Math.abs(dist - lensRadius) <= lensRadius * LENS_WALL_PERTURBATION_MAX + 1e-6,
        `t=${State.currentTime}: glow distance ${dist} exceeds the +-8% perturbation bound around ${lensRadius}`
      );
    }
  }
});

// -- determinism ------------------------------------------------------------------------------------

test('the refraction-field perturbation is deterministic: seeking to the same position after different playback histories matches exactly', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags);
  State.visualTuning.wormholeSkybox = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.visualTuning.wormholeStarfield = 1;
  State.visualTuning.wormholeLens = 0.7;
  State.visualTuning.wormholeWallWaves = 0.6;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;

  const first = new CosmicWormholeIdentity();
  const second = new CosmicWormholeIdentity();
  first.pool.length = 0;
  second.pool.length = 0;
  for (let index = 0; index < 4; index++) {
    State.currentTime = 1 + index * 0.4;
    first.draw(makeBackend(), [], []);
  }
  for (let index = 0; index < 13; index++) {
    State.currentTime = 1 + index * 0.12;
    second.draw(makeBackend(), [], []);
  }

  State.currentTime = 5.6;
  first.syncPosition(5.6);
  second.syncPosition(5.6);
  const firstBackend = makeBackend();
  const secondBackend = makeBackend();
  first.draw(firstBackend, [], []);
  second.draw(secondBackend, [], []);

  assert.ok(firstBackend.lines.length > 0, 'expected star geometry to render');
  assert.deepEqual(firstBackend.lines, secondBackend.lines);
});
