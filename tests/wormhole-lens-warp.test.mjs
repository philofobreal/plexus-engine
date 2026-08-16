import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// F1 of the wormhole true-lens plan (documents/audits/wormhole-true-lens-plan.md): a pure,
// screen-space gravitational lens *forward* mapping (source -> image), replacing the earlier
// sink-style deflection from the lens-overhaul plan. Nothing here reads route/camera/State,
// nothing allocates beyond the caller-owned out object, and every value must be reproducible
// directly from its numeric arguments alone.

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

function loadLens() {
  return createSourceLoader()('visuals/WormholeLensWarp.ts');
}

function warp(fn, px, py, cx, cy, radius, strength, swirl) {
  const out = { x: 0, y: 0 };
  fn(px, py, cx, cy, radius, strength, swirl, out);
  return out;
}

// -- identity at strength=0 -----------------------------------------------------------------

test('wormholeLensWarpPoint is an exact identity pass-through whenever strength<=0, for any swirl value', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const cases = [
    [123.4, 56.7, 100, 100, 80, 0, 0],
    [123.4, 56.7, 100, 100, 80, 0, 1.5],
    [123.4, 56.7, 100, 100, 80, -0.5, 2],
    [0, 0, 0, 0, 80, 0, 0]
  ];
  for (const [px, py, cx, cy, radius, strength, swirl] of cases) {
    const out = warp(wormholeLensWarpPoint, px, py, cx, cy, radius, strength, swirl);
    assert.equal(out.x, px, `px=${px} strength=${strength} swirl=${swirl}`);
    assert.equal(out.y, py, `py=${py} strength=${strength} swirl=${swirl}`);
  }
});

test('wormholeLensWarpPoint is an exact identity pass-through whenever radius<=0', () => {
  const { wormholeLensWarpPoint } = loadLens();
  for (const radius of [0, -10, NaN]) {
    const out = warp(wormholeLensWarpPoint, 200, 150, 100, 100, radius, 1, 1);
    assert.equal(out.x, 200);
    assert.equal(out.y, 150);
  }
});

// -- determinism -----------------------------------------------------------------------------

test('wormholeLensWarpPoint and wormholeLensMagnificationGain are deterministic for identical inputs', () => {
  const { wormholeLensWarpPoint, wormholeLensMagnificationGain } = loadLens();
  const a = warp(wormholeLensWarpPoint, 210, 340, 100, 100, 90, 0.7, 0.4);
  const b = warp(wormholeLensWarpPoint, 210, 340, 100, 100, 90, 0.7, 0.4);
  assert.deepEqual(a, b);

  const dx = 210 - 100, dy = 340 - 100;
  const d2 = dx * dx + dy * dy;
  const g1 = wormholeLensMagnificationGain(d2, 90, 0.7);
  const g2 = wormholeLensMagnificationGain(d2, 90, 0.7);
  assert.equal(g1, g2);
});

// -- swirl=0 -> pure radial warp, angle from center unchanged --------------------------------

test('wormholeLensWarpPoint with swirl=0 keeps the warped point exactly on the original radial line from the lens center', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const cx = 400, cy = 300;
  const cases = [
    [500, 300, 60, 0.5],
    [400, 450, 60, 0.9],
    [350, 250, 60, 0.3]
  ];
  for (const [px, py, radius, strength] of cases) {
    const out = warp(wormholeLensWarpPoint, px, py, cx, cy, radius, strength, 0);
    const origAngle = Math.atan2(py - cy, px - cx);
    const warpedAngle = Math.atan2(out.y - cy, out.x - cx);
    assert.ok(
      Math.abs(origAngle - warpedAngle) < 1e-9,
      `angle from center must be unchanged when swirl=0: orig=${origAngle} warped=${warpedAngle}`
    );
  }
});

test('wormholeLensWarpPoint with nonzero swirl rotates the point off its original radial line', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const cx = 400, cy = 300;
  const px = 460, py = 300; // close to the lens center, where falloff (and thus swirl) is strong
  const withoutSwirl = warp(wormholeLensWarpPoint, px, py, cx, cy, 60, 0.6, 0);
  const withSwirl = warp(wormholeLensWarpPoint, px, py, cx, cy, 60, 0.6, 1.2);
  const angleNoSwirl = Math.atan2(withoutSwirl.y - cy, withoutSwirl.x - cx);
  const angleSwirl = Math.atan2(withSwirl.y - cy, withSwirl.x - cx);
  assert.ok(Math.abs(angleNoSwirl - angleSwirl) > 1e-6, 'a nonzero swirl must rotate the point off its original angle');
});

// -- forward mapping is a ring, not a sink ----------------------------------------------------

test('a source approaching the lens axis images out toward the Einstein radius, never toward the center', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const cx = 500, cy = 400;
  const radius = 70;
  // Approaching along a fixed ray (+X), the image distance from center must (a) always sit at or
  // outside the ring and (b) monotonically shrink toward the ring itself as beta shrinks toward
  // 0 -- the opposite of a sink, which would shrink toward the center instead.
  let previousOvershoot = Infinity;
  for (const beta of [10, 1, 0.1, 0.01, 0.001]) {
    const out = warp(wormholeLensWarpPoint, cx + beta, cy, cx, cy, radius, 1, 0);
    const dist = Math.hypot(out.x - cx, out.y - cy);
    const overshoot = dist - radius;
    assert.ok(overshoot >= -1e-6, `image must sit at/outside the Einstein radius: beta=${beta} dist=${dist}`);
    assert.ok(
      overshoot <= previousOvershoot + 1e-9,
      `overshoot past the ring must shrink monotonically as beta shrinks: beta=${beta} overshoot=${overshoot} previous=${previousOvershoot}`
    );
    previousOvershoot = overshoot;
  }
});

test('theta+ is always >= the Einstein radius for every beta>0 and strength=1', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const cx = 0, cy = 0;
  const radius = 55;
  // beta=0 exactly is the one construction-mandated exception (dx=dy=0 forces the output to the
  // center regardless of theta+, see the dedicated axis/continuity tests below) -- every other
  // beta must image at or beyond the Einstein radius at full strength.
  for (const beta of [0.01, 1, 10, 55, 100, 1000]) {
    for (const strength of [0.01, 0.3, 0.6, 1]) {
      const out = warp(wormholeLensWarpPoint, beta, 0, cx, cy, radius, strength, 0);
      const dist = Math.hypot(out.x - cx, out.y - cy);
      assert.ok(Number.isFinite(dist), `distance must stay finite: beta=${beta} strength=${strength}`);
      if (strength === 1) {
        assert.ok(dist >= radius - 1e-6, `theta+ must be >= radius: beta=${beta} dist=${dist}`);
      }
    }
  }
});

test('far from the lens, theta+ asymptotically approaches beta (weak lensing looks unperturbed)', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const cx = 0, cy = 0;
  const radius = 40;
  const farBeta = 100000;
  const out = warp(wormholeLensWarpPoint, farBeta, 0, cx, cy, radius, 1, 0);
  const dist = Math.hypot(out.x - cx, out.y - cy);
  const relativeError = Math.abs(dist - farBeta) / farBeta;
  assert.ok(relativeError < 1e-6, `far-field image must sit within a tiny fraction of beta: dist=${dist} beta=${farBeta}`);
});

// -- continuity through the axis (no NaN/Infinity, bounded ramp) -----------------------------

test('wormholeLensWarpPoint stays finite and bounded as the sampled point approaches the lens center', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const cx = 500, cy = 500;
  const radius = 40;
  // theta+(beta) is monotonically increasing in beta and theta+(0)=radius, so down to the beta
  // floor (a tiny fraction of radius, see LENS_BETA_FLOOR_RATIO in WormholeLensWarp.ts) the image
  // distance must sit at/outside the ring and never blow up.
  for (const d of [4, 3, 2, 1, 0.5, 0.1, 0.01, 0.001]) {
    const out = warp(wormholeLensWarpPoint, cx + d, cy, cx, cy, radius, 1, 0.5);
    assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y), `output must stay finite at d=${d}`);
    const dist = Math.hypot(out.x - cx, out.y - cy);
    assert.ok(dist >= radius - 1e-6, `image must never undershoot the ring: d=${d} dist=${dist}`);
    assert.ok(dist < radius * 1.5, `image must stay bounded near the axis, not blow up: d=${d} dist=${dist}`);
  }
  // Inside the beta floor's tiny neighborhood (d far below LENS_BETA_FLOOR_RATIO*radius), the
  // scale factor is pinned constant, so distance-from-center is exactly linear in d, ramping
  // smoothly from the ring (at the floor boundary) down to 0 (at d=0) -- a deliberate, documented
  // trade of the ">=ring" invariant for continuity through the one direction-undefined point.
  let previousDist = -1;
  for (const d of [1e-6, 1e-7, 1e-8, 1e-9, 0]) {
    const out = warp(wormholeLensWarpPoint, cx + d, cy, cx, cy, radius, 1, 0.5);
    assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y), `output must stay finite at d=${d}`);
    const dist = Math.hypot(out.x - cx, out.y - cy);
    assert.ok(dist <= radius + 1e-6, `sub-floor ramp must never exceed the ring: d=${d} dist=${dist}`);
    assert.ok(dist <= previousDist + 1e-9 || previousDist < 0, `sub-floor ramp must shrink toward 0: d=${d} dist=${dist} previous=${previousDist}`);
    previousDist = dist;
  }
  // Exactly at the center (dx=dy=0), the point lands exactly on the lens center: the scale factor
  // multiplies a zero vector regardless of its own magnitude, so this is exact by construction,
  // not a special-cased branch.
  const atCenter = warp(wormholeLensWarpPoint, cx, cy, cx, cy, radius, 1, 0.5);
  assert.equal(atCenter.x, cx);
  assert.equal(atCenter.y, cy);
});

// -- magnification gain --------------------------------------------------------------------------

test('wormholeLensMagnificationGain is largest near the lens axis and fades toward 0 far away', () => {
  const { wormholeLensMagnificationGain } = loadLens();
  const radius = 80;
  const strength = 1;
  const nearAxis = wormholeLensMagnificationGain(1, radius, strength);
  const atRing = wormholeLensMagnificationGain(radius * radius, radius, strength);
  const farOut = wormholeLensMagnificationGain((radius * 50) ** 2, radius, strength);
  assert.ok(nearAxis > atRing, 'gain must be larger near the axis (beta->0) than at the ring itself');
  assert.ok(atRing > farOut, 'gain must fade further out');
  assert.ok(farOut < 0.01, 'gain must be nearly 0 far from the lens (weak-lensing regime)');
});

test('wormholeLensMagnificationGain is bounded for every input, including extreme ones', () => {
  const { wormholeLensMagnificationGain } = loadLens();
  const radius = 50;
  for (const d2 of [0, 1, 100, 2500, 10000, 1e9]) {
    for (const strength of [0, 0.3, 0.7, 1, 1.5, -1]) {
      const gain = wormholeLensMagnificationGain(d2, radius, strength);
      assert.ok(Number.isFinite(gain), `gain must be finite at d2=${d2} strength=${strength}`);
      assert.ok(gain >= 0 && gain <= 2.5 + 1e-9, `gain out of bounds at d2=${d2} strength=${strength}: ${gain}`);
    }
  }
});

test('wormholeLensMagnificationGain is exactly 0 whenever strength<=0 or radius<=0', () => {
  const { wormholeLensMagnificationGain } = loadLens();
  assert.equal(wormholeLensMagnificationGain(2500, 50, 0), 0);
  assert.equal(wormholeLensMagnificationGain(2500, 50, -1), 0);
  assert.equal(wormholeLensMagnificationGain(2500, 0, 1), 0);
  assert.equal(wormholeLensMagnificationGain(2500, -10, 1), 0);
});

// -- secondary image (F2) ---------------------------------------------------------------------

test('wormholeLensSecondaryPoint lands exactly on the lens center whenever strength<=0 or radius<=0', () => {
  const { wormholeLensSecondaryPoint } = loadLens();
  const cases = [
    [123.4, 56.7, 100, 100, 80, 0, 0],
    [123.4, 56.7, 100, 100, 80, -0.5, 1.5],
    [200, 150, 100, 100, 0, 1, 1],
    [200, 150, 100, 100, -10, 1, 1]
  ];
  for (const [px, py, cx, cy, radius, strength, swirl] of cases) {
    const out = warp(wormholeLensSecondaryPoint, px, py, cx, cy, radius, strength, swirl);
    assert.equal(out.x, cx, `strength=${strength} radius=${radius}`);
    assert.equal(out.y, cy, `strength=${strength} radius=${radius}`);
  }
});

test('wormholeLensSecondaryPoint always lands strictly inside (or exactly on, at beta=0) the Einstein radius', () => {
  const { wormholeLensSecondaryPoint } = loadLens();
  const cx = 0, cy = 0;
  const radius = 60;
  for (const beta of [0, 0.01, 1, 10, 60, 200, 5000]) {
    for (const strength of [0.2, 0.5, 1]) {
      const out = warp(wormholeLensSecondaryPoint, cx + beta, cy, cx, cy, radius, strength, 0);
      const dist = Math.hypot(out.x - cx, out.y - cy);
      assert.ok(Number.isFinite(dist), `distance must stay finite: beta=${beta} strength=${strength}`);
      assert.ok(dist <= radius + 1e-6, `secondary image must never sit outside the ring: beta=${beta} strength=${strength} dist=${dist}`);
    }
  }
});

test('wormholeLensSecondaryPoint sits on the opposite side of the lens center from the source', () => {
  const { wormholeLensSecondaryPoint } = loadLens();
  const cx = 400, cy = 300;
  const px = 500, py = 300; // directly to the +X side of center
  const out = warp(wormholeLensSecondaryPoint, px, py, cx, cy, 50, 1, 0);
  assert.ok(out.x < cx, `secondary image must sit on the -X side when the source is on the +X side, got x=${out.x}`);
  assert.ok(Math.abs(out.y - cy) < 1e-9, 'no swirl means the secondary image stays on the same axis line');
});

test('wormholeLensSecondaryPoint magnitude grows toward the source approaching the axis, and shrinks to 0 far away', () => {
  const { wormholeLensSecondaryPoint } = loadLens();
  const cx = 0, cy = 0;
  const radius = 45;
  const near = warp(wormholeLensSecondaryPoint, cx + 0.001, cy, cx, cy, radius, 1, 0);
  const mid = warp(wormholeLensSecondaryPoint, cx + radius, cy, cx, cy, radius, 1, 0);
  const far = warp(wormholeLensSecondaryPoint, cx + 100000, cy, cx, cy, radius, 1, 0);
  const distNear = Math.hypot(near.x - cx, near.y - cy);
  const distMid = Math.hypot(mid.x - cx, mid.y - cy);
  const distFar = Math.hypot(far.x - cx, far.y - cy);
  assert.ok(distNear > distMid, `magnitude must shrink as beta grows: near=${distNear} mid=${distMid}`);
  assert.ok(distMid > distFar, `magnitude must keep shrinking further out: mid=${distMid} far=${distFar}`);
  assert.ok(distFar < 1, `secondary image must be negligible far from the axis: far=${distFar}`);
  assert.ok(Math.abs(distNear - radius) < 0.01, `near-axis magnitude must approach thetaE: distNear=${distNear} radius=${radius}`);
});

test('wormholeLensSecondaryPoint swirl rotates in the opposite direction from the primary mapping', () => {
  const { wormholeLensSecondaryPoint, wormholeLensWarpPoint } = loadLens();
  const cx = 400, cy = 300;
  const px = 460, py = 300;
  const primary = warp(wormholeLensWarpPoint, px, py, cx, cy, 60, 0.6, 1.2);
  const secondary = warp(wormholeLensSecondaryPoint, px, py, cx, cy, 60, 0.6, 1.2);
  const primaryAngle = Math.atan2(primary.y - cy, primary.x - cx);
  const secondaryAngle = Math.atan2(secondary.y - cy, secondary.x - cx);
  // The source itself sits at angle 0 from the center; the primary image swirls to a positive
  // angle (rotates one way) while the secondary -- besides sitting on the opposite side -- swirls
  // its own arc the other way, so its angle should be reflected past the axis-opposite line (pi)
  // in the opposite rotational sense from the primary's own deviation from angle 0.
  assert.ok(Math.abs(primaryAngle) > 1e-6, 'primary image must be rotated off angle 0 by the swirl');
  const secondaryDeviationFromOppositeAxis = secondaryAngle - Math.PI;
  assert.ok(Math.abs(secondaryDeviationFromOppositeAxis) > 1e-6, 'secondary image must be rotated off the opposite-axis angle by the swirl');
  assert.ok(
    Math.sign(primaryAngle) !== Math.sign(secondaryDeviationFromOppositeAxis),
    `primary and secondary swirl deviations must have opposite signs: primary=${primaryAngle} secondaryDeviation=${secondaryDeviationFromOppositeAxis}`
  );
});

test('wormholeLensSecondaryGain is largest near the axis and fades to 0 far away, bounded and lower than the primary cap', () => {
  const { wormholeLensSecondaryGain } = loadLens();
  const radius = 70;
  const nearAxis = wormholeLensSecondaryGain(1, radius, 1);
  const atRing = wormholeLensSecondaryGain(radius * radius, radius, 1);
  const farOut = wormholeLensSecondaryGain((radius * 50) ** 2, radius, 1);
  assert.ok(nearAxis > atRing, 'gain must be largest near the axis');
  assert.ok(atRing > farOut, 'gain must fade further out');
  assert.ok(farOut < 0.01, 'gain must be nearly 0 far from the lens');
  for (const d2 of [0, 1, 100, 2500, 10000, 1e9]) {
    for (const strength of [0, 0.3, 0.7, 1, 1.5, -1]) {
      const gain = wormholeLensSecondaryGain(d2, radius, strength);
      assert.ok(Number.isFinite(gain), `gain must be finite at d2=${d2} strength=${strength}`);
      assert.ok(gain >= 0 && gain <= 1.2 + 1e-9, `gain out of bounds at d2=${d2} strength=${strength}: ${gain}`);
    }
  }
});

test('wormholeLensSecondaryGain is exactly 0 whenever strength<=0 or radius<=0', () => {
  const { wormholeLensSecondaryGain } = loadLens();
  assert.equal(wormholeLensSecondaryGain(2500, 50, 0), 0);
  assert.equal(wormholeLensSecondaryGain(2500, 50, -1), 0);
  assert.equal(wormholeLensSecondaryGain(2500, 0, 1), 0);
  assert.equal(wormholeLensSecondaryGain(2500, -10, 1), 0);
});

test('wormholeLensSecondaryPoint and wormholeLensSecondaryGain are deterministic and defensive against non-finite inputs', () => {
  const { wormholeLensSecondaryPoint, wormholeLensSecondaryGain } = loadLens();
  const a = warp(wormholeLensSecondaryPoint, 210, 340, 100, 100, 90, 0.7, 0.4);
  const b = warp(wormholeLensSecondaryPoint, 210, 340, 100, 100, 90, 0.7, 0.4);
  assert.deepEqual(a, b);
  for (const bad of [NaN, Infinity, -Infinity]) {
    const out = warp(wormholeLensSecondaryPoint, bad, bad, bad, bad, bad, bad, bad);
    assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y), `must stay finite for bad=${bad}`);
    assert.ok(Number.isFinite(wormholeLensSecondaryGain(bad, 50, 0.5)));
  }
});

// -- defensive numeric handling --------------------------------------------------------------

test('wormholeLensWarpPoint and wormholeLensMagnificationGain treat non-finite inputs defensively instead of producing NaN', () => {
  const { wormholeLensWarpPoint, wormholeLensMagnificationGain } = loadLens();
  for (const bad of [NaN, Infinity, -Infinity]) {
    const out = warp(wormholeLensWarpPoint, bad, bad, bad, bad, bad, bad, bad);
    assert.ok(Number.isFinite(out.x), `out.x must stay finite for bad=${bad}`);
    assert.ok(Number.isFinite(out.y), `out.y must stay finite for bad=${bad}`);

    const out2 = warp(wormholeLensWarpPoint, 100, 100, 50, 50, 60, bad, bad);
    assert.ok(Number.isFinite(out2.x) && Number.isFinite(out2.y), `partial-bad inputs must stay finite for bad=${bad}`);

    assert.ok(Number.isFinite(wormholeLensMagnificationGain(bad, 50, 0.5)));
    assert.ok(Number.isFinite(wormholeLensMagnificationGain(2500, bad, 0.5)));
    assert.ok(Number.isFinite(wormholeLensMagnificationGain(2500, 50, bad)));
  }
});

test('wormholeLensWarpPoint never reads or mutates any route-frame-like or State-like shared object', () => {
  const { wormholeLensWarpPoint } = loadLens();
  const sharedState = { visualTuning: { wormholeLens: 1 }, currentTime: 5 };
  const before = warp(wormholeLensWarpPoint, 210, 340, 100, 100, 90, 0.7, 0.4);
  sharedState.visualTuning.wormholeLens = 0;
  sharedState.currentTime = 999;
  const after = warp(wormholeLensWarpPoint, 210, 340, 100, 100, 90, 0.7, 0.4);
  assert.deepEqual(before, after);
});

// -- streak-chord guard -------------------------------------------------------------------------

test('wormholeLensChordExceedsAngle is false for a small angular separation and true for a wide one', () => {
  const { wormholeLensChordExceedsAngle } = loadLens();
  const cx = 0, cy = 0;
  // Two points 10 degrees apart on a circle of radius 100 around the center.
  const a10 = [100, 0];
  const b10 = [100 * Math.cos(Math.PI / 18), 100 * Math.sin(Math.PI / 18)];
  assert.equal(wormholeLensChordExceedsAngle(cx, cy, a10[0], a10[1], b10[0], b10[1], 25 * Math.PI / 180), false);

  // Two points 90 degrees apart -- well past a 25-degree threshold.
  const a90 = [100, 0];
  const b90 = [0, 100];
  assert.equal(wormholeLensChordExceedsAngle(cx, cy, a90[0], a90[1], b90[0], b90[1], 25 * Math.PI / 180), true);
});

test('wormholeLensChordExceedsAngle handles the wraparound near +/-180 degrees correctly', () => {
  const { wormholeLensChordExceedsAngle } = loadLens();
  const cx = 0, cy = 0;
  // 170 degrees and -170 degrees are only 20 degrees apart going the short way around.
  const a = [100 * Math.cos(170 * Math.PI / 180), 100 * Math.sin(170 * Math.PI / 180)];
  const b = [100 * Math.cos(-170 * Math.PI / 180), 100 * Math.sin(-170 * Math.PI / 180)];
  assert.equal(wormholeLensChordExceedsAngle(cx, cy, a[0], a[1], b[0], b[1], 25 * Math.PI / 180), false);
});

test('wormholeLensChordExceedsAngle is symmetric and deterministic', () => {
  const { wormholeLensChordExceedsAngle } = loadLens();
  const cx = 10, cy = -5;
  const a = [80, 40];
  const b = [-30, 90];
  const maxAngle = 25 * Math.PI / 180;
  const forward = wormholeLensChordExceedsAngle(cx, cy, a[0], a[1], b[0], b[1], maxAngle);
  const backward = wormholeLensChordExceedsAngle(cx, cy, b[0], b[1], a[0], a[1], maxAngle);
  assert.equal(forward, backward);
  assert.equal(forward, wormholeLensChordExceedsAngle(cx, cy, a[0], a[1], b[0], b[1], maxAngle));
});
