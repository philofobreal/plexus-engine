import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createLoader } from './helpers/xr-loader.mjs';

const config = { resolution: '1080p', aspectRatio: '16:9', fps: 60, watermark: false };

test('MVP holds workspace and file replacement through the export, including a deferred confirmation', async () => {
    const exports = {}, downloads = [];
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
        exportDialog: { root: panel, setActive() {}, setStatus() {}, setProgress() {},
            blocksWorkspaceShortcuts: () => Boolean(ui.exportJob) },
        controller: {
            startExport: (_config, progress) => new Promise(resolve => { emitProgress = progress; finish = resolve; }),
            canUseHistory: () => true,
            loadFile: file => loaded.push(file)
        },
        unsavedChangesGuard: { run: action => { confirmReplacement = action; }, sync() {} },
        downloadBlob(_blob, filename) { downloads.push(filename); }
    });

    ui.handleFile('delayed');
    const job = ui.runExport(config);
    confirmReplacement();
    ui.handleFile('during export');
    emitProgress(.5);
    assert.deepEqual(loaded, []);
    assert.equal(workspace.inert, true);
    assert.equal(panel.inert, false);
    assert.equal(ui.historyBlocked(), true);

    finish(new Blob(['video']));
    await job;
    assert.deepEqual(downloads, ['plexus-visual.webm']);
    assert.equal(workspace.inert, false);
    assert.equal(priorLock.inert, true);
    assert.equal(ui.historyBlocked(), false);
    ui.handleFile('new track');
    confirmReplacement();
    assert.deepEqual(loaded, ['new track']);
    const highPrecision = ui.runExport({ ...config, format: 'mp4', mp4VideoCodec: 'vp9-10bit' });
    finish(new Blob(['10-bit video']));
    await highPrecision;
    assert.equal(downloads.at(-1), 'plexus-visual (10-bit).mp4');
});

test('MVP uses the supported renderer and locks playback history even when given old isolated settings', async () => {
    let args, selected, progress, finish;
    class Exporter {
        constructor(...values) { args = values; }
        startExport(value, onProgress) {
            selected = JSON.parse(JSON.stringify(value));
            progress = onProgress;
            return new Promise(resolve => { finish = resolve; });
        }
    }
    const load = createLoader({ '../../export/WebMExporter': { WebMExporter: Exporter } }, {
        fetch: async () => ({ ok: true, json: async () => ({ presets: [] }) })
    });
    const { State } = load('state/store.ts');
    const { MvpVisualController } = load('ui/mvp/MvpVisualController.ts');
    State.duration = 10;
    State.isPlaying = true;
    const stops = [], updates = [];
    const engine = {
        addPlaybackStateListener() {}, addPositionChangedListener() {},
        stop(reset) { stops.push(reset); State.isPlaying = false; }
    };
    const controller = new MvpVisualController(engine, () => false, {});
    controller.canSaveJourney = () => true;
    const p5 = {}, canvas = {};
    controller.setExportTarget(p5, canvas);

    const job = controller.startExport({ ...config, runtime: 'isolated-wormhole', memoryLimitMiB: 512, preflight: true },
        value => updates.push(value));
    assert.deepEqual(args, [p5, canvas, engine]);
    assert.deepEqual(selected, config);
    assert.deepEqual(stops, [false]);
    assert.equal(controller.canUseHistory(), false);
    progress(.4);
    finish(new Blob(['video']));
    assert.equal((await job).size, 5);
    progress(.9);
    assert.deepEqual(updates, [.4]);
    assert.equal(controller.canUseHistory(), true);

    const uhd = controller.startExport({ ...config, resolution: '4K', videoBitrate: 1 }, () => {});
    assert.deepEqual(selected, { ...config, resolution: '4K', preflight: true, videoBitrate: 64_000_000 });
    finish(new Blob(['uhd']));
    await uhd;

    const preciseMp4 = controller.startExport({ ...config, format: 'mp4', mp4VideoCodec: 'vp9-10bit', webmBitDepth: 10 }, () => {});
    assert.deepEqual(selected, { ...config, format: 'mp4', mp4VideoCodec: 'vp9-10bit' });
    finish(new Blob(['mp4']));
    await preciseMp4;
});

test('MVP export ignores stale mode and memory preferences and copies only current settings and cache', () => {
    const copies = [], starts = [];
    const oldSettings = new Map([['plexus.exportRuntime', 'isolated-wormhole'], ['plexus.exportMemoryLimit', '512']]);
    const reads = [];
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
    buttons = ['720p', '1080p', '4K'].map(res => Object.assign(new Element(), { dataset: { res } }));
    const load = createLoader({}, { document: { createElement: () => new Element() },
        window: { localStorage: { getItem(key) { reads.push(key); return oldSettings.get(key); } } },
        navigator: { clipboard: { async writeText(value) { copies.push(JSON.parse(value)); } } } });
    const { ExportDialog } = load('ui/mvp/ExportDialog.ts');
    const cache = { files: 0, cleanupPending: 0, scope: 'This tab' };
    const dialog = new ExportDialog({ onStart: value => starts.push(JSON.parse(JSON.stringify(value))), onStop() {}, onCancel() {},
        getCacheSummary: () => cache });
    dialog.restoreResolution('1080p');
    dialog.root.querySelector('.mvp-export-start').click();
    dialog.root.querySelector('.mvp-export-copy').click();
    assert.deepEqual(reads, []);
    assert.doesNotMatch(dialog.root.innerHTML, /Export rendering|Isolated Wormhole|Export memory limit/);
    assert.deepEqual(starts, [config]);
    assert.deepEqual(copies, [{ export: config, cache }]);

    dialog.applyCapabilityReport({ preferredBackend: 'webcodecs', canExport4K: false, warnings: ['4K disabled'] });
    dialog.restoreResolution('4K');
    assert.equal(buttons[2].disabled, true);
    assert.equal(dialog.getResolution(), '720p');
});
