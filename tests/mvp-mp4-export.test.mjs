import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoader } from './helpers/xr-loader.mjs';

const base = { resolution: '720p', aspectRatio: '16:9', fps: 60 };

test('a new or unreadable format preference starts MP4, while an explicit WebM choice survives reopening', () => {
    const saved = new Map(), starts = [], copied = [];
    let storageAvailable = true;
    class Element extends EventTarget {
        children = new Map();
        classList = { toggle() {} };
        querySelector(selector) {
            if (selector === '.mvp-export-resolution button.is-active') return null;
            if (!this.children.has(selector)) {
                const child = new Element();
                if (selector === '.mvp-export-format') {
                    child.value = this.innerHTML.match(/<option value="(\w+)" selected>/)?.[1];
                }
                this.children.set(selector, child);
            }
            return this.children.get(selector);
        }
        querySelectorAll() { return []; }
    }
    const load = createLoader({}, {
        document: { createElement: () => new Element() },
        navigator: { clipboard: { async writeText(value) { copied.push(JSON.parse(value).export); } } },
        localStorage: {
            getItem(key) { if (!storageAvailable) throw Error('Storage disabled'); return saved.get(key); },
            setItem(key, value) { saved.set(key, value); },
        },
    });
    const { ExportDialog } = load('ui/mvp/ExportDialog.ts');
    const open = () => new ExportDialog({
        onStart: config => starts.push(config.mp4VideoCodec === 'vp9-10bit'
            ? 'mp4vp9' : config.format ?? (config.webmBitDepth === 10 ? 'webm10' : 'webm')),
        onStop() {}, onCancel() {},
    });
    const start = dialog => dialog.root.querySelector('.mvp-export-start').dispatchEvent(new Event('click'));
    const first = open();
    start(first);
    const select = first.root.querySelector('.mvp-export-format');
    select.value = 'webm';
    select.dispatchEvent(new Event('change'));
    start(open());
    select.value = 'webm10';
    select.dispatchEvent(new Event('change'));
    const reopened = open();
    start(reopened);
    reopened.root.querySelector('.mvp-export-copy').dispatchEvent(new Event('click'));
    assert.equal(copied[0].webmBitDepth, 10);
    select.value = 'mp4vp9';
    select.dispatchEvent(new Event('change'));
    const preciseMp4 = open();
    start(preciseMp4);
    preciseMp4.root.querySelector('.mvp-export-copy').dispatchEvent(new Event('click'));
    assert.equal(copied[1].format, 'mp4');
    assert.equal(copied[1].mp4VideoCodec, 'vp9-10bit');
    storageAvailable = false;
    start(open());
    assert.deepEqual(starts, ['mp4', 'webm', 'webm10', 'mp4vp9', 'mp4']);
});

test('MP4 is explicit, MVP-only, and can be cancelled while loading its alternate worker', async () => {
    let resolveWorker, alternateStarts = 0, compatibleStarts = 0;
    const backend = { start(config) { alternateStarts++; assert.equal(config.format, 'mp4'); return new Blob(['mp4']); } };
    const load = createLoader({
        './ExportCapabilityDetector': { ExportCapabilityDetector: { detectCapabilities: async () => ({}) } },
        './ExportBackendRegistry': { ExportBackendRegistry: { getPreferred: () => ({ start: () => { compatibleStarts++; return new Blob(['webm']); } }) } },
        './WebCodecsBackend': {},
    });
    const { WebMExporter } = load('export/WebMExporter.ts');
    await assert.rejects(new WebMExporter({}, {}, {}).startExport({ ...base, format: 'mp4' }, () => {}), /unavailable in this host/);
    const job = new WebMExporter({}, {}, {}, null, { createMp4Backend: () => new Promise(resolve => { resolveWorker = resolve; }) });
    const cancelled = job.startExport({ ...base, format: 'mp4' }, () => assert.fail('Cancel leaked progress'));
    job.cancelExport();
    resolveWorker(backend);
    await assert.rejects(cancelled, /cancelled/);
    assert.equal(alternateStarts, 0);
    assert.equal(await (await job.startExport(base, () => {})).text(), 'webm');
    const retry = job.startExport({ ...base, format: 'mp4' }, () => {});
    resolveWorker(backend);
    assert.equal(await (await retry).text(), 'mp4');
    assert.equal(compatibleStarts, 1);
    assert.equal(alternateStarts, 1);
});

test('MP4 cache clears just its owned directory and leaves the WebM storage contract intact', async () => {
    const { ExportStorageLease, clearFinishedExportCache, validMp4ExportStorageName, validExportStorageName } =
        createLoader()('export/ExportStorageLease.ts');
    const removed = [];
    const root = async () => ({ async removeEntry(...args) { removed.push(args); } });
    const mp4 = new ExportStorageLease(root, 'mp4'), pending = new ExportStorageLease(root, 'mp4');
    const webm = new ExportStorageLease(root);
    assert.ok(validMp4ExportStorageName(mp4.name));
    assert.ok(!validExportStorageName(mp4.name));
    assert.ok(validExportStorageName(webm.name));
    mp4.retain(); webm.retain();
    assert.equal((await clearFinishedExportCache()).removed, 2);
    assert.equal(removed[0][0], mp4.name);
    assert.equal(removed[0][1].recursive, true);
    assert.deepEqual(removed[1], [webm.name]);
    assert.equal(pending.disposition, 'pending');
});

test('MP4 AVC level covers both picture size and frame rate, and reads the encoded level', () => {
    const { selectMp4AvcLevel, readMp4AvcLevel } = createLoader()('export/Mp4AvcLevel.ts');
    assert.equal(selectMp4AvcLevel(3840, 2160, 60, 28_000_000), 52);
    assert.equal(selectMp4AvcLevel(2160, 3840, 60, 28_000_000), 52);
    assert.equal(selectMp4AvcLevel(3840, 2160, 30, 28_000_000), 51);
    assert.equal(selectMp4AvcLevel(1920, 1080, 60, 12_000_000), 42);
    assert.equal(selectMp4AvcLevel(1280, 720, 60, 6_000_000), 32);
    assert.equal(selectMp4AvcLevel(3840, 2160, Infinity, 28_000_000), undefined);
    const header = Uint8Array.of(255, 1, 100, 0, 52, 255, 225, 0);
    assert.equal(readMp4AvcLevel(header.subarray(1)), 52);
    assert.equal(readMp4AvcLevel(header), undefined);
});

test('MP4 accepts a working platform encoder at 60 fps even if its reported level is lower', async () => {
    const { selectMp4AvcEncoding } = createLoader()('export/Mp4AvcLevel.ts');
    for (const [requested, emitted, bitrate] of [[32, 31, 6e6], [42, 40, 12e6], [52, 51, 40e6]]) {
        const preferred = { fullCodecString: `avc1.6400${requested.toString(16)}`, bitrate,
            ...(requested === 52 ? { bitrateMode: 'constant' } : {}) };
        const tried = [];
        const encoding = await selectMp4AvcEncoding(preferred, requested, async candidate => {
            tried.push({ ...candidate });
            return emitted;
        });
        assert.equal(encoding, preferred);
        assert.equal(tried.length, requested === 52 ? 2 : 1);
        assert.ok(tried.every(config => config.bitrate === bitrate && config.fullCodecString === preferred.fullCodecString));
    }
});

test('MP4 retains the preferred encoder when compliant and selects VBR if it fixes the AVC level', async () => {
    const { selectMp4AvcEncoding } = createLoader()('export/Mp4AvcLevel.ts');
    const preferred = { fullCodecString: 'avc1.640034', bitrateMode: 'constant', bitrate: 40e6 };
    const tried = [];
    assert.equal(await selectMp4AvcEncoding(preferred, 52, async candidate => {
        tried.push(candidate);
        return 52;
    }), preferred);
    assert.deepEqual(tried, [preferred]);
    const variable = await selectMp4AvcEncoding(preferred, 52, async candidate => candidate.bitrateMode ? 51 : 52);
    assert.equal(variable.fullCodecString, preferred.fullCodecString);
    assert.equal(variable.bitrate, preferred.bitrate);
    assert.equal(variable.bitrateMode, undefined);
});

test('MP4 retries an explicitly refused codec with browser defaults and surfaces real encoder failure', async () => {
    const { selectMp4AvcEncoding } = createLoader()('export/Mp4AvcLevel.ts');
    const preferred = { fullCodecString: 'avc1.640034', bitrateMode: 'constant', bitrate: 40e6, keyFrameInterval: 1 };
    const refused = new Error('H.264 encoding is unavailable');
    const tried = [];
    const encoding = await selectMp4AvcEncoding(preferred, 52, async candidate => {
        tried.push({ ...candidate });
        if (candidate.fullCodecString) throw refused;
        return 51;
    });
    assert.deepEqual(tried.map(candidate => candidate.fullCodecString), [preferred.fullCodecString, preferred.fullCodecString, undefined]);
    assert.deepEqual(tried.map(candidate => candidate.bitrateMode), ['constant', undefined, undefined]);
    assert.equal(encoding.keyFrameInterval, 1);
    assert.equal(encoding.bitrate, preferred.bitrate);
    await assert.rejects(selectMp4AvcEncoding(preferred, 52, async () => { throw refused; }), error => error === refused);
});

test('4K worker refusal and Stop are handled before allocating the render surface', async () => {
    let worker;
    class Worker {
        constructor() { worker = this; }
        postMessage(message) { this.message = message; }
        terminate() { this.terminated = true; }
    }
    const load = createLoader({ './export.worker.ts?worker': { __esModule: true, default: Worker } }, {
        createImageBitmap: () => assert.fail('No real bitmap during preflight'), setTimeout, clearTimeout, Float32Array,
    });
    const { State } = load('state/store.ts');
    const { WebCodecsBackend } = load('export/WebCodecsBackend.ts');
    State.duration = 1;
    for (const command of ['refuse', 'stop']) {
        const backend = new WebCodecsBackend({ noLoop: () => assert.fail('Live render must remain untouched') }, {}, {}, 'track');
        const result = backend.start({ ...base, resolution: '4K', preflight: true }, () => {});
        assert.equal(worker.message.width, 3840);
        assert.equal(worker.message.height, 2160);
        assert.equal(worker.message.preflight, true);
        if (command === 'refuse') worker.onmessage({ data: { type: 'export_error', message: 'Unsupported 4K' } });
        else backend.stopAndSave();
        await assert.rejects(result, command === 'refuse' ? /Unsupported 4K/ : /No video frames/);
        assert.equal(worker.terminated, true);
        assert.equal(State.isExporting, false);
    }
});


test('high-precision MP4 uses independent pictures to preserve brief frame details', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('src/export/mp4-export.worker.ts','utf8');
    assert.match(source, /encoding = \{ codec: 'vp9', fullCodecString, bitrate, keyFrameInterval: 0,/);
    assert.match(source, /codec: 'avc', bitrate, keyFrameInterval: 1/);
    assert.match(source, /picture.add\(sample\)/);
});
