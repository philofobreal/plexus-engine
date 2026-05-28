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

test('morphing moves current tuning values toward target tuning', () => {
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, audioSensitivity: 1 };
  const target = { ...defaultVisualTuning, audioSensitivity: 3, transitionSpeed: 0.25 };

  applyTuningMorph(current, target, target.transitionSpeed);

  assert.equal(current.audioSensitivity, 1.5);
  assert.ok(current.audioSensitivity > 1);
  assert.ok(current.audioSensitivity < 3);
});

test('morphing does not overshoot target values', () => {
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const rising = { ...defaultVisualTuning, lineWeight: 0 };
  const risingTarget = { ...defaultVisualTuning, lineWeight: 1 };
  const falling = { ...defaultVisualTuning, lineWeight: 1 };
  const fallingTarget = { ...defaultVisualTuning, lineWeight: 0 };

  applyTuningMorph(rising, risingTarget, 0.95);
  applyTuningMorph(falling, fallingTarget, 0.95);

  assert.ok(rising.lineWeight >= 0);
  assert.ok(rising.lineWeight <= 1);
  assert.ok(falling.lineWeight >= 0);
  assert.ok(falling.lineWeight <= 1);
});

test('morphing is stable when current and target values match', () => {
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning };
  const target = { ...defaultVisualTuning };

  applyTuningMorph(current, target, 0.4);

  assert.deepEqual(current, target);
});
