import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

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
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
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

const loadSemantics = () => createSrcLoader()('semantics/index.ts');

// Minimal synthetic TrackAnalysis carrying only the fields the semantic layer reads.
function makeSection(label, start, end, energy, density) {
  return {
    start, end, label, energy, density,
    dominantFeature: 'rhythm', avgRms: energy, peakRms: energy
  };
}

function makeAnalysis(sections, tensionSegments = []) {
  return {
    duration: sections.length ? sections[sections.length - 1].end : 0,
    sections,
    tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 1, segments: tensionSegments }
  };
}

// intro -> verse -> build -> drop -> break -> peak -> outro
function classicArrangement() {
  return makeAnalysis([
    makeSection('intro', 0, 8, 0.2, 0.2),
    makeSection('verse', 8, 24, 0.5, 0.5),
    makeSection('build', 24, 32, 0.7, 0.7),
    makeSection('drop', 32, 56, 0.95, 0.9),
    makeSection('break', 56, 64, 0.3, 0.3),
    makeSection('peak', 64, 88, 1.0, 0.95),
    makeSection('outro', 88, 96, 0.2, 0.2)
  ]);
}

test('buildNarrative is deterministic for identical input', () => {
  const { buildNarrative } = loadSemantics();
  const a = buildNarrative(classicArrangement());
  const b = buildNarrative(classicArrangement());
  assert.deepEqual(a, b);
  assert.equal(a.version, 1);
  assert.equal(a.segments.length, 7);
});

test('buildNarrative maps section labels to the narrative vocabulary', () => {
  const { buildNarrative } = loadSemantics();
  const { segments } = buildNarrative(classicArrangement());
  // Array.from rehydrates the mapped array into this realm so assert/strict's
  // prototype-aware deepEqual does not trip over the loader's vm-realm Array.
  assert.deepEqual(Array.from(segments, s => s.type), [
    'intro', 'groove', 'build', 'release', 'breakdown', 'peak', 'outro'
  ]);
  for (const segment of segments) {
    assert.ok(segment.intensity >= 0 && segment.intensity <= 1);
    assert.ok(segment.endTime >= segment.startTime);
    assert.match(segment.id, /^narrative-\d+-/);
  }
});

test('buildNarrative detects a fake-drop (short drop immediately rebuilding)', () => {
  const { buildNarrative } = loadSemantics();
  const analysis = makeAnalysis([
    makeSection('build', 0, 8, 0.7, 0.7),
    makeSection('drop', 8, 11, 0.9, 0.9),   // only 3s, then rebuilds
    makeSection('build', 11, 19, 0.8, 0.8),
    makeSection('drop', 19, 43, 0.95, 0.9)  // real, sustained drop
  ]);
  const types = Array.from(buildNarrative(analysis).segments, s => s.type);
  assert.deepEqual(types, ['build', 'fake-drop', 'build', 'release']);
});

test('buildNarrative upgrades a verse on a rising tension trend', () => {
  const { buildNarrative } = loadSemantics();
  const analysis = makeAnalysis(
    [makeSection('verse', 0, 16, 0.5, 0.5)],
    [{ start: 0, end: 16, startValue: 0.2, endValue: 0.8, direction: 'rising', confidence: 0.9 }]
  );
  assert.equal(buildNarrative(analysis).segments[0].type, 'tension');
});

test('generateIntents is deterministic and produces the compress -> release pair', () => {
  const { buildNarrative, generateIntents } = loadSemantics();
  const narrative = buildNarrative(classicArrangement());
  const a = generateIntents(narrative);
  const b = generateIntents(narrative);
  assert.deepEqual(a, b);
  assert.equal(a.version, 1);
  assert.equal(a.points.length, narrative.segments.length);

  // build segment -> compress, and the drop entering after build -> release
  const intents = Array.from(a.points, p => p.intent);
  assert.deepEqual(intents, [
    'establish', 'sustain', 'compress', 'release', 'recover', 'celebrate', 'return'
  ]);
  for (const point of a.points) {
    assert.ok(point.weight >= 0 && point.weight <= 1);
    assert.ok(point.duration >= 0.5 && point.duration <= 4.0);
  }
});

test('generateIntents keeps a stand-alone peak as celebrate, not release', () => {
  const { buildNarrative, generateIntents } = loadSemantics();
  // peak NOT preceded by build/tension stays its steady-state intent.
  const analysis = makeAnalysis([
    makeSection('verse', 0, 16, 0.5, 0.5),
    makeSection('peak', 16, 40, 1.0, 0.95)
  ]);
  const intents = Array.from(generateIntents(buildNarrative(analysis)).points, p => p.intent);
  assert.deepEqual(intents, ['sustain', 'celebrate']);
});

function intentPlan(points) {
  return { version: 1, points };
}

// Highest action intensity carried by a frame — used to assert echo decay.
function peakIntensity(frame) {
  const values = Object.values(frame.actions);
  return values.length ? Math.max(...values) : 0;
}

test('processChoreography is deterministic for identical input', () => {
  const { processChoreography } = loadSemantics();
  const plan = intentPlan([
    { time: 0, intent: 'establish', weight: 0.3, duration: 2 },
    { time: 8, intent: 'compress', weight: 0.7, duration: 2 },
    { time: 12, intent: 'release', weight: 0.95, duration: 1 }
  ]);
  assert.deepEqual(processChoreography(plan), processChoreography(plan));
});

test('processChoreography maps intents to abstract actions only (no concrete tuning/style)', () => {
  const { processChoreography } = loadSemantics();
  const { frames, version } = processChoreography(intentPlan([
    { time: 4, intent: 'anticipate', weight: 0.8, duration: 2 }
  ]));
  assert.equal(version, 1);
  assert.equal(frames.length, 1);
  const actionKeys = Object.keys(frames[0].actions);
  assert.ok(actionKeys.length > 0);
  // Every key must be a known abstract ChoreographyAction; intensities stay in 0..1.
  const vocabulary = new Set(['expand', 'collapse', 'orbit', 'fragment', 'bloom', 'pulse', 'echo', 'freeze', 'accelerate', 'slow', 'densify', 'thin', 'focus', 'scatter', 'merge']);
  for (const [action, intensity] of Object.entries(frames[0].actions)) {
    assert.ok(vocabulary.has(action), `unexpected action ${action}`);
    assert.ok(intensity >= 0 && intensity <= 1);
  }
});

test('echo operator generates decreasing-intensity follow-up actions after the main event', () => {
  const { processChoreography } = loadSemantics();
  const { frames } = processChoreography(intentPlan([
    { time: 10, intent: 'release', weight: 1.0, duration: 2 }
  ]));

  const primary = frames.find(f => f.time === 10);
  const echoes = frames.filter(f => f.activeOperators.includes('echo'));
  assert.ok(primary, 'primary frame exists');
  assert.equal(echoes.length, 2);

  // Echoes come strictly after the event, carry an explicit `echo` action, and decay.
  let previousPeak = peakIntensity(primary);
  for (const echo of echoes) {
    assert.ok(echo.time > primary.time, 'echo is after the event');
    assert.ok(typeof echo.actions.echo === 'number', 'echo frame tags an echo action');
    const peak = peakIntensity(echo);
    assert.ok(peak < previousPeak, `echo peak ${peak} should be below ${previousPeak}`);
    previousPeak = peak;
  }
});

test('invert operator flips actions to their opposite phase (contrast)', () => {
  const { processChoreography, ACTION_ANTONYMS } = loadSemantics();
  const { frames } = processChoreography(intentPlan([
    { time: 0, intent: 'contrast', weight: 1.0, duration: 2 }
  ]));
  const frame = frames[0];
  assert.ok(frame.activeOperators.includes('invert'));
  // contrast base = fragment + freeze -> inverted to merge + bloom.
  assert.ok(typeof frame.actions.merge === 'number');
  assert.ok(typeof frame.actions.bloom === 'number');
  assert.equal(frame.actions.fragment, undefined);
  assert.equal(frame.actions.freeze, undefined);
  assert.equal(ACTION_ANTONYMS.fragment, 'merge');
});

test('mirror operator adds a softened counter-motion (symmetry)', () => {
  const { processChoreography } = loadSemantics();
  const { frames } = processChoreography(intentPlan([
    { time: 0, intent: 'sustain', weight: 1.0, duration: 2 }
  ]));
  const frame = frames[0];
  assert.ok(frame.activeOperators.includes('mirror'));
  // sustain base = orbit + pulse; mirror keeps both and folds in each other's counter-motion.
  assert.ok(typeof frame.actions.orbit === 'number');
  assert.ok(typeof frame.actions.pulse === 'number');
});

test('full semantic chain composes deterministically end to end', () => {
  const { buildNarrative, generateIntents, processChoreography } = loadSemantics();
  const run = () => processChoreography(generateIntents(buildNarrative(classicArrangement())));
  assert.deepEqual(run(), run());
  assert.ok(run().frames.length >= 7);
});

const ALL_ACTIONS = ['expand', 'collapse', 'orbit', 'fragment', 'bloom', 'pulse', 'echo', 'freeze', 'accelerate', 'slow', 'densify', 'thin', 'focus', 'scatter', 'merge'];
const RESOLVER_STYLES = ['classic', 'temporal', 'dark-techno', 'organic-ambient', 'cyberpunk', 'cosmic-wormhole', 'hero'];

function loadTuningConfig() {
  return createSrcLoader()('config/visualTuning.ts');
}

function choreographyFrame(actions) {
  return { time: 0, actions, activeOperators: [] };
}

test('resolveSemanticState returns a complete clamped config for null/empty choreography', () => {
  const { resolveSemanticState } = loadSemantics();
  const { visualTuningKeys } = loadTuningConfig();
  for (const choreography of [null, choreographyFrame({})]) {
    const out = resolveSemanticState(choreography, 'cyberpunk', {});
    for (const key of visualTuningKeys) {
      assert.ok(Number.isFinite(out[key]), `${key} is finite`);
    }
  }
});

test('resolveSemanticState keeps every controlled param within its min/max bounds', () => {
  const { resolveSemanticState } = loadSemantics();
  const { visualTuningControls } = loadTuningConfig();
  // Saturate with every action above intensity 1.0 to stress the clamp.
  const actions = Object.fromEntries(ALL_ACTIONS.map(a => [a, 5]));
  for (const style of RESOLVER_STYLES) {
    const out = resolveSemanticState(choreographyFrame(actions), style, {});
    for (const control of visualTuningControls) {
      const value = out[control.key];
      assert.ok(value >= control.min && value <= control.max,
        `${style}.${control.key} = ${value} outside [${control.min}, ${control.max}]`);
    }
  }
});

test('resolveSemanticState lets each style reinterpret the same abstract action', () => {
  const { resolveSemanticState } = loadSemantics();
  const bloom = choreographyFrame({ bloom: 1.0 });
  const cyber = resolveSemanticState(bloom, 'cyberpunk', {});
  const organic = resolveSemanticState(bloom, 'organic-ambient', {});
  const wormhole = resolveSemanticState(bloom, 'cosmic-wormhole', {});

  // Same gesture, style-specific vocabulary engaged.
  assert.ok(cyber.lineWeight > organic.lineWeight, 'cyberpunk thickens lines on bloom');
  assert.ok(organic.circleSize > cyber.circleSize, 'organic swells circles on bloom');
  assert.ok(wormhole.wormholeWarp > 0, 'wormhole warps the tunnel on bloom');
  // The three resolved configs are not identical.
  assert.notDeepEqual(cyber, organic);
  assert.notDeepEqual(organic, wormhole);
});

test('resolveSemanticState is deterministic and overlays provided presets', () => {
  const { resolveSemanticState } = loadSemantics();
  const { cloneDefaultVisualTuning } = loadTuningConfig();
  const preset = cloneDefaultVisualTuning();
  preset.lineWeight = 3;
  preset.circleHue = 123; // no choreography action maps to circleHue
  const presets = { cyberpunk: preset };
  const frame = choreographyFrame({ densify: 0.5, orbit: 0.3 });

  const a = resolveSemanticState(frame, 'cyberpunk', presets);
  const b = resolveSemanticState(frame, 'cyberpunk', presets);
  assert.deepEqual(a, b);
  // Base preset informs the starting point (lineWeight at least the preset's value here,
  // since no active action lowers it).
  assert.ok(a.lineWeight >= 3);
  // A param untouched by any action passes through from the base preset verbatim — proving
  // the provided base is honoured rather than reset to engine defaults (ADR-003 / review fix).
  assert.equal(a.circleHue, 123);
});

test('semantic layer stays free of p5/DOM/runtime-state imports', () => {
  const files = [
    'semantics/NarrativeEngine.ts',
    'semantics/IntentGenerator.ts',
    'semantics/ChoreographyEngine.ts',
    'semantics/PatternGrammar.ts',
    'semantics/MotifPlanner.ts',
    'semantics/TransitionPlanner.ts',
    'semantics/motifResolver.ts',
    'semantics/mapper.ts',
    'semantics/visualScoreValidation.ts',
    'semantics/SemanticResolver.ts',
    'semantics/SemanticRuntimeAdapter.ts',
    'semantics/index.ts'
  ]
    .map(p => readFileSync(join(SRC_ROOT, p), 'utf8'))
    .join('\n');
  assert.doesNotMatch(files, /from 'p5'|from "p5"/);
  assert.doesNotMatch(files, /\.\.\/state(?:\/|['"])|\.\.\/visuals\/|\.\.\/ui\/|\.\.\/audio\//);
  assert.doesNotMatch(files, /document\.|window\.|navigator\./);
});

function scoreFrame(timeSec, actions = {}, transition = { type: 'MORPH', durationSec: 1 }, durationSec = 1) {
  return {
    timeSec,
    durationSec,
    narrativeState: 'DEVELOPMENT',
    primaryPattern: 'FLOW',
    actions,
    motion: {
      speed: timeSec,
      complexity: timeSec / 10,
      variation: { seed: 7, phraseIndex: 0, variationIndex: 0 }
    },
    transition,
    confidence: Math.min(1, timeSec / 10)
  };
}

test('ADR-004 MORPH interpolates actions, motion, and confidence', () => {
  const { SemanticResolver } = loadSemantics();
  const resolver = new SemanticResolver();
  resolver.setPlan({
    version: '1.0', trackHash: 'morph',
    frames: [
      scoreFrame(0, { EXPAND: 0 }, { type: 'MORPH', durationSec: 10 }, 10),
      scoreFrame(10, { EXPAND: 1 })
    ]
  });
  const result = resolver.resolve(5);
  assert.equal(result.progress, 0.5);
  assert.equal(result.actions.EXPAND, 0.5);
  assert.equal(result.actions.PULSE, 0);
  assert.equal(result.motion.speed, 1);
  assert.equal(result.confidence, 0.5);
});

test('ADR-004 CUT and zero-default policy prevent interpolation', () => {
  const { SemanticResolver } = loadSemantics();
  const resolver = new SemanticResolver();
  resolver.setPlan({
    version: '1.0', trackHash: 'cut',
    frames: [scoreFrame(0, { PULSE: 0.8 }, { type: 'CUT', durationSec: 0 }, 10), scoreFrame(10, { EXPAND: 1 })]
  });
  const result = resolver.resolve(9.999);
  assert.equal(result.progress, 0);
  assert.equal(result.actions.PULSE, 0.8);
  assert.equal(result.actions.EXPAND, 0);
  assert.equal(result.motion.speed, 0);
  assert.equal(resolver.resolve(10).actions.EXPAND, 1);
});

test('ADR-004 transition duration controls morph time independently of frame spacing', () => {
  const { SemanticResolver } = loadSemantics();
  const resolver = new SemanticResolver();
  resolver.setPlan({
    version: '1.0', trackHash: 'transition-window',
    frames: [
      scoreFrame(0, { EXPAND: 0 }, { type: 'MORPH', durationSec: 2 }, 10),
      scoreFrame(10, { EXPAND: 1 })
    ]
  });
  assert.equal(resolver.resolve(1).progress, 0.5);
  assert.equal(resolver.resolve(1).actions.EXPAND, 0.5);
  assert.equal(resolver.resolve(5).progress, 1);
  assert.equal(resolver.resolve(5).actions.EXPAND, 1);
});

test('ADR-004 completed transition passes next narrative and pattern to the mapper', () => {
  const { SemanticResolver } = loadSemantics();
  const mapperInputs = [];
  const resolver = new SemanticResolver({
    map: input => {
      mapperInputs.push(input);
      return {};
    }
  });
  resolver.setPlan({
    version: '1.0', trackHash: 'discrete-transition',
    frames: [
      scoreFrame(0, { FLOW: 1 }, { type: 'MORPH', durationSec: 2 }, 10),
      { ...scoreFrame(10, { EXPAND: 1 }), narrativeState: 'TENSION_PEAK', primaryPattern: 'EXPLOSION' }
    ]
  });

  const midTransition = resolver.resolve(1);
  assert.equal(midTransition.narrativeState, 'DEVELOPMENT');
  assert.equal(midTransition.primaryPattern, 'FLOW');
  assert.equal(mapperInputs.at(-1).narrativeState, 'DEVELOPMENT');
  assert.equal(mapperInputs.at(-1).primaryPattern, 'FLOW');

  const completedTransition = resolver.resolve(5);
  assert.equal(completedTransition.progress, 1);
  assert.equal(completedTransition.narrativeState, 'TENSION_PEAK');
  assert.equal(completedTransition.primaryPattern, 'EXPLOSION');
  assert.equal(mapperInputs.at(-1).narrativeState, 'TENSION_PEAK');
  assert.equal(mapperInputs.at(-1).primaryPattern, 'EXPLOSION');
});

test('ADR-004 frame duration defines gaps and expires the last frame', () => {
  const { SemanticResolver } = loadSemantics();
  const resolver = new SemanticResolver();
  resolver.setPlan({
    version: '1.0', trackHash: 'finite-frames',
    frames: [scoreFrame(2, { PULSE: 1 }, { type: 'CUT', durationSec: 0 }, 2), scoreFrame(8, { FLOW: 1 })]
  });
  assert.equal(resolver.resolve(1.999), null);
  assert.equal(resolver.resolve(3.999).actions.PULSE, 1);
  assert.equal(resolver.resolve(4), null);
  assert.equal(resolver.resolve(7.999), null);
  assert.equal(resolver.resolve(8).actions.FLOW, 1);
  assert.equal(resolver.resolve(9), null);
});

test('ADR-004 rejects malformed external plans atomically without throwing', () => {
  const { SemanticResolver, MAX_VISUAL_SCORE_FRAMES } = loadSemantics();
  const resolver = new SemanticResolver();
  resolver.setPlan({ version: '1.0', trackHash: 'valid', frames: [scoreFrame(0, { PULSE: 1 })] });
  assert.equal(resolver.hasPlan(), true);

  for (const malformed of [
    {},
    { version: '2.0', trackHash: 'unsupported-version', frames: [] },
    { version: '1.0', trackHash: 'missing-frames' },
    { version: '1.0', trackHash: 'wrong-frames', frames: null },
    { version: '1.0', trackHash: 'oversized', frames: new Array(MAX_VISUAL_SCORE_FRAMES + 1) },
    { version: '1.0', trackHash: 'bad-frame', frames: [{}] },
    { version: '1.0', trackHash: 'bad-motion', frames: [{ ...scoreFrame(0), motion: null }] },
    { version: '1.0', trackHash: 'bad-enum', frames: [{ ...scoreFrame(0), narrativeState: 'UNKNOWN' }] },
    { version: '1.0', trackHash: 'bad-action', frames: [{ ...scoreFrame(0), actions: { TELEPORT: 1 } }] },
    { version: '1.0', trackHash: 'bad-time', frames: [{ ...scoreFrame(0), timeSec: Number.NaN }] }
  ]) {
    assert.doesNotThrow(() => resolver.setPlan(malformed));
    assert.equal(resolver.hasPlan(), false);
    assert.equal(resolver.resolve(0), null);
  }
});

test('ADR-004 snapshots validated external plans against later mutation', () => {
  const { SemanticResolver } = loadSemantics();
  const resolver = new SemanticResolver();
  const plan = { version: '1.0', trackHash: 'snapshot', frames: [scoreFrame(0, { PULSE: 0.75 })] };
  resolver.setPlan(plan);
  plan.frames[0].actions.PULSE = 0;
  plan.frames[0].motion.speed = 1;
  assert.equal(resolver.resolve(0).actions.PULSE, 0.75);
  assert.equal(resolver.resolve(0).motion.speed, 0);
});

test('ADR-004 resolver remains stable for large sorted and unsorted plans', () => {
  const { SemanticResolver } = loadSemantics();
  const resolver = new SemanticResolver();
  const frames = Array.from({ length: 20_000 }, (_, index) => scoreFrame(index, { FLOW: index / 20_000 })).reverse();
  resolver.setPlan({ version: '1.0', trackHash: 'large', frames });
  assert.equal(resolver.resolve(19_998.5).current.timeSec, 19_998);
  assert.equal(resolver.resolve(3.25).current.timeSec, 3);
  assert.ok(Math.abs(resolver.resolve(10_000.5).actions.FLOW - 10_000.5 / 20_000) < 1e-12);
  assert.equal(resolver.resolve(Number.NaN), null);
});

test('ADR-004 runtime adapter applies only whitelisted tuning keys', () => {
  const { SemanticResolver, SemanticRuntimeAdapter, ALLOWED_TUNING_KEYS } = loadSemantics();
  const { defaultVisualTuning } = createSrcLoader()('config/visualTuning.ts');
  const resolver = new SemanticResolver({ map: () => ({ audioSensitivity: 0.5, injectedRuntimeState: 99 }) });
  resolver.setPlan({ version: '1.0', trackHash: 'adapter', frames: [scoreFrame(0)] });
  const target = { ...defaultVisualTuning, lineDistance: 7 };
  const adapter = new SemanticRuntimeAdapter(resolver);
  adapter.update(0, target);
  assert.equal(ALLOWED_TUNING_KEYS.has('audioSensitivity'), true);
  assert.equal(target.audioSensitivity, 1.5);
  assert.equal(target.lineDistance, 7);
  assert.equal('injectedRuntimeState' in target, false);
});
