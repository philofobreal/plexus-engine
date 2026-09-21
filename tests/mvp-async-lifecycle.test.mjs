import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const plan = (name) => ({ name, points: [{ id: 'shared-id', preset: `${name}.json` }] });

// Real controller and pure helpers; only audio, IO and offline planner boundaries are controlled.
function harness() {
    const state = { trackAnalysis: { name: 'A' }, duration: 60, availablePresets: [], preloadedPresets: {},
        targetTuning: {}, performancePlan: null, editedPerformancePlan: null };
    const requests = [], hashes = [], saves = [], events = [], fallbackCalls = [], presetRequests = [];
    const storage = new Map();
    const root = process.cwd();
    const stubs = new Map(Object.entries({
        'src/state/store.ts': { State: state },
        'src/audio/AudioEngine.ts': {},
        'src/export/WebMExporter.ts': {},
        'src/export/ExportCapabilityDetector.ts': {},
        'src/config/featureFlags.ts': { featureFlags: {} },
        'src/automation/generatorRouting.ts': { shouldUseVisualOs: () => true, stylePackForVisualMode: () => 'wormhole' },
        'src/automation/visualOsPlanLoader.ts': { generateVisualOsPerformancePlan: (analysis, options) => {
            const result = deferred(); requests.push({ analysis, options, ...result }); return result.promise;
        } },
        'src/automation/performancePlanGenerator.ts': { generatePerformancePlan: (...args) => {
            fallbackCalls.push(args); return plan('fallback');
        } },
        'src/ui/semanticPlanRuntime.ts': {
            computeAndPublishSemanticPlan: () => events.push('semantic'), snapshotSemanticBaseTuning: () => events.push('snapshot')
        },
        'src/state/visualTransitionState.ts': { setActiveVisualTransitionComponent: () => {} },
        'src/ui/mvp/metaTuningStorage.ts': {
            computeTrackFingerprint: analysis => { const result = deferred(); hashes.push({ analysis, ...result }); return result.promise; },
            loadMetaTuning: key => storage.get(key) ?? null,
            saveMetaTuning: (key, payload) => { saves.push({ key, payload }); return true; }
        }
    }).map(([file, value]) => [path.resolve(root, file), value]));
    const modules = new Map();
    function load(file) {
        if (stubs.has(file)) return stubs.get(file);
        if (modules.has(file)) return modules.get(file);
        const exports = {};
        modules.set(file, exports);
        const source = readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', "'/'");
        const code = ts.transpileModule(source, { compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
        } }).outputText;
        vm.runInNewContext(code, { exports, console, fetch: async url => {
            if (url.endsWith('/index.json')) return { ok: true, json: async () => ({ presets: [] }) };
            const result = deferred(); presetRequests.push({ url, ...result }); return result.promise;
        }, require: request => {
            assert.ok(request.startsWith('.'), `Unexpected dependency: ${request}`);
            return load(path.resolve(path.dirname(file), request + '.ts'));
        } }, { filename: file });
        return exports;
    }
    const { MvpVisualController } = load(path.resolve(root, 'src/ui/mvp/MvpVisualController.ts'));
    const engine = { stop() {}, async loadFile() {}, addPlaybackStateListener() {}, addPositionChangedListener() {} };
    const callbacks = Object.fromEntries(['onLoadStart', 'onProgress', 'onAnalysisComplete', 'onAnalysisError',
        'onPlaybackStateChange', 'onPositionChange', 'onPlaybackEnded', 'onPlanChanged', 'onMetaTuningRestored']
        .map(name => [name, () => events.push(name)]));
    const controller = new MvpVisualController(engine, () => false, callbacks);
    async function start(name) {
        await controller.loadFile({ name });
        state.trackAnalysis = { name };
        engine.onAnalysisComplete();
    }
    return { state, controller, engine, requests, hashes, saves, events, storage, fallbackCalls, presetRequests, start };
}

test('superseded initial plan cannot publish or mark a newer track ready', async () => {
    const h = harness();
    await h.start('A');
    const oldCallback = h.engine.onAnalysisComplete;
    await h.start('B');
    oldCallback();
    assert.equal(h.requests.length, 2, 'late analysis callback is ignored');
    h.requests[0].resolve(plan('A'));
    await flush();
    assert.equal(h.state.performancePlan, null);
    assert.equal(h.hashes.length, 0);
    assert.ok(!h.events.includes('onAnalysisComplete'));
    h.requests[1].resolve(plan('B'));
    await flush();
    assert.equal(h.hashes[0].analysis.name, 'B');
    assert.ok(!h.events.includes('onAnalysisComplete'), 'fingerprint must finish before ready');
    h.hashes[0].resolve('B-key');
    await flush();
    assert.equal(h.state.performancePlan.name, 'B');
    assert.equal(h.events.at(-1), 'onAnalysisComplete');
    assert.equal(h.events.filter(e => e === 'onPlanChanged').length, 1);
});

test('saved tuning from a superseded load cannot change the current track', async () => {
    const h = harness();
    h.storage.set('A-key', { macros: { intensity: 1 }, advancedBoosts: { wormholeGrainShape: 1 } });
    await h.start('A');
    h.requests[0].resolve(plan('A'));
    await flush();
    await h.start('B');
    h.hashes[0].resolve('A-key');
    await flush();
    assert.equal(h.controller.getMacros().intensity, 0.5);
    assert.equal(h.controller.trackFingerprint, null);
    assert.ok(!h.events.includes('onMetaTuningRestored'));
    assert.equal(h.state.performancePlan, null);
});

test('accepted saved tuning, semantic plan and journey are prepared before ready', async () => {
    const h = harness();
    h.storage.set('A-key', { macros: { intensity: 0.8 }, advancedBoosts: { wormholeGrainShape: 1 } });
    await h.start('A');
    await h.controller.regeneratePlan('active', 'stable');
    assert.equal(h.requests.length, 1, 'hidden workspace cannot supersede initial preparation');
    assert.equal(await h.controller.saveMetaTuningForTrack(), false);
    h.requests[0].resolve(plan('A'));
    await flush();
    h.hashes[0].resolve('A-key');
    await flush();
    assert.equal(h.controller.getMacros().intensity, 0.8);
    assert.equal(h.controller.getAdvancedBoosts().wormholeGrainShape, 1);
    assert.deepEqual(h.events.slice(-5), ['onMetaTuningRestored', 'semantic', 'snapshot', 'onPlanChanged', 'onAnalysisComplete']);
    assert.equal(await h.controller.saveMetaTuningForTrack(), true);
    assert.equal(h.saves[0].key, 'A-key');
});

test('reverse regeneration completion preserves the latest selected activity and variant', async () => {
    const h = harness();
    const first = h.controller.regeneratePlan('calm', 'stable');
    const second = h.controller.regeneratePlan('active', 'paired');
    h.requests[1].resolve(plan('active'));
    await second;
    h.requests[0].resolve(plan('calm'));
    await first;
    assert.equal(h.state.performancePlan.name, 'active');
    assert.equal(h.controller.getActivityLevel(), 'active');
    assert.equal(h.controller.getVariantMode(), 'paired');
    assert.equal(h.requests[0].options.activityLevel, 'calm');
    assert.equal(h.requests[1].options.activityLevel, 'active');
    assert.equal(h.events.filter(e => e === 'onPlanChanged').length, 1);
});

test('a regeneration pending when a file is replaced cannot publish', async () => {
    const h = harness();
    const pending = h.controller.regeneratePlan('active', 'paired');
    await h.start('B');
    h.requests[0].resolve(plan('old'));
    await pending;
    assert.equal(h.state.performancePlan, null);
    assert.ok(!h.events.includes('onPlanChanged'));
});

test('legacy fallback keeps the original analysis, duration and preset inputs across await', async () => {
    const h = harness();
    h.state.availablePresets = ['A.json'];
    const metadata = h.state.preloadedPresets;
    const pending = h.controller.regeneratePlan('active', 'paired');
    await h.start('B');
    h.state.duration = 120;
    h.state.availablePresets = ['B.json'];
    h.state.preloadedPresets = { B: {} };
    h.requests[0].resolve(null);
    await pending;
    assert.equal(h.fallbackCalls[0][0].name, 'A');
    assert.deepEqual(h.fallbackCalls[0][1], ['A.json']);
    assert.equal(h.fallbackCalls[0][2], 60);
    assert.equal(h.fallbackCalls[0][3].presetMetadata, metadata);
    assert.equal(h.state.performancePlan, null);
});

for (const supersede of ['load', 'regenerate']) test(`late preset with reused point id cannot apply after ${supersede}`, async () => {
    const h = harness();
    let applied = 0;
    h.controller.applyAutomationPreset = () => applied++;
    h.controller.lastTriggeredAutomationPointId = 'shared-id';
    const pending = h.controller.loadAndApplyPreset('A.json', { id: 'shared-id' });
    if (supersede === 'load') await h.start('B');
    else void h.controller.regeneratePlan('active', 'paired');
    h.controller.lastTriggeredAutomationPointId = 'shared-id';
    h.presetRequests[0].resolve({ ok: true, json: async () => ({ visualTuning: {} }) });
    await pending;
    assert.equal(applied, 0);
    assert.equal(h.controller.presetCache.size, 0);
});

test('old preset preload cannot refill the cache cleared by a new load', async () => {
    const h = harness();
    const pending = h.controller.preloadPresetsForPlan(plan('A'));
    await h.start('B');
    h.presetRequests[0].resolve({ ok: true, json: async () => ({ old: true }) });
    await pending;
    assert.equal(h.controller.presetCache.size, 0);
});

test('save snapshots tuning at invocation and refuses publication after track replacement', async () => {
    const h = harness();
    const pending = h.controller.saveMetaTuningForTrack();
    await h.start('B');
    h.hashes[0].resolve('A-key');
    assert.equal(await pending, false);
    assert.equal(h.saves.length, 0);
    assert.equal(h.controller.trackFingerprint, null);
    const accepted = harness();
    const saving = accepted.controller.saveMetaTuningForTrack();
    accepted.controller.setMacros({ intensity: 1 });
    accepted.hashes[0].resolve('A-key');
    assert.equal(await saving, true);
    assert.equal(accepted.saves[0].payload.macros.intensity, 0.5);
});

test('superseded preparation failures stay silent; current failure reports and permits retry', async () => {
    const h = harness();
    await h.start('A');
    await h.start('B');
    h.requests[0].reject(new Error('old request'));
    await flush();
    assert.ok(!h.events.includes('onAnalysisError'));
    h.requests[1].reject(new Error('current request'));
    await flush();
    assert.equal(h.events.filter(e => e === 'onAnalysisError').length, 1);
    assert.ok(!h.events.includes('onAnalysisComplete'));
    await h.start('C');
    h.requests[2].resolve(plan('C'));
    await flush();
    h.hashes[0].resolve('C-key');
    await flush();
    assert.equal(h.state.performancePlan.name, 'C');
    assert.equal(h.events.at(-1), 'onAnalysisComplete');
});

test('superseded regeneration rejection does not hide the accepted workspace', async () => {
    const h = harness();
    const first = h.controller.regeneratePlan('calm', 'stable');
    const second = h.controller.regeneratePlan('active', 'paired');
    h.requests[1].resolve(plan('active'));
    await second;
    h.requests[0].reject(new Error('superseded'));
    await first;
    assert.equal(h.state.performancePlan.name, 'active');
    assert.ok(!h.events.includes('onAnalysisError'));
});

test('a previous-plan preset requested during regeneration cannot cross publication', async () => {
    const h = harness();
    let applied = 0;
    h.controller.applyAutomationPreset = () => applied++;
    const regeneration = h.controller.regeneratePlan('active', 'paired');
    h.controller.lastTriggeredAutomationPointId = 'shared-id';
    const pendingPreset = h.controller.loadAndApplyPreset('old-plan.json', { id: 'shared-id' });
    h.requests[0].resolve(plan('new'));
    await regeneration;
    assert.equal(h.controller.lastTriggeredAutomationPointId, null);
    h.controller.lastTriggeredAutomationPointId = 'shared-id';
    h.presetRequests[0].resolve({ ok: true, json: async () => ({}) });
    await pendingPreset;
    assert.equal(applied, 0);
});
