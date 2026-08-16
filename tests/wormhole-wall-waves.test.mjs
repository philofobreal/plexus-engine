import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Phase 5 of the wormhole refractive membrane wall plan (documents/audits/wormhole-wall-membrane-plan.md):
// pure, stateless event-driven pressure-wave fronts (kick/LOW_DROP origins) that will later feed the
// same radius-offset channel WormholeWallGeometry's ripple uses. Nothing here reads route/camera
// state, and every value must be reproducible directly from (events, frames, timeSec, ...) alone --
// seeking must match frame-by-frame playback exactly.

function createSourceLoader() {
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
    vm.runInNewContext(output, { module, exports: module.exports, require, Math, Number, Array, Object });
    return module.exports;
  }
  return relative => load(join(process.cwd(), 'src', relative));
}

function loadWaves() {
  return createSourceLoader()('visuals/WormholeWallWaves.ts');
}

const SAMPLE_RATE = 48000;
const HOP_SIZE = 1024;
const HOP_SEC = HOP_SIZE / SAMPLE_RATE;

function makeFrame(state, lowEnergy) {
  const spectrum = new Array(24).fill(0);
  for (let i = 0; i < 8; i++) spectrum[i] = lowEnergy;
  return { perceptualSpectrum: spectrum, state };
}

/** LOW_DROP block spans frame indices [550, 590]; every other frame is a loud HIGH frame. */
function makeFrames() {
  const frames = [];
  for (let i = 0; i < 700; i++) {
    const state = i >= 550 && i <= 590 ? 'LOW_DROP' : 'HIGH';
    frames.push(makeFrame(state, 0.6));
  }
  return frames;
}

function frameIndexAt(timeSec) {
  return Math.round(timeSec / HOP_SEC);
}

function snapshotFronts(fronts, count) {
  return Array.from({ length: count }, (_, i) => ({ ...fronts[i] }));
}

// -- gathering: empty/no-event cases -------------------------------------------------------------

test('wormholeWallGatherWaveFronts returns zero fronts with no events and no frames', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool } = loadWaves();
  const pool = createWormholeWallWaveFrontPool();
  const count = wormholeWallGatherWaveFronts([], [], 12.0, SAMPLE_RATE, HOP_SIZE, pool);
  assert.equal(count, 0);
});

test('wormholeWallWaveOffset is exactly zero with no active fronts', () => {
  const { wormholeWallWaveOffset, createWormholeWallWaveFrontPool } = loadWaves();
  const pool = createWormholeWallWaveFrontPool();
  for (const depthPhase of [0, 0.2, 0.5, 0.9, 1]) {
    assert.equal(wormholeWallWaveOffset(pool, 0, depthPhase), 0);
  }
});

// These three tests query at t=5.0, well outside the [550,590]-frame LOW_DROP block (~11.73-12.59s),
// so only the kick-qualification logic under test can contribute a front.

test('a lone type-3 (fx/high-transient) event never spawns a kick front', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool } = loadWaves();
  const frames = makeFrames();
  const events = [{ time: 4.9, intensity: 0.9, type: 3 }];
  const pool = createWormholeWallWaveFrontPool();
  const count = wormholeWallGatherWaveFronts(events, frames, 5.0, SAMPLE_RATE, HOP_SIZE, pool);
  assert.equal(count, 0);
});

test('a kick event mapped to a quiet (no low-frequency support) frame never qualifies', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool } = loadWaves();
  const frames = makeFrames();
  const quietIndex = frameIndexAt(4.9);
  frames[quietIndex] = makeFrame('HIGH', 0); // zero low-band energy at the mapped frame
  const events = [{ time: 4.9, intensity: 0.9, type: 1 }];
  const pool = createWormholeWallWaveFrontPool();
  const count = wormholeWallGatherWaveFronts(events, frames, 5.0, SAMPLE_RATE, HOP_SIZE, pool);
  assert.equal(count, 0);
});

test('an event older than WALL_WAVE_WINDOW_SEC never qualifies', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool, WALL_WAVE_WINDOW_SEC } = loadWaves();
  const frames = makeFrames();
  const events = [{ time: 5.0 - WALL_WAVE_WINDOW_SEC - 0.5, intensity: 0.9, type: 1 }];
  const pool = createWormholeWallWaveFrontPool();
  const count = wormholeWallGatherWaveFronts(events, frames, 5.0, SAMPLE_RATE, HOP_SIZE, pool);
  assert.equal(count, 0);
});

// -- gathering: qualifying events and the 3-active cap -------------------------------------------

test('a lone qualifying kick event spawns exactly one kick front with the right age', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool, WALL_WAVE_KIND_KICK } = loadWaves();
  const frames = makeFrames();
  const events = [{ time: 4.5, intensity: 0.8, type: 1 }];
  const pool = createWormholeWallWaveFrontPool();
  const count = wormholeWallGatherWaveFronts(events, frames, 5.0, SAMPLE_RATE, HOP_SIZE, pool);
  assert.equal(count, 1);
  assert.equal(pool[0].kind, WALL_WAVE_KIND_KICK);
  assert.ok(Math.abs(pool[0].ageSec - 0.5) < 1e-9, `expected ageSec ~0.5, got ${pool[0].ageSec}`);
  assert.ok(pool[0].intensity > 0 && pool[0].intensity <= 1);
});

test('a live LOW_DROP frame spawns exactly one lowDrop front with age since the block onset', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool, WALL_WAVE_KIND_LOWDROP } = loadWaves();
  const frames = makeFrames();
  const queryTime = 12.0; // within the [550,590] LOW_DROP block
  const pool = createWormholeWallWaveFrontPool();
  const count = wormholeWallGatherWaveFronts([], frames, queryTime, SAMPLE_RATE, HOP_SIZE, pool);
  assert.equal(count, 1);
  assert.equal(pool[0].kind, WALL_WAVE_KIND_LOWDROP);
  const expectedOnset = 550 * HOP_SEC;
  assert.ok(Math.abs(pool[0].ageSec - (queryTime - expectedOnset)) < 1e-6);
});

test('never more than WALL_WAVE_MAX_ACTIVE fronts, even with a live LOW_DROP plus many qualifying kicks', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool, WALL_WAVE_MAX_ACTIVE, WALL_WAVE_KIND_LOWDROP } = loadWaves();
  const frames = makeFrames();
  const queryTime = 12.0;
  // Five qualifying kicks within the 2.5s window, all on top of the live LOW_DROP block above.
  const events = [9.6, 10.1, 10.6, 11.1, 11.6].map(time => ({ time, intensity: 0.8, type: 1 }));
  const pool = createWormholeWallWaveFrontPool();
  const count = wormholeWallGatherWaveFronts(events, frames, queryTime, SAMPLE_RATE, HOP_SIZE, pool);
  assert.equal(count, WALL_WAVE_MAX_ACTIVE);
  assert.equal(pool[0].kind, WALL_WAVE_KIND_LOWDROP, 'the live drop must take the reserved slot');
});

// -- determinism / seek-independence --------------------------------------------------------------

test('gathering is a pure function of timeSec: seeking away and back reproduces identical fronts', () => {
  const { wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool } = loadWaves();
  const frames = makeFrames();
  const events = [9.6, 10.1, 10.6, 11.1, 11.6].map(time => ({ time, intensity: 0.8, type: 1 }));
  const pool = createWormholeWallWaveFrontPool();

  const countBefore = wormholeWallGatherWaveFronts(events, frames, 12.0, SAMPLE_RATE, HOP_SIZE, pool);
  const before = snapshotFronts(pool, countBefore);

  // Simulate an unrelated seek elsewhere, reusing the exact same scratch pool.
  wormholeWallGatherWaveFronts(events, frames, 3.0, SAMPLE_RATE, HOP_SIZE, pool);

  const countAfter = wormholeWallGatherWaveFronts(events, frames, 12.0, SAMPLE_RATE, HOP_SIZE, pool);
  const after = snapshotFronts(pool, countAfter);

  assert.equal(countAfter, countBefore);
  assert.deepEqual(after, before);
});

// -- front position and character -------------------------------------------------------------

test('wormholeWallWaveFrontDepthPhase is a pure function of (ageSec, kind); fronts are born at the horizon and advect toward the camera, kick faster than LOW_DROP', () => {
  const { wormholeWallWaveFrontDepthPhase, WALL_WAVE_KIND_KICK, WALL_WAVE_KIND_LOWDROP } = loadWaves();
  assert.equal(wormholeWallWaveFrontDepthPhase(0, WALL_WAVE_KIND_KICK), 1, 'a front is born at the horizon (depthPhase 1), never at the camera');
  assert.equal(wormholeWallWaveFrontDepthPhase(0, WALL_WAVE_KIND_LOWDROP), 1);
  for (const age of [0, 0.05, 0.1, 0.2, 0.3]) {
    const a = wormholeWallWaveFrontDepthPhase(age, WALL_WAVE_KIND_KICK);
    const b = wormholeWallWaveFrontDepthPhase(age, WALL_WAVE_KIND_KICK);
    assert.equal(a, b, 'must be a pure function of (ageSec, kind)');
    if (age > 0) {
      assert.ok(
        wormholeWallWaveFrontDepthPhase(age, WALL_WAVE_KIND_KICK) < wormholeWallWaveFrontDepthPhase(age, WALL_WAVE_KIND_LOWDROP),
        `kick should have advected further toward the camera than LOW_DROP at age ${age}`
      );
    }
  }
  // Both kinds clamp at the camera (depthPhase 0) instead of overshooting into negative space.
  assert.equal(wormholeWallWaveFrontDepthPhase(100, WALL_WAVE_KIND_KICK), 0);
  assert.equal(wormholeWallWaveFrontDepthPhase(100, WALL_WAVE_KIND_LOWDROP), 0);
});

test('wormholeWallWaveFrontAmplitude peaks at the front\'s own position and fades away from it', () => {
  const { wormholeWallWaveFrontAmplitude, wormholeWallWaveFrontDepthPhase, WALL_WAVE_KIND_KICK } = loadWaves();
  const front = { kind: WALL_WAVE_KIND_KICK, ageSec: 0.2, intensity: 1, variant: 0 };
  const frontPhase = wormholeWallWaveFrontDepthPhase(front.ageSec, front.kind);
  const atPeak = wormholeWallWaveFrontAmplitude(front, frontPhase);
  const near = wormholeWallWaveFrontAmplitude(front, frontPhase + 0.02);
  const far = wormholeWallWaveFrontAmplitude(front, frontPhase + 0.6);
  assert.ok(atPeak > near, 'amplitude should be highest exactly at the front position');
  assert.ok(near > far, 'amplitude should keep fading further from the front position');
  assert.ok(far >= 0, 'amplitude must never go negative');
});

// -- monotonic temporal decay ----------------------------------------------------------------------

test('wormholeWallWaveFrontPeakAmplitude decays monotonically with age, for both kick and lowDrop', () => {
  const { wormholeWallWaveFrontPeakAmplitude, WALL_WAVE_KIND_KICK, WALL_WAVE_KIND_LOWDROP } = loadWaves();
  for (const kind of [WALL_WAVE_KIND_KICK, WALL_WAVE_KIND_LOWDROP]) {
    let previous = Infinity;
    for (const ageSec of [0, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 2.5]) {
      const amplitude = wormholeWallWaveFrontPeakAmplitude({ kind, ageSec, intensity: 1, variant: 0 });
      assert.ok(amplitude < previous, `kind=${kind} age=${ageSec}: expected strictly decreasing amplitude, got ${amplitude} >= ${previous}`);
      previous = amplitude;
    }
  }
});

test('wormholeWallWaveFrontPeakAmplitude is zero with zero intensity, regardless of age', () => {
  const { wormholeWallWaveFrontPeakAmplitude, WALL_WAVE_KIND_KICK } = loadWaves();
  for (const ageSec of [0, 0.5, 2]) {
    assert.equal(wormholeWallWaveFrontPeakAmplitude({ kind: WALL_WAVE_KIND_KICK, ageSec, intensity: 0, variant: 0 }), 0);
  }
});

// -- bounded total amplitude -------------------------------------------------------------------

test('wormholeWallWaveOffset caps the sum of several simultaneous max-strength fronts', () => {
  const { wormholeWallWaveOffset, WALL_WAVE_MAX_TOTAL_AMPLITUDE, WALL_WAVE_KIND_LOWDROP } = loadWaves();
  const fronts = [
    { kind: WALL_WAVE_KIND_LOWDROP, ageSec: 0, intensity: 1, variant: 0 },
    { kind: WALL_WAVE_KIND_LOWDROP, ageSec: 0, intensity: 1, variant: 0 },
    { kind: WALL_WAVE_KIND_LOWDROP, ageSec: 0, intensity: 1, variant: 0 }
  ];
  // Sampling exactly at the shared front position (depthPhase 0 at age 0) maximizes every
  // contribution simultaneously -- the worst case for a "global pump" leak.
  const offset = wormholeWallWaveOffset(fronts, fronts.length, 0);
  assert.ok(offset <= WALL_WAVE_MAX_TOTAL_AMPLITUDE + 1e-12, `offset ${offset} exceeded the total cap`);
  assert.ok(offset > 0, 'three coincident max fronts should still produce a nonzero bump');
});

test('wormholeWallWaveOffset only honors up to fronts.length entries, ignoring a larger frontCount', () => {
  const { wormholeWallWaveOffset, WALL_WAVE_KIND_KICK } = loadWaves();
  const fronts = [{ kind: WALL_WAVE_KIND_KICK, ageSec: 0, intensity: 1, variant: 0 }];
  assert.doesNotThrow(() => wormholeWallWaveOffset(fronts, 99, 0));
});

// -- defensive numeric handling ------------------------------------------------------------------

test('wave functions treat non-finite inputs defensively instead of throwing or producing NaN', () => {
  const {
    wormholeWallGatherWaveFronts, createWormholeWallWaveFrontPool,
    wormholeWallWaveFrontDepthPhase, wormholeWallWaveFrontPeakAmplitude,
    wormholeWallWaveFrontAmplitude, wormholeWallWaveOffset, WALL_WAVE_KIND_KICK
  } = loadWaves();
  const pool = createWormholeWallWaveFrontPool();
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.doesNotThrow(() => wormholeWallGatherWaveFronts([], [], bad, SAMPLE_RATE, HOP_SIZE, pool));
    assert.ok(Number.isFinite(wormholeWallWaveFrontDepthPhase(bad, WALL_WAVE_KIND_KICK)));
    assert.ok(Number.isFinite(wormholeWallWaveFrontPeakAmplitude({ kind: WALL_WAVE_KIND_KICK, ageSec: bad, intensity: bad, variant: bad })));
    assert.ok(Number.isFinite(wormholeWallWaveFrontAmplitude({ kind: WALL_WAVE_KIND_KICK, ageSec: bad, intensity: bad, variant: bad }, bad)));
    assert.ok(Number.isFinite(wormholeWallWaveOffset(pool, bad, bad)));
  }
});
