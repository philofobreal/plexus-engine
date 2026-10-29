import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const config = () => ({ resolution: '720p', aspectRatio: '16:9', fps: 60 });
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
    for (let i = 0; i < 200 && !predicate(); i++) await flush();
    assert.ok(predicate(), 'Expected boundary was not reached');
}

function coordinator() {
    const detection = deferred(), completion = deferred();
    let starts = 0, stops = 0, cancels = 0, captured, progress;
    const backend = {
        start(c, p) { starts++; captured = c; progress = p; return completion.promise; },
        stopAndSave() { stops++; }, cancelExport() { cancels++; }
    };
    const load = createLoader({
        './ExportCapabilityDetector': { ExportCapabilityDetector: { detectCapabilities: () => detection.promise } },
        './ExportBackendRegistry': { ExportBackendRegistry: { getPreferred: () => backend } },
        './WebCodecsBackend': {}
    });
    const { WebMExporter } = load('export/WebMExporter.ts');
    return { exporter: new WebMExporter({}, {}, {}), detection, completion,
        get starts() { return starts; }, get stops() { return stops; }, get cancels() { return cancels; },
        get captured() { return captured; }, get progress() { return progress; } };
}

test('export reserves the slot before capability detection, releases failed preparation', async () => {
    const h = coordinator();
    const result = h.exporter.startExport(config(), () => {});
    await assert.rejects(h.exporter.startExport(config(), () => {}), /already running/);
    h.detection.reject(new Error('capability failure'));
    await assert.rejects(result, /capability failure/);
    await assert.rejects(h.exporter.startExport(config(), () => {}), /capability failure/);
});

test('Cancel during preparation is latched and keeps the slot until preparation settles', async () => {
    const h = coordinator();
    const result = h.exporter.startExport(config(), () => assert.fail('cancelled progress'));
    h.exporter.cancelExport(); h.exporter.cancelExport();
    await assert.rejects(h.exporter.startExport(config(), () => {}), /already running/);
    h.detection.resolve({});
    await assert.rejects(result, /cancelled/);
    assert.equal(h.starts, 0);
});

test('Stop during preparation reports an empty prefix instead of starting a full export', async () => {
    const h = coordinator();
    const result = h.exporter.startExport(config(), () => {});
    h.exporter.stopAndSave(); h.exporter.stopAndSave(); h.detection.resolve({});
    await assert.rejects(result, /No video frames/);
    assert.equal(h.starts, 0);
});

test('Cancel overrides Stop during preparation', async () => {
    const h = coordinator(); const result = h.exporter.startExport(config(), () => {});
    h.exporter.stopAndSave(); h.exporter.cancelExport(); h.detection.resolve({});
    await assert.rejects(result, /cancelled/);
});

test('export captures output settings before awaiting capabilities', async () => {
    const h = coordinator(), c = config();
    const result = h.exporter.startExport(c, () => {});
    c.fps = 24; c.watermark = true; h.detection.resolve({});
    await until(() => h.starts === 1);
    assert.equal(h.captured.fps, 60); assert.equal(h.captured.watermark, undefined);
    h.completion.resolve(new Blob(['video'])); await result;
});

test('Cancel retains the running backend until settlement and suppresses queued progress/result', async () => {
    const h = coordinator(), seen = [];
    const result = h.exporter.startExport(config(), p => seen.push(p));
    h.detection.resolve({}); await until(() => h.starts === 1);
    h.progress(0.2); h.exporter.cancelExport(); h.exporter.cancelExport(); h.progress(1);
    await assert.rejects(h.exporter.startExport(config(), () => {}), /already running/);
    h.completion.resolve(new Blob(['late']));
    await assert.rejects(result, /cancelled/);
    assert.equal(h.cancels, 1); assert.deepEqual(seen, [0.2]);
});

test('Stop is latched once; Cancel can override it while a prefix is finalizing', async () => {
    const h = coordinator(); const result = h.exporter.startExport(config(), () => {});
    h.detection.resolve({}); await until(() => h.starts === 1);
    h.exporter.stopAndSave(); h.exporter.stopAndSave();
    assert.equal(h.stops, 1);
    h.exporter.cancelExport(); h.exporter.stopAndSave();
    h.completion.resolve(new Blob(['prefix'])); await assert.rejects(result, /cancelled/);
    assert.equal(h.cancels, 1); assert.equal(h.stops, 1);
});

test('a completed job callback cannot publish progress into the next job', async () => {
    const h = coordinator(), seen = [];
    h.detection.resolve({});
    const first = h.exporter.startExport(config(), p => seen.push(p));
    await until(() => h.starts === 1); const oldProgress = h.progress;
    h.completion.resolve(new Blob(['done'])); await first;
    const second = h.exporter.startExport(config(), () => {});
    oldProgress(0.9); await second; assert.deepEqual(seen, []);
});

function backendHarness({ bitmap, ack = true, autoDone = true, failGraphics = false, video = null, audio = null } = {}) {
    const workers = [], messages = [], calls = [], deadlines = new Map();
    const state = { duration: 4 / 60, isExporting: false, exportTime: 0, visualMode: 'cosmic-wormhole', videoBackplateActive: Boolean(video) };
    class Worker {
        onmessage = null; onerror = null; terminated = 0;
        constructor() { workers.push(this); }
        postMessage(m) {
            messages.push(m);
            if (m.type === 'encode_frame' && ack) queueMicrotask(() => {
                this.onmessage?.({ data: { type: 'frame_encoded', timestampUs: m.timestampUs } });
                this.onmessage?.({ data: { type: 'queue_update', size: 0 } });
            });
            if (m.type === 'finalize_export' && autoDone) queueMicrotask(() => this.onmessage?.({ data: { type: 'export_done', blob: new Blob(['video']) } }));
        }
        terminate() { this.terminated++; }
    }
    const p5 = {
        noLoop() { calls.push('noLoop'); }, loop() { calls.push('loop'); }, redraw() { calls.push('draw'); },
        createGraphics() {
            if (failGraphics) throw new Error('allocation failed');
            return { pixelDensity() {}, clear() {}, elt: { getContext: () => null }, remove() { calls.push('remove'); } };
        }
    };
    const globals = { Blob, performance, HTMLMediaElement: { HAVE_METADATA: 1, HAVE_CURRENT_DATA: 2 },
        setTimeout(fn, ms) { if (ms === 30_000) { const key = {}; deadlines.set(key, fn); return key; } return setTimeout(fn, ms); },
        clearTimeout(id) { if (!deadlines.delete(id)) clearTimeout(id); },
        window: { requestAnimationFrame: cb => queueMicrotask(cb) },
        createImageBitmap: bitmap ?? (async () => ({ close() { calls.push('close'); } })) };
    const load = createLoader({
        '../state/store': { State: state },
        './ExportBackendRegistry': { ExportBackendRegistry: { register() {} } },
        './export.worker.ts?worker': { __esModule: true, default: Worker }
    }, globals);
    const { WebCodecsBackend } = load('export/WebCodecsBackend.ts');
    const backend = new WebCodecsBackend(p5, {}, { getAudioBuffer: () => audio }, 'track', video);
    return { backend, state, workers, messages, calls, deadlines, p5 };
}

test('graphics allocation failure restores the preview loop and releases the backend', async () => {
    const h = backendHarness({ failGraphics: true });
    await assert.rejects(h.backend.start(config(), () => {}), /allocation failed/);
    assert.equal(h.state.isExporting, false); assert.deepEqual(h.calls, ['noLoop', 'loop']);
    await assert.rejects(h.backend.start(config(), () => {}), /allocation failed/);
});

test('Cancel during bitmap creation releases preview once and closes the eventual bitmap', async () => {
    const gate = deferred(); let requested = false, closed = 0;
    const h = backendHarness({ bitmap: () => { requested = true; return gate.promise; } });
    const result = h.backend.start(config(), () => assert.fail('cancelled progress'));
    await until(() => requested);
    h.backend.cancelExport(); h.backend.cancelExport();
    await assert.rejects(result, /cancelled/);
    gate.resolve({ close() { closed++; } }); await flush();
    assert.equal(closed, 1); assert.equal(h.workers[0].terminated, 1);
    assert.equal(h.calls.filter(c => c === 'loop').length, 1);
    assert.equal(h.calls.filter(c => c === 'remove').length, 1);
    assert.equal(h.messages.filter(m => m.type === 'encode_frame').length, 0);
    assert.equal(h.deadlines.size, 0);
});

test('Stop during a later bitmap saves only the submitted contiguous prefix', async () => {
    const gate = deferred(); let requests = 0, closed = 0;
    const h = backendHarness({ bitmap: () => ++requests === 1 ? Promise.resolve({ close() {} }) : gate.promise });
    const result = h.backend.start(config(), () => {});
    await until(() => requests === 2); h.backend.stopAndSave(); h.backend.stopAndSave();
    assert.equal((await result).size, 5);
    gate.resolve({ close() { closed++; } }); await flush();
    assert.equal(closed, 1);
    assert.equal(h.messages.filter(m => m.type === 'encode_frame').length, 1);
    assert.equal(h.messages.filter(m => m.type === 'finalize_export').length, 1);
});

test('Stop before the first bitmap reports no saveable frames and never finalizes empty video', async () => {
    const gate = deferred(); let requested = false;
    const h = backendHarness({ bitmap: () => { requested = true; return gate.promise; } });
    const result = h.backend.start(config(), () => {}); await until(() => requested);
    h.backend.stopAndSave(); await assert.rejects(result, /No video frames/);
    gate.resolve({ close() {} }); await flush();
    assert.equal(h.messages.some(m => m.type === 'finalize_export'), false);
});

test('backpressure permits at most two unacknowledged frames, then Cancel releases the wait', async () => {
    const h = backendHarness({ ack: false }); const result = h.backend.start(config(), () => {});
    await until(() => h.messages.filter(m => m.type === 'encode_frame').length === 2);
    await new Promise(resolve => setTimeout(resolve, 12));
    assert.equal(h.messages.filter(m => m.type === 'encode_frame').length, 2);
    h.backend.cancelExport(); await assert.rejects(result, /cancelled/);
});

test('Cancel during finalization suppresses a late completion and Stop cannot interrupt the drain', async () => {
    const h = backendHarness({ autoDone: false }); const result = h.backend.start(config(), () => {});
    await until(() => h.messages.some(m => m.type === 'finalize_export'));
    const lateHandler = h.workers[0].onmessage;
    h.backend.stopAndSave(); assert.equal(h.workers[0].terminated, 0);
    h.backend.cancelExport(); lateHandler({ data: { type: 'export_done', blob: new Blob(['late']) } });
    await assert.rejects(result, /cancelled/); assert.equal(h.workers[0].terminated, 1);
});

test('worker error while capturing aborts the wait, closes late resources and restores preview', async () => {
    const gate = deferred(); let requested = false, closed = 0;
    const h = backendHarness({ bitmap: () => { requested = true; return gate.promise; } });
    const result = h.backend.start(config(), () => {}); await until(() => requested);
    h.workers[0].onerror({ message: 'encoder crashed' }); await assert.rejects(result, /encoder crashed/);
    gate.resolve({ close() { closed++; } }); await flush();
    assert.equal(closed, 1); assert.equal(h.state.isExporting, false);
});

test('a bounded finalize wait rejects a stalled encoder and clears resources', async () => {
    const h = backendHarness({ autoDone: false }); const result = h.backend.start(config(), () => {});
    await until(() => h.messages.some(m => m.type === 'finalize_export'));
    assert.equal(h.deadlines.size, 1); [...h.deadlines.values()][0]();
    await assert.rejects(result, /timed out/); assert.equal(h.deadlines.size, 0);
    assert.equal(h.state.isExporting, false); assert.equal(h.workers[0].terminated, 1);
});

test('Cancel while waiting for video metadata removes all media listeners', async () => {
    const listeners = new Map();
    const video = { readyState: 0, pause() {}, addEventListener(type, fn) { listeners.set(type, fn); },
        removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); } };
    const h = backendHarness({ video }); const result = h.backend.start(config(), () => {});
    await until(() => listeners.has('loadedmetadata'));
    h.backend.cancelExport(); await assert.rejects(result, /cancelled/);
    assert.equal(listeners.size, 0); assert.equal(h.deadlines.size, 0);
});

test('worker serializes start, frames and finalize across asynchronous OPFS preparation', async () => {
    const gate = deferred(), order = [], messages = [];
    let closed = 0;
    const file = { createSyncAccessHandle: async () => ({ truncate() {}, write() {}, flush() {}, close() {} }),
        getFile: async () => new Blob(['encoded']) };
    const self = { postMessage: m => messages.push(m),
        VideoFrame: class { close() { closed++; } },
        VideoEncoder: class {
            constructor() { order.push('constructor'); }
            configure() {} encode() { order.push('frame'); } flush() { order.push('flush'); return Promise.resolve(); } close() {}
        } };
    const load = createLoader({ './WebMMuxer': { WebMMuxer: class { finalize() { return null; } } } },
        { self, performance, navigator: { storage: { getDirectory: () => gate.promise } },
            setInterval: () => 1, clearInterval() {} });
    load('export/export.worker.ts');
    self.onmessage({ data: { type: 'start_export', width: 1280, height: 720, fps: 60, sampleRate: 48000 } });
    self.onmessage({ data: { type: 'encode_frame', bitmap: { close() { closed++; } }, timestampUs: 0 } });
    const done = self.onmessage({ data: { type: 'finalize_export' } });
    await flush(); assert.deepEqual(order, []);
    gate.resolve({ async *entries() {}, getFileHandle: async () => file });
    await done;
    assert.deepEqual(order, ['constructor', 'frame', 'flush']); assert.equal(closed, 2);
    assert.equal(messages.filter(m => m.type === 'export_done').length, 1);
    assert.equal(messages.some(m => m.type === 'export_error'), false);
});

test('Stop keeps the same floor-rounded audio/video prefix without detaching playback PCM', async () => {
    const left = Float32Array.from({ length: 3202 }, (_, i) => i / 3202);
    const right = Float32Array.from(left, x => -x);
    const audio = { sampleRate: 48001, length: left.length, numberOfChannels: 2,
        getChannelData: c => c === 0 ? left : right };
    const h = backendHarness({ audio }); let progress = 0;
    await h.backend.start(config(), p => { if (p < 1 && ++progress === 2) h.backend.stopAndSave(); });
    const frames = h.messages.filter(m => m.type === 'encode_frame');
    assert.equal(frames.length, 2);
    assert.deepEqual(frames.map(m => m.timestampUs), [0, 16667]);
    assert.deepEqual(frames.map(m => m.audioSampleCount), [800, 800]);
    for (let i = 0; i < frames.length; i++) {
        const m = frames[i], start = Math.floor(i * 48001 / 60), end = Math.floor((i + 1) * 48001 / 60);
        assert.deepEqual([...m.audioPlanar], [...left.subarray(start, end), ...right.subarray(start, end)]);
    }
    assert.equal(left.byteLength, 12808); assert.equal(right.byteLength, 12808);
});

test('MVP Stop/Cancel remain latched until cleanup, retain confirmation, and re-enable for the next job', () => {
    class Element extends EventTarget {
        disabled = false; dataset = {}; style = {}; textContent = ''; children = new Map();
        classList = { toggle() {}, remove() {}, add() {}, contains() { return false; } };
        querySelector(s) { if (!this.children.has(s)) this.children.set(s, new Element()); return this.children.get(s); }
        querySelectorAll() { return []; }
        click() { this.dispatchEvent(new Event('click')); }
    }
    let stopped = 0, cancelled = 0, confirms = 0, approve = false;
    const load = createLoader({}, { document: { createElement: () => new Element() },
        window: { confirm() { confirms++; return approve; } } });
    const { ExportDialog } = load('ui/mvp/ExportDialog.ts');
    const dialog = new ExportDialog({ onStart() {}, onStop() { stopped++; }, onCancel() { cancelled++; } });
    const stop = dialog.root.querySelector('.mvp-export-stop'), cancel = dialog.root.querySelector('.mvp-export-cancel');
    const status = dialog.root.querySelector('.mvp-modal-status');
    dialog.setActive(true); dialog.setProgress(.1); assert.equal(status.textContent, 'Exporting video…');
    stop.click(); stop.click(); dialog.setProgress(.2);
    assert.equal(status.textContent, 'Stopping and saving captured video…');
    assert.equal(stopped, 1); assert.equal(stop.disabled, true);
    cancel.click(); assert.equal(cancelled, 0); assert.equal(cancel.disabled, false);
    approve = true; cancel.click(); cancel.click();
    dialog.setProgress(.3); assert.equal(status.textContent, 'Cancelling export…');
    assert.equal(cancelled, 1); assert.equal(confirms, 2); assert.equal(cancel.disabled, true);
    dialog.setActive(false); dialog.setActive(true);
    assert.equal(stop.disabled, false); assert.equal(cancel.disabled, false);
});
