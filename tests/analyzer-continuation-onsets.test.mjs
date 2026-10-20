import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoader} from './helpers/xr-loader.mjs';
import {challengeSpecs, challengeFixture, pcmBytes, sha256} from './fixtures/acoustic-onset-challenges.mjs';
import {robustnessSpecs, robustnessFixture} from './fixtures/predictive-onset-robustness.mjs';
import {adaptiveSpecs, adaptiveFixture} from './fixtures/adaptive-onset-robustness.mjs';
import {residualSpecs, residualFixture} from './fixtures/residual-onset-robustness.mjs';
import {differenceSpecs, differenceFixture} from './fixtures/difference-onset-robustness.mjs';
import {continuationSpecs, continuationFixture} from './fixtures/continuation-onset-robustness.mjs';
import {matchOnsets} from './helpers/onset-matching.mjs';

const load = createLoader({}, {Float32Array, Float64Array});
const {extractContinuationOnsets} = load('analyzer/ContinuationOnsets.ts');
const read = path => JSON.parse(readFileSync(path));

function replay(matrices, saved) {
    let position = 0, matched = 0, extras = 0, negatives = 0;
    for (const [specs, fixture] of matrices) for (const spec of specs) {
        const f = fixture(spec), old = saved.cases[position++], before = pcmBytes(f.samples);
        assert.equal(f.pcmSha256, old.pcmSha256); assert.equal(f.truthSha256, old.truthSha256);
        const r = extractContinuationOnsets(f.samples, spec.sampleRate);
        assert.deepEqual(pcmBytes(f.samples), before);
        assert.equal(JSON.stringify(r.candidates), JSON.stringify(old.candidates), spec.id);
        assert.equal(JSON.stringify(r.rejected), JSON.stringify(old.rejected), spec.id);
        for (const c of [...r.candidates, ...r.rejected.map(p => p.candidate)]) {
            assert.ok(c.supportStartSample >= 0 && c.supportStartSample <= c.sampleIndex);
            assert.ok(c.supportEndSample > c.sampleIndex && c.supportEndSample <= f.samples.length);
            assert.equal(c.time, c.sampleIndex / spec.sampleRate);
            assert.ok(c.supportEndSample <= c.proposalSample + r.lookaheadSamples);
            assert.equal('probability' in c, false);
        }
        for (const p of r.rejected) {
            assert.ok(p.continuationPower < p.continuationFloor);
            assert.ok(p.afterSecondPower < p.beforeSecondPower);
            assert.equal(p.candidate.evidenceSource, 'residual-v4-confirmed');
            assert.equal(p.candidate.endpointAmbiguous, false);
        }
        const times = Array.from(r.candidates, c => c.time);
        if (f.negativeStart !== null) negatives += times.filter(t => t >= f.negativeStart).length;
        else {
            const m = matchOnsets(f.truthSamples.map(i => i / spec.sampleRate), times, .002);
            matched += m.matchedCount; extras += m.falsePositives;
        }
    }
    assert.equal(position, saved.cases.length);
    return [matched, extras, negatives];
}

test('continuation keeps all 1081 prior matches and 140 extras while reducing removal candidates from six to two', () => {
    const saved = read('research/analyzer-lab/fixtures/an03e-development-final.json');
    const oldKnown = read('research/analyzer-lab/fixtures/an03d-development-final.json');
    const oldD = read('research/analyzer-lab/fixtures/an03d-robustness-frozen.json');
    assert.equal(sha256(readFileSync('src/analyzer/DifferenceOnsets.ts')), oldD.sourceHashes['src/analyzer/DifferenceOnsets.ts']);
    assert.equal(sha256(readFileSync('src/analyzer/ContinuationOnsets.ts')), saved.sourceHashes['src/analyzer/ContinuationOnsets.ts']);
    for (const [i, c] of saved.cases.entries()) {
        const prior = i < 333 ? oldKnown.cases[i] : oldD.cases[i - 333];
        assert.deepEqual(c.eventTimes.differenceV5, prior.eventTimes.differenceV5);
        assert.equal(c.pcmSha256, prior.pcmSha256); assert.equal(c.truthSha256, prior.truthSha256);
    }
    assert.deepEqual(replay([[challengeSpecs(), challengeFixture], [robustnessSpecs(), robustnessFixture],
        [adaptiveSpecs(), adaptiveFixture], [residualSpecs(), residualFixture], [differenceSpecs(), differenceFixture]], saved),
    [1081, 140, 2]);
});

test('predeclared 56-case transfer preserves 108/192 matches and 32 extras; 14 removal candidates become zero', () => {
    const saved = read('research/analyzer-lab/fixtures/an03e-transfer-frozen.json');
    assert.equal(continuationSpecs().length, 56);
    assert.deepEqual(replay([[continuationSpecs(), continuationFixture]], saved), [108, 32, 0]);
});

test('directional filtering is deterministic and invariant under polarity and ordinary gain changes', () => {
    const spec = continuationSpecs().find(s => s.family === 'negative' && s.kind === 'remove-high');
    const f = continuationFixture(spec), baseline = extractContinuationOnsets(f.samples, spec.sampleRate);
    assert.ok(baseline.rejected.length > 0);
    for (const gain of [-1, .5, 2]) {
        const r = extractContinuationOnsets(Float32Array.from(f.samples, x => gain * x), spec.sampleRate);
        assert.equal(JSON.stringify(r.candidates.map(c => c.sampleIndex)), JSON.stringify(baseline.candidates.map(c => c.sampleIndex)));
        assert.equal(JSON.stringify(r.rejected.map(p => p.candidate.sampleIndex)), JSON.stringify(baseline.rejected.map(p => p.candidate.sampleIndex)));
    }
    assert.equal(JSON.stringify(extractContinuationOnsets(f.samples, spec.sampleRate)), JSON.stringify(baseline));
});

test('short tails keep physical support and ambiguous evidence; malformed PCM/clocks fail', () => {
    for (const sampleRate of [1000, 8000, 44100, 96000]) for (const length of [1, 2, 4, 5, 511]) {
        const samples = new Float32Array(length); samples[length - 1] = .5;
        const r = extractContinuationOnsets(samples, sampleRate);
        assert.equal(r.rejected.length, 0);
        for (const c of r.candidates) {
            assert.ok(c.sampleIndex < length && c.supportEndSample <= length);
            assert.equal(c.endpointAmbiguous, true);
        }
    }
    for (const samples of [new Float32Array(), Float32Array.of(NaN), Float32Array.of(Infinity), Float32Array.of(8.1)])
        assert.throws(() => extractContinuationOnsets(samples, 8000));
    for (const fs of [0, 999, 384001, 8000.5, NaN]) assert.throws(() => extractContinuationOnsets(Float32Array.of(0), fs));
});
