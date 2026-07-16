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

/**
 * Screen-space polar angle and radius (around the fixed lens center) of a star across a draw
 * sequence. A star's world position is fixed; only its depth changes over time, and depth scales
 * both screen axes by the same positive factor, so at bend=0 the polar angle is exactly invariant
 * to depth alone. Any change in angle over the sequence is therefore attributable to the background
 * turn cue, without the centroid-level near-plane noise a raw-position measurement would carry. The
 * radius is recorded too: a pure rotation around the lens center (the old, rejected mechanism)
 * preserves radius exactly, so a measurable radius change is direct evidence of a genuine translate.
 */
function starAngleSeries(CosmicWormholeIdentity, State, tuningPreset, startTime, durationSec, fps, starIndex) {
  const tuning = {
    ...tuningPreset, wormholeStarfield: 1, wormholeGalaxy: 0, performanceMode: 0, chromaKeyMode: 0
  };
  Object.assign(State.visualTuning, tuning);
  Object.assign(State.targetTuning, tuning);
  const identity = new CosmicWormholeIdentity();
  identity.syncPosition(startTime);
  const frames = Math.round(durationSec * fps);
  const angles = [];
  const radii = [];
  const coreDrifts = [];
  for (let index = 0; index <= frames; index++) {
    State.currentTime = startTime + index / fps;
    const backend = makeBackend();
    identity.draw(backend, [], []);
    const [, , sx, sy] = backend.lines[starIndex];
    const dx = sx - backend.width / 2;
    const dy = sy - backend.height / 2;
    angles.push(Math.atan2(dy, dx));
    radii.push(Math.hypot(dx, dy));
    const grainLines = backend.lines.slice(1800);
    const coreCentroid = grainLines.reduce((acc, line) => {
      acc.x += line[2];
      acc.y += line[3];
      return acc;
    }, { x: 0, y: 0 });
    const count = Math.max(1, grainLines.length);
    coreDrifts.push(Math.hypot(coreCentroid.x / count - backend.width / 2, coreCentroid.y / count - backend.height / 2));
  }
  return { angles, radii, coreDrifts };
}

/** Wrapped angular deltas between consecutive samples: net (signed) change and total absolute travel. */
function angularSweep(angles) {
  let netChange = 0;
  let cumulativeAbsChange = 0;
  for (let index = 1; index < angles.length; index++) {
    let delta = angles[index] - angles[index - 1];
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    netChange += delta;
    cumulativeAbsChange += Math.abs(delta);
  }
  return { netChange, cumulativeAbsChange };
}

test('spiral background reads as a visible, continuous cosmic-turn cue across several multi-second draw windows', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State);

  // Several independent 3-second draw windows (inside the required 2-5s window), starting at
  // different song positions. This route is a bounded structural meander, not a one-directional
  // spiral (see documents/audits/wormhole-travel-and-path-bend-plan.md): any single 3-second slice
  // can legitimately land on a locally back-and-forth stretch, so a real regression (the cue going
  // weak or disappearing) is caught by requiring the cue to be visible *on average* across several
  // independently sampled windows, and strongly directional in at least one of them, rather than
  // demanding every single window be monotonic.
  const startTimes = [2, 5, 8, 11, 14];
  const durationSec = 3;
  const fps = 8;
  const starIndices = Array.from({ length: 8 }, (_, index) => index * 220);

  let sumAbsNetDeg = 0;
  let windowCount = 0;
  let maxMonotonicRatio = 0;
  let maxCoreDrift = 0;
  for (const startTime of startTimes) {
    let sumAbsNet = 0;
    let sumRatio = 0;
    for (const starIndex of starIndices) {
      const { angles, coreDrifts } = starAngleSeries(
        CosmicWormholeIdentity, State, spiral, startTime, durationSec, fps, starIndex
      );
      const { netChange, cumulativeAbsChange } = angularSweep(angles);
      sumAbsNet += Math.abs(netChange);
      sumRatio += Math.abs(netChange) / Math.max(1e-9, cumulativeAbsChange);
      for (const drift of coreDrifts) maxCoreDrift = Math.max(maxCoreDrift, drift);
    }
    sumAbsNetDeg += (sumAbsNet / starIndices.length) * 180 / Math.PI;
    maxMonotonicRatio = Math.max(maxMonotonicRatio, sumRatio / starIndices.length);
    windowCount++;
  }
  const avgAbsNetDeg = sumAbsNetDeg / windowCount;

  assert.ok(
    avgAbsNetDeg >= 0.5,
    `expected a conservative but measurable angular sweep averaged across windows, got ${avgAbsNetDeg.toFixed(2)} deg`
  );
  // "Monotonic arc": at least one sampled window should show most of its angular travel landing in
  // one net direction rather than canceling back and forth, proving the mechanism can produce a
  // strongly directional turn and not just noise. A perfectly straight sweep gives ratio 1; pure
  // back-and-forth jitter gives ratio near 0.
  assert.ok(
    maxMonotonicRatio >= 0.5,
    `expected at least one window with a mostly one-directional sweep, best net/total ratio was ${maxMonotonicRatio.toFixed(2)}`
  );

  // The foreground reads the distance-smoothed route history so a bend retarget cannot rewrite the
  // whole visible volume in one frame. It must still produce a clearly visible developed-arc swing,
  // while the upper bound keeps the route lens-local.
  assert.ok(
    maxCoreDrift >= 35,
    `expected the foreground core to visibly swing with the turn, drifted only ${maxCoreDrift.toFixed(1)}px`
  );
  assert.ok(
    maxCoreDrift <= 324,
    `core centroid left the lens-local sanity bound: ${maxCoreDrift.toFixed(1)}px (bound 324px at height 540)`
  );
});

test('spiral background moves smoothly frame to frame -- no on-screen snap/teleport while a star is visible', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  const tuning = {
    ...spiral, wormholeStarfield: 1, wormholeGalaxy: 0, performanceMode: 0, chromaKeyMode: 0
  };
  setupReleaseTestState(State);
  Object.assign(State.visualTuning, tuning);
  Object.assign(State.targetTuning, tuning);

  // A 40-second sequence covers roughly one full star depth cycle, so every star transits its own
  // near-plane fade at some point; a real bug here was a smooth, alpha-faded transit landing right
  // next to a genuine multi-hundred-degree snap while the star was still bright. Recording each
  // star's own alpha lets the check ignore the far/faded (correctly invisible or off-screen) part of
  // that transit and focus on whether the *visible* part ever teleports.
  const startTime = 2;
  const fps = 20;
  const durationSec = 40;
  const frames = Math.round(durationSec * fps);
  const cx = 800;
  const cy = 450;
  const onScreenBound = Math.hypot(cx, cy) * 2;
  const visibleAlphaFloor = 15;

  const identity = new CosmicWormholeIdentity();
  identity.syncPosition(startTime);
  const previous = new Array(1800).fill(null);
  let maxVisibleDelta = 0;
  for (let index = 0; index <= frames; index++) {
    State.currentTime = startTime + index / fps;
    let lastAlpha = 0;
    const backend = {
      width: cx * 2, height: cy * 2, frameCount: 1, lines: [], glows: [],
      background() {}, noStroke() {}, noFill() {}, fill() {}, strokeWeight() {},
      stroke(_r, _g, _b, a) { lastAlpha = a; },
      line(px, py, sx, sy) {
        const starIndex = this.lines.length;
        this.lines.push([px, py, sx, sy]);
        if (starIndex >= 1800) return;
        const onScreen = Math.hypot(sx - cx, sy - cy) <= onScreenBound;
        const visible = lastAlpha >= visibleAlphaFloor && onScreen;
        const prior = previous[starIndex];
        if (prior && prior.visible && visible) {
          const delta = Math.hypot(sx - prior.x, sy - prior.y);
          if (delta > maxVisibleDelta) maxVisibleDelta = delta;
        }
        previous[starIndex] = { x: sx, y: sy, visible };
      },
      circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
      radialGlow() {}
    };
    identity.draw(backend, [], []);
  }

  // A generous bound: comfortably above ordinary per-frame parallax motion at this world-scale, but
  // far below the hundreds-to-thousands-of-pixel snaps a reintroduced rotation-based heading (rotating
  // either a background object's own world position or the viewer's offset vector) produced.
  assert.ok(
    maxVisibleDelta <= 300,
    `expected smooth on-screen motion frame to frame, got a ${maxVisibleDelta.toFixed(1)}px single-frame jump while visible`
  );
});

test('drive (pathBend=0) keeps every background star angle and radius exactly frozen across the same sequence', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const drive = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-drive.json'), 'utf8'
  )).visualTuning;
  assert.equal(drive.wormholePathBend, 0, 'drive is the zero-bend baseline preset');
  setupReleaseTestState(State);

  const starIndices = Array.from({ length: 6 }, (_, index) => index * 300);
  for (const starIndex of starIndices) {
    const { angles } = starAngleSeries(CosmicWormholeIdentity, State, drive, 2, 3, 8, starIndex);
    const base = angles[0];
    for (const angle of angles) {
      assert.ok(Math.abs(angle - base) < 1e-9, `star ${starIndex} angle drifted at pathBend=0: ${angle} vs ${base}`);
    }
  }
});

test('spiral background radius diverges from a same-depth zero-bend baseline -- a genuine world translate, not a pure center rotation', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  const spiralZeroBend = { ...spiral, wormholePathBend: 0 };
  setupReleaseTestState(State);

  // Both runs share the exact same star depth-cycling schedule (it does not depend on bend), so any
  // difference in on-screen radius at matched frames is attributable purely to the bend-driven world
  // transform. A pure rotation around the fixed lens center -- the mechanism being replaced --
  // preserves radius exactly (see the determinism-level rotation-identity test), so radius equality
  // would mean the background is still only rotating in place instead of the viewer genuinely
  // translating through a bending world.
  const startTime = 2;
  const durationSec = 3;
  const fps = 8;
  const starIndices = Array.from({ length: 8 }, (_, index) => index * 220);

  let sampleCount = 0;
  let sumAbsRelativeDeviation = 0;
  let maxAbsRelativeDeviation = 0;
  for (const starIndex of starIndices) {
    const { radii: bentRadii } = starAngleSeries(CosmicWormholeIdentity, State, spiral, startTime, durationSec, fps, starIndex);
    const { radii: straightRadii } = starAngleSeries(CosmicWormholeIdentity, State, spiralZeroBend, startTime, durationSec, fps, starIndex);
    for (let index = 0; index < bentRadii.length; index++) {
      const baseline = Math.max(1e-6, straightRadii[index]);
      const relativeDeviation = Math.abs(bentRadii[index] - straightRadii[index]) / baseline;
      sumAbsRelativeDeviation += relativeDeviation;
      maxAbsRelativeDeviation = Math.max(maxAbsRelativeDeviation, relativeDeviation);
      sampleCount++;
    }
  }
  const avgRelativeDeviation = sumAbsRelativeDeviation / sampleCount;

  assert.ok(
    avgRelativeDeviation > 0.01,
    `expected a measurable radius change vs. the zero-bend baseline (world translate), got avg relative deviation ${(avgRelativeDeviation * 100).toFixed(2)}%`
  );
  assert.ok(
    maxAbsRelativeDeviation > 0.02,
    `expected at least one frame with a clearly measurable radius change, got max relative deviation ${(maxAbsRelativeDeviation * 100).toFixed(2)}%`
  );
});

test('background turn cue retargets without teleporting at a stationary song distance', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State);

  const tuning = {
    ...spiral, wormholePathBend: 0, wormholeStarfield: 1, wormholeGalaxy: 0, performanceMode: 0, chromaKeyMode: 0
  };
  Object.assign(State.visualTuning, tuning);
  Object.assign(State.targetTuning, tuning);
  const identity = new CosmicWormholeIdentity();
  const startTime = 2;
  identity.syncPosition(startTime);
  State.currentTime = startTime;

  const starIndex = 440;
  const baseline = makeBackend();
  identity.draw(baseline, [], []);
  const [, , baseSx, baseSy] = baseline.lines[starIndex];

  // Mutate only the live rendered tuning -- not the morph target, not the song position, and no
  // grain has crossed a generation boundary -- then redraw at the exact same travel distance.
  State.visualTuning.wormholePathBend = spiral.wormholePathBend;
  const bent = makeBackend();
  identity.draw(bent, [], []);
  const [, , bentSx, bentSy] = bent.lines[starIndex];

  const shift = Math.hypot(bentSx - baseSx, bentSy - baseSy);
  assert.ok(
    shift <= 1e-6,
    `expected a stationary live bend retarget to preserve the background position, got a ${shift.toFixed(6)}px shift`
  );
});

test('foreground route retargets without rearranging in-flight grains at a stationary song distance', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State);

  const tuning = {
    ...spiral,
    wormholePathBend: 0,
    wormholePathBendVertical: 0,
    wormholeStarfield: 0,
    wormholeGalaxy: 0,
    wormholeSkybox: 0,
    performanceMode: 0,
    chromaKeyMode: 0
  };
  Object.assign(State.visualTuning, tuning);
  Object.assign(State.targetTuning, tuning);
  State.activeVisualTransitionId = null;

  const identity = new CosmicWormholeIdentity();
  const time = 2;
  identity.syncPosition(time);
  State.currentTime = time;

  const baseline = makeBackend();
  identity.draw(baseline, [], []);
  State.visualTuning.wormholePathBend = spiral.wormholePathBend;
  const retargeted = makeBackend();
  identity.draw(retargeted, [], []);

  assert.equal(retargeted.lines.length, baseline.lines.length);
  let maxShift = 0;
  for (let index = 0; index < baseline.lines.length; index++) {
    const before = baseline.lines[index];
    const after = retargeted.lines[index];
    maxShift = Math.max(maxShift, Math.hypot(after[2] - before[2], after[3] - before[3]));
  }
  assert.ok(
    maxShift <= 1e-6,
    `stationary bend retarget rearranged an in-flight grain by ${maxShift.toFixed(6)}px`
  );
});

test('bend-only transitions do not inject a second grain-geometry disturbance', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State);

  const tuning = {
    ...spiral,
    wormholePathBend: 0,
    wormholePathBendVertical: 0,
    wormholeStarfield: 0,
    wormholeGalaxy: 0,
    wormholeSkybox: 0,
    performanceMode: 0,
    chromaKeyMode: 0
  };
  const target = { ...tuning, wormholePathBend: spiral.wormholePathBend };

  function render(activeTransitionId) {
    Object.assign(State.visualTuning, tuning);
    Object.assign(State.targetTuning, target);
    State.activeVisualTransitionId = activeTransitionId;
    const identity = new CosmicWormholeIdentity();
    identity.syncPosition(2);
    State.currentTime = 2;
    identity.draw(makeBackend(), [], []);
    State.currentTime = 2.36;
    const backend = makeBackend();
    identity.draw(backend, [], []);
    return backend.lines;
  }

  const control = render(null);
  const transitioning = render('bend-only');
  State.activeVisualTransitionId = null;
  assert.deepEqual(
    transitioning,
    control,
    'a route bend already has tuning morph + steering; it must not also trigger grain distortion'
  );
});

test('cosmos bend response translates equal-depth stars without stretching their spacing', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State);

  function separationAt(bend) {
    const tuning = {
      ...spiral,
      wormholePathBend: bend,
      wormholePathBendVertical: 0,
      wormholeStarfield: 1,
      wormholeGalaxy: 0,
      wormholeSkybox: 0,
      performanceMode: 0,
      chromaKeyMode: 0
    };
    Object.assign(State.visualTuning, tuning);
    Object.assign(State.targetTuning, tuning);
    State.activeVisualTransitionId = null;
    const identity = new CosmicWormholeIdentity();
    identity.starPool[0].x = -2000;
    identity.starPool[0].y = 0;
    identity.starPool[1].x = 2000;
    identity.starPool[1].y = 0;
    identity.starPool[1].seed = identity.starPool[0].seed;
    const time = 8;
    identity.syncPosition(time);
    State.currentTime = time;
    const backend = makeBackend();
    identity.draw(backend, [], []);
    const first = backend.lines[0];
    const second = backend.lines[1];
    return Math.hypot(second[2] - first[2], second[3] - first[3]);
  }

  const straight = separationAt(0);
  const bent = separationAt(spiral.wormholePathBend);
  assert.ok(straight > 1, 'fixture must have measurable equal-depth star spacing');
  assert.ok(
    Math.abs(bent - straight) <= 1e-6,
    `bend stretched equal-depth cosmos spacing from ${straight.toFixed(6)}px to ${bent.toFixed(6)}px`
  );
});
