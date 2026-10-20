import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
import {hash,pcmBytes} from './fixtures/musical-entity-corpus.mjs';
import {forecastSpecs,renderForecastFixture} from './fixtures/harmonic-forecast-corpus.mjs';
const {fitHarmonicForecast,evaluateHarmonicForecast}=createLoader({}, {Float32Array,Float64Array})('analyzer/HarmonicForecast.ts');
function run(kind,start=0){
    const f=renderForecastFixture(forecastSpecs('development').find(s=>s.kind===kind)),n=2048,
        prefix=f.samples.slice(start,start+n),suffix=f.samples.slice(start+n,start+n*1.5),
        identity={...f.identity,pcmSha256:hash(pcmBytes(prefix)),sampleCount:n,timelineOffsetSeconds:start/f.identity.sampleRate},
        model=fitHarmonicForecast(prefix,identity);
    return {model,scores:evaluateHarmonicForecast(model,suffix)};
}
test('one authored source with unexpected suffix gain change is still unpredictable in both models',()=>{
    const {model,scores}=run('gain-step',960);
    assert.ok(scores.every(r=>r.heldOutResidualFraction>.1));
    assert.equal(model.sourceIsolation,'unverified-mixture');assert.equal(model.consumerUse,'diagnostic-only');
});
test('one authored vibrato source does not become certified polyphony through large residual',()=>{
    const {model,scores}=run('vibrato');
    assert.ok(scores.every(r=>r.heldOutResidualFraction>.1));
    assert.equal(model.sourceIsolation,'unverified-mixture');assert.equal(model.xrScoring,'ineligible');
    assert.equal('sourceCount' in model,false);assert.equal('sourceId' in model,false);
});
