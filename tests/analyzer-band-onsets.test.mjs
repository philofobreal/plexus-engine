import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoader} from './helpers/xr-loader.mjs';
import {challengeSpecs,challengeFixture,pcmBytes,sha256} from './fixtures/acoustic-onset-challenges.mjs';
import {robustnessSpecs,robustnessFixture} from './fixtures/predictive-onset-robustness.mjs';
import {adaptiveSpecs,adaptiveFixture} from './fixtures/adaptive-onset-robustness.mjs';
import {residualSpecs,residualFixture} from './fixtures/residual-onset-robustness.mjs';
import {differenceSpecs,differenceFixture} from './fixtures/difference-onset-robustness.mjs';
import {continuationSpecs,continuationFixture} from './fixtures/continuation-onset-robustness.mjs';
import {peakSpecs,peakFixture} from './fixtures/peak-onset-robustness.mjs';
import {bandSpecs,bandFixture} from './fixtures/band-onset-robustness.mjs';
import {matchOnsets} from './helpers/onset-matching.mjs';

const {extractBandOnsets}=createLoader({}, {Float32Array,Float64Array})('analyzer/BandOnsets.ts');
const read=p=>JSON.parse(readFileSync('research/analyzer-lab/fixtures/'+p));
function check(spec,f,r,saved){
    assert.equal(f.pcmSha256,saved.pcmSha256);assert.equal(f.truthSha256,saved.truthSha256);
    assert.equal(JSON.stringify(r.candidates),JSON.stringify(saved.candidates));
    for(const c of r.candidates){
        assert.equal(c.time,c.sampleIndex/spec.sampleRate);
        assert.ok(c.supportStartSample>=0&&c.supportStartSample<=c.sampleIndex);
        assert.ok(c.supportEndSample<=f.samples.length&&c.supportEndSample>c.sampleIndex);
        if(c.evidenceSource==='physical-band-innovation'){
            assert.equal(c.supportStartSample,0);assert.ok(r.bandCentresHz.includes(c.bandHz));
            assert.equal(c.endpointAmbiguous,false);assert.ok(c.bandRiseRatio>=1.3);
        }
    }
    assert.equal(r.physicalFloor,1e-4);assert.equal(r.physicalPeakContrast,8);
    assert.equal(r.predictorRateHz,spec.sampleRate/r.predictorLagSamples);
    assert.ok(r.bandCentresHz.every(f=>f<.4*spec.sampleRate));
}

test('physical bands preserve all 589 known cases and add 63 strict matches without extra or negative growth',()=>{
    const saved=read('an03g-development-final.json');
    const evolution=read('t10a-source-evolution.json');
    assert.equal(sha256(readFileSync(evolution.predecessorSource)),saved.sourceHashes['src/analyzer/BandOnsets.ts']);
    assert.equal(evolution.predecessorSha256,saved.sourceHashes['src/analyzer/BandOnsets.ts']);
    assert.equal(sha256(readFileSync('src/analyzer/BandOnsets.ts')),evolution.replacementSha256);
    assert.equal(sha256(readFileSync(evolution.helper.path)),evolution.helper.sha256);
    assert.equal(evolution.oldMeasurementsRewritten,false);
    let cursor=0,matches=0,extras=0,negatives=0;
    const totals={};
    for(const [matrix,specs,fixture] of [['c2',challengeSpecs(),challengeFixture],['an03',robustnessSpecs(),robustnessFixture],
        ['an03b',adaptiveSpecs(),adaptiveFixture],['an03c',residualSpecs(),residualFixture],['an03d',differenceSpecs(),differenceFixture],
        ['an03e',continuationSpecs(),continuationFixture],['an03f',peakSpecs(),peakFixture]])for(const spec of specs){
        const f=fixture(spec),before=pcmBytes(f.samples),old=saved.cases[cursor++],r=extractBandOnsets(f.samples,spec.sampleRate);
        assert.deepEqual(pcmBytes(f.samples),before);check(spec,f,r,{...Object.values(old.variants)[0],pcmSha256:old.pcmSha256,truthSha256:old.truthSha256});
        assert.equal(f.pcmSha256,old.pcmSha256);assert.equal(f.truthSha256,old.truthSha256);
        for(const t of old.baseTimes)assert.ok(r.candidates.some(c=>c.time===t));
        const sum=totals[matrix]??={matched2ms:0,extras2ms:0,negatives:0};
        if(f.negativeStart!==null){const n=r.candidates.filter(c=>c.time>=f.negativeStart).length;sum.negatives+=n;negatives+=n;}
        else{const m=matchOnsets(f.truthSamples.map(i=>i/spec.sampleRate),r.candidates.map(c=>c.time),.002);
            sum.matched2ms+=m.matchedCount;sum.extras2ms+=m.falsePositives;matches+=m.matchedCount;extras+=m.falsePositives;}
    }
    assert.equal(cursor,589);assert.deepEqual([matches,extras,negatives],[1494,240,2]);
    for(const [matrix,s] of Object.entries(totals)){
        const baseline=saved.totals[matrix].v6;
        assert.ok(s.matched2ms>=baseline.matched2ms);assert.equal(s.extras2ms,baseline.extras2ms);assert.equal(s.negatives,baseline.negatives);
    }
});

test('frozen 112 new conditions gain 71 matches and retain four existing negative counterexamples',()=>{
    const saved=read('an03g-transfer-frozen.json');let cursor=0,matches=0,extras=0,negatives=0;
    for(const spec of bandSpecs()){
        const f=bandFixture(spec),old=saved.cases[cursor++],r=extractBandOnsets(f.samples,spec.sampleRate);
        check(spec,f,r,{...old.variants.v8,pcmSha256:old.pcmSha256,truthSha256:old.truthSha256});
        for(const c of old.variants.v6.candidates)assert.ok(r.candidates.some(p=>JSON.stringify(p)===JSON.stringify(c)));
        if(f.negativeStart!==null)negatives+=r.candidates.filter(c=>c.time>=f.negativeStart).length;
        else{const m=matchOnsets(f.truthSamples.map(i=>i/spec.sampleRate),r.candidates.map(c=>c.time),.002);matches+=m.matchedCount;extras+=m.falsePositives;}
    }
    assert.equal(cursor,112);assert.deepEqual([matches,extras,negatives],[279,64,4]);
    assert.equal(saved.totals.v6.matches2ms,208);assert.equal(saved.totals.v6.extras2ms,64);assert.equal(saved.totals.v6.negatives,4);
});

test('new soft repeated attacks retain exact timestamps under polarity and binary gain changes',()=>{
    const spec=peakSpecs().find(s=>s.id==='an03f-012'),f=peakFixture(spec),before=pcmBytes(f.samples);
    const result=extractBandOnsets(f.samples,spec.sampleRate),times=result.candidates.map(c=>c.sampleIndex);
    assert.equal(matchOnsets(f.truthSamples.map(i=>i/spec.sampleRate),result.candidates.map(c=>c.time),.002).matchedCount,6);
    for(const gain of [-1,.5,2]){
        const r=extractBandOnsets(Float32Array.from(f.samples,v=>v*gain),spec.sampleRate);
        assert.deepEqual(r.candidates.map(c=>c.sampleIndex),times);
    }
    assert.equal(JSON.stringify(result),JSON.stringify(extractBandOnsets(f.samples,spec.sampleRate)));
    assert.deepEqual(pcmBytes(f.samples),before);
});

test('real short tails, exact silence and malformed physical inputs cannot invent support or probability',()=>{
    for(const fs of [1000,8000,16000,44100,96000])for(const length of [1,2,4,5,511]){
        const samples=new Float32Array(length);samples[length-1]=.5;
        const r=extractBandOnsets(samples,fs);
        for(const c of r.candidates){assert.ok(c.sampleIndex<length&&c.supportEndSample<=length);assert.equal('probability' in c,false);}
    }
    assert.equal(extractBandOnsets(new Float32Array(8000),8000).candidates.length,0);
    for(const fs of [999,384001,8000.5,NaN])assert.throws(()=>extractBandOnsets(Float32Array.of(0),fs));
    for(const samples of [new Float32Array(),Float32Array.of(NaN),Float32Array.of(8.1)])assert.throws(()=>extractBandOnsets(samples,8000));
    assert.throws(()=>extractBandOnsets(Float32Array.of(0),8000,{physicalFloor:1}));
});
