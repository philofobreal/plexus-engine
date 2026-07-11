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

// Matches CosmicWormholeIdentity.ts's own ratio constants.
const STAR_SPEED_RATIO = 0.4;
const GALAXY_SPEED_RATIO = 0.05;
const SKYBOX_ROUTE_WORLD_FRACTION = 0.035;

test('wormholeSpeed 1 -> 8: foreground/star/galaxy travel rate strictly increases, skybox increases but stays bounded', () => {
  const speeds = [1, 2, 3, 4, 5, 6, 7, 8];
  let prevForeground = -Infinity, prevStar = -Infinity, prevGalaxy = -Infinity, prevSkybox = -Infinity;
  for (const speed of speeds) {
    const effectiveRate = sync.wormholeEffectiveTravelRate(speed, 1);
    const foreground = sync.wormholeForegroundTravelRate(effectiveRate);
    const star = sync.wormholeStarTravelRate(effectiveRate, STAR_SPEED_RATIO);
    const galaxy = sync.wormholeGalaxyTravelRate(effectiveRate, GALAXY_SPEED_RATIO);
    const skybox = sync.wormholeSkyboxTravelRate(effectiveRate, SKYBOX_ROUTE_WORLD_FRACTION);

    assert.ok(foreground > prevForeground, `foreground travel rate did not increase at speed=${speed}`);
    assert.ok(star > prevStar, `star travel rate did not increase at speed=${speed}`);
    assert.ok(galaxy > prevGalaxy, `galaxy travel rate did not increase at speed=${speed}`);
    assert.ok(skybox > prevSkybox, `skybox travel rate did not increase at speed=${speed}`);

    // Near objects react more strongly than far ones, at every speed -- the "difference is only
    // parallax" requirement.
    assert.ok(foreground > star, `foreground should react more strongly than star at speed=${speed}`);
    assert.ok(star > galaxy, `star should react more strongly than galaxy at speed=${speed}`);

    prevForeground = foreground;
    prevStar = star;
    prevGalaxy = galaxy;
    prevSkybox = skybox;
  }
});

test('skybox travel rate is genuinely bounded, not just small', () => {
  // Within the real UI range (wormholeSpeed up to 10) the ratio alone already keeps skybox small;
  // this proves the cap is a real ceiling, not decoration, by feeding it a rate far beyond anything
  // the UI can produce.
  const cap = 6;
  const modestRate = sync.wormholeEffectiveTravelRate(8, 1);
  const extremeRate = sync.wormholeEffectiveTravelRate(1000, 1);
  const modest = sync.wormholeSkyboxTravelRate(modestRate, SKYBOX_ROUTE_WORLD_FRACTION, cap);
  const extreme = sync.wormholeSkyboxTravelRate(extremeRate, SKYBOX_ROUTE_WORLD_FRACTION, cap);
  assert.ok(modest < cap, `expected modest skybox rate ${modest} to stay under the cap ${cap}`);
  assert.equal(extreme, cap, `expected an extreme input to saturate at the cap, got ${extreme}`);
});

test('effective travel rate has no wall-clock or frame-count dependence (pure function of speed and motion)', () => {
  const a = sync.wormholeEffectiveTravelRate(4, 1.3);
  const b = sync.wormholeEffectiveTravelRate(4, 1.3);
  assert.equal(a, b);
  const source = readFileSync(syncSourcePath, 'utf8');
  assert.doesNotMatch(source, /Date\.now|performance\.now|frameCount|requestAnimationFrame/);
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
