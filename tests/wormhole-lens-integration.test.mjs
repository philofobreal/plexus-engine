import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Lens-overhaul plan T5: integration tests for the gravitational lens warp wired into
// CosmicWormholeIdentity.draw() (skybox/starfield/galaxy background layers only, never the grain
// tunnel interior). These exercise the real draw() loop through the same TS-in-VM source loader
// pattern already established by tests/wormhole-depth-integrity.test.mjs, rather than duplicating
// the projection math.

const SRC_ROOT = join(process.cwd(), 'src');
const LENS_WARP_PATH = join(SRC_ROOT, 'visuals', 'WormholeLensWarp.ts');

/** Same loader as the other wormhole test files, but `stubs` lets a caller replace a specific
 *  absolute module path's exports outright (e.g. to intercept every call into WormholeLensWarp.ts
 *  without touching any other module), so the test can prove *whether* CosmicWormholeIdentity calls
 *  into that module at all, instead of only inspecting its numeric effect. */
function createSourceLoader(stubs = new Map()) {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    if (stubs.has(path)) {
      const module = { exports: stubs.get(path) };
      cache.set(path, module);
      return module.exports;
    }
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
    vm.runInNewContext(output, {
      module, exports: module.exports, require, Math, Number, Array, Object, Map, Set,
      Uint16Array, Float64Array, Uint8Array
    });
    return module.exports;
  }
  return relative => load(join(SRC_ROOT, relative));
}

function makeBackend() {
  return {
    width: 960, height: 540, frameCount: 1, lines: [], glows: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    // Plain-JSON round-trip: several tests below load CosmicWormholeIdentity.ts through two
    // independent `createSourceLoader()` calls (a real module and a stubbed WormholeLensWarp), each
    // its own `vm` realm. Nested arrays like the reused `galaxyColor` scratch tuple are constructed
    // inside that sandboxed realm, so comparing them by reference/prototype across two different
    // loader calls makes `assert.deepEqual` report a spurious mismatch even when every number is
    // identical. Cloning through JSON strips realm identity while leaving the numbers untouched.
    line(...args) { this.lines.push(JSON.parse(JSON.stringify(args))); },
    circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow(...args) { this.glows.push(JSON.parse(JSON.stringify(args))); },
    radialDim() {}, compositeRingTint() {}
  };
}

function lensTestFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0.4), state: 'HIGH'
  };
}

/** Baseline state shared by every test below; individual tests override tuning after calling this. */
function setupLensTestState(State, featureFlags) {
  featureFlags.wormholeSkybox = true;
  State.sampleRate = 48000;
  State.hopSize = 1024;
  State.frames = Array.from({ length: 400 }, () => lensTestFrame());
  State.events = [];
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = lensTestFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.isExporting = false;
  State.isPlaying = true;
  State.playbackFade = 1;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;
  State.visualTuning.wormholeDepth = 1.2;
  State.visualTuning.wormholeSpeed = 2;
  State.visualTuning.wormholeCurve = 0;
  State.visualTuning.wormholePathBend = 0;
  State.visualTuning.wormholePathBendVertical = 0;
  State.visualTuning.wormholeRing = 0;
  State.visualTuning.wormholeDepthCoherence = 0;
  State.visualTuning.wormholeJitter = 0;
  State.visualTuning.wormholeSkybox = 1;
  State.visualTuning.wormholeStarfield = 1;
  State.visualTuning.wormholeGalaxy = 1;
  State.visualTuning.wormholeOpticsEnabled = 1;
  State.visualTuning.wormholeWall = 0;
  State.visualTuning.wormholeLens = 0;
  State.visualTuning.wormholeLensRadius = 0.5;
  State.visualTuning.wormholeLensSwirl = 0.35;
}

test('wormholeLens=0 renders bit-identical output whether or not the lens module is even functional', () => {
  // A stub that would make every warped coordinate an obvious, distinctive marker if it were ever
  // invoked. If disabling the lens still calls into this module, the marker would leak into the
  // rendered geometry below -- so an unpolluted, byte-identical render against the real module is a
  // strictly stronger proof of "wormholeLens<=0 is a true no-op" than comparing two real renders.
  const marker = 123456.5;
  const corruptingStub = {
    wormholeLensWarpPoint(px, py, cx, cy, radius, strength, swirl, out) {
      out.x = marker;
      out.y = marker;
      return out;
    },
    wormholeLensMagnificationGain() { return 999; },
    wormholeLensNearAxisVisibility() { return 1; },
    wormholeLensSecondaryPoint(px, py, cx, cy, radius, strength, swirl, out) {
      out.x = marker;
      out.y = marker;
      return out;
    },
    wormholeLensSecondaryGain() { return 999; }
  };

  function render(stubs) {
    const load = createSourceLoader(stubs);
    const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
    const { State } = load('state/store.ts');
    const { featureFlags } = load('config/featureFlags.ts');
    setupLensTestState(State, featureFlags);
    State.visualTuning.wormholeLens = 0; // the case under test
    const identity = new CosmicWormholeIdentity();
    for (let index = 0; index < 5; index++) {
      State.currentTime = 1 + index * 0.4;
      identity.draw(makeBackend(), [], []);
    }
    const backend = makeBackend();
    identity.draw(backend, [], []);
    return backend;
  }

  const real = render(new Map());
  const stubbed = render(new Map([[LENS_WARP_PATH, corruptingStub]]));

  assert.ok(real.lines.length > 0, 'expected background/grain geometry to render');
  assert.deepEqual(real.lines, stubbed.lines);
  assert.deepEqual(real.glows, stubbed.glows);

  const flat = [...stubbed.lines.flat(), ...stubbed.glows.flat()].filter(value => typeof value === 'number');
  assert.ok(!flat.includes(marker), 'the lens module must never be called when wormholeLens<=0');
});

/** Counts of the marker-corrupting stub's fingerprint (four/two coordinates exactly at `marker`)
 *  in the backend's captured draw calls, used below to prove a specific layer actually routes its
 *  projected points through the lens module. */
function countMarkedLines(lines, marker) {
  return lines.filter(([px, py, sx, sy]) => px === marker && py === marker && sx === marker && sy === marker).length;
}
function countMarkedGlows(glows, marker) {
  return glows.filter(([x, y]) => x === marker && y === marker).length;
}

function renderWithCorruptingStub(configure) {
  const marker = 123456.5;
  const corruptingStub = {
    wormholeLensWarpPoint(px, py, cx, cy, radius, strength, swirl, out) {
      out.x = marker;
      out.y = marker;
      return out;
    },
    wormholeLensMagnificationGain() { return 1; },
    wormholeLensNearAxisVisibility() { return 1; },
    wormholeLensSecondaryPoint(px, py, cx, cy, radius, strength, swirl, out) {
      out.x = px;
      out.y = py;
      return out;
    },
    wormholeLensSecondaryGain() { return 0; }
  };
  const load = createSourceLoader(new Map([[LENS_WARP_PATH, corruptingStub]]));
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupLensTestState(State, featureFlags);
  configure(State, featureFlags);
  const identity = new CosmicWormholeIdentity();
  State.currentTime = 3;
  const backend = makeBackend();
  identity.draw(backend, [], []);
  return { backend, marker };
}

test('skybox layer routes both streak endpoints through the lens warp, gated off in performance mode', () => {
  const { backend, marker } = renderWithCorruptingStub((State) => {
    State.visualTuning.wormholeStarfield = 0;
    State.visualTuning.wormholeGalaxy = 0;
    State.visualTuning.wormholeLens = 0.6;
    State.visualTuning.performanceMode = 0;
  });
  assert.ok(countMarkedLines(backend.lines, marker) > 0, 'skybox streaks must be lens-warped');

  const { backend: perfBackend, marker: perfMarker } = renderWithCorruptingStub((State) => {
    State.visualTuning.wormholeStarfield = 0;
    State.visualTuning.wormholeGalaxy = 0;
    State.visualTuning.wormholeLens = 0.6;
    State.visualTuning.performanceMode = 1;
  });
  assert.ok(perfBackend.lines.length > 0, 'skybox should still render under performance mode');
  assert.equal(
    countMarkedLines(perfBackend.lines, perfMarker), 0,
    'performance mode must skip the skybox lens warp specifically'
  );
});

test('starfield layer routes both streak endpoints through the lens warp, even in performance mode', () => {
  const { backend, marker } = renderWithCorruptingStub((State, featureFlags) => {
    featureFlags.wormholeSkybox = false;
    State.visualTuning.wormholeGalaxy = 0;
    State.visualTuning.wormholeLens = 0.6;
    State.visualTuning.performanceMode = 0;
  });
  assert.ok(countMarkedLines(backend.lines, marker) > 0, 'star streaks must be lens-warped');

  const { backend: perfBackend, marker: perfMarker } = renderWithCorruptingStub((State, featureFlags) => {
    featureFlags.wormholeSkybox = false;
    State.visualTuning.wormholeGalaxy = 0;
    State.visualTuning.wormholeLens = 0.6;
    State.visualTuning.performanceMode = 1;
  });
  assert.ok(
    countMarkedLines(perfBackend.lines, perfMarker) > 0,
    'unlike skybox, the star layer must remain lens-warped under performance mode'
  );
});

test('galaxy layer routes both its current and previous-echo glow through the lens warp', () => {
  const { backend, marker } = renderWithCorruptingStub((State, featureFlags) => {
    featureFlags.wormholeSkybox = false;
    State.visualTuning.wormholeStarfield = 0;
    State.visualTuning.wormholeLens = 0.6;
    State.visualTuning.performanceMode = 0;
    State.visualTuning.chromaKeyMode = 0;
  });
  assert.ok(backend.glows.length > 0, 'expected galaxy glow calls');
  assert.ok(countMarkedGlows(backend.glows, marker) > 0, 'galaxy glows must be lens-warped');
  // Every galaxy draws a "now" glow plus a fainter previous-frame echo glow (both warped
  // independently, per T5): the marked count should be a clean multiple reflecting both.
  assert.equal(countMarkedGlows(backend.glows, marker) % 2, 0, 'now + prev echo warp in pairs');
});

test('the grain tunnel interior and membrane wall are never routed through the lens warp', () => {
  // Isolate the interior layers: skybox/starfield/galaxy off, so every remaining line() call comes
  // from either the grain pool or (when enabled) the membrane wall/caustics -- neither of which the
  // lens-overhaul plan permits the lens to touch.
  const withWall = renderWithCorruptingStub((State, featureFlags) => {
    featureFlags.wormholeSkybox = false;
    State.visualTuning.wormholeStarfield = 0;
    State.visualTuning.wormholeGalaxy = 0;
    State.visualTuning.wormholeLens = 0.6;
    State.visualTuning.wormholeWall = 0.7;
    State.visualTuning.wormholeWallCaustics = 0.6;
    State.visualTuning.wormholeWallRefraction = 0.5;
  });
  const withoutWall = renderWithCorruptingStub((State, featureFlags) => {
    featureFlags.wormholeSkybox = false;
    State.visualTuning.wormholeStarfield = 0;
    State.visualTuning.wormholeGalaxy = 0;
    State.visualTuning.wormholeLens = 0.6;
    State.visualTuning.wormholeWall = 0;
  });
  assert.ok(withWall.backend.lines.length > 0, 'expected grain/wall geometry to render');
  assert.equal(countMarkedLines(withWall.backend.lines, withWall.marker), 0, 'grain/wall lines must not be lens-warped');
  assert.equal(countMarkedLines(withoutWall.backend.lines, withoutWall.marker), 0, 'grain lines must not be lens-warped');
});

test('seeking to the same song position via different playback histories stays bit-identical with the lens active', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupLensTestState(State, featureFlags);
  State.visualTuning.wormholePathBend = 0.6;
  State.visualTuning.wormholeLens = 0.6;
  State.visualTuning.wormholeLensSwirl = 0.5;

  const first = new CosmicWormholeIdentity();
  const second = new CosmicWormholeIdentity();
  for (let index = 0; index < 4; index++) {
    State.currentTime = 1 + index * 0.35;
    first.draw(makeBackend(), [], []);
  }
  for (let index = 0; index < 15; index++) {
    State.currentTime = 1 + index * 0.09;
    second.draw(makeBackend(), [], []);
  }

  State.currentTime = 6.4;
  first.syncPosition(6.4);
  second.syncPosition(6.4);
  const firstBackend = makeBackend();
  const secondBackend = makeBackend();
  first.draw(firstBackend, [], []);
  second.draw(secondBackend, [], []);

  assert.ok(firstBackend.lines.length > 0);
  assert.deepEqual(firstBackend.lines, secondBackend.lines);
  assert.deepEqual(firstBackend.glows, secondBackend.glows);
});

test('the lens center follows a curved route instead of staying pinned to the screen center', () => {
  // A pass-through stub that leaves geometry untouched but records every (cx, cy) center the real
  // draw() loop actually called it with -- proving the wiring without re-deriving the projection.
  const centersByCall = [];
  const recordingStub = {
    wormholeLensWarpPoint(px, py, cx, cy, radius, strength, swirl, out) {
      centersByCall.push([cx, cy]);
      out.x = px;
      out.y = py;
      return out;
    },
    wormholeLensMagnificationGain() { return 0; },
    wormholeLensNearAxisVisibility() { return 1; },
    wormholeLensSecondaryPoint(px, py, cx, cy, radius, strength, swirl, out) {
      out.x = px;
      out.y = py;
      return out;
    },
    wormholeLensSecondaryGain() { return 0; }
  };

  function centerFor(pathBend, travelSeconds) {
    centersByCall.length = 0;
    const load = createSourceLoader(new Map([[LENS_WARP_PATH, recordingStub]]));
    const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
    const { State } = load('state/store.ts');
    const { featureFlags } = load('config/featureFlags.ts');
    setupLensTestState(State, featureFlags);
    State.visualTuning.wormholePathBend = pathBend;
    State.visualTuning.wormholeLens = 0.6;
    const identity = new CosmicWormholeIdentity();
    for (let index = 0; index < 6; index++) {
      State.currentTime = index * (travelSeconds / 6);
      identity.draw(makeBackend(), [], []);
    }
    // Only the final, measured draw's centers matter -- the warm-up loop above also calls into the
    // (recording) stub, and an early, barely-converged frame would otherwise pollute `centersByCall[0]`.
    centersByCall.length = 0;
    State.currentTime = travelSeconds;
    identity.draw(makeBackend(), [], []);
    assert.ok(centersByCall.length > 0, 'expected at least one lens-warped point to sample the center');
    // Every warped point this frame must share the exact same lens center.
    for (const [cx, cy] of centersByCall) {
      assert.equal(cx, centersByCall[0][0]);
      assert.equal(cy, centersByCall[0][1]);
    }
    return centersByCall[0];
  }

  const straightCenter = centerFor(0, 6);
  const [screenCx, screenCy] = [480, 270]; // 960x540 backend from makeBackend()
  assert.ok(
    Math.hypot(straightCenter[0] - screenCx, straightCenter[1] - screenCy) < 1e-6,
    'a dead-straight route keeps the lens center at screen center'
  );

  const bentCenter = centerFor(0.8, 6);
  assert.ok(
    Math.hypot(bentCenter[0] - screenCx, bentCenter[1] - screenCy) > 5,
    `a curved route must move the lens center off-center, got ${JSON.stringify(bentCenter)}`
  );

  // Continuity: two nearby travel positions along the same curved route must not jump wildly.
  const nearA = centerFor(0.8, 6.0);
  const nearB = centerFor(0.8, 6.05);
  assert.ok(
    Math.hypot(nearA[0] - nearB[0], nearA[1] - nearB[1]) < 40,
    `lens center must move continuously, not jump: ${JSON.stringify(nearA)} -> ${JSON.stringify(nearB)}`
  );
});
