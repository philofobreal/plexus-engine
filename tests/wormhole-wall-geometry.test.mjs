import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Phase 2 of the wormhole refractive membrane wall plan (documents/audits/wormhole-wall-membrane-plan.md):
// pure ring/segment layout, ripple, and caustic-helix geometry consumed later by
// WormholeWallMaterial/WormholeWallWaves and the CosmicWormholeIdentity draw integration. Nothing
// here reads or writes a route frame, camera state, or wall-clock time.

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

function loadGeometry() {
  return createSourceLoader()('visuals/WormholeWallGeometry.ts');
}

// -- ring/segment layout ---------------------------------------------------------------------

test('wormholeWallSegmentCount/RingCount halve (roughly) in performance mode', () => {
  const { wormholeWallSegmentCount, wormholeWallRingCount, WALL_SEGMENTS, WALL_RINGS, WALL_SEGMENTS_PERFORMANCE, WALL_RINGS_PERFORMANCE } = loadGeometry();
  assert.equal(wormholeWallSegmentCount(false), WALL_SEGMENTS);
  assert.equal(wormholeWallSegmentCount(true), WALL_SEGMENTS_PERFORMANCE);
  assert.equal(wormholeWallRingCount(false), WALL_RINGS);
  assert.equal(wormholeWallRingCount(true), WALL_RINGS_PERFORMANCE);
  assert.ok(WALL_SEGMENTS_PERFORMANCE < WALL_SEGMENTS, 'performance segment count must be lower');
  assert.ok(WALL_RINGS_PERFORMANCE < WALL_RINGS, 'performance ring count must be lower');
});

test('wormholeWallSegmentTheta evenly spaces segments around the full circle, band 0 at theta 0', () => {
  const { wormholeWallSegmentTheta } = loadGeometry();
  const count = 48;
  assert.equal(wormholeWallSegmentTheta(0, count), 0);
  for (let i = 0; i < count; i++) {
    const expected = (i / count) * Math.PI * 2;
    assert.ok(Math.abs(wormholeWallSegmentTheta(i, count) - expected) < 1e-12, `segment ${i}`);
  }
});

test('wormholeWallRingDepthPhase is immutable per ring index and covers (0,1] evenly', () => {
  const { wormholeWallRingDepthPhase } = loadGeometry();
  const ringCount = 16;
  const phases = Array.from({ length: ringCount }, (_, i) => wormholeWallRingDepthPhase(i, ringCount));
  for (let i = 0; i < ringCount; i++) {
    assert.ok(phases[i] > 0 && phases[i] <= 1, `ring ${i} phase must be in (0,1]`);
  }
  // Strictly increasing, evenly spaced.
  for (let i = 1; i < ringCount; i++) {
    assert.ok(phases[i] > phases[i - 1], `ring ${i} phase must exceed ring ${i - 1}`);
  }
  const step = phases[1] - phases[0];
  for (let i = 1; i < ringCount; i++) {
    assert.ok(Math.abs((phases[i] - phases[i - 1]) - step) < 1e-9, `ring ${i} spacing must be uniform`);
  }
});

test('wormholeWallRingZ never travels: fixed per (ringIndex, ringCount, maxZ), independent of travelDistance', () => {
  const { wormholeWallRingZ } = loadGeometry();
  const ringCount = 16;
  const maxZ = 1000;
  const baseline = Array.from({ length: ringCount }, (_, i) => wormholeWallRingZ(i, ringCount, maxZ));
  // Sampling the exact same (ringIndex, ringCount, maxZ) at any later "time" -- there is no time
  // parameter at all -- must reproduce the identical z. This is the "rings don't travel" contract.
  for (let i = 0; i < ringCount; i++) {
    assert.equal(wormholeWallRingZ(i, ringCount, maxZ), baseline[i]);
    assert.ok(baseline[i] > 0 && baseline[i] <= maxZ, `ring ${i} z must stay within the horizon`);
  }
});

// -- ripple ------------------------------------------------------------------------------------

test('wormholeWallRippleOffset is deterministic for identical inputs', () => {
  const { wormholeWallRippleOffset } = loadGeometry();
  const cases = [
    [0, 0, 0], [1.3, 0.42, 5000], [-2.1, 0.99, 123456.7], [6.4, 0.001, -50]
  ];
  for (const [theta, depthPhase, travelDistance] of cases) {
    const a = wormholeWallRippleOffset(theta, depthPhase, travelDistance);
    const b = wormholeWallRippleOffset(theta, depthPhase, travelDistance);
    assert.equal(a, b, `theta=${theta} depthPhase=${depthPhase} travelDistance=${travelDistance}`);
  }
});

test('wormholeWallRippleOffset stays within +-WALL_RIPPLE_MAX_AMPLITUDE across a dense sweep', () => {
  const { wormholeWallRippleOffset, WALL_RIPPLE_MAX_AMPLITUDE } = loadGeometry();
  const STEPS = 64;
  for (let i = 0; i <= STEPS; i++) {
    const theta = (i / STEPS) * Math.PI * 2;
    for (let j = 0; j <= STEPS; j++) {
      const depthPhase = j / STEPS;
      for (const travelDistance of [0, 500, 12345.6, 987654321]) {
        const offset = wormholeWallRippleOffset(theta, depthPhase, travelDistance);
        assert.ok(
          offset >= -WALL_RIPPLE_MAX_AMPLITUDE - 1e-9 && offset <= WALL_RIPPLE_MAX_AMPLITUDE + 1e-9,
          `ripple out of bounds at theta=${theta} depthPhase=${depthPhase} travelDistance=${travelDistance}: ${offset}`
        );
      }
    }
  }
});

test('wormholeWallRippleOffset is a pure function of travelDistance: seeking directly matches stepping there frame-by-frame', () => {
  const { wormholeWallRippleOffset } = loadGeometry();
  const theta = 2.7;
  const depthPhase = 0.63;
  const targetDistance = 4000;

  const direct = wormholeWallRippleOffset(theta, depthPhase, targetDistance);

  // Simulate 400 small forward steps (as continuous playback would produce) vs one instantaneous
  // seek; the offset at the same final travelDistance must be bit-identical either way.
  let simulated = 0;
  for (let i = 0; i < 400; i++) simulated += 10;
  assert.equal(simulated, targetDistance);
  const stepped = wormholeWallRippleOffset(theta, depthPhase, simulated);

  assert.equal(direct, stepped, 'ripple must not depend on the path taken to reach travelDistance');
});

test('wormholeWallRippleOffset advects at exactly the grain flow rate: a depthPhase shift is exactly cancelled by the matching travelDistance shift', () => {
  const { wormholeWallRippleOffset, WALL_ADVECTION_HORIZON } = loadGeometry();
  const theta = 1.9;
  const baseDepthPhase = 0.4;
  const baseTravel = 12345.6;
  const baseline = wormholeWallRippleOffset(theta, baseDepthPhase, baseTravel);
  for (const delta of [0.1, -0.25, 0.5]) {
    const shifted = wormholeWallRippleOffset(
      theta,
      baseDepthPhase + delta,
      baseTravel - delta * WALL_ADVECTION_HORIZON
    );
    assert.ok(
      Math.abs(shifted - baseline) < 1e-9,
      `delta=${delta}: the advected phase must be invariant under a matching (depthPhase, travelDistance) shift`
    );
  }
});

test('wormholeWallRippleOffset completes exactly one advection cycle per grain-generation horizon', () => {
  const { wormholeWallRippleOffset, WALL_ADVECTION_HORIZON } = loadGeometry();
  const theta = -1.2;
  const depthPhase = 0.63;
  const travel = 7000;
  const oneHorizonLater = wormholeWallRippleOffset(theta, depthPhase, travel + WALL_ADVECTION_HORIZON);
  assert.ok(
    Math.abs(oneHorizonLater - wormholeWallRippleOffset(theta, depthPhase, travel)) < 1e-9,
    'advancing travelDistance by exactly one horizon must return a fixed ring to the same material phase'
  );
});

test('wormholeWallRippleOffset stays continuous as travelDistance sweeps densely across an advection-horizon wrap boundary', () => {
  // Regression guard: `wormholeWallAdvectedPhase` wraps at integer multiples of
  // WALL_ADVECTION_HORIZON. That wrap is only invisible through Math.sin when every depth
  // frequency it feeds is a whole number (see the function's own doc comment); a fractional
  // frequency would tear right at the wrap, exactly like the caustic twist term had to be fixed to
  // avoid (see the caustic continuity test in this file). This sweeps travelDistance densely
  // through a wrap boundary and bounds the largest per-step change a smooth sine at this amplitude
  // and step size could plausibly produce.
  const { wormholeWallRippleOffset, WALL_RIPPLE_MAX_AMPLITUDE, WALL_ADVECTION_HORIZON } = loadGeometry();
  const theta = 0.9;
  const depthPhase = 0.5; // wrap boundary falls inside the sweep at travelDistance = 500
  const STEPS = 400;
  let previous = wormholeWallRippleOffset(theta, depthPhase, 0);
  let maxStep = 0;
  for (let i = 1; i <= STEPS; i++) {
    const travelDistance = (i / STEPS) * WALL_ADVECTION_HORIZON;
    const value = wormholeWallRippleOffset(theta, depthPhase, travelDistance);
    maxStep = Math.max(maxStep, Math.abs(value - previous));
    previous = value;
  }
  // A genuine tear would jump by up to 2x the full amplitude in one step; a smooth sine at this
  // step density moves only a small fraction of the amplitude per step.
  assert.ok(
    maxStep < WALL_RIPPLE_MAX_AMPLITUDE * 0.2,
    `largest per-step change ${maxStep} is too large for a smooth sweep -- likely a wrap-boundary tear`
  );
});

test('wormholeWallRippleOffset never reads or mutates any route-frame-like object: identical output regardless of unrelated shared state', () => {
  const { wormholeWallRippleOffset } = loadGeometry();
  const sharedRouteFrame = { headingAngle: 0, curvature: 0, positionX: 0, positionY: 0 };
  const before = wormholeWallRippleOffset(1.1, 0.5, 777);
  // Mutate a plausible route-frame object the way advancing the camera would; the ripple function
  // never receives it, so this must have zero effect on its output.
  sharedRouteFrame.headingAngle = 0.9;
  sharedRouteFrame.curvature = 0.002;
  sharedRouteFrame.positionX = 250;
  sharedRouteFrame.positionY = -75;
  const after = wormholeWallRippleOffset(1.1, 0.5, 777);
  assert.equal(before, after);
});

// -- caustics ------------------------------------------------------------------------------------

test('wormholeWallCausticTheta is deterministic and distinct across the caustic set', () => {
  const { wormholeWallCausticTheta, WALL_CAUSTIC_COUNT } = loadGeometry();
  assert.ok(WALL_CAUSTIC_COUNT >= 4 && WALL_CAUSTIC_COUNT <= 6, 'plan calls for 4-6 helices');
  const depthPhase = 0.37;
  const travelDistance = 8000;
  const values = [];
  for (let i = 0; i < WALL_CAUSTIC_COUNT; i++) {
    const a = wormholeWallCausticTheta(i, depthPhase, travelDistance);
    const b = wormholeWallCausticTheta(i, depthPhase, travelDistance);
    assert.equal(a, b, `caustic ${i} must be deterministic`);
    values.push(((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
  }
  // No two helices should land on the exact same wrapped theta -- otherwise they'd visually merge.
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      assert.notEqual(values[i], values[j], `caustic ${i} and ${j} must not coincide`);
    }
  }
});

test('wormholeWallCausticTheta seeking directly matches stepping there frame-by-frame (FPS/seek independence)', () => {
  const { wormholeWallCausticTheta, WALL_CAUSTIC_COUNT } = loadGeometry();
  const depthPhase = 0.81;
  const targetDistance = 15000;
  for (let i = 0; i < WALL_CAUSTIC_COUNT; i++) {
    const direct = wormholeWallCausticTheta(i, depthPhase, targetDistance);
    // 60fps-at-different-rates simulation: reaching the same travelDistance via very different step
    // counts must produce the identical theta, since the function only reads the final distance.
    let viaManySteps = 0;
    for (let s = 0; s < 1500; s++) viaManySteps += 10;
    let viaFewSteps = 0;
    for (let s = 0; s < 3; s++) viaFewSteps += 5000;
    assert.equal(viaManySteps, targetDistance);
    assert.equal(viaFewSteps, targetDistance);
    assert.equal(wormholeWallCausticTheta(i, depthPhase, viaManySteps), direct);
    assert.equal(wormholeWallCausticTheta(i, depthPhase, viaFewSteps), direct);
  }
});

test('wormholeWallCausticTheta: the twist term now advects with travelDistance at the grain flow rate, dominating the slow independent drift', () => {
  const { wormholeWallCausticTheta, WALL_ADVECTION_HORIZON, WALL_CAUSTIC_COUNT } = loadGeometry();
  const depthPhase = 0.55;
  const travel = 4000;
  const delta = 0.02;
  function angularDistance(a, b) {
    const twoPi = Math.PI * 2;
    let diff = (a - b) % twoPi;
    if (diff > Math.PI) diff -= twoPi;
    if (diff < -Math.PI) diff += twoPi;
    return Math.abs(diff);
  }
  for (let i = 0; i < WALL_CAUSTIC_COUNT; i++) {
    // Shifting depthPhase by +delta and travelDistance by -delta*horizon leaves the advected
    // twist phase invariant; only the slow independent drift term (driftRate*travelDistance)
    // differs, and for a small delta that residual must stay far below a full turn -- otherwise
    // the twist term isn't actually the dominant motion anymore.
    const a = wormholeWallCausticTheta(i, depthPhase, travel);
    const b = wormholeWallCausticTheta(i, depthPhase + delta, travel - delta * WALL_ADVECTION_HORIZON);
    assert.ok(
      angularDistance(a, b) < 0.05,
      `caustic ${i}: advected twist should dominate over the slow drift residual (got ${angularDistance(a, b)} rad)`
    );
  }
});

test('wormholeWallCausticTheta never reads or mutates any route-frame-like object', () => {
  const { wormholeWallCausticTheta } = loadGeometry();
  const sharedRouteFrame = { headingAngle: 0, curvature: 0, positionX: 0, positionY: 0 };
  const before = wormholeWallCausticTheta(2, 0.44, 999);
  sharedRouteFrame.headingAngle = -0.4;
  sharedRouteFrame.curvature = -0.0015;
  sharedRouteFrame.positionX = -120;
  sharedRouteFrame.positionY = 900;
  const after = wormholeWallCausticTheta(2, 0.44, 999);
  assert.equal(before, after);
});

test('wormholeWallCausticTheta: dense sampling (48 and 32 steps, geometry-overhaul plan T3) keeps every adjacent theta step well under 20 degrees', () => {
  const { wormholeWallCausticTheta, wormholeWallRingDepthPhase, WALL_CAUSTIC_COUNT, WALL_CAUSTIC_MAX_TURNS } = loadGeometry();
  const MAX_STEP_RAD = (20 * Math.PI) / 180;
  // Deliberately includes non-round travelDistance values (a round multiple of the 1000-unit
  // advection horizon would place any wrap boundary exactly at the sweep's own start/end and could
  // hide a wrap-related discontinuity -- real playback essentially never lands on one exactly).
  for (const travelDistance of [0, 5000, 5237.8, 12345.67, 987654.321]) {
    for (const sampleCount of [48, 32]) {
      for (let causticIndex = 0; causticIndex < WALL_CAUSTIC_COUNT; causticIndex++) {
        let previous = null;
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
          const depthPhase = wormholeWallRingDepthPhase(sampleIndex, sampleCount);
          const theta = wormholeWallCausticTheta(causticIndex, depthPhase, travelDistance);
          if (previous !== null) {
            const rawStep = Math.abs(theta - previous);
            const step = Math.min(rawStep, Math.PI * 2 - rawStep);
            assert.ok(
              step < MAX_STEP_RAD,
              `travelDistance=${travelDistance} sampleCount=${sampleCount} caustic=${causticIndex} sample=${sampleIndex}: step ${step} rad exceeds the Nyquist-safe bound`
            );
          }
          previous = theta;
        }
      }
    }
  }
  assert.ok(WALL_CAUSTIC_MAX_TURNS <= 1.5, 'the authored twist cap itself must not silently regress past the planned bound');
});

test('wormholeWallCausticTheta stays continuous across the full depth sweep at every travelDistance -- no wrap-boundary tear regardless of where travelDistance/WALL_ADVECTION_HORIZON falls', () => {
  const { wormholeWallCausticTheta, WALL_CAUSTIC_COUNT, WALL_ADVECTION_HORIZON } = loadGeometry();
  const MAX_STEP_RAD = (5 * Math.PI) / 180;
  const STEPS = 400;
  // Sweep travelDistance itself across several multiples of the advection horizon, at fine
  // sub-horizon resolution, so a wrap boundary (which occurs once per horizon) is guaranteed to
  // fall inside at least one of the sampled fine steps for each sweep -- this is exactly the
  // scenario a coarse fixed-travelDistance test would miss.
  for (let horizonMultiple = 0; horizonMultiple < 3; horizonMultiple++) {
    for (let causticIndex = 0; causticIndex < WALL_CAUSTIC_COUNT; causticIndex++) {
      let previous = null;
      for (let i = 0; i <= STEPS; i++) {
        const travelDistance = (horizonMultiple + i / STEPS) * WALL_ADVECTION_HORIZON;
        const theta = wormholeWallCausticTheta(causticIndex, 0.5, travelDistance);
        if (previous !== null) {
          const rawStep = Math.abs(theta - previous);
          const step = Math.min(rawStep, Math.PI * 2 - rawStep);
          assert.ok(
            step < MAX_STEP_RAD,
            `caustic=${causticIndex} horizonMultiple=${horizonMultiple} i=${i} travelDistance=${travelDistance}: step ${step} rad -- likely a wrap-boundary tear`
          );
        }
        previous = theta;
      }
    }
  }
});

test('wormholeWallCausticTheta clamps out-of-range/invalid caustic indices instead of throwing', () => {
  const { wormholeWallCausticTheta, WALL_CAUSTIC_COUNT } = loadGeometry();
  const last = wormholeWallCausticTheta(WALL_CAUSTIC_COUNT - 1, 0.2, 100);
  assert.equal(wormholeWallCausticTheta(WALL_CAUSTIC_COUNT + 5, 0.2, 100), last);
  assert.equal(wormholeWallCausticTheta(-3, 0.2, 100), wormholeWallCausticTheta(0, 0.2, 100));
  assert.doesNotThrow(() => wormholeWallCausticTheta(NaN, 0.2, 100));
});

// -- defensive numeric handling ------------------------------------------------------------------

test('geometry functions treat non-finite inputs defensively instead of producing NaN', () => {
  const {
    wormholeWallSegmentTheta, wormholeWallRingDepthPhase, wormholeWallRingZ,
    wormholeWallRippleOffset, wormholeWallCausticTheta
  } = loadGeometry();
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.ok(Number.isFinite(wormholeWallSegmentTheta(bad, 48)));
    assert.ok(Number.isFinite(wormholeWallRingDepthPhase(bad, 16)));
    assert.ok(Number.isFinite(wormholeWallRingZ(0, 16, bad)));
    assert.ok(Number.isFinite(wormholeWallRippleOffset(bad, bad, bad)));
    assert.ok(Number.isFinite(wormholeWallCausticTheta(0, bad, bad)));
  }
});
