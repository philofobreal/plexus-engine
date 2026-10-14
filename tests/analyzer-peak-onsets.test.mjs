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
import {peakSpecs, peakFixture} from './fixtures/peak-onset-robustness.mjs';
import {matchOnsets} from './helpers/onset-matching.mjs';

const load=createLoader({}, {Float32Array,Float64Array});
const {extractPeakOnsets}=load('analyzer/PeakOnsets.ts');
const {extractContinuationOnsets}=load('analyzer/ContinuationOnsets.ts');
const read=p=>JSON.parse(readFileSync(p));

function replay(matrices,saved) {
    let cursor=0,matched=0,extras=0,negatives=0;
    for(const [specs,fixture] of matrices) for(const spec of specs) {
        const f=fixture(spec),old=saved.cases[cursor++],before=pcmBytes(f.samples);
        const r=extractPeakOnsets(f.samples,spec.sampleRate);
        assert.deepEqual(pcmBytes(f.samples),before);
        assert.equal(f.pcmSha256,old.pcmSha256); assert.equal(f.truthSha256,old.truthSha256);
        assert.equal(JSON.stringify(r.candidates),JSON.stringify(old.candidates));
        for(const c of r.candidates) {
            assert.equal(c.time,c.sampleIndex/spec.sampleRate);
            assert.ok(c.supportStartSample>=0 && c.supportStartSample<=c.sampleIndex);
            assert.ok(c.supportEndSample<=f.samples.length && c.supportEndSample>c.sampleIndex);
            assert.ok(c.supportEndSample<=c.proposalSample+r.lookaheadSamples);
        }
        // Every previous candidate must retain its timestamp/evidence. New peaks never displace it.
        const times=new Set(Array.from(r.candidates,c=>c.sampleIndex));
        for(const c of extractContinuationOnsets(f.samples,spec.sampleRate).candidates) assert.ok(times.has(c.sampleIndex));
        if(f.negativeStart!==null) negatives+=r.candidates.filter(c=>c.time>=f.negativeStart).length;
        else { const m=matchOnsets(f.truthSamples.map(i=>i/spec.sampleRate),r.candidates.map(c=>c.time),.002);
            matched+=m.matchedCount; extras+=m.falsePositives; }
    }
    assert.equal(cursor,saved.cases.length);
    return [matched,extras,negatives];
}

test('peak research preserves all known evidence and adds eleven matches without known extras/negative growth',()=>{
    const saved=read('research/analyzer-lab/fixtures/an03f-development-final.json');
    const before=read('research/analyzer-lab/fixtures/an03f-development-02.json');
    assert.equal(sha256(readFileSync('src/analyzer/PeakOnsets.ts')),saved.sourceHashes['src/analyzer/PeakOnsets.ts']);
    for(const [i,c] of saved.cases.entries()) assert.deepEqual(c.eventTimes.peakV7,before.cases[i].eventTimes.peakV7);
    assert.deepEqual(replay([[challengeSpecs(),challengeFixture],[robustnessSpecs(),robustnessFixture],
        [adaptiveSpecs(),adaptiveFixture],[residualSpecs(),residualFixture],[differenceSpecs(),differenceFixture],
        [continuationSpecs(),continuationFixture]],saved),[1200,172,2]);
});

test('new transfer counterexamples remain explicit: experimental peaks add false and late candidates; no promotion',()=>{
    const saved=read('research/analyzer-lab/fixtures/an03f-transfer-frozen.json');
    assert.equal(peakSpecs().length,104);
    assert.deepEqual(replay([[peakSpecs(),peakFixture]],saved),[261,126,0]);
    const scored=read('research/analyzer-lab/fixtures/an03f-transfer-frozen.scores.json');
    const t=scored.totals.transfer.positive;
    assert.equal(t['0.002'].continuationV6.falsePositiveCount,68);
    assert.equal(t['0.025'].peakV7.matchedCount,304);
    assert.equal(t['0.025'].peakV7.falsePositiveCount,83);
});

test('peak evidence retains physical tail bounds and rejects invalid input without confidence invention',()=>{
    for(const fs of [1000,8000,44100,96000]) for(const length of [1,2,4,5,511]) {
        const s=new Float32Array(length); s[length-1]=.5;
        const r=extractPeakOnsets(s,fs);
        for(const c of r.candidates) { assert.ok(c.sampleIndex<length && c.supportEndSample<=length); assert.equal('probability' in c,false); }
    }
    for(const s of [new Float32Array(),Float32Array.of(NaN),Float32Array.of(8.1)]) assert.throws(()=>extractPeakOnsets(s,8000));
    for(const fs of [999,384001,8000.5,NaN]) assert.throws(()=>extractPeakOnsets(Float32Array.of(0),fs));
});
