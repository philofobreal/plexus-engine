// Measure finite preset-base deadlines on an existing accepted chart-source capture.
// node scripts/evaluate-automation-arrival.mjs INPUT.source.json OUTPUT_NEW.json
// Reads local shipped presets; never decodes audio or rewrites a retained measurement.
// Coverage/deadline consistency only, not annotated musical accuracy or rendered particle arrival.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createLoader} from '../tests/helpers/xr-loader.mjs';
const [input,output]=process.argv.slice(2);
if(!input||!output||fs.existsSync(output))throw Error('Supply a capture and a new output path');
const bytes=fs.readFileSync(input),capture=JSON.parse(bytes),publication=capture.source?.performancePlan;
if(!publication?.points.length)throw Error('Capture has no performance plan');
const load=createLoader(),{AutomationTuningTimeline}=load('automation/AutomationTuningTimeline.ts'),
 {WormholeSpiralAutomation}=load('automation/WormholeSpiralAutomation.ts'),
 {cloneDefaultVisualTuning,effectiveWormholeSpiral}=load('config/visualTuning.ts'),
 {applyMvpWormholePreset}=load('automation/applyMvpWormholePreset.ts'),
 {automationMorphWindow}=load('automation/performanceAutomationRuntime.ts'),
 {applyMorphScale,clampMorphScale}=load('automation/morphScale.ts');
const defaultScale=clampMorphScale(publication,1,{durationSec:capture.source.durationSec}),plan=applyMorphScale(publication,defaultScale,{durationSec:capture.source.durationSec});
const assets=new Map();for(const p of plan.points){if(!/^[\w .-]+\.json$/.test(p.preset))throw Error('Invalid asset name');
 if(!assets.has(p.preset))assets.set(p.preset,JSON.parse(fs.readFileSync(path.join('public/visual-tuning-presets',p.preset))));}
const preset=name=>assets.get(name),timeline=new AutomationTuningTimeline(),signed=new WormholeSpiralAutomation();
const begin=performance.now();timeline.configure(plan,preset);signed.configure(plan,preset);const preparationMs=performance.now()-begin;
const raw=cloneDefaultVisualTuning(),out=cloneDefaultVisualTuning(),checks=[];
let previous;
for(const p of plan.points){
 applyMvpWormholePreset(raw,preset(p.preset),p);timeline.applyCanonicalTarget(p,raw);
 const window=automationMorphWindow(p,previous),deadline=p.time===0?0:window.end;
 timeline.apply(deadline,out,raw);signed.apply(deadline,out,raw);
 let maxResidual=0;for(const key of timeline.anchors.find(a=>a.point===p).keys){if(key==='wormholeSpiral'||key==='wormholeSpiralDirection')continue;maxResidual=Math.max(maxResidual,Math.abs(out[key]-raw[key]));}
 const signedResidual=Math.abs(effectiveWormholeSpiral(out)-effectiveWormholeSpiral(raw));
 if(maxResidual>1e-9||signedResidual>1e-9)throw Error('Missed authored endpoint: '+p.id+' '+maxResidual+'/'+signedResidual);
 checks.push({id:p.id,cue:p.time,start:window.start,deadline,duration:p.morphDurationSec,arrivalAtCue:window.arrivalAtCue,maxResidual,signedResidual});previous=p;
}
const last=plan.points.at(-1),lastWindow=automationMorphWindow(last,plan.points.at(-2)),warmTime=(lastWindow.start+lastWindow.end)/2,warmRaw=cloneDefaultVisualTuning();
for(const p of plan.points){if(p.time>warmTime)break;applyMvpWormholePreset(warmRaw,preset(p.preset),p);timeline.applyCanonicalTarget(p,warmRaw);}
const warmStart=performance.now();for(let i=0;i<1000;i++){timeline.configure(plan,preset);signed.configure(plan,preset);timeline.apply(warmTime,out,warmRaw);signed.apply(warmTime,out,warmRaw);}const warm1000Ms=performance.now()-warmStart;
const sources=Object.fromEntries(['src/automation/AutomationTuningTimeline.ts','src/automation/WormholeSpiralAutomation.ts','src/automation/performanceAutomationRuntime.ts','src/automation/applyMvpWormholePreset.ts','src/automation/morphScale.ts','src/config/visualTuning.ts','scripts/evaluate-automation-arrival.mjs'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const result={sources,recording:capture.recording,sourceSha256:createHash('sha256').update(bytes).digest('hex'),scope:'Default-scale preset-base endpoint consistency; semantic modulation/particles/human musical precision not measured',defaultScale,points:checks.length,passed:true,preparationMs,warm1000Ms,checks};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...result,checks:undefined}));
