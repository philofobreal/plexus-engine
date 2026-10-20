import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { acceptedTimingFixture } from '../research/analyzer-lab/diagnostics/measure-accepted-timing.mjs';
const load = createLoader({}, { Float32Array, Float64Array });
const { refineAcceptedEventTiming } = load('analyzer/AcceptedEventTiming.ts');
const { normalizeEventTiming } = load('types/eventTiming.ts');
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { normalizeTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
const plain = x => JSON.parse(JSON.stringify(x));
const spec = kind => ({ kind, sampleRate: 44100, phase: .25, gain: 1, polarity: 1, edge: null });

test('v2 retains gradual-ramp counterexample as abstention while v1 remains executable', () => {
    const f = acceptedTimingFixture(spec('ramp'));
    const v1 = refineAcceptedEventTiming(f.samples, 44100, 1024, f.events);
    const v2 = refineAcceptedEventTiming(f.samples, 44100, 1024, f.events, 2);
    assert.equal(v1.report.observations[0].status, 'refined');
    assert.equal(v2.report.observations[0].status, 'gradual-attack');
    assert.equal(v2.events[0].time, f.events[0].time); assert.equal(v2.report.observations[0].sampleIndex, null);
    assert.equal(v2.report.algorithm, 'accepted-frame-band-timing-v2-dc1');
    assert.equal(normalizeEventTiming(v2.report, f.samples.length / 44100,
        { sampleRate: 44100, sampleCount: f.samples.length, hopSize: 1024 }, v2.events)?.algorithm, v2.report.algorithm);
});

test('v2 real sharp attack stays localized, deterministic and invariant to polarity/binary gain', () => {
    const f = acceptedTimingFixture(spec('noise-decay'));
    const r = refineAcceptedEventTiming(f.samples, 44100, 1024, f.events, 2);
    assert.equal(r.report.observations[0].status, 'refined');
    assert.ok(Math.abs(r.events[0].time - f.truthSamples[0] / 44100) < .002);
    for (const gain of [-1, .5, 2]) {
        const other = refineAcceptedEventTiming(Float32Array.from(f.samples, x => x * gain), 44100, 1024, f.events, 2);
        assert.deepEqual(plain(other.report), plain(r.report));
    }
});

test('normalization binds event count/time and abstention support to published PCM frame', () => {
    const f = acceptedTimingFixture(spec('ramp')), report = plain(refineAcceptedEventTiming(f.samples, 44100, 1024, f.events, 2).report);
    const duration = f.samples.length / 44100, clock = { sampleRate: 44100, sampleCount: f.samples.length, hopSize: 1024 };
    assert.equal(normalizeEventTiming(report, duration, clock, []), undefined);
    assert.equal(normalizeEventTiming(report, duration, clock, [{ time: 0 }]), undefined);
    const corrupt = structuredClone(report); corrupt.observations[0].supportStartSample = 0; corrupt.observations[0].supportEndSample = 1;
    assert.equal(normalizeEventTiming(corrupt, duration, clock, f.events), undefined);
});

test('v2 worker option integrates into canonical analysis without changing accepted events or meter', () => {
    const fs = 8000, samples = new Float32Array(fs * 2);
    for (const t of [.23, .73, 1.23, 1.73]) {
        const at = Math.round(t * fs);
        for (let i = 0; i < 40; i++) samples[at + i] = .6 * Math.sin(i * 2.6 + .3) * Math.exp(-i / 12);
    }
    const old = analyzeAudio({ samples, sampleRate: fs });
    const candidate = analyzeAudio({ samples, sampleRate: fs, options: { eventTiming: 'local-band-v2' } });
    assert.equal(candidate.events.length, old.events.length);
    assert.deepEqual(plain(candidate.beats), plain(old.beats));
    assert.equal(candidate.trackAnalysis.eventTiming.algorithm, 'accepted-frame-band-timing-v2-dc1');
    const canonical = normalizeTrackAnalysis(candidate.trackAnalysis, candidate.bpm, candidate.events);
    assert.deepEqual(plain(canonical.eventTiming), plain(candidate.trackAnalysis.eventTiming));
    assert.equal(normalizeTrackAnalysis(candidate.trackAnalysis, candidate.bpm, []).eventTiming, undefined);
});

test('historical v2 publications remain readable while unknown algorithm identities are rejected', () => {
    const f = acceptedTimingFixture(spec('ramp'));
    const report = plain(refineAcceptedEventTiming(f.samples, 44100, 1024, f.events, 2).report);
    const clock = { sampleRate: 44100, sampleCount: f.samples.length, hopSize: 1024 }, duration = f.samples.length / 44100;
    report.algorithm = 'accepted-frame-band-timing-v2';
    assert.equal(normalizeEventTiming(report, duration, clock, f.events)?.algorithm, report.algorithm);
    report.algorithm = 'unknown';
    assert.equal(normalizeEventTiming(report, duration, clock, f.events), undefined);
});
