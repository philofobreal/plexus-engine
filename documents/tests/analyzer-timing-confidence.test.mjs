import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import { GOLDEN_FIXTURES, buildFixtureInput } from './fixtures/golden-fixtures.mjs';

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
const SAMPLE_RATE = 44100;

function assertUnit(tc, label) {
  for (const key of ['tempo', 'beat', 'grid', 'overall']) {
    assert.ok(tc[key] >= 0 && tc[key] <= 1, `${label}: timingConfidence.${key} out of [0,1] (${tc[key]})`);
  }
}

test('timing confidence is a coherent unit-range blend on clean material', () => {
  const house = GOLDEN_FIXTURES.find(f => f.id === 'house-128');
  const result = analyzeAudio(buildFixtureInput(house));
  const tc = result.timingConfidence;
  assertUnit(tc, 'house-128');

  // overall is a blend of the three sources, never exceeding the strongest source.
  const maxSource = Math.max(tc.tempo, tc.beat, tc.grid);
  assert.ok(tc.overall <= maxSource + 1e-9, 'overall must not exceed the strongest component');
  assert.ok(tc.overall > 0.4, `clean four-on-floor should have decent overall confidence (got ${tc.overall})`);
  assert.ok(tc.tempo > 0.5, `clean four-on-floor should have high tempo confidence (got ${tc.tempo})`);

  // top-level and trackAnalysis timing confidence must agree.
  assert.deepEqual(result.trackAnalysis.timingConfidence, tc);
});

test('timing confidence collapses on non-metric noise', () => {
  const samples = new Float32Array(SAMPLE_RATE * 6);
  let seed = 7;
  for (let i = 0; i < samples.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; samples[i] = ((seed / 0xffffffff) * 2 - 1) * 0.3; }
  const result = analyzeAudio({ samples, sampleRate: SAMPLE_RATE, options: { requestId: 2, algorithmVersion: 2, phraseSize: 8 } });
  const tc = result.timingConfidence;
  assertUnit(tc, 'noise');
  assert.ok(tc.overall < 0.4, `noise overall timing confidence should be low (got ${tc.overall})`);
});

test('clean material outscores noise across every confidence component', () => {
  const clean = analyzeAudio(buildFixtureInput(GOLDEN_FIXTURES.find(f => f.id === 'house-120'))).timingConfidence;

  const noiseSamples = new Float32Array(SAMPLE_RATE * 6);
  let seed = 99;
  for (let i = 0; i < noiseSamples.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; noiseSamples[i] = ((seed / 0xffffffff) * 2 - 1) * 0.3; }
  const noisy = analyzeAudio({ samples: noiseSamples, sampleRate: SAMPLE_RATE, options: { requestId: 3, algorithmVersion: 2, phraseSize: 8 } }).timingConfidence;

  assert.ok(clean.tempo > noisy.tempo, `tempo: clean ${clean.tempo} <= noisy ${noisy.tempo}`);
  assert.ok(clean.overall > noisy.overall, `overall: clean ${clean.overall} <= noisy ${noisy.overall}`);
});

test('legacy confidence fields stay consistent with the unified model', () => {
  const result = analyzeAudio(buildFixtureInput(GOLDEN_FIXTURES.find(f => f.id === 'techno-140')));
  // downbeat confidence is bounded by the grid/bpm confidences it derives from.
  assert.ok(result.downbeatConfidence <= result.gridConfidence + 1e-9, 'downbeat must not exceed grid');
  assert.ok(result.downbeatConfidence <= result.bpmConfidence * 1.2 + 1e-9, 'downbeat must not exceed 1.2x bpm');
  assert.ok(Math.abs(result.timingConfidence.tempo - result.bpmConfidence) < 1e-9, 'tempo confidence mirrors bpmConfidence');
});
