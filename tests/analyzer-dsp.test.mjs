import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

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
const SAMPLE_RATE = 44100;
const HOP = 1024;
const FRAMES_PER_SEC = SAMPLE_RATE / HOP;

function impulseEnvelope(bpm, frames, { jitter = 0, value = 1 } = {}) {
  const env = new Float32Array(frames);
  const period = FRAMES_PER_SEC * 60 / bpm;
  let seed = 99;
  for (let k = 0; ; k++) {
    let pos = k * period;
    if (jitter > 0) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      pos += ((seed / 0xffffffff) * 2 - 1) * jitter;
    }
    const idx = Math.round(pos);
    if (idx >= frames) break;
    if (idx >= 0) env[idx] += value;
  }
  return env;
}

// ---- onset envelope (FeatureExtractor, Task 2) -------------------------------------

test('FeatureExtractor onset envelope is zero for silence and deterministic', () => {
  const { FeatureExtractor } = loadSrc('analyzer/FeatureExtractor.ts');
  const silence = new Float32Array(HOP * 8);
  const a = new FeatureExtractor(silence, SAMPLE_RATE, HOP);
  a.process();
  for (let i = 0; i < a.totalFrames; i++) assert.equal(a.onsetEnvT[i], 0);

  const samples = new Float32Array(HOP * 32);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const kick = i % 11025 < 256 ? 1 : 0;
    samples[i] = Math.sin(2 * Math.PI * 220 * t) * 0.2 + kick * Math.sin(2 * Math.PI * 60 * t) * 0.7;
  }
  const e1 = new FeatureExtractor(samples.slice(), SAMPLE_RATE, HOP); e1.process();
  const e2 = new FeatureExtractor(samples.slice(), SAMPLE_RATE, HOP); e2.process();
  assert.deepEqual(Array.from(e2.onsetEnvT), Array.from(e1.onsetEnvT));

  let peak = 0;
  for (let i = 0; i < e1.totalFrames; i++) peak = Math.max(peak, e1.onsetEnvT[i]);
  assert.ok(peak > 0, 'onset envelope should respond to transients');
  assert.ok(e1.typOnset >= 0);
});

// ---- tempo estimation (TempoEstimator, Task 3) -------------------------------------

test('estimateTempo recovers the fundamental of a clean click train', () => {
  const { estimateTempo } = loadSrc('analyzer/TempoEstimator.ts');
  for (const bpm of [100, 120, 128, 140]) {
    const env = impulseEnvelope(bpm, 512);
    const { candidates } = estimateTempo(env, SAMPLE_RATE, HOP);
    assert.ok(candidates.length > 0, `${bpm}: expected candidates`);
    const top = candidates[0];
    const metricMatch = Math.abs(top.bpm - bpm) <= 2
      || Math.abs(top.bpm - bpm * 2) <= 3
      || Math.abs(top.bpm - bpm / 2) <= 3;
    assert.ok(metricMatch, `${bpm}: top candidate ${top.bpm} not metrically related`);
    assert.ok(top.confidence > 0.35, `${bpm}: confidence ${top.confidence} too low`);
  }
});

test('estimateTempo assigns lower confidence to noisy than to clean tempo', () => {
  const { estimateTempo } = loadSrc('analyzer/TempoEstimator.ts');
  const clean = estimateTempo(impulseEnvelope(120, 512), SAMPLE_RATE, HOP);

  let seed = 7;
  const noise = new Float32Array(512);
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    noise[i] = seed / 0xffffffff;
  }
  const noisy = estimateTempo(noise, SAMPLE_RATE, HOP);

  const cleanConf = clean.candidates[0]?.confidence ?? 0;
  const noisyConf = noisy.candidates[0]?.confidence ?? 0;
  assert.ok(cleanConf > noisyConf, `clean ${cleanConf} should beat noisy ${noisyConf}`);
});

test('estimateTempo tags half/double-time relatives and is deterministic', () => {
  const { estimateTempo } = loadSrc('analyzer/TempoEstimator.ts');
  const env = impulseEnvelope(90, 600);
  const a = estimateTempo(env, SAMPLE_RATE, HOP);
  const b = estimateTempo(env, SAMPLE_RATE, HOP);
  assert.deepEqual(b, a, 'estimateTempo must be deterministic');
  for (const c of a.candidates) {
    assert.equal(typeof c.isHalfTime, 'boolean');
    assert.equal(typeof c.isDoubleTime, 'boolean');
    assert.ok(c.bpm >= 70 && c.bpm <= 180);
    assert.ok(c.confidence >= 0 && c.confidence <= 1);
  }
});

// ---- DP beat tracking (BeatTracker, Task 4) ----------------------------------------

function interBeatStats(beats) {
  const gaps = [];
  for (let i = 1; i < beats.length; i++) gaps.push(beats[i] - beats[i - 1]);
  const mean = gaps.reduce((s, g) => s + g, 0) / Math.max(1, gaps.length);
  const maxDev = gaps.reduce((m, g) => Math.max(m, Math.abs(g - mean)), 0);
  return { gaps, mean, maxDev };
}

test('trackBeats locks onto a periodic onset envelope', () => {
  const { trackBeats } = loadSrc('analyzer/BeatTracker.ts');
  const bpm = 120;
  const period = FRAMES_PER_SEC * 60 / bpm;
  const env = impulseEnvelope(bpm, 512);
  const result = trackBeats(env, period, SAMPLE_RATE, HOP);

  assert.ok(result.beats.length >= 8, `expected many beats, got ${result.beats.length}`);
  const { mean, maxDev } = interBeatStats(result.beats);
  assert.ok(Math.abs(mean - period) < period * 0.15, `mean gap ${mean} vs period ${period}`);
  assert.ok(maxDev < period * 0.5, `inter-beat gap deviation ${maxDev} too high`);
});

test('trackBeats extrapolates the grid through a silent breakdown', () => {
  const { trackBeats } = loadSrc('analyzer/BeatTracker.ts');
  const bpm = 124;
  const period = FRAMES_PER_SEC * 60 / bpm;
  const frames = 600;
  const env = impulseEnvelope(bpm, frames);
  // Silence the middle third (the "breakdown"): no onsets at all there.
  const lo = Math.floor(frames / 3);
  const hi = Math.floor((2 * frames) / 3);
  for (let i = lo; i < hi; i++) env[i] = 0;

  const result = trackBeats(env, period, SAMPLE_RATE, HOP);
  const beatsInGap = result.beats.filter(b => b >= lo && b < hi);
  assert.ok(beatsInGap.length >= 2, `expected extrapolated beats in the gap, got ${beatsInGap.length}`);
  const { mean } = interBeatStats(result.beats);
  assert.ok(Math.abs(mean - period) < period * 0.2, `grid spacing drifted in gap: ${mean} vs ${period}`);
});

test('trackBeats is deterministic and degrades gracefully on empty input', () => {
  const { trackBeats } = loadSrc('analyzer/BeatTracker.ts');
  const env = impulseEnvelope(128, 400);
  const period = FRAMES_PER_SEC * 60 / 128;
  const a = trackBeats(env, period, SAMPLE_RATE, HOP);
  const b = trackBeats(env, period, SAMPLE_RATE, HOP);
  assert.deepEqual(b, a);

  const none = trackBeats(new Float32Array(0), period, SAMPLE_RATE, HOP);
  assert.equal(none.beats.length, 0);
  const flat = trackBeats(new Float32Array(200), period, SAMPLE_RATE, HOP);
  assert.equal(typeof flat.beats.length, 'number');
});
