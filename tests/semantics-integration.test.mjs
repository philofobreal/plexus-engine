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

test('automation yields to ADR-004 only when a time-based plan exists', () => {
  const load = createLoader();
  const { SemanticResolver } = load('semantics/SemanticResolver.ts');
  const { shouldYieldPerformanceAutomation } = load('ui/semanticAutomationPolicy.ts');
  const resolver = new SemanticResolver();
  const flags = { semanticResolver: false, semanticChoreography: true };

  resolver.setPlan(null);
  assert.equal(shouldYieldPerformanceAutomation(flags, resolver.hasPlan()), false);
  resolver.setPlan({ version: '1.0', trackHash: 'active', frames: [frame()] });
  assert.equal(shouldYieldPerformanceAutomation(flags, resolver.hasPlan()), true);
  assert.equal(shouldYieldPerformanceAutomation({ ...flags, semanticResolver: true }, false), true);
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
