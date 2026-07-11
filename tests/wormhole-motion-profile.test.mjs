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
    const source = readFileSync(filePath, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const context = vm.createContext({
      exports: module.exports,
      module,
      require(request) {
        const base = normalize(join(dirname(filePath), request));
        return load(base.endsWith('.ts') ? base : `${base}.ts`);
      },
      Math,
      Number
    });
    vm.runInContext(output, context, { filename: filePath });
    return module.exports;
  }
  return load(join(SRC_ROOT, entry));
}

const { computeWormholeMotionProfile } = loadTs('visuals/WormholeMotionProfile.ts');
const {
  createWormholeGrainCharacter, wormholeGrainFlowAngle, wormholeKickSwarmGain,
  wormholeKickReleaseEnvelope
} = loadTs('visuals/WormholeGrainField.ts');

function profile(overrides = {}) {
  const spectrum = overrides.perceptualSpectrum ?? new Array(24).fill(0.35);
  return computeWormholeMotionProfile({
    bpm: 120,
    currentFrame: { e: 0.7, eRatio: 0.75, densityProj: 0.65, melodyProj: 0, fxProj: 0, perceptualSpectrum: spectrum, state: 'HIGH' },
    currentFeatures: { melody: 0, vocal: 0, fx: 0, density: 0.65, brightness: 0.5, tension: 0.5 },
    perceptualSpectrum: spectrum,
    beatDecay: 0,
    denseImpactFlash: 0,
    directorOutput: { state: 'DROP', centripetalOrbit: 0, glitchIntensity: 0, invertBackground: false },
    timingConfidence: 0.9,
    ...overrides
  });
}

test('wormhole travel speed scales monotonically with trusted BPM', () => {
  const slow = profile({ bpm: 82 });
  const medium = profile({ bpm: 120 });
  const fast = profile({ bpm: 174 });
  assert.ok(slow.travelSpeed < medium.travelSpeed);
  assert.ok(medium.travelSpeed < fast.travelSpeed);
});

test('kick evidence produces a short depth pulse and cohort impulse', () => {
  const kickSpectrum = [...new Array(8).fill(0.95), ...new Array(16).fill(0.08)];
  const idle = profile({ perceptualSpectrum: kickSpectrum, beatDecay: 0, denseImpactFlash: 0 });
  const kick = profile({ perceptualSpectrum: kickSpectrum, beatDecay: 1, denseImpactFlash: 0.8 });
  assert.ok(kick.depthPulse > idle.depthPulse + 0.5);
  assert.ok(kick.kickJitter > idle.kickJitter + 0.3);
  assert.ok(kick.travelSpeed > idle.travelSpeed);
});

test('a beat without low-band support does not masquerade as a kick', () => {
  const highTransient = [...new Array(8).fill(0), ...new Array(16).fill(0.95)];
  const response = profile({ perceptualSpectrum: highTransient, beatDecay: 1, denseImpactFlash: 1 });
  assert.equal(response.depthPulse, 0);
  assert.equal(response.kickJitter, 0);
});

test('kick swarm is silent between kicks and admits only a discontinuous grain subset', () => {
  let activeOnKick = 0;
  for (let index = 1; index <= 1000; index++) {
    const character = createWormholeGrainCharacter(index * 12.9898);
    assert.equal(wormholeKickSwarmGain(character, 0, 0.9), 0, 'no continuous jitter between kicks');
    if (wormholeKickSwarmGain(character, 1, 0.9) > 0) activeOnKick++;
  }
  assert.ok(activeOnKick > 200 && activeOnKick < 380, `kick cohort remains partial (${activeOnKick}/1000)`);
});

test('release character decays monotonically by forward distance without a position helper', () => {
  const distances = [0, 10, 20, 40, 80, 160];
  let previousGain = Infinity;
  for (const distance of distances) {
    const gain = wormholeKickReleaseEnvelope(distance);
    assert.ok(gain <= previousGain + 1e-9, `release gain increased at distance ${distance}`);
    previousGain = gain;
  }
  assert.ok(wormholeKickReleaseEnvelope(1000) < 0.01, 'far enough from release the push has fully settled');
  const source = readFileSync(join(SRC_ROOT, 'visuals/WormholeGrainField.ts'), 'utf8');
  assert.doesNotMatch(source, /wormholeRelease(?:Swarm|LowDrop)Offset/);
});

test('grain field contains fine dust, structural grains, and sparse highlights', () => {
  const characters = Array.from({ length: 1000 }, (_, index) => createWormholeGrainCharacter((index + 1) * 12.9898));
  const fine = characters.filter((character) => character.weightScale < 0.8).length;
  const body = characters.filter((character) => character.weightScale >= 0.8 && character.weightScale < 1.3).length;
  const sparks = characters.filter((character) => character.weightScale >= 1.3).length;
  assert.ok(fine > body && body > sparks && sparks > 50, `expected authored population mix (${fine}/${body}/${sparks})`);
  assert.ok(Math.min(...characters.map((character) => character.trailScale)) < 0.6);
  assert.ok(Math.max(...characters.map((character) => character.trailScale)) > 1.2);
});

test('warp advects grains independently instead of rotating the field as one tube', () => {
  const first = createWormholeGrainCharacter(12.9898);
  const second = createWormholeGrainCharacter(25.9796);
  const firstAngle = wormholeGrainFlowAngle(first, 0.45, 2.2, 0.4, 0.7);
  const secondAngle = wormholeGrainFlowAngle(second, 0.45, 2.2, 0.4, 0.7);
  assert.notEqual(firstAngle, secondAngle, 'individual phases produce different angular displacement');
  assert.notEqual(first.flowRate, second.flowRate, 'individual flow rates differ');
  assert.equal(wormholeGrainFlowAngle(first, 0.45, 0, 0, 0), 0, 'zero warp leaves the authored position intact');
});

test('grain flow angle depends only on depth, never on wall-clock time', () => {
  // Same character and depth must always produce the same swirl offset: nothing in the
  // signature carries elapsed time, so a grain holding position cannot wobble back and forth.
  const character = createWormholeGrainCharacter(41.234);
  const first = wormholeGrainFlowAngle(character, 0.6, 1.4, 0.5, 0.3);
  const second = wormholeGrainFlowAngle(character, 0.6, 1.4, 0.5, 0.3);
  assert.equal(first, second);
  assert.notEqual(
    wormholeGrainFlowAngle(character, 0.2, 1.4, 0.5, 0.3),
    first,
    'a different depth (i.e. forward progress) is what changes the swirl, not time'
  );
});

test('grain flow is monotonic along forward progress and curve zero is an exact baseline', () => {
  for (let index = 1; index <= 64; index++) {
    const character = createWormholeGrainCharacter(index * 12.9898);
    assert.equal(
      wormholeGrainFlowAngle(character, 0.35, 2.6, 0, 1),
      0,
      'wormholeCurve=0 must disable local curvature even with maximum warp and bass'
    );
    const angles = Array.from(
      { length: 41 },
      (_, sample) => wormholeGrainFlowAngle(character, 1 - sample / 40, 2.2, 0.7, 0.8)
    );
    const direction = Math.sign(angles.at(-1) - angles[0]);
    assert.notEqual(direction, 0);
    for (let sample = 1; sample < angles.length; sample++) {
      assert.ok(
        (angles[sample] - angles[sample - 1]) * direction >= -1e-12,
        `grain ${index} reversed angular flow at sample ${sample}`
      );
    }
  }
  assert.doesNotMatch(wormholeGrainFlowAngle.toString(), /Math\.(sin|cos)/);
});

test('renderer keeps the lens fixed and delegates local swarm motion', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/CosmicWormholeIdentity.ts'), 'utf8');
  assert.match(source, /const cx = backend\.width \/ 2;/);
  assert.match(source, /const cy = backend\.height \/ 2;/);
  assert.doesNotMatch(source, /cameraKick|kickPhase/);
  assert.doesNotMatch(source, /z \* warpK|curveImpulse|lastDirectorState|curveOffset[XY]/);
  assert.match(source, /wormholeKickSwarmGain\(grain, motion\.kickJitter, jitter\)/);
  assert.match(source, /wormholeGrainFlowAngle\(\s*grain,/);
});

test('sustained bass becomes warp pressure, not repeated kick pulses', () => {
  const bass = [...new Array(8).fill(0.95), ...new Array(16).fill(0.05)];
  const sustained = profile({ perceptualSpectrum: bass, beatDecay: 0, denseImpactFlash: 0 });
  const kick = profile({ perceptualSpectrum: bass, beatDecay: 1, denseImpactFlash: 1 });
  assert.equal(sustained.depthPulse, 0);
  assert.ok(sustained.bassWarp > 0.8, `expected sustained warp, got ${sustained.bassWarp}`);
  assert.ok(kick.depthPulse > 0.8, `expected kick pulse, got ${kick.depthPulse}`);
  assert.ok(kick.bassWarp < sustained.bassWarp * 0.3, 'transient is routed away from sustained warp');
});

test('low timing confidence restrains tempo authority and transient motion', () => {
  const confident = profile({ bpm: 174, beatDecay: 1, denseImpactFlash: 1, timingConfidence: 0.95 });
  const uncertain = profile({ bpm: 174, beatDecay: 1, denseImpactFlash: 1, timingConfidence: 0.08 });
  assert.ok(uncertain.travelSpeed < confident.travelSpeed);
  assert.ok(uncertain.depthPulse < confident.depthPulse);
  assert.ok(uncertain.kickJitter < confident.kickJitter);
  assert.ok(uncertain.perspectiveCompression <= confident.perspectiveCompression);
});
