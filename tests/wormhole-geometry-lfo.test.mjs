import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

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
    vm.runInNewContext(output, { module, exports: module.exports, require, Math, Number, Array, Object });
    return module.exports;
  }
  return relative => load(join(process.cwd(), 'src', relative));
}

const WAVEFORMS = {
  off: 0, sine: 1, saw: 2, triangle: 3, square: 4, randomGlide: 5, pluck: 6, organic: 7
};
const NON_OFF_WAVEFORMS = [1, 2, 3, 4, 5, 6, 7];
const EXACT_INVERSION_WAVEFORMS = [1, 3, 4]; // Sine, Triangle, Square

test('wormhole LFO rate controls expose the extended 8 Hz performance range', () => {
  const { visualTuningControls } = loadVisualTuningModule();
  for (const key of ['wormholeRadiusLfoRate', 'wormholeDepthLfoRate']) {
    const control = visualTuningControls.find(item => item.key === key);
    assert.ok(control, `${key} control exists`);
    assert.equal(control.min, 0.01, `${key} minimum`);
    assert.equal(control.max, 8, `${key} maximum`);
  }
});

test('evaluateWormholeLfo is deterministic across all 8 waveform indices', () => {
  const load = createSourceLoader();
  const { evaluateWormholeLfo } = load('visuals/WormholeGeometryLfo.ts');
  for (let waveform = 0; waveform <= 7; waveform++) {
    for (const phase of [0, 0.1, 0.33, 0.5, 0.75, 0.999]) {
      const a = evaluateWormholeLfo(waveform, phase);
      const b = evaluateWormholeLfo(waveform, phase);
      assert.equal(a, b, `waveform=${waveform} phase=${phase} must be deterministic`);
    }
  }
});

test('evaluateWormholeLfo returns 0 for Off and every invalid/out-of-range waveform index', () => {
  const load = createSourceLoader();
  const { evaluateWormholeLfo } = load('visuals/WormholeGeometryLfo.ts');
  for (const waveform of [0, -1, 1.5, NaN, 8, 99]) {
    for (const phase of [0, 0.25, 0.5, 0.9]) {
      assert.equal(evaluateWormholeLfo(waveform, phase), 0, `waveform=${waveform} phase=${phase} must be 0`);
    }
  }
});

test('evaluateWormholeLfo treats NaN/Infinity phase as phase 0, defensively', () => {
  const load = createSourceLoader();
  const { evaluateWormholeLfo } = load('visuals/WormholeGeometryLfo.ts');
  for (const waveform of NON_OFF_WAVEFORMS) {
    const atZero = evaluateWormholeLfo(waveform, 0);
    assert.equal(evaluateWormholeLfo(waveform, NaN), atZero, `waveform=${waveform} NaN phase`);
    assert.equal(evaluateWormholeLfo(waveform, Infinity), atZero, `waveform=${waveform} +Infinity phase`);
    assert.equal(evaluateWormholeLfo(waveform, -Infinity), atZero, `waveform=${waveform} -Infinity phase`);
  }
});

test('evaluateWormholeLfo stays within [-1,1] across a dense phase sweep, every waveform', () => {
  const load = createSourceLoader();
  const { evaluateWormholeLfo } = load('visuals/WormholeGeometryLfo.ts');
  const STEPS = 2000;
  for (const waveform of NON_OFF_WAVEFORMS) {
    for (let i = 0; i <= STEPS; i++) {
      const phase = (i / STEPS) * 3 - 1; // sweep outside [0,1) too, since phase wraps internally
      const value = evaluateWormholeLfo(waveform, phase);
      assert.ok(value >= -1 - 1e-9 && value <= 1 + 1e-9, `waveform=${waveform} phase=${phase} out of bounds: ${value}`);
    }
  }
});

test('evaluateWormholeLfo is zero-mean at midpoint sampling, every non-Off waveform', () => {
  const load = createSourceLoader();
  const { evaluateWormholeLfo } = load('visuals/WormholeGeometryLfo.ts');
  const N = 20000;
  for (const waveform of NON_OFF_WAVEFORMS) {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const phase = (i + 0.5) / N;
      sum += evaluateWormholeLfo(waveform, phase);
    }
    const mean = sum / N;
    assert.ok(Math.abs(mean) < 0.01, `waveform=${waveform} expected ~zero mean, got ${mean}`);
  }
});

test('a half-cycle phase offset is an exact inversion for Sine/Triangle/Square, a decorrelation shift for the rest', () => {
  const load = createSourceLoader();
  const { evaluateWormholeLfo } = load('visuals/WormholeGeometryLfo.ts');
  for (const waveform of NON_OFF_WAVEFORMS) {
    let maxAbsSum = 0;
    for (let i = 0; i < 1000; i++) {
      const phase = i / 1000;
      const a = evaluateWormholeLfo(waveform, phase);
      const b = evaluateWormholeLfo(waveform, phase + 0.5);
      maxAbsSum = Math.max(maxAbsSum, Math.abs(a + b));
    }
    if (EXACT_INVERSION_WAVEFORMS.includes(waveform)) {
      assert.ok(maxAbsSum < 1e-9, `waveform=${waveform} expected exact inversion, max |f(p)+f(p+0.5)|=${maxAbsSum}`);
    } else {
      assert.ok(maxAbsSum > 0.05, `waveform=${waveform} expected a genuine decorrelation shift, not an inversion or a no-op`);
    }
  }
});

test('wormholeGeometryLfoPhase is a pure canonical-time oscillator phase', () => {
  const load = createSourceLoader();
  const { wormholeGeometryLfoPhase } = load('visuals/WormholeGeometryLfo.ts');
  const a = wormholeGeometryLfoPhase(5, 0.3);
  const b = wormholeGeometryLfoPhase(5, 0.3);
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 1, `phase must land in [0,1), got ${a}`);

  // A one-second time step advances by exactly the requested cycles per second.
  const c = wormholeGeometryLfoPhase(6, 0.3);
  assert.ok(Math.abs(c - (a + 0.3)) < 1e-9, `expected canonical time to advance phase by the rate`);
});

test('wormholeGeometryLfoMultiplier bounds its finite amount defensively', () => {
  const load = createSourceLoader();
  const {
    wormholeGeometryLfoMultiplier
  } = load('visuals/WormholeGeometryLfo.ts');
  const STEPS = 500;
  for (const waveform of NON_OFF_WAVEFORMS) {
    for (let i = 0; i <= STEPS; i++) {
      const phase = i / STEPS;
      const radiusMultiplier = wormholeGeometryLfoMultiplier(waveform, phase, 0.25);
      const depthMultiplier = wormholeGeometryLfoMultiplier(waveform, phase, 10);
      assert.ok(
        radiusMultiplier >= 0.75 - 1e-9 && radiusMultiplier <= 1.25 + 1e-9,
        `waveform=${waveform} phase=${phase} radius multiplier out of bounds: ${radiusMultiplier}`
      );
      assert.ok(
        depthMultiplier >= 0.1 - 1e-9 && depthMultiplier <= 1.9 + 1e-9,
        `waveform=${waveform} phase=${phase} depth multiplier out of bounds: ${depthMultiplier}`
      );
    }
  }
});

test('wormholeGeometryLfoMultiplier is exactly 1 for Off, at every phase', () => {
  const load = createSourceLoader();
  const { wormholeGeometryLfoMultiplier } = load('visuals/WormholeGeometryLfo.ts');
  for (const phase of [0, 0.2, 0.5, 0.8, 1.3, -0.4]) {
    assert.equal(wormholeGeometryLfoMultiplier(WAVEFORMS.off, phase, 0.25), 1);
  }
});

// -- normalizeVisualTuningConfig (round-4 corrected behavior) -----------------------------------

function loadVisualTuningModule() {
  const source = readFileSync(join(process.cwd(), 'src/config/visualTuning.ts'), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const context = vm.createContext({
    exports: {},
    require(request) {
      if (request === './featureFlags') return { featureFlags: { heroEffect: false } };
      throw new Error(`Unsupported import in test loader: ${request}`);
    },
    Math,
    Number,
    Object
  });
  vm.runInContext(transpiled, context);
  return context.exports;
}

test('normalizeVisualTuningConfig: an absent LFO waveform key stays sticky (missing != invalid)', () => {
  const { normalizeVisualTuningConfig, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, wormholeRadiusLfoWaveform: WAVEFORMS.sine, wormholeDepthLfoWaveform: WAVEFORMS.sine };
  const next = normalizeVisualTuningConfig({ visualTuning: { wormholeRadius: 2 } }, current);
  assert.equal(next.wormholeRadiusLfoWaveform, WAVEFORMS.sine, 'absent key must stay sticky at the prior active value');
  assert.equal(next.wormholeDepthLfoWaveform, WAVEFORMS.sine, 'absent key must stay sticky at the prior active value');
});

test('normalizeVisualTuningConfig: a present-but-invalid LFO waveform value resets to Off, not sticky', () => {
  const { normalizeVisualTuningConfig, defaultVisualTuning } = loadVisualTuningModule();
  for (const invalidValue of [1.5, NaN, 8, 'foo', null, -1]) {
    const current = { ...defaultVisualTuning, wormholeRadiusLfoWaveform: WAVEFORMS.sine, wormholeDepthLfoWaveform: WAVEFORMS.sine };
    const next = normalizeVisualTuningConfig(
      { visualTuning: { wormholeRadiusLfoWaveform: invalidValue, wormholeDepthLfoWaveform: invalidValue } },
      current
    );
    assert.equal(next.wormholeRadiusLfoWaveform, WAVEFORMS.off, `invalid value ${invalidValue} must reset radius LFO to Off, not stay sticky`);
    assert.equal(next.wormholeDepthLfoWaveform, WAVEFORMS.off, `invalid value ${invalidValue} must reset depth LFO to Off, not stay sticky`);
  }
});

test('normalizeVisualTuningConfig: a present, valid LFO waveform value is adopted', () => {
  const { normalizeVisualTuningConfig, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, wormholeRadiusLfoWaveform: WAVEFORMS.off, wormholeDepthLfoWaveform: WAVEFORMS.off };
  const next = normalizeVisualTuningConfig(
    { visualTuning: { wormholeRadiusLfoWaveform: WAVEFORMS.organic, wormholeDepthLfoWaveform: WAVEFORMS.pluck } },
    current
  );
  assert.equal(next.wormholeRadiusLfoWaveform, WAVEFORMS.organic);
  assert.equal(next.wormholeDepthLfoWaveform, WAVEFORMS.pluck);
});
