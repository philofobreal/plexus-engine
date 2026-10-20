import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoader} from './helpers/xr-loader.mjs';
import {challengeSpecs, challengeFixture, pcmBytes, sha256} from './fixtures/acoustic-onset-challenges.mjs';
import {robustnessSpecs, robustnessFixture} from './fixtures/predictive-onset-robustness.mjs';
import {adaptiveSpecs, adaptiveFixture} from './fixtures/adaptive-onset-robustness.mjs';
import {residualSpecs, residualFixture} from './fixtures/residual-onset-robustness.mjs';
import {matchOnsets} from './helpers/onset-matching.mjs';

const load = createLoader({}, {Float32Array, Float64Array});
const {extractResidualOnsets} = load('analyzer/ResidualOnsets.ts');
const {extractAdaptiveOnsets} = load('analyzer/AdaptiveOnsets.ts');
const {normalizeResidualOnsets} = load('types/residualOnsets.ts');
const {analyzeAudio} = load('analyzer/analyzeAudio.ts');
const {normalizeTrackAnalysis} = load('analyzer/normalizeAnalysisResult.ts');

function check(f) {
    const before = pcmBytes(f.samples), r = extractResidualOnsets(f.samples, f.spec.sampleRate);
    assert.deepEqual(pcmBytes(f.samples), before);
    assert.equal(JSON.stringify(normalizeResidualOnsets(r, f.duration)), JSON.stringify(r));
    for (const p of r.candidates) {
        assert.ok(p.predictorSupportEndSample <= p.proposalSample);
        assert.ok(p.predictorSupportStartSample >= p.supportStartSample);
        if (p.backgroundModel === 'clean-block') assert.ok(p.modelBlockCount >= 3);
    }
    return r;
}

test('v4 retains every known isolated/mixed/dense attack and fixes the 58 carrier misses and two ramps at 2 ms', () => {
    const totals = {c2: 0, an03: 0, an03b: 0};
    for (const [matrix, specs, fixture] of [['c2', challengeSpecs(), challengeFixture],
        ['an03', robustnessSpecs(), robustnessFixture], ['an03b', adaptiveSpecs(), adaptiveFixture]]) {
        for (const spec of specs) {
            const f = fixture(spec), r = check(f), times = Array.from(r.candidates, c => c.time);
            if (spec.family === 'negative') assert.equal(times.filter(t => t >= .1).length, 0, spec.id);
            else {
                const m = matchOnsets(f.truthSamples.map(i => i / spec.sampleRate), times, .002);
                assert.equal(m.misses, 0, spec.id); totals[matrix] += m.matchedCount;
                const extra = matrix === 'c2' ? spec.family === 'mixture' : matrix === 'an03' || spec.bed === 'tone';
                assert.equal(m.falsePositives, extra ? 1 : 0, spec.id);
                if (extra) assert.equal(r.candidates[0].endpointAmbiguous, true);
            }
        }
    }
    assert.deepEqual(totals, {c2: 432, an03: 72, an03b: 144});
});

test('clean-block provenance agrees with the authored sine recurrence without inventing confidence', () => {
    const f = adaptiveFixture({family: 'positive', sampleRate: 32000, bed: 'tone', gap: .006, phase: .41});
    const r = check(f), interior = Array.from(r.candidates).filter(c => c.time > .1);
    assert.equal(interior.length, 6);
    for (const c of interior) {
        assert.equal(c.backgroundModel, 'clean-block');
        assert.ok(Math.abs(c.predictorCoefficient - 2 * Math.cos(2 * Math.PI * 173 / 32000)) < 1e-7);
        assert.equal(c.predictorSupportStartSample, c.predictorSupportEndSample - r.hopSize - 2);
        assert.equal('confidence' in c, false);
    }
});

test('new frozen matrix remains active with limited polyphonic recall and five beating hits', () => {
    const old = JSON.parse(readFileSync('research/analyzer-lab/fixtures/an03c-robustness-frozen.json'));
    assert.equal(sha256(readFileSync('src/analyzer/ResidualOnsets.ts')), old.sourceHashes['src/analyzer/ResidualOnsets.ts']);
    const specs = residualSpecs(); assert.equal(specs.length, 84);
    let matches2 = 0, matches25 = 0, extra2 = 0, extra25 = 0, negative = 0;
    for (let i = 0; i < specs.length; i++) {
        const f = residualFixture(specs[i]), r = check(f), saved = old.cases[i];
        assert.equal(f.pcmSha256, saved.pcmSha256); assert.equal(f.truthSha256, saved.truthSha256);
        assert.equal(JSON.stringify(r.candidates), JSON.stringify(saved.candidates));
        const times = Array.from(r.candidates, c => c.time);
        if (specs[i].family === 'negative') {
            const hits = times.filter(t => t >= .1).length; negative += hits;
            if (specs[i].kind !== 'beating') assert.equal(hits, 0);
        } else {
            const truth = f.truthSamples.map(n => n / specs[i].sampleRate);
            const a = matchOnsets(truth, times, .002), b = matchOnsets(truth, times, .025);
            matches2 += a.matchedCount; extra2 += a.falsePositives;
            matches25 += b.matchedCount; extra25 += b.falsePositives;
        }
    }
    // Post-inspection preservation, not a universal musical acceptance criterion.
    assert.deepEqual([matches2, extra2, matches25, extra25, negative], [158, 26, 160, 24, 5]);
});

test('explicit v4 selector preserves default/false/v3 projections and returns the existing adaptive field', () => {
    const f = adaptiveFixture({family: 'positive', sampleRate: 12000, bed: 'tone', gap: .006, phase: .41});
    const input = {samples: f.samples, sampleRate: 12000};
    const base = analyzeAudio(input);
    assert.equal(JSON.stringify(base), JSON.stringify(analyzeAudio({...input, options: {adaptiveOnsets: false}})));
    const v3 = analyzeAudio({...input, options: {adaptiveOnsets: true}});
    assert.equal(JSON.stringify(v3.trackAnalysis.adaptiveOnsets), JSON.stringify(extractAdaptiveOnsets(f.samples, 12000)));
    const v4 = analyzeAudio({...input, options: {adaptiveOnsets: true, adaptiveOnsetVersion: 4, predictiveOnsets: true, acousticOnsets: {}}});
    assert.equal(v4.trackAnalysis.adaptiveOnsets.algorithm, 'residual-innovation-v4');
    assert.equal(v4.trackAnalysis.predictiveOnsets.algorithm, 'predictive-innovation-v2');
    assert.equal(v4.trackAnalysis.acousticOnsets.algorithm, 'overlap-energy-rise-v1');
    assert.equal(JSON.stringify(normalizeTrackAnalysis(v4.trackAnalysis).adaptiveOnsets), JSON.stringify(v4.trackAnalysis.adaptiveOnsets));
    const restored = JSON.parse(JSON.stringify(v4));
    delete restored.trackAnalysis.adaptiveOnsets; delete restored.trackAnalysis.predictiveOnsets; delete restored.trackAnalysis.acousticOnsets;
    assert.equal(JSON.stringify(restored), JSON.stringify(base));
    for (const options of [...[null, 0, 3, 6, 4.1, NaN, '4', {}, []].map(v => ({adaptiveOnsets: true, adaptiveOnsetVersion: v})),
        {adaptiveOnsetVersion: 4}, {adaptiveOnsets: false, adaptiveOnsetVersion: 4}]) {
        let progress = 0;
        assert.throws(() => analyzeAudio({...input, options, onProgress: () => progress++}), /version must be 4/);
        assert.equal(progress, 0);
    }
});

test('v4 normalization rejects corrupted model identity, block counts and physically impossible fit support', () => {
    const f = adaptiveFixture({family: 'positive', sampleRate: 32000, bed: 'tone', gap: .006, phase: .41});
    const original = extractResidualOnsets(f.samples, 32000);
    for (const mutate of [r => r.algorithm = 'wrong', r => r.backgroundEstimator = 'unknown',
        r => r.candidates[1].backgroundModel = 'unknown', r => r.candidates[1].modelBlockCount = 2,
        r => r.candidates[1].modelBlockCount = 16, r => r.candidates[1].predictorSupportEndSample++,
        r => r.candidates[1].predictorSupportStartSample--, r => r.candidates[1].time++,
        r => r.candidates[1].innovationRatio = 7, r => r.candidates[1].supportEndSample--,
        r => r.candidates[0].modelBlockCount = 1, r => r.candidates.reverse()]) {
        const r = JSON.parse(JSON.stringify(original)); mutate(r);
        assert.equal(normalizeResidualOnsets(r, f.duration), undefined);
    }
    for (const x of [null, false, 0, '', []]) assert.equal(normalizeResidualOnsets(x, f.duration), undefined);
    assert.equal(normalizeResidualOnsets(original, f.duration, {sampleRate: 44100, sampleCount: f.samples.length}), undefined);
});

test('v4 input guards, deterministic output and real impulse/tail clocks remain stable across long histories', () => {
    for (const fs of [8000, 44100, 96000]) {
        const x = Float32Array.from({length: 6 * fs}, (_, i) => .15 * Math.sin(2 * Math.PI * 110 * i / fs));
        const at = Math.round(5.3 * fs); x[at] += .5;
        const a = extractResidualOnsets(x, fs), later = Array.from(a.candidates).filter(c => c.time >= .1);
        assert.equal(later.length, 1); assert.ok(Math.abs(later[0].sampleIndex - at) <= 1);
        assert.equal(JSON.stringify(a), JSON.stringify(extractResidualOnsets(x, fs)));
        for (const size of [1, 2, 511]) {
            const tail = new Float32Array(size); tail[size - 1] = .5;
            const r = extractResidualOnsets(tail, fs);
            assert.ok(r.candidates.length > 0);
            assert.ok(r.candidates.every(p => p.sampleIndex < size && p.endpointAmbiguous));
        }
    }
    assert.equal(extractResidualOnsets(new Float32Array(1001), 44100).candidates.length, 0);
    for (const x of [[], new Float64Array([0]), new Float32Array(), new Float32Array([NaN]), new Float32Array([9])])
        assert.throws(() => extractResidualOnsets(x, 44100));
    for (const fs of [0, 999, 384001, 44100.5, NaN]) assert.throws(() => extractResidualOnsets(new Float32Array([0]), fs));
});
