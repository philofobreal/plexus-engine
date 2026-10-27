import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
const load=createLoader();
const {measureRhythmAttention,planRhythmAttention}=load('gameplay/RhythmLocalAttention.ts');
const {buildRhythmChartWithDiagnostics,buildRhythmChart}=load('gameplay/RhythmChartBuilder.ts');
const {DEFAULT_RHYTHM_GAME_CONFIG:config}=load('gameplay/RhythmGameConfig.ts');
const {normalizeGenerationSettings,difficultyProfile}=load('gameplay/RhythmGenerationProfile.ts');
const {validateRhythmMovement}=load('gameplay/RhythmMovement.ts');
const settings=normalizeGenerationSettings({chartProfile:'musical-v1',difficulty:'ultra',activity:'active',variation:'expressive',
 handPattern:'alternate',handLead:'even',zones:'split',playSpace:'tall',motionSafety:'guarded'});
const json=v=>JSON.stringify(v),clone=v=>JSON.parse(json(v));
function fixture(reverse=false){
 const durationSec=10,sampleRate=1024,hopSize=32;
 const events=Array.from({length:16},(_,i)=>[0,.0625].map(offset=>({time:2+i*.5+offset,intensity:.8,type:1}))).flat();
 const frames=Array.from({length:durationSec*32},()=>({e:.7,densityProj:.7,perceptualSpectrum:new Array(24).fill(.1)}));
 events.forEach((event,i)=>{const high=(event.time>=6)!==reverse,primary=(i%2===1)===high;
  const frame=frames[Math.floor(event.time*sampleRate/hopSize)],group=i%2===0?0:2;
  for(let b=group*8;b<group*8+8;b++)frame.perceptualSpectrum[b]+=primary?.8:.08;
 });
 const source={durationSec,events,beats:Array.from({length:21},(_,i)=>i*.5),barStarts:[0,2,4,6,8],timingConfidence:1,
  sections:[{start:0,end:durationSec,label:'break'}],sectionStarts:[0]};
 source.attention=measureRhythmAttention(events,durationSec,frames,sampleRate,hopSize);
 return{source,frames,sampleRate,hopSize};
}
function attention(source){return planRhythmAttention(source.events.map((event,index)=>({event,index})),source.events,source.durationSec,.5,
 source.barStarts,true,settings,config.minGlobalNoteSpacingSec*difficultyProfile('ultra').globalSpacingScale,
 difficultyProfile('ultra').globalSpacingScale,source.attention);}
const indices=chart=>[...new Set(chart.map(n=>Number(n.id.split('-')[1])))];

test('matched-budget source choices follow a spectral-change switch inside ONE break, not event parity or the label',()=>{
 const a=fixture(),b=fixture(true),before=json(a),pa=attention(a.source),pb=attention(b.source);
 assert.equal(pa.summary.mode,'frame-change');assert.equal(pa.selected.size,pb.selected.size);
 assert.ok(pa.selected.size>=12,'control retains repeated onsets, not one token accent');
 for(const index of pa.selected)assert.equal(index%2,a.source.events[index].time>=6?1:0);
 for(const index of pb.selected)assert.equal(index%2,b.source.events[index].time>=6?0:1);
 assert.notDeepEqual([...pa.selected],[...pb.selected]);assert.equal(json(a),before);
});

test('actual guarded chart retains the locally stronger stream and original time/type/intensity',()=>{
 for(const reverse of [false,true]){
  const{source}=fixture(reverse),{chart,diagnostics}=buildRhythmChartWithDiagnostics(source,config,settings);
  assert.ok(chart.length>8);assert.ok(validateRhythmMovement(chart,config,settings).valid);
  for(const n of chart){const index=Number(n.id.split('-')[1]),e=source.events[index];
   assert.equal(n.time,e.time);assert.equal(n.sourceType,e.type);assert.equal(n.intensity,e.intensity);
   assert.equal(index%2,(e.time>=6)!==reverse?1:0);
  }
  assert.equal(diagnostics.attention.mode,'frame-change');
  assert.equal(diagnostics.sourceEvents,diagnostics.retainedEvents+diagnostics.skippedEvents);
  assert.equal(diagnostics.rejected['echo-window']??0,0);assert.equal(diagnostics.rejected['section-breath']??0,0);
  assert.equal(diagnostics.rejected['pair-preparation']??0,0);assert.ok(diagnostics.rejected['local-attention']>0);
 }
});

test('relabeling identical music as peak/intro/build never substitutes for local evidence',()=>{
 const{source}=fixture(),expected=json(buildRhythmChart(source,config,settings));
 for(const label of ['peak','intro','build','verse','outro','drop']){
  const other={...source,sections:source.sections.map(s=>({...s,label}))};
  assert.equal(json(buildRhythmChart(other,config,settings)),expected,label);
 }
});

test('automation point insertion and visual gesture changes do not reset local source selection',()=>{
 const{source}=fixture(),expected=indices(buildRhythmChart(source,config,settings));
 const points=[0,3,4.5,6.5,8].map((time,i)=>({id:'p'+i,time,preset:'unused.json',intensity:3,confidence:1,
  sectionId:'s',reason:'peak',morphDurationSec:1,morphCurve:'linear',meta:{movementGesture:'wave',behaviour:{energy:1}}}));
 assert.deepEqual(indices(buildRhythmChart({...source,performancePlan:{version:1,source:'auto',points}},config,settings)),expected);
});

test('invalid/absent frame evidence degrades explicitly to event-only, never inventing a grid note',()=>{
 const{source}=fixture();
 for(const evidence of [undefined,{...source.attention,sampleRate:0},{...source.attention,hopSize:31},
  {...source.attention,frameCount:2},{...source.attention,records:source.attention.records.slice(1)},
  {...source.attention,records:source.attention.records.map((r,i)=>i? r:{...r,time:r.time+.1})}]){
  const{chart,diagnostics}=buildRhythmChartWithDiagnostics({...source,attention:evidence},config,settings);
  assert.equal(diagnostics.attention.mode,'events-only');assert.equal(diagnostics.attention.fallbackReason,'missing-or-invalid-frame-evidence');
  assert.ok(chart.length>0);assert.ok(chart.every(n=>source.events.some(e=>e.time===n.time)));
 }
 assert.deepEqual([...attention({...source,events:[],attention:undefined}).selected],[]);
 assert.equal(measureRhythmAttention(source.events,source.durationSec,fixture().frames,44100,32),undefined,'wrong clock cannot be inferred from frame count');
});

test('Classic ignores measured attention byte-for-byte and frame projection never changes the input',()=>{
 const{source,frames,sampleRate,hopSize}=fixture(),before=json({source,frames});
 assert.equal(json(buildRhythmChart(source,config,{...settings,chartProfile:'legacy'})),
  json(buildRhythmChart({...source,attention:undefined},config,{...settings,chartProfile:'legacy'})));
 assert.equal(json(measureRhythmAttention(source.events,source.durationSec,frames,sampleRate,hopSize)),json(source.attention));
 assert.equal(json({source,frames}),before);
});

test('copied measured passages keep relative source choices after a whole-bar translation',()=>{
 const{source}=fixture(),base=attention(source),offset=12;
 const events=source.events.map(e=>({...e,time:e.time+offset}));
 const other={...source,events,durationSec:source.durationSec+offset,barStarts:Array.from({length:11},(_,i)=>i*2),
  attention:{...source.attention,frameCount:source.attention.frameCount+offset*32,
   records:source.attention.records.map(r=>({...r,time:r.time+offset,frame:r.frame+offset*32}))}};
 assert.deepEqual([...attention(other).selected],[...base.selected]);
});

test('late first bar, duplicate source timestamps and empty gaps terminate deterministically',()=>{
 const{source}=fixture(),late={...source,barStarts:[5,7,9]};
 assert.ok(buildRhythmChart(late,config,settings).length>0);
 const duplicate={...source,attention:undefined,events:source.events.flatMap(e=>[e,{...e}])};
 const result=buildRhythmChart(duplicate,config,settings);
 assert.equal(json(result),json(buildRhythmChart(clone(duplicate),config,settings)));
 assert.ok(validateRhythmMovement(result,config,settings).valid);
});

test('a truncated meter cannot map tail events into an expired or overlapping window',()=>{
 const events=[2.5,4.1,4.3,20,20.5,29].map(time=>({time,intensity:.8,type:1}));
 const plan=planRhythmAttention(events.map((event,index)=>({event,index})),events,30,.5,[0,2.2],true,settings,.1,.45);
 for(const e of events)assert.equal(plan.windows.filter(w=>w.start<=e.time&&e.time<w.end).length,1,e.time);
 for(let i=1;i<plan.windows.length;i++)assert.ok(plan.windows[i].start>=plan.windows[i-1].end);
});

test('Together preserves real shared accents on uniform and accented material without replacing source times',()=>{
 for(const accented of [false,true]){
  const{source}=fixture();source.attention=undefined;
  source.events=Array.from({length:32},(_,i)=>({time:2+i*.25,intensity:accented&&i%8===0?1:.6,type:1}));
  source.durationSec=11;source.sections=[{start:0,end:11,label:'break'}];source.barStarts=[0,2,4,6,8,10];
  const together=buildRhythmChart(source,config,{...settings,handPattern:'together'});
  const alternate=buildRhythmChart(source,config,settings);
  assert.ok(together.filter(n=>n.pairId).length>alternate.filter(n=>n.pairId).length);
  assert.ok(together.every(n=>source.events.some(e=>e.time===n.time)));
  assert.ok(validateRhythmMovement(together,config,{...settings,handPattern:'together'}).valid);
 }
});

test('malformed frame arrays and record payloads fail closed instead of throwing',()=>{
 const{source,frames,sampleRate,hopSize}=fixture();
 for(const change of ['abc',{length:3},null]){
  const bad={...source,attention:{...source.attention,records:source.attention.records.map((r,i)=>i?r:{...r,change})}};
  assert.equal(attention(bad).summary.mode,'events-only');
 }
 const badFrames=clone(frames);badFrames[Math.floor(source.events[0].time*sampleRate/hopSize)].perceptualSpectrum='x'.repeat(24);
 assert.equal(measureRhythmAttention(source.events,source.durationSec,badFrames,sampleRate,hopSize),undefined);
 assert.equal(attention({...source,attention:{...source.attention,frameCount:source.attention.frameCount+.5}}).summary.mode,'events-only');
});
