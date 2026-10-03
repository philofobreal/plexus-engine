import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

test('requested XR slider positions follow the exact shared MVP macro -> clamp -> advanced order without compounding', () => {
    const load = createLoader();
    const { cloneDefaultVisualTuning } = load('config/visualTuning.ts');
    const { mapMvpMacrosToTuning } = load('config/macroTuningMapper.ts');
    const { advancedBoostKeys, resolveAdvancedTuningValue } = load('config/metaTuningBoost.ts');
    const { resolveMetaTuning } = load('config/resolveMetaTuning.ts');
    const { XR_WORMHOLE_MACROS: macros, XR_WORMHOLE_BOOSTS: boosts } = load('config/xrWormholeTuning.ts');
    assert.deepEqual(JSON.parse(JSON.stringify(macros)), { intensity: 1, motion: 1, depth: 0.3, detail: 1 });
    // The user's authored XR defaults (2026-10-03).
    const authored = { wormholeNebulaAmount: 0.5, wormholeNebulaDetail: 1, wormholeNebulaBloom: 1, wormholeNebulaWeave: 1,
        wormholeSpiral: 0.04, wormholeSpiralArms: 0.5, wormholeGrainDensity: 0.5, postFxFragmentAmount: 0, postFxFragmentDisplacement: 0,
        postFxFragmentDensity: 0, lineAlpha: 1, lineWeight: 0.98, wormholeGrainShape: 1 };
    for (const [key, value] of Object.entries(authored)) assert.equal(boosts[key], value, key);
    for (const scale of [0.1, 0.5, 1, 2, 4]) {
        const raw = cloneDefaultVisualTuning(); raw.wormholeNebulaAmount = scale; raw.wormholeSpeed = scale; raw.lineWeight = scale;
        Object.freeze(raw);
        const expected = { ...raw, ...mapMvpMacrosToTuning(macros, raw) };
        for (const key of advancedBoostKeys) expected[key] = resolveAdvancedTuningValue(key, boosts[key], expected[key]);
        const out = cloneDefaultVisualTuning();
        for (let n = 0; n < 3; n++) assert.deepEqual(JSON.parse(JSON.stringify(resolveMetaTuning(raw, macros, boosts, out))), expected);
        assert.equal(out.wormholeGrainShape, 1);
        assert.ok(out.wormholeNebulaAmount > 0, 'Nebula is on');
        assert.ok(out.wormholeSpiral > 0, 'a hint of spiral');
        for (const key of ['postFxFragmentAmount', 'postFxFragmentDisplacement', 'postFxFragmentDensity']) assert.equal(out[key], 0);
    }
});

test('injected Wormhole state produces the same primitive stream as MVP default state and leaves the global store unchanged', () => {
    const load = createLoader();
    const { State } = load('state/store.ts');
    const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
    const injected = JSON.parse(JSON.stringify(State));
    const capture = () => {
        const commands = [];
        return { commands, backend: new Proxy({ width: 960, height: 540, frameCount: 1, compactMaterialPreview: true }, {
            get(target, key) { if (key in target) return target[key]; return (...args) => { commands.push([key, ...args]); return null; }; }
        }) };
    };
    const original = capture(), isolated = capture();
    const snapshot = JSON.stringify(State);
    new CosmicWormholeIdentity().draw(original.backend, [], []);
    new CosmicWormholeIdentity(injected).draw(isolated.backend, [], []);
    assert.deepEqual(isolated.commands, original.commands);
    injected.currentTime = 10; injected.visualTuning.wormholeSpeed = 4;
    new CosmicWormholeIdentity(injected).draw(capture().backend, [], []);
    assert.equal(JSON.stringify(State), snapshot);
});

test('MVP and injected identity agree with explicitly enabled material, square grains and full density', () => {
    const load = createLoader();
    const { State } = load('state/store.ts');
    const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
    const { resolveMetaTuning } = load('config/resolveMetaTuning.ts');
    const { XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS } = load('config/xrWormholeTuning.ts');
    State.targetTuning.wormholeNebulaAmount = 0.6;
    // Exercise the active raster path even though the user's current XR preset disables Nebula.
    resolveMetaTuning(State.targetTuning, XR_WORMHOLE_MACROS, { ...XR_WORMHOLE_BOOSTS, wormholeNebulaAmount: 0.12 }, State.visualTuning);
    State.currentFrame.e = 0.8; State.currentFrame.eRatio = 0.7; State.playbackFade = 1;
    State.currentTime = 1;
    const capture = () => {
        const commands = [], layers = [];
        const backend = new Proxy({ width: 960, height: 540, frameCount: 60, compactMaterialPreview: true,
            beginFieldRaster(layer, cols, rows) { commands.push(['raster', layer, cols, rows]); return layers[layer] = new Float32Array(cols * rows * 4); }
        }, { get(target, key) { return key in target ? target[key] : (...args) => commands.push([key, ...args]); } });
        return { backend, commands, layers };
    };
    const original = capture(), isolated = capture();
    new CosmicWormholeIdentity().draw(original.backend, [], []);
    new CosmicWormholeIdentity(JSON.parse(JSON.stringify(State))).draw(isolated.backend, [], []);
    assert.equal(original.layers.length, 3);
    assert.deepEqual(isolated.commands, original.commands);
    for (let i = 0; i < 3; i++) assert.deepEqual(isolated.layers[i], original.layers[i]);
});

test('the XR defaults run the Nebula raster; a zero amount still bypasses all of its work', () => {
    const load = createLoader();
    const { State } = load('state/store.ts');
    const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
    const { resolveMetaTuning } = load('config/resolveMetaTuning.ts');
    const { XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS } = load('config/xrWormholeTuning.ts');
    State.targetTuning.wormholeNebulaAmount = 0.9;
    State.playbackFade = 1; State.currentTime = 1;
    const rastersWith = boosts => {
        resolveMetaTuning(State.targetTuning, XR_WORMHOLE_MACROS, boosts, State.visualTuning);
        let rasters = 0;
        const backend = new Proxy({ width: 960, height: 540, frameCount: 60, compactMaterialPreview: true,
            beginFieldRaster() { rasters++; return null; } }, { get(target, key) { return key in target ? target[key] : () => {}; } });
        new CosmicWormholeIdentity().draw(backend, [], []);
        return rasters;
    };
    assert.ok(rastersWith(XR_WORMHOLE_BOOSTS) > 0, 'the authored defaults draw the Nebula');
    assert.equal(rastersWith({ ...XR_WORMHOLE_BOOSTS, wormholeNebulaAmount: 0 }), 0, 'amount 0 skips it entirely');
});

function sourceHarness() {
    const canvases = [];
    class Backend {
        constructor() { this.canvas = { width: 960, height: 540 }; this.frameCount = 0; canvases.push(this); }
    }
    let draws = 0;
    class Identity { constructor(state) { this.state = state; } syncPosition() {} setDepthCue() {} setDepthLayers() {} draw() { draws++; } }
    const load = createLoader({
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend },
        './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }
    }, { fetch: async () => ({ ok: true, json: async () => ({ presets: [] }) }) });
    return { load, source: new (load('visuals/WormholeCanvasSource.ts').WormholeCanvasSource)(), draws: () => draws };
}

test('background consumes the supplied gameplay plan without independently regenerating it', async () => {
    const { source, load } = sourceHarness();
    const { EMPTY_TRACK_ANALYSIS } = load('analyzer/normalizeAnalysisResult.ts');
    const performancePlan = { version: 1, source: 'auto', points: [] };
    await source.prepare({ frames: [], events: [], sampleRate: 44100, hopSize: 1024, duration: 1, bpm: 120,
        trackAnalysis: EMPTY_TRACK_ANALYSIS, performancePlan });
    assert.equal(source.plan, performancePlan); source.dispose();
});

test('actual source owns no loop: steady pause does no drawing; playing canvas work is capped and seek/restart wakes it', async () => {
    const { source, draws } = sourceHarness();
    await source.prepare(null);
    assert.equal(source.render(0, false), true);
    for (let i = 0; i < 240; i++) assert.equal(source.render(0, false), false);
    assert.equal(draws(), 1);
    for (let i = 0; i < 120; i++) source.render(i / 120, true);
    assert.ok(draws() <= 32);
    assert.equal(source.render(1, false), true); const paused = draws();
    for (let i = 0; i < 72; i++) source.render(1, false);
    assert.equal(draws(), paused);
    assert.equal(source.render(0, true), true); source.dispose(); assert.equal(source.render(5, true), false);
});

test('source copies analyzer frames before director mutation and protects immutable publication', async () => {
    const { source, load } = sourceHarness();
    const { EMPTY_TRACK_ANALYSIS } = load('analyzer/normalizeAnalysisResult.ts');
    const frame = Object.freeze({ e: 0.7, densityProj: 0.3, melodyProj: 0, fxProj: 0, subEnergy: 0.2, bassEnergy: 0.4,
        subFlux: 0.1, bassFlux: 0.1, perceptualSpectrum: Object.freeze(new Array(24).fill(0.1)), state: 'IDLE', eRatio: 0.8 });
    await source.prepare({ frames: [frame], events: [], sampleRate: 44100, hopSize: 1024, duration: 1, bpm: 120, trackAnalysis: EMPTY_TRACK_ANALYSIS,
        performancePlan: { version: 1, source: 'auto', points: [] } });
    source.render(0, true);
    assert.equal(frame.state, 'IDLE');
    source.dispose();
});
