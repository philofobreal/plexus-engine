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

test('transparent chroma key mode clears to fully transparent output', () => {
  const { defaultVisualTuning, getBackgroundClearStyle } = loadVisualTuningModule();
  const clear = getBackgroundClearStyle({ ...defaultVisualTuning, chromaKeyMode: 2 }, 20);

  assert.equal(clear.r, 0);
  assert.equal(clear.g, 0);
  assert.equal(clear.b, 0);
  assert.equal(clear.a, 0);
});

test('performance mode disables radial gradient glow work', () => {
  const { defaultVisualTuning, shouldUseExpensiveGlow } = loadVisualTuningModule();

  assert.equal(shouldUseExpensiveGlow({ ...defaultVisualTuning, performanceMode: 0, chromaKeyMode: 0 }), true);
  assert.equal(shouldUseExpensiveGlow({ ...defaultVisualTuning, performanceMode: 1, chromaKeyMode: 0 }), false);
  assert.equal(shouldUseExpensiveGlow({ ...defaultVisualTuning, performanceMode: 0, chromaKeyMode: 1 }), false);
});

test('presentation URL parameter hides UI chrome through shared state', () => {
  const ui = readFileSync(join(process.cwd(), 'src/ui/DashboardUI.ts'), 'utf8');
  const state = readFileSync(join(process.cwd(), 'src/state/store.ts'), 'utf8');

  assert.match(state, /uiVisible: true/);
  assert.match(ui, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(ui, /params\.get\('presentation'\) !== 'true'/);
  assert.match(ui, /State\.uiVisible = false/);
  assert.match(ui, /document\.body\.classList\.add\('presentation-mode', 'chrome-idle'\)/);
});
