import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Visual OS Style System (ADR-005) - unit + contract tests for the renderer-independent
// scene-translation layer. The layer must CONSUME the ADR-003 semantic output and never
// re-derive musical semantics, and must never leak renderer/tuning concepts.

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
const readSrc = (rel) => readFileSync(join(SRC_ROOT, rel), 'utf8');

// -- Fixtures ----------------------------------------------------------------

function makePack(overrides = {}) {
  return {
    id: 'test-pack',
    label: 'Test',
    capabilities: {
      preferred: ['network-bloom', 'tunnel-drive'],
      supported: ['pulse-field', 'orbit-system'],
      forbidden: ['void-minimal'],
      palettes: { preferred: ['neon'], forbidden: ['earth'] }
    },
    vocabulary: { palette: 'neon', lineCharacter: 0.8, glowCharacter: 0.6, grain: 0.2, contrast: 0.9 },
    behaviour: { energy: 0, density: 0, motion: 0, volatility: 0, cohesion: 0 },
    substyles: {},
    targetMap: {},
    ...overrides
  };
}

function makeBundle() {
  const phrase = (id, motif, role, startTime, endTime, intensity, density, motion, novelty, variationSeed) => ({
    id, motif, role, startTime, endTime, subdivision: 'bar', intensity, density, motion, novelty, variationSeed, operators: []
  });
  return {
    narrative: {
      version: 1,
      segments: [
        { id: 'n1', startTime: 0, endTime: 8, type: 'intro', intensity: 0.3 },
        { id: 'n2', startTime: 8, endTime: 16, type: 'release', intensity: 0.9 }
      ]
    },
    intent: {
      version: 1,
      points: [
        { time: 0, intent: 'establish', weight: 0.4, duration: 1 },
        { time: 8, intent: 'expand', weight: 0.9, duration: 1 }
      ]
    },
    choreography: {
      version: 1,
      frames: [
        { time: 2, actions: { pulse: 0.7 }, activeOperators: [] },
        { time: 9, actions: { bloom: 0.9, scatter: 0.4 }, activeOperators: [] },
        { time: 12, actions: { fragment: 0.65 }, activeOperators: [] }
      ],
      score: {
        version: 1,
        motifs: [
          // p1's semantic motif is FORBIDDEN by the pack on purpose, to test exclusion.
          phrase('p1', 'void-minimal', 'foundation', 0, 8, 0.3, 0.3, 0.3, 0.1, 11),
          phrase('p2', 'network-bloom', 'release', 8, 16, 0.9, 0.8, 0.7, 0.8, 22)
        ],
        transitions: [
          { fromMotifId: 'p1', toMotifId: 'p2', startTime: 8, duration: 2, behavior: 'morph', curve: 'easeInOut', preserve: ['color'] }
        ]
      }
    }
  };
}

// -- VariationEngine ----------------------------------------------------------

test('variation engine never proposes a forbidden motif and ranks preferred over supported', () => {
  const { scoreMotifCandidates, buildCandidateMotifs } = load('automation/variationEngine.ts');
  const cap = makePack().capabilities;
  const candidates = buildCandidateMotifs('void-minimal', cap);
  assert.ok(!candidates.includes('void-minimal'), 'forbidden motif must be excluded');
  for (const m of candidates) assert.ok(!cap.forbidden.includes(m));

  const ranked = scoreMotifCandidates(
    { semanticMotif: 'pulse-field', intensity: 0.5, novelty: 0.2, variationSeed: 7 },
    cap,
    { previousMotif: null, recentUsage: {}, recentWindow: 4 }
  );
  for (const c of ranked) assert.ok(!cap.forbidden.includes(c.motif));
  // The top candidate's capability component should be at least supported-tier.
  assert.ok(ranked[0].capability >= 0.55);
});

test('variation engine is deterministic for identical input', () => {
  const { scoreMotifCandidates } = load('automation/variationEngine.ts');
  const cap = makePack().capabilities;
  const args = [
    { semanticMotif: 'orbit-system', intensity: 0.6, novelty: 0.7, variationSeed: 42 },
    cap,
    { previousMotif: 'network-bloom', recentUsage: { 'network-bloom': 2 }, recentWindow: 4 }
  ];
  const a = JSON.stringify(scoreMotifCandidates(...args));
  const b = JSON.stringify(scoreMotifCandidates(...args));
  assert.equal(a, b);
});

test('high novelty rewards switching away from the previous motif', () => {
  const { scoreMotifCandidates } = load('automation/variationEngine.ts');
  const cap = makePack().capabilities;
  const ctx = { previousMotif: 'network-bloom', recentUsage: {}, recentWindow: 4 };
  const lowNovelty = scoreMotifCandidates({ semanticMotif: 'network-bloom', intensity: 0.7, novelty: 0.05, variationSeed: 1 }, cap, ctx);
  const highNovelty = scoreMotifCandidates({ semanticMotif: 'network-bloom', intensity: 0.7, novelty: 0.95, variationSeed: 1 }, cap, ctx);
  const cont = (list) => list.find((c) => c.motif === 'network-bloom').noveltyFit;
  assert.ok(cont(lowNovelty) > cont(highNovelty), 'continuation should score higher under low novelty');
});

// -- ChoreographyDirector ---------------------------------------------------

test('director emits one scene per phrase and never selects a forbidden motif', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const pack = makePack();
  const scenes = directScenes(makeBundle(), pack);
  assert.equal(scenes.length, 2);
  for (const scene of scenes) {
    assert.ok(!pack.capabilities.forbidden.includes(scene.motif));
  }
});

test('director consumes the existing narrative/intent output (no re-derivation)', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const scenes = directScenes(makeBundle(), makePack());
  assert.equal(scenes[0].narrative, 'intro');
  assert.equal(scenes[0].intent, 'establish');
  assert.equal(scenes[1].narrative, 'release');
  assert.equal(scenes[1].intent, 'expand');
});

test('director builds a narrative-shaped birth..death evolution', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const scenes = directScenes(makeBundle(), makePack());
  for (const scene of scenes) {
    assert.equal(scene.evolution.steps.length, 5);
    assert.equal(scene.evolution.steps[0].phase, 'birth');
    assert.equal(scene.evolution.steps[0].at, 0);
    assert.equal(scene.evolution.steps[4].phase, 'death');
    for (const step of scene.evolution.steps) {
      assert.ok(step.level >= 0 && step.level <= 1);
    }
  }
  // Different narratives must produce measurably different lifecycle envelopes.
  const introPeak = scenes[0].evolution.steps.find((s) => s.phase === 'peak').at;
  const releasePeak = scenes[1].evolution.steps.find((s) => s.phase === 'peak').at;
  assert.notEqual(introPeak, releasePeak);
});

test('director maps micro-events from frames inside each scene span', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const scenes = directScenes(makeBundle(), makePack());
  // Scene 0 [0,8): frame at t=2 (pulse 0.7) -> one impact micro-event.
  assert.equal(scenes[0].microEvents.length, 1);
  assert.equal(scenes[0].microEvents[0].source, 'impact');
  // Scene 1 [8,16): frames at t=9 (bloom 0.9) and t=12 (fragment 0.65) above threshold.
  assert.equal(scenes[1].microEvents.length, 2);
  const sources = [...scenes[1].microEvents.map((e) => e.source)].sort();
  assert.deepEqual(sources, ['fx', 'impact']);
});

test('director maps the incoming transition and stays in 0..1 behaviour bounds', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const scenes = directScenes(makeBundle(), makePack());
  assert.equal(scenes[1].transition.behavior, 'morph');
  assert.equal(scenes[1].transition.durationSec, 2);
  for (const scene of scenes) {
    for (const key of ['energy', 'density', 'motion', 'volatility', 'cohesion']) {
      assert.ok(scene.behaviour[key] >= 0 && scene.behaviour[key] <= 1, `${key} in range`);
    }
  }
});

test('director output is deterministic across repeated runs', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const pack = makePack();
  const a = JSON.stringify(directScenes(makeBundle(), pack));
  const b = JSON.stringify(directScenes(makeBundle(), pack));
  assert.equal(a, b);
});

// -- Purity / reuse boundary guard --------------------------------------------

test('Visual OS automation modules do not import runtime, renderer, or analyzer layers', () => {
  const forbidden = [/from '\.\.\/state/, /from '\.\.\/visuals/, /from '\.\.\/ui/, /from '\.\.\/audio/, /from '\.\.\/analyzer/, /from 'p5'/];
  for (const rel of ['automation/variationEngine.ts', 'automation/choreographyDirector.ts', 'automation/styleTranslator.ts', 'automation/automationSituationClassifier.ts', 'automation/globalVisualNarrative.ts', 'automation/longScenePlanner.ts', 'automation/movementGrammar.ts', 'automation/variationMemory.ts', 'automation/microChoreographyPlanner.ts']) {
    const src = readSrc(rel);
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(src), `${rel} must not match ${pattern}`);
    }
  }
});

// -- Style Resolver (inheritance) ---------------------------------------------

const STYLE_PACKS = JSON.parse(readFileSync(join(process.cwd(), 'public/visual-tuning-presets/style-packs.json'), 'utf8'));

test('shipped style-packs.json resolves every pack', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  for (const def of STYLE_PACKS.packs) {
    const resolved = resolveStylePack(STYLE_PACKS, def.id);
    assert.equal(resolved.id, def.id);
  }
});

test('cosmic wormhole maps every main dramaturgy phase to a wormhole clip preset', () => {
  const cosmic = STYLE_PACKS.packs.find(pack => pack.id === 'cosmic-wormhole');
  assert.ok(cosmic);
  // The clip profile owns the whole narrative surface: no main dramaturgy key may fall back to a
  // generic temporal/default preset. Role-level motion contrast between the vos-wh presets is
  // asserted in tests/wormhole-clip-profile.test.mjs.
  const mainKeys = ['intro', 'groove', 'tension', 'build', 'fake-drop', 'release', 'peak', 'breakdown', 'outro', 'default'];
  for (const key of mainKeys) {
    const preset = cosmic.targetMap[key]?.preset;
    assert.ok(preset && /^vos-wh-/.test(preset), `'${key}' must bind a wormhole clip preset, got '${preset}'`);
  }
  const distinct = new Set(mainKeys.map(key => cosmic.targetMap[key].preset));
  assert.ok(distinct.size >= 7, `dramaturgy phases spread across the clip family (${distinct.size} distinct presets)`);
});

test('inheritance makes forbidden additive and keeps preferred disjoint from forbidden', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const minimal = resolveStylePack(STYLE_PACKS, 'dark-techno-minimal');
  // Inherited from dark-techno:
  for (const m of ['wave-ripple', 'halo-focus']) assert.ok(minimal.capabilities.forbidden.includes(m), `${m} inherited-forbidden`);
  // Added by minimal itself:
  for (const m of ['network-bloom', 'swarm-motion', 'orbit-system']) assert.ok(minimal.capabilities.forbidden.includes(m), `${m} own-forbidden`);
  const forbidden = new Set(minimal.capabilities.forbidden);
  for (const m of minimal.capabilities.preferred) assert.ok(!forbidden.has(m), `${m} preferred must not be forbidden`);
  for (const m of minimal.capabilities.supported) assert.ok(!forbidden.has(m));
});

test('a child can re-enable a parent-forbidden form by explicitly preferring it', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const file = {
    version: 1,
    packs: [
      { id: 'p', capabilities: { preferred: [], supported: [], forbidden: ['tunnel-drive'], palettes: { preferred: [], forbidden: [] } } },
      { id: 'c', extends: 'p', capabilities: { preferred: ['tunnel-drive'], supported: [], forbidden: [], palettes: { preferred: [], forbidden: [] } } }
    ]
  };
  const resolved = resolveStylePack(file, 'c');
  assert.ok(resolved.capabilities.preferred.includes('tunnel-drive'));
  assert.ok(!resolved.capabilities.forbidden.includes('tunnel-drive'));
});

test('resolver rejects cycles, missing parents, and unknown enum members', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const cyclic = { version: 1, packs: [{ id: 'a', extends: 'b' }, { id: 'b', extends: 'a' }] };
  assert.throws(() => resolveStylePack(cyclic, 'a'), /cycle/i);
  const missing = { version: 1, packs: [{ id: 'a', extends: 'ghost' }] };
  assert.throws(() => resolveStylePack(missing, 'a'), /not found/i);
  const badMotif = { version: 1, packs: [{ id: 'a', capabilities: { preferred: ['not-a-motif'], supported: [], forbidden: [], palettes: { preferred: [], forbidden: [] } } }] };
  assert.throws(() => resolveStylePack(badMotif, 'a'), /Unknown motif/i);
});

test('substyle resolution layers onto the resolved pack', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const dt = resolveStylePack(STYLE_PACKS, 'dark-techno');
  assert.ok(dt.substyles.strobe, 'strobe substyle present');
  assert.ok(dt.substyles.strobe.capabilities.preferred.includes('fragment-cloud'));
  assert.ok(dt.substyles.strobe.behaviour.volatility > dt.behaviour.volatility);
});

// -- Style Translation Pipeline (renderer independence) -----------------------

const VISUAL_SCENE_KEYS = ['timeSec', 'durationSec', 'stylePack', 'substyle', 'motif', 'vocabulary', 'behaviour', 'evolution', 'microEvents', 'transition', 'targetStateReference'];

test('translateScene emits a renderer-independent VisualScene with an opaque target handle', () => {
  const { resolveStylePack, translateScenePlan } = load('automation/styleTranslator.ts');
  const { directScenes } = load('automation/choreographyDirector.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  const scenes = directScenes(makeBundle(), pack);
  const plan = translateScenePlan(scenes, pack);

  assert.equal(plan.scenes.length, scenes.length);
  for (const scene of plan.scenes) {
    // No renderer/tuning concepts may leak into the domain scene.
    for (const key of Object.keys(scene)) {
      assert.ok(VISUAL_SCENE_KEYS.includes(key), `unexpected VisualScene key: ${key}`);
      assert.ok(!/tuning|preset|opacity|particle|alpha/i.test(key), `renderer concept leaked: ${key}`);
    }
    // targetStateReference is an OPAQUE handle, never a preset filename.
    assert.equal(typeof scene.targetStateReference, 'string');
    assert.ok(scene.targetStateReference.includes(':'));
    assert.ok(!/\.json/i.test(scene.targetStateReference), 'handle must not name a preset file');
    // Final motif must be permitted by the style.
    assert.ok(!pack.capabilities.forbidden.includes(scene.motif));
  }
});

test('translateScenePlan with a substyle is deterministic and tags the substyle', () => {
  const { resolveStylePack, translateScenePlan } = load('automation/styleTranslator.ts');
  const { directScenes } = load('automation/choreographyDirector.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  const scenes = directScenes(makeBundle(), pack, { substyle: 'strobe' });
  const a = JSON.stringify(translateScenePlan(scenes, pack, 'strobe'));
  const b = JSON.stringify(translateScenePlan(scenes, pack, 'strobe'));
  assert.equal(a, b);
  const plan = JSON.parse(a);
  for (const scene of plan.scenes) {
    assert.equal(scene.substyle, 'strobe');
    assert.ok(scene.targetStateReference.startsWith('dark-techno#strobe:'));
  }
});

// -- Renderer Adapter + end-to-end (Phase 4) ---------------------------------

function section(label, start, end, energy, density, dominantFeature = 'rhythm') {
  return { start, end, label, energy, density, dominantFeature, avgRms: energy, peakRms: energy };
}

function makeTrackAnalysis(bpm = 128, confidence = 0.9) {
  const sections = [
    section('intro', 0, 8, 0.2, 0.2),
    section('verse', 8, 24, 0.5, 0.5, 'vocal'),
    section('build', 24, 32, 0.75, 0.75),
    section('drop', 32, 48, 0.95, 0.9),
    section('break', 48, 56, 0.25, 0.25)
  ];
  return {
    duration: 56, bpm, tempo: bpm, bpmConfidence: confidence, tempoConfidence: confidence,
    gridConfidence: confidence, timingConfidence: { tempo: confidence, beat: confidence, grid: confidence, overall: confidence },
    sections, significantMoments: [], noveltyPeaks: [{ time: 32, value: 0.9, reasons: ['novelty-peak'] }],
    tensionTrends: { globalSlope: 0, peakTime: 32, peakValue: 1, segments: [] }
  };
}

const VALID_REASONS = new Set(['intro', 'verse', 'build', 'drop', 'break', 'peak', 'outro', 'harmonicShift', 'manual']);

test('end-to-end Visual OS plan is a valid PerformanceAutomationPlan with resolved presets', () => {
  const { buildVisualOsPerformancePlan } = load('automation/visualOsPlanner.ts');
  const plan = buildVisualOsPerformancePlan(makeTrackAnalysis(), STYLE_PACKS, { duration: 56, stylePackId: 'dark-techno' });
  assert.ok(plan, 'plan produced');
  assert.equal(plan.version, 1);
  assert.equal(plan.source, 'auto');
  assert.ok(plan.points.length > 0);
  for (let i = 0; i < plan.points.length; i++) {
    const p = plan.points[i];
    assert.equal(typeof p.id, 'string');
    assert.ok(/\.json$/i.test(p.preset), `preset must be resolved to a file: ${p.preset}`);
    assert.ok(VALID_REASONS.has(p.reason), `reason ${p.reason}`);
    assert.ok(p.intensity >= 0.3 && p.intensity <= 3.0, `intensity ${p.intensity}`);
    assert.ok(p.confidence >= 0 && p.confidence <= 1);
    if (i > 0) assert.ok(p.time >= plan.points[i - 1].time, 'points sorted by time');
  }
  // Anti-overlap: a point's morph never runs past the next point.
  for (let i = 0; i < plan.points.length - 1; i++) {
    assert.ok(plan.points[i].morphDurationSec <= plan.points[i + 1].time - plan.points[i].time + 1e-6);
  }
});

test('end-to-end Visual OS plan is deterministic', () => {
  const { buildVisualOsPerformancePlan } = load('automation/visualOsPlanner.ts');
  const a = JSON.stringify(buildVisualOsPerformancePlan(makeTrackAnalysis(), STYLE_PACKS, { duration: 56, stylePackId: 'dark-techno-minimal' }));
  const b = JSON.stringify(buildVisualOsPerformancePlan(makeTrackAnalysis(), STYLE_PACKS, { duration: 56, stylePackId: 'dark-techno-minimal' }));
  assert.equal(a, b);
});

test('planner returns null (legacy fallback) when the style pack cannot be resolved', () => {
  const { buildVisualOsPerformancePlan } = load('automation/visualOsPlanner.ts');
  const plan = buildVisualOsPerformancePlan(makeTrackAnalysis(), STYLE_PACKS, { stylePackId: 'does-not-exist' });
  assert.equal(plan, null);
});

test('adapter and planner do not import runtime/renderer/analyzer layers', () => {
  const forbidden = [/from '\.\.\/state/, /from '\.\.\/visuals/, /from '\.\.\/ui/, /from '\.\.\/audio/, /from '\.\.\/analyzer/, /from 'p5'/];
  for (const rel of ['automation/scenePlanAdapter.ts', 'automation/visualOsPlanner.ts']) {
    const src = readSrc(rel);
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(src), `${rel} must not match ${pattern}`);
    }
  }
});

// A reliable musical grid for the planner (bars every secondsPerBar from t=0).
function makeTempo(bpm = 128, reliable = true) {
  const spb = (60 / bpm) * 4;
  return { bpm, secondsPerBar: spb, gridOffset: 0, bars: Array.from({ length: 400 }, (_, i) => i * spb), reliable, confidence: reliable ? 0.9 : 0.1 };
}

test('a long scene expands into multiple enveloped segments that follow the evolution arc', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  const scenePlan = { version: 1, stylePack: 'dark-techno', scenes: [makeScene(0, 40, 'release', 'dark-techno')] };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, tempo: makeTempo(128), trackSeed: 7 });
  const pts = plan.points.filter((p) => p.sectionId === 'vos:dark-techno:0');
  // A 40s scene expands into several choreography segments (not one big anchor).
  assert.ok(pts.length > 1, `long scene expands into multiple segments (${pts.length})`);
  for (const p of pts) assert.equal(typeof p.meta.evolutionPhase, 'string', 'each point carries an evolution phase');
  // Intensity follows the birth..peak..death arc: the hottest point sits past the birth anchor.
  const maxIdx = pts.reduce((best, p, i, arr) => (p.intensity > arr[best].intensity ? i : best), 0);
  assert.ok(maxIdx > 0, 'a later (peak-region) segment reads hotter than the birth anchor');
});

// -- Anti-repetition (hard variation policy) ----------------------------------

function makeRepetitionBundle() {
  const phrase = (id, startTime, endTime, seed) => ({
    id, motif: 'grid-scan', role: 'foundation', startTime, endTime, subdivision: 'bar',
    intensity: 0.6, density: 0.5, motion: 0.5, novelty: 0.08, variationSeed: seed, operators: []
  });
  return {
    narrative: { version: 1, segments: [{ id: 'n', startTime: 0, endTime: 20, type: 'groove', intensity: 0.6 }] },
    intent: { version: 1, points: [{ time: 0, intent: 'sustain', weight: 0.6, duration: 1 }] },
    choreography: {
      version: 1, frames: [],
      score: { version: 1, transitions: [], motifs: [phrase('p0', 0, 4, 1), phrase('p1', 4, 8, 2), phrase('p2', 8, 12, 3), phrase('p3', 12, 16, 4), phrase('p4', 16, 20, 5)] }
    }
  };
}

const THREE_MOTIF_PACK = {
  preferred: ['grid-scan', 'tunnel-drive', 'pulse-field'], supported: [], forbidden: [],
  palettes: { preferred: ['mono'], forbidden: [] }
};

test('director hard-bans immediate (A->A) and short-gap (A->B->A) motif repetition', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const pack = makePack({ capabilities: THREE_MOTIF_PACK });
  const motifs = directScenes(makeRepetitionBundle(), pack).map((s) => s.motif);
  for (let i = 1; i < motifs.length; i++) assert.notEqual(motifs[i], motifs[i - 1], `A->A at ${i}`);
  for (let i = 2; i < motifs.length; i++) assert.notEqual(motifs[i], motifs[i - 2], `A->B->A at ${i}`);
});

test('disabling the variation policy lets the scorer repeat (policy is what prevents it)', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const pack = makePack({ capabilities: THREE_MOTIF_PACK });
  const motifs = directScenes(makeRepetitionBundle(), pack, { variationPolicy: { forbidImmediateRepeat: false, minRepeatGap: 0 } }).map((s) => s.motif);
  assert.ok(motifs.some((m, i) => i > 0 && m === motifs[i - 1]), 'without policy, low-novelty continuity repeats');
});

// -- Fallback frame->scene robustness -----------------------------------------

test('degenerate zero-duration scenes are filtered out', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const phrase = (id, s, e) => ({ id, motif: 'pulse-field', role: 'foundation', startTime: s, endTime: e, subdivision: 'bar', intensity: 0.5, density: 0.5, motion: 0.5, novelty: 0.1, variationSeed: 1, operators: [] });
  const bundle = {
    narrative: { version: 1, segments: [{ id: 'n', startTime: 0, endTime: 8, type: 'groove', intensity: 0.5 }] },
    intent: { version: 1, points: [{ time: 0, intent: 'sustain', weight: 0.5, duration: 1 }] },
    choreography: { version: 1, frames: [], score: { version: 1, transitions: [], motifs: [phrase('a', 0, 4), phrase('z', 4, 4)] } }
  };
  const scenes = directScenes(bundle, makePack());
  assert.equal(scenes.length, 1, 'zero-duration phrase dropped');
  assert.ok(scenes[0].durationSec > 0);
});

test('frame fallback gives the trailing frame a real duration (no zero-length scene)', () => {
  const { directScenes } = load('automation/choreographyDirector.ts');
  const frame = (time, motif, seed) => ({ time, actions: {}, activeOperators: [], motif, motifIntensity: 0.5, motifDensity: 0.5, motifMotion: 0.5, novelty: 0.2, variationSeed: seed });
  const bundle = {
    narrative: { version: 1, segments: [{ id: 'n', startTime: 0, endTime: 12, type: 'groove', intensity: 0.5 }] },
    intent: { version: 1, points: [{ time: 0, intent: 'sustain', weight: 0.5, duration: 1 }] },
    // No score => frame fallback path.
    choreography: { version: 1, frames: [frame(0, 'pulse-field', 1), frame(4, 'orbit-system', 2), frame(8, 'network-bloom', 3)] }
  };
  const scenes = directScenes(bundle, makePack());
  assert.equal(scenes.length, 3);
  for (const s of scenes) assert.ok(s.durationSec > 0, 'every fallback scene has positive duration');
});

// -- Density cap on SceneEvolution expansion ----------------------------------

function makeScene(timeSec, durationSec, narrative, packId = 'base-temporal', energy = 0.6) {
  return {
    timeSec, durationSec, stylePack: packId, motif: 'pulse-field',
    vocabulary: { palette: 'spectral', lineCharacter: 0.5, glowCharacter: 0.5, grain: 0.3, contrast: 0.5 },
    behaviour: { energy, density: 0.5, motion: 0.5, volatility: 0.2, cohesion: 0.6 },
    evolution: { steps: [
      { phase: 'birth', at: 0, level: 0.2 }, { phase: 'growth', at: 0.3, level: 0.5 },
      { phase: 'peak', at: 0.5, level: 0.9 }, { phase: 'release', at: 0.75, level: 0.5 }, { phase: 'death', at: 0.92, level: 0.2 }
    ] },
    microEvents: [], targetStateReference: `${packId}:${narrative}`
  };
}

test('adapter caps waypoint density on long scenes and collapses short scenes', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'base-temporal');
  const scenePlan = { version: 1, stylePack: 'base-temporal', scenes: [makeScene(0, 40, 'build'), makeScene(40, 1.0, 'peak')] };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, minWaypointSpacingSec: 2.5, maxWaypointsPerScene: 5 });

  const longPts = plan.points.filter((p) => p.sectionId === 'vos:base-temporal:0');
  const tinyPts = plan.points.filter((p) => p.sectionId === 'vos:base-temporal:1');
  assert.ok(longPts.length >= 2 && longPts.length <= 5, `long scene waypoints ${longPts.length}`);
  assert.equal(tinyPts.length, 1, 'a 1s scene collapses to a single anchor');
  for (let i = 1; i < longPts.length; i++) {
    assert.ok(longPts[i].time - longPts[i - 1].time >= 2.5 - 1e-6, 'min spacing respected');
  }
});

// -- Data-driven capability weights -------------------------------------------

test('capability weights are data-driven (override flips preferred vs supported)', () => {
  const { scoreMotifCandidates } = load('automation/variationEngine.ts');
  const cap = {
    preferred: ['network-bloom'], supported: ['grid-scan'], forbidden: [],
    palettes: { preferred: [], forbidden: [] }, weights: { preferred: 0.3, supported: 0.9 }
  };
  const ranked = scoreMotifCandidates({ semanticMotif: null, intensity: 0.5, novelty: 0.5, variationSeed: 1 }, cap, { previousMotif: null, recentUsage: {}, recentWindow: 4 });
  const bloom = ranked.find((c) => c.motif === 'network-bloom');
  const grid = ranked.find((c) => c.motif === 'grid-scan');
  assert.ok(grid.capability > bloom.capability, 'supported outweighs preferred when the pack says so');
});

test('Visual OS is the default generator: forceLegacyDramaturgy defaults to false and the old flag is gone', () => {
  const { featureFlags } = load('config/featureFlags.ts');
  assert.equal(featureFlags.forceLegacyDramaturgy, false);
  assert.equal('USE_VISUAL_OS_V2' in featureFlags, false);
});

// -- Generator routing (UI flow, via the pure helper DashboardUI.generatePlan calls) ----------

test('generator routing is an allowlist: only Dramaturgy runs Visual OS; everything else is legacy', () => {
  const { shouldUseVisualOs } = load('automation/generatorRouting.ts');
  assert.equal(shouldUseVisualOs('dramaturgy', false), true, 'Dramaturgy -> Visual OS');
  assert.equal(shouldUseVisualOs('strict', false), false, 'Strict -> legacy');
  assert.equal(shouldUseVisualOs('hero', false), false, 'Hero -> legacy');
  assert.equal(shouldUseVisualOs('dramaturgy', true), false, 'debug override -> legacy');
  // An unknown / typo / future strategy must NOT accidentally fall into Visual OS.
  assert.equal(shouldUseVisualOs('visual-os', false), false, 'unknown strategy -> legacy');
  assert.equal(shouldUseVisualOs('', false), false, 'empty strategy -> legacy');
});

test('every Visual Mode maps to a real, resolvable style pack', () => {
  const { stylePackForVisualMode, VISUAL_MODE_TO_STYLE_PACK } = load('automation/generatorRouting.ts');
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const packIds = new Set(STYLE_PACKS.packs.map((p) => p.id));
  for (const mode of Object.keys(VISUAL_MODE_TO_STYLE_PACK)) {
    const packId = stylePackForVisualMode(mode);
    assert.ok(packId && packIds.has(packId), `visual mode '${mode}' -> known pack`);
    assert.equal(resolveStylePack(STYLE_PACKS, packId).id, packId);
  }
  // Visual mode and its default pack share an id except 'temporal' -> 'base-temporal'.
  assert.equal(stylePackForVisualMode('cyberpunk'), 'cyberpunk');
  assert.equal(stylePackForVisualMode('temporal'), 'base-temporal');
  assert.equal(stylePackForVisualMode('not-a-mode'), undefined);
});

// -- Full style-pack coverage (Phase 4) ---------------------------------------

const MAIN_PACKS = ['base-temporal', 'classic', 'dark-techno', 'organic-ambient', 'cyberpunk', 'cosmic-wormhole', 'hero'];
const NARRATIVES = ['intro', 'groove', 'tension', 'build', 'fake-drop', 'release', 'peak', 'breakdown', 'outro'];

test('every shipped style pack declares an explicit, full targetMap (not relying on inheritance)', () => {
  for (const pack of STYLE_PACKS.packs) {
    const map = pack.targetMap ?? {};
    for (const key of [...NARRATIVES, 'default']) {
      const ref = map[key];
      assert.ok(ref && typeof ref.preset === 'string' && /\.json$/i.test(ref.preset), `${pack.id} raw targetMap missing '${key}'`);
    }
  }
});

test('every main style pack resolves and covers all narratives plus a sparse default target', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  for (const id of MAIN_PACKS) {
    const pack = resolveStylePack(STYLE_PACKS, id);
    assert.equal(pack.id, id);
    for (const n of NARRATIVES) {
      const ref = pack.targetMap[n];
      assert.ok(ref && typeof ref.preset === 'string' && /\.json$/i.test(ref.preset), `${id} missing targetMap[${n}]`);
    }
    assert.ok(pack.targetMap.default && /\.json$/i.test(pack.targetMap.default.preset), `${id} missing sparse default target`);
  }
});

test('every main style pack produces a valid Visual OS plan with renderer-independent meta', () => {
  const { buildVisualOsPerformancePlan } = load('automation/visualOsPlanner.ts');
  for (const id of MAIN_PACKS) {
    const plan = buildVisualOsPerformancePlan(makeTrackAnalysis(), STYLE_PACKS, { duration: 56, stylePackId: id });
    assert.ok(plan && plan.points.length > 0, `plan for ${id}`);
    for (const p of plan.points) {
      assert.ok(/\.json$/i.test(p.preset), `${id} preset ${p.preset}`);
      assert.ok(p.meta, `${id} point carries meta`);
      assert.equal(typeof p.meta.motif, 'string');
      assert.equal(p.meta.stylePack, id);
      assert.equal(typeof p.meta.sceneId, 'string');
      assert.equal(typeof p.meta.evolutionPhase, 'string');
      for (const key of Object.keys(p.meta)) {
        assert.ok(!/tuning|preset|opacity|particle|alpha/i.test(key), `meta leaked renderer concept: ${key}`);
      }
    }
  }
});

test('planner returns null for an empty/broken packs file (legacy fallback)', () => {
  const { buildVisualOsPerformancePlan } = load('automation/visualOsPlanner.ts');
  assert.equal(buildVisualOsPerformancePlan(makeTrackAnalysis(), { version: 1, packs: [] }, { stylePackId: 'base-temporal' }), null);
});

// -- Activity level (Phase 3) -------------------------------------------------

test('activity level is the density cap (macro < balanced < active) independent of variation', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'base-temporal');
  // A long build scene whose natural bar subdivision exceeds every activity cap, so the cap (not
  // the music) is what differentiates the three levels. 'build' has no release role => no extra
  // release points, so the point count equals the segment cap exactly.
  const scenePlan = { version: 1, stylePack: 'base-temporal', scenes: [makeScene(0, 64, 'build')] };
  const count = (level) => adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 70, activityLevel: level, tempo: makeTempo(128), trackSeed: 3 }).points.length;
  const macro = count('macro');
  const balanced = count('balanced');
  const active = count('active');
  assert.equal(macro, 1, 'macro collapses the scene to a single anchor');
  assert.ok(balanced > macro, `balanced (${balanced}) denser than macro (${macro})`);
  assert.ok(active > balanced, `active (${active}) denser than balanced (${balanced})`);
  assert.equal(count('active'), active, 'deterministic');
});

test('Active is a real density increase, not just a higher cap, on medium drops/breaks', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'cyberpunk');
  const count = (dur, narrative, level, energy) => {
    const scenePlan = { version: 1, stylePack: 'cyberpunk', scenes: [makeVariantScene(10, dur, narrative, 'cyberpunk', energy)] };
    return adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: dur + 20, variantMode: 'paired', activityLevel: level, tempo: makeTempo(128), trackSeed: 4 })
      .points.filter((p) => p.sectionId === 'vos:cyberpunk:0').length;
  };
  // Reported bug: Active+Paired produced only ~1-3 points on a 20-30s drop/break because Activity
  // was merely a cap. With the density scale + lowered base segment lengths, a medium scene fills.
  assert.ok(count(24, 'release', 'active', 0.9) >= 4, `active+paired densifies a 24s drop (${count(24, 'release', 'active', 0.9)})`);
  assert.ok(count(20, 'breakdown', 'active', 0.3) >= 4, `active+paired densifies a 20s break (${count(20, 'breakdown', 'active', 0.3)})`);
  // Active genuinely exceeds Balanced on the SAME medium scene (density, not just a higher ceiling).
  assert.ok(count(24, 'release', 'active', 0.9) > count(24, 'release', 'balanced', 0.9), `active denser than balanced (${count(24, 'release', 'active', 0.9)} vs ${count(24, 'release', 'balanced', 0.9)})`);
  // Macro still collapses a medium scene to a single section anchor.
  assert.equal(count(24, 'release', 'macro', 0.9), 1, 'macro stays a single anchor');
});

// -- Renderer Independence Contract: domain modules stay clean (Phase 8 #9) ----

test('Visual OS domain modules contain no preset filenames or render/tuning concepts', () => {
  const renderTokens = /\.json|particleEnergySpeed|particleBeatSpeed|opacity|lineAlpha|wormholeWarp|document\.|window\./;
  for (const rel of ['automation/styleTranslator.ts', 'automation/choreographyDirector.ts', 'automation/variationEngine.ts', 'automation/automationSituationClassifier.ts', 'automation/globalVisualNarrative.ts', 'automation/longScenePlanner.ts', 'automation/movementGrammar.ts', 'automation/variationMemory.ts', 'automation/microChoreographyPlanner.ts']) {
    assert.ok(!renderTokens.test(readSrc(rel)), `${rel} must stay renderer-independent`);
  }
});

// -- AutomationSituation + Variant Pairs (ADR-005 extension) -------------------

function makeVariantScene(timeSec, durationSec, narrative, packId = 'cyberpunk', energy = 0.85) {
  return {
    timeSec, durationSec, stylePack: packId, motif: 'tunnel-drive',
    vocabulary: { palette: 'neon', lineCharacter: 0.9, glowCharacter: 0.6, grain: 0.5, contrast: 0.9 },
    behaviour: { energy, density: 0.7, motion: 0.6, volatility: 0.4, cohesion: 0.4 },
    evolution: { steps: [
      { phase: 'birth', at: 0, level: 0.4 }, { phase: 'growth', at: 0.3, level: 0.7 },
      { phase: 'peak', at: 0.5, level: 0.95 }, { phase: 'release', at: 0.75, level: 0.6 }, { phase: 'death', at: 0.92, level: 0.3 }
    ] },
    microEvents: [], targetStateReference: `${packId}:${narrative}`
  };
}

test('automation situation classifier is deterministic and rule-based', () => {
  const { classifyAutomationSituation } = load('automation/automationSituationClassifier.ts');
  const c = (o) => classifyAutomationSituation(o);
  assert.equal(c({ narrative: 'intro', energy: 0.2, durationSec: 10 }), 'intro-establish');
  assert.equal(c({ narrative: 'outro', energy: 0.2, durationSec: 20 }), 'outro-dissolve');
  assert.equal(c({ narrative: 'build', energy: 0.6, durationSec: 8 }), 'buildup-ramp');
  assert.equal(c({ narrative: 'tension', energy: 0.6, durationSec: 8 }), 'buildup-ramp');
  assert.equal(c({ narrative: 'release', energy: 0.9, durationSec: 20 }), 'drop-long');
  assert.equal(c({ narrative: 'release', energy: 0.9, durationSec: 6 }), 'drop-short');
  assert.equal(c({ narrative: 'release', energy: 0.9, durationSec: 20, previousNarrative: 'build' }), 'drop-after-build');
  assert.equal(c({ narrative: 'breakdown', energy: 0.2, durationSec: 30 }), 'breakdown-long');
  assert.equal(c({ narrative: 'breakdown', energy: 0.2, durationSec: 6 }), 'transition-release');
  assert.equal(c({ narrative: 'peak', energy: 0.9, durationSec: 20 }), 'peak-sustain');
  assert.equal(c({ narrative: 'groove', energy: 0.5, durationSec: 30 }), 'groove-sustain');
  assert.equal(c({ narrative: 'groove', energy: 0.5, durationSec: 10 }), 'verse-long');
  assert.equal(c({ narrative: 'fake-drop', energy: 0.6, durationSec: 8 }), 'transition-release');
  // Deterministic for identical input.
  const args = { narrative: 'release', energy: 0.8, durationSec: 25, previousNarrative: 'tension' };
  assert.equal(c(args), c(args));
});

test('movement grammar resolves deterministic renderer-independent gesture qualities', () => {
  const { resolveMovementGesture } = load('automation/movementGrammar.ts');
  const behaviour = { energy: 0.9, density: 0.7, motion: 0.8, volatility: 0.5, cohesion: 0.4 };
  const input = { situation: 'drop-long', variantRole: 'primary', behaviour, narrative: 'release', variationMode: 'paired' };
  const first = resolveMovementGesture(input);
  assert.equal(first, resolveMovementGesture(input), 'same input gives the same gesture');
  assert.ok(['pulse', 'drive', 'orbit', 'scatter', 'collapse', 'expand', 'bloom', 'fragment', 'ripple', 'slice', 'tunnel', 'swarm', 'lock', 'echo', 'fade'].includes(first));
  assert.ok(!/\.json/i.test(JSON.stringify(first)), 'gesture carries no concrete target');

  const release = resolveMovementGesture({ ...input, variantRole: 'release' });
  assert.notEqual(release, first, 'segment role can change movement quality within one situation');
  const developed = resolveMovementGesture({ ...input, previousGesture: first, variationMode: 'expressive' });
  assert.notEqual(developed, first, 'expressive mode develops away from an immediate repetition');
});

test('style movement vocabulary inherits, substyles override, and unknown gestures fall back', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const base = resolveStylePack(STYLE_PACKS, 'base-temporal');
  assert.deepEqual([...base.movementVocabulary['drop-long']], ['drive', 'slice', 'fragment', 'lock']);
  const strobe = resolveStylePack(STYLE_PACKS, 'dark-techno').substyles.strobe;
  assert.deepEqual([...strobe.movementVocabulary['drop-long']], ['slice', 'fragment', 'lock', 'pulse']);
  assert.deepEqual([...strobe.movementVocabulary['breakdown-long']], [...base.movementVocabulary['breakdown-long']], 'unlisted situation inherits');

  const file = { version: 1, packs: [
    { id: 'parent', movementVocabulary: { 'drop-long': ['drive', 'slice'] } },
    { id: 'child', extends: 'parent', movementVocabulary: { 'drop-long': ['explode'] } }
  ] };
  assert.deepEqual([...resolveStylePack(file, 'child').movementVocabulary['drop-long']], ['drive', 'slice'], 'invalid authored list does not erase valid fallback');
});

test('variation memory is local, defensive, and records cross-scene choreography', () => {
  const { createVariationMemory } = load('automation/variationMemory.ts');
  const memory = createVariationMemory();
  const plan = planChoreo('peak-sustain', 32, ['a', 'b', 'c'], 'paired');
  memory.record(plan);
  const snapshot = memory.snapshot();
  assert.equal(snapshot.recentSituations.at(-1), 'peak-sustain');
  assert.equal(snapshot.recentTargets.length, plan.segments.length);
  assert.equal(snapshot.lastPeakGesture, plan.segments.at(-1).movementGesture);
  snapshot.recentTargets.push('mutated');
  assert.ok(!memory.snapshot().recentTargets.includes('mutated'), 'snapshot cannot mutate generator memory');
  assert.deepEqual(memory.snapshot(), memory.snapshot(), 'memory reads are deterministic');
});

test('long scene planner creates a real entry-to-release macro form', () => {
  const { planLongScene } = load('automation/longScenePlanner.ts');
  const long = planLongScene('drop-long', 48);
  assert.deepEqual([...long.map((section) => section.phase)], ['entry', 'establish', 'intensify', 'peak', 'release']);
  assert.ok(Math.abs(long.reduce((sum, section) => sum + section.durationSec, 0) - 48) < 1e-6);
  assert.ok(new Set(long.flatMap((section) => section.preferredGestures)).size >= 4, 'macro phases change movement quality');
  assert.deepEqual([...planLongScene('drop-short', 8).map((section) => section.phase)], ['entry']);
});

test('global visual narrative distinguishes returns and marks climax/resolution', () => {
  const { planGlobalVisualNarrative } = load('automation/globalVisualNarrative.ts');
  const plan = { version: 1, stylePack: 'cyberpunk', scenes: [
    makeVariantScene(0, 8, 'intro', 'cyberpunk', 0.2),
    makeVariantScene(8, 24, 'release', 'cyberpunk', 0.8),
    makeVariantScene(32, 16, 'breakdown', 'cyberpunk', 0.3),
    makeVariantScene(48, 24, 'peak', 'cyberpunk', 1),
    makeVariantScene(72, 12, 'outro', 'cyberpunk', 0.15)
  ] };
  const narrative = planGlobalVisualNarrative(plan);
  assert.equal(narrative.arcType, 'two-drop');
  assert.equal(narrative.returnStrategy, 'evolve');
  assert.equal(narrative.climaxSceneIndex, 3);
  assert.equal(narrative.sceneBiases[3].roleInTrack, 'climax');
  assert.equal(narrative.sceneBiases[4].roleInTrack, 'resolution');
  assert.equal(JSON.stringify(narrative), JSON.stringify(planGlobalVisualNarrative(plan)), 'deterministic global arc');
});

const NEUTRAL_TEMPO = { bpm: 0, secondsPerBar: null, gridOffset: 0, bars: [], reliable: false, confidence: 0 };

function planChoreo(situation, durationSec, vocabulary, mode, overrides = {}) {
  const { planMicroChoreography, variationProfileFor } = load('automation/microChoreographyPlanner.ts');
  const behaviour = overrides.behaviour ?? { energy: 0.8, density: 0.5, motion: 0.5, volatility: 0.3, cohesion: 0.5 };
  return planMicroChoreography(
    { situation, startSec: overrides.startSec ?? 0, durationSec, behaviour, vocabulary, vocabularyId: 'vid' },
    { variation: variationProfileFor(mode), activityCap: overrides.activityCap ?? 8, tempo: overrides.tempo ?? NEUTRAL_TEMPO },
    { trackSeed: overrides.trackSeed ?? 42, sceneIndex: overrides.sceneIndex ?? 0 }
  );
}

test('micro-choreography planner always returns a plan whose envelopes fill each segment exactly', () => {
  // Stable mode, a short scene, and an empty vocabulary all yield a usable plan (never null/empty).
  for (const [dur, vocab, mode] of [[40, ['drop.primary', 'drop.counter', 'drop.release'], 'stable'], [6, ['drop.primary'], 'paired'], [40, [], 'expressive']]) {
    const plan = planChoreo('drop-long', dur, vocab, mode);
    assert.ok(plan && plan.segments.length >= 1, `>=1 segment (dur ${dur}, ${mode})`);
    for (const s of plan.segments) {
      assert.ok(s.durationSec > 0 && s.envelope, 'segment has duration + envelope');
      assert.equal(typeof s.movementGesture, 'string', 'segment has an abstract movement gesture');
      const { attackSec, sustainSec, releaseSec, cooldownSec } = s.envelope;
      assert.ok(attackSec >= 0 && sustainSec >= 0 && releaseSec >= 0 && cooldownSec >= 0, 'non-negative phases');
      const sum = attackSec + sustainSec + releaseSec + cooldownSec;
      assert.ok(Math.abs(sum - s.durationSec) < 1e-6, `envelope fills the segment (${sum} vs ${s.durationSec})`);
    }
  }
  // Bit-for-bit determinism for identical input (seeded, no Math.random).
  assert.equal(JSON.stringify(planChoreo('drop-long', 40, ['a', 'b', 'c'], 'paired')), JSON.stringify(planChoreo('drop-long', 40, ['a', 'b', 'c'], 'paired')));
  // Renderer independence: the planner never emits a preset filename.
  assert.ok(!/\.json/i.test(JSON.stringify(planChoreo('drop-long', 40, ['drop.primary', 'drop.counter'], 'expressive'))), 'planner output names no preset file');
});

test('subdivision snaps to bars under a reliable grid and falls back to equal time without one', () => {
  const spb = (60 / 120) * 4; // 2.0s bars
  const tempo = { bpm: 120, secondsPerBar: spb, gridOffset: 0, bars: Array.from({ length: 100 }, (_, i) => i * spb), reliable: true, confidence: 0.9 };
  const snapped = planChoreo('drop-long', 48, ['drop.primary', 'drop.counter'], 'paired', { tempo, startSec: 0 });
  assert.ok(snapped.segments.length >= 3, `enough segments to test snapping (${snapped.segments.length})`);
  for (const s of snapped.segments) {
    const offBars = s.offsetSec / spb;
    assert.ok(Math.abs(offBars - Math.round(offBars)) < 1e-6, `segment starts on a bar line (${s.offsetSec})`);
  }
  // Without a reliable grid the subdivision is an equal time split.
  const even = planChoreo('drop-long', 48, ['drop.primary', 'drop.counter'], 'paired', { tempo: NEUTRAL_TEMPO });
  assert.ok(even.segments.length >= 2);
  const d0 = even.segments[0].durationSec;
  for (const s of even.segments) assert.ok(Math.abs(s.durationSec - d0) < 1e-6, 'equal-time fallback segments');
});

test('the role sequence is a real cycle, not a fixed A/B alternation', () => {
  const plan = planChoreo('drop-long', 64, ['drop.primary', 'drop.counter', 'drop.release'], 'expressive', { tempo: makeTempo(128), activityCap: 12, trackSeed: 99 });
  const roles = plan.segments.map((s) => s.role);
  assert.ok(roles.length >= 4, `enough segments to show a cycle (${roles.length})`);
  assert.ok(new Set(roles).size >= 3, `cycle uses more than two roles (${[...new Set(roles)].join(',')})`);
  // Not a strict two-symbol alternation (A,B,A,B,...): some position breaks role[i] === role[i-2].
  assert.ok(!roles.every((r, i) => i < 2 || r === roles[i - 2]), 'not a fixed A-B-A-B alternation');
});

test('weighted memory keeps roles moving (bounded runs) and is deterministic', () => {
  const opts = { tempo: makeTempo(128), activityCap: 14, trackSeed: 77 };
  const roles = planChoreo('groove-sustain', 80, ['verse.primary', 'verse.motion', 'drop.counter', 'break.glow'], 'expressive', opts).segments.map((s) => s.role);
  assert.ok(roles.length >= 6, `long horizon (${roles.length})`);
  let run = 1, maxRun = 1;
  for (let i = 1; i < roles.length; i++) { run = roles[i] === roles[i - 1] ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
  assert.ok(maxRun <= 3, `weighted memory avoids long same-role runs (max run ${maxRun})`);
  assert.ok(new Set(roles).size >= 2, 'more than one role across the horizon');
  const again = planChoreo('groove-sustain', 80, ['verse.primary', 'verse.motion', 'drop.counter', 'break.glow'], 'expressive', opts).segments.map((s) => s.role);
  assert.equal(JSON.stringify(roles), JSON.stringify(again), 'deterministic role sequence');
});

test('style pack targetMap resolves variant target handles to concrete presets (with child override)', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const base = resolveStylePack(STYLE_PACKS, 'base-temporal');
  const keys = ['drop.primary', 'drop.counter', 'drop.release', 'build.compress', 'build.escalate',
    'break.sparse', 'break.glow', 'verse.primary', 'verse.motion', 'peak.overdrive', 'transition.slice', 'outro.dissolve'];
  for (const key of keys) {
    const ref = base.targetMap[key];
    assert.ok(ref && /\.json$/i.test(ref.preset), `base-temporal ${key} -> ${ref && ref.preset}`);
  }
  // Inheritance: a child without its own variant key inherits the base mapping.
  const hero = resolveStylePack(STYLE_PACKS, 'hero');
  assert.equal(hero.targetMap['drop.counter'].preset, 'vos-drop-counter.json');
  // Child override: cyberpunk remaps drop.counter to its own preset.
  const cyber = resolveStylePack(STYLE_PACKS, 'cyberpunk');
  assert.equal(cyber.targetMap['drop.counter'].preset, 'vos-peak-overdrive.json');
});

test('a long drop scene is split into a variant pair with multiple distinct resolved presets', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'cyberpunk');
  const scenePlan = { version: 1, stylePack: 'cyberpunk', scenes: [makeVariantScene(0, 40, 'release', 'cyberpunk')] };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, variantMode: 'paired', maxWaypointsPerScene: 8 });
  const pts = plan.points.filter((p) => p.sectionId === 'vos:cyberpunk:0');
  assert.ok(pts.length >= 2, `long drop expanded into variants (${pts.length})`);
  const presets = new Set(pts.map((p) => p.preset));
  assert.ok(presets.size >= 2, `distinct variant presets (${[...presets].join(',')})`);
  for (const p of pts) {
    assert.ok(/\.json$/i.test(p.preset), `resolved preset ${p.preset}`);
    assert.equal(p.meta.automationSituation, 'drop-long');
    assert.equal(typeof p.meta.vocabularyId, 'string');
    assert.ok(['primary', 'secondary', 'release', 'sparse', 'focus'].includes(p.meta.variantRole), `role ${p.meta.variantRole}`);
    assert.equal(typeof p.meta.movementGesture, 'string', 'movement gesture reaches timeline meta');
    assert.equal(typeof p.meta.longScenePhase, 'string', 'long-scene phase reaches timeline meta');
    assert.equal(typeof p.meta.globalArcRole, 'string', 'global arc role reaches timeline meta');
    assert.ok(typeof p.meta.targetStateReference === 'string' && !/\.json/i.test(p.meta.targetStateReference), 'meta handle stays opaque');
    assert.equal(typeof p.meta.evolutionPhase, 'string');
  }
});

test('two consecutive long drops evolve instead of replaying the same target and gesture sequence', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'cyberpunk');
  const scenePlan = { version: 1, stylePack: 'cyberpunk', scenes: [
    makeVariantScene(0, 40, 'release', 'cyberpunk'),
    makeVariantScene(40, 40, 'release', 'cyberpunk')
  ] };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 80, variantMode: 'expressive', maxWaypointsPerScene: 8 });
  const signature = (sceneIndex) => plan.points
    .filter((point) => point.sectionId === `vos:cyberpunk:${sceneIndex}`)
    .map((point) => `${point.meta.targetStateReference}/${point.meta.movementGesture}`);
  assert.notDeepEqual(signature(0), signature(1), 'returning drop is evolved by global bias and cross-scene memory');
  assert.notEqual(signature(0).at(-1), signature(1)[0], 'scene boundary does not repeat the same target/gesture');
});

test('a short scene stays sparse but still carries choreography provenance', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'cyberpunk');
  const scenePlan = { version: 1, stylePack: 'cyberpunk', scenes: [makeVariantScene(0, 6, 'release', 'cyberpunk')] };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, variantMode: 'paired' });
  const pts = plan.points.filter((p) => p.sectionId === 'vos:cyberpunk:0');
  assert.ok(pts.length >= 1 && pts.length <= 3, `short scene stays sparse (${pts.length})`);
  for (const p of pts) {
    assert.equal(typeof p.meta.vocabularyId, 'string', 'point carries choreography provenance');
    assert.ok(['primary', 'secondary', 'release', 'sparse', 'focus'].includes(p.meta.variantRole), `role ${p.meta.variantRole}`);
  }
});

test('variant mode controls split aggressiveness (stable single style, paired/expressive split)', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  const scenePlan = { version: 1, stylePack: 'dark-techno', scenes: [makeVariantScene(0, 44, 'release', 'dark-techno')] };
  const stats = (mode) => {
    const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, variantMode: mode, maxWaypointsPerScene: 8 });
    const pts = plan.points.filter((p) => p.sectionId === 'vos:dark-techno:0');
    return { points: pts.length, distinct: new Set(pts.map((p) => p.preset)).size };
  };
  const stable = stats('stable');
  const paired = stats('paired');
  const expressive = stats('expressive');
  assert.equal(stable.distinct, 1, 'stable keeps a single style per scene');
  assert.ok(paired.distinct >= 2, `paired splits into distinct variants (${paired.distinct})`);
  assert.ok(expressive.points >= paired.points, `expressive at least as dense (${expressive.points} vs ${paired.points})`);
  assert.deepEqual(stats('expressive'), expressive, 'deterministic');
});

test('automation breathes: every morph stays well short of the gap to the next point', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  // A long, sparse breakdown is exactly where the legacy "stretch to next point" erased the air.
  const scenePlan = { version: 1, stylePack: 'dark-techno', scenes: [makeScene(10, 36, 'breakdown', 'dark-techno', 0.25)] };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, variantMode: 'stable', tempo: makeTempo(120), trackSeed: 5 });
  const pts = plan.points;
  assert.ok(pts.length >= 2, `breakdown breathes across multiple points (${pts.length})`);
  for (let i = 0; i < pts.length - 1; i++) {
    const gap = pts[i + 1].time - pts[i].time;
    assert.ok(pts[i].morphDurationSec <= gap + 1e-6, 'morph never overruns the next point (anti-overlap)');
    assert.ok(gap - pts[i].morphDurationSec > 0.5, `visible air remains after the morph (gap ${gap.toFixed(2)}, morph ${pts[i].morphDurationSec.toFixed(2)})`);
  }
});

test('adapter makes soft transitions longer and drop-like transitions shorter without edge-to-edge stretching', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  const scenePlan = { version: 1, stylePack: 'dark-techno', scenes: [makeScene(16, 36, 'breakdown', 'dark-techno', 0.5)] };
  const base = { duration: 60, variantMode: 'stable', tempo: makeTempo(120), trackSeed: 15 };
  const analysis = (energy, density, novelty = 0, reasons = []) => ({
    sections: [section('verse', 0, 16, 0.3, 0.3), { ...section('break', 16, 52, energy, density), reasons }],
    noveltyPeaks: novelty ? [{ time: 16, value: novelty }] : [], cues: [], timingConfidence: { overall: 0.9 }
  });
  const soft = adaptScenePlanToPerformancePlan(scenePlan, pack, { ...base, analysis: analysis(0.32, 0.31) });
  const drop = adaptScenePlanToPerformancePlan(scenePlan, pack, { ...base, analysis: analysis(0.95, 0.95, 1, ['high-transient']) });
  assert.ok(soft.points[0].morphDurationSec > drop.points[0].morphDurationSec);
  assert.equal(soft.points[0].morphCurve, 'easeInOut');
  assert.equal(drop.points[0].morphCurve, 'exponential');
  assert.equal(JSON.stringify(drop), JSON.stringify(adaptScenePlanToPerformancePlan(scenePlan, pack, { ...base, analysis: analysis(0.95, 0.95, 1, ['high-transient']) })));
  for (let i = 0; i < soft.points.length - 1; i++) {
    const gap = soft.points[i + 1].time - soft.points[i].time;
    assert.ok(soft.points[i].morphDurationSec < gap - 0.5, 'cooldown air remains; morph is not edge-to-edge');
  }
});

test('adapter preserves an explicit style-pack morph curve under aggressive dynamics', () => {
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = makePack({
    targetMap: { breakdown: { preset: 'explicit.json', morphCurve: 'linear' }, default: { preset: 'default.json' } },
    behaviourVocabulary: {}, variantPairs: {}, movementVocabulary: {}
  });
  const scenePlan = { version: 1, stylePack: 'test-pack', scenes: [makeScene(16, 20, 'breakdown', 'test-pack', 0.5)] };
  const analysis = {
    sections: [section('verse', 0, 16, 0.1, 0.1), { ...section('break', 16, 36, 1, 1), reasons: ['high-transient'] }],
    noveltyPeaks: [{ time: 16, value: 1 }], cues: [], timingConfidence: { overall: 1 }
  };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 40, variantMode: 'stable', analysis });
  assert.equal(plan.points[0].morphCurve, 'linear');
});

test('stable mode is not static: one identity, multiple points, varying intensity', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  const scenePlan = { version: 1, stylePack: 'dark-techno', scenes: [makeVariantScene(0, 44, 'release', 'dark-techno', 0.9)] };
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, variantMode: 'stable', tempo: makeTempo(128), trackSeed: 6 });
  const pts = plan.points.filter((p) => p.sectionId === 'vos:dark-techno:0');
  assert.ok(pts.length >= 2, `stable still breaks a long scene into multiple points (${pts.length})`);
  assert.equal(new Set(pts.map((p) => p.preset)).size, 1, 'a single visual identity');
  assert.ok(new Set(pts.map((p) => p.intensity.toFixed(3))).size >= 2, 'intensity varies across the scene (it breathes, not flat)');
});

test('release roles scale with releaseFrequency (expressive >> stable) across the horizon', () => {
  // Release roles are seeded, so assert over a horizon of scenes rather than one fragile seed.
  const countReleases = (mode) => {
    let n = 0;
    for (let s = 0; s < 8; s++) {
      const plan = planChoreo('drop-long', 64, ['drop.primary', 'drop.counter', 'drop.release'], mode, { tempo: makeTempo(128), activityCap: 12, trackSeed: 100 + s, sceneIndex: s });
      n += plan.segments.filter((seg) => seg.role === 'release').length;
    }
    return n;
  };
  const expressive = countReleases('expressive');
  const stable = countReleases('stable');
  assert.ok(expressive >= 1, `expressive emits release roles across scenes (${expressive})`);
  assert.ok(expressive > stable, `expressive releases far more than stable (${expressive} vs ${stable})`);
});

test('every style-pack targetMap preset is registered in the preset manifest', () => {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/visual-tuning-presets/index.json'), 'utf8'));
  const present = new Set(manifest.presets);
  for (const pack of STYLE_PACKS.packs) {
    const maps = [pack.targetMap ?? {}];
    for (const sub of Object.values(pack.substyles ?? {})) if (sub.targetMap) maps.push(sub.targetMap);
    for (const map of maps) {
      for (const ref of Object.values(map)) {
        assert.ok(present.has(ref.preset), `${pack.id} targetMap preset ${ref.preset} missing from manifest`);
      }
    }
  }
});

test('new Visual OS variant presets are registered in the manifest', () => {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/visual-tuning-presets/index.json'), 'utf8'));
  const required = ['vos-drop-primary.json', 'vos-drop-counter.json', 'vos-drop-release.json',
    'vos-build-compress.json', 'vos-build-escalate.json', 'vos-break-sparse.json', 'vos-break-glow.json',
    'vos-verse-primary.json', 'vos-verse-motion.json', 'vos-peak-overdrive.json', 'vos-transition-slice.json', 'vos-outro-dissolve.json'];
  for (const p of required) assert.ok(manifest.presets.includes(p), `manifest missing ${p}`);
});
