import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Phase 3 of the wormhole refractive membrane wall plan (documents/audits/wormhole-wall-membrane-plan.md):
// pure Fresnel-style edge brightness, spectral sector-band mapping (must bit-match the grain field's
// bandIndex convention), and the chromatic refraction fringe offset. Nothing here reads route/camera
// state, and the spectrum channel must never touch radius.

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

function loadMaterial() {
  return createSourceLoader()('visuals/WormholeWallMaterial.ts');
}

const TWO_PI = Math.PI * 2;
const BANDS = 24;

// -- Fresnel monotonicity -----------------------------------------------------------------------

test('wormholeWallDepthEdgeGain is 1 at the camera and strictly decreases to 0 at the horizon', () => {
  const { wormholeWallDepthEdgeGain } = loadMaterial();
  const maxZ = 1000;
  assert.ok(Math.abs(wormholeWallDepthEdgeGain(0, maxZ) - 1) < 1e-9, 'z=0 must read full brightness');
  assert.ok(wormholeWallDepthEdgeGain(maxZ, maxZ) < 1e-6, 'z=horizon must fade to ~0');

  const STEPS = 200;
  let previous = wormholeWallDepthEdgeGain(0, maxZ);
  for (let i = 1; i <= STEPS; i++) {
    const z = (i / STEPS) * maxZ;
    const value = wormholeWallDepthEdgeGain(z, maxZ);
    assert.ok(value <= previous + 1e-9, `depth edge gain must be non-increasing: z=${z} value=${value} previous=${previous}`);
    previous = value;
  }
});

test('wormholeWallFresnel stays within [0,1] and is non-increasing with depth past the near-plane ramp', () => {
  const { wormholeWallFresnel } = loadMaterial();
  const maxZ = 1000;
  // wormholeNearPlaneVisibility's own ramp ends at max(max(60, maxZ*0.015)+1, maxZ*0.055) = 61 here;
  // start well past it (0.1 * maxZ) so this sweep only covers the monotone falloff region.
  const nearFullZ = maxZ * 0.1;

  const STEPS = 200;
  for (let i = 0; i <= STEPS; i++) {
    const z = (i / STEPS) * maxZ;
    const value = wormholeWallFresnel(z, maxZ);
    assert.ok(value >= -1e-9 && value <= 1 + 1e-9, `fresnel out of bounds at z=${z}: ${value}`);
  }

  let previous = wormholeWallFresnel(nearFullZ, maxZ);
  for (let i = 1; i <= STEPS; i++) {
    const z = nearFullZ + (i / STEPS) * (maxZ - nearFullZ);
    const value = wormholeWallFresnel(z, maxZ);
    assert.ok(value <= previous + 1e-9, `fresnel must be non-increasing past the near ramp: z=${z} value=${value} previous=${previous}`);
    previous = value;
  }
});

test('wormholeWallFresnel is deterministic and handles non-finite inputs defensively', () => {
  const { wormholeWallFresnel } = loadMaterial();
  assert.equal(wormholeWallFresnel(400, 1000), wormholeWallFresnel(400, 1000));
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.ok(Number.isFinite(wormholeWallFresnel(bad, 1000)));
    assert.ok(Number.isFinite(wormholeWallFresnel(400, bad)));
  }
});

// -- sector-band mapping matches the grain field -------------------------------------------------

/** Mirrors CosmicWormholeIdentity's constructor: theta = TWO_PI/BANDS * (bandIndex + jitter), jitter in [0,1). */
function grainThetaFor(bandIndex, jitter) {
  return (TWO_PI / BANDS) * (bandIndex + jitter);
}

test('wormholeWallBandIndex recovers the exact grain bandIndex for every band across the full jitter range', () => {
  const { wormholeWallBandIndex } = loadMaterial();
  for (let bandIndex = 0; bandIndex < BANDS; bandIndex++) {
    for (const jitter of [0, 0.001, 0.25, 0.5, 0.75, 0.999]) {
      const theta = grainThetaFor(bandIndex, jitter);
      assert.equal(wormholeWallBandIndex(theta), bandIndex, `bandIndex=${bandIndex} jitter=${jitter} theta=${theta}`);
    }
  }
});

test('wormholeWallBandIndex matches floor(theta / 2*PI * 24) exactly, per the plan clarification', () => {
  const { wormholeWallBandIndex } = loadMaterial();
  const STEPS = 500;
  for (let i = 0; i < STEPS; i++) {
    const theta = (i / STEPS) * TWO_PI;
    const expected = Math.min(BANDS - 1, Math.floor((theta / TWO_PI) * BANDS));
    assert.equal(wormholeWallBandIndex(theta), expected, `theta=${theta}`);
  }
});

test('wormholeWallBandIndex wraps negative and >2*PI theta into the same [0,BANDS) sector as its normalized angle', () => {
  const { wormholeWallBandIndex } = loadMaterial();
  const theta = 1.234;
  const base = wormholeWallBandIndex(theta);
  assert.equal(wormholeWallBandIndex(theta - TWO_PI), base);
  assert.equal(wormholeWallBandIndex(theta + TWO_PI), base);
  assert.equal(wormholeWallBandIndex(theta - TWO_PI * 3), base);
});

test('wormholeWallSectorResponse touches only alpha/refraction/rippleSpeed and never suggests a radius channel', () => {
  const { wormholeWallSectorResponse } = loadMaterial();
  const response = wormholeWallSectorResponse(0.5);
  assert.deepEqual(Object.keys(response).sort(), ['alphaGain', 'refractionGain', 'rippleSpeedGain']);
});

test('wormholeWallSectorResponse channels are bounded and monotonically non-decreasing in band energy', () => {
  const { wormholeWallSectorResponse } = loadMaterial();
  const STEPS = 100;
  let previous = wormholeWallSectorResponse(0);
  for (let i = 1; i <= STEPS; i++) {
    const energy = i / STEPS;
    const response = wormholeWallSectorResponse(energy);
    for (const key of ['alphaGain', 'refractionGain', 'rippleSpeedGain']) {
      assert.ok(response[key] >= previous[key] - 1e-9, `${key} must be non-decreasing in band energy`);
      assert.ok(response[key] >= 0, `${key} must stay non-negative`);
    }
    previous = response;
  }
});

// -- clump mask (wireframe-removal, geometry-overhaul plan T2) ----------------------------------

test('wormholeWallClumpField stays within [0,1] and is deterministic across a dense (theta, depthPhase) sweep', () => {
  const { wormholeWallClumpField } = loadMaterial();
  const STEPS = 200;
  for (let i = 0; i <= STEPS; i++) {
    const theta = (i / STEPS) * TWO_PI;
    for (let j = 0; j <= STEPS; j += 20) {
      const phase = j / STEPS;
      const a = wormholeWallClumpField(theta, phase);
      const b = wormholeWallClumpField(theta, phase);
      assert.equal(a, b, `theta=${theta} phase=${phase}`);
      assert.ok(a >= -1e-9 && a <= 1 + 1e-9, `field out of [0,1] at theta=${theta} phase=${phase}: ${a}`);
    }
  }
});

test('wormholeWallClumpGain extinguishes roughly 40-60% of the (theta, depthPhase) domain', () => {
  const { wormholeWallClumpGain } = loadMaterial();
  const STEPS = 240;
  let zeroCount = 0;
  let total = 0;
  for (let i = 0; i < STEPS; i++) {
    const theta = (i / STEPS) * TWO_PI;
    for (let j = 0; j < STEPS; j++) {
      const phase = j / STEPS;
      const gain = wormholeWallClumpGain(theta, phase);
      assert.ok(gain >= -1e-9 && gain <= 1 + 1e-9, `gain out of [0,1] at theta=${theta} phase=${phase}: ${gain}`);
      if (gain <= 1e-9) zeroCount++;
      total++;
    }
  }
  const zeroFraction = zeroCount / total;
  assert.ok(
    zeroFraction >= 0.4 && zeroFraction <= 0.6,
    `expected ~40-60% fully-extinguished segments, got ${(zeroFraction * 100).toFixed(1)}%`
  );
});

test('wormholeWallClumpGain forms spatially coherent clumps: most fully-lit points have a fully-lit neighbour a small theta-step away', () => {
  const { wormholeWallClumpGain } = loadMaterial();
  const STEPS = 240;
  const STEP_THETA = TWO_PI / STEPS;
  let litCount = 0;
  let litWithLitNeighbour = 0;
  for (let i = 0; i < STEPS; i++) {
    const theta = (i / STEPS) * TWO_PI;
    for (let j = 0; j < 40; j++) {
      const phase = j / 40;
      const gain = wormholeWallClumpGain(theta, phase);
      if (gain >= 1 - 1e-9) {
        litCount++;
        const neighbour = wormholeWallClumpGain(theta + STEP_THETA, phase);
        if (neighbour > 0) litWithLitNeighbour++;
      }
    }
  }
  assert.ok(litCount > 0, 'sweep must contain at least some fully-lit points to be a meaningful test');
  // Independent per-segment noise would put a fully-dark neighbour next to a lit point roughly as
  // often as not; a spatially coherent field must overwhelmingly avoid that.
  assert.ok(
    litWithLitNeighbour / litCount > 0.85,
    `expected a fully-lit point's immediate theta-neighbour to also be lit (coherent clumps), got ${((litWithLitNeighbour / litCount) * 100).toFixed(1)}%`
  );
});

test('wormholeWallClumpGain moves with the advected depth phase: a fixed (theta, depthPhase) reproduces the exact same clump shape one advection horizon later', () => {
  const { wormholeWallClumpGain } = loadMaterial();
  for (const [theta, phase] of [[0.4, 0.1], [2.9, 0.62], [5.7, 0.95]]) {
    const a = wormholeWallClumpGain(theta, phase);
    const b = wormholeWallClumpGain(theta, phase + 1);
    assert.ok(Math.abs(a - b) < 1e-9, `clump gain must be periodic in advected depth phase (period 1): theta=${theta} phase=${phase}`);
  }
});

test('wormholeWallClumpField/Gain treat non-finite inputs defensively instead of producing NaN', () => {
  const { wormholeWallClumpField, wormholeWallClumpGain } = loadMaterial();
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.ok(Number.isFinite(wormholeWallClumpField(bad, 0.5)));
    assert.ok(Number.isFinite(wormholeWallClumpField(0.5, bad)));
    assert.ok(Number.isFinite(wormholeWallClumpGain(bad, 0.5)));
    assert.ok(Number.isFinite(wormholeWallClumpGain(0.5, bad)));
  }
});

// -- chromatic refraction fringe -------------------------------------------------------------------

test('wormholeWallChromaticGain is exactly 0 whenever wormholeWallRefraction is 0, at every intensity', () => {
  const { wormholeWallChromaticGain } = loadMaterial();
  for (const intensity of [0, 0.5, 0.8, 0.95, 1]) {
    assert.equal(wormholeWallChromaticGain(intensity, 0), 0, `intensity=${intensity}`);
  }
});

test('wormholeWallChromaticGain gates out everything below the brightest ~20-30%', () => {
  const { wormholeWallChromaticGain } = loadMaterial();
  assert.equal(wormholeWallChromaticGain(0.2, 1), 0);
  assert.equal(wormholeWallChromaticGain(0.5, 1), 0);
  assert.equal(wormholeWallChromaticGain(0.7, 1), 0);
  assert.ok(wormholeWallChromaticGain(0.95, 1) > 0, 'near-peak intensity must pass the gate');
  assert.ok(wormholeWallChromaticGain(1, 1) > 0);
});

test('wormholeWallChromaticGain scales with refraction once past the intensity gate', () => {
  const { wormholeWallChromaticGain } = loadMaterial();
  const low = wormholeWallChromaticGain(0.95, 0.2);
  const high = wormholeWallChromaticGain(0.95, 0.8);
  assert.ok(low > 0 && high > low, 'higher refraction must yield a larger gain once gated on');
});

test('wormholeWallChromaticOffset splits a point into a symmetric warm/cool pair along its own radial direction from the ring center', () => {
  const { wormholeWallChromaticOffset } = loadMaterial();
  const result = wormholeWallChromaticOffset(110, 100, 100, 100, 5);
  // Point is 10px to the right of center -> radial direction is +X.
  assert.ok(Math.abs(result.warmX - 115) < 1e-9);
  assert.ok(Math.abs(result.warmY - 100) < 1e-9);
  assert.ok(Math.abs(result.coolX - 105) < 1e-9);
  assert.ok(Math.abs(result.coolY - 100) < 1e-9);
  // Symmetric around the original point.
  assert.ok(Math.abs((result.warmX + result.coolX) / 2 - 110) < 1e-9);
  assert.ok(Math.abs((result.warmY + result.coolY) / 2 - 100) < 1e-9);
});

test('wormholeWallChromaticOffset collapses to the source point when offsetPixels is 0, or the point sits exactly at the ring center', () => {
  const { wormholeWallChromaticOffset } = loadMaterial();
  // Compare property-by-property: the module loads in its own VM realm, so its returned object
  // literals do not share this file's Object.prototype and assert.deepEqual (deepStrictEqual under
  // node:assert/strict) would otherwise report a false "not reference-equal" prototype mismatch.
  const zeroOffset = wormholeWallChromaticOffset(110, 100, 100, 100, 0);
  assert.equal(zeroOffset.warmX, 110);
  assert.equal(zeroOffset.warmY, 100);
  assert.equal(zeroOffset.coolX, 110);
  assert.equal(zeroOffset.coolY, 100);

  const atCenter = wormholeWallChromaticOffset(100, 100, 100, 100, 5);
  assert.equal(atCenter.warmX, 100);
  assert.equal(atCenter.warmY, 100);
  assert.equal(atCenter.coolX, 100);
  assert.equal(atCenter.coolY, 100);
});

test('wormholeWallChromaticOffset never produces NaN for degenerate or non-finite inputs', () => {
  const { wormholeWallChromaticOffset } = loadMaterial();
  for (const bad of [NaN, Infinity, -Infinity]) {
    const result = wormholeWallChromaticOffset(bad, bad, 0, 0, bad);
    for (const key of Object.keys(result)) assert.ok(Number.isFinite(result[key]), `${key} must stay finite`);
  }
});
