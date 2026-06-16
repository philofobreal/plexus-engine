import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadAnalyzerModule() {
  const source = readFileSync(join(process.cwd(), 'src/audio/analyzer.worker.ts'), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const context = vm.createContext({
    exports: {},
    self: { onmessage: undefined, postMessage() {} },
    Float32Array,
    Math,
    Number
  });
  vm.runInContext(transpiled, context);
  return context.exports;
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
