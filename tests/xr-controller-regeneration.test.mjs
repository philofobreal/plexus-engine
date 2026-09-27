// XrAppController integration: file load, generation-setting regeneration without re-analysis,
// plan reuse, stale async results, overlapping loads, immersive lock-out, plan failure and disposal.
// Runtime, scene, input and capability modules are stubbed; the drawer, gameplay session, chart
// builder, playback binding and section timeline are the real modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';

function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const settle = () => new Promise(setImmediate);

function harness({ presenting = false } = {}) {
    const doc = fakeDocument();
    const window = new EventTarget();
    const source = chartSources()['journey-128-confident'];
    const State = { events: source.events, frames: [], sampleRate: 44100, hopSize: 1024, bpm: 128, duration: source.durationSec,
        trackAnalysis: { beats: source.beats, barStarts: source.barStarts, timingConfidence: { overall: 0.9 },
            sections: [{ start: 0, end: 48, label: 'build', energy: 0.5, density: 0.5, dominantFeature: 'rhythm', avgRms: 0.1, peakRms: 0.2 },
                { start: 48, end: 96, label: 'drop', energy: 0.9, density: 0.8, dominantFeature: 'rhythm', avgRms: 0.2, peakRms: 0.3 }] } };
    const prepareCalls = [];
    let prepareImpl = async () => source.performancePlan;
    const sceneLog = { analyses: [], timelines: [], enabled: [] };
    class FakeScene {
        constructor() { this.path = { revision: 0, unprojectStrike() {} }; }
        getWorldToPlayfield(m) { return m; }
        async setWormholeEnabled(v) { sceneLog.enabled.push(v); }
        async setWormholeAnalysis(a) { sceneLog.analyses.push(a); }
        setSectionTimeline(t) { sceneLog.timelines.push(t); }
        placeForViewer() {} update() {} dispose() { sceneLog.disposed = true; }
    }
    class FakeInput { update() {} getStrikeAttempt() { return null; } resetMotion() {} pulseHaptics() {} dispose() {} }
    const load = createLoader({
        three: THREE,
        '../state/store': { State },
        '../automation/prepareWormholePerformance': { prepareWormholePerformance: (...args) => { prepareCalls.push(args); return prepareImpl(...args); } },
        './runtime/XrCapabilityDetector': { detectImmersiveVrSupport: async () => 'unsupported' },
        './runtime/XrInputAdapter': { XrInputAdapter: FakeInput },
        './runtime/XrPerformanceProfile': { applyConservativeFoveation() {}, applyTargetFrameRate: async () => {} },
        './scene/RhythmGameScene': { RhythmGameScene: FakeScene }
    }, { document: doc, window });
    const listeners = [], ended = [];
    const engine = { loads: 0, stops: [], plays: [], time: 0,
        loadFile() { this.loads++; return Promise.resolve(); },
        play(offset) { this.plays.push(offset); for (const fn of listeners) fn('play', offset ?? this.time); },
        stop(reset) { this.stops.push(reset); for (const fn of listeners) fn(reset ? 'stop' : 'pause', reset ? 0 : this.time); },
        getCurrentTime() { return this.time; },
        addPlaybackStateListener(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
        addPlaybackEndedListener(fn) { ended.push(fn); return () => ended.splice(ended.indexOf(fn), 1); } };
    const canvas = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) });
    const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: { domElement: canvas, xr: { getReferenceSpace: () => null, getSession: () => null } },
        setPlaying() {}, invalidate() {}, setUpdateCallback(cb) { this.callback = cb; }, isPresenting: () => presenting,
        requestImmersiveSession: async () => ({}), onSessionStart: null, onSessionEnd: null };
    const container = doc.createElement('div');
    const { XrAppController } = load('xr/XrAppController.ts');
    const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG } = load('gameplay/index.ts');
    const controller = new XrAppController(engine, runtime, container, () => ({}), {});
    const drawer = controller.drawer;
    const radios = () => findAll(drawer.generationFieldset, n => n.type === 'radio');
    return {
        controller, drawer, engine, State, sceneLog, prepareCalls, container, source,
        setPrepare(fn) { prepareImpl = fn; },
        chart: () => JSON.stringify(controller.session.chart),
        expected(settings, plan = source.performancePlan) {
            return JSON.stringify(buildRhythmChart({ events: source.events, durationSec: source.durationSec, beats: source.beats,
                barStarts: source.barStarts, timingConfidence: 0.9, performancePlan: plan }, DEFAULT_RHYTHM_GAME_CONFIG, settings));
        },
        async loadTrack() {
            drawer.fileInput.files = [{ name: 'song.wav' }];
            drawer.fileInput.dispatchEvent(new Event('change'));
            await engine.onAnalysisComplete();
            await settle();
        },
        pick(value) { const radio = radios().find(r => r.value === value); radio.checked = true; radio.dispatchEvent(new Event('change')); }
    };
}

test('load prepares one plan with the current settings, builds the chart and hands the section timeline to the scene', async () => {
    const h = harness();
    await h.loadTrack();
    assert.equal(h.engine.loads, 1);
    assert.equal(h.prepareCalls.length, 1);
    assert.deepEqual({ ...h.prepareCalls[0][2] }, { activityLevel: 'balanced', variantMode: 'paired' });
    assert.equal(h.chart(), h.expected({}));
    assert.equal(h.controller.session.getState(), 'ready');
    assert.equal(h.sceneLog.timelines.at(-1).map(c => c.title).join(), 'BUILD-UP,DROP');
    assert.equal(h.sceneLog.analyses.filter(Boolean).length, 1, 'the Wormhole receives the plan once');
    assert.match(h.drawer.trackTitleEl.textContent, /song/);
});

test('hand/difficulty/zone changes regenerate from the captured analysis: no re-analysis, no new plan, playback rewound', async () => {
    const h = harness(); await h.loadTrack();
    h.engine.play(0); assert.equal(h.controller.session.getState(), 'playing');
    h.pick('call-response'); await settle();
    h.pick('expert'); await settle();
    h.pick('cross'); await settle();
    assert.equal(h.engine.loads, 1, 'never reloads or re-analyzes');
    assert.equal(h.prepareCalls.length, 1, 'plan reused: Activity/Variation unchanged');
    assert.ok(h.engine.stops.includes(true), 'playback stops and rewinds');
    assert.equal(h.controller.session.getState(), 'ready');
    assert.equal(h.chart(), h.expected({ handPattern: 'call-response', difficulty: 'expert', zones: 'cross' }));
    assert.equal(h.sceneLog.analyses.filter(Boolean).length, 1, 'the Wormhole is not re-prepared');
    assert.equal(h.sceneLog.timelines.filter(t => t.length).length, 1, 'sections do not change with settings');
    assert.match(h.drawer.progressEl.textContent, /Choreography updated/);
});

test('Activity/Variation re-prepare the shared plan and the Wormhole; stale overlapping results are discarded', async () => {
    const h = harness(); await h.loadTrack();
    const first = deferred(), second = deferred();
    const plans = [first, second]; let call = 0;
    h.setPrepare(() => plans[call++].promise);
    h.pick('active'); await settle();
    h.pick('expressive'); await settle();
    assert.equal(h.prepareCalls.length, 3);
    assert.deepEqual({ ...h.prepareCalls[2][2] }, { activityLevel: 'active', variantMode: 'expressive' });
    const latestPlan = { ...h.source.performancePlan, points: h.source.performancePlan.points.slice(0, 3) };
    second.resolve(latestPlan); await settle();
    first.resolve(h.source.performancePlan); await settle();
    assert.equal(h.chart(), h.expected({ activity: 'active', variation: 'expressive' }, latestPlan), 'only the newest request applies');
    assert.equal(h.sceneLog.analyses.filter(Boolean).at(-1).performancePlan, latestPlan);
});

test('settings chosen before a track apply to the next load; changes during loading supersede it; file input locks while regenerating', async () => {
    const h = harness();
    h.pick('hard'); h.pick('macro');
    assert.equal(h.prepareCalls.length, 0, 'nothing to regenerate without a track');
    await h.loadTrack();
    assert.deepEqual({ ...h.prepareCalls[0][2] }, { activityLevel: 'macro', variantMode: 'paired' });
    assert.equal(h.chart(), h.expected({ difficulty: 'hard', activity: 'macro' }));
    // While a regeneration is pending the file input is disabled and a stray change event is ignored.
    const pending = deferred(); h.setPrepare(() => pending.promise);
    h.pick('active'); await settle();
    assert.equal(h.drawer.fileInput.disabled, true);
    h.drawer.fileInput.files = [{ name: 'next.wav' }]; h.drawer.fileInput.dispatchEvent(new Event('change'));
    assert.equal(h.engine.loads, 1);
    pending.resolve(h.source.performancePlan); await settle();
    assert.equal(h.drawer.fileInput.disabled, false);
    assert.equal(h.chart(), h.expected({ difficulty: 'hard', activity: 'active' }));

    // A setting changed while a new track's plan is still being prepared supersedes the load's plan.
    const fresh = harness();
    const loadPlan = deferred(), settingPlan = deferred(); const queue = [loadPlan, settingPlan]; let call = 0;
    fresh.setPrepare(() => queue[call++].promise);
    fresh.drawer.fileInput.files = [{ name: 'song.wav' }]; fresh.drawer.fileInput.dispatchEvent(new Event('change'));
    const analysis = fresh.engine.onAnalysisComplete(); await settle();
    fresh.pick('expressive'); await settle();
    settingPlan.resolve(fresh.source.performancePlan); await settle();
    loadPlan.resolve({ version: 1, source: 'auto', points: [] }); await analysis; await settle();
    assert.equal(fresh.chart(), fresh.expected({ variation: 'expressive' }), 'the stale load plan never overwrites the newer chart');
    assert.equal(fresh.controller.session.getState(), 'ready');
    assert.equal(fresh.sceneLog.timelines.filter(t => t.length).length, 1, 'the section callout still receives the timeline of this track');
    assert.equal(fresh.sceneLog.analyses.filter(Boolean).length, 1, 'and the Wormhole its plan');
});

test('immersive sessions lock regeneration; a failed plan falls back to basic patterns; dispose removes the chrome', async () => {
    const vr = harness({ presenting: true }); await vr.loadTrack();
    const before = vr.chart();
    vr.pick('expert'); await settle();
    assert.equal(vr.chart(), before); assert.equal(vr.engine.stops.length, 0);
    const failing = harness();
    failing.setPrepare(async () => { throw new Error('offline'); });
    await failing.loadTrack();
    assert.match(failing.drawer.progressEl.textContent, /Basic patterns/);
    assert.equal(failing.chart(), failing.expected({}, { version: 1, source: 'auto', points: [] }));
    assert.equal(failing.container.children.length, 1);
    failing.controller.dispose();
    assert.equal(failing.container.children.length, 0);
    assert.ok(failing.sceneLog.disposed);
});
