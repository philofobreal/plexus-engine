import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createLoader } from './helpers/xr-loader.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
const predecessor = readFileSync('documents/tests/WormholeCanvasSource.pre-t05a.ts.txt', 'utf8');
const point = (time, direction = 1) => ({ id: String(time), time, sectionId: 's', preset: 'fixed.json', confidence: 1,
    intensity: 1, reason: 'build', morphDurationSec: 2, morphCurve: 'linear', spiralDirection: direction });
const payload = { visualMode: 'cosmic-wormhole', visualTuning: { wormholeSpiral: .7, wormholeNebulaAmount: .2,
    wormholeNebulaWeave: .3, wormholeGrainDensity: 0, transitionSpeed: .005 } };
const baseLoad = createLoader();
const { cloneDefaultVisualTuning, effectiveWormholeSpiral } = baseLoad('config/visualTuning.ts');
const { defaultAdvancedBoosts } = baseLoad('config/metaTuningBoost.ts');
const { resolveMetaTuning } = baseLoad('config/resolveMetaTuning.ts');
function seed(gains = 'meta') {
    return { version: 1, rawTuning: { ...cloneDefaultVisualTuning(), wormholeSpeed: .35, wormholeSpiral: .4 },
        macros: { intensity: .6, motion: .7, depth: .2, detail: .4 }, boosts: { ...defaultAdvancedBoosts(), lineWeight: .3 },
        policy: { gains, semanticResolver: false, semanticChoreography: false } };
}
function analysis(load, points = [point(0), point(2, -1)]) {
    const { createEmptyTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
    const trackAnalysis = createEmptyTrackAnalysis();
    const frame = { e: .5, eRatio: 1, densityProj: .2, melodyProj: .1, fxProj: 0, subEnergy: .3, bassEnergy: .2,
        subFlux: .1, bassFlux: .1, state: 'DRIVE', perceptualSpectrum: Array(24).fill(.1) };
    trackAnalysis.features = Array.from({ length: 100 }, () => ({ melody: .2, vocal: .1, fx: 0, density: .3, brightness: .4, tension: .2 }));
    trackAnalysis.cues = [{ time: .5, intensity: .7, type: 'BUILDUP_START' }];
    return { frames: Array.from({ length: 100 }, () => ({ ...frame, perceptualSpectrum: [...frame.perceptualSpectrum] })),
        events: [{ time: .2, type: 1 }, { time: .7, type: 2 }], trackAnalysis, sampleRate: 10, hopSize: 1, bpm: 120,
        duration: 10, performancePlan: { version: 1, source: 'edited', points } };
}
function harness(old = false, globals = {}, extraStubs = {}) {
    const drawn = [], syncs = [];
    class Identity {
        constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.frameDrive = { travel: 0, travelRate: 0, hue: 0 }; this.stageTimes = {}; }
        setStageClock() {} setMaterialSink() {} setLineSink() {} setDepthCue() {} setDepthLayers() {}
        syncPosition(t) { syncs.push(t); }
        draw() { drawn.push(plain({ time: this.state.currentTime, tuning: this.state.visualTuning, target: this.state.targetTuning,
            frame: this.state.currentFrame, features: this.state.currentFeatures, modulation: this.state.modulation,
            director: this.state.directorOutput, beat: this.state.beatDecay, dense: this.state.denseImpactFlash,
            fade: this.state.playbackFade, transition: this.state.activeVisualTransitionId, anchor: this.state.spiralTransitionAnchor })); }
    }
    class Backend {
        constructor(w, h) { this.width = w; this.height = h; this.canvas = { width: w, height: h }; this.frameCount = 0; }
        background() {}
    }
    const stubs = { './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity },
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend }, ...extraStubs };
    const environment = { performance: { now: () => 0 }, fetch: async () => ({ ok: true, json: async () => plain(payload) }), ...globals };
    const load = createLoader(stubs, environment);
    // Retained adapter with current dependencies deliberately isolates the extraction, not a historical bundle replay.
    let Source;
    if (old) {
        const module = { exports: {} };
        const code = ts.transpileModule(predecessor, { compilerOptions: { module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll('import.meta.env.BASE_URL', "'/plexus-engine/'");
        vm.runInNewContext(code, { console, ...environment, module, exports: module.exports, require: request => {
            if (Object.hasOwn(stubs, request)) return stubs[request];
            const path = resolve('src/visuals', request);
            return load(existsSync(path + '.ts') ? path + '.ts' : join(path, 'index.ts'));
        } });
        Source = module.exports.WormholeCanvasSource;
    } else Source = load('visuals/WormholeCanvasSource.ts').WormholeCanvasSource;
    return { load, drawn, syncs, Source };
}

test('XR extraction matches retained T04b source across accepted/skipped frames, pause, seek and presentation changes', async () => {
    const old = harness(true), current = harness();
    const a = new old.Source(), b = new current.Source();
    await a.prepare(analysis(old.load)); await b.prepare(analysis(current.load));
    const run = (t, playing, continuous) => assert.equal(b.render(t, playing, continuous), a.render(t, playing, continuous));
    for (let i = 0; i <= 180; i++) run(i / 60, true, true);
    run(3, false); run(3, false); run(.4, false); run(2.5, false);
    for (const presentation of [{ lineStroke: .8 }, { macros: { intensity: .5, motion: .2, depth: .6, detail: .7 } },
        { grainMaterial: { wormholeNebulaWeave: .1 } }, { spiralDirection: 'left' }, { spiralDirection: 'right' }, { spiralDirection: 'auto' }]) {
        a.setPresentation(presentation); b.setPresentation(presentation); run(2.5, false); run(2.6, true); run(6, false);
    }
    assert.deepEqual(current.drawn, old.drawn, 'all tuning, frame, transient, modulation, director and anchor values');
    assert.deepEqual(current.syncs, old.syncs); a.dispose(); b.dispose();
});

test('explicit Studio raw and MVP meta policies retain their own raw seed and apply gains exactly once', () => {
    const { WormholeFrameContext } = baseLoad('visuals/WormholeFrameContext.ts');
    for (const gains of ['raw', 'meta']) {
        const input = seed(gains), copy = plain(input), context = new WormholeFrameContext(input);
        const expected = plain(gains === 'raw' ? input.rawTuning : resolveMetaTuning(input.rawTuning, input.macros, input.boosts, cloneDefaultVisualTuning()));
        assert.deepEqual(plain(context.state.visualTuning), plain(expected));
        for (let i = 0; i <= 120; i++) context.step(i / 60, true, 1 / 60, i ? (i - 1) / 60 : null, false, i === 0);
        assert.deepEqual(plain(context.state.visualTuning), plain(expected), 'no compounding over repeated draws');
        assert.deepEqual(input, copy, 'input seed never mutated');
        input.rawTuning.wormholeSpeed = 4; input.macros.motion = 0; input.boosts.lineWeight = 0; input.policy.gains = 'raw';
        context.prepare(null); assert.deepEqual(plain(context.state.visualTuning), plain(expected), 'seed is copied at construction');
    }
});

test('source accepts explicit host policy instead of silently substituting XR defaults', async () => {
    const h = harness(), input = seed(), source = new h.Source({ contextSeed: input });
    await source.prepare(null); source.render(1, false);
    const expected = resolveMetaTuning(input.rawTuning, input.macros, input.boosts, cloneDefaultVisualTuning());
    assert.deepEqual(h.drawn[0].tuning, plain(expected)); source.dispose();
});

test('immutable analysis is borrowed, assets are copied, contexts remain isolated and missing assets fail atomically', () => {
    const { WormholeFrameContext } = baseLoad('visuals/WormholeFrameContext.ts');
    const a = new WormholeFrameContext(seed()), b = new WormholeFrameContext(seed());
    const published = analysis(baseLoad), before = plain(published), assets = new Map([['fixed.json', plain(payload)]]);
    const freeze = object => { if (!object || typeof object !== 'object') return; Object.values(object).forEach(freeze); Object.freeze(object); };
    freeze(published); a.prepare(published); a.preparePlan(published.performancePlan, assets);
    assets.get('fixed.json').visualTuning.wormholeSpiral = 999;
    a.step(2.5, false, 1 / 60, null, false, true);
    assert.notEqual(a.state.visualTuning.wormholeSpiral, 999); assert.deepEqual(plain(published), before);
    assert.notEqual(a.state.currentFrame, published.frames[25]); assert.notEqual(a.state.currentFeatures, published.trackAnalysis.features[25]);
    assert.notEqual(a.state.visualTuning, b.state.visualTuning); assert.equal(b.performancePlan, null);
    const ready = a.performancePlan;
    assert.throws(() => a.preparePlan({ points: [point(1), { ...point(2), preset: 'missing.json' }] }, assets), /Missing Wormhole preset/);
    assert.equal(a.performancePlan, ready, 'failed publication preserves last complete assets/plan');
    a.prepare(null); assert.equal(a.performancePlan, null); assert.equal(a.state.beatDecay, 0);
});

test('one accepted source frame performs one director update and one draw; unchanged pause performs neither', async () => {
    let updates = 0;
    const { VisualDirectorFSM } = baseLoad('visuals/VisualDirectorFSM.ts');
    class Director extends VisualDirectorFSM { update(...args) { updates++; return super.update(...args); } }
    const h = harness(false, {}, { './VisualDirectorFSM': { VisualDirectorFSM: Director } }), source = new h.Source();
    await source.prepare(analysis(h.load)); source.render(.7, false);
    assert.equal(updates, 1); assert.equal(h.drawn.length, 1);
    source.render(.7, false); assert.equal(updates, 1); assert.equal(h.drawn.length, 1);
    source.setPresentation({ lineStroke: .8 }); source.render(.7, false);
    assert.equal(updates, 2); assert.equal(h.drawn.length, 2); source.dispose();
});

test('superseded and disposed preparation cannot publish assets to the extracted context', async () => {
    const pending = [];
    const h = harness(false, { fetch: url => new Promise(resolve => pending.push({ url, resolve })) }), source = new h.Source();
    const a = source.prepare(analysis(h.load)), b = source.prepare(analysis(h.load, [{ ...point(0), preset: 'new.json' }]));
    pending[1].resolve({ ok: true, json: async () => payload }); await b;
    const accepted = source.plan;
    pending[0].resolve({ ok: true, json: async () => payload }); await a; assert.equal(source.plan, accepted);
    const c = source.prepare(analysis(h.load)); source.dispose();
    pending[2].resolve({ ok: true, json: async () => payload }); await c;
    assert.equal(source.plan, null); assert.equal(source.render(1, true), false);
});

test('signed plan anchors begin from the explicit host raw seed', () => {
    const { WormholeFrameContext } = baseLoad('visuals/WormholeFrameContext.ts');
    const input = seed('raw'); input.rawTuning.wormholeSpiral = 2.3;
    const context = new WormholeFrameContext(input), published = analysis(baseLoad, [point(1, -1)]);
    context.prepare(published); context.preparePlan(published.performancePlan, new Map([['fixed.json', payload]]));
    context.step(1, false, 0, null, false, true);
    near(effectiveWormholeSpiral(context.state.visualTuning), 2.3);
    context.step(1.5, false, .5, 1, false, false);
    assert.ok(effectiveWormholeSpiral(context.state.visualTuning) < 2.3);
});

test('shared context has no host IO, canvas, clock, XR defaults or plan generation dependency', () => {
    const text = readFileSync('src/visuals/WormholeFrameContext.ts', 'utf8');
    for (const [, specifier] of text.matchAll(/from ['"]([^'"]+)['"]/g))
        assert.doesNotMatch(specifier, /^three$|\/(state|ui|audio|xr)\/|xrWormholeTuning|prepareWormholePerformance/);
    assert.doesNotMatch(text, /\b(fetch|requestAnimationFrame|setInterval)\s*\(|\b(document|window|performance)\./);
    assert.doesNotMatch(readFileSync('src/types/WormholeContext.ts', 'utf8'), /from ['"](?!\.\/index['"])/);
    assert.ok(predecessor.includes('private readonly macros = { ...XR_WORMHOLE_MACROS }'));
    assert.equal(createHash('sha256').update(predecessor).digest('hex'), '173b0d2731d245798d76de6b157154d3c72c130f3e9b1c3aad4dbbe97554d436');
});
