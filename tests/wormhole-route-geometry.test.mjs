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

const COMPONENTS = ['offsetX', 'offsetY', 'tangentX', 'tangentY'];
const BENDS = [0.2, 0.58, 0.72, 1];

function assertSampleEqual(actual, expected, message) {
  for (const key of COMPONENTS) {
    assert.equal(actual[key], expected[key], `${message}: ${key}`);
  }
}

test('bend zero is a literal positive-zero straight route for fresh and reused outputs', () => {
  const reused = { offsetX: 1, offsetY: -1, tangentX: 1, tangentY: -1 };
  for (const sampler of [route.sampleWormholeRoute, route.sampleWormholeBackgroundRoute]) {
    const actual = sampler === route.sampleWormholeRoute
      ? sampler(7345, 0.5, 0, reused)
      : sampler(7345, 0, reused);
    for (const key of COMPONENTS) {
      assert.equal(actual[key], 0, key);
      assert.equal(Object.is(actual[key], -0), false, `${key} must be positive zero`);
    }
  }
});

test('bend changes route amplitude only, never centreline topology or tangent cadence', () => {
  for (let distance = 0; distance <= 30000; distance += 125) {
    const canonical = route.sampleWormholeBackgroundRoute(distance, 1);
    for (const bend of BENDS) {
      const sample = route.sampleWormholeBackgroundRoute(distance, bend);
      for (const key of COMPONENTS) {
        assert.ok(
          Math.abs(sample[key] / bend - canonical[key]) <= 1e-12,
          `distance=${distance}, bend=${bend}, component=${key}`
        );
      }
    }
  }
});

test('foreground depth scales one shared centreline without creating local S-turns', () => {
  const distance = 7350;
  const bend = 0.72;
  const canonical = route.sampleWormholeBackgroundRoute(distance, bend);
  const canonicalOffsetLength = Math.hypot(canonical.offsetX, canonical.offsetY);
  const canonicalTangentLength = Math.hypot(canonical.tangentX, canonical.tangentY);
  assert.ok(canonicalOffsetLength > 0.01);
  assert.ok(canonicalTangentLength > 0.01);

  for (const depth of [0, 0.12, 0.35, 0.5, 0.76, 1]) {
    const sample = route.sampleWormholeRoute(distance, depth, bend);
    const offsetLength = Math.hypot(sample.offsetX, sample.offsetY);
    const tangentLength = Math.hypot(sample.tangentX, sample.tangentY);
    assert.ok(offsetLength > 0.01, `depth=${depth} collapsed the shared centreline`);
    assert.ok(tangentLength > 0.01, `depth=${depth} collapsed the shared tangent`);

    const offsetCross = canonical.offsetX * sample.offsetY - canonical.offsetY * sample.offsetX;
    const tangentCross = canonical.tangentX * sample.tangentY - canonical.tangentY * sample.tangentX;
    assert.ok(
      Math.abs(offsetCross) <= 1e-12 * canonicalOffsetLength * offsetLength,
      `depth=${depth} changed centreline direction`
    );
    assert.ok(
      Math.abs(tangentCross) <= 1e-12 * canonicalTangentLength * tangentLength,
      `depth=${depth} changed tangent direction`
    );
  }
});

test('arc route has no hashed cell targets and bend is not distance-derived', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(source, /PATH_CELL|cellLength|routeCellTarget|routeCellSlope|pseudoNoise\([^)]*routeDistance/);
  assert.match(source, /const ARC_RADIUS = 9000;/);
  assert.match(source, /const theta = distance \/ ARC_RADIUS;/);
});

function headingAt(distance, bend) {
  const sample = route.sampleWormholeBackgroundRoute(distance, bend);
  return Math.atan2(sample.tangentY, sample.tangentX);
}

function angularDelta(a, b) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

function maxHeadingDeltaPer1000(bend) {
  let maxDelta = 0;
  for (let distance = 0; distance <= 30000; distance += 125) {
    maxDelta = Math.max(maxDelta, angularDelta(headingAt(distance, bend), headingAt(distance + 1000, bend)));
  }
  return maxDelta;
}

function tangentDirectionChanges(bend) {
  let changes = 0;
  let previousSign = 0;
  for (let distance = 0; distance <= 30000; distance += 125) {
    const sample = route.sampleWormholeBackgroundRoute(distance, bend);
    const sign = Math.sign(sample.tangentX) || previousSign;
    if (previousSign && sign && sign !== previousSign) changes++;
    previousSign = sign;
  }
  return changes;
}

test('higher bend does not increase route heading cadence', () => {
  const low = maxHeadingDeltaPer1000(0.2);
  const high = maxHeadingDeltaPer1000(0.72);
  assert.ok(low <= Math.PI, `low bend heading delta ${low}`);
  assert.ok(high <= Math.PI, `high bend heading delta ${high}`);
  assert.ok(Math.abs(high - low) <= 1e-12, `bend changed heading cadence: low=${low}, high=${high}`);
  assert.ok(tangentDirectionChanges(0.72) <= tangentDirectionChanges(0.2));
});

function curvatureSignsOverVisibleDepth(startDistance, bend) {
  const signs = [];
  let previous = route.sampleWormholeBackgroundRoute(startDistance, bend);
  let current = route.sampleWormholeBackgroundRoute(startDistance + 250, bend);
  for (let distance = startDistance + 500; distance <= startDistance + 5000; distance += 250) {
    const next = route.sampleWormholeBackgroundRoute(distance, bend);
    const ax = next.offsetX - 2 * current.offsetX + previous.offsetX;
    const ay = next.offsetY - 2 * current.offsetY + previous.offsetY;
    const cross = current.tangentX * ay - current.tangentY * ax;
    const sign = Math.sign(cross);
    if (sign) signs.push(sign);
    previous = current;
    current = next;
  }
  return signs;
}

test('arc route has at most one curvature-sign change across a visible depth span', () => {
  for (const start of [0, 2500, 5000, 9000, 14000]) {
    const signs = curvatureSignsOverVisibleDepth(start, 0.72);
    let changes = 0;
    for (let i = 1; i < signs.length; i++) {
      if (signs[i] !== signs[i - 1]) changes++;
    }
    assert.ok(changes <= 1, `start=${start} changed curvature sign ${changes} times`);
  }
});

test('background viewer heading is tangent-correlated with the same canonical route', () => {
  for (const distance of [0, 1250, 5000, 9000, 16000]) {
    const canonical = route.sampleWormholeBackgroundRoute(distance + 1100, 0.72);
    const frame = route.sampleWormholeBackgroundViewerFrame(distance, 0.72);
    const dot = canonical.tangentX * frame.headingX + canonical.tangentY * frame.headingY;
    assert.ok(dot > 0, `distance=${distance} background heading diverged from route tangent`);
  }
});

test('background parallax motion follows the arc tangent without whole-world rotation', () => {
  const worldScale = 300;
  for (const distance of [1200, 5000, 9000, 14000]) {
    const previous = route.sampleWormholeBackgroundViewerFrame(distance - 240, 0.72);
    const current = route.sampleWormholeBackgroundViewerFrame(distance, 0.72);
    const tangent = route.sampleWormholeBackgroundRoute(distance + 1100, 0.72);
    const before = route.wormholeBackgroundWorldRelative(1000, -500, previous, worldScale);
    const after = route.wormholeBackgroundWorldRelative(1000, -500, current, worldScale);
    const motionX = after.x - before.x;
    const motionY = after.y - before.y;
    const dot = motionX * tangent.tangentX + motionY * tangent.tangentY;
    assert.ok(dot > 0, `distance=${distance} background motion diverged from route tangent`);
    assert.equal(current.turnAngle, 0, 'background frame must not request whole-world rotation');
  }
});

test('forward and backward bend morphs remain on one canonical route without one-step jumps', () => {
  const pairs = [[0, 0.72], [0.72, 0.58], [0.58, 0.35], [0.35, 0.2], [0.72, 0], [0.58, 0]];
  const distance = 9550;
  for (const [from, to] of pairs) {
    let previous = route.sampleWormholeBackgroundViewerFrame(distance, from);
    for (let step = 1; step <= 120; step++) {
      const bend = from + (to - from) * (step / 120);
      const current = route.sampleWormholeBackgroundViewerFrame(distance, bend);
      const delta = Math.hypot(current.offsetX - previous.offsetX, current.offsetY - previous.offsetY);
      assert.ok(delta <= 0.02, `${from}->${to} step ${step} jumped by ${delta}`);
      previous = current;
    }
  }
});

test('route sampling is history-independent across seek and sync-position call order', () => {
  const checkpoints = [0, 100, 2999, 3000, 7345, 12000, 30000];
  for (const distance of checkpoints) {
    const expected = route.sampleWormholeBackgroundRoute(distance, 0.72);
    route.sampleWormholeBackgroundRoute(90000, 0.2);
    route.sampleWormholeBackgroundRoute(3, 1);
    assertSampleEqual(route.sampleWormholeBackgroundRoute(distance, 0.72), expected, `seek ${distance}`);
  }
});
