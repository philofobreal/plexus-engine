import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash,pairwiseAssociation} from './fixtures/musical-entity-corpus.mjs';

test('association recall includes abstained known positives without counting unknown pairs as true negatives',()=>{
    const truth=[{observationId:'a',source:'A'},{observationId:'b',source:'A'},{observationId:'c',source:'B'}];
    const result=pairwiseAssociation(truth,[{observationId:'a',sourceId:'one'},
        {observationId:'b',sourceId:null},{observationId:'c',sourceId:'one'}],'source');
    assert.equal(result.falsePositive,1);assert.equal(result.falseNegative,1);assert.equal(result.trueNegative,0);
    assert.equal(result.unknownPairs,2);assert.equal(result.precision,0);assert.equal(result.recall,0);
    assert.equal(result.coverage,2/3);
});

test('frozen research retains every measured source snapshot and disjoint transfer tuple',()=>{
    const root='research/analyzer-lab/fixtures/',development=JSON.parse(readFileSync(root+'an04a-development-01.json')),
        transfer=JSON.parse(readFileSync(root+'an04a-transfer-frozen.json'));
    const tuples=new Set(development.cases.map(c=>JSON.stringify({...c.spec,split:undefined})));
    for(const [name,report] of [['an04a-development-01.json',development],['an04a-transfer-frozen.json',transfer]]){
        for(const [path,digest] of Object.entries(report.sourceHashes))assert.equal(hash(readFileSync(root+name+'.sources/'+path)),digest);
        assert.equal(report.productionPromotion,false);assert.equal(report.independentRecordedMusicAccuracy,null);
        assert.equal(report.externalReferenceStatus,'unavailable-no-two-compatible-providers');
        for(const c of report.cases)for(const o of c.observations){assert.equal(o.sourceId,undefined);assert.equal(o.motifId,undefined);}
    }
    assert.ok(transfer.cases.every(c=>!tuples.has(JSON.stringify({...c.spec,split:undefined}))));
    assert.equal(transfer.frozenReference.sha256,hash(readFileSync(root+'an04a-development-01.json')));
});

test('counterexamples to musical source identity remain present in the frozen evaluation',()=>{
    const report=JSON.parse(readFileSync('research/analyzer-lab/fixtures/an04a-transfer-frozen.json'));
    const sequential=report.controls.find(c=>c.name==='indistinguishable-sequential');
    const changed=report.controls.find(c=>c.name==='same-source-timbre-change');
    // Validate archived measurement arithmetic against explicit authored truth, not the live algorithm's future behavior.
    for(const c of [sequential,changed]){
        assert.ok(c);assert.deepEqual(pairwiseAssociation(c.truth,c.registry.assignments,'source'),c.source);
        assert.equal(c.registry.groundTruthStatus,false);assert.equal(c.registry.confidence,null);
    }
    assert.ok(report.knownLimits.length>0);
});
