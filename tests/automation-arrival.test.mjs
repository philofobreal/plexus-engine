import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
const load=createLoader();
const {AutomationTuningTimeline}=load('automation/AutomationTuningTimeline.ts');
const {automationMorphProgress}=load('automation/performanceAutomationRuntime.ts');
const {cloneDefaultVisualTuning,applyTuningMorph,effectiveWormholeSpiral}=load('config/visualTuning.ts');
const {applyMvpWormholePreset}=load('automation/applyMvpWormholePreset.ts');
const {WormholeSpiralAutomation}=load('automation/WormholeSpiralAutomation.ts');
const point=(time,preset,duration=.1,curve='linear')=>({id:String(time),time,preset,sectionId:'s',reason:'verse',intensity:1,confidence:.8,
    morphDurationSec:duration,morphCurve:curve,cuePlacement:{role:time===0?'scene-entry':'structure',start:0,end:30}});
const payloads={a:{visualTuning:{wormholeSpeed:.1,wormholePathBend:0,lineWeight:5,wormholeSpiral:.6,wormholeSpiralDirection:1,transitionSpeed:0}},
    b:{visualTuning:{wormholeSpeed:7,wormholePathBend:2,wormholeSpiral:.8,wormholeSpiralDirection:-1,transitionSpeed:0}},
    c:{visualTuning:{wormholeSpeed:1}}};
const plan=(points=[point(0,'a'),point(2,'b')])=>({version:1,source:'auto',points});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function fixture(points){const input=plan(points),timeline=new AutomationTuningTimeline(),assets={...payloads};timeline.configure(input,n=>assets[n]);return{input,timeline,assets};}
function target(f,time){const out=cloneDefaultVisualTuning(),p=f.input.points.filter(p=>p.time<=time).at(-1);if(p){applyMvpWormholePreset(out,f.assets[p.preset],p);f.timeline.applyCanonicalTarget(p,out);}return out;}

test('finite authored progress has exact endpoints and curve midpoints even below .2s',()=>{
 for(const curve of ['linear','easeInOut','exponential'])for(const duration of [0,.025,.1,1,4]){
  const p=point(2,'b',duration,curve);assert.equal(automationMorphProgress(p,1.99),0);assert.equal(automationMorphProgress(p,2+duration),1);
  if(duration){assert.equal(automationMorphProgress(p,2),0);const m=automationMorphProgress(p,2+duration/2);assert.ok(m>0&&m<1);}
 }
});

test('finite preset arrival is independent of FPS, zero transition speed and first-seen time',()=>{
 for(const fps of [30,60,120]){
  const f=fixture(),out=cloneDefaultVisualTuning();
  for(let t=0;t<2.1;t+=1/fps)f.timeline.apply(t,out,target(f,t));
  f.timeline.apply(2.1,out,target(f,2.1));near(out.wormholeSpeed,7);near(out.wormholePathBend,2);near(out.lineWeight,5);
 }
 const f=fixture(),out=cloneDefaultVisualTuning();f.timeline.apply(2.05,out,target(f,2.05));near(out.wormholeSpeed,3.55);
 const snapshot=out.wormholeSpeed;f.timeline.apply(2.05,out,target(f,2.05));near(out.wormholeSpeed,snapshot);
 f.timeline.apply(2.1,out,target(f,2.1));f.timeline.apply(2.05,out,target(f,2.05));near(out.wormholeSpeed,snapshot);
});

test('partial presets retain canonical inherited values on direct/rewound seek',()=>{
 const f=fixture(),t=target(f,2.05);near(t.lineWeight,5);const out=cloneDefaultVisualTuning();out.lineWeight=1;
 f.timeline.apply(2.05,out,t);near(out.lineWeight,5);
 const future=target(f,2.1);future.lineWeight=99;f.timeline.applyCanonicalTarget(f.input.points[1],future);near(future.lineWeight,5);
});

test('interrupted anchors sample preceding finite value at the exact interruption',()=>{
 const f=fixture([point(0,'a'),point(2,'b',2),point(3,'c',1)]),out=cloneDefaultVisualTuning();
 f.timeline.apply(3,out,target(f,3));near(out.wormholeSpeed,3.55);
 f.timeline.apply(3.5,out,target(f,3.5));near(out.wormholeSpeed,2.275);
 f.timeline.apply(4,out,target(f,4));near(out.wormholeSpeed,1);
});

test('ready prefix works while a future asset is missing and retries when it arrives',()=>{
 const input=plan([point(0,'a'),point(2,'b'),point(10,'later')]),assets={...payloads};const t=new AutomationTuningTimeline();
 t.configure(input,n=>assets[n]);const out=cloneDefaultVisualTuning(),expected=cloneDefaultVisualTuning();
 applyMvpWormholePreset(expected,assets.b,input.points[1]);t.applyCanonicalTarget(input.points[1],expected);
 assert.equal(t.apply(2.1,out,expected),true);near(out.wormholeSpeed,7);
 assert.equal(t.apply(10.1,out,expected),false);
 assets.later=payloads.c;t.configure(input,n=>assets[n]);applyMvpWormholePreset(expected,assets.later,input.points[2]);t.applyCanonicalTarget(input.points[2],expected);
 assert.equal(t.apply(10.1,out,expected),true);near(out.wormholeSpeed,1);
});

test('semantic/manual deltas compose over base and ordinary smoothing resumes after arrival',()=>{
 const f=fixture(),out=cloneDefaultVisualTuning(),t=target(f,2.05);t.wormholeSpeed+=.2;
 f.timeline.apply(2.05,out,t);near(out.wormholeSpeed,3.75);
 f.timeline.apply(2.1,out,t);near(out.wormholeSpeed,7.2);
 t.wormholeSpeed=8;t.transitionSpeed=.5;t.morphDurationSec=3;assert.equal(f.timeline.apply(2.2,out,t),false);
 applyTuningMorph(out,t,t.transitionSpeed,1/60);assert.ok(out.wormholeSpeed>7.2&&out.wormholeSpeed<8);
});

test('host-owned globals and manual spiral direction remain outside finite base ownership',()=>{
 const f=fixture(),out=cloneDefaultVisualTuning(),t=target(f,2.05);out.performanceMode=1;out.wormholeSpiralDirection=-1;
 f.timeline.apply(2.05,out,t);assert.equal(out.performanceMode,1);assert.equal(out.wormholeSpiralDirection,-1);
});

test('signed spiral and finite base share authored duration; typed floor cannot extend it',()=>{
 const f=fixture(),out=cloneDefaultVisualTuning(),s=new WormholeSpiralAutomation();s.configure(f.input,n=>f.assets[n]);
 const t=target(f,2.1);assert.equal(t.morphDurationSec,.1);f.timeline.apply(2.05,out,target(f,2.05));s.apply(2.05,out);
 near(effectiveWormholeSpiral(out),-.1);f.timeline.apply(2.1,out,t);s.apply(2.1,out);near(effectiveWormholeSpiral(out),-.8);
 const legacy={...f.input.points[1]};delete legacy.cuePlacement;const raw=cloneDefaultVisualTuning();applyMvpWormholePreset(raw,payloads.b,legacy);assert.ok(raw.morphDurationSec>.1);
});

test('warm finite cache does not rebuild and a new payload keeps the original phase',()=>{
 const f=fixture();let resolves=0;const resolve=(raw,out)=>{resolves++;return Object.assign(out,raw);};
 f.timeline.configure(f.input,n=>f.assets[n],1,resolve);const prepared=resolves;
 const out=cloneDefaultVisualTuning();
 for(let i=0;i<10;i++){f.timeline.configure(f.input,n=>f.assets[n],1,resolve);f.timeline.apply(2.05,out,target(f,2.05));}
 assert.equal(resolves,prepared);
 f.assets.b={visualTuning:{wormholeSpeed:3,transitionSpeed:0}};f.timeline.configure(f.input,n=>f.assets[n],1,resolve);
 f.timeline.apply(2.05,out,target(f,2.05));near(out.wormholeSpeed,1.55);
});

test('foreign identity keys do not acquire ownership; supported aliases do',()=>{
 const input=plan([point(0,'foreign')]),assets={foreign:{visualMode:'another-style',visualTuning:{wormholeSpeed:9,particleBassTurn:1.7,heroDrumsOnly:1}}};
 const timeline=new AutomationTuningTimeline();timeline.configure(input,n=>assets[n]);
 const current=cloneDefaultVisualTuning();current.wormholeSpeed=6;timeline.applyCanonicalTarget(input.points[0],current);
 assert.equal(current.wormholeSpeed,6);assert.equal(current.particleActivityTurn,1.7);assert.equal(current.heroEventMode,1);
 const out=cloneDefaultVisualTuning();out.wormholeSpeed=6;timeline.apply(0,out,current);assert.equal(out.wormholeSpeed,6);
});

test('typed speed-only plans leave unauthored spiral controls alone; ready spiral prefix reaches deadline',()=>{
 const bare=plan([point(0,'speed'),point(2,'speed')]),spiral=new WormholeSpiralAutomation(),seed=cloneDefaultVisualTuning();seed.wormholeSpiral=2.3;
 spiral.configure(bare,()=>({visualTuning:{wormholeSpeed:2}}),0,undefined,seed);
 const out={...seed,wormholeSpiralDirection:-1};assert.equal(spiral.apply(2.05,out),false);assert.equal(out.wormholeSpiral,2.3);assert.equal(out.wormholeSpiralDirection,-1);
 const f=fixture([point(0,'a'),point(2,'b'),point(10,'missing')]);spiral.configure(f.input,n=>f.assets[n],0,undefined,seed);
 assert.equal(spiral.apply(2.1,out),true);near(effectiveWormholeSpiral(out),-.8);assert.equal(spiral.apply(10.1,out),false);
});
