import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const PRESET_ROOT = join(process.cwd(), 'public/visual-tuning-presets');
const DIFFERENTIATION_THRESHOLD = 0.09;
const LEGACY_DISSOLVE_DRIFT_DISTANCE = 0.070899;

function createSrcLoader() {
  const moduleCache = new Map();
  function resolvePath(request, parentPath) {
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    if (base.endsWith('.ts')) return base;
    try {
      readFileSync(`${base}.ts`, 'utf8');
      return `${base}.ts`;
    } catch {
      return join(base, 'index.ts');
    }
  }
  function load(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;
    const output = ts.transpileModule(readFileSync(filePath, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    moduleCache.set(filePath, module);
    vm.runInNewContext(output, {
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      Math,
      Number
    }, { filename: filePath });
    return module.exports;
  }
  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const { defaultVisualTuning, visualTuningControls } = createSrcLoader()('config/visualTuning.ts');
const controlsByKey = new Map(Array.from(visualTuningControls, (control) => [control.key, control]));
const presetFiles = readdirSync(PRESET_ROOT).filter((name) => /^vos-wh-.*\.json$/.test(name)).sort();
const backgroundMasters = new Set(['wormholeStarfield', 'wormholeGalaxy', 'wormholeSkybox']);
const weights = {
  // Geometry/motion variables define the character; material variables still prevent lookalikes.
  wormholeRadius: 3,
  wormholeDepth: 1,
  wormholeSpeed: 1.5,
  wormholeWarp: 1.5,
  wormholePathBend: 2,
  wormholePathBendVertical: 1,
  wormholeCurve: 0.5,
  wormholeRing: 0.5,
  wormholeDepthCoherence: 0.5,
  wormholeContinuity: 0.5,
  wormholeEmissionMode: 0.5,
  wormholeJitter: 0.5
};
const weightedKeys = Object.keys(weights);
const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

function readPreset(name) {
  return JSON.parse(readFileSync(join(PRESET_ROOT, name), 'utf8')).visualTuning;
}

function weightedDistance(left, right) {
  let squaredDistance = 0;
  for (const key of weightedKeys) {
    const control = controlsByKey.get(key);
    assert.ok(control, `control metadata for ${key}`);
    const leftValue = left[key] ?? defaultVisualTuning[key];
    const rightValue = right[key] ?? defaultVisualTuning[key];
    const normalizedDelta = (leftValue - rightValue) / (control.max - control.min);
    squaredDistance += weights[key] * normalizedDelta * normalizedDelta;
  }
  return Math.sqrt(squaredDistance / weightTotal);
}

test('wormhole factory presets keep a minimum normalized weighted separation', () => {
  const presets = Object.fromEntries(presetFiles.map((name) => [name, readPreset(name)]));
  const distances = [];
  for (let leftIndex = 0; leftIndex < presetFiles.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < presetFiles.length; rightIndex++) {
      const leftName = presetFiles[leftIndex];
      const rightName = presetFiles[rightIndex];
      const distance = weightedDistance(presets[leftName], presets[rightName]);
      distances.push({ leftName, rightName, distance });
      assert.ok(
        distance >= DIFFERENTIATION_THRESHOLD,
        `${leftName} / ${rightName} distance ${distance.toFixed(6)} is below ${DIFFERENTIATION_THRESHOLD}`
      );
    }
  }

  const dissolveDrift = distances.find(({ leftName, rightName }) =>
    leftName === 'vos-wh-dissolve.json' && rightName === 'vos-wh-drift.json'
  ).distance;
  assert.ok(
    dissolveDrift >= LEGACY_DISSOLVE_DRIFT_DISTANCE + 0.025,
    `dissolve/drift improved from ${LEGACY_DISSOLVE_DRIFT_DISTANCE} to ${dissolveDrift.toFixed(6)}`
  );
});

test('wormhole preset speeds retain the authored dramaturgical ordering', () => {
  const role = (name) => readPreset(`vos-wh-${name}.json`).wormholeSpeed;
  assert.ok(role('overdrive') > role('punch'));
  assert.ok(role('punch') > role('spiral'));
  assert.ok(role('spiral') >= role('drive'));
  assert.ok(role('drive') > role('collapse'));
  assert.ok(role('collapse') > role('sparse'));
  assert.ok(role('sparse') > role('establish'));
  assert.ok(role('establish') > role('galaxy'));
  assert.ok(role('galaxy') > role('dissolve'));
  assert.ok(role('dissolve') > role('drift'));
});
