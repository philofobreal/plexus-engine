import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const read = path => readFileSync(join(process.cwd(), path), 'utf8');

const POST_FX_SOURCES = [
  'src/visuals/PostFxTypes.ts',
  'src/visuals/PostFxPipeline.ts',
  'src/visuals/CanvasPostFxSurface.ts',
  'src/visuals/TemporalFragmentationEffect.ts',
  'src/visuals/temporalFragmentationPlan.ts'
];

function createLoader() {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module);
    const resolve = request => {
      const base = normalize(join(dirname(path), request));
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require: resolve, Math, Number, Object, Array, Map, Set });
    return module.exports;
  }
  return relative => load(join(SRC_ROOT, relative));
}

function createMockCanvas(width, height) {
  const ctx = {
    ops: [],
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    canvas: null,
    save() { this.ops.push(['save']); },
    restore() { this.ops.push(['restore']); },
    setTransform(...args) { this.ops.push(['setTransform', ...args]); },
    beginPath() { this.ops.push(['beginPath']); },
    rect(...args) { this.ops.push(['rect', ...args]); },
    clip() { this.ops.push(['clip']); },
    clearRect(...args) { this.ops.push(['clearRect', ...args]); },
    drawImage(...args) { this.ops.push(['drawImage', ...args]); }
  };
  const canvas = { width, height, getContext: () => ctx };
  ctx.canvas = canvas;
  return canvas;
}

function baseInput(overrides = {}) {
  return {
    timeSec: 12.5,
    widthPx: 1920,
    heightPx: 1080,
    glitchIntensity: 1,
    spectralChaos: 0.5,
    rhythmicImpulse: 0.5,
    amount: 1,
    displacement: 0.5,
    density: 0.5,
    ...overrides
  };
}

/** Puts the engine into "a glitch accent is happening right now" for the pipeline-level tests. */
function armGlitch(State, { amount = 1, performanceMode = 0, playing = true } = {}) {
  State.isPlaying = playing;
  State.isExporting = false;
  State.directorOutput.glitchIntensity = 1;
  State.modulation.spectralChaos = 0.5;
  State.modulation.rhythmicImpulse = 0.5;
  State.visualTuning.performanceMode = performanceMode;
  State.visualTuning.postFxFragmentAmount = amount;
  State.visualTuning.postFxFragmentDisplacement = 0.5;
  State.visualTuning.postFxFragmentDensity = 0.5;
}

test('strength 0 and amount 0 are a full bypass, not a no-op composite', () => {
  const load = createLoader();
  const { planTemporalFragmentation, createTemporalFragmentationPlan, isTemporalFragmentationActive, FRAGMENT_GATE } =
    load('visuals/temporalFragmentationPlan.ts');
  const plan = createTemporalFragmentationPlan();

  assert.equal(isTemporalFragmentationActive(1, 0), false);
  assert.equal(isTemporalFragmentationActive(0, 1), false);
  assert.equal(isTemporalFragmentationActive(FRAGMENT_GATE - 0.001, 1), false);
  assert.equal(isTemporalFragmentationActive(FRAGMENT_GATE, 1), true);

  assert.equal(planTemporalFragmentation(plan, baseInput({ amount: 0 })).active, false);
  assert.equal(plan.bandCount, 0);
  assert.equal(planTemporalFragmentation(plan, baseInput({ glitchIntensity: 0 })).active, false);
  assert.equal(planTemporalFragmentation(plan, baseInput({ glitchIntensity: FRAGMENT_GATE - 0.001 })).active, false);
  assert.equal(planTemporalFragmentation(plan, baseInput()).active, true);
});

test('an inactive chain never snapshots, allocates a buffer, or touches the frame', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { PostFxPipeline } = load('visuals/PostFxPipeline.ts');
  const { CanvasPostFxSurface } = load('visuals/CanvasPostFxSurface.ts');
  const { TemporalFragmentationEffect } = load('visuals/TemporalFragmentationEffect.ts');

  let factoryCalls = 0;
  const surface = new CanvasPostFxSurface(() => { factoryCalls++; return createMockCanvas(8, 8); });
  const pipeline = new PostFxPipeline([new TemporalFragmentationEffect()], surface);
  const canvas = createMockCanvas(1920, 1080);
  const host = { drawingContext: canvas.getContext('2d') };

  armGlitch(State, { amount: 0 });
  pipeline.render(host, 10);
  assert.equal(canvas.getContext('2d').ops.length, 0, 'amount 0 must leave the frame pixel-identical');
  assert.equal(factoryCalls, 0, 'no buffer may be allocated while the chain is inactive');

  armGlitch(State, { amount: 1 });
  State.directorOutput.glitchIntensity = 0;
  pipeline.render(host, 10);
  assert.equal(canvas.getContext('2d').ops.length, 0);
  assert.equal(factoryCalls, 0);
});

test('performanceMode and paused/stopped are explicit bypasses ahead of every post cost', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { PostFxPipeline } = load('visuals/PostFxPipeline.ts');
  const { CanvasPostFxSurface } = load('visuals/CanvasPostFxSurface.ts');
  const { TemporalFragmentationEffect } = load('visuals/TemporalFragmentationEffect.ts');

  let factoryCalls = 0;
  const surface = new CanvasPostFxSurface(() => { factoryCalls++; return createMockCanvas(8, 8); });
  const pipeline = new PostFxPipeline([new TemporalFragmentationEffect()], surface);
  const canvas = createMockCanvas(1920, 1080);
  let hostReads = 0;
  const host = { get drawingContext() { hostReads++; return canvas.getContext('2d'); } };

  armGlitch(State, { performanceMode: 1 });
  pipeline.render(host, 10);
  assert.equal(hostReads, 0, 'performanceMode must return before target resolution');
  assert.equal(factoryCalls, 0, 'performanceMode must not allocate a post buffer');
  assert.equal(canvas.getContext('2d').ops.length, 0);

  armGlitch(State, { playing: false });
  pipeline.render(host, 10);
  assert.equal(hostReads, 0, 'a paused/stopped frame must stay exactly what the identity drew');
  assert.equal(factoryCalls, 0);

  armGlitch(State);
  pipeline.render(host, 10);
  assert.ok(hostReads > 0);
  assert.equal(factoryCalls, 1);
  assert.ok(canvas.getContext('2d').ops.length > 0);
});

test('the snapshot buffer is allocated once and resized only on a real dimension change', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { PostFxPipeline } = load('visuals/PostFxPipeline.ts');
  const { CanvasPostFxSurface } = load('visuals/CanvasPostFxSurface.ts');
  const { TemporalFragmentationEffect } = load('visuals/TemporalFragmentationEffect.ts');

  const surface = new CanvasPostFxSurface(() => createMockCanvas(0, 0));
  const pipeline = new PostFxPipeline([new TemporalFragmentationEffect()], surface);
  const canvas = createMockCanvas(1280, 720);
  const host = { drawingContext: canvas.getContext('2d') };

  armGlitch(State);
  for (let frame = 0; frame < 60; frame++) pipeline.render(host, 10 + frame / 60);
  assert.equal(surface.bufferAllocationCount, 1, 'no per-frame buffer allocation');
  assert.equal(surface.bufferResizeCount, 1, 'only the initial sizing');

  canvas.width = 3840;
  canvas.height = 2160;
  pipeline.render(host, 11);
  assert.equal(surface.bufferAllocationCount, 1, 'a resize must reuse the same buffer object');
  assert.equal(surface.bufferResizeCount, 2);
  pipeline.render(host, 11.02);
  assert.equal(surface.bufferResizeCount, 2, 'an unchanged size must not resize');
});

test('the export target receives the same post pass as the live canvas', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { PostFxPipeline } = load('visuals/PostFxPipeline.ts');
  const { CanvasPostFxSurface } = load('visuals/CanvasPostFxSurface.ts');
  const { TemporalFragmentationEffect } = load('visuals/TemporalFragmentationEffect.ts');

  const surface = new CanvasPostFxSurface(() => createMockCanvas(0, 0));
  const pipeline = new PostFxPipeline([new TemporalFragmentationEffect()], surface);
  const live = createMockCanvas(1920, 1080);
  const offscreen = createMockCanvas(1920, 1080);
  const host = { drawingContext: live.getContext('2d'), __plexusExportTarget: { drawingContext: offscreen.getContext('2d') } };

  armGlitch(State);
  State.isPlaying = false;
  State.isExporting = true;
  pipeline.render(host, 10);

  assert.equal(live.getContext('2d').ops.length, 0, 'export must not write to the live canvas');
  const exportOps = offscreen.getContext('2d').ops.filter(op => op[0] === 'drawImage');
  assert.ok(exportOps.length > 0);

  // Same song time, live clock: the identical decision must come out.
  const liveSurface = new CanvasPostFxSurface(() => createMockCanvas(0, 0));
  const livePipeline = new PostFxPipeline([new TemporalFragmentationEffect()], liveSurface);
  const liveOnly = createMockCanvas(1920, 1080);
  State.isExporting = false;
  State.isPlaying = true;
  livePipeline.render({ drawingContext: liveOnly.getContext('2d') }, 10);
  assert.deepEqual(
    liveOnly.getContext('2d').ops.filter(op => op[0] === 'drawImage').map(op => op.slice(5)),
    exportOps.map(op => op.slice(5))
  );
});

test('fragment decisions are deterministic for the same song time and state', () => {
  const load = createLoader();
  const { planTemporalFragmentation, createTemporalFragmentationPlan } = load('visuals/temporalFragmentationPlan.ts');
  const snapshot = input => {
    const plan = planTemporalFragmentation(createTemporalFragmentationPlan(), input);
    return { active: plan.active, bands: plan.bands.slice(0, plan.bandCount).map(band => ({ ...band })) };
  };

  const first = snapshot(baseInput({ timeSec: 41.37 }));
  const second = snapshot(baseInput({ timeSec: 41.37 }));
  assert.deepEqual(first, second);
  // Re-entering the same song time after other times were planned must not drift.
  snapshot(baseInput({ timeSec: 99.1 }));
  assert.deepEqual(snapshot(baseInput({ timeSec: 41.37 })), first);
  assert.notDeepEqual(snapshot(baseInput({ timeSec: 99.1 })), first);
});

test('fragmentation is burst-coherent: one topology per slot, re-selection inside it', () => {
  const load = createLoader();
  const { planTemporalFragmentation, createTemporalFragmentationPlan, TOPOLOGY_SLOT_SEC, ACTIVATION_STEP_SEC } =
    load('visuals/temporalFragmentationPlan.ts');
  const plan = createTemporalFragmentationPlan();

  const collectSlot = slotStart => {
    const geometry = new Map();
    const selections = [];
    for (let step = 0; step < 4; step++) {
      const timeSec = slotStart + step * ACTIVATION_STEP_SEC + 0.01;
      planTemporalFragmentation(plan, baseInput({ timeSec }));
      const bands = plan.bands.slice(0, plan.bandCount).map(band => ({ ...band }));
      for (const band of bands) {
        const key = `${band.y}`;
        const shape = `${band.height}:${band.x}:${band.width}`;
        const known = geometry.get(key);
        assert.ok(known === undefined || known === shape, 'band geometry must not change inside one topology slot');
        geometry.set(key, shape);
      }
      selections.push(bands.map(band => `${band.y}:${band.shiftX}`).join('|'));
    }
    return { geometry, selections };
  };

  const slotA = collectSlot(TOPOLOGY_SLOT_SEC * 40);
  const slotB = collectSlot(TOPOLOGY_SLOT_SEC * 41);
  assert.ok(slotA.geometry.size > 0);
  assert.ok(new Set(slotA.selections).size > 1, 'displacement must re-roll inside a burst');
  assert.notDeepEqual([...slotA.geometry.keys()].sort(), [...slotB.geometry.keys()].sort());
});

test('spectral chaos shapes fragmentation but never gates it, and the envelope thins the burst', () => {
  const load = createLoader();
  const { planTemporalFragmentation, createTemporalFragmentationPlan, FRAGMENT_GATE } =
    load('visuals/temporalFragmentationPlan.ts');
  const plan = createTemporalFragmentationPlan();

  // High chaos with no glitch envelope must stay silent: no continuous TV glitch.
  for (let step = 0; step < 200; step++) {
    planTemporalFragmentation(plan, baseInput({ timeSec: step * 0.05, spectralChaos: 1, glitchIntensity: 0 }));
    assert.equal(plan.active, false);
  }

  // A decaying envelope moves fewer fragments than the attack peak.
  planTemporalFragmentation(plan, baseInput({ glitchIntensity: 1, density: 1 }));
  const peak = plan.bandCount;
  planTemporalFragmentation(plan, baseInput({ glitchIntensity: FRAGMENT_GATE + 0.02, density: 1 }));
  assert.ok(plan.bandCount <= peak);
  assert.ok(peak >= 1);
});

test('every fragment stays inside the surface, keeps its Y range, and is wrap-closable', () => {
  const load = createLoader();
  const { planTemporalFragmentation, createTemporalFragmentationPlan, MAX_MOVING_BANDS } =
    load('visuals/temporalFragmentationPlan.ts');
  const plan = createTemporalFragmentationPlan();

  for (const size of [[640, 360], [1920, 1080], [3840, 2160]]) {
    for (let step = 0; step < 400; step++) {
      planTemporalFragmentation(plan, baseInput({
        timeSec: step * 0.037,
        widthPx: size[0],
        heightPx: size[1],
        spectralChaos: (step % 11) / 10,
        rhythmicImpulse: (step % 7) / 6,
        density: (step % 5) / 4,
        displacement: (step % 3) / 2
      }));
      assert.ok(plan.bandCount <= MAX_MOVING_BANDS);
      const tops = new Set();
      for (let i = 0; i < plan.bandCount; i++) {
        const band = plan.bands[i];
        assert.ok(band.x >= 0 && band.x + band.width <= size[0], 'fragment must stay inside the surface');
        assert.ok(band.y >= 0 && band.y + band.height <= size[1]);
        assert.ok(band.width > 0 && band.height > 0);
        assert.ok(Math.abs(band.shiftX) > 0 && Math.abs(band.shiftX) < band.width, 'shift must stay wrap-closable');
        assert.ok(Number.isInteger(band.shiftX), 'displacement must be whole device pixels');
        assert.equal(tops.has(band.y), false, 'a band may move at most once per frame');
        tops.add(band.y);
      }
    }
  }
});

test('each moving fragment is cleared and fully refilled with same-size, same-Y source rects', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { PostFxPipeline } = load('visuals/PostFxPipeline.ts');
  const { CanvasPostFxSurface } = load('visuals/CanvasPostFxSurface.ts');
  const { TemporalFragmentationEffect } = load('visuals/TemporalFragmentationEffect.ts');

  const surface = new CanvasPostFxSurface(() => createMockCanvas(0, 0));
  const pipeline = new PostFxPipeline([new TemporalFragmentationEffect()], surface);
  const canvas = createMockCanvas(1920, 1080);
  const ctx = canvas.getContext('2d');
  const host = { drawingContext: ctx };
  armGlitch(State, { amount: 1 });

  let inspected = 0;
  for (let step = 0; step < 40; step++) {
    ctx.ops.length = 0;
    pipeline.render(host, 20 + step * 0.05);
    if (ctx.ops.length === 0) continue;

    assert.deepEqual(ctx.ops[1], ['setTransform', 1, 0, 0, 1, 0, 0], 'post math must run in device pixels');
    assert.equal(ctx.globalCompositeOperation, 'source-over');
    assert.equal(ctx.globalAlpha, 1);

    for (let i = 0; i < ctx.ops.length; i++) {
      if (ctx.ops[i][0] !== 'rect') continue;
      const [, x, y, width, height] = ctx.ops[i];
      assert.deepEqual(ctx.ops[i + 1], ['clip']);
      assert.deepEqual(ctx.ops[i + 2], ['clearRect', x, y, width, height], 'the cleared rect must equal the clip rect');

      const first = ctx.ops[i + 3];
      const second = ctx.ops[i + 4];
      for (const draw of [first, second]) {
        assert.equal(draw[0], 'drawImage');
        const [, , sx, sy, sw, sh, , dy, dw, dh] = draw;
        assert.equal(sx, x, 'source column must be the fragment itself');
        assert.equal(sy, y, 'v1 displacement is X-only: the source row must not move');
        assert.equal(dy, y, 'v1 displacement is X-only: the destination row must not move');
        assert.equal(sw, dw, 'no horizontal scale/crop in v1');
        assert.equal(sh, dh, 'no vertical scale/crop in v1');
        assert.equal(sh, height);
      }
      // Wrap pair must fully cover the cleared span, so no alpha hole can appear.
      const left = Math.min(first[6], second[6]);
      const right = Math.max(first[6], second[6]) + width;
      assert.ok(left <= x && right >= x + width, 'the wrap copy must close the cleared span');
      assert.equal(Math.abs(first[6] - second[6]), width, 'the wrap copy must be exactly one span away');
      inspected++;
    }
  }
  assert.ok(inspected > 0, 'the accent must actually produce fragments');
});

test('the post chain has no random source and no forbidden renderer coupling', () => {
  for (const path of POST_FX_SOURCES) {
    const source = read(path);
    assert.doesNotMatch(source, /Math\.random/, `${path} must stay deterministic`);
    assert.doesNotMatch(source, /Date\.now|performance\.now/, `${path} must not read a wall clock`);
    assert.doesNotMatch(source, /from '\.\/(P5RenderTargetCompositor|IdentityTransitionController|StyleRegistry)'/, `${path} must not reach into the ADR-006 crossfade`);
    assert.doesNotMatch(source, /from '(p5|\.\.\/ui\/|\.\.\/audio\/)/, `${path} must not import p5, UI, or audio`);
  }
  // The planner must stay a pure function of its input: no state import, and no state read on any
  // line of actual code (documentation may still name the signals it expects to be handed).
  const planLines = read('src/visuals/temporalFragmentationPlan.ts')
    .split(/\r?\n/)
    .filter(line => !/^\s*(\*|\/\/|\/\*)/.test(line));
  assert.doesNotMatch(planLines.join('\n'), /\bState\./);
  assert.doesNotMatch(planLines.join('\n'), /from '\.\.\/state\//);
});

test('post FX effects never gain identity, transition, or shared-simulation authority', () => {
  for (const path of POST_FX_SOURCES) {
    const source = read(path);
    assert.doesNotMatch(source, /State\.visualMode\s*=(?!=)/);
    assert.doesNotMatch(source, /State\.visualModeTransition/);
    assert.doesNotMatch(source, /State\.modulation\.\w+\s*=(?!=)/);
    assert.doesNotMatch(source, /State\.directorOutput\.\w+\s*=(?!=)/);
    assert.doesNotMatch(source, /advanceSharedSimulation/);
  }
});

test('the renderer runs the post chain exactly once, after the finished identity frame', () => {
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const calls = renderer.match(/postFxPipeline\.render\(/g) ?? [];
  assert.equal(calls.length, 1, 'exactly one post seam');
  assert.match(renderer, /const postFxPipeline = new PostFxPipeline\(\[new TemporalFragmentationEffect\(\)\]\);/);
  // The seam sits after the whole draw branch, so an active crossfade is post-processed once on the
  // final composite rather than once per participating identity.
  assert.match(
    renderer,
    /identityTransitionController\.draw\(ct, backend, compositor, styleRegistry, particles, shockwaves\);\r?\n\s*\} else \{\r?\n\s*styleRegistry\.get\(State\.visualMode\)\.draw\(backend, particles, shockwaves\);\r?\n\s*\}[\s\S]{0,400}?postFxPipeline\.render\(/
  );
  assert.doesNotMatch(renderer, /compositor[\s\S]{0,200}postFxPipeline\.render\([\s\S]{0,200}composite\(/);
});

test('post FX tuning keys are renderer-level, default to a bypass, and stay identity-independent', () => {
  const load = createLoader();
  const { defaultVisualTuning, visualTuningControls } = load('config/visualTuning.ts');
  const { identityOwnedTuningKeys } = load('config/identityTuningRegistry.ts');

  assert.equal(defaultVisualTuning.postFxFragmentAmount, 0, 'default must preserve the current Plexus output');
  assert.equal(defaultVisualTuning.postFxFragmentDisplacement, 0.5);
  assert.equal(defaultVisualTuning.postFxFragmentDensity, 0.5);

  const postControls = Array.from(visualTuningControls).filter(control => control.group === 'Post FX');
  assert.deepEqual(Array.from(postControls, control => control.key), [
    'postFxFragmentAmount',
    'postFxFragmentDisplacement',
    'postFxFragmentDensity'
  ]);
  for (const control of postControls) {
    assert.equal(control.min, 0);
    assert.equal(control.max, 1);
  }
  for (const keys of Object.values(identityOwnedTuningKeys)) {
    for (const key of keys) assert.doesNotMatch(key, /^postFx/, 'post FX is renderer-level, not identity-owned');
  }
});
