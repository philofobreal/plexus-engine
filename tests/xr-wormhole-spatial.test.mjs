// XR Wormhole spatial field, data seam: the Wormhole source resolves a small plain-data spatial
// state from its own morphed tuning for every drawn frame, and that state travels with the frame
// (in thread here; through the worker in xr-wormhole-worker.test.mjs) up to the XR backdrop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({ three: THREE });
const { createWormholeSpatialFrame, resolveWormholeSpatialFrame } = load('visuals/wormholeSpatialFrame.ts');
const { WORMHOLE_SPATIAL_MAX_TRAVEL_RATE, WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS, WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE } = load('types/WormholeSpatialFrame.ts');
const { cloneDefaultVisualTuning } = load('config/visualTuning.ts');
const { resolveMetaTuning } = load('config/resolveMetaTuning.ts');
const { XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS } = load('config/xrWormholeTuning.ts');
const { applyMvpWormholePreset } = load('automation/applyMvpWormholePreset.ts');
const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');

const UNIT_FIELDS = ['amount', 'density', 'radius', 'depth', 'turbulence', 'streak', 'wisp', 'pulse', 'impact',
    'red', 'green', 'blue', 'hazeRed', 'hazeGreen', 'hazeBlue'];
const FIELDS = ['time', 'travel', 'travelRate', 'tubeSpread', 'spiralTurns', 'hue', ...UNIT_FIELDS];
const drive = (over = {}) => ({ travel: 0.25, travelRate: 0.3, hue: 210, ...over });
const calm = { beatDecay: 0, denseImpactFlash: 0 };

function assertBounded(frame, label) {
    assert.deepEqual(Object.keys(frame).sort(), [...FIELDS].sort(), `${label}: exactly the contract fields`);
    for (const key of FIELDS) assert.ok(Number.isFinite(frame[key]), `${label}: ${key} finite (${frame[key]})`);
    for (const key of UNIT_FIELDS) assert.ok(frame[key] >= 0 && frame[key] <= 1, `${label}: ${key} in [0, 1] (${frame[key]})`);
    assert.ok(frame.time >= 0, `${label}: time`);
    assert.ok(frame.travel >= 0, `${label}: travel (${frame.travel})`);
    assert.ok(frame.travelRate >= 0 && frame.travelRate <= WORMHOLE_SPATIAL_MAX_TRAVEL_RATE, `${label}: travelRate`);
    assert.ok(frame.hue >= 0 && frame.hue < 360, `${label}: hue (${frame.hue})`);
    assert.ok(frame.spiralTurns >= -WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS && frame.spiralTurns <= WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS, `${label}: signed spiralTurns (${frame.spiralTurns})`);
    assert.ok(frame.tubeSpread >= WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE[0] && frame.tubeSpread <= WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE[1], `${label}: tubeSpread (${frame.tubeSpread})`);
}

/** The XR-resolved tuning of every shipped Wormhole preset (preset merge -> XR macros and boosts). */
function resolvedPresets() {
    const dir = 'public/visual-tuning-presets';
    const point = { id: 'p', time: 0, sectionId: 's', preset: 'p', confidence: 1, intensity: 1, reason: 'section', morphDurationSec: 1, morphCurve: 'easeInOut' };
    return readdirSync(dir).filter(name => name.startsWith('vos-wh-')).map(name => {
        const target = cloneDefaultVisualTuning();
        applyMvpWormholePreset(target, JSON.parse(readFileSync(`${dir}/${name}`, 'utf8')), point);
        return { name, tuning: resolveMetaTuning(target, XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS, cloneDefaultVisualTuning()) };
    });
}

test('the resolver writes one reused record, bounded and finite for any tuning, including hostile values', () => {
    const out = createWormholeSpatialFrame();
    assertBounded(out, 'fresh');
    assert.equal(resolveWormholeSpatialFrame(out, 3, cloneDefaultVisualTuning(), drive(), calm), out, 'no allocation: the record is returned');
    assertBounded(out, 'defaults');
    const hostile = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1e9, 1e9, -0.0000001];
    for (const value of hostile) {
        const tuning = cloneDefaultVisualTuning();
        for (const key of Object.keys(tuning)) if (typeof tuning[key] === 'number') tuning[key] = value;
        resolveWormholeSpatialFrame(out, value, tuning, drive({ travel: value, travelRate: value, hue: value }),
            { beatDecay: value, denseImpactFlash: value });
        assertBounded(out, `all inputs ${value}`);
    }
    // Travel crosses unwrapped (consumers derive their own cycles); a tiny negative hue never rounds up to 360.
    resolveWormholeSpatialFrame(out, 1, cloneDefaultVisualTuning(), drive({ travel: -1e-17, hue: -1e-14 }), calm);
    assert.ok(out.travel === 0 && out.hue < 360);
    resolveWormholeSpatialFrame(out, 1, cloneDefaultVisualTuning(), drive({ travel: 7.75, hue: 725 }), calm);
    assert.equal(out.travel, 7.75); assert.equal(out.hue, 5);
    // A non-finite drawn hue falls back to the authored circle hue.
    const tuning = cloneDefaultVisualTuning(); tuning.circleHue = 300;
    resolveWormholeSpatialFrame(out, 1, tuning, drive({ hue: Number.NaN }), calm);
    assert.equal(out.hue, 300);
});

test('resolution is deterministic and follows the morphed tuning and transients of the frame', () => {
    const tuning = cloneDefaultVisualTuning();
    Object.assign(tuning, { wormholeJitter: 0.6, wormholeNebulaAmount: 0.4, wormholeRing: 0.2, wormholeEmissionMode: 2 });
    const a = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 12.5, tuning, drive(), { beatDecay: 0.4, denseImpactFlash: 0.9 });
    const b = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 12.5, tuning, drive(), { beatDecay: 0.4, denseImpactFlash: 0.9 });
    assert.deepEqual(a, b);
    assert.equal(a.time, 12.5); assert.equal(a.pulse, 0.4); assert.equal(a.impact, 0.9);
    assert.equal(a.travel, 0.25); assert.equal(a.travelRate, 0.3); assert.equal(a.hue, 210);
    // The spiral the image drew crosses as is (turns), bounded; a drive without one draws none.
    const spiralOf = spiralTurns => resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1, tuning, drive({ spiralTurns }), calm).spiralTurns;
    assert.equal(spiralOf(2.4), 2.4); assert.equal(spiralOf(undefined), 0); assert.equal(spiralOf(Number.NaN), 0);
    // T04a deliberately extends the old positive-only contract; predecessor retained in documents/tests.
    assert.equal(spiralOf(-1), -1); assert.equal(spiralOf(1e9), WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS);
    assert.equal(spiralOf(-1e9), -WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS);
    // A fractional emission mode (a morph between Continuous and Sparse burst) is a continuous crossfade.
    const at = mode => { tuning.wormholeEmissionMode = mode; return resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 0, tuning, drive(), calm).density; };
    const steps = [0, 0.25, 0.5, 1, 1.5, 2].map(at);
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i] < steps[i - 1], `density falls monotonically toward sparse: ${steps}`);
    // A disabled image (no line opacity) carries no presence.
    tuning.lineAlpha = 0;
    assert.equal(resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 0, tuning, drive(), calm).amount, 0);
});

test('every shipped Wormhole preset resolves to a bounded frame; magenta roles keep their hue', () => {
    const presets = resolvedPresets();
    assert.ok(presets.length >= 10);
    for (const { name, tuning } of presets) {
        const frame = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1, tuning, drive({ hue: tuning.circleHue }), calm);
        assertBounded(frame, name);
        assert.equal(frame.hue, tuning.circleHue, `${name}: the displayed hue crosses unchanged`);
    }
});

test('the Wormhole identity publishes the travel and hue of exactly the frame it drew, deterministically', () => {
    const wormhole = createLoader();
    const { CosmicWormholeIdentity } = wormhole('visuals/CosmicWormholeIdentity.ts');
    const { State } = wormhole('state/store.ts');
    const backend = () => ({ width: 960, height: 540, frameCount: 1, beginFieldRaster() { return null; }, drawFieldRaster() {},
        background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {}, line() {}, circle() {}, triangle() {},
        beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}, radialDim() {}, compositeRingTint() {} });
    State.bpm = 128; State.playbackFade = 1; State.isPlaying = true;
    Object.assign(State.visualTuning, { circleHue: 335, wormholeSpeed: 3, performanceMode: 0 });
    Object.assign(State.targetTuning, { circleHue: 335, wormholeSpeed: 3, performanceMode: 0 });
    const run = () => {
        const identity = new CosmicWormholeIdentity(); identity.syncPosition(4);
        const series = [];
        for (let i = 0; i <= 60; i++) { State.currentTime = 4 + i / 30; identity.draw(backend(), [], []); series.push({ ...identity.frameDrive }); }
        return series;
    };
    const first = run(), second = run();
    assert.deepEqual(first, second, 'same song times -> same drive');
    for (const drive of first) {
        assert.ok(Number.isFinite(drive.travel) && drive.travel >= 0, `travel ${drive.travel}`);
        assert.ok(Number.isFinite(drive.travelRate) && drive.travelRate > 0, `rate ${drive.travelRate}`);
        assert.ok(drive.travelRate < WORMHOLE_SPATIAL_MAX_TRAVEL_RATE, 'the clamp bounds outliers, not ordinary flight');
        assert.equal(drive.hue, 335, 'no vocal/melody: the line hue is the circle hue');
        assert.ok(drive.red > drive.blue && drive.blue > drive.green, `the stroked magenta grain colour ${drive.red},${drive.green},${drive.blue}`);
        assert.deepEqual([drive.hazeRed, drive.hazeGreen, drive.hazeBlue], [96, 108, 160], 'the identity own depth haze');
    }
    for (let i = 1; i < first.length; i++) assert.ok(first[i].travel > first[i - 1].travel, 'travel advances with song time');
    // The coherent spiral it applied: the authored turns while the grain material (which it conditions) is on, none otherwise.
    assert.ok(first.every(d => d.spiralTurns === 0), 'no grain material: no spiral');
    Object.assign(State.visualTuning, { wormholeNebulaAmount: 0.5, wormholeSpiral: 1.5 });
    const identity = new CosmicWormholeIdentity(); identity.syncPosition(4); State.currentTime = 4; identity.draw(backend(), [], []);
    assert.equal(identity.frameDrive.spiralTurns, 1.5, 'the turns the grains were drawn with');
    State.visualTuning.wormholeNebulaAmount = 0;
    identity.draw(backend(), [], []); assert.equal(identity.frameDrive.spiralTurns, 0);
});

/** Real `WormholeCanvasSource` over a recording identity whose drive is a pure function of song time. */
async function sourceHarness() {
    class FakeIdentity {
        constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.stageTimes = {}; this.frameDrive = { travel: 0, travelRate: 0, hue: 0 }; }
        setStageClock() {} setMaterialSink() {} setLineSink() {} setDepthCue() {} setDepthLayers() {} syncPosition() {}
        draw() {
            const t = this.state.currentTime;
            this.frameDrive.travel = t * 0.37; this.frameDrive.travelRate = 0.37; this.frameDrive.hue = this.state.visualTuning.circleHue;
        }
    }
    class FakeBackend {
        constructor(width, height) { this.canvas = { width, height }; this.width = width; this.height = height; this.frameCount = 0; }
        background() {}
    }
    const PRESETS = { 'cyan.json': { visualMode: 'cosmic-wormhole', visualTuning: { circleHue: 200, wormholeJitter: 0 } },
        'magenta.json': { visualMode: 'cosmic-wormhole', visualTuning: { circleHue: 330, wormholeJitter: 0.8 } } };
    const point = (id, time, preset) => ({ id, time, sectionId: id, preset, confidence: 1, intensity: 1, reason: 'section', morphDurationSec: 1.5, morphCurve: 'easeInOut' });
    const source = () => {
        const sourceLoad = createLoader({
            './CosmicWormholeIdentity': { CosmicWormholeIdentity: FakeIdentity },
            './Canvas2DRendererBackend': { Canvas2DRendererBackend: FakeBackend },
            '../config/featureFlags': { featureFlags: { semanticResolver: false, semanticChoreography: false } }
        }, { fetch: async url => ({ ok: true, json: async () => PRESETS[decodeURIComponent(url.split('/').at(-1))] }), performance: { now: () => 0 } });
        const { createEmptyTrackAnalysis } = sourceLoad('analyzer/normalizeAnalysisResult.ts');
        const { WormholeCanvasSource } = sourceLoad('visuals/WormholeCanvasSource.ts');
        const created = new WormholeCanvasSource();
        const analysis = { frames: [], events: [], trackAnalysis: createEmptyTrackAnalysis(), sampleRate: 44100, hopSize: 1024, bpm: 120,
            duration: 20, performancePlan: { points: [point('a', 0, 'cyan.json'), point('b', 4, 'magenta.json')] } };
        return { source: created, analysis };
    };
    return source;
}

test('source direction override is separate from gains and morphs with song time, including while paused', async () => {
    const make = await sourceHarness(), { source, analysis } = make();
    source.setPresentation({ spiralDirection: 'left' }); await source.prepare(analysis);
    source.render(0, false); assert.equal(source.state.visualTuning.wormholeSpiralDirection, -1);
    source.setPresentation({ spiralDirection: 'right' }); source.render(0, false);
    assert.equal(source.state.visualTuning.wormholeSpiralDirection, -1, 'a paused song has no morph delta');
    source.render(.1, true);
    assert.ok(source.state.visualTuning.wormholeSpiralDirection > -1 && source.state.visualTuning.wormholeSpiralDirection < 1);
    source.render(10, false); assert.equal(source.state.visualTuning.wormholeSpiralDirection, 1, 'discrete seek resolves the current override');
    source.setPresentation({ spiralDirection: 'auto' }); source.render(12, false);
    assert.equal(source.state.visualTuning.wormholeSpiralDirection, 1, 'legacy authored preset stays right in Auto');
    source.dispose();
});

test('in-thread source: the spatial frame describes the drawn frame, resets on prepare, and a seek reproduces it', async () => {
    const make = await sourceHarness();
    const { source, analysis } = make();
    assert.equal(source.spatialFrame, null, 'nothing drawn yet');
    await source.prepare(analysis);
    assert.equal(source.spatialFrame, null, 'prepared, not drawn');
    assert.equal(source.render(1, false), true);
    const frame = source.spatialFrame;
    assertBounded(frame, 'drawn');
    assert.equal(frame.time, 1);
    assert.ok(Math.abs(frame.travel - 0.37) < 1e-12 && frame.travelRate === 0.37 && frame.hue === 200);
    // Playing through the transition: every frame's state is resolved from that frame's morphed tuning
    // (no second morph). A slower Motion macro morphs gradually, and the spatial state with it.
    source.setPresentation({ macros: { intensity: 1, motion: 0.5, depth: 0.1, detail: 1 } });
    source.render(1, false);
    const series = [];
    for (let i = 0; i <= 150; i++) {
        source.render(1 + i / 30, true, true);
        const expected = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1 + i / 30, source.state.visualTuning, source.identity.frameDrive, source.state);
        assert.deepEqual({ ...source.spatialFrame }, { ...expected }, `frame ${i} matches its own morphed tuning`);
        series.push(source.spatialFrame.turbulence);
    }
    assert.equal(source.spatialFrame, frame, 'one record reused for every frame');
    assert.ok(series.at(-1) > 0.5 && source.spatialFrame.hue > 300, 'reached the magenta role');
    for (let i = 1; i < series.length; i++) assert.ok(Math.abs(series[i] - series[i - 1]) < 0.1, `continuous morph at ${i}: ${series[i - 1]} -> ${series[i]}`);
    // A paused frame that is skipped (steady pause) keeps the shown frame's state.
    const before = { ...source.spatialFrame };
    source.render(6.5, false); const paused = { ...source.spatialFrame };
    assert.equal(paused.time, 6.5);
    assert.equal(source.render(6.5, false), false);
    assert.deepEqual({ ...source.spatialFrame }, paused);
    assert.notDeepEqual(before, paused);
    // Seeking back to the same song time recreates the same state as a fresh seek there.
    source.render(2, false);
    const sought = { ...source.spatialFrame };
    const fresh = make(); await fresh.source.prepare(fresh.analysis);
    fresh.source.setPresentation({ macros: { intensity: 1, motion: 0.5, depth: 0.1, detail: 1 } });
    fresh.source.render(2, false);
    assert.deepEqual(sought, { ...fresh.source.spatialFrame });
    // A new preparation clears it until the next frame is drawn.
    await source.prepare(analysis);
    assert.equal(source.spatialFrame, null);
    source.dispose(); fresh.source.dispose();
});

test('the backdrop exposes the spatial frame only while its image is prepared and shown', async () => {
    const spatial = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 2, cloneDefaultVisualTuning(), drive(), calm);
    const source = { canvas: {}, focalPoint: { x: 0, y: 0 }, spatialFrame: spatial, async prepare() {}, render: () => true, dispose() {} };
    const backdrop = new WormholeBackdrop(source);
    assert.equal(backdrop.spatialFrame, null, 'not prepared yet');
    await backdrop.prepare(null);
    assert.equal(backdrop.spatialFrame, spatial, 'the source record itself (plain data, no copy)');
    backdrop.root.visible = false;
    assert.equal(backdrop.spatialFrame, null, 'hidden background -> no spatial state');
    backdrop.dispose();
    const legacy = new WormholeBackdrop({ canvas: {}, async prepare() {}, render: () => true, dispose() {} });
    await legacy.prepare(null);
    assert.equal(legacy.spatialFrame, null, 'a source without spatial state is valid (optional contract)');
    legacy.dispose();
});

test('the spatial seam stays plain data: no XR import of config or automation, no preset names in XR', () => {
    const resolver = readFileSync('src/visuals/wormholeSpatialFrame.ts', 'utf8');
    const imports = [...resolver.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
    assert.deepEqual(imports.sort(), ['../config/visualTuning', '../types', '../types/WormholeSpatialFrame'],
        'the resolver reads tuning types and the shared hue law only');
    const contract = readFileSync('src/types/WormholeSpatialFrame.ts', 'utf8');
    assert.doesNotMatch(contract, /\bfrom ['"]/, 'the contract imports nothing');
    for (const file of readdirSync('src/xr/scene')) {
        assert.doesNotMatch(readFileSync(`src/xr/scene/${file}`, 'utf8'), /vos-wh-|\.json['"]/, `${file} must not name presets`);
    }
});

test('the spatial frame carries the grain and haze colours the Wormhole drew; hue stands in when absent', () => {
    const tuning = cloneDefaultVisualTuning();
    const drawn = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1, tuning,
        drive({ hue: 205, red: 51, green: 153, blue: 255, hazeRed: 96, hazeGreen: 108, hazeBlue: 160 }), calm);
    assert.deepEqual([drawn.red, drawn.green, drawn.blue], [0.2, 0.6, 1]);
    assert.deepEqual([drawn.hazeRed, drawn.hazeGreen, drawn.hazeBlue], [96 / 255, 108 / 255, 160 / 255]);
    const { hueToRgbInto } = load('config/visualTuning.ts');
    for (const hue of [205, 335]) {
        const stand = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1, tuning, drive({ hue }), calm);
        const expected = hueToRgbInto([0, 0, 0], hue, 0.82, 0.55).map(v => v / 255);
        assert.deepEqual([stand.red, stand.green, stand.blue], expected, `the identity's line colour law at ${hue}`);
        assert.deepEqual([stand.hazeRed, stand.hazeGreen, stand.hazeBlue], expected, 'no haze shift without a haze colour');
    }
    // Blue/cyan and violet/magenta roles keep their colour family through the seam.
    const cyan = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1, tuning, drive({ hue: 205 }), calm);
    const magenta = resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1, tuning, drive({ hue: 335 }), calm);
    assert.ok(cyan.blue > cyan.red && magenta.red > magenta.green && magenta.red > cyan.red);
});

// ---------------------------------------------------------------- dramaturgy (Task 4): qualities emerge from the tuning
const roleState = over => Object.assign(cloneDefaultVisualTuning(), { lineAlpha: 5, wormholeWarp: 1, wormholeJitter: 0.2, wormholeCurve: 0,
    wormholeNebulaAmount: 0, wormholeNebulaWeave: 1, wormholeEmissionMode: 0, wormholeRing: 0, wormholeSpiral: 0.016, wormholeDepth: 0.4,
    wormholeRadius: 1, wormholeContinuity: 1, wormholeGrainDensity: 1 }, over);
const frameOf = tuning => ({ ...resolveWormholeSpatialFrame(createWormholeSpatialFrame(), 1, tuning, drive(), calm) });

test('synthetic tuning states keep the intended qualitative ordering', () => {
    const overdrive = frameOf(roleState({ wormholeWarp: 5, wormholeJitter: 1, wormholeCurve: 0.45, wormholeNebulaAmount: 0.8, wormholeEmissionMode: 1, wormholeRadius: 2.85 }));
    const drift = frameOf(roleState({ wormholeWarp: 1.6, wormholeJitter: 0.28, wormholeCurve: 0.1, wormholeNebulaAmount: 0.2, wormholeRadius: 0.75 }));
    const sparse = frameOf(roleState({ wormholeEmissionMode: 2, wormholeRadius: 2.1 }));
    const spiral = frameOf(roleState({ wormholeWarp: 5, wormholeSpiral: 0.32, wormholeCurve: 0.32, wormholeEmissionMode: 1 }));
    const straight = frameOf(roleState({ wormholeWarp: 1.2 }));
    const collapse = frameOf(roleState({ wormholeRing: 0.07, wormholeJitter: 1 }));
    const dissolve = frameOf(roleState({ wormholeWarp: 0, wormholeJitter: 0 }));
    const nebula = frameOf(roleState({ wormholeNebulaAmount: 0.4, wormholeNebulaWeave: 1 }));
    const deep = frameOf(roleState({ wormholeDepth: 0.94 })), shallow = frameOf(roleState({ wormholeDepth: 0.215 }));
    assert.ok(overdrive.turbulence > drift.turbulence && overdrive.amount > drift.amount, 'overdrive more turbulent and present than drift');
    assert.ok(sparse.density < overdrive.density && sparse.density < straight.density, 'sparse is the least occupied');
    assert.ok(sparse.radius > straight.radius, 'sparse breathes wider');
    assert.ok(nebula.wisp > straight.wisp && straight.wisp === 0, 'Nebula / Weave raise the soft-volume tendency');
    assert.ok(dissolve.amount < drift.amount && dissolve.amount >= 0.5, 'dissolve reduces presence, never to nothing');
    assert.ok(deep.depth > shallow.depth, 'galaxy-like depth reads deeper');
    for (const frame of [overdrive, drift, sparse, spiral, straight, collapse, dissolve, nebula]) assertBounded(frame, 'role');
});

test('the shipped Wormhole roles, as the XR resolves them, differ the intended way (no preset names in the resolver)', () => {
    const frames = Object.fromEntries(resolvedPresets().map(({ name, tuning }) =>
        [name.replace(/^vos-wh-|\.json$/g, ''), frameOf(tuning)]));
    const { overdrive, drift, sparse, spiral, establish, drive, collapse, dissolve, galaxy, punch } = frames;
    assert.ok(overdrive.turbulence > drift.turbulence && overdrive.amount > drift.amount);
    assert.ok(Object.values(frames).every(f => f === sparse || f.density > sparse.density), 'sparse: least occupied');
    assert.ok(Object.values(frames).every(f => f === dissolve || f.amount > dissolve.amount), 'dissolve: least present');
    assert.ok(Object.values(frames).every(f => f === galaxy || f.depth > 0 && f.depth < galaxy.depth), 'galaxy: deepest');
    assert.ok(punch.turbulence > establish.turbulence && punch.density < establish.density, 'punch: energetic, compact occupancy');
    const code = readFileSync('src/visuals/wormholeSpatialFrame.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /vos-wh|overdrive|galaxy|collapse|dissolve|establish|preset/i, 'no role or preset names in the mapping code');
});

test('the natural near/far role pairs stay apart in space: the near member wider and shallower, the far member narrower and deeper', () => {
    const frames = Object.fromEntries(resolvedPresets().map(({ name, tuning }) =>
        [name.replace(/^vos-wh-|.json$/g, ''), frameOf(tuning)]));
    // documents/features/wormhole-clip-profile.md, "Near/far geometry pairs" (near member first).
    const pairs = [['drive', 'establish'], ['collapse', 'spiral'], ['sparse', 'galaxy'], ['overdrive', 'punch'], ['dissolve', 'drift']];
    for (const [near, far] of pairs) {
        assert.ok(frames[near].depth < frames[far].depth, `${near} reads nearer than ${far}: ${frames[near].depth.toFixed(2)} vs ${frames[far].depth.toFixed(2)}`);
        assert.ok(frames[near].radius > frames[far].radius, `${near} is wider than ${far}`);
    }
    // The depth reading is the image's own projected scale (radius / depth): equal ratios, equal depth.
    const at = (radius, depth) => frameOf({ ...cloneDefaultVisualTuning(), wormholeRadius: radius, wormholeDepth: depth }).depth;
    // Fully deep at a quarter (the far roles under the XR Depth macro), fully near from 2^3.5.
    assert.ok(Math.abs(at(1, 0.5) - at(2, 1)) < 1e-12 && at(1, 4) === 1 && at(3, 0.1) === 0 && at(1, 1) > 0.5 && at(1, 1) < 0.75);
    assert.ok(at(1, 0.4) > at(1, 0.2) && at(1.5, 0.4) < at(1, 0.4), 'deeper reads deeper, wider reads nearer');
});

test('the tube spread is the identity\'s own grain projection: wall radius 50 x radius, horizon 1000 x depth, focal 1.2 heights', () => {
    const spread = (radius, depth) => frameOf({ ...cloneDefaultVisualTuning(), wormholeRadius: radius, wormholeDepth: depth }).tubeSpread;
    assert.ok(Math.abs(spread(1, 1) - 50 * 1.2 / 1000) < 1e-12);
    assert.ok(Math.abs(spread(2, 0.5) - 4 * spread(1, 1)) < 1e-12, 'proportional to radius / depth');
    assert.equal(spread(1, 0), WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE[1], 'a degenerate depth is bounded');
    // The constants mirror the identity's projection; a change there must be mirrored here.
    const identity = readFileSync('src/visuals/CosmicWormholeIdentity.ts', 'utf8');
    for (const literal of ['const Z_REFERENCE = 1000;', 'const fov = backend.height * 1.2;', 'const radius = 50 * grain.releaseRadius;']) {
        assert.ok(identity.includes(literal), literal);
    }
    const frames = Object.fromEntries(resolvedPresets().map(({ name, tuning }) => [name.replace(/^vos-wh-|\.json$/g, ''), frameOf(tuning)]));
    assert.ok(frames.galaxy.tubeSpread < frames.establish.tubeSpread && frames.sparse.tubeSpread > frames.galaxy.tubeSpread * 4,
        'a deep, narrow tunnel spreads little (its grains rush from far away), a wide, shallow one a lot');
});

test('faster authored flight travels faster through the Wormhole itself (the field inherits its rate)', () => {
    const wormhole = createLoader();
    const { CosmicWormholeIdentity } = wormhole('visuals/CosmicWormholeIdentity.ts');
    const { State } = wormhole('state/store.ts');
    const backend = () => ({ width: 960, height: 540, frameCount: 1, beginFieldRaster() { return null; }, drawFieldRaster() {},
        background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {}, line() {}, circle() {}, triangle() {},
        beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}, radialDim() {}, compositeRingTint() {} });
    State.bpm = 128; State.playbackFade = 1; State.isPlaying = true;
    const rateFor = speed => {
        Object.assign(State.visualTuning, { wormholeSpeed: speed }); Object.assign(State.targetTuning, { wormholeSpeed: speed });
        const identity = new CosmicWormholeIdentity(); identity.syncPosition(4);
        for (let i = 0; i <= 8; i++) { State.currentTime = 4 + i / 30; identity.draw(backend(), [], []); }
        return identity.frameDrive.travelRate;
    };
    const drift = rateFor(0.55), overdrive = rateFor(9);
    assert.ok(overdrive > drift * 3, `overdrive ${overdrive} vs drift ${drift} horizons/s`);
});
