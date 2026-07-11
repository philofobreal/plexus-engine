import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

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
    vm.runInNewContext(output, { module, exports: module.exports, require, Math, Number, Array, Object, Map, Set, Uint16Array });
    return module.exports;
  }
  return relative => load(join(process.cwd(), 'src', relative));
}

function kickTestFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(0.9), ...new Array(16).fill(0.1)],
    state: 'HIGH'
  };
}

function setupReleaseTestState(State) {
  State.sampleRate = 1000;
  State.hopSize = 100;
  State.frames = Array.from({ length: 400 }, () => kickTestFrame());
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = kickTestFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.isExporting = false;
  State.playbackFade = 1;
  State.isPlaying = true;
}

function makeBackend() {
  return {
    width: 960, height: 540, frameCount: 1, lines: [], glows: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow(...args) { this.glows.push(args); }
  };
}

function angleAt(sx, sy, cx, cy) {
  return Math.atan2(sy - cy, sx - cx);
}

function unwrapDelta(delta) {
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

function loadSpiralPreset() {
  return JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
}

test('skybox pan saturation is smooth, strictly monotonic, and sign-symmetric across the full authored heading range', () => {
  const load = createSourceLoader();
  const { wormholeSkyboxPanHeading } = load('visuals/CosmicWormholeIdentity.ts');
  const { ROUTE_MAX_HEADING } = load('visuals/WormholeGrainField.ts');

  assert.equal(wormholeSkyboxPanHeading(0), 0);

  const steps = 4000;
  let previous = wormholeSkyboxPanHeading(-ROUTE_MAX_HEADING);
  for (let i = 1; i <= steps; i++) {
    const heading = -ROUTE_MAX_HEADING + (2 * ROUTE_MAX_HEADING) * (i / steps);
    const value = wormholeSkyboxPanHeading(heading);
    assert.ok(
      value > previous,
      `expected strictly increasing pan at heading=${heading}, got ${value} after ${previous} (old hard clamp went flat here)`
    );
    previous = value;
  }

  for (const heading of [0.05, 0.2, 0.4, 0.6, 0.88, 1.4]) {
    const positive = wormholeSkyboxPanHeading(heading);
    const negative = wormholeSkyboxPanHeading(-heading);
    assert.ok(
      Math.abs(positive + negative) < 1e-9,
      `expected odd symmetry at heading=${heading}, got ${positive} vs ${negative}`
    );
  }
});

test('bend=0 skybox trail is a nonzero, rate-proportional, capped forward cue instead of an exactly static plate', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity, SKYBOX_FORWARD_CUE_CAP } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  const spiral = loadSpiralPreset();
  setupReleaseTestState(State);
  featureFlags.wormholeSkybox = true;

  function measureAtSpeed(speed) {
    const tuning = {
      ...spiral, wormholePathBend: 0, wormholeStarfield: 0, wormholeGalaxy: 0, wormholeSkybox: 1,
      wormholeSpeed: speed, performanceMode: 0, chromaKeyMode: 0
    };
    Object.assign(State.visualTuning, tuning);
    Object.assign(State.targetTuning, tuning);
    const identity = new CosmicWormholeIdentity();
    identity.syncPosition(2);
    State.currentTime = 2;
    const backend = makeBackend();
    identity.draw(backend, [], []);
    const [prevSx, prevSy, sx, sy] = backend.lines[0];
    assert.equal(identity.baseRouteNow.headingAngle, 0, 'bend=0 must keep the route perfectly straight');
    const length = Math.hypot(sx - prevSx, sy - prevSy);
    // On a straight route the trail is pure radial shrink toward screen center (no lateral pan
    // component), so the implied shrink fraction can be recovered directly from the geometry and
    // checked against the authored cap without needing to reach it via realistic UI-range speeds.
    const radialSpan = Math.hypot(sx - 480, sy - 270);
    const impliedShrink = radialSpan > 0 ? length / radialSpan : 0;
    return { length, impliedShrink };
  }

  try {
    const low = measureAtSpeed(0.2);
    const mid = measureAtSpeed(1.5);
    const high = measureAtSpeed(4);
    const extreme = measureAtSpeed(10);

    assert.ok(low.length > 0, `expected a nonzero forward cue on a straight route, got ${low.length}`);
    assert.ok(mid.length > low.length, `expected the cue to grow with canonical rate: mid=${mid.length} low=${low.length}`);
    assert.ok(high.length > mid.length, `expected the cue to keep growing with canonical rate: high=${high.length} mid=${mid.length}`);
    assert.ok(extreme.length >= high.length, `expected the cue to never shrink as speed keeps rising: high=${high.length} extreme=${extreme.length}`);
    for (const [label, sample] of [['low', low], ['mid', mid], ['high', high], ['extreme', extreme]]) {
      assert.ok(
        sample.impliedShrink <= SKYBOX_FORWARD_CUE_CAP + 1e-9,
        `expected the ${label}-speed forward shrink to stay within the authored cap ${SKYBOX_FORWARD_CUE_CAP}, got ${sample.impliedShrink}`
      );
    }
  } finally {
    featureFlags.wormholeSkybox = false;
  }
});

test('starfield, galaxy, and skybox agree on lateral turn direction, in a fixed, measured ratio band', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  const spiral = loadSpiralPreset();
  setupReleaseTestState(State);
  featureFlags.wormholeSkybox = true;

  const startTime = 2;
  const fps = 30;
  const frameCount = 400;

  const starTuning = {
    ...spiral, wormholePathBend: 0.6, wormholeStarfield: 1, wormholeGalaxy: 0, wormholeSkybox: 0,
    performanceMode: 0, chromaKeyMode: 0
  };
  const galaxyTuning = {
    ...spiral, wormholePathBend: 0.6, wormholeStarfield: 0, wormholeGalaxy: 1, wormholeSkybox: 0,
    performanceMode: 0, chromaKeyMode: 0
  };
  const skyTuning = {
    ...spiral, wormholePathBend: 0.6, wormholeStarfield: 0, wormholeGalaxy: 0, wormholeSkybox: 1,
    performanceMode: 0, chromaKeyMode: 0
  };

  function runFrames(tuning) {
    Object.assign(State.visualTuning, tuning);
    Object.assign(State.targetTuning, tuning);
    const identity = new CosmicWormholeIdentity();
    identity.syncPosition(startTime);
    const out = [];
    for (let index = 0; index <= frameCount; index++) {
      State.currentTime = startTime + index / fps;
      const backend = makeBackend();
      identity.draw(backend, [], []);
      out.push({ backend, heading: identity.baseRouteNow.headingAngle });
    }
    return out;
  }

  let starRuns, galaxyRuns, skyRuns;
  try {
    starRuns = runFrames(starTuning);
    galaxyRuns = runFrames(galaxyTuning);
    skyRuns = runFrames(skyTuning);
  } finally {
    featureFlags.wormholeSkybox = false;
  }

  assert.ok(starRuns.length === frameCount + 1, 'expected the full scripted 400-frame turn');
  const headingSpan = starRuns[starRuns.length - 1].heading - starRuns[0].heading;
  assert.ok(headingSpan > 0.05, `expected a developed turn over the script, heading only spanned ${headingSpan}`);

  // Galaxy (9 large, slow glows) and skybox (a single shared pan scalar) are both effectively
  // noise-free at single-frame granularity, so their lateral direction can be compared frame by
  // frame: this is exactly the class of regression this test exists to catch (RC6 -- the skybox's
  // pan used to translate the opposite screen direction from every other background layer for the
  // same route heading).
  function meanCurrentGx(glows) {
    let sum = 0, count = 0;
    for (let g = 0; g < glows.length; g += 2) { sum += glows[g][0]; count++; }
    return sum / count;
  }
  const galaxyMean = galaxyRuns.map(r => meanCurrentGx(r.backend.glows));
  // Every skybox star shares the exact same frame-to-frame pan delta (the per-star `star.x * radius`
  // term is time-invariant and cancels out), so star index 0's own current endpoint is an exact,
  // noise-free stand-in for the whole layer's pan direction.
  const skyPosition = skyRuns.map(r => r.backend.lines[0][2]);

  let significantFrames = 0;
  let signMismatches = 0;
  for (let i = 1; i < galaxyRuns.length; i++) {
    if (Math.abs(starRuns[i].heading) <= 0.05) continue;
    significantFrames++;
    const dGalaxy = galaxyMean[i] - galaxyMean[i - 1];
    const dSky = skyPosition[i] - skyPosition[i - 1];
    if (Math.sign(dGalaxy) !== Math.sign(dSky)) signMismatches++;
  }
  assert.ok(significantFrames > 100, `expected many frames past the |heading|>0.05 gate, got ${significantFrames}`);
  assert.equal(
    signMismatches, 0,
    `galaxy and skybox disagreed on lateral turn direction in ${signMismatches}/${significantFrames} frames`
  );

  // The near starfield's per-star depth-cycling dominates any single-frame or single-window lateral
  // reading (a pre-existing, unrelated property of the tunnel starfield, not something this task may
  // touch -- see the Tiltasok). Its net turn direction only reads clean once genuinely random per-star
  // noise is averaged out across many independent stars *and* several independent time windows, which
  // is exactly the technique the existing spiral background turn-cue test already relies on. The same
  // windowed net angular sweep, aggregated across windows, is used here as the star:galaxy ratio and
  // sign-agreement signal instead of a raw per-frame comparison.
  function netAngularSweep(tuning, indices, isGalaxy) {
    Object.assign(State.visualTuning, tuning);
    Object.assign(State.targetTuning, tuning);
    const cx = 480, cy = 270;
    let total = 0;
    const windowStartTimes = [2, 5, 8, 11, 14];
    const durationSec = 3;
    const windowFps = 8;
    const windowFrames = Math.round(durationSec * windowFps);
    let windowCount = 0;
    for (const windowStart of windowStartTimes) {
      const identity = new CosmicWormholeIdentity();
      identity.syncPosition(windowStart);
      const series = indices.map(() => []);
      for (let index = 0; index <= windowFrames; index++) {
        State.currentTime = windowStart + index / windowFps;
        const backend = makeBackend();
        identity.draw(backend, [], []);
        indices.forEach((idx, k) => {
          const point = isGalaxy ? backend.glows[idx * 2] : backend.lines[idx].slice(2);
          series[k].push([point[0], point[1]]);
        });
      }
      let windowNet = 0;
      for (const points of series) {
        let net = 0;
        for (let i = 1; i < points.length; i++) {
          net += unwrapDelta(angleAt(points[i][0], points[i][1], cx, cy) - angleAt(points[i - 1][0], points[i - 1][1], cx, cy));
        }
        windowNet += net / points.length;
      }
      total += windowNet;
      windowCount++;
    }
    return total / windowCount;
  }

  featureFlags.wormholeSkybox = true;
  let starAggregate, galaxyAggregate;
  try {
    starAggregate = netAngularSweep(starTuning, Array.from({ length: 20 }, (_, i) => i * 90), false);
    galaxyAggregate = netAngularSweep(galaxyTuning, Array.from({ length: 9 }, (_, i) => i), true);
  } finally {
    featureFlags.wormholeSkybox = false;
  }

  assert.equal(
    Math.sign(starAggregate), Math.sign(galaxyAggregate),
    `expected the starfield's aggregate turn direction to match the galaxy layer's: star=${starAggregate} galaxy=${galaxyAggregate}`
  );

  // Measured on the current implementation (see Task06); a regression-catching band, not a claim
  // about the "correct" ratio -- +-40% per the task's own instruction.
  const measuredRatio = 12.443649324817434;
  const ratio = Math.abs(starAggregate) / Math.abs(galaxyAggregate);
  assert.ok(
    ratio >= measuredRatio * 0.6 && ratio <= measuredRatio * 1.4,
    `expected star:galaxy lateral ratio within +-40% of ${measuredRatio}, got ${ratio}`
  );
});
