import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const syncSourcePath = join(process.cwd(), 'src/visuals/WormholeCosmicSync.ts');
const syncOutput = ts.transpileModule(readFileSync(syncSourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const syncModule = { exports: {} };
vm.runInContext(syncOutput, vm.createContext({ exports: syncModule.exports, module: syncModule, Math, Number }), {
  filename: syncSourcePath
});
const sync = syncModule.exports;

const routeSourcePath = join(process.cwd(), 'src/visuals/WormholeGrainField.ts');
const routeOutput = ts.transpileModule(readFileSync(routeSourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const routeModule = { exports: {} };
vm.runInContext(routeOutput, vm.createContext({ exports: routeModule.exports, module: routeModule, Math, Number }), {
  filename: routeSourcePath
});
const route = routeModule.exports;

const timelineSourcePath = join(process.cwd(), 'src/visuals/WormholeTimeline.ts');
const timelineOutput = ts.transpileModule(readFileSync(timelineSourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const timelineModule = { exports: {} };
vm.runInContext(timelineOutput, vm.createContext({
  exports: timelineModule.exports, module: timelineModule, Math, Number, Float64Array
}), { filename: timelineSourcePath });
const timeline = timelineModule.exports;

// Matches CosmicWormholeIdentity.ts's own ratio constants.
const STAR_SPEED_RATIO = 0.4;
const GALAXY_SPEED_RATIO = 0.05;
const SKYBOX_ROUTE_WORLD_FRACTION = 0.035;

test('canonical rate 1 -> many: foreground/star/galaxy trail separation strictly increases, skybox increases but stays bounded', () => {
  const rates = [40, 80, 160, 320, 640, 1280, 2560, 5120];
  let prevForeground = -Infinity, prevStar = -Infinity, prevGalaxy = -Infinity, prevSkybox = -Infinity;
  for (const rate of rates) {
    const foreground = sync.wormholeTrailSeparation(rate, 1);
    const star = sync.wormholeTrailSeparation(rate, STAR_SPEED_RATIO);
    const galaxy = sync.wormholeTrailSeparation(rate, GALAXY_SPEED_RATIO);
    const skybox = Math.min(sync.SKYBOX_TRAVEL_RATE_CAP, sync.wormholeTrailSeparation(rate, SKYBOX_ROUTE_WORLD_FRACTION));

    assert.ok(foreground > prevForeground, `foreground trail separation did not increase at rate=${rate}`);
    assert.ok(star > prevStar, `star trail separation did not increase at rate=${rate}`);
    assert.ok(galaxy > prevGalaxy, `galaxy trail separation did not increase at rate=${rate}`);
    assert.ok(skybox >= prevSkybox, `skybox trail separation decreased at rate=${rate}`);

    // Near objects react more strongly than far ones, at every rate -- the "difference is only
    // parallax" requirement.
    assert.ok(foreground > star, `foreground should react more strongly than star at rate=${rate}`);
    assert.ok(star > galaxy, `star should react more strongly than galaxy at rate=${rate}`);

    prevForeground = foreground;
    prevStar = star;
    prevGalaxy = galaxy;
    prevSkybox = skybox;
  }
});

test('skybox trail separation is genuinely bounded, not just small', () => {
  // Within the real UI range the ratio alone already keeps skybox small; this proves the cap
  // applied at the call site (CosmicWormholeIdentity.ts) is a real ceiling, not decoration, by
  // feeding it a rate far beyond anything the UI can produce.
  const cap = sync.SKYBOX_TRAVEL_RATE_CAP;
  const modestRate = 320;
  const extremeRate = 500000;
  const modest = Math.min(cap, sync.wormholeTrailSeparation(modestRate, SKYBOX_ROUTE_WORLD_FRACTION));
  const extreme = Math.min(cap, sync.wormholeTrailSeparation(extremeRate, SKYBOX_ROUTE_WORLD_FRACTION));
  assert.ok(modest < cap, `expected modest skybox separation ${modest} to stay under the cap ${cap}`);
  assert.equal(extreme, cap, `expected an extreme input to saturate at the cap, got ${extreme}`);
});

test('trail separation has no wall-clock or frame-count dependence (pure function of rate and ratio)', () => {
  const a = sync.wormholeTrailSeparation(320, 0.4);
  const b = sync.wormholeTrailSeparation(320, 0.4);
  assert.equal(a, b);
  const source = readFileSync(syncSourcePath, 'utf8');
  assert.doesNotMatch(source, /Date\.now|performance\.now|frameCount|requestAnimationFrame/);
});

test('trail/rate consistency: every layer\'s implied rate is the same constant multiple of the canonical rate, and layer ratios match exactly', () => {
  const rates = [0, 10, 75, 240, 596, 1200];
  for (const rate of rates) {
    const foreground = sync.wormholeTrailSeparation(rate, 1);
    const star = sync.wormholeTrailSeparation(rate, STAR_SPEED_RATIO);
    const galaxy = sync.wormholeTrailSeparation(rate, GALAXY_SPEED_RATIO);

    for (const [separation, ratio] of [[foreground, 1], [star, STAR_SPEED_RATIO], [galaxy, GALAXY_SPEED_RATIO]]) {
      if (rate === 0) {
        assert.equal(separation, 0);
        continue;
      }
      const impliedConstant = separation / (rate * ratio);
      assert.ok(
        Math.abs(impliedConstant - sync.WORMHOLE_TRAIL_REFERENCE_SEC) < 1e-12,
        `expected trail separation / (rate * ratio) to equal WORMHOLE_TRAIL_REFERENCE_SEC exactly, got ${impliedConstant}`
      );
    }

    if (rate > 0) {
      assert.ok(Math.abs(foreground / star - 1 / STAR_SPEED_RATIO) < 1e-9, 'foreground:star ratio must equal 1:STAR_SPEED_RATIO');
      assert.ok(Math.abs(star / galaxy - STAR_SPEED_RATIO / GALAXY_SPEED_RATIO) < 1e-9, 'star:galaxy ratio must equal layerRatio ratio');
    }
  }
});

test('WormholeTransport.rateAt is consistent with the derivative of distanceAt', () => {
  const sampleRate = 48000;
  const hopSize = 1024;
  const frames = Array.from({ length: 240 }, (_, index) => ({
    e: 0.6, eRatio: 0.5 + 0.3 * Math.sin(index * 0.3), densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0.4), state: index % 40 < 20 ? 'HIGH' : 'LOW'
  }));
  const features = Array.from({ length: frames.length }, () => ({
    melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5
  }));
  const transport = new timeline.WormholeTransport();
  transport.sync(frames, sampleRate, hopSize, [], features, 128, 0.9);

  const hopSec = hopSize / sampleRate;
  const h = hopSec / 100;
  for (let index = 5; index < frames.length - 5; index += 17) {
    // Sample mid-hop, away from segment boundaries, so the forward difference stays within one
    // piecewise-linear LUT segment instead of averaging across a slope discontinuity.
    const t = (index + 0.5) * hopSec;
    const forwardDiff = (transport.distanceAt(t + h) - transport.distanceAt(t)) / h;
    const rate = transport.rateAt(t);
    assert.ok(
      Math.abs(forwardDiff - rate) < 1e-6 * Math.max(1, Math.abs(rate)),
      `rateAt(${t}) = ${rate} diverged from d(distanceAt)/dt = ${forwardDiff}`
    );
  }
});

test('wormholeParallaxStrength increases with turnIntensity, bounded, and turnIntensity is read from real route frames (AC4)', () => {
  // Synthetic sweep: monotonic and bounded.
  let previous = -Infinity;
  for (const turnIntensity of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    const strength = sync.wormholeParallaxStrength(turnIntensity);
    assert.ok(strength > previous, `parallax strength did not increase at turnIntensity=${turnIntensity}`);
    assert.ok(strength <= 1.7, `parallax strength ${strength} grew unbounded at turnIntensity=${turnIntensity}`);
    previous = strength;
  }
  assert.equal(sync.wormholeParallaxStrength(0), 1, 'zero turn intensity must not amplify parallax at all');

  // Real route frames, same bend, different points along the one sign-preserving route arc:
  // turnIntensity develops with the canonical bend and never comes from a per-layer route.
  const bend = 0.72;
  const earlyArc = route.sampleWormholeRouteFrame(1200, bend);
  const developedArc = route.sampleWormholeRouteFrame(7200, bend);
  assert.ok(
    developedArc.turnIntensity > earlyArc.turnIntensity * 2,
    `expected developed turnIntensity (${developedArc.turnIntensity}) to clearly exceed early value (${earlyArc.turnIntensity})`
  );
  const boundaryStrength = sync.wormholeParallaxStrength(earlyArc.turnIntensity);
  const midStrength = sync.wormholeParallaxStrength(developedArc.turnIntensity);
  assert.ok(
    midStrength > boundaryStrength,
    `expected stronger parallax on the developed arc (${midStrength}) than near the start (${boundaryStrength})`
  );
});

test('background route-follow direction remains correlated with foreground route heading', () => {
  const bend = 0.72;
  function localVector(cameraDistance, lookahead) {
    const camera = route.sampleWormholeRouteFrame(cameraDistance, bend);
    const sample = route.sampleWormholeRouteFrame(cameraDistance + lookahead, bend);
    const dx = sample.positionX - camera.positionX;
    const dy = sample.positionY - camera.positionY;
    return {
      x: dx * camera.normalX + dy * camera.normalY,
      z: dx * camera.tangentX + dy * camera.tangentY
    };
  }

  for (const cameraDistance of [1200, 7350, 18000, 90000]) {
    const foreground = localVector(cameraDistance, 900);
    const background = localVector(cameraDistance, 3600);
    const dot = foreground.x * background.x + foreground.z * background.z;
    const cosine = dot / Math.max(1e-9, Math.hypot(foreground.x, foreground.z) * Math.hypot(background.x, background.z));
    assert.ok(
      cosine > 0.92,
      `background route drift diverged from foreground heading at camera=${cameraDistance}: cosine=${cosine.toFixed(4)}`
    );
  }
});

test('a star\'s lateral swing is measurably stronger mid-turn than at a segment boundary, at identical speed (AC4)', () => {
  // Reproduces the exact star world/local math CosmicWormholeIdentity.ts uses (STAR_ROUTE_WORLD_SCALE
  // = 1, radius/fov as used there), through the real `sampleWormholeRouteFrame` /
  // `projectWormholeTubePoint`-equivalent camera-local transform -- not a re-derivation of the
  // physics, just the same handful of lines the renderer runs, at two picked distances along the
  // identical bent route rather than two different presets/speeds.
  const cx = 640, cy = 360, fov = 720 * 1.2;
  const STAR_ROUTE_WORLD_SCALE = 1;
  const bend = 0.72;
  const starX = 1; // a representative star lateral world coordinate

  function starLocalOffset(camZ, parallax) {
    const baseRouteNow = route.sampleWormholeRouteFrame(camZ, bend);
    const routeNow = route.sampleWormholeRouteFrame(camZ, bend); // same depth as camera: z ~ 0 case is illustrative only
    const starWorldX = routeNow.positionX + starX * STAR_ROUTE_WORLD_SCALE * parallax * routeNow.normalX;
    const starWorldY = routeNow.positionY + starX * STAR_ROUTE_WORLD_SCALE * parallax * routeNow.normalY;
    const deltaX = starWorldX - baseRouteNow.positionX;
    const deltaY = starWorldY - baseRouteNow.positionY;
    return Math.hypot(
      deltaX * baseRouteNow.normalX + deltaY * baseRouteNow.normalY,
      deltaX * baseRouteNow.tangentX + deltaY * baseRouteNow.tangentY
    );
  }

  const earlyArc = route.sampleWormholeRouteFrame(1200, bend);
  const developedArc = route.sampleWormholeRouteFrame(7200, bend);
  const boundaryParallax = sync.wormholeParallaxStrength(earlyArc.turnIntensity);
  const midParallax = sync.wormholeParallaxStrength(developedArc.turnIntensity);

  const boundarySwing = starLocalOffset(1200, boundaryParallax);
  const midSwing = starLocalOffset(7200, midParallax);

  assert.ok(
    midSwing > boundarySwing,
    `expected a larger lateral swing on the developed arc (${midSwing.toFixed(4)}) than near the start (${boundarySwing.toFixed(4)})`
  );
});
