import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
import {renderEntityCorpus,corpusSpecs} from './fixtures/musical-entity-corpus.mjs';

const load=createLoader({}, {Float32Array});
const {extractHarmonicTimbre}=load('analyzer/HarmonicTimbre.ts');
const {trackMusicalEntities}=load('analyzer/MusicalEntityTracker.ts');
const {projectMusicalRelations}=load('semantics/musicalRelations.ts');
const make=()=>{const f=renderEntityCorpus(corpusSpecs('development')[0],extractHarmonicTimbre);
    return trackMusicalEntities(f.observations,f.identity);};

test('relations preserve evidence lineage for source overlap, motif return and cross-source handoff',()=>{
    const registry=make(),before=JSON.stringify(registry),result=projectMusicalRelations(registry);
    const coactivity=result.relations.filter(r=>r.kind==='source-coactivity');assert.equal(coactivity.length,1);
    assert.equal(coactivity[0].startSample,1600);assert.equal(coactivity[0].endSample,15680);
    assert.ok(result.relations.some(r=>r.kind==='motif-return-candidate' && r.observationIds.join()==='observation-001,observation-003'));
    assert.ok(result.relations.some(r=>r.kind==='motif-handoff-candidate' && r.observationIds.join()==='observation-000,observation-004'));
    assert.equal(JSON.stringify(registry),before);assert.equal(result.xrScoring,'ineligible');assert.equal(result.confidence,null);
    result.identity.sampleCount=1;result.relations[0].observationIds[0]='changed';
    assert.equal(JSON.stringify(registry),before);
});

test('no source resolution means no coactivity or handoff claims',()=>{
    const registry=make();for(const a of registry.assignments)a.sourceId=null;
    assert.equal(projectMusicalRelations(registry).relations.length,0);
});

test('relations reject publication upgrades and resource limits rather than silently dropping events',()=>{
    const registry=make();assert.throws(()=>projectMusicalRelations(registry,0),/budget/);
    assert.throws(()=>projectMusicalRelations({...registry,confidence:.9}),/contract/);
    assert.throws(()=>projectMusicalRelations({...registry,xrScoring:'eligible'}),/contract/);
    assert.deepEqual(JSON.parse(JSON.stringify(projectMusicalRelations(registry))),
        JSON.parse(JSON.stringify(projectMusicalRelations(registry))));
});
