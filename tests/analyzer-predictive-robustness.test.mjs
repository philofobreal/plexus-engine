import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { robustnessSpecs, robustnessFixture } from './fixtures/predictive-onset-robustness.mjs';
import { matchOnsets } from './helpers/onset-matching.mjs';
import { pcmBytes } from './fixtures/acoustic-onset-challenges.mjs';
const {extractPredictiveOnsets} = createLoader({}, {Float32Array, Float64Array})('analyzer/PredictiveOnsets.ts');

test('frozen robustness preserves all 72 mono/poly added attacks and clean annotated negatives', () => {
    let truths = 0, matched = 0, negatives = 0;
    const specs = robustnessSpecs(); assert.equal(specs.length, 45);
    for (const spec of specs) {
        const f = robustnessFixture(spec), before = pcmBytes(f.samples);
        const r = extractPredictiveOnsets(f.samples, spec.sampleRate);
        assert.deepEqual(pcmBytes(f.samples), before);
        const times = Array.from(r.candidates, p => p.time);
        if (spec.family === 'positive') {
            const m = matchOnsets(f.truthSamples.map(i => i / spec.sampleRate), times, .025);
            assert.equal(m.misses, 0, spec.id);
            truths += f.truthSamples.length; matched += m.matchedCount;
            // Clip-start candidates remain explicit unknown-prior evidence, not hidden.
            assert.ok(r.candidates.filter(p => p.time < .1).every(p => p.endpointAmbiguous));
        } else {
            negatives++;
            assert.equal(times.filter(t => t >= f.negativeStart).length, 0, spec.id);
        }
    }
    assert.equal(truths, 72); assert.equal(matched, 72); assert.equal(negatives, 21);
});

test('long sustain across rolling rebases remains quiet and observes a later added hit', () => {
    const fs = 16000, x = Float32Array.from({length: fs * 6}, (_, i) => .2 * Math.sin(2 * Math.PI * 110 * i / fs));
    const at = Math.round(5.3 * fs);
    x[at] += .1;
    const r = extractPredictiveOnsets(x, fs);
    const observed = Array.from(r.candidates, p => p.time).filter(t => t >= .1);
    assert.deepEqual(matchOnsets([at / fs], observed, .025), {matchedCount: 1, misses: 0, falsePositives: 0});
});
