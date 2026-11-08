import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const { readExportPerformance, resolveExportPerformance } = createLoader()('export/ExportPerformance.ts');
const report = { version: 1, requested: 'turbo', active: 'turbo', scheduling: 'cooperative', frameSource: 'exact',
    outcome: 'completed', framesSubmitted: 90, peakOutstandingFrames: 2, audioPoolLimitBytes: 25600,
    hostMs: { total: 1000, renderRequest: 700 }, workerMs: { videoSubmit: 500 } };

test('performance reports copy bounded scalar timing records without accepting payloads or impossible resource claims', () => {
    const input = { ...report, pcm: new Float32Array(400), arbitrary: 'private' };
    const owned = readExportPerformance(input);
    assert.ok(owned);
    assert.deepEqual({...resolveExportPerformance('turbo','mp4')}, {requested:'turbo',active:'economy',fallbackReason:'mp4-throughput-unqualified'});
    assert.equal(readExportPerformance({...report,active:'economy'}),null);
    assert.equal(readExportPerformance({...report,active:'economy',fallbackReason:'mp4-throughput-unqualified'}).active,'economy');
    assert.equal(owned.pcm, undefined);
    assert.equal(owned.arbitrary, undefined);
    owned.hostMs.total = 1; owned.workerMs.videoSubmit = 1;
    assert.equal(report.hostMs.total, 1000); assert.equal(report.workerMs.videoSubmit, 500);
    for (const change of [{ peakOutstandingFrames: 3 }, { framesSubmitted: -1 }, { active: 'unknown' },
        { hostMs: { total: NaN } }, { workerMs: { audio: new Float32Array(2) } },
        { hostMs: Object.fromEntries(Array.from({length:21}, (_,i) => ['stage'+i, i])) }]) {
        assert.equal(readExportPerformance({ ...report, ...change }), null);
    }
});

function workerHarness(turbo) {
    const messages = [], timers = [], closed = [];
    let encoder, dequeueListeners = 0;
    class Encoder extends EventTarget {
        encodeQueueSize = 0;
        constructor(init) { super(); this.init = init; encoder = this; }
        addEventListener(...args) { dequeueListeners++; super.addEventListener(...args); }
        configure() {}
        encode() { this.encodeQueueSize++; }
        async flush() {}
        close() { closed.push('encoder'); }
    }
    const self = { VideoEncoder: Encoder, VideoFrame: class { close() { closed.push('frame'); } },
        postMessage: (data, transfer) => messages.push({data,transfer}) };
    const load = createLoader({}, { self, performance, TextEncoder, TextDecoder, Blob,
        setInterval: callback => { timers.push(callback); return 1; }, clearInterval() {},
        navigator: { storage: { async getDirectory() { return { async getFileHandle() { return {
            async createSyncAccessHandle() { return { truncate() {}, write(c) { return c.byteLength; }, flush() {}, close() {} }; },
            async getFile() { return new Blob(['video']); }
        }; } }; } } }
    });
    load('export/export.worker.ts');
    return { self, messages, timers, closed, get encoder() { return encoder; }, get dequeueListeners() { return dequeueListeners; },
        async start() { await self.onmessage({data:{type:'start_export',width:1280,height:720,fps:60,sampleRate:48000,...(turbo?{queueEvents:true}:{})}}); } };
}

test('Turbo worker publishes native dequeue capacity immediately, preserving the legacy periodic backstop', async () => {
    const turbo = workerHarness(true), economy = workerHarness(false);
    await turbo.start(); await economy.start();
    for(const h of [turbo,economy]) {
        for(let i=0;i<2;i++) await h.self.onmessage({data:{type:'encode_frame',bitmap:{close(){h.closed.push('bitmap');}},timestampUs:Math.round(i*1e6/60)}});
        assert.equal(h.messages.filter(m=>m.data.type==='frame_encoded').length,2);
        assert.equal(h.closed.filter(s=>s==='bitmap').length,2);
        assert.equal(h.timers.length,1);
    }
    assert.equal(economy.dequeueListeners,0);
    assert.equal(economy.messages.filter(m=>m.data.type==='queue_update').length,0);
    assert.equal(turbo.dequeueListeners,1);
    assert.equal(turbo.messages.filter(m=>m.data.type==='queue_update').at(-1).data.size,2);
    const count = turbo.messages.length;
    turbo.encoder.encodeQueueSize = 1;
    turbo.encoder.dispatchEvent(new Event('dequeue'));
    assert.equal(turbo.messages.length,count+1);
    assert.equal(turbo.messages.at(-1).data.size,1);
    turbo.encoder.encodeQueueSize = 0;
    turbo.timers[0]();
    assert.equal(turbo.messages.at(-1).data.size,0);
});

test('Turbo yields through one reusable task channel, closes both ports and ignores prior-job messages on retry', async () => {
    const channels = [];
    class Channel {
        constructor() {
            this.port1 = { onmessage: null, close() { this.closed = true; } };
            this.port2 = { postMessage() {}, close() { this.closed = true; } };
            channels.push(this);
        }
    }
    const loader = createLoader({
        './ExportBackendRegistry': { ExportBackendRegistry: { register() {} } },
        './export.worker.ts?worker': { __esModule: true, default: class {} },
    }, { MessageChannel: Channel });
    const Backend = loader('export/WebCodecsBackend.ts').WebCodecsBackend;
    const backend = new Backend({}, {}, {}, 'test');
    let settled = false;
    const first = backend.yieldToBrowser().then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    channels[0].port1.onmessage(); await first;
    assert.equal(settled, true);
    const second = backend.yieldToBrowser();
    assert.equal(channels.length, 1);
    const late = channels[0].port1.onmessage;
    backend.running = true;
    backend.cancelExport(); await second; await backend.cleanup();
    assert.equal(channels[0].port1.closed, true);
    assert.equal(channels[0].port2.closed, true);
    settled = false;
    const retry = backend.yieldToBrowser().then(() => { settled = true; });
    assert.equal(channels.length, 2);
    late(); await Promise.resolve(); assert.equal(settled, false);
    channels[1].port1.onmessage(); await retry;
    backend.running = true; await backend.cleanup();
    assert.equal(channels[1].port1.closed, true);
    assert.equal(channels[1].port2.closed, true);
});
