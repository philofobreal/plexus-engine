import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoader } from './helpers/xr-loader.mjs';

const base = { resolution: '720p', aspectRatio: '16:9', fps: 60 };
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
