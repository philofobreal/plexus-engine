import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoader } from './helpers/xr-loader.mjs';

const base = { resolution: '720p', aspectRatio: '16:9', fps: 60 };

test('a new or unreadable format preference starts MP4, while an explicit WebM choice survives reopening', () => {
    const saved = new Map(), starts = [];
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
        localStorage: {
            getItem(key) { if (!storageAvailable) throw Error('Storage disabled'); return saved.get(key); },
            setItem(key, value) { saved.set(key, value); },
        },
    });
    const { ExportDialog } = load('ui/mvp/ExportDialog.ts');
    const open = () => new ExportDialog({ onStart: config => starts.push(config.format ?? 'webm'), onStop() {}, onCancel() {} });
    const start = dialog => dialog.root.querySelector('.mvp-export-start').dispatchEvent(new Event('click'));
    const first = open();
    start(first);
    const select = first.root.querySelector('.mvp-export-format');
    select.value = 'webm';
    select.dispatchEvent(new Event('change'));
    start(open());
    storageAvailable = false;
    start(open());
    assert.deepEqual(starts, ['mp4', 'webm', 'mp4']);
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
