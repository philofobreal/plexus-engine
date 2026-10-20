import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
import {renderHarmonicFixture,harmonicSpecs} from './fixtures/harmonic-evidence-corpus.mjs';
const load=createLoader({}, {Float32Array,Float64Array});
const {fitHarmonicResidual,assessHarmonicEvidence}=load('analyzer/HarmonicEvidence.ts');
const {extractPitchCandidates}=load('analyzer/PitchCandidates.ts');
const pure=(gain=1,dc=0)=>Float32Array.from({length:2048},(_,i)=>dc+gain*(Math.sin(2*Math.PI*220.3*i/16000+.37)
    +.3*Math.sin(2*Math.PI*440.6*i/16000+.9)));

test('QR harmonic projection fits nonorthogonal finite-window harmonics better than independent columns',()=>{
    const pcm=pure(),before=Array.from(pcm),result=fitHarmonicResidual(pcm,16000,220.3);
    assert.equal(result.status,'available');assert.ok(result.fitResidualFraction<1e-12);
    assert.ok(result.heldOutResidualFraction<1e-12);
    assert.ok(result.independentColumnFitResidual>1e-5);assert.ok(result.independentColumnHeldOutResidual>1e-5);
    assert.deepEqual(Array.from(pcm),before);
});

test('relative residual is gain/DC tolerant and the held-out suffix is not used to fit coefficients',()=>{
    const a=pure(.1),b=pure(.4,.3),ra=fitHarmonicResidual(a,16000,220.3),rb=fitHarmonicResidual(b,16000,220.3);
    assert.ok(ra.heldOutResidualFraction<1e-12);assert.ok(rb.heldOutResidualFraction<1e-10);
    const changed=a.slice();for(let i=ra.trainingSamples;i<changed.length;i++)changed[i]=-changed[i];
    const rc=fitHarmonicResidual(changed,16000,220.3);
    assert.equal(rc.fitResidualFraction,ra.fitResidualFraction);
    assert.ok(rc.heldOutResidualFraction>1,'suffix prediction error must not be clipped to one');
});

test('stable evidence needs three adjacent frames and exposes wider decision support',()=>{
    const f=renderHarmonicFixture(harmonicSpecs('development')[0]),p=extractPitchCandidates(f.samples,f.identity),e=assessHarmonicEvidence(f.samples,p);
    assert.equal(e.frames[0].status,'unstable');assert.equal(e.frames[1].status,'unstable');
    assert.equal(e.frames[2].status,'steady-harmonic-compatible');
    assert.equal(e.frames[2].supportStartSample,0);assert.equal(e.frames[2].fitSupportStartSample,640);
    assert.equal(e.frames[2].supportEndSample,2688);assert.equal(e.sourceIsolation,'unverified-mixture');
});

test('octave and unison two-source mixtures can fit well without source isolation being certified',()=>{
    for(const kind of ['octave','unison']){
        const f=renderHarmonicFixture(harmonicSpecs('development').find(s=>s.kind===kind));
        const e=assessHarmonicEvidence(f.samples,extractPitchCandidates(f.samples,f.identity));
        assert.ok(e.frames.some(frame=>frame.status==='steady-harmonic-compatible'));
        assert.equal(e.sourceIsolation,'unverified-mixture');assert.equal(e.groundTruthStatus,false);assert.equal(e.xrScoring,'ineligible');
    }
});

test('one-source gain changes produce large residual; the metric does not claim polyphony',()=>{
    const f=renderHarmonicFixture(harmonicSpecs('development').find(s=>s.kind==='gain-step'));
    const e=assessHarmonicEvidence(f.samples,extractPitchCandidates(f.samples,f.identity));
    assert.ok(e.frames.some(frame=>frame.status==='large-residual'));
    assert.equal(e.sourceIsolation,'unverified-mixture');assert.equal(e.confidence,null);
});

test('silence remains unavailable and missing pitch breaks temporal continuity',()=>{
    assert.equal(fitHarmonicResidual(new Float32Array(2048),16000,220).status,'below-floor');
    const f=renderHarmonicFixture(harmonicSpecs('development')[0]),p=extractPitchCandidates(f.samples,f.identity);
    p.frames[3].primary=null;
    const e=assessHarmonicEvidence(f.samples,p);
    assert.equal(e.frames[3].status,'no-pitch');assert.equal(e.frames[4].consecutiveStableFrames,1);
    assert.equal(e.frames[4].status,'unstable');
});

test('malformed support, nonfinite PCM and unsupported frequencies reject explicitly',()=>{
    const f=renderHarmonicFixture(harmonicSpecs('development')[0]),p=extractPitchCandidates(f.samples,f.identity);
    assert.throws(()=>fitHarmonicResidual(pure(),16000,0),/input/);
    assert.throws(()=>fitHarmonicResidual(Float32Array.of(NaN),16000,220),/input/);
    const before=JSON.stringify(p);assertHarmonicDeterminism();
    function assertHarmonicDeterminism(){assert.equal(JSON.stringify(assessHarmonicEvidence(f.samples,p)),JSON.stringify(assessHarmonicEvidence(f.samples,p)));}
    assert.equal(JSON.stringify(p),before);p.frames[0].supportEndSample++;
    assert.throws(()=>assessHarmonicEvidence(f.samples,p),/clock/);
});
