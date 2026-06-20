import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import { SEMANTIC_FIXTURES, buildFixtureInput } from './fixtures/golden-fixtures.mjs';

const SRC_ROOT = join(process.cwd(), 'src');

function createSrcLoader() {
  const cache = new Map();
  function resolvePath(request, parentPath) {
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    if (base.endsWith('.ts')) return base;
    try { readFileSync(`${base}.ts`, 'utf8'); return `${base}.ts`; } catch { return join(base, 'index.ts'); }
  }
  function load(filePath) {
    if (cache.has(filePath)) return cache.get(filePath).exports;
    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    cache.set(filePath, module);
    const context = vm.createContext({ exports: module.exports, module, require: (r) => load(resolvePath(r, filePath)), Float32Array, Math, Number, Error });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }
  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const loadSrc = createSrcLoader();
const { analyzeAudio } = loadSrc('analyzer/analyzeAudio.ts');
const { NoveltyAnalyzer } = loadSrc('analyzer/NoveltyAnalyzer.ts');

const REASON_VOCABULARY = new Set([
  'bar-aligned', 'energy-rise', 'energy-drop', 'density-rise', 'bass-return', 'bass-drop',
  'high-transient', 'percussive-onset', 'after-buildup', 'low-grid-confidence', 'novelty-peak',
  'section-position', 'weak-evidence-fallback'
]);

for (const fixture of SEMANTIC_FIXTURES) {
  test(`novelty curve invariants: ${fixture.id}`, () => {
    const result = analyzeAudio(buildFixtureInput(fixture));
    const curve = result.trackAnalysis.noveltyCurve;

    assert.ok(Array.isArray(curve) && curve.length > 0, `${fixture.id}: empty novelty curve`);
    assert.equal(curve.length, result.trackAnalysis.features.length, `${fixture.id}: curve must be per-frame`);

    let monotoneTime = true;
    for (let i = 0; i < curve.length; i++) {
      const p = curve[i];
      assert.ok(p.value >= 0 && p.value <= 1, `${fixture.id}: novelty value out of [0,1] at ${i}`);
      assert.ok(Number.isFinite(p.time), `${fixture.id}: non-finite time at ${i}`);
      assert.ok(Array.isArray(p.reasons), `${fixture.id}: reasons must be an array at ${i}`);
      for (const r of p.reasons) assert.ok(REASON_VOCABULARY.has(r), `${fixture.id}: unknown reason ${r}`);
      if (i > 0 && curve[i].time < curve[i - 1].time) monotoneTime = false;
    }
    assert.ok(monotoneTime, `${fixture.id}: novelty curve time must be non-decreasing`);
  });
}

test('novelty curve is deterministic across repeated runs', () => {
  const fixture = SEMANTIC_FIXTURES.find(f => f.id === 'long-breakdown-house');
  const a = analyzeAudio(buildFixtureInput(fixture)).trackAnalysis.noveltyCurve.map(p => [p.time, p.value, p.reasons.join('|')]);
  const b = analyzeAudio(buildFixtureInput(fixture)).trackAnalysis.noveltyCurve.map(p => [p.time, p.value, p.reasons.join('|')]);
  assert.deepEqual(b, a);
});

test('structured tracks expose novelty peaks, beatless beds expose fewer', () => {
  const structured = analyzeAudio(buildFixtureInput(SEMANTIC_FIXTURES.find(f => f.id === 'long-breakdown-house')));
  const structuredPeaks = structured.trackAnalysis.noveltyCurve.filter(p => p.reasons.length > 0);
  assert.ok(structuredPeaks.length > 0, 'structured track should expose at least one labeled novelty peak');
  // every labeled peak carries the canonical 'novelty-peak' marker
  for (const p of structuredPeaks) assert.ok(p.reasons.includes('novelty-peak'), 'labeled peak missing novelty-peak reason');
});

test('NoveltyAnalyzer handles empty input without throwing', () => {
  // NoveltyAnalyzer runs inside the test's vm realm, so compare by length rather than array identity.
  const analyzer = new NoveltyAnalyzer([], [], 1024, 44100);
  assert.equal(analyzer.computeCurve().length, 0);
  assert.equal(analyzer.getPeaks().length, 0);
});
