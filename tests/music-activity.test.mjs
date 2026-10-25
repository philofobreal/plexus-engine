import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';
import { activityFixture, ACTIVITY_KINDS, ACTIVITY_TUPLES, entryFixture, ENTRY_KINDS, ACTIVITY_V1_SHA256, ENTRY_V1_SHA256, bandFixture, BAND_KINDS, BAND_V1_SHA256, contextFixture, CONTEXT_SPECS, attackChangeFixture, ATTACK_CHANGE_KINDS, ATTACK_CHANGE_PHASES } from './fixtures/music-activity-corpus.mjs';
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
    const legacy = json(baseline); delete legacy.spectralEntries; delete legacy.bandActivity; delete legacy.entryContexts; delete legacy.attackChanges;
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
        delete r.spectralEntries; delete r.bandActivity; delete r.entryContexts; delete r.attackChanges; for (const a of r.attacks) delete a.quietOnset; digest.update(JSON.stringify(r));
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


test('T11c frozen aggregate stays exact when the optional band extension is omitted', () => {
    const digest = createHash('sha256');
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const kind of ENTRY_KINDS) {
        const r = extract(entryFixture(kind, tuple), tuple.sampleRate === 16000 ? 512 : 1024);
        delete r.bandActivity; delete r.entryContexts; delete r.attackChanges; for (const a of r.attacks) delete a.quietOnset; digest.update(JSON.stringify(r));
    }
    assert.equal(digest.digest('hex'), ENTRY_V1_SHA256);
});

test('quiet additions end independently of a continuing carrier with observed confirmation support', () => {
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const kind of ['soft-tone', 'repeat-soft-tone', 'soft-noise-hit']) {
        const hop = tuple.sampleRate === 16000 ? 512 : 1024, f = entryFixture(kind, tuple), r = extract(f, hop);
        const ends = kind === 'repeat-soft-tone' ? [.95, 1.65] : [kind === 'soft-tone' ? 1.2 : .76];
        assert.equal(r.activity.length, 1); assert.equal(r.activity[0].rightCensored, true, 'background keeps playing');
        assert.equal(r.bandActivity.records.length, ends.length);
        for (let i = 0; i < ends.length; i++) {
            const a = r.bandActivity.records[i], end = ends[i] * f.sampleRate;
            assert.equal(a.entryId, r.spectralEntries.candidates[i].id); assert.equal(a.endReason, 'quiet-windows');
            assert.ok(a.bins.length > 0 && a.bins.length <= 18); assert.equal(a.rightCensored, false);
            assert.ok(Math.abs(a.endSample - end) <= hop, `${tuple.sampleRate}/${kind}`);
            assert.ok(a.offsetSupportSamples[0] <= end && a.offsetSupportSamples[1] >= end);
            assert.ok(a.decisionSample >= a.endSample + 2 * hop);
            assert.ok(normalizeAcousticActivity(r, r.clock));
        }
    }
});

test('frozen bands stay continuous through held modulation, and same-band overlap has unresolved ownership', () => {
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const kind of BAND_KINDS) {
        const hop = tuple.sampleRate === 16000 ? 512 : 1024, f = bandFixture(kind, tuple, hop), r = extract(f, hop);
        assert.ok(normalizeAcousticActivity(r, r.clock), `${tuple.sampleRate}/${kind}`);
        assert.equal(r.bandActivity.sourceOwnership, 'unresolved'); assert.equal(r.bandActivity.xrScoring, 'ineligible');
        const first = r.bandActivity.records[0]; assert.ok(first, kind);
        if (['held', 'partial-tail', 'one-quiet-tail'].includes(kind)) {
            assert.equal(first.endReason, 'file-boundary', kind); assert.equal(first.endSample, f.samples.length);
            assert.equal(first.offsetSupportSamples, null); assert.equal(first.rightCensored, true);
        } else {
            assert.equal(first.endReason, 'quiet-windows', kind);
            if (f.expectedBandEnd !== null) {
                const truth = f.expectedBandEnd * f.sampleRate;
                assert.ok(Math.abs(first.endSample - truth) <= hop, kind);
                assert.ok(first.offsetSupportSamples[0] <= truth && truth <= first.offsetSupportSamples[1], kind);
            }
            if (['same-band-overlap', 'near-band-overlap'].includes(kind)) assert.ok(first.endSample / f.sampleRate > f.sourceEnd + .3, 'mask cannot separate two sources in the same band');
            if (kind === 'entry-glide') assert.ok(first.endSample / f.sampleRate < f.sourceEnd - .4, 'leaving fixed bins is not a source offset');
            if (kind === 'fade') assert.ok(first.endSample / f.sampleRate < f.sourceEnd, 'relative energy threshold, not last nonzero PCM');
        }
    }
});

test('band release preserves gain/polarity/DC invariance, short-window clocks and accepted-entry association', () => {
    for (const hop of [512, 1024]) {
        const f = entryFixture('soft-tone'), baseline = extract(f, hop).bandActivity.records[0];
        for (const gain of [-2, -.5, .5, 2]) for (const dc of [0, .4]) {
            const r = extract({ ...f, samples: Float32Array.from(f.samples, x => gain * x + dc) }, hop), a = r.bandActivity.records[0];
            assert.ok(normalizeAcousticActivity(r, r.clock)); assert.deepEqual(a.bins, baseline.bins);
            assert.equal(a.endSample, baseline.endSample); assert.equal(a.endReason, baseline.endReason);
        }
    }
    for (const hop of [32, 64, 128, 256]) assert.equal(extract(entryFixture('soft-tone'), hop).bandActivity.records.length, 0);
    assert.equal(extract(entryFixture('clipped-tail')).bandActivity.records.length, 0, 'rejected provisional entries must not leak');
});

test('band normalization clones and rejects forged identities, unsupported versions and missing confirmation', () => {
    const r = json(extract(entryFixture('soft-tone'))), normal = normalizeAcousticActivity(r, r.clock);
    normal.bandActivity.records[0].bins[0]++; assert.notDeepEqual(json(normal), r);
    const old = json(r); delete old.bandActivity;
    assert.deepEqual(json(normalizeAcousticActivity(old, old.clock)), old);
    for (const mutate of [x => x.algorithm = 'oracle', x => x.confidence = .9, x => x.sourceOwnership = 'isolated-note',
        x => x.scope = 'source', x => x.xrScoring = 'eligible', x => x.records.pop(),
        x => x.records[0].entryId = 'entry:0', x => x.records[0].startSample++, x => x.records[0].bins.push(1),
        x => x.records[0].bins = [], x => { delete x.records[0].bins[0]; }, x => x.records[0].bins[0] = 256, x => x.records[0].endSample++,
        x => x.records[0].maskSupportSamples[1]++, x => x.records[0].decisionSample--,
        x => x.records[0].offsetSupportSamples[1]--, x => x.records[0].rightCensored = true,
        x => x.records[0].endReason = 'source-ended']) {
        const bad = json(r); mutate(bad.bandActivity); assert.equal(normalizeAcousticActivity(bad, bad.clock), undefined);
    }
    const bad = json(r); delete bad.spectralEntries; assert.equal(normalizeAcousticActivity(bad, bad.clock), undefined);
});

test('streaming monitor saturation is explicit, bounded and does not change entry acceptance', () => {
    // Inject occupied resource slots, not acoustic truth: exercises the real overflow path.
    const f = entryFixture('soft-tone'), a = new MusicActivity(f.samples, f.sampleRate, 512);
    const slots = Array.from({ length: 32 }, () => ({ frame: 0, bins: [], baseline: [], peak: 0, quiet: 0, endFrame: null }));
    new FeatureExtractor(f.samples, f.sampleRate, 512).process(undefined, (s, re, im) => {
        a.activeBands.splice(0, a.activeBands.length, ...slots);
        // Keep injected slots occupied for this observation; no signal classification claim.
        for (const slot of slots) slot.quiet = -100;
        a.observe(s, re, im); assert.ok(a.activeBands.length <= 32);
    });
    const r = a.finish(); assert.equal(r.spectralEntries.candidates.length, 1);
    const b = r.bandActivity.records[0]; assert.equal(b.endReason, 'budget-exceeded');
    assert.equal(b.endSample, null); assert.equal(b.offsetSupportSamples, null); assert.equal(b.rightCensored, true);
    assert.ok(normalizeAcousticActivity(r, r.clock));
});


test('prefix neighborhoods qualify modulation changes while all T11d evidence stays byte-exact', () => {
    const digest = createHash('sha256'); let occupiedExtras = 0, uncertainExtras = 0;
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const kind of [...ENTRY_KINDS, ...BAND_KINDS]) {
        const hop = tuple.sampleRate === 16000 ? 512 : 1024;
        const f = ENTRY_KINDS.includes(kind) ? entryFixture(kind, tuple) : bandFixture(kind, tuple, hop), r = extract(f, hop);
        assert.ok(normalizeAcousticActivity(r, r.clock)); assert.equal(r.entryContexts.records.length, r.spectralEntries.candidates.length);
        for (let i = 0; i < r.entryContexts.records.length; i++) {
            const c = r.entryContexts.records[i], e = r.spectralEntries.candidates[i];
            assert.equal(c.entryId, e.id); assert.ok(c.prefixSamples[1] <= e.sampleIndex);
            if (i === 0 || kind === 'repeat-soft-tone') assert.equal(c.context, 'unoccupied-neighborhood', `${tuple.sampleRate}/${kind}/${i}`);
            else if (['am-entry', 'entry-glide', 'near-band-overlap'].includes(kind)) {
                assert.notEqual(c.context, 'unoccupied-neighborhood');
                if (c.context === 'occupied-neighborhood') occupiedExtras++; else uncertainExtras++;
            }
        }
        delete r.entryContexts; delete r.attackChanges; for (const a of r.attacks) delete a.quietOnset; digest.update(JSON.stringify(r));
    }
    assert.equal(digest.digest('hex'), BAND_V1_SHA256); assert.equal(occupiedExtras, 17); assert.equal(uncertainExtras, 3);
});

test('entry context stays tied to clean prefix under subwindow shifts and gain/DC', () => {
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) {
        const f = entryFixture('soft-tone', tuple), hop = tuple.sampleRate === 16000 ? 512 : 1024;
        for (const phase of [0, .125, .375, .625, .875]) {
            const shift = Math.round(hop * phase), samples = new Float32Array(f.samples.length);
            samples.set(f.samples.subarray(0, samples.length - shift), shift);
            const a = extract({ ...f, samples }, hop); assert.equal(a.spectralEntries.candidates.length, 1);
            const c = a.entryContexts.records[0];
            assert.equal(c.context, 'unoccupied-neighborhood'); assert.ok(normalizeAcousticActivity(a, a.clock));
            for (const gain of [-.5, 2]) {
                const modified = Float32Array.from(samples, x => gain * x + .4), b = extract({ ...f, samples: modified }, hop);
                assert.equal(b.entryContexts.records[0].context, c.context); assert.equal(b.entryContexts.records[0].peakBin, c.peakBin);
            }
            assert.equal(c.decisionSample, samples.length); assert.equal(a.entryContexts.publication, 'full-track-analysis');
        }
    }
});

test('new parameter controls retain real near-band/repeated attacks as raw evidence, with no source ownership claim', () => {
    let cases = 0, occupied = 0;
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const spec of CONTEXT_SPECS[split]) {
        const hop = split === 'development' ? 512 : 1024, f = contextFixture(spec, tuple, hop), r = extract(f, hop);
        assert.ok(normalizeAcousticActivity(r, r.clock)); assert.ok(r.entryContexts.records.length > 0);
        assert.equal(r.entryContexts.scope, 'dominant-excess-neighborhood'); assert.equal(r.entryContexts.sourceOwnership, 'unresolved');
        assert.equal(r.entryContexts.xrScoring, 'ineligible'); assert.equal(r.entryContexts.confidence, null);
        if (spec.kind === 'neighbor') {
            const later = r.entryContexts.records.filter((c, i) => r.spectralEntries.candidates[i].time >= 1.05 - hop / f.sampleRate);
            assert.ok(later.some(c => c.context === 'occupied-neighborhood'), 'a real independent nearby addition can also occupy this neighborhood');
        }
        if (spec.kind === 'repeat' && spec.gap >= .25) {
            assert.equal(r.spectralEntries.candidates.length, 2); assert.ok(r.entryContexts.records.every(c => c.context === 'unoccupied-neighborhood'));
        }
        occupied += r.entryContexts.records.filter(c => c.context === 'occupied-neighborhood').length; cases++;
    }
    assert.equal(cases, 16); assert.ok(occupied > 0);
});

test('context normalization validates derivable policy, association and clone isolation; omission remains valid', () => {
    const r = json(extract(entryFixture('soft-tone'))), n = normalizeAcousticActivity(r, r.clock);
    n.entryContexts.records[0].prefixSamples[0]++; assert.notDeepEqual(json(n), r);
    const old = json(r); delete old.entryContexts; assert.deepEqual(json(normalizeAcousticActivity(old, old.clock)), old);
    for (const mutate of [x => x.algorithm = 'oracle', x => x.confidence = .9, x => x.scope = 'all-sources',
        x => x.sourceOwnership = 'note', x => x.publication = 'online', x => x.xrScoring = 'eligible', x => x.records.pop(),
        x => x.records[0].entryId = 'entry:0', x => x.records[0].peakBin = 0, x => x.records[0].peakBin = 256, x => x.records[0].peakBin = 255,
        x => x.records[0].prefixSamples[1]++, x => x.records[0].seedSamples[0]++, x => x.records[0].decisionSample--,
        x => x.records[0].prefixPower = NaN, x => x.records[0].prefixToSeedPowerRatio = -1,
        x => x.records[0].context = 'occupied-neighborhood']) {
        const bad = json(r); mutate(bad.entryContexts); assert.equal(normalizeAcousticActivity(bad, bad.clock), undefined);
    }
    const bad = json(r); delete bad.spectralEntries; assert.equal(normalizeAcousticActivity(bad, bad.clock), undefined);
    const { classifyEntryNeighborhood: classify } = load('types/musicEvents.ts');
    assert.equal(classify(1e-8, .001), 'uncertain', 'weak ratio cannot imply physical silence when measured prefix is above floor');
    assert.equal(classify(1e-12, .1), 'uncertain', 'relative numerical residue does not prove occupied energy');
});


test('full-track publication stays honest when suffix dedup revises entries but frozen prefix measurements remain exact', () => {
    const tuple = ACTIVITY_TUPLES.transfer[1], f = entryFixture('soft-tone', tuple), hop = 1024;
    const probe = samples => {
        const a = new MusicActivity(samples, f.sampleRate, hop);
        new FeatureExtractor(samples, f.sampleRate, hop).process(undefined, (s, r, i) => a.observe(s, r, i));
        return { a, result: a.finish() };
    };
    for (const phase of [.2, .3, .4]) {
        const shift = Math.round(hop * phase), samples = new Float32Array(f.samples.length);
        samples.set(f.samples.subarray(0, samples.length - shift), shift);
        const before = probe(samples), e = before.result.spectralEntries.candidates[0], context = before.result.entryContexts.records[0];
        assert.ok(context); assert.equal(context.decisionSample, samples.length);
        assert.equal(before.result.entryContexts.publication, 'full-track-analysis');
        const raw = before.a.entryFrames.find(p => p.frame === e.observationFrame);
        samples[e.decisionSample + 1] = 8; samples[e.decisionSample + 2] = 8;
        const after = probe(samples), revised = after.a.entryFrames.find(p => p.frame === e.observationFrame);
        assert.ok(raw && revised); assert.equal(revised.contextPeak, raw.contextPeak);
        assert.equal(revised.prefixPower, raw.prefixPower); assert.equal(revised.prefixRatio, raw.prefixRatio);
        assert.ok(!after.result.spectralEntries.candidates.some(p => p.id === e.id), 'inherited retrospective raw-entry dedup can remove it');
        assert.ok(!after.result.entryContexts.records.some(p => p.entryId === e.id), 'no orphan context publication');
        assert.ok(normalizeAcousticActivity(after.result, after.result.clock));
    }
});


// T11f: numeric locality/support acceptance, not a new texture/source classifier.
test('short attack changes retain local measurements across later additions and disclose inherited retargeting', () => {
    let unchanged = 0, retargeted = 0, isolated = 0;
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const phase of ATTACK_CHANGE_PHASES) {
        const hop = tuple.sampleRate === 16000 ? 512 : 1024, first = new Map();
        for (const kind of ATTACK_CHANGE_KINDS) {
            const f = attackChangeFixture(kind, tuple, hop, phase), r = extract(f, hop), c = r.attackChanges.records[0];
            assert.ok(normalizeAcousticActivity(r, r.clock)); assert.ok(c); assert.equal(c.status, 'measured');
            assert.equal(c.attackId, r.attacks[0].id); assert.equal(c.decisionSample, f.samples.length);
            assert.equal(r.attackChanges.publication, 'full-track-analysis');
            assert.equal(r.attackChanges.sourceOwnership, 'unresolved'); assert.equal(r.attackChanges.confidence, null);
            assert.ok(c.positivePower > 1e-10); assert.ok(c.positivePowerFraction > 0 && c.positivePowerFraction <= 1);
            if (!kind.includes('-late-')) {
                first.set(kind, { c, attack: r.attacks[0] }); isolated++;
                // Only declared pure-signal controls: these bounds do not classify arbitrary mixtures.
                assert.ok(kind === 'tone' ? c.peakNeighborhoodFraction > .8 : c.peakNeighborhoodFraction < .3, `${tuple.sampleRate}/${phase}/${kind}`);
                assert.ok(c.bodySamples[0] <= f.startSample && c.bodySamples[1] > f.startSample);
            } else {
                const base = first.get(kind.split('-')[0]);
                if (base.c.attackId === c.attackId) {
                    assert.deepEqual(json(c), json(base.c), 'later PCM outside the short windows cannot recolor this measurement'); unchanged++;
                    assert.ok(c.bodySamples[1] < f.laterSample);
                } else {
                    // Legacy localization is retained, including this demonstrated ambiguity.
                    assert.ok(Math.abs(r.attacks[0].sampleIndex - f.laterSample) <= hop); retargeted++;
                }
            }
        }
    }
    assert.equal(isolated, 45); assert.equal(unchanged, 34); assert.equal(retargeted, 11);
});

function measureFixedAttack(samples, sampleRate, hop, sampleIndex) {
    // Unit scope: prescribed anchor, independent of the legacy detector's localization.
    const a = new MusicActivity(samples, sampleRate, hop), result = { attacks: [{ id: `acoustic:${sampleIndex}`, sampleIndex }] };
    a.attackChanges(result); return result.attackChanges;
}
test('Hann-weighted centering avoids artificial narrow peaks at impulse edges and rejects constant DC', () => {
    for (const [fs, hop, size] of [[8000, 512, 128], [16000, 512, 256], [48000, 1024, 512]]) {
        const anchor = Math.round(.2 * fs), body = anchor - Math.ceil(.002 * fs);
        for (const offset of [0, 1, Math.floor(size / 2), size - 2, size - 1]) {
            const samples = new Float32Array(Math.round(.4 * fs)); samples[body + offset] = 1;
            const base = measureFixedAttack(samples, fs, hop, anchor), c = base.records[0]; assert.equal(base.windowSize, size);
            if (offset === 0 || offset === size - 1) {
                assert.equal(c.status, 'below-floor'); assert.equal(c.peakNeighborhoodFraction, null);
            } else { assert.ok(['measured', 'below-floor'].includes(c.status)); if (c.status === 'measured') assert.ok(c.peakNeighborhoodFraction < .15); }
            for (const dc of [-.7, .4]) {
                const shifted = Float32Array.from(samples, x => x + dc), d = measureFixedAttack(shifted, fs, hop, anchor).records[0];
                assert.equal(d.status, c.status);
                assert.ok(Math.abs(d.positivePower - c.positivePower) < 1e-8);
                if (c.status === 'measured') assert.ok(Math.abs(d.peakNeighborhoodFraction - c.peakNeighborhoodFraction) < 1e-6);
            }
        }
        const dc = measureFixedAttack(new Float32Array(Math.round(.4 * fs)).fill(.3), fs, hop, anchor).records[0];
        assert.equal(dc.status, 'below-floor'); assert.equal(dc.positivePower, 0); assert.equal(dc.positivePowerFraction, 0);
    }
});

test('short-window excess has gain-covariant power, invariant ratios and explicit boundary/resolution abstentions', () => {
    const f = attackChangeFixture('tone'), r = extract(f), c = r.attackChanges.records[0];
    for (const gain of [.5, 2]) {
        const b = extract({ ...f, samples: Float32Array.from(f.samples, x => x * gain) }).attackChanges.records[0];
        assert.equal(b.attackId, c.attackId); assert.equal(b.peakBin, c.peakBin);
        assert.ok(Math.abs(b.positivePower / c.positivePower - gain ** 2) < 1e-6);
        assert.ok(Math.abs(b.peakNeighborhoodFraction - c.peakNeighborhoodFraction) < 1e-6);
    }
    const anchor = 1600, quiet = new Float32Array(3200);
    quiet[anchor] = 1e-7;
    assert.equal(measureFixedAttack(quiet, 16000, 512, anchor).records[0].status, 'below-floor');
    for (const sample of [0, 10, quiet.length - 1]) {
        const a = measureFixedAttack(quiet, 16000, 512, sample).records[0]; assert.equal(a.status, 'file-boundary');
        assert.equal(a.prefixSamples, null); assert.equal(a.bodySamples, null); assert.equal(a.positivePower, null);
    }
    for (const [fs, hop] of [[1000, 512], [16000, 64], [384000, 1024]]) {
        const a = measureFixedAttack(quiet, fs, hop, anchor); assert.equal(a.windowSize, null);
        assert.equal(a.records[0].status, 'insufficient-resolution'); assert.equal(a.records[0].positivePower, null);
    }
    const entry = extract(entryFixture('soft-tone')); assert.equal(entry.spectralEntries.candidates.length, 1);
    assert.equal(entry.attackChanges.records.length, 0, 'this layer does not silently claim coverage of quiet spectral entries');
});

test('attack-change contract clones, retains older payloads and rejects forged measurements and associations', () => {
    const r = json(extract(attackChangeFixture('tone'))), n = normalizeAcousticActivity(r, r.clock);
    assert.deepEqual(json(n), r); n.attackChanges.records[0].bodySamples[0]++; assert.notDeepEqual(json(n), r);
    const old = json(r); delete old.attackChanges; assert.deepEqual(json(normalizeAcousticActivity(old, old.clock)), old);
    for (const mutate of [x => x.algorithm = 'oracle', x => x.scope = 'isolated-source', x => x.sourceOwnership = 'known',
        x => x.publication = 'streaming', x => x.confidence = .9, x => x.xrScoring = 'eligible', x => x.windowSize *= 2,
        x => x.records.pop(), x => x.records.push(x.records[0]), x => { delete x.records[0]; },
        x => x.records[0].attackId = 'acoustic:0', x => x.records[0].decisionSample--,
        x => x.records[0].prefixSamples[0]++, x => x.records[0].bodySamples = null,
        x => x.records[0].status = 'file-boundary', x => x.records[0].positivePower = null,
        x => x.records[0].positivePower = Infinity, x => x.records[0].positivePower = -1,
        x => x.records[0].positivePowerFraction = 2, x => x.records[0].positivePowerFraction = null,
        x => x.records[0].peakBin = 0, x => x.records[0].peakBin = x.windowSize / 2,
        x => x.records[0].peakNeighborhoodFraction = 0, x => x.records[0].peakNeighborhoodFraction = NaN]) {
        const bad = json(r); mutate(bad.attackChanges); assert.equal(normalizeAcousticActivity(bad, bad.clock), undefined);
    }
    const boundary = json(extract({ samples: Float32Array.from({ length: 2051 }, (_, i) => i === 2048 ? 1 : i === 2049 ? -1 : 0), sampleRate: 16000 }));
    assert.equal(boundary.attackChanges.records[0].status, 'file-boundary'); assert.ok(normalizeAcousticActivity(boundary, boundary.clock));
    boundary.attackChanges.records[0].positivePower = 0; assert.equal(normalizeAcousticActivity(boundary, boundary.clock), undefined);
});


test('non-silent prefixes subtract matching/stronger windows and retain known weaker-prefix excess', () => {
    const fs = 16000, size = 256, anchor = 3200, body = anchor - Math.ceil(.002 * fs), prefix = body - Math.ceil(.004 * fs) - size;
    for (const [before, after, expectedFraction] of [[.2, .2, 0], [.3, .2, 0], [.2, .3, 5 / 9]]) {
        const samples = new Float32Array(6400);
        for (let n = 0; n < size; n++) {
            const wave = Math.sin(2 * Math.PI * 16 * n / size + .31);
            samples[prefix + n] = before * wave; samples[body + n] = after * wave;
        }
        const c = measureFixedAttack(samples, fs, 512, anchor).records[0];
        assert.ok(Math.abs(c.positivePowerFraction - expectedFraction) < 1e-6);
        if (!expectedFraction) { assert.equal(c.status, 'below-floor'); assert.equal(c.positivePower, 0); }
        else { assert.equal(c.status, 'measured'); assert.ok(Math.abs(c.positivePower - .025) < 1e-6); }
    }
    // A valid zero measurement from a complete, constant body must bind both zero-valued ratios.
    const r = json(extract(attackChangeFixture('tone'))), c = r.attackChanges.records[0];
    c.status = 'below-floor'; c.positivePower = 0; c.positivePowerFraction = 0;
    c.peakBin = null; c.peakNeighborhoodFraction = null; assert.ok(normalizeAcousticActivity(r, r.clock));
    c.positivePowerFraction = 1; assert.equal(normalizeAcousticActivity(r, r.clock), undefined);
    c.positivePowerFraction = 0; c.positivePower = 1e-11; assert.equal(normalizeAcousticActivity(r, r.clock), undefined);
});


test('quiet-prefix crossing recovers all eleven retargeted controls without changing legacy anchors', () => {
    let recovered = 0, stable = 0;
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const phase of ATTACK_CHANGE_PHASES) {
        const hop = tuple.sampleRate === 16000 ? 512 : 1024;
        for (const kind of ATTACK_CHANGE_KINDS.filter(k => k.includes('-late-'))) {
            const f = attackChangeFixture(kind, tuple, hop, phase), r = extract(f, hop), a = r.attacks[0], q = a.quietOnset;
            assert.ok(q); assert.ok(normalizeAcousticActivity(r, r.clock));
            assert.ok(q.sampleIndex >= f.startSample && q.sampleIndex - f.startSample <= Math.ceil(.002 * f.sampleRate));
            assert.ok(q.sampleIndex < f.laterSample); assert.equal(q.decisionSample, f.samples.length);
            if (a.sampleIndex >= f.laterSample - .005 * f.sampleRate) recovered++; else stable++;
        }
    }
    assert.equal(recovered, 11); assert.equal(stable, 34);
});

test('quiet crossings abstain on nonquiet prefix, clipped body and insufficient hop; DC/gain and noise limits remain explicit', () => {
    const f = attackChangeFixture('tone-late-noise'), a = extract(f).attacks[0].quietOnset;
    for (const dc of [-.4, .7]) for (const gain of [.5, 2]) {
        const r = extract({ ...f, samples: Float32Array.from(f.samples, x => x * gain + dc) });
        assert.ok(normalizeAcousticActivity(r, r.clock)); assert.ok(Math.abs(r.attacks[0].quietOnset.sampleIndex - a.sampleIndex) <= 1);
    }
    const make = (samples, fs = 16000, hop = 512) => {
        const r = extract({ samples, sampleRate: fs }, hop); assert.ok(normalizeAcousticActivity(r, r.clock)); return r;
    };
    for (const kind of ['silence', 'dc', 'below-floor', 'start-clipped']) assert.ok(make(activityFixture(kind).samples).attacks.every(a => !a.quietOnset));
    assert.ok(extract(entryFixture('soft-tone')).attacks.every(a => !a.quietOnset));
    const partial = new Float32Array(2051); partial[2048] = 1; partial[2049] = -1;
    assert.ok(make(partial).attacks.length); assert.ok(make(partial).attacks.every(a => !a.quietOnset));
    assert.ok(make(f.samples, f.sampleRate, 4).attacks.every(a => !a.quietOnset));
    const bed = Float32Array.from({ length: 8192 }, (_, i) => (i < 4096 ? .1 : .7) * Math.sin(i * .4));
    const b = make(bed); assert.ok(b.attacks.length); assert.ok(b.attacks.every(a => !a.quietOnset), 'nonquiet background cannot qualify');
    const noise = Float32Array.from({ length: 8192 }, (_, i) => 1.4e-5 * Math.sin(2 * Math.PI * i / 13));
    for (let i = 4096; i < noise.length; i++) noise[i] += .1 * Math.sin(i * .4);
    const n = make(noise); assert.ok(n.attacks[0].quietOnset.sampleIndex >= 4096, 'near-floor stationary noise must not become an early crossing');
    const spiked = new Float32Array(8192); spiked[4095] = 1e-4;
    for (let i = 4400; i < spiked.length; i++) spiked[i] = .1 * Math.sin((i - 4400) * .4 + .5);
    const spike = make(spiked); assert.ok(spike.attacks.length); assert.equal(spike.attacks[0].quietOnset, undefined, 'initial trailing spike is not a new crossing');
    // A DC step can cross this signal threshold; it is explicitly not musical/source evidence.
    const step = Float32Array.from({ length: 4096 }, (_, i) => i >= 1400 ? .3 : 0), d = make(step);
    assert.ok(d.attacks[0].quietOnset); assert.equal(d.xrScoring, 'ineligible');
    // Slow quiet rise: support describes the measurement, not a bound on the physical start.
    const ramp = Float32Array.from({ length: 8192 }, (_, i) => i >= 2048 ? 1e-4 * Math.min(1, (i - 2048) / 1600) * Math.sin(i * .5) : 0);
    const t = make(ramp); assert.ok(t.attacks[0]?.quietOnset); assert.ok(t.attacks[0].quietOnset.sampleIndex > 2048 + 32);
});

test('quiet-crossing normalizer binds window policy, clones arrays and accepts predecessor omission', () => {
    const fixture = attackChangeFixture('tone-late-noise');
    const r = json(extract(fixture)), n = normalizeAcousticActivity(r, r.clock);
    assert.ok(n.attacks[0].quietOnset); n.attacks[0].quietOnset.prefixSamples[0]++; assert.notDeepEqual(json(n), r);
    const old = json(r); for (const a of old.attacks) delete a.quietOnset;
    // A predecessor payload used v1 legacy-bound windows. Merely deleting v2's anchor is invalid.
    old.attackChanges.algorithm = 'attack-local-excess-v1';
    old.attackChanges.records = old.attacks.map(a => json(measureFixedAttack(fixture.samples, fixture.sampleRate, 512, a.sampleIndex).records[0]));
    assert.deepEqual(json(normalizeAcousticActivity(old, old.clock)), old);
    for (const mutate of [q => q.algorithm = 'note-onset', q => q.sampleIndex++, q => q.prefixSamples[0]++, q => q.supportSamples[1]++,
        q => q.prefixPower = 1, q => q.thresholdPower *= 2, q => q.crossingPower = q.thresholdPower, q => q.crossingPower = Infinity, q => q.decisionSample--, q => q.confidence = .99, q => q.sourceOwnership = 'known']) {
        const b = json(r); mutate(b.attacks[0].quietOnset); assert.equal(normalizeAcousticActivity(b, b.clock), undefined);
    }
});


// T11h: use the existing alternative crossing to bind the short measurement, without another sidecar.
test('v2 short spectra stay exact across all forty-five later additions, including legacy retargets', () => {
    let pairs = 0, retargeted = 0;
    for (const tuple of [...ACTIVITY_TUPLES.development, ...ACTIVITY_TUPLES.transfer]) for (const phase of ATTACK_CHANGE_PHASES) {
        const hop = tuple.sampleRate === 16000 ? 512 : 1024, isolated = new Map();
        for (const kind of ATTACK_CHANGE_KINDS) {
            const f = attackChangeFixture(kind, tuple, hop, phase), r = json(extract(f, hop));
            assert.equal(r.attackChanges.algorithm, 'attack-local-excess-v2');
            const { attackId, ...measurement } = r.attackChanges.records[0];
            assert.equal(attackId, r.attacks[0].id, 'association retains the historical energy attack ID');
            assert.equal(measurement.bodySamples[0], r.attacks[0].quietOnset.sampleIndex - Math.ceil(.002 * f.sampleRate));
            if (!kind.includes('-late-')) isolated.set(kind, { measurement, attackId });
            else {
                const base = isolated.get(kind.split('-')[0]);
                assert.deepEqual(measurement, base.measurement, `${tuple.sampleRate}/${phase}/${kind}`);
                assert.ok(measurement.bodySamples[1] < f.laterSample);
                if (attackId !== base.attackId) retargeted++;
                pairs++;
            }
            assert.ok(normalizeAcousticActivity(r, r.clock));
        }
    }
    assert.equal(pairs, 45); assert.equal(retargeted, 11);
});

test('v2 window binding rejects version relabeling and supports genuine legacy v1 payloads', () => {
    const tuple = ACTIVITY_TUPLES.development[0];
    let r, fixture;
    for (const phase of ATTACK_CHANGE_PHASES) {
        fixture = attackChangeFixture('impulse-late-tone', tuple, 512, phase);
        const candidate = json(extract(fixture));
        if (candidate.attacks[0].sampleIndex !== candidate.attacks[0].quietOnset.sampleIndex) { r = candidate; break; }
    }
    assert.ok(r); const a = r.attacks[0];
    const legacy = json(measureFixedAttack(fixture.samples, tuple.sampleRate, 512, a.sampleIndex));
    legacy.algorithm = 'attack-local-excess-v1';
    const v1 = json(r); v1.attackChanges = legacy;
    assert.deepEqual(json(normalizeAcousticActivity(v1, v1.clock)), v1);
    const v1WithoutQuiet = json(v1); delete v1WithoutQuiet.attacks[0].quietOnset;
    assert.ok(normalizeAcousticActivity(v1WithoutQuiet, v1WithoutQuiet.clock));
    const relabeledV1 = json(v1); relabeledV1.attackChanges.algorithm = 'attack-local-excess-v2';
    assert.equal(normalizeAcousticActivity(relabeledV1, relabeledV1.clock), undefined);
    const relabeledV2 = json(r); relabeledV2.attackChanges.algorithm = 'attack-local-excess-v1';
    assert.equal(normalizeAcousticActivity(relabeledV2, relabeledV2.clock), undefined);
    const missingQuiet = json(r); delete missingQuiet.attacks[0].quietOnset;
    assert.equal(normalizeAcousticActivity(missingQuiet, missingQuiet.clock), undefined);
    const cloned = normalizeAcousticActivity(r, r.clock); cloned.attackChanges.records[0].prefixSamples[0]++;
    assert.notDeepEqual(json(cloned), r);
});

test('v2 retains legacy windows without a qualified crossing and keeps boundary/resolution abstentions', () => {
    for (const kind of ACTIVITY_KINDS) {
        const f = activityFixture(kind), r = extract(f);
        for (let i = 0; i < r.attacks.length; i++) if (!r.attacks[i].quietOnset) {
            const a = r.attacks[i], expected = measureFixedAttack(f.samples, f.sampleRate, 512, a.sampleIndex).records[0];
            assert.deepEqual(json(r.attackChanges.records[i]), json(expected));
        }
    }
    // Even a crossing near the start cannot justify padding a missing clean prefix window.
    const fs = 16000, samples = new Float32Array(6400);
    for (let i = 256; i < samples.length; i++) samples[i] = .02 * Math.sin(i * .4);
    samples[450] = 2;
    const r = extract({ samples, sampleRate: fs }, 256);
    assert.ok(r.attacks[0].quietOnset); assert.equal(r.attackChanges.records[0].status, 'file-boundary');
    assert.equal(measureFixedAttack(samples, fs, 256, r.attacks[0].sampleIndex).records[0].status, 'measured', 'do not silently return the supported legacy measurement');
    assert.ok(normalizeAcousticActivity(r, r.clock));
    for (const [fs, hop] of [[1000, 512], [16000, 64], [384000, 1024]]) {
        const a = new MusicActivity(samples, fs, hop), result = { attacks: [{ id: 'acoustic:3200', sampleIndex: 3200, quietOnset: { sampleIndex: 3100 } }] };
        a.attackChanges(result); assert.equal(result.attackChanges.records[0].status, 'insufficient-resolution');
        assert.equal(result.attackChanges.records[0].bodySamples, null);
    }
});
