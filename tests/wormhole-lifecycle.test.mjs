import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadTypeScriptModule(relativePath) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Math, Number });
  return module.exports;
}

test('long wormhole and hero playback never allocates or accumulates shockwaves', () => {
  const { ShockwaveLifecycle } = loadTypeScriptModule('src/visuals/ShockwaveLifecycle.ts');
  const lifecycle = new ShockwaveLifecycle('cosmic-wormhole');
  let allocations = 0;

  for (let i = 0; i < 100_000; i++) {
    lifecycle.emit('cosmic-wormhole', () => ({ id: allocations++ }));
    lifecycle.emit('hero', () => ({ id: allocations++ }));
  }

  assert.equal(lifecycle.items.length, 0);
  assert.equal(allocations, 0);
});

test('visual mode changes clear accumulated shockwaves without owning dramaturgy state', () => {
  const { ShockwaveLifecycle } = loadTypeScriptModule('src/visuals/ShockwaveLifecycle.ts');
  const lifecycle = new ShockwaveLifecycle('classic');

  for (let i = 0; i < 250; i++) lifecycle.emit('classic', () => ({ id: i }));
  assert.equal(lifecycle.items.length, 250);
  assert.equal(lifecycle.syncMode('cosmic-wormhole'), true);
  assert.equal(lifecycle.items.length, 0);
  assert.equal(lifecycle.syncMode('cosmic-wormhole'), false);
});

test('depth wrapping stays within the live horizon and maps exact zero to epsilon', () => {
  const { wrapDepth } = loadTypeScriptModule('src/visuals/WormholeDepth.ts');

  assert.equal(wrapDepth(1500, 1000), 500);
  assert.equal(wrapDepth(-10, 1000), 990);
  assert.equal(wrapDepth(1000, 1000), 1e-3);
  assert.equal(wrapDepth(Number.NaN, 1000), 1e-3);
  assert.ok(wrapDepth(4999, 500) > 0 && wrapDepth(4999, 500) < 500);
});

test('wormhole emission modes are deterministic and sparse mode omits most grains', () => {
  const { wormholeEmissionGain } = loadTypeScriptModule('src/visuals/WormholeEmission.ts');
  const first = Array.from({ length: 360 }, (_, index) => wormholeEmissionGain(2, index * 12.9898, 48, 1));
  const second = Array.from({ length: 360 }, (_, index) => wormholeEmissionGain(2, index * 12.9898, 48, 1));

  assert.deepEqual(first, second);
  assert.equal(wormholeEmissionGain(0, 10, 48, 0), 1);
  assert.ok(wormholeEmissionGain(1, 10, 48, 1) > wormholeEmissionGain(1, 10, 0, 0));
  const active = first.filter(value => value > 0).length;
  assert.ok(active > 0 && active < first.length * 0.35, `unexpected sparse population: ${active}`);
});

test('fractional wormhole emission coordinates crossfade adjacent valid modes', () => {
  const { wormholeEmissionGain } = loadTypeScriptModule('src/visuals/WormholeEmission.ts');
  const dense = wormholeEmissionGain(0, 10, 48, 0);
  const pulse = wormholeEmissionGain(1, 10, 48, 0);
  assert.equal(wormholeEmissionGain(0.5, 10, 48, 0), dense + (pulse - dense) * 0.5);
});

test('wormhole emission helper stays renderer-independent and allocation-free by construction', () => {
  const source = readFileSync(join(process.cwd(), 'src/visuals/WormholeEmission.ts'), 'utf8');
  // Stateful envelopes may allocate their tracker once at identity construction; draw-time
  // helpers must still avoid random or collection/object allocation in the hot path.
  assert.doesNotMatch(source, /Math\.random|\[\]|\{\s*\}/);
  assert.doesNotMatch(source, /Renderer|backend|document|window|p5/i);
});

test('wormhole transition tracker reacts once to each legacy or semantic identity', () => {
  const { WormholeTransitionTracker } = loadTypeScriptModule('src/visuals/WormholeEmission.ts');
  const tracker = new WormholeTransitionTracker();

  assert.equal(tracker.update(null), false);
  assert.equal(tracker.update('automation:point-a'), true);
  assert.equal(tracker.update('automation:point-a'), false);
  assert.equal(tracker.update('motif:12:tunnel-drive:0'), true);
  assert.equal(tracker.update('motif:12:tunnel-drive:0'), false);
  assert.equal(tracker.update(null), false);
  assert.equal(tracker.update('motif:12:tunnel-drive:0'), true);
});

test('wormhole automation transition starts without an instant curve surge', () => {
  const { WormholeAutomationTransition } = loadTypeScriptModule('src/visuals/WormholeEmission.ts');
  const transition = new WormholeAutomationTransition();

  assert.equal(transition.update('point-a', 10, 12), 0);
  assert.ok(transition.update('point-a', 10.016, 12) < 0.001);
});

test('wormhole automation response follows morph duration without resetting instantly', () => {
  const { WormholeAutomationTransition } = loadTypeScriptModule('src/visuals/WormholeEmission.ts');
  const longMorph = new WormholeAutomationTransition();
  const shortMorph = new WormholeAutomationTransition();

  longMorph.update('point-a', 0, 12);
  shortMorph.update('point-a', 0, 0.5);
  const longFirstFrame = longMorph.update('point-a', 1 / 60, 12);
  const shortFirstFrame = shortMorph.update('point-a', 1 / 60, 0.5);

  assert.ok(longFirstFrame < 0.001, `long morph surged on first frame: ${longFirstFrame}`);
  assert.ok(shortFirstFrame > longFirstFrame, 'short morph should respond faster');
  assert.ok(shortFirstFrame < 0.01, `short morph reset instantly: ${shortFirstFrame}`);
  assert.ok(longMorph.update('point-a', 6, 12) > longFirstFrame);
});

test('semantic transition identities are deterministic and distinguish adjacent frames', () => {
  const { motifTransitionId, semanticScoreTransitionId } = loadTypeScriptModule('src/visuals/VisualTransitionIdentity.ts');
  const motifA = { time: 8, motifId: 'tunnel-a', phrasePosition: 0, actions: {}, activeOperators: [] };
  const motifB = { ...motifA, time: 12, motifId: 'tunnel-b' };
  const scoreA = {
    timeSec: 8, durationSec: 4, primaryPattern: 'FLOW', narrativeState: 'DEVELOPMENT', actions: {},
    motion: { speed: 0.5, complexity: 0.4, variation: { seed: 1, phraseIndex: 2, variationIndex: 0 } },
    confidence: 1
  };
  const scoreB = { ...scoreA, timeSec: 12, motion: { ...scoreA.motion, variation: { ...scoreA.motion.variation, variationIndex: 1 } } };

  assert.equal(motifTransitionId(motifA), motifTransitionId({ ...motifA }));
  assert.notEqual(motifTransitionId(motifA), motifTransitionId(motifB));
  assert.equal(semanticScoreTransitionId(scoreA), semanticScoreTransitionId({ ...scoreA }));
  assert.notEqual(semanticScoreTransitionId(scoreA), semanticScoreTransitionId(scoreB));
  assert.equal(motifTransitionId(null), null);
  assert.equal(semanticScoreTransitionId(null), null);
});
