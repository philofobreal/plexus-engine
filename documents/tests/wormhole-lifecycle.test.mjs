import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
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

/** Like `loadTypeScriptModule`, but resolves relative `require`s -- needed for modules (like
 * `src/config/visualTuning.ts`) with a real (non-type-only) sibling import. */
function createRequireLoader() {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module);
    const require = request => {
      const base = normalize(join(dirname(path), request));
      const resolved = base.endsWith('.ts') ? base : `${base}.ts`;
      return load(resolved);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require, Math, Number, Array, Object, Map, Set });
    return module.exports;
  }
  return relative => load(join(process.cwd(), 'src', relative));
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

/** Steps the real morph forward at a fixed fps from t=0, returning the tuning value at the
 * requested checkpoints (song-time seconds). Uses the real `tuningMorphDeltaSec` clock-change
 * rejection, so this is exactly the mechanism `PlexusRenderer.ts` drives every frame. */
function stepMorph(applyTuningMorph, tuningMorphDeltaSec, from, to, fps, checkpoints) {
  const current = { ...from };
  const results = {};
  let t = 0, previousTime = null;
  const dt = 1 / fps;
  const remaining = new Set(checkpoints.map(c => c.toFixed(6)));
  while (remaining.size > 0 && t <= Math.max(...checkpoints) + dt) {
    const delta = tuningMorphDeltaSec(t, previousTime, false);
    applyTuningMorph(current, to, to.transitionSpeed, delta);
    previousTime = t;
    for (const checkpoint of checkpoints) {
      const key = checkpoint.toFixed(6);
      if (remaining.has(key) && t >= checkpoint - dt / 2 && t <= checkpoint + dt / 2) {
        results[key] = { ...current };
        remaining.delete(key);
      }
    }
    t += dt;
  }
  return results;
}

function progressFraction(from, current, to, key) {
  const span = to[key] - from[key];
  if (Math.abs(span) < 1e-9) return 1; // nothing to converge toward on this field
  return (current[key] - from[key]) / span;
}

test('automation transition glides continuously: no first-frame snap, partial at 0.25*duration, converged by duration, frame-rate independent', () => {
  const load = createRequireLoader();
  const { applyTuningMorph, tuningMorphDeltaSec, cloneDefaultVisualTuning } = load('config/visualTuning.ts');

  const from = cloneDefaultVisualTuning();
  from.wormholeSpeed = 1;
  from.wormholePathBend = 0;
  from.wormholeContinuity = 1;
  const to = cloneDefaultVisualTuning();
  to.wormholeSpeed = 4;
  to.wormholePathBend = 0.6;
  to.wormholeContinuity = 1.5;
  to.morphDurationSec = 1.2;

  const keys = ['wormholeSpeed', 'wormholePathBend', 'wormholeContinuity'];
  const oneFrameAt60 = 1 / 60;
  const results60 = stepMorph(applyTuningMorph, tuningMorphDeltaSec, from, to, 60, [oneFrameAt60, 0.3, 1.2]);
  const results30 = stepMorph(applyTuningMorph, tuningMorphDeltaSec, from, to, 30, [0.3, 1.2]);
  const results120 = stepMorph(applyTuningMorph, tuningMorphDeltaSec, from, to, 120, [0.3, 1.2]);

  for (const key of keys) {
    const firstFrame = progressFraction(from, results60[oneFrameAt60.toFixed(6)], to, key);
    assert.ok(firstFrame < 0.25, `${key}: first-frame progress ${firstFrame.toFixed(3)} looks like a snap, not a glide`);

    const partial = progressFraction(from, results60['0.300000'], to, key);
    assert.ok(partial > 0.3 && partial < 0.95, `${key}: progress at 0.25*duration (${partial.toFixed(3)}) is not meaningfully partial`);

    const done = progressFraction(from, results60['1.200000'], to, key);
    assert.ok(done > 0.95, `${key}: progress at morphDurationSec (${done.toFixed(3)}) did not reach the target`);

    // Frame-rate independence ("seek reproduces the same result"): the same elapsed song-time
    // yields the same tuning value regardless of how many frames it took to get there.
    for (const frameResults of [results30, results120]) {
      const other = progressFraction(from, frameResults['0.300000'], to, key);
      assert.ok(Math.abs(other - partial) < 0.01, `${key}: 0.3s progress diverges across frame rates (${partial.toFixed(4)} vs ${other.toFixed(4)})`);
      const otherDone = progressFraction(from, frameResults['1.200000'], to, key);
      assert.ok(Math.abs(otherDone - done) < 0.01, `${key}: 1.2s progress diverges across frame rates (${done.toFixed(4)} vs ${otherDone.toFixed(4)})`);
    }
  }
});

test('a discontinuous timeline jump (seek) freezes the morph instead of fast-forwarding or resetting it', () => {
  const load = createRequireLoader();
  const { applyTuningMorph, tuningMorphDeltaSec, cloneDefaultVisualTuning } = load('config/visualTuning.ts');

  const from = cloneDefaultVisualTuning();
  from.wormholeSpeed = 1;
  const to = cloneDefaultVisualTuning();
  to.wormholeSpeed = 4;
  to.morphDurationSec = 1.2;

  const current = { ...from };
  let t = 0, previousTime = null;
  for (let i = 0; i < 18; i++) { // ~0.3s at 60fps: a genuinely partial state
    const delta = tuningMorphDeltaSec(t, previousTime, false);
    applyTuningMorph(current, to, to.transitionSpeed, delta);
    previousTime = t;
    t += 1 / 60;
  }
  const beforeSeek = current.wormholeSpeed;
  assert.ok(beforeSeek > 1 && beforeSeek < 4, `expected a genuinely partial state before the seek, got ${beforeSeek}`);

  // Simulate a user scrubbing the timeline far ahead: a large, discontinuous jump.
  const seekDelta = tuningMorphDeltaSec(9.0, previousTime, true);
  applyTuningMorph(current, to, to.transitionSpeed, seekDelta);
  assert.equal(seekDelta, 0, 'a clock-changed jump must not report a real elapsed delta');
  assert.equal(current.wormholeSpeed, beforeSeek, 'seeking must freeze the morph, not fast-forward or reset it');
});

test('full preset-sequence regression: every real wormhole preset pair glides without a snap and fully converges', () => {
  const load = createRequireLoader();
  const { applyTuningMorph, tuningMorphDeltaSec, cloneDefaultVisualTuning, normalizeVisualTuningConfig } = load('config/visualTuning.ts');

  const presetDir = join(process.cwd(), 'public/visual-tuning-presets');
  const presetNames = [
    'vos-wh-establish.json', 'vos-wh-drift.json', 'vos-wh-sparse.json', 'vos-wh-collapse.json',
    'vos-wh-galaxy.json', 'vos-wh-dissolve.json', 'vos-wh-punch.json', 'vos-wh-overdrive.json',
    'vos-wh-drive.json', 'vos-wh-spiral.json'
  ];
  const presets = presetNames.map(name => {
    const payload = JSON.parse(readFileSync(join(presetDir, name), 'utf8'));
    return { name, tuning: normalizeVisualTuningConfig(payload, cloneDefaultVisualTuning()) };
  });

  const keys = ['wormholeSpeed', 'wormholePathBend', 'wormholeContinuity'];
  const morphDurationSec = 1.0;
  const oneFrame = 1 / 60;

  for (let i = 0; i < presets.length - 1; i++) {
    const from = { ...presets[i].tuning };
    const to = { ...presets[i + 1].tuning, morphDurationSec };
    const results = stepMorph(applyTuningMorph, tuningMorphDeltaSec, from, to, 60, [oneFrame, morphDurationSec]);

    for (const key of keys) {
      if (Math.abs(to[key] - from[key]) < 1e-9) continue; // this pair does not move this field
      const firstFrame = progressFraction(from, results[oneFrame.toFixed(6)], to, key);
      assert.ok(
        firstFrame < 0.25,
        `${presets[i].name} -> ${presets[i + 1].name} (${key}): first-frame progress ${firstFrame.toFixed(3)} looks like a snap`
      );
      const done = progressFraction(from, results[morphDurationSec.toFixed(6)], to, key);
      assert.ok(
        done > 0.9,
        `${presets[i].name} -> ${presets[i + 1].name} (${key}): progress ${done.toFixed(3)} at morphDurationSec did not converge`
      );
      // Monotonic, non-overshooting: never passes the target and comes back.
      assert.ok(done <= 1.0 + 1e-6, `${presets[i].name} -> ${presets[i + 1].name} (${key}): overshot the target (${done.toFixed(4)})`);
    }
  }
});
