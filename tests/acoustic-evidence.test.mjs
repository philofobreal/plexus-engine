import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoader} from './helpers/xr-loader.mjs';

const {assessAcousticOnsets}=createLoader()('semantics/acousticEvidence.ts');
const identity={pcmSha256:'a'.repeat(64),sampleRate:8000,sampleCount:16000,timelineOffsetSeconds:0};
const candidate=(time,clock=identity)=>{
    const sampleIndex=Math.round(time*clock.sampleRate);
    return {sampleIndex,time:sampleIndex/clock.sampleRate,supportStartSample:0,
        supportEndSample:clock.sampleCount,endpointAmbiguous:false};
};
const reference=(a,b,clock=identity)=>({class:'onset',time:(a+b)/2,acceptance:'two-library-agreement',
    groundTruthStatus:false,confidence:null,evidenceType:'pseudo_label',timeInterval:[Math.min(a,b),Math.max(a,b)],
    disagreementSeconds:Math.abs(a-b),identity:{...clock},votes:[{provider:'librosa',time:a},{provider:'audioflux',time:b}]});

test('both library timestamps are required and consumer meaning never exceeds research evidence',()=>{
    const input=[candidate(1.036),candidate(1.012)],refs=[reference(1,1.024)],before=JSON.stringify([input,refs]);
    const r=assessAcousticOnsets(input,refs,identity);
    assert.equal(r.events.filter(e=>e.referenceStatus==='two-library-agreement').length,1);
    assert.equal(r.events[0].time,input[1].time);assert.equal(r.events[1].time,input[0].time);
    for(const e of r.events){
        assert.equal(e.dramaturgy,'diagnostic-only');assert.equal(e.choreography,'diagnostic-only');
        assert.equal(e.xrScoring,'ineligible');assert.equal(e.confidence,null);assert.equal(e.groundTruthStatus,false);
    }
    assert.equal(r.unqualifiedAreNegatives,false);
    r.events[0].reference.votes[0].time=7;
    r.events[0].reference.timeInterval[0]=7;
    assert.equal(JSON.stringify([input,refs]),before);
});

test('missing agreement and incomplete endpoints retain explicit abstention without negative labels',()=>{
    const c={...candidate(.5),endpointAmbiguous:true};
    const r=assessAcousticOnsets([c],[],identity);
    assert.equal(r.events[0].reference,null);assert.ok(r.events[0].reasons.includes('endpoint-ambiguous'));
    assert.equal(assessAcousticOnsets([],[],identity).events.length,0);
    const refs=[reference(.5,.51)];
    assert.equal(assessAcousticOnsets([],refs,identity).uncoveredReferenceCount,1);
});

test('wrong PCM, clocks, fabricated truth, duplicate votes and unsupported capability are rejected',()=>{
    const c=candidate(.5),r=reference(.5,.51);
    for(const invalid of [{...r,class:'kick'},{...r,confidence:.9},{...r,groundTruthStatus:true},
        {...r,evidenceType:'ground_truth'},{...r,timeInterval:[.5,.5]},{...r,disagreementSeconds:0},
        {...r,identity:{...identity,pcmSha256:'b'.repeat(64)}},{...r,votes:[r.votes[0],r.votes[0]]},
        {...r,votes:[r.votes[0],{provider:'plexus',time:.51}]},reference(.5,.526)])
        assert.throws(()=>assessAcousticOnsets([c],[invalid],identity));
    assert.throws(()=>assessAcousticOnsets([c],[r,r],identity));
    for(const invalid of [{...c,time:NaN},{...c,time:.51},{...c,supportEndSample:16001},
        {...c,supportStartSample:4001},{...c,sampleIndex:-1}])
        assert.throws(()=>assessAcousticOnsets([invalid],[],identity));
    assert.throws(()=>assessAcousticOnsets([c,c],[],identity));
    assert.throws(()=>assessAcousticOnsets([],[],{...identity,sampleRate:999}));
});

test('one-to-one interval assignment agrees with exhaustive cardinality and is order independent',()=>{
    const brute=(points,refs,i=0,used=new Set())=>{
        if(i===refs.length)return 0;
        let best=brute(points,refs,i+1,used);
        for(let j=0;j<points.length;j++)if(!used.has(j)&&refs[i].votes.every(v=>Math.abs(points[j].time-v.time)<=.025)){
            const next=new Set(used);next.add(j);best=Math.max(best,1+brute(points,refs,i+1,next));
        }
        return best;
    };
    let seed=20261023;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
    for(let k=0;k<120;k++){
        const points=[...new Set(Array.from({length:5},()=>Math.round((1+random()*.12)*8000)))].map(i=>candidate(i/8000));
        const refs=Array.from({length:4},(_,i)=>{
            const t=1+random()*.12+i*.000001;return reference(t,t+(random()-.5)*.02);
        });
        const r=assessAcousticOnsets(points,refs,identity);
        assert.equal(r.events.filter(e=>e.reference!==null).length,brute(points,refs));
        const permuted=refs.toReversed().map(r=>({...r,votes:r.votes.toReversed()}));
        assert.equal(JSON.stringify(r),JSON.stringify(assessAcousticOnsets(points.toReversed(),permuted,identity)));
    }
    const points=[candidate(1.01),candidate(1.032)],refs=[reference(1.01,1.02),reference(1.04,1.05)];
    assert.equal(assessAcousticOnsets(points,refs,identity).events.filter(e=>e.reference).length,2);
});

test('actual retained recording qualification matches Python counts while withholding all XR targets',()=>{
    const data=JSON.parse(readFileSync('research/analyzer-lab/fixtures/an03f-dual-prodigy-01.json'));
    const totals={continuationV6:0,peakV7:0};
    for(const row of data.rows){
        const clock={pcmSha256:row.excerptWithContextPcmSha256,sampleRate:row.track.sampleRate,
            sampleCount:row.contextEndSample-row.contextStartSample,timelineOffsetSeconds:row.contextStartSample/row.track.sampleRate};
        const refs=row.strictReference.acceptedReferences.map(r=>({...r,identity:clock}));
        for(const p of Object.keys(totals)){
            const points=row.eventTimes[p].map(t=>candidate(t-clock.timelineOffsetSeconds,clock));
            const result=assessAcousticOnsets(points,refs,clock);
            totals[p]+=result.events.filter(e=>e.reference!==null).length;
            for(const [i,e] of result.events.entries()){
                assert.equal(e.time,row.eventTimes[p][i]);assert.equal(e.xrScoring,'ineligible');
            }
        }
    }
    assert.deepEqual(totals,{continuationV6:379,peakV7:1079});
});
