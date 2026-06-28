import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadTypeScriptModule(relativePath) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Math, Number });
  return module.exports;
}

test('long wormhole and hero playback never allocates or accumulates shockwaves', () => {
  const { ShockwaveLifecycle } = loadTypeScriptModule('src/visuals/ShockwaveLifecycle.ts');
  const lifecycle = new ShockwaveLifecycle('cosmic-wormhole');
  let allocations = 0;

  for (let i = 0; i < 100_000; i++) {
    lifecycle.emit('cosmic-wormhole', () => ({ id: allocations++ }));
    lifecycle.emit('hero', () => ({ id: allocations++ }));
  }

  assert.equal(lifecycle.items.length, 0);
  assert.equal(allocations, 0);
});

test('visual mode changes clear accumulated shockwaves without owning dramaturgy state', () => {
  const { ShockwaveLifecycle } = loadTypeScriptModule('src/visuals/ShockwaveLifecycle.ts');
  const lifecycle = new ShockwaveLifecycle('classic');

  for (let i = 0; i < 250; i++) lifecycle.emit('classic', () => ({ id: i }));
  assert.equal(lifecycle.items.length, 250);
  assert.equal(lifecycle.syncMode('cosmic-wormhole'), true);
  assert.equal(lifecycle.items.length, 0);
  assert.equal(lifecycle.syncMode('cosmic-wormhole'), false);
});

test('depth wrapping stays within the live horizon and maps exact zero to epsilon', () => {
  const { wrapDepth } = loadTypeScriptModule('src/visuals/WormholeDepth.ts');

  assert.equal(wrapDepth(1500, 1000), 500);
  assert.equal(wrapDepth(-10, 1000), 990);
  assert.equal(wrapDepth(1000, 1000), 1e-3);
  assert.equal(wrapDepth(Number.NaN, 1000), 1e-3);
  assert.ok(wrapDepth(4999, 500) > 0 && wrapDepth(4999, 500) < 500);
});
