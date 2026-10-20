import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
const plain = value => JSON.parse(JSON.stringify(value));

test('default, v1 and corrected-v2 worker requests exactly match their direct analyzer publications', () => {
    const sampleRate = 22050, samples = new Float32Array(sampleRate * 4);
    let seed = 137;
    for (let beat = 1; beat < 8; beat++) {
        const at = Math.round(beat * .5 * sampleRate) + 137;
        for (let i = 0; i < 150; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            samples[at + i] = .6 * (seed / 2**31 - 1) * Math.exp(-i / 40);
        }
    }
    const before = samples.slice(), messages = [], self = { postMessage: message => messages.push(message) };
    const load = createLoader({}, { self, Float32Array, Float64Array });
    const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
    load('audio/analyzer.worker.ts');
    for (const [i, mode] of [undefined, 'local-band-v1', 'local-band-v2'].entries()) {
        messages.length = 0;
        const options = { requestId: i + 1, algorithmVersion: 7, phraseSize: 4, ...(mode ? { eventTiming: mode } : {}) };
        const expected = analyzeAudio({ samples, sampleRate, options });
        self.onmessage({ data: { ...options, sampleRate, samples: samples.buffer } });
        const done = messages.find(m => m.type === 'analysis_done');
        assert.ok(done, mode ?? 'default');
        const { type, ...actual } = done;
        assert.deepEqual(plain(actual), plain(expected));
        assert.ok(actual.events.length > 0);
        if (mode) assert.equal(actual.trackAnalysis.eventTiming.observations.length, actual.events.length);
        else assert.equal(actual.trackAnalysis.eventTiming, undefined);
    }
    assert.deepEqual(samples, before);
});
