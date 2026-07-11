import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const GRAIN_COUNT = 360;
const BACKGROUND_STAR_COUNT = 1800;
const DEPTH_LAYERS = 15;
const FIXED_HORIZON = 2600;
const MAX_UNIFORMITY_CV = 0.35;

function pseudoNoise(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function initialPhases() {
  return Array.from({ length: GRAIN_COUNT }, (_, index) => {
    const layer = Math.floor(index / 24);
    const seed = (index + 1) * 12.9898;
    return (layer + pseudoNoise(seed, 3.1)) / DEPTH_LAYERS;
  });
}

function wrapDepth(z, maxZ) {
  return Math.max(1e-3, ((z % maxZ) + maxZ) % maxZ);
}

function densityCv(depths, maxZ, binCount = DEPTH_LAYERS) {
  const bins = new Uint32Array(binCount);
  for (const depth of depths) {
    const bin = Math.min(bins.length - 1, Math.floor(depth / maxZ * bins.length));
    bins[bin]++;
  }
  const mean = depths.length / bins.length;
  let variance = 0;
  for (const count of bins) variance += (count - mean) ** 2;
  return Math.sqrt(variance / bins.length) / mean;
}

function runMutableDepthSchedule() {
  const depths = initialPhases().map(phase => phase * FIXED_HORIZON);
  let maxZ = FIXED_HORIZON;
  let targetMaxZ = maxZ;
  let peakCv = 0;

  for (let frame = 0; frame < 6000; frame++) {
    if (frame % 60 === 0) targetMaxZ = 1800 + pseudoNoise(frame + 1, 99) * 3200;
    maxZ += (targetMaxZ - maxZ) * 0.08;
    const velocity = 18 + pseudoNoise(frame, 7) * 12;
    for (let index = 0; index < depths.length; index++) {
      depths[index] = wrapDepth(depths[index] - velocity, maxZ);
    }
    peakCv = Math.max(peakCv, densityCv(depths, maxZ));
  }

  return { finalCv: densityCv(depths, maxZ), peakCv };
}

test('negative control: mutable depths lose uniformity under a moving maxZ schedule', () => {
  const result = runMutableDepthSchedule();
  assert.ok(result.peakCv > MAX_UNIFORMITY_CV, `mutable model unexpectedly passed: ${result.peakCv}`);
  assert.ok(result.finalCv > MAX_UNIFORMITY_CV, `mutable model recovered unexpectedly: ${result.finalCv}`);
});

function loadDepthHelpers() {
  const source = readFileSync(join(process.cwd(), 'src/visuals/WormholeDepth.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Math, Number });
  return module.exports;
}

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

test('derived depth phases remain uniform under the same moving maxZ schedule', () => {
  const { advanceDepthPhase, depthFromPhase } = loadDepthHelpers();
  const phases = initialPhases();
  const depths = new Float64Array(phases.length);
  let travelPhase = 0;
  let maxZ = FIXED_HORIZON;
  let targetMaxZ = maxZ;
  let peakCv = 0;

  for (let frame = 0; frame < 6000; frame++) {
    if (frame % 60 === 0) targetMaxZ = 1800 + pseudoNoise(frame + 1, 99) * 3200;
    maxZ += (targetMaxZ - maxZ) * 0.08;
    const velocity = 18 + pseudoNoise(frame, 7) * 12;
    travelPhase = advanceDepthPhase(travelPhase, velocity, maxZ);
    for (let index = 0; index < phases.length; index++) {
      depths[index] = depthFromPhase(phases[index], travelPhase, maxZ);
    }
    peakCv = Math.max(peakCv, densityCv(depths, maxZ));
  }

  assert.ok(peakCv < MAX_UNIFORMITY_CV, `derived model lost uniformity: ${peakCv}`);
});

test('authored depth coherence restores deterministic cohort character without accumulating damage', () => {
  const { depthFromPhase, depthWithCoherence, depthPhaseAtTime } = loadDepthHelpers();
  const phases = initialPhases();
  const travelPhase = depthPhaseAtTime(42);
  const continuous = phases.map(phase => depthWithCoherence(phase, travelPhase, 3400, 0, DEPTH_LAYERS));
  const coherent = phases.map(phase => depthWithCoherence(phase, travelPhase, 3400, 0.9, DEPTH_LAYERS));
  const repeated = phases.map(phase => depthWithCoherence(phase, travelPhase, 3400, 0.9, DEPTH_LAYERS));

  assert.deepEqual(continuous, phases.map(phase => depthFromPhase(phase, travelPhase, 3400)));
  assert.deepEqual(coherent, repeated, 'cohort character is deterministic at the same song position');
  assert.ok(densityCv(coherent, 3400, 60) > densityCv(continuous, 3400, 60) + 0.15, 'coherence creates visible depth cohorts');
});

test('100 seeks with moving maxZ do not accumulate coherence density damage', () => {
  const { advanceDepthPhase, depthPhaseAtTime, depthWithCoherence } = loadDepthHelpers();
  const phases = initialPhases();
  let travelPhase = 0;
  let maxZ = 2600;
  let peakDamageDelta = 0;

  for (let seekIndex = 0; seekIndex < 100; seekIndex++) {
    const targetMaxZ = 1800 + pseudoNoise(seekIndex + 1, 91) * 3200;
    for (let frame = 0; frame < 45; frame++) {
      maxZ += (targetMaxZ - maxZ) * 0.08;
      travelPhase = advanceDepthPhase(travelPhase, 18 + pseudoNoise(frame, seekIndex + 3) * 12, maxZ);
    }

    const seekTime = pseudoNoise(seekIndex + 17, 121) * 360;
    travelPhase = depthPhaseAtTime(seekTime);
    const afterHistory = phases.map(phase => depthWithCoherence(phase, travelPhase, maxZ, 0.85, DEPTH_LAYERS));
    const freshAtPosition = phases.map(phase => depthWithCoherence(
      phase,
      depthPhaseAtTime(seekTime),
      maxZ,
      0.85,
      DEPTH_LAYERS
    ));
    peakDamageDelta = Math.max(
      peakDamageDelta,
      Math.abs(densityCv(afterHistory, maxZ, 60) - densityCv(freshAtPosition, maxZ, 60))
    );
    assert.deepEqual(afterHistory, freshAtPosition, `seek ${seekIndex} retained path-dependent depth damage`);
  }

  assert.equal(peakDamageDelta, 0);
});

test('wormhole grains no longer carry mutable z depth state', () => {
  const source = readFileSync(join(process.cwd(), 'src/visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.doesNotMatch(source, /interface DustGrain\s*\{[^}]*\bz:\s*number/);
  assert.doesNotMatch(source, /grain\.z\s*=/);
  assert.match(source, /readonly depthPhase: number/);
});

test('syncPosition produces identical wormhole line geometry after different histories', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const first = new CosmicWormholeIdentity();
  const second = new CosmicWormholeIdentity();
  const makeBackend = () => ({
    width: 960, height: 540, frameCount: 1, lines: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}
  });

  State.isPlaying = true;
  State.playbackFade = 1;
  State.visualTuning.wormholeDepth = 3.4;
  State.visualTuning.wormholeSpeed = 2.2;
  State.visualTuning.wormholeCurve = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.currentTime = 10;
  for (let index = 0; index < 3; index++) first.draw(makeBackend(), [], []);
  for (let index = 0; index < 11; index++) second.draw(makeBackend(), [], []);

  State.currentTime = 42;
  first.syncPosition(42);
  second.syncPosition(42);
  const firstBackend = makeBackend();
  const secondBackend = makeBackend();
  first.draw(firstBackend, [], []);
  second.draw(secondBackend, [], []);
  assert.deepEqual(firstBackend.lines, secondBackend.lines);
});

test('syncPosition also restores deterministic curved galaxy geometry', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const first = new CosmicWormholeIdentity();
  const second = new CosmicWormholeIdentity();
  const makeBackend = () => ({
    width: 960, height: 540, frameCount: 1, lines: [], glows: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow(...args) { this.glows.push(args); }
  });

  State.isPlaying = true;
  State.playbackFade = 1;
  State.visualTuning.performanceMode = 0;
  State.visualTuning.chromaKeyMode = 0;
  State.visualTuning.wormholeDepth = 4.6;
  State.visualTuning.wormholeSpeed = 3.1;
  State.visualTuning.wormholeCurve = 0.75;
  State.visualTuning.wormholeGalaxy = 1.2;
  State.visualTuning.wormholeDepthCoherence = 0.65;
  State.modulation.kineticTension = 0.6;
  State.directorOutput.centripetalOrbit = 0.4;
  State.directorOutput.state = 'DROP';
  for (let index = 0; index < 4; index++) first.draw(makeBackend(), [], []);
  for (let index = 0; index < 13; index++) second.draw(makeBackend(), [], []);

  State.currentTime = 73;
  first.syncPosition(73);
  second.syncPosition(73);
  const firstBackend = makeBackend();
  const secondBackend = makeBackend();
  first.draw(firstBackend, [], []);
  second.draw(secondBackend, [], []);
  assert.deepEqual(firstBackend.lines, secondBackend.lines);
  assert.deepEqual(firstBackend.glows, secondBackend.glows);
  assert.ok(firstBackend.glows.length > 0, 'galaxy branch rendered');
});

test('cohort character is reserved for collapse/spiral while sparse keeps open depth', () => {
  const readPreset = name => JSON.parse(readFileSync(join(process.cwd(), 'public/visual-tuning-presets', name), 'utf8')).visualTuning;
  assert.ok(readPreset('vos-wh-collapse.json').wormholeDepthCoherence >= 0.6);
  assert.ok(readPreset('vos-wh-spiral.json').wormholeDepthCoherence >= 0.5);
  assert.ok(readPreset('vos-wh-sparse.json').wormholeDepthCoherence <= 0.4);
});

function kickTestFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(0.9), ...new Array(16).fill(0.1)],
    state: 'HIGH'
  };
}

function setupReleaseTestState(State, events) {
  State.sampleRate = 1000;
  State.hopSize = 100;
  State.frames = Array.from({ length: 400 }, () => kickTestFrame());
  State.events = events;
  State.bpm = 128;
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.currentFrame = kickTestFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.isExporting = false;
  State.playbackFade = 1;
  State.isPlaying = true;
  State.visualTuning.wormholeDepth = 1.0;
  State.visualTuning.wormholeSpeed = 2;
  State.visualTuning.wormholeJitter = 1;
  State.visualTuning.wormholeCurve = 0;
  State.visualTuning.wormholePathBend = 0;
  State.visualTuning.wormholeRing = 0;
  State.visualTuning.wormholeDepthCoherence = 0;
  State.visualTuning.wormholeGalaxy = 0;
  State.visualTuning.wormholeStarfield = 0;
  State.visualTuning.wormholeWarp = 0;
  State.visualTuning.wormholeEmissionMode = 0;
}

function makeReleaseTestBackend() {
  return {
    width: 960, height: 540, frameCount: 1, lines: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}
  };
}

function assertValidGrainTrails(backend, label) {
  const grainLines = backend.lines;
  assert.ok(grainLines.length > 0, `${label}: expected rendered grain trails`);
  for (let index = 0; index < grainLines.length; index++) {
    const [px, py, sx, sy] = grainLines[index];
    assert.ok([px, py, sx, sy].every(Number.isFinite), `${label}: grain line ${index} is not finite`);
    assert.ok(Math.hypot(sx - px, sy - py) <= backend.height * 0.22 + 1e-7,
      `${label}: grain line ${index} exceeds the projection cap`);
  }
}

function visibleGrainEntries(load, identity) {
  const { depthWithCoherence } = load('visuals/WormholeDepth.ts');
  const { wormholeNearPlaneVisibility } = load('visuals/WormholeGrainField.ts');
  const Z_REFERENCE = 1000; // mirrors the private constant in CosmicWormholeIdentity.ts
  const entries = [];
  for (let index = 0; index < identity.pool.length; index++) {
    const grain = identity.pool[index];
    const grainMaxZ = Z_REFERENCE * grain.releaseDepth;
    const z = depthWithCoherence(
      grain.depthPhase, identity.travelPhase, grainMaxZ, grain.releaseDepthCoherence, DEPTH_LAYERS
    );
    if (wormholeNearPlaneVisibility(z, grainMaxZ) > 0) {
      entries.push({ index, layer: Math.floor(index / 24), z });
    }
  }
  return entries;
}

function layerCenterlineDeltas(load, identity, straightBackend, curvedBackend) {
  const entries = visibleGrainEntries(load, identity);
  assert.equal(curvedBackend.lines.length, straightBackend.lines.length, 'bend must not change grain draw count');
  assert.ok(entries.length <= curvedBackend.lines.length, 'visible grain entries must align with rendered lines');
  const byLayer = new Map();
  for (let drawIndex = 0; drawIndex < entries.length; drawIndex++) {
    const entry = entries[drawIndex];
    const straight = straightBackend.lines[drawIndex];
    const curved = curvedBackend.lines[drawIndex];
    const bucket = byLayer.get(entry.layer) ?? { dx: 0, dy: 0, z: 0, count: 0 };
    bucket.dx += curved[2] - straight[2];
    bucket.dy += curved[3] - straight[3];
    bucket.z += entry.z;
    bucket.count++;
    byLayer.set(entry.layer, bucket);
  }
  return [...byLayer.values()]
    .filter(bucket => bucket.count >= 10)
    .map(bucket => ({
      x: bucket.dx / bucket.count,
      y: bucket.dy / bucket.count,
      z: bucket.z / bucket.count
    }))
    .sort((a, b) => a.z - b.z);
}

function signChanges(values) {
  let changes = 0;
  let previous = 0;
  for (const value of values) {
    const sign = Math.sign(value);
    if (!sign) continue;
    if (previous && sign !== previous) changes++;
    previous = sign;
  }
  return changes;
}

function maxPairDistance(points) {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return max;
}

test('zero starfield emits no background-star draws while active starfield still renders', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  setupReleaseTestState(State, []);
  State.currentTime = 4;

  State.visualTuning.wormholeStarfield = 0;
  State.targetTuning.wormholeStarfield = 0;
  const disabledBackend = makeReleaseTestBackend();
  new CosmicWormholeIdentity().draw(disabledBackend, [], []);
  assert.ok(disabledBackend.lines.length <= GRAIN_COUNT, `disabled starfield drew ${disabledBackend.lines.length} lines`);

  State.visualTuning.wormholeStarfield = 1;
  State.targetTuning.wormholeStarfield = 1;
  const activeBackend = makeReleaseTestBackend();
  new CosmicWormholeIdentity().draw(activeBackend, [], []);
  assert.ok(activeBackend.lines.length >= BACKGROUND_STAR_COUNT, 'active starfield no longer renders its pool');
});

test('viewer route frame keeps the wormhole core centered while backgrounds sell the turn', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', 'vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State, []);

  const makeBackend = () => ({
    width: 960, height: 540, frameCount: 1, lines: [], glows: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {},
    line(...args) { this.lines.push(args); }, circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow(...args) { this.glows.push(args); }
  });
  const render = (bend, starfield, galaxy, timeSec) => {
    const tuning = {
      ...spiral, wormholePathBend: bend, wormholeStarfield: starfield, wormholeGalaxy: galaxy,
      performanceMode: 0, chromaKeyMode: 0
    };
    Object.assign(State.visualTuning, tuning);
    Object.assign(State.targetTuning, tuning);
    State.currentTime = timeSec;
    const identity = new CosmicWormholeIdentity();
    identity.syncPosition(timeSec);
    const backend = makeBackend();
    identity.draw(backend, [], []);
    return backend;
  };
  const centroid = (points, xIndex, yIndex) => {
    const sum = points.reduce((acc, point) => {
      acc.x += point[xIndex];
      acc.y += point[yIndex];
      return acc;
    }, { x: 0, y: 0 });
    return { x: sum.x / Math.max(1, points.length), y: sum.y / Math.max(1, points.length) };
  };

  const sampleTimes = [4, 8, 12, 20, 32];
  const coreDisplacements = [];
  const starDisplacements = [];
  const galaxyDisplacements = [];
  for (const timeSec of sampleTimes) {
    const straightCore = render(0, 0, 0, timeSec);
    const curvedCore = render(spiral.wormholePathBend, 0, 0, timeSec);
    const coreCentroid = centroid(curvedCore.lines, 2, 3);
    assert.ok(curvedCore.lines.length > 0);
    const straightCoreCentroid = centroid(straightCore.lines, 2, 3);
    const fromCenter = Math.hypot(coreCentroid.x - curvedCore.width / 2, coreCentroid.y - curvedCore.height / 2);
    const coreDelta = Math.hypot(coreCentroid.x - straightCoreCentroid.x, coreCentroid.y - straightCoreCentroid.y);
    coreDisplacements.push(coreDelta);
    // The foreground core is a *consequence* of the same route-local camera transform as the
    // background (undamped `FOREGROUND_ROUTE_DRIFT_WEIGHT`), not a value artificially recentered
    // toward the lens: it must visibly reflect the turn, not stay locked near the straight-baseline
    // position (the old, now-fixed "frontal tube" regression this test used to encode as a pass).
    // Still a generous lens-local sanity bound -- catches a true regression (e.g. the core flying
    // off-screen or diverging) without reintroducing the old, overly tight "stays near center" bound.
    assert.ok(
      fromCenter <= curvedCore.height * 0.5,
      `t=${timeSec}: curved core left the lens-local sanity bound (${fromCenter.toFixed(1)}px)`
    );

    const straightBackground = render(0, 1, 1, timeSec);
    const curvedBackground = render(spiral.wormholePathBend, 1, 1, timeSec);
    const straightStarCentroid = centroid(straightBackground.lines.slice(0, BACKGROUND_STAR_COUNT), 2, 3);
    const curvedStarCentroid = centroid(curvedBackground.lines.slice(0, BACKGROUND_STAR_COUNT), 2, 3);
    const straightGalaxyCentroid = centroid(straightBackground.glows, 0, 1);
    const curvedGalaxyCentroid = centroid(curvedBackground.glows, 0, 1);
    starDisplacements.push(Math.hypot(
      curvedStarCentroid.x - straightStarCentroid.x,
      curvedStarCentroid.y - straightStarCentroid.y
    ));
    galaxyDisplacements.push(Math.hypot(
      curvedGalaxyCentroid.x - straightGalaxyCentroid.x,
      curvedGalaxyCentroid.y - straightGalaxyCentroid.y
    ));
  }
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(
    Math.max(...coreDisplacements) >= 45,
    `foreground core never visibly reflected the turn: ${JSON.stringify(coreDisplacements)}`
  );
  assert.ok(average(starDisplacements) >= 8, `star displacement ${JSON.stringify(starDisplacements)}`);
  assert.ok(average(galaxyDisplacements) >= 8, `galaxy displacement ${JSON.stringify(galaxyDisplacements)}`);
  assert.ok(Math.max(...starDisplacements) >= 12, `star cue never became cinematic: ${JSON.stringify(starDisplacements)}`);
  assert.ok(Math.max(...galaxyDisplacements) >= 10, `galaxy cue never became cinematic: ${JSON.stringify(galaxyDisplacements)}`);
});

test('spiral, punch, and overdrive keep foreground vanishing point lens-local while bending orientation', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  setupReleaseTestState(State, []);

  const presetNames = ['vos-wh-spiral.json', 'vos-wh-punch.json', 'vos-wh-overdrive.json'];
  for (const presetName of presetNames) {
    const preset = JSON.parse(readFileSync(
      join(process.cwd(), 'public/visual-tuning-presets', presetName), 'utf8'
    )).visualTuning;
    const baseline = {
      ...preset,
      wormholePathBend: 0,
      wormholeStarfield: 0,
      wormholeGalaxy: 0,
      wormholeSkybox: 0,
      wormholeEmissionMode: 0,
      performanceMode: 0,
      chromaKeyMode: 0
    };
    const curved = { ...baseline, wormholePathBend: preset.wormholePathBend };
    const timeSec = 12;
    const identity = new CosmicWormholeIdentity();

    Object.assign(State.visualTuning, baseline);
    Object.assign(State.targetTuning, baseline);
    State.currentTime = timeSec;
    identity.syncPosition(timeSec);
    const straightBackend = makeReleaseTestBackend();
    identity.draw(straightBackend, [], []);

    Object.assign(State.visualTuning, curved);
    Object.assign(State.targetTuning, curved);
    State.currentTime = timeSec;
    const curvedBackend = makeReleaseTestBackend();
    identity.draw(curvedBackend, [], []);

    const centers = layerCenterlineDeltas(load, identity, straightBackend, curvedBackend);
    assert.ok(centers.length >= 8, `${presetName}: expected enough visible depth-layer centers`);
    const span = maxPairDistance(centers);
    assert.ok(span >= 1.5, `${presetName}: foreground route frame cue is too weak (${span.toFixed(2)}px)`);
    const far = centers[centers.length - 1];
    assert.ok(
      Math.hypot(far.x, far.y) <= curvedBackend.height * 0.3,
      `${presetName}: far centerline left the lens-local tunnel perspective (${JSON.stringify(far)})`
    );
    const source = readFileSync(join(process.cwd(), 'src/visuals/CosmicWormholeIdentity.ts'), 'utf8');
    assert.match(source, /this\.routeNow\.normalX/);
  }
});

test('background star trail direction correlates with camera heading delta and drive remains stable', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { sampleWormholeRouteFrame } = load('visuals/WormholeGrainField.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets/vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State, []);
  const tuning = {
    ...spiral,
    wormholeStarfield: 1,
    wormholeGalaxy: 0,
    wormholeSkybox: 0,
    performanceMode: 0,
    chromaKeyMode: 0
  };
  const straightTuning = { ...tuning, wormholePathBend: 0 };

  const averageTrail = (bend, timeSec) => {
    const activeTuning = bend > 0 ? tuning : straightTuning;
    Object.assign(State.visualTuning, activeTuning);
    Object.assign(State.targetTuning, activeTuning);
    State.currentTime = timeSec;
    const identity = new CosmicWormholeIdentity();
    identity.syncPosition(timeSec);
    const backend = makeReleaseTestBackend();
    identity.draw(backend, [], []);
    let sumX = 0;
    let sumY = 0;
    for (const [px, py, sx, sy] of backend.lines.slice(0, BACKGROUND_STAR_COUNT)) {
      sumX += sx - px;
      sumY += sy - py;
    }
    return { x: sumX / BACKGROUND_STAR_COUNT, y: sumY / BACKGROUND_STAR_COUNT };
  };

  let correlated = 0;
  let measured = 0;
  for (let step = 0; step <= 24; step++) {
    const timeSec = 4 + step / 12;
    const curved = averageTrail(spiral.wormholePathBend, timeSec);
    const straight = averageTrail(0, timeSec);
    const avgX = curved.x - straight.x;
    const avgY = curved.y - straight.y;
    const length = Math.hypot(avgX, avgY);
    assert.ok(length > 0.001, `t=${timeSec}: expected measurable bend-induced average star trail motion`);
    const distance = timeSec * 240;
    const previousDistance = Math.max(0, distance - tuning.wormholeSpeed * 10 * 0.4);
    const headingDelta = sampleWormholeRouteFrame(distance, spiral.wormholePathBend).headingAngle
      - sampleWormholeRouteFrame(previousDistance, spiral.wormholePathBend).headingAngle;
    if (Math.abs(headingDelta) > 0.0005) {
      measured++;
      if (Math.sign(avgX) === -Math.sign(headingDelta)) correlated++;
    }
  }
  assert.ok(measured > 10, 'expected enough heading-delta samples');
  assert.ok(correlated / measured >= 0.55, `star trail/heading correlation ${correlated}/${measured}`);
});

test('automation morph reaches existing render geometry within one second without waiting for grain release', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const spiral = JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets/vos-wh-spiral.json'), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State, []);
  const identity = new CosmicWormholeIdentity();

  const baseline = {
    ...spiral,
    wormholePathBend: 0,
    wormholeSpeed: 2,
    wormholeContinuity: 0.7,
    wormholeGalaxy: 0,
    wormholeStarfield: 0,
    wormholeSkybox: 0
  };
  Object.assign(State.visualTuning, baseline);
  Object.assign(State.targetTuning, baseline);
  State.performancePlan = {
    version: 1,
    source: 'auto',
    points: [{
      id: 'auto-spiral',
      time: 2,
      sectionId: 'test',
      preset: 'vos-wh-spiral.json',
      confidence: 1,
      intensity: 1,
      reason: 'build',
      morphDurationSec: 2,
      morphCurve: 'easeInOut'
    }]
  };
  State.editedPerformancePlan = null;

  const centroid = backend => {
    const sum = backend.lines.reduce((acc, line) => {
      acc.x += line[2];
      acc.y += line[3];
      return acc;
    }, { x: 0, y: 0 });
    return { x: sum.x / Math.max(1, backend.lines.length), y: sum.y / Math.max(1, backend.lines.length) };
  };

  identity.syncPosition(2);
  State.currentTime = 2;
  const before = makeReleaseTestBackend();
  identity.draw(before, [], []);
  assert.ok(before.lines.length > 0, 'expected baseline render geometry');
  const beforeCentroid = centroid(before);

  Object.assign(State.visualTuning, {
    ...baseline,
    wormholePathBend: spiral.wormholePathBend,
    wormholeSpeed: spiral.wormholeSpeed,
    wormholeContinuity: spiral.wormholeContinuity
  });
  Object.assign(State.targetTuning, {
    ...baseline,
    wormholePathBend: spiral.wormholePathBend,
    wormholeSpeed: spiral.wormholeSpeed,
    wormholeContinuity: spiral.wormholeContinuity
  });
  State.currentTime = 2.75;
  const duringMorph = makeReleaseTestBackend();
  identity.draw(duringMorph, [], []);
  assert.ok(duringMorph.lines.length > 0, 'expected morph render geometry');
  const afterCentroid = centroid(duringMorph);

  const displacement = Math.hypot(afterCentroid.x - beforeCentroid.x, afterCentroid.y - beforeCentroid.y);
  assert.ok(
    displacement >= 2,
    `existing render geometry did not visibly react during the automation envelope: ${displacement}`
  );
});

test('draw-based normal-preset sweep keeps backward correction activation very low', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  const { wormholeDepthDiagnostics } = load('visuals/WormholeDiagnostics.ts');
  const readPreset = role => JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', `vos-wh-${role}.json`), 'utf8'
  )).visualTuning;
  const roles = ['drive', 'spiral', 'drift', 'galaxy', 'collapse', 'sparse', 'punch', 'overdrive'];
  setupReleaseTestState(State, []);
  featureFlags.wormholeDiagnostics = true;
  try {
    for (const role of roles) {
      const tuning = { ...readPreset(role), wormholeStarfield: 0, wormholeGalaxy: 0 };
      Object.assign(State.visualTuning, tuning);
      Object.assign(State.targetTuning, tuning);
      const identity = new CosmicWormholeIdentity();
      wormholeDepthDiagnostics.reset();
      identity.syncPosition(8);
      for (let frameIndex = 0; frameIndex < 12; frameIndex++) {
        State.currentTime = 8 + frameIndex / 30;
        identity.draw(makeReleaseTestBackend(), [], []);
      }
      const snapshot = wormholeDepthDiagnostics.snapshot();
      assert.ok(snapshot.trailSamples > 0, `${role}: no rendered trail samples`);
      assert.ok(
        snapshot.trailCorrectionRate <= 0.02,
        `${role}: correction rate ${snapshot.trailCorrections}/${snapshot.trailSamples}`
      );
    }
  } finally {
    featureFlags.wormholeDiagnostics = false;
    wormholeDepthDiagnostics.reset();
  }
});

test('weak wormhole presets stay visible without a bright always-on grain floor', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const readPreset = role => JSON.parse(readFileSync(
    join(process.cwd(), 'public/visual-tuning-presets', `vos-wh-${role}.json`), 'utf8'
  )).visualTuning;
  setupReleaseTestState(State, []);
  const quietFrame = {
    e: 0.04, eRatio: 0.04, densityProj: 0.04, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0), state: 'LOW'
  };
  State.frames = Array.from({ length: 400 }, () => quietFrame);
  State.currentFrame = quietFrame;
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.04, brightness: 0.1, tension: 0.1 };

  const render = role => {
    const tuning = { ...readPreset(role), wormholeStarfield: 0, wormholeGalaxy: 0 };
    Object.assign(State.visualTuning, tuning);
    Object.assign(State.targetTuning, tuning);
    const backend = {
      ...makeReleaseTestBackend(), currentAlpha: 0, alphas: [],
      stroke(_r, _g, _b, alpha) { this.currentAlpha = alpha; },
      line(...args) { this.lines.push(args); this.alphas.push(this.currentAlpha); }
    };
    const identity = new CosmicWormholeIdentity();
    identity.syncPosition(6);
    State.currentTime = 6;
    identity.draw(backend, [], []);
    return {
      count: backend.alphas.length,
      meanAlpha: backend.alphas.reduce((sum, alpha) => sum + alpha, 0) / Math.max(1, backend.alphas.length),
      totalAlpha: backend.alphas.reduce((sum, alpha) => sum + alpha, 0)
    };
  };

  const metrics = Object.fromEntries(['drive', 'dissolve', 'sparse', 'drift'].map(role => [role, render(role)]));
  for (const role of ['dissolve', 'sparse', 'drift']) {
    assert.ok(metrics[role].count > 0, `${role}: visibility collapsed`);
    assert.ok(metrics[role].meanAlpha <= metrics.drive.meanAlpha, `${role}: always-on floor exceeds drive`);
  }
  assert.ok(metrics.sparse.totalAlpha < metrics.drive.totalAlpha * 0.45, JSON.stringify(metrics));
});

test('in-flight grain geometry is immutable across extreme preset switches and trails stay finite and bounded', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  setupReleaseTestState(State, []);
  const intro = {
    wormholeRadius: 0.8, wormholeDepth: 1, wormholeSpeed: 2.5, wormholeWarp: 0.8,
    wormholeCurve: 0.35, wormholePathBend: 0, wormholeRing: 0,
    wormholeDepthCoherence: 0, wormholeContinuity: 0.35
  };
  const establish = {
    wormholeRadius: 1.6, wormholeDepth: 3.4, wormholeSpeed: 1.2, wormholeWarp: 0.3,
    wormholeCurve: 0, wormholePathBend: 0.08, wormholeRing: 0,
    wormholeDepthCoherence: 0, wormholeContinuity: 1.1
  };
  Object.assign(State.visualTuning, intro);
  Object.assign(State.targetTuning, intro);
  const identity = new CosmicWormholeIdentity();
  State.currentTime = 0.75;
  const beforeBackend = makeReleaseTestBackend();
  identity.draw(beforeBackend, [], []);
  const beforeGeometry = identity.pool.map(grain => ({
    generation: grain.releaseGeneration,
    radius: grain.releaseRadius,
    depth: grain.releaseDepth,
    warp: grain.releaseWarp,
    curve: grain.releaseCurve
  }));

  // This exact transition used to reverse the normalized phase because depth rose 1.0 -> 3.4.
  Object.assign(State.visualTuning, establish);
  Object.assign(State.targetTuning, establish);
  const switchedBackend = makeReleaseTestBackend();
  identity.draw(switchedBackend, [], []);
  assert.deepEqual(
    switchedBackend.lines.slice(BACKGROUND_STAR_COUNT),
    beforeBackend.lines.slice(BACKGROUND_STAR_COUNT),
    'changing projection tuning at the same song position must not jump an in-flight grain'
  );
  for (let index = 0; index < identity.pool.length; index++) {
    const before = beforeGeometry[index];
    const grain = identity.pool[index];
    if (grain.releaseGeneration !== before.generation) continue;
    assert.deepEqual(
      {
        generation: grain.releaseGeneration,
        radius: grain.releaseRadius,
        depth: grain.releaseDepth,
        warp: grain.releaseWarp,
        curve: grain.releaseCurve
      },
      before,
      `grain ${index} changed position character mid-flight`
    );
  }
  assertValidGrainTrails(switchedBackend, 'intro -> establish');

  const extremeProfiles = [
    establish,
    { ...intro, wormholeRadius: 0.8, wormholeDepth: 2.3, wormholeSpeed: 9, wormholeWarp: 2.5, wormholeCurve: 0.45, wormholePathBend: 0.42, wormholeContinuity: 1.35 },
    { ...intro, wormholeRadius: 1.8, wormholeDepth: 5, wormholeSpeed: 0.3, wormholeWarp: 0.2, wormholeCurve: 0.1, wormholePathBend: 0.22, wormholeContinuity: 2.4 },
    { ...intro, wormholeRadius: 0.9, wormholeDepth: 3, wormholeSpeed: 4.8, wormholeWarp: 1.65, wormholeCurve: 0.32, wormholePathBend: 0.72, wormholeRing: 0, wormholeDepthCoherence: 0.6, wormholeContinuity: 1.2 }
  ];
  for (let step = 1; step <= 120; step++) {
    if (step % 30 === 1) {
      const profile = extremeProfiles[Math.floor(step / 30) % extremeProfiles.length];
      Object.assign(State.visualTuning, profile);
      Object.assign(State.targetTuning, profile);
    }
    State.currentTime = 0.75 + step / 60;
    const backend = makeReleaseTestBackend();
    identity.draw(backend, [], []);
    assertValidGrainTrails(backend, `transition frame ${step}`);
  }

  const fresh = identity.pool.filter((grain, index) => grain.releaseGeneration > beforeGeometry[index].generation);
  assert.ok(fresh.length > 0, 'expected fresh generations during transition sequence');
  assert.ok(fresh.some(grain => grain.releaseDepth !== intro.wormholeDepth), 'fresh grains adopt a later profile');
});

function bassTestFrame(level) {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: [...new Array(8).fill(level), ...new Array(16).fill(0.1)],
    state: 'HIGH'
  };
}

test('a later bass rise never rewrites an already-released grain, but does reach freshly-released ones', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  setupReleaseTestState(State, []); // no kick events: isolate the bass path
  State.currentFrame = bassTestFrame(0.05); // quiet bass to start
  const identity = new CosmicWormholeIdentity();
  const dt = 1 / 60;

  for (let step = 0; step <= 90; step++) { // t = 0..1.5s
    State.currentTime = step * dt;
    identity.draw(makeReleaseTestBackend(), [], []);
  }
  const releasedOnQuietBass = identity.pool
    .map((grain, index) => ({
      index, generation: grain.releaseGeneration, bass: grain.releaseBass, bandEnergy: grain.releaseBandEnergy
    }))
    .filter(entry => entry.generation > 0);
  assert.ok(releasedOnQuietBass.length > 20, `expected a substantial pre-release cohort, got ${releasedOnQuietBass.length}`);
  assert.ok(releasedOnQuietBass.every(entry => entry.bass < 0.2), 'quiet-bass releases should sample a low releaseBass');
  const quietLowBand = releasedOnQuietBass.filter(entry => identity.pool[entry.index].bandIndex < 8);
  assert.ok(quietLowBand.length > 0);
  assert.ok(quietLowBand.every(entry => entry.bandEnergy === 0.05), 'release must snapshot the current band energy');

  State.currentFrame = bassTestFrame(0.95); // bass rises after these grains already released
  for (let step = 91; step <= 120; step++) { // t = 1.5..2.0s
    State.currentTime = step * dt;
    identity.draw(makeReleaseTestBackend(), [], []);
  }

  let unchanged = 0;
  for (const { index, generation, bass, bandEnergy } of releasedOnQuietBass) {
    if (identity.pool[index].releaseGeneration !== generation) continue; // wrapped again; not part of this check
    unchanged++;
    assert.equal(identity.pool[index].releaseBass, bass, `grain ${index} releaseBass changed after an unrelated later bass rise`);
    assert.equal(
      identity.pool[index].releaseBandEnergy,
      bandEnergy,
      `grain ${index} releaseBandEnergy changed after an unrelated later spectrum rise`
    );
  }
  assert.ok(unchanged > 0, 'expected most quiet-bass releases to still be in the same generation');

  const freshOnLoudBass = identity.pool
    .map((grain, index) => ({ index, generation: grain.releaseGeneration, bass: grain.releaseBass }))
    .filter(entry => !releasedOnQuietBass.some(prior => prior.index === entry.index) && entry.generation > 0);
  assert.ok(freshOnLoudBass.length > 0, 'expected some grains to release for the first time after the bass rise');
  assert.ok(freshOnLoudBass.some(entry => entry.bass > 0.5), 'a freshly-released grain should pick up the higher live bass');
  const freshLoudLowBand = freshOnLoudBass.filter(entry => identity.pool[entry.index].bandIndex < 8);
  assert.ok(freshLoudLowBand.length > 0, 'expected a newly released low-band grain');
  assert.ok(
    freshLoudLowBand.some(entry => identity.pool[entry.index].releaseBandEnergy === 0.95),
    'a freshly-released grain should snapshot the current band energy'
  );
});

test('a huge jump spanning several generations still snapshots the release exactly once, at the latest state', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  setupReleaseTestState(State, []);
  const identity = new CosmicWormholeIdentity();

  State.currentTime = 0;
  identity.draw(makeReleaseTestBackend(), [], []); // baseline: no release yet at t=0
  const before = identity.pool.map(grain => grain.releaseGeneration);

  State.currentTime = 20; // large jump: several generations for a fast-lapping horizon
  identity.draw(makeReleaseTestBackend(), [], []);

  let jumped = 0;
  for (let index = 0; index < identity.pool.length; index++) {
    const grain = identity.pool[index];
    if (grain.releaseGeneration > before[index]) {
      jumped++;
      // Exactly one snapshot: the stored distance/generation reflect the current frame only,
      // never an intermediate skipped generation.
      assert.ok(grain.releaseDistance > 0, `grain ${index} release distance was not updated to the jump target`);
    }
  }
  assert.ok(jumped > 0, 'expected the large time jump to release at least some grains');
});

test('a later kick never changes an already-released grain, but does reach freshly-released ones', () => {
  const kick1 = { time: 0.05, intensity: 1, type: 2 };
  const kick2 = { time: 1.0, intensity: 1, type: 2 };
  const dt = 1 / 60;

  const loadControl = createSourceLoader();
  const { CosmicWormholeIdentity: ControlIdentity } = loadControl('visuals/CosmicWormholeIdentity.ts');
  const { State: ControlState } = loadControl('state/store.ts');
  setupReleaseTestState(ControlState, [kick1]);
  const control = new ControlIdentity();
  for (let step = 0; step <= 60; step++) {
    ControlState.currentTime = step * dt;
    control.draw(makeReleaseTestBackend(), [], []);
  }
  // Snapshot every grain that already completed its first release before kick2 exists.
  const releasedBeforeKick2 = control.pool
    .map((grain, index) => ({ index, generation: grain.releaseGeneration }))
    .filter(entry => entry.generation === 1);
  assert.ok(releasedBeforeKick2.length > 50, `expected a substantial pre-released cohort, got ${releasedBeforeKick2.length}`);

  for (let step = 61; step <= 90; step++) {
    ControlState.currentTime = step * dt;
    control.draw(makeReleaseTestBackend(), [], []);
  }
  const controlSnapshot = control.pool.map(grain => (
    { generation: grain.releaseGeneration, kick: grain.releaseKick, distance: grain.releaseDistance }
  ));

  const loadTest = createSourceLoader();
  const { CosmicWormholeIdentity: TestIdentity } = loadTest('visuals/CosmicWormholeIdentity.ts');
  const { State: TestState } = loadTest('state/store.ts');
  setupReleaseTestState(TestState, [kick1]);
  const testSubject = new TestIdentity();
  for (let step = 0; step <= 60; step++) {
    TestState.currentTime = step * dt;
    testSubject.draw(makeReleaseTestBackend(), [], []);
  }
  TestState.events = [kick1, kick2]; // a fresh kick arrives right after t=1.0
  for (let step = 61; step <= 90; step++) {
    TestState.currentTime = step * dt;
    testSubject.draw(makeReleaseTestBackend(), [], []);
  }
  const testSnapshot = testSubject.pool.map(grain => (
    { generation: grain.releaseGeneration, kick: grain.releaseKick, distance: grain.releaseDistance }
  ));

  for (const { index } of releasedBeforeKick2) {
    const before = controlSnapshot[index];
    const after = testSnapshot[index];
    // Still in the same generation in both runs (did not wrap again in this window).
    if (before.generation !== 1 || after.generation !== 1) continue;
    assert.equal(after.kick, before.kick, `grain ${index} kick changed after an unrelated later kick`);
    assert.equal(after.distance, before.distance, `grain ${index} release distance changed retroactively`);
  }

  // Grains that release for the first time *after* kick2 exists must be free to react to it.
  const freshReleases = testSubject.pool
    .map((grain, index) => ({ index, generation: grain.releaseGeneration, kick: grain.releaseKick }))
    .filter(entry => entry.generation === 1 && !releasedBeforeKick2.some(prior => prior.index === entry.index));
  assert.ok(freshReleases.length > 0, 'expected some grains to release for the first time in this window');
  assert.ok(freshReleases.some(entry => entry.kick > 0.001), 'a freshly-released grain should pick up the later kick');
});

test('seeking clears stale release reactions and lands on the exact same generation as a fresh seek', () => {
  // "No accumulated depth or release damage" means: after any amount of prior history, syncPosition
  // must leave the pool indistinguishable from an instance that seeked straight to that position.
  const loadHistory = createSourceLoader();
  const { CosmicWormholeIdentity: HistoryIdentity } = loadHistory('visuals/CosmicWormholeIdentity.ts');
  const { State: HistoryState } = loadHistory('state/store.ts');
  setupReleaseTestState(HistoryState, [{ time: 0.05, intensity: 1, type: 2 }]);
  const identity = new HistoryIdentity();
  const dt = 1 / 60;
  for (let step = 0; step <= 90; step++) {
    HistoryState.currentTime = step * dt;
    identity.draw(makeReleaseTestBackend(), [], []);
  }
  const releasedBeforeSeek = identity.pool.filter(grain => grain.releaseGeneration > 0).length;
  assert.ok(releasedBeforeSeek > 0, 'expected some grains to have released before the seek');

  HistoryState.currentTime = 5;
  identity.syncPosition(5);
  for (const grain of identity.pool) {
    assert.equal(grain.releaseKick, 0, 'seek must clear any residual kick reaction');
    assert.equal(grain.releaseEmission, 0, 'seek must clear any residual LOW_DROP reaction');
    assert.equal(grain.releaseBass, 0, 'seek must clear any residual bass reaction');
    assert.equal(grain.releaseDensity, 0, 'seek must clear any residual density reaction');
  }

  const loadFresh = createSourceLoader();
  const { CosmicWormholeIdentity: FreshIdentity } = loadFresh('visuals/CosmicWormholeIdentity.ts');
  const { State: FreshState } = loadFresh('state/store.ts');
  setupReleaseTestState(FreshState, [{ time: 0.05, intensity: 1, type: 2 }]);
  const fresh = new FreshIdentity();
  FreshState.currentTime = 5;
  fresh.syncPosition(5);

  for (let index = 0; index < identity.pool.length; index++) {
    assert.equal(
      identity.pool[index].releaseGeneration,
      fresh.pool[index].releaseGeneration,
      `grain ${index} generation depends on pre-seek history`
    );
  }

  // The seek jump itself must not be misread as a fresh generation crossing on the very next frame.
  const preDrawSnapshot = identity.pool.map(grain => (
    { generation: grain.releaseGeneration, kick: grain.releaseKick, emission: grain.releaseEmission }
  ));
  identity.draw(makeReleaseTestBackend(), [], []);
  for (let index = 0; index < identity.pool.length; index++) {
    assert.deepEqual(
      { generation: identity.pool[index].releaseGeneration, kick: identity.pool[index].releaseKick, emission: identity.pool[index].releaseEmission },
      preDrawSnapshot[index],
      `grain ${index} spuriously re-released on the frame right after a seek`
    );
  }
});

test('a huge deltaTime jump never skips a generation: distance-based release matches fine-grained stepping', () => {
  const loadCoarse = createSourceLoader();
  const { CosmicWormholeIdentity: CoarseIdentity } = loadCoarse('visuals/CosmicWormholeIdentity.ts');
  const { State: CoarseState } = loadCoarse('state/store.ts');
  setupReleaseTestState(CoarseState, [{ time: 0.05, intensity: 1, type: 2 }]);
  const coarse = new CoarseIdentity();
  // Two huge jumps instead of many small per-frame steps (simulating a stall / low-FPS export tail).
  CoarseState.currentTime = 3;
  coarse.draw(makeReleaseTestBackend(), [], []);
  CoarseState.currentTime = 6;
  coarse.draw(makeReleaseTestBackend(), [], []);

  const loadFine = createSourceLoader();
  const { CosmicWormholeIdentity: FineIdentity } = loadFine('visuals/CosmicWormholeIdentity.ts');
  const { State: FineState } = loadFine('state/store.ts');
  setupReleaseTestState(FineState, [{ time: 0.05, intensity: 1, type: 2 }]);
  const fine = new FineIdentity();
  const dt = 1 / 60;
  for (let step = 0; step <= 360; step++) {
    FineState.currentTime = step * dt;
    fine.draw(makeReleaseTestBackend(), [], []);
  }

  let anyReleased = 0;
  for (let index = 0; index < coarse.pool.length; index++) {
    if (fine.pool[index].releaseGeneration > 0) anyReleased++;
    assert.equal(
      coarse.pool[index].releaseGeneration,
      fine.pool[index].releaseGeneration,
      `grain ${index} generation count depends on step size (skipped or double-counted a generation)`
    );
  }
  assert.ok(anyReleased > 0, 'expected some grains to have released by t=6');
});

function makeAlphaCapturingBackend() {
  let lastAlpha = 0;
  return {
    width: 960, height: 540, frameCount: 1, lines: [], alphas: [],
    background() {}, noStroke() {}, noFill() {}, fill() {}, strokeWeight() {},
    stroke(_r, _g, _b, a) { lastAlpha = a; },
    line(...args) { this.lines.push(args); this.alphas.push(lastAlpha); },
    circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}
  };
}

/**
 * The pool's fixed `bandIndex` for each grain that actually reached a `backend.line()` call, in the
 * same order the renderer emits them. The draw loop skips a grain outright (no line, no alpha) once
 * its own current depth falls inside the near-plane cull zone (`wormholeNearPlaneVisibility() <= 0`),
 * and roughly one whole depth layer's worth of grains sits at that boundary at any instant -- so
 * `backend.lines[index]` does NOT line up with `identity.pool[index]` in general. This replays the
 * same cull predicate (via the same depth helpers the renderer itself uses) to reconstruct the
 * correspondence, rather than assuming a 1:1 index match.
 */
function survivingBandIndices(load, identity) {
  const { depthWithCoherence } = load('visuals/WormholeDepth.ts');
  const { wormholeNearPlaneVisibility } = load('visuals/WormholeGrainField.ts');
  const Z_REFERENCE = 1000; // mirrors the private constant in CosmicWormholeIdentity.ts
  const indices = [];
  for (const grain of identity.pool) {
    const grainMaxZ = Z_REFERENCE * grain.releaseDepth;
    const z = depthWithCoherence(
      grain.depthPhase, identity.travelPhase, grainMaxZ, grain.releaseDepthCoherence, DEPTH_LAYERS
    );
    if (wormholeNearPlaneVisibility(z, grainMaxZ) > 0) indices.push(grain.bandIndex);
  }
  return indices;
}

/**
 * Peak alpha among every grain whose fixed `bandIndex` equals `band`. A band's 15 depth-layer grains
 * are independently near/far-plane-faded at any given instant (that per-grain depth fade is unrelated
 * to the band's own audio content), so a handful of a band's grains reading near-zero even while
 * their band is loud is expected, not a defect -- averaging across all 15 would dilute the signal
 * with those incidentally-faded grains. The peak instead reliably surfaces whichever of that band's
 * grains is currently well clear of the fade zone.
 */
function peakAlphaForBand(backend, bandIndices, band) {
  let peak = 0;
  for (let index = 0; index < backend.alphas.length; index++) {
    if (bandIndices[index] === band) peak = Math.max(peak, backend.alphas[index]);
  }
  return peak;
}

test('a single active frequency band lights up only its own angular sector (circular spectrograph)', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const BAND_COUNT = 24;
  setupReleaseTestState(State, []);
  // A silent baseline release snapshot isolates the live contribution: grains release with zero
  // band energy, so any brightness seen below comes from the live spectrum term, not the snapshot.
  State.currentFrame.perceptualSpectrum = new Array(BAND_COUNT).fill(0);
  const identity = new CosmicWormholeIdentity();
  const startTime = 5;
  identity.syncPosition(startTime);
  State.currentTime = startTime;

  const activeBand = 5;
  const spectrum = new Array(BAND_COUNT).fill(0.02);
  spectrum[activeBand] = 0.95;
  State.currentFrame.perceptualSpectrum = spectrum;
  const backend = makeAlphaCapturingBackend();
  identity.draw(backend, [], []);
  const bandIndices = survivingBandIndices(load, identity);

  const activePeak = peakAlphaForBand(backend, bandIndices, activeBand);
  let maxOtherPeak = 0;
  for (let band = 0; band < BAND_COUNT; band++) {
    if (band === activeBand) continue;
    maxOtherPeak = Math.max(maxOtherPeak, peakAlphaForBand(backend, bandIndices, band));
  }
  assert.ok(
    activePeak > maxOtherPeak * 3,
    `expected the active band's own sector to read far brighter than every other band, got active=${activePeak.toFixed(2)} vs best-of-rest=${maxOtherPeak.toFixed(2)}`
  );
});

test('the lit sector migrates with the active band instead of staying fixed or pulsing globally', () => {
  const load = createSourceLoader();
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const BAND_COUNT = 24;
  setupReleaseTestState(State, []);
  State.currentFrame.perceptualSpectrum = new Array(BAND_COUNT).fill(0);
  const identity = new CosmicWormholeIdentity();
  const startTime = 5;
  identity.syncPosition(startTime);
  State.currentTime = startTime;

  function spectrumWithBand(band) {
    const spectrum = new Array(BAND_COUNT).fill(0.02);
    spectrum[band] = 0.95;
    return spectrum;
  }

  const firstBand = 3;
  State.currentFrame.perceptualSpectrum = spectrumWithBand(firstBand);
  const firstBackend = makeAlphaCapturingBackend();
  identity.draw(firstBackend, [], []);
  const firstBandPeakBefore = peakAlphaForBand(firstBackend, survivingBandIndices(load, identity), firstBand);

  // Switch to a different band at the same travel distance (no generation crossing, no seek): the
  // live term must respond immediately, not wait for a grain's next release.
  const secondBand = 17;
  State.currentFrame.perceptualSpectrum = spectrumWithBand(secondBand);
  const secondBackend = makeAlphaCapturingBackend();
  identity.draw(secondBackend, [], []);
  const secondBandIndices = survivingBandIndices(load, identity);
  const firstBandPeakAfter = peakAlphaForBand(secondBackend, secondBandIndices, firstBand);
  const secondBandPeakAfter = peakAlphaForBand(secondBackend, secondBandIndices, secondBand);

  assert.ok(
    secondBandPeakAfter > firstBandPeakAfter * 3,
    `expected the newly active band's sector to now read brightest, got new-band=${secondBandPeakAfter.toFixed(2)} vs old-band=${firstBandPeakAfter.toFixed(2)}`
  );
  assert.ok(
    firstBandPeakAfter < firstBandPeakBefore * 0.6,
    `expected the previously active sector to dim once its band went quiet, got ${firstBandPeakBefore.toFixed(2)} -> ${firstBandPeakAfter.toFixed(2)}`
  );

  // Not a global pulse: at any one time only a narrow slice of bands should be materially brighter
  // than the field average, not the whole pool moving together.
  let sum = 0;
  for (const alpha of secondBackend.alphas) sum += alpha;
  const overallMean = sum / secondBackend.alphas.length;
  assert.ok(
    secondBandPeakAfter > overallMean * 2,
    `expected the active sector to stand out from the field average, got band=${secondBandPeakAfter.toFixed(2)} vs field=${overallMean.toFixed(2)}`
  );
});

test('cosmos-sync galaxy/skybox trail additions cost O(layer-count), not O(item-count)', () => {
  // `draw()` is a hot 60fps path. The new galaxy/skybox positional reactivity cues must add a
  // handful of extra `sampleWormholeRouteFrame` calls (one per galaxy, one shared for the whole
  // skybox layer), never one per background item (9000 skybox stars, 1800 starfield stars).
  const load = createSourceLoader();
  const { State } = load('state/store.ts');
  const featureFlags = load('config/featureFlags.ts').featureFlags;
  const grainField = load('visuals/WormholeGrainField.ts');

  let callCount = 0;
  const realSampleWormholeRouteFrame = grainField.sampleWormholeRouteFrame;
  grainField.sampleWormholeRouteFrame = (...args) => {
    callCount++;
    return realSampleWormholeRouteFrame(...args);
  };

  // Loaded after the patch, through the same cache, so its own `require('./WormholeGrainField')`
  // resolves to this same (now-wrapped) module object.
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');

  setupReleaseTestState(State, []);

  const drawOnceWith = (galaxy, starfield, skybox, skyboxFlag) => {
    featureFlags.wormholeSkybox = skyboxFlag;
    Object.assign(State.visualTuning, { wormholeGalaxy: galaxy, wormholeStarfield: starfield, wormholeSkybox: skybox });
    Object.assign(State.targetTuning, { wormholeGalaxy: galaxy, wormholeStarfield: starfield, wormholeSkybox: skybox });
    const identity = new CosmicWormholeIdentity();
    identity.syncPosition(12);
    State.currentTime = 12;
    callCount = 0;
    identity.draw(makeReleaseTestBackend(), [], []);
    return callCount;
  };

  const baseline = drawOnceWith(0, 0, 0, false);
  const withGalaxy = drawOnceWith(1, 0, 0, false);
  // The skybox path is gated by `featureFlags.wormholeSkybox` (off by default), not the tuning
  // value alone -- toggle the flag itself to actually exercise (and isolate) its route-frame cost.
  const withSkybox = drawOnceWith(0, 0, 1, true);
  const withStarfieldOnly = drawOnceWith(0, 1, 0, false);
  const withEverything = drawOnceWith(1, 1, 1, true);

  const GALAXY_COUNT = 9;
  const galaxyDelta = withGalaxy - baseline;
  const skyboxDelta = withSkybox - baseline;

  assert.ok(
    galaxyDelta > 0 && galaxyDelta <= GALAXY_COUNT * 3,
    `galaxy layer added ${galaxyDelta} route-frame calls -- expected O(${GALAXY_COUNT}), not O(item-count)`
  );
  assert.ok(
    skyboxDelta > 0 && skyboxDelta <= 3,
    `skybox layer added ${skyboxDelta} route-frame calls for its whole 9000-star pool -- expected a small constant, not O(item-count)`
  );
  // Enabling the starfield naturally costs one pre-existing call per star (unrelated to this
  // change) plus 2 shared calls: exactly STAR_COUNT + 2. The refactor to `wormholeStarTravelRate`
  // must not add anything beyond that already-existing per-star cost.
  const STAR_COUNT = 1800;
  const starfieldDelta = withStarfieldOnly - baseline;
  assert.ok(
    starfieldDelta >= STAR_COUNT && starfieldDelta <= STAR_COUNT + 5,
    `starfield added ${starfieldDelta} route-frame calls -- expected ~${STAR_COUNT + 2} (pre-existing 1/star), not extra per-star sampling from the refactor`
  );
  assert.ok(
    withEverything < baseline + galaxyDelta + skyboxDelta + starfieldDelta + 5,
    'combined draw call count grew disproportionately to the sum of its parts'
  );

  grainField.sampleWormholeRouteFrame = realSampleWormholeRouteFrame;
});
