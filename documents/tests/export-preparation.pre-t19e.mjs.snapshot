import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({}, { setTimeout, clearTimeout, TextEncoder, TextDecoder, Blob, Float32Array });
const { vp9ExportCodec, probeExportEncoding } = load('export/ExportPreparation.ts');
const { exportMemoryBudget, captureExportSnapshot } = load('export/ExportSnapshot.ts');
const settings = { codec: 'legacy', width: 3840, height: 2160, framerate: 60, bitrate: 40_000_000, latencyMode: 'quality', bitrateMode: 'constant' };

test('VP9 levels cover actual picture/sample-rate/bitrate, including portrait and 4K60', () => {
    assert.equal(vp9ExportCodec(1280, 720, 30, 8e6), 'vp09.00.31.08');
    assert.equal(vp9ExportCodec(1280, 720, 60, 8e6), 'vp09.00.40.08');
    assert.equal(vp9ExportCodec(1920, 1080, 60, 14e6), 'vp09.00.41.08');
    assert.equal(vp9ExportCodec(3840, 2160, 30, 40e6), 'vp09.00.50.08');
    assert.equal(vp9ExportCodec(2160, 3840, 60, 40e6), 'vp09.00.51.08');
    assert.throws(() => vp9ExportCodec(3840, 2160, 120, 40e6), /exceeds/);
    assert.throws(() => vp9ExportCodec(0, 1080, 60, 14e6), /Invalid/);
});

function environment({ unsupported = false, failVp9 = false, noPackets = false, stall = false, audioUnsupported = false } = {}) {
    const events = [], frames = [], encoders = [], canvases = [], data = [];
    const packet = (timestamp = 0) => ({ timestamp, duration: 20000, byteLength: 3, type: 'key', copyTo() {} });
    class VideoEncoder {
        static async isConfigSupported(c) { events.push(['support', { ...c }]); return { supported: !unsupported }; }
        constructor(init) { this.init = init; encoders.push(this); }
        configure(c) { this.config = c; events.push(['configure', c]); }
        encode(f) { if (failVp9 && this.config.codec !== 'vp8') this.init.error(new Error('Hardware encoder unavailable'));
            else if (!noPackets) this.init.output(packet(f.timestamp)); }
        flush() { return stall ? new Promise(() => {}) : Promise.resolve(); }
        close() { this.closed = true; }
    }
    class AudioEncoder extends VideoEncoder {
        static async isConfigSupported() { return { supported: !audioUnsupported }; }
        encode() { this.init.output(packet()); }
    }
    class VideoFrame { constructor(_canvas, init) { Object.assign(this, init); frames.push(this); } close() { this.closed = true; } }
    class AudioData { constructor(init) { Object.assign(this, init); data.push(this); } close() { this.closed = true; } }
    class OffscreenCanvas { constructor(w, h) { this.width = w; this.height = h; canvases.push(this); }
        getContext() { return { fillRect() {} }; } }
    return { env: { VideoEncoder, AudioEncoder, VideoFrame, AudioData, OffscreenCanvas }, events, frames, encoders, canvases, data };
}

test('worker codec trial uses exact output settings and closes its private frames/audio/encoders/canvas', async () => {
    const h = environment(), before = JSON.stringify(settings);
    const result = await probeExportEncoding(settings, 48000, true, h.env);
    assert.equal(JSON.stringify(settings), before);
    assert.equal(result.config.codec, 'vp09.00.51.08');
    assert.equal(result.report.width, 3840); assert.equal(result.report.height, 2160); assert.equal(result.report.fps, 60);
    assert.equal(result.report.probeFrames, 3); assert.ok(result.report.probeBytes > 0);
    assert.equal(h.frames.length, 3); assert.equal(h.data[0].numberOfFrames, 2400);
    assert.ok(h.frames.every(f => f.closed)); assert.ok(h.data.every(f => f.closed));
    assert.ok(h.encoders.every(e => e.closed)); assert.ok(h.canvases.every(c => c.width === 1 && c.height === 1));
    assert.equal(h.events[0][1].bitrate, 40_000_000); assert.equal(h.events[0][1].bitrateMode, 'constant');
});

test('a failed VP9 trial tries VP8 at identical dimensions/fps and reports its actual choice', async () => {
    const h = environment({ failVp9: true });
    const result = await probeExportEncoding(settings, 48000, false, h.env);
    assert.equal(result.config.codec, 'vp8'); assert.equal(result.config.width, 3840); assert.equal(result.config.framerate, 60);
    assert.deepEqual(h.events.filter(e => e[0] === 'support').map(e => e[1].codec), ['vp09.00.51.08', 'vp8']);
    assert.ok(h.encoders.every(e => e.closed));
});

test('unsupported video/audio and missing worker APIs fail before trial resource allocation', async () => {
    for (const options of [{ unsupported: true }, { audioUnsupported: true }]) {
        const h = environment(options);
        await assert.rejects(probeExportEncoding(settings, 48000, true, h.env), /unsupported|not supported/);
        assert.equal(h.encoders.length, 0); assert.equal(h.frames.length, 0);
    }
    await assert.rejects(probeExportEncoding(settings, 48000, false, {}), /requires worker/);
});

test('no output and stalled flush are failures and release all trial resources', async () => {
    for (const options of [{ noPackets: true }, { stall: true }]) {
        const h = environment(options);
        await assert.rejects(probeExportEncoding(settings, 48000, false, h.env, 10), /no complete required media|timed out/);
        assert.ok(h.encoders.every(e => e.closed)); assert.ok(h.frames.every(f => f.closed));
        assert.ok(h.canvases.every(c => c.width === 1));
    }
});

test('Auto has a documented 2GiB planning ceiling; explicit smaller limits are enforced before PCM access', async () => {
    assert.equal(exportMemoryBudget({}), 2 * 1024 ** 3);
    assert.equal(exportMemoryBudget({ memoryLimitMiB: 512 }), 512 * 1024 ** 2);
    for (const value of [0, NaN, '2048', 4096]) assert.throws(() => exportMemoryBudget({ memoryLimitMiB: value }), /Invalid/);
    const track = load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis(); track.duration = 1500;
    let reads = 0;
    const audio = { length: 1500 * 48000, sampleRate: 48000, numberOfChannels: 2, getChannelData() { reads++; throw new Error('PCM admission passed'); } };
    const input = { audioContentId: 'a'.repeat(64), seed: { version: 1 }, analysis: { duration: 1500, sampleRate: 48000,
        hopSize: track.featureHopSize, trackAnalysis: track, performancePlan: { points: [] } }, presets: {} };
    const config = { resolution: '4K', aspectRatio: '16:9', fps: 60, memoryLimitMiB: 512 };
    await assert.rejects(captureExportSnapshot(input, audio, config, new AbortController().signal), /Estimated.*MiB; admission budget: 512 MiB/);
    assert.equal(reads, 0);
    await assert.rejects(captureExportSnapshot(input, audio, { ...config, memoryLimitMiB: undefined }, new AbortController().signal), /PCM admission passed/);
    assert.equal(reads, 1); // No huge allocation is made by this admission test.
});

test('MVP memory choice restores, saves, copies and locks with the active job; invalid storage falls back to Auto', async () => {
    class Element extends EventTarget {
        disabled = false; dataset = {}; style = {}; textContent = ''; value = ''; children = new Map();
        classList = { toggle() {}, remove() {}, add() {}, contains() { return false; } };
        querySelector(s) { if (!this.children.has(s)) this.children.set(s, new Element()); return this.children.get(s); }
        querySelectorAll(selector) {
            if (selector !== '.mvp-export-resolution button') return [];
            return this.buttons ??= ['720p', '1080p', '4K'].map(res => Object.assign(new Element(), { dataset: { res } }));
        } click() { this.dispatchEvent(new Event('click')); }
    }
    const storage = new Map([['plexus.exportRuntime', 'isolated-wormhole'], ['plexus.exportMemoryLimit', '1024']]), copied = [], starts = [];
    const uiLoad = createLoader({}, { document: { createElement: () => new Element() },
        window: { localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } },
        navigator: { clipboard: { async writeText(s) { copied.push(JSON.parse(s)); } } } });
    const Dialog = uiLoad('ui/mvp/ExportDialog.ts').ExportDialog;
    const dialog = new Dialog({ onStart: c => starts.push(c), onStop() {}, onCancel() {} }, true);
    const memory = dialog.root.querySelector('.mvp-export-memory'); assert.equal(memory.value, '1024'); assert.equal(memory.disabled, false);
    memory.value = '512'; memory.dispatchEvent(new Event('change')); assert.equal(storage.get('plexus.exportMemoryLimit'), '512');
    dialog.root.querySelector('.mvp-export-start').click(); assert.equal(starts[0].memoryLimitMiB, 512); assert.equal(starts[0].preflight, true);
    dialog.root.querySelector('.mvp-export-copy').click(); await Promise.resolve(); assert.equal(copied[0].export.memoryLimitMiB, 512);
    dialog.setActive(true); assert.equal(memory.disabled, true); dialog.setActive(false); assert.equal(memory.disabled, false);
    storage.set('plexus.exportMemoryLimit', '999999999'); const fresh = new Dialog({ onStart() {}, onStop() {}, onCancel() {} }, true);
    assert.equal(fresh.root.querySelector('.mvp-export-memory').value, 'auto');
    dialog.applyCapabilityReport({ preferredBackend: 'webcodecs', canExport4K: false, fourKRestriction: 'device-heuristic', warnings: ['4K rendering disabled'] });
    const fourK = dialog.root.querySelectorAll('.mvp-export-resolution button').find(b => b.dataset.res === '4K');
    assert.equal(fourK.disabled, false, 'A device-class guess cannot override actual worker testing in MVP');
    dialog.applyCapabilityReport({ preferredBackend: 'webcodecs', canExport4K: false, warnings: [] });
    assert.equal(fourK.disabled, true, 'An explicit non-heuristic capability restriction is retained');
});

function backendHarness() {
    const messages = [], rendered = [], profiles = []; let worker;
    const forbidden = new Proxy({}, { get() { throw new Error('Live access'); }, set() { throw new Error('Live mutation'); } });
    class Worker {
        constructor() { worker = this; }
        postMessage(m) { messages.push(m);
            if (m.type === 'encode_frame') queueMicrotask(() => this.onmessage?.({ data: { type: 'frame_encoded', timestampUs: m.timestampUs } }));
            if (m.type === 'finalize_export') queueMicrotask(() => this.onmessage?.({ data: { type: 'export_done', blob: new Blob(['result']) } }));
        }
        terminate() { this.terminated = true; }
    }
    const backendLoad = createLoader({ '../state/store': { State: forbidden }, './ExportBackendRegistry': { ExportBackendRegistry: { register() {} } },
        './export.worker.ts?worker': { __esModule: true, default: Worker } }, { performance, setTimeout, clearTimeout, Blob, Float32Array,
        window: { requestAnimationFrame: cb => queueMicrotask(cb) }, createImageBitmap: async () => ({ close() {} }) });
    const Backend = backendLoad('export/WebCodecsBackend.ts').WebCodecsBackend;
    const backend = new Backend(forbidden, {}, forbidden, 'frozen');
    const runtime = { duration: 1 / 60, bpm: 120, beatDecay: 0,
        snapshot: { width: 1280, height: 720, fps: 60, analysisId: 'id', estimatedBytes: 100, budgetBytes: 200 },
        audio: { sampleRate: 48000, length: 800, numberOfChannels: 1, getChannelData: () => new Float32Array(800) },
        async renderFrame() { rendered.push(0); return {}; } };
    return { backend, messages, rendered, profiles, get worker() { return worker; },
        start: () => backend.start({ resolution: '720p', aspectRatio: '16:9', fps: 60, runtime: 'isolated-wormhole', preflight: true }, () => {}, runtime, p => profiles.push(p)) };
}

test('production preflight gates all real frames, reports the selected codec and preserves frame-zero timestamp', async () => {
    const h = backendHarness(), result = h.start();
    await Promise.resolve(); assert.equal(h.rendered.length, 0); assert.equal(h.messages.length, 1); assert.equal(h.messages[0].preflight, true);
    h.worker.onmessage({ data: { type: 'export_prepared', report: { codec: 'vp8', width: 1280, height: 720, fps: 60, probeFrames: 3, probeBytes: 100 } } });
    await result; assert.equal(h.messages.find(m => m.type === 'encode_frame').timestampUs, 0);
    assert.equal(h.profiles[0].preflight.codec, 'vp8'); assert.equal(h.worker.terminated, true);
});

test('Cancel, Stop and worker errors during preflight release the worker without producing frames', async () => {
    for (const command of ['cancel', 'stop', 'error']) {
        const h = backendHarness(), result = h.start(); await Promise.resolve();
        if (command === 'cancel') h.backend.cancelExport();
        else if (command === 'stop') h.backend.stopAndSave();
        else h.worker.onmessage({ data: { type: 'export_error', message: 'Unsupported 4K' } });
        await assert.rejects(result, /cancelled|No video frames|Unsupported 4K/);
        assert.equal(h.rendered.length, 0); assert.equal(h.worker.terminated, true);
    }
});

test('real worker start probes before OPFS, configures the verified codec, and excludes probe frames from saved output', async () => {
    const h = environment(), messages = [], chunks = [], order = [];
    const self = { ...h.env, postMessage: m => messages.push(m) };
    const workerLoad = createLoader({}, { ...h.env, self, setTimeout, clearTimeout, performance, TextEncoder, TextDecoder, Blob, Float32Array,
        setInterval: () => 1, clearInterval() {}, navigator: { storage: { async getDirectory() {
            order.push(h.frames.length); return { async *entries() {}, async getFileHandle() { return {
                async createSyncAccessHandle() { return { truncate() {}, write(c) { chunks.push(c); }, flush() {}, close() {} }; },
                async getFile() { return new Blob(chunks); }
            }; } };
        } } } });
    workerLoad('export/export.worker.ts');
    await self.onmessage({ data: { type: 'start_export', width: 3840, height: 2160, fps: 60, sampleRate: 48000, hasAudio: true, preflight: true } });
    assert.deepEqual(order, [3]); assert.equal(messages.find(m => m.type === 'export_prepared').report.codec, 'vp09.00.51.08');
    assert.equal(h.encoders.at(-2).config.codec, 'vp09.00.51.08');
    await self.onmessage({ data: { type: 'encode_frame', bitmap: { close() {} }, timestampUs: 0, audioPlanar: new Float32Array(1600), audioSampleCount: 800 } });
    await self.onmessage({ data: { type: 'finalize_export' } });
    assert.equal(messages.filter(m => m.type === 'frame_encoded').length, 1);
    assert.ok(messages.find(m => m.type === 'export_done').blob.size > 0);
    assert.equal(h.frames.length, 4); assert.ok(h.encoders.every(e => e.closed));
});
