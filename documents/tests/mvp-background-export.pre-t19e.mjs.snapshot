import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createLoader } from './helpers/xr-loader.mjs';

const config = { resolution: '1080p', aspectRatio: '16:9', fps: 60, runtime: 'isolated-wormhole' };
const deferred = () => {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return { promise, resolve };
};

test('MVP releases the workspace only for a minimized isolated job with a submitted frame', async () => {
    const exports = {};
    class Element { inert = false; }
    const source = ts.transpileModule(readFileSync('src/ui/mvp/MvpUI.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    vm.runInNewContext(source, { exports, require: () => ({}), HTMLElement: Element, Error,
        document: { querySelector: () => null } });
    const ui = Object.create(exports.MvpUI.prototype);
    const workspace = new Element(), panel = new Element(), priorLock = new Element();
    priorLock.inert = true;
    let emitProgress, finish, confirmReplacement;
    const loaded = [];
    Object.assign(ui, {
        exportJob: null,
        root: { children: [workspace, panel, priorLock] },
        exportDialog: { root: panel, setActive() {}, setStatus() {}, setProgress() {}, blocksWorkspaceShortcuts: () => true },
        controller: {
            startExport: (_config, progress) => new Promise(resolve => { emitProgress = progress; finish = resolve; }),
            canUseHistory: () => true,
            loadFile: file => loaded.push(file)
        },
        unsavedChangesGuard: { run: action => { confirmReplacement = action; }, sync() {} },
        downloadBlob() {}
    });

    const isolated = ui.runExport(config);
    ui.setExportMinimized(true);
    ui.handleFile('too early');
    assert.equal(confirmReplacement, undefined);
    assert.equal(workspace.inert, true);
    assert.equal(ui.historyBlocked(), true);

    emitProgress(0); // the first submitted frame displays 0%
    assert.equal(workspace.inert, false);
    assert.equal(ui.historyBlocked(), false);
    ui.handleFile('stale confirmation');
    ui.setExportMinimized(false);
    confirmReplacement();
    assert.deepEqual(loaded, []);
    assert.equal(workspace.inert, true);

    ui.setExportMinimized(true);
    ui.handleFile('new track');
    confirmReplacement();
    assert.deepEqual(loaded, ['new track']);
    assert.equal(panel.inert, false);
    finish(new Blob(['isolated']));
    await isolated;

    const compatible = ui.runExport({ ...config, runtime: undefined });
    ui.setExportMinimized(true);
    emitProgress(0);
    ui.handleFile('compatible replacement');
    assert.deepEqual(loaded, ['new track']);
    assert.equal(workspace.inert, true);
    assert.equal(ui.historyBlocked(), true);
    finish(new Blob(['compatible']));
    await compatible;
    assert.equal(workspace.inert, false);
    assert.equal(priorLock.inert, true);
});

test('isolated controller retains original PCM, analysis and visual inputs while the live track is edited and replaced', async () => {
    const prepared = deferred(), finish = deferred(), fetchedPreset = deferred();
    const preset = { visualTuning: { wormholeSpeed: .3 } };
    let disposed = 0;
    class Exporter {
        constructor(_p5, _canvas, _engine, _visual, options) { this.options = options; }
        async startExport(selected, progress) {
            if (selected.runtime !== 'isolated-wormhole') return new Blob(['compatible']);
            const runtime = await this.options.prepareRuntime(selected, new AbortController().signal);
            progress(0);
            prepared.resolve(runtime);
            await finish.promise;
            runtime.dispose();
            return new Blob(['isolated']);
        }
    }
    const load = createLoader({ '../../export/WebMExporter': { WebMExporter: Exporter } },
        { crypto: webcrypto, TextEncoder, Float32Array, AbortController, performance,
            fetch: async (url, options) => {
                if (url.endsWith('/p.json')) {
                    assert.ok(options.signal instanceof AbortSignal);
                    return { ok: true, json: () => fetchedPreset.promise };
                }
                return { ok: true, json: async () => ({ presets: [] }) };
            } });
    const { State } = load('state/store.ts');
    const { createEmptyTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
    const { MvpVisualController } = load('ui/mvp/MvpVisualController.ts');
    const makeTrack = (bpm, value) => {
        const duration = 1, sampleRate = 48000;
        const samples = new Float32Array(sampleRate).fill(value);
        const trackAnalysis = { ...createEmptyTrackAnalysis(), duration, bpm };
        return { samples, state: { bpm, duration, sampleRate, trackAnalysis },
            audio: { sampleRate, length: samples.length, numberOfChannels: 1, getChannelData: () => samples } };
    };
    const a = makeTrack(123, .25), b = makeTrack(168, -.5);
    let current = a;
    Object.assign(State, a.state, { isPlaying: true });
    State.performancePlan = { version: 1, source: 'edited', points: [{ id: 'p', time: 0, preset: 'p.json',
        sectionId: 's', confidence: 1, intensity: .5, reason: 'manual', morphDurationSec: 1, morphCurve: 'linear' }] };
    const stops = [], notifications = [];
    const engine = {
        addPlaybackStateListener() {}, addPositionChangedListener() {},
        stop(reset) { stops.push(reset); State.isPlaying = false; },
        play() { State.isPlaying = true; },
        getAudioBuffer: () => current.audio,
        async loadFile() { current = b; Object.assign(State, b.state); }
    };
    const controller = new MvpVisualController(engine, () => false, {
        onProgress() {}, onAnalysisError: message => assert.fail(message), onPlaybackEnded() {}, onPlaybackStateChange() {},
        onPositionChange() {}, onLoadStart: name => notifications.push(name)
    }, {
        factory: (snapshot, audio) => ({ snapshot, audio, dispose() { disposed++; } }),
        musicDisplay: () => ({ mode: 'spectrum', size: .3, opacity: .6 })
    });
    controller.sessions = { invalidate: () => true };
    controller.setExportTarget({}, {});
    controller.currentFileHash = 'a'.repeat(64);
    const motion = controller.macros.motion;

    const result = controller.startExport(config, () => {});
    assert.equal(controller.canUseHistory(), false);
    fetchedPreset.resolve(preset);
    const runtime = await Promise.race([prepared.promise, result.then(() => assert.fail('No isolated runtime'))]);
    assert.equal(controller.canUseHistory(), true);
    assert.equal(State.isPlaying, true);
    assert.deepEqual(stops, []);
    controller.macros.motion = 1;
    preset.visualTuning.wormholeSpeed = .8;
    State.performancePlan.points[0].time = .5;
    a.samples[0] = .9;
    await controller.loadFile(new File(['different soundtrack'], 'B.wav'));
    controller.play();

    assert.equal(State.isPlaying, true);
    assert.equal(State.bpm, 168);
    assert.deepEqual(stops, [true]);
    assert.deepEqual(notifications, ['B.wav']);
    assert.equal(runtime.snapshot.input.audioContentId, 'a'.repeat(64));
    assert.equal(runtime.snapshot.input.analysis.bpm, 123);
    assert.equal(runtime.snapshot.input.analysis.performancePlan.points[0].time, 0);
    assert.equal(runtime.snapshot.input.seed.macros.motion, motion);
    assert.equal(runtime.snapshot.input.presets['p.json'].visualTuning.wormholeSpeed, .3);
    assert.equal(runtime.audio.getChannelData(0)[0], .25);
    assert.equal(current.audio.getChannelData(0)[0], -.5);
    finish.resolve();
    await result;
    assert.equal(disposed, 1);
    assert.throws(() => runtime.audio.getChannelData(0), /unavailable/);
    assert.equal(State.isPlaying, true);
    await controller.startExport({ ...config, runtime: undefined }, () => {});
    assert.deepEqual(stops, [true, false]);
    assert.equal(State.isPlaying, false);
});

test('track replacement restores the next resolution while clipboard diagnostics retain the current job resolution', async () => {
    const copies = [];
    const resolutions = ['720p', '1080p', '4K'];
    let buttons;
    class Element extends EventTarget {
        dataset = {}; style = {}; children = new Map(); classes = new Set();
        classList = {
            add: name => this.classes.add(name), remove: name => this.classes.delete(name),
            contains: name => this.classes.has(name),
            toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
        };
        querySelector(selector) {
            if (selector === '.mvp-export-resolution button.is-active') return buttons.find(b => b.classes.has('is-active'));
            if (!this.children.has(selector)) this.children.set(selector, new Element());
            return this.children.get(selector);
        }
        querySelectorAll() { return buttons; }
        focus() {}
        click() { this.dispatchEvent(new Event('click')); }
    }
    buttons = resolutions.map(res => Object.assign(new Element(), { dataset: { res } }));
    const load = createLoader({}, { document: { createElement: () => new Element() }, window: {},
        navigator: { clipboard: { async writeText(value) { copies.push(JSON.parse(value)); } } } });
    const { ExportDialog } = load('ui/mvp/ExportDialog.ts');
    const dialog = new ExportDialog({ onStart() {}, onStop() {}, onCancel() {} }, true);
    dialog.restoreResolution('1080p');
    dialog.setActive(true, config);
    dialog.restoreResolution('4K');
    assert.equal(dialog.getResolution(), '4K');
    dialog.setProfile({ analysisId: 'original-job' });
    const copy = () => dialog.root.querySelector('.mvp-export-copy').click();
    copy();
    assert.equal(copies[0].export.resolution, '1080p');
    dialog.setActive(false);
    copy();
    assert.equal(copies[1].export.resolution, '4K');
    assert.equal(copies[1].diagnosticExport.resolution, '1080p');
    assert.equal(copies[1].diagnostics.analysisId, 'original-job');
});
