import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const cache = new Map();
function load(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }}).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Float32Array, Math, Number, Error,
    require: request => load(resolve(dirname(path), request + '.ts')) }, { filename: path });
  return module.exports;
}
const tone = (rate, duration, signal) => Float32Array.from({ length: Math.floor(rate * duration) }, (_, i) => signal(i / rate));
const sine = (hz, t) => Math.sin(2 * Math.PI * hz * t);
const mean = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const segment = (frames, key, from, to, rate, hop = 1024) => frames.slice(Math.ceil(from * rate / hop), Math.floor(to * rate / hop)).map(f => f[key]);

test('analysis publishes separate sub/bass body and flux without making sustained bass into beat events', () => {
  const { analyzeAudio } = load('src/analyzer/analyzeAudio.ts');
  const sampleRate = 22050;
  const samples = tone(sampleRate, 3, t => 0.4 * sine(40, t));
  const result = analyzeAudio({ samples, sampleRate });
  assert.ok(result.frames.every(f => ['subEnergy', 'bassEnergy', 'subFlux', 'bassFlux'].every(k => Number.isFinite(f[k]) && f[k] >= 0 && f[k] <= 1)));
  assert.ok(mean(segment(result.frames, 'subEnergy', 0.5, 2.5, sampleRate)) > 0.6);
  assert.ok(mean(segment(result.frames, 'bassEnergy', 0.5, 2.5, sampleRate)) < 0.15);
  assert.ok(mean(segment(result.frames, 'subFlux', 0.5, 2.5, sampleRate)) < 0.08);
  assert.equal(result.events.filter(e => e.time > 0.5).length, 0);
});

function extract(rate, duration, signal, hop = 1024) {
  const { extractLowFrequencies } = load('src/analyzer/LowFrequencyExtractor.ts');
  const values = extractLowFrequencies(tone(rate, duration, signal), rate, hop);
  return Array.from(values.subEnergy, (_, i) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v[i]])));
}

for (const rate of [8000, 22050, 44100, 48000, 96000]) {
  test(`fixed musical bands separate 40/110 Hz and reject 1 kHz at ${rate} Hz`, () => {
    for (const [hz, key, other] of [[40, 'subEnergy', 'bassEnergy'], [110, 'bassEnergy', 'subEnergy']]) {
      const frames = extract(rate, 2, t => 0.4 * sine(hz, t));
      assert.ok(mean(segment(frames, key, 0.4, 1.7, rate)) > 0.8, `${hz} Hz body`);
      assert.ok(mean(segment(frames, other, 0.4, 1.7, rate)) < 0.1, `${hz} Hz leakage`);
      for (const f of frames) for (const value of Object.values(f)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
    const high = extract(rate, 2, t => 0.6 * sine(1000, t));
    assert.ok(mean(segment(high, 'subEnergy', 0.4, 1.7, rate)) < 0.005);
    assert.ok(mean(segment(high, 'bassEnergy', 0.4, 1.7, rate)) < 0.005);
  });
}

test('shared normalization preserves mixed-band balance and relative amplitude changes', () => {
  const rate = 22050;
  const frames = extract(rate, 4, t => (t < 2 ? 0.12 : 0.48) * (sine(40, t) + 0.3 * sine(110, t)));
  const quiet = mean(segment(frames, 'subEnergy', 0.5, 1.5, rate));
  const loud = mean(segment(frames, 'subEnergy', 2.5, 3.5, rate));
  const upper = mean(segment(frames, 'bassEnergy', 2.5, 3.5, rate));
  assert.ok(loud > quiet * 3.7 && loud < quiet * 4.3);
  assert.ok(upper / loud > 0.25 && upper / loud < 0.35);
  assert.ok(Math.max(...segment(frames, 'subFlux', 1.9, 2.25, rate)) > 0.3);
  assert.ok(mean(segment(frames, 'subFlux', 2.7, 3.5, rate)) < 0.02);
});

test('flux reacts to a bass note change with constant amplitude, not a steady tone', () => {
  const rate = 44100;
  const frames = extract(rate, 4, t => 0.4 * sine(t < 2 ? 85 : 145, t));
  assert.ok(Math.max(...segment(frames, 'bassFlux', 1.9, 2.3, rate)) > 0.35);
  assert.ok(mean(segment(frames, 'bassFlux', 0.5, 1.7, rate)) < 0.02);
  assert.ok(mean(segment(frames, 'bassFlux', 2.7, 3.5, rate)) < 0.02);
  assert.ok(mean(segment(frames, 'subFlux', 1.9, 2.3, rate)) < 0.12);
});

test('silence, near-silence and DC do not normalize into a bass signal', () => {
  for (const signal of [() => 0, () => 0.5, t => 1e-6 * sine(40, t)]) {
    const frames = extract(22050, 2, signal);
    assert.ok(frames.every(f => Object.values(f).every(v => v === 0)));
  }
});

test('quiet boundaries, release, silence padding and isolated outliers remain bounded', () => {
  const rate = 22050;
  const base = extract(rate, 4, t => t >= 1 && t < 3 ? 0.2 * sine(40, t) : 0);
  const padded = extract(rate, 12, t => t >= 1 && t < 3 ? 0.2 * sine(40, t) : 0);
  assert.ok(Math.abs(mean(segment(base, 'subEnergy', 1.5, 2.5, rate)) - mean(segment(padded, 'subEnergy', 1.5, 2.5, rate))) < 0.01);
  assert.ok(Math.max(...segment(base, 'subFlux', 0.9, 1.3, rate)) > 0.3);
  assert.ok(mean(segment(base, 'subEnergy', 3.7, 4, rate)) < 0.005);
  const outlier = extract(rate, 4, t => (t > 2 && t < 2.02 ? 4 : 0.2) * sine(40, t));
  assert.ok(mean(segment(outlier, 'subEnergy', 0.5, 1.5, rate)) > 0.75);
});

test('extraction is deterministic, does not mutate samples and handles empty/short/invalid input', () => {
  const { extractLowFrequencies } = load('src/analyzer/LowFrequencyExtractor.ts');
  const samples = tone(22050, 1, t => 0.4 * sine(50, t)); samples[7] = NaN; samples[9] = Infinity;
  const original = samples.slice();
  const a = extractLowFrequencies(samples, 22050, 1024), b = extractLowFrequencies(samples, 22050, 1024);
  for (const key of Object.keys(a)) assert.deepEqual(a[key], b[key]);
  assert.deepEqual(samples, original);
  for (const length of [0, 1, 1023]) assert.equal(extractLowFrequencies(new Float32Array(length), 22050, 1024).subEnergy.length, 0);
  for (const [rate, hop] of [[0,1024], [NaN,1024], [Infinity,1024], [44100,0], [44100,0.5]]) assert.throws(() => extractLowFrequencies(samples, rate, hop));
});

test('normalization defaults legacy low-frequency fields, clamps corrupt fields and preserves source', () => {
  const { normalizeAudioFrame } = load('src/analyzer/normalizeAnalysisResult.ts');
  const legacy = Object.freeze({ e: 0.7, state: 'HIGH', perceptualSpectrum: [0.8] });
  const clean = normalizeAudioFrame(legacy);
  for (const key of ['subEnergy','bassEnergy','subFlux','bassFlux']) assert.equal(clean[key], 0);
  assert.equal(clean.e, legacy.e); assert.notEqual(clean, legacy);
  const corrupt = normalizeAudioFrame({ ...legacy, subEnergy: NaN, bassEnergy: Infinity, subFlux: -1, bassFlux: 4 });
  assert.deepEqual([corrupt.subEnergy, corrupt.bassEnergy, corrupt.subFlux, corrupt.bassFlux], [0,0,0,1]);
});

test('slow amplitude ramp raises body smoothly; an added kick has stronger flux than sustain', () => {
  const rate = 22050;
  const ramp = extract(rate, 4, t => (0.08 + t * 0.1) * sine(40, t));
  const a = mean(segment(ramp, 'subEnergy', 0.5, 1, rate)), b = mean(segment(ramp, 'subEnergy', 2.8, 3.3, rate));
  assert.ok(b > a * 2);
  const mix = extract(rate, 4, t => 0.2 * sine(110, t) + (t >= 2 && t < 2.3 ? 0.7 * Math.exp(-(t - 2) * 22) * sine(40, t - 2) : 0));
  assert.ok(Math.max(...segment(mix, 'subFlux', 1.9, 2.3, rate)) > 0.3);
  assert.ok(mean(segment(mix, 'bassEnergy', 0.5, 1.5, rate)) > 0.7);
  assert.ok(mean(segment(mix, 'bassFlux', 0.5, 1.5, rate)) < 0.02);
});
