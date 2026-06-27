import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

function loadSemantics() {
  const cache = new Map();
  function load(filePath) {
    if (cache.has(filePath)) return cache.get(filePath).exports;
    const output = ts.transpileModule(readFileSync(filePath, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(filePath, module);
    vm.runInContext(output, vm.createContext({
      exports: module.exports, module, Math, Number,
      require(request) {
        const base = normalize(join(dirname(filePath), request));
        let target = base.endsWith('.ts') ? base : `${base}.ts`;
        try { readFileSync(target); } catch { target = join(base, 'index.ts'); }
        return load(target);
      }
    }), { filename: filePath });
    return module.exports;
  }
  return load(join(SRC_ROOT, 'semantics/index.ts'));
}

function section(label, start, end, energy, density, dominantFeature = 'rhythm') {
  return { label, start, end, energy, density, dominantFeature, avgRms: energy, peakRms: energy };
}

function analysis(bpm = 128, confidence = 0.9) {
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

function run(input = analysis()) {
  const semantics = loadSemantics();
  const narrative = semantics.buildNarrative(input);
  const intents = semantics.generateIntents(narrative);
  return semantics.processChoreography(intents, input);
}

test('Visual Score AST is deterministic and JSON serializable', () => {
  const a = run();
  const b = run();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(a.score))), JSON.stringify(a.score));
  assert.equal(a.score.version, 1);
  assert.equal(a.score.motifs.length, 5);
  for (const frame of a.frames.filter(frame => frame.motif)) {
    assert.equal(typeof frame.motifIntensity, 'number');
    assert.equal(typeof frame.motifDensity, 'number');
    assert.equal(typeof frame.motifMotion, 'number');
    assert.equal(typeof frame.novelty, 'number');
  }
});

test('planner chooses tempo/confidence-aware subdivisions', () => {
  const fast = run(analysis(170, 0.9));
  const slow = run(analysis(82, 0.9));
  const uncertain = run(analysis(128, 0.2));
  assert.ok(fast.score.motifs.every(m => m.subdivision === 'bar' || m.subdivision === 'two-bars'));
  assert.ok(slow.score.motifs.every(m => m.subdivision === 'half-beat' || m.subdivision === 'bar'));
  assert.ok(uncertain.score.motifs.every(m => m.subdivision === 'section'));
  assert.ok(fast.frames.length < slow.frames.length, 'fast music must not generate denser choreography than slow music');
});

test('every adjacent motif receives a typed transition', () => {
  const { score, frames } = run();
  assert.equal(score.transitions.length, score.motifs.length - 1);
  assert.equal(score.transitions[2].behavior, 'collapse-release');
  for (const transition of score.transitions) {
    assert.ok(score.motifs.some(m => m.id === transition.fromMotifId));
    assert.ok(score.motifs.some(m => m.id === transition.toMotifId));
    const transitionFrames = frames.filter(frame =>
      frame.transition?.behavior === transition.behavior
      && frame.motifId === transition.fromMotifId);
    assert.ok(transitionFrames.length > 0);
    assert.ok(transitionFrames.every(frame => frame.transition.fromMotif && frame.transition.toMotif));
  }
});

test('empty analysis is a valid score and motif/transition fields affect only resolved tuning output', () => {
  const empty = analysis(0, 0);
  empty.duration = 0;
  empty.sections = [];
  empty.noveltyPeaks = [];
  const plan = run(empty);
  assert.equal(plan.frames.length, 0);
  assert.equal(plan.score.motifs.length, 0);
  assert.equal(plan.score.transitions.length, 0);

  const { resolveSemanticState } = loadSemantics();
  const baseFrame = { time: 0, actions: {}, activeOperators: [] };
  const orbit = resolveSemanticState({ ...baseFrame, motif: 'orbit-system' }, 'classic', {});
  const plain = resolveSemanticState(baseFrame, 'classic', {});
  assert.ok(orbit.temporalRingSize > plain.temporalRingSize);
  assert.ok(orbit.particleActivityTurn > plain.particleActivityTurn);

  const collapse = resolveSemanticState({ ...baseFrame, transition: { behavior: 'collapse-release', progress: 0, preserve: ['rhythmPhase'] } }, 'classic', {});
  const release = resolveSemanticState({ ...baseFrame, transition: { behavior: 'collapse-release', progress: 1, preserve: ['rhythmPhase'] } }, 'classic', {});
  assert.ok(release.lineDistance > collapse.lineDistance);

  const defaultJson = resolveSemanticState(null, 'classic', { 'default.json': { circleHue: 217 } });
  assert.equal(defaultJson.circleHue, 217);
});

test('transition resolver blends from and to motifs by progress', () => {
  const { resolveSemanticState } = loadSemantics();
  const frame = progress => ({
    time: progress, actions: {}, activeOperators: [], motif: 'orbit-system',
    motifIntensity: 1, motifDensity: 1, motifMotion: 1, novelty: 0,
    transition: {
      behavior: 'morph', progress, preserve: [],
      fromMotif: 'orbit-system', toMotif: 'network-bloom'
    }
  });
  const from = resolveSemanticState(frame(0), 'classic', {});
  const to = resolveSemanticState(frame(1), 'classic', {});
  assert.ok(from.temporalRingSize > to.temporalRingSize, 'from motif fades out');
  assert.ok(to.polygonAlpha > from.polygonAlpha, 'to motif fades in');
});

test('intent assignment follows time rather than point array index', () => {
  const { processChoreography } = loadSemantics();
  const input = analysis();
  const intents = {
    version: 1,
    points: [
      { time: 8, intent: 'compress', weight: 1, duration: 1 },
      { time: 0, intent: 'establish', weight: 0.2, duration: 1 },
      { time: 4, intent: 'contrast', weight: 0.5, duration: 1 }
    ]
  };
  const plan = processChoreography(intents, input);
  assert.equal(plan.score.motifs[0].intensity, 0.2);
  assert.equal(plan.score.motifs[1].intensity, 1);
  const verseStart = plan.frames.find(frame => frame.time === 8 && !frame.transition);
  assert.ok(typeof verseStart.actions.collapse === 'number');
});

test('implemented grammar operators deterministically vary phrase fields', () => {
  const { sampleMotifGrammar } = loadSemantics();
  const base = {
    id: 'm', motif: 'pulse-field', role: 'foundation', startTime: 0, endTime: 8,
    subdivision: 'beat', intensity: 1, density: 1, motion: 1, novelty: 0,
    variationSeed: 7, operators: []
  };
  for (const operator of ['repeat', 'alternate', 'grow', 'shrink', 'cascade', 'call-response']) {
    const first = sampleMotifGrammar({ ...base, operators: [operator] }, 0.75, 3);
    const second = sampleMotifGrammar({ ...base, operators: [operator] }, 0.75, 3);
    assert.deepEqual(first, second);
    assert.ok(first.activeOperators.includes(operator));
    assert.ok(first.intensity !== 1 || first.density !== 1 || first.motion !== 1 || first.rhythmicPhase !== 0.875);
  }
});

test('cascade changes resolver output through propagated density and motion', () => {
  const { sampleMotifGrammar, resolveSemanticState } = loadSemantics();
  const phrase = {
    id: 'cascade', motif: 'orbit-system', role: 'tension', startTime: 0, endTime: 8,
    subdivision: 'beat', intensity: 0.9, density: 0.9, motion: 0.8, novelty: 0.2,
    variationSeed: 1, operators: ['cascade']
  };
  const resolveSample = (position, index) => {
    const sample = sampleMotifGrammar(phrase, position, index);
    return resolveSemanticState({
      time: position * 8, actions: {}, activeOperators: sample.activeOperators,
      motif: phrase.motif, motifIntensity: sample.intensity, motifDensity: sample.density,
      motifMotion: sample.motion, novelty: phrase.novelty
    }, 'classic', {});
  };
  const early = resolveSample(0.1, 0);
  const late = resolveSample(0.8, 3);
  assert.ok(late.temporalRingSize > early.temporalRingSize);
  assert.ok(late.particleActivityTurn > early.particleActivityTurn);
});

test('grow and shrink produce different target tuning over phrase time', () => {
  const { sampleMotifGrammar, resolveSemanticState } = loadSemantics();
  const resolveAt = (operator, position, index) => {
    const phrase = {
      id: operator, motif: 'network-bloom', role: 'foundation', startTime: 0, endTime: 8,
      subdivision: 'beat', intensity: 1, density: 1, motion: 1, novelty: 0,
      variationSeed: 2, operators: [operator]
    };
    const sample = sampleMotifGrammar(phrase, position, index);
    return resolveSemanticState({
      time: position * 8, actions: {}, activeOperators: sample.activeOperators,
      motif: phrase.motif, motifIntensity: sample.intensity, motifDensity: sample.density,
      motifMotion: sample.motion, novelty: phrase.novelty, phrasePosition: position
    }, 'classic', {});
  };
  assert.ok(resolveAt('grow', 1, 4).lineDistance > resolveAt('grow', 0, 0).lineDistance);
  assert.ok(resolveAt('shrink', 0, 0).lineDistance > resolveAt('shrink', 1, 4).lineDistance);
});

test('long handoff and collapse-release transitions use more than three progress frames', () => {
  for (const input of [analysis(128, 0.2), analysis(40, 0.9)]) {
    const { score, frames } = run(input);
    const transition = score.transitions.find(candidate =>
      candidate.behavior === 'handoff' || candidate.behavior === 'collapse-release');
    assert.ok(transition, 'expected a long handoff or collapse-release transition');
    const samples = frames.filter(frame =>
      frame.motifId === transition.fromMotifId
      && frame.transition?.behavior === transition.behavior);
    assert.ok(samples.length > 3, `${transition.behavior} should have more than three samples`);
    assert.equal(samples[0].transition.progress, 0);
    assert.equal(samples.at(-1).transition.progress, 1);
    assert.ok(samples.some(frame => frame.rhythmicPhase !== frame.transition.progress));
  }
});

test('semantic modules have no physical preset or runtime boundary coupling', () => {
  const source = ['NarrativeEngine.ts', 'IntentGenerator.ts', 'MotifPlanner.ts', 'PatternGrammar.ts',
    'TransitionPlanner.ts', 'ChoreographyEngine.ts', 'SemanticResolver.ts', 'index.ts']
    .map(file => readFileSync(join(SRC_ROOT, 'semantics', file), 'utf8')).join('\n');
  assert.deepEqual(source.match(/[A-Za-z0-9_-]+\.json\b/g) ?? [], ['default.json']);
  assert.doesNotMatch(source, /preset(?:Name|File)|from ['"](?:p5|\.\.\/state|\.\.\/visuals|\.\.\/ui|\.\.\/audio)/i);
  assert.doesNotMatch(source, /document\.|window\.|navigator\.|State\.(?:modulation|directorOutput)/);
});
