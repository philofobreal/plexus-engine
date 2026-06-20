import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import { GOLDEN_FIXTURES, SEMANTIC_FIXTURES, buildFixtureInput, coverage, isMetricMatch } from './fixtures/golden-fixtures.mjs';

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

// Semantic/dramaturgy suite: structural correctness (section count, drop arrival, grid-vs-novelty
// fallback) asserted as ranges so it stays meaningful through later section/dramaturgy changes.
for (const fixture of SEMANTIC_FIXTURES) {
  test(`semantic: ${fixture.id}`, () => {
    const gt = fixture.groundTruth;
    const result = analyzeAudio(buildFixtureInput(fixture));
    const sections = result.trackAnalysis.sections;

    // (a) section segmentation produces a musically plausible number of sections
    const [minSections, maxSections] = gt.expectedSectionCountRange;
    assert.ok(
      sections.length >= minSections && sections.length <= maxSections,
      `${fixture.id}: section count ${sections.length} outside [${minSections}, ${maxSections}]`
    );

    // (b) beatless beds must not pretend to have a confident tempo grid
    if (gt.gridless) {
      assert.ok(
        result.gridConfidence <= gt.maxGridConfidence,
        `${fixture.id}: gridConfidence ${result.gridConfidence.toFixed(3)} > ${gt.maxGridConfidence} for a beatless track`
      );
    }

    // (c) a structural high-energy arrival (drop/peak/build) lands near the known drop time
    if (gt.expectedDropTime != null) {
      const tol = gt.dropTolerance ?? 2.0;
      const arrival = sections.find(s =>
        (s.label === 'drop' || s.label === 'peak' || s.label === 'build') &&
        Math.abs(s.start - gt.expectedDropTime) <= tol
      );
      assert.ok(
        arrival,
        `${fixture.id}: no drop/peak/build section within ${tol}s of expected drop ${gt.expectedDropTime}; ` +
          `got ${sections.map(s => `${s.label}@${s.start.toFixed(2)}`).join(', ')}`
      );
    }

    // (d) timing confidence stays a coherent unit-range model
    const tc = result.timingConfidence;
    for (const key of ['tempo', 'beat', 'grid', 'overall']) {
      assert.ok(tc[key] >= 0 && tc[key] <= 1, `${fixture.id}: timingConfidence.${key} out of range`);
    }

    // (e) determinism: identical input yields identical section boundaries
    const repeat = analyzeAudio(buildFixtureInput(fixture));
    assert.deepEqual(
      repeat.trackAnalysis.sections.map(s => [s.start, s.label]),
      sections.map(s => [s.start, s.label]),
      `${fixture.id}: section segmentation is not deterministic`
    );

    // (f) timing-mode honesty: a trusted grid yields only bar-aligned candidates; an untrusted
    // grid yields only novelty/energy-reactive ones (never a false bar-aligned claim).
    const trustedGrid = result.gridConfidence >= 0.15 || result.bpmConfidence >= 0.20;
    for (const candidate of result.trackAnalysis.boundaryCandidates) {
      if (trustedGrid) {
        assert.equal(candidate.timingMode, 'bar-aligned', `${fixture.id}: trusted-grid candidate must be bar-aligned, got ${candidate.timingMode}`);
      } else {
        assert.ok(candidate.timingMode === 'novelty' || candidate.timingMode === 'energy-reactive', `${fixture.id}: untrusted-grid candidate must be novelty/energy-reactive, got ${candidate.timingMode}`);
      }
    }

    // (g) a novelty peak supports the structural drop arrival
    if (gt.expectedDropTime != null) {
      const tol = Math.max(2.0, gt.dropTolerance ?? 2.0);
      assert.ok(
        result.trackAnalysis.noveltyPeaks.some(p => Math.abs(p.time - gt.expectedDropTime) <= tol),
        `${fixture.id}: no novelty peak within ${tol}s of drop ${gt.expectedDropTime}; ` +
          `peaks @ ${result.trackAnalysis.noveltyPeaks.map(p => p.time.toFixed(1)).join(', ')}`
      );
    }
  });
}

test('semantic: structured tracks expose more novelty peaks than beatless beds', () => {
  const peakCount = (id) => analyzeAudio(buildFixtureInput(SEMANTIC_FIXTURES.find(f => f.id === id))).trackAnalysis.noveltyPeaks.length;
  const ambient = peakCount('ambient-no-grid');
  const structured = peakCount('long-breakdown-house');
  assert.ok(ambient < structured, `ambient peak count ${ambient} should be < structured ${structured}`);
});
