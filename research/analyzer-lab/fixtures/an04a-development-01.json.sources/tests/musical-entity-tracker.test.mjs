import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
import {renderEntityCorpus,corpusSpecs,pairwiseAssociation} from './fixtures/musical-entity-corpus.mjs';

const load=createLoader({}, {Float32Array});
const {trackMusicalEntities}=load('analyzer/MusicalEntityTracker.ts');
const {extractHarmonicTimbre}=load('analyzer/HarmonicTimbre.ts');
const json=x=>JSON.parse(JSON.stringify(x));
const identity={pcmSha256:'a'.repeat(64),sampleRate:16000,sampleCount:160000,timelineOffsetSeconds:3};
const timbre=(values,startSample=0)=>({space:'harmonic-amplitude-v1',
    values:[...values,...Array(8-values.length).fill(0)].map(x=>x/values.reduce((a,b)=>a+b,0)),
    fundamentalHz:200,supportStartSample:startSample,supportEndSample:startSample+1600});
const observation=(id,startSample,values)=>({id,startSample,endSample:startSample+3200,
    kind:'isolated-candidate',timbre:values?timbre(values,startSample):null,notes:[],notesOrigin:'authored-symbolic'});
const notes=(start=0,positions=[0,1000,2000,3000],pitch=[60,64,67,62])=>positions.map((p,i)=>
    ({midi:pitch[i],startSample:start+p,endSample:start+p+500}));

test('actual candidate PCM tracks same-family overlap, silence reentry and cross-source motif handoff',()=>{
    const fixture=renderEntityCorpus(corpusSpecs('development')[0],extractHarmonicTimbre);
    const result=trackMusicalEntities(fixture.observations,fixture.identity);
    assert.equal(result.sources.length,3);assert.equal(result.musicalMotifs.length,3);
    for(const field of ['source','motif']){
        const score=pairwiseAssociation(fixture.truth,result.assignments,field);
        assert.equal(score.precision,1);assert.equal(score.recall,1);assert.equal(score.coverage,1);
    }
    const [a,b,c,d,e,f]=result.assignments;
    assert.notEqual(a.sourceId,b.sourceId);assert.equal(a.sourceId,c.sourceId);assert.equal(b.sourceId,d.sourceId);
    assert.equal(a.motifId,e.motifId);assert.notEqual(a.sourceId,e.sourceId);
    assert.equal(e.transpositionSemitones,5);assert.equal(e.durationScale,1.25);
    assert.equal(f.transpositionSemitones,-5);assert.equal(f.durationScale,.8);
    assert.equal(result.confidence,null);assert.equal(result.xrScoring,'ineligible');
});

test('harmonic descriptor is gain/phase tolerant and has actual sample support',()=>{
    const wave=(gain,phase)=>Float32Array.from({length:3200},(_,i)=>gain*(Math.sin(2*Math.PI*200*i/16000+phase)
        +.3*Math.sin(2*Math.PI*400*i/16000+2*phase)));
    const a=extractHarmonicTimbre(wave(.2,.1),16000,200,100).descriptor;
    const b=extractHarmonicTimbre(wave(.03,2),16000,200,100).descriptor;
    assert.ok(a.values.every((v,i)=>Math.abs(v-b.values[i])<1e-4));
    assert.equal(a.supportStartSample,100);assert.equal(a.supportEndSample,3300);
    assert.ok(Math.abs(a.values[0]-1/1.3)<1e-4);
    assert.equal(extractHarmonicTimbre(new Float32Array(3200),16000,200).reason,'below-floor');
    assert.equal(extractHarmonicTimbre(wave(.2,0),16000,null).reason,'missing-fundamental');
    assert.equal(extractHarmonicTimbre(wave(.2,0),16000,1000).reason,'insufficient-bandwidth');
    assert.equal(extractHarmonicTimbre(new Float32Array(10),16000,200).reason,'insufficient-support');
    assert.throws(()=>extractHarmonicTimbre(Float32Array.of(NaN),16000,200),/PCM/);
});

test('indistinguishable simultaneous sources abstain rather than invent another instrument identity',()=>{
    const result=trackMusicalEntities([observation('a',0,[1,.2]),observation('b',0,[1,.2])],identity);
    assert.equal(result.sources.length,1);assert.equal(result.assignments[1].sourceId,null);
    assert.equal(result.assignments[1].sourceStatus,'ambiguous');
    assert.ok(result.assignments[1].reasons.includes('overlapping-source-match'));
});

test('nearby first anchors retain alternative source hypotheses on a later midpoint',()=>{
    const result=trackMusicalEntities([observation('a',0,[1,.1]),observation('b',4000,[1,.5]),
        observation('c',8000,[1,.3])],identity);
    assert.equal(result.sources.length,2);assert.equal(result.assignments[2].sourceStatus,'ambiguous');
    assert.equal(result.assignments[2].sourceAlternatives.length,2);
});

test('half-open source intervals permit touching and long silence, while true overlap abstains',()=>{
    const result=trackMusicalEntities([observation('a',0,[1]),observation('b',3200,[1]),
        observation('c',4000,[1]),observation('d',100000,[1])],identity);
    assert.equal(result.assignments[0].sourceId,result.assignments[1].sourceId);
    assert.equal(result.assignments[2].sourceId,null);
    assert.equal(result.assignments[0].sourceId,result.assignments[3].sourceId);
});

test('unresolved mixtures and missing timbre remain unknown without fabricated source counts',()=>{
    const a=observation('a',0,[1]);a.kind='unresolved-mixture';a.notes=notes();a.endSample=4000;
    const b=observation('b',5000,null);
    const result=trackMusicalEntities([a,b],identity);
    assert.equal(result.sources.length,0);assert.equal(result.musicalMotifs.length,0);
    assert.equal(result.assignments[0].motifStatus,'unavailable');
    assert.ok(result.assignments[1].reasons.includes('missing-timbre'));
});

test('motif recognition rejects a changed contour or changed rhythm, and does not require source identity',()=>{
    const a=observation('a',0,null);a.notes=notes();a.endSample=4000;
    const b=observation('b',5000,null);b.notes=notes(5000,[0,600,2000,3000]);b.endSample=9000;
    const c=observation('c',10000,null);c.notes=notes(10000,undefined,[60,64,66,62]);c.endSample=14000;
    const result=trackMusicalEntities([a,b,c],identity);
    assert.equal(result.musicalMotifs.length,3);assert.equal(result.sources.length,0);
});

test('musical motif ambiguity retains both possible rhythm templates',()=>{
    const a=observation('a',0,null);a.notes=notes();a.endSample=4000;
    const b=observation('b',5000,null);b.notes=notes(5000,[0,1150,2000,3000]);b.endSample=9000;
    const c=observation('c',10000,null);c.notes=notes(10000,[0,1075,2000,3000]);c.endSample=14000;
    const result=trackMusicalEntities([a,b,c],identity,{motifMaxRhythmError:.03});
    assert.equal(result.musicalMotifs.length,2);assert.equal(result.assignments[2].motifStatus,'ambiguous');
    assert.equal(result.assignments[2].motifAlternatives.length,2);
});

test('registry is deterministic under input permutation, JSON-safe and detached from input state',()=>{
    const fixture=renderEntityCorpus(corpusSpecs('development')[0],extractHarmonicTimbre);
    const before=JSON.stringify(fixture.observations),result=trackMusicalEntities(fixture.observations,fixture.identity);
    assert.deepEqual(json(result),json(trackMusicalEntities([...fixture.observations].reverse(),fixture.identity)));
    result.sources[0].observationIds.push('changed');result.identity.sampleCount=1;result.options.sourceMaxDistance=1;
    assert.equal(JSON.stringify(fixture.observations),before);assert.notEqual(fixture.identity.sampleCount,1);
    assert.equal(trackMusicalEntities([],identity).assignments.length,0);
});

test('malformed clocks, descriptor support, note order and resource overflow fail explicitly',()=>{
    const a=observation('a',0,[1]);
    assert.throws(()=>trackMusicalEntities([a,a],identity),/duplicate/);
    assert.throws(()=>trackMusicalEntities([a],{...identity,pcmSha256:'bad'}),/identity/);
    assert.throws(()=>trackMusicalEntities([a],identity,{maxObservations:0}),/budget/);
    assert.throws(()=>trackMusicalEntities([a,observation('b',4000,[1])],identity,{maxObservations:1}),/budget/);
    assert.throws(()=>trackMusicalEntities([a],identity,{sourceMaxDistance:NaN}),/threshold/);
    for(const change of [x=>x.timbre.values.fill(0),x=>x.timbre.supportEndSample=99999,x=>x.endSample=Infinity,
        x=>x.notes=[{midi:60,startSample:0,endSample:1000},{midi:60,startSample:500,endSample:1500}]]){
        const bad=json(a);change(bad);assert.throws(()=>trackMusicalEntities([bad],identity));
    }
});
