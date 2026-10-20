import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash} from './fixtures/musical-entity-corpus.mjs';
const root='research/analyzer-lab/fixtures/';
const read=name=>JSON.parse(readFileSync(root+name));

test('harmonic measurements retain exact snapshots and immutable pitch predecessor identities',()=>{
    for(const name of ['an04c-development-01.json','an04c-transfer-frozen.json','an04c-recorded-01.json']){
        const r=read(name);
        for(const [path,digest] of Object.entries(r.sourceHashes))assert.equal(hash(readFileSync(root+name+'.sources/'+path)),digest);
        assert.equal(hash(readFileSync(r.baselineReference.path)),r.baselineReference.sha256);
        assert.equal(r.sourceIsolationReference,'unavailable');assert.equal(r.productionPromotion,false);
        assert.equal(r.confidence,null);
        for(const c of r.cases)assert.equal(c.sourceIsolation,'unverified-mixture');
    }
});

test('two actual arithmetic providers agree only on the specified fixed-frequency model, not source isolation',()=>{
    for(const name of ['an04c-development-01.json','an04c-transfer-frozen.json','an04c-recorded-01.json']){
        const r=read(name);assert.deepEqual(r.arithmetic.versions,{numpy:'2.2.6',scipy:'1.15.3'});
        assert.equal(r.arithmetic.cutoff,1e-10);assert.equal(r.arithmetic.scipyDriver,'gelsd');
        for(const frame of r.arithmetic.frames){
            assert.equal(frame.arithmeticAgreement,true);assert.ok(frame.plexusMaxDifference<1e-10);
            assert.equal(frame.musicalTruth,false);
        }
    }
});

test('frozen transfer and counterexamples remain explicit without changing raw musical pitch',()=>{
    const a=read('an04c-development-01.json'),b=read('an04c-transfer-frozen.json');
    assert.equal(b.frozenReference.sha256,hash(readFileSync(root+'an04c-development-01.json')));
    const specs=new Set(a.cases.map(c=>JSON.stringify(c.spec)));
    assert.ok(b.cases.every(c=>!specs.has(JSON.stringify(c.spec))));
    for(const kind of ['octave','unison']){
        const c=b.cases.find(c=>c.caseId.startsWith('new-')&&c.spec.kind===kind);
        assert.equal(c.truth.sourceCount,2);assert.ok(c.statusCounts['steady-harmonic-compatible']>0);
    }
    const vibrato=b.cases.find(c=>c.spec.kind==='vibrato');
    assert.equal(vibrato.truth.sourceCount,1);assert.ok(vibrato.statusCounts['large-residual']>0);
    const recorded=read('an04c-recorded-01.json');assert.equal(recorded.recordedAccuracy,null);
    assert.equal(recorded.summary.steadyCompatibleFrames,0,'retain measured restrictive-model limitation');
});
