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
  const context = vm.createContext({
    exports: {},
    require(request) {
      if (request === './featureFlags') return { featureFlags: { heroEffect: false } };
      throw new Error(`Unsupported import in test loader: ${request}`);
    },
    Math,
    Number
  });
  vm.runInContext(transpiled, context);
  return context.exports;
}

test('morphing moves current tuning values toward target tuning', () => {
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, audioSensitivity: 1 };
  const target = { ...defaultVisualTuning, audioSensitivity: 3, transitionSpeed: 0.25 };

  applyTuningMorph(current, target, target.transitionSpeed);

  assert.equal(current.audioSensitivity, 1.25);
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

test('long morphs crossfade wormhole emission mode instead of snapping in one frame', () => {
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, wormholeEmissionMode: 0 };
  const target = { ...defaultVisualTuning, wormholeEmissionMode: 2, morphDurationSec: 12, transitionSpeed: 0.25 };
  applyTuningMorph(current, target, target.transitionSpeed);
  assert.ok(current.wormholeEmissionMode > 0);
  assert.ok(current.wormholeEmissionMode < 2);
});

test('song-time morphing is equivalent at 30, 60, and 120 FPS', () => {
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const target = { ...defaultVisualTuning, wormholeCurve: 0.9, wormholeEmissionMode: 2, transitionSpeed: 0.18 };
  const values = [30, 60, 120].map((fps) => {
    const current = { ...defaultVisualTuning, wormholeCurve: 0, wormholeEmissionMode: 0 };
    for (let frame = 0; frame < fps * 2; frame++) applyTuningMorph(current, target, target.transitionSpeed, 1 / fps);
    return [current.wormholeCurve, current.wormholeEmissionMode];
  });
  assert.ok(Math.abs(values[0][0] - values[1][0]) < 1e-12);
  assert.ok(Math.abs(values[1][0] - values[2][0]) < 1e-12);
  assert.ok(Math.abs(values[0][1] - values[2][1]) < 1e-12);
});

test('zero song-time delta freezes morph state during pause', () => {
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, wormholeDepth: 1 };
  const target = { ...defaultVisualTuning, wormholeDepth: 4, transitionSpeed: 0.5 };
  applyTuningMorph(current, target, target.transitionSpeed, 0);
  assert.equal(current.wormholeDepth, 1);
});

test('discrete selector parameters snap immediately even at a zero song-time delta (VT-2.15/VT-2.16)', () => {
  // A zero delta freezes every continuous/interpolated morph (see the preceding test), but discrete
  // selector parameters are a general exception: they snap regardless of elapsed morph time,
  // including a zero delta. Proven here on an existing, pre-LFO discrete key (`heroBeepMode`) so the
  // rule reads as general behaviour, not something special-cased for the two new wormhole LFO keys.
  const { applyTuningMorph, defaultVisualTuning } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, heroBeepMode: 0 };
  const target = { ...defaultVisualTuning, heroBeepMode: 3, transitionSpeed: 0.5 };
  applyTuningMorph(current, target, target.transitionSpeed, 0);
  assert.equal(current.heroBeepMode, 3);
});

test('morph clock resets on first frame, seek, large jump, and export clock switch', () => {
  const { tuningMorphDeltaSec } = loadVisualTuningModule();
  assert.equal(tuningMorphDeltaSec(10, null), 0);
  assert.equal(tuningMorphDeltaSec(4, 10), 0);
  assert.equal(tuningMorphDeltaSec(20, 10), 0);
  assert.equal(tuningMorphDeltaSec(10.016, 10, true), 0);
  assert.ok(Math.abs(tuningMorphDeltaSec(10 + 1 / 60, 10) - 1 / 60) < 1e-12);
});

test('a reset morph frame does not surge toward a new preset', () => {
  const { applyTuningMorph, defaultVisualTuning, tuningMorphDeltaSec } = loadVisualTuningModule();
  const current = { ...defaultVisualTuning, wormholePathBend: 0 };
  const target = { ...defaultVisualTuning, wormholePathBend: 1, transitionSpeed: 1 };
  applyTuningMorph(current, target, target.transitionSpeed, tuningMorphDeltaSec(40, null));
  assert.equal(current.wormholePathBend, 0);
});
