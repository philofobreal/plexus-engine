import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createLoader}from'./helpers/xr-loader.mjs';
const drain=()=>new Promise(r=>setImmediate(r));
function setup(overrides={},assets={}){
 const forbid=()=>{throw Error('Unexpected background canvas');};
 const load=createLoader({three:THREE,'./createWormholeNativeWorker':{createWormholeNativeWorker:()=>{throw Error('Inject worker');}}},
  {performance:{now:()=>0},setTimeout,clearTimeout,ArrayBuffer,Float32Array,document:{createElement:forbid},OffscreenCanvas:class{constructor(){forbid();}},
   fetch:async url=>({ok:true,json:async()=>assets[decodeURIComponent(url.split('/').at(-1))]??{}})});
 const raw=load('config/visualTuning.ts').cloneDefaultVisualTuning();Object.assign(raw,{wormholePathBend:0,wormholePathBendVertical:0,wormholeLens:0,wormholeStarfield:0,wormholeGalaxy:0,wormholeSkybox:0,...overrides});
 const seed={version:1,rawTuning:raw,macros:{intensity:.5,motion:.5,depth:.5,detail:.5},boosts:{},policy:{gains:'raw',semanticResolver:false,semanticChoreography:false}};
 const Source=load('visuals/WormholeNativeSource.ts').WormholeNativeSource;return{load,raw,seed,Source,source:new Source(seed)};
}
const active=f=>Array.from(f.data.slice(0,f.count*16));
const family=(f,k)=>{const a=[];for(let i=0;i<f.count;i++)if(f.data[i*16+15]===k)a.push(Array.from(f.data.slice(i*16,(i+1)*16)));return a;};
function analysis(load,points=[]){const frames=Array.from({length:600},()=>({e:1,eRatio:1.2,densityProj:.5,melodyProj:.3,fxProj:0,subEnergy:1,bassEnergy:1,subFlux:.2,bassFlux:.2,state:'DRIVE',perceptualSpectrum:Array(24).fill(1)}));
 return{frames,events:[{time:2,type:0,intensity:1}],sampleRate:100,hopSize:1,bpm:128,duration:6,trackAnalysis:load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis(),performancePlan:{version:1,source:'edited',points}};}
const point=(id,time,preset)=>({id,time,preset,confidence:1,intensity:1,reason:'build',morphDurationSec:1,morphCurve:'linear'});
test('native wall Off preserves primary geometry, On supplies an explicit preview and material choices use bounded original families',async()=>{
 const h=setup();await h.source.prepare(null);h.source.render(2.125,false);const grains=active(h.source.frame),bank=h.source.frame.wall.data.buffer;
 assert.equal(h.source.frame.wall.count,0);assert.equal(bank.byteLength,204800);
 h.source.setPresentation({wall:{mode:'on'}});h.source.render(2.125,false);assert.ok(family(h.source.frame.wall,0).length>0);assert.ok(family(h.source.frame.wall,1).length>0);assert.equal(family(h.source.frame.wall,2).length,0);
 assert.deepEqual(active(h.source.frame),grains);assert.ok(h.source.frame.wall.count<=2686);
 for(const n of active(h.source.frame.wall))assert.ok(Number.isFinite(n));
 h.source.setPresentation({wall:{material:'mosaic'}});h.source.render(2.125,false);assert.ok(family(h.source.frame.wall,2).length>0);assert.equal(family(h.source.frame.wall,0).length,0);assert.equal(family(h.source.frame.wall,1).length,0);
 h.source.setPresentation({wall:{mode:'off'}});h.source.render(2.125,false);assert.equal(h.source.frame.wall.count,0);assert.equal(h.source.frame.wall.data.buffer,bank);h.source.dispose();
});
test('native wall coordinates project onto the original raster membrane/caustic strokes before per-eye projection',async()=>{
 const h=setup({wormholeOpticsEnabled:1,wormholeWall:1,wormholeWallRefraction:0,wormholeNebulaAmount:0}),Context=h.load('visuals/WormholeFrameContext.ts').WormholeFrameContext,c=new Context(h.seed);
 c.step(1.25,false,1,null,false,true);const lines=[],backend={width:960,height:540,frameCount:0};
 for(const name of['background','noStroke','noFill','fill','stroke','strokeWeight','circle','triangle','beginShape','vertex','endShape','radialGlow','radialDim','compositeRingTint','drawFieldRaster'])backend[name]=()=>{};
 backend.beginFieldRaster=()=>null;backend.line=(...v)=>lines.push(v);c.identity.draw(backend,[],[]);
 await h.source.prepare(null);h.source.render(1.25,false);const f=h.source.frame.wall;assert.ok(f.count>100);assert.ok(lines.length>=f.count);
 for(let i=0;i<f.count;i++){const o=i*16,d=f.data,p=lines[i];
  const xy=[480+d[o+4]/-d[o+6]*648,270-d[o+5]/-d[o+6]*648,480+d[o+1]/-d[o+3]*648,270-d[o+2]/-d[o+3]*648];
  for(let j=0;j<4;j++)assert.ok(Math.abs(xy[j]-p[j])<.01,`segment ${i}, coordinate ${j}: ${xy[j]} vs ${p[j]}`);
 }c.dispose();h.source.dispose();
});
test('preset mode honours authored gate/material/amount after MVP suppression, without enabling lens or editing presets; rewind retains authority',async()=>{
 const assets={a:{visualTuning:{wormholeOpticsEnabled:1,wormholeWall:.4,wormholeWallMode:1}},b:{visualTuning:{wormholeOpticsEnabled:0,wormholeWall:1}}},before=JSON.stringify(assets),h=setup({},assets);
 const a=analysis(h.load,[point('a',0,'a'),point('b',3,'b')]);h.source.setPresentation({wall:{mode:'preset'}});await h.source.prepare(a);
 h.source.render(2.125,false);assert.ok(family(h.source.frame.wall,2).length>0);h.source.render(4,false);assert.equal(h.source.frame.wall.count,0);
 h.source.render(2.125,false);assert.ok(family(h.source.frame.wall,2).length>0);assert.equal(JSON.stringify(assets),before);
 const Context=h.load('visuals/WormholeFrameContext.ts').WormholeFrameContext,c=new Context(h.seed);c.preparePlan(a.performancePlan,new Map(Object.entries(assets)));c.setPresentation({wall:{mode:'preset',amount:.75}});c.step(2,false,1,null,true,true);
 assert.equal(c.state.visualTuning.wormholeWall,1,'shared Advanced gain saturates at existing wall bounds');assert.equal(c.state.visualTuning.wormholeOpticsEnabled,0,'lens gate stays suppressed');c.rewind();c.step(2,false,1,null,true,true);assert.equal(c.state.visualTuning.wormholeWallMode,1);assert.equal(c.state.visualTuning.wormholeWall,1);c.dispose();h.source.dispose();
});
test('existing fronts deform membrane and trigger chromatic cracks; zero controls, decay and repeated seeks are deterministic',async()=>{
 const h=setup(),a=analysis(h.load),before=JSON.stringify(a);h.source.setPresentation({wall:{mode:'on'}});await h.source.prepare(a);h.source.render(2.05,false);
 const f=h.source.frame.wall,first=active(f);assert.ok(family(f,3).length>0);assert.ok(family(f,0).some(r=>r[12]!==0),'lit spectral sectors carry warm/cool fringe');
 h.source.setPresentation({wall:{fringe:0}});h.source.render(2.05,false);assert.ok(active(h.source.frame.wall).length>0);for(let i=0;i<f.count;i++)assert.equal(f.data[i*16+12],0);
 h.source.setPresentation({wall:{fringe:.5,cracks:0}});h.source.render(2.05,false);assert.equal(family(f,3).length,0);
 h.source.setPresentation({wall:{cracks:.5,caustics:0}});h.source.render(2.05,false);assert.equal(family(f,1).length,0);
 h.source.setPresentation({wall:{caustics:.5,waves:0}});h.source.render(2.05,false);const noWave=family(f,0).filter(r=>r[12]===0);
 h.source.setPresentation({wall:{waves:.5}});h.source.render(2.05,false);const wave=family(f,0).filter(r=>r[12]===0);assert.equal(wave.length,noWave.length);assert.ok(wave.some((r,i)=>r.slice(1,7).some((x,j)=>Math.abs(x-noWave[i][j+1])>1e-6)));
 h.source.render(5,false);assert.equal(family(f,3).length,0);h.source.render(2.05,false);assert.deepEqual(active(f),first);assert.equal(JSON.stringify(a),before);
 h.source.setPresentation({wall:{amount:0}});h.source.render(2.05,false);assert.equal(f.count,0);h.source.dispose();
});
test('performance policy retains bounded membrane/mosaic but omits crack and chromatic passes',async()=>{
 const h=setup({performanceMode:1}),a=analysis(h.load);h.source.setPresentation({wall:{mode:'on'}});await h.source.prepare(a);h.source.render(2.05,false);const f=h.source.frame.wall;
 assert.ok(f.count>0&&f.count<500);assert.equal(family(f,3).length,0);for(let i=0;i<f.count;i++)assert.equal(f.data[i*16+12],0);h.source.dispose();
});
test('Wall settings are presentation-only, normalize old/hostile records and persist with the actual Copy report',()=>{
 const h=setup(),{DEFAULT_XR_SETTINGS,XR_SETTINGS,normalizeXrSettings,changeScope}=h.load('xr/XrSettings.ts');
 let s=normalizeXrSettings({background:{}});assert.equal(s.background.wall.mode,'off');assert.equal(s.background.wall.material,'preset');assert.equal(s.background.wall.amount,.5);
 for(const[id,value]of[['wallMode','on'],['wallMaterial','mosaic'],['wallAmount',20],['wallFringe',0],['wallCaustics',90],['wallWaves',70],['wallCracks',80]]){const d=XR_SETTINGS.find(d=>d.id===id);assert.equal(d.section,'wall');s=d.write(s,value);assert.equal(d.read(s),value);}
 assert.equal(changeScope(DEFAULT_XR_SETTINGS,s),'presentation');const values=new Map(),store=h.load('xr/XrSettingsStore.ts').createXrSettingsStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});store.save(s);assert.equal(JSON.stringify(store.load()),JSON.stringify(s));
 const report=h.load('xr/XrMenuModel.ts').settingsReport(store.load(),'wall');assert.match(report,/Wall: On/);assert.match(report,/Wall material: Mosaic/);assert.match(report,/Wall amount: 20/);
 const bad=normalizeXrSettings({background:{wall:{mode:'invalid',material:'bad',amount:NaN,fringe:8,cracks:-5}}});assert.equal(bad.background.wall.mode,'off');assert.equal(bad.background.wall.amount,.5);assert.equal(bad.background.wall.fringe,1);assert.equal(bad.background.wall.cracks,0);h.source.dispose();
});
test('wall GPU batch validates old absence, safety, distance and quality without detaching packets; disposes once',async()=>{
 const h=setup();h.source.setPresentation({wall:{mode:'on'}});await h.source.prepare(null);h.source.render(2.125,false);
 const Wall=h.load('xr/scene/NativeWormholeWall.ts').NativeWormholeWall,w=new Wall();w.setFrame(h.source.frame.wall);const full=w.mesh.geometry.instanceCount;assert.ok(full>0);w.setBudget(360);w.setFrame(h.source.frame.wall);assert.ok(w.mesh.geometry.instanceCount<full*.5);
 assert.equal(w.mesh.geometry.getAttribute('aHead').count,3200);assert.equal(w.mesh.material.depthWrite,false);assert.equal(w.mesh.material.transparent,false);assert.ok(w.mesh.renderOrder<-1001);assert.equal(w.mesh.material.map,undefined);
 const d=new Float32Array(16);d.set([0,0,0,-1,0,0,-2,.02,1,1,1,.5,0,0,0,0]);w.setFrame({count:1,data:d});assert.equal(w.mesh.geometry.instanceCount,0);
 d[1]=d[4]=4;d[3]=-5;d[6]=-6;w.setFrame({count:1,data:d});assert.equal(w.mesh.geometry.instanceCount,1);w.setDistance(4);w.setFrame({count:1,data:d});assert.equal(w.mesh.geometry.instanceCount,0);
 w.setFrame();assert.equal(w.mesh.geometry.instanceCount,0);assert.throws(()=>w.setFrame({count:3201,data:d}),/Invalid native wall/);let gd=0,md=0;w.mesh.geometry.addEventListener('dispose',()=>gd++);w.mesh.material.addEventListener('dispose',()=>md++);w.dispose();w.dispose();assert.equal(gd,1);assert.equal(md,1);h.source.dispose();
});
test('worker transfers wall atomically, returns three buffers once, rejects stale settings and clears absent Off output',async()=>{
 const h=setup(),responses=[],posts=[],host=h.load('visuals/WormholeNativeWorkerHost.ts').createNativeWorkerHost((m,t=[])=>{const out=structuredClone(m,{transfer:t});for(const b of t)assert.equal(b.byteLength,0);responses.push(out);},seed=>new h.Source(seed));
 const worker={onmessage:null,onerror:null,onmessageerror:null,postMessage(m,t=[]){const out=structuredClone(m,{transfer:t});posts.push(out);void host.receive(out);},terminate(){host.dispose();}};
 const Proxy=h.load('visuals/WormholeNativeWorkerSource.ts').WormholeNativeWorkerSource,p=new Proxy({seed:h.seed,workerFactory:()=>worker});p.setPresentation({wall:{mode:'on'}});const prep=p.prepare(null);await drain();worker.onmessage({data:responses.shift()});await prep;
 p.render(2.125,false);await drain();const first=responses.shift();assert.equal(first.buffer.byteLength,437760);assert.equal(first.cosmosBuffer.byteLength,308352);assert.equal(first.wallBuffer.byteLength,204800);worker.onmessage({data:first});p.render(2.125,false);assert.equal(first.wallBuffer.byteLength,0);const shown=active(p.frame.wall),bank=p.frame.wall.data.buffer;
 assert.equal(posts.at(-1).type,'release');assert.equal(posts.at(-1).wallBuffer.byteLength,204800);h.source.setPresentation({wall:{mode:'on'}});await h.source.prepare(null);h.source.render(2.125,false);assert.deepEqual(shown,active(h.source.frame.wall));
 p.render(3,false);await drain();p.setPresentation({wall:{mode:'off'}});p.render(3,false);worker.onmessage({data:responses.shift()});await drain();assert.deepEqual(active(p.frame.wall),shown);const off=responses.shift();assert.equal(off.wallBuffer,undefined);worker.onmessage({data:off});p.render(3,false);assert.equal(p.frame.wall.count,0);assert.notEqual(p.frame.wall.data.buffer,bank);p.dispose();h.source.dispose();
});
test('optional wall pair validation fails closed on malformed data and missing lease return',async()=>{
 const h=setup(),messages=[],host=h.load('visuals/WormholeNativeWorkerHost.ts').createNativeWorkerHost(m=>messages.push(m),()=>h.source);
 await host.receive({type:'prepare',version:1,generation:1,analysis:null,presentation:{wall:{mode:'on'}}});await host.receive({type:'render',version:1,generation:1,requestId:1,epoch:1,revision:1,songTime:2.125,playing:false,continuous:false,presentation:{wall:{mode:'on'}}});
 const frame=messages.at(-1),valid=h.load('types/WormholeNativeWorkerProtocol.ts').validNativeResponse;assert.equal(valid(frame),true);const old={...frame};delete old.wallCount;delete old.wallBuffer;assert.equal(valid(old),true);
 for(const bad of[{...frame,wallCount:3201},{...frame,wallCount:-1},{...frame,wallCount:.5},{...frame,wallBuffer:undefined},{...frame,wallBuffer:new ArrayBuffer(16)}])assert.equal(valid(bad),false);
 await host.receive({type:'release',version:1,generation:1,requestId:1,buffer:frame.buffer,cosmosBuffer:frame.cosmosBuffer});assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/Missing wall lease/);host.dispose();
});
test('main fallback supports wall overrides and disposal; native prepare clears displayed old wall',async()=>{
 const h=setup(),Proxy=h.load('visuals/WormholeNativeWorkerSource.ts').WormholeNativeWorkerSource,p=new Proxy({forceMain:true,seed:h.seed});p.setPresentation({wall:{mode:'on'}});await p.prepare(null);p.render(2.125,false);assert.ok(p.frame.wall.count>0);assert.match(p.executionLabel,/main geometry/);
 p.setPresentation({wall:{mode:'off'}});p.render(2.125,false);assert.equal(p.frame.wall.count,0);await p.prepare(null);assert.equal(p.frame,null);p.dispose();h.source.dispose();
});
