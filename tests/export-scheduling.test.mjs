import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoader } from './helpers/xr-loader.mjs';

const config = { resolution: '720p', aspectRatio: '16:9', fps: 60, runtime: 'isolated-wormhole' };

async function until(check) {
    for (let tries = 0; tries < 250; tries++) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 2));
    }
    assert.fail('Export did not reach the expected boundary');
}

function fixture(scheduling, { autoAck = false } = {}) {
    const requests = [], rendered = [], progress = [], profiles = [], watchdogs = new Map();
    let worker, animationFrames = 0, polls = 0;
    class Worker {
        constructor() { worker = this; }
        emit(data) { this.onmessage?.({ data }); }
        ack(index) {
            const request = requests.filter(message => message.type === 'encode_frame')[index];
            this.emit({ type: 'frame_encoded', timestampUs: request.timestampUs });
        }
        postMessage(message) {
            requests.push(message);
            if (message.type === 'encode_frame' && autoAck) queueMicrotask(() => {
                this.emit({ type: 'frame_encoded', timestampUs: message.timestampUs });
                this.emit({ type: 'queue_update', size: 0 });
            });
            if (message.type === 'finalize_export') queueMicrotask(() => {
                this.emit({ type: 'export_done', blob: new Blob(['video']) });
            });
        }
        terminate() { this.terminated = true; }
    }
    const load = createLoader({
        '../state/store': { State: new Proxy({}, { get() { assert.fail('Read live state'); } }) },
        './ExportBackendRegistry': { ExportBackendRegistry: { register() {} } },
        './export.worker.ts?worker': { __esModule: true, default: Worker }
    }, {
        performance, Float32Array, Blob, createImageBitmap: async () => ({ close() {} }),
        window: { requestAnimationFrame: callback => { animationFrames++; queueMicrotask(callback); } },
        setTimeout(callback, delay) {
            if (delay === 30_000) {
                const handle = Symbol('export watchdog');
                watchdogs.set(handle, callback);
                return handle;
            }
            if (delay === 2) polls++;
            return setTimeout(callback, delay);
        },
        clearTimeout: handle => typeof handle === 'symbol' ? watchdogs.delete(handle) : clearTimeout(handle)
    });
    const { WebCodecsBackend } = load('export/WebCodecsBackend.ts');
    const live = new Proxy({}, { get() { assert.fail('Read live audio or renderer'); } });
    const backend = new WebCodecsBackend(live, {}, live, 'Frozen', null, scheduling);
    const samples = new Float32Array(3200).fill(.125);
    const runtime = {
        duration: 4 / 60,
        snapshot: { width: 1280, height: 720, fps: 60, analysisId: 'a'.repeat(64), estimatedBytes: 100, budgetBytes: 200 },
        audio: { sampleRate: 48000, length: samples.length, numberOfChannels: 1, getChannelData: () => samples },
        async renderFrame(index, fps) { rendered.push([index, fps]); return {}; }
    };
    return {
        backend, requests, rendered, progress, profiles, watchdogs,
        frames: () => requests.filter(message => message.type === 'encode_frame'),
        start: () => backend.start(config, value => progress.push(value), runtime, profile => profiles.push(profile)),
        get worker() { return worker; }, get animationFrames() { return animationFrames; }, get polls() { return polls; }
    };
}

test('candidate removes display waits while preserving ordered frame/audio input and the production default', async () => {
    const baseline = fixture(undefined, { autoAck: true }), candidate = fixture('cooperative', { autoAck: true });
    await baseline.start();
    await candidate.start();
    const payloads = run => run.frames().map(frame => [frame.timestampUs, frame.audioSampleCount, [...frame.audioPlanar]]);
    assert.deepEqual(payloads(candidate), payloads(baseline));
    assert.deepEqual(candidate.rendered, [[0, 60], [1, 60], [2, 60], [3, 60]]);
    assert.deepEqual(candidate.progress, baseline.progress);
    assert.equal(baseline.animationFrames, 5);
    assert.equal(candidate.animationFrames, 0);
    assert.equal(candidate.polls, 0);
    assert.equal(baseline.profiles[0].scheduling, 'display');
    assert.equal(candidate.profiles[0].scheduling, 'cooperative');
    assert.equal(candidate.profiles[0].stagesMs.animationFrameWait, 0);
    assert.equal(candidate.watchdogs.size, 0);
});

test('cooperative queue requires both acknowledgement and capacity, and Stop saves only the admitted prefix', async () => {
    const h = fixture('cooperative');
    const job = h.start();
    await until(() => h.frames().length === 2 && h.backend.resumeQueueWait);
    h.worker.emit({ type: 'queue_update', size: 2 });
    h.worker.ack(0);
    assert.equal(h.frames().length, 2);
    assert.ok(h.backend.resumeQueueWait);
    h.worker.emit({ type: 'queue_update', size: 1 });
    await until(() => h.frames().length === 3 && h.backend.resumeQueueWait);
    h.backend.stopAndSave();
    assert.equal((await job).size, 5);
    assert.deepEqual(h.frames().map(frame => frame.timestampUs), [0, 16667, 33333]);
    assert.equal(h.requests.at(-1).type, 'finalize_export');
    assert.equal(h.profiles[0].resources.peakOutstandingFrames, 2);
    assert.equal(h.polls, 0);
    assert.equal(h.worker.terminated, true);
    assert.equal(h.backend.resumeQueueWait, null);
    assert.equal(h.watchdogs.size, 0);
});

test('Cancel, worker error and watchdog release a cooperative queue wait without finalizing', async () => {
    for (const [interrupt, message] of [
        [h => h.backend.cancelExport(), /cancelled/],
        [h => h.worker.emit({ type: 'export_error', message: 'encoder failed' }), /encoder failed/],
        [h => h.watchdogs.values().next().value(), /timed out/]
    ]) {
        const h = fixture('cooperative');
        const job = h.start();
        const rejection = assert.rejects(job, message);
        await until(() => h.frames().length === 2 && h.backend.resumeQueueWait);
        interrupt(h);
        await rejection;
        assert.deepEqual(h.requests.map(message => message.type), ['start_export', 'encode_frame', 'encode_frame']);
        assert.equal(h.worker.terminated, true);
        assert.equal(h.backend.resumeQueueWait, null);
        assert.equal(h.watchdogs.size, 0);
    }
});
