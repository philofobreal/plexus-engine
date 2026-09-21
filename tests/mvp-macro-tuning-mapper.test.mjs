import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function transpile(relPath) {
  const source = readFileSync(join(process.cwd(), relPath), 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}

function runInSandbox(relPath, requireStub) {
  const context = vm.createContext({ exports: {}, require: requireStub, Math, Number, Object, Array });
  vm.runInContext(transpile(relPath), context);
  return context.exports;
}

function loadVisualTuningModule() {
  return runInSandbox('src/config/visualTuning.ts', (request) => {
    if (request === './featureFlags') return { featureFlags: { heroEffect: false } };
    throw new Error(`Unsupported import in test loader: ${request}`);
  });
}

function loadMetaTuningBoostModule(visualTuningModule) {
  return runInSandbox('src/ui/mvp/metaTuningBoost.ts', (request) => {
    if (request === '../../config/visualTuning') return visualTuningModule;
    throw new Error(`Unsupported import in test loader: ${request}`);
  });
}

function loadMacroTuningMapperModule(visualTuningModule, metaTuningBoostModule) {
  return runInSandbox('src/ui/mvp/macroTuningMapper.ts', (request) => {
    if (request === '../../config/visualTuning') return visualTuningModule;
    if (request === './metaTuningBoost') return metaTuningBoostModule;
    throw new Error(`Unsupported import in test loader: ${request}`);
  });
}

function load() {
  const visualTuning = loadVisualTuningModule();
  const metaTuningBoost = loadMetaTuningBoostModule(visualTuning);
  const macroTuningMapper = loadMacroTuningMapperModule(visualTuning, metaTuningBoost);
  return { ...visualTuning, ...metaTuningBoost, ...macroTuningMapper };
}

test('grain line shape is an absolute saved choice, independent of preset values and macro gains', () => {
  const { defaultAdvancedBoosts, resolveAdvancedTuningValue, mapMvpMacrosToTuning, cloneDefaultVisualTuning,
    normalizeVisualTuningConfig, applyTuningMorph } = load();
  const defaults = defaultAdvancedBoosts();
  assert.equal(defaults.wormholeGrainShape, 0);
  assert.equal(defaults.lineWeight, 0.5);
  const saved = JSON.parse(JSON.stringify({ ...defaults, wormholeGrainShape: 1 }));
  for (const base of [0, 1]) {
    assert.equal(resolveAdvancedTuningValue('wormholeGrainShape', saved.wormholeGrainShape, base), 1);
    assert.equal(resolveAdvancedTuningValue('wormholeGrainShape', 0, base), 0);
  }
  for (const malformed of [undefined, NaN, 0.5, 9]) {
    assert.equal(resolveAdvancedTuningValue('wormholeGrainShape', malformed, 1), 0);
  }
  const current = cloneDefaultVisualTuning();
  const target = normalizeVisualTuningConfig({ wormholeGrainShape: 1 }, current);
  applyTuningMorph(current, target, 0.1, 0);
  assert.equal(current.wormholeGrainShape, 1, 'selectors also switch while paused');
  assert.equal(mapMvpMacrosToTuning({ intensity: 1, motion: 1, depth: 1, detail: 1 }, current).wormholeGrainShape, undefined);
  assert.equal(resolveAdvancedTuningValue('lineWeight', 1, 2), 8);
});

// ─── mapMvpMacrosToTuning: each macro multiplies (above center) or fades toward zero (below
// center) whatever the preset/automation-point *currently* authors for its mapped keys -- read
// fresh from `base` every call, never from a stored anchor. This replaces the earlier "blend
// toward an authored [lo, hi] pole, anchored on a one-time snapshot" design, whose snapshot could
// silently inherit an already-boosted value for any key a preset didn't redefine, making the
// macro appear to "stick" after a few preset changes. ───────────────────────────────────────────

test('a centered macro (the shipped default) reproduces the base value exactly for every key', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning } = load();
  const base = cloneDefaultVisualTuning();
  base.wormholeSpeed = 4.8; // an arbitrary "preset dramaturgy" value
  base.audioSensitivity = 0.42;
  base.wormholeNebulaAmount = 0.77;

  const result = mapMvpMacrosToTuning(defaultMvpMacroTuning, base);

  assert.ok(Math.abs(result.wormholeSpeed - 4.8) < 1e-9);
  assert.ok(Math.abs(result.audioSensitivity - 0.42) < 1e-9);
  assert.ok(Math.abs(result.wormholeNebulaAmount - 0.77) < 1e-9);
});

test('a preset dramaturgy swing survives under default (neutral) macros: establish vs drive stay distinct', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning } = load();
  const establish = cloneDefaultVisualTuning();
  establish.wormholeSpeed = 1.2;
  const drive = cloneDefaultVisualTuning();
  drive.wormholeSpeed = 4.8;

  const resultEstablish = mapMvpMacrosToTuning(defaultMvpMacroTuning, establish);
  const resultDrive = mapMvpMacrosToTuning(defaultMvpMacroTuning, drive);

  assert.notEqual(resultEstablish.wormholeSpeed, resultDrive.wormholeSpeed);
});

test('a fully-open macro slider (100%) multiplies the live base by BOOST_GAIN_MAX, whatever the base is', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning, BOOST_GAIN_MAX, visualTuningControls } = load();
  const control = visualTuningControls.find((c) => c.key === 'wormholeSpeed');

  for (const base of [1.2, 4.8]) {
    const tuning = cloneDefaultVisualTuning();
    tuning.wormholeSpeed = base;
    const result = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, motion: 1 }, tuning);
    const expected = Math.min(control.max, base * BOOST_GAIN_MAX);
    assert.ok(Math.abs(result.wormholeSpeed - expected) < 1e-9, `base=${base}: got ${result.wormholeSpeed}, expected ${expected}`);
  }
});

test('a fully-closed macro slider (0%) fades the live base all the way to zero, for a key whose own authored floor is 0', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning, visualTuningControls } = load();
  const control = visualTuningControls.find((c) => c.key === 'wormholeWarp');
  assert.equal(control.min, 0, 'test assumes wormholeWarp\'s own authored floor is 0');
  const base = cloneDefaultVisualTuning();
  base.wormholeWarp = 3.2;

  const result = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, motion: 0 }, base);

  assert.ok(Math.abs(result.wormholeWarp - 0) < 1e-9);
});

test('a fully-closed macro slider (0%) is still clamped to a key\'s own authored floor when that floor is above zero', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning, visualTuningControls } = load();
  const control = visualTuningControls.find((c) => c.key === 'wormholeSpeed');
  assert.ok(control.min > 0, 'test assumes wormholeSpeed has a positive authored floor');
  const base = cloneDefaultVisualTuning();
  base.wormholeSpeed = 4.8;

  const result = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, motion: 0 }, base);

  assert.ok(Math.abs(result.wormholeSpeed - control.min) < 1e-9);
});

test('repeated non-monotonic macro moves stay fully reversible against a fixed base (no compounding/hysteresis)', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning } = load();
  const base = cloneDefaultVisualTuning();
  base.wormholeNebulaAmount = 0.5;

  const up = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, detail: 1 }, base).wormholeNebulaAmount;
  const backToCenter = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, detail: 0.5 }, base).wormholeNebulaAmount;
  const upAgain = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, detail: 1 }, base).wormholeNebulaAmount;

  assert.ok(Math.abs(backToCenter - base.wormholeNebulaAmount) < 1e-9, 'centered macro must reproduce the base exactly');
  assert.ok(Math.abs(up - upAgain) < 1e-9, 'the same slider position must produce the same result every time, regardless of history');
});

test('dropDampening is inverted: raising Intensity reduces it (a harder-hitting drop), not raises it', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning } = load();
  const base = cloneDefaultVisualTuning();
  base.dropDampening = 1.0;

  const highIntensity = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, intensity: 1 }, base).dropDampening;
  const lowIntensity = mapMvpMacrosToTuning({ ...defaultMvpMacroTuning, intensity: 0 }, base).dropDampening;

  assert.ok(highIntensity < base.dropDampening, 'max Intensity should reduce dropDampening below the base');
  assert.ok(lowIntensity > highIntensity, 'min Intensity should leave more dropDampening than max Intensity');
});

test('the Intensity macro leaves audioSensitivity alone at center, so a moment\'s Strength survives', () => {
  const { cloneDefaultVisualTuning, defaultMvpMacroTuning, mapMvpMacrosToTuning } = load();
  const base = cloneDefaultVisualTuning();
  base.audioSensitivity = 3.5; // e.g. a high-Strength automation point

  const result = mapMvpMacrosToTuning(defaultMvpMacroTuning, base);

  assert.ok(Math.abs(result.audioSensitivity - 3.5) < 1e-9);
});

test('every macro-mapped output stays within its visualTuningControls bounds', () => {
  const { cloneDefaultVisualTuning, visualTuningControls, mapMvpMacrosToTuning } = load();
  const boundsByKey = new Map(visualTuningControls.map((c) => [c.key, c]));
  const base = cloneDefaultVisualTuning();
  // Push the base itself out to an extreme so the blend has room to overshoot if unclamped.
  for (const key of Object.keys(base)) {
    const control = boundsByKey.get(key);
    if (control) base[key] = control.max;
  }

  for (const macros of [
    { intensity: 0, motion: 0, depth: 0, detail: 0 },
    { intensity: 1, motion: 1, depth: 1, detail: 1 },
    { intensity: 0.5, motion: 0.5, depth: 0.5, detail: 0.5 }
  ]) {
    const result = mapMvpMacrosToTuning(macros, base);
    for (const [key, value] of Object.entries(result)) {
      const control = boundsByKey.get(key);
      if (!control) continue;
      assert.ok(value >= control.min - 1e-9 && value <= control.max + 1e-9, `${key}=${value} out of [${control.min}, ${control.max}]`);
    }
  }
});

// ─── boostFactor: the shared curve both Visual character and Advanced tuning sliders use ───────

test('boostFactor is neutral (1x) exactly at center', () => {
  const { boostFactor } = load();
  assert.equal(boostFactor(0.5), 1);
});

test('reused macro output matches fresh results without mutating raw tuning or unrelated fields', () => {
  const { cloneDefaultVisualTuning, mapMvpMacrosToTuning } = load();
  const scratch = cloneDefaultVisualTuning();
  for (let i = 0; i < 1000; i++) {
    const raw = cloneDefaultVisualTuning();
    raw.wormholeNebulaAmount = (i % 11) / 10;
    raw.wormholeSpeed = (i % 31) / 10;
    raw.lineWeight = (i % 17) / 10;
    const before = JSON.stringify(raw);
    const macros = { intensity: (i % 7) / 6, motion: (i % 9) / 8, depth: (i % 5) / 4, detail: (i % 11) / 10 };
    const expected = mapMvpMacrosToTuning(macros, raw);
    Object.assign(scratch, raw);
    assert.equal(mapMvpMacrosToTuning(macros, raw, scratch), scratch);
    for (const [key, value] of Object.entries(expected)) assert.equal(scratch[key], value);
    assert.equal(scratch.lineWeight, raw.lineWeight, 'unmapped tuning is retained');
    assert.equal(JSON.stringify(raw), before, 'raw preset/semantic tuning is read-only');
  }
});

test('boostFactor multiplies up to BOOST_GAIN_MAX at the top and fades to exactly 0 at the bottom', () => {
  const { boostFactor, BOOST_GAIN_MAX } = load();
  assert.ok(Math.abs(boostFactor(1) - BOOST_GAIN_MAX) < 1e-9);
  assert.equal(boostFactor(0), 0);
});
