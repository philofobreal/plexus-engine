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
const depth = loadTs('visuals/WormholeDepth.ts');
const grains = loadTs('visuals/WormholeGrainField.ts');

function preset(role) {
  return JSON.parse(readFileSync(join(process.cwd(), `public/visual-tuning-presets/vos-wh-${role}.json`), 'utf8')).visualTuning;
}

function projectedMotion(role) {
  const tuning = preset(role);
  const sampleRate = 48000;
  const hopSize = 1024;
  const frames = Array.from({ length: 240 }, () => ({
    e: 0.68, eRatio: 0.74, densityProj: 0.66, melodyProj: 0, fxProj: 0,
    perceptualSpectrum: new Array(24).fill(0.42), state: 'HIGH'
  }));
  const features = Array.from({ length: frames.length }, () => ({
    melody: 0, vocal: 0, fx: 0, density: 0.66, brightness: 0.5, tension: 0.55
  }));
  const transport = new timeline.WormholeTransport();
  transport.sync(frames, sampleRate, hopSize, [], features, 128, 0.9);
  const speed = new timeline.WormholeAuthoredSpeedTimeline();
  speed.reset(0, tuning.wormholeSpeed);
  const horizon = 1000 * tuning.wormholeDepth;
  const fov = 1080 * 1.2;
  const tubeRadius = 70 * tuning.wormholeRadius;
  const distanceAt = (time) => transport.distanceAt(time) + speed.offsetAt(time, tuning.wormholeSpeed, 1);
  const phaseAt = (time) => depth.wrapDepthPhase(distanceAt(time) / horizon);
  const phases = Array.from({ length: 21 }, (_, sample) => phaseAt(2 + sample / 20));
  let visible = 0;
  let changed = 0;
  let displacement = 0;

  for (let index = 0; index < 360; index++) {
    const basePhase = ((Math.floor(index / 24) + ((index * 37) % 101) / 101) / 15) % 1;
    const theta = (index % 24) / 24 * Math.PI * 2;
    let firstX = 0;
    let firstY = 0;
    let previousX = 0;
    let previousY = 0;
    let pathLength = 0;
    let fullyVisible = true;
    for (let sample = 0; sample <= 20; sample++) {
      const z = depth.depthFromPhase(basePhase, phases[sample], horizon);
      if (grains.wormholeNearPlaneVisibility(z, horizon) <= 0) {
        fullyVisible = false;
        break;
      }
      const x = Math.cos(theta) * tubeRadius / z * fov;
      const y = Math.sin(theta) * tubeRadius / z * fov;
      if (sample === 0) {
        firstX = x;
        firstY = y;
      } else {
        pathLength += Math.min(80, Math.hypot(x - previousX, y - previousY));
      }
      previousX = x;
      previousY = y;
    }
    if (!fullyVisible) continue;
    const endpointDelta = Math.hypot(previousX - firstX, previousY - firstY);
    visible++;
    if (endpointDelta >= 3) changed++;
    displacement += pathLength;
  }
  return { changedRatio: changed / Math.max(1, visible), motion: displacement / Math.max(1, visible) };
}

test('drive advances a substantial projected grain population within one second', () => {
  const drive = projectedMotion('drive');
  assert.ok(drive.changedRatio >= 0.4, `drive projected change ratio ${drive.changedRatio}`);
  assert.ok(drive.motion >= 8, `drive projected motion ${drive.motion}`);
});

test('projected forward motion preserves overdrive > punch > drive > drift', () => {
  const metrics = Object.fromEntries(['overdrive', 'punch', 'drive', 'drift'].map((role) => [role, projectedMotion(role)]));
  assert.ok(metrics.overdrive.motion > metrics.punch.motion, JSON.stringify(metrics));
  assert.ok(metrics.punch.motion > metrics.drive.motion, JSON.stringify(metrics));
  assert.ok(metrics.drive.motion > metrics.drift.motion, JSON.stringify(metrics));
});

test('raising wormholeSpeed increases projected travel rather than only trail length', () => {
  const drive = projectedMotion('drive');
  const overdrive = projectedMotion('overdrive');
  assert.ok(overdrive.changedRatio >= drive.changedRatio, `${overdrive.changedRatio} vs ${drive.changedRatio}`);
  assert.ok(overdrive.motion >= drive.motion * 1.25, `${overdrive.motion} vs ${drive.motion}`);
});
