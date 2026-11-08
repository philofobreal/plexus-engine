import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({}, { setTimeout, clearTimeout, TextEncoder, TextDecoder, Blob, Float32Array });
const { probeExportEncoding } = load('export/ExportPreparation.ts');
const { readExportDiagnostic, publishExportDiagnostic, ExportDiagnosticJournal, EXPORT_FPS_KEY } = load('export/ExportDiagnostics.ts');
const settings = { codec: 'vp09.02.51.10', width: 3840, height: 2160, framerate: 60,
    bitrate: 64_000_000, latencyMode: 'quality', bitrateMode: 'constant', webmBitDepth: 10 };
const report = { version: 1, codec: settings.codec, width: 3840, height: 2160, fps: 60, bitrate: 64_000_000,
    bitDepth: 10, stage: 'complete', encoder: 'supported', decoder: 'supported', encodedFrames: 3, decodedFrames: 3 };

function environment({ encoder = true, decoder = true, encodeError, decodeMissing = false } = {}) {
    const queries = [], allocated = [], closed = [];
    const answer = value => { if (typeof value === 'object') throw value; return { supported: value }; };
    class VideoEncoder {
        static async isConfigSupported(c) { queries.push(['encoder', c]); return answer(encoder); }
        constructor(init) { this.init = init; allocated.push('encoder'); }
        configure() {}
        encode(frame) {
            if (encodeError) { this.init.error(encodeError); return; }
            this.init.output({ timestamp: frame.timestamp, duration: 16667, byteLength: 3, type: 'key', copyTo() {} });
        }
        async flush() {}
        close() { closed.push('encoder'); }
    }
    let activeDecoder;
    class VideoDecoder {
        static async isConfigSupported(c) { queries.push(['decoder', c]); return answer(decoder); }
        constructor(init) { this.init = init; activeDecoder = this; allocated.push('decoder'); }
        configure() {}
        decode() { if (!decodeMissing) this.init.output({ close() { closed.push('decoded-frame'); } }); }
        async flush() {}
        close() { closed.push('decoder'); }
    }
    class OffscreenCanvas {
        constructor() { allocated.push('canvas'); }
        getContext() { return { fillRect() {} }; }
    }
    class VideoFrame {
        constructor(_, init) { Object.assign(this, init); allocated.push('frame'); }
        close() { closed.push('frame'); }
    }
    return { env: { VideoEncoder, VideoDecoder, OffscreenCanvas, VideoFrame }, queries, allocated, closed,
        get decoder() { return activeDecoder; } };
}

test('10-bit diagnostics distinguish encoder and decoder refusal before allocation without downgrading', async () => {
    for (const [encoder, decoder] of [[true, false], [false, true], [false, false]]) {
        const h = environment({ encoder, decoder }), events = [];
        await assert.rejects(probeExportEncoding(settings, 48000, false, h.env, 100, e => events.push(e)), /10-bit|preflight failed/);
        assert.deepEqual(h.queries.map(q => q[0]), ['encoder', 'decoder']);
        assert.ok(h.queries.every(q => q[1].codec === 'vp09.02.51.10'));
        assert.equal(events.at(-1).encoder, encoder ? 'supported' : 'unsupported');
        assert.equal(events.at(-1).decoder, decoder ? 'supported' : 'unsupported');
        assert.equal(events.at(-1).stage, decoder ? 'encoder-query' : 'decoder-query');
        assert.equal(events.at(-1).fps, 60);
        assert.equal(events.at(-1).bitDepth, 10);
        assert.deepEqual(h.allocated, []);
    }
});

test('query exceptions keep their names, missing APIs are explicit, and observation cannot mask rejection', async () => {
    const h = environment({ encoder: { name: 'NotSupportedError', message: 'Profile 2 unavailable' } }), events = [];
    await assert.rejects(probeExportEncoding(settings, 48000, false, h.env, 100, e => events.push(e)), /preflight failed/);
    assert.equal(events[0].encoder, 'error');
    assert.equal(events[0].decoder, 'supported');
    assert.equal(events[0].errorName, 'NotSupportedError');
    assert.equal(events[0].message, 'Profile 2 unavailable');
    const absent = [];
    await assert.rejects(probeExportEncoding(settings, 48000, false, {}, 100, e => absent.push(e)), /requires worker/);
    assert.equal(absent[0].stage, 'api');
    assert.equal(absent[0].encoder, 'unavailable');
    await assert.rejects(probeExportEncoding(settings, 48000, false, {}, 100, () => { throw Error('Observer'); }), /requires worker/);
});

test('actual probe counts and failures survive observation, resources close and result shape stays compatible', async () => {
    const h = environment(), events = [];
    const result = await probeExportEncoding(settings, 48000, false, h.env, 100, e => { events.push(e); e.codec = 'observer mutation'; });
    assert.deepEqual(Object.keys(result).sort(), ['config', 'report']);
    assert.equal(result.config.codec, settings.codec);
    assert.equal(events.at(-1).stage, 'complete');
    assert.equal(events.at(-1).encodedFrames, 3);
    assert.equal(events.at(-1).decodedFrames, 3);
    assert.ok(h.closed.includes('encoder') && h.closed.includes('decoder'));
    assert.equal(h.closed.filter(x => x === 'frame').length, 3);
    for (const [options, stage, message] of [
        [{ decodeMissing: true }, 'decode', /could not decode/],
        [{ encodeError: Error('Encoder resource lost') }, 'encode', /Encoder resource lost/],
    ]) {
        const failed = environment(options), reports = [];
        await assert.rejects(probeExportEncoding(settings, 48000, false, failed.env, 100, e => reports.push(e)), message);
        assert.equal(reports.at(-1).stage, stage);
        assert.ok(reports.at(-1).message);
        assert.ok(failed.closed.includes('encoder') && failed.closed.includes('decoder'));
    }
    assert.equal((await probeExportEncoding(settings, 48000, false, environment().env, 100, () => { throw Error('Observer'); })).report.probeFrames, 3);
});

test('worker diagnostic allowlist and bounded journal retain no PCM, track data or stale attempt', () => {
    assert.equal(readExportDiagnostic({ ...report, fps: NaN }), null);
    assert.equal(readExportDiagnostic({ ...report, encodedFrames: -1 }), null);
    assert.equal(readExportDiagnostic({ ...report, message: 'x'.repeat(1001) }), null);
    assert.equal(readExportDiagnostic({ ...report, stage: 'invented' }), null);
    const journal = new ExportDiagnosticJournal();
    journal.begin({ resolution: '4K', aspectRatio: '16:9', fps: 60, webmBitDepth: 10,
        trackName: 'private', audio: new Float32Array(3), runtime: 'isolated-wormhole', memoryLimitMiB: 512 });
    for (let i = 0; i < 20; i++) journal.record({ ...report, message: String(i), audio: new Float32Array(4) });
    journal.record({ invalid: true });
    journal.fail({ name: 'NotSupportedError', message: 'x'.repeat(2000) });
    const snapshot = journal.snapshot();
    assert.equal(snapshot.events.length, 12);
    assert.equal(snapshot.events[0].message, '8');
    assert.equal(snapshot.failure.message.length, 1000);
    assert.doesNotMatch(JSON.stringify(snapshot), /trackName|private|audio|runtime|memoryLimitMiB/);
    snapshot.events[0].codec = 'mutated'; snapshot.requested.fps = 1;
    assert.equal(journal.snapshot().events[0].codec, settings.codec);
    assert.equal(journal.snapshot().requested.fps, 60);
    journal.begin({ resolution: '720p', aspectRatio: '16:9', fps: 30 });
    assert.equal(journal.snapshot().events.length, 0);
    assert.equal(journal.snapshot().failure, null);
    const original = { ...report };
    publishExportDiagnostic(e => { e.codec = 'mutated'; }, original);
    assert.equal(original.codec, settings.codec);
});

test('backend accepts only valid current-worker diagnostics, isolates observers and suppresses late messages', async () => {
    const backendLoad = createLoader({
        './ExportBackendRegistry': { ExportBackendRegistry: { register() {} } },
        './export.worker.ts?worker': { __esModule: true, default: class {} },
    });
    const Backend = backendLoad('export/WebCodecsBackend.ts').WebCodecsBackend;
    const backend = new Backend({}, {}, {}, 'test'), worker = {}, events = [];
    backend.worker = worker;
    backend.diagnosticObserver = e => { events.push(e); throw Error('Broken UI'); };
    const done = backend.waitForExportDone(worker, false), handler = worker.onmessage;
    handler({ data: { type: 'export_diagnostic', report: { ...report, width: -1 } } });
    handler({ data: { type: 'export_diagnostic', report } });
    backend.cancelled = true;
    handler({ data: { type: 'export_diagnostic', report } });
    backend.cancelled = false; backend.worker = {};
    handler({ data: { type: 'export_diagnostic', report } });
    assert.equal(events.length, 1);
    backend.worker = worker;
    const blob = new Blob(['video']);
    handler({ data: { type: 'export_done', blob } });
    assert.equal(await done, blob);
    assert.equal(report.codec, settings.codec);
});

function uiEnvironment(initial = '30') {
    const saved = new Map([[EXPORT_FPS_KEY, initial]]), copies = [], starts = [];
    let storageAvailable = true;
    class Element extends EventTarget {
        children = new Map(); dataset = {}; style = {}; disabled = false; classes = new Set();
        classList = { toggle: (n, on) => on ? this.classes.add(n) : this.classes.delete(n),
            add: n => this.classes.add(n), remove: n => this.classes.delete(n), contains: n => this.classes.has(n) };
        querySelector(s) { if (!this.children.has(s)) this.children.set(s, new Element()); return this.children.get(s); }
        querySelectorAll() { return []; }
        click() { this.dispatchEvent(new Event('click')); }
    }
    const document = { createElement: () => new Element(), activeElement: null };
    const loader = createLoader({}, { document, navigator: { userAgent: 'Samsung-test Chrome/test',
        clipboard: { async writeText(v) { copies.push(JSON.parse(v)); } } }, localStorage: {
        getItem(k) { if (!storageAvailable) throw Error('Storage denied'); return saved.get(k); },
        setItem(k, v) { if (!storageAvailable) throw Error('Storage denied'); saved.set(k, v); }
    } });
    const Dialog = loader('ui/mvp/ExportDialog.ts').ExportDialog;
    return { saved, copies, starts, loader, Element, unavailable() { storageAvailable = false; },
        open: () => new Dialog({ onStart: c => starts.push(c), onStop() {}, onCancel() {} }) };
}

test('MVP FPS preference and copied diagnostics separate current settings from the failed attempt', () => {
    const h = uiEnvironment(), dialog = h.open(), find = s => dialog.root.querySelector(s);
    find('.mvp-export-format').value = 'mp4vp9';
    find('.mvp-export-start').click();
    assert.equal(h.starts[0].fps, 30);
    assert.equal(h.starts[0].mp4VideoCodec, 'vp9-10bit');
    dialog.setActive(true);
    assert.equal(find('.mvp-export-fps').disabled, true);
    dialog.recordDiagnostic(report);
    dialog.recordFailure({ name: 'NotSupportedError', message: 'Decoder unavailable' });
    dialog.setActive(false);
    assert.equal(find('.mvp-export-fps').disabled, false);
    assert.match(find('.mvp-export-codec-diagnostic').textContent, /VP9 10-bit.*3840x2160 at 60 fps/);
    find('.mvp-export-fps').value = '60';
    find('.mvp-export-fps').dispatchEvent(new Event('change'));
    find('.mvp-export-copy').click();
    const copied = h.copies[0];
    assert.equal(copied.export.fps, 60);
    assert.equal(copied.diagnostics.requested.fps, 30);
    assert.equal(copied.diagnostics.failure.name, 'NotSupportedError');
    assert.equal(copied.diagnostics.events[0].codec, settings.codec);
    assert.equal(copied.diagnostics.userAgent, 'Samsung-test Chrome/test');
    assert.equal(h.open().root.querySelector('.mvp-export-fps').value, '60');
    h.saved.set(EXPORT_FPS_KEY, '15');
    assert.equal(h.open().root.querySelector('.mvp-export-fps').value, '60');
    h.unavailable();
    assert.equal(h.open().root.querySelector('.mvp-export-fps').value, '60');
    dialog.setActive(true);
    find('.mvp-export-copy').click();
    assert.equal(h.copies.at(-1).diagnostics.events.length, 0);
});

test('dashboard shares the explicit FPS preference, copies diagnostics and locks the selector during export', () => {
    const h = uiEnvironment(), els = Object.fromEntries(['exportResolution', 'exportAspect', 'exportWatermark',
        'exportVideoBtn', 'stopExportBtn', 'cancelExportBtn', 'status', 'exportFps', 'copyExportBtn', 'diagnosticStatus']
        .map(k => [k, new h.Element()]));
    els.exportResolution.value = '1080p'; els.exportAspect.value = '9:16';
    const Controller = h.loader('ui/controllers/ExportController.ts').ExportController;
    const c = new Controller(els, { onExportStart: v => h.starts.push(v), onExportStop() {}, onExportCancel() {} });
    c.setCanExport(true); els.exportVideoBtn.click();
    assert.equal(h.starts[0].fps, 30);
    c.setExportActive(true); c.recordDiagnostic(report); c.recordFailure(Error('Device lost'));
    assert.equal(els.exportFps.disabled, true);
    els.copyExportBtn.click();
    assert.equal(h.copies[0].diagnostics.events[0].decodedFrames, 3);
    assert.equal(h.copies[0].diagnostics.failure.message, 'Device lost');
    c.resetExportUi();
    assert.equal(els.exportFps.disabled, false);
    els.exportFps.value = '60'; els.exportFps.dispatchEvent(new Event('change'));
    assert.equal(h.saved.get(EXPORT_FPS_KEY), '60');
});
