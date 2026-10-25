import test from 'node:test';import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
const load=createLoader({},{Float32Array,Float64Array}),m=load('types/musicEvents.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const clock={sampleRate:8000,sampleCount:10001,hopSize:1024,windowSize:1024,originSample:0,timestamp:'window-start',tailPolicy:'zero-pad'};
const hits=[{time:0,intensity:.2,type:1},{time:1024/8000,intensity:.8,type:2},{time:10000/8000,intensity:1.2,type:3}];
test('accepted hit projection preserves exact old times/types/strengths with track-local IDs and real support',()=>{
 const before=plain(hits),layer=m.projectAcceptedMusicEvents(hits,clock);
 assert.deepEqual(hits,before);assert.equal(layer.events.length,3);
 assert.deepEqual(plain(layer.events.map(e=>[e.time,e.strength,e.legacyType])),hits.map(e=>[e.time,e.intensity,e.type]));
 assert.equal(layer.events[2].sampleIndex,10000);assert.deepEqual(plain(layer.events[2].supportSamples),[9216,10001]);
 assert.equal(new Set(layer.events.map(e=>e.id)).size,3);assert.equal(layer.idScope,'this-analysis');
 assert.equal(layer.confidence,null);assert.equal(layer.capabilities.vocal,'unsupported');assert.equal(layer.capabilities.dominance,'unknown');
 layer.clock.sampleRate=123;layer.events[0].supportSamples[0]=99;assert.equal(clock.sampleRate,8000);assert.deepEqual(hits,before);
});
test('no accepted hits means no events, not a fabricated silence or vocal/tonal diagnosis',()=>{
 const r=m.projectAcceptedMusicEvents([],clock);assert.equal(r.events.length,0);assert.equal(r.capabilities.tonal,'unsupported');
 assert.equal(r.capabilities.acousticOnset,'unverified');assert.equal(r.capabilities.dominance,'unknown');
});
test('contradictory clocks, duplicate hits, out-of-range samples and invented fractional samples are rejected',()=>{
 for(const patch of [{sampleRate:NaN},{sampleCount:0},{hopSize:1000},{windowSize:2048},{originSample:1},{timestamp:'center'},{tailPolicy:'extend'}])assert.throws(()=>m.projectAcceptedMusicEvents(hits,{...clock,...patch}));
 for(const bad of [[hits[0],hits[0]],[hits[1],hits[0]],[{...hits[0],time:-1}],[{...hits[0],time:10001/8000}],[{...hits[0],intensity:NaN}],[{...hits[0],type:4}],[{...hits[0],time:.1/8000}]])assert.throws(()=>m.projectAcceptedMusicEvents(bad,clock));
});
test('transport rejects forged support, associations, confidence and musical source claims',()=>{
 const source=plain(m.projectAcceptedMusicEvents(hits,clock));
 const mutations=[r=>r.events[0].supportSamples[1]++,r=>r.events[0].uncertaintySamples[1]++,r=>r.events[0].sampleIndex++,r=>r.events[0].acceptedEventIndex++,r=>r.events[0].family='vocal',r=>r.events[0].phase='sustain',r=>r.confidence=.99,r=>r.capabilities.vocal='supported',r=>r.capabilities.dominance='percussive',r=>r.clock.sampleRate=44100,r=>r.events.pop(),r=>r.events[0].strength=.7];
 for(const mutate of mutations){const bad=plain(source);mutate(bad);assert.equal(m.normalizeMusicEvents(bad,clock,hits),undefined);}
 const restored=m.normalizeMusicEvents(source,clock,hits);assert.deepEqual(plain(restored),source);restored.events[0].supportSamples[0]=123;assert.equal(source.events[0].supportSamples[0],0);
 assert.equal(m.normalizeMusicEvents(source,undefined,hits),undefined);
});
test('analyzer publishes the additive layer without changing any legacy analysis field or PCM',()=>{
 const current=load('analyzer/analyzeAudio.ts').analyzeAudio;
 const legacy=createLoader({'../types/musicEvents':{...m,projectAcceptedMusicEvents:()=>undefined}},{Float32Array,Float64Array})('analyzer/analyzeAudio.ts').analyzeAudio;
 const samples=new Float32Array(8000*3);for(let i=1000;i<samples.length;i+=2000)samples[i]=.8;const original=samples.slice();
 for(const eventTiming of [undefined,'local-band-v1','local-band-v2']){const input={samples,sampleRate:8000,options:{eventTiming}},r=current(input),b=legacy(input);
  const raw=plain(r);assert.ok(raw.trackAnalysis.musicEvents);delete raw.trackAnalysis.musicEvents;assert.deepEqual(raw,plain(b));
  const normalized=load('analyzer/normalizeAnalysisResult.ts').normalizeTrackAnalysis(r.trackAnalysis,r.bpm,r.events);
  assert.deepEqual(plain(normalized.musicEvents),plain(r.trackAnalysis.musicEvents));assert.equal(normalized.musicEvents.events.length,r.events.length);
 }
 assert.deepEqual(samples,original);
});
test('worker transports the same event layer and legacy/empty normalization never invents evidence',()=>{
 const messages=[],self={postMessage:m=>messages.push(m)},worker=createLoader({},{self,Float32Array,Float64Array});worker('audio/analyzer.worker.ts');
 const samples=new Float32Array(8000);self.onmessage({data:{samples:samples.buffer,sampleRate:8000,requestId:17}});
 const result=messages.find(x=>x.type==='analysis_done');assert.equal(result.requestId,17);assert.equal(result.trackAnalysis.musicEvents.events.length,0);
 const n=load('analyzer/normalizeAnalysisResult.ts');const old=n.createEmptyTrackAnalysis();assert.equal(n.normalizeTrackAnalysis(old).musicEvents,undefined);
 const bad=plain(result.trackAnalysis);bad.musicEvents.events.push({});assert.equal(n.normalizeTrackAnalysis(bad).musicEvents,undefined);
});
