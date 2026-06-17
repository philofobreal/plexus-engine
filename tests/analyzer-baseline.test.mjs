import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const FIXTURE_ROOT = join(process.cwd(), 'tests', 'fixtures', 'analyzer');
const baseline = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'headless-baseline.summary.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'analysis-result.schema.json'), 'utf8'));

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

function createSyntheticBuffer(totalSamples, sampleRate) {
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
  return samples;
}

function resolveSchemaRef(ref) {
  const name = ref.replace('#/$defs/', '');
  const resolved = schema.$defs[name];
  assert.ok(resolved, `Unknown schema ref ${ref}`);
  return resolved;
}

function validateSchema(value, node, path = '$') {
  if (node.$ref) return validateSchema(value, resolveSchemaRef(node.$ref), path);

  if (node.type === 'object') {
    assert.equal(typeof value, 'object', `${path} must be object`);
    assert.notEqual(value, null, `${path} must not be null`);
    assert.equal(Array.isArray(value), false, `${path} must not be array`);
    const required = node.required || [];
    for (const key of required) assert.ok(Object.hasOwn(value, key), `${path}.${key} is required`);
    if (node.additionalProperties === false) {
      const allowed = new Set(Object.keys(node.properties || {}));
      for (const key of Object.keys(value)) assert.ok(allowed.has(key), `${path}.${key} is not in schema`);
    }
    for (const [key, child] of Object.entries(node.properties || {})) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], child, `${path}.${key}`);
    }
    return;
  }

  if (node.type === 'array') {
    assert.ok(Array.isArray(value), `${path} must be array`);
    for (let i = 0; i < value.length; i++) validateSchema(value[i], node.items, `${path}[${i}]`);
    return;
  }

  if (node.type === 'number') {
    assert.equal(typeof value, 'number', `${path} must be number`);
    assert.ok(Number.isFinite(value), `${path} must be finite`);
  } else if (node.type === 'string') {
    assert.equal(typeof value, 'string', `${path} must be string`);
  }

  if (node.enum) assert.ok(node.enum.includes(value), `${path} must be one of ${node.enum.join(', ')}`);
}

function round(value) {
  return Number(value.toFixed(6));
}

function summarize(result) {
  const midIndex = Math.floor(result.frames.length / 2);
  const firstEvent = result.events[0];
  const firstSection = result.trackAnalysis.sections[0];
  return {
    requestId: result.requestId,
    bpm: result.bpm,
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
    duration: round(result.trackAnalysis.duration),
    firstFrame: summarizeFrame(result.frames[0]),
    midFrame: summarizeFrame(result.frames[midIndex]),
    firstEvent: firstEvent ? summarizeEvent(firstEvent) : null,
    firstSection: firstSection ? summarizeSection(firstSection) : null,
    tensionTrends: {
      globalSlope: round(result.trackAnalysis.tensionTrends.globalSlope),
      peakTime: round(result.trackAnalysis.tensionTrends.peakTime),
      peakValue: round(result.trackAnalysis.tensionTrends.peakValue),
      segmentCount: result.trackAnalysis.tensionTrends.segments.length
    }
  };
}

function summarizeFrame(frame) {
  return {
    e: round(frame.e),
    densityProj: round(frame.densityProj),
    melodyProj: round(frame.melodyProj),
    fxProj: round(frame.fxProj),
    state: frame.state,
    eRatio: round(frame.eRatio)
  };
}

function summarizeEvent(event) {
  return {
    time: round(event.time),
    intensity: round(event.intensity),
    type: event.type
  };
}

function summarizeSection(section) {
  return {
    start: round(section.start),
    end: round(section.end),
    label: section.label,
    energy: round(section.energy),
    density: round(section.density),
    dominantFeature: section.dominantFeature,
    avgRms: round(section.avgRms),
    peakRms: round(section.peakRms)
  };
}

function assertAlmostDeepEqual(actual, expected, path = '$') {
  if (typeof expected === 'number') {
    assert.ok(Math.abs(actual - expected) <= 0.0001, `${path}: expected ${expected}, got ${actual}`);
    return;
  }
  if (Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, `${path}.length`);
    for (let i = 0; i < expected.length; i++) assertAlmostDeepEqual(actual[i], expected[i], `${path}[${i}]`);
    return;
  }
  if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), `${path} keys`);
    for (const key of Object.keys(expected)) assertAlmostDeepEqual(actual[key], expected[key], `${path}.${key}`);
    return;
  }
  assert.equal(actual, expected, path);
}

test('analyzeAudio output matches schema and baseline summary', () => {
  const { analyzeAudio } = createSrcLoader()('analyzer/analyzeAudio.ts');
  const { sampleRate, totalSamples, requestId, algorithmVersion, phraseSize } = baseline.fixture;
  const samples = createSyntheticBuffer(totalSamples, sampleRate);

  const result = analyzeAudio({ samples, sampleRate, options: { requestId, algorithmVersion, phraseSize } });
  validateSchema(result, schema);
  assertAlmostDeepEqual(summarize(result), baseline.summary);
});
