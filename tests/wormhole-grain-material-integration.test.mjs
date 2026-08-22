import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const IDENTITY_PATH = join(SRC_ROOT, 'visuals', 'CosmicWormholeIdentity.ts');
const MATERIAL_PATH = join(SRC_ROOT, 'visuals', 'wormholeGrainMaterialRaster.ts');
const GRAIN_FIELD_PATH = join(SRC_ROOT, 'visuals', 'WormholeGrainField.ts');

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
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, {
      module, exports: module.exports, require,
      Math, Number, Object, Array, Map, Set,
      Float32Array, Float64Array, Uint8Array, Uint16Array
    });
    return module.exports;
  }
  return relative => load(join(SRC_ROOT, relative));
}

function testFrame() {
  return {
    e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0.72), state: 'HIGH'
  };
}

function setupState(State, featureFlags, amount, performanceMode = 0, extra = {}) {
  featureFlags.wormholeSkybox = false;
  State.sampleRate = 48000;
  State.hopSize = 1024;
  State.frames = Array.from({ length: 400 }, testFrame);
  State.events = [];
  State.bpm = 128;
  State.currentTime = 3;
  State.exportTime = 0;
  State.isExporting = false;
  State.isPlaying = true;
  State.playbackFade = 1;
  State.currentFrame = testFrame();
  State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
  State.trackAnalysis.timingConfidence.overall = 0.9;
  State.trackAnalysis.features = [];
  State.trackAnalysis.bars = [];

  Object.assign(State.visualTuning, {
    performanceMode,
    chromaKeyMode: 0,
    wormholeDepth: 1.5,
    wormholeSpeed: 2,
    wormholeRadius: 1,
    wormholeCurve: 0.4,
    wormholeWarp: 0.8,
    wormholePathBend: 0.35,
    wormholePathBendVertical: -0.2,
    wormholeRing: 0.25,
    wormholeDepthCoherence: 0.3,
    wormholeJitter: 0.1,
    wormholeEmissionMode: 0,
    wormholeStarfield: 0,
    wormholeGalaxy: 0,
    wormholeSkybox: 0,
    wormholeWall: 0,
    wormholeLens: 0,
    wormholeNebulaAmount: amount,
    wormholeNebulaDetail: 0.65,
    wormholeNebulaBloom: 0.7,
    wormholeNebulaWeave: 0,
    wormholeSpiral: 0,
    wormholeSpiralArms: 0,
    wormholeGrainDensity: 0,
    ...extra
  });
  Object.assign(State.targetTuning, State.visualTuning);
}

function makeBackend(refuseRaster = false) {
  let currentStroke = [0, 0, 0, 0];
  let currentWeight = 0;
  const buffers = new Map();
  return {
    width: 640,
    height: 360,
    frameCount: 1,
    lines: [],
    beginCalls: [],
    drawCalls: [],
    background() {}, noStroke() {}, noFill() {}, fill() {},
    stroke(r, g, b, a) { currentStroke = [r, g, b, a]; },
    strokeWeight(weight) { currentWeight = weight; },
    line(px, py, sx, sy) {
      this.lines.push({ coords: [px, py, sx, sy], stroke: [...currentStroke], weight: currentWeight });
    },
    circle() {}, triangle() {}, beginShape() {}, vertex() {}, endShape() {},
    radialGlow() {}, radialDim() {}, compositeRingTint() {},
    beginFieldRaster(layer, cols, rows) {
      this.beginCalls.push([layer, cols, rows]);
      if (refuseRaster) return null;
      const buffer = new Float32Array(cols * rows * 4);
      buffers.set(layer, buffer);
      return buffer;
    },
    drawFieldRaster(layer, x, y, width, height, gain, blend) {
      this.drawCalls.push([layer, x, y, width, height, gain, blend]);
    }
  };
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function render({ amount, refuseRaster = false, performanceMode = 0, stubs = new Map(), tuning = {} }) {
  const load = createSourceLoader(stubs);
  const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
  const { State } = load('state/store.ts');
  const { featureFlags } = load('config/featureFlags.ts');
  setupState(State, featureFlags, amount, performanceMode, tuning);
  const identity = new CosmicWormholeIdentity();
  identity.syncPosition(State.currentTime);
  const backend = makeBackend(refuseRaster);
  identity.draw(backend, [], []);
  return { backend, State };
}

/** Grain carriers only; the weave pass feeds the same accumulator with `weave: 1` commands. */
function grainCarriers(carriers) {
  return carriers.filter(carrier => carrier.weave !== 1);
}

function weaveCarriers(carriers) {
  return carriers.filter(carrier => carrier.weave === 1);
}

function capturingMaterialStub(carriers) {
  return {
    resolveWormholeGrainMaterialRasterSize(_width, _height, _detail, _highTier, out) {
      out.cols = 64;
      out.rows = 36;
      return out;
    },
    clearWormholeGrainMaterialBuffers(l0, l1, l2) { l0.fill(0); l1.fill(0); l2.fill(0); },
    accumulateWormholeGrainCarrier(_l0, _cols, _rows, _width, _height, carrier) {
      carriers.push(json(carrier));
    },
    resolveWormholeGrainMaterial() {}
  };
}

test('amount zero performs exact legacy line work and makes zero raster calls', () => {
  const { backend } = render({ amount: 0 });
  assert.ok(backend.lines.length > 0, 'foreground grains must still render');
  assert.equal(backend.beginCalls.length, 0);
  assert.equal(backend.drawCalls.length, 0);
});

test('backend refusal falls back to the exact amount-zero line commands for the whole frame', () => {
  const disabled = render({ amount: 0 }).backend;
  const refused = render({ amount: 1, refuseRaster: true }).backend;
  assert.equal(refused.beginCalls.length, 3, 'all three requests are attempted before the grain loop');
  assert.equal(refused.drawCalls.length, 0);
  assert.deepEqual(json(refused.lines), json(disabled.lines));
});

test('legacy line and raster accumulator consume identical corrected/capped endpoints', () => {
  const carriers = [];
  const materialStub = capturingMaterialStub(carriers);
  const { backend } = render({
    amount: 0.5,
    stubs: new Map([[MATERIAL_PATH, materialStub]])
  });

  const grains = grainCarriers(carriers);
  assert.equal(grains.length, backend.lines.length);
  for (let index = 0; index < grains.length; index++) {
    const carrier = grains[index];
    assert.deepEqual(
      [carrier.tailX, carrier.tailY, carrier.headX, carrier.headY],
      backend.lines[index].coords
    );
  }
  assert.deepEqual(backend.drawCalls.map(call => call[0]), [2, 1, 0]);
});

test('amount crossfade preserves endpoints, halves legacy alpha, and amount one removes only legacy grain lines', () => {
  const disabled = render({ amount: 0 }).backend;

  const halfCarriers = [];
  const half = render({
    amount: 0.5,
    stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(halfCarriers)]])
  }).backend;
  assert.equal(half.lines.length, disabled.lines.length);
  for (let index = 0; index < disabled.lines.length; index++) {
    assert.deepEqual(half.lines[index].coords, disabled.lines[index].coords);
    assert.equal(half.lines[index].stroke[3], disabled.lines[index].stroke[3] * 0.5);
    assert.equal(half.lines[index].weight, disabled.lines[index].weight);
  }

  const fullCarriers = [];
  const full = render({
    amount: 1,
    stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(fullCarriers)]])
  }).backend;
  assert.equal(full.lines.length, 0);
  assert.equal(grainCarriers(fullCarriers).length, disabled.lines.length);
  assert.deepEqual(full.drawCalls.map(call => call[0]), [2, 1, 0]);
});

test('enabling material does not increase route/tube projection work', () => {
  function projectedCallCount(amount) {
    const realLoad = createSourceLoader();
    const realGrainField = realLoad('visuals/WormholeGrainField.ts');
    let count = 0;
    const wrappedGrainField = {
      ...realGrainField,
      projectWormholeTubePoint(...args) {
        count++;
        return realGrainField.projectWormholeTubePoint(...args);
      }
    };
    const carriers = [];
    render({
      amount,
      stubs: new Map([
        [GRAIN_FIELD_PATH, wrappedGrainField],
        [MATERIAL_PATH, capturingMaterialStub(carriers)]
      ])
    });
    return count;
  }

  const disabledCount = projectedCallCount(0);
  const activeCount = projectedCallCount(1);
  assert.ok(disabledCount > 0);
  assert.equal(activeCount, disabledCount);
});

test('performance mode keeps foreground lines and bypasses raster acquisition', () => {
  const { backend } = render({ amount: 1, performanceMode: 1 });
  assert.ok(backend.lines.length > 0);
  assert.equal(backend.beginCalls.length, 0);
  assert.equal(backend.drawCalls.length, 0);
});

test('identity contains one carrier loop handoff and no superseded background/lens-field path', () => {
  const source = readFileSync(IDENTITY_PATH, 'utf8');
  assert.doesNotMatch(source, /wormholeNebulaField|drawNebulaField|wormholeLensUnwarp/);
  assert.match(source, /from '\.\/wormholeGrainMaterialRaster'/);

  const loopEnd = source.indexOf('wormholeDepthDiagnostics.endFrame()');
  const loopStart = source.lastIndexOf('for (let i = 0; i < activeGrainCount; i++)', loopEnd);
  const grainLoop = source.slice(loopStart, loopEnd);
  assert.equal((grainLoop.match(/= projectWormholeTubePoint\(/g) ?? []).length, 2);
  assert.equal((grainLoop.match(/accumulateWormholeGrainCarrier\(/g) ?? []).length, 1);
  assert.equal((grainLoop.match(/backend\.line\(/g) ?? []).length, 2, 'one exact fallback and one active crossfade call site');
  assert.ok(grainLoop.indexOf('wormholeProjectedTrailScale') < grainLoop.indexOf('accumulateWormholeGrainCarrier'));
  assert.ok(grainLoop.indexOf('accumulateWormholeGrainCarrier') < grainLoop.lastIndexOf('backend.line'));

  // The weave pass owns the only other handoff, and it may not reproject or resample the route.
  const weaveStart = source.indexOf('private drawGrainWeave(');
  const weaveBodyStart = source.indexOf('private weaveNeighbour(', weaveStart);
  const afterWeave = source.indexOf('private ', weaveBodyStart + 'private '.length);
  const weavePass = source.slice(weaveStart, afterWeave > weaveBodyStart ? afterWeave : source.length);
  assert.equal((weavePass.match(/accumulateWormholeGrainCarrier\(/g) ?? []).length, 2,
    'one straight ring chord and one Hermite arm segment call site');
  assert.doesNotMatch(weavePass, /projectWormholeTubePoint|routePath|sampleSmoothedLookahead/);
});

// -- connective weave and spiral geometry (spiral material plan S1/S4/S5) --------------------

test('the weave only exists while the material raster is active and the weave amount is nonzero', () => {
  const off = [];
  render({ amount: 1, stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(off)]]), tuning: { wormholeNebulaWeave: 0 } });
  assert.equal(weaveCarriers(off).length, 0, 'zero weave amount emits no connective carriers');

  const on = [];
  render({ amount: 1, stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(on)]]), tuning: { wormholeNebulaWeave: 0.6 } });
  assert.ok(weaveCarriers(on).length > 0, 'an active weave amount emits connective carriers');
  assert.equal(grainCarriers(on).length, grainCarriers(off).length, 'the weave never changes the grain carrier set');

  const disabled = render({ amount: 0, tuning: { wormholeNebulaWeave: 1 } }).backend;
  assert.equal(disabled.beginCalls.length, 0, 'a weave cannot resurrect raster work at amount zero');
});

test('weave carriers stay bounded, tagged, and never brighter than the grains they join', () => {
  const carriers = [];
  render({
    amount: 1,
    stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(carriers)]]),
    tuning: { wormholeNebulaWeave: 0.6 }
  });
  const grains = grainCarriers(carriers);
  const weaves = weaveCarriers(carriers);
  const brightestGrain = Math.max(...grains.map(carrier => carrier.alpha));
  for (const carrier of weaves) {
    assert.equal(carrier.weave, 1);
    assert.ok(carrier.depth >= 0 && carrier.depth <= 1, 'weave depth is the mean of two resolved depths');
    assert.ok(carrier.alpha <= brightestGrain * 0.6 + 1e-9, 'a weave is capped by its dimmer endpoint');
    assert.ok(Number.isFinite(carrier.headX + carrier.headY + carrier.tailX + carrier.tailY));
  }
});

test('spiral twist, arm density, and grain density are inert while the material is off', () => {
  // These three are conditioning for the Nebula material: at amount 0 they must force back to
  // the historical single-copy, non-twisted field regardless of their own tuning value, so the
  // legacy default render -- the overwhelming default case across the app -- never changes.
  const historical = render({ amount: 0 }).backend;
  const stillHistorical = render({
    amount: 0,
    tuning: { wormholeSpiral: 3, wormholeSpiralArms: 6, wormholeGrainDensity: 1 }
  }).backend;
  assert.deepEqual(json(stillHistorical.lines), json(historical.lines));
});

test('spiral twist, arm density, and grain density activate once the material is on, and default to the tuned look', () => {
  const zeroCarriers = [];
  render({
    amount: 1,
    stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(zeroCarriers)]]),
    tuning: { wormholeSpiral: 0, wormholeSpiralArms: 0, wormholeGrainDensity: 0 }
  });
  const twistedCarriers = [];
  render({
    amount: 1,
    stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(twistedCarriers)]]),
    tuning: { wormholeSpiral: 1.2 }
  });
  const zeroGrains = grainCarriers(zeroCarriers);
  const twistedGrains = grainCarriers(twistedCarriers);
  assert.equal(twistedGrains.length, zeroGrains.length, 'twist moves grains, it does not add or drop them');
  assert.ok(
    twistedGrains.some((carrier, index) => carrier.headX !== zeroGrains[index].headX || carrier.headY !== zeroGrains[index].headY),
    'a nonzero twist must actually rotate the field once the material is active'
  );

  const tunedDensityCarriers = [];
  render({
    amount: 1,
    stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(tunedDensityCarriers)]]),
    tuning: { wormholeGrainDensity: 0.34 }
  });
  assert.ok(
    grainCarriers(tunedDensityCarriers).length > zeroGrains.length,
    'a nonzero grain density must add carriers over the historical single copy'
  );

  const fullDensityCarriers = [];
  render({
    amount: 1,
    stubs: new Map([[MATERIAL_PATH, capturingMaterialStub(fullDensityCarriers)]]),
    tuning: { wormholeGrainDensity: 1 }
  });
  assert.ok(grainCarriers(fullDensityCarriers).length > zeroGrains.length * 2, 'full density activates the extra grain copies');
});

test('the shipped defaults for spiral, arm, and density conditioning are the tuned optimum, not zero', () => {
  const load = createSourceLoader();
  const { defaultVisualTuning } = load('config/visualTuning.ts');
  assert.ok(defaultVisualTuning.wormholeSpiral > 0, 'spiral twist should default to the validated look once enabled');
  assert.ok(defaultVisualTuning.wormholeSpiralArms > 0, 'arm density wave should default to the validated look once enabled');
  assert.ok(defaultVisualTuning.wormholeGrainDensity > 0, 'grain density should default to the validated look once enabled');
  assert.equal(defaultVisualTuning.wormholeNebulaAmount, 0, 'the master gate itself stays off by default, per the architecture gate');
});
