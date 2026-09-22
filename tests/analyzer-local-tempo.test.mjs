import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { GOLDEN_FIXTURES } from './fixtures/golden-fixtures.mjs';

const SRC_ROOT = join(process.cwd(), 'src');

function createSrcLoader() {
  const moduleCache = new Map();
  function resolvePath(request, parentPath) {
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    if (base.endsWith('.ts')) return base;
    try {
      readFileSync(`${base}.ts`, 'utf8');
      return `${base}.ts`;
    } catch {
      return join(base, 'index.ts');
    }
  }
  function load(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;
    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const context = vm.createContext({
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      Float32Array,
      Math,
      Number,
      Error
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }
  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const loadSrc = createSrcLoader();
const { estimateTempo } = loadSrc('analyzer/TempoEstimator.ts');
const { GridAligner } = loadSrc('analyzer/GridAligner.ts');
const FPS = 50;

function pulses(seconds, regions) {
  const env = new Float32Array(Math.round(seconds * FPS));
  for (const { start = 0.2, end = seconds, bpm = 128, gain = 1 } of regions) {
    for (let t = start; t < end; t += 60 / bpm) env[Math.round(t * FPS)] = gain;
  }
  return env;
}

function tempo(env) { return estimateTempo(env, 48000, 960); }
function near(actual, expected, tolerance = 2) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected} +/- ${tolerance}, got ${actual}`);
}

test('local tempo: recurring quiet rhythm beats a short loud competing rhythm', () => {
  const env = pulses(90, [
    { start: 0.2, end: 10, bpm: 100, gain: 30 },
    { start: 12.2, end: 90, bpm: 128, gain: 0.1 },
  ]);
  near(tempo(env).candidates[0]?.bpm, 128);
});

test('local tempo: silence length, musical phase and section loudness do not set BPM', () => {
  for (const bpm of [70, 90, 120, 128, 140, 176, 185]) {
    const plain = tempo(pulses(36, [{ bpm }]));
    const arranged = tempo(pulses(210, [
      { start: 31.37, end: 49, bpm, gain: 0.1 },
      { start: 97.11, end: 116, bpm, gain: 2 },
      { start: 176.63, end: 194, bpm, gain: 0.3 },
    ]));
    // Slow pulses have a legitimate double-time alternative; compare the tempo family.
    assert.ok([1, 2, 0.5].some(r => Math.abs(arranged.candidates[0]?.bpm - bpm * r) <= 2), `${bpm}: ${JSON.stringify(arranged)}`);
    assert.ok([1, 2, 0.5].some(r => Math.abs(plain.candidates[0]?.bpm - bpm * r) <= 2));
    assert.ok(arranged.candidates[0].confidence > 0.4, `${bpm}: confidence ${arranged.candidates[0].confidence}`);
  }
});

test('local tempo: isolated transients cannot masquerade as repeated rhythm', () => {
  for (const count of [0, 1, 2, 3]) {
    const env = new Float32Array(FPS * 60);
    for (let i = 0; i < count; i++) env[200 + i * 25] = 1;
    assert.equal(tempo(env).candidates.length, 0, `${count} transients need more evidence`);
  }
});

test('local tempo: one extreme hit does not drown a repeating percussive pattern', () => {
  const env = pulses(60, [{ bpm: 128, gain: 0.2 }]);
  env[400] = 10000;
  near(tempo(env).candidates[0]?.bpm, 128);
});

test('local tempo: competing tempos remain alternatives with reduced confidence', () => {
  const stable = tempo(pulses(96, [{ bpm: 128 }]));
  const mixed = tempo(pulses(96, [
    { start: 0.2, end: 48, bpm: 128 }, { start: 48.2, end: 96, bpm: 100 },
  ]));
  assert.ok(mixed.candidates.some(c => Math.abs(c.bpm - 128) <= 2));
  assert.ok(mixed.candidates.some(c => Math.abs(c.bpm - 100) <= 2));
  assert.ok(mixed.candidates[0].confidence < stable.candidates[0].confidence - 0.1);
});

test('local tempo: input is immutable, finite and deterministic across analysis rates', () => {
  for (const [sampleRate, hop] of [[44100, 1024], [48000, 1024], [22050, 512]]) {
    const env = new Float32Array(Math.round(40 * sampleRate / hop));
    for (let t = 0.2; t < 40; t += 60 / 128) env[Math.round(t * sampleRate / hop)] = 1;
    env[3] = NaN; env[9] = Infinity; env[11] = -5;
    const copy = env.slice();
    const result = estimateTempo(env, sampleRate, hop);
    near(result.candidates[0]?.bpm, 128);
    assert.deepEqual(estimateTempo(env, sampleRate, hop), result);
    assert.deepEqual(env, copy);
    assert.ok(result.candidates.every(c => Number.isFinite(c.confidence) && c.confidence >= 0 && c.confidence <= 1));
  }
});

test('local tempo: invalid clocks and options fail closed without throwing or allocating unbounded arrays', () => {
  const env = pulses(24, [{ bpm: 128 }]);
  for (const [rate, hop, options] of [[0, 960], [48000, 0], [Infinity, 960], [48000, 960, { minBpm: 0 }], [48000, 960, { maxBpm: 1e9 }], [48000, 960, { harmonics: Infinity }], [48000, 960, { maxCandidates: 0 }]]) {
    assert.equal(estimateTempo(env, rate, hop, options).candidates.length, 0);
  }
});

test('local metric resolution: an unpopulated double grid stays rejected across long breaks', () => {
  for (const bpm of [70, 90, 128, 176]) {
    const env = pulses(180, [
      { start: 20.2, end: 42, bpm }, { start: 103.31, end: 132, bpm, gain: 0.2 },
    ]);
    const bass = Float32Array.from(env, v => v > 0 ? 1 : 0);
    const grid = new GridAligner({ totalFrames: env.length, onsetEnvT: env, fluxT: env, typFlux: 1, rawBassT: bass }, 48000, 960);
    grid.calculate();
    near(grid.estimatedBPM, bpm);
    assert.equal(grid.tempoCandidates[0].bpm, grid.estimatedBPM);
  }
});

test('local tempo: noise, a sustained envelope and a tail with too few attacks are not confident rhythm', () => {
  const constant = new Float32Array(FPS * 60).fill(1);
  assert.equal(tempo(constant).candidates.length, 0);
  let seed = 19;
  const noise = Float32Array.from(constant, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  });
  const noisy = tempo(noise);
  assert.ok((noisy.candidates[0]?.confidence ?? 0) < 0.4);
  const tail = new Float32Array(FPS * 60);
  tail[tail.length - 1] = 1; tail[tail.length - 26] = 1;
  assert.equal(tempo(tail).candidates.length, 0);
});

test('local tempo: evidence covers the final rhythmic section and uses fixed-size windows', () => {
  const env = pulses(181, [{ start: 165.2, end: 181, bpm: 128 }]);
  const result = tempo(env);
  near(result.candidates[0]?.bpm, 128);
  assert.ok(result.windows.length > 0);
  assert.ok(result.windows.some(w => w.endFrame === env.length));
  assert.ok(result.windows.every(w => w.endFrame - w.startFrame <= FPS * 12));
});

for (const id of ['house-128', 'dnb-176', 'slow-floor-70']) {
  test(`local tempo integration: ${id} through raw audio, quiet sections and a long break`, () => {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === id);
    const raw = fixture.build();
    const samples = new Float32Array(fixture.sampleRate * 48);
    for (const [start, gain] of [[8.37, 0.1], [31.11, 0.8]]) {
      const offset = Math.round(start * fixture.sampleRate);
      for (let i = 0; i < raw.length; i++) samples[offset + i] = raw[i] * gain;
    }
    const { analyzeAudio } = loadSrc('analyzer/analyzeAudio.ts');
    const result = analyzeAudio({ samples, sampleRate: fixture.sampleRate });
    near(result.bpm, fixture.groundTruth.expectedBpm, fixture.groundTruth.allowedBpmError);
    assert.equal(result.bpm, result.tempoCandidates[0].bpm);
    assert.equal(result.trackAnalysis.bpm, result.bpm);
    assert.ok(result.beats.every(Number.isFinite));
    assert.ok(result.timingConfidence.tempo >= 0 && result.timingConfidence.tempo <= 1);
  });
}
