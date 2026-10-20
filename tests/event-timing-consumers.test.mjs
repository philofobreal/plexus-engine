import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader({}, { Float32Array, Float64Array, TextEncoder, crypto: webcrypto });
const { refineAcceptedEventTiming } = load('analyzer/AcceptedEventTiming.ts');
const { buildRhythmChart, RhythmGameSession, notePosition, DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');
const { computeTrackFingerprint } = load('ui/mvp/metaTuningStorage.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test('one accepted correction reaches XR hit time and spawn coherently, including seek/reset', () => {
    const fs = 44100, hop = 1024, frame = 130 * hop, samples = new Float32Array(fs * 5);
    let seed = 501;
    for (let i = 0; i < 200; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[frame + 177 + i] = .6 * (seed / 2**31 - 1) * Math.exp(-i / 66);
    }
    const sourceEvents = [{ time: frame / fs, type: 2, intensity: .9 }];
    const r = refineAcceptedEventTiming(samples, fs, hop, sourceEvents);
    assert.equal(r.report.observations[0].status, 'refined');
    const source = events => ({ events, durationSec: 5, beats: [], barStarts: [] });
    const legacy = buildRhythmChart(source(sourceEvents)), chart = buildRhythmChart(source(r.events));
    assert.equal(chart.length, legacy.length); assert.ok(chart.length > 0);
    assert.ok(chart.every(n => n.time === r.events[0].time));
    assert.deepEqual(plain(chart.map(n => n.id)), plain(legacy.map(n => n.id)));
    assert.equal(buildRhythmChart(source([])).length, 0);
    const session = new RhythmGameSession(); session.loadChart(chart); session.start();
    const spawn = chart[0].time - config.approachTimeSec;
    assert.equal(session.getActiveNotes(spawn - .0001).length, 0);
    assert.equal(session.getActiveNotes(spawn + .0001).length, chart.length);
    const atHit = notePosition(chart[0], chart[0].time, { x: 0, y: 0, z: 0 });
    assert.equal(atHit.z, 0);
    session.seek(4); session.seek(0);
    assert.equal(session.getActiveNotes(spawn + .0001).length, chart.length);
});

test('saved experimental journeys have a distinct key while legacy fingerprints remain byte compatible', async () => {
    const analysis = { bpm: 120, duration: 32, sections: [{ start: 0 }, { start: 16 }], bars: Array(16) };
    const legacy = await computeTrackFingerprint(analysis);
    const expected = createHash('sha256').update(JSON.stringify({ bpm: 120, duration: 32, sectionStarts: [0, 16], barCount: 16 })).digest('hex');
    assert.equal(legacy, expected);
    const experimental = { ...analysis, eventTiming: { algorithm: 'accepted-frame-band-timing-v1' } };
    assert.notEqual(await computeTrackFingerprint(experimental), legacy);
    assert.equal(await computeTrackFingerprint(experimental), await computeTrackFingerprint(structuredClone(experimental)));
});

test('AudioEngine opt-in crosses copy/transfer boundary and superseded results cannot publish it', async () => {
    const workers = [], pcm = new Float32Array(4410), state = { targetTuning: { phraseSize: 4 }, visualTuning: {}, modulation: {} };
    class Worker {
        constructor() { workers.push(this); }
        postMessage(request, transfer) { this.request = request; this.transfer = transfer; }
        terminate() { this.terminated = true; }
    }
    const ctx = { decodeAudioData: async () => ({ duration: .1, sampleRate: 44100, getChannelData: () => pcm }) };
    const loader = createLoader({ './analyzer.worker.ts?worker': Worker,
        '../analyzer': { ANALYSIS_ALGORITHM_VERSION: 7, createEmptyTrackAnalysis: () => ({}), normalizeTrackAnalysis: a => a, normalizeAudioFrame: a => a },
        '../config/featureFlags': { featureFlags: {} }, '../state/store': { State: state },
        '../state/visualTransitionState': { resetActiveVisualTransitions() {} }, './HeroMetronome': { HeroMetronome: {} } },
        { window: { AudioContext: function() { return ctx; } } });
    const { AudioEngine } = loader('audio/AudioEngine.ts');
    const engine = new AudioEngine(undefined, { heroMetronome: false, loopPlayback: false, eventTiming: 'local-band-v1' });
    const file = { arrayBuffer: async () => new ArrayBuffer(4) };
    await engine.loadFile(file);
    const old = workers[0], oldHandler = old.onmessage;
    assert.equal(old.request.eventTiming, 'local-band-v1');
    assert.notEqual(old.request.samples, pcm.buffer); assert.equal(pcm.byteLength, 17640);
    assert.equal(old.transfer[0], old.request.samples);
    await engine.loadFile(file); assert.equal(old.terminated, true);
    oldHandler({ data: { type: 'analysis_done', requestId: old.request.requestId, trackAnalysis: { eventTiming: { sentinel: true } } } });
    assert.equal(state.trackAnalysis.eventTiming, undefined);
    const current = workers[1];
    current.onmessage({ data: { type: 'analysis_done', requestId: current.request.requestId, bpm: 120, adaptiveThreshold: .1,
        frames: [], events: [], hopSize: 1024, trackAnalysis: { eventTiming: { algorithm: 'accepted-frame-band-timing-v1' } } } });
    assert.equal(current.terminated, true); assert.equal(state.trackAnalysis.eventTiming.algorithm, 'accepted-frame-band-timing-v1');
    const legacy = new AudioEngine(undefined, { heroMetronome: false }); await legacy.loadFile(file);
    assert.equal(Object.hasOwn(workers.at(-1).request, 'eventTiming'), false);
});
