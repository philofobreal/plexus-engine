import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

function createLoader() {
  const cache = new Map();
  function load(filePath) {
    if (cache.has(filePath)) return cache.get(filePath).exports;
    const output = ts.transpileModule(readFileSync(filePath, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(filePath, module);
    vm.runInContext(output, vm.createContext({
      exports: module.exports, module, Math, Number, Object, Map, Set,
      require(request) {
        if (request === 'p5') return function P5() {};
        const base = normalize(join(dirname(filePath), request));
        let target = base.endsWith('.ts') ? base : `${base}.ts`;
        try { readFileSync(target); } catch { target = join(base, 'index.ts'); }
        return load(target);
      }
    }), { filename: filePath });
    return module.exports;
  }
  return relativePath => load(join(SRC_ROOT, relativePath));
}

function frame() {
  return {
    timeSec: 0, durationSec: 4, narrativeState: 'DEVELOPMENT', primaryPattern: 'FLOW', actions: {},
    motion: { speed: 0, complexity: 0, variation: { seed: 1, phraseIndex: 0, variationIndex: 0 } },
    confidence: 1
  };
}

test('SemanticRuntimeAdapter preserves untouched tuning and clamps written deltas', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  const resolver = new SemanticResolver({
    map: () => ({ audioSensitivity: 100, lineAlpha: -100 })
  });
  resolver.setPlan({ version: '1.0', trackHash: 'integration', frames: [frame()] });

  const target = { ...defaultVisualTuning, lineDistance: 6.5, circleHue: 133 };
  const adapter = new SemanticRuntimeAdapter(resolver);
  adapter.setBaseTuning(target);
  adapter.update(0, target);

  assert.equal(target.audioSensitivity, 4);
  assert.equal(target.lineAlpha, 0);
  assert.equal(target.lineDistance, 6.5);
  assert.equal(target.circleHue, 133);
});

test('SemanticRuntimeAdapter uses a stable fallback base without accumulating deltas', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  const resolver = new SemanticResolver({ map: () => ({ audioSensitivity: 0.5 }) });
  resolver.setPlan({ version: '1.0', trackHash: 'stable-base', frames: [frame()] });
  const target = { ...defaultVisualTuning };
  const adapter = new SemanticRuntimeAdapter(resolver);

  adapter.update(0, target);
  adapter.update(0, target);
  assert.equal(target.audioSensitivity, 1.5);
});

test('SemanticRuntimeAdapter restores owned keys when a later frame drops its delta', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  const resolver = new SemanticResolver({
    map: input => input.actions.EXPAND > 0 ? { lineDistance: 1.2 } : {}
  });
  resolver.setPlan({
    version: '1.0', trackHash: 'stale-delta',
    frames: [
      { ...frame(), durationSec: 1, actions: { EXPAND: 1 }, transition: { type: 'CUT', durationSec: 0 } },
      { ...frame(), timeSec: 1, actions: {} }
    ]
  });
  const target = { ...defaultVisualTuning };
  const baseLineDistance = target.lineDistance;
  const adapter = new SemanticRuntimeAdapter(resolver);

  adapter.update(0, target);
  assert.equal(target.lineDistance, baseLineDistance + 1.2);
  adapter.update(1, target);
  assert.equal(target.lineDistance, baseLineDistance);
});

test('SemanticRuntimeAdapter restores owned keys after the last frame expires', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  const resolver = new SemanticResolver({ map: () => ({ audioSensitivity: 0.5 }) });
  resolver.setPlan({ version: '1.0', trackHash: 'finite-last-frame', frames: [{ ...frame(), durationSec: 1 }] });
  const target = { ...defaultVisualTuning };
  const baseSensitivity = target.audioSensitivity;
  const adapter = new SemanticRuntimeAdapter(resolver);

  adapter.update(0, target);
  assert.equal(target.audioSensitivity, baseSensitivity + 0.5);
  adapter.update(1, target);
  assert.equal(target.audioSensitivity, baseSensitivity);
});

test('SemanticRuntimeAdapter releases owned keys when its plan is removed', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  const resolver = new SemanticResolver({ map: () => ({ audioSensitivity: 0.5 }) });
  resolver.setPlan({ version: '1.0', trackHash: 'removed-plan', frames: [frame()] });
  const target = { ...defaultVisualTuning };
  const baseSensitivity = target.audioSensitivity;
  const adapter = new SemanticRuntimeAdapter(resolver);

  adapter.update(0, target);
  assert.equal(target.audioSensitivity, baseSensitivity + 0.5);
  resolver.setPlan(null);
  adapter.update(0, target);
  assert.equal(target.audioSensitivity, baseSensitivity);

  target.audioSensitivity = baseSensitivity + 0.25;
  adapter.update(0, target);
  assert.equal(target.audioSensitivity, baseSensitivity + 0.25);
});

test('semantic tuning ownership requires an active plan on the enabled semantic path', () => {
  const load = createLoader();
  const { isSemanticTuningActive } = load('ui/semanticAutomationPolicy.ts');
  const flags = { semanticResolver: false, semanticChoreography: true };

  assert.equal(isSemanticTuningActive(flags, false, false), false);
  assert.equal(isSemanticTuningActive(flags, true, false), true);
  assert.equal(isSemanticTuningActive({ ...flags, semanticResolver: true }, false, false), false);
  assert.equal(isSemanticTuningActive({ ...flags, semanticResolver: true }, false, true), true);
});

test('preset automation still selects new points while both semantic feature flags are enabled', () => {
  const load = createLoader();
  const { findActiveAutomationPoint } = load('ui/performanceAutomationRuntime.ts');
  const point = (id, time, preset) => ({
    id, time, preset, sectionId: id, confidence: 1, intensity: 1, reason: 'drop',
    morphDurationSec: 1, morphCurve: 'easeInOut'
  });
  const plan = { version: 1, source: 'auto', points: [
    point('a', 0, 'temporal1.json'), point('b', 8, 'temporal3.json'), point('c', 16, 'temporal5.json')
  ] };
  const flags = { semanticResolver: true, semanticChoreography: true };

  assert.deepEqual(flags, { semanticResolver: true, semanticChoreography: true });
  assert.equal(findActiveAutomationPoint(plan, 4).id, 'a');
  assert.equal(findActiveAutomationPoint(plan, 10).id, 'b');
  assert.equal(findActiveAutomationPoint(plan, 18).id, 'c');
});

test('Visual OS preset changes compose with semantic identity instead of being overwritten', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const {
    resetActiveVisualTransitions,
    setActiveVisualTransitionComponent
  } = load('state/visualTransitionState.ts');
  const { findActiveAutomationPoint } = load('ui/performanceAutomationRuntime.ts');
  const point = (id, time, preset) => ({
    id, time, preset, sectionId: id, confidence: 1, intensity: 1, reason: 'drop',
    morphDurationSec: 1, morphCurve: 'easeInOut'
  });
  const plan = { version: 1, source: 'auto', points: [
    point('straight', 0, 'temporal1.json'),
    point('burst', 8, 'temporal2.json'),
    point('overdrive', 16, 'temporal4.json')
  ] };

  resetActiveVisualTransitions();
  setActiveVisualTransitionComponent('semantic-score', 'score:drop:0');
  const identities = [4, 10, 18].map(time => {
    const active = findActiveAutomationPoint(plan, time);
    setActiveVisualTransitionComponent('automation', `automation:${active.id}`);
    return { preset: active.preset, identity: State.activeVisualTransitionId };
  });

  assert.deepEqual(identities.map(value => value.preset), [
    'temporal1.json', 'temporal2.json', 'temporal4.json'
  ]);
  assert.equal(new Set(identities.map(value => value.identity)).size, 3);
  for (const value of identities) {
    assert.match(value.identity, /^automation:/);
    assert.match(value.identity, /\|score:drop:0$/);
  }
});

test('Plan -> Resolver -> Bridge -> targetTuning clamps extreme semantic actions', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { SemanticRendererBridge } = load('visuals/PlexusRenderer.ts');
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  const resolver = new SemanticResolver({
    map: input => ({ audioSensitivity: input.actions.EXPAND * 100 })
  });
  resolver.setPlan({
    version: '1.0', trackHash: 'bridge-chain',
    frames: [{ ...frame(), actions: { EXPAND: 999 } }]
  });
  const target = { ...defaultVisualTuning, circleHue: 147 };
  const bridge = new SemanticRendererBridge();
  bridge.setSemanticAdapter(new SemanticRuntimeAdapter(resolver));
  bridge.updateSemantic(0, target);

  assert.equal(target.audioSensitivity, 4);
  assert.equal(target.circleHue, 147);
});

test('SemanticRendererBridge is active only while its resolver has a plan', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { SemanticRendererBridge } = load('visuals/PlexusRenderer.ts');
  const resolver = new SemanticResolver();
  const bridge = new SemanticRendererBridge();
  bridge.setSemanticAdapter(new SemanticRuntimeAdapter(resolver));

  assert.equal(bridge.hasPlan(), false);
  resolver.setPlan({ version: '1.0', trackHash: 'active', frames: [frame()] });
  assert.equal(bridge.hasPlan(), true);
  resolver.setPlan(null);
  assert.equal(bridge.hasPlan(), false);
});

test('SemanticRendererBridge publishes a stable transition id when the active score frame changes', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { SemanticRuntimeAdapter } = load('semantics/SemanticRuntimeAdapter.ts');
  const { SemanticRendererBridge } = load('visuals/PlexusRenderer.ts');
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  const resolver = new SemanticResolver();
  const first = { ...frame(), durationSec: 1 };
  const second = {
    ...frame(), timeSec: 1,
    motion: { ...frame().motion, variation: { seed: 2, phraseIndex: 1, variationIndex: 0 } }
  };
  resolver.setPlan({ version: '1.0', trackHash: 'transition-ids', frames: [first, second] });
  const bridge = new SemanticRendererBridge();
  bridge.setSemanticAdapter(new SemanticRuntimeAdapter(resolver));
  const target = { ...defaultVisualTuning };

  const firstId = bridge.updateSemantic(0, target);
  assert.equal(bridge.updateSemantic(0.5, target), firstId);
  const secondId = bridge.updateSemantic(1, target);
  assert.notEqual(secondId, firstId);
  assert.match(firstId, /^score:/);
  assert.match(secondId, /^score:/);
});
