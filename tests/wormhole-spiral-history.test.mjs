import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({ three: THREE });
const { WormholeSpiralAutomation } = load('automation/WormholeSpiralAutomation.ts');
const { cloneDefaultVisualTuning, effectiveWormholeSpiral, applyTuningMorph, tuningMorphAmount } = load('config/visualTuning.ts');
const { AutomationPlanViewCache } = load('automation/automationPlanView.ts');
const { normalizeStoredJourney } = load('ui/mvp/journeyStorage.ts');
const { EditHistory } = load('ui/mvp/EditHistory.ts');
const { XrFrameSignal } = load('xr/scene/XrFrameSignal.ts');
const near = (a, b, e = 1e-10) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const point = (id, time, direction, preset = 'fixed.json') => ({ id, time, sectionId: 's', preset, confidence: 1,
    intensity: 1, reason: 'build', morphDurationSec: 2, morphCurve: 'linear',
    ...(direction === undefined ? {} : { spiralDirection: direction }) });
const payload = (magnitude = 2, direction = 1) => ({ visualMode: 'cosmic-wormhole', visualTuning: {
    wormholeSpiral: magnitude, wormholeSpiralDirection: direction, transitionSpeed: .005,
    wormholeNebulaAmount: .2, wormholeNebulaWeave: .5, wormholeGrainDensity: 0 } });
const plan = () => ({ version: 1, source: 'edited', points: [point('a', 0, 1), point('b', 2, -1), point('c', 5, 1)] });
const configure = (p = plan(), presets = { 'fixed.json': payload() }) => {
    const channel = new WormholeSpiralAutomation(); channel.configure(p, name => presets[name]); return channel;
};
const valueAt = (channel, time) => { const out = cloneDefaultVisualTuning(); channel.apply(time, out); return effectiveWormholeSpiral(out); };

test('absolute signed anchors reproduce continuous live morph at an exact point boundary', () => {
    const channel = configure(), current = cloneDefaultVisualTuning(), target = cloneDefaultVisualTuning();
    Object.assign(current, { wormholeSpiral: 2, wormholeSpiralDirection: 1 });
    Object.assign(target, { wormholeSpiral: 2, wormholeSpiralDirection: -1, transitionSpeed: .005, morphDurationSec: 2, morphCurveValue: 0 });
    for (let i = 1; i <= 30; i++) {
        applyTuningMorph(current, target, target.transitionSpeed, 1 / 60);
        near(valueAt(channel, 2 + i / 60), effectiveWormholeSpiral(current));
    }
    const baseStep = .005 * cloneDefaultVisualTuning().morphDurationSec / 2;
    const zeroAt = 2 + Math.log(.5) / (60 * Math.log(1 - baseStep));
    near(valueAt(channel, zeroAt), 0);
    assert.ok(valueAt(channel, zeroAt - .001) > 0 && valueAt(channel, zeroAt + .001) < 0);
});

test('24/36/60 Hz, direct seek, repeated frame and backward history sample the same signed result', () => {
    const expected = valueAt(configure(), 2.5);
    for (const fps of [24, 36, 60]) {
        const channel = configure();
        for (let frame = 0; frame <= 6 * fps; frame++) valueAt(channel, frame / fps);
        for (const time of [8, .1, 2.5, 1, 5, 2.5, 2.5]) {
            const result = valueAt(channel, time);
            if (time === 2.5) assert.equal(result, expected, `FPS/history ${fps}`);
        }
    }
});

test('interrupted transitions use the preceding curve at the exact anchor, including unequal magnitudes', () => {
    const p = plan(); p.points[1].preset = 'large.json'; p.points[2].time = 2.3;
    const channel = configure(p, { 'fixed.json': payload(), 'large.json': payload(4) });
    for (const boundary of [2, 2.3]) near(valueAt(channel, boundary - 1e-8), valueAt(channel, boundary + 1e-8), 2e-7);
    const at = cloneDefaultVisualTuning(); channel.apply(2.2, at);
    const amount = tuningMorphAmount({ morphDurationSec: 2, morphCurveValue: 0 }, .005, .2);
    near(at.wormholeSpiral, 2 + 2 * amount); near(effectiveWormholeSpiral(at), 2 - 6 * amount);
});

test('legacy plans bypass the new channel; Straight and inactive material are not switched on', () => {
    const old = { version: 1, source: 'auto', points: [point('a', 0)] };
    const untouched = cloneDefaultVisualTuning(); untouched.wormholeSpiral = .123;
    assert.equal(configure(old).apply(10, untouched), false); assert.equal(untouched.wormholeSpiral, .123);
    const zero = configure(plan(), { 'fixed.json': payload(2, 0) });
    assert.equal(valueAt(zero, 0), 0); assert.equal(valueAt(zero, 6), 0);
    const current = cloneDefaultVisualTuning(); current.wormholeNebulaAmount = 0;
    configure().apply(2.5, current); assert.equal(current.wormholeNebulaAmount, 0);
});

test('missing/replaced preset and changed host gain invalidate cached anchors without compounding', () => {
    const p = plan(), cache = {}, channel = new WormholeSpiralAutomation();
    channel.configure(p, name => cache[name]);
    assert.equal(channel.apply(3, cloneDefaultVisualTuning()), false);
    cache['fixed.json'] = payload(); channel.configure(p, name => cache[name]);
    const original = valueAt(channel, 2.5); assert.ok(original > 0 && original < 2);
    cache['fixed.json'] = payload(1); channel.configure(p, name => cache[name]); near(valueAt(channel, 2.5), original / 2);
    const boost = (raw, out) => Object.assign(out, raw, { wormholeSpiral: raw.wormholeSpiral * 2 });
    channel.configure(p, name => cache[name], 'gain2', boost); near(valueAt(channel, 2.5), original);
    channel.configure(p, name => cache[name], 'gain2', boost); near(valueAt(channel, 2.5), original);
    channel.invalidate(); assert.equal(channel.apply(3, cloneDefaultVisualTuning()), false);
});

test('direction-only edits rebuild the scaled plan view; storage and edit history retain directions', () => {
    const p = plan(), cache = new AutomationPlanViewCache();
    const first = cache.getView(p, 1, 20, () => {});
    p.points[1].spiralDirection = 1;
    const second = cache.getView(p, 1, 20, () => {});
    assert.notEqual(second, first); assert.equal(first.points[1].spiralDirection, -1); assert.equal(second.points[1].spiralDirection, 1);
    p.points[1].spiralDirection = -1;
    const stored = normalizeStoredJourney({ version: 1, plan: p, activityLevel: 'balanced', variantMode: 'paired', morphScale: 1, edited: true }, 20);
    assert.equal(stored.plan.points[1].spiralDirection, -1);
    const history = new EditHistory(300);
    const before = JSON.stringify(stored), edited = JSON.parse(before); edited.plan.points[1].spiralDirection = 1;
    const after = JSON.stringify(edited);
    history.record('journey', { key: before, data: before }, { key: after, data: after }, 'Direction');
    const restored = new EditHistory(300);
    assert.equal(restored.importArchive(history.exportArchive(), { journey: { key: after, data: after }, tuning: { key: '{}', data: '{}' } },
        (_domain, data) => ({ key: data, data })), true);
    assert.equal(JSON.parse(restored.undo().before.data).plan.points[1].spiralDirection, -1);
    assert.equal(JSON.parse(restored.redo().after.data).plan.points[1].spiralDirection, 1);
});

class FakeIdentity {
    constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.frameDrive = { travel: 0, travelRate: 0, hue: 0 }; }
    setStageClock() {} setMaterialSink() {} setLineSink() {} setDepthCue() {} setDepthLayers() {} syncPosition() {}
    draw() { this.frameDrive.spiralTurns = effectiveWormholeSpiral(this.state.visualTuning); }
}
class FakeBackend {
    constructor(w, h) { this.canvas = { width: w, height: h }; this.width = w; this.height = h; this.frameCount = 0; }
    background() {}
}
async function source() {
    const sourceLoad = createLoader({ './CosmicWormholeIdentity': { CosmicWormholeIdentity: FakeIdentity },
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: FakeBackend },
        '../config/featureFlags': { featureFlags: { semanticResolver: false, semanticChoreography: false } } },
    { fetch: async () => ({ ok: true, json: async () => payload() }), performance: { now: () => 0 } });
    const { WormholeCanvasSource } = sourceLoad('visuals/WormholeCanvasSource.ts');
    const { createEmptyTrackAnalysis } = sourceLoad('analyzer/normalizeAnalysisResult.ts');
    const result = new WormholeCanvasSource();
    result.setPresentation({ macros: { intensity: .5, motion: .5, depth: .5, detail: .5 }, grainMaterial: { wormholeSpiral: .5 }, maxFrameRateHz: 120 });
    await result.prepare({ frames: [], events: [], sampleRate: 44100, hopSize: 1024, bpm: 120, duration: 10,
        trackAnalysis: createEmptyTrackAnalysis(), performancePlan: plan() });
    return result;
}
test('real source auto path publishes identical signed carrier after live, direct seek, replay and paused sampling', async () => {
    const direct = await source(); direct.render(2.5, false); const expected = direct.spatialFrame.spiralTurns;
    for (const fps of [24, 36, 60]) {
        const live = await source(); for (let i = 0; i <= 2.5 * fps; i++) live.render(i / fps, true, true);
        near(live.spatialFrame.spiralTurns, expected);
        live.render(8, false); live.render(2.5, false); assert.equal(live.spatialFrame.spiralTurns, expected);
        live.render(.1, false); live.render(2.5, false); assert.equal(live.spatialFrame.spiralTurns, expected);
        assert.equal(live.render(2.5, false), false); assert.equal(live.spatialFrame.spiralTurns, expected);
        live.dispose();
    }
    direct.dispose();
});

test('XR display smoothing is odd in signed twist, holds on pause and forgets history on seek', () => {
    const positive = new XrFrameSignal(), negative = new XrFrameSignal();
    for (let frame = 0; frame <= 108; frame++) {
        const songTime = frame / 72, frameTime = Math.floor(frame / 2) / 36;
        const value = 1 - frameTime * 1.5;
        const a = positive.sample(songTime, frameTime, value), b = negative.sample(songTime, frameTime, -value);
        near(a, -b); near(negative.sample(songTime, frameTime, -value), b);
    }
    assert.equal(negative.sample(.1, .1, -.8), -.8, 'a backward seek uses its displayed carrier directly');
});
