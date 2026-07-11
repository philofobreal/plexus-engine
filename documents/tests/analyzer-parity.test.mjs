import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const normalizePayload = (payload) => JSON.parse(JSON.stringify(payload));

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

test('headless analyzeAudio produces deterministic analyzer output', () => {
  const { analyzeAudio } = createSrcLoader()('analyzer/analyzeAudio.ts');
  const sampleRate = 44_100;
  const totalSamples = 1024 * 64;
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    const beatGate = i % 11_025 < 512 ? 1 : 0;
    samples[i] = Math.sin(2 * Math.PI * 220 * time) * 0.25
      + Math.sin(2 * Math.PI * 1760 * time) * 0.08
      + beatGate * Math.sin(2 * Math.PI * 80 * time) * 0.7;
  }

  const first = analyzeAudio({ samples: samples.slice(), sampleRate, options: { requestId: 42, algorithmVersion: 2, phraseSize: 8 } });
  const second = analyzeAudio({ samples: samples.slice(), sampleRate, options: { requestId: 42, algorithmVersion: 2, phraseSize: 8 } });

  assert.equal(first.requestId, 42);
  assert.equal(first.hopSize, 1024);
  assert.equal(first.frames.length, totalSamples / 1024);
  assert.equal(first.trackAnalysis.features.length, first.frames.length);
  assert.equal(first.trackAnalysis.spectralPivot.length, first.frames.length);
  assert.equal(first.trackAnalysis.featureHopSize, 1024);
  assert.ok(first.bpm >= 70 && first.bpm <= 180);
  assert.ok(first.tempoCandidates.length > 0);
  assert.ok(first.bpmConfidence >= 0 && first.bpmConfidence <= 1);
  assert.ok(first.gridConfidence >= 0 && first.gridConfidence <= 1);
  assert.ok(first.trackAnalysis.tempoCandidates.length > 0);
  assert.ok(first.events.length > 0);
  assert.ok(first.trackAnalysis.sections.length > 0);
  assert.deepEqual(normalizePayload(second), normalizePayload(first));
});

function createNegativeFixture(kind, sampleRate = 44_100, seconds = 8) {
  const samples = new Float32Array(sampleRate * seconds);
  let seed = 17;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    if (kind === 'ambient') {
      samples[i] = Math.sin(2 * Math.PI * 110 * time) * 0.08
        + Math.sin(2 * Math.PI * 220 * time) * 0.04
        + Math.sin(2 * Math.PI * 0.12 * time) * 0.03;
    } else if (kind === 'noise') {
      samples[i] = noise() * 0.08;
    } else if (kind === 'spoken') {
      const syllable = Math.sin(2 * Math.PI * 2.7 * time) > 0.65 ? 1 : 0;
      samples[i] = syllable * Math.sin(2 * Math.PI * (170 + 35 * Math.sin(2 * Math.PI * 0.9 * time)) * time) * 0.18;
    } else {
      samples[i] = noise() * 0.01;
    }
  }

  if (kind === 'clicks') {
    for (const clickTime of [0.37, 1.22, 2.91, 3.46, 5.08, 6.72, 7.31]) {
      const start = Math.floor(clickTime * sampleRate);
      for (let i = start; i < Math.min(samples.length, start + 64); i++) samples[i] += 0.7 * Math.exp(-(i - start) / 12);
    }
  }

  return { samples, sampleRate };
}

test('analyzeAudio keeps confidence low for non-metric negative fixtures', () => {
  const { analyzeAudio } = createSrcLoader()('analyzer/analyzeAudio.ts');
  for (const kind of ['ambient', 'noise', 'spoken', 'clicks']) {
    const fixture = createNegativeFixture(kind);
    const result = analyzeAudio({ ...fixture, options: { requestId: 100, algorithmVersion: 2, phraseSize: 8 } });
    assert.ok(result.bpmConfidence < 0.5, `${kind} bpmConfidence ${result.bpmConfidence}`);
    assert.ok(result.downbeatConfidence <= result.gridConfidence, `${kind} downbeatConfidence ${result.downbeatConfidence} gridConfidence ${result.gridConfidence}`);
    assert.ok(result.downbeatConfidence <= result.bpmConfidence * 1.2, `${kind} downbeatConfidence ${result.downbeatConfidence} bpmConfidence ${result.bpmConfidence}`);
    assert.equal(result.bpm, result.tempoCandidates[0]?.bpm ?? result.bpm);
  }
});

function createGridFeatures(onsetTimes, sampleRate = 100, duration = 10) {
  const totalFrames = Math.ceil(duration * sampleRate);
  const fluxT = new Array(totalFrames).fill(0.01);
  const rawBassT = new Array(totalFrames).fill(0.02);
  const rmsT = new Array(totalFrames).fill(0.04);
  for (const time of onsetTimes) {
    const frame = Math.max(21, Math.min(totalFrames - 22, Math.round(time * sampleRate)));
    fluxT[frame] = 5;
    rawBassT[frame] = 1;
    rmsT[frame] = 0.8;
  }
  return {
    totalFrames,
    fluxT,
    rawBassT,
    rmsT,
    typRms: 0.2,
    typFlux: 1
  };
}

function runGrid(onsetTimes, duration = 10) {
  const { GridAligner } = createSrcLoader()('analyzer/GridAligner.ts');
  const grid = new GridAligner(createGridFeatures(onsetTimes, 100, duration), 100, 1);
  grid.calculate();
  return grid;
}

test('GridAligner caps bpm confidence for one or two onset intervals', () => {
  const grid = runGrid([0.5, 1.0], 2);

  assert.ok(grid.tempoCandidates.length > 0);
  assert.ok(grid.bpmConfidence < 0.35);
  assert.equal(grid.estimatedBPM, grid.tempoCandidates[0].bpm);
});

test('GridAligner reports low grid confidence for irregular random onsets', () => {
    const grid = runGrid([0.42, 0.91, 1.77, 2.4, 3.31, 4.0, 5.23, 6.01], 7);

    assert.ok(grid.gridConfidence < 0.4);
    assert.ok(grid.downbeatConfidence <= grid.gridConfidence);
    assert.ok(grid.downbeatConfidence <= grid.bpmConfidence * 1.2);
    assert.equal(grid.estimatedBPM, grid.tempoCandidates[0]?.bpm ?? grid.estimatedBPM);
});

test('GridAligner caps downbeat confidence when bpm or grid confidence is low', () => {
  const grid = runGrid([0.42, 0.91, 1.77, 2.4, 3.31, 4.0, 5.23, 6.01], 7);

  assert.ok(grid.bpmConfidence < 0.5 || grid.gridConfidence < 0.5);
  assert.ok(grid.downbeatConfidence < 0.5);
  assert.ok(grid.downbeatConfidence <= grid.gridConfidence);
  assert.ok(grid.downbeatConfidence <= grid.bpmConfidence * 1.2);
});

test('GridAligner marks half-time or double-time tempo candidates', () => {
  const onsetTimes = [];
  let time = 0.5;
  for (let i = 0; i < 18; i++) {
    onsetTimes.push(time);
    time += i % 2 === 0 ? 60 / 85 : 60 / 170;
  }
  const grid = runGrid(onsetTimes, Math.ceil(time + 1));

  assert.ok(grid.tempoCandidates.some(candidate => candidate.isHalfTime || candidate.isDoubleTime));
  assert.equal(grid.estimatedBPM, grid.tempoCandidates[0].bpm);
});

test('GridAligner gives high bpm confidence only with enough clean evidence', () => {
  const onsetTimes = [];
  for (let time = 0.5; time < 9; time += 0.5) onsetTimes.push(time);
  const grid = runGrid(onsetTimes, 10);

  assert.ok(grid.bpmConfidence > 0.8);
  assert.ok(grid.gridConfidence > 0.7);
  assert.equal(grid.estimatedBPM, grid.tempoCandidates[0].bpm);
});

test('SectionAnalyzer uses stable energy-reactive windows when grid confidence is low', () => {
  const { SectionAnalyzer } = createSrcLoader()('analyzer/SectionAnalyzer.ts');
  const totalFrames = 240;
  const rmsT = new Array(totalFrames).fill(0).map((_, index) => index < 80 ? 0.18 : index < 150 ? 0.82 : 0.34);
  const features = {
    totalFrames,
    rmsT,
    rawBassT: rmsT.map(value => value * 0.8),
    rawMidT: rmsT.map(value => value * 0.5),
    rawHighT: rmsT.map(value => value * 0.3),
    fluxT: rmsT.map((value, index) => Math.abs(value - (rmsT[index - 1] ?? value))),
    typRms: 0.5
  };
  features.fluxT[36] = 2;
  const badGrid = {
    bpmConfidence: 0.1,
    gridConfidence: 0.1,
    gridOffset: 0,
    secondsPerBar: 0.2
  };
  const visualFeatures = rmsT.map(value => ({
    melody: 0.1,
    vocal: 0.1,
    fx: value > 0.7 ? 0.5 : 0.1,
    density: value,
    brightness: value * 0.5,
    tension: value
  }));

  const segmenter = new SectionAnalyzer(features, badGrid, 10, 1);
  segmenter.calculate(visualFeatures);

  assert.ok(segmenter.barAnalyses.length <= 24);
  assert.ok(segmenter.trackSections.length > 0);
  assert.ok(segmenter.trackSections.length <= 8);
  assert.equal(segmenter.trackSections[0].end, 3.6);
  assert.ok(segmenter.trackSections.every(section => Number.isFinite(section.start) && section.end > section.start));
});
