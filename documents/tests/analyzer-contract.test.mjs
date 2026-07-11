import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const FIXTURE_ROOT = join(ROOT, 'tests/fixtures/analyzer');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

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

function buildContractFixture() {
  const sampleRate = 44_100;
  const totalSamples = 1024 * 96;
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    const beatGate = i % 11_025 < 512 ? 1 : 0;
    const barGate = i % 44_100 < 2048 ? 1 : 0;
    const slowRise = Math.min(1, i / (1024 * 64));
    samples[i] = Math.sin(2 * Math.PI * 220 * time) * 0.22
      + Math.sin(2 * Math.PI * 440 * time) * 0.11 * slowRise
      + Math.sin(2 * Math.PI * 1760 * time) * 0.06
      + beatGate * Math.sin(2 * Math.PI * 80 * time) * 0.62
      + barGate * Math.sin(2 * Math.PI * 120 * time) * 0.18;
  }

  return { sampleRate, totalSamples, samples };
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function summarize(result) {
  const midFrame = result.frames[Math.floor(result.frames.length / 2)];
  const firstFrame = result.frames[0];
  const firstEvent = result.events[0] ?? null;
  const firstSection = result.trackAnalysis.sections[0] ?? null;

  return {
    requestId: result.requestId,
    bpm: result.bpm,
    bpmConfidence: round(result.bpmConfidence),
    gridConfidence: round(result.gridConfidence),
    downbeatConfidence: round(result.downbeatConfidence),
    tempoCandidateCount: result.tempoCandidates.length,
    topTempoCandidate: result.tempoCandidates[0] ? {
      bpm: result.tempoCandidates[0].bpm,
      score: round(result.tempoCandidates[0].score),
      intervalSec: round(result.tempoCandidates[0].intervalSec),
      peakCount: result.tempoCandidates[0].peakCount,
      isHalfTime: result.tempoCandidates[0].isHalfTime,
      isDoubleTime: result.tempoCandidates[0].isDoubleTime
    } : null,
    adaptiveThreshold: round(result.adaptiveThreshold),
    hopSize: result.hopSize,
    frameCount: result.frames.length,
    eventCount: result.events.length,
    barCount: result.trackAnalysis.bars.length,
    sectionCount: result.trackAnalysis.sections.length,
    patternCount: result.trackAnalysis.patterns.length,
    cueCount: result.trackAnalysis.cues.length,
    significantMomentCount: result.trackAnalysis.significantMoments.length,
    featureCount: result.trackAnalysis.features.length,
    buildupCount: result.trackAnalysis.buildupConfidence.length,
    spectralPivotCount: result.trackAnalysis.spectralPivot.length,
    featureHopSize: result.trackAnalysis.featureHopSize,
    gridOffset: round(result.trackAnalysis.gridOffset),
    trackBpmConfidence: round(result.trackAnalysis.bpmConfidence),
    trackGridConfidence: round(result.trackAnalysis.gridConfidence),
    trackDownbeatConfidence: round(result.trackAnalysis.downbeatConfidence),
    trackTempoCandidateCount: result.trackAnalysis.tempoCandidates.length,
    duration: round(result.trackAnalysis.duration),
    firstFrame: {
      e: round(firstFrame.e),
      densityProj: round(firstFrame.densityProj),
      melodyProj: round(firstFrame.melodyProj),
      fxProj: round(firstFrame.fxProj),
      state: firstFrame.state,
      eRatio: round(firstFrame.eRatio)
    },
    midFrame: {
      e: round(midFrame.e),
      densityProj: round(midFrame.densityProj),
      melodyProj: round(midFrame.melodyProj),
      fxProj: round(midFrame.fxProj),
      state: midFrame.state,
      eRatio: round(midFrame.eRatio)
    },
    firstEvent: firstEvent ? {
      time: round(firstEvent.time),
      intensity: round(firstEvent.intensity),
      type: firstEvent.type
    } : null,
    firstSection: firstSection ? {
      start: round(firstSection.start),
      end: round(firstSection.end),
      label: firstSection.label,
      energy: round(firstSection.energy),
      density: round(firstSection.density),
      dominantFeature: firstSection.dominantFeature,
      avgRms: round(firstSection.avgRms),
      peakRms: round(firstSection.peakRms)
    } : null,
    tensionTrends: {
      globalSlope: round(result.trackAnalysis.tensionTrends.globalSlope),
      peakTime: round(result.trackAnalysis.tensionTrends.peakTime),
      peakValue: round(result.trackAnalysis.tensionTrends.peakValue),
      segmentCount: result.trackAnalysis.tensionTrends.segments.length
    }
  };
}

function analyzeFixture() {
  const baseline = readJson(join(FIXTURE_ROOT, 'headless-baseline.summary.json'));
  const { analyzeAudio } = createSrcLoader()('analyzer/analyzeAudio.ts');
  const fixture = buildContractFixture();

  assert.equal(fixture.sampleRate, baseline.fixture.sampleRate);
  assert.equal(fixture.totalSamples, baseline.fixture.totalSamples);

  return analyzeAudio({
    samples: fixture.samples,
    sampleRate: fixture.sampleRate,
    options: {
      requestId: baseline.fixture.requestId,
      algorithmVersion: baseline.fixture.algorithmVersion,
      phraseSize: baseline.fixture.phraseSize
    }
  });
}

function resolveRef(schema, rootSchema) {
  if (!schema.$ref) return schema;
  const parts = schema.$ref.split('/').slice(1);
  return parts.reduce((node, part) => node[part], rootSchema);
}

function validateSchema(value, schema, rootSchema, path = '$') {
  const resolved = resolveRef(schema, rootSchema);

  if (resolved.enum) {
    assert.ok(resolved.enum.includes(value), `${path} must be one of ${resolved.enum.join(', ')}`);
  }

  if (resolved.type === 'number') {
    assert.equal(typeof value, 'number', `${path} must be a number`);
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }

  if (resolved.type === 'string') {
    assert.equal(typeof value, 'string', `${path} must be a string`);
    return;
  }

  if (resolved.type === 'boolean') {
    assert.equal(typeof value, 'boolean', `${path} must be a boolean`);
    return;
  }

  if (resolved.type === 'array') {
    assert.ok(Array.isArray(value), `${path} must be an array`);
    for (let i = 0; i < value.length; i++) {
      validateSchema(value[i], resolved.items, rootSchema, `${path}[${i}]`);
    }
    return;
  }

  if (resolved.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
    const keys = Object.keys(value);
    for (const requiredKey of resolved.required ?? []) {
      assert.ok(Object.hasOwn(value, requiredKey), `${path}.${requiredKey} is required`);
    }
    if (resolved.additionalProperties === false) {
      for (const key of keys) {
        assert.ok(Object.hasOwn(resolved.properties ?? {}, key), `${path}.${key} is not in schema`);
      }
    }
    for (const [key, propertySchema] of Object.entries(resolved.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], propertySchema, rootSchema, `${path}.${key}`);
    }
  }
}

test('analyzeAudio output matches the stable JSON schema snapshot', () => {
  const schema = readJson(join(FIXTURE_ROOT, 'analysis-result.schema.json'));
  const result = analyzeFixture();

  validateSchema(JSON.parse(JSON.stringify(result)), schema, schema);
});

test('analyzeAudio fixture output matches the SaaS/VST baseline summary', () => {
  const baseline = readJson(join(FIXTURE_ROOT, 'headless-baseline.summary.json'));
  const result = analyzeFixture();

  assert.deepEqual(summarize(result), baseline.summary);
});
