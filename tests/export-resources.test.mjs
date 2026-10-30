import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function snapshot() {
    const serializations = [];
    const load = createLoader({}, { crypto: webcrypto, TextEncoder, Float32Array, AbortController,
        JSON: { parse: JSON.parse, stringify(value) { serializations.push(value); return JSON.stringify(value); } } });
    const track = load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis(); track.duration = 1;
    const frame = { e: .25, eRatio: 1, densityProj: .1, melodyProj: .2, fxProj: .3, state: 'IDLE' };
    const input = { audioContentId: 'f'.repeat(64), analysis: { frames: [frame, frame], events: [], trackAnalysis: track,
        sampleRate: 1000, hopSize: track.featureHopSize, duration: 1, bpm: 120, performancePlan: { version: 1, source: 'edited', points: [] } },
        seed: { version: 1, rawTuning: {}, macros: {}, boosts: {}, policy: {} }, presets: {}, musicDisplay: { mode: 'off' }, skybox: false, morphScale: 1 };
    let reads = 0;
    const channel = new Float32Array(1000);
    const audio = { length: 1000, sampleRate: 1000, numberOfChannels: 1, getChannelData() { reads++; return channel; } };
    serializations.length = 0; // Exclude empty-analysis fixture construction from export instrumentation.
    return { input, audio, serializations, get reads() { return reads; }, capture: () => load('export/ExportSnapshot.ts').captureExportSnapshot(input, audio,
        { resolution: '720p', aspectRatio: '16:9', fps: 60 }, new AbortController().signal) };
}

test('snapshot direct copy keeps JSON-normalized data and SHA identity, without serializing the whole input to copy it', async () => {
    const h = snapshot(); h.input.seed.optional = undefined; h.input.seed.values = [-0, undefined, , 3];
    Object.defineProperty(h.input.seed, '__proto__', { value: { safe: 1 }, enumerable: true });
    const reference = JSON.parse(JSON.stringify(h.input));
    const id = createHash('sha256').update(JSON.stringify(reference.analysis)).digest('hex');
    const lease = await h.capture();
    assert.equal(JSON.stringify(lease.snapshot.input), JSON.stringify(reference)); assert.equal(lease.snapshot.analysisId, id);
    assert.equal(h.serializations.length, 1); assert.equal(h.serializations[0], lease.snapshot.input.analysis);
    assert.equal(Object.hasOwn(lease.snapshot.input.seed, 'optional'), false);
    assert.equal(Object.hasOwn(lease.snapshot.input.seed, '__proto__'), true);
    assert.equal(Object.getPrototypeOf(lease.snapshot.input.seed).safe, undefined);
    assert.equal(lease.snapshot.input.analysis.frames[0], lease.snapshot.input.analysis.frames[1], 'One immutable copy of a shared subtree');
    assert.notEqual(lease.snapshot.input.analysis.frames[0], h.input.analysis.frames[0]);
    assert.equal(Object.isFrozen(h.input.analysis.frames[0]), false);
    h.input.analysis.frames[0].e = .9; assert.equal(lease.snapshot.input.analysis.frames[0].e, .25);
    assert.throws(() => { lease.snapshot.input.analysis.frames[0].e = 1; }, TypeError); lease.dispose();
});

test('snapshot rejects oversized sparse arrays and cycles on custom array properties before copying PCM', async () => {
    for (const huge of [true, false]) {
        const h = snapshot();
        if (huge) h.input.analysis.frames.length = 1_000_000_000;
        else h.input.analysis.frames.self = h.input.analysis.frames;
        await assert.rejects(h.capture(), huge ? /admission budget/ : /cycle/);
        assert.equal(h.reads, 0); assert.equal(h.serializations.length, 0);
    }
});

let nextStorageId = 0;
const storageLoad = createLoader({}, { setTimeout, clearTimeout, crypto: { randomUUID: () => `test-${++nextStorageId}` } });
const { ExportStorageLease, validExportStorageName } = storageLoad('export/ExportStorageLease.ts');
test('storage leases are unique and remove only their own file; retained results and other jobs survive', async () => {
    const removed = [], files = new Set();
    const dir = { async removeEntry(name) { removed.push(name); files.delete(name); }, entries() { assert.fail('No global sweep'); } };
    const a = new ExportStorageLease(async () => dir), b = new ExportStorageLease(async () => dir);
    assert.notEqual(a.name, b.name); assert.ok(validExportStorageName(a.name));
    for (const name of ['', '../other.webm', 'unrelated.webm', 'temp_plexus_export_a/../b.webm']) assert.equal(validExportStorageName(name), false);
    files.add(a.name); files.add(b.name); b.retain(); await a.discard(); await a.discard();
    assert.deepEqual(removed, [a.name]); assert.deepEqual([...files], [b.name]); assert.equal(b.disposition, 'retained-result');
});

test('storage cleanup retries a released worker lock and treats a missing own file as already removed', async () => {
    let calls = 0;
    const lease = new ExportStorageLease(async () => ({ async removeEntry() {
        if (++calls === 1) throw Object.assign(new Error('locked'), { name: 'NoModificationAllowedError' });
    } }));
    await lease.discard(); assert.equal(calls, 2); assert.equal(lease.disposition, 'removed');
    const absent = new ExportStorageLease(async () => ({ async removeEntry() { throw Object.assign(new Error('missing'), { name: 'NotFoundError' }); } }));
    await absent.discard(); assert.equal(absent.disposition, 'removed');
});

test('storage failure stays diagnostic and cannot replace cancellation with an unrelated cleanup error', async () => {
    const lease = new ExportStorageLease(async () => ({ async removeEntry() { throw new Error('storage unavailable'); } }));
    await lease.discard(); assert.equal(lease.disposition, 'cleanup-pending');
});

test('an unresponsive storage API cannot keep the job reservation locked indefinitely', async () => {
    const lease = new ExportStorageLease(() => new Promise(() => {}));
    await lease.discard(); assert.equal(lease.disposition, 'cleanup-pending');
});

function backend({ leased = false, ack = true, cancelAfterFirst = false } = {}) {
    const sent = [], pcm = [], profiles = [], events = [], files = new Set(['another-active-export']); let worker;
    const forbidden = new Proxy({}, { get() { throw new Error('Live state/audio access'); }, set() { throw new Error('Live mutation'); } });
    const left = Float32Array.from({ length: 100 }, (_, i) => i + .25), right = Float32Array.from({ length: 100 }, (_, i) => -i - .5);
    class Worker {
        constructor() { worker = this; }
        postMessage(m) {
            sent.push(m);
            if (m.type === 'start_export' && m.storageFile) files.add(m.storageFile);
            if (m.type === 'encode_frame') {
                const received = structuredClone(m.audioPlanar, { transfer: [m.audioPlanar.buffer] });
                assert.equal(m.audioPlanar.buffer.byteLength, 0); pcm.push([...received]);
                if (ack) queueMicrotask(() => {
                    this.onmessage?.({ data: { type: 'frame_encoded', timestampUs: m.timestampUs,
                        audioBuffer: structuredClone(received, { transfer: [received.buffer] }) } });
                    this.onmessage?.({ data: { type: 'queue_update', size: 0 } });
                });
            }
            if (m.type === 'finalize_export') queueMicrotask(() => this.onmessage?.({ data: { type: 'export_done', blob: new Blob(['saved']) } }));
        }
        terminate() { this.terminated = true; events.push('terminated'); }
    }
    const globals = { performance, setTimeout, clearTimeout, Blob, Float32Array,
        window: { requestAnimationFrame: cb => queueMicrotask(cb) }, createImageBitmap: async () => ({ close() {} }) };
    if (leased) globals.navigator = { storage: { async getDirectory() { return { async removeEntry(name) {
        assert.equal(worker.terminated, true); events.push(['removed', name]); files.delete(name);
    } }; } } };
    const load = createLoader({ '../state/store': { State: forbidden }, './ExportBackendRegistry': { ExportBackendRegistry: { register() {} } },
        './export.worker.ts?worker': { __esModule: true, default: Worker } }, globals);
    const instance = new (load('export/WebCodecsBackend.ts').WebCodecsBackend)(forbidden, {}, forbidden, 'frozen');
    const runtime = { duration: .1, bpm: 120, beatDecay: 0,
        snapshot: { width: 1280, height: 720, fps: 60, analysisId: 'id', estimatedBytes: 100, budgetBytes: 200 },
        audio: { length: 100, sampleRate: 1000, numberOfChannels: 2, getChannelData: i => i ? right : left }, async renderFrame() { return {}; } };
    return { instance, runtime, sent, pcm, profiles, events, files, left, right, get worker() { return worker; },
        start: () => instance.start({ resolution: '720p', aspectRatio: '16:9', fps: 60, runtime: 'isolated-wormhole' },
            () => { if (cancelAfterFirst) instance.cancelExport(); }, runtime, p => profiles.push(p)) };
}

test('real transfer round trips reuse bounded PCM buffers without changing half-open samples, channel order or playback PCM', async () => {
    const h = backend(); await h.start(); assert.equal(h.pcm.length, 6);
    for (let frame = 0; frame < 6; frame++) {
        const start = Math.floor(frame * 1000 / 60), end = Math.floor((frame + 1) * 1000 / 60);
        assert.deepEqual(h.pcm[frame], [...h.left.subarray(start, end), ...h.right.subarray(start, end)]);
    }
    assert.equal(h.profiles[0].resources.audioBufferAllocations, 2); assert.equal(h.profiles[0].resources.audioBuffersReused, 4);
    assert.equal(h.profiles[0].resources.audioPoolLimitBytes, 272);
    assert.equal(h.left.byteLength, 400); assert.equal(h.right[99], -99.5);
});

test('successful output retains its backing file until its consumer explicitly discards the result', async () => {
    const h = backend({ leased: true }), blob = await h.start();
    const own = h.sent[0].storageFile;
    assert.equal(await blob.text(), 'saved'); assert.ok(h.files.has(own)); assert.ok(h.files.has('another-active-export'));
    assert.equal(h.profiles[0].resources.storage, 'retained-result');
    await h.instance.discardResult(); assert.equal(h.files.has(own), false); assert.ok(h.files.has('another-active-export'));
    assert.deepEqual(h.events, ['terminated', ['removed', own]]);
});

test('Cancel and worker failure terminate encoding before removing only the owned file', async () => {
    for (const command of ['cancel', 'error']) {
        const h = backend({ leased: true, ack: command === 'cancel', cancelAfterFirst: command === 'cancel' }), result = h.start();
        if (command === 'error') { await flush(); h.worker.onmessage({ data: { type: 'export_error', message: 'Codec failed' } }); }
        await assert.rejects(result, /cancelled|Codec failed/);
        assert.deepEqual([...h.files], ['another-active-export']); assert.equal(h.profiles[0].resources.storage, 'removed');
    }
});

test('failed validation of a reused backend cannot discard its previous published result', async () => {
    const h = backend({ leased: true }); await h.start(); const previous = h.sent[0].storageFile;
    await assert.rejects(h.instance.start({ fps: 0 }, () => {}, h.runtime), /positive frame rate/);
    await h.instance.discardResult(); assert.ok(h.files.has(previous)); assert.ok(h.files.has('another-active-export'));
});

test('Stop saves a nonempty prefix and retains its file, while clearing the reusable PCM pool at teardown', async () => {
    const h = backend({ leased: true, ack: false }), result = h.start();
    await flush(); h.instance.stopAndSave(); const blob = await result;
    assert.equal(await blob.text(), 'saved'); assert.ok(h.pcm.length > 0 && h.pcm.length < 6);
    assert.equal(h.profiles[0].resources.storage, 'retained-result'); assert.ok(h.profiles[0].resources.audioBufferAllocations <= 2);
});

test('worker never sweeps files from other jobs and closes its OPFS handle on a startup failure', async () => {
    const events = [], messages = [];
    const self = { VideoEncoder: class { configure() { throw new Error('configure failed'); } close() { events.push('encoder closed'); } }, postMessage: m => messages.push(m) };
    const load = createLoader({}, { self, performance, TextEncoder, TextDecoder, setInterval: () => 1, clearInterval() {},
        navigator: { storage: { async getDirectory() { return {
            entries() { assert.fail('Must not enumerate another export'); }, removeEntry() { assert.fail('Must not remove another export'); },
            async getFileHandle(name) { events.push(name); return { async createSyncAccessHandle() { return { truncate() {}, close() { events.push('file closed'); } }; } }; }
        }; } } } });
    load('export/export.worker.ts'); const own = 'temp_plexus_export_owned.webm';
    await self.onmessage({ data: { type: 'start_export', width: 64, height: 36, fps: 60, sampleRate: 48000, storageFile: own } });
    assert.deepEqual(events, [own, 'encoder closed', 'file closed']); assert.match(messages[0].message, /configure failed/);
    events.length = 0;
    await self.onmessage({ data: { type: 'start_export', storageFile: '../another.webm' } });
    assert.deepEqual(events, []); assert.match(messages.at(-1).message, /Invalid export storage/);
});

test('PostFX teardown releases its own 4K snapshot immediately without resizing the borrowed output', () => {
    let owned;
    const context = { save() {}, restore() {}, setTransform() {}, drawImage() {} };
    const load = createLoader({ '../state/store': { State: {} } });
    const Surface = load('visuals/CanvasPostFxSurface.ts').CanvasPostFxSurface;
    const surface = new Surface(() => owned = { width: 0, height: 0, getContext: () => context });
    const target = { canvas: { width: 3840, height: 2160 }, ctx: context };
    surface.captureSnapshot(target); assert.equal(owned.width, 3840);
    const Pipeline = load('visuals/PostFxPipeline.ts').PostFxPipeline;
    const pipeline = new Pipeline([], surface, () => ({})); pipeline.dispose(); pipeline.dispose();
    assert.equal(owned.width, 1); assert.equal(owned.height, 1); assert.equal(target.canvas.width, 3840);
    assert.equal(surface.bufferAllocationCount, 1);
});

test('Cancel after queued completion discards unpublished storage before unlocking the coordinator', async () => {
    const gate = deferred(); let discard = 0, exporter;
    const backend = { async start() { exporter.cancelExport(); return new Blob(['late']); }, cancelExport() {},
        async discardResult() { discard++; await gate.promise; } };
    const load = createLoader({ './WebCodecsBackend': {}, './ExportCapabilityDetector': { ExportCapabilityDetector: { async detectCapabilities() { return {}; } } },
        './ExportBackendRegistry': { ExportBackendRegistry: { getPreferred: () => backend } } });
    exporter = new (load('export/WebMExporter.ts').WebMExporter)({}, {}, {});
    const config = { resolution: '720p', aspectRatio: '16:9', fps: 60 }, result = exporter.startExport(config, () => {});
    await flush(); assert.equal(discard, 1); await assert.rejects(exporter.startExport(config, () => {}), /already running/);
    gate.resolve(); await assert.rejects(result, /cancelled/);
});
