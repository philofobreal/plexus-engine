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
    const context = vm.createContext({ exports: module.exports, module, require: (r) => load(resolvePath(r, filePath)), Float32Array, Float64Array, Math, Number, Error, Array, Object });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }
  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const loadSrc = createSrcLoader();
const { analyzeAudio } = loadSrc('analyzer/analyzeAudio.ts');
const { NoveltyAnalyzer } = loadSrc('analyzer/NoveltyAnalyzer.ts');
const { SectionAnalyzer } = loadSrc('analyzer/SectionAnalyzer.ts');

const REASON_VOCABULARY = new Set([
  'bar-aligned', 'energy-rise', 'energy-drop', 'density-rise', 'bass-return', 'bass-drop',
  'high-transient', 'percussive-onset', 'after-buildup', 'low-grid-confidence', 'novelty-peak',
  'section-position', 'weak-evidence-fallback'
]);

for (const fixture of SEMANTIC_FIXTURES) {
  test(`novelty curve invariants: ${fixture.id}`, () => {
    const result = analyzeAudio(buildFixtureInput(fixture));
    const ta = result.trackAnalysis;
    const curve = ta.noveltyCurve;

    // Curve is a plain per-frame number[] (memory/clone friendly), values in [0,1].
    assert.ok(Array.isArray(curve) && curve.length > 0, `${fixture.id}: empty novelty curve`);
    assert.equal(curve.length, ta.features.length, `${fixture.id}: curve must be per-frame`);
    for (let i = 0; i < curve.length; i++) {
      assert.equal(typeof curve[i], 'number', `${fixture.id}: curve[${i}] not a number`);
      assert.ok(curve[i] >= 0 && curve[i] <= 1, `${fixture.id}: novelty value out of [0,1] at ${i}`);
    }

    // Reasons live only on the sparse peaks.
    assert.ok(Array.isArray(ta.noveltyPeaks), `${fixture.id}: noveltyPeaks must be an array`);
    let monotoneTime = true;
    for (let i = 0; i < ta.noveltyPeaks.length; i++) {
      const p = ta.noveltyPeaks[i];
      assert.ok(p.value >= 0 && p.value <= 1, `${fixture.id}: peak value out of [0,1]`);
      assert.ok(Array.isArray(p.reasons) && p.reasons.includes('novelty-peak'), `${fixture.id}: peak missing novelty-peak reason`);
      for (const r of p.reasons) assert.ok(REASON_VOCABULARY.has(r), `${fixture.id}: unknown reason ${r}`);
      if (i > 0 && p.time < ta.noveltyPeaks[i - 1].time) monotoneTime = false;
    }
    assert.ok(monotoneTime, `${fixture.id}: novelty peaks must be time-sorted`);
  });
}

test('novelty curve and peaks are deterministic across repeated runs', () => {
  const fixture = SEMANTIC_FIXTURES.find(f => f.id === 'long-breakdown-house');
  const a = analyzeAudio(buildFixtureInput(fixture)).trackAnalysis;
  const b = analyzeAudio(buildFixtureInput(fixture)).trackAnalysis;
  assert.deepEqual(Array.from(b.noveltyCurve), Array.from(a.noveltyCurve));
  assert.deepEqual(
    b.noveltyPeaks.map(p => [p.time, p.value, p.reasons.join('|')]),
    a.noveltyPeaks.map(p => [p.time, p.value, p.reasons.join('|')])
  );
});

test('NoveltyAnalyzer handles empty input without throwing', () => {
  const analyzer = new NoveltyAnalyzer([], [], 1024, 44100);
  assert.equal(analyzer.getCurveValues().length, 0);
  assert.equal(analyzer.getPeaks().length, 0);
});

// --- edge-case: track-start/end must not produce spurious novelty peaks ----------------

function makeFrame(e, density = e, fx = 0.1) {
  return {
    visual: { melody: 0.1, vocal: 0.1, fx, density, brightness: density * 0.5, tension: density },
    audio: {
      e, densityProj: density, melodyProj: 0.1, fxProj: fx,
      perceptualSpectrum: new Array(24).fill(e * 0.5), state: 'LOW', eRatio: e
    }
  };
}

test('novelty taper suppresses spurious peaks at the track edges', () => {
  const hop = 1024, sr = 44100;
  const n = 400; // ~9.28s
  const duration = n * hop / sr;
  const visual = [], audio = [];
  for (let i = 0; i < n; i++) {
    // A short fade-in over the first ~0.5s, a long stable body, and a genuine mid-track jump.
    const fadeIn = Math.min(1, i / 22);
    let e = 0.5 * fadeIn;
    if (i >= 200) e = 0.9; // sustained step change near t ~= 4.64s
    const f = makeFrame(e);
    visual.push(f.visual);
    audio.push(f.audio);
  }
  const peaks = new NoveltyAnalyzer(visual, audio, hop, sr).getPeaks();

  // No peak in the first or last second (edge windows are truncated/tapered).
  assert.ok(!peaks.some(p => p.time < 1.0), `unexpected edge peak near start: ${peaks.map(p => p.time.toFixed(2))}`);
  assert.ok(!peaks.some(p => p.time > duration - 1.0), `unexpected edge peak near end: ${peaks.map(p => p.time.toFixed(2))}`);
  // The real interior change is still detected.
  const midTime = 200 * hop / sr;
  assert.ok(peaks.some(p => Math.abs(p.time - midTime) <= 1.0), `interior change not detected near ${midTime.toFixed(2)}s`);
});

// --- low-grid boundaries must be novelty/energy-reactive, never bar-aligned ------------

test('low-grid SectionAnalyzer yields novelty/energy-reactive boundary candidates', () => {
  const totalFrames = 240;
  const rmsT = new Array(totalFrames).fill(0).map((_, i) => (i < 120 ? 0.2 : 0.85));
  const features = {
    totalFrames,
    rmsT,
    rawBassT: rmsT.map(v => v * 0.8),
    rawMidT: rmsT.map(v => v * 0.5),
    rawHighT: rmsT.map(v => v * 0.3),
    fluxT: rmsT.map((v, i) => Math.abs(v - (rmsT[i - 1] ?? v))),
    typRms: 0.5
  };
  const badGrid = { bpmConfidence: 0.1, gridConfidence: 0.1, gridOffset: 0, secondsPerBar: 0.2 };
  const visualFeatures = rmsT.map(v => ({ melody: 0.1, vocal: 0.1, fx: v > 0.7 ? 0.5 : 0.1, density: v, brightness: v * 0.5, tension: v }));
  // A strong novelty peak right at the energy change (t = 120 * 1 / 10 = 12s).
  const noveltyPeaks = [{ time: 12, value: 0.9, reasons: ['novelty-peak', 'energy-rise'] }];

  const segmenter = new SectionAnalyzer(features, badGrid, 10, 1);
  segmenter.calculate(visualFeatures, noveltyPeaks);

  assert.ok(segmenter.boundaryCandidates.length > 0, 'expected boundary candidates on a low-grid track');
  assert.ok(
    segmenter.boundaryCandidates.every(c => c.timingMode === 'novelty' || c.timingMode === 'energy-reactive'),
    `low-grid candidates must never be bar-aligned: ${segmenter.boundaryCandidates.map(c => c.timingMode).join(',')}`
  );
  assert.ok(
    segmenter.boundaryCandidates.some(c => c.timingMode === 'novelty'),
    'expected at least one novelty-snapped boundary near the strong peak'
  );
});
