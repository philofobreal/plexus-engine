import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { generatePerformancePlan } from '../src/automation/performancePlanGenerator.ts';

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
      Number
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }

  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

function loadAnalyzerModule() {
  return createSrcLoader()('analyzer/DramaturgyBuilder.ts');
}

function createRisingAnalysisFrames(count) {
  const features = [];
  const frames = [];
  for (let i = 0; i < count; i++) {
    const ramp = i / (count - 1);
    const sinePressure = Math.sin(2 * Math.PI * (220 + ramp * 660) * (i / 44_100)) * (0.2 + ramp * 0.8);
    const normalized = Math.min(1, Math.abs(sinePressure) + ramp * 0.55);
    features.push({
      melody: ramp * 0.5,
      vocal: ramp * 0.3,
      fx: ramp * 0.6,
      density: normalized,
      brightness: ramp,
      tension: ramp
    });
    frames.push({
      e: normalized,
      densityProj: normalized,
      melodyProj: ramp * 0.5,
      fxProj: ramp * 0.6,
      state: ramp > 0.5 ? 'HIGH' : 'LOW',
      eRatio: ramp
    });
  }
  return { features, frames };
}

test('dramaturgy analysis detects a rising buildup trend', () => {
  const { computeDramaturgyAnalysis } = loadAnalyzerModule();
  const { features, frames } = createRisingAnalysisFrames(160);
  const result = computeDramaturgyAnalysis(features, frames, 1024, 44_100);
  const early = result.buildupConfidence.slice(0, 40).reduce((sum, value) => sum + value, 0) / 40;
  const late = result.buildupConfidence.slice(-40).reduce((sum, value) => sum + value, 0) / 40;

  assert.ok(late > early);
  assert.ok(result.tensionTrends.globalSlope > 0);
  assert.ok(result.tensionTrends.peakTime > 0);
  assert.ok(result.tensionTrends.segments.some(segment => segment.direction === 'rising'));
});

test('dramaturgy analysis is deterministic for identical input', () => {
  const { computeDramaturgyAnalysis } = loadAnalyzerModule();
  const { features, frames } = createRisingAnalysisFrames(120);

  const first = computeDramaturgyAnalysis(features, frames, 1024, 44_100);
  const second = computeDramaturgyAnalysis(features, frames, 1024, 44_100);

  assert.deepEqual(second, first);
});

test('critically low grid and bpm confidence keeps dramaturgy cue timing energy-reactive', async () => {
  const baseAnalysis = {
    duration: 16,
    bpm: 120,
    bpmConfidence: 0.95,
    gridConfidence: 0.92,
    downbeatConfidence: 0.9,
    tempoCandidates: [{ bpm: 120, score: 1, intervalSec: 0.5, peakCount: 12, isHalfTime: false, isDoubleTime: false }],
    bars: [
      { index: 0, start: 0, end: 2, energy: 0.4, density: 0.4, avgRms: 0.4, peakRms: 0.5, bass: 0.3, mid: 0.3, treble: 0.3, state: 'LOW', dominantFeature: 'rhythm' },
      { index: 1, start: 2, end: 4, energy: 0.9, density: 0.8, avgRms: 0.8, peakRms: 0.9, bass: 0.8, mid: 0.5, treble: 0.4, state: 'HIGH', dominantFeature: 'impact' }
    ],
    sections: [
      { start: 0, end: 16, label: 'drop', energy: 0.88, density: 0.82, dominantFeature: 'impact', avgRms: 0.8, peakRms: 0.95 }
    ],
    patterns: [],
    cues: [{ time: 2.26, duration: 0.5, intensity: 1, confidence: 0.96, kind: 'impact' }],
    significantMoments: [{ time: 2.26, duration: 0.5, intensity: 1, confidence: 0.96, kind: 'impact' }],
    features: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    featureHopSize: 1024,
    gridOffset: 0
  };

  const aligned = await generatePerformancePlan(baseAnalysis, ['default.json'], 16);
  const reactive = await generatePerformancePlan({ ...baseAnalysis, bpmConfidence: 0.12, gridConfidence: 0.12 }, ['default.json'], 16);
  const alignedMicro = aligned.points.find(point => point.id.startsWith('micro-impact'));
  const reactiveMicro = reactive.points.find(point => point.id.startsWith('micro-impact'));

  assert.ok(alignedMicro);
  assert.ok(reactiveMicro);
  assert.equal(alignedMicro.time, 2.5);
  assert.equal(reactiveMicro.time, 2.26);
  assert.equal(reactiveMicro.timingMode, 'energy-reactive');
  assert.ok(reactiveMicro.confidence < alignedMicro.confidence);
});
