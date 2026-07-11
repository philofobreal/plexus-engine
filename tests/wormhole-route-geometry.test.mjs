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

test('runtime route steering recentres after spiral instead of preserving its accumulated heading', () => {
  const state = route.createWormholeRouteState();
  route.resetWormholeRouteState(state, 0, 0);

  for (let distance = 90; distance <= 18000; distance += 90) {
    route.advanceWormholeRouteState(state, distance, 0.72);
  }
  const spiralHeading = state.headingAngle;
  assert.ok(spiralHeading > 0.35 && spiralHeading <= 0.72 * 0.88 + 0.02, `spiral heading ${spiralHeading}`);

  let maxHeading = state.headingAngle;
  for (let distance = 18090; distance <= 42000; distance += 90) {
    route.advanceWormholeRouteState(state, distance, 0);
    maxHeading = Math.max(maxHeading, state.headingAngle);
  }

  assert.ok(
    maxHeading <= spiralHeading + 0.02,
    `straight exit overshot ${spiralHeading} -> ${maxHeading}`
  );
  assert.ok(Math.abs(state.headingAngle) < 0.002, `straight preset retained heading ${state.headingAngle}`);
  assert.ok(Math.abs(state.curvature) < 1e-6, `straight preset retained curvature ${state.curvature}`);
  assert.equal(state.targetHeading, 0);
});

test('runtime route retarget publishes look-ahead curvature without moving a paused camera', () => {
  const state = route.createWormholeRouteState();
  route.resetWormholeRouteState(state, 5000, 0);
  const before = { x: state.positionX, y: state.positionY, heading: state.headingAngle };
  route.advanceWormholeRouteState(state, 5000, 0.72);

  assert.deepEqual(
    { x: state.positionX, y: state.positionY, heading: state.headingAngle },
    before,
    'retargeting at a stationary song position must not teleport the camera'
  );
  assert.ok(state.curvature > 0, 'forward route samples must see the new authored turn immediately');
});

test('runtime route curvature stays frame-continuous while a spiral bend morphs to straight', () => {
  const ROUTE_CURVATURE = 0.88 / 18000;
  const ROUTE_COUNTER_EASE_DISTANCE = 180;
  const STEP_DISTANCE = 4;
  const GLIDE_PER_FRAME = 1 - Math.exp(-(1 / 60) / 0.45);
  const maxCurvatureDelta = ROUTE_CURVATURE
    * (1 - Math.exp(-STEP_DISTANCE / ROUTE_COUNTER_EASE_DISTANCE))
    + 1e-9;
  const state = route.createWormholeRouteState();
  route.resetWormholeRouteState(state, 0, 0.72);

  let distance = 0;
  for (let frameIndex = 0; frameIndex < 30; frameIndex++) {
    distance += STEP_DISTANCE;
    route.advanceWormholeRouteState(state, distance, 0.72);
  }

  let bend = 0.72;
  let previousCurvature = state.curvature;
  let previousTurnIntensity = state.turnIntensity;
  for (let frameIndex = 0; frameIndex < 600; frameIndex++) {
    bend += (0 - bend) * GLIDE_PER_FRAME;
    distance += STEP_DISTANCE;
    route.advanceWormholeRouteState(state, distance, bend);

    const curvatureDelta = Math.abs(state.curvature - previousCurvature);
    const turnIntensityDelta = Math.abs(state.turnIntensity - previousTurnIntensity);
    const targetHeading = bend * 0.88;
    assert.ok(
      curvatureDelta <= maxCurvatureDelta,
      `frame ${frameIndex} curvature jumped ${curvatureDelta} above ${maxCurvatureDelta}`
    );
    assert.ok(
      turnIntensityDelta <= 0.05,
      `frame ${frameIndex} turn intensity jumped ${turnIntensityDelta}`
    );
    assert.ok(
      state.headingAngle <= targetHeading + 0.02,
      `frame ${frameIndex} heading ${state.headingAngle} overshot target ${targetHeading}`
    );

    previousCurvature = state.curvature;
    previousTurnIntensity = state.turnIntensity;
  }
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

test('Task04: converged seek reset matches long stable playthrough at the same (distance, bend)', () => {
  // Task 04: resetWormholeRouteStateConverged must reconstruct the state a long constant-bend
  // playthrough would already be in, instead of the always-heading-0 straight baseline
  // resetWormholeRouteState uses. Compare it against an actual integrated playthrough from d=0.
  function playthroughState(targetDistance, bend, stepDistance) {
    const state = route.createWormholeRouteState();
    route.resetWormholeRouteState(state, 0, bend);
    for (let distance = stepDistance; distance < targetDistance; distance += stepDistance) {
      route.advanceWormholeRouteState(state, distance, bend);
    }
    route.advanceWormholeRouteState(state, targetDistance, bend);
    return state;
  }

  // Converged case: D=25000 is well past ROUTE_ARC_LENGTH (18000), so a constant-bend playthrough
  // has already reached the bounded authored heading and curvature has settled to zero.
  {
    const bend = 0.72;
    const D = 25000;
    const played = playthroughState(D, bend, 25);
    const converged = route.resetWormholeRouteStateConverged(route.createWormholeRouteState(), D, bend);
    const headingDelta = Math.abs(played.headingAngle - converged.headingAngle);
    assert.ok(headingDelta <= 0.05, `converged heading delta ${headingDelta} exceeded 0.05 rad`);
    assert.ok(Math.abs(played.curvature) < 1e-3, `playthrough curvature ${played.curvature} should be ~0 at D=${D}`);
    assert.ok(Math.abs(converged.curvature) < 1e-9, `converged curvature ${converged.curvature} should be ~0 at D=${D}`);
  }

  // bend=0: both playthrough and converged reset must give an exact straight baseline.
  {
    const bend = 0;
    const D = 25000;
    const played = playthroughState(D, bend, 25);
    const converged = route.resetWormholeRouteStateConverged(route.createWormholeRouteState(), D, bend);
    assert.equal(played.headingAngle, 0);
    assert.equal(converged.headingAngle, 0);
    assert.equal(converged.curvature, 0);
  }

  // Pre-convergence case: D=2000 is well before ROUTE_ARC_LENGTH, so the steering-response delay
  // (ROUTE_CURVATURE_EASE_DISTANCE) still separates the two; a looser, documented tolerance applies.
  {
    const bend = 0.72;
    const D = 2000;
    const played = playthroughState(D, bend, 10);
    const converged = route.resetWormholeRouteStateConverged(route.createWormholeRouteState(), D, bend);
    const headingDelta = Math.abs(played.headingAngle - converged.headingAngle);
    console.log(`[Task04] pre-convergence heading delta at D=${D}, bend=${bend}: ${headingDelta.toFixed(6)} rad`);
    assert.ok(headingDelta <= 0.08, `pre-convergence heading delta ${headingDelta} exceeded 0.08 rad`);
  }
});

test('Task04: converged seek reset is a pure O(1) function of (distance, bend), not history-dependent', () => {
  const state = route.createWormholeRouteState();
  const a = { ...route.resetWormholeRouteStateConverged(state, 12000, 0.5) };
  // Perturb the state with unrelated calls, then reset again at the same (distance, bend): result
  // must be identical, proving there is no hidden dependency on prior state or call order.
  route.resetWormholeRouteStateConverged(state, 90000, 0.2);
  route.advanceWormholeRouteState(state, 90050, 1);
  const b = { ...route.resetWormholeRouteStateConverged(state, 12000, 0.5) };
  for (const key of FRAME_COMPONENTS) {
    assert.equal(b[key], a[key], `${key} differed across repeated converged resets at the same (distance, bend)`);
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

// --- Task 07: signed (left/right) path bend --------------------------------------------------

/**
 * `assert.equal` (from `node:assert/strict`) uses SameValue (`Object.is`), which distinguishes
 * `+0` from `-0`. Several mirror-symmetric quantities are legitimately `-0` on one side of the
 * mirror (e.g. `(-amount) * ROUTE_CURVATURE * 0 === -0`) while their physical value is exactly
 * zero either way, so mirror checks use plain `===` (SameValueZero for numbers) instead.
 */
function assertMirror(actual, expected, message) {
  assert.ok(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

test('signed bend: pure route sampler is exactly mirror-symmetric across bend sign', () => {
  for (const bend of [0.03, 0.16, 0.35, 0.72, 1]) {
    for (const distance of [0, 1, 125, 2000, 7345, 18000, 30000, 100000]) {
      const pos = frame(distance, bend);
      const neg = frame(distance, -bend);
      assertMirror(neg.positionX, -pos.positionX, `positionX mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.positionY, pos.positionY, `positionY mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.headingAngle, -pos.headingAngle, `headingAngle mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.curvature, -pos.curvature, `curvature mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.turnIntensity, pos.turnIntensity, `turnIntensity mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.tangentX, -pos.tangentX, `tangentX mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.tangentY, pos.tangentY, `tangentY mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.normalX, pos.normalX, `normalX mirror distance=${distance} bend=${bend}`);
      assertMirror(neg.normalY, -pos.normalY, `normalY mirror distance=${distance} bend=${bend}`);
    }
  }
});

test('signed bend: legacy offset samplers are exactly mirror-symmetric across bend sign', () => {
  for (const bend of [0.16, 0.72, 1]) {
    for (const distance of [125, 2000, 18000]) {
      for (const depthT of [0, 0.5, 1]) {
        const pos = route.sampleWormholeRoute(distance, depthT, bend);
        const neg = route.sampleWormholeRoute(distance, depthT, -bend);
        assertMirror(neg.offsetX, -pos.offsetX, `offsetX mirror distance=${distance} depthT=${depthT} bend=${bend}`);
        assertMirror(neg.offsetY, pos.offsetY, `offsetY mirror distance=${distance} depthT=${depthT} bend=${bend}`);
        assertMirror(neg.tangentX, -pos.tangentX, `tangentX mirror distance=${distance} depthT=${depthT} bend=${bend}`);
        assertMirror(neg.tangentY, pos.tangentY, `tangentY mirror distance=${distance} depthT=${depthT} bend=${bend}`);
      }
      const posBg = route.sampleWormholeBackgroundRoute(distance, bend);
      const negBg = route.sampleWormholeBackgroundRoute(distance, -bend);
      assertMirror(negBg.offsetX, -posBg.offsetX, `background offsetX mirror distance=${distance} bend=${bend}`);
      assertMirror(negBg.offsetY, posBg.offsetY, `background offsetY mirror distance=${distance} bend=${bend}`);
    }
  }
});

test('signed bend: runtime steering integrator advance sequence is exactly mirror-symmetric', () => {
  for (const bend of [0.16, 0.42, 0.72, 1]) {
    const positive = route.createWormholeRouteState();
    const negative = route.createWormholeRouteState();
    route.resetWormholeRouteState(positive, 0, bend);
    route.resetWormholeRouteState(negative, 0, -bend);

    for (let distance = 90; distance <= 24000; distance += 90) {
      route.advanceWormholeRouteState(positive, distance, bend);
      route.advanceWormholeRouteState(negative, distance, -bend);
      assertMirror(negative.headingAngle, -positive.headingAngle, `headingAngle mirror distance=${distance} bend=${bend}`);
      assertMirror(negative.curvature, -positive.curvature, `curvature mirror distance=${distance} bend=${bend}`);
      assertMirror(negative.positionX, -positive.positionX, `positionX mirror distance=${distance} bend=${bend}`);
      assertMirror(negative.positionY, positive.positionY, `positionY mirror distance=${distance} bend=${bend}`);
      assertMirror(negative.turnIntensity, positive.turnIntensity, `turnIntensity mirror distance=${distance} bend=${bend}`);
    }

    // Exit back toward straight: the recentring path must mirror too.
    for (let distance = 24090; distance <= 42000; distance += 90) {
      route.advanceWormholeRouteState(positive, distance, 0);
      route.advanceWormholeRouteState(negative, distance, 0);
      assertMirror(negative.headingAngle, -positive.headingAngle, `exit headingAngle mirror distance=${distance} bend=${bend}`);
      assertMirror(negative.curvature, -positive.curvature, `exit curvature mirror distance=${distance} bend=${bend}`);
    }
  }
});

test('signed bend: look-ahead sampling from a live steering state is exactly mirror-symmetric', () => {
  for (const bend of [0.16, 0.72]) {
    const positive = route.createWormholeRouteState();
    const negative = route.createWormholeRouteState();
    route.resetWormholeRouteState(positive, 0, bend);
    route.resetWormholeRouteState(negative, 0, -bend);
    for (let distance = 60; distance <= 6000; distance += 60) {
      route.advanceWormholeRouteState(positive, distance, bend);
      route.advanceWormholeRouteState(negative, distance, -bend);
    }
    for (const lookahead of [0, 250, 900, 4000, 12000]) {
      const posLook = route.sampleWormholeRouteStateFrame(positive, positive.distance + lookahead);
      const negLook = route.sampleWormholeRouteStateFrame(negative, negative.distance + lookahead);
      assertMirror(negLook.headingAngle, -posLook.headingAngle, `look-ahead headingAngle mirror lookahead=${lookahead} bend=${bend}`);
      assertMirror(negLook.positionX, -posLook.positionX, `look-ahead positionX mirror lookahead=${lookahead} bend=${bend}`);
      assertMirror(negLook.positionY, posLook.positionY, `look-ahead positionY mirror lookahead=${lookahead} bend=${bend}`);
    }
  }
});

test('signed bend: resetWormholeRouteStateConverged is exactly mirror-symmetric', () => {
  for (const bend of [0.16, 0.42, 0.72, 1]) {
    for (const distance of [0, 2000, 12000, 25000]) {
      const positive = route.resetWormholeRouteStateConverged(route.createWormholeRouteState(), distance, bend);
      const negative = route.resetWormholeRouteStateConverged(route.createWormholeRouteState(), distance, -bend);
      assertMirror(negative.headingAngle, -positive.headingAngle, `converged headingAngle mirror distance=${distance} bend=${bend}`);
      assertMirror(negative.curvature, -positive.curvature, `converged curvature mirror distance=${distance} bend=${bend}`);
      assertMirror(negative.turnIntensity, positive.turnIntensity, `converged turnIntensity mirror distance=${distance} bend=${bend}`);
    }
  }
});

test('signed bend: key route invariants (continuity, normalization, baseline, convergence) hold for negative bends', () => {
  // Continuous heading (same tolerance as the positive-bend "heading is continuous" test above).
  for (const bend of [-1, -0.72, -0.2]) {
    let previous = frame(0, bend);
    let maxDelta = 0;
    for (let distance = 75; distance <= 30000; distance += 75) {
      const current = frame(distance, bend);
      maxDelta = Math.max(maxDelta, Math.abs(unwrapDelta(previous.headingAngle, current.headingAngle)));
      previous = current;
    }
    assert.ok(maxDelta <= 0.04, `negative bend=${bend} max heading step ${maxDelta}`);
  }

  // Normalized tangent/normal.
  for (const bend of [-1, -0.72, -0.2]) {
    for (let distance = 0; distance <= 30000; distance += 750) {
      const sample = frame(distance, bend);
      assert.ok(Math.abs(Math.hypot(sample.tangentX, sample.tangentY) - 1) <= 1e-12);
      assert.ok(Math.abs(Math.hypot(sample.normalX, sample.normalY) - 1) <= 1e-12);
      assert.ok(Math.abs(sample.tangentX * sample.normalX + sample.tangentY * sample.normalY) <= 1e-12);
    }
  }

  // Zero-bend baseline is unaffected by an intervening negative-bend sample.
  {
    const reused = {
      positionX: 12, positionY: -4, tangentX: 1, tangentY: 0,
      normalX: 0, normalY: 1, headingAngle: 9, curvature: 3, turnIntensity: 2
    };
    frame(7000, -0.72);
    const actual = frame(4200, 0, reused);
    assert.equal(actual.positionX, 0);
    assert.equal(actual.positionY, 4200);
    assert.equal(actual.headingAngle, 0);
    assert.equal(actual.curvature, 0);
    assert.equal(actual.turnIntensity, 0);
  }

  // Converged seek reset matches a long stable negative-bend playthrough (mirrors the existing
  // Task04 positive-bend convergence check).
  {
    const bend = -0.72;
    const D = 25000;
    const state = route.createWormholeRouteState();
    route.resetWormholeRouteState(state, 0, bend);
    for (let distance = 25; distance < D; distance += 25) {
      route.advanceWormholeRouteState(state, distance, bend);
    }
    route.advanceWormholeRouteState(state, D, bend);
    const converged = route.resetWormholeRouteStateConverged(route.createWormholeRouteState(), D, bend);
    const headingDelta = Math.abs(state.headingAngle - converged.headingAngle);
    assert.ok(headingDelta <= 0.05, `negative-bend converged heading delta ${headingDelta} exceeded 0.05 rad`);
    assert.ok(Math.abs(converged.curvature) < 1e-9, `negative-bend converged curvature ${converged.curvature} should be ~0 at D=${D}`);
  }
});

test('backward compatibility: clampSignedUnit(0.7) === 0.7 and [0,1]-range route frames are bitwise unchanged from the pre-signed-bend fixture', () => {
  assert.equal(route.clampSignedUnit(0.7), 0.7);
  assert.equal(route.clampSignedUnit(1), 1);
  assert.equal(route.clampSignedUnit(0), 0);

  // Captured from `sampleWormholeRouteFrame` before clamp01 was replaced with clampSignedUnit on
  // the bend path (Task 07). Every (distance, bend) pair here uses a bend already inside [0, 1], so
  // the signed clamp must reproduce these values exactly.
  const FIXTURE = [
    { d: 0, b: 0, frame: { positionX: 0, positionY: 0, tangentX: 0, tangentY: 1, normalX: 1, normalY: 0, headingAngle: 0, curvature: 0, turnIntensity: 0 } },
    { d: 0, b: 0.2, frame: { positionX: 0, positionY: 0, tangentX: 0, tangentY: 1, normalX: 1, normalY: 0, headingAngle: 0, curvature: 0, turnIntensity: 0 } },
    { d: 0, b: 0.72, frame: { positionX: 0, positionY: 0, tangentX: 0, tangentY: 1, normalX: 1, normalY: 0, headingAngle: 0, curvature: 0, turnIntensity: 0 } },
    { d: 0, b: 1, frame: { positionX: 0, positionY: 0, tangentX: 0, tangentY: 1, normalX: 1, normalY: 0, headingAngle: 0, curvature: 0, turnIntensity: 0 } },
    { d: 125, b: 0.2, frame: { positionX: 0.07638887938108609, positionY: 124.99996887860316, tangentX: 0.0012222219179241199, tangentY: 0.9999992530865127, normalX: 0.9999992530865127, normalY: -0.0012222219179241199, headingAngle: 0.0012222222222222224, curvature: 0.000009777777777777779, turnIntensity: 0.00002880122599451303 } },
    { d: 125, b: 0.72, frame: { positionX: 0.27499955633376993, positionY: 124.9995966670571, tangentX: 0.00439998580268041, tangentY: 0.999990320015617, normalX: 0.999990320015617, normalY: -0.00439998580268041, headingAngle: 0.0044, curvature: 0.0000352, turnIntensity: 0.0001036844135802469 } },
    { d: 125, b: 1, frame: { positionX: 0.38194325578187116, positionY: 124.99922196647339, tangentX: 0.006111073073916477, tangentY: 0.9999813272186062, normalX: 0.9999813272186062, normalY: -0.006111073073916477, headingAngle: 0.006111111111111111, curvature: 0.00004888888888888889, turnIntensity: 0.00014400612997256514 } },
    { d: 2000, b: 0.2, frame: { positionX: 19.554932360944672, positionY: 1999.8725291863636, tangentX: 0.01955430917426667, tangentY: 0.9998087962169152, normalX: 0.9998087962169152, normalY: -0.01955430917426667, headingAngle: 0.01955555555555556, curvature: 0.000009777777777777779, turnIntensity: 0.006858710562414265 } },
    { d: 2000, b: 0.5, frame: { positionX: 48.87915212464183, positionY: 1999.2033873871542, tangentX: 0.04886941613613044, tangentY: 0.9988051762813976, normalX: 0.9988051762813976, normalY: -0.04886941613613044, headingAngle: 0.04888888888888889, curvature: 0.000024444444444444445, turnIntensity: 0.017146776406035662 } },
    { d: 2000, b: 0.72, frame: { positionX: 70.37092866444158, positionY: 1998.3483560103925, tangentX: 0.07034186213156582, tangentY: 0.9975229433110117, normalX: 0.9975229433110117, normalY: -0.07034186213156582, headingAngle: 0.0704, curvature: 0.0000352, turnIntensity: 0.024691358024691353 } },
    { d: 2000, b: 1, frame: { positionX: 97.69990227898519, positionY: 1996.8146917615936, tangentX: 0.09762205159723347, tangentY: 0.9952235603330274, normalX: 0.9952235603330274, normalY: -0.09762205159723347, headingAngle: 0.09777777777777778, curvature: 0.00004888888888888889, turnIntensity: 0.034293552812071325 } },
    { d: 7345, b: 0.35, frame: { positionX: 460.95663837584937, positionY: 7325.678645618463, tangentX: 0.12535050126947148, tangentY: 0.9921125197433466, normalX: 0.9921125197433466, normalY: -0.12535050126947148, headingAngle: 0.1256811111111111, curvature: 0.000017111111111111112, turnIntensity: 0.12727326139617628 } },
    { d: 7345, b: 0.72, frame: { positionX: 944.2254845583844, positionY: 7263.443638750808, tangentX: 0.25567321608402843, tangentY: 0.9667632629435449, normalX: 0.9667632629435449, normalY: -0.25567321608402843, headingAngle: 0.258544, curvature: 0.0000352, turnIntensity: 0.2618192805864198 } },
    { d: 7345, b: 1, frame: { positionX: 1304.644169726644, positionY: 7188.164615098976, tangentX: 0.3514213811826166, tangentY: 0.9362173961466974, normalX: 0.9362173961466974, normalY: -0.3514213811826166, headingAngle: 0.3590888888888889, curvature: 0.00004888888888888889, turnIntensity: 0.3636378897033608 } },
    { d: 18000, b: 0.72, frame: { positionX: 5514.16602976854, positionY: 16819.597529405313, tangentX: 0.5920498330350671, tangentY: 0.8059013557521474, normalX: 0.8059013557521474, normalY: -0.5920498330350671, headingAngle: 0.6336, curvature: 0.0000352, turnIntensity: 0.72 } },
    { d: 18000, b: 1, frame: { positionX: 7421.90841411995, positionY: 15765.113432024371, tangentX: 0.7707388788989693, tangentY: 0.6371511441985802, normalX: 0.6371511441985802, normalY: -0.7707388788989693, headingAngle: 0.88, curvature: 0.00004888888888888889, turnIntensity: 1 } },
    { d: 30000, b: 0.2, frame: { positionX: 4368.540720477919, positionY: 29571.624901990257, tangentX: 0.2891447768194603, tangentY: 0.9572853796219937, normalX: 0.9572853796219937, normalY: -0.2891447768194603, headingAngle: 0.29333333333333333, curvature: 0.000009777777777777779, turnIntensity: 0.2 } },
    { d: 30000, b: 0.72, frame: { positionX: 14421.65955927984, positionY: 24727.074443114256, tangentX: 0.8703930203976219, tangentY: 0.4923575835133495, normalX: 0.4923575835133495, normalY: -0.8703930203976219, headingAngle: 1.056, curvature: 0.0000352, turnIntensity: 0.72 } },
    { d: 30000, b: 1, frame: { positionX: 18328.467626317826, positionY: 20343.751444126152, tangentX: 0.9945834039350564, tangentY: 0.10394158271335074, normalX: 0.10394158271335074, normalY: -0.9945834039350564, headingAngle: 1.4666666666666668, curvature: 0.00004888888888888889, turnIntensity: 1 } },
    { d: 100000, b: 0.72, frame: { positionX: 54808.35810636714, positionY: -10495.481776831735, tangentX: -0.3694409585444771, tangentY: -0.9292542053441233, normalX: -0.9292542053441233, normalY: 0.3694409585444771, headingAngle: 3.52, curvature: 0.0000352, turnIntensity: 0.72 } }
  ];

  for (const { d, b, frame: expected } of FIXTURE) {
    assertFrameEqual(route.sampleWormholeRouteFrame(d, b), expected, `fixture d=${d} b=${b}`);
  }
});

// --- Task 08: vertical bend component (diagonal turn, no camera roll) -------------------------

// Field-wise comparison instead of assert.deepEqual: the route module is loaded into its own vm
// context/realm, so plain object literals it returns have a different [[Prototype]] than object
// literals created in this file, which deepStrictEqual (correctly) treats as unequal.
function assertBendPair(actual, expectedH, expectedV, message) {
  assert.equal(actual.bendH, expectedH, `${message}: bendH`);
  assert.equal(actual.bendV, expectedV, `${message}: bendV`);
}

test('Task08: combinedWormholePathBend clamps each axis independently and only scales down past unit magnitude', () => {
  // Inside the unit circle: each axis passes through clampSignedUnit unchanged.
  assertBendPair(route.combinedWormholePathBend(0.3, 0.4), 0.3, 0.4, 'inside unit circle');
  assertBendPair(route.combinedWormholePathBend(0, 0), 0, 0, 'zero');
  assertBendPair(route.combinedWormholePathBend(1, 0), 1, 0, 'horizontal only');
  assertBendPair(route.combinedWormholePathBend(0, -1), 0, -1, 'vertical only');
  // Exactly on the unit circle: untouched (hypot(0.6, 0.8) === 1).
  assertBendPair(route.combinedWormholePathBend(0.6, 0.8), 0.6, 0.8, 'on unit circle');

  // Past the unit circle: both components are scaled down by the same factor so the combined
  // magnitude is exactly 1, preserving direction.
  const { bendH, bendV } = route.combinedWormholePathBend(0.9, 0.9);
  assert.ok(Math.abs(Math.hypot(bendH, bendV) - 1) < 1e-12, `combined magnitude ${Math.hypot(bendH, bendV)} must clamp to 1`);
  assert.ok(Math.abs(bendH - bendV) < 1e-12, 'equal inputs must stay equal after proportional scaling');
  assert.ok(Math.abs(bendH / bendV - 0.9 / 0.9) < 1e-9);

  // Out-of-range raw inputs are clamped to [-1, 1] per axis first, then combined.
  const overRange = route.combinedWormholePathBend(5, -5);
  assert.ok(Math.abs(Math.hypot(overRange.bendH, overRange.bendV) - 1) < 1e-12);
  assert.ok(overRange.bendH > 0 && overRange.bendV < 0);

  // Mirror symmetry: negating either input negates only that output component.
  for (const [h, v] of [[0.2, 0.7], [0.9, 0.6], [1, 1]]) {
    const base = route.combinedWormholePathBend(h, v);
    const negH = route.combinedWormholePathBend(-h, v);
    const negV = route.combinedWormholePathBend(h, -v);
    assert.ok(Math.abs(negH.bendH + base.bendH) < 1e-12);
    assert.ok(Math.abs(negH.bendV - base.bendV) < 1e-12);
    assert.ok(Math.abs(negV.bendH - base.bendH) < 1e-12);
    assert.ok(Math.abs(negV.bendV + base.bendV) < 1e-12);
  }
});

test('Task08: projectWormholeTubePoint verticalDrift defaults to zero (bit-identical to the pre-Task-08 call signature)', () => {
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const routeNow = route.sampleWormholeRouteFrame(4200, 0.5);
  const baseRouteNow = route.sampleWormholeRouteFrame(3900, 0.5);
  const withoutArg = route.projectWormholeTubePoint(routeNow, baseRouteNow, 300, 0.7, 50, 4, cx, cy, fov);
  const withExplicitZero = route.projectWormholeTubePoint(routeNow, baseRouteNow, 300, 0.7, 50, 4, cx, cy, fov, 0);
  assert.deepEqual(withoutArg, withExplicitZero);
});

test('Task08: verticalDrift is exactly mirror-symmetric and never rotates the cross-section (moves localY only)', () => {
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const routeNow = route.sampleWormholeRouteFrame(4200, 0.3);
  const baseRouteNow = route.sampleWormholeRouteFrame(3900, 0.3);
  const driftWeight = route.wormholeRouteTurnVisualGain(0.3);
  for (const theta of [0, 0.6, Math.PI / 2, 2.1, Math.PI, 4.4]) {
    const zero = route.projectWormholeTubePoint(routeNow, baseRouteNow, 300, theta, 50, driftWeight, cx, cy, fov, 0);
    const positive = route.projectWormholeTubePoint(routeNow, baseRouteNow, 300, theta, 50, driftWeight, cx, cy, fov, 40);
    const negative = route.projectWormholeTubePoint(routeNow, baseRouteNow, 300, theta, 50, driftWeight, cx, cy, fov, -40);
    // X is untouched by vertical drift: it depends only on the (unchanged) horizontal route/radial terms.
    assert.ok(Math.abs(positive.screenX - zero.screenX) < 1e-9, `theta=${theta} verticalDrift leaked into screenX`);
    assert.ok(Math.abs(negative.screenX - zero.screenX) < 1e-9, `theta=${theta} verticalDrift leaked into screenX`);
    // Y moves by a symmetric, nonzero amount in each direction.
    const upDelta = positive.screenY - zero.screenY;
    const downDelta = negative.screenY - zero.screenY;
    assert.ok(Math.abs(upDelta) > 1e-6, `theta=${theta} vertical drift had no measurable Y effect`);
    assert.ok(Math.abs(upDelta + downDelta) < 1e-9, `theta=${theta} vertical drift is not mirror-symmetric: +${upDelta} vs ${downDelta}`);
  }
});

test('Task08: combined diagonal bend keeps the projected tube cross-section circular (AC1 extension)', () => {
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const radius = 50;
  const N = 48;
  function ringAspect(distanceNow, z, bendH, bendV) {
    const { bendH: h, bendV: v } = route.combinedWormholePathBend(bendH, bendV);
    const routeNow = route.sampleWormholeRouteFrame(distanceNow + z, h);
    const baseRouteNow = route.sampleWormholeRouteFrame(distanceNow, h);
    const routeNowV = route.sampleWormholeRouteFrame(distanceNow + z, v);
    const baseRouteNowV = route.sampleWormholeRouteFrame(distanceNow, v);
    const verticalDrift = routeNowV.positionX - baseRouteNowV.positionX;
    const driftWeight = route.wormholeRouteTurnVisualGain(1);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const p = route.projectWormholeTubePoint(
        routeNow, baseRouteNow, z, theta, radius, driftWeight, cx, cy, fov, verticalDrift
      );
      minX = Math.min(minX, p.screenX); maxX = Math.max(maxX, p.screenX);
      minY = Math.min(minY, p.screenY); maxY = Math.max(maxY, p.screenY);
    }
    return (maxX - minX) / (maxY - minY);
  }

  const cases = [
    [2000, 300, 0.5, 0.5], [2000, 300, 0.5, -0.5], [6000, 300, 0.72, 0.3],
    [400, 100, 0.6, 0.6], [15000, 800, 0.5, 0.5], [9600, 1500, 0.8, 0.8]
  ];
  for (const [distance, z, bendH, bendV] of cases) {
    const ratio = ringAspect(distance, z, bendH, bendV);
    assert.ok(
      ratio > 0.8 && ratio < 1.25,
      `distance=${distance} z=${z} bendH=${bendH} bendV=${bendV}: cross-section ratio ${ratio.toFixed(3)} is not circular`
    );
  }

  // bendV=0 must reproduce the plain horizontal-only AC1 baseline exactly (verticalDrift is 0).
  const straightVerticalRatio = ringAspect(2000, 300, 0.5, 0);
  const withoutVertical = (() => {
    const routeNow = route.sampleWormholeRouteFrame(2300, 0.5);
    const baseRouteNow = route.sampleWormholeRouteFrame(2000, 0.5);
    const driftWeight = route.wormholeRouteTurnVisualGain(1);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const p = route.projectWormholeTubePoint(routeNow, baseRouteNow, 300, theta, radius, driftWeight, cx, cy, fov);
      minX = Math.min(minX, p.screenX); maxX = Math.max(maxX, p.screenX);
      minY = Math.min(minY, p.screenY); maxY = Math.max(maxY, p.screenY);
    }
    return (maxX - minX) / (maxY - minY);
  })();
  assert.ok(Math.abs(straightVerticalRatio - withoutVertical) < 1e-9, 'bendV=0 must match the no-vertical-drift baseline exactly');
});
