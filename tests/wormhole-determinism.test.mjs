import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

function loadTs(entry) {
  const cache = new Map();
  function load(filePath) {
    if (cache.has(filePath)) return cache.get(filePath).exports;
    const module = { exports: {} };
    cache.set(filePath, module);
    const output = ts.transpileModule(readFileSync(filePath, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    vm.runInContext(output, vm.createContext({
      exports: module.exports,
      module,
      require(request) {
        const base = normalize(join(dirname(filePath), request));
        return load(base.endsWith('.ts') ? base : `${base}.ts`);
      },
      Math,
      Number,
      Float64Array
    }), { filename: filePath });
    return module.exports;
  }
  return load(join(SRC_ROOT, entry));
}

const timeline = loadTs('visuals/WormholeTimeline.ts');
const grains = loadTs('visuals/WormholeGrainField.ts');
const { computeWormholeMotionProfile } = loadTs('visuals/WormholeMotionProfile.ts');

function frame(state = 'HIGH', low = 0.7) {
  return { e: 0.6, eRatio: 0.7, densityProj: 0.5, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(low), ...new Array(16).fill(0.1)], state };
}

test('canonical time selects export time and is independent from render FPS', () => {
  assert.equal(timeline.canonicalWormholeTime(12.5, false, 4), 12.5);
  assert.equal(timeline.canonicalWormholeTime(12.5, true, 4), 4);
  const transport = new timeline.WormholeTransport();
  const frames = Array.from({ length: 800 }, (_, index) => frame(index < 400 ? 'LOW' : 'HIGH'));
  transport.sync(frames, 48000, 1024);
  const timestamp = 9.375;
  const samples = [30, 60, 120].map(() => transport.distanceAt(timestamp));
  assert.deepEqual(samples, [samples[0], samples[0], samples[0]]);
});

test('live and export clocks produce the same travel geometry at the same song position', () => {
  const transport = new timeline.WormholeTransport();
  transport.sync(Array.from({ length: 800 }, () => frame('HIGH')), 48000, 1024);
  const songTime = 7.25;
  const liveTime = timeline.canonicalWormholeTime(songTime, false, 0);
  const exportTime = timeline.canonicalWormholeTime(99, true, songTime);
  assert.equal(transport.distanceAt(liveTime), transport.distanceAt(exportTime));
});

test('fixed-hop travel reconstructs after arbitrary seek history', () => {
  const transport = new timeline.WormholeTransport();
  const frames = Array.from({ length: 1200 }, (_, index) => frame(index % 91 < 20 ? 'LOW_DROP' : 'HIGH'));
  transport.sync(frames, 44100, 1024);
  const expected = transport.distanceAt(17.25);
  transport.distanceAt(2);
  transport.distanceAt(24);
  assert.equal(transport.distanceAt(17.25), expected);
});

test('fixed-hop distance integrates the shared motion travel-speed model', () => {
  const frames = Array.from({ length: 800 }, () => frame('HIGH'));
  const features = Array.from({ length: frames.length }, () => ({
    melody: 0, vocal: 0, fx: 0, density: 0.7, brightness: 0.5, tension: 0.5
  }));
  const slow = new timeline.WormholeTransport();
  const fast = new timeline.WormholeTransport();
  slow.sync(frames, 48000, 1024, [], features, 82, 0.9);
  fast.sync(frames, 48000, 1024, [], features, 174, 0.9);
  assert.ok(fast.distanceAt(8) > slow.distanceAt(8), 'motion.travelSpeed changes actual Z distance');
});

test('authored speed morph changes only future rate and stays monotonic', () => {
  const transport = new timeline.WormholeTransport();
  const frames = Array.from({ length: 1200 }, () => frame('HIGH'));
  transport.sync(frames, 48000, 1024);
  const speed = new timeline.WormholeAuthoredSpeedTimeline();
  speed.reset(0, 1);
  const distance = (time, target) => transport.distanceAt(time) + speed.offsetAt(time, target, 2);
  const beforeChange = distance(2, 1);
  const atChange = distance(2, 7.2);
  assert.equal(atChange, beforeChange, 'speed target change preserves accumulated distance');
  let previous = atChange;
  for (let frameIndex = 1; frameIndex <= 240; frameIndex++) {
    const current = distance(2 + frameIndex / 120, 7.2);
    assert.ok(current > previous, `travel remains forward at frame ${frameIndex}`);
    previous = current;
  }
});

test('mirrored horizontal bend morph has deterministic canonical travel and route samples', () => {
  const transport = new timeline.WormholeTransport();
  transport.sync(Array.from({ length: 1200 }, () => frame('HIGH')), 48000, 1024);
  const speed = new timeline.WormholeAuthoredSpeedTimeline();
  speed.reset(0, 1);
  const sampleRun = () => Array.from({ length: 121 }, (_, index) => {
    const time = 2 + index / 60;
    const progress = index / 120;
    const distance = transport.distanceAt(time) + speed.offsetAt(time, 4.8, 2);
    const bend = 0.72 + (-0.42 - 0.72) * progress;
    return { distance, frame: grains.sampleWormholeRouteFrame(distance, bend) };
  });
  assert.deepEqual(sampleRun(), sampleRun());
});

test('authored speed timeline is equivalent at 30, 60, and 120 FPS', () => {
  const endOffsets = [30, 60, 120].map((fps) => {
    const speed = new timeline.WormholeAuthoredSpeedTimeline();
    speed.reset(0, 1);
    for (let frameIndex = 0; frameIndex <= fps * 6; frameIndex++) {
      const time = frameIndex / fps;
      speed.offsetAt(time, time < 2 ? 1 : 9, 1.5);
    }
    return speed.offsetAt(6, 9, 1.5);
  });
  assert.ok(Math.abs(endOffsets[0] - endOffsets[1]) < 1e-9);
  assert.ok(Math.abs(endOffsets[1] - endOffsets[2]) < 1e-9);
});

test('authored speed timeline ignores float jitter without anchor spam or distance discontinuity', () => {
  const speed = new timeline.WormholeAuthoredSpeedTimeline();
  speed.reset(0, 1);
  for (let frameIndex = 1; frameIndex <= 1200; frameIndex++) {
    const jitter = Math.sin(frameIndex * 1.713) * 0.019;
    speed.offsetAt(frameIndex / 120, 1 + jitter, 1);
  }
  assert.equal(speed.anchorCount(), 1, 'sub-quantum float/playback noise must not write anchors');

  const before = speed.offsetAt(10, 1, 1);
  const atChange = speed.offsetAt(10, 1.1, 1);
  assert.equal(atChange, before, 'an intentional speed change preserves accumulated distance');
  assert.equal(speed.anchorCount(), 2);
  assert.ok(speed.offsetAt(11, 1.1, 1) > atChange);
});

test('quantized playback-fade ramps stay within the bounded anchor capacity', () => {
  const speed = new timeline.WormholeAuthoredSpeedTimeline();
  speed.reset(0, 1);
  for (let frameIndex = 1; frameIndex <= 1200; frameIndex++) {
    const progress = frameIndex / 1200;
    speed.offsetAt(progress * 10, 1 + progress * 9, 0.5);
  }
  assert.ok(speed.anchorCount() <= 181, `unexpected anchor count: ${speed.anchorCount()}`);
});

test('speed timeline safely re-anchors before its earliest known song position', () => {
  const speed = new timeline.WormholeAuthoredSpeedTimeline();
  speed.reset(100, 1);
  assert.equal(speed.offsetAt(50, 2, 1), 0);
  assert.ok(speed.offsetAt(60, 2, 1) > 0);
  assert.ok(Number.isFinite(speed.offsetAt(70, 3, 1)));
});

function presetTuning(role) {
  return JSON.parse(
    readFileSync(join(process.cwd(), `public/visual-tuning-presets/vos-wh-${role}.json`), 'utf8')
  ).visualTuning;
}

/** Mirrors CosmicWormholeIdentity.travelDistanceAt: canonical base plus the anchored authored offset. */
function makeTravelDistance(frames, features, bpm, confidence) {
  const transport = new timeline.WormholeTransport();
  transport.sync(frames, 48000, 1024, [], features, bpm, confidence);
  const speed = new timeline.WormholeAuthoredSpeedTimeline();
  let currentTarget = null;
  return {
    reset(timeSec, targetSpeed) {
      currentTarget = targetSpeed;
      speed.reset(timeSec, targetSpeed);
    },
    at(timeSec, targetSpeed, durationSec = 3) {
      currentTarget = targetSpeed;
      return Math.max(0, transport.distanceAt(timeSec) + speed.offsetAt(timeSec, targetSpeed, durationSec));
    },
    target: () => currentTarget
  };
}

function longFrameSet(count = 12000) {
  const frames = Array.from({ length: count }, () => frame('HIGH', 0.7));
  const features = Array.from({ length: count }, () => (
    { melody: 0, vocal: 0, fx: 0, density: 0.7, brightness: 0.5, tension: 0.5 }
  ));
  return { frames, features };
}

test('forward-only: raising wormholeSpeed never decreases travel distance', () => {
  const { frames, features } = longFrameSet();
  const travel = makeTravelDistance(frames, features, 128, 0.9);
  travel.reset(0, 1);
  let previous = travel.at(0, 1);
  for (let step = 1; step <= 3000; step++) {
    const t = step / 30;
    const targetSpeed = 1 + Math.min(9, t * 0.5); // ramps 1 -> 10 over the run
    const current = travel.at(t, targetSpeed);
    assert.ok(current >= previous, `distance decreased at t=${t}: ${previous} -> ${current}`);
    previous = current;
  }
});

test('forward-only: lowering wormholeSpeed never decreases travel distance', () => {
  const { frames, features } = longFrameSet();
  const travel = makeTravelDistance(frames, features, 128, 0.9);
  travel.reset(0, 9.0);
  let previous = travel.at(0, 9.0);
  for (let step = 1; step <= 3000; step++) {
    const t = step / 30;
    const targetSpeed = Math.max(0.1, 9 - t * 0.05); // ramps 9 -> 0.1 over the run
    const current = travel.at(t, targetSpeed);
    assert.ok(current >= previous, `distance decreased at t=${t}: ${previous} -> ${current}`);
    previous = current;
  }
});

test('low-speed drift/dissolve/galaxy presets still make positive forward progress within one second', () => {
  const { frames, features } = longFrameSet();
  for (const role of ['drift', 'dissolve', 'galaxy']) {
    const tuning = presetTuning(role);
    const travel = makeTravelDistance(frames, features, 128, 0.9);
    travel.reset(10, tuning.wormholeSpeed);
    const before = travel.at(10, tuning.wormholeSpeed);
    const after = travel.at(11, tuning.wormholeSpeed);
    assert.ok(after > before, `${role} must drift forward within 1s (before=${before}, after=${after})`);
  }
});

test('authored preset-pair transitions never produce a backward travel delta', () => {
  const pairs = [
    ['drive', 'punch'],
    ['spiral', 'overdrive'],
    ['overdrive', 'drift'],
    ['dissolve', 'drift']
  ];
  for (const [fromRole, toRole] of pairs) {
    const { frames, features } = longFrameSet();
    const fromSpeed = presetTuning(fromRole).wormholeSpeed;
    const toSpeed = presetTuning(toRole).wormholeSpeed;
    const travel = makeTravelDistance(frames, features, 128, 0.9);
    travel.reset(0, fromSpeed);
    let previous = travel.at(0, fromSpeed);
    for (let step = 1; step <= 9000; step++) {
      const t = step / 30;
      const targetSpeed = t < 20 ? fromSpeed : toSpeed; // switch mid-run, well inside the analyzed range
      const current = travel.at(t, targetSpeed);
      assert.ok(current >= previous, `${fromRole}->${toRole} decreased at t=${t}: ${previous} -> ${current}`);
      previous = current;
    }
  }
});

test('travel distance extrapolates past the analyzed range instead of freezing', () => {
  const { frames, features } = longFrameSet(600); // short analysis window (~12.8s)
  const transport = new timeline.WormholeTransport();
  transport.sync(frames, 48000, 1024, [], features, 128, 0.9);
  const trackDuration = frames.length * 1024 / 48000;
  const atEnd = transport.distanceAt(trackDuration);
  const beyond = transport.distanceAt(trackDuration + 5);
  assert.ok(beyond > atEnd, 'distance keeps advancing beyond the last analyzed hop instead of freezing');
});

test('a preset transition stays forward-only even as playback runs past the analyzed range', () => {
  // Regression: once the base canonical distance stalled past the LUT's covered duration, a
  // lower authored target speed used to pull the combined travel distance backward.
  const { frames, features } = longFrameSet(600);
  const travel = makeTravelDistance(frames, features, 128, 0.9);
  travel.reset(0, 9.0);
  let previous = travel.at(0, 9.0);
  for (let step = 1; step <= 900; step++) {
    const t = step / 20; // runs to 45s, well past the ~12.8s analyzed window
    const targetSpeed = t < 10 ? 9.0 : 0.1;
    const current = travel.at(t, targetSpeed);
    assert.ok(current >= previous, `decreased at t=${t}: ${previous} -> ${current}`);
    previous = current;
  }
});

test('path bend is a pure function of route distance and zero keeps the fixed-lens baseline', () => {
  const zero = grains.sampleWormholeRoute(4200, 0.45, 0);
  assert.deepEqual(Object.values(zero), [0, 0, 0, 0]);
  for (const value of Object.values(zero)) assert.equal(Object.is(value, -0), false, 'baseline uses positive zero');
  const lens = grains.sampleWormholeRoute(4200, 0, 1);
  const middle = grains.sampleWormholeRoute(4200, 0.5, 1);
  const horizon = grains.sampleWormholeRoute(4200, 1, 1);
  assert.ok(Math.hypot(lens.offsetX, lens.offsetY) > 0.01, 'lens endpoint keeps the shared centreline readable');
  assert.ok(Math.hypot(horizon.offsetX, horizon.offsetY) > 0.01, 'far endpoint keeps the shared centreline readable');
  assert.ok(Math.hypot(middle.offsetX, middle.offsetY) >= Math.hypot(lens.offsetX, lens.offsetY));
  assert.ok(Math.hypot(middle.offsetX, middle.offsetY) >= Math.hypot(horizon.offsetX, horizon.offsetY));
  const value = grains.sampleWormholeRoute(4200, 0.45, 0.7);
  assert.deepEqual(value, grains.sampleWormholeRoute(4200, 0.45, 0.7));
  assert.notDeepEqual(value, grains.sampleWormholeRoute(5300, 0.45, 0.7));
});

test('route tangent is smooth, locally forward-stable, and non-periodic', () => {
  const bend = 0.6;
  const step = 20;
  let hardReversals = 0;
  let previous = grains.sampleWormholeRoute(0, 0.5, bend);
  for (let distance = step; distance <= 12000; distance += step) {
    const current = grains.sampleWormholeRoute(distance, 0.5, bend);
    const previousLength = Math.hypot(previous.tangentX, previous.tangentY);
    const currentLength = Math.hypot(current.tangentX, current.tangentY);
    if (previousLength > 1e-5 && currentLength > 1e-5) {
      const correlation = (previous.tangentX * current.tangentX + previous.tangentY * current.tangentY)
        / (previousLength * currentLength);
      if (correlation < -0.25) hardReversals++;
      assert.ok(correlation > -0.8, `abrupt route reversal at distance ${distance}: ${correlation}`);
    }
    previous = current;
  }
  assert.ok(hardReversals <= 2, `route direction reversed too often: ${hardReversals}`);
  assert.notDeepEqual(
    grains.sampleWormholeRoute(1500, 0.5, bend),
    grains.sampleWormholeRoute(10500, 0.5, bend),
    'the visible arc segment must not collapse to a repeated short wave'
  );
});

test('curved presets have measurable mid-depth displacement and tangent', () => {
  const spiral = presetTuning('spiral');
  const route = grains.sampleWormholeRoute(4200, 0.5, spiral.wormholePathBend);
  assert.ok(Math.hypot(route.offsetX, route.offsetY) > 0.05, JSON.stringify(route));
  assert.ok(Math.hypot(route.tangentX, route.tangentY) > 0.02, JSON.stringify(route));
});

test('camera-relative route frame is an exact zero-bend baseline', () => {
  const route = grains.sampleWormholeRouteFrame(12000, 0.8);
  const camera = grains.sampleWormholeRouteFrame(5100, 0.8);
  const dx = route.positionX - camera.positionX;
  const dy = route.positionY - camera.positionY;
  const relative = {
    x: dx * camera.normalX + dy * camera.normalY,
    z: dx * camera.tangentX + dy * camera.tangentY
  };
  assert.ok(Math.abs(relative.x) > 1e-3);
  assert.ok(relative.z > 1000);

  const zeroRoute = grains.sampleWormholeRouteFrame(4200, 0);
  const zeroCamera = grains.sampleWormholeRouteFrame(1100, 0);
  const zeroDx = zeroRoute.positionX - zeroCamera.positionX;
  const zeroDy = zeroRoute.positionY - zeroCamera.positionY;
  assert.deepEqual(
    [zeroDx * zeroCamera.normalX + zeroDy * zeroCamera.normalY, zeroDx * zeroCamera.tangentX + zeroDy * zeroCamera.tangentY],
    [0, 3100],
    'zero bend remains an exact camera-local straight baseline'
  );
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /this\.routePath\.sample\(distanceNow \+ z, this\.routeNow\)/);
  assert.match(source, /this\.routePath\.sample\(distanceNow, this\.baseRouteNow\)/);
  assert.match(source, /projectWormholeTubePoint\(\s*\r?\n?\s*this\.routeNow, this\.baseRouteNow, z, projectedThetaNow, projectedRadiusNow, routeTurnVisualGain/);
  assert.doesNotMatch(source, /sampleWormholeRoute\(|wormholeViewerRelativeRoute|VIEWER_ROUTE_LOOKAHEAD|FOREGROUND_ROUTE_SCREEN_SCALE/);

  // The pure projection math itself: the grain's own radial contribution (what draws the circle) is
  // projected through the camera frame at full strength; only the shared, theta-independent
  // route-curvature drift term may be damped by `routeDriftWeight`, so scaling can never bias the
  // circle's shape.
  const grainFieldSource = readFileSync(join(SRC_ROOT, 'visuals/WormholeGrainField.ts'), 'utf8');
  assert.match(grainFieldSource, /radialWorldX \* baseRouteNow\.normalX \+ radialWorldY \* baseRouteNow\.normalY/);
  assert.match(grainFieldSource, /routeDriftX \* baseRouteNow\.normalX \+ routeDriftY \* baseRouteNow\.normalY\)\s*\r?\n?\s*\*\s*depthDriftWeight/);
});

test('background layers use the same route-local travel frame, not screen rotation', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /this\.routePath\.advance\(camZ, effectivePathBend\)/);
  assert.match(source, /this\.routePath\.sample\(camZ, this\.baseRouteNow\)/);
  assert.match(source, /const starDepthTravel = camZ \* STAR_SPEED_RATIO/);
  assert.match(source, /const starPrevCamZ = Math\.max\(0, camZ - vzStar\)/);
  assert.match(source, /this\.routePath\.sample\(starPrevCamZ, this\.baseRoutePrev\)/);
  assert.match(source, /this\.routePath\.sampleSmoothedLookahead\(camZ \+ z, this\.routeNow\)/);
  assert.match(source, /const starLateralX = star\.x \* STAR_ROUTE_WORLD_SCALE \* starParallax \* this\.routeNow\.normalX/);
  assert.match(source, /const prevStarLateralX = star\.x \* STAR_ROUTE_WORLD_SCALE \* starParallaxPrev \* this\.routePrev\.normalX/);
  assert.match(source, /const galaxyDepthTravel = camZ \* GALAXY_SPEED_RATIO/);
  assert.match(source, /this\.routePath\.sampleSmoothedLookahead\(camZ \+ gz, this\.routeNow\)/);
  assert.match(source, /const gLateralX = galaxy\.x \* GALAXY_ROUTE_WORLD_SCALE \* galaxyParallax \* this\.routeNow\.normalX/);
  assert.doesNotMatch(source, /BACKGROUND_ROUTE_FOLLOW_SCALE|sampleWormholeBackgroundViewerFrame|wormholeBackgroundWorldRelative|backgroundViewer/);
  assert.doesNotMatch(source, /sampleWormholeRouteFrame\(starDepthTravel|sampleWormholeRouteFrame\(galaxyDepthTravel/);
  assert.doesNotMatch(source, /STAR_ROTATION_GAIN|GALAXY_ROTATION_GAIN|SKYBOX_ROTATION_GAIN/);

  // No additive screen-space offset/rotation may reappear as the background cue.
  assert.doesNotMatch(source, /\+ starTurnX|\+ galaxyTurnX|panX|panY/);
  assert.doesNotMatch(source, /wormholeRotateAroundCenter|wormholeBackgroundTurnAngle|backgroundTurnAngle/);
});

test('stars and galaxies fade out through the near-plane zone instead of projecting an unbounded position', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  // A star's/galaxy's depth cycles through the near plane every generation, same as grains; unlike
  // grains (which cull via `wormholeNearPlaneVisibility` and `continue`), background layers must not
  // skip the draw call outright (that would desync `backend.lines[]` from the star pool index), so
  // this is expressed as an alpha fade plus a floored projection depth instead.
  assert.match(source, /wormholeNearPlaneVisibility\(z, MAX_STAR_Z\)/);
  assert.match(source, /wormholeNearPlaneVisibility\(gz, MAX_GALAXY_Z\)/);
  assert.match(source, /STAR_PROJECTION_Z_FLOOR/);
  assert.match(source, /GALAXY_PROJECTION_Z_FLOOR/);
  assert.match(source, /sAlpha[^;]*starNearVisibility/);
  assert.match(source, /gAlpha[^;]*gNearVisibility/);
});

test('background route frame keeps deep layers curved without tunnel depth anchoring', () => {
  const distance = 7350;
  const bend = 0.72;
  const foreground = grains.sampleWormholeRouteFrame(distance, bend);
  const background = grains.sampleWormholeRouteFrame(distance, bend);
  assert.deepEqual(foreground, background);
  assert.ok(Math.abs(background.headingAngle) > 0.1, JSON.stringify(background));
  assert.ok(Math.abs(background.positionX) > 10, JSON.stringify(background));
  assert.equal(grains.sampleWormholeRouteFrame(distance, 0).positionX, 0);
  assert.equal(grains.sampleWormholeRouteFrame(distance, 0).headingAngle, 0);
});

test('disabled starfield skips the complete star projection and route-sampling hot path', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  const guard = source.indexOf('if (starAmount > 0)');
  const loop = source.indexOf('for (let i = 0; i < this.starPool.length; i++)', guard);
  const colorSection = source.indexOf('// --- Color:', loop);
  assert.ok(guard > 0 && loop > guard && colorSection > loop);
  assert.ok(source.indexOf('sampleWormholeRoute(camZ + z', guard) < colorSection);
});

test('grain projection samples real current and previous route positions without moving the lens', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /const cx = backend\.width \/ 2;\s*const cy = backend\.height \/ 2;/);
  assert.match(source, /this\.routePath\.sample\(distanceNow \+ z, this\.routeNow\)/);
  assert.match(source, /this\.routePath\.sample\(distancePrev \+ prevZ, this\.routePrev\)/);
  assert.match(source, /this\.routePath\.sample\(distanceNow, this\.baseRouteNow\)/);
  assert.match(source, /this\.routePath\.sample\(distancePrev, this\.baseRoutePrev\)/);
  assert.match(source, /wormholeTransitionEnergy\(\s*grain\.seed, frameTick, transitionEnvelope, liveEnergy, depthT/);
  assert.doesNotMatch(source, /distanceNow \+ routeDepthNow|distancePrev \+ routeDepthPrev/);
  assert.doesNotMatch(source, /wormholeViewerRelativeRoute|FOREGROUND_ROUTE_SCREEN_SCALE/);
  assert.doesNotMatch(source, /cx\s*[+\-]=|cy\s*[+\-]=/);
});

test('foreground and background projection use pure camera-local transform, no heading-shear compensation', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  // The tube/star/galaxy cross-section must come from a plain camera-local dot-product transform
  // (right/up/forward basis), never an extra heading-delta shear term layered on top of it -- that
  // shear is exactly what compressed the tube's circular cross-section into an ellipse.
  assert.doesNotMatch(source, /FOREGROUND_HEADING_COMPENSATION|BACKGROUND_HEADING_COMPENSATION/);
  assert.doesNotMatch(source, /FOREGROUND_ROUTE_WORLD_SCALE/);
  assert.doesNotMatch(source, /headingDelta\w*\s*\*\s*z\b|headingDelta\w*\s*\*\s*prevZ\b|headingDelta\w*\s*\*\s*gz\b/);
});

test('release and sync geometry snapshot the rendered tuning, never the morph target', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /snapshotGrainGeometry\(grain, State\.visualTuning, (?:safeTime|timeSec)\)/);
  assert.doesNotMatch(source, /snapshotGrainGeometry\(grain, State\.targetTuning/);
});

test('transition turbulence is deterministic, per-grain decorrelated, spectral, and depth-local', () => {
  const seed = 12.9898;
  const time = 18.25;
  const a = grains.wormholeTransitionEnergy(seed, time, 1, 0.8, 0.18);
  const b = grains.wormholeTransitionEnergy(seed, time, 1, 0.8, 0.18);
  assert.deepEqual(a, b, 'same seed/time/envelope/band/depth must produce identical turbulence');
  const zero = grains.wormholeTransitionEnergy(seed, time, 0, 0.8, 0.18);
  assert.equal(JSON.stringify(zero), JSON.stringify(
    { angularOffset: 0, radiusScale: 1, alphaScale: 1, strokeScale: 1, amplitude: 0 }
  ), 'zero morph envelope must be an exact no-op');

  const other = grains.wormholeTransitionEnergy(seed + 12.9898, time, 1, 0.8, 0.18);
  assert.notDeepEqual(a, other, 'different grain seeds need decorrelated phases');

  const quiet = grains.wormholeTransitionEnergy(seed, time, 1, 0.05, 0.18);
  const deep = grains.wormholeTransitionEnergy(seed, time, 1, 0.8, 0.9);
  assert.ok(a.amplitude > quiet.amplitude, 'active spectrum band should strengthen transition energy');
  assert.ok(a.amplitude > deep.amplitude * 2, 'near-camera grains should receive stronger local turbulence than deep grains');
  assert.ok(a.alphaScale !== 1 || a.strokeScale !== 1, 'transition material flicker should affect alpha/stroke');
});

test('near-plane visibility culls close grains and projection caps stay finite', () => {
  const maxDepth = 2400;
  assert.equal(grains.wormholeNearPlaneVisibility(59, maxDepth), 0);
  assert.equal(grains.wormholeNearPlaneVisibility(maxDepth * 0.055, maxDepth), 1);
  assert.ok(grains.wormholeNearPlaneVisibility(90, maxDepth) > 0);
  assert.ok(grains.wormholeNearPlaneVisibility(90, maxDepth) < 1);
  assert.equal(grains.wormholeProjectedStrokeWeight(999), 4.5);
  const scale = grains.wormholeProjectedTrailScale(1000, 0, 1000);
  assert.equal(scale, 0.22);
  assert.ok(Math.hypot(1000 * scale, 0) <= 220);
});

test('route-local trail correction rejects every inward radial direction', () => {
  assert.equal(grains.wormholeBackwardTrailCorrection(10, 0, 5, 0), 0, 'tail behind head is already forward');
  const correction = grains.wormholeBackwardTrailCorrection(10, 0, 15, 4);
  assert.equal(correction, 0.5);
  const correctedTailX = 15 - 10 * correction;
  const correctedTailY = 4;
  const forwardDot = (10 - correctedTailX) * 10 + (0 - correctedTailY) * 0;
  assert.ok(forwardDot >= -1e-12, 'corrected tail-to-head vector cannot point inward');
});

test('kick envelope requires accepted low-band event evidence and freezes with song time', () => {
  const frames = Array.from({ length: 100 }, () => frame('HIGH', 0.9));
  const events = [{ time: 1, intensity: 1, type: 2 }];
  const first = timeline.wormholeKickEnvelopeAtTime(events, frames, 1.04, 48000, 1024);
  assert.ok(first > 0);
  assert.equal(timeline.wormholeKickEnvelopeAtTime([{ time: 1, intensity: 1, type: 3 }], frames, 1.04, 48000, 1024), 0);
  const highOnly = frames.map(() => frame('HIGH', 0));
  assert.equal(timeline.wormholeKickEnvelopeAtTime(events, highOnly, 1.04, 48000, 1024), 0);
  assert.equal(timeline.wormholeKickEnvelopeAtTime(events, frames, 1.04, 48000, 1024), first);
});

test('LOW_DROP variants are stable, diverse, partial, and disjoint from kick cohort', () => {
  const variants = new Set(Array.from({ length: 64 }, (_, id) => timeline.deterministicVariant(id, 6)));
  assert.equal(variants.size, 6);
  let lowDropCount = 0;
  for (let index = 1; index <= 1000; index++) {
    const grain = grains.createWormholeGrainCharacter(index * 12.9898);
    const lowDrop = grains.wormholeLowDropGain(grain, 1);
    if (lowDrop > 0) {
      lowDropCount++;
      assert.equal(grains.wormholeKickSwarmGain(grain, 1, 1), 0);
    }
  }
  assert.ok(lowDropCount > 100 && lowDropCount < 300, `partial LOW_DROP cohort: ${lowDropCount}`);
});

test('depth visibility floor is continuous and cannot override zero opacity', () => {
  assert.equal(grains.wormholeVisibilityFloor(0), 0);
  assert.ok(grains.wormholeVisibilityFloor(0.5) > grains.wormholeVisibilityFloor(0.2));
  assert.ok(grains.wormholeVisibilityFloor(0.5) > grains.wormholeVisibilityFloor(0.8));
  assert.ok(grains.wormholeVisibilityFloor(0.999) < 0.1);
  assert.ok(grains.wormholeVisibilityFloor(0.5) <= 8, 'floor stays below weak-preset material alpha');
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /const alpha = lineAlpha \* fade \* emissionGain \* Math\.max\(visibilityFloor, reactiveGrainAlpha\)/);
});

test('slow evolution is pure and stays within authored bounds at both confidence modes', () => {
  const base = {
    bpm: 128,
    currentFrame: frame(),
    currentFeatures: { melody: 0, vocal: 0, fx: 0, density: 0.5, brightness: 0.5, tension: 0.5 },
    perceptualSpectrum: frame().perceptualSpectrum,
    beatDecay: 0,
    denseImpactFlash: 0,
    directorOutput: { state: 'DROP', centripetalOrbit: 0, glitchIntensity: 0, invertBackground: false },
    bars: Array.from({ length: 12 }, (_, index) => ({ index, start: index * 2, end: index * 2 + 2 }))
  };
  for (const timingConfidence of [0.1, 0.9]) {
    for (const timeSec of [0, 3, 8, 13, 19, 31]) {
      const result = computeWormholeMotionProfile({ ...base, timingConfidence, timeSec });
      assert.ok(result.depthEvolution >= 0.94 && result.depthEvolution <= 1.06);
      assert.ok(result.densityEvolution >= 0.92 && result.densityEvolution <= 1.08);
      assert.ok(result.perspectiveEvolution >= 0.96 && result.perspectiveEvolution <= 1.04);
      assert.deepEqual(result, computeWormholeMotionProfile({ ...base, timingConfidence, timeSec }));
    }
  }
});

test('wormhole renderer has no frame counter or shared curve transform', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.doesNotMatch(source, /State\.rotationPhase|advanceDepthPhase|cameraTravelDist|curveImpulse/);
  assert.match(source, /canonicalWormholeTime/);
  assert.doesNotMatch(source, /wormholeRelease(?:LowDrop|Swarm)Offset/);
  assert.doesNotMatch(source, /baseOffset[XY]|updateSkyboxCamera/);
  assert.match(source, /wormholeBackwardTrailCorrection/);
});

test('route sampling and draw-time grain projection do not allocate path or grain objects', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  const drawBody = source.slice(source.indexOf('    draw('), source.indexOf('    private travelDistanceAt'));
  assert.doesNotMatch(drawBody, /this\.pool\.push|this\.starPool\.push|this\.galaxyPool\.push|createWormholeGrainCharacter/);
  assert.match(drawBody, /this\.routePath\.sample\([^;]+, this\.routeNow\)/);
  assert.match(drawBody, /this\.routePath\.sample\([^;]+, this\.routePrev\)/);
});

test('tunnel geometry release-samples canonical-time LFO parameters and has no live audio position multiplier', () => {
  // Regression guard: FOV/maxZ/radius/alpha/weight/vz previously read `motion.perspectiveCompression`,
  // `motion.depthPulse`, `motion.densityFill`, and the live `impact` (kick) scalar directly, making
  // the whole tunnel/field visibly "breathe" with every audio frame. Only the slow, bar-scale
  // `*Evolution` terms may still shape these; live per-frame audio must route through the release
  // snapshot (kickGain/bassGain/releaseDensity), never a direct geometry multiplier.
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /const fov = backend\.height \* 1\.2;/);
  assert.match(source, /this\.travelPhase = wrapDepthPhase\(travelDistance \/ Z_REFERENCE\);/);
  assert.match(source, /const vz = wormholeTrailSeparation\(canonicalRate, 1\);/);
  assert.match(source, /grain\.releaseRadius = effectiveWormholeGeometryValue\(/);
  assert.match(source, /grain\.releaseDepth = effectiveWormholeGeometryValue\(/);
  assert.match(source, /snapshotGrainGeometry\(grain, State\.visualTuning, timeSec\)/);
  assert.match(source, /const radius = 50 \* grain\.releaseRadius;/);
  assert.match(source, /const grainMaxZ = Z_REFERENCE \* grain\.releaseDepth;/);
  assert.match(source, /const projectedThetaNow = thetaNow \+ transitionEnergyNow\.angularOffset;/);
  assert.match(source, /const projectedRadiusNow = radius \* transitionEnergyNow\.radiusScale;/);
  assert.match(source, /\* transitionEnergyNow\.alphaScale/);
  assert.match(source, /\* transitionEnergyNow\.strokeScale/);
  assert.doesNotMatch(source, /const (fov|diagnosticMaxZ|vz|radius) = [^;]*(perspectiveCompression|depthPulse|densityFill|depthEvolution|perspectiveEvolution)/);
  assert.doesNotMatch(source, /reactiveGrainAlpha = [^;]*(motion\.densityFill|impact)/);
  assert.doesNotMatch(source, /wormholeProjectedStrokeWeight\(\s*\([^)]*impact/);
  // Bass must reach grain flow angle only through the stable per-grain release snapshot, never live.
  assert.doesNotMatch(source, /wormholeGrainFlowAngle\([^)]*motion\.bassWarp/);
  assert.match(source, /wormholeGrainFlowAngle\(\s*grain, depthT, grain\.releaseWarp, grain\.releaseCurve, grain\.releaseBass/);
  // Material (alpha/weight), unlike geometry, is meant to track the live per-band spectrum strongly
  // -- that is the circular-spectrograph identity, not a geometry change -- so `LIVE_GRAIN_SHIMMER`
  // must stay a live-dominant blend, not the old, near-silent shimmer.
  const shimmerMatch = source.match(/const LIVE_GRAIN_SHIMMER = ([\d.]+);/);
  assert.ok(shimmerMatch, 'expected a LIVE_GRAIN_SHIMMER constant');
  assert.ok(
    Number(shimmerMatch[1]) >= 0.5,
    `expected live spectrum to dominate grain material response, got LIVE_GRAIN_SHIMMER=${shimmerMatch[1]}`
  );
  assert.match(source, /grain\.releaseBandEnergy \* \(1 - LIVE_GRAIN_SHIMMER\) \+ liveEnergy \* LIVE_GRAIN_SHIMMER/);
});
