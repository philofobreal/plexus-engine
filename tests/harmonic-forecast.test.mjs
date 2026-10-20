import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
import {hash,pcmBytes} from './fixtures/musical-entity-corpus.mjs';
import {forecastSpecs,renderForecastFixture} from './fixtures/harmonic-forecast-corpus.mjs';
const {fitHarmonicForecast,evaluateHarmonicForecast}=createLoader({}, {Float32Array,Float64Array})('analyzer/HarmonicForecast.ts');
function window(kind='steady',gain=1,dc=0){
    const f=renderForecastFixture(forecastSpecs('development').find(s=>s.kind===kind)),n=2048;
    const prefix=Float32Array.from(f.samples.slice(0,n),x=>x*gain+dc),suffix=Float32Array.from(f.samples.slice(n,n*1.5),x=>x*gain+dc);
    return {prefix,suffix,identity:{...f.identity,sampleCount:n,pcmSha256:hash(pcmBytes(prefix))}};
}
test('forecast frequency and both coefficient sets are fitted from prefix only; evaluation never mutates fit',()=>{
    const w=window(),fit=fitHarmonicForecast(w.prefix,w.identity),before=JSON.stringify(fit),pcm=Array.from(w.prefix);
    const good=evaluateHarmonicForecast(fit,w.suffix);
    assert.ok(good.every(r=>r.heldOutResidualFraction<.001));
    const bad=evaluateHarmonicForecast(fit,Float32Array.from(w.suffix,x=>-x));
    assert.ok(bad.every(r=>r.heldOutResidualFraction>1));
    assert.equal(JSON.stringify(fit),before);assert.deepEqual(Array.from(w.prefix),pcm);
    assert.equal(JSON.stringify(fitHarmonicForecast(w.prefix,w.identity)),before);
});
test('prefix linear envelope reduces forecast residual on authored linear rise',()=>{
    const w=window('linear-rise'),fit=fitHarmonicForecast(w.prefix,w.identity),scores=evaluateHarmonicForecast(fit,w.suffix);
    assert.equal(scores[0].kind,'stationary');assert.equal(scores[1].kind,'linear-envelope');
    assert.ok(scores[1].heldOutResidualFraction<scores[0].heldOutResidualFraction/4);
});
test('forecast residual is gain/DC tolerant and undefined for below-floor suffix',()=>{
    const a=window(),b=window('steady',3,.3);
    const ra=evaluateHarmonicForecast(fitHarmonicForecast(a.prefix,a.identity),a.suffix),rb=evaluateHarmonicForecast(fitHarmonicForecast(b.prefix,b.identity),b.suffix);
    for(let i=0;i<2;i++)assert.ok(Math.abs(ra[i].heldOutResidualFraction-rb[i].heldOutResidualFraction)<1e-6);
    const fit=fitHarmonicForecast(a.prefix,a.identity);
    assert.ok(evaluateHarmonicForecast(fit,new Float32Array(1024).fill(fit.trainingMean)).every(r=>r.heldOutResidualFraction===null));
});
test('octave and unison mixtures remain unresolved despite low prediction errors',()=>{
    for(const kind of ['octave','unison']){
        const w=window(kind),fit=fitHarmonicForecast(w.prefix,w.identity);
        assert.ok(evaluateHarmonicForecast(fit,w.suffix).every(r=>r.heldOutResidualFraction<.001));
        assert.equal(fit.sourceIsolation,'unverified-mixture');assert.equal(fit.confidence,null);assert.equal(fit.xrScoring,'ineligible');
    }
});
test('silence has no model and unsupported or nonfinite clocks/PCM are rejected',()=>{
    const w=window('silence'),fit=fitHarmonicForecast(w.prefix,w.identity);
    assert.equal(fit.status,'no-pitch');assert.equal(fit.frequencyHz,null);assert.deepEqual(Array.from(evaluateHarmonicForecast(fit,w.suffix)),[]);
    assert.throws(()=>fitHarmonicForecast(w.prefix.slice(1),w.identity));
    const bad=w.prefix.slice();bad[10]=NaN;assert.throws(()=>fitHarmonicForecast(bad,w.identity));
    assert.throws(()=>evaluateHarmonicForecast(fit,w.suffix.slice(1)));
    bad[10]=Infinity;assert.throws(()=>evaluateHarmonicForecast(fit,bad.slice(0,1024)));
});
test('malformed models and scoring eligibility cannot cross the evaluation boundary',()=>{
    const w=window(),fit=fitHarmonicForecast(w.prefix,w.identity),copy=()=>JSON.parse(JSON.stringify(fit));
    for(const mutate of [f=>f.xrScoring='eligible',f=>f.frequencyHz=NaN,f=>f.models[0].coefficients[0]=Infinity,
        f=>f.models[1].kind='stationary',f=>f.harmonics=1000,f=>f.identity.sampleCount=1]){
        const changed=copy();mutate(changed);assert.throws(()=>evaluateHarmonicForecast(changed,w.suffix));
    }
});
