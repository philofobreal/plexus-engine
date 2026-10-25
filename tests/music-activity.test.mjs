import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';
import { activityFixture, ACTIVITY_KINDS, ACTIVITY_TUPLES, entryFixture, ENTRY_KINDS, ACTIVITY_V1_SHA256 } from './fixtures/music-activity-corpus.mjs';
const load = createLoader({}, { Float32Array, Float64Array, Uint32Array, Int32Array });
const { MusicActivity } = load('analyzer/MusicActivity.ts');
const { FeatureExtractor } = load('analyzer/FeatureExtractor.ts');
const { normalizeAcousticActivity } = load('types/musicEvents.ts');
const json = x => JSON.parse(JSON.stringify(x));
function extract(fixture, hop = 512) {
    const activity = new MusicActivity(fixture.samples, fixture.sampleRate, hop);
    const features = new FeatureExtractor(fixture.samples, fixture.sampleRate, hop);
    features.process(undefined, (start, re, im) => activity.observe(start, re, im));
    return activity.finish();
}

test('silence, DC and below-floor PCM have no attacks, activity or fabricated voices', () => {
    for (const kind of ['silence', 'dc', 'below-floor']) {
        const result = extract(activityFixture(kind));
        assert.equal(result.attacks.length, 0, kind); assert.equal(result.activity.length, 0, kind);
        assert.ok(result.dominance.every(d => ['unknown', 'silence'].includes(d.texture)), kind);
        assert.equal(result.confidence, null); assert.equal(result.xrScoring, 'ineligible');
        assert.equal(result.capabilities.vocal, 'unsupported'); assert.equal(result.capabilities.noteIdentity, 'unsupported');
    }
});

test('held tone, noise, legato and vibrato do not become an attack on every changed spectral window', () => {
    for (const kind of ['held-tone', 'noise', 'legato', 'vibrato']) {
        const f = activityFixture(kind), result = extract(f);
        assert.equal(result.attacks.length, 1, kind);
        assert.ok(Math.abs(result.attacks[0].time - f.attacks[0]) <= .04, kind);
        assert.equal(result.activity.length, 1, kind); assert.ok(result.activity[0].sustainSamples, kind);
        assert.ok(result.dominance.some(d => d.texture === (kind === 'noise' ? 'broadband' : 'tonal')), kind);
        assert.ok(result.dominance.length <= 5, kind + ' stable dominance');
    }
});

test('constant DC does not turn noise into tonal activity or move acoustic boundaries', () => {
    for (const kind of ['held-tone', 'noise', 'noise-hit', 'overlap', 'tail']) {
        const original = activityFixture(kind), baseline = extract(original);
        for (const dc of [.1, .5, -1]) {
            const shifted = { ...original, samples: Float32Array.from(original.samples, x => x + dc) }, result = extract(shifted);
            assert.deepEqual(json(result.activity), json(baseline.activity), kind);
            assert.deepEqual(result.attacks.map(a => a.family), baseline.attacks.map(a => a.family), kind);
            assert.deepEqual(json(result.dominance), json(baseline.dominance), kind);
            assert.equal(result.attacks.length, baseline.attacks.length);
            for (let i = 0; i < result.attacks.length; i++) assert.ok(Math.abs(result.attacks[i].sampleIndex - baseline.attacks[i].sampleIndex) <= 1, kind);
        }
    }
});

test('separated re-articulations and an energetic overlapping transient keep distinct acoustic evidence', () => {
    for (const kind of ['repeat', 'dense', 'overlap', 'noise-hit']) {
        const f = activityFixture(kind), result = extract(f);
        for (const time of f.attacks) assert.ok(result.attacks.some(a => Math.abs(a.time - time) <= .04), kind + ' ' + time);
        assert.equal(result.attacks.length, f.attacks.length, kind + ' no extras');
        if (kind === 'repeat') assert.equal(result.activity.length, 3);
        if (kind === 'overlap') { assert.equal(result.activity.length, 1); assert.ok(result.attacks.some(a => a.family !== 'tonal')); }
    }
});

test('boundaries include actual observed support; clipped starts and tails do not assert note onsets or offsets', () => {
    const f = activityFixture('held-tone'), r = extract(f), a = r.activity[0];
    const onset = Math.round(f.attacks[0] * f.sampleRate), offset = Math.round(f.offsets[0] * f.sampleRate);
    assert.ok(a.onsetSupportSamples[0] <= onset && onset < a.onsetSupportSamples[1]);
    assert.ok(a.offsetSupportSamples[0] <= offset && offset <= a.offsetSupportSamples[1]);
    assert.equal(a.leftCensored, false); assert.equal(a.rightCensored, false);
    const tail = extract(activityFixture('tail')).activity.at(-1);
    assert.equal(tail.rightCensored, true); assert.equal(tail.offsetSupportSamples, null);
    const start = extract(activityFixture('start-clipped'));
    assert.equal(start.activity[0].leftCensored, true); assert.equal(start.activity[0].onsetSupportSamples, null);
    assert.equal(start.attacks.length, 0, 'no observed pre-start silence');
    for (const d of r.dominance) assert.ok(d.decisionSample >= d.startSample && d.decisionSample <= f.samples.length);
});

test('fixed transfer tuples and window phases preserve authored attacks and negative behavior', () => {
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const kind of ACTIVITY_KINDS) {
        const f = activityFixture(kind, tuple), result = extract(f, 1024);
        assert.ok(normalizeAcousticActivity(result, result.clock), kind);
        const tolerance = 1024 / tuple.sampleRate + .004;
        for (const time of f.attacks) assert.ok(result.attacks.some(a => Math.abs(a.time - time) <= tolerance), kind + ' ' + time);
        assert.equal(result.attacks.length, f.attacks.length, kind + ' ' + tuple.sampleRate);
    }
});

test('normalization binds clock/interval/association semantics, clones publication and rejects forged musical claims', () => {
    const source = json(extract(activityFixture('repeat'))), normal = normalizeAcousticActivity(source, source.clock);
    assert.deepEqual(json(normal), source); normal.attacks[0].supportSamples[0]++;
    assert.notDeepEqual(json(normal), source);
    for (const mutate of [x => x.confidence = .99, x => x.capabilities.vocal = 'supported', x => x.xrScoring = 'eligible',
        x => x.clock.sampleRate++, x => x.activity[0].id = 'voice-1', x => x.activity[0].endSample = -1,
        x => x.attacks[0].sampleIndex++, x => x.attacks[0].family = 'vocal', x => x.attacks[0].strengthRms = NaN,
        x => x.dominance[0].decisionSample = x.clock.sampleCount - 1, x => x.activity[0].startSample++,
        x => { const a = x.dominance[2]; a.startSample = x.dominance[1].startSample + x.clock.hopSize;
            x.dominance[1].endSample = a.startSample; a.decisionSample = a.startSample + x.clock.hopSize; },
        x => { const a = x.activity.at(-1); a.endSample = x.clock.sampleCount; a.offsetSupportSamples = [a.endSample - x.clock.hopSize, a.endSample]; a.sustainSamples = [a.startSample, a.endSample]; },
        x => x.dominance[0].endSample--, x => x.dominance[0].texture = 'drums', x => x.attacks.reverse()]) {
        const bad = json(source); mutate(bad); assert.equal(normalizeAcousticActivity(bad, source.clock), undefined);
    }
    assert.equal(normalizeAcousticActivity(source, undefined), undefined);
});

test('spectrum observer is read-only and legacy numeric analysis/chart data is exact', () => {
    const f = activityFixture('overlap'), samples = f.samples.slice(), activity = new MusicActivity(f.samples, f.sampleRate, 512);
    const features = new FeatureExtractor(f.samples, f.sampleRate, 512);
    features.process(undefined, (start, re, im) => {
        const a = re.slice(), b = im.slice(); activity.observe(start, re, im); assert.deepEqual(re, a); assert.deepEqual(im, b);
    });
    assert.deepEqual(samples, f.samples);
    const current = load('analyzer/analyzeAudio.ts').analyzeAudio;
    const legacy = createLoader({ './MusicActivity': { MusicActivity: class { observe() {} finish() { return undefined; } } } },
        { Float32Array, Float64Array })('analyzer/analyzeAudio.ts').analyzeAudio;
    const input = { samples: f.samples, sampleRate: f.sampleRate }, a = json(current(input)), b = json(legacy(input));
    assert.ok(a.trackAnalysis.musicActivity); delete a.trackAnalysis.musicActivity; assert.deepEqual(a, b);
    assert.deepEqual(f.samples, samples);
});

test('worker transports the layer, normalizer drops malformed evidence and old payload remains unchanged', () => {
    const messages = [], self = { postMessage: m => messages.push(m) };
    const worker = createLoader({}, { self, Float32Array, Float64Array }); worker('audio/analyzer.worker.ts');
    const samples = activityFixture('held-tone').samples;
    self.onmessage({ data: { samples: samples.buffer, sampleRate: 16000, requestId: 39 } });
    const result = messages.find(m => m.type === 'analysis_done'); assert.ok(result); assert.equal(result.requestId, 39);
    const n = load('analyzer/normalizeAnalysisResult.ts');
    assert.deepEqual(json(n.normalizeTrackAnalysis(result.trackAnalysis, result.bpm, result.events).musicActivity), json(result.trackAnalysis.musicActivity));
    assert.equal(n.normalizeTrackAnalysis(n.createEmptyTrackAnalysis()).musicActivity, undefined);
    result.trackAnalysis.musicActivity.capabilities.vocal = 'supported';
    assert.equal(n.normalizeTrackAnalysis(result.trackAnalysis, result.bpm, result.events).musicActivity, undefined);
});

test('invalid PCM and incomplete/misaligned spectra fail explicitly; unresolved short windows keep unknown family', () => {
    assert.throws(() => new MusicActivity(new Float32Array(), 16000, 512));
    assert.throws(() => new MusicActivity(Float32Array.of(NaN), 16000, 512));
    assert.throws(() => new MusicActivity(new Float32Array(1024), 0, 512));
    const activity = new MusicActivity(new Float32Array(1024), 16000, 512);
    assert.throws(() => activity.finish(), /coverage/);
    assert.throws(() => activity.observe(1, new Float32Array(512), new Float32Array(512)), /clock/);
    for (const hop of [32, 64, 128, 256]) {
    const tiny = extract(activityFixture('held-tone'), hop);
    assert.ok(tiny.attacks.every(a => a.family === 'unknown'));
    assert.ok(tiny.dominance.every(a => a.texture === 'unknown' || a.texture === 'silence'));
    }
});

// A transient on the exact frame edge must not localize into preceding silence or be reused.
test('impulse and following rise remain inside activity and honor the localized refractory interval', () => {
    const samples = new Float32Array(6144); samples[1024] = 1;
    for (let i = 2048; i < 4096; i++) samples[i] = .1 * Math.sin(2 * Math.PI * 440 * (i - 2048) / 16000);
    const r = extract({ samples, sampleRate: 16000 }, 1024);
    assert.ok(normalizeAcousticActivity(r, r.clock)); assert.equal(r.attacks.length, 2);
    assert.ok(r.attacks[0].sampleIndex >= 1024);
    assert.ok(r.attacks[1].sampleIndex - r.attacks[0].sampleIndex >= .06 * 16000);
});

test('sparse/dense impulses, truncated windows and low-resolution clocks always publish normalizable evidence', () => {
    for (const fs of [1000, 4000, 16000, 44100, 384000]) for (const hop of [4, 64, 512, 1024]) {
        const samples = new Float32Array(hop * 8 + 3);
        let seed = 1;
        for (let i = hop; i < hop * 6; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            if (i % (hop * 2) < hop) samples[i] = .2 * (seed / 2 ** 31 - 1);
        }
        samples[hop] = 1;
        const r = extract({ samples, sampleRate: fs }, hop);
        assert.ok(normalizeAcousticActivity(r, r.clock), `${fs}/${hop}`);
        if (hop < 512 || hop / fs < .015) {
            assert.ok(r.attacks.every(a => a.family === 'unknown'));
            if (r.attacks.length) {
                const bad = json(r); bad.attacks[0].family = 'tonal';
                assert.equal(normalizeAcousticActivity(bad, bad.clock), undefined);
            }
        }
    }
});


test('spectral entries recover quiet additions over a tonal carrier without changing energy attacks', () => {
    for (const kind of ENTRY_KINDS) {
        const f = entryFixture(kind), r = extract(f);
        assert.ok(normalizeAcousticActivity(r, r.clock), kind);
        const entries = r.spectralEntries.candidates;
        assert.equal(entries.length, f.expectedEntries.length, kind);
        if (f.expectedEntries.length) {
            assert.equal(r.attacks.length, 0, 'the quiet addition is absent from the legacy energy-rise list');
            for (let i = 0; i < entries.length; i++) {
                assert.ok(entries[i].prefixSamples[1] <= entries[i].sampleIndex);
                assert.ok(Math.abs(entries[i].time - f.attacks[i]) <= 512 / f.sampleRate + .004, kind + ' ' + entries[i].time);
            }
            assert.equal(entries[0].texture, kind !== 'soft-noise-hit' ? 'tonal' : 'broadband');
        }
    }
});


test('spectral-entry frozen transfer controls preserve quiet entries and reject carrier modulation/replacement', () => {
    for (const tuple of ACTIVITY_TUPLES.transfer) for (const kind of ENTRY_KINDS) {
        const f = entryFixture(kind, tuple), r = extract(f, 1024), entries = r.spectralEntries.candidates;
        assert.ok(normalizeAcousticActivity(r, r.clock), kind);
        assert.equal(entries.length, f.expectedEntries.length, `${tuple.sampleRate}/${kind}`);
        for (let i = 0; i < entries.length; i++) assert.ok(Math.abs(entries[i].time - f.attacks[i]) <= 1024 / f.sampleRate + .004, `${kind}:${entries[i].time}`);
    }
});

test('entry support, prefix-only model, DC/gain invariance, complete-tail and legacy publication contracts', () => {
    const f = entryFixture('soft-tone'), baseline = extract(f), original = json(baseline.spectralEntries.candidates[0]);
    for (const gain of [.5, 2]) for (const dc of [0, .4, -1]) {
        const samples = Float32Array.from(f.samples, x => x * gain + dc), r = extract({ ...f, samples });
        assert.ok(normalizeAcousticActivity(r, r.clock)); assert.equal(r.spectralEntries.candidates.length, 1);
        assert.equal(r.spectralEntries.candidates[0].texture, original.texture);
        assert.ok(Math.abs(r.spectralEntries.candidates[0].time - .7) <= .036);
    }
    const changed = f.samples.slice();
    for (let i = Math.round(1.3 * f.sampleRate); i < changed.length; i++) changed[i] = .8 * Math.sin(i * .7);
    assert.deepEqual(json(extract({ ...f, samples: changed }).spectralEntries.candidates[0]), original, 'future PCM cannot train/alter earlier prefix evidence');
    const legacy = json(baseline); delete legacy.spectralEntries;
    assert.deepEqual(json(normalizeAcousticActivity(legacy, legacy.clock)), legacy);
    const normal = normalizeAcousticActivity(baseline, baseline.clock); normal.spectralEntries.candidates[0].bodySamples[0]++;
    assert.notDeepEqual(json(normal), json(baseline));
    for (const mutate of [x => x.algorithm = 'oracle', x => x.confidence = .99, x => x.xrScoring = 'eligible',
        x => x.candidates[0].prefixSamples[0]++, x => x.candidates[0].bodySamples[1]++, x => x.candidates[0].supportSamples[0]++,
        x => x.candidates[0].sampleIndex++, x => x.candidates[0].decisionSample--,
        x => x.candidates[0].positivePowerFraction = 1.1, x => x.candidates[0].carrierPowerRatio = .5,
        x => x.candidates[0].backgroundResidualFraction = NaN, x => x.candidates[0].texture = 'vocals']) {
        const bad = json(baseline); mutate(bad.spectralEntries); assert.equal(normalizeAcousticActivity(bad, bad.clock), undefined);
    }
});


test('T11b output digest remains exact and prior corpus receives no duplicate spectral candidates', () => {
    const digest = createHash('sha256');
    for (const kind of ACTIVITY_KINDS) {
        const r = extract(activityFixture(kind));
        assert.equal(r.spectralEntries.candidates.length, 0, kind);
        delete r.spectralEntries; digest.update(JSON.stringify(r));
    }
    assert.equal(digest.digest('hex'), ACTIVITY_V1_SHA256);
});


test('real worker carries positive masked-entry evidence with the original request identity', () => {
    const messages = [], self = { postMessage: m => messages.push(m) };
    createLoader({}, { self, Float32Array, Float64Array })('audio/analyzer.worker.ts');
    const f = entryFixture('soft-tone');
    self.onmessage({ data: { samples: f.samples.buffer, sampleRate: f.sampleRate, requestId: 40 } });
    const message = messages.find(m => m.type === 'analysis_done' && m.requestId === 40);
    assert.ok(message); assert.equal(message.trackAnalysis.musicActivity.spectralEntries.candidates.length, 1);
    const normalized = load('analyzer/normalizeAnalysisResult.ts').normalizeTrackAnalysis(message.trackAnalysis, message.bpm, message.events);
    assert.deepEqual(json(normalized.musicActivity.spectralEntries), json(message.trackAnalysis.musicActivity.spectralEntries));
});


test('quiet-entry timing survives five subwindow phases at each supported regression clock', () => {
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) {
        const f = entryFixture('soft-tone', tuple), hop = tuple.sampleRate === 16000 ? 512 : 1024;
        for (const fraction of [0, .125, .375, .625, .875]) {
            const shift = Math.round(hop * fraction), samples = new Float32Array(f.samples.length);
            samples.set(f.samples.subarray(0, f.samples.length - shift), shift);
            const r = extract({ ...f, samples }, hop), entries = r.spectralEntries.candidates;
            assert.equal(entries.length, 1, `${tuple.sampleRate}/${fraction}`);
            assert.ok(Math.abs(entries[0].time - (.7 + shift / tuple.sampleRate)) <= hop / tuple.sampleRate + .004);
            assert.ok(normalizeAcousticActivity(r, r.clock));
        }
    }
});
