import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createLoader} from './helpers/xr-loader.mjs';
import {fakeDocument,findAll} from './helpers/fake-dom.mjs';
import {harness} from './helpers/xr-controller-harness.mjs';
const load=createLoader({three:THREE}),plain=x=>JSON.parse(JSON.stringify(x));
const {DEFAULT_MUSIC_DISPLAY,normalizeMusicDisplay}=load('types/MusicDisplay.ts');
const {sampleMusicSpectrum,projectMusicSpectrum}=load('presentation/MusicSpectrum.ts');
const {WormholeMusicDisplay}=load('visuals/WormholeMusicDisplay.ts');
const {XrMusicDisplay}=load('xr/scene/XrMusicDisplay.ts');
const frames=Array.from({length:4},(_,frame)=>({perceptualSpectrum:Array.from({length:24},(_,i)=>.1+frame*.15+i*.01)}));
const enabled={mode:'spectrum',size:.5,opacity:.5};
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
function recorder(){const lines=[],strokes=[];return{width:1060,height:600,lines,strokes,noFill(){},strokeWeight(v){this.weight=v},stroke(...v){strokes.push(v)},line(...v){lines.push(v)}}}

test('spectrum samples the published 24 bands on the absolute analysis clock without mutation',()=>{
 const bands=new Float32Array(24),before=JSON.stringify(frames);
 assert.equal(sampleMusicSpectrum(frames,4,1,.125,bands),true);
 for(let i=0;i<24;i++)near(bands[i],(frames[0].perceptualSpectrum[i]+frames[1].perceptualSpectrum[i])/2);
 assert.equal(JSON.stringify(frames),before);
 const saved=bands.slice();sampleMusicSpectrum(frames,4,1,.65,bands);sampleMusicSpectrum(frames,4,1,.125,bands);assert.deepEqual(bands,saved);
});
test('missing/legacy bands and invalid clocks hide; hostile amplitudes clamp to finite display values',()=>{
 const out=new Float32Array(24);
 for(const [source,rate,hop,time]of [[[],4,1,0],[frames,0,1,0],[frames,4,0,0],[frames,4,1,-1],[frames,4,1,NaN],[frames,4,1,1],[frames,Infinity,1,0],[[{}],4,1,0]]){
  out.fill(1);assert.equal(sampleMusicSpectrum(source,rate,hop,time,out),false);assert.ok(out.every(v=>v===0));
 }
 const values=Array(24).fill(.5);values.splice(0,5,NaN,Infinity,-4,2,'0.5');
 assert.equal(sampleMusicSpectrum([{perceptualSpectrum:values}],4,1,0,out),true);assert.deepEqual([...out.slice(0,5)],[0,0,0,1,0]);
});
test('same-time pause/seek/reload and differently partitioned rendering produce identical bars',()=>{
 const a=new WormholeMusicDisplay(),b=new WormholeMusicDisplay();a.setSettings(enabled);b.setSettings({...enabled});
 for(const t of [0,.125,.7,.2,.125])a.draw(recorder(),frames,4,1,t,{x:.2,y:-.1});
 const r=recorder();b.draw(r,structuredClone(frames),4,1,.125,{x:.2,y:-.1});assert.deepEqual(a.lines,b.lines);
 const again=recorder();a.draw(again,frames,4,1,.125,{x:.2,y:-.1});assert.deepEqual(again.lines,r.lines);assert.deepEqual(again.strokes,r.strokes);
});
test('bounded spectrum geometry leaves its central disk and a 90-degree lower corridor clear at every size',()=>{
 const out=new Float32Array(96),bands=new Float32Array(24);
 for(const size of [0,.5,1])for(const energy of [0,.2,1]){
  bands.fill(energy);projectMusicSpectrum(bands,size,out);assert.ok(out.every(Number.isFinite));
  for(let i=0;i<24;i++){const o=i*4,x=out[o+2],y=out[o+3];
   near(Math.hypot(out[o],out[o+1]),.045+.035*size);assert.ok(Math.hypot(x,y)<=.116001);
   assert.ok(!(y>0&&Math.abs(x)<y),'no bar in the lower 90-degree opening');
  }
 }
});
test('Off, zero opacity, silence and absent data add no raster primitive; enabling does not allocate new buffers',()=>{
 const display=new WormholeMusicDisplay(),r=recorder(),bands=display.bands,lines=display.lines;
 display.draw(r,frames,4,1,.125,{x:0,y:0});assert.equal(r.lines.length,0);
 display.setSettings({...enabled,opacity:0});display.draw(r,frames,4,1,.125,{x:0,y:0});assert.equal(r.lines.length,0);
 display.setSettings(enabled);display.draw(r,frames,4,1,.125,{x:0,y:0});assert.equal(r.lines.length,24);
 assert.equal(display.bands,bands);assert.equal(display.lines,lines);assert.ok(r.weight>=1.5);
 for(const data of [[],[{perceptualSpectrum:Array(24).fill(0)}]]){const r=recorder();display.draw(r,data,4,1,0,{x:0,y:0});assert.equal(r.lines.length,0)}
});
test('native GPU centers, radial endpoints and opacity match the shared raster projection at the displayed time',()=>{
 const native=new XrMusicDisplay(),raster=new WormholeMusicDisplay(),r=recorder(),focus={x:.2,y:-.1};raster.setSettings(enabled);
 raster.draw(r,frames,4,1,.125,focus);native.update(frames,4,1,.125,focus,40,1.65,enabled);
 assert.deepEqual([...native.bands],[...raster.bands]);const p=native.mesh.geometry.getAttribute('position'),c=native.mesh.geometry.getAttribute('color');
 for(let i=0;i<24;i++){const v=i*4,o=i*4;near((p.getX(v)+p.getX(v+1))/2,raster.lines[o]);near(-(p.getY(v)+p.getY(v+1))/2,raster.lines[o+1]);
  near((p.getX(v+2)+p.getX(v+3))/2,raster.lines[o+2]);near(-(p.getY(v+2)+p.getY(v+3))/2,raster.lines[o+3]);
  near(native.mesh.material.opacity*c.getW(v),r.strokes[i][3]/255);
 }
 near(native.mesh.position.x,10.6);near(native.mesh.position.y,-1.35);assert.equal(native.mesh.position.z,-40);
 assert.equal(p.count,96);assert.equal(native.mesh.geometry.index.count,144);assert.equal(native.mesh.material.depthWrite,false);assert.equal(native.mesh.material.forceSinglePass,true);
 native.dispose();
});
test('native unchanged frames/opacity/pose do not upload geometry; seek and distance preserve the normalized diagram',()=>{
 const d=new XrMusicDisplay(),focus={x:0,y:0};d.update(frames,4,1,.125,focus,40,1.65,enabled);
 const p=d.mesh.geometry.getAttribute('position'),version=p.version,first=p.array.slice();
 for(let i=0;i<100;i++)d.update(frames,4,1,.125,focus,500,1.95,{...enabled,opacity:.25});
 assert.equal(p.version,version);assert.equal(d.mesh.material.opacity,.25);near(d.mesh.scale.x,750);
 d.update(frames,4,1,.7,focus,40,1.65,enabled);d.update(frames,4,1,.125,focus,40,1.65,enabled);assert.deepEqual(p.array,first);
 let disposed=0;for(const r of[d.mesh.geometry,d.mesh.material])r.addEventListener('dispose',()=>disposed++);d.dispose();assert.equal(disposed,2);
});
test('native missing data remains hidden on repeated updates rather than exposing stale bars',()=>{
 const d=new XrMusicDisplay();for(let i=0;i<3;i++){d.update([],4,1,0,{x:0,y:0},40,1.65,enabled);assert.equal(d.mesh.visible,false)}d.dispose();
});
test('normalization is safe and all three XR controls persist/copy with presentation scope',()=>{
 assert.deepEqual(plain(normalizeMusicDisplay({mode:'other',size:Infinity,opacity:-5})),{mode:'off',size:.5,opacity:0});
 const {XR_SETTINGS,DEFAULT_XR_SETTINGS,changeScope}=load('xr/XrSettings.ts'),{settingsReport}=load('xr/XrMenuModel.ts');
 assert.equal(DEFAULT_XR_SETTINGS.appearance.musicDisplay,undefined);let settings=DEFAULT_XR_SETTINGS;
 for(const [id,value]of[['musicDisplay','spectrum'],['musicDisplaySize',75],['musicDisplayOpacity',25]]){
  const d=XR_SETTINGS.find(d=>d.id===id);assert.equal(d.section,'cosmos');assert.equal(d.scope,'presentation');settings=d.write(settings,value);
 }
 assert.equal(changeScope(DEFAULT_XR_SETTINGS,settings),'presentation');assert.equal(settings.generation,DEFAULT_XR_SETTINGS.generation);
 let raw;const store=load('xr/XrSettingsStore.ts').createXrSettingsStore({getItem:()=>raw??null,setItem:(_k,v)=>{raw=v}});store.save(settings);
 assert.equal(JSON.stringify(store.load()),JSON.stringify(settings));assert.match(settingsReport(settings),/Music display: Spectrum/);
 assert.deepEqual(JSON.parse(settingsReport(settings).split('JSON: ')[1]).appearance.musicDisplay,{mode:'spectrum',size:.75,opacity:.25});
});
test('MVP/Studio control remembers the shared preference and includes it in the existing Copy action',async()=>{
 const doc=fakeDocument(),saved=new Map(),copies=[];
 const l=createLoader({'./previewQualityControl.css':{}},{document:doc,window:{localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}},navigator:{clipboard:{writeText:async v=>copies.push(JSON.parse(v))}}});
 const {createPreviewQualityControl}=l('ui/PreviewQualityControl.ts'),control=createPreviewQualityControl(false,true);
 const mode=findAll(control.root,e=>e.attributes?.['aria-label']==='Music display')[0];mode.value='spectrum';mode.dispatchEvent(new Event('change'));
 const size=findAll(control.root,e=>e.attributes?.['aria-label']==='Spectrum size')[0];size.value='75';size.dispatchEvent(new Event('input'));
 const button=findAll(control.root,e=>e.textContent==='Copy preview settings')[0];button.dispatchEvent(new Event('click'));await new Promise(setImmediate);
 assert.deepEqual(copies[0].musicDisplay,{mode:'spectrum',size:.75,opacity:.5});assert.equal(control.preference.wormholeRenderer,'offscreen');
 assert.deepEqual(plain(createPreviewQualityControl(false).preference.musicDisplay),copies[0].musicDisplay);
});
test('unavailable/corrupt viewer storage leaves controls functional with an Off default',()=>{
 const doc=fakeDocument(),l=createLoader({'./previewQualityControl.css':{}},{document:doc,window:{localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}}});
 assert.deepEqual(plain(l('ui/PreviewQualityControl.ts').createPreviewQualityControl(false).preference.musicDisplay),plain(DEFAULT_MUSIC_DISPLAY));
});
test('spectrum projection has no DSP, history, runtime random source or environmental dependency',()=>{
 const source=readFileSync('src/presentation/MusicSpectrum.ts','utf8');
 assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|document\.|window\.|\bfft\s*\(|history\.push/);
 assert.doesNotMatch(readFileSync('src/visuals/WormholeMusicDisplay.ts','utf8'),/from ['"].*(?:state|audio|analyzer|xr)\//);
});
test('live XR display changes retain playback, chart, scoring and the prepared plan',async()=>{
 const h=harness();await h.loadTrack();h.engine.play(10);const chart=h.chart(),stops=h.engine.stops.length,plans=h.prepareCalls.length;
 for(const mode of['spectrum','off']){h.pick(mode,'cosmos','musicDisplay');assert.equal(h.chart(),chart);assert.equal(h.engine.stops.length,stops);assert.equal(h.prepareCalls.length,plans);assert.equal(h.controller.session.getState(),'playing')}
 h.controller.dispose();
});
test('embedded display updates request redraw without snapping tuning, and survive exact rewind/reprepare',()=>{
 const seen=[];class Identity{constructor(state){this.state=state}setMusicDisplay(s){seen.push(plain(s))}}
 const l=createLoader({'./CosmicWormholeIdentity':{CosmicWormholeIdentity:Identity}});
 const {cloneDefaultVisualTuning}=l('config/visualTuning.ts'),{defaultAdvancedBoosts}=l('config/metaTuningBoost.ts');
 const {WormholeFrameContext}=l('visuals/WormholeFrameContext.ts');
 const c=new WormholeFrameContext({version:1,rawTuning:cloneDefaultVisualTuning(),macros:{intensity:.5,motion:.5,depth:.5,detail:.5},boosts:defaultAdvancedBoosts(),policy:{gains:'meta',semanticResolver:false,semanticChoreography:false}});
 const before=JSON.stringify(c.state.visualTuning),changed=c.setPresentation({musicDisplay:enabled});
 assert.deepEqual(plain(changed),{tuningChanged:false,directionChanged:false,displayChanged:true});assert.equal(JSON.stringify(c.state.visualTuning),before);
 c.rewind();assert.deepEqual(seen.at(-1),enabled);c.dispose();
});
test('MVP worker carries only display preferences, keeps analysis preparation once, and clears Off explicitly by omission',()=>{
 const messages=[],port={onmessage:null,onerror:null,onmessageerror:null,postMessage:m=>messages.push(structuredClone(m)),terminate(){}};
 const l=createLoader({'./wormholeHostRender.worker.ts?worker':{}},{setTimeout:()=>1,clearTimeout(){}});
 const {State}=l('state/store.ts'),{WormholeHostWorkerSource}=l('visuals/WormholeHostWorkerSource.ts');
 const source=new WormholeHostWorkerSource(()=>{},()=>port),target={width:1060,height:600,rasterPixelRatio:1,compactMaterialPreview:true,frameCount:1,presentRaster(){},background(){}};
 source.draw(State,target,0,false,false,enabled);port.onmessage({data:{type:'ready',generation:messages[0].generation}});
 source.draw(State,target,0,false,false,enabled);const on=messages.at(-1);assert.deepEqual(on.frame.musicDisplay,enabled);assert.equal('analysis'in on.frame,false);
 port.onmessage({data:{type:'frame',generation:on.generation,serial:on.serial,bitmap:{close(){}},raster:'webgl',renderMs:1}});
 source.draw(State,target,0,false,false);assert.equal('musicDisplay'in messages.at(-1).frame,false);assert.equal(messages.filter(m=>m.type==='prepare').length,1);source.dispose();
});
