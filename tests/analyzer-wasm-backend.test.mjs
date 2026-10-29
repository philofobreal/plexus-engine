import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';
import { harness } from './helpers/xr-controller-harness.mjs';

const bytes = fs.readFileSync('src/analyzer/math/fft.scalar.wasm');
const module = new WebAssembly.Module(bytes);
const globals = { WebAssembly, Float32Array, Float64Array };
const load = createLoader({}, globals);
const { FFT } = load('analyzer/math/FFT.ts');
const { createWasmFftKernelFactory, WasmFftFailure } = load('analyzer/math/WasmFftKernel.ts');
const factory = createWasmFftKernelFactory(module);
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { runAnalysisWithBackend } = load('audio/AnalyzerBackendRunner.ts');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const raw = value => Buffer.from(value.buffer, value.byteOffset, value.byteLength);
const signal = (rate = 22050, seconds = 3) => Float32Array.from({ length: rate * seconds + 7 }, (_, i) =>
    .1 * Math.sin(i * 2 * Math.PI * 330 / rate) + .6 * Math.exp(-(i / rate % .5) * 70) * Math.sin(i * 2 * Math.PI * 63 / rate));

test('production WASM is exactly the measured scalar binary, not another algorithm', () => {
    assert.deepEqual(bytes, fs.readFileSync('research/analyzer-lab/candidates/wasm-fft/fft.scalar.wasm'));
    assert.deepEqual(WebAssembly.Module.imports(module), [{ module: 'env', name: 'memory', kind: 'memory' }]);
    assert.deepEqual(WebAssembly.Module.exports(module), [{ name: 'transform', kind: 'function' }]);
});

for (const size of [2, 4, 512, 1024, 4096, 16384, 65536]) test(`production resident FFT exactly preserves stores at N=${size}`, () => {
    const a = new FFT(size), b = new FFT(size, factory);
    for (let i = 0; i < size; i++) { a.re[i] = b.re[i] = i % 7 ? Math.sin(i * .174) * 8 : -0; a.im[i] = b.im[i] = Math.cos(i * .021) * 1e-39; }
    a.transform(); b.transform();
    assert.deepEqual(raw(a.re), raw(b.re)); assert.deepEqual(raw(a.im), raw(b.im));
    assert.equal(b.re.buffer.byteLength, Math.ceil(12 * size / 65536) * 65536);
    assert.notEqual(new FFT(size, factory).re.buffer, b.re.buffer);
});

for (const [sampleRate, hopSize] of [[22050, 512], [44100, 1024], [96000, 2048]]) {
    test(`full production FFT injection preserves normal/XR publication at ${sampleRate}/${hopSize}`, async () => {
        const samples = signal(sampleRate), before = Buffer.from(raw(samples));
        for (const rhythmOnsets of [false, true]) {
            const input = { samples, sampleRate, options: { hopSize, rhythmOnsets, requestId: 17 } };
            const ref = analyzeAudio(input);
            const accelerated = await runAnalysisWithBackend(input, 'wasm', async () => factory);
            assert.equal(accelerated.backend.used, 'wasm');
            assert.equal(accelerated.backend.kernel, 'fft-scalar-f64-v1');
            assert.equal(digest(accelerated.result), digest(ref));
        }
        assert.deepEqual(raw(samples), before);
    });
}

test('TS selection and unsupported capability avoid loading WASM; load failure falls back', async () => {
    const input = { samples: signal(), sampleRate: 22050 }, expected = digest(analyzeAudio(input));
    let calls = 0;
    const loader = async () => { calls++; throw Error('network/CSP'); };
    const ts = await runAnalysisWithBackend(input, 'typescript', loader);
    assert.equal(calls, 0); assert.equal(ts.backend.used, 'typescript'); assert.equal(digest(ts.result), expected);
    const unsupported = await runAnalysisWithBackend(input, 'auto', loader, false);
    assert.equal(calls, 0); assert.equal(unsupported.backend.fallback, 'unsupported');
    const missing = await runAnalysisWithBackend(input, 'wasm', loader);
    assert.equal(calls, 1); assert.equal(missing.backend.fallback, 'load-failed'); assert.equal(digest(missing.result), expected);
});

test('partially overwritten WASM scratch retries the entire immutable PCM in TS once', async () => {
    const samples = signal(), before = Buffer.from(raw(samples)), input = { samples, sampleRate: 22050 };
    let transforms = 0, loads = 0;
    const broken = (size, cos, sin) => {
        const kernel = factory(size, cos, sin);
        return { re: kernel.re, im: kernel.im, transform() {
            kernel.transform();
            if (++transforms === 5) { kernel.re[0] = NaN; kernel.im[0] = Infinity; throw new WasmFftFailure(); }
        } };
    };
    const value = await runAnalysisWithBackend(input, 'auto', async () => { loads++; return broken; });
    assert.equal(loads, 1); assert.equal(transforms, 5); assert.equal(value.backend.fallback, 'execution-failed');
    assert.equal(digest(value.result), digest(analyzeAudio(input))); assert.deepEqual(raw(samples), before);
});

test('instance failure falls back, while invalid PCM remains an analysis error', async () => {
    const input = { samples: signal(), sampleRate: 22050 };
    const value = await runAnalysisWithBackend(input, 'wasm', async () => () => { throw new WasmFftFailure(); });
    assert.equal(value.backend.fallback, 'execution-failed');
    await assert.rejects(runAnalysisWithBackend({ samples: new Float32Array([NaN]), sampleRate: 22050 }, 'auto', async () => factory), /finite/);
});

test('superseded lazy initialization never enters DSP or emits progress', async () => {
    let finish, current = true, progress = 0;
    const pending = runAnalysisWithBackend({ samples: signal(), sampleRate: 22050, onProgress: () => progress++ }, 'auto',
        () => new Promise(resolve => { finish = resolve; }), true, () => current);
    current = false; finish(factory);
    await assert.rejects(pending, /superseded/); assert.equal(progress, 0);
});

test('async worker filters superseded success/progress/error and rejects unknown backend', async () => {
    const messages = [], jobs = [], self = { postMessage: m => messages.push(m) };
    const local = createLoader({ './AnalyzerBackendRunner': { runAnalysisWithBackend: input => new Promise((resolve, reject) => jobs.push({ input, resolve, reject })) } }, { ...globals, self });
    local('audio/analyzer.worker.ts');
    const request = requestId => ({ data: { requestId, sampleRate: 22050, samples: signal().buffer, phraseSize: 8, algorithmVersion: 7, analysisBackend: 'auto' } });
    self.onmessage(request(1)); self.onmessage(request(2));
    assert.deepEqual(messages.map(m => m.requestId), [1, 2]); messages.length = 0;
    jobs[0].input.onProgress(.5, 'stale'); jobs[0].resolve({ result: { requestId: 1 }, backend: { used: 'wasm' } });
    jobs[1].resolve({ result: { requestId: 2 }, backend: { used: 'wasm' } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(messages.map(m => m.requestId), [2]);
    self.onmessage(request(3)); self.onmessage(request(4)); messages.length = 0;
    jobs[2].reject(Error('stale')); jobs[3].reject(Error('current'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.at(-1).requestId, 4); assert.equal(messages.at(-1).type, 'analysis_error');
    self.onmessage({ data: { ...request(5).data, analysisBackend: 'unknown' } });
    assert.equal(messages.at(-1).requestId, 5); assert.match(messages.at(-1).message, /Unsupported/);
});

function loaderWith(fetch, extra = {}) {
    return createLoader({ '../analyzer/math/fft.scalar.wasm?url&no-inline': { default: 'fft.wasm' } },
        { ...globals, fetch, AbortController, setTimeout, clearTimeout, ...extra })('audio/WasmAnalysisBackend.ts');
}
test('lazy loader caches a compiled module and compiles bytes when MIME is wrong', async () => {
    let calls = 0;
    const loader = loaderWith(async () => { calls++; return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }); });
    const [a, b] = await Promise.all([loader.loadWasmFftKernel(), loader.loadWasmFftKernel()]);
    assert.equal(a, b); assert.equal(calls, 1); assert.equal(new FFT(1024, a).re.length, 1024);
});
test('streaming compilation rejection retries the same response as bytes', async () => {
    let streams = 0;
    const wasm = Object.create(WebAssembly); wasm.compileStreaming = async () => { streams++; throw Error('stream unsupported'); };
    const loader = loaderWith(async () => new Response(bytes, { headers: { 'Content-Type': 'application/wasm' } }), { WebAssembly: wasm });
    assert.equal(new FFT(1024, await loader.loadWasmFftKernel()).re.length, 1024); assert.equal(streams, 1);
});
test('failed download or corrupt binary permits retry instead of poisoning the cache', async () => {
    let calls = 0;
    const loader = loaderWith(async () => ++calls === 1 ? new Response('', { status: 404 }) : calls === 2 ? new Response('broken') : new Response(bytes));
    await assert.rejects(loader.loadWasmFftKernel(), /unavailable/);
    await assert.rejects(loader.loadWasmFftKernel());
    assert.equal(new FFT(512, await loader.loadWasmFftKernel()).re.length, 512); assert.equal(calls, 3);
});
test('timeout bounds an unresolved fetch and aborts its signal', async () => {
    let expire, signal, cleared = false;
    const loader = loaderWith((_url, options) => { signal = options.signal; return new Promise(() => {}); },
        { setTimeout: fn => { expire = fn; return 1; }, clearTimeout: () => { cleared = true; } });
    const pending = loader.loadWasmFftKernel(); expire();
    await assert.rejects(pending, /timed out/); assert.ok(signal.aborted && cleared);
});

test('MVP/Studio backend choice restores, saves, copies and reports actual fallback', async () => {
    const document = fakeDocument(), storage = new Map([['plexus.analyzerBackend', 'typescript']]), chosen = []; let copied;
    document.execCommand = () => false;
    const local = createLoader({ './previewQualityControl.css': {} }, { document,
        window: { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } },
        navigator: { clipboard: { writeText: async text => { copied = text; } } } });
    const control = local('ui/PreviewQualityControl.ts').createPreviewQualityControl(false, true, mode => chosen.push(mode));
    assert.deepEqual(chosen, ['typescript']);
    const select = findAll(control.root, e => e.getAttribute?.('aria-label') === 'Analysis backend')[0];
    select.value = 'wasm'; select.dispatchEvent(new Event('change'));
    assert.equal(chosen.at(-1), 'wasm'); assert.equal(storage.get('plexus.analyzerBackend'), 'wasm');
    control.showAnalysisBackend({ requested: 'wasm', used: 'typescript', fallback: 'load-failed' });
    assert.ok(findAll(control.root, e => e.textContent?.includes('Last analysis: TypeScript (load-failed)')).length);
    findAll(control.root, e => e.textContent === 'Copy preview settings')[0].click();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(JSON.parse(copied).analyzerBackend, 'wasm');
});

test('XR backend choice is next-load scope, persists/copies and preserves artistic defaults', () => {
    const local = createLoader(), { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope, normalizeXrSettings } = local('xr/XrSettings.ts');
    const descriptor = XR_SETTINGS.find(d => d.id === 'analysisBackend');
    const next = descriptor.write(DEFAULT_XR_SETTINGS, 'wasm');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, next), 'analysis');
    assert.equal(next.generation, DEFAULT_XR_SETTINGS.generation); assert.equal(next.background, DEFAULT_XR_SETTINGS.background);
    assert.equal(normalizeXrSettings(JSON.parse(JSON.stringify(next))).system.analysisBackend, 'wasm');
    const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const { createXrSettingsStore } = local('xr/XrSettingsStore.ts');
    createXrSettingsStore(storage).save(next);
    assert.equal(createXrSettingsStore(storage).load().system.analysisBackend, 'wasm');
    const text = local('xr/XrMenuModel.ts').settingsReport(next);
    assert.match(text, /Analysis backend: WebAssembly FFT/);
    assert.equal(JSON.parse(text.split('JSON: ')[1]).system.analysisBackend, 'wasm');
    assert.equal(descriptor.read(normalizeXrSettings({ system: { analysisBackend: 'invalid' } })), 'auto');
    assert.equal(descriptor.read(descriptor.write(next, 'auto')), 'auto');
});

test('changing XR backend during a loaded session never rebuilds background or regenerates chart', async t => {
    const h = harness(); t.after(() => h.controller.dispose()); await h.loadTrack();
    const selected = []; h.engine.setAnalyzerBackend = value => selected.push(value);
    const before = { loads: h.engine.loads, stops: h.engine.stops.length, plans: h.prepareCalls.length,
        backgrounds: h.sceneLog.backgrounds?.length, chart: h.chart() };
    h.pick('wasm', 'system', 'analysisBackend');
    assert.deepEqual(selected, ['wasm']);
    assert.deepEqual({ loads: h.engine.loads, stops: h.engine.stops.length, plans: h.prepareCalls.length,
        backgrounds: h.sceneLog.backgrounds?.length, chart: h.chart() }, before);
});

test('AudioEngine captures backend before decode, filters stale diagnostics and keeps playback PCM', async () => {
    const workers = [], decodes = [], playback = new Float32Array([.2, .4, .1]);
    const state = { isPlaying: false, isPaused: false, targetTuning: {}, visualTuning: {}, modulation: {}, eventIndex: 0, beatIndex: 0 };
    class Worker {
        constructor() { workers.push(this); }
        postMessage(request, transfer) { this.request = request; this.transfer = transfer; }
        terminate() { this.terminated = true; }
    }
    const ctx = { currentTime: 0, decodeAudioData: () => new Promise(resolve => decodes.push(resolve)) };
    const local = createLoader({ './analyzer.worker.ts?worker': Worker,
        '../analyzer': { ANALYSIS_ALGORITHM_VERSION: 7, createEmptyTrackAnalysis: () => ({}), normalizeTrackAnalysis: a => a, normalizeAudioFrame: a => a },
        '../analyzer/TrackStructure': { interpretTrackStructure: a => a },
        '../config/featureFlags': { featureFlags: { heroEffect: false } },
        '../state/store': { State: state }, '../state/visualTransitionState': { resetActiveVisualTransitions() {} },
        './HeroMetronome': { HeroMetronome: { generateStems: () => [] } }
    }, { window: { AudioContext: function () { return ctx; } } });
    const engine = new (local('audio/AudioEngine.ts').AudioEngine)();
    const file = { arrayBuffer: async () => new ArrayBuffer(8) };
    const decoded = { duration: 1, sampleRate: 44100, getChannelData: () => playback };
    engine.setAnalyzerBackend('wasm'); const first = engine.loadFile(file);
    await new Promise(setImmediate); engine.setAnalyzerBackend('typescript'); decodes[0](decoded); await first;
    assert.equal(workers[0].request.analysisBackend, 'wasm');
    assert.notEqual(workers[0].transfer[0], playback.buffer); assert.deepEqual([...playback], [...new Float32Array([.2, .4, .1])]);
    const second = engine.loadFile(file); await new Promise(setImmediate); decodes[1](decoded); await second;
    assert.ok(workers[0].terminated); assert.equal(workers[1].request.analysisBackend, 'typescript');
    workers[0].onmessage({ data: { type: 'analysis_done', requestId: workers[0].request.requestId, backend: { requested: 'wasm', used: 'wasm' } } });
    assert.equal(engine.getAnalysisBackendInfo(), null);
    workers[1].onmessage({ data: { type: 'analysis_done', requestId: workers[1].request.requestId, bpm: 120, adaptiveThreshold: .1,
        frames: [], events: [], hopSize: 1024, trackAnalysis: { bars: [] }, backend: { requested: 'typescript', used: 'typescript' } } });
    assert.ok(workers[1].terminated); assert.equal(engine.getAnalysisBackendInfo().used, 'typescript');
});
