import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/config/previewQuality.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, { exports });
const { PreviewQualityPreference } = exports;

test('desktop reduced mode is reversible and independent of artwork or render history', () => {
  const preference = new PreviewQualityPreference(false);
  const sample = () => [preference.compactMaterialPreview, preference.pixelRatioCap, preference.maxBackingLongEdge];
  assert.deepEqual(sample(), [false, 2, 1920]);
  for (let i = 0; i < 5; i++) {
    preference.setMode('reduced');
    assert.deepEqual(sample(), [true, 1.25, 1280]);
    preference.setMode('auto');
    assert.deepEqual(sample(), [false, 2, 1920]);
  }
});

test('compact automatic mode, saved choices and invalid preferences keep safe defaults', () => {
  assert.equal(new PreviewQualityPreference(true).compactMaterialPreview, true);
  assert.equal(new PreviewQualityPreference(false, 'reduced').compactMaterialPreview, true);
  for (const saved of [null, '', 'unknown', {}, 1]) {
    assert.equal(new PreviewQualityPreference(false, saved).mode, 'auto');
  }
});
