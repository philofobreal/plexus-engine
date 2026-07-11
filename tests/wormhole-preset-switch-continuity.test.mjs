import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const FPS = 60;
const DELTA_SEC = 1 / FPS;
const START_TIME_SEC = 2;
const WARMUP_FRAMES = 120;
const POST_SWITCH_FRAMES = 120;
const STAR_COUNT = 1800;
const VISIBLE_ALPHA_FLOOR = 0.05;
const BACKEND_WIDTH = 960;
const BACKEND_HEIGHT = 540;
const MAX_STAR_DELTA_PX = Math.max(8, BACKEND_WIDTH * 0.015);

// Source: the visualTuning blocks in public/visual-tuning-presets/vos-wh-*.json.
// They are intentionally inlined: this deterministic Node harness must not fetch presets.
const PRESETS = {
  spiral: {
    audioSensitivity: 1.3, backgroundRed: 8, backgroundGreen: 4, backgroundBlue: 20,
    circleHue: 275, lineAlpha: 1.35, lineWeight: 1.1, wormholeRadius: 0.9,
    wormholeDepth: 3.0, wormholeSpeed: 4.8, wormholeWarp: 1.65, wormholeCurve: 0.32,
    wormholePathBend: 0.72, wormholeRing: 0, wormholeDepthCoherence: 0.6,
    wormholeContinuity: 1.45, wormholeEmissionMode: 1, wormholeJitter: 0.12
  },
  drive: {
    audioSensitivity: 1.15, backgroundRed: 4, backgroundGreen: 6, backgroundBlue: 16,
    circleHue: 195, lineAlpha: 1.3, lineWeight: 1.0, wormholeRadius: 1.0,
    wormholeDepth: 2.8, wormholeSpeed: 4.2, wormholeWarp: 0.35, wormholeCurve: 0,
    wormholePathBend: 0, wormholeRing: 0, wormholeDepthCoherence: 0,
    wormholeContinuity: 1.35, wormholeEmissionMode: 0, wormholeJitter: 0.04
  },
  overdrive: {
    audioSensitivity: 1.55, backgroundRed: 18, backgroundGreen: 2, backgroundBlue: 14,
    circleHue: 335, lineAlpha: 1.85, lineWeight: 1.25, wormholeRadius: 0.8,
    wormholeDepth: 2.3, wormholeSpeed: 9.0, wormholeWarp: 2.5, wormholeCurve: 0.45,
    wormholePathBend: 0.42, wormholeRing: 0, wormholeDepthCoherence: 0,
    wormholeContinuity: 0.8, wormholeEmissionMode: 1, wormholeJitter: 0.9
  },
  drift: {
    audioSensitivity: 0.8, backgroundRed: 2, backgroundGreen: 2, backgroundBlue: 8,
    circleHue: 250, lineAlpha: 1.25, lineWeight: 0.8, wormholeRadius: 1.8,
    wormholeDepth: 5.0, wormholeSpeed: 0.3, wormholeWarp: 0.2, wormholeCurve: 0.1,
    wormholePathBend: -0.16, wormholeRing: 0, wormholeDepthCoherence: 0,
    wormholeContinuity: 1.55, wormholeEmissionMode: 0, wormholeJitter: 0.05
  },
  sparse: {
    audioSensitivity: 0.8, backgroundRed: 3, backgroundGreen: 3, backgroundBlue: 6,
    circleHue: 230, lineAlpha: 1.35, lineWeight: 0.8, wormholeRadius: 1.2,
    wormholeDepth: 4.7, wormholeSpeed: 1.4, wormholeWarp: 0.1, wormholeCurve: 0.05,
    wormholePathBend: 0, wormholeRing: 0, wormholeDepthCoherence: 0.35,
    wormholeContinuity: 2.0, wormholeEmissionMode: 2, wormholeJitter: 0
  },
  galaxy: {
    audioSensitivity: 1.1, backgroundRed: 4, backgroundGreen: 3, backgroundBlue: 14,
    circleHue: 45, lineAlpha: 1.55, lineWeight: 1.1, wormholeRadius: 1.5,
    wormholeDepth: 4.6, wormholeSpeed: 0.75, wormholeWarp: 0.35, wormholeCurve: 0.12,
    wormholePathBend: 0.22, wormholePathBendVertical: 0.12, wormholeRing: 0, wormholeDepthCoherence: 0,
    wormholeContinuity: 2.0, wormholeEmissionMode: 0, wormholeJitter: 0
  },
  punch: {
    audioSensitivity: 1.45, backgroundRed: 14, backgroundGreen: 2, backgroundBlue: 18,
    circleHue: 320, lineAlpha: 1.65, lineWeight: 1.15, wormholeRadius: 0.85,
    wormholeDepth: 2.4, wormholeSpeed: 7.2, wormholeWarp: 1.2, wormholeCurve: 0.08,
    wormholePathBend: 0, wormholeRing: 0, wormholeDepthCoherence: 0,
    wormholeContinuity: 0.7, wormholeEmissionMode: 1, wormholeJitter: 0.35
  }
};

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
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, {
      module, exports: module.exports, require, Math, Number, Array, Object, Map, Set,
      Uint16Array, Float64Array
    });
    return module.exports;
  }
  return relative => load(join(process.cwd(), 'src', relative));
}

function syntheticFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(0.9), ...new Array(16).fill(0.1)],
    state: 'HIGH'
  };
}

function setupReleaseTestState(State) {
  State.sampleRate = 1000;
  State.hopSize = 100;
  State.frames = Array.from({ length: 400 }, syntheticFrame);
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.features = [];
  State.trackAnalysis.bars = [];
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = syntheticFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.isExporting = false;
  State.exportTime = 0;
  State.playbackFade = 1;
  State.isPlaying = true;
  State.beatDecay = 0;
  State.denseImpactFlash = 0;
  State.activeVisualTransitionId = null;
}

function makeStarBackend() {
  let lastAlpha = 0;
  let lineIndex = 0;
  const stars = [];
  return {
    width: BACKEND_WIDTH,
    height: BACKEND_HEIGHT,
    frameCount: 1,
    stars,
    background() {}, noStroke() {}, noFill() {}, fill() {}, strokeWeight() {},
    stroke(_r, _g, _b, alpha) { lastAlpha = alpha; },
    line(px, py, sx, sy) {
      if (lineIndex < STAR_COUNT) stars.push({ px, py, sx, sy, alpha: lastAlpha });
      lineIndex++;
    },
    circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}
  };
}

const load = createSourceLoader();
const { CosmicWormholeIdentity, IntegratedWormholeRoute } = load('visuals/CosmicWormholeIdentity.ts');
const { wormholeParallaxStrength } = load('visuals/WormholeCosmicSync.ts');
const { State } = load('state/store.ts');
const { applyTuningMorph } = load('config/visualTuning.ts');
const { WormholeTransport, WormholeAuthoredSpeedTimeline } = load('visuals/WormholeTimeline.ts');
const { ROUTE_CURVATURE } = load('visuals/WormholeGrainField.ts');
const defaultTuning = { ...State.visualTuning };

function completePreset(preset, morphDurationSec) {
  return {
    ...defaultTuning,
    ...preset,
    morphDurationSec,
    wormholeStarfield: 1,
    wormholeGalaxy: 0,
    performanceMode: 0,
    chromaKeyMode: 0
  };
}

/**
 * Deterministic preset-morph renderer harness. The first 1800 line calls are the starfield: the
 * skybox feature flag is off by default, galaxies use radialGlow(), and the foreground follows.
 * CosmicWormholeIdentity deliberately emits one line per star even at zero alpha, preserving pool
 * index as the stable cross-frame identity.
 */
function runScriptedMorph(fromPresetTuning, toPresetTuning, opts = {}) {
  const morphDurationSec = opts.morphDurationSec ?? 2;
  const warmupFrames = opts.warmupFrames ?? WARMUP_FRAMES;
  const postSwitchFrames = opts.postSwitchFrames ?? POST_SWITCH_FRAMES;
  const startTimeSec = opts.startTimeSec ?? START_TIME_SEC;
  const from = completePreset(fromPresetTuning, morphDurationSec);
  const to = completePreset(toPresetTuning, morphDurationSec);

  setupReleaseTestState(State);
  Object.assign(State.visualTuning, from);
  Object.assign(State.targetTuning, from);
  const identity = new CosmicWormholeIdentity();
  identity.syncPosition(startTimeSec);

  const frames = [];
  for (let frameIndex = 0; frameIndex < warmupFrames + postSwitchFrames; frameIndex++) {
    if (frameIndex === warmupFrames) Object.assign(State.targetTuning, to);
    State.currentTime = startTimeSec + frameIndex * DELTA_SEC;
    applyTuningMorph(State.visualTuning, State.targetTuning, State.targetTuning.transitionSpeed, DELTA_SEC);
    const backend = makeStarBackend();
    identity.draw(backend, [], []);
    assert.equal(backend.stars.length, STAR_COUNT, 'starfield must preserve one line per stable pool index');
    frames.push(backend.stars);
  }

  return { frames, switchFrameIndex: warmupFrames };
}

/**
 * Task04 seek harness: play a preset forward normally, then perform a genuine seek (`syncPosition`
 * to a much later song time, as transport/UI seek does) and keep drawing. The seek frame itself is
 * legitimately allowed to change the picture; only continuity *between* the post-seek frames is the
 * regression this guards (RC4: seek used to reset route heading to 0, so a curved preset seeked mid
 * turn would snap straight and then visibly un-snap over the next few frames as steering caught up).
 */
function runSeekScenario(presetTuning, opts = {}) {
  const morphDurationSec = opts.morphDurationSec ?? 2;
  const preSeekFrames = opts.preSeekFrames ?? 200;
  const postSeekFrames = opts.postSeekFrames ?? 60;
  const startTimeSec = opts.startTimeSec ?? START_TIME_SEC;
  const seekAheadSec = opts.seekAheadSec ?? 30;
  const tuning = completePreset(presetTuning, morphDurationSec);

  setupReleaseTestState(State);
  Object.assign(State.visualTuning, tuning);
  Object.assign(State.targetTuning, tuning);
  const identity = new CosmicWormholeIdentity();
  identity.syncPosition(startTimeSec);

  for (let frameIndex = 0; frameIndex < preSeekFrames; frameIndex++) {
    State.currentTime = startTimeSec + frameIndex * DELTA_SEC;
    identity.draw(makeStarBackend(), [], []);
  }

  const seekTimeSec = startTimeSec + preSeekFrames * DELTA_SEC + seekAheadSec;
  identity.syncPosition(seekTimeSec);

  const frames = [];
  for (let frameIndex = 0; frameIndex < postSeekFrames; frameIndex++) {
    State.currentTime = seekTimeSec + frameIndex * DELTA_SEC;
    const backend = makeStarBackend();
    identity.draw(backend, [], []);
    frames.push(backend.stars);
  }
  return frames;
}

function measureContinuity(run) {
  let maxDeltaPx = 0;
  let maxDeltaFrame = -1;
  let maxDeltaStar = -1;
  let maxFadeRatio = 0;
  let fadeGateAtSwitch = 0;
  let fadeGateAtMaxJump = 0;
  let trailLengthSum = 0;
  let screenMotionSum = 0;

  for (let frameIndex = run.switchFrameIndex; frameIndex < run.frames.length; frameIndex++) {
    const previous = run.frames[frameIndex - 1];
    const current = run.frames[frameIndex];
    let visibleCount = 0;
    let fadeCount = 0;
    let frameMaxDelta = 0;
    for (let starIndex = 0; starIndex < STAR_COUNT; starIndex++) {
      const before = previous[starIndex];
      const after = current[starIndex];
      if (before.alpha >= VISIBLE_ALPHA_FLOOR) {
        visibleCount++;
        if (after.alpha / before.alpha < 0.5) fadeCount++;
      }
      if (before.alpha < VISIBLE_ALPHA_FLOOR || after.alpha < VISIBLE_ALPHA_FLOOR) continue;
      const delta = Math.hypot(after.sx - before.sx, after.sy - before.sy);
      frameMaxDelta = Math.max(frameMaxDelta, delta);
      trailLengthSum += Math.hypot(after.sx - after.px, after.sy - after.py);
      screenMotionSum += delta;
      if (delta > maxDeltaPx) {
        maxDeltaPx = delta;
        maxDeltaFrame = frameIndex;
        maxDeltaStar = starIndex;
      }
    }
    if (frameIndex === run.switchFrameIndex) fadeGateAtSwitch = fadeCount;
    if (frameMaxDelta >= maxDeltaPx - 1e-12) fadeGateAtMaxJump = fadeCount;
    if (frameIndex < run.switchFrameIndex + 20 && visibleCount > 0) {
      maxFadeRatio = Math.max(maxFadeRatio, fadeCount / visibleCount);
    }
  }

  return {
    maxDeltaPx, maxDeltaFrame, maxDeltaStar, maxFadeRatio, fadeGateAtSwitch,
    fadeGateAtMaxJump,
    trailToMotionRatio: trailLengthSum / Math.max(1e-12, screenMotionSum)
  };
}

const renderRunCache = new Map();
function measuredPair(fromName, toName) {
  const key = `${fromName}->${toName}`;
  if (!renderRunCache.has(key)) {
    renderRunCache.set(key, measureContinuity(runScriptedMorph(PRESETS[fromName], PRESETS[toName])));
  }
  return renderRunCache.get(key);
}

function travelSeries(fromPresetTuning, toPresetTuning, morphDurationSec = 2) {
  setupReleaseTestState(State);
  const transport = new WormholeTransport();
  transport.sync(
    State.frames, State.sampleRate, State.hopSize, State.events,
    State.trackAnalysis.features, State.bpm, State.trackAnalysis.timingConfidence.overall
  );
  const authoredSpeedTimeline = new WormholeAuthoredSpeedTimeline();
  authoredSpeedTimeline.reset(START_TIME_SEC, fromPresetTuning.wormholeSpeed);
  const distances = [];
  const frameBounds = [];

  for (let frameIndex = 0; frameIndex < WARMUP_FRAMES + POST_SWITCH_FRAMES; frameIndex++) {
    const timeSec = START_TIME_SEC + frameIndex * DELTA_SEC;
    const speed = frameIndex < WARMUP_FRAMES
      ? fromPresetTuning.wormholeSpeed
      : toPresetTuning.wormholeSpeed;
    // Mirrors CosmicWormholeIdentity.travelDistanceAt(): transport.distanceAt(timeSec) plus the
    // analytic authored-speed offset, clamped at zero (lines 822-829 in the current source).
    distances.push(Math.max(0,
      transport.distanceAt(timeSec) + authoredSpeedTimeline.offsetAt(timeSec, speed, morphDurationSec)
    ));
    const baseFrameDistance = transport.distanceAt(timeSec + DELTA_SEC) - transport.distanceAt(timeSec);
    const authoredFrameBound = 96 * Math.max(fromPresetTuning.wormholeSpeed, toPresetTuning.wormholeSpeed) * DELTA_SEC;
    frameBounds.push(baseFrameDistance + authoredFrameBound);
  }
  return { distances, frameBounds };
}

test('B1: scripted morph travel distance stays non-decreasing and frame-continuous', () => {
  for (const [fromName, toName] of [['spiral', 'drive'], ['spiral', 'overdrive'], ['overdrive', 'drift']]) {
    const { distances, frameBounds } = travelSeries(PRESETS[fromName], PRESETS[toName]);
    for (let index = 1; index < distances.length; index++) {
      const delta = distances[index] - distances[index - 1];
      assert.ok(delta >= -1e-9, `${fromName}->${toName} travel decreased by ${delta} at frame ${index}`);
      assert.ok(
        delta < frameBounds[index] * 3,
        `${fromName}->${toName} travel jumped ${delta} at frame ${index} (3x bound ${frameBounds[index] * 3})`
      );
    }
  }
});

test('B2: drive -> punch stays below the visible-star displacement threshold on a straight route', () => {
  const result = measuredPair('drive', 'punch');
  assert.ok(
    result.maxDeltaPx <= MAX_STAR_DELTA_PX,
    `drive->punch max visible-star delta ${result.maxDeltaPx.toFixed(3)}px exceeded ${MAX_STAR_DELTA_PX.toFixed(3)}px`
  );
});

test('T1 (RC1/RC2): spiral -> drive has no visible-star displacement above the frame threshold', () => {
  const result = measuredPair('spiral', 'drive');
  assert.ok(result.maxDeltaPx <= MAX_STAR_DELTA_PX,
    `spiral->drive max delta ${result.maxDeltaPx.toFixed(3)}px at frame ${result.maxDeltaFrame}, star ${result.maxDeltaStar}`);
});

test('T2: the remaining curved preset pairs stay below the visible-star displacement threshold', () => {
  for (const [fromName, toName] of [['spiral', 'overdrive'], ['overdrive', 'drift']]) {
    const result = measuredPair(fromName, toName);
    assert.ok(result.maxDeltaPx <= MAX_STAR_DELTA_PX,
      `${fromName}->${toName} max delta ${result.maxDeltaPx.toFixed(3)}px at frame ${result.maxDeltaFrame}, star ${result.maxDeltaStar}`);
  }
});

test('T3 (RC3): at most 2% of visible stars cross the motion fade gate after a switch', () => {
  for (const [fromName, toName] of [['spiral', 'drive'], ['spiral', 'overdrive'], ['overdrive', 'drift']]) {
    const result = measuredPair(fromName, toName);
    assert.ok(result.maxFadeRatio <= 0.02,
      `${fromName}->${toName} peak 20-frame fade ratio was ${(result.maxFadeRatio * 100).toFixed(3)}%`);
  }
});

test('distance-smoothed turn and parallax stay frame-continuous through a scripted spiral -> drive morph', () => {
  const route = new IntegratedWormholeRoute();
  const startDistance = 1000;
  const frameDistance = 240 / FPS;
  route.reset(startDistance, PRESETS.spiral.wormholePathBend);
  let previousTurn = route.smoothedTurnIntensity(startDistance);
  let previousParallax = wormholeParallaxStrength(previousTurn);
  let maxTurnDelta = 0;
  let maxParallaxDelta = 0;

  for (let frameIndex = 1; frameIndex <= WARMUP_FRAMES + POST_SWITCH_FRAMES; frameIndex++) {
    const distance = startDistance + frameIndex * frameDistance;
    const morphT = frameIndex <= WARMUP_FRAMES
      ? 0
      : Math.min(1, (frameIndex - WARMUP_FRAMES) / POST_SWITCH_FRAMES);
    const bend = PRESETS.spiral.wormholePathBend
      + (PRESETS.drive.wormholePathBend - PRESETS.spiral.wormholePathBend) * morphT;
    route.advance(distance, bend);
    const turn = route.smoothedTurnIntensity(distance);
    const parallax = wormholeParallaxStrength(turn);
    maxTurnDelta = Math.max(maxTurnDelta, Math.abs(turn - previousTurn));
    maxParallaxDelta = Math.max(maxParallaxDelta, Math.abs(parallax - previousParallax));
    previousTurn = turn;
    previousParallax = parallax;
  }

  assert.ok(maxTurnDelta <= 0.02, `smoothed turn delta ${maxTurnDelta} exceeded 0.02`);
  assert.ok(maxParallaxDelta <= 0.015, `parallax delta ${maxParallaxDelta} exceeded 0.015`);
});

test('distance-smoothed turn is materially stronger on a developed arc than at its boundary', () => {
  const route = new IntegratedWormholeRoute();
  route.reset(0, PRESETS.spiral.wormholePathBend);
  const boundaryTurn = route.smoothedTurnIntensity(0);
  for (let distance = 60; distance <= 7200; distance += 60) {
    route.advance(distance, PRESETS.spiral.wormholePathBend);
  }
  const developedTurn = route.smoothedTurnIntensity(7200);
  assert.ok(
    developedTurn > boundaryTurn * 1.1,
    `expected developed smoothed turn ${developedTurn} to exceed boundary ${boundaryTurn}`
  );
});

test('Task03 A: extreme low speed + silent audio does not reset the route camera mid-playback', () => {
  // Regression scenario (Task 03 background): wormholeSpeed pinned at the UI minimum (0.1) plus a
  // silent/low-confidence audio window can push the combined travel rate (transport rate ~54-60
  // u/s minus authored offset rate -86.4 u/s at speed 0.1) negative for a short stretch, which used
  // to make IntegratedWormholeRoute.advance() treat the tiny backward step as a seek and reset the
  // camera (heading -> 0, history cleared) every single frame of the dip.
  const SAMPLE_RATE = 48000, HOP = 1024;
  const hopSec = HOP / SAMPLE_RATE;
  const loud = () => ({
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(0.9), ...new Array(16).fill(0.1)], state: 'HIGH'
  });
  const silent = () => ({
    e: 0, eRatio: 0, densityProj: 0, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0), state: 'IDLE'
  });

  // Warmup builds a well-developed, non-zero heading (so a reset's heading-zeroing is
  // detectable); the dip is the degenerate silent+min-speed window; the tail confirms recovery.
  const WARM_SEC = 3, DIP_SEC = 0.5, TAIL_SEC = 3;
  const warmCount = Math.ceil(WARM_SEC / hopSec);
  const dipCount = Math.ceil(DIP_SEC / hopSec);
  const tailCount = Math.ceil(TAIL_SEC / hopSec);
  const frames = [
    ...Array.from({ length: warmCount }, loud),
    ...Array.from({ length: dipCount }, silent),
    ...Array.from({ length: tailCount }, loud)
  ];
  const features = frames.map(() => (
    { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 }
  ));

  const transport = new WormholeTransport();
  transport.sync(frames, SAMPLE_RATE, HOP, [], features, 128, 0); // timingConfidence = 0 throughout
  const speedTimeline = new WormholeAuthoredSpeedTimeline();
  speedTimeline.reset(0, 1.0);
  const morphDurationSec = 0.2; // fast morph: the offset reaches its steady authored rate quickly
  const targetSpeedAt = (t) => (t >= WARM_SEC && t < WARM_SEC + DIP_SEC) ? 0.1 : 1.0;
  const travelDistanceAt = (t) => Math.max(
    0, transport.distanceAt(t) + speedTimeline.offsetAt(t, targetSpeedAt(t), morphDurationSec)
  );

  const bend = 0.4; // spiral bend, so a reset's heading-zeroing is detectable
  const route = new IntegratedWormholeRoute();
  const FPS = 60;
  const frameOut = { positionX: 0, positionY: 0, tangentX: 0, tangentY: 1, normalX: 1, normalY: 0, headingAngle: 0, curvature: 0, turnIntensity: 0 };
  route.reset(travelDistanceAt(0), bend);
  let previousHeading = route.sample(travelDistanceAt(0), frameOut).headingAngle;
  let previousDistance = travelDistanceAt(0);
  let sawLocalDecrease = false;
  let headingAtDipStart = null;

  const totalFrames = Math.round((WARM_SEC + DIP_SEC + TAIL_SEC) * FPS) - 1;
  assert.ok(totalFrames >= 300, `test window must cover at least 300 frames (got ${totalFrames})`);

  for (let step = 1; step <= totalFrames; step++) {
    const timeSec = step / FPS;
    const distance = travelDistanceAt(timeSec);
    if (distance < previousDistance - 1e-9) sawLocalDecrease = true;

    route.advance(distance, bend);
    const heading = route.sample(distance, frameOut).headingAngle;
    if (headingAtDipStart === null && timeSec >= WARM_SEC) headingAtDipStart = previousHeading;

    const deltaHeading = Math.abs(heading - previousHeading);
    const deltaDistance = Math.abs(distance - previousDistance);
    assert.ok(
      deltaHeading <= ROUTE_CURVATURE * deltaDistance + 1e-6,
      `heading jumped by ${deltaHeading} at frame ${step} (|Δd|=${deltaDistance}, `
      + `bound=${(ROUTE_CURVATURE * deltaDistance + 1e-6).toFixed(8)})`
    );
    assert.ok(
      !(Math.abs(previousHeading) > 0.005 && heading === 0),
      `route camera appears to have reset at frame ${step}: heading snapped from ${previousHeading} to exactly 0`
    );

    previousHeading = heading;
    previousDistance = distance;
  }

  assert.ok(Math.abs(headingAtDipStart) > 0.005, `expected a well-developed heading before the dip (got ${headingAtDipStart})`);
  if (sawLocalDecrease) {
    assert.ok(sawLocalDecrease, 'travel distance locally decreased during the silent/min-speed dip, as expected');
  } else {
    console.log('[Task03-A] synthetic scenario never produced a local travel decrease; this run documents the regression floor instead');
  }
});

test('Task04: seek to a converged mid-turn position introduces no star jump between post-seek frames', () => {
  // 200 frames of spiral playback, seek 30s forward, then check frame-to-frame continuity of the
  // first 5 post-seek frames -- explicitly excluding the seek's own (legitimate) picture change.
  const frames = runSeekScenario(PRESETS.spiral, { preSeekFrames: 200, postSeekFrames: 5, seekAheadSec: 30 });
  let maxDeltaPx = 0;
  let maxDeltaFrame = -1;
  let maxDeltaStar = -1;
  for (let frameIndex = 1; frameIndex < frames.length; frameIndex++) {
    const previous = frames[frameIndex - 1];
    const current = frames[frameIndex];
    for (let starIndex = 0; starIndex < STAR_COUNT; starIndex++) {
      const before = previous[starIndex];
      const after = current[starIndex];
      if (before.alpha < VISIBLE_ALPHA_FLOOR || after.alpha < VISIBLE_ALPHA_FLOOR) continue;
      const delta = Math.hypot(after.sx - before.sx, after.sy - before.sy);
      if (delta > maxDeltaPx) {
        maxDeltaPx = delta;
        maxDeltaFrame = frameIndex;
        maxDeltaStar = starIndex;
      }
    }
  }
  assert.ok(
    maxDeltaPx <= MAX_STAR_DELTA_PX,
    `post-seek frame-to-frame star jump ${maxDeltaPx.toFixed(3)}px at frame ${maxDeltaFrame}, star ${maxDeltaStar} `
    + `exceeded ${MAX_STAR_DELTA_PX.toFixed(3)}px`
  );
});

test('instrumentation report: deterministic before-values for the three repro pairs', () => {
  for (const [fromName, toName] of [['spiral', 'drive'], ['spiral', 'overdrive'], ['overdrive', 'drift']]) {
    const result = measuredPair(fromName, toName);
    console.log(
      `[wormhole-continuity] ${fromName}->${toName}: maxDeltaPx=${result.maxDeltaPx.toFixed(6)}, `
      + `fadeGateAtSwitch=${result.fadeGateAtSwitch}, fadeGateAtMaxJump=${result.fadeGateAtMaxJump}, `
      + `maxFadeRatio20=${result.maxFadeRatio.toFixed(6)}, trailToMotionRatio=${result.trailToMotionRatio.toFixed(6)}`
    );
  }
});

test('Task07: a negative (left) path bend moves the background starfield opposite a positive (right) bend, at comparable magnitude', () => {
  // Two full-identity renders that are identical in every respect except the sign of
  // wormholePathBend on the target preset. The per-star radial term in the star projection
  // (`starLateralX/Y`, proportional to each star's own x-position and to |turnIntensity|) is
  // bit-identical between the two runs -- it depends only on bend magnitude, never sign -- so it
  // contributes equally to both and cancels out of the mean. Only the shared route-drift term
  // flips sign with the bend, so the mean net lateral screen displacement across all visible stars
  // isolates that shared left/right steering cue.
  const rightTuning = { ...PRESETS.drive, wormholePathBend: 0.6 };
  const leftTuning = { ...PRESETS.drive, wormholePathBend: -0.6 };

  function meanLateralDelta(run) {
    const before = run.frames[run.switchFrameIndex];
    const after = run.frames[run.frames.length - 1];
    let sum = 0;
    let count = 0;
    for (let starIndex = 0; starIndex < STAR_COUNT; starIndex++) {
      const b = before[starIndex];
      const a = after[starIndex];
      if (b.alpha < VISIBLE_ALPHA_FLOOR || a.alpha < VISIBLE_ALPHA_FLOOR) continue;
      sum += a.sx - b.sx;
      count++;
    }
    assert.ok(count > 50, `too few visible stars to measure a stable mean (got ${count})`);
    return sum / count;
  }

  const rightMean = meanLateralDelta(runScriptedMorph(PRESETS.drive, rightTuning));
  const leftMean = meanLateralDelta(runScriptedMorph(PRESETS.drive, leftTuning));

  assert.ok(
    Math.sign(rightMean) !== Math.sign(leftMean),
    `expected opposite lateral directions, got right=${rightMean.toFixed(3)} left=${leftMean.toFixed(3)}`
  );
  const magnitudeRatio = Math.abs(leftMean) / Math.abs(rightMean);
  assert.ok(
    magnitudeRatio > 0.9 && magnitudeRatio < 1.1,
    `expected comparable magnitude (within +-10%), got right=${rightMean.toFixed(3)} left=${leftMean.toFixed(3)} ratio=${magnitudeRatio.toFixed(3)}`
  );
});

test('Task07: negative-bend spiral -> drive has no visible-star displacement above the frame threshold (mirrors T1/RC1/RC2)', () => {
  // Same regression T1 already guards for the shipped (right-turning) spiral preset, run again with
  // its bend sign flipped, so the continuity/seek fixes from Task 00/02/04 are proven for left turns
  // too, not just the one direction every shipped preset happened to use before Task 07.
  const spiralLeft = { ...PRESETS.spiral, wormholePathBend: -PRESETS.spiral.wormholePathBend };
  const result = measureContinuity(runScriptedMorph(spiralLeft, PRESETS.drive));
  assert.ok(result.maxDeltaPx <= MAX_STAR_DELTA_PX,
    `spiralLeft->drive max delta ${result.maxDeltaPx.toFixed(3)}px at frame ${result.maxDeltaFrame}, star ${result.maxDeltaStar}`);
});

test('Task09: spiral (+0.72) -> mirrored overdrive (-0.42) stays within the continuity harness threshold', () => {
  const mirroredOverdrive = { ...PRESETS.overdrive, wormholePathBend: -PRESETS.overdrive.wormholePathBend };
  const result = measureContinuity(runScriptedMorph(PRESETS.spiral, mirroredOverdrive));
  assert.ok(result.maxDeltaPx <= MAX_STAR_DELTA_PX,
    `spiral->mirroredOverdrive max delta ${result.maxDeltaPx.toFixed(3)}px at frame ${result.maxDeltaFrame}, star ${result.maxDeltaStar}`);
});

test('Task11: galaxy diagonal reveal -> sparse stays within the continuity harness threshold', () => {
  const result = measureContinuity(runScriptedMorph(PRESETS.galaxy, PRESETS.sparse));
  assert.ok(result.maxDeltaPx <= MAX_STAR_DELTA_PX,
    `galaxy->sparse max delta ${result.maxDeltaPx.toFixed(3)}px at frame ${result.maxDeltaFrame}, star ${result.maxDeltaStar}`);
});

test('Task11: drift left arc -> mirrored overdrive right arc stays within the continuity harness threshold', () => {
  const mirroredOverdrive = { ...PRESETS.overdrive, wormholePathBend: -PRESETS.overdrive.wormholePathBend };
  const result = measureContinuity(runScriptedMorph(PRESETS.drift, mirroredOverdrive));
  assert.ok(result.maxDeltaPx <= MAX_STAR_DELTA_PX,
    `drift->mirroredOverdrive max delta ${result.maxDeltaPx.toFixed(3)}px at frame ${result.maxDeltaFrame}, star ${result.maxDeltaStar}`);
});

test('Task07: seek into a negative-bend (left) turn introduces no star jump between post-seek frames (mirrors Task04)', () => {
  const spiralLeft = { ...PRESETS.spiral, wormholePathBend: -PRESETS.spiral.wormholePathBend };
  const frames = runSeekScenario(spiralLeft, { preSeekFrames: 200, postSeekFrames: 5, seekAheadSec: 30 });
  let maxDeltaPx = 0;
  let maxDeltaFrame = -1;
  let maxDeltaStar = -1;
  for (let frameIndex = 1; frameIndex < frames.length; frameIndex++) {
    const previous = frames[frameIndex - 1];
    const current = frames[frameIndex];
    for (let starIndex = 0; starIndex < STAR_COUNT; starIndex++) {
      const before = previous[starIndex];
      const after = current[starIndex];
      if (before.alpha < VISIBLE_ALPHA_FLOOR || after.alpha < VISIBLE_ALPHA_FLOOR) continue;
      const delta = Math.hypot(after.sx - before.sx, after.sy - before.sy);
      if (delta > maxDeltaPx) {
        maxDeltaPx = delta;
        maxDeltaFrame = frameIndex;
        maxDeltaStar = starIndex;
      }
    }
  }
  assert.ok(
    maxDeltaPx <= MAX_STAR_DELTA_PX,
    `negative-bend post-seek frame-to-frame star jump ${maxDeltaPx.toFixed(3)}px at frame ${maxDeltaFrame}, star ${maxDeltaStar} `
    + `exceeded ${MAX_STAR_DELTA_PX.toFixed(3)}px`
  );
});
