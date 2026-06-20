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

function run(samples, requestId = 1) {
  return analyzeAudio({ samples, sampleRate: SAMPLE_RATE, options: { requestId, algorithmVersion: 2, phraseSize: 8 } });
}

function allFinite(arr) { return arr.every(v => Number.isFinite(v)); }

test('pure silence produces a finite, low-confidence result without throwing', () => {
  const result = run(new Float32Array(SAMPLE_RATE * 4));
  assert.ok(Number.isFinite(result.bpm));
  assert.ok(result.timingConfidence.overall <= 0.2, `silence overall confidence ${result.timingConfidence.overall}`);
  assert.ok(allFinite(result.beats) && allFinite(result.barStarts));
});

test('a pure click track recovers its tempo', () => {
  const samples = new Float32Array(SAMPLE_RATE * 6);
  const beat = 60 / 120;
  for (let t = 0.1; t < 6; t += beat) {
    const start = Math.floor(t * SAMPLE_RATE);
    for (let i = 0; i < 64; i++) { if (start + i < samples.length) samples[start + i] += Math.exp(-i / 12); }
  }
  const result = run(samples, 2);
  const metric = [1, 2, 0.5].some(r => Math.abs(result.bpm - 120 * r) <= 3);
  assert.ok(metric, `click track bpm ${result.bpm} not metric to 120`);
  assert.ok(result.beats.length > 4, 'click track should yield beats');
});

test('a mid-track tempo transition stays finite and plausible', () => {
  const samples = new Float32Array(SAMPLE_RATE * 8);
  const kick = (t, gain) => {
    const start = Math.floor(t * SAMPLE_RATE);
    for (let i = 0; i < SAMPLE_RATE * 0.16; i++) {
      const idx = start + i; if (idx >= samples.length) break;
      const tt = i / SAMPLE_RATE;
      samples[idx] += Math.sin(2 * Math.PI * (45 + 45 * Math.exp(-tt / 0.012)) * tt) * gain * Math.exp(-tt / 0.056);
    }
  };
  for (let t = 0.2; t < 4; t += 60 / 120) kick(t, 0.95);   // first half at 120
  for (let t = 4; t < 8; t += 60 / 140) kick(t, 0.95);     // second half at 140
  for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i]);
  const result = run(samples, 3);
  assert.ok(result.bpm >= 100 && result.bpm <= 160, `transition bpm ${result.bpm} implausible`);
  assert.ok(allFinite(result.beats), 'beats must be finite through a tempo change');
  assert.ok(result.beats.length > 8, 'tempo-changing track should still be tracked');
});

test('the grid spans a silent breakdown but visual events do not flood it', () => {
  const fixture = GOLDEN_FIXTURES.find(f => f.id === 'breakdown-124');
  const result = analyzeAudio(buildFixtureInput(fixture));
  // breakdown silence window is [3.5, 5.5].
  const GAP_LO = 3.7;
  const GAP_HI = 5.3;

  // (1) the musical grid is continuous: beats are extrapolated through the silence.
  const gridInGap = result.beats.filter(b => b >= GAP_LO && b <= GAP_HI);
  assert.ok(gridInGap.length >= 2, `grid should extrapolate through the breakdown, got ${gridInGap.length}`);

  // (2) but the visual beat events are NOT fired on silent extrapolated beats.
  const eventsInGap = result.events.filter(e => e.time >= GAP_LO && e.time <= GAP_HI);
  const eventsOutsideGap = result.events.filter(e => e.time < GAP_LO || e.time > GAP_HI);
  assert.ok(eventsOutsideGap.length > 0, 'active sections must still produce beat events');
  assert.ok(
    eventsInGap.length < gridInGap.length,
    `visual events in the breakdown (${eventsInGap.length}) should be fewer than grid beats (${gridInGap.length})`
  );
});

test('repeated analysis of the same buffer is byte-identical (determinism)', () => {
  const fixture = GOLDEN_FIXTURES.find(f => f.id === 'techno-140');
  const a = analyzeAudio(buildFixtureInput(fixture));
  const b = analyzeAudio(buildFixtureInput(fixture));
  assert.deepEqual(JSON.parse(JSON.stringify(b.beats)), JSON.parse(JSON.stringify(a.beats)));
  assert.deepEqual(JSON.parse(JSON.stringify(b.barStarts)), JSON.parse(JSON.stringify(a.barStarts)));
  assert.equal(b.bpm, a.bpm);
});
