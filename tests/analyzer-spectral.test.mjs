import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const BAND_KEYS = ['sub', 'bass', 'lowMid', 'mid', 'presence', 'brilliance', 'air'];
const SAFETY_RANGES_HZ = {
  sub: { min: 20, max: 70 },
  bass: { min: 50, max: 220 },
  lowMid: { min: 140, max: 650 },
  mid: { min: 400, max: 2600 },
  presence: { min: 1600, max: 6200 },
  brilliance: { min: 4200, max: 13000 },
  air: { min: 9000, max: 16000 }
};

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

function dynamicSineWithSilence(sampleRate, fftSize, frames = 12) {
  const samples = new Float32Array(fftSize * frames);
  for (let frame = 0; frame < frames; frame++) {
    if (frame % 3 === 2) continue;
    const frameStart = frame * fftSize;
    for (let i = 0; i < fftSize; i++) {
      const sampleIndex = frameStart + i;
      samples[sampleIndex] = Math.sin(2 * Math.PI * 440 * (sampleIndex / sampleRate)) * 0.75;
    }
  }
  return samples;
}

function mixedSineBuffer(partials, sampleRate, fftSize, frames = 80) {
  const samples = new Float32Array(fftSize * frames);
  for (let i = 0; i < samples.length; i++) {
    let value = 0;
    for (const [frequency, amplitude] of partials) {
      value += Math.sin(2 * Math.PI * frequency * (i / sampleRate)) * amplitude;
    }
    samples[i] = value;
  }
  return samples;
}

function transientBurstBuffer(sampleRate, fftSize, frames = 120) {
  const samples = new Float32Array(fftSize * frames);
  const burstStart = fftSize * 45 + 123;
  for (let i = 0; i < 512; i++) {
    const sampleIndex = burstStart + i;
    samples[sampleIndex] = Math.sin(2 * Math.PI * 1200 * (sampleIndex / sampleRate)) * 0.95;
  }
  return samples;
}

function kickBurstBuffer(frequency, sampleRate, fftSize, frames = 48) {
  const samples = new Float32Array(fftSize * frames);
  for (let frame = 0; frame < frames; frame += 4) {
    const frameStart = frame * fftSize;
    for (let i = 0; i < Math.min(384, fftSize); i++) {
      const sampleIndex = frameStart + i;
      const env = Math.exp(-i / 140);
      samples[sampleIndex] = Math.sin(2 * Math.PI * frequency * (sampleIndex / sampleRate)) * env * 0.95;
    }
  }
  return samples;
}

function pinkNoiseBuffer(sampleRate, fftSize, frames = 80) {
  const samples = new Float32Array(fftSize * frames);
  let seed = 23;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = (seed / 0xffffffff) * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.0990460;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    samples[i] = (b0 + b1 + b2 + white * 0.1848) * 0.05;
  }
  void sampleRate;
  return samples;
}

function assertStrictBands(calibration) {
  let previousMax = 0;
  for (const key of BAND_KEYS) {
    const band = calibration.bandsHz[key];
    assert.ok(Number.isFinite(band.min), `${key} finite min`);
    assert.ok(Number.isFinite(band.max), `${key} finite max`);
    assert.ok(band.min >= 0, `${key} non-negative min`);
    assert.ok(band.min >= previousMax, `${key} ordered`);
    assert.ok(band.min < band.max, `${key} min < max`);
    assert.ok(band.max <= calibration.nyquist, `${key} max <= nyquist`);
    previousMax = band.max;
  }
}

function extract(samples, sampleRate, fftSize = 1024) {
  const { FeatureExtractor } = createSrcLoader()('analyzer/FeatureExtractor.ts');
  const extractor = new FeatureExtractor(samples, sampleRate, fftSize);
  extractor.process();
  const i = Math.floor(extractor.totalFrames / 2);
  return { extractor, i };
}

function analyze(samples, sampleRate, fftSize = 1024) {
  const { analyzeAudio } = createSrcLoader()('analyzer/analyzeAudio.ts');
  return analyzeAudio({ samples, sampleRate, options: { hopSize: fftSize, requestId: 1 } });
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

test('FeatureExtractor builds independent 24-band logarithmic spectrum from FFT bins', () => {
  const cases = [
    { frequency: 60, minBand: 0, maxBand: 8, label: '60Hz low' },
    { frequency: 1000, minBand: 10, maxBand: 16, label: '1000Hz mid' },
    { frequency: 8000, minBand: 19, maxBand: 23, label: '8000Hz high' }
  ];

  for (const testCase of cases) {
    const { extractor, i } = extract(sineBuffer(testCase.frequency, 44_100, 1024, 10), 44_100);
    const spectrum = extractor.perceptualSpectrumT.map(band => band[i]);
    const maxValue = Math.max(...spectrum);
    const maxBand = spectrum.findIndex(value => value === maxValue);

    assert.equal(spectrum.length, 24);
    assert.ok(maxBand >= testCase.minBand && maxBand <= testCase.maxBand, `${testCase.label} peak band ${maxBand}`);
    assert.ok(maxValue > 0, `${testCase.label} should produce spectrum energy`);

    const aroundPeak = spectrum.slice(Math.max(0, maxBand - 2), Math.min(spectrum.length, maxBand + 3));
    assert.ok(new Set(aroundPeak.map(value => value.toFixed(6))).size > 1, `${testCase.label} neighboring bands should not be identical`);
  }
});

test('perceptual spectrum bands all receive effective FFT-bin contribution at 44.1kHz', () => {
  const { extractor } = extract(noiseBuffer(44_100, 1024, 8), 44_100);

  assert.equal(extractor.perceptualSpectrumEffectiveBinCount.length, 24);
  for (let i = 0; i < extractor.perceptualSpectrumEffectiveBinCount.length; i++) {
    assert.ok(extractor.perceptualSpectrumEffectiveBinCount[i] > 0, `band ${i} should have overlap contribution`);
  }
});

test('perceptual spectrum keeps bass and sub movement readable after normalization', () => {
  const sampleRate = 44_100;

  const sub = analyze(sineBuffer(45, sampleRate, 1024, 48, 0.85), sampleRate);
  const subFrame = sub.frames[Math.floor(sub.frames.length / 2)].perceptualSpectrum;
  assert.ok(Math.max(...subFrame.slice(0, 7)) > 0.45, '45Hz sine should visibly raise low columns');

  const kick = analyze(kickBurstBuffer(60, sampleRate, 1024), sampleRate);
  const lowMax = new Array(8).fill(0);
  for (const frame of kick.frames) {
    frame.perceptualSpectrum.slice(0, 8).forEach((value, index) => {
      lowMax[index] = Math.max(lowMax[index], value);
    });
  }
  assert.ok(lowMax.filter(value => value > 0.18).length >= 3, `60Hz burst should raise multiple low/bass columns, got ${lowMax.join(',')}`);
  assert.ok(new Set(lowMax.slice(0, 6).map(value => value.toFixed(3))).size > 2, 'low-band smoothing must not make low columns identical');

  const bassline = analyze(sineBuffer(90, sampleRate, 1024, 48, 0.75), sampleRate);
  const bassFrame = bassline.frames[Math.floor(bassline.frames.length / 2)].perceptualSpectrum;
  assert.ok(Math.max(...bassFrame.slice(4, 10)) > 0.35, '90Hz bassline should remain readable in bass columns');
});

test('perceptual spectrum bandwidth normalization prevents high-band bin-count dominance', () => {
  const result = analyze(pinkNoiseBuffer(44_100, 1024, 96), 44_100);
  const frame = result.frames[Math.floor(result.frames.length / 2)].perceptualSpectrum;
  const lowAvg = frame.slice(0, 8).reduce((sum, value) => sum + value, 0) / 8;
  const highAvg = frame.slice(16, 24).reduce((sum, value) => sum + value, 0) / 8;

  assert.ok(highAvg < lowAvg * 1.8, `high bands should not dominate by bin count alone: low=${lowAvg}, high=${highAvg}`);
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
  assert.ok(first.confidence.overall > 0);
  assertStrictBands(first);
  for (const key of BAND_KEYS) {
    assert.ok(first.centersHz[key] >= SAFETY_RANGES_HZ[key].min, `${key} center >= safety min`);
    assert.ok(first.centersHz[key] <= SAFETY_RANGES_HZ[key].max, `${key} center <= safety max`);
  }

  const silence = JSON.parse(JSON.stringify(estimateSpectralCalibration(new Float32Array(1024 * 3), 44_100, 1024)));
  assert.deepEqual(silence.confidence, {
    overall: 0,
    signalToNoise: 0,
    spectralStability: 0,
    dynamicRangeConfidence: 0
  });
  assert.deepEqual(silence.bandsHz.bass, { min: 60, max: 180 });
});

test('SpectralCalibration falls back to strict static bands for zero input', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(new Float32Array(1024 * 12), 44_100, 1024);

  assert.equal(calibration.confidence.overall, 0);
  assertStrictBands(calibration);
  assert.deepEqual(JSON.parse(JSON.stringify(calibration.bandsHz.bass)), { min: 60, max: 180 });
});

test('SpectralCalibration keeps bands valid at extremely low sample rates', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(sineBuffer(8, 100, 1024, 12, 0.7), 100, 1024);

  assert.equal(calibration.nyquist, 50);
  assertStrictBands(calibration);
});

test('SpectralCalibration clamps fallback and adaptive bands to Nyquist limits', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const lowNyquist = estimateSpectralCalibration(sineBuffer(900, 12_000, 1024, 24, 0.7), 12_000, 1024);
  const fullRange = estimateSpectralCalibration(sineBuffer(12_000, 48_000, 1024, 24, 0.7), 48_000, 1024);

  assertStrictBands(lowNyquist);
  assertStrictBands(fullRange);
  for (const key of BAND_KEYS) {
    assert.ok(lowNyquist.bandsHz[key].max <= lowNyquist.nyquist);
    assert.ok(fullRange.bandsHz[key].max <= fullRange.nyquist);
  }
});

test('SpectralCalibration confidence reports silence as zero signal integrity', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(new Float32Array(1024 * 16), 44_100, 1024);

  assert.deepEqual(JSON.parse(JSON.stringify(calibration.confidence)), {
    overall: 0,
    signalToNoise: 0,
    spectralStability: 0,
    dynamicRangeConfidence: 0
  });
});

test('SpectralCalibration confidence treats white noise as spectrally stable with low dynamic range', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(noiseBuffer(44_100, 1024, 80), 44_100, 1024);

  assert.ok(calibration.confidence.spectralStability > 0.85);
  assert.ok(calibration.confidence.dynamicRangeConfidence < 0.3);
});

test('SpectralCalibration confidence detects amplitude variance in dynamic tracks', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(dynamicSineWithSilence(44_100, 1024, 90), 44_100, 1024);

  assert.ok(calibration.confidence.dynamicRangeConfidence > 0.65);
});

test('SpectralCalibration musical profile detects bass-heavy low end', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(sineBuffer(80, 44_100, 1024, 80), 44_100, 1024);

  assert.ok(calibration.musicalProfile?.lowEnd > 0.75);
});

test('SpectralCalibration musical profile detects tonal mid sine', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(sineBuffer(1000, 44_100, 1024, 80), 44_100, 1024);

  assert.ok(calibration.musicalProfile?.tonal > 0.75);
});

test('SpectralCalibration musical profile detects vocal-like mid presence body', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const samples = mixedSineBuffer([
    [260, 0.3],
    [900, 0.35],
    [2800, 0.25]
  ], 44_100, 1024, 80);
  const calibration = estimateSpectralCalibration(samples, 44_100, 1024);

  assert.ok(calibration.musicalProfile?.vocalLike > 0.55);
  assert.ok(calibration.musicalProfile?.midBody > 0.75);
});

test('SpectralCalibration musical profile detects noisy highs', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(noiseBuffer(44_100, 1024, 80), 44_100, 1024);

  assert.ok(calibration.musicalProfile?.noisyHighs > 0.75);
});

test('SpectralCalibration musical profile detects transient-rich bursts', () => {
  const { estimateSpectralCalibration } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const calibration = estimateSpectralCalibration(transientBurstBuffer(44_100, 1024), 44_100, 1024);

  assert.ok(calibration.musicalProfile?.transientRich > 0.75);
});

test('collectCalibrationWindowStarts captures transient burst in long silence', () => {
  const { collectCalibrationWindowStarts } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const sampleRate = 44_100;
  const fftSize = 1024;
  const burstStart = fftSize * 43 + 137;
  const samples = new Float32Array(fftSize * 120);

  for (let i = 0; i < 384; i++) {
    const sampleIndex = burstStart + i;
    samples[sampleIndex] = Math.sin(2 * Math.PI * 880 * (sampleIndex / sampleRate)) * 0.9;
  }

  const starts = collectCalibrationWindowStarts(samples, sampleRate, fftSize, 8);
  assert.ok(starts.length <= 8);
  assert.ok(
    starts.some(start => start <= burstStart && burstStart < start + fftSize),
    `expected one selected window to cover burst at ${burstStart}, got ${starts.join(',')}`
  );
});

test('collectCalibrationWindowStarts is bounded, sorted, unique, and valid', () => {
  const { collectCalibrationWindowStarts } = createSrcLoader()('analyzer/SpectralCalibration.ts');
  const sampleRate = 48_000;
  const fftSize = 1024;
  const maxWindows = 5;
  const samples = noiseBuffer(sampleRate, fftSize, 300);
  const starts = collectCalibrationWindowStarts(samples, sampleRate, fftSize, maxWindows);
  const maxStart = samples.length - fftSize;

  assert.ok(starts.length <= maxWindows);
  assert.equal(new Set(starts).size, starts.length);
  for (let i = 1; i < starts.length; i++) {
    assert.ok(starts[i] > starts[i - 1]);
  }
  for (const start of starts) {
    assert.ok(start >= 0);
    assert.ok(start <= maxStart);
  }
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
    crest: new Float32Array([input.crest ?? 5]),
    calibration: input.calibration
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

test('FeatureClassifier suppresses melody and vocal false positives on high-noise low-confidence input', () => {
  const { FeatureClassifier } = createSrcLoader()('analyzer/FeatureClassifier.ts');
  const lowQualityCalibration = {
    confidence: {
      overall: 0.18,
      signalToNoise: 0.08,
      spectralStability: 0.18,
      dynamicRangeConfidence: 0.2
    }
  };

  const output = new FeatureClassifier({
    rms: new Float32Array([0.85]),
    rawRms: new Float32Array([0.85]),
    flux: new Float32Array([0.7]),
    sub: new Float32Array([0.05]),
    bass: new Float32Array([0.1]),
    lowMid: new Float32Array([0.62]),
    mid: new Float32Array([0.78]),
    presence: new Float32Array([0.8]),
    brilliance: new Float32Array([0.72]),
    air: new Float32Array([0.65]),
    high: new Float32Array([0.78]),
    centroid: new Float32Array([0.8]),
    flatness: new Float32Array([0.92]),
    zcr: new Float32Array([0.22]),
    rolloff: new Float32Array([0.9]),
    crest: new Float32Array([2.5]),
    calibration: lowQualityCalibration
  }).classifyFrames();

  assert.ok(output.melodyRaw[0] < 0.35);
  assert.ok(output.vocalRaw[0] < 0.35);
  assert.ok(output.fxRaw[0] > output.melodyRaw[0]);
  assert.ok(output.fxRaw[0] > output.vocalRaw[0]);
});
