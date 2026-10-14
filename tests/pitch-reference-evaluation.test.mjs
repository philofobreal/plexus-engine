import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash} from './fixtures/musical-entity-corpus.mjs';
const root='research/analyzer-lab/fixtures/';
const read=name=>JSON.parse(readFileSync(root+name));

test('actual pitch measurement retains both providers, original clocks and exact source snapshots',()=>{
    for(const name of ['an04b-development-01.json','an04b-transfer-frozen.json','an04b-recorded-01.json']){
        const report=read(name);
        for(const [path,digest] of Object.entries(report.sourceHashes))assert.equal(hash(readFileSync(root+name+'.sources/'+path)),digest);
        for(const c of report.cases){
            assert.deepEqual(c.provider.providerVersions,{'librosa-yin':'0.11.0','audioflux-ncf':'0.1.9'});
            assert.equal(c.provider.pcmSha256,c.identity.pcmSha256);
            assert.equal(c.provider.raw['librosa-yin'].length,c.analysis.frames.length);
            assert.equal(c.provider.raw['audioflux-ncf'].length,c.analysis.frames.length);
            assert.equal(c.provider.parameters.centering,false);assert.equal(c.provider.parameters.padding,false);
            assert.equal(c.measurements.inferredSources,0);assert.equal(c.measurements.inferredMusicalMotifs,0);
            for(const p of c.provider.pairs){assert.equal(p.votes.length,2);assert.equal(p.groundTruthStatus,false);
                assert.equal(p.supportStartSample,p.frameIndex*c.analysis.hopLength);
                assert.equal(p.supportEndSample,p.supportStartSample+c.analysis.frameLength);}
        }
    }
});

test('frozen monophonic transfer is disjoint and the comparison excludes unannotated recordings',()=>{
    const a=read('an04b-development-01.json'),b=read('an04b-transfer-frozen.json'),recorded=read('an04b-recorded-01.json');
    const seen=new Set(a.cases.map(c=>JSON.stringify(c.spec)));
    assert.ok(b.cases.every(c=>!seen.has(JSON.stringify(c.spec))));
    assert.equal(b.frozenReference.sha256,hash(readFileSync(root+'an04b-development-01.json')));
    assert.equal(recorded.groundTruthType,'unavailable');assert.equal(recorded.summary.refinedMeanAbsoluteCents,null);
    assert.ok(recorded.cases.every(c=>c.truth===null&&c.measurements.recordedAccuracy===null));
});

test('shared provider guesses on non-tonal controls cannot silently become supervised source labels',()=>{
    const report=read('an04b-development-01.json');
    for(const kind of ['noise','below-floor']){
        const c=report.cases.find(c=>c.spec.kind===kind);assert.ok(c);
        assert.ok(c.provider.pairs.length>0,'retain the observed shared counterexample');
        assert.equal(c.measurements.proposals,0);assert.equal(c.measurements.qualified,0);
        assert.equal(c.measurements.inferredSources,0);
    }
    assert.equal(report.productionPromotion,false);assert.equal(report.confidence,null);
});
