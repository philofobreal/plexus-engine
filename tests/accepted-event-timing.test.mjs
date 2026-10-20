import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader({}, { Float32Array, Float64Array });
const { refineAcceptedEventTiming, retimePercussiveCues } = load('analyzer/AcceptedEventTiming.ts');
const { normalizeEventTiming } = load('types/eventTiming.ts');
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { normalizeTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const FS = 44100, H = 1024;
function hit(samples, at, amplitude = .6) {
    let seed = 501;
    for (let i = 0; i < Math.round(.005 * FS) && at + i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[at + i] += amplitude * (seed / 2**31 - 1) * Math.exp(-i / FS / .0015);
    }
}
function fixture() {
    const samples = new Float32Array(FS), frame = 10 * H, attack = frame + 177;
    hit(samples, attack);
    return { samples, frame, attack, events: [{ time: frame / FS, intensity: .9, type: 2 }] };
}

test('observed accepted-frame attack is localized without changing event identity, grid or PCM', () => {
    const f = fixture(), before = Array.from(f.samples), original = plain(f.events);
    const result = refineAcceptedEventTiming(f.samples, FS, H, f.events), o = result.report.observations[0];
    assert.equal(o.status, 'refined');
    assert.ok(Math.abs(o.sampleIndex - f.attack) / FS <= .002);
    assert.ok(Math.abs(result.events[0].time - f.attack / FS) < Math.abs(f.events[0].time - f.attack / FS));
    assert.equal(result.events.length, f.events.length);
    assert.equal(result.events[0].type, 2); assert.equal(result.events[0].intensity, .9);
    assert.deepEqual(plain(f.events), original); assert.deepEqual(Array.from(f.samples), before);
    assert.deepEqual(plain(result), plain(refineAcceptedEventTiming(f.samples, FS, H, f.events)));
    for (const gain of [-1, .5, 2]) {
        const r = refineAcceptedEventTiming(Float32Array.from(f.samples, x => x * gain), FS, H, f.events);
        assert.equal(r.report.observations[0].sampleIndex, o.sampleIndex);
    }
});

test('two distinct attacks retain original timing rather than choosing an arbitrary target', () => {
    const f = fixture(); hit(f.samples, f.frame + 700);
    const r = refineAcceptedEventTiming(f.samples, FS, H, f.events);
    assert.equal(r.report.observations[0].status, 'ambiguous');
    assert.equal(r.events[0].time, f.events[0].time);
    assert.equal(r.report.observations[0].sampleIndex, null);
});

test('unsupported edges, silence, below-floor and sustained tone abstain; empty accepted events stay empty', () => {
    const frame = 10 * H, events = [{ time: frame / FS, intensity: .8, type: 1 }];
    for (const samples of [new Float32Array(FS), Float32Array.from({ length: FS }, () => 1e-8),
        Float32Array.from({ length: FS }, (_, i) => .1 * Math.sin(2 * Math.PI * 223 * i / FS))]) {
        const r = refineAcceptedEventTiming(samples, FS, H, events);
        assert.notEqual(r.report.observations[0].status, 'refined');
        assert.equal(r.events[0].time, events[0].time);
    }
    const f = fixture();
    assert.equal(refineAcceptedEventTiming(f.samples, FS, H, []).events.length, 0);
    for (const time of [0, 42 * H / FS]) {
        const r = refineAcceptedEventTiming(f.samples, FS, H, [{ ...events[0], time }]);
        assert.equal(r.report.observations[0].status, 'insufficient-support');
    }
});

test('clock, ordered accepted events and physical PCM are validated before extraction', () => {
    const f = fixture();
    for (const events of [[f.events[0], f.events[0]], [{ ...f.events[0], time: NaN }],
        [{ ...f.events[0], time: .12345 }], [{ ...f.events[0], type: 9 }]])
        assert.throws(() => refineAcceptedEventTiming(f.samples, FS, H, events));
    assert.throws(() => refineAcceptedEventTiming(Float32Array.of(NaN), FS, H, []));
    assert.throws(() => refineAcceptedEventTiming(f.samples, 44100.5, H, f.events));
});

test('only explicitly onset-backed impact cues follow timing; other semantic cue times survive', () => {
    const f = fixture(), { report } = refineAcceptedEventTiming(f.samples, FS, H, f.events);
    const cue = { time: f.events[0].time, kind: 'impact', intensity: .8, confidence: .9, duration: .1 };
    const input = [{ ...cue, reasons: ['percussive-onset'] }, { ...cue }, { ...cue, kind: 'break', reasons: ['percussive-onset'] }];
    const result = retimePercussiveCues(input, report);
    assert.equal(result.filter(c => c.time === report.observations[0].time).length, 1);
    assert.equal(result.filter(c => c.time === f.events[0].time).length, 2);
    assert.equal(input[0].time, f.events[0].time);
});

test('additive report survives JSON and rejects malformed clock, support, index and retiming', () => {
    const f = fixture(), report = plain(refineAcceptedEventTiming(f.samples, FS, H, f.events).report);
    const clock = { sampleRate: FS, sampleCount: f.samples.length, hopSize: H };
    const copy = normalizeEventTiming(report, 1, clock);
    assert.deepEqual(plain(copy), report); copy.observations[0].time = 0;
    assert.notEqual(report.observations[0].time, 0);
    const mutations = [r => r.sampleRate++, r => r.policy = 'qualified', r => r.observations[0].sampleIndex = -1,
        r => r.observations[0].supportEndSample = FS + 1, r => r.observations[0].time += .01,
        r => r.observations[0].eventIndex++, r => r.observations[0].status = 'certain'];
    for (const mutate of mutations) {
        const bad = structuredClone(report); mutate(bad);
        assert.equal(normalizeEventTiming(bad, 1, clock), undefined);
    }
    assert.equal(normalizeEventTiming(report, 1), undefined);
});

test('actual analyzer and worker publish the same opt-in correction with default grid and event counts', () => {
    const samples = new Float32Array(FS * 4);
    for (let i = 1; i < 8; i++) hit(samples, Math.round(i * .5 * FS) + 137);
    const base = analyzeAudio({ samples, sampleRate: FS });
    const refined = analyzeAudio({ samples, sampleRate: FS, options: { eventTiming: 'local-band-v1', requestId: 7 } });
    assert.equal(refined.events.length, base.events.length); assert.ok(base.events.length > 0);
    assert.equal(base.trackAnalysis.eventTiming, undefined);
    assert.deepEqual(plain(refined.beats), plain(base.beats)); assert.deepEqual(plain(refined.barStarts), plain(base.barStarts));
    assert.deepEqual(plain(refined.events.map(e => [e.type, e.intensity])), plain(base.events.map(e => [e.type, e.intensity])));
    assert.deepEqual(plain(normalizeTrackAnalysis(refined.trackAnalysis).eventTiming), plain(refined.trackAnalysis.eventTiming));
    const messages = [], self = { postMessage: message => messages.push(message) };
    createLoader({}, { self, Float32Array, Float64Array })('audio/analyzer.worker.ts');
    self.onmessage({ data: { requestId: 7, algorithmVersion: 7, phraseSize: 4, samples: samples.buffer,
        sampleRate: FS, eventTiming: 'local-band-v1' } });
    const done = messages.find(m => m.type === 'analysis_done');
    assert.ok(done); assert.deepEqual(plain(done.events), plain(refined.events));
    assert.deepEqual(plain(done.trackAnalysis.eventTiming), plain(refined.trackAnalysis.eventTiming));
    self.onmessage({ data: { requestId: 8, samples: samples.buffer, sampleRate: FS, eventTiming: 'wrong' } });
    assert.equal(messages.at(-1).type, 'analysis_error'); assert.equal(messages.at(-1).requestId, 8);
});
