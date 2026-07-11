import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

function createLoader() {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module);
    const resolve = request => {
      const base = normalize(join(dirname(path), request));
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require: resolve, Math, Number, Object, Array, Map, Set });
    return module.exports;
  }
  return relative => load(join(SRC_ROOT, relative));
}

test('computeCrossfadeAlpha handles start, midpoint, completion, and backward time', () => {
  const load = createLoader();
  const { computeCrossfadeAlpha } = load('visuals/IdentityTransitionController.ts');
  assert.equal(computeCrossfadeAlpha(10, 10, 2), 0);
  assert.equal(computeCrossfadeAlpha(11, 10, 2), 0.5);
  assert.equal(computeCrossfadeAlpha(12, 10, 2), 1);
  assert.equal(computeCrossfadeAlpha(9, 10, 2), 1);
});

test('requestVisualModeChange flips synchronously, skips paused blending, and anchors export time', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange, clearVisualModeTransition } = load('state/visualModeTransition.ts');

  State.visualMode = 'classic';
  State.isPlaying = false;
  State.isExporting = false;
  requestVisualModeChange('temporal', { durationSec: 2 });
  assert.equal(State.visualMode, 'temporal');
  assert.equal(State.visualModeTransition, null);

  State.isExporting = true;
  State.exportTime = 42.25;
  requestVisualModeChange('cyberpunk', { durationSec: 1.5 });
  assert.equal(State.visualMode, 'cyberpunk');
  assert.equal(State.visualModeTransition.startTimeSec, 42.25);
  assert.equal(State.visualModeTransition.durationSec, 1.5);
  clearVisualModeTransition();
});

test('requestVisualModeChange clamps active dual rendering to 0.1..4 seconds', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange } = load('state/visualModeTransition.ts');
  State.visualMode = 'classic'; State.currentTime = 2; State.isPlaying = true; State.isExporting = false;
  requestVisualModeChange('temporal', { durationSec: 99 });
  assert.equal(State.visualModeTransition.durationSec, 4);
  requestVisualModeChange('cyberpunk', { durationSec: 0.001 });
  assert.equal(State.visualModeTransition.durationSec, 0.1);
});

test('Phase 1 compositor uses source-over and forbids additive lighter blending', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/P5RenderTargetCompositor.ts'), 'utf8');
  assert.match(source, /globalCompositeOperation = 'source-over'/);
  assert.doesNotMatch(source, /globalCompositeOperation = 'lighter'/);
  assert.match(source, /globalAlpha = 1 - mix;[\s\S]*outgoing[\s\S]*globalAlpha = mix;[\s\S]*incoming/);
  const beginFrame = source.match(/beginFrame\([^]*?\n    \}/)?.[0] ?? '';
  assert.match(beginFrame, /this\.outgoing\.clear\(\)/);
  assert.match(beginFrame, /this\.incoming\.clear\(\)/);
  assert.doesNotMatch(beginFrame, /activeGeneration|generation !==/);
});

test('controller composites only while active and advances shared simulation exactly once', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange } = load('state/visualModeTransition.ts');
  const { IdentityTransitionController } = load('visuals/IdentityTransitionController.ts');
  const calls = [];
  const outgoing = { id: 'classic', usesSharedSimulation: true, draw: (_b, _p, _s, c) => calls.push(['out', c.advanceSharedSimulation, c.timeSec]) };
  const incoming = { id: 'temporal', usesSharedSimulation: true, draw: (_b, _p, _s, c) => calls.push(['in', c.advanceSharedSimulation, c.timeSec]) };
  const registry = { get: id => id === 'classic' ? outgoing : incoming };
  const compositor = {
    outgoingBackend: {}, incomingBackend: {}, beginCalls: 0, compositeCalls: 0,
    beginFrame() { this.beginCalls++; }, composite() { this.compositeCalls++; }
  };
  const backend = { width: 960, height: 540 };
  const controller = new IdentityTransitionController();

  State.visualMode = 'classic';
  State.currentTime = 5;
  State.isPlaying = true;
  State.isExporting = false;
  requestVisualModeChange('temporal', { durationSec: 2 });
  controller.draw(5.5, backend, compositor, registry, [], []);
  assert.deepEqual(calls, [['in', true, 5.5], ['out', false, 5.5]]);
  assert.equal(compositor.beginCalls, 1);
  assert.equal(compositor.compositeCalls, 1);

  calls.length = 0;
  controller.draw(7, backend, compositor, registry, [], []);
  assert.deepEqual(calls, [['in', true, 7]]);
  assert.equal(compositor.beginCalls, 1);
  assert.equal(compositor.compositeCalls, 1);
});

test('non-pool incoming identity delegates the single simulation advance to outgoing', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange } = load('state/visualModeTransition.ts');
  const { IdentityTransitionController } = load('visuals/IdentityTransitionController.ts');
  const calls = [];
  const outgoing = { id: 'classic', usesSharedSimulation: true, draw: (_b, _p, _s, c) => calls.push(['out', c.advanceSharedSimulation]) };
  const incoming = { id: 'cosmic-wormhole', draw: (_b, _p, _s, c) => calls.push(['in', c.advanceSharedSimulation]) };
  const registry = { get: id => id === 'classic' ? outgoing : incoming };
  const compositor = { outgoingBackend: {}, incomingBackend: {}, beginFrame() {}, composite() {} };
  State.visualMode = 'classic'; State.currentTime = 0; State.isPlaying = true; State.isExporting = false;
  requestVisualModeChange('cosmic-wormhole', { durationSec: 1 });
  new IdentityTransitionController().draw(0.5, { width: 1, height: 1 }, compositor, registry, [], []);
  assert.deepEqual(calls, [['out', true], ['in', false]]);
});

function sourceFiles(root) {
  const result = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) result.push(...sourceFiles(path));
    else if (path.endsWith('.ts')) result.push(path);
  }
  return result;
}

test('State.visualMode has one runtime writer', () => {
  const writers = sourceFiles(SRC_ROOT).filter(path => /State\.visualMode\s*=(?!=)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(writers.map(path => normalize(path)), [normalize(join(SRC_ROOT, 'state/visualModeTransition.ts'))]);
});
