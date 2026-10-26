import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
const load=createLoader();
const {MotifRuntimeAdapter}=load('semantics/MotifRuntimeAdapter.ts');
const {SemanticTuningProjection}=load('visuals/SemanticTuningProjection.ts');
const {cloneDefaultVisualTuning,applyTuningMorph}=load('config/visualTuning.ts');
const {motifTransitionId}=load('visuals/VisualTransitionIdentity.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const frame=(time,progress)=>({time,motifId:'a',motif:'void-minimal',phrasePosition:progress,variationSeed:7,rhythmicPhase:.9,
 actions:{accelerate:progress},activeOperators:[],motifIntensity:0,motifDensity:0,motifMotion:0,novelty:0,
 transition:{behavior:'morph',progress,preserve:['color'],fromMotif:'void-minimal',toMotif:'tunnel-drive'}});
function plan(){return {version:1,frames:[{time:0,actions:{},activeOperators:[],motifId:'a'},frame(2,0),frame(3,.5),frame(3.999999,1),
 {time:4,actions:{},activeOperators:[],motifId:'b'}],score:{version:1,motifs:[],transitions:[{fromMotifId:'a',toMotifId:'b',startTime:2,duration:2,behavior:'morph',curve:'easeInOut',preserve:['color']}]}};}

test('explicit semantic transition values advance continuously without changing canonical identity',()=>{
 const p=plan(),saved=JSON.stringify(p),base=cloneDefaultVisualTuning(),out=cloneDefaultVisualTuning(),a=new MotifRuntimeAdapter();
 const samples=[];let token;
 for(const t of [2.25,2.5,2.75]){
  const logical=a.update(p,t,base,out);assert.equal(logical,p.frames[1]);
  const id=motifTransitionId(logical);if(token)assert.equal(id,token);token=id;
  samples.push(out.wormholeSpeed);near(a.sampled.transition.progress,(t-2)/2);
 }
 near(samples[0],base.wormholeSpeed+.375);near(samples[1],base.wormholeSpeed+.75);near(samples[2],base.wormholeSpeed+1.125);
 const object=a.sampled,paused=JSON.stringify(out);a.update(p,2.75,base,out);assert.equal(a.sampled,object);assert.equal(JSON.stringify(out),paused);
 a.update(p,4,base,out);assert.equal(a.current,p.frames[4]);near(out.wormholeSpeed,base.wormholeSpeed);
 a.update(p,2.5,base,out);near(out.wormholeSpeed,base.wormholeSpeed+.75);
 assert.equal(JSON.stringify(p),saved);
});

test('ordinary and mismatched or unsupported transition samples retain hold semantics',()=>{
 const changes=[p=>{delete p.score;},p=>{p.frames[2].motifId='other';},p=>{p.frames[2].transition.progress=-.1;},
  p=>{p.frames[2].transition.preserve=[];},p=>{p.frames[2].time=2;p.frames.splice(3,1);},p=>{p.score.transitions[0].duration=.1;},
  p=>{p.frames[2].transition.toMotif='grid-scan';}];
 for(const change of changes){const p=plan();change(p);const a=new MotifRuntimeAdapter();a.update(p,2.5,cloneDefaultVisualTuning(),cloneDefaultVisualTuning());assert.equal(a.sampled,a.current);}
 const p=plan(),a=new MotifRuntimeAdapter();a.update(p,1.9,cloneDefaultVisualTuning(),cloneDefaultVisualTuning());assert.equal(a.sampled,p.frames[0]);
});

test('missing actions interpolate as zero and rhythmic/operator metadata remains logical',()=>{
 const p=plan();p.frames[1].actions={bloom:1};p.frames[2].actions={accelerate:1};p.frames[2].rhythmicPhase=.1;p.frames[2].variationSeed=99;
 const a=new MotifRuntimeAdapter();a.update(p,2.5,cloneDefaultVisualTuning(),cloneDefaultVisualTuning());
 near(a.sampled.actions.bloom,.5);near(a.sampled.actions.accelerate,.5);assert.equal(a.sampled.rhythmicPhase,.9);assert.equal(a.sampled.variationSeed,7);
});

test('raw semantic ownership releases on removal, preserves manual replacements and follows in-place base edits',()=>{
 const p=plan(),a=new MotifRuntimeAdapter(),base=cloneDefaultVisualTuning(),out=cloneDefaultVisualTuning();
 a.update(p,2.5,base,out);base.wormholeSpeed=2;a.update(p,2.5,base,out);near(out.wormholeSpeed,2.75);
 out.lineWeight=6;a.update(null,2.5,base,out);near(out.wormholeSpeed,2);assert.equal(out.lineWeight,6);
 a.update(p,2.5,base,out);out.wormholeSpeed=5;a.clear(out,base);assert.equal(out.wormholeSpeed,5);
 const replacement=cloneDefaultVisualTuning();replacement.wormholeSpeed=6;a.clear(replacement,base);assert.equal(replacement.wormholeSpeed,6);
 a.update(p,Number.NaN,base,replacement);assert.equal(a.current,null);
});

test('empty semantic plans leave the original raw values unclamped',()=>{
 const a=new MotifRuntimeAdapter(),base=cloneDefaultVisualTuning(),out={...base,transitionSpeed:.005};base.transitionSpeed=.005;
 a.update({version:1,frames:[],score:{version:1,motifs:[],transitions:[]}},0,base,out);assert.equal(out.transitionSpeed,.005);
});

test('semantic projection restores exact pre-overlay values after saturation and pause repeats',()=>{
 const p=new SemanticTuningProjection(),base=cloneDefaultVisualTuning(),semantic={...base,audioSensitivity:4},out={...base,audioSensitivity:3.95};base.audioSensitivity=3.8;
 for(let i=0;i<1000;i++){p.restore(out);near(out.audioSensitivity,3.95);applyTuningMorph(out,base,0,0);p.apply(out,base,semantic);assert.equal(out.audioSensitivity,4);}
 p.restore(out);near(out.audioSensitivity,3.95);
});

test('projection ownership never restores an unrelated object or out-of-band manual write',()=>{
 const p=new SemanticTuningProjection(),base=cloneDefaultVisualTuning(),semantic={...base,wormholeSpeed:2},out=cloneDefaultVisualTuning();
 p.apply(out,base,semantic);out.wormholeSpeed=5;p.restore(out);assert.equal(out.wormholeSpeed,5);
 p.apply(out,base,semantic);const replacement={...base,wormholeSpeed:6};p.restore(replacement);assert.equal(replacement.wormholeSpeed,6);
});

test('rendering the semantic delta once is cadence/seek independent even when base smoothing speed is zero',()=>{
 const p=plan(),base=cloneDefaultVisualTuning();base.transitionSpeed=0;
 function at(times){const adapter=new MotifRuntimeAdapter(),projection=new SemanticTuningProjection(),out={...base},target={...base};let previous=0;
  for(const t of times){adapter.update(p,t,base,target);projection.restore(out);applyTuningMorph(out,base,0,Math.max(0,t-previous));projection.apply(out,base,target);previous=t;}return out.wormholeSpeed;}
 for(const hz of [30,60,120]){const times=[];for(let t=0;t<2.5;t+=1/hz)times.push(t);times.push(2.5);near(at(times),base.wormholeSpeed+.75);}
 near(at([2.5]),at([0,3.5,2.5]));
});

test('preset snapshot restoration does not bake previous semantic deltas into partial presets',()=>{
 const isolated=createLoader(),{State}=isolated('state/store.ts'),{restoreSemanticBaseTuning,snapshotSemanticBaseTuning}=isolated('ui/semanticPlanRuntime.ts');
 const {applyMvpWormholePreset}=isolated('automation/applyMvpWormholePreset.ts');
 const base=cloneDefaultVisualTuning();State.semanticBaseTuning={...base};State.visualChoreography={version:1,frames:[]};State.targetTuning={...base};
 for(let i=0;i<50;i++){State.targetTuning.lineAlpha+=.2;restoreSemanticBaseTuning(false);applyMvpWormholePreset(State.targetTuning,{visualTuning:{wormholeSpeed:1}},
  {time:i,id:String(i),intensity:1,morphDurationSec:1,morphCurve:'linear'});snapshotSemanticBaseTuning(false);near(State.semanticBaseTuning.lineAlpha,base.lineAlpha);}
});

test('continuous semantic updates preserve unrelated manual host controls',()=>{
 const a=new MotifRuntimeAdapter(),p=plan(),base=cloneDefaultVisualTuning(),target={...base};
 a.update(p,2.25,base,target);target.performanceMode=1;
 a.update(p,2.5,base,target);assert.equal(target.performanceMode,1);near(target.wormholeSpeed,base.wormholeSpeed+.75);
 a.update(p,4,base,target);assert.equal(target.performanceMode,1);near(target.wormholeSpeed,base.wormholeSpeed);
});
