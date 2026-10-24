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
import { harness } from './helpers/xr-controller-harness.mjs';

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
    // Only the plan differs: the worker proxy then posts the plan alone (`prepare-plan`), not the analysis.
    const [loaded, regenerated] = [h.sceneLog.analyses.filter(Boolean)[0], h.sceneLog.analyses.filter(Boolean).at(-1)];
    assert.notEqual(regenerated, loaded);
    for (const key of ['frames', 'events', 'trackAnalysis', 'sampleRate', 'hopSize', 'bpm', 'duration']) assert.equal(regenerated[key], loaded[key], key);
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

test('a first visit starts from the authored defaults: Wormhole Max, Ultra choreography in Tall, Hyper / Auto, Shard', async () => {
    const h = harness({ settingsStore: 'defaults' });
    const { DEFAULT_XR_SETTINGS } = createLoader()('xr/XrSettings.ts');
    assert.equal(JSON.stringify(h.controller.settings), JSON.stringify(DEFAULT_XR_SETTINGS));
    const first = h.sceneLog.backgrounds[0];
    assert.deepEqual([first.wormhole, first.quality, first.rateHz, first.lineStroke, first.sharpness], [true, 'max', 36, 0.3, 1]);
    assert.equal(h.sceneLog.enabled.at(-1), true, 'the Wormhole is switched on without a menu visit');
    assert.equal(h.sceneLog.designs.at(-1), 'shard');
    assert.deepEqual(h.sceneLog.blades, [1.1]);
    assert.equal(h.sceneLog.layouts[0].rowCount, 4, 'the Tall stage');
    await h.loadTrack();
    assert.deepEqual({ ...h.prepareCalls[0][2] }, { activityLevel: 'active', variantMode: 'expressive' });
    assert.equal(h.chart(), h.expected(DEFAULT_XR_SETTINGS.generation));
    assert.equal(h.controller.session.config.noteSpeedMps, 10, 'Hyper');
});

test('the System switches rebuild the background pipeline live, are saved and never regenerate (ADR-009 Addendum X)', async () => {
    const { DEFAULT_XR_SETTINGS } = createLoader()('xr/XrSettings.ts');
    const saved = [];
    // A stored classic System setup (diagnostics off, canvas lines, fixed pacing); the shipped defaults differ.
    const classic = { ...DEFAULT_XR_SETTINGS, system: { materialRenderer: 'gpu', diagnostics: false, grainLines: 'canvas', backgroundPacing: 'fixed' } };
    const h = harness({ gpu: true, settingsStore: { load: () => classic, save: s => saved.push(JSON.parse(JSON.stringify(s))) } });
    assert.deepEqual({ ...h.sceneLog.pipelines[0] }, { gpuMaterial: true, profile: false, gpuLines: false, softwareRaster: false, webglRaster: true },
        'GPU material, no profiling with Diagnostics off; a record without a raster choice takes the WebGL raster');
    await h.loadTrack();
    h.engine.play(0);
    const prepares = h.prepareCalls.length, chart = h.chart(), stops = h.engine.stops.length;
    const overlay = h.controller.overlay, frames = n => { for (let i = 0; i < n; i++) h.runtime.callback(null, 1 / 60); };
    frames(150);
    assert.equal(overlay.dataset.xrBackgroundStages, undefined, 'diagnostics off: nothing is measured or shown');
    assert.equal(h.controller.menuContext().diagnostics, undefined);

    h.pick('cpu', 'system'); await settle();
    assert.deepEqual({ ...h.sceneLog.pipelines.at(-1) }, { gpuMaterial: false, profile: false, gpuLines: false, softwareRaster: false, webglRaster: true });
    h.pick('on', 'system'); await settle();
    assert.deepEqual({ ...h.sceneLog.pipelines.at(-1) }, { gpuMaterial: false, profile: true, gpuLines: false, softwareRaster: false, webglRaster: true });
    frames(150);
    assert.match(overlay.dataset.xrBackgroundStages, /^Display .* fps/, 'the line after two seconds of play');
    assert.match(h.controller.menuContext().diagnostics, /CPU material/);
    h.pick('gpu', 'system'); await settle();
    frames(150);
    assert.match(h.controller.menuContext().diagnostics, /GPU material/);

    h.pick('off', 'system'); await settle();
    assert.equal(overlay.dataset.xrBackgroundStages, undefined, 'switching off clears the mirrors');
    assert.equal(h.controller.menuContext().diagnostics, undefined);
    h.pick('on', 'system'); await settle();
    assert.equal(h.controller.menuContext().diagnostics, undefined, 'no stale line when switched on again');
    assert.equal(h.controller.session.getState(), 'playing', 'presentation: playback continues');
    assert.equal(h.engine.stops.length, stops);
    assert.equal(h.prepareCalls.length, prepares); assert.equal(h.chart(), chart);
    assert.deepEqual(saved.slice(-5).map(s => [s.system.materialRenderer, s.system.diagnostics]),
        [['cpu', false], ['cpu', true], ['gpu', true], ['gpu', false], ['gpu', true]], 'every switch is saved');

    // Grain lines (Addendum AA) rebuild the pipeline too; GPU lines need the GPU material.
    const { XR_SETTINGS, changeScope } = createLoader()('xr/XrSettings.ts');
    const set = (id, value) => {
        const next = XR_SETTINGS.find(d => d.id === id).write(h.controller.settings, value);
        h.controller.runMenuCommand({ type: 'settings-changed', settings: next, scope: changeScope(h.controller.settings, next) });
    };
    set('grainLines', 'gpu'); await settle();
    assert.deepEqual({ ...h.sceneLog.pipelines.at(-1) }, { gpuMaterial: true, profile: true, gpuLines: true, softwareRaster: false, webglRaster: true });
    frames(150);
    set('materialRenderer', 'cpu'); await settle();
    assert.deepEqual({ ...h.sceneLog.pipelines.at(-1) }, { gpuMaterial: false, profile: true, gpuLines: false, softwareRaster: false, webglRaster: true }, 'no GPU lines without the GPU material');
    set('materialRenderer', 'gpu'); await settle();
    assert.equal(h.sceneLog.pipelines.at(-1).gpuLines, true, 'the choice is kept and applies again');
    // Background raster (Addendum AE) rebuilds the pipeline; the other choices stay.
    set('backgroundRaster', 'cpu'); await settle();
    assert.deepEqual({ ...h.sceneLog.pipelines.at(-1) }, { gpuMaterial: true, profile: true, gpuLines: true, softwareRaster: true, webglRaster: false });
    set('backgroundRaster', 'gpu'); await settle();
    assert.equal(h.sceneLog.pipelines.at(-1).softwareRaster, false);
    // Background raster WebGL (Addendum AF): the batched WebGL raster, rebuilt like the others.
    set('backgroundRaster', 'webgl'); await settle();
    assert.deepEqual({ ...h.sceneLog.pipelines.at(-1) }, { gpuMaterial: true, profile: true, gpuLines: true, softwareRaster: false, webglRaster: true });
    set('backgroundRaster', 'gpu'); await settle();
    assert.equal(h.sceneLog.pipelines.at(-1).webglRaster, false);
    // Background pacing (Addendum Z) applies live.
    assert.equal(h.sceneLog.pacing[0], false, 'the stored fixed pacing at startup');
    set('backgroundPacing', 'adaptive'); await settle();
    assert.equal(h.sceneLog.pacing.at(-1), true);
    set('backgroundPacing', 'fixed'); await settle();
    assert.equal(h.sceneLog.pacing.at(-1), false);
    assert.equal(h.controller.session.getState(), 'playing', 'presentation: playback continues');
    assert.equal(h.prepareCalls.length, prepares); assert.equal(h.chart(), chart);
    assert.deepEqual(saved.at(-1).system, { materialRenderer: 'gpu', diagnostics: true, grainLines: 'gpu', backgroundPacing: 'fixed',
        backgroundRaster: 'gpu' });
});

test('GPU material needs a capable renderer; ?xrDiagnostics=1 forces profiling whatever the switch says', () => {
    const plain = harness({ settingsStore: 'defaults' });
    assert.deepEqual({ ...plain.sceneLog.pipelines[0] }, { gpuMaterial: false, profile: true, gpuLines: false, softwareRaster: false, webglRaster: true },
        'no half-float targets: the CPU material raster (and no GPU lines without it); Diagnostics on and WebGL background raster by default');
    const { DEFAULT_XR_SETTINGS: defaults } = createLoader()('xr/XrSettings.ts');
    const gpuRaster = harness({ settingsStore: { load: () => ({ ...defaults, system: { ...defaults.system, backgroundRaster: 'cpu' } }), save() {} } });
    assert.equal(gpuRaster.sceneLog.pipelines[0].softwareRaster, true, 'Background raster CPU: software raster');
    const { DEFAULT_XR_SETTINGS } = createLoader()('xr/XrSettings.ts');
    const quiet = { ...DEFAULT_XR_SETTINGS, system: { ...DEFAULT_XR_SETTINGS.system, diagnostics: false } };
    const forced = harness({ settingsStore: { load: () => quiet, save() {} }, diagnostics: true });
    assert.deepEqual({ ...forced.sceneLog.pipelines[0] }, { gpuMaterial: false, profile: true, gpuLines: false, softwareRaster: false, webglRaster: true });
    assert.equal(forced.controller.settings.system.diagnostics, false, 'the stored switch is untouched');
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
    assert.equal(key('Tab').defaultPrevented, false, 'Tab stays the page focus key (the track panel is reachable)');
    assert.equal(controller.menuState.hover, null);
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

function sendCanvasPointer(h, type, x = 400, y = 300) {
    h.runtime.renderer.domElement.dispatchEvent(Object.assign(new Event(type, { cancelable: true }),
        { clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true, pointerType: 'touch' }));
}

test('native pointer events score on press using the song clock, with no delayed release strike or camera turn', async () => {
    const h = harness(); await h.loadTrack();
    const note = h.controller.session.chart.find(n => n.hand === 'left');
    assert.ok(note);
    h.controller.session.loadChart([note]);
    h.engine.play(0);
    h.engine.time = note.time;
    const { notePosition } = createLoader()('gameplay/index.ts');
    const point = new THREE.Vector3();
    notePosition(note, note.time, point, h.controller.gameConfig);
    h.runtime.camera.updateMatrixWorld(true);
    point.project(h.runtime.camera);
    const x = (point.x + 1) * 400, y = (1 - point.y) * 300;
    const turns = []; h.runtime.rotateDesktopView = (...args) => turns.push(args);
    sendCanvasPointer(h, 'pointerdown', x, y);
    assert.equal(h.controller.session.getSnapshot().hitCount, 1, 'real ray selection and shared judge run at contact');
    h.engine.time += 1;
    sendCanvasPointer(h, 'pointermove', x + 100, y + 50);
    sendCanvasPointer(h, 'pointerup', x + 100, y + 50);
    assert.equal(h.controller.session.getSnapshot().hitCount, 1);
    assert.equal(turns.length, 0);
    h.controller.dispose();
});

test('a pointer held over the menu cannot activate after Space starts play or keyboard navigation changes screen', async () => {
    const h = harness(); await h.loadTrack();
    const releases = [];
    const strike = h.controller.desktopInput.onStrike;
    h.controller.desktopInput.onStrike = (...args) => { releases.push(args); strike(...args); };
    sendCanvasPointer(h, 'pointerdown');
    h.window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'Space', key: ' ' }));
    assert.equal(h.controller.session.getState(), 'playing');
    sendCanvasPointer(h, 'pointerup'); assert.equal(releases.length, 0);
    h.window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
    sendCanvasPointer(h, 'pointerdown');
    h.window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowDown' }));
    sendCanvasPointer(h, 'pointerup'); assert.equal(releases.length, 0);
    h.controller.dispose();
});

test('halo preview is opt-in, uses the accepted chart and regenerates its sidecar under the existing generation guard', async () => {
    const ordinary = harness(); await ordinary.loadTrack();
    assert.equal(ordinary.sceneLog.rolePlans.at(-1), null);
    ordinary.controller.dispose();
    const h = harness({ haloPreview: true }); await h.loadTrack();
    const firstPlan = h.sceneLog.rolePlans.at(-1);
    assert.ok(firstPlan.roles.length > 0);
    const ids = new Set(h.controller.session.chart.map(n => n.id));
    assert.ok(firstPlan.roles.every(role => ids.has(role.noteId)));
    const first = deferred(), second = deferred(); let calls = 0;
    h.setPrepare(() => (calls++ === 0 ? first : second).promise);
    h.pick('active'); assert.equal(h.sceneLog.rolePlans.at(-1), null, 'old plan cleared before async preparation');
    h.pick('expressive');
    second.resolve(h.source.performancePlan); await settle();
    const newest = h.sceneLog.rolePlans.at(-1); assert.ok(newest.roles.length > 0);
    const publishedCount = h.sceneLog.rolePlans.length;
    first.resolve(h.source.performancePlan); await settle();
    assert.equal(h.sceneLog.rolePlans.length, publishedCount, 'stale preparation cannot restore an old sidecar');
    h.controller.dispose();
});

test('halo observer receives session resets/resolutions; failed consumer hides halos and gameplay keeps running', async () => {
    const h = harness({ haloPreview: true }); await h.loadTrack();
    h.engine.play(0);
    assert.ok(h.sceneLog.roleResets.length >= 2);
    h.controller.session.seek(10);
    assert.ok(h.sceneLog.resolutions.some(args => args[3] === true));
    h.controller.scene.resolutionObserver.onNoteResolved = () => { throw new Error('bad renderer'); };
    h.engine.time = 20;
    h.runtime.callback(null, 1 / 60);
    assert.equal(h.controller.session.getState(), 'playing');
    assert.ok(h.controller.session.getSnapshot().missCount > 0);
    assert.equal(h.sceneLog.rolePlans.at(-1), null);
    assert.match(h.drawer.errorEl.textContent, /Note halos unavailable/);
    h.controller.dispose();
});

test('new load and disposal clear role plans and detach the consumer before resources are released', async () => {
    const h = harness({ haloPreview: true }); await h.loadTrack();
    h.drawer.fileInput.files = [{ name: 'other.wav' }];
    h.drawer.fileInput.dispatchEvent(new Event('change'));
    assert.equal(h.sceneLog.rolePlans.at(-1), null, 'clear on load, before analysis');
    await h.engine.onAnalysisComplete(); await settle();
    const pending = deferred(); h.setPrepare(() => pending.promise);
    h.pick('active');
    h.controller.dispose(); h.controller.dispose();
    const events = h.sceneLog.roleResets.length, plans = h.sceneLog.rolePlans.length;
    h.controller.session.restart();
    assert.equal(h.sceneLog.roleResets.length, events, 'no notification into disposed scene');
    pending.resolve(h.source.performancePlan); await settle();
    assert.equal(h.sceneLog.rolePlans.length, plans, 'no late plan into disposed scene');
    assert.equal(h.sceneLog.rolePlans.at(-1), null); assert.ok(h.sceneLog.disposed);
});

test('Note halos is a live persisted Visuals choice with no chart/transport change and no replay of old results', async () => {
    const saved = [], store = { load: () => ({}), save: settings => saved.push(settings) };
    const h = harness({ settingsStore: store }); await h.loadTrack(); h.engine.play(0);
    const chart = h.chart(), stops = h.engine.stops.length, preparations = h.prepareCalls.length;
    const snapshot = JSON.stringify(h.controller.session.getSnapshot());
    h.pick('phrase', 'background');
    assert.ok(h.sceneLog.rolePlans.at(-1).roles.length > 0);
    assert.equal(saved.at(-1).appearance.noteHalos, 'phrase');
    assert.equal(h.chart(), chart); assert.equal(h.engine.stops.length, stops);
    assert.equal(h.prepareCalls.length, preparations);
    assert.equal(JSON.stringify(h.controller.session.getSnapshot()), snapshot);
    h.pick('classic', 'background');
    assert.equal(h.controller.settings.appearance.noteHalos, 'phrase', 'design change keeps halo choice');
    h.pick('off', 'background', 'noteHalos');
    assert.equal(h.sceneLog.rolePlans.at(-1), null);
    const resolutionCount = h.sceneLog.resolutions?.length ?? 0;
    h.controller.session.update(10);
    assert.equal(h.sceneLog.resolutions?.length ?? 0, resolutionCount, 'disabled consumer detached');
    h.pick('phrase', 'background');
    assert.equal(h.sceneLog.resolutions?.length ?? 0, resolutionCount, 'enabling does not replay old misses/hits');
    h.controller.dispose();
});

test('Material spiral direction is live and saved, independent of chart/score and halo/design choices', async () => {
    const saved = [], h = harness({ settingsStore: { load: () => ({}), save: s => saved.push(s) } });
    await h.loadTrack(); h.engine.play(0);
    const chart = h.chart(), stops = h.engine.stops.length, score = JSON.stringify(h.controller.session.getSnapshot());
    h.pick('left', 'material', 'spiralDirection');
    assert.equal(h.sceneLog.spiralDirections.at(-1), 'left');
    assert.equal(saved.at(-1).appearance.spiralDirection, 'left');
    h.pick('phrase', 'background'); h.pick('classic', 'background');
    assert.equal(h.controller.settings.appearance.spiralDirection, 'left');
    assert.equal(h.chart(), chart); assert.equal(h.engine.stops.length, stops);
    assert.equal(JSON.stringify(h.controller.session.getSnapshot()), score);
    h.pick('auto', 'material', 'spiralDirection'); assert.equal(h.sceneLog.spiralDirections.at(-1), 'auto');
    h.controller.dispose();
});

test('cockpit and filename caption are live presentation, using the selected filename without regeneration',async()=>{
 const saved=[],h=harness({settingsStore:{load:()=>({}),save:s=>saved.push(s)}});await h.loadTrack();
 assert.equal(h.sceneLog.trackTitles.at(-1),'song.wav');assert.deepEqual(h.sceneLog.cockpit.at(-1),{mode:'full',title:'scroll'});
 h.engine.play(0);const chart=h.chart(),stops=h.engine.stops.length,planCalls=h.prepareCalls.length;
 h.pick('reduced','cockpit','cockpit');h.pick('static','cockpit','cockpitTitle');
 assert.equal(h.sceneLog.cockpit.at(-1).mode,'reduced');assert.equal(h.sceneLog.cockpit.at(-1).title,'static');assert.equal(saved.at(-1).appearance.cockpitTitle,'static');
 assert.equal(h.chart(),chart);assert.equal(h.engine.stops.length,stops);assert.equal(h.prepareCalls.length,planCalls);h.controller.dispose();
});
