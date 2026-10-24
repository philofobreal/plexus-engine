import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './xr-loader.mjs';
import { fakeDocument, findAll } from './fake-dom.mjs';
import { chartSources } from './xr-chart-sources.mjs';
import { historicalXrSettings } from './xr-historical-settings.mjs';
const settle = () => new Promise(setImmediate);
export function harness({ presenting = false, settingsStore, gpu = false, diagnostics = false, haloPreview = false } = {}) {
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
        setCockpitSettings(mode, title) { (sceneLog.cockpit ??= []).push({ mode, title }); }
        setTrackTitle(name) { (sceneLog.trackTitles ??= []).push(name); }
        resolutionObserver = { onRunReset() { (sceneLog.roleResets ??= []).push(true); },
            onNoteResolved(...args) { (sceneLog.resolutions ??= []).push(args); } };
        setNoteRolePlan(plan) { (sceneLog.rolePlans ??= []).push(plan); }
        constructor() { this.path = { revision: 0, unprojectStrike() {}, projectPlayfieldPoint() {}, unprojectPlayfieldPoint() {} }; }
        getWorldToPlayfield(m) { return m; }
        prerender() {}
        async setWormholeEnabled(v) { sceneLog.enabled.push(v); }
        async setWormholeAnalysis(a) { sceneLog.analyses.push(a); }
        setSectionTimeline(t) { sceneLog.timelines.push(t); }
        async setBackgroundSettings(b) { (sceneLog.backgrounds ??= []).push(b); }
        setDisplayFrameRate() {} get backgroundRenderMs() { return 0; } setGameConfig(c) { (sceneLog.configs ??= []).push(c); } setStageLayout(l) { (sceneLog.layouts ??= []).push(l); } setScoreOverview(o) { (sceneLog.overviews ??= []).push(o); }
        setNoteDesign(d) { (sceneLog.designs ??= []).push(d); }
        setSpiralDirection(d) { (sceneLog.spiralDirections ??= []).push(d); }
        async setBackgroundPipeline(p) { (sceneLog.pipelines ??= []).push(p); sceneLog.gpuMaterial = p.gpuMaterial; } get gpuMaterialEnabled() { return sceneLog.gpuMaterial === true; }
        setAdaptivePacing(on) { (sceneLog.pacing ??= []).push(on); }
        // Every display frame shows a new background frame (diagnostics counting).
        get backgroundFramesShown() { return (this.shown = (this.shown ?? 0) + 1); } get backgroundStageTimes() { return null; }
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
        renderer: { domElement: canvas, xr: { getReferenceSpace: () => (presenting ? referenceSpace : null), getSession: () => null },
            // A renderer that can draw the GPU grain material (half-float targets), when asked.
            ...(gpu ? { capabilities: { isWebGL2: true }, extensions: { has: () => true } } : {}) },
        setPlaying() {}, invalidate() {}, setUpdateCallback(cb) { this.callback = cb; }, isPresenting: () => presenting,
        requestImmersiveSession: async () => ({}), onSessionStart: null, onSessionEnd: null, ended: 0, endActiveSession() { this.ended++; } };
    const container = doc.createElement('div');
    const { XrAppController } = load('xr/XrAppController.ts');
    const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG } = load('gameplay/index.ts');
    const baseline = historicalXrSettings(load);
    let store = settingsStore === 'defaults' ? undefined : settingsStore ?? { load: () => baseline, save() {} };
    if (haloPreview) {
        const original = store;
        store = { load: () => { const settings = original?.load() ?? baseline;
            return { ...settings, appearance: { ...settings.appearance, noteHalos: 'phrase' } }; }, save(settings) { original?.save(settings); } };
    }
    const controller = new XrAppController(engine, runtime, container, () => ({}),
        { ...(store ? { settingsStore: store } : {}), ...(diagnostics ? { diagnostics: true } : {}) });
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
        pick(value, section = 'choreography', settingId) {
            const descriptor = XR_SETTINGS.find(d => d.section === section && (!settingId || d.id === settingId) && d.kind === 'choice' && d.choices.some(c => c.value === value));
            assert.ok(descriptor, `${section}: ${value}`);
            const next = descriptor.write(controller.settings, value), scope = changeScope(controller.settings, next);
            if (scope) controller.runMenuCommand({ type: 'settings-changed', settings: next, scope });
        }
    };
}
