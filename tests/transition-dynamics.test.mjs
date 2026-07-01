import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function load(file) {
  const cache = new Map();
  function visit(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, { module, exports: module.exports, require(request) {
      const base = normalize(join(dirname(path), request));
      return visit(base.endsWith('.ts') ? base : `${base}.ts`);
    }, Math, Number });
    return module.exports;
  }
  return visit(join(process.cwd(), 'src', file));
}

const dynamics = load('automation/transitionDynamics.ts');
const envelope = { attackSec: 2, sustainSec: 4, releaseSec: 1, cooldownSec: 1 };
const analysis = (sections, noveltyPeaks = [], cues = []) => ({
  sections, noveltyPeaks, cues, timingConfidence: { overall: 0.9 }
});

test('soft low-contrast evidence lengthens attack while preserving release, cooldown, and total', () => {
  const a = analysis([{ start: 0, end: 16, energy: 0.4, density: 0.4 }, { start: 16, end: 32, energy: 0.42, density: 0.41 }]);
  const profile = dynamics.computeTransitionDynamicsProfile({ analysis: a, timeSec: 16 });
  const adapted = dynamics.adaptAutomationEnvelopeToDynamics(envelope, profile);
  assert.ok(adapted.attackSec > envelope.attackSec);
  assert.equal(adapted.releaseSec, envelope.releaseSec);
  assert.equal(adapted.cooldownSec, envelope.cooldownSec);
  assert.ok(Math.abs(Object.values(adapted).reduce((x, y) => x + y, 0) - 8) < 1e-9);
  assert.equal(dynamics.adaptMorphCurveToDynamics('linear', profile), 'easeInOut');
});

test('drop/transient evidence shortens attack and permits exponential curve deterministically', () => {
  const a = analysis(
    [{ start: 0, end: 16, energy: 0.15, density: 0.2 }, { start: 16, end: 32, energy: 0.95, density: 0.9, reasons: ['high-transient'] }],
    [{ time: 16, value: 0.95 }], [{ time: 16, kind: 'impact', intensity: 1, confidence: 1 }]
  );
  const input = { analysis: a, timeSec: 16 };
  const p1 = dynamics.computeTransitionDynamicsProfile(input);
  const p2 = dynamics.computeTransitionDynamicsProfile(input);
  assert.deepEqual(p1, p2);
  assert.ok(dynamics.adaptAutomationEnvelopeToDynamics(envelope, p1).attackSec < envelope.attackSec);
  assert.equal(dynamics.adaptMorphCurveToDynamics('easeInOut', p1), 'exponential');
});

test('missing analysis preserves the old envelope and curve', () => {
  const profile = dynamics.computeTransitionDynamicsProfile({ timeSec: 0 });
  assert.equal(JSON.stringify(dynamics.adaptAutomationEnvelopeToDynamics(envelope, profile)), JSON.stringify(envelope));
  assert.equal(dynamics.adaptMorphCurveToDynamics('linear', profile), 'linear');
});

test('real TrackAnalysis feature windows produce different intra-section profiles', () => {
  const features = Array.from({ length: 32 }, (_, i) => ({
    melody: 0.2, vocal: 0.1, brightness: 0.3,
    density: i < 20 ? 0.2 : 0.9,
    fx: i >= 20 && i < 24 ? 0.95 : 0.05,
    tension: i < 20 ? 0.25 : 0.85
  }));
  const realistic = {
    duration: 32, bpm: 120, bpmConfidence: 0.9, gridConfidence: 0.9, downbeatConfidence: 0.9,
    tempoCandidates: [], bars: [],
    sections: [{ start: 0, end: 32, label: 'verse', energy: 0.5, density: 0.5, dominantFeature: 'rhythm', avgRms: 0.48, peakRms: 0.7, reasons: [] }],
    patterns: [], cues: [], significantMoments: [], features, buildupConfidence: [], spectralPivot: [],
    tensionTrends: { globalSlope: 0, peakTime: 22, peakValue: 0.9, segments: [] },
    noveltyCurve: features.map((_, i) => i === 21 ? 0.9 : 0), noveltyPeaks: [], boundaryCandidates: [],
    featureHopSize: 1024, gridOffset: 0, tempo: 120, tempoConfidence: 0.9, beats: [], beatConfidence: 0.9,
    barStarts: [], alternativeTempos: [], timingConfidence: { tempo: 0.9, beat: 0.9, grid: 0.9, overall: 0.9 }
  };
  const calm = dynamics.computeTransitionDynamicsProfile({ analysis: realistic, timeSec: 8 });
  const change = dynamics.computeTransitionDynamicsProfile({ analysis: realistic, timeSec: 20 });
  assert.ok(change.localContrast > calm.localContrast);
  assert.ok(change.transientness > calm.transientness);
  assert.ok(change.energySlope > 0 && change.energySlope < change.energyDelta, 'slope is bounded and time-normalized');
});
