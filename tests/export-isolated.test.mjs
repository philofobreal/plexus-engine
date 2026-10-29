import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';

const config = { resolution: '720p', aspectRatio: '16:9', fps: 60, runtime: 'isolated-wormhole' };
const plain = x => JSON.parse(JSON.stringify(x));
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
async function until(f) { for (let i = 0; i < 200 && !f(); i++) await new Promise(resolve => setTimeout(resolve, 1)); assert.ok(f(), 'boundary not reached'); }
function fixture(globals = {}) {
    const load = createLoader({}, { crypto: webcrypto, TextEncoder, Float32Array, AbortController, ...globals });
    const tuning = load('config/visualTuning.ts').cloneDefaultVisualTuning();
    const analysis = load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis();
    const duration = 1, sampleRate = 48000;
    analysis.duration = duration; analysis.bpm = 120;
    const input = { audioContentId: 'a'.repeat(64),
        analysis: { frames: [], events: [], trackAnalysis: analysis, duration, sampleRate, hopSize: 1024, bpm: 120,
            performancePlan: { version: 1, source: 'edited', points: [{ id: 'p', time: 0, preset: 'p.json',
                sectionId: 's', confidence: 1, intensity: .5, reason: 'manual', morphDurationSec: 1, morphCurve: 'linear' }] } },
        seed: { version: 1, rawTuning: tuning, macros: { intensity: .5, motion: .5, depth: .5, detail: .5 }, boosts: {},
            policy: { gains: 'meta', semanticResolver: false, semanticChoreography: false } },
        presets: { 'p.json': { visualTuning: { wormholeSpeed: .3 } } },
        musicDisplay: { mode: 'spectrum', size: .3, opacity: .6 }, skybox: false, morphScale: 1 };
    const channels = [new Float32Array(sampleRate).fill(.1), new Float32Array(sampleRate).fill(-.2)];
    let reads = 0;
    const audio = { sampleRate, length: sampleRate, numberOfChannels: 2, getChannelData(i) { reads++; return channels[i]; } };
    return { load, input, audio, channels, get reads() { return reads; },
        capture: load('export/ExportSnapshot.ts').captureExportSnapshot };
}

test('snapshot owns frozen analysis/plan/preset/macro/display data and one independent PCM copy per channel', async () => {
    const h = fixture(), before = hash(h.input), lease = await h.capture(h.input, h.audio, config, new AbortController().signal);
    assert.equal(hash(h.input), before); assert.equal(h.reads, 2);
    assert.notEqual(lease.audio.getChannelData(0).buffer, h.channels[0].buffer);
    assert.deepEqual([...lease.audio.getChannelData(1)], [...h.channels[1]]);
    h.input.analysis.performancePlan.points[0].time = .5; h.input.seed.macros.motion = 1;
    h.input.presets['p.json'].visualTuning.wormholeSpeed = 4; h.input.musicDisplay.opacity = 0; h.channels[0][0] = 1;
    assert.equal(lease.snapshot.input.analysis.performancePlan.points[0].time, 0);
    assert.equal(lease.snapshot.input.seed.macros.motion, .5);
    assert.equal(lease.snapshot.input.presets['p.json'].visualTuning.wormholeSpeed, .3);
    assert.equal(lease.snapshot.input.musicDisplay.opacity, .6);
    assert.equal(lease.audio.getChannelData(0)[0], Math.fround(.1));
    assert.throws(() => { lease.snapshot.input.analysis.duration = 2; }, TypeError);
    assert.equal(h.channels[0].byteLength, 192000);
    lease.dispose(); lease.dispose(); assert.throws(() => lease.audio.getChannelData(0), /unavailable/);
});

test('snapshot captures controls before asynchronous hashing and IDs bind the copied content', async () => {
    const h = fixture(), p = h.capture(h.input, h.audio, config, new AbortController().signal);
    h.input.seed.rawTuning.wormholeSpeed = 4; h.input.analysis.bpm = 180;
    const a = await p, original = fixture(), b = await original.capture(original.input, original.audio, config, new AbortController().signal);
    assert.equal(a.snapshot.analysisId, b.snapshot.analysisId); assert.deepEqual(plain(a.snapshot.presetIds), plain(b.snapshot.presetIds));
    const c = await h.capture(h.input, h.audio, config, new AbortController().signal);
    assert.notEqual(c.snapshot.analysisId, a.snapshot.analysisId);
    a.dispose(); b.dispose(); c.dispose();
});

test('memory admission rejects before any PCM copy and includes surfaces/queue/headroom', async () => {
    const h = fixture(); await assert.rejects(h.capture(h.input, h.audio, config, new AbortController().signal, 1024), /admission budget/);
    assert.equal(h.reads, 0);
    const a = await h.capture(h.input, h.audio, config, new AbortController().signal);
    const b = await h.capture(h.input, h.audio, { ...config, resolution: '1080p' }, new AbortController().signal);
    assert.equal(b.snapshot.estimatedBytes - a.snapshot.estimatedBytes, (1920 * 1080 - 1280 * 720) * 4 * 5);
    a.dispose(); b.dispose();
});

test('invalid content/clock/fps/dimensions/plain-data/cyclic snapshots are rejected before PCM copying', async () => {
    const changes = [h => h.input.audioContentId = '', h => h.input.analysis.sampleRate = 44100,
        h => h.input.analysis.duration = 2, h => h.input.seed.version = 99,
        h => h.input.seed.rawTuning.wormholeSpeed = NaN,
        h => h.input.presets.loop = h.input.presets,
        h => h.input.presets['p.json'] = undefined];
    for (const change of changes) { const h = fixture(); change(h); await assert.rejects(h.capture(h.input, h.audio, config, new AbortController().signal)); assert.equal(h.reads, 0); }
    for (const c of [{ fps: 24 }, { fps: 120 }, { fps: 0 }, { resolution: '8K' }, { aspectRatio: 'bad' }]) {
        const h = fixture(); await assert.rejects(h.capture(h.input, h.audio, { ...config, ...c }, new AbortController().signal)); assert.equal(h.reads, 0);
    }
});

test('pre-cancelled capture does no work; cancellation during hashing does not publish a lease', async () => {
    const h = fixture(), abort = new AbortController(); abort.abort();
    await assert.rejects(h.capture(h.input, h.audio, config, abort.signal), /cancelled/); assert.equal(h.reads, 0);
    const gate = deferred(), g = fixture({ crypto: { subtle: { digest: () => gate.promise } } }), running = new AbortController();
    const result = g.capture(g.input, g.audio, config, running.signal); running.abort();
    gate.resolve(new ArrayBuffer(32)); await assert.rejects(result, /cancelled/);
    assert.equal(g.channels[0].byteLength, 192000);
});

test('mono audio retains one channel without introducing a detached playback buffer', async () => {
    const h = fixture(); h.audio.numberOfChannels = 1;
    const lease = await h.capture(h.input, h.audio, config, new AbortController().signal);
    assert.equal(h.reads, 1); assert.equal(lease.audio.numberOfChannels, 1);
    assert.throws(() => lease.audio.getChannelData(1), /unavailable/); lease.dispose();
});

test('output aspect/title/watermark are captured before hashing; malformed PCM is rejected', async () => {
    const h = fixture(), c = { ...config, aspectRatio: '9:16', trackName: 'Frozen title', watermark: true };
    const result = h.capture(h.input, h.audio, c, new AbortController().signal);
    c.trackName = 'Edited'; c.watermark = false; c.fps = 30;
    const lease = await result;
    assert.equal(lease.snapshot.width, 720); assert.equal(lease.snapshot.height, 1280);
    assert.equal(lease.snapshot.output.trackName, 'Frozen title'); assert.equal(lease.snapshot.output.watermark, true);
    assert.equal(lease.snapshot.fps, 60); lease.dispose();
    h.channels[0][10] = NaN;
    await assert.rejects(h.capture(h.input, h.audio, config, new AbortController().signal), /non-finite sample/);
});

function sequential() {
    const traces = new WeakMap(); let draws = 0;
    class Backend {
        constructor(w, h) { this.width = w; this.height = h; this.frameCount = 0; this.canvas = { width: w, height: h }; traces.set(this, []); }
        background(...args) { draws++; traces.set(this, [['background', ...args]]); }
        beginFieldRaster() { return null; }
    }
    for (const method of ['noStroke', 'noFill', 'fill', 'stroke', 'strokeWeight', 'line', 'circle', 'triangle', 'beginShape', 'vertex', 'endShape', 'radialGlow', 'radialDim', 'compositeRingTint', 'drawFieldRaster'])
        Backend.prototype[method] = function (...args) { traces.get(this).push([method, ...args]); };
    const backends = [];
    class Recorded extends Backend { constructor(w, h) { super(w, h); backends.push(this); } }
    const load = createLoader({ './Canvas2DRendererBackend': { Canvas2DRendererBackend: Recorded } });
    const raw = load('config/visualTuning.ts').cloneDefaultVisualTuning();
    Object.assign(raw, { wormholeGrainDensity: .025, wormholeNebulaAmount: 0, wormholeGalaxy: 0, wormholeStarfield: 0,
        wormholeSpiral: .3, wormholePathBend: .4, wormholePathBendVertical: -.2 });
    const seed = { version: 1, rawTuning: raw, macros: { intensity: .5, motion: .5, depth: .5, detail: .5 }, boosts: {},
        policy: { gains: 'raw', semanticResolver: false, semanticChoreography: false } };
    const a = new (load('visuals/WormholeCanvasSource.ts').WormholeCanvasSource)({ width: 64, height: 36, contextSeed: seed });
    const b = new (load('visuals/WormholeCanvasSource.ts').WormholeCanvasSource)({ width: 64, height: 36, contextSeed: seed });
    const trackAnalysis = load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis();
    const analysis = { frames: [], events: [], trackAnalysis, duration: 4, bpm: 120, sampleRate: 48000, hopSize: 1024,
        performancePlan: { version: 1, source: 'edited', points: [{ id: 'p', time: .5, preset: 'p' }] } };
    const assets = new Map([['p', { visualTuning: { wormholeSpeed: .9, wormholeSpiral: .8, wormholePathBend: -.4 } }]]);
    a.prepareExport(analysis, assets); b.prepareExport(analysis, assets);
    return { a, b, analysis, assets, get draws() { return draws; },
        signature(s, i) { return hash({ calls: traces.get(backends[i]), state: s.exportState, focal: s.focalPoint }); } };
}

test('sequential 30/60 fps output matches the independent rewind oracle across repeats, gaps and backwards seeks', () => {
    const h = sequential(), before = hash(h.analysis);
    for (const fps of [60, 30]) for (const frame of [0, 1, 2, 9, 30, 60, 60, 25, 90]) {
        h.a.renderExportFrame(frame, fps); h.b.renderExact(frame / fps);
        assert.equal(h.signature(h.a, 0), h.signature(h.b, 1), `${frame}/${fps}`);
    }
    assert.equal(hash(h.analysis), before); h.a.dispose(); h.b.dispose();
});

test('sequential work advances each canonical tick once rather than replaying every requested frame', () => {
    const h = sequential(), initial = h.draws;
    for (let i = 0; i <= 60; i++) h.a.renderExportFrame(i, 60);
    assert.equal(h.draws - initial, 61);
    h.a.renderExportFrame(60, 60); assert.equal(h.draws - initial, 61);
    assert.throws(() => h.a.renderExportFrame(1, 24), /Invalid/);
    assert.throws(() => h.a.renderExportFrame(-1, 60), /Invalid/);
    assert.throws(() => h.a.renderExportFrame(241, 60), /outside/);
    h.a.dispose(); assert.throws(() => h.a.renderExportFrame(1, 60), /outside/); h.b.dispose();
});

test('presentation changes invalidate sequential state and match a fresh exact replay', () => {
    const h = sequential(); h.a.renderExportFrame(40, 60);
    for (const p of [{ spiralDirection: 'left' }, { musicDisplay: { mode: 'spectrum', size: .4, opacity: .6 } }, { macros: { motion: .8 } }]) {
        h.a.setPresentation(p); h.b.setPresentation(p);
        h.a.renderExportFrame(40, 60); h.b.renderExact(40 / 60);
        assert.equal(h.signature(h.a, 0), h.signature(h.b, 1));
    }
    h.a.dispose(); h.b.dispose();
});

test('resolved scaled plans retain their authored durations through private preparation and rewind', () => {
    const h = sequential();
    h.analysis.performancePlan.points[0] = { id: 'p', time: .5, preset: 'p', morphDurationSec: 3,
        morphCurve: 'ease', reason: 'structure', cuePlacement: { role: 'structure', start: 0, end: 4 } };
    const before = hash(h.analysis.performancePlan);
    h.a.prepareExport(h.analysis, h.assets); h.a.renderExportFrame(50, 60); h.a.renderExportFrame(0, 60);
    assert.equal(hash(h.a.plan), before); assert.equal(h.a.plan.points[0].morphDurationSec, 3);
    h.a.dispose(); h.b.dispose();
});

function isolatedBackend({ complete = true } = {}) {
    const messages = [], workers = [], profiles = [], rendered = [];
    const State = new Proxy({}, { get(_t, key) { throw new Error(`Global State read: ${String(key)}`); }, set() { throw new Error('Global State write'); } });
    class Worker {
        constructor() { workers.push(this); }
        postMessage(m) { messages.push(m);
            if (m.type === 'encode_frame') queueMicrotask(() => { this.onmessage?.({ data: { type: 'frame_encoded', timestampUs: m.timestampUs } }); this.onmessage?.({ data: { type: 'queue_update', size: 0 } }); });
            if (m.type === 'finalize_export' && complete) queueMicrotask(() => this.onmessage?.({ data: { type: 'export_done', blob: new Blob(['video']), timings: { workerVideoFlush: 2 } } }));
        }
        terminate() { this.terminated = true; }
    }
    const load = createLoader({ '../state/store': { State }, './ExportBackendRegistry': { ExportBackendRegistry: { register() {} } },
        './export.worker.ts?worker': { __esModule: true, default: Worker } },
        { performance, setTimeout, clearTimeout, Blob, Float32Array, window: { requestAnimationFrame: cb => queueMicrotask(cb) }, createImageBitmap: async () => ({ close() {} }) });
    const { WebCodecsBackend } = load('export/WebCodecsBackend.ts');
    const p5 = new Proxy({}, { get(_t, key) { throw new Error(`Live p5 access: ${String(key)}`); }, deleteProperty() { throw new Error('Live p5 mutation'); } });
    const backend = new WebCodecsBackend(p5, {}, new Proxy({}, { get() { throw new Error('Live AudioEngine read'); } }), 'frozen');
    const samples = new Float32Array(2400).fill(.2), runtime = { duration: .05, bpm: 123, beatDecay: .2,
        snapshot: { width: 1280, height: 720, fps: 60, analysisId: 'a'.repeat(64), estimatedBytes: 100, budgetBytes: 200 },
        audio: { sampleRate: 48000, length: 2400, numberOfChannels: 1, getChannelData: () => samples },
        async renderFrame(i, fps) { rendered.push([i, fps]); return {}; }, dispose() { this.disposed = true; } };
    return { backend, runtime, messages, workers, rendered, profiles, start: () => backend.start(config, () => {}, runtime, p => profiles.push(p)) };
}

test('isolated encoding reads only snapshot PCM/clock/rendering and never accesses live State/p5/AudioEngine', async () => {
    const h = isolatedBackend(); assert.equal((await h.start()).size, 5);
    assert.deepEqual(h.rendered, [[0, 60], [1, 60], [2, 60]]);
    assert.deepEqual(h.messages.filter(m => m.type === 'encode_frame').map(m => m.timestampUs), [0, 16667, 33333]);
    assert.equal(h.profiles[0].outcome, 'completed'); assert.equal(h.profiles[0].framesSubmitted, 3);
    assert.equal(h.profiles[0].stagesMs.workerVideoFlush, 2);
    assert.ok(h.profiles[0].stagesMs.backendRequest >= 0); assert.equal(h.workers[0].terminated, true);
});

test('isolated Cancel during finalization terminates the worker and retains cancellation profile', async () => {
    const h = isolatedBackend({ complete: false }), result = h.start();
    await until(() => h.messages.some(m => m.type === 'finalize_export'));
    h.backend.cancelExport(); await assert.rejects(result, /cancelled/);
    assert.equal(h.profiles[0].outcome, 'cancelled'); assert.equal(h.workers[0].terminated, true);
});

test('isolated backend refuses mismatched output dimensions/clock before touching a live renderer', async () => {
    const h = isolatedBackend(); h.runtime.snapshot.fps = 30;
    await assert.rejects(h.start(), /frozen snapshot/); assert.equal(h.workers.length, 0);
});

test('isolated audio failure rejects instead of silently publishing a video without its frozen soundtrack', async () => {
    const h = isolatedBackend({ complete: false }), result = h.start();
    await until(() => h.workers.length === 1);
    h.workers[0].onmessage({ data: { type: 'export_audio_warning', message: 'Opus unavailable' } });
    await assert.rejects(result, /audio failed: Opus unavailable/);
    assert.equal(h.workers[0].terminated, true); assert.equal(h.profiles[0].outcome, 'failed');
});

test('private PostFX uses its supplied state while the live global state remains paused and unchanged', () => {
    const load = createLoader(), global = load('state/store.ts').State;
    const before = hash(global);
    const privateState = { visualTuning: { ...global.visualTuning, postFxFragmentAmount: 1 }, directorOutput: { glitchIntensity: 1 }, modulation: { spectralChaos: .8, rhythmicImpulse: .7 }, isExporting: true, isPlaying: false };
    const effect = new (load('visuals/TemporalFragmentationEffect.ts').TemporalFragmentationEffect)(() => privateState);
    assert.equal(effect.isActive({ timeSec: 1, widthPx: 100, heightPx: 100 }), true);
    privateState.directorOutput.glitchIntensity = 0; assert.equal(effect.isActive({ timeSec: 1, widthPx: 100, heightPx: 100 }), false);
    assert.equal(hash(global), before);
});

test('coordinator cancels a preparing isolated runtime and disposes a late-created renderer before unlocking', async () => {
    const gate = deferred(); let signal, disposed = 0, starts = 0;
    const load = createLoader({ './WebCodecsBackend': {},
        './ExportCapabilityDetector': { ExportCapabilityDetector: { detectCapabilities: async () => ({}) } },
        './ExportBackendRegistry': { ExportBackendRegistry: { getPreferred: () => ({ start() { starts++; } }) } }
    }, { AbortController });
    const { WebMExporter } = load('export/WebMExporter.ts');
    const exporter = new WebMExporter({}, {}, {}, null, { prepareRuntime: (_c, s) => { signal = s; return gate.promise; } });
    const result = exporter.startExport(config, () => {}); exporter.cancelExport();
    assert.equal(signal.aborted, true);
    await assert.rejects(exporter.startExport(config, () => {}), /already running/);
    gate.resolve({ dispose() { disposed++; } }); await assert.rejects(result, /cancelled/);
    assert.equal(disposed, 1); assert.equal(starts, 0);
});

test('coordinator keeps Compatible as the legacy path and explicitly rejects unsupported isolated hosts', async () => {
    let preparations = 0, runtimePassed;
    const load = createLoader({ './WebCodecsBackend': {},
        './ExportCapabilityDetector': { ExportCapabilityDetector: { detectCapabilities: async () => ({}) } },
        './ExportBackendRegistry': { ExportBackendRegistry: { getPreferred: () => ({ async start(_c, _p, runtime) { runtimePassed = runtime; return new Blob(['legacy']); } }) } }
    }, { Blob, AbortController });
    const { WebMExporter } = load('export/WebMExporter.ts');
    const configured = new WebMExporter({}, {}, {}, null, { async prepareRuntime() { preparations++; throw new Error('must not prepare'); } });
    assert.equal((await configured.startExport({ ...config, runtime: undefined }, () => {})).size, 6);
    assert.equal(preparations, 0); assert.equal(runtimePassed, undefined);
    const legacy = new WebMExporter({}, {}, {});
    await assert.rejects(legacy.startExport(config, () => {}), /unavailable in this host/);
});

test('MVP isolated selection restores/saves/copies settings and diagnostics without persisting PCM or resetting legacy defaults', async () => {
    class Element extends EventTarget {
        disabled = false; dataset = {}; style = {}; textContent = ''; value = ''; children = new Map();
        classList = { toggle() {}, remove() {}, add() {}, contains() { return false; } };
        querySelector(s) { if (!this.children.has(s)) this.children.set(s, new Element()); return this.children.get(s); }
        querySelectorAll() { return []; } click() { this.dispatchEvent(new Event('click')); }
    }
    const storage = new Map([['plexus.exportRuntime', 'isolated-wormhole']]), copied = [], starts = [];
    const load = createLoader({}, { document: { createElement: () => new Element() },
        window: { localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } },
        navigator: { clipboard: { async writeText(text) { copied.push(JSON.parse(text)); } } } });
    const { ExportDialog } = load('ui/mvp/ExportDialog.ts');
    const dialog = new ExportDialog({ onStart: c => starts.push(c), onStop() {}, onCancel() {} }, true);
    const select = dialog.root.querySelector('.mvp-export-runtime');
    assert.equal(select.value, 'isolated-wormhole');
    dialog.root.querySelector('.mvp-export-start').click(); assert.equal(starts[0].runtime, 'isolated-wormhole');
    dialog.setProfile({ analysisId: 'test', stagesMs: { bitmap: 2 }, outcome: 'completed' });
    dialog.root.querySelector('.mvp-export-copy').click(); await flush();
    assert.equal(copied[0].export.runtime, 'isolated-wormhole'); assert.equal(copied[0].diagnostics.stagesMs.bitmap, 2);
    select.value = 'compatible'; select.dispatchEvent(new Event('change'));
    assert.equal(storage.get('plexus.exportRuntime'), 'compatible');
    const legacy = new ExportDialog({ onStart() {}, onStop() {}, onCancel() {} });
    assert.equal(legacy.root.querySelector('.mvp-export-runtime').value, 'compatible');
});

test('worker profiling is additive, identifies flush stages and preserves the unprofiled done packet', async () => {
    for (const profiling of [false, true]) {
        const messages = []; let time = 0;
        const self = { VideoEncoder: class { configure() {} flush() { return Promise.resolve(); } close() {} }, postMessage: m => messages.push(m) };
        const load = createLoader({ './WebMMuxer': { WebMMuxer: class { finalize() { return null; } } } },
            { self, performance: { now: () => ++time }, setInterval: () => 1, clearInterval() {},
                navigator: { storage: { async getDirectory() { return { async *entries() {}, async getFileHandle() {
                    return { async createSyncAccessHandle() { return { truncate() {}, flush() {}, close() {} }; }, async getFile() { return new Blob(['file']); } };
                } }; } } } });
        load('export/export.worker.ts');
        await self.onmessage({ data: { type: 'start_export', width: 64, height: 36, fps: 60, sampleRate: 48000, ...(profiling ? { profile: true } : {}) } });
        await self.onmessage({ data: { type: 'finalize_export' } });
        const done = messages.find(m => m.type === 'export_done'); assert.ok(done);
        if (profiling) { assert.ok(done.timings.workerVideoFlush > 0); assert.equal(done.timings.workerInputWindow, 0); }
        else assert.deepEqual(Object.keys(done).sort(), ['blob', 'type']);
    }
});

test('private runtime composes and post-processes its own surface, and disposal releases both canvases once', async () => {
    const h = fixture(), lease = await h.capture(h.input, h.audio, config, new AbortController().signal), sources = [], surfaces = [];
    class Source {
        exportState = { beatDecay: .7, visualTuning: {}, directorOutput: {}, modulation: {} };
        canvas = {}; closes = 0;
        constructor() { sources.push(this); }
        setPresentation(p) { this.display = p; } prepareExport(a, p) { this.analysis = a; this.presets = p; }
        renderExportFrame(i, fps) { this.frame = [i, fps]; } dispose() { this.closes++; }
    }
    let postCalls = 0;
    const load = createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: Source },
        './CanvasPostFxSurface': { CanvasPostFxSurface: class {} }, './TemporalFragmentationEffect': { TemporalFragmentationEffect: class {} },
        './PostFxPipeline': { PostFxPipeline: class { constructor(_effects, _surface, state) { this.state = state; }
            render(host, time) { assert.equal(this.state().isExporting, true); assert.equal(time, 1 / 60); assert.ok(host.drawingContext); postCalls++; } } }
    }, { document: { createElement() { const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }) }; surfaces.push(canvas); return canvas; } } });
    const Runtime = load('visuals/WormholeExportRuntime.ts').WormholeExportRuntime;
    const runtime = new Runtime(lease.snapshot, lease.audio);
    const image = await runtime.renderFrame(1, 60); assert.equal(image, surfaces[0]); assert.equal(postCalls, 1);
    assert.equal(runtime.beatDecay, .7); assert.equal(sources[0].analysis, lease.snapshot.input.analysis);
    await assert.rejects(runtime.renderFrame(1, 30), /clock differs/);
    runtime.dispose(); runtime.dispose(); assert.equal(sources[0].closes, 1); assert.equal(image.width, 1);
    await assert.rejects(runtime.renderFrame(1, 60), /disposed/); lease.dispose();
});

test('coordinator releases a prepared private runtime after capability/backend failure', async () => {
    let disposed = 0;
    const load = createLoader({ './WebCodecsBackend': {},
        './ExportCapabilityDetector': { ExportCapabilityDetector: { detectCapabilities: async () => { throw new Error('codec unavailable'); } } },
        './ExportBackendRegistry': {} }, { AbortController });
    const Exporter = load('export/WebMExporter.ts').WebMExporter;
    const exporter = new Exporter({}, {}, {}, null, { async prepareRuntime() { return { dispose() { disposed++; } }; } });
    await assert.rejects(exporter.startExport(config, () => {}), /codec unavailable/); assert.equal(disposed, 1);
    await assert.rejects(exporter.startExport(config, () => {}), /codec unavailable/); assert.equal(disposed, 2);
});

test('MVP rejects a settings revision changed during snapshot hashing before constructing its renderer', async () => {
    const gate = deferred(); let prepare, constructed = 0;
    class Exporter {
        constructor(_p, _c, _e, _v, options) { prepare = options.prepareRuntime; }
        async startExport(c) { const runtime = await prepare(c, new AbortController().signal); runtime.dispose(); return new Blob(['video']); }
    }
    const stubs = { '../../export/WebMExporter': { WebMExporter: Exporter } };
    const h = fixture({ crypto: { subtle: { digest: () => gate.promise } } });
    const load = createLoader(stubs, { crypto: { subtle: { digest: () => gate.promise } }, TextEncoder, Float32Array, AbortController, performance,
        fetch: async () => ({ ok: true, json: async () => ({ presets: [] }) }) });
    const state = load('state/store.ts').State;
    Object.assign(state, h.input.analysis); state.targetTuning = h.input.seed.rawTuning;
    const engine = { addPlaybackStateListener() {}, addPositionChangedListener() {}, stop() {}, getAudioBuffer: () => h.audio };
    const Controller = load('ui/mvp/MvpVisualController.ts').MvpVisualController;
    const controller = new Controller(engine, () => false, { onProgress() {}, onAnalysisError() {}, onPlaybackEnded() {}, onPlaybackStateChange() {}, onPositionChange() {} },
        { factory() { constructed++; throw new Error('must not construct'); }, musicDisplay: () => h.input.musicDisplay });
    controller.setExportTarget({}, {}); controller.currentFileHash = 'a'.repeat(64);
    controller.presetCache.set('p.json', h.input.presets['p.json']);
    state.performancePlan = h.input.analysis.performancePlan;
    const result = controller.startExport(config, () => {});
    controller.macros.motion = .8; gate.resolve(new ArrayBuffer(32));
    await assert.rejects(result, /changed during export preparation/); assert.equal(constructed, 0);
});

