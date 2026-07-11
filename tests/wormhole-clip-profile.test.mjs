import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Cosmic Wormhole Videoclip Profile (ADR-005 data extension) - contract tests for the
// wormhole action vocabulary, its clip preset family, and the low-confidence fallback.
// The profile is a deterministic, music-aware BASELINE videoclip performance profile
// realized entirely through existing Visual OS data mechanisms (behaviourVocabulary +
// targetMap + presets); these tests pin that contract.

const SRC_ROOT = join(process.cwd(), 'src');
const PRESET_ROOT = join(process.cwd(), 'public/visual-tuning-presets');

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
    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const context = vm.createContext({
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      Float32Array,
      Math,
      Number
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }

  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const load = (entry) => createSrcLoader()(entry);

const STYLE_PACKS = JSON.parse(readFileSync(join(PRESET_ROOT, 'style-packs.json'), 'utf8'));
const PRESET_INDEX = JSON.parse(readFileSync(join(PRESET_ROOT, 'index.json'), 'utf8'));

// Discovered from the FILESYSTEM (not from index.json), so a preset that exists on disk but was
// forgotten in the manifest still gets scanned and still fails the registration test below.
const WH_PRESET_FILES = readdirSync(PRESET_ROOT).filter((name) => /^vos-wh-.*\.json$/.test(name)).sort();

function readPreset(name) {
  return JSON.parse(readFileSync(join(PRESET_ROOT, name), 'utf8'));
}

const WH_ROLES = ['establish', 'drive', 'spiral', 'sparse', 'punch', 'overdrive', 'drift', 'collapse', 'galaxy', 'dissolve'];
const MAIN_DRAMATURGY_KEYS = ['intro', 'groove', 'tension', 'build', 'fake-drop', 'release', 'peak', 'breakdown', 'outro', 'default'];
const WORMHOLE_TUNING_KEYS = [
  'wormholeRadius',
  'wormholeDepth',
  'wormholeSpeed',
  'wormholeWarp',
  'wormholeCurve',
  'wormholePathBend',
  'wormholePathBendVertical',
  'wormholeRing',
  'wormholeDepthCoherence',
  'wormholeContinuity',
  'wormholeStarfield',
  'wormholeGalaxy',
  'wormholeSkybox',
  'wormholeEmissionMode',
  'wormholeJitter'
];
const WORMHOLE_BACKGROUND_MASTER_KEYS = ['wormholeStarfield', 'wormholeGalaxy', 'wormholeSkybox'];
// `wormholePathBendVertical` defaults to zero for the family. Task 11 authors it only on the
// galaxy reveal, so it remains optional while still being an owned wormhole tuning key.
const WORMHOLE_UNPRESETED_KEYS = ['wormholePathBendVertical'];
const WORMHOLE_FACTORY_PRESET_KEYS = WORMHOLE_TUNING_KEYS.filter(
  (key) => !WORMHOLE_BACKGROUND_MASTER_KEYS.includes(key) && !WORMHOLE_UNPRESETED_KEYS.includes(key)
);

// -- Preset family contract ----------------------------------------------------

test('all 10 wormhole clip presets exist, are registered, and cover every clip role', () => {
  assert.equal(WH_PRESET_FILES.length, 10, `10 vos-wh presets on disk (${WH_PRESET_FILES.length})`);
  for (const role of WH_ROLES) {
    assert.ok(WH_PRESET_FILES.includes(`vos-wh-${role}.json`), `vos-wh-${role}.json exists on disk`);
  }
  // Registration is two-way: every file on disk is in the manifest, every manifest entry exists.
  const registered = PRESET_INDEX.presets.filter((name) => /^vos-wh-/.test(name)).sort();
  for (const name of WH_PRESET_FILES) {
    assert.ok(registered.includes(name), `${name} registered in index.json`);
  }
  for (const name of registered) {
    assert.ok(WH_PRESET_FILES.includes(name), `${name} registered in index.json but missing on disk`);
  }
});

test('every wormhole clip preset carries the route/grain wormhole role keys explicitly and leaves background masters global', () => {
  for (const name of WH_PRESET_FILES) {
    const tuning = readPreset(name).visualTuning ?? {};
    for (const key of WORMHOLE_FACTORY_PRESET_KEYS) {
      assert.ok(key in tuning, `${name} must explicitly carry ${key}`);
    }
    for (const key of WORMHOLE_BACKGROUND_MASTER_KEYS) {
      assert.ok(!(key in tuning), `${name} must not reset user-global ${key}`);
    }
  }
});

test('identity tuning registry owns wormhole keys once and filters only automation foreign writes', () => {
  const registry = load('config/identityTuningRegistry.ts');
  assert.deepEqual(Array.from(registry.ownedTuningKeysForIdentity('cosmic-wormhole')), WORMHOLE_TUNING_KEYS);
  for (const key of WORMHOLE_TUNING_KEYS) {
    assert.equal(registry.ownerForTuningKey(key), 'cosmic-wormhole', `${key} owner`);
  }

  const generic = registry.filterForeignIdentityTuningForAutomation({
    visualTuning: {
      wormholeDepth: 4,
      wormholePathBend: 0.7,
      lineAlpha: 1.2
    }
  }, 'cosmic-wormhole');
  assert.equal(JSON.stringify(generic.visualTuning), JSON.stringify({ wormholeDepth: 4, wormholePathBend: 0.7, lineAlpha: 1.2 }));

  const foreign = registry.filterForeignIdentityTuningForAutomation({
    visualMode: 'temporal',
    visualTuning: {
      wormholeDepth: 4,
      wormholePathBend: 0.7,
      lineAlpha: 1.2
    }
  }, 'cosmic-wormhole');
  assert.equal(JSON.stringify(foreign.visualTuning), JSON.stringify({ lineAlpha: 1.2 }));

  const authored = registry.filterForeignIdentityTuningForAutomation({
    visualMode: 'cosmic-wormhole',
    visualTuning: {
      wormholeDepth: 4,
      wormholePathBend: 0.7,
      lineAlpha: 1.2
    }
  }, 'cosmic-wormhole');
  assert.equal(JSON.stringify(authored.visualTuning), JSON.stringify({ wormholeDepth: 4, wormholePathBend: 0.7, lineAlpha: 1.2 }));
});

test('every wormhole clip preset pins visualMode to cosmic-wormhole', () => {
  for (const name of WH_PRESET_FILES) {
    assert.equal(readPreset(name).visualMode, 'cosmic-wormhole', `${name} carries visualMode`);
  }
});

test('all presets stay visible and ring quantization is limited to authored ring roles', () => {
  for (const role of WH_ROLES) {
    const tuning = readPreset(`vos-wh-${role}.json`).visualTuning;
    const floor = 1.25;
    assert.ok(tuning.lineAlpha >= floor, `${role} remains visibly above the opacity floor`);
    if (role !== 'collapse') {
      assert.equal(tuning.wormholeRing, 0, `${role} does not quantize depth into rings`);
    }
  }
  const collapse = readPreset('vos-wh-collapse.json').visualTuning;
  assert.ok(collapse.wormholeRing >= 0.25 && collapse.wormholeRing <= 0.4, 'collapse ring compression stays restrained');
});

test('weak roles pin a deep-perspective depth and continuity profile', () => {
  const expected = {
    establish: [3.4, 1.1],
    drive: [2.8, 1.35],
    spiral: [3.0, 1.45],
    sparse: [4.7, 2.0],
    drift: [5.0, 1.55],
    galaxy: [4.6, 2.0],
    dissolve: [4.2, 0.9]
  };
  for (const [role, [depth, continuity]] of Object.entries(expected)) {
    const tuning = readPreset(`vos-wh-${role}.json`).visualTuning;
    assert.equal(tuning.wormholeDepth, depth, `${role} depth`);
    assert.equal(tuning.wormholeContinuity, continuity, `${role} continuity`);
  }
});

test('clip roles have materially different wormhole behaviour (role-level contrast)', () => {
  const p = Object.fromEntries(WH_ROLES.map((role) => [role, readPreset(`vos-wh-${role}.json`).visualTuning]));

  // Straight drive stays perfectly straight; the spiral build twists past it.
  assert.equal(p.drive.wormholeCurve, 0, 'straight drive must remain exactly straight');
  assert.equal(p.drive.wormholePathBend, 0, 'straight drive keeps a fixed route');
  assert.ok(p.spiral.wormholeWarp > p.drive.wormholeWarp, 'spiral build exceeds straight-drive warp');
  assert.ok(p.spiral.wormholePathBend > p.drive.wormholePathBend, 'spiral restores a curved route');

  // Impact is carried by forward speed/material: punch keeps a stable line of action, while
  // overdrive may bank and spiral remains the dedicated hero turn.
  assert.ok(p.punch.wormholeSpeed > p.drive.wormholeSpeed, 'tunnel punch outruns the drive');
  assert.ok(p.overdrive.wormholeJitter >= 0.8, 'overdrive carries controlled jitter');
  assert.ok(p.overdrive.wormholeSpeed >= p.punch.wormholeSpeed, 'overdrive tops the punch speed');
  assert.ok(p.spiral.wormholePathBend > p.overdrive.wormholePathBend, 'spiral owns the strongest readable route bend');
  assert.equal(p.punch.wormholePathBend, 0, 'tunnel punch stays axis-locked for a readable impact');
  assert.ok(p.overdrive.wormholePathBend > p.galaxy.wormholePathBend, 'overdrive intensifies the galaxy arc');
  assert.ok(p.spiral.wormholeWarp <= 1.9 && p.spiral.wormholeCurve <= 0.32, 'spiral avoids centrifuge motion');
  assert.ok(p.punch.wormholeWarp <= 2.2, 'punch keeps speed without excessive spin');
  assert.ok(p.overdrive.wormholeWarp <= 2.6, 'overdrive keeps speed without excessive spin');

  // Deep drift owns the largest, slowest space of the family.
  for (const role of WH_ROLES) {
    if (role === 'drift') continue;
    assert.ok(p.drift.wormholeDepth > p[role].wormholeDepth, `deep drift deeper than ${role}`);
    assert.ok(p.drift.wormholeSpeed < p[role].wormholeSpeed, `deep drift slower than ${role}`);
  }

  // Sparse break uses a small burst population with long streaks; collapse owns ring compression.
  assert.equal(p.sparse.wormholeEmissionMode, 2, 'sparse break emits only a small grain population');
  assert.equal(p.sparse.wormholeRing, 0, 'sparse break preserves open depth instead of becoming rings');
  assert.ok(p.sparse.wormholeContinuity >= 2, 'sparse break keeps long readable streaks');
  assert.ok(p.sparse.wormholeDepthCoherence > 0, 'sparse break retains segmented/ribbed structure');
  assert.ok(p.collapse.wormholeRing >= 0.25, 'collapse retains restrained ring compression');
  assert.ok(p.collapse.wormholeDepthCoherence >= 0.7, 'collapse retains compressed structural coherence');
  assert.equal(p.collapse.wormholePathBend, 0, 'collapse recentres while ring compression carries the transition');
  assert.equal(p.sparse.wormholePathBend, 0, 'sparse break restores stable negative space');
  assert.equal(p.establish.wormholePathBend, 0, 'establish presents the space on a stable axis');
  assert.equal(p.dissolve.wormholePathBend, 0, 'dissolve exits without introducing a final camera turn');
  assert.ok(p.galaxy.wormholePathBend > p.drift.wormholePathBend, 'galaxy reveal owns a broader arc than deep drift');
  for (const role of WH_ROLES) {
    if (role === 'collapse') continue;
    assert.ok(p.collapse.wormholeRing > p[role].wormholeRing, `collapse ring alignment above ${role}`);
  }

  // Galaxy reveal shares the maximum allowed streak continuity with sparse; dissolve remains dim but readable.
  for (const role of WH_ROLES) {
    if (role === 'galaxy' || role === 'sparse') continue;
    assert.ok(p.galaxy.wormholeContinuity > p[role].wormholeContinuity, `galaxy streaks longer than ${role}`);
  }
  assert.equal(p.galaxy.wormholeContinuity, p.sparse.wormholeContinuity, 'galaxy and sparse share the control-safe continuity maximum');
  assert.ok(p.galaxy.wormholeSpeed < 1, 'galaxy reveal is a slow glide');
  for (const role of WH_ROLES) {
    if (role === 'dissolve') continue;
    assert.ok(p.dissolve.lineAlpha <= p[role].lineAlpha, `dissolve no brighter than ${role}`);
  }
  assert.ok(p.dissolve.wormholeContinuity >= 0.9, 'dissolve retains shortened but visible perspective trails');

  // The whole family stays pairwise distinct on the motion-character tuple.
  const tuples = WH_ROLES.map((role) => JSON.stringify([
    p[role].wormholeEmissionMode,
    p[role].wormholeContinuity,
    p[role].wormholeJitter,
    p[role].wormholeCurve,
    p[role].wormholeWarp
  ]));
  assert.equal(new Set(tuples).size, WH_ROLES.length, 'clip family pairwise distinct');
});

test('impact roles respect minimum projection-safe geometry', () => {
  for (const role of ['punch', 'overdrive', 'collapse']) {
    const tuning = readPreset(`vos-wh-${role}.json`).visualTuning;
    assert.ok(tuning.wormholeDepth >= 2.2, `${role} keeps sufficient horizon depth`);
    assert.ok(tuning.wormholeRadius >= 0.75, `${role} keeps a projection-safe radius`);
    assert.ok(tuning.lineWeight <= 1.25, `${role} keeps authored stroke weight controlled`);
  }
});

test('authored wormhole preset pairs form the requested contrast matrix', () => {
  const p = Object.fromEntries(WH_ROLES.map((role) => [role, readPreset(`vos-wh-${role}.json`).visualTuning]));
  assert.ok(p.punch.wormholeSpeed >= p.drive.wormholeSpeed * 1.5, 'drive -> punch is a speed jump');
  assert.ok(p.overdrive.wormholeWarp > p.spiral.wormholeWarp, 'spiral -> overdrive raises warp');
  assert.ok(p.overdrive.wormholeJitter > p.spiral.wormholeJitter * 4, 'spiral -> overdrive raises jitter');
  assert.ok(p.sparse.wormholeEmissionMode > p.galaxy.wormholeEmissionMode, 'sparse -> galaxy opens the field');
  assert.ok(p.galaxy.wormholeContinuity >= p.sparse.wormholeContinuity, 'sparse -> galaxy maintains maximum streak continuity');
  assert.ok(p.collapse.wormholeRing > p.drive.wormholeRing, 'collapse -> drive releases ring compression');
  assert.equal(p.drive.wormholeCurve, 0, 'collapse -> drive resolves to straight perspective');
  assert.ok(p.overdrive.wormholeSpeed > p.drift.wormholeSpeed * 10, 'overdrive -> drift is a deep slowdown');
});

test('Task11 assigns left, right, and diagonal route cues while preserving mirrorable hero turns', () => {
  const p = Object.fromEntries(WH_ROLES.map((role) => [role, readPreset(`vos-wh-${role}.json`).visualTuning]));
  const pack = STYLE_PACKS.packs.find((candidate) => candidate.id === 'cosmic-wormhole');

  assert.equal(p.drift.wormholePathBend, -0.16, 'deep drift uses the authored left arc');
  assert.equal(p.galaxy.wormholePathBend, 0.22, 'galaxy reveal keeps its authored right arc');
  assert.equal(p.galaxy.wormholePathBendVertical, 0.12, 'galaxy reveal adds a gentle upward diagonal');
  assert.ok(p.spiral.wormholePathBend > 0 && p.overdrive.wormholePathBend > 0, 'hero turns retain right-hand authored magnitudes');
  assert.equal(pack.targetMap['wormhole.spiral-build'].mirrorable, true, 'spiral remains mirrorable');
  assert.equal(pack.targetMap['wormhole.overdrive-peak'].mirrorable, true, 'overdrive remains mirrorable');
});

test('cosmic variant pairs use only wormhole action handles', () => {
  const pack = STYLE_PACKS.packs.find((candidate) => candidate.id === 'cosmic-wormhole');
  for (const [situation, variants] of Object.entries(pack.variantPairs)) {
    for (const variant of variants) {
      for (const key of ['primary', 'secondary', 'release']) {
        if (!variant[key]) continue;
        assert.match(variant[key], /^wormhole\./, `${situation}.${key} remains in wormhole vocabulary`);
      }
    }
  }

  const expectedPairs = {
    'groove-sustain': ['wormhole.straight-drive', 'wormhole.tunnel-punch'],
    'buildup-ramp': ['wormhole.spiral-build', 'wormhole.overdrive-peak'],
    'breakdown-long': ['wormhole.sparse-break', 'wormhole.reveal-galaxy'],
    'transition-release': ['wormhole.collapse-transition', 'wormhole.straight-drive'],
    'peak-sustain': ['wormhole.overdrive-peak', 'wormhole.deep-drift']
  };
  for (const [situation, [primary, secondary]] of Object.entries(expectedPairs)) {
    assert.equal(pack.variantPairs[situation][0].primary, primary, `${situation} primary`);
    assert.equal(pack.variantPairs[situation][0].secondary, secondary, `${situation} secondary`);
  }
});

test('cosmic variant-pair pacing ranges are valid authored bounds', () => {
  const pack = STYLE_PACKS.packs.find((candidate) => candidate.id === 'cosmic-wormhole');
  for (const [situation, variants] of Object.entries(pack.variantPairs)) {
    for (const pair of variants) {
      assert.ok(Number.isFinite(pair.minSegmentSec) && pair.minSegmentSec > 0, `${situation} has a positive minimum`);
      assert.ok(Number.isFinite(pair.maxSegmentSec) && pair.minSegmentSec <= pair.maxSegmentSec, `${situation} has an ordered range`);
    }
  }
});

test('wormhole morph floor is deterministic, calibrated, and capped', () => {
  const { wormholeMorphDurationFloor, WORMHOLE_MORPH_FLOOR_CAP } = load('automation/morphFloor.ts');
  assert.ok(wormholeMorphDurationFloor(8.7, 0) >= 1.3, 'large speed delta raises morph time');
  assert.ok(wormholeMorphDurationFloor(0, 0.72) >= 1.15, 'large bend delta raises morph time');
  assert.equal(wormholeMorphDurationFloor(0, 0), 0, 'no wormhole delta adds no floor');
  assert.equal(wormholeMorphDurationFloor(100, 100), WORMHOLE_MORPH_FLOOR_CAP, 'floor cap applies');
});

test('the wormhole morph floor is automation-only and can only raise the point morph', () => {
  const dashboard = readFileSync(join(SRC_ROOT, 'ui/DashboardUI.ts'), 'utf8');
  const method = dashboard.match(/private applyPerformancePreset\([\s\S]*?\r?\n    \}\r?\n\r?\n    private isPerformanceAutomationPlan/);
  assert.ok(method, 'isolates the preset application method');
  assert.match(method[0], /if \(options\.overrideMorph\) applyAutomationMorphAuthority\(State\.targetTuning, options\.overrideMorph\);\r?\n        if \(options\.automationPointId && options\.overrideMorph\) \{[\s\S]*?State\.targetTuning\.morphDurationSec = Math\.max\(\s*options\.overrideMorph\.morphDurationSec,\s*wormholeMorphDurationFloor\(deltaSpeed, deltaBend\)/);
  assert.match(dashboard, /onPresetLoad: \(fileName\) => \{ void this\.loadVisualPreset\(fileName\); \}/);
});

// -- Style pack contract --------------------------------------------------------

test('cosmic-wormhole targetMap never falls back to temporal/default presets on main dramaturgy keys', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'cosmic-wormhole');
  for (const key of MAIN_DRAMATURGY_KEYS) {
    const preset = pack.targetMap[key]?.preset;
    assert.ok(preset, `'${key}' resolved`);
    assert.ok(/^vos-wh-/.test(preset), `'${key}' binds a wormhole clip preset, got '${preset}'`);
  }
});

test('cosmic-wormhole authors a wormhole action vocabulary for all 11 situations', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'cosmic-wormhole');
  const situations = [
    'intro-establish', 'verse-long', 'groove-sustain', 'buildup-ramp', 'drop-short', 'drop-long',
    'drop-after-build', 'breakdown-long', 'peak-sustain', 'transition-release', 'outro-dissolve'
  ];
  for (const situation of situations) {
    const handles = pack.behaviourVocabulary[situation];
    assert.ok(Array.isArray(handles) && handles.length > 0, `${situation} authored`);
    for (const handle of handles) {
      assert.ok(/^wormhole\./.test(handle), `${situation} handle '${handle}' is a wormhole action`);
      const ref = pack.targetMap[handle];
      assert.ok(ref && /^vos-wh-/.test(ref.preset), `handle '${handle}' resolves to a clip preset`);
    }
  }
});

// -- End-to-end action coverage --------------------------------------------------

function section(label, start, end, energy, density, dominantFeature = 'rhythm') {
  return { start, end, label, energy, density, dominantFeature, avgRms: energy, peakRms: energy };
}

// A clip-shaped fixture with evidence for intro/groove/build/drop/break/outro so the
// classifier can reach the corresponding situations.
function makeClipAnalysis(bpm = 128, confidence = 0.9) {
  const sections = [
    section('intro', 0, 12, 0.2, 0.2),
    section('verse', 12, 36, 0.5, 0.5, 'vocal'),
    section('build', 36, 44, 0.75, 0.75),
    section('drop', 44, 64, 0.95, 0.9),
    section('break', 64, 84, 0.25, 0.25),
    section('drop', 84, 100, 0.9, 0.85),
    section('outro', 100, 116, 0.2, 0.2)
  ];
  return {
    duration: 116, bpm, tempo: bpm, bpmConfidence: confidence, tempoConfidence: confidence,
    gridConfidence: confidence, timingConfidence: { tempo: confidence, beat: confidence, grid: confidence, overall: confidence },
    sections, significantMoments: [], noveltyPeaks: [{ time: 44, value: 0.9, reasons: ['novelty-peak'] }],
    tensionTrends: { globalSlope: 0, peakTime: 44, peakValue: 1, segments: [] }
  };
}

function buildClipPlan(confidence = 0.9) {
  const { buildVisualOsPerformancePlan } = load('automation/visualOsPlanner.ts');
  return buildVisualOsPerformancePlan(makeClipAnalysis(128, confidence), STYLE_PACKS, {
    duration: 116, stylePackId: 'cosmic-wormhole'
  });
}

test('a clip-shaped track yields a wormhole action sequence across the dramaturgy', () => {
  const plan = buildClipPlan();
  assert.ok(plan && plan.points.length > 0, 'plan produced');

  for (const point of plan.points) {
    assert.ok(/^vos-wh-/.test(point.preset), `every point binds a clip preset (${point.preset})`);
    assert.ok(/:wormhole\./.test(point.meta.targetStateReference), `provenance carries a wormhole action (${point.meta.targetStateReference})`);
  }

  const situations = new Set(plan.points.map((point) => point.meta.automationSituation));
  assert.ok(situations.has('intro-establish'), `intro evidence covered (${[...situations]})`);
  assert.ok(situations.has('buildup-ramp'), 'build evidence covered');
  assert.ok(['groove-sustain', 'verse-long'].some((s) => situations.has(s)), 'groove evidence covered');
  assert.ok(['drop-short', 'drop-long', 'drop-after-build'].some((s) => situations.has(s)), 'drop evidence covered');
  assert.ok(['breakdown-long', 'transition-release'].some((s) => situations.has(s)), 'break evidence covered');
  assert.ok(situations.has('outro-dissolve'), 'outro evidence covered');
});

test('identical input produces a byte-identical wormhole clip plan', () => {
  assert.equal(JSON.stringify(buildClipPlan()), JSON.stringify(buildClipPlan()));
});

// -- Low-confidence fallback ------------------------------------------------------

test('dampVariationForConfidence clones and never mutates VARIATION_PROFILES', () => {
  const { dampVariationForConfidence, variationProfileFor, VARIATION_PROFILES } = load('automation/microChoreographyPlanner.ts');
  const snapshot = JSON.parse(JSON.stringify(VARIATION_PROFILES));
  const expressive = variationProfileFor('expressive');
  const spb = (60 / 128) * 4;
  const lowTempo = { bpm: 128, secondsPerBar: spb, gridOffset: 0, bars: [0, spb, spb * 2], reliable: false, confidence: 0.1 };
  const highTempo = { bpm: 128, secondsPerBar: spb, gridOffset: 0, bars: [0, spb, spb * 2], reliable: true, confidence: 0.9 };
  const neutralTempo = { bpm: 0, secondsPerBar: null, gridOffset: 0, bars: [], reliable: false, confidence: 0 };

  const damped = dampVariationForConfidence(expressive, lowTempo);
  assert.notEqual(damped, expressive, 'returns a fresh object');
  assert.deepEqual(JSON.parse(JSON.stringify(VARIATION_PROFILES)), snapshot, 'VARIATION_PROFILES untouched');
  assert.ok(damped.vocabularySize <= 2, 'family cap');
  assert.ok(damped.transitionFrequency < expressive.transitionFrequency, 'rarer switching');
  assert.ok(damped.releaseFrequency < expressive.releaseFrequency, 'rarer releases');
  assert.ok(damped.randomnessBudget < expressive.randomnessBudget, 'less jitter');
  assert.ok(damped.lifetimeScale > expressive.lifetimeScale, 'longer breath');

  const confident = dampVariationForConfidence(expressive, highTempo);
  assert.notEqual(confident, expressive, 'clone even at high confidence');
  assert.deepEqual(confident, expressive, 'high confidence leaves the profile unchanged');

  const neutral = dampVariationForConfidence(expressive, neutralTempo);
  assert.deepEqual(neutral, expressive, 'no tempo evidence leaves the profile unchanged');
});

test('low timing confidence simplifies the clip without raw point-count coupling', () => {
  const low = buildClipPlan(0.1);
  const high = buildClipPlan(0.9);
  assert.ok(low && high && low.points.length > 0 && high.points.length > 0);

  const diversityPerScene = (plan) => {
    const byScene = new Map();
    for (const point of plan.points) {
      if (!byScene.has(point.sectionId)) byScene.set(point.sectionId, new Set());
      byScene.get(point.sectionId).add(point.meta.targetStateReference);
    }
    return [...byScene.values()].map((set) => set.size);
  };

  // Contract 1: at low confidence no scene mixes more than two behaviour families.
  const lowDiversity = diversityPerScene(low);
  assert.ok(lowDiversity.every((count) => count <= 2), `low-confidence scenes stay within 2 families (${lowDiversity})`);

  // Contract 2: low confidence never raises intra-scene diversity above the confident run.
  assert.ok(Math.max(...lowDiversity) <= Math.max(...diversityPerScene(high)), 'no extra diversity under low confidence');

  // Contract 3: cuts land equal-or-slower - the average intra-scene gap does not shrink.
  const averageGap = (plan) => {
    const gaps = [];
    for (let i = 1; i < plan.points.length; i++) {
      if (plan.points[i].sectionId === plan.points[i - 1].sectionId) {
        gaps.push(plan.points[i].time - plan.points[i - 1].time);
      }
    }
    return gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity;
  };
  assert.ok(averageGap(low) >= averageGap(high) - 1e-6, `low-confidence pacing is equal or slower (${averageGap(low)} vs ${averageGap(high)})`);

  // Determinism holds on the fallback path too.
  assert.equal(JSON.stringify(low), JSON.stringify(buildClipPlan(0.1)));
});
