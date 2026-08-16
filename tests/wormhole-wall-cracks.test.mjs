import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Phase 8 of the wormhole refractive membrane wall plan (documents/audits/wormhole-wall-membrane-plan.md):
// a pre-generated, deterministic crack pool that glows only under an active kick/LOW_DROP wave
// front, reusing WormholeWallWaves' front pool instead of a second event source. Crack geometry
// itself never depends on travelDistance or wall-clock time -- only emission does, and only through
// the supplied fronts.

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

function loadCracks() {
  return createSourceLoader()('visuals/WormholeWallCracks.ts');
}

// -- pool determinism and limits -----------------------------------------------------------------

test('crack pool has the plan-specified count and per-crack point count within [4,8]', () => {
  const { WALL_CRACK_COUNT, WALL_CRACK_MIN_POINTS, WALL_CRACK_MAX_POINTS, wormholeWallCrackPointCount } = loadCracks();
  assert.equal(WALL_CRACK_MIN_POINTS, 4);
  assert.equal(WALL_CRACK_MAX_POINTS, 8);
  assert.ok(WALL_CRACK_COUNT >= 4, 'plan calls for a small pool');
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    const count = wormholeWallCrackPointCount(i);
    assert.ok(count >= WALL_CRACK_MIN_POINTS && count <= WALL_CRACK_MAX_POINTS, `crack ${i} point count ${count}`);
  }
});

test('crack points are deterministic and identical across repeated reads', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackPointCount, wormholeWallCrackPoint } = loadCracks();
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    const count = wormholeWallCrackPointCount(i);
    for (let p = 0; p < count; p++) {
      const a = wormholeWallCrackPoint(i, p);
      const b = wormholeWallCrackPoint(i, p);
      assert.equal(a.theta, b.theta, `crack ${i} point ${p} theta`);
      assert.equal(a.depthPhase, b.depthPhase, `crack ${i} point ${p} depthPhase`);
    }
  }
});

test('crack points never move backward in depth along their own path and stay within (0,1)', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackPointCount, wormholeWallCrackPoint } = loadCracks();
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    const count = wormholeWallCrackPointCount(i);
    let previousDepth = -Infinity;
    for (let p = 0; p < count; p++) {
      const point = wormholeWallCrackPoint(i, p);
      assert.ok(point.depthPhase > 0 && point.depthPhase < 1, `crack ${i} point ${p} depthPhase in (0,1)`);
      assert.ok(point.depthPhase > previousDepth, `crack ${i} point ${p} must be deeper than the previous point`);
      previousDepth = point.depthPhase;
    }
  }
});

test('crack points never read or mutate any route-frame-like object', () => {
  const { wormholeWallCrackPoint } = loadCracks();
  const sharedRouteFrame = { headingAngle: 0, curvature: 0, positionX: 0, positionY: 0 };
  const before = wormholeWallCrackPoint(2, 1);
  sharedRouteFrame.headingAngle = 0.8;
  sharedRouteFrame.curvature = 0.002;
  sharedRouteFrame.positionX = 300;
  sharedRouteFrame.positionY = -80;
  const after = wormholeWallCrackPoint(2, 1);
  assert.equal(before.theta, after.theta);
  assert.equal(before.depthPhase, after.depthPhase);
});

test('crack index/point index are clamped defensively instead of throwing', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackPoint, wormholeWallCrackPointCount, wormholeWallCrackEligibleKind } = loadCracks();
  assert.doesNotThrow(() => wormholeWallCrackPoint(WALL_CRACK_COUNT + 10, 0));
  assert.doesNotThrow(() => wormholeWallCrackPoint(-5, 0));
  assert.doesNotThrow(() => wormholeWallCrackPoint(0, 999));
  assert.doesNotThrow(() => wormholeWallCrackPoint(0, -3));
  assert.doesNotThrow(() => wormholeWallCrackPointCount(NaN));
  assert.doesNotThrow(() => wormholeWallCrackEligibleKind(Infinity));
});

test('the crack family mixes eligible kinds instead of every crack reacting to everything', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackEligibleKind } = loadCracks();
  const kinds = new Set();
  for (let i = 0; i < WALL_CRACK_COUNT; i++) kinds.add(wormholeWallCrackEligibleKind(i));
  assert.ok(kinds.size >= 2, 'expected a heterogeneous mix of eligible kinds across the family');
});

// -- peak-gated emission --------------------------------------------------------------------------

test('emission is exactly zero with no fronts at all', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackEmission } = loadCracks();
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    assert.equal(wormholeWallCrackEmission(i, [], 0), 0, `crack ${i}`);
  }
});

test('a weak front (below every crack\'s own activation threshold) still yields zero emission', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackEmission } = loadCracks();
  const weakFront = { kind: 0, ageSec: 0, intensity: 0.02, variant: 0 };
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    assert.equal(wormholeWallCrackEmission(i, [weakFront], 1), 0, `crack ${i} with a near-zero-intensity front`);
  }
});

test('a strong, fresh, eligible-kind front produces nonzero emission on at least one crack', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackEmission, WALL_CRACK_ELIGIBLE_BOTH } = loadCracks();
  const strongKick = { kind: 0, ageSec: 0, intensity: 1, variant: 0 };
  const strongDrop = { kind: 1, ageSec: 0, intensity: 1, variant: 0 };
  let anyLit = false;
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    const e = Math.max(
      wormholeWallCrackEmission(i, [strongKick], 1),
      wormholeWallCrackEmission(i, [strongDrop], 1)
    );
    if (e > 0) anyLit = true;
    assert.ok(e >= 0 && e <= 1, `crack ${i} emission must stay within [0,1]`);
  }
  assert.ok(anyLit, 'expected at least one crack to light up under a strong fresh front of either kind');
  void WALL_CRACK_ELIGIBLE_BOTH;
});

test('a crack never reacts to a front of a kind it is not eligible for', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackEmission, wormholeWallCrackEligibleKind, WALL_CRACK_ELIGIBLE_KICK, WALL_CRACK_ELIGIBLE_LOWDROP } = loadCracks();
  const strongKick = { kind: 0, ageSec: 0, intensity: 1, variant: 0 };
  const strongDrop = { kind: 1, ageSec: 0, intensity: 1, variant: 0 };
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    const kind = wormholeWallCrackEligibleKind(i);
    if (kind === WALL_CRACK_ELIGIBLE_KICK) {
      assert.equal(wormholeWallCrackEmission(i, [strongDrop], 1), 0, `kick-only crack ${i} must ignore a LOW_DROP front`);
    } else if (kind === WALL_CRACK_ELIGIBLE_LOWDROP) {
      assert.equal(wormholeWallCrackEmission(i, [strongKick], 1), 0, `lowDrop-only crack ${i} must ignore a kick front`);
    }
  }
});

test('emission decays monotonically (non-increasing) with a front\'s own age, for a crack it triggers', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackEmission, WALL_CRACK_ELIGIBLE_BOTH, wormholeWallCrackEligibleKind } = loadCracks();
  const bothCrackIndex = Array.from({ length: WALL_CRACK_COUNT }, (_, i) => i)
    .find(i => wormholeWallCrackEligibleKind(i) === WALL_CRACK_ELIGIBLE_BOTH);
  assert.ok(bothCrackIndex !== undefined, 'expected at least one "both" crack in the family for this test');

  let previous = Infinity;
  for (const ageSec of [0, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5]) {
    const front = { kind: 0, ageSec, intensity: 1, variant: 0 };
    const emission = wormholeWallCrackEmission(bothCrackIndex, [front], 1);
    assert.ok(emission <= previous + 1e-12, `age ${ageSec}: expected non-increasing emission, got ${emission} > ${previous}`);
    previous = emission;
  }
});

test('emission only honors up to fronts.length entries, ignoring a larger frontCount', () => {
  const { wormholeWallCrackEmission } = loadCracks();
  const fronts = [{ kind: 0, ageSec: 0, intensity: 1, variant: 0 }];
  assert.doesNotThrow(() => wormholeWallCrackEmission(0, fronts, 99));
});

test('emission stays bounded and finite for non-finite front fields', () => {
  const { WALL_CRACK_COUNT, wormholeWallCrackEmission } = loadCracks();
  const badFront = { kind: 0, ageSec: NaN, intensity: Infinity, variant: NaN };
  for (let i = 0; i < WALL_CRACK_COUNT; i++) {
    const e = wormholeWallCrackEmission(i, [badFront], 1);
    assert.ok(Number.isFinite(e) && e >= 0 && e <= 1, `crack ${i} emission ${e}`);
  }
  assert.doesNotThrow(() => wormholeWallCrackEmission(NaN, [badFront], NaN));
});
