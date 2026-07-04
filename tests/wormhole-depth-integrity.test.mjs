import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const GRAIN_COUNT = 360;
const DEPTH_LAYERS = 15;
const FIXED_HORIZON = 2600;
const MAX_UNIFORMITY_CV = 0.35;

function pseudoNoise(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function initialPhases() {
  return Array.from({ length: GRAIN_COUNT }, (_, index) => {
    const layer = Math.floor(index / 24);
    const seed = (index + 1) * 12.9898;
    return (layer + pseudoNoise(seed, 3.1)) / DEPTH_LAYERS;
  });
}

function wrapDepth(z, maxZ) {
  return Math.max(1e-3, ((z % maxZ) + maxZ) % maxZ);
}

function densityCv(depths, maxZ, binCount = DEPTH_LAYERS) {
  const bins = new Uint32Array(binCount);
  for (const depth of depths) {
    const bin = Math.min(bins.length - 1, Math.floor(depth / maxZ * bins.length));
    bins[bin]++;
  }
  const mean = depths.length / bins.length;
  let variance = 0;
  for (const count of bins) variance += (count - mean) ** 2;
  return Math.sqrt(variance / bins.length) / mean;
}

function runMutableDepthSchedule() {
  const depths = initialPhases().map(phase => phase * FIXED_HORIZON);
  let maxZ = FIXED_HORIZON;
  let targetMaxZ = maxZ;
  let peakCv = 0;

  for (let frame = 0; frame < 6000; frame++) {
    if (frame % 60 === 0) targetMaxZ = 1800 + pseudoNoise(frame + 1, 99) * 3200;
    maxZ += (targetMaxZ - maxZ) * 0.08;
    const velocity = 18 + pseudoNoise(frame, 7) * 12;
    for (let index = 0; index < depths.length; index++) {
      depths[index] = wrapDepth(depths[index] - velocity, maxZ);
    }
    peakCv = Math.max(peakCv, densityCv(depths, maxZ));
  }

  return { finalCv: densityCv(depths, maxZ), peakCv };
}

test('negative control: mutable depths lose uniformity under a moving maxZ schedule', () => {
  const result = runMutableDepthSchedule();
  assert.ok(result.peakCv > MAX_UNIFORMITY_CV, `mutable model unexpectedly passed: ${result.peakCv}`);
  assert.ok(result.finalCv > MAX_UNIFORMITY_CV, `mutable model recovered unexpectedly: ${result.finalCv}`);
});

function loadDepthHelpers() {
  const source = readFileSync(join(process.cwd(), 'src/visuals/WormholeDepth.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Math, Number });
  return module.exports;
}

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
      const resolved = base.endsWith('.ts') ? base : `${base}.ts`;
      return load(resolved);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require, Math, Number, Array, Object, Map, Set, Uint16Array });
    return module.exports;
  }
  return relative => load(join(process.cwd(), 'src', relative));
}

test('derived depth phases remain uniform under the same moving maxZ schedule', () => {
  const { advanceDepthPhase, depthFromPhase } = loadDepthHelpers();
  const phases = initialPhases();
  const depths = new Float64Array(phases.length);
  let travelPhase = 0;
  let maxZ = FIXED_HORIZON;
  let targetMaxZ = maxZ;
  let peakCv = 0;

  for (let frame = 0; frame < 6000; frame++) {
    if (frame % 60 === 0) targetMaxZ = 1800 + pseudoNoise(frame + 1, 99) * 3200;
    maxZ += (targetMaxZ - maxZ) * 0.08;
    const velocity = 18 + pseudoNoise(frame, 7) * 12;
    travelPhase = advanceDepthPhase(travelPhase, velocity, maxZ);
    for (let index = 0; index < phases.length; index++) {
      depths[index] = depthFromPhase(phases[index], travelPhase, maxZ);
    }
    peakCv = Math.max(peakCv, densityCv(depths, maxZ));
  }

  assert.ok(peakCv < MAX_UNIFORMITY_CV, `derived model lost uniformity: ${peakCv}`);
});

test('authored depth coherence restores deterministic cohort character without accumulating damage', () => {
  const { depthFromPhase, depthWithCoherence, depthPhaseAtTime } = loadDepthHelpers();
  const phases = initialPhases();
  const travelPhase = depthPhaseAtTime(42);
  const continuous = phases.map(phase => depthWithCoherence(phase, travelPhase, 3400, 0, DEPTH_LAYERS));
  const coherent = phases.map(phase => depthWithCoherence(phase, travelPhase, 3400, 0.9, DEPTH_LAYERS));
  const repeated = phases.map(phase => depthWithCoherence(phase, travelPhase, 3400, 0.9, DEPTH_LAYERS));

  assert.deepEqual(continuous, phases.map(phase => depthFromPhase(phase, travelPhase, 3400)));
  assert.deepEqual(coherent, repeated, 'cohort character is deterministic at the same song position');
  assert.ok(densityCv(coherent, 3400, 60) > densityCv(continuous, 3400, 60) + 0.15, 'coherence creates visible depth cohorts');
});

test('100 seeks with moving maxZ do not accumulate coherence density damage', () => {
  const { advanceDepthPhase, depthPhaseAtTime, depthWithCoherence } = loadDepthHelpers();
  const phases = initialPhases();
  let travelPhase = 0;
  let maxZ = 2600;
  let peakDamageDelta = 0;

  for (let seekIndex = 0; seekIndex < 100; seekIndex++) {
    const targetMaxZ = 1800 + pseudoNoise(seekIndex + 1, 91) * 3200;
    for (let frame = 0; frame < 45; frame++) {
      maxZ += (targetMaxZ - maxZ) * 0.08;
      travelPhase = advanceDepthPhase(travelPhase, 18 + pseudoNoise(frame, seekIndex + 3) * 12, maxZ);
    }

    const seekTime = pseudoNoise(seekIndex + 17, 121) * 360;
    travelPhase = depthPhaseAtTime(seekTime);
    const afterHistory = phases.map(phase => depthWithCoherence(phase, travelPhase, maxZ, 0.85, DEPTH_LAYERS));
    const freshAtPosition = phases.map(phase => depthWithCoherence(
      phase,
      depthPhaseAtTime(seekTime),
      maxZ,
      0.85,
      DEPTH_LAYERS
    ));
    peakDamageDelta = Math.max(
      peakDamageDelta,
      Math.abs(densityCv(afterHistory, maxZ, 60) - densityCv(freshAtPosition, maxZ, 60))
    );
    assert.deepEqual(afterHistory, freshAtPosition, `seek ${seekIndex} retained path-dependent depth damage`);
  }

  assert.equal(peakDamageDelta, 0);
});

test('wormhole grains no longer carry mutable z depth state', () => {
  const source = readFileSync(join(process.cwd(), 'src/visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.doesNotMatch(source, /interface DustGrain\s*\{[^}]*\bz:\s*number/);
  assert.doesNotMatch(source, /grain\.z\s*=/);
  assert.match(source, /readonly depthPhase: number/);
});

test('syncPosition produces identical wormhole line geometry after different histories', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const first = new CosmicWormholeIdentity();
  const second = new CosmicWormholeIdentity();
  const makeBackend = () => ({
    width: 960, height: 540, frameCount: 1, lines: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}
  });

  State.isPlaying = true;
  State.playbackFade = 1;
  State.visualTuning.wormholeDepth = 3.4;
  State.visualTuning.wormholeSpeed = 2.2;
  State.visualTuning.wormholeCurve = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.currentTime = 10;
  for (let index = 0; index < 3; index++) first.draw(makeBackend(), [], []);
  for (let index = 0; index < 11; index++) second.draw(makeBackend(), [], []);

  State.currentTime = 42;
  first.syncPosition(42);
  second.syncPosition(42);
  const firstBackend = makeBackend();
  const secondBackend = makeBackend();
  first.draw(firstBackend, [], []);
  second.draw(secondBackend, [], []);
  assert.deepEqual(firstBackend.lines, secondBackend.lines);
});

test('syncPosition also restores deterministic curved galaxy geometry', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const first = new CosmicWormholeIdentity();
  const second = new CosmicWormholeIdentity();
  const makeBackend = () => ({
    width: 960, height: 540, frameCount: 1, lines: [], glows: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow(...args) { this.glows.push(args); }
  });

  State.isPlaying = true;
  State.playbackFade = 1;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;
  State.visualTuning.wormholeDepth = 4.6;
  State.visualTuning.wormholeSpeed = 3.1;
  State.visualTuning.wormholeCurve = 0.75;
  State.visualTuning.wormholeGalaxy = 1.2;
  State.visualTuning.wormholeDepthCoherence = 0.65;
  State.modulation.kineticTension = 0.6;
  State.directorOutput.centripetalOrbit = 0.4;
  State.directorOutput.state = 'DROP';
  for (let index = 0; index < 4; index++) first.draw(makeBackend(), [], []);
  for (let index = 0; index < 13; index++) second.draw(makeBackend(), [], []);

  State.currentTime = 73;
  first.syncPosition(73);
  second.syncPosition(73);
  const firstBackend = makeBackend();
  const secondBackend = makeBackend();
  first.draw(firstBackend, [], []);
  second.draw(secondBackend, [], []);
  assert.deepEqual(firstBackend.lines, secondBackend.lines);
  assert.deepEqual(firstBackend.glows, secondBackend.glows);
  assert.ok(firstBackend.glows.length > 0, 'galaxy branch rendered');
});

test('legacy-like cohort character is intentionally authored by collapse, sparse, and spiral presets', () => {
  const readPreset = name => JSON.parse(readFileSync(join(process.cwd(), 'public/visual-tuning-presets', name), 'utf8')).visualTuning;
  assert.ok(readPreset('vos-wh-collapse.json').wormholeDepthCoherence >= 0.6);
  assert.ok(readPreset('vos-wh-sparse.json').wormholeDepthCoherence >= 0.8);
  assert.ok(readPreset('vos-wh-spiral.json').wormholeDepthCoherence >= 0.5);
});
