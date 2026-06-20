import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import { GOLDEN_FIXTURES, buildFixtureInput, coverage, isMetricMatch } from './fixtures/golden-fixtures.mjs';

const SRC_ROOT = join(process.cwd(), 'src');

function createSrcLoader() {
  const moduleCache = new Map();
  function resolvePath(request, parentPath) {
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    if (base.endsWith('.ts')) return base;
    try { readFileSync(`${base}.ts`, 'utf8'); return `${base}.ts`; } catch { return join(base, 'index.ts'); }
  }
  function load(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;
    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const context = vm.createContext({ exports: module.exports, module, require: (r) => load(resolvePath(r, filePath)), Float32Array, Math, Number, Error });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }
  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const { analyzeAudio } = createSrcLoader()('analyzer/analyzeAudio.ts');

// Musical-correctness suite: each fixture has a known tempo/beat/bar grid. We require the
// engine to (a) report a metrically-correct tempo, (b) emit beats that are phase-accurate to
// the true grid (precision — every reported beat is a real beat), and (c) place bar starts on
// true downbeats. Half/double-time reads are accepted as metrically correct.
for (const fixture of GOLDEN_FIXTURES) {
  test(`verification: ${fixture.id}`, () => {
    const gt = fixture.groundTruth;
    const result = analyzeAudio(buildFixtureInput(fixture));

    // (a) tempo correctness. Strict fixtures (e.g. drum & bass) must lock the actual beat
    // rate, not a half/double-time multiple; others accept a metric multiple.
    if (gt.strictTempo) {
      assert.ok(
        Math.abs(result.bpm - gt.expectedBpm) <= gt.allowedBpmError,
        `${fixture.id}: bpm ${result.bpm} must equal ${gt.expectedBpm} +/- ${gt.allowedBpmError} (no half/double allowed)`
      );
    } else {
      assert.ok(
        isMetricMatch(result.bpm, gt.expectedBpm, gt.allowedBpmError),
        `${fixture.id}: bpm ${result.bpm} is not a metric match for ${gt.expectedBpm}`
      );
    }

    // (b) beat precision: reported beats land on true beat positions
    assert.ok(result.beats.length > 0, `${fixture.id}: no beats produced`);
    const beatPrecision = coverage(result.beats, gt.expectedBeatPositions, gt.allowedBeatTolerance);
    assert.ok(beatPrecision >= 0.8, `${fixture.id}: beat precision ${beatPrecision.toFixed(2)} < 0.8`);

    // beats should not be unreasonably sparse relative to the true grid (allows half-time)
    const beatRecall = coverage(gt.expectedBeatPositions, result.beats, gt.allowedBeatTolerance);
    assert.ok(beatRecall >= 0.4, `${fixture.id}: beat recall ${beatRecall.toFixed(2)} < 0.4`);

    // (c) bar starts land on true downbeats
    assert.ok(result.barStarts.length > 0, `${fixture.id}: no bar starts produced`);
    const barPrecision = coverage(result.barStarts, gt.expectedBarStarts, gt.allowedBarTolerance);
    assert.ok(barPrecision >= 0.7, `${fixture.id}: bar precision ${barPrecision.toFixed(2)} < 0.7`);

    // timing confidence must be a coherent unit-range model
    const tc = result.timingConfidence;
    for (const key of ['tempo', 'beat', 'grid', 'overall']) {
      assert.ok(tc[key] >= 0 && tc[key] <= 1, `${fixture.id}: timingConfidence.${key} out of range`);
    }
  });
}
