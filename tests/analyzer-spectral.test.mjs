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
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
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

function sineBuffer(frequency, sampleRate, fftSize, frames = 6, amplitude = 0.8) {
  const samples = new Float32Array(fftSize * frames);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate)) * amplitude;
  }
  return samples;
}

function noiseBuffer(sampleRate, fftSize, frames = 6) {
  const samples = new Float32Array(fftSize * frames);
  let seed = 17;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    samples[i] = ((seed / 0xffffffff) * 2 - 1) * 0.35;
  }
  void sampleRate;
  return samples;
}

function extract(samples, sampleRate, fftSize = 1024) {
  const { FeatureExtractor } = createSrcLoader()('analyzer/FeatureExtractor.ts');
  const extractor = new FeatureExtractor(samples, sampleRate, fftSize);
  extractor.process();
  const i = Math.floor(extractor.totalFrames / 2);
  return { extractor, i };
}

test('FeatureExtractor classifies fixed Hz sine bands across sample rates', () => {
  const cases = [
    {
      frequency: 80,
      assertBand: (extractor, i, sampleRate) => {
        assert.ok(extractor.rawBassT[i] > extractor.rawMidT[i], `${sampleRate} 80Hz bass should exceed mid`);
        assert.ok(extractor.rawBassT[i] > extractor.rawHighT[i], `${sampleRate} 80Hz bass should exceed high`);
      }
    },
    {
      frequency: 1000,
      assertBand: (extractor, i, sampleRate) => {
        assert.ok(extractor.midT[i] > extractor.bassT[i], `${sampleRate} 1000Hz mid should exceed bass`);
        assert.ok(extractor.midT[i] > extractor.brillianceT[i], `${sampleRate} 1000Hz mid should exceed brilliance`);
      }
    },
    {
      frequency: 8000,
      assertBand: (extractor, i, sampleRate) => {
        assert.ok(extractor.brillianceT[i] > extractor.midT[i], `${sampleRate} 8000Hz brilliance should exceed mid`);
        assert.ok(extractor.rawHighT[i] > extractor.rawBassT[i], `${sampleRate} 8000Hz high should exceed bass`);
      }
    }
  ];

  for (const sampleRate of [44_100, 48_000]) {
    for (const testCase of cases) {
      const { extractor, i } = extract(sineBuffer(testCase.frequency, sampleRate, 1024), sampleRate);
      testCase.assertBand(extractor, i, sampleRate);
    }
  }
});

test('FeatureExtractor splits presence energy into legacy mid and high compatibility bands', () => {
  const { extractor, i } = extract(sineBuffer(3000, 44_100, 1024), 44_100);

  assert.ok(extractor.presenceT[i] > extractor.midT[i], '3000Hz should primarily land in presence');
  assert.ok(extractor.presenceT[i] > extractor.brillianceT[i], '3000Hz should not be treated as brilliance');
  assert.ok(extractor.rawHighT[i] > 0.25, 'presence should contribute materially to rawHighT');
  assert.ok(extractor.rawMidT[i] > 0.25, 'presence should still contribute materially to rawMidT');
  assert.ok(extractor.rawHighT[i] > extractor.rawMidT[i] * 0.35, 'presence must not be swallowed entirely by rawMidT');
});

test('analyzeAudio passes clean classifier bands without mid/presence double-counting', () => {
  const source = readFileSync(join(SRC_ROOT, 'analyzer', 'analyzeAudio.ts'), 'utf8');

  assert.match(source, /bass: features\.bassT/);
  assert.match(source, /mid: features\.midT/);
  assert.match(source, /presence: features\.presenceT/);
  assert.doesNotMatch(source, /bass: features\.rawBassT/);
  assert.doesNotMatch(source, /mid: features\.rawMidT/);
});

test('FeatureExtractor avoids hard-coded FFT bin limits', () => {
  const at441 = extract(sineBuffer(80, 44_100, 1024), 44_100);
  const at48 = extract(sineBuffer(80, 48_000, 1024), 48_000);

  assert.ok(at441.extractor.rawBassT[at441.i] > 0.6);
  assert.ok(at48.extractor.rawBassT[at48.i] > 0.6);
  assert.ok(Math.abs(at441.extractor.centroidT[at441.i] - at48.extractor.centroidT[at48.i]) < 0.002);
});

test('FeatureExtractor returns stable zeros for silence', () => {
  const { extractor } = extract(new Float32Array(1024 * 3), 44_100);
  for (let i = 0; i < extractor.totalFrames; i++) {
    for (const array of [
      extractor.rmsT,
      extractor.rawBassT,
      extractor.rawMidT,
      extractor.rawHighT,
      extractor.centroidT,
      extractor.flatnessT,
      extractor.spectralRolloffT,
      extractor.spectralCrestT
    ]) {
      assert.equal(array[i], 0);
    }
  }
});

test('SpectralCalibration produces valid deterministic adaptive output and default fallback', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const samples = sineBuffer(95, 44_100, 1024, 12);
  const first = estimateSpectralCalibration(samples, 44_100, 1024);
  const second = estimateSpectralCalibration(samples, 44_100, 1024);

  assert.deepEqual(second, first);
  assert.ok(first.confidence > 0);
  let previousMax = 0;
  for (const key of ['sub', 'bass', 'lowMid', 'mid', 'presence', 'brilliance', 'air']) {
    const band = first.bandsHz[key];
    assert.ok(band.min < band.max, `${key} min < max`);
    assert.ok(band.min >= previousMax || Math.abs(band.min - previousMax) < 1e-9, `${key} ordered`);
    assert.ok(band.max <= first.nyquist, `${key} clamped`);
    previousMax = band.max;
  }

  const silence = JSON.parse(JSON.stringify(estimateSpectralCalibration(new Float32Array(1024 * 3), 44_100, 1024)));
  assert.equal(silence.confidence, 0);
  assert.deepEqual(silence.bandsHz.bass, { min: 60, max: 180 });
});

test('FeatureClassifier clamps outputs, handles silence, and separates tonal/noise fixtures', () => {
  const { FeatureClassifier } = createSrcLoader()('analyzer/FeatureClassifier.ts');

  const classifyOne = (input) => new FeatureClassifier({
    rms: new Float32Array([input.rms ?? 1]),
    rawRms: input.rawRms !== undefined ? new Float32Array([input.rawRms]) : undefined,
    flux: new Float32Array([input.flux ?? 0.2]),
    sub: new Float32Array([input.sub ?? 0]),
    bass: new Float32Array([input.bass ?? 0]),
    lowMid: new Float32Array([input.lowMid ?? 0]),
    mid: new Float32Array([input.mid ?? 0]),
    presence: new Float32Array([input.presence ?? 0]),
    brilliance: new Float32Array([input.brilliance ?? 0]),
    air: new Float32Array([input.air ?? 0]),
    high: new Float32Array([input.high ?? 0]),
    centroid: new Float32Array([input.centroid ?? 0.2]),
    flatness: new Float32Array([input.flatness ?? 0.2]),
    zcr: new Float32Array([input.zcr ?? 0.02]),
    rolloff: new Float32Array([input.rolloff ?? 0.3]),
    crest: new Float32Array([input.crest ?? 5])
  }).classifyFrames();

  const noise = classifyOne({ flatness: 0.92, zcr: 0.2, brilliance: 0.35, air: 0.25, high: 0.6, rolloff: 0.85, centroid: 0.7 });
  const sine = classifyOne({ mid: 0.75, presence: 0.15, flatness: 0.02, zcr: 0.01, crest: 11, centroid: 0.15 });
  const low = classifyOne({ sub: 0.65, bass: 0.3, mid: 0.02, flatness: 0.03, zcr: 0.01, crest: 10 });
  const clamped = classifyOne({ rms: 8, flux: 8, mid: 8, presence: 8, brilliance: 8, air: 8, centroid: 8, flatness: -3, zcr: 8, rolloff: 8, crest: 100 });
  const silence = classifyOne({ rms: 0, flux: 1, mid: 1, presence: 1, brilliance: 1, air: 1, centroid: 1, flatness: 1, zcr: 1, rolloff: 1, crest: 1 });
  const decodeNoise = classifyOne({ rms: 1, rawRms: 0.00005, flux: 1, mid: 1, presence: 1, brilliance: 1, air: 1, centroid: 1, flatness: 1, zcr: 1, rolloff: 1, crest: 1 });

  assert.ok(noise.fxRaw[0] > sine.fxRaw[0]);
  assert.ok(sine.melodyRaw[0] > noise.melodyRaw[0]);
  assert.ok(low.vocalRaw[0] < 0.2);

  for (const values of Object.values(clamped)) {
    assert.ok(values[0] >= 0 && values[0] <= 1);
  }
  for (const values of Object.values(silence)) {
    assert.equal(values[0], 0);
  }
  for (const values of Object.values(decodeNoise)) {
    assert.equal(values[0], 0);
  }
});
