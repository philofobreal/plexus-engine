import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Phase 8 of the wormhole refractive membrane wall plan (documents/audits/wormhole-wall-membrane-plan.md):
// pure grid sizing and tick-shape geometry for the optional pixel-mosaic material mode. Cell
// placement itself reuses WormholeWallGeometry's ring/segment layout (tested separately); this only
// covers what's new here -- grid counts and the tick half-width formula.

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

function loadMosaic() {
  return createSourceLoader()('visuals/WormholeWallMosaic.ts');
}

test('wormholeMosaicRingCount halves (roughly) in performance mode', () => {
  const { wormholeMosaicRingCount, MOSAIC_RINGS, MOSAIC_RINGS_PERFORMANCE } = loadMosaic();
  assert.equal(wormholeMosaicRingCount(false), MOSAIC_RINGS);
  assert.equal(wormholeMosaicRingCount(true), MOSAIC_RINGS_PERFORMANCE);
  assert.ok(MOSAIC_RINGS_PERFORMANCE < MOSAIC_RINGS, 'performance ring count must be lower');
});

test('MOSAIC_SEGMENTS matches the 24-band spectral convention exactly (one cell column per band)', () => {
  const { MOSAIC_SEGMENTS } = loadMosaic();
  assert.equal(MOSAIC_SEGMENTS, 24);
});

test('wormholeMosaicTickHalfWidth is deterministic and strictly less than half the cell span', () => {
  const { wormholeMosaicTickHalfWidth } = loadMosaic();
  for (const segmentCount of [4, 12, 24, 48, 96]) {
    const halfWidth = wormholeMosaicTickHalfWidth(segmentCount);
    const cellSpan = (Math.PI * 2) / segmentCount;
    assert.ok(halfWidth > 0, `segmentCount=${segmentCount}: half-width must be positive`);
    assert.ok(halfWidth < cellSpan / 2, `segmentCount=${segmentCount}: tick must stay within its own cell (no touching neighbors)`);
    assert.equal(wormholeMosaicTickHalfWidth(segmentCount), halfWidth, 'deterministic for identical input');
  }
});

test('wormholeMosaicTickHalfWidth shrinks as segmentCount grows (narrower cells -> narrower ticks)', () => {
  const { wormholeMosaicTickHalfWidth } = loadMosaic();
  const coarse = wormholeMosaicTickHalfWidth(12);
  const fine = wormholeMosaicTickHalfWidth(48);
  assert.ok(fine < coarse, 'more segments must produce a narrower tick');
});

test('wormholeMosaicTickHalfWidth treats non-finite/invalid input defensively instead of throwing', () => {
  const { wormholeMosaicTickHalfWidth } = loadMosaic();
  for (const bad of [NaN, Infinity, -Infinity, 0, -5]) {
    assert.doesNotThrow(() => wormholeMosaicTickHalfWidth(bad));
    assert.ok(Number.isFinite(wormholeMosaicTickHalfWidth(bad)) && wormholeMosaicTickHalfWidth(bad) > 0);
  }
});
