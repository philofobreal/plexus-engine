import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLoader } from './helpers/xr-loader.mjs';
import { harness } from './helpers/xr-controller-harness.mjs';
const load = createLoader(), plain = x => JSON.parse(JSON.stringify(x));
const { DramaturgyBuilder } = load('analyzer/DramaturgyBuilder.ts');
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { normalizeTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
const { selectRhythmEvents } = load('gameplay/RhythmEventSource.ts');
const { planRhythmAttention } = load('gameplay/RhythmLocalAttention.ts');
const { normalizeRhythmOnsets } = load('types/rhythmOnsets.ts');
const { buildRhythmChartWithDiagnostics } = load('gameplay/RhythmChartBuilder.ts');
const { projectRenderWorkerAnalysis } = load('types/CanvasVisualSource.ts');
const clock = {sampleRate:6400,sampleCount:51200,hopSize:64,windowSize:64,originSample:0,timestamp:'window-start',tailPolicy:'zero-pad'};
const event = (time,intensity=.8) => ({time,intensity,type:1});
const pool = events => ({algorithm:'percussive-pool-v1',clock:{...clock},events});
const settings = {chartProfile:'musical-v1',difficulty:'ultra',activity:'active',variation:'expressive',handPattern:'alternate',handLead:'even',motionSafety:'guarded'};

test('the worker JSON schema adds only the optional pool and preserves every predecessor constraint',()=>{
    const schema=JSON.parse(readFileSync('tests/fixtures/analyzer/analysis-result.schema.json'));
    const previous=JSON.parse(readFileSync('documents/tests/analysis-result-schema.pre-t12d.json'));
    assert.deepEqual(schema.$defs.trackAnalysis.properties.rhythmOnsets,{$ref:'#/$defs/rhythmOnsetPool'});
    assert.equal(schema.$defs.rhythmOnsetPool.additionalProperties,false);
    assert.deepEqual(schema.$defs.rhythmOnsetPool.required,['algorithm','clock','events']);
    delete schema.$defs.trackAnalysis.properties.rhythmOnsets;delete schema.$defs.rhythmOnsetPool;
    assert.deepEqual(schema,previous);
});
function builder() {
    const features = {totalFrames:800};
    for(const key of ['percussiveT','bassSustainT','rawBassT','rawHighT','fluxLowT','fluxMidT','fluxHighT','zcrT','spectralRolloffT'])
        features[key]=new Float32Array(800);
    features.percussiveT[300]=.35; features.percussiveT[307]=.9;
    const b=new DramaturgyBuilder(features,{beats:[3,3.5],secondsPerBeat:.5,estimatedBPM:120},{},6400,64);
    b.buildBeatEvents(); return {b,features};
}

test('a strong off-grid peak survives chart publication even when visual proximity suppression hid it',()=>{
    const {b}=builder(), before=JSON.stringify(b.events), events=b.rhythmEvents();
    assert.deepEqual(Array.from(b.events,e=>e.time),[3]);
    assert.deepEqual(Array.from(events,e=>e.time),[3,3.07]);
    assert.equal(JSON.stringify(b.events),before);
    events[0].intensity=0; assert.notEqual(b.events[0].intensity,0);
    assert.deepEqual(plain(b.rhythmEvents()),plain(builder().b.rhythmEvents()));
});

test('Musical ranking can choose the stronger actual source time; detailed accounting uses that exact array',()=>{
    const {b}=builder(), p=pool(b.rhythmEvents()), selected=selectRhythmEvents(b.events,8,'musical-v1',p,clock);
    const source={events:selected.events,eventSource:selected.info,durationSec:8,beats:Array.from({length:16},(_,i)=>i*.5),barStarts:[0,2,4,6],
        timingConfidence:.9,sections:[{start:0,end:8,label:'verse'}]};
    const result=buildRhythmChartWithDiagnostics(source,undefined,settings);
    assert.ok(result.chart.some(n=>n.time===3.07)); assert.ok(result.chart.every(n=>selected.events.some(e=>e.time===n.time)));
    assert.equal(result.diagnostics.source,'grid-independent-percussive'); assert.equal(result.diagnostics.sourceEvents,2);
    assert.equal(result.diagnostics.eventSource.addedEvents,1);
    for(const d of result.diagnostics.decisions) assert.equal(d.time,selected.events[d.sourceIndex].time);
});

test('Classic and unavailable, malformed or incompatible pools preserve the exact legacy array',()=>{
    const legacy=[event(3)], p=pool([event(3),event(3.2)]);
    assert.equal(selectRhythmEvents(legacy,8,'legacy',p,clock).events,legacy);
    for(const bad of [undefined,{...p,algorithm:'candidate-only'},pool([event(3.2)]),pool([event(3,.7),event(3.2)]),
        pool([event(3.2),event(3)]),pool([event(3),event(3)]),pool([event(3),event(3+1e-11)]),pool([event(3),event(8)]),pool([event(3),event(3.201)]),
        {...p,clock:{...clock,sampleCount:clock.sampleCount+1}},pool([event(3),event(3.2,NaN)])]) {
        const result=selectRhythmEvents(legacy,8,'musical-v1',bad,clock);
        assert.equal(result.events,legacy); assert.equal(result.info.fallbackReason,'missing-or-invalid-pool');
    }
    assert.equal(normalizeRhythmOnsets(p,8),undefined);
});

test('more available peaks expand choice without inflating the local Activity budget',()=>{
    const legacy=[2.4,2.8,3.2,3.6].map(t=>event(t,.3));
    const events=[...legacy,...[2.2,2.6,3,3.4,3.8].map(t=>event(t,1))].sort((a,b)=>a.time-b.time);
    const candidates=events.map((event,index)=>({event,index}));
    const expanded=planRhythmAttention(candidates,events,8,.5,[0,2,4,6],true,settings,.05,1);
    const budgeted=planRhythmAttention(candidates,events,8,.5,[0,2,4,6],true,settings,.05,1,undefined,legacy);
    assert.equal(budgeted.selected.size,4); assert.ok(expanded.selected.size>budgeted.selected.size);
    assert.equal(budgeted.summary.budgetSource,'legacy-visual');
    assert.ok([...budgeted.selected].every(i=>events[i].intensity===1));
    const invalid=planRhythmAttention(candidates,events,8,.5,[0,2,4,6],true,settings,.05,1,undefined,[event(2.1)]);
    assert.equal(invalid.summary.budgetSource,'invalid-budget'); assert.equal(invalid.selected.size,1);
});

test('normalization clones both levels, rejects wrong clocks and never promotes research candidates',()=>{
    const legacy=[event(3)], p=pool([event(3),event(3.2)]), before=JSON.stringify(p);
    const result=normalizeRhythmOnsets(p,8,clock,legacy);
    result.clock.sampleRate=8000; result.events[1].time=4;
    assert.equal(JSON.stringify(p),before);
    assert.equal(normalizeRhythmOnsets(p,8,{...clock,hopSize:128},legacy),undefined);
    for(const c of [{...p,clock:{...clock,tailPolicy:'crop'}},{...p,clock:{...clock,windowSize:128}},pool([event(3),{...event(3.2),type:4}])])
        assert.equal(normalizeRhythmOnsets(c,8,clock,legacy),undefined);
    assert.equal(selectRhythmEvents(legacy,8,'musical-v1',{...p,selection:'candidate-only',algorithm:'overlap-energy-rise-v1'},clock).events,legacy);
});

test('existing bass-only and sustained weak-peak exclusions also protect the additional source',()=>{
    const {b,features}=builder(); b.events=[];
    features.percussiveT.fill(0); features.percussiveT[400]=.3; features.bassSustainT[400]=1;
    assert.equal(b.rhythmEvents().length,0);
    features.percussiveT[400]=.9; features.rawBassT[400]=1; features.fluxLowT[400]=1;
    b.cachedTrackMidHighFluxP90=null; b.cachedTrackMidHighFluxRatio=null;
    assert.equal(b.rhythmEvents().length,0);
});

test('raw audio opt-in is additive and deterministic; default events, cues, sections and sample buffer stay exact',()=>{
    const sr=8000,samples=new Float32Array(sr*6);
    for(const time of [1,1.37,2,2.07,3.18,4]) for(let j=0;j<600;j++) {
        const i=Math.round(time*sr)+j;
        samples[i]+=.6*Math.sin(j*1.723+Math.sin(j*2.3))*Math.exp(-j/110);
    }
    const bytes=samples.slice(), base=analyzeAudio({samples,sampleRate:sr}), next=analyzeAudio({samples,sampleRate:sr,options:{rhythmOnsets:true}});
    assert.ok(next.trackAnalysis.rhythmOnsets.events.length>0);
    const normalized=normalizeTrackAnalysis(next.trackAnalysis,next.bpm,next.events);
    assert.deepEqual(plain(normalized.rhythmOnsets),plain(next.trackAnalysis.rhythmOnsets));
    delete next.trackAnalysis.rhythmOnsets; assert.deepEqual(plain(next),plain(base)); assert.deepEqual(samples,bytes);
    assert.deepEqual(plain(analyzeAudio({samples,sampleRate:sr,options:{rhythmOnsets:true}}).trackAnalysis.rhythmOnsets),plain(normalized.rhythmOnsets));
    assert.throws(()=>analyzeAudio({samples,sampleRate:sr,options:{rhythmOnsets:'yes'}}));
    assert.equal(analyzeAudio({samples,sampleRate:sr,options:{rhythmOnsets:true,eventTiming:'local-band-v2'}}).trackAnalysis.rhythmOnsets,undefined);
});

test('silence and a faded sustained tone do not become a repeating source of targets',()=>{
    const sr=8000;
    for(const tonal of [false,true]) {
        const samples=Float32Array.from({length:sr*5},(_,i)=>tonal?.4*Math.sin(2*Math.PI*80*i/sr)*Math.min(1,i/(sr*.75)):0);
        const r=analyzeAudio({samples,sampleRate:sr,options:{rhythmOnsets:true}});
        assert.equal(r.trackAnalysis.rhythmOnsets.events.filter(e=>e.time>1).length,0);
    }
});

test('chart-only evidence is omitted from render-worker preparation without mutating main analysis',()=>{
    const p=pool([event(3)]), a={duration:8,events:p.events,frames:[],trackAnalysis:{rhythmOnsets:p,features:[]}};
    const result=projectRenderWorkerAnalysis(a);
    assert.equal('rhythmOnsets' in result.trackAnalysis,false); assert.equal(a.trackAnalysis.rhythmOnsets,p);
    assert.equal(result.events,a.events); assert.equal(result.trackAnalysis.features,a.trackAnalysis.features);
});

test('the actual worker transports only the requested pool with its request identity and clear failure path',()=>{
    const messages=[],self={postMessage:m=>messages.push(m)};
    createLoader({}, {self,Float32Array,Float64Array})('audio/analyzer.worker.ts');
    self.onmessage({data:{requestId:71,sampleRate:8000,samples:new Float32Array(24000).buffer,rhythmOnsets:true}});
    const result=messages.find(m=>m.type==='analysis_done');
    assert.equal(result.requestId,71); assert.equal(result.trackAnalysis.rhythmOnsets.algorithm,'percussive-pool-v1');
    messages.length=0;
    self.onmessage({data:{requestId:72,sampleRate:8000,samples:new Float32Array(24000).buffer,rhythmOnsets:'yes'}});
    assert.equal(messages.at(-1).type,'analysis_error'); assert.equal(messages.at(-1).requestId,72);
});

test('AudioEngine opts in without detaching playback PCM and invalidates superseded pool publications',async()=>{
    const workers=[],decodes=[],state={isPlaying:false,targetTuning:{phraseSize:4},visualTuning:{},modulation:{}};
    const pcm=new Float32Array(24000);
    class Worker {constructor(){workers.push(this)}postMessage(request,transfer){this.request=request;this.transfer=transfer}terminate(){this.terminated=true}}
    const ctx={currentTime:0,state:'running',destination:{},decodeAudioData:()=>new Promise(resolve=>decodes.push(resolve))};
    const {AudioEngine}=createLoader({'./analyzer.worker.ts?worker':Worker,'../state/store':{State:state},
        '../config/featureFlags':{featureFlags:{heroEffect:false}},'../state/visualTransitionState':{resetActiveVisualTransitions(){}},
        './HeroMetronome':{HeroMetronome:{generateStems(){return []}}}}, {window:{AudioContext:function(){return ctx}}})('audio/AudioEngine.ts');
    const engine=new AudioEngine(undefined,{rhythmOnsets:true,loopPlayback:false,heroMetronome:false});
    const file={arrayBuffer:async()=>new ArrayBuffer(8)}, buffer={duration:3,sampleRate:8000,getChannelData:()=>pcm};
    const first=engine.loadFile(file); await new Promise(setImmediate); decodes[0](buffer); await first;
    const old=workers[0], stale=old.onmessage;
    assert.equal(old.request.rhythmOnsets,true);assert.notEqual(old.request.samples,pcm.buffer);assert.equal(pcm.byteLength,96000);
    assert.equal(old.transfer[0],old.request.samples);
    const second=engine.loadFile(file); await new Promise(setImmediate); decodes[1](buffer); await second;
    assert.ok(old.terminated);
    stale({data:{type:'analysis_done',requestId:old.request.requestId,trackAnalysis:{rhythmOnsets:pool([])}}});
    assert.equal(state.trackAnalysis.rhythmOnsets,undefined);
    const next=workers[1], raw=analyzeAudio({samples:pcm,sampleRate:8000,options:{requestId:next.request.requestId,rhythmOnsets:true}});
    next.onmessage({data:{type:'analysis_done',...raw}});
    assert.ok(next.terminated); assert.equal(state.trackAnalysis.rhythmOnsets.algorithm,'percussive-pool-v1');
});

test('XR profile changes regenerate from the captured pool; Classic and render events keep legacy ownership',async()=>{
    const h=harness({diagnostics:true});
    const sr=6400,hop=64,duration=h.State.duration;
    const c={...clock,sampleRate:sr,hopSize:hop,windowSize:hop,sampleCount:Math.round(duration*sr)};
    const events=h.State.events;
    // The harness legacy fixture has non-frame timestamps; canonicalize only this authored input.
    const legacy=events.map(e=>({...e,time:Math.round(e.time*sr/hop)*hop/sr}));
    const extra={time:3.04,intensity:1,type:3};
    const all=[...legacy.filter(e=>e.time!==extra.time),extra].sort((a,b)=>a.time-b.time);
    h.State.events=legacy; h.State.sampleRate=sr;h.State.hopSize=hop;
    h.State.trackAnalysis={...h.State.trackAnalysis,featureClock:c,rhythmOnsets:{algorithm:'percussive-pool-v1',clock:c,events:all}};
    await h.loadTrack(); h.pick('musical-v1'); await new Promise(setImmediate); await new Promise(setImmediate);
    const measured=JSON.parse(h.controller.overlay.dataset.xrChartSelection);
    assert.equal(measured.eventSource.kind,'grid-independent-percussive');
    assert.equal(h.sceneLog.analyses.at(-1).events,legacy);
    h.pick('legacy'); await new Promise(setImmediate); await new Promise(setImmediate);
    assert.equal(JSON.parse(h.controller.overlay.dataset.xrChartSelection).eventSource.kind,'legacy-visual');
});

