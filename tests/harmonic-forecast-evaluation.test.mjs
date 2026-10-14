import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash,pcmBytes} from './fixtures/musical-entity-corpus.mjs';
import {renderForecastFixture} from './fixtures/harmonic-forecast-corpus.mjs';
import {renderPitchFixture} from './fixtures/pitch-candidate-corpus.mjs';
import {createLoader} from './helpers/xr-loader.mjs';
const directory='research/analyzer-lab/fixtures/',names=['an04d-development-02','an04d-transfer-frozen-02','an04d-recorded-01'],
    reports=names.map(name=>JSON.parse(readFileSync(directory+name+'.json'))),
    {fitHarmonicForecast,evaluateHarmonicForecast}=createLoader({}, {Float32Array,Float64Array})('analyzer/HarmonicForecast.ts');

test('retained prefix forecast results and predecessor snapshots verify exact source identities',()=>{
    for(const name of [...names,'an04d-development-01','an04d-transfer-frozen']){
        const path=directory+name+'.json',report=JSON.parse(readFileSync(path));
        for(const [source,digest] of Object.entries(report.sourceHashes))assert.equal(hash(readFileSync(path+'.sources/'+source)),digest);
        if(names.includes(name))for(const [source,digest] of Object.entries(report.sourceHashes))assert.equal(hash(readFileSync(source)),digest);
        assert.equal(report.productionPromotion,false);assert.equal(report.recordedAccuracy,null);
    }
    assert.equal(reports[1].frozenReference.sha256,hash(readFileSync(directory+names[0]+'.json')));
    for(const [old,newName] of [['an04d-development-01',names[0]],['an04d-transfer-frozen',names[1]]]){
        const a=JSON.parse(readFileSync(directory+old+'.json')),b=JSON.parse(readFileSync(directory+newName+'.json'));
        assert.deepEqual(a.cases.map(c=>c.frames),b.cases.map(c=>c.frames),'budget refreeze must not change forecast outputs');
    }
});
test('actual sampled arithmetic and prefix pitch agreement retain both original provider results',()=>{
    for(const report of reports){
        for(const r of report.arithmetic.frames){
            assert.equal(r.arithmeticAgreement,true);assert.ok(r.plexusMaxDifference<=1e-10);assert.equal(r.musicalTruth,false);
            assert.equal(r.results.numpy.rank,r.columns);assert.equal(r.results.scipy.rank,r.columns);
        }
        for(const c of report.cases){
            const sampled=report.pitch.cases.filter(p=>p.parentCaseId===c.caseId);
            assert.deepEqual(sampled.map(p=>p.parentFrameIndex),[...new Set([0,c.frames.length-1])].filter(i=>i>=0));
            for(const p of sampled){
                assert.deepEqual(p.providerVersions,{'librosa-yin':'0.11.0','audioflux-ncf':'0.1.9'});
                assert.equal(p.identity.pcmSha256,c.frames[p.parentFrameIndex].forecast.identity.pcmSha256);
                const own=p.ownFrequencyHz,pair=p.pairs[0];
                assert.equal(p.ownQualified,own!==null&&Boolean(pair)&&pair.votes.every(v=>Math.abs(1200*Math.log2(own/v.frequencyHz))<=25));
                if(pair){assert.equal(pair.confidence,null);assert.equal(pair.groundTruthStatus,false);assert.equal(pair.votes.length,2);}
            }
        }
    }
});
test('synthetic first/last forecast frames replay from raw PCM without future or teacher inputs',()=>{
    for(const report of reports.slice(0,2))for(const c of report.cases){
        const input=c.caseId.startsWith('new-')?renderForecastFixture(c.spec):renderPitchFixture(c.spec);
        assert.equal(hash(pcmBytes(input.samples)),c.identity.pcmSha256);
        for(const index of [...new Set([0,c.frames.length-1])].filter(i=>i>=0)){
            const f=c.frames[index],prefix=input.samples.slice(f.supportStartSample,f.prefixEndSample);
            const fitted=fitHarmonicForecast(prefix,f.forecast.identity);
            assert.equal(hash(pcmBytes(prefix)),f.forecast.identity.pcmSha256);
            assert.deepEqual(JSON.parse(JSON.stringify(fitted)),f.forecast);
            assert.deepEqual(JSON.parse(JSON.stringify(evaluateHarmonicForecast(fitted,input.samples.slice(f.prefixEndSample,f.supportEndSample)))),f.evaluation);
        }
    }
});
test('frozen transfer includes beneficial envelopes and retained ambiguity and modulation failures',()=>{
    const report=reports[1],find=kind=>report.cases.find(c=>c.spec.kind===kind),score=(c,i)=>c.modelSummary[i].heldOut.mean;
    for(const kind of ['linear-rise','linear-fall'])assert.ok(score(find(kind),1)<score(find(kind),0)/4);
    for(const kind of ['octave','unison']){const c=find(kind);assert.equal(c.truth.sourceCount,2);assert.ok(score(c,0)<.001);}
    assert.ok(score(find('vibrato'),0)>.1);assert.equal(find('silence').modelSummary[0].heldOut.mean,null);
    assert.ok(report.cases.every(c=>c.sourceIsolation==='unverified-mixture'));
});
