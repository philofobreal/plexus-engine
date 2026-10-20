import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
import {renderPitchFixture} from './fixtures/pitch-candidate-corpus.mjs';
const load=createLoader({}, {Float32Array,Float64Array});
const {extractPitchCandidates}=load('analyzer/PitchCandidates.ts');
const {assessPitchCandidates}=load('semantics/pitchEvidence.ts');
const f=renderPitchFixture({kind:'sine',sampleRate:16000,frequencyHz:261.63,gain:.1,phase:.1});
const analysis=extractPitchCandidates(f.samples,f.identity),freq=analysis.frames[0].primary.frequencyHz;
const reference=(a=freq,b=freq)=>({frameIndex:0,supportStartSample:0,supportEndSample:2048,identity:{...f.identity},
    votes:[{provider:'librosa-yin',frequencyHz:a},{provider:'audioflux-ncf',frequencyHz:b}],
    evidenceType:'pseudo_label',acceptance:'two-library-agreement',confidence:null,groundTruthStatus:false});

test('pitch gate requires both actual provider identities and both frequencies, preserving unknown policy',()=>{
    const r=reference(),before=JSON.stringify(r),result=assessPitchCandidates(analysis,[r]);
    assert.equal(result.qualifiedFrameIndices.length,1);assert.equal(result.xrScoring,'ineligible');
    assert.equal(result.confidence,null);assert.equal(result.unqualifiedAreNegatives,false);assert.equal(JSON.stringify(r),before);
    // Both references agree within 25 cents, but candidate is 30 cents from one vote.
    const skew=assessPitchCandidates(analysis,[reference(freq*2**(10/1200),freq*2**(30/1200))]);
    assert.equal(skew.qualifiedFrameIndices.length,0);
});

test('pitch gate rejects reused frames, wrong clocks, single providers and invented certainty',()=>{
    assert.throws(()=>assessPitchCandidates(analysis,[reference(),reference()]),/reference/);
    for(const change of [r=>r.identity.sampleRate=8000,r=>r.supportEndSample++,r=>r.votes[1].provider='librosa-yin',
        r=>r.groundTruthStatus=true,r=>r.confidence=.9,r=>r.votes[1].frequencyHz*=2]){
        const r=reference();change(r);assert.throws(()=>assessPitchCandidates(analysis,[r]),/reference/);
    }
    assert.equal(assessPitchCandidates(analysis,[]).qualifiedFrameIndices.length,0);
});
