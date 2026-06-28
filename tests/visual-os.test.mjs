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
  for (const rel of ['automation/variationEngine.ts', 'automation/choreographyDirector.ts', 'automation/styleTranslator.ts']) {
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

test('adapter expands SceneEvolution phases into intensity waypoints', () => {
  const { resolveStylePack, translateScenePlan } = load('automation/styleTranslator.ts');
  const { directScenes } = load('automation/choreographyDirector.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'dark-techno');
  const scenes = directScenes(makeBundle(), pack);
  const scenePlan = translateScenePlan(scenes, pack);
  const plan = adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 16 });
  // Phase expansion => more points than scenes.
  assert.ok(plan.points.length > scenes.length, 'evolution phases expanded into waypoints');
  // Within scene 0 the peak waypoint must read hotter than the birth waypoint.
  const scene0 = plan.points.filter((p) => p.sectionId === 'vos:dark-techno:0');
  const birth = scene0.find((p) => p.id.includes('-birth-'));
  const peak = scene0.find((p) => p.id.includes('-peak-'));
  assert.ok(birth && peak, 'birth and peak waypoints present');
  assert.ok(peak.intensity >= birth.intensity, 'peak hotter than birth');
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

function makeScene(timeSec, durationSec, narrative) {
  return {
    timeSec, durationSec, stylePack: 'base-temporal', motif: 'pulse-field',
    vocabulary: { palette: 'spectral', lineCharacter: 0.5, glowCharacter: 0.5, grain: 0.3, contrast: 0.5 },
    behaviour: { energy: 0.6, density: 0.5, motion: 0.5, volatility: 0.2, cohesion: 0.6 },
    evolution: { steps: [
      { phase: 'birth', at: 0, level: 0.2 }, { phase: 'growth', at: 0.3, level: 0.5 },
      { phase: 'peak', at: 0.5, level: 0.9 }, { phase: 'release', at: 0.75, level: 0.5 }, { phase: 'death', at: 0.92, level: 0.2 }
    ] },
    microEvents: [], targetStateReference: `base-temporal:${narrative}`
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

test('activity level changes waypoint density deterministically (macro < balanced < active)', () => {
  const { resolveStylePack } = load('automation/styleTranslator.ts');
  const { adaptScenePlanToPerformancePlan } = load('automation/scenePlanAdapter.ts');
  const pack = resolveStylePack(STYLE_PACKS, 'base-temporal');
  // A ~10s scene whose phase gaps straddle the balanced vs. active minimum spacing.
  const scenePlan = { version: 1, stylePack: 'base-temporal', scenes: [makeScene(0, 10, 'build')] };
  const count = (level) => adaptScenePlanToPerformancePlan(scenePlan, pack, { duration: 60, activityLevel: level }).points.length;
  const macro = count('macro');
  const balanced = count('balanced');
  const active = count('active');
  assert.equal(macro, 1, 'macro collapses the scene to a single anchor');
  assert.ok(balanced > macro, `balanced (${balanced}) denser than macro (${macro})`);
  assert.ok(active > balanced, `active (${active}) denser than balanced (${balanced})`);
  assert.equal(count('active'), active, 'deterministic');
});

// -- Renderer Independence Contract: domain modules stay clean (Phase 8 #9) ----

test('Visual OS domain modules contain no preset filenames or render/tuning concepts', () => {
  const renderTokens = /\.json|particleEnergySpeed|particleBeatSpeed|opacity|lineAlpha|wormholeWarp|document\.|window\./;
  for (const rel of ['automation/styleTranslator.ts', 'automation/choreographyDirector.ts', 'automation/variationEngine.ts']) {
    assert.ok(!renderTokens.test(readSrc(rel)), `${rel} must stay renderer-independent`);
  }
});
