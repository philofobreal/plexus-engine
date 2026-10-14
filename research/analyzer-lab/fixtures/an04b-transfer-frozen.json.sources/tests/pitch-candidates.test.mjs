import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
import {renderPitchFixture} from './fixtures/pitch-candidate-corpus.mjs';
const load=createLoader({}, {Float32Array,Float64Array});
const {extractPitchCandidates,pitchCandidatesToUnresolvedParts}=load('analyzer/PitchCandidates.ts');
const {trackMusicalEntities}=load('analyzer/MusicalEntityTracker.ts');
const make=kind=>renderPitchFixture({kind,sampleRate:16000,frequencyHz:261.63,gain:.1,phase:.37});
const cents=(a,b)=>Math.abs(1200*Math.log2(a/b));

test('raw PCM supplies F0 proposals; parabolic refinement improves fractional-lag error',()=>{
    const f=make('harmonic'),before=Array.from(f.samples),a=extractPitchCandidates(f.samples,f.identity);
    assert.equal(a.frames.length,10);assert.equal(a.frameLength,2048);assert.equal(a.hopLength,320);
    for(const frame of a.frames){assert.ok(frame.primary);assert.ok(cents(frame.primary.frequencyHz,261.63)<5);
        assert.ok(cents(frame.primary.frequencyHz,261.63)<cents(frame.primary.integerLagFrequencyHz,261.63));}
    assert.deepEqual(Array.from(f.samples),before);assert.equal(a.confidence,null);
    assert.ok(a.frames[0].alternatives.length>0,'period aliases are retained, not interpreted as voices');
});

test('silence, DC, below-floor PCM and deterministic noise do not produce primary candidates',()=>{
    for(const kind of ['silence','dc','below-floor','noise']){
        const f=make(kind),a=extractPitchCandidates(f.samples,f.identity);
        assert.ok(a.frames.every(frame=>frame.primary===null),kind);
    }
});

test('polyphonic, octave and unison mixtures cannot become isolated sources through the adapter',()=>{
    for(const kind of ['two-incommensurate','two-octave','two-unison','harmonic']){
        const f=make(kind),a=extractPitchCandidates(f.samples,f.identity),parts=pitchCandidatesToUnresolvedParts(a);
        assert.ok(parts.every(p=>p.kind==='unresolved-mixture'&&p.timbre===null&&p.notes.length===0));
        const registry=trackMusicalEntities(parts,f.identity);assert.equal(registry.sources.length,0);
        assert.equal(registry.musicalMotifs.length,0);assert.equal(registry.xrScoring,'ineligible');
    }
});

test('frame support and tail use original samples; nonzero timeline offset stays metadata',()=>{
    const f=make('sine');f.identity.timelineOffsetSeconds=9;
    const a=extractPitchCandidates(f.samples,f.identity);
    assert.equal(a.identity.timelineOffsetSeconds,9);assert.equal(a.frames[0].supportStartSample,0);
    assert.equal(a.frames.at(-1).supportEndSample,4928);assert.equal(a.unobservedTailSamples,192);
    const tiny=f.samples.slice(0,100),short=extractPitchCandidates(tiny,{...f.identity,sampleCount:100});
    assert.equal(short.status,'insufficient-support');assert.equal(short.unobservedTailSamples,100);
    assert.equal(short.frames.length,0);
});

test('invalid clocks, nonfinite input, budget overflow and fake isolation reject explicitly',()=>{
    const f=make('sine');assert.throws(()=>extractPitchCandidates(f.samples,{...f.identity,sampleCount:1}),/clock/);
    assert.throws(()=>extractPitchCandidates(f.samples,{...f.identity,pcmSha256:'bad'}),/clock/);
    assert.throws(()=>extractPitchCandidates(Float32Array.of(NaN),{...f.identity,sampleCount:1}),/Nonfinite/);
    const large=new Float32Array(16000*90);
    assert.throws(()=>extractPitchCandidates(large,{...f.identity,sampleCount:large.length}),/budget/);
    const a=extractPitchCandidates(f.samples,f.identity);
    assert.throws(()=>pitchCandidatesToUnresolvedParts({...a,sourceIsolation:'verified'}),/contract/);
    assert.equal(JSON.stringify(a),JSON.stringify(extractPitchCandidates(f.samples,f.identity)));
});
