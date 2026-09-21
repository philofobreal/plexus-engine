import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

test('explicit line caps reach live/export targets and restore context even after a failed draw', () => {
  const source = readFileSync('src/visuals/P5RendererBackend.ts', 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    require(id) {
      if (id === '../state/store') return { State: {} };
      if (id === './CanvasFieldRasterSurface') return { CanvasFieldRasterSurface: class {} };
      if (id === 'p5') return {};
      throw new Error(id);
    }
  });
  const makeTarget = () => ({
    drawingContext: { lineCap: 'round' }, seen: [],
    line(...coords) { this.seen.push([this.drawingContext.lineCap, coords]); }
  });
  const live = makeTarget(), exported = makeTarget();
  const backend = new exports.P5RendererBackend(live);
  for (const target of [live, exported, live]) {
    live.__plexusExportTarget = target === live ? undefined : target;
    backend.line(1, 2, 3, 4, 'square');
    assert.equal(target.seen.at(-1)[0], 'square');
    assert.deepEqual(target.seen.at(-1)[1], [1, 2, 3, 4]);
    assert.equal(target.drawingContext.lineCap, 'round');
    backend.line(5, 6, 7, 8);
    assert.equal(target.seen.at(-1)[0], 'round', 'the next unstyled primitive must not inherit square ends');
  }
  live.line = () => { throw new Error('draw failed'); };
  assert.throws(() => backend.line(1, 2, 3, 4, 'square'), /draw failed/);
  assert.equal(live.drawingContext.lineCap, 'round');
});
