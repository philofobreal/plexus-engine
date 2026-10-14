import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoader} from './helpers/xr-loader.mjs';
import {challengeSpecs, challengeFixture, pcmBytes, sha256} from './fixtures/acoustic-onset-challenges.mjs';
import {robustnessSpecs, robustnessFixture} from './fixtures/predictive-onset-robustness.mjs';
import {adaptiveSpecs, adaptiveFixture} from './fixtures/adaptive-onset-robustness.mjs';
import {matchOnsets} from './helpers/onset-matching.mjs';

const load = createLoader({}, {Float32Array, Float64Array});
const {extractAdaptiveOnsets} = load('analyzer/AdaptiveOnsets.ts');
const {normalizeAdaptiveOnsets} = load('types/adaptiveOnsets.ts');
const {analyzeAudio} = load('analyzer/analyzeAudio.ts');
const {normalizeTrackAnalysis} = load('analyzer/normalizeAnalysisResult.ts');

function check(f) {
    const before = pcmBytes(f.samples), r = extractAdaptiveOnsets(f.samples, f.spec.sampleRate);
    assert.deepEqual(pcmBytes(f.samples), before);
    assert.equal(JSON.stringify(normalizeAdaptiveOnsets(r, f.duration)), JSON.stringify(r));
    for (let i = 1; i < r.candidates.length; i++)
        assert.ok(r.candidates[i].sampleIndex - r.candidates[i - 1].sampleIndex >= r.minimumSeparationSamples);
    return r;
}

test('adaptive v3 recovers all C2 dense attacks at 2 ms without extra events and rejects known ramps/offsets', () => {
    const counts = {isolated: 0, mixture: 0, density: 0, negative: 0};
    for (const spec of challengeSpecs()) {
        const f = challengeFixture(spec), r = check(f);
        const times = Array.from(r.candidates, c => c.time);
        if (spec.family === 'negative') {
            const hits = times.filter(t => t >= .1).length;
            counts.negative += hits; assert.equal(hits, 0, spec.id);
        } else {
            const m = matchOnsets(f.truthSamples.map(i => i / spec.sampleRate), times, .002);
            counts[spec.family] += m.matchedCount;
            assert.equal(m.misses, 0, spec.id);
            assert.equal(m.falsePositives, spec.family === 'mixture' ? 1 : 0, spec.id);
            if (spec.family === 'mixture') assert.equal(r.candidates[0].endpointAmbiguous, true);
        }
    }
    assert.deepEqual(counts, {isolated: 72, mixture: 144, density: 216, negative: 0});
});

test('adaptive model guard protects all previously inspected mono/poly noise/tone conditions', () => {
    let matched = 0, extras = 0;
    for (const spec of robustnessSpecs()) {
        const f = robustnessFixture(spec), r = check(f);
        const times = Array.from(r.candidates, c => c.time);
        if (spec.family === 'negative') assert.equal(times.filter(t => t >= .1).length, 0, spec.id);
        else {
            const m = matchOnsets(f.truthSamples.map(i => i / spec.sampleRate), times, .002);
            assert.equal(m.misses, 0, spec.id); matched += m.matchedCount; extras += m.falsePositives;
            assert.equal(r.candidates[0].endpointAmbiguous, true);
        }
    }
    assert.equal(matched, 72); assert.equal(extras, 24);
});

test('new frozen synthetic cases remain active with disclosed partial mixed-density recall and two negative hits', () => {
    const saved = JSON.parse(readFileSync('research/analyzer-lab/fixtures/an03b-robustness-frozen.json'));
    assert.equal(sha256(readFileSync('src/analyzer/AdaptiveOnsets.ts')), saved.sourceHashes['src/analyzer/AdaptiveOnsets.ts']);
    let matched = 0, extras = 0, negative = 0;
    const specs = adaptiveSpecs(); assert.equal(specs.length, 60);
    for (let i = 0; i < specs.length; i++) {
        const f = adaptiveFixture(specs[i]), r = check(f), old = saved.cases[i];
        assert.equal(f.pcmSha256, old.pcmSha256); assert.equal(f.truthSha256, old.truthSha256);
        assert.equal(JSON.stringify(r.candidates), JSON.stringify(old.candidates));
        const times = Array.from(r.candidates, c => c.time);
        if (specs[i].family === 'negative') negative += times.filter(t => t >= .1).length;
        else {
            const m = matchOnsets(f.truthSamples.map(n => n / specs[i].sampleRate), times, .002);
            matched += m.matchedCount; extras += m.falsePositives;
        }
    }
    // These are preserved post-inspection regressions, not universal acceptance targets.
    assert.equal(matched, 86); assert.equal(extras, 12); assert.equal(negative, 2);
});

test('adaptive integration defaults/false preserve legacy output and v1/v2/v3 coexist', () => {
    const f = challengeFixture({family: 'density', sampleRate: 8000, kind: 'noise', gapSeconds: .008, pattern: 'equal'});
    const original = analyzeAudio({samples: f.samples, sampleRate: 8000});
    const disabled = analyzeAudio({samples: f.samples, sampleRate: 8000, options: {adaptiveOnsets: false}});
    assert.equal(JSON.stringify(original), JSON.stringify(disabled));
    const enabled = analyzeAudio({samples: f.samples, sampleRate: 8000,
        options: {adaptiveOnsets: true, predictiveOnsets: true, acousticOnsets: {}}});
    assert.equal(enabled.trackAnalysis.adaptiveOnsets.algorithm, 'adaptive-innovation-v3');
    assert.equal(enabled.trackAnalysis.predictiveOnsets.algorithm, 'predictive-innovation-v2');
    assert.equal(enabled.trackAnalysis.acousticOnsets.algorithm, 'overlap-energy-rise-v1');
    const restored = JSON.parse(JSON.stringify(enabled));
    delete restored.trackAnalysis.adaptiveOnsets; delete restored.trackAnalysis.predictiveOnsets; delete restored.trackAnalysis.acousticOnsets;
    assert.equal(JSON.stringify(restored), JSON.stringify(original));
    assert.equal(JSON.stringify(normalizeTrackAnalysis(enabled.trackAnalysis).adaptiveOnsets), JSON.stringify(enabled.trackAnalysis.adaptiveOnsets));
    for (const option of [null, 0, '', [], {}]) {
        let progress = 0;
        assert.throws(() => analyzeAudio({samples: f.samples, sampleRate: 8000, options: {adaptiveOnsets: option}, onProgress: () => progress++}), /must be boolean/);
        assert.equal(progress, 0);
    }
});

test('adaptive normalization rejects invalid model clocks, local contrast, spacing and support', () => {
    const f = challengeFixture({family: 'density', sampleRate: 8000, kind: 'noise', gapSeconds: .008, pattern: 'equal'});
    const original = extractAdaptiveOnsets(f.samples, 8000);
    for (const mutate of [r => r.algorithm = 'predictive-innovation-v2', r => r.contrastSamples++,
        r => r.minimumSeparationSamples++, r => r.candidates[0].time++, r => r.candidates[0].proposalSample++,
        r => r.candidates[0].innovationRatio = 7, r => r.candidates[0].predictorCoefficient = 3,
        r => r.candidates[0].supportEndSample--, r => r.candidates[0].endpointAmbiguous = true,
        r => r.candidates.reverse()]) {
        const r = JSON.parse(JSON.stringify(original)); mutate(r);
        assert.equal(normalizeAdaptiveOnsets(r, f.duration), undefined);
    }
    for (const value of [null, false, 0, '', []]) assert.equal(normalizeAdaptiveOnsets(value, f.duration), undefined);
    assert.equal(normalizeAdaptiveOnsets(original, f.duration, {sampleRate: 44100, sampleCount: f.samples.length}), undefined);
});

test('adaptive input/determinism and real tail/impulse clocks survive rebasing', () => {
    for (const fs of [8000, 44100, 96000]) {
        const x = new Float32Array(Math.round(6 * fs)), at = Math.round(5.3 * fs);
        x[at] = .5;
        const a = extractAdaptiveOnsets(x, fs);
        assert.equal(a.candidates.length, 1); assert.ok(Math.abs(a.candidates[0].sampleIndex - at) <= 1);
        assert.equal(JSON.stringify(a), JSON.stringify(extractAdaptiveOnsets(x, fs)));
        for (const size of [1, 2, 511]) {
            const tail = new Float32Array(size); tail[size - 1] = .5;
            const r = extractAdaptiveOnsets(tail, fs);
            assert.ok(r.candidates.length > 0);
            assert.ok(r.candidates.every(p => p.sampleIndex < size && p.endpointAmbiguous));
        }
    }
    assert.equal(extractAdaptiveOnsets(new Float32Array(1001), 44100).candidates.length, 0);
    for (const x of [[], new Float64Array([0]), new Float32Array(), new Float32Array([NaN]), new Float32Array([9])])
        assert.throws(() => extractAdaptiveOnsets(x, 44100));
    for (const fs of [0, 999, 384001, 44100.5, NaN]) assert.throws(() => extractAdaptiveOnsets(new Float32Array([0]), fs));
});
