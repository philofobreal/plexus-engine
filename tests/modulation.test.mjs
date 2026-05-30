import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadVisualTuningModule() {
  const source = readFileSync(join(process.cwd(), 'src/config/visualTuning.ts'), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const context = vm.createContext({ exports: {}, Math, Number });
  vm.runInContext(transpiled, context);
  return context.exports;
}

test('modulation bus keeps all outputs in the normalized range', () => {
  const { computeModulationBus, defaultVisualTuning } = loadVisualTuningModule();
  const frame = { e: 3, b: 2, m: 0.4, t: 1.8, state: 'HIGH', eRatio: 1.5 };
  const features = { melody: 1.4, vocal: 1.2, fx: 2, density: 1.7, brightness: 1.3, tension: 1.6 };
  const modulation = computeModulationBus(frame, features, 1.8, 1.5, { ...defaultVisualTuning, audioSensitivity: 3 });

  for (const value of Object.values(modulation)) {
    assert.ok(value >= 0);
    assert.ok(value <= 1);
  }
});

test('audioSensitivity linearly scales modulation values until clamped', () => {
  const { computeModulationBus, defaultVisualTuning } = loadVisualTuningModule();
  const frame = { e: 0.1, b: 0.1, m: 0.1, t: 0.1, state: 'HIGH', eRatio: 0.1 };
  const features = { melody: 0.1, vocal: 0.1, fx: 0.1, density: 0.1, brightness: 0.1, tension: 0.1 };
  const half = computeModulationBus(frame, features, 0.1, 0.1, { ...defaultVisualTuning, audioSensitivity: 0.5 });
  const normal = computeModulationBus(frame, features, 0.1, 0.1, { ...defaultVisualTuning, audioSensitivity: 1 });
  const double = computeModulationBus(frame, features, 0.1, 0.1, { ...defaultVisualTuning, audioSensitivity: 2 });

  for (const key of Object.keys(normal)) {
    assert.equal(Number(normal[key].toFixed(6)), Number((half[key] * 2).toFixed(6)));
    assert.equal(Number(double[key].toFixed(6)), Number((normal[key] * 2).toFixed(6)));
  }
});

test('writeModulationBus mutates and returns the caller-owned modulation object', () => {
  const { computeModulationBus, writeModulationBus, defaultVisualTuning } = loadVisualTuningModule();
  const frame = { e: 0.7, b: 0.5, m: 0.25, t: 0.9, state: 'HIGH', eRatio: 1.1 };
  const features = { melody: 0.8, vocal: 0.4, fx: 0.7, density: 0.6, brightness: 0.9, tension: 0.5 };
  const target = {
    kineticTension: -1,
    lowFrequencyDrive: -1,
    spectralChaos: -1,
    rhythmicImpulse: -1,
    macroMomentum: -1
  };
  const expected = computeModulationBus(frame, features, 0.3, 0.2, defaultVisualTuning);

  const returned = writeModulationBus(target, frame, features, 0.3, 0.2, defaultVisualTuning);

  assert.equal(returned, target);
  assert.deepEqual({ ...target }, { ...expected });
});

test('hueToRgbInto matches hueToRgb, returns the provided tuple, and normalizes hue', () => {
  const { hueToRgb, hueToRgbInto } = loadVisualTuningModule();
  const target = [0, 0, 0];

  const returned = hueToRgbInto(target, -30);

  assert.equal(returned, target);
  assert.deepEqual(Array.from(target), Array.from(hueToRgb(-30)));
  assert.deepEqual(Array.from(target), Array.from(hueToRgb(330)));

  hueToRgbInto(target, 390, 80, 45);
  assert.deepEqual(Array.from(target), Array.from(hueToRgb(30, 80, 45)));
});
