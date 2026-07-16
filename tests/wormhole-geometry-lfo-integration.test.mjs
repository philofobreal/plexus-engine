import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const PRESET_ROOT = join(process.cwd(), 'public', 'visual-tuning-presets');

function createSourceLoader() {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const output = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module);
    const require = request => {
      const base = normalize(join(dirname(path), request));
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require, Math, Number, Array, Object, Map, Set, Uint16Array });
    return module.exports;
  }
  return relative => load(join(process.cwd(), 'src', relative));
}

const WAVEFORMS = { off: 0, sine: 1, saw: 2, triangle: 3, square: 4, randomGlide: 5, pluck: 6, organic: 7 };

function testFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(0.9), ...new Array(16).fill(0.1)],
    state: 'HIGH'
  };
}

function setupState(State) {
  State.sampleRate = 1000;
  State.hopSize = 100;
  State.frames = Array.from({ length: 400 }, () => testFrame());
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = testFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.isExporting = false;
  State.playbackFade = 1;
  State.isPlaying = true;
}

function tuning(overrides = {}) {
  return {
    wormholeRadius: 1.4, wormholeDepth: 2.6, wormholeSpeed: 2, wormholeWarp: 0.3, wormholeCurve: 0,
    wormholePathBend: 0, wormholePathBendVertical: 0, wormholeRing: 0, wormholeDepthCoherence: 0,
    wormholeRadiusLfoWaveform: WAVEFORMS.sine, wormholeRadiusLfoRate: 1, wormholeRadiusLfoAmount: 0.25,
    wormholeDepthLfoWaveform: WAVEFORMS.off, wormholeDepthLfoRate: 1, wormholeDepthLfoAmount: 0.25,
    wormholeContinuity: 1.2, wormholeStarfield: 0, wormholeGalaxy: 0, wormholeSkybox: 0,
    wormholeEmissionMode: 0, wormholeJitter: 0, performanceMode: 0, chromaKeyMode: 0,
    ...overrides
  };
}

test('radius and depth LFOs change continuously from canonical time, not grain release generation', () => {
  const { effectiveWormholeGeometryValue } = createSourceLoader()('visuals/WormholeGeometryLfo.ts');
  const atStart = effectiveWormholeGeometryValue(2, WAVEFORMS.sine, 0, 1, 0.25);
  const quarterCycle = effectiveWormholeGeometryValue(2, WAVEFORMS.sine, 0.25, 1, 0.25);
  assert.equal(atStart, 2);
  assert.equal(quarterCycle, 2.5);
});

test('the canonical time LFO has identical output after a seek and at 30/60/120 FPS', () => {
  const { effectiveWormholeGeometryValue } = createSourceLoader()('visuals/WormholeGeometryLfo.ts');
  const targetTime = 17.5;
  const values = [30, 60, 120].map(fps => {
    let value = 0;
    for (let frame = 0; frame <= targetTime * fps; frame++) {
      value = effectiveWormholeGeometryValue(1.4, WAVEFORMS.organic, frame / fps, 0.17, 0.3);
    }
    return value;
  });
  const afterSeek = effectiveWormholeGeometryValue(1.4, WAVEFORMS.organic, targetTime, 0.17, 0.3);
  assert.deepEqual(values, [afterSeek, afterSeek, afterSeek]);
});

test('Off is the exact authored-radius/depth baseline at every time', () => {
  const { effectiveWormholeGeometryValue } = createSourceLoader()('visuals/WormholeGeometryLfo.ts');
  for (const time of [0, 0.1, 5.7, 100]) {
    assert.equal(effectiveWormholeGeometryValue(1.4, WAVEFORMS.off, time, 2, 0.5), 1.4);
    assert.equal(effectiveWormholeGeometryValue(2.6, WAVEFORMS.off, time, 0.05, 0.5, 0.5), 2.6);
  }
});

test('the renderer feeds canonical-time LFO values through the same release snapshot used by the sliders', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { effectiveWormholeGeometryValue } = load('visuals/WormholeGeometryLfo.ts');
  const { State } = load('state/store.ts');
  setupState(State);
  const activeTuning = tuning();
  Object.assign(State.visualTuning, activeTuning);
  Object.assign(State.targetTuning, activeTuning);

  const identity = new CosmicWormholeIdentity();
  identity.syncPosition(0.25);
  const expectedAtQuarterCycle = 1.4 * 1.25;
  for (const grain of identity.pool) {
    assert.ok(Math.abs(grain.releaseRadius - expectedAtQuarterCycle) < 1e-9);
    assert.equal(grain.releaseDepth, 2.6);
  }

  // A parameter change in this renderer is release-snapshotted: existing grains keep the sampled
  // value until release/sync, exactly as they do when the actual Tunnel radius slider is moved.
  const held = identity.pool.map(grain => ({
    generation: grain.releaseGeneration,
    radius: grain.releaseRadius
  }));
  State.currentTime = 0.26;
  identity.draw({
    width: 960, height: 540, frameCount: 1,
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line() {}, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}
  }, [], []);
  let released = 0;
  const expectedAtNextRelease = effectiveWormholeGeometryValue(1.4, WAVEFORMS.sine, 0.26, 1, 0.25);
  for (let index = 0; index < identity.pool.length; index++) {
    const grain = identity.pool[index];
    if (grain.releaseGeneration === held[index].generation) {
      assert.equal(grain.releaseRadius, held[index].radius, `grain ${index} changed before release`);
    } else {
      released++;
      assert.ok(Math.abs(grain.releaseRadius - expectedAtNextRelease) < 1e-9, `grain ${index} missed the current LFO value at release`);
    }
  }
  assert.ok(released > 0, 'the short step should release at least one grain and start the population transition');

  identity.syncPosition(0.75);
  const expectedAtThreeQuarterCycle = 1.4 * 0.75;
  for (const grain of identity.pool) {
    assert.ok(Math.abs(grain.releaseRadius - expectedAtThreeQuarterCycle) < 1e-9);
  }

  const source = readFileSync(join(process.cwd(), 'src', 'visuals', 'CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /snapshotGrainGeometry\(grain, State\.visualTuning, timeSec\)/);
  assert.match(source, /const grainMaxZ = Z_REFERENCE \* grain\.releaseDepth;/);
  assert.match(source, /const radius = 50 \* grain\.releaseRadius;/);
});

test('every factory geometry preset authors a complete, bounded, expressive LFO profile', () => {
  const files = readdirSync(PRESET_ROOT).filter(name => name.endsWith('.json') && name !== 'index.json' && name !== 'style-packs.json');
  const profiles = new Map();
  for (const file of files) {
    const tuning = JSON.parse(readFileSync(join(PRESET_ROOT, file), 'utf8')).visualTuning ?? {};
    if (!('wormholeRadius' in tuning) && !('wormholeDepth' in tuning)) continue;
    for (const key of ['wormholeRadiusLfoWaveform', 'wormholeRadiusLfoRate', 'wormholeRadiusLfoAmount', 'wormholeDepthLfoWaveform', 'wormholeDepthLfoRate', 'wormholeDepthLfoAmount']) {
      assert.ok(key in tuning, `${file} must author ${key}`);
    }
    assert.ok(tuning.wormholeRadiusLfoWaveform >= 1 && tuning.wormholeRadiusLfoWaveform <= 7, `${file} radius waveform`);
    assert.ok(tuning.wormholeDepthLfoWaveform >= 1 && tuning.wormholeDepthLfoWaveform <= 7, `${file} depth waveform`);
    assert.ok(tuning.wormholeRadiusLfoRate >= 0.01 && tuning.wormholeRadiusLfoRate <= 8, `${file} radius rate`);
    assert.ok(tuning.wormholeDepthLfoRate >= 0.01 && tuning.wormholeDepthLfoRate <= 8, `${file} depth rate`);
    assert.ok(tuning.wormholeRadiusLfoAmount > 0 && tuning.wormholeRadiusLfoAmount <= 0.5, `${file} radius amount`);
    assert.ok(tuning.wormholeDepthLfoAmount > 0 && tuning.wormholeDepthLfoAmount <= 0.5, `${file} depth amount`);
    profiles.set(file, tuning);
  }

  assert.ok(new Set([...profiles.values()].map(t => t.wormholeRadiusLfoWaveform)).size >= 6, 'radius profiles should use most waveform families');
  assert.ok(new Set([...profiles.values()].map(t => t.wormholeDepthLfoWaveform)).size >= 5, 'depth profiles should use varied waveform families');
  assert.ok(profiles.get('vos-transition-slice.json').wormholeRadiusLfoRate >= 3.5, 'transition slice should expose the fast expressive range');
  assert.ok(profiles.get('vos-wh-overdrive.json').wormholeRadiusLfoRate > profiles.get('vos-wh-establish.json').wormholeRadiusLfoRate, 'overdrive should move faster than establish');
  assert.ok(profiles.get('vos-wh-dissolve.json').wormholeRadiusLfoRate < 0.1, 'dissolve should retain a slow atmospheric drift');
});

test('factory preset pairs alternate clearly between near and far projected tunnel geometry', () => {
  const pairings = [
    ['temporal2.json', 'temporal1.json'],
    ['temporal4.json', 'temporal3.json'],
    ['vos-break-glow.json', 'vos-break-sparse.json'],
    ['vos-build-compress.json', 'vos-build-escalate.json'],
    ['vos-drop-primary.json', 'vos-drop-counter.json'],
    ['vos-peak-overdrive.json', 'vos-transition-slice.json'],
    ['vos-verse-motion.json', 'vos-verse-primary.json'],
    ['vos-wh-drive.json', 'vos-wh-establish.json'],
    ['vos-wh-collapse.json', 'vos-wh-spiral.json'],
    ['vos-wh-sparse.json', 'vos-wh-galaxy.json'],
    ['vos-wh-overdrive.json', 'vos-wh-punch.json'],
    ['vos-wh-dissolve.json', 'vos-wh-drift.json']
  ];
  const readTuning = file => JSON.parse(readFileSync(join(PRESET_ROOT, file), 'utf8')).visualTuning;

  for (const [nearFile, farFile] of pairings) {
    const near = readTuning(nearFile);
    const far = readTuning(farFile);
    const nearProjectedScale = near.wormholeRadius / near.wormholeDepth;
    const farProjectedScale = far.wormholeRadius / far.wormholeDepth;
    assert.ok(near.wormholeRadius > far.wormholeRadius, `${nearFile} radius should frame closer than ${farFile}`);
    assert.ok(near.wormholeDepth < far.wormholeDepth, `${nearFile} horizon should be shallower than ${farFile}`);
    assert.ok(
      nearProjectedScale >= farProjectedScale * 2.2,
      `${nearFile}/${farFile} projected scale contrast ${nearProjectedScale.toFixed(3)}/${farProjectedScale.toFixed(3)}`
    );
  }
});
