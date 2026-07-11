import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src/visuals/WormholeGrainField.ts');
const output = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInContext(output, vm.createContext({ exports: module.exports, module, Math, Number }), {
  filename: sourcePath
});
const route = module.exports;

const FRAME_COMPONENTS = [
  'positionX', 'positionY', 'tangentX', 'tangentY', 'normalX', 'normalY',
  'headingAngle', 'curvature', 'turnIntensity'
];

function frame(distance, bend, out) {
  return route.sampleWormholeRouteFrame(distance, bend, out);
}

function assertFrameEqual(actual, expected, message) {
  for (const key of FRAME_COMPONENTS) {
    assert.equal(actual[key], expected[key], `${message}: ${key}`);
  }
}

function localCenter(worldDistance, cameraDistance, bend) {
  const world = frame(worldDistance, bend);
  const camera = frame(cameraDistance, bend);
  const dx = world.positionX - camera.positionX;
  const dy = world.positionY - camera.positionY;
  return {
    x: dx * camera.normalX + dy * camera.normalY,
    z: dx * camera.tangentX + dy * camera.tangentY
  };
}

function unwrapDelta(previous, current) {
  let delta = current - previous;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

test('route frame bend zero is the exact straight travel baseline', () => {
  const reused = {
    positionX: 12, positionY: -4,
    tangentX: 1, tangentY: 0,
    normalX: 0, normalY: 1,
    headingAngle: 9, curvature: 3, turnIntensity: 2
  };
  for (const distance of [0, 125, 7345, 30000]) {
    const actual = frame(distance, 0, reused);
    assert.equal(actual.positionX, 0);
    assert.equal(actual.positionY, distance);
    assert.equal(actual.tangentX, 0);
    assert.equal(actual.tangentY, 1);
    assert.equal(actual.normalX, 1);
    assert.equal(actual.normalY, 0);
    assert.equal(actual.headingAngle, 0);
    assert.equal(actual.curvature, 0);
    assert.equal(actual.turnIntensity, 0);
    for (const key of FRAME_COMPONENTS) {
      assert.equal(Object.is(actual[key], -0), false, `${key} must be positive zero when zero applies`);
    }
  }
});

test('route tangent is normalized and normal is its perpendicular pair', () => {
  for (const bend of [0, 0.2, 0.58, 0.72, 1]) {
    for (let distance = 0; distance <= 30000; distance += 375) {
      const sample = frame(distance, bend);
      assert.ok(Math.abs(Math.hypot(sample.tangentX, sample.tangentY) - 1) <= 1e-12);
      assert.ok(Math.abs(Math.hypot(sample.normalX, sample.normalY) - 1) <= 1e-12);
      assert.ok(Math.abs(sample.tangentX * sample.normalX + sample.tangentY * sample.normalY) <= 1e-12);
    }
  }
});

test('heading is continuous and bend scales the same canonical arc identity', () => {
  for (const bend of [0.2, 0.72, 1]) {
    let previous = frame(0, bend);
    let maxDelta = 0;
    for (let distance = 75; distance <= 30000; distance += 75) {
      const current = frame(distance, bend);
      maxDelta = Math.max(maxDelta, Math.abs(unwrapDelta(previous.headingAngle, current.headingAngle)));
      previous = current;
    }
    assert.ok(maxDelta <= 0.04, `bend=${bend} max heading step ${maxDelta}`);
  }

  const low = frame(2400, 0.25);
  const high = frame(2400, 0.75);
  assert.ok(high.turnIntensity > low.turnIntensity);
  assert.ok(Math.abs(high.turnIntensity / low.turnIntensity - 3) < 0.02);
  assert.ok(high.curvature > low.curvature);
});

test('curvature sign does not flip across the visible long-route horizon', () => {
  for (const bend of [0.35, 0.72, 1]) {
    const signs = [];
    for (let distance = 150; distance <= 60000; distance += 150) {
      const sign = Math.sign(frame(distance, bend).curvature);
      if (sign) signs.push(sign);
    }
    assert.ok(signs.length > 0);
    assert.ok(signs.every(sign => sign === signs[0]), `bend=${bend} signs=${signs}`);
  }
});

test('camera-local route keeps distant centerline near the viewing axis', () => {
  for (const cameraDistance of [0, 1200, 3600, 7350, 12000, 18000]) {
    for (const lookahead of [250, 600, 1000, 1800]) {
      const center = localCenter(cameraDistance + lookahead, cameraDistance, 0.72);
      assert.ok(center.z > lookahead * 0.55, `forward depth collapsed: ${JSON.stringify(center)}`);
      assert.ok(
        Math.abs(center.x / center.z) <= 0.5,
        `vanishing center left the route-local view: camera=${cameraDistance} lookahead=${lookahead} ${JSON.stringify(center)}`
      );
    }
  }
});

test('legacy route offset remains an exact zero-bend compatibility baseline', () => {
  const reused = { offsetX: 1, offsetY: -1, tangentX: 1, tangentY: -1 };
  for (const sampler of [route.sampleWormholeRoute, route.sampleWormholeBackgroundRoute]) {
    const actual = sampler === route.sampleWormholeRoute
      ? sampler(7345, 0.5, 0, reused)
      : sampler(7345, 0, reused);
    assert.deepEqual(actual, { offsetX: 0, offsetY: 0, tangentX: 0, tangentY: 0 });
  }
});

test('route model is integrated persistent curvature, not a hashed route field', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(source, /PATH_CELL|cellLength|routeCellTarget|routeCellSlope|pseudoNoise\([^)]*routeDistance/);
  assert.doesNotMatch(source, /offsetY = Math\.sin\(theta\)|ARC_RADIUS/);
  assert.doesNotMatch(source, /wormholeTurnSign|TURN_PERIOD_SEGMENTS|\+,\+,-,-/);
  assert.doesNotMatch(source, /Math\.exp\(-distance \/ ROUTE_BEND_LENGTH\)|Math\.atan\(slope\)|Math\.log1p/);
  assert.match(source, /sampleWormholeRouteFrame/);
  assert.match(source, /ROUTE_ARC_LENGTH = 18000/);
  assert.match(source, /ROUTE_MAX_HEADING = 0\.88/);
  assert.match(source, /ROUTE_CURVATURE = ROUTE_MAX_HEADING \/ ROUTE_ARC_LENGTH/);
  assert.match(source, /amount \* ROUTE_CURVATURE \* Math\.max\(0, distance\)/);
  assert.match(source, /wormholeIntegratedRoute\(distance, amount, result\)/);
});

test('route sampling is history-independent across seek and call order', () => {
  const checkpoints = [0, 100, 2999, 3000, 7345, 12000, 30000];
  for (const distance of checkpoints) {
    const expected = { ...frame(distance, 0.72) };
    frame(90000, 0.2);
    frame(3, 1);
    assertFrameEqual(frame(distance, 0.72), expected, `seek ${distance}`);
  }
});

test('projected tube cross-section stays circular across bends and depths (AC1 numeric proof)', () => {
  // This is the exact check the previous, now-fixed regression lacked: the earlier renderer scaled
  // one screen axis of the tube by 0.25 but left the other axis raw, giving an exact 4:1 ellipse at
  // every bend including the straight baseline. A green test suite never caught it because nothing
  // measured the final projected ring shape -- only the underlying route-frame math in isolation.
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const radius = 50;
  const N = 48;
  function ringAspect(distanceNow, z, bend, driftWeight) {
    const routeNow = route.sampleWormholeRouteFrame(distanceNow + z, bend);
    const baseRouteNow = route.sampleWormholeRouteFrame(distanceNow, bend);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const p = route.projectWormholeTubePoint(routeNow, baseRouteNow, z, theta, radius, driftWeight, cx, cy, fov);
      minX = Math.min(minX, p.screenX); maxX = Math.max(maxX, p.screenX);
      minY = Math.min(minY, p.screenY); maxY = Math.max(maxY, p.screenY);
    }
    return (maxX - minX) / (maxY - minY);
  }

  const cases = [
    [2000, 300, 0], [2000, 300, 0.5], [6000, 300, 1], [400, 100, 0], [400, 100, 1], [15000, 800, 0.72],
    // Wider sweep (large z relative to distance/turn scale): visual gain moves only the shared
    // centerline drift, never the per-theta radial cross-section, so it must not create a fixed
    // ellipse even when the route cue is amplified.
    [2000, 1500, 1], [6000, 2000, 1], [20000, 3000, 1], [50000, 5000, 1], [9600, 4800, 1], [30000, 4700, 1]
  ];
  for (const [distance, z, bend] of cases) {
    const ratio = ringAspect(distance, z, bend, route.wormholeRouteTurnVisualGain(bend));
    assert.ok(
      ratio > 0.8 && ratio < 1.25,
      `distance=${distance} z=${z} bend=${bend}: cross-section ratio ${ratio.toFixed(3)} is not circular`
    );
  }

  // The exact straight baseline must be circular regardless of drift-weight tuning, since bend=0
  // carries no route offset at all.
  const baselineRatio = ringAspect(2000, 300, 0, route.wormholeRouteTurnVisualGain(0));
  assert.ok(Math.abs(baselineRatio - 1) < 0.01, `bend=0 baseline ratio ${baselineRatio.toFixed(4)} must be ~1.0`);
});

test('route sampling cost does not grow with distance (fixed-cost, not O(distance))', () => {
  // A long track used to make sampleWormholeRouteFrame iterate one segment at a time from distance
  // zero, so cost grew linearly with playback position. The fixed-step integrator should cost about
  // the same whether sampling near the start or many hours in.
  const iterations = 20000;
  const timeAt = distance => {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) route.sampleWormholeRouteFrame(distance + i, 0.72);
    return Number(process.hrtime.bigint() - start);
  };
  timeAt(1000); // warm up JIT before measuring
  timeAt(50_000_000);
  const nearNs = timeAt(1000);
  const farNs = timeAt(50_000_000);
  assert.ok(
    farNs < nearNs * 5,
    `sampling near the start took ${nearNs}ns but far into the track took ${farNs}ns -- cost is growing with distance`
  );
});

test('route heading grows through a continuous analytic turn field and position follows the heading integral', () => {
  const ROUTE_ARC_LENGTH = 18000;
  const ROUTE_MAX_HEADING = 0.88;
  const ROUTE_CURVATURE = ROUTE_MAX_HEADING / ROUTE_ARC_LENGTH;
  function expectedHeading(distance, bend) {
    return bend * ROUTE_CURVATURE * Math.max(0, distance);
  }

  for (const bend of [0.15, 0.5, 0.72, 1]) {
    let previousHeading = -Infinity;
    let previousX = -Infinity;
    for (const distance of [0, 1, 1200, 2400, 4800, 9600, 14400, 18000, 24000, 100000]) {
      const actual = frame(distance, bend);
      assert.ok(Math.abs(actual.headingAngle - expectedHeading(distance, bend)) < 1e-12, `heading distance=${distance} bend=${bend}`);
      assert.ok(actual.headingAngle >= previousHeading - 1e-12, `heading regressed distance=${distance} bend=${bend}`);
      assert.ok(actual.positionX >= previousX - 1e-9, `positionX regressed distance=${distance} bend=${bend}`);
      assert.ok(actual.positionY <= distance + 1e-9, `positionY should be integrated through heading distance=${distance} bend=${bend}`);
      previousHeading = actual.headingAngle;
      previousX = actual.positionX;
    }
  }

  const straight = frame(9600, 0);
  const bent = frame(9600, 0.7);
  assert.equal(straight.positionX, 0);
  assert.ok(bent.headingAngle > frame(2400, 0.7).headingAngle * 2.5, 'heading should develop substantially with distance');
  assert.ok(bent.curvature > 0, 'mid-arc curvature should keep one positive sign');
  assert.ok(bent.positionX > 250, `expected meaningful lateral route displacement, got ${bent.positionX}`);
});

test('direct visual turn gain keeps first bend continuous without flattening the morph', () => {
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const distance = 4200;
  const z = 900;
  const radius = 50;
  const theta = 0.35;
  const zeroRoute = route.sampleWormholeRouteFrame(distance + z, 0);
  const zeroBase = route.sampleWormholeRouteFrame(distance, 0);
  const zero = route.projectWormholeTubePoint(
    zeroRoute, zeroBase, z, theta, radius, route.wormholeRouteTurnVisualGain(0), cx, cy, fov
  );
  const tinyBend = 1 / 60;
  const tinyRoute = route.sampleWormholeRouteFrame(distance + z, tinyBend);
  const tinyBase = route.sampleWormholeRouteFrame(distance, tinyBend);
  const tiny = route.projectWormholeTubePoint(
    tinyRoute, tinyBase, z, theta, radius, route.wormholeRouteTurnVisualGain(tinyBend), cx, cy, fov
  );
  const highRoute = route.sampleWormholeRouteFrame(distance + z, 0.72);
  const highBase = route.sampleWormholeRouteFrame(distance, 0.72);
  const high = route.projectWormholeTubePoint(
    highRoute, highBase, z, theta, radius, route.wormholeRouteTurnVisualGain(0.72), cx, cy, fov
  );
  const firstFrameShift = Math.hypot(tiny.screenX - zero.screenX, tiny.screenY - zero.screenY);
  const fullShift = Math.hypot(high.screenX - zero.screenX, high.screenY - zero.screenY);
  const expectedLinearRatio = tinyBend / 0.72;
  const shiftRatio = firstFrameShift / fullShift;
  assert.ok(firstFrameShift < Math.max(2, fullShift * 0.04), `first bend frame jumped ${firstFrameShift}px vs full ${fullShift}px`);
  assert.ok(
    shiftRatio > expectedLinearRatio * 0.45,
    `first bend frame was flattened too much: ratio ${shiftRatio} vs expected ${expectedLinearRatio}`
  );
});

test('curved presets still curve after long playback time', () => {
  const bend = 0.72;
  const late = frame(240000, bend);
  const later = frame(241200, bend);
  const headingDelta = unwrapDelta(late.headingAngle, later.headingAngle);
  assert.ok(late.curvature > 0, `late curvature expired: ${late.curvature}`);
  assert.ok(headingDelta > 0.0001, `late route heading stopped changing: ${headingDelta}`);
  assert.ok(later.positionX > late.positionX, 'late route position should continue following the turn field');
});

test('projected ring center is the route centerline transform, not an independent recentering (AC2/AC3 numeric proof)', () => {
  // Problem 3's target is a physically correct route centerline, not "moved ring centers" for their
  // own sake: this proves the projected ring center *is* the camera-local route-drift delta
  // (`localCenter`, the same quantity the existing "keeps distant centerline near the viewing axis"
  // test already validates in isolation), scaled by the drift weight -- not an independently tuned
  // recentering effect. Averaging screen position over a full circle of theta samples exactly
  // cancels the theta-dependent radial term (its mean over a period is zero), leaving only the
  // theta-independent drift contribution, so the mean IS the projected centerline delta.
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const radius = 50;
  const N = 96;
  const bend = 0.72;
  const driftWeight = route.wormholeRouteTurnVisualGain(bend);

  function ringMeanScreen(distanceNow, z, bend) {
    const routeNow = route.sampleWormholeRouteFrame(distanceNow + z, bend);
    const baseRouteNow = route.sampleWormholeRouteFrame(distanceNow, bend);
    let sumScreenX = 0, sumScreenY = 0;
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const p = route.projectWormholeTubePoint(routeNow, baseRouteNow, z, theta, radius, driftWeight, cx, cy, fov);
      sumScreenX += p.screenX;
      sumScreenY += p.screenY;
    }
    return { x: sumScreenX / N, y: sumScreenY / N };
  }

  function expectedLocalOffset(distanceNow, z, bend) {
    const baseRouteNow = route.sampleWormholeRouteFrame(distanceNow, bend);
    const worldRoute = route.sampleWormholeRouteFrame(distanceNow + z, bend);
    const driftX = worldRoute.positionX - baseRouteNow.positionX;
    const driftY = worldRoute.positionY - baseRouteNow.positionY;
    const localX = (driftX * baseRouteNow.normalX + driftY * baseRouteNow.normalY) * driftWeight;
    const localZ = Math.max(z * 0.68, driftX * baseRouteNow.tangentX + driftY * baseRouteNow.tangentY);
    return { localX, localZ };
  }

  const cases = [[2000, 300], [6000, 300], [15000, 800], [400, 100], [9600, 300], [2000, 900]];
  const centersAtBend = [];
  for (const [distance, z] of cases) {
    const mean = ringMeanScreen(distance, z, bend);
    const expected = expectedLocalOffset(distance, z, bend);
    const measuredLocalX = (mean.x - cx) * expected.localZ / fov;
    const relErr = Math.abs(measuredLocalX - expected.localX) / Math.max(1, Math.abs(expected.localX));
    assert.ok(
      relErr < 0.28,
      `distance=${distance} z=${z}: ring center local offset ${measuredLocalX.toFixed(2)} does not match ` +
      `the visually gained route centerline delta ${expected.localX.toFixed(2)} (rel err ${(relErr * 100).toFixed(1)}%)`
    );
    centersAtBend.push(mean);
  }

  // The centers genuinely differ across depth -- a *consequence* of the physical match just proven
  // (different depths sample different route positions), not a separately tuned behavior.
  let maxPairDistance = 0;
  for (let i = 0; i < centersAtBend.length; i++) {
    for (let j = i + 1; j < centersAtBend.length; j++) {
      maxPairDistance = Math.max(maxPairDistance, Math.hypot(
        centersAtBend[i].x - centersAtBend[j].x, centersAtBend[i].y - centersAtBend[j].y
      ));
    }
  }
  assert.ok(maxPairDistance > 5, `ring centers across depth barely differ (max pair distance ${maxPairDistance.toFixed(2)}px)`);

  // bend = 0 collapses every case back to the exact lens baseline: no route offset at all.
  for (const [distance, z] of cases) {
    const mean = ringMeanScreen(distance, z, 0);
    assert.ok(
      Math.abs(mean.x - cx) < 1e-6 && Math.abs(mean.y - cy) < 1e-6,
      `distance=${distance} z=${z}: bend=0 ring center should be exactly lens-centered, got ${JSON.stringify(mean)}`
    );
  }
});

test('perspective vanishing point stays inside the route rather than drifting off to one side (AC3 numeric proof)', () => {
  // Extends the existing raw-route-delta "keeps distant centerline near the viewing axis" check
  // through the actual projection entry point (`projectWormholeTubePoint`, visually gained drift)
  // instead of the abstract route frame alone -- closing the same kind of implementation gap the
  // AC1 circularity test closed for the cross-section shape. Bend is capped at 0.72, the highest
  // value any shipped wormhole preset actually uses (`vos-wh-spiral.json`).
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const radius = 50;
  const N = 48;
  function ringLocal(distanceNow, z, bend) {
    const routeNow = route.sampleWormholeRouteFrame(distanceNow + z, bend);
    const baseRouteNow = route.sampleWormholeRouteFrame(distanceNow, bend);
    let sumScreenX = 0, sumScreenY = 0;
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const p = route.projectWormholeTubePoint(routeNow, baseRouteNow, z, theta, radius, route.wormholeRouteTurnVisualGain(bend), cx, cy, fov);
      sumScreenX += p.screenX;
      sumScreenY += p.screenY;
    }
    const driftX = routeNow.positionX - baseRouteNow.positionX;
    const driftY = routeNow.positionY - baseRouteNow.positionY;
    const localZ = Math.max(z * 0.68, driftX * baseRouteNow.tangentX + driftY * baseRouteNow.tangentY);
    const localX = (sumScreenX / N - cx) * localZ / fov;
    return { localX, localZ };
  }

  for (const cameraDistance of [0, 1200, 3600, 7350, 12000, 18000]) {
    for (const lookahead of [250, 600, 1000, 1800]) {
      for (const bend of [0.25, 0.5, 0.72]) {
        const { localX, localZ } = ringLocal(cameraDistance, lookahead, bend);
        assert.ok(localZ > lookahead * 0.5, `forward depth collapsed: camera=${cameraDistance} lookahead=${lookahead} bend=${bend}`);
        assert.ok(
          Math.abs(localX / localZ) <= 0.5,
          `vanishing point left the route-local view: camera=${cameraDistance} lookahead=${lookahead} bend=${bend} ratio=${(localX / localZ).toFixed(3)}`
        );
      }
    }
  }
});

test('camera forward equals the route tangent, compared directly (not via a derivative approximation)', () => {
  // The camera's reference frame IS the route frame -- there is no separate "camera" object to keep
  // in sync. This proves it two ways:
  // (1) direct: the real sampled position a tiny step further along the route (not a manual
  //     derivative formula) points, by cosine similarity, in the same direction as the analytic
  //     tangent reported at the starting point;
  // (2) frame identity: the tangent is *exactly* (sin(headingAngle), cos(headingAngle)) by the
  //     integrator's own construction, with zero tolerance.
  // Distances are sampled away from the immediate segment boundary (matching this file's existing
  // "curvature sign does not flip" convention), since the route position is a fixed-step numerical
  // integral of heading rather than a history accumulator.
  const eps = 0.1;
  const segmentLength = 4800;
  for (const bend of [0.15, 0.35, 0.72, 1]) {
    for (let segment = 0; segment < 5; segment++) {
      for (let local = 300; local < segmentLength - 300; local += 300) {
        const distance = segment * segmentLength + local;
        const a = frame(distance, bend);
        const b = frame(distance + eps, bend);

        // (2) frame identity, exact.
        assert.equal(a.tangentX, Math.sin(a.headingAngle), `tangentX identity distance=${distance} bend=${bend}`);
        assert.equal(a.tangentY, Math.cos(a.headingAngle), `tangentY identity distance=${distance} bend=${bend}`);

        // (1) direct secant-vs-tangent alignment.
        const secantX = (b.positionX - a.positionX) / eps;
        const secantY = (b.positionY - a.positionY) / eps;
        const secantLength = Math.hypot(secantX, secantY);
        const cosineSimilarity = (secantX * a.tangentX + secantY * a.tangentY) / secantLength;
        assert.ok(
          cosineSimilarity > 0.9,
          `camera forward diverged from where the route actually goes next: distance=${distance} bend=${bend} cos=${cosineSimilarity.toFixed(4)}`
        );
      }
    }
  }
});
