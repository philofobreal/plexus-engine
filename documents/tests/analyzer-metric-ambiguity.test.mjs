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

function makeNoise(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 0xffffffff) * 2 - 1; };
}
function kick(samples, t, gain) {
  const start = Math.floor(t * SAMPLE_RATE);
  for (let i = 0; i < SAMPLE_RATE * 0.16; i++) {
    const idx = start + i; if (idx >= samples.length) break;
    const tt = i / SAMPLE_RATE;
    samples[idx] += Math.sin(2 * Math.PI * (45 + 45 * Math.exp(-tt / 0.012)) * tt) * gain * Math.exp(-tt / 0.056);
  }
}
function snare(samples, t, gain, noise) {
  const start = Math.floor(t * SAMPLE_RATE);
  let prev = 0;
  for (let i = 0; i < SAMPLE_RATE * 0.1; i++) {
    const idx = start + i; if (idx >= samples.length) break;
    const n = noise(); const hp = n - prev; prev = n;
    samples[idx] += hp * gain * Math.exp(-(i / SAMPLE_RATE) / 0.05);
  }
}

// Kick on every base beat; optionally fill the half-beats with snares so the perceived pulse
// is double the kick rate (a classic half/double-time ambiguity).
function ambiguousTrack(baseBpm, { fillOffbeats }) {
  const dur = 8;
  const samples = new Float32Array(dur * SAMPLE_RATE);
  const noise = makeNoise(0x33);
  const beat = 60 / baseBpm;
  for (let t = 0.2; t < dur; t += beat) {
    kick(samples, t, 0.95);
    if (fillOffbeats) snare(samples, t + beat / 2, 0.5, noise);
  }
  for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i]);
  return { samples, sampleRate: SAMPLE_RATE, options: { requestId: 1, algorithmVersion: 2, phraseSize: 8 } };
}

function isMetric(bpm, base, tol = 3) {
  return [1, 2, 0.5, 1.5].some(r => Math.abs(bpm - base * r) <= tol);
}
function exposesRelative(result) {
  const bpm = result.bpm;
  const all = [...result.trackAnalysis.alternativeTempos, ...result.tempoCandidates.map(c => c.bpm)];
  return all.some(alt => Math.abs(alt - bpm * 2) <= 4 || Math.abs(alt - bpm / 2) <= 4)
    || result.tempoCandidates.some(c => c.isHalfTime || c.isDoubleTime);
}

for (const base of [70, 75, 87]) {
  test(`metric ambiguity: ${base} BPM with offbeat fills resolves to a metric tempo and exposes the relative`, () => {
    const result = analyzeAudio(ambiguousTrack(base, { fillOffbeats: true }));
    assert.ok(isMetric(result.bpm, base), `${base}: bpm ${result.bpm} not metrically related to ${base}`);
    assert.ok(exposesRelative(result), `${base}: no half/double-time alternative exposed (bpm ${result.bpm}, alts ${result.trackAnalysis.alternativeTempos})`);
  });
}

test('a plain kick train without offbeat fills is not pushed to double-time', () => {
  const result = analyzeAudio(ambiguousTrack(75, { fillOffbeats: false }));
  // With no offbeat energy, the engine must not invent a double-time (150) pulse.
  assert.ok(isMetric(result.bpm, 75), `bpm ${result.bpm} not metric to 75`);
  assert.ok(result.bpm <= 110, `plain 75 kick train should not read as ~150 double-time (got ${result.bpm})`);
});

test('alternativeTempos and tempoCandidates stay consistent with the chosen tempo', () => {
  const result = analyzeAudio(ambiguousTrack(128 / 2, { fillOffbeats: true }));
  assert.equal(result.bpm, result.tempoCandidates[0].bpm, 'top candidate must equal chosen bpm');
  for (const alt of result.trackAnalysis.alternativeTempos) {
    assert.ok(alt >= 60 && alt <= 200, `alternative tempo ${alt} out of plausible range`);
  }
});
