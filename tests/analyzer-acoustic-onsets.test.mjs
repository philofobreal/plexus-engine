import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { impulsePhaseCorpus, attackCorpus, pairedSampleMetrics } from './fixtures/acoustic-onset-fixtures.mjs';
const load = createLoader({}, { Float32Array, Float64Array });
const { extractAcousticOnsets } = load('analyzer/AcousticOnsets.ts');
const { magnitudeFlatness } = load('analyzer/math/SpectralFlatness.ts');
const { applyEMA, applyEMAInSeconds } = load('analyzer/TemporalSmoother.ts');
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { normalizeTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');

test('independent flatness arithmetic is bounded, gain invariant, and uses the same stabilized bins', () => {
    assert.equal(magnitudeFlatness([1, 1, 1]), 1);
    assert.equal(magnitudeFlatness([0, 0, 0]), 0);
    assert.ok(Math.abs(magnitudeFlatness([1, 2, 4]) - 6 / 7) < 1e-12);
    const values = [1, .3, .7, .00001];
    for (const gain of [1, 1e-6, 1e-10, 8]) {
        assert.ok(Math.abs(magnitudeFlatness(values.map(v => v * gain)) - magnitudeFlatness(values)) < 1e-12);
    }
    assert.ok(magnitudeFlatness([0, 1, 0]) < 1e-6);
    for (const bad of [[NaN], [-1], [Infinity]]) assert.throws(() => magnitudeFlatness(bad));
});

test('clock-based EMA follows the defining time response and retains the legacy reference coefficient', () => {
    for (const sampleRate of [8000, 22050, 44100, 48000, 96000]) for (const hopSize of [128, 512, 1024]) {
        const input = new Float32Array(25).fill(1); input[0] = 0;
        const output = applyEMAInSeconds(input, sampleRate, hopSize, .08);
        for (let i = 0; i < output.length; i++) assert.ok(Math.abs(output[i] - (1 - Math.exp(-i * hopSize / sampleRate / .08))) < 1e-7);
    }
    const input = Float32Array.from([0, 1, 1, .5, 0, 0]);
    const tau = -(1024 / 44100) / Math.log(1 - .1);
    assert.deepEqual(Array.from(applyEMAInSeconds(input, 44100, 1024, tau)), Array.from(applyEMA(input, .1)));
    for (const tauSeconds of [0, -1, NaN, Infinity]) assert.throws(() => applyEMAInSeconds(input, 44100, 128, tauSeconds));
});

test('overlap observes and sample-localizes all 1024 legacy window phases', () => {
    const fixture = impulsePhaseCorpus(44100, Array.from({ length: 1024 }, (_, i) => i));
    const result = extractAcousticOnsets(fixture.samples, fixture.sampleRate);
    const metrics = pairedSampleMetrics(result.candidates, fixture.truthSamples, 0);
    assert.equal(metrics.matchedCount, 1024, JSON.stringify(metrics));
    assert.equal(metrics.falsePositives, 0); assert.equal(metrics.misses, 0);
    assert.equal(metrics.maximumAbsoluteSamples, 0);
});

for (const sampleRate of [8000, 16000, 22050, 44100, 48000, 96000]) for (const hopSize of [128, 256]) {
    test(`all acoustic phases plus legacy boundaries at ${sampleRate} Hz / ${hopSize} hop`, () => {
        const fixture = impulsePhaseCorpus(sampleRate, [...Array.from({ length: hopSize }, (_, i) => i), 511, 512, 1023]);
        const result = extractAcousticOnsets(fixture.samples, sampleRate, { windowSize: 512, hopSize });
        const metrics = pairedSampleMetrics(result.candidates, fixture.truthSamples, 0);
        assert.equal(metrics.misses, 0, JSON.stringify(metrics)); assert.equal(metrics.falsePositives, 0, JSON.stringify(metrics));
        assert.equal(metrics.maximumAbsoluteSamples, 0);
    });
}

test('real first/last-sample and partial-tail evidence is observed, bounded and explicitly ambiguous', () => {
    for (const hopSize of [128, 256]) for (const length of [1, 511, 512, 1024, 1025, 8192 + 73]) for (const at of [0, length - 1]) {
        const samples = new Float32Array(length); samples[at] = .5;
        const result = extractAcousticOnsets(samples, 44100, {windowSize: 512, hopSize});
        assert.equal(result.candidates.length, 1, `${length}/${at}`);
        const candidate = result.candidates[0];
        assert.equal(candidate.sampleIndex, at); assert.equal(candidate.time, at / 44100);
        assert.equal(candidate.endpointAmbiguous, true);
        assert.ok(candidate.supportStartSample <= at && candidate.supportEndSample > at && candidate.supportEndSample <= length);
    }
});

test('silence/DC/sustain/fadeout cutoffs provide no interior or terminal attacks', () => {
    for (const sampleRate of [8000, 44100, 48000]) for (const hz of [0, 40, 110, 440, 1000]) for (const phase of [0, Math.PI / 3]) {
        const samples = Float32Array.from({ length: Math.round(sampleRate * .4) + 73 }, (_, i) => hz === 0 ? .2 : .2 * Math.sin(2 * Math.PI * hz * i / sampleRate + phase));
        const result = extractAcousticOnsets(samples, sampleRate);
        assert.equal(result.candidates.filter(c => c.sampleIndex >= sampleRate * .08).length, 0, `${sampleRate}/${hz}/${phase}`);
        const faded = Float32Array.from(samples, (v, i) => v * Math.max(0, 1 - i / samples.length));
        assert.equal(extractAcousticOnsets(faded, sampleRate).candidates.filter(c => c.sampleIndex >= sampleRate * .08).length, 0);
    }
    assert.equal(extractAcousticOnsets(new Float32Array(4096), 44100).candidates.length, 0);
});

for (const kind of ['noise', 'pluck']) test(`fixed ${kind} waveforms preserve separated attacks with disclosed sample localization`, () => {
    for (const sampleRate of [8000, 44100, 48000]) {
        const fixture = attackCorpus(sampleRate, kind), copy = fixture.samples.slice();
        const result = extractAcousticOnsets(fixture.samples, sampleRate);
        const metrics = pairedSampleMetrics(result.candidates, fixture.truthSamples, Math.ceil(.012 * sampleRate));
        assert.equal(metrics.misses, 0, JSON.stringify(metrics)); assert.equal(metrics.falsePositives, 0, JSON.stringify(metrics));
        assert.deepEqual(fixture.samples, copy);
        assert.equal(JSON.stringify(result), JSON.stringify(extractAcousticOnsets(fixture.samples, sampleRate)));
    }
});

test('the declared 15 ms candidate separation retains stronger evidence and keeps distinct later attacks', () => {
    const samples = new Float32Array(44100);
    samples[8820] = .2; samples[9261] = .8; samples[22050] = .4;
    const result = extractAcousticOnsets(samples, 44100);
    assert.deepEqual(Array.from(result.candidates, c => c.sampleIndex), [9261, 22050]);
});

test('invalid overlap/input is rejected and optional evidence survives transport without changing accepted events', () => {
    for (const options of [null, true, [], {windowSize: 511}, {hopSize: 0}, {windowSize: 512, hopSize: 512}, {windowSize: 512, hopSize: 64}]) {
        assert.throws(() => extractAcousticOnsets(new Float32Array(2048), 44100, options));
    }
    assert.throws(() => extractAcousticOnsets(Float32Array.from([Infinity]), 44100));
    const fixture = attackCorpus(8000, 'noise');
    const legacy = analyzeAudio({samples: fixture.samples, sampleRate: 8000});
    const enabled = analyzeAudio({samples: fixture.samples, sampleRate: 8000, options: {acousticOnsets: {}}});
    assert.deepEqual(enabled.events, legacy.events); assert.deepEqual(enabled.frames, legacy.frames);
    const without = {...enabled.trackAnalysis}; delete without.acousticOnsets;
    assert.equal(JSON.stringify(without), JSON.stringify(legacy.trackAnalysis));
    const transported = normalizeTrackAnalysis(JSON.parse(JSON.stringify(enabled.trackAnalysis)));
    assert.deepEqual(JSON.parse(JSON.stringify(transported.acousticOnsets)), JSON.parse(JSON.stringify(enabled.trackAnalysis.acousticOnsets)));
    assert.notEqual(transported.acousticOnsets.candidates, enabled.trackAnalysis.acousticOnsets.candidates);
    const bad = JSON.parse(JSON.stringify(enabled.trackAnalysis)); bad.acousticOnsets.candidates[0].time = NaN;
    assert.equal(normalizeTrackAnalysis(bad).acousticOnsets, undefined);
    bad.acousticOnsets.candidates = [null];
    assert.equal(normalizeTrackAnalysis(bad).acousticOnsets, undefined);
    for (const malformed of [null, false, 0, '']) {
        const payload = {...enabled.trackAnalysis, acousticOnsets: malformed};
        assert.equal(normalizeTrackAnalysis(payload).acousticOnsets, undefined);
    }
    const otherClock = JSON.parse(JSON.stringify(enabled.trackAnalysis));
    otherClock.acousticOnsets.sampleRate *= 2; otherClock.acousticOnsets.sampleCount *= 2;
    for (const c of otherClock.acousticOnsets.candidates) c.time = c.sampleIndex / otherClock.acousticOnsets.sampleRate;
    assert.equal(normalizeTrackAnalysis(otherClock).acousticOnsets, undefined);
    const badSupport = JSON.parse(JSON.stringify(enabled.trackAnalysis));
    badSupport.acousticOnsets.candidates[0].supportStartSample = 0;
    badSupport.acousticOnsets.candidates[0].supportEndSample = fixture.samples.length;
    assert.equal(normalizeTrackAnalysis(badSupport).acousticOnsets, undefined);
    const endpointSamples = new Float32Array(4096); endpointSamples[0] = 1;
    const endpoint = analyzeAudio({samples: endpointSamples, sampleRate: 8000, options: {acousticOnsets: {}}}).trackAnalysis;
    endpoint.acousticOnsets.candidates[0].endpointAmbiguous = false;
    assert.equal(normalizeTrackAnalysis(endpoint).acousticOnsets, undefined);
    let progress = 0;
    assert.throws(() => analyzeAudio({samples: fixture.samples, sampleRate: 8000, options: {acousticOnsets: {windowSize: 511}}, onProgress: () => progress++}));
    assert.equal(progress, 0);
    assert.equal(normalizeTrackAnalysis(legacy.trackAnalysis).acousticOnsets, undefined);
});
