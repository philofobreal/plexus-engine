import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const plan = (name) => ({ name, points: [{ id: 'shared-id', preset: `${name}.json` }] });

// Real controller and pure helpers; only audio, IO and offline planner boundaries are controlled.
function harness({ saveSucceeds = () => true } = {}) {
    const state = { trackAnalysis: { name: 'A' }, duration: 60, availablePresets: [], preloadedPresets: {},
        targetTuning: {}, performancePlan: null, editedPerformancePlan: null };
    const requests = [], hashes = [], saves = [], events = [], fallbackCalls = [], presetRequests = [];
    const storage = new Map(), sessionSaves = [], sessions = { invalidations: 0, discards: 0, resume: null };
    const root = process.cwd();
    const stubs = new Map(Object.entries({
        'src/state/store.ts': { State: state },
        'src/ui/mvp/SessionStore.ts': { SessionStore: class {
            getSaveError() { return sessions.error ?? null; }
            invalidate() { sessions.invalidations++; }
            discard() { sessions.discards++; return true; }
            async consume() { return await sessions.resume; }
            async save(checkpoint, changes, current) {
                const result = deferred(); sessionSaves.push({ checkpoint, changes, ...result });
                return await result.promise && current();
            }
        } },
        'src/ui/mvp/audioContentHash.ts': { computeAudioContentHash: async file => file.hashPromise ?? file.hash ?? 'a'.repeat(64) },
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
            normalizeStoredMetaTuning: value => ({ ...value,
                advancedBoosts: { ...load(path.resolve(root, 'src/ui/mvp/metaTuningBoost.ts')).defaultAdvancedBoosts(), ...value.advancedBoosts } }),
            computeTrackFingerprint: analysis => { const result = deferred(); hashes.push({ analysis, ...result }); return result.promise; },
            loadMetaTuning: key => storage.get(key) ?? null,
            saveTrackChanges: (key, changes) => {
                saves.push({ key, changes, payload: { ...changes.tuning, ...(changes.journey ? { journey: changes.journey } : {}) } });
                return saveSucceeds();
            }
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
        vm.runInNewContext(code, { exports, console, crypto: webcrypto, fetch: async url => {
            if (url.endsWith('/index.json')) return { ok: true, json: async () => ({ presets: [] }) };
            const result = deferred(); presetRequests.push({ url, ...result }); return result.promise;
        }, require: request => {
            assert.ok(request.startsWith('.'), `Unexpected dependency: ${request}`);
            return load(path.resolve(path.dirname(file), request + '.ts'));
        } }, { filename: file });
        return exports;
    }
    const { MvpVisualController } = load(path.resolve(root, 'src/ui/mvp/MvpVisualController.ts'));
    const engine = { position: 0, stop() { state.isPlaying = false; }, seek(time) { this.position = time; },
        getCurrentTime() { return this.position; }, play() { state.isPlaying = true; },
        async loadFile() {}, addPlaybackStateListener() {}, addPositionChangedListener() {} };
    const callbacks = Object.fromEntries(['onLoadStart', 'onProgress', 'onAnalysisComplete', 'onAnalysisError',
        'onPlaybackStateChange', 'onPositionChange', 'onPlaybackEnded', 'onPlanChanged', 'onMetaTuningRestored']
        .map(name => [name, () => events.push(name)]));
    const controller = new MvpVisualController(engine, () => false, callbacks);
    async function start(name) {
        await controller.loadFile({ name });
        state.trackAnalysis = { name };
        engine.onAnalysisComplete();
    }
    return { state, controller, engine, callbacks, sessionSaves, sessions, requests, hashes, saves, events, storage, fallbackCalls, presetRequests, start,
        normalizeCheckpoint: load(path.resolve(root, 'src/ui/mvp/sessionCheckpoint.ts')).normalizeCheckpoint };
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
    h.state.performancePlan = plan('A');
    const pending = h.controller.saveMetaTuningForTrack();
    await h.start('B');
    h.hashes[0].resolve('A-key');
    assert.equal(await pending, false);
    assert.equal(h.saves.length, 0);
    assert.equal(h.controller.trackFingerprint, null);
    const accepted = harness();
    accepted.state.performancePlan = plan('A');
    const saving = accepted.controller.saveMetaTuningForTrack();
    accepted.controller.setMacros({ intensity: 1 });
    accepted.hashes[0].resolve('A-key');
    assert.equal(await saving, true);
    assert.equal(accepted.saves[0].payload.macros.intensity, 0.5);
});

test('saved journey is restored before ready and is independent of the generated baseline', async () => {
    const h = harness();
    const saved = { version: 1, macros: { intensity: 0.8 }, advancedBoosts: {}, journey: {
        version: 1, plan: plan('manual'), activityLevel: 'active', variantMode: 'expressive', morphScale: 1.5, edited: true
    } };
    h.storage.set('A-key', saved);
    await h.start('A'); h.requests[0].resolve(plan('generated')); await flush();
    h.hashes[0].resolve('A-key'); await flush();
    assert.equal(h.controller.getPlan().name, 'manual');
    assert.equal(h.state.performancePlan.name, 'generated');
    assert.equal(h.state.performancePlanEdited, true);
    assert.equal(h.controller.getMorphScale(), 1.5);
    assert.equal(h.controller.getActivityLevel(), 'active');
    assert.equal(h.controller.getVariantMode(), 'expressive');
    assert.equal(h.events.at(-1), 'onAnalysisComplete');
    assert.equal(h.presetRequests.at(-1).url, '/visual-tuning-presets/manual.json');
    h.controller.getPlan().points[0].preset = 'changed.json';
    assert.equal(saved.journey.plan.points[0].preset, 'manual.json');
});

test('new unsaved track resets tuning and journey settings instead of leaking the previous track', async () => {
    const h = harness();
    h.controller.setMacros({ intensity: 1 });
    h.controller.setAdvancedBoost('lineWeight', 1);
    h.controller.activityLevel = 'active'; h.controller.variantMode = 'expressive';
    h.state.automationMorphScale = 3; h.state.performancePlanEdited = true;
    await h.start('B'); h.requests[0].resolve(plan('B')); await flush();
    h.hashes[0].resolve('unsaved'); await flush();
    assert.equal(h.controller.getMacros().intensity, 0.5);
    assert.equal(h.controller.getAdvancedBoosts().lineWeight, 0.5);
    assert.equal(h.controller.getActivityLevel(), 'balanced');
    assert.equal(h.controller.getVariantMode(), 'paired');
    assert.equal(h.controller.getMorphScale(), 1);
    assert.equal(h.state.performancePlanEdited, false);
    assert.equal(h.controller.getPlan().name, 'B');
});

test('save captures an independent complete journey and refuses a pending regeneration', async () => {
    const h = harness();
    assert.equal(await h.controller.saveJourneyForTrack(), false, 'no track plan');
    h.state.editedPerformancePlan = plan('manual');
    h.state.performancePlanEdited = true; h.state.automationMorphScale = 1.5;
    h.controller.activityLevel = 'active'; h.controller.variantMode = 'expressive';
    const saving = h.controller.saveJourneyForTrack();
    h.state.editedPerformancePlan.points[0].preset = 'later.json';
    h.state.automationMorphScale = 2;
    h.hashes[0].resolve('A-key');
    assert.equal(await saving, true);
    const journey = h.saves[0].payload.journey;
    assert.equal(journey.plan.points[0].preset, 'manual.json');
    assert.equal(journey.morphScale, 1.5);
    assert.equal(journey.edited, true);
    assert.equal(journey.activityLevel, 'active');
    assert.equal(journey.variantMode, 'expressive');
    const regenerating = h.controller.regeneratePlan('macro', 'stable');
    assert.equal(await h.controller.saveJourneyForTrack(), false);
    h.requests[0].resolve(plan('new')); await regenerating;
    assert.equal(await h.controller.saveJourneyForTrack(), true);
});

async function ready(h) {
    await h.start('A');
    h.state.trackAnalysis.sections = [];
    h.state.trackAnalysis.bars = [];
    h.state.visualTuning = { audioSensitivity: 1 };
    h.requests[0].resolve({ version: 1, source: 'auto', points: [{ id: 'p', preset: 'A.json', time: 2,
        morphDurationSec: 1, intensity: 1, morphCurve: 'linear', reason: 'manual', sectionId: '', confidence: 1 }] });
    await flush(); h.hashes[0].resolve('A-key'); await flush();
}

test('morph limit follows the entire current journey above 400%, with history and saving in agreement', async () => {
    const h = harness(); await ready(h); const c = h.controller;
    h.state.duration = 120;
    const second = c.addMomentAtTime(22);
    assert.ok(second);
    const max = (22 - 2 - 0.02) / 1;
    assert.equal(c.getMaxMorphScale(), max);
    c.setMorphScale(max);
    assert.equal(c.getMorphScale(), max);
    const view = c.getAutomationPlanView();
    assert.equal(view.points[0].morphDurationSec, max);
    assert.equal(view.points[1].morphDurationSec, 2 * max);
    assert.equal(c.getPlan().points[0].morphDurationSec, 1);
    assert.equal(await c.saveJourneyForTrack(), true);
    assert.equal(h.saves.at(-1).changes.journey.morphScale, max);
    assert.equal(c.undo(), true); assert.equal(c.getMorphScale(), 1);
    assert.equal(c.redo(), true); assert.equal(c.getMorphScale(), max);
    c.moveMoment(second.id, 12);
    assert.equal(c.getMaxMorphScale(), 9.98);
    assert.equal(c.getMorphScale(), 9.98, 'the edit clamps synchronously before history records it');
    assert.equal(c.undo(), true); assert.equal(c.getMorphScale(), max);
    assert.equal(c.getPlan().points[1].time, 22);
    assert.equal(c.redo(), true); assert.equal(c.getMorphScale(), 9.98);
    assert.equal(c.getPlan().points[1].time, 12);
    assert.equal(c.getAutomationPlanView().points[1].morphDurationSec, 19.96);
    assert.equal(await c.saveJourneyForTrack(), true);
    assert.equal(h.saves.at(-1).changes.journey.morphScale, 9.98);
});

test('cached morph view obeys the track-end limit for a single point and changing duration', async () => {
    const h = harness(); await ready(h); const c = h.controller;
    c.setMorphScale(50);
    assert.equal(c.getAutomationPlanView().points[0].morphDurationSec, 50);
    const prior = c.getAutomationPlanView();
    assert.equal(c.getAutomationPlanView(), prior, 'unchanged state reuses its projection');
    h.state.duration = 12;
    assert.equal(c.getMaxMorphScale(), 9.98);
    assert.equal(c.getAutomationPlanView().points[0].morphDurationSec, 9.98);
    assert.equal(c.getMorphScale(), 9.98);
    assert.equal(c.getPlan().points[0].morphDurationSec, 1);
});

function enableSession(h) {
    h.controller.currentFile = { name: 'test.wav', size: 1024, lastModified: 12, type: 'audio/wav' };
    h.callbacks.getWorkspaceSnapshot = () => ({ position: h.engine.position, wasPlaying: h.state.isPlaying,
        fullscreen: false, selectedMomentId: 'p', timelineHidden: true, snap: true, follow: false, draw: true,
        zoom: 2, pan: 5, layers: { waveform: true, rms: false, buildup: true, automation: true, cues: false },
        drawer: 'tuning', sheetOpen: false, previewQuality: 'reduced', exportResolution: '1080p', loopPlayback: false,
        targetTuning: { ...h.state.targetTuning } });
}

test('history save captures all panels and branches, pauses transport and clears all save domains together', async () => {
    const h = harness(); await ready(h); enableSession(h);
    h.controller.updateMoment('p', { intensity: 2 });
    h.controller.setAdvancedBoost('lineWeight', 0.8);
    h.controller.setHistoryScope('all'); h.controller.undo();
    h.engine.position = 12.345; h.engine.play();
    const pending = h.controller.saveUnsavedChangesForTrack();
    assert.equal(h.state.isPlaying, false);
    assert.equal(h.sessionSaves.length, 1);
    const capture = h.sessionSaves[0];
    assert.equal(capture.checkpoint.workspace.position, 12.345);
    assert.equal(capture.checkpoint.history.future.length, 1);
    assert.equal(capture.changes.journey.plan.points[0].intensity, 2);
    assert.ok(capture.changes.tuning);
    assert.equal(await h.controller.saveSessionForTrack(), false, 'double save blocked');
    capture.resolve(true); assert.equal(await pending, true);
    assert.equal(h.controller.hasUnsavedChanges(), false);
    h.controller.redo();
    assert.equal(h.controller.getUnsavedChanges().history, true);
    await h.controller.saveMetaTuningForTrack();
    assert.equal(h.controller.getUnsavedChanges().tuning, false);
    assert.equal(h.controller.hasUnsavedChanges(), true, 'panel save cannot clear history dirty state');
    h.controller.discardSession();
    assert.equal(h.controller.hasUnsavedChanges(), false);
});

test('edits and track replacement during session save prevent successful publication and clean-state claims', async () => {
    for (const change of ['edit', 'track', 'scope', 'view', 'play']) {
        const h = harness(); await ready(h); enableSession(h);
        h.controller.updateMoment('p', { intensity: 2 });
        const pending = h.controller.saveSessionForTrack();
        if (change === 'edit') h.controller.updateMoment('p', { intensity: 3 });
        if (change === 'track') await h.controller.loadFile({ name: 'B' });
        if (change === 'scope') h.controller.setHistoryScope('all');
        if (change === 'view') h.controller.markSessionChanged();
        if (change === 'play') h.controller.play();
        h.sessionSaves[0].resolve(true);
        assert.equal(await pending, false, change);
        if (change !== 'track') assert.equal(h.controller.getUnsavedChanges().history, true);
    }
});

test('a failed workspace capture releases the save lock and permits a successful retry', async () => {
    const h = harness(); await ready(h); enableSession(h);
    h.controller.updateMoment('p', { intensity: 2 });
    const capture = h.callbacks.getWorkspaceSnapshot;
    h.callbacks.getWorkspaceSnapshot = () => { throw Error('capture failed'); };
    assert.equal(await h.controller.saveSessionForTrack(), false);
    assert.equal(h.controller.getUnsavedChanges().history, true);
    assert.equal(h.sessionSaves.length, 0);
    assert.match(h.controller.getSessionSaveError(), /capture/i);
    h.callbacks.getWorkspaceSnapshot = capture;
    const retry = h.controller.saveSessionForTrack();
    assert.equal(h.sessionSaves.length, 1, 'retry must reach persistence');
    h.sessionSaves[0].resolve(true);
    assert.equal(await retry, true);
    assert.equal(h.controller.hasUnsavedChanges(), false);
    assert.equal(h.controller.getSessionSaveError(), null);
});

test('history persistence failures reach the caller with actionable reasons and preserve dirty state', async () => {
    const messages = { 'too-large': /too large/i, 'invalid-checkpoint': /validated/i, storage: /storage/i, changed: /changed during/i };
    for (const [reason, pattern] of Object.entries(messages)) {
        const h = harness(); await ready(h); enableSession(h);
        h.controller.updateMoment('p', { intensity: 2 }); h.sessions.error = reason;
        const pending = h.controller.saveSessionForTrack(); h.sessionSaves[0].resolve(false);
        assert.equal(await pending, false);
        assert.match(h.controller.getSessionSaveError(), pattern);
        assert.equal(h.controller.getUnsavedChanges().history, true);
        assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    }
});

test('session replay waits for normal load, restores history/options/position paused, and requires a fresh save', async () => {
    const h = harness(); await ready(h); enableSession(h);
    h.controller.updateMoment('p', { intensity: 2 });
    h.controller.setHistoryScope('all'); h.controller.setAdvancedBoost('lineWeight', 0.8); h.controller.undo();
    h.engine.position = 12.345;
    const pending = h.controller.saveSessionForTrack(); h.sessionSaves[0].resolve(true); await pending;
    const checkpoint = h.normalizeCheckpoint(h.sessionSaves[0].checkpoint);
    assert.ok(checkpoint);
    let workspace;
    h.callbacks.onWorkspaceRestored = value => { workspace = value; };
    h.controller.pendingCheckpoint = checkpoint;
    await h.controller.loadFile(h.controller.currentFile);
    h.engine.onAnalysisComplete(); await flush(); h.requests[1].resolve(h.sessionSaves[0].changes.journey.plan);
    await flush(); h.hashes[1].resolve('A-key'); await flush();
    assert.equal(h.controller.getPlan().points[0].intensity, 2);
    assert.equal(h.controller.getHistoryStatus().redoCount, 1);
    assert.equal(h.controller.getHistoryStatus().scope, 'all');
    assert.equal(h.engine.position, 12.345); assert.equal(h.state.isPlaying, false);
    assert.equal(workspace.previewQuality, 'reduced');
    assert.equal(h.controller.getUnsavedChanges().history, true);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false);
    h.controller.redo(); assert.equal(h.controller.getAdvancedBoosts().lineWeight, 0.8);
    h.controller.undo(); h.controller.undo(); assert.equal(h.controller.getPlan().points[0].intensity, 1);
});

test('a delayed startup resume never replaces a manually selected track', async () => {
    const h = harness(), delayed = deferred(); h.sessions.resume = delayed.promise;
    const resuming = h.controller.resumeSession();
    await h.controller.loadFile({ name: 'manual.wav' });
    delayed.resolve({ file: { name: 'old.wav' } }); await resuming;
    assert.equal(h.controller.currentFile.name, 'manual.wav');
});

test('history attaches by content hash, accepts renames, and never attaches to an equal-descriptor different file', async () => {
    const h = harness(); await ready(h); enableSession(h);
    h.controller.updateMoment('p', { intensity: 2 });
    const pending = h.controller.saveSessionForTrack(); h.sessionSaves[0].resolve(true); await pending;
    const checkpoint = h.normalizeCheckpoint(h.sessionSaves[0].checkpoint);
    h.controller.pendingCheckpoint = checkpoint;
    const reload = async (hash, name, index) => {
        await h.controller.loadFile({ name, hash, size: 1024 }); h.engine.onAnalysisComplete();
        await flush();
        h.requests[index].resolve(JSON.parse(checkpoint.current.journey.data).generatedPlan);
        await flush(); h.hashes[index].resolve('A-key'); await flush();
    };
    await reload('b'.repeat(64), 'test.wav', 1);
    assert.equal(h.controller.getHistoryStatus().undoCount, 0);
    assert.equal(h.controller.getPlan().points[0].intensity, 1);
    assert.ok(h.controller.pendingCheckpoint, 'unmatched pending restore can still be claimed by its matching file');
    await reload('a'.repeat(64), 'renamed.wav', 2);
    assert.equal(h.controller.getHistoryStatus().undoCount, 1);
    assert.equal(h.controller.getPlan().points[0].intensity, 2);
    assert.equal(h.controller.pendingCheckpoint, null);
});

test('analysis completing before the content hash waits, and superseded hashes cannot publish', async () => {
    const h = harness(), firstHash = deferred();
    const firstLoad = h.controller.loadFile({ name: 'first.wav', hashPromise: firstHash.promise });
    h.engine.onAnalysisComplete(); await flush();
    assert.equal(h.requests.length, 0, 'plan publication waits for content identity');
    await h.controller.loadFile({ name: 'second.wav', hash: 'b'.repeat(64) });
    h.engine.onAnalysisComplete(); await flush();
    assert.equal(h.requests.length, 1);
    firstHash.resolve('a'.repeat(64)); await firstLoad; await flush();
    assert.equal(h.requests.length, 1, 'late first hash cannot start a stale plan');
    assert.equal(h.controller.currentFileHash, 'b'.repeat(64));
});

test('dirty state tracks real edits/reverts, and effect Save cannot clear it', async () => {
    const h = harness(); await ready(h);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false);
    h.controller.updateMoment('p', { intensity: 1 });
    h.controller.removeMoment('missing');
    h.controller.setMorphScale(1);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false, 'no-op edits');
    h.controller.updateMoment('p', { intensity: 2 });
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    await h.controller.saveMetaTuningForTrack();
    assert.equal(h.saves.at(-1).payload.journey, undefined);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    h.controller.updateMoment('p', { intensity: 1 });
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false, 'revert to accepted baseline');
    h.controller.setMorphScale(2);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    assert.equal(await h.controller.saveJourneyForTrack(), true);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false);
    h.controller.removeMoment('p');
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    await h.controller.saveJourneyForTrack();
    assert.equal(h.saves.at(-1).payload.journey.plan.points.length, 0);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false);
});

test('tuning uses the same dirty baseline for macros, advanced sliders, selectors and reset', async () => {
    const h = harness(); await ready(h);
    const c = h.controller;
    assert.equal(c.hasUnsavedChanges(), false);
    c.setMacros({ ...c.getMacros() });
    c.setAdvancedBoost('lineWeight', 0.5);
    c.resetAdvancedBoosts();
    assert.equal(c.hasUnsavedChanges(), false, 'no-op controls stay clean');
    c.setMacros({ ...c.getMacros(), intensity: 0.8 });
    assert.equal(c.hasUnsavedTuningChanges(), true);
    assert.equal(c.hasUnsavedJourneyChanges(), false);
    c.setMacros({ ...c.getMacros(), intensity: 0.5 });
    assert.equal(c.hasUnsavedChanges(), false, 'macro revert clears warning');
    c.setAdvancedBoost('lineWeight', 1);
    assert.equal(c.hasUnsavedTuningChanges(), true);
    c.resetAdvancedBoosts();
    assert.equal(c.hasUnsavedChanges(), false);
    c.setAdvancedBoost('wormholeGrainShape', 1);
    assert.equal(c.hasUnsavedTuningChanges(), true);
    await c.saveMetaTuningForTrack();
    assert.equal(c.hasUnsavedChanges(), false);
    c.resetAdvancedBoosts();
    assert.equal(c.hasUnsavedTuningChanges(), true, 'reset differs from saved selector');
    c.setAdvancedBoost('wormholeGrainShape', 1);
    assert.equal(c.hasUnsavedChanges(), false);
});

test('independent saves leave the other domain dirty; Save all writes both in one transaction', async () => {
    const h = harness(); await ready(h);
    const c = h.controller;
    c.setMacros({ ...c.getMacros(), intensity: 0.8 }); c.updateMoment('p', { intensity: 2 });
    await c.saveJourneyForTrack();
    assert.equal(c.hasUnsavedTuningChanges(), true);
    assert.equal(c.hasUnsavedJourneyChanges(), false);
    assert.equal(h.saves.at(-1).changes.tuning, undefined);
    c.setMorphScale(2);
    await c.saveMetaTuningForTrack();
    assert.equal(c.hasUnsavedTuningChanges(), false);
    assert.equal(c.hasUnsavedJourneyChanges(), true);
    assert.equal(h.saves.at(-1).changes.journey, undefined);
    c.setAdvancedBoost('lineWeight', 1);
    const before = h.saves.length;
    assert.equal(await c.saveUnsavedChangesForTrack(), true);
    assert.equal(h.saves.length, before + 1);
    assert.equal(h.saves.at(-1).changes.tuning.advancedBoosts.lineWeight, 1);
    assert.equal(h.saves.at(-1).changes.journey.morphScale, 2);
    assert.equal(c.hasUnsavedChanges(), false);
    await c.saveUnsavedChangesForTrack();
    assert.equal(h.saves.length, before + 1, 'clean Save all does not write');
});

test('failed Save all keeps both domains dirty, and newer tuning is protected across an awaited save', async () => {
    let succeeds = false;
    const h = harness({ saveSucceeds: () => succeeds }); await ready(h);
    const c = h.controller;
    c.setMacros({ ...c.getMacros(), motion: 0.8 }); c.setMorphScale(2);
    assert.equal(await c.saveUnsavedChangesForTrack(), false);
    assert.equal(c.hasUnsavedTuningChanges(), true);
    assert.equal(c.hasUnsavedJourneyChanges(), true);
    succeeds = true; c.trackFingerprint = null;
    const saving = c.saveUnsavedChangesForTrack();
    c.setMacros({ ...c.getMacros(), motion: 1 });
    h.hashes[1].resolve('A-key');
    assert.equal(await saving, false, 'continuation must wait for the newer edit too');
    assert.equal(h.saves.at(-1).payload.macros.motion, 0.8);
    assert.equal(c.hasUnsavedTuningChanges(), true);
    assert.equal(c.hasUnsavedJourneyChanges(), false);
    await c.saveMetaTuningForTrack();
    assert.equal(c.hasUnsavedChanges(), false);
});

test('pending tuning and Save all snapshots cannot write after track replacement', async () => {
    for (const method of ['saveMetaTuningForTrack', 'saveUnsavedChangesForTrack']) {
        const h = harness(); await ready(h);
        const c = h.controller;
        c.setAdvancedBoost('lineWeight', 1); c.setMorphScale(2); c.trackFingerprint = null;
        const saving = c[method]();
        await h.start('B'); h.hashes[1].resolve('A-key');
        assert.equal(await saving, false);
        assert.equal(h.saves.length, 0);
        h.requests[1].resolve(plan('B')); await flush(); h.hashes[2].resolve('B-key'); await flush();
        assert.equal(c.hasUnsavedChanges(), false, 'fresh track starts with a clean baseline');
    }
});

test('create, move, nudge and regeneration all protect unsaved automation', async () => {
    const h = harness(); await ready(h);
    h.controller.moveMoment('p', 4); assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    await h.controller.saveJourneyForTrack();
    h.controller.nudgeMoment('p', 1); assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    await h.controller.saveJourneyForTrack();
    assert.ok(h.controller.addMomentAtTime(20));
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    await h.controller.saveJourneyForTrack();
    const regeneration = h.controller.regeneratePlan('active', 'expressive');
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    assert.equal(h.controller.canSaveJourney(), false);
    h.requests[1].resolve(plan('regenerated')); await regeneration;
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    assert.equal(h.controller.canSaveJourney(), true);
    await h.controller.saveJourneyForTrack();
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false);
});

test('failed saves stay dirty; saving a snapshot cannot clear edits made during await', async () => {
    let succeeds = false;
    const h = harness({ saveSucceeds: () => succeeds }); await ready(h);
    h.controller.updateMoment('p', { intensity: 2 });
    assert.equal(await h.controller.saveJourneyForTrack(), false);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    succeeds = true;
    h.controller.trackFingerprint = null;
    const saving = h.controller.saveJourneyForTrack();
    h.controller.updateMoment('p', { intensity: 3 });
    h.hashes[1].resolve('A-key'); await saving;
    assert.equal(h.saves.at(-1).payload.journey.plan.points[0].intensity, 2);
    assert.equal(h.controller.hasUnsavedJourneyChanges(), true);
    await h.controller.saveJourneyForTrack();
    assert.equal(h.controller.hasUnsavedJourneyChanges(), false);
});

test('a pending automation save cannot write or mark a replacement track clean', async () => {
    const h = harness(); await ready(h);
    h.controller.updateMoment('p', { intensity: 2 });
    h.controller.trackFingerprint = null;
    const saving = h.controller.saveJourneyForTrack();
    await h.start('B');
    h.hashes[1].resolve('A-key');
    assert.equal(await saving, false);
    assert.equal(h.saves.length, 0);
    assert.equal(h.controller.trackFingerprint, null);
});

test('A to unsaved B to A restores A while a superseded saved journey never publishes', async () => {
    const h = harness();
    h.storage.set('A-key', { version: 1, macros: { intensity: 0.9 }, advancedBoosts: { wormholeGrainShape: 1 },
        journey: { version: 1, plan: plan('saved-A'), activityLevel: 'active', variantMode: 'expressive',
            morphScale: 2, edited: true } });
    await h.start('A'); h.requests[0].resolve(plan('auto-A')); await flush();
    await h.start('B');
    h.hashes[0].resolve('A-key'); await flush();
    assert.equal(h.controller.getPlan(), null, 'late A restoration cannot publish into B');
    h.requests[1].resolve(plan('auto-B')); await flush();
    h.hashes[1].resolve('B-key'); await flush();
    assert.equal(h.controller.getPlan().name, 'auto-B');
    assert.equal(h.controller.getMacros().intensity, 0.5);
    await h.start('A'); h.requests[2].resolve(plan('auto-A')); await flush();
    h.hashes[2].resolve('A-key'); await flush();
    assert.equal(h.controller.getPlan().name, 'saved-A');
    assert.equal(h.controller.getMacros().intensity, 0.9);
    assert.equal(h.controller.getAdvancedBoosts().wormholeGrainShape, 1);
    assert.equal(h.controller.getMorphScale(), 2);
    assert.equal(h.controller.getVariantMode(), 'expressive');
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

test('history restores add/edit/move/delete/morph, keeps saved baselines and creates no implicit saves', async () => {
    const h = harness(); await ready(h); const c = h.controller;
    assert.equal(c.undo(), false);
    c.updateMoment('p', {intensity:2}); await c.saveJourneyForTrack();
    assert.equal(c.hasUnsavedJourneyChanges(), false);
    assert.equal(c.undo(), true); assert.equal(c.getPlan().points[0].intensity, 1);
    assert.equal(c.hasUnsavedJourneyChanges(), true);
    assert.equal(c.redo(), true); assert.equal(c.getPlan().points[0].intensity, 2);
    assert.equal(c.hasUnsavedJourneyChanges(), false);
    c.moveMoment('p', 4); c.undo(); assert.equal(c.getPlan().points[0].time, 2);
    c.redo(); assert.equal(c.getPlan().points[0].time, 4);
    const added = c.addMomentAtTime(20); assert.ok(added);
    c.undo(); assert.equal(c.getPlan().points.length, 1);
    c.redo(); assert.equal(c.getPlan().points[1].id, added.id);
    c.removeMoment(added.id); c.undo(); assert.equal(c.getPlan().points[1].id, added.id);
    c.redo(); assert.equal(c.getPlan().points.length, 1);
    c.setMorphScale(2); c.undo(); assert.equal(c.getMorphScale(), 1);
    c.redo(); assert.equal(c.getMorphScale(), 2);
    assert.equal(h.saves.length, 1, 'history never writes localStorage');
});

test('scope switching cannot overwrite another domain and restores tuning controls through UI callback', async () => {
    const h = harness(); await ready(h); const c = h.controller;
    c.updateMoment('p', {intensity:2}); c.setAdvancedBoost('lineWeight', 1);
    c.undo(); assert.equal(c.getPlan().points[0].intensity, 1); assert.equal(c.getAdvancedBoosts().lineWeight, 1);
    c.setHistoryScope('all'); c.undo(); assert.equal(c.getAdvancedBoosts().lineWeight, 0.5);
    assert.equal(h.events.at(-1), 'onMetaTuningRestored');
    c.redo(); assert.equal(c.getAdvancedBoosts().lineWeight, 1);
    c.setHistoryScope('journey'); c.redo(); assert.equal(c.getPlan().points[0].intensity, 2);
    c.setHistoryScope('all'); await c.saveUnsavedChangesForTrack();
    c.resetAdvancedBoosts(); c.undo(); assert.equal(c.getAdvancedBoosts().lineWeight, 1);
    assert.equal(c.hasUnsavedChanges(), false);
    assert.equal(c.getHistoryStatus().scope, 'all', 'scope is not in the restored snapshot');
});

test('gestures coalesce, exact reverts/no-op edits do not fill history and save splits a gesture', async () => {
    const h = harness(); await ready(h); const c = h.controller;
    c.updateMoment('p', {intensity:1}); c.removeMoment('missing'); c.setMorphScale(1);
    assert.equal(c.getHistoryStatus().undoCount, 0);
    c.beginHistoryGesture(); c.updateMoment('p', {intensity:2}); c.updateMoment('p', {intensity:3}); c.endHistoryGesture();
    assert.equal(c.getHistoryStatus().undoCount, 1); c.undo();
    assert.equal(c.getPlan().points[0].intensity, 1); c.redo();
    c.beginHistoryGesture(); c.updateMoment('p', {intensity:2}); c.updateMoment('p', {intensity:3}); c.endHistoryGesture();
    assert.equal(c.getHistoryStatus().undoCount, 1);
    c.beginHistoryGesture(); c.updateMoment('p', {intensity:2}); await c.saveJourneyForTrack();
    c.updateMoment('p', {intensity:1}); c.undo();
    assert.equal(c.getPlan().points[0].intensity, 2); assert.equal(c.hasUnsavedChanges(), false);
});

test('regeneration is one reversible edit including baseline/options/scale, and blocks undo while pending', async () => {
    const h = harness(); await ready(h); const c = h.controller;
    c.updateMoment('p', {intensity:2}); c.setMorphScale(2);
    const originalGenerated = JSON.stringify(h.state.performancePlan);
    const pending = c.regeneratePlan('active', 'expressive');
    assert.equal(c.undo(), false);
    h.requests[1].resolve({version:1,source:'auto',points:[]}); await pending;
    // Empty planner result uses the harness fallback, still one accepted generation command.
    assert.equal(c.getHistoryStatus().undoCount, 3);
    const regenerated = JSON.stringify(c.getPlan());
    c.undo(); assert.equal(c.getPlan().points[0].intensity, 2); assert.equal(c.getMorphScale(), 2);
    assert.equal(c.getActivityLevel(), 'balanced'); assert.equal(c.getVariantMode(), 'paired');
    assert.equal(JSON.stringify(h.state.performancePlan), originalGenerated);
    c.redo(); assert.equal(JSON.stringify(c.getPlan()), regenerated);
    assert.equal(c.getActivityLevel(), 'active'); assert.equal(c.getVariantMode(), 'expressive');
    assert.equal(c.getMorphScale(), 1);
});

test('history invalidates late preset responses with reused IDs and resets on the next track', async () => {
    const h = harness(); await ready(h); const c = h.controller;
    c.updateMoment('p', {preset:'new.json'});
    let applied = 0; c.applyAutomationPreset = () => applied++;
    c.lastTriggeredAutomationPointId = 'p';
    const pending = c.loadAndApplyPreset('new.json', {id:'p'});
    const request = h.presetRequests.at(-1);
    c.undo(); c.lastTriggeredAutomationPointId = 'p';
    request.resolve({ok:true,json:async()=>({})}); await pending;
    assert.equal(applied, 0);
    c.setHistoryScope('all'); await h.start('B');
    assert.equal(c.getHistoryStatus().undoCount, 0); assert.equal(c.getHistoryStatus().redoCount, 0);
    assert.equal(c.getHistoryStatus().scope, 'all'); assert.equal(c.undo(), false);
});
