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
import { historicalXrSettings } from './helpers/xr-historical-settings.mjs';

function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const settle = () => new Promise(setImmediate);

/** `settingsStore: 'defaults'` starts from the shipped defaults; otherwise the fixed historical baseline. */
function harness({ presenting = false, settingsStore } = {}) {
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
        async setBackgroundSettings(b) { (sceneLog.backgrounds ??= []).push(b); }
        setDisplayFrameRate() {} get backgroundRenderMs() { return 0; } setGameConfig(c) { (sceneLog.configs ??= []).push(c); } setStageLayout(l) { (sceneLog.layouts ??= []).push(l); } setScoreOverview(o) { (sceneLog.overviews ??= []).push(o); }
        setNoteDesign(d) { (sceneLog.designs ??= []).push(d); }
        placeForViewer() {} update() {} dispose() { sceneLog.disposed = true; }
    }
    const inputLog = { pointerMode: [], haptics: [], lengths: {}, rays: { left: null, right: null }, thumb: { left: 0, right: 0 }, instance: null };
    class FakeInput { constructor() { inputLog.instance = this; } update() {} getStrikeAttempt() { return null; } resetMotion() {} dispose() {}
        pulseHaptics(hand) { inputLog.haptics.push(hand); }
        setBladeLength(m) { (sceneLog.blades ??= []).push(m); }
        setPointerMode(on) { inputLog.pointerMode.push(on); }
        getPointerRay(hand, target) { const ray = inputLog.rays[hand]; if (!ray) return false; target.copy(ray); return true; }
        setPointerLength(hand, m) { inputLog.lengths[hand] = m; }
        getThumbstickX(hand) { return inputLog.thumb[hand]; } }
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
    const canvas = Object.assign(new EventTarget(), { dataset: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) });
    const referenceSpace = new EventTarget();
    const runtime = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
        renderer: { domElement: canvas, xr: { getReferenceSpace: () => (presenting ? referenceSpace : null), getSession: () => null } },
        setPlaying() {}, invalidate() {}, setUpdateCallback(cb) { this.callback = cb; }, isPresenting: () => presenting,
        requestImmersiveSession: async () => ({}), onSessionStart: null, onSessionEnd: null, ended: 0, endActiveSession() { this.ended++; } };
    const container = doc.createElement('div');
    const { XrAppController } = load('xr/XrAppController.ts');
    const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG } = load('gameplay/index.ts');
    const baseline = historicalXrSettings(load);
    const store = settingsStore === 'defaults' ? undefined : settingsStore ?? { load: () => baseline, save() {} };
    const controller = new XrAppController(engine, runtime, container, () => ({}), store ? { settingsStore: store } : {});
    const drawer = controller.drawer;
    const { XR_SETTINGS, changeScope } = load('xr/XrSettings.ts');
    return {
        controller, drawer, engine, State, sceneLog, prepareCalls, container, source, runtime, inputLog, window,
        setPrepare(fn) { prepareImpl = fn; },
        chart: () => JSON.stringify(controller.session.chart),
        expected(settings, plan = source.performancePlan) {
            return JSON.stringify(buildRhythmChart({ events: source.events, durationSec: source.durationSec, beats: source.beats,
                barStarts: source.barStarts, timingConfidence: 0.9, performancePlan: plan, sectionStarts: [0, 48] }, DEFAULT_RHYTHM_GAME_CONFIG, settings));
        },
        async loadTrack() {
            drawer.fileInput.files = [{ name: 'song.wav' }];
            drawer.fileInput.dispatchEvent(new Event('change'));
            await engine.onAnalysisComplete();
            await settle();
        },
        /** Chooses a setting the way the game menu does (Addendum S): a scoped settings command. */
        pick(value, section = 'choreography') {
            const descriptor = XR_SETTINGS.find(d => d.section === section && d.kind === 'choice' && d.choices.some(c => c.value === value));
            assert.ok(descriptor, `${section}: ${value}`);
            const next = descriptor.write(controller.settings, value), scope = changeScope(controller.settings, next);
            if (scope) controller.runMenuCommand({ type: 'settings-changed', settings: next, scope });
        }
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

test('a failed plan falls back to basic patterns; dispose removes the chrome', async () => {
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

test('restored settings drive the first chart and background; every change is saved; presentation changes never regenerate', async () => {
    const saved = [];
    const restored = { generation: { difficulty: 'hard', activity: 'balanced', variation: 'paired', handPattern: 'together', handLead: 'even', zones: 'shared' },
        background: { quality: 'high', rateHz: 36, lineStroke: 0.3, sharpness: 0.5 } };
    const settingsStore = { load: () => restored, save: s => saved.push(JSON.parse(JSON.stringify(s))) };
    const h = harness({ settingsStore });
    const first = h.sceneLog.backgrounds[0];
    assert.deepEqual([first.quality, first.rateHz, first.lineStroke], ['high', 36, 0.3], 'the scene gets the restored background before any plane');
    assert.equal(Object.values(h.controller.settings.generation).slice(0, 6).join(), 'hard,balanced,paired,together,even,shared');
    await h.loadTrack();
    // A field the record lacks (here the play space) takes the /xr/ default, Tall.
    assert.equal(h.chart(), h.expected({ ...restored.generation, playSpace: 'tall' }));
    h.engine.play(0);
    const stopsBefore = h.engine.stops.length, prepares = h.prepareCalls.length, chart = h.chart();
    h.pick('performance', 'background'); await settle();
    assert.equal(h.engine.stops.length, stopsBefore, 'presentation never rewinds');
    assert.equal(h.controller.session.getState(), 'playing');
    assert.equal(h.prepareCalls.length, prepares); assert.equal(h.chart(), chart);
    assert.equal(h.sceneLog.backgrounds.at(-1).quality, 'performance');
    h.pick('expert'); await settle();
    assert.equal(h.controller.session.getState(), 'ready', 'chart scope rewinds and regenerates');
    assert.deepEqual(saved.map(s => [s.background.quality, s.generation.difficulty]), [['performance', 'hard'], ['performance', 'expert']]);
});

test('a first visit starts from the authored defaults: Wormhole on, Ultra choreography in the Tall space, Hyper / Long, Shard', async () => {
    const h = harness({ settingsStore: 'defaults' });
    const { DEFAULT_XR_SETTINGS } = createLoader()('xr/XrSettings.ts');
    assert.equal(JSON.stringify(h.controller.settings), JSON.stringify(DEFAULT_XR_SETTINGS));
    const first = h.sceneLog.backgrounds[0];
    assert.deepEqual([first.wormhole, first.quality, first.rateHz, first.lineStroke, first.sharpness], [true, 'ultra', 36, 0.34, 1]);
    assert.equal(h.sceneLog.enabled.at(-1), true, 'the Wormhole is switched on without a menu visit');
    assert.equal(h.sceneLog.designs.at(-1), 'shard');
    assert.deepEqual(h.sceneLog.blades, [1.1]);
    assert.equal(h.sceneLog.layouts[0].rowCount, 4, 'the Tall stage');
    await h.loadTrack();
    assert.deepEqual({ ...h.prepareCalls[0][2] }, { activityLevel: 'active', variantMode: 'expressive' });
    assert.equal(h.chart(), h.expected(DEFAULT_XR_SETTINGS.generation));
    assert.equal(h.controller.session.config.noteSpeedMps, 10, 'Hyper');
});

test('note speed and saber length rewind without regenerating: same chart, new stage, blade and judging', async () => {
    const h = harness();
    const { resolvePlayProfile } = createLoader()('xr/XrPlayProfile.ts');
    assert.equal(h.sceneLog.layouts[0].playfieldForwardMeters, resolvePlayProfile({ noteSpeed: 'normal', saberLength: 'normal' }).stage.playfieldForwardMeters,
        'the derived stage applies at startup');
    assert.deepEqual(h.sceneLog.blades, [1]);
    await h.loadTrack();
    const chart = h.chart(), prepares = h.prepareCalls.length;
    h.engine.play(0);
    const pickPlay = value => h.pick(value, 'gameplay');
    pickPlay('fast'); await settle();
    assert.ok(h.engine.stops.includes(true), 'playback rewinds');
    assert.equal(h.controller.session.getState(), 'ready');
    assert.equal(h.chart(), chart, 'the chart is not regenerated');
    assert.equal(h.prepareCalls.length, prepares);
    assert.equal(h.sceneLog.configs.at(-1).noteSpeedMps, 7);
    assert.equal(h.sceneLog.layouts.at(-1).runwayFrontZMeters, -16);
    pickPlay('long'); await settle();
    assert.equal(h.sceneLog.blades.at(-1), 1.1);
    assert.equal(h.controller.session.config.noteSpeedMps, 7, 'the session judges with the new configuration');
});

test('Play space regenerates the chart and reshapes the stage, rows and Auto saber together', async () => {
    const h = harness(); await h.loadTrack();
    const prepares = h.prepareCalls.length;
    h.engine.play(0);
    const pickPlay = value => h.pick(value, 'gameplay');
    pickPlay('auto'); await settle();
    assert.equal(h.sceneLog.blades.at(-1), 1, 'Auto is the Normal blade in the Standard space');
    pickPlay('tall'); await settle();
    assert.equal(h.chart(), h.expected({ playSpace: 'tall' }), 'the chart is regenerated with the overhead row');
    assert.equal(h.prepareCalls.length, prepares, 'the shared plan is reused');
    assert.ok(h.engine.stops.includes(true));
    assert.equal(h.controller.session.getState(), 'ready');
    assert.equal(h.sceneLog.layouts.at(-1).rowCount, 4);
    assert.equal(h.sceneLog.layouts.at(-1).hudPlacement, 'side');
    assert.equal(h.sceneLog.configs.at(-1).rowSpacingMeters, 0.4);
    assert.equal(h.controller.session.config.rowSpacingMeters, 0.4, 'the session judges the taller rows');
    assert.equal(h.sceneLog.blades.at(-1), 1.1, 'Auto lengthens the blade in the Tall space');
});

test('the published sections weight the score of the loaded chart; regeneration keeps them', async () => {
    const h = harness(); await h.loadTrack();
    const plan = () => h.controller.session.getScoringPlan();
    assert.deepEqual(plan().sections.map(s => s.label), ['build', 'drop']);
    assert.ok(plan().bonuses);
    assert.ok(plan().sections[1].weight > plan().sections[0].weight, 'the drop outweighs the build');
    assert.equal(plan().noteSection.length, h.controller.session.getSnapshot().totalNotes);
    h.pick('expert'); await settle();
    assert.deepEqual(plan().sections.map(s => s.label), ['build', 'drop']);
});

test('in VR the menu runs the game: start, grip pause, settings with tabs and a regenerating change, back, exit', async () => {
    const h = harness({ presenting: true }); await h.loadTrack();
    const { controller, runtime, inputLog, engine } = h;
    const pose = { transform: { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } };
    const frame = { getViewerPose: () => pose };
    const tick = () => runtime.callback(frame, 1 / 72);
    const panel = controller.menuPanel;
    /** Points the right controller at the centre of a menu item. */
    const aim = id => {
        tick(); // the panel shows the current screen before we point at it
        const target = panel.layout.items.find(i => i.id === id);
        assert.ok(target, `${id} is on screen`);
        const { width, height } = panel.mesh.geometry.parameters;
        const point = panel.mesh.localToWorld(new THREE.Vector3(((target.x + target.w / 2) / 1024 - 0.5) * width,
            (0.5 - (target.y + target.h / 2) / 704) * height, 0));
        const origin = new THREE.Vector3(0.2, 1.3, -0.2);
        inputLog.rays.right = new THREE.Ray(origin, point.clone().sub(origin).normalize());
        tick();
    };
    const choose = id => { aim(id); inputLog.instance.onTriggerPress('right'); };
    runtime.onSessionStart();
    tick();
    assert.ok(panel.visible, 'the menu opens on entering VR');
    assert.equal(inputLog.pointerMode.at(-1), true, 'lasers replace the sabers');
    assert.ok(Math.abs(panel.root.position.z + 1.3) < 1e-9 && Math.abs(panel.root.position.y - 1.48) < 1e-9, 'in front of the eyes');
    aim('action:start');
    assert.equal(controller.menuState.hover, 'action:start');
    assert.ok(Number.isFinite(inputLog.lengths.right) && inputLog.lengths.right < 2, 'the laser ends on the panel');
    assert.ok(inputLog.haptics.includes('right'), 'hover ticks the controller');
    inputLog.instance.onTriggerPress('right');
    assert.equal(controller.session.getState(), 'playing'); assert.ok(engine.plays.includes(0));
    assert.equal(panel.visible, false); assert.equal(inputLog.pointerMode.at(-1), false, 'sabers are back');
    inputLog.instance.onPausePress();
    assert.equal(controller.session.getState(), 'paused');
    assert.ok(panel.visible); assert.equal(controller.menuState.screen, 'pause');
    choose('action:settings');
    assert.equal(controller.menuState.screen, 'settings'); assert.equal(controller.menuState.tab, 'gameplay');
    inputLog.thumb.left = 0.9; tick(); tick();
    assert.equal(controller.menuState.tab, 'choreography', 'one flick, one tab');
    inputLog.thumb.left = 0; tick();
    const prepares = h.prepareCalls.length;
    choose('opt:difficulty:ultra'); await settle(); tick();
    assert.equal(h.chart(), h.expected({ difficulty: 'ultra' }), 'the chart regenerates inside VR');
    assert.equal(h.prepareCalls.length, prepares, 'from the captured analysis and plan');
    assert.equal(controller.session.getState(), 'ready', 'the song rewound');
    assert.equal(h.controller.settings.generation.difficulty, 'ultra', 'one settings state');
    assert.equal(controller.menuState.screen, 'settings', 'the player stays in Settings');
    choose('action:back');
    assert.equal(controller.menuState.screen, 'main', 'Back lands on the screen the session implies');
    inputLog.rays.right = null; tick();
    assert.equal(controller.menuState.hover, null);
    inputLog.instance.onTriggerPress('right');
    assert.equal(controller.session.getState(), 'ready', 'a trigger pointing at nothing does nothing');
    choose('action:exit');
    assert.equal(runtime.ended, 1);
    runtime.onSessionEnd();
    assert.ok(panel.visible, 'back on the desktop the game menu returns in the canvas');
});

test('the song end opens Results in VR and in the desktop canvas menu', async () => {
    const vr = harness({ presenting: true }); await vr.loadTrack();
    vr.runtime.onSessionStart();
    vr.controller.session.start(); vr.engine.play(0);
    assert.equal(vr.controller.menuPanel.visible, false);
    vr.controller.session.finish(); vr.controller.handleTransportChanged();
    assert.equal(vr.controller.menuState.screen, 'results');
    vr.runtime.callback({ getViewerPose: () => null }, 1 / 72);
    assert.ok(vr.controller.menuPanel.layout.items.some(i => i.id === 'action:restart'));
    const desk = harness(); await desk.loadTrack();
    desk.engine.play(0);
    assert.equal(desk.controller.menuPanel.visible, false, 'playing closes the canvas menu');
    desk.controller.session.finish(); desk.controller.handleTransportChanged();
    assert.equal(desk.controller.menuState.screen, 'results', 'the desktop canvas menu shows the results');
    assert.ok(desk.controller.menuPanel.visible);
});

test('on the desktop the game menu lives in the canvas: Escape, the gear button, keyboard and mouse run it', async () => {
    const h = harness(); await h.loadTrack();
    const { controller, engine } = h;
    const panel = controller.menuPanel;
    const key = name => { const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name }); h.window.dispatchEvent(event); return event; };
    h.runtime.callback(null, 1 / 60);
    assert.ok(panel.visible, 'the title screen is up after loading');
    assert.equal(controller.menuState.screen, 'main');
    assert.equal(panel.layout.items.some(i => i.id === 'action:exit'), false, 'no Exit VR on the desktop');
    engine.play(0);
    assert.equal(controller.session.getState(), 'playing'); assert.equal(panel.visible, false, 'playing closes the menu');
    assert.ok(key('Escape').defaultPrevented);
    assert.equal(controller.session.getState(), 'paused', 'Escape pauses'); assert.ok(panel.visible); assert.equal(controller.menuState.screen, 'pause');
    key('ArrowDown');
    assert.equal(controller.menuState.hover, 'action:resume', 'the first key focuses the primary action');
    key('Enter');
    assert.equal(controller.session.getState(), 'playing', 'Enter chooses Resume'); assert.equal(panel.visible, false);
    key('Escape'); key('Escape');
    assert.equal(controller.session.getState(), 'playing', 'Escape on Pause resumes');
    h.drawer.gameMenuButton.blur = () => {};
    h.drawer.gameMenuButton.click();
    assert.equal(controller.session.getState(), 'paused', 'the gear button pauses and opens the menu');
    assert.equal(h.drawer.gameMenuButton.getAttribute('aria-expanded'), 'true');
    // Mouse: project the Settings button's centre to the canvas and click it.
    h.runtime.callback(null, 1 / 60);
    const target = panel.layout.items.find(i => i.id === 'action:settings');
    const { width, height } = panel.mesh.geometry.parameters;
    const world = panel.mesh.localToWorld(new THREE.Vector3(((target.x + target.w / 2) / 1024 - 0.5) * width, (0.5 - (target.y + target.h / 2) / 704) * height, 0));
    const ndc = world.project(h.runtime.camera);
    controller.desktopInput.onPointerMove(ndc.x, ndc.y);
    h.runtime.callback(null, 1 / 60);
    assert.equal(controller.menuState.hover, 'action:settings', 'the mouse hovers what it points at');
    controller.desktopInput.onStrike('left', ndc.x, ndc.y);
    assert.equal(controller.menuState.screen, 'settings', 'a click chooses it');
    key('Escape');
    assert.equal(controller.menuState.screen, 'pause', 'Escape goes back from Settings');
    const strikes = controller.session.getSnapshot().hitCount;
    controller.desktopInput.onStrike('right', 0, 0);
    assert.equal(controller.session.getSnapshot().hitCount, strikes, 'clicks never cut while the menu is open');
});
