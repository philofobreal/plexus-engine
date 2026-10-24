import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createLoader } from './helpers/xr-loader.mjs';

function setup() {
    let clock=0;
    const forbidden=()=>{throw Error('native source allocated a browser raster/worker resource');};
    const load=createLoader({}, { performance:{now:()=>clock}, document:{createElement:forbidden},
        OffscreenCanvas:class{constructor(){forbidden();}},Worker:class{constructor(){forbidden();}},
        fetch:async()=>({ok:true,json:async()=>({visualTuning:{wormholeSpiral:.8,wormholeSpiralDirection:-1,wormholePathBend:.6,wormholeGrainDensity:.5}})}) });
    const raw=load('config/visualTuning.ts').cloneDefaultVisualTuning();Object.assign(raw,{wormholeNebulaAmount:.5,wormholeSpiral:.8,wormholeGrainDensity:1});
    const seed={version:1,rawTuning:raw,macros:{intensity:.5,motion:.5,depth:.5,detail:.5},boosts:{},policy:{gains:'raw',semanticResolver:false,semanticChoreography:false}};
    const Source=load('visuals/WormholeNativeSource.ts').WormholeNativeSource,source=new Source(seed);
    return{load,source,clock:t=>{clock=t*1000;}};
}
const analysis=load=>({frames:[],events:[],sampleRate:44100,hopSize:1024,bpm:128,duration:10,
    trackAnalysis:load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis(),performancePlan:{version:1,source:'edited',points:[]}});
test('native source uses the real identity without DOM, Canvas, OffscreenCanvas or Worker allocation',async()=>{
    const h=setup();await h.source.prepare(analysis(h.load));assert.equal(h.source.frame,null);
    assert.equal(h.source.render(2,false),true);const f=h.source.frame;
    assert.equal(f.version,1);assert.equal(f.songTime,2);assert.ok(f.count>0&&f.count<=1440);assert.equal(f.data.length,1440*16);
    assert.equal(h.source.canvas,undefined);assert.equal(h.source.spatialFrame.time,2);
    const ids=new Set();for(let i=0;i<f.count;i++){const o=i*16;ids.add(f.data[o]);assert.ok(f.data[o+3]<0);for(let c=0;c<16;c++)assert.ok(Number.isFinite(f.data[o+c]));}
    assert.equal(ids.size,f.count);const data=f.data;assert.equal(h.source.render(2,false),false);
    h.source.setPresentation({spiralDirection:'left'});assert.equal(h.source.render(2,false),true);assert.ok(h.source.spatialFrame.spiralTurns<0);
    assert.equal(h.source.frame.data,data,'one fixed spatial buffer');h.source.setPresentation({spiralDirection:'right'});h.source.render(2,false);assert.ok(h.source.spatialFrame.spiralTurns>0);
    h.source.dispose();assert.equal(h.source.frame,null);assert.equal(h.source.render(3,true),false);
});
test('native coordinates are captured before perspective division while legacy projection stays unchanged',()=>{
    const load=createLoader(),{projectWormholeTubePoint}=load('visuals/WormholeGrainField.ts');
    const route={positionX:0,positionY:0,normalX:1,normalY:0,tangentX:0,tangentY:1},point={x:0,y:0,z:0};
    const plain=projectWormholeTubePoint(route,route,200,Math.PI/2,50,4,480,270,648,0);
    const captured=projectWormholeTubePoint(route,route,200,Math.PI/2,50,4,480,270,648,0,point);
    assert.deepEqual(captured,plain);assert.ok(Math.abs(point.x)<1e-12);assert.equal(point.y,50);assert.equal(point.z,136);
    assert.equal(captured.screenY,270+50/136*648);assert.deepEqual(Object.keys(captured).sort(),['screenX','screenY']);
});
test('native menu choice normalizes legacy settings and persists/copies through the existing settings contract',()=>{
    const load=createLoader();const {DEFAULT_XR_SETTINGS,normalizeXrSettings,XR_SETTINGS,changeScope}=load('xr/XrSettings.ts');
    const descriptor=XR_SETTINGS.find(d=>d.id==='presentationMode');assert.ok(descriptor);assert.equal(descriptor.section,'system');
    const chosen=descriptor.write(DEFAULT_XR_SETTINGS,'native-grains');assert.equal(changeScope(DEFAULT_XR_SETTINGS,chosen),'presentation');
    assert.equal(normalizeXrSettings(JSON.parse(JSON.stringify(chosen))).background.presentationMode,'native-grains');
    assert.equal(normalizeXrSettings({background:{presentationMode:'unknown'}}).background.presentationMode,'hybrid');
    assert.equal(normalizeXrSettings({background:{}}).background.presentationMode,'hybrid');
    const {createXrSettingsStore}=load('xr/XrSettingsStore.ts');const values=new Map(),store=createXrSettingsStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});
    store.save(chosen);assert.equal(store.load().background.presentationMode,'native-grains');
    assert.ok(JSON.stringify(store.load()).includes('native-grains'),'existing Copy settings serializes normalized settings');
    const report=load('xr/XrMenuModel.ts').settingsReport(chosen,'native-smoke');
    assert.match(report,/Wormhole mode: Native grains \(experimental\)/,'actual Copy settings report includes the selected mode');
});
function renderer() {return createLoader({'three':THREE})('xr/scene/XrNativeWormhole.ts').XrNativeWormhole;}
function packet(records){const data=new Float32Array(records.length*16);records.forEach((r,i)=>data.set([i,...r,0,0,0,0],i*16));return{version:1,generation:1,serial:1,songTime:0,count:records.length,data};}
const record=(x,y,z)=>[x,y,z,x,y,z-1,.02,1,.5,.2,.5];
test('native renderer uses bounded instancing, metre geometry, depth tests and gameplay/near clearance',()=>{
    const Native=renderer(),source={dispose(){this.disposed=true;}},native=new Native(source);
    const frame=packet([record(4,0,-10),record(0,0,-1),record(4,0,-.1),record(4,0,-250)]);
    native.setFrame(frame);assert.equal(native.mesh.geometry.instanceCount,1);
    assert.equal(native.mesh.material.depthTest,true);assert.equal(native.mesh.material.depthWrite,false);
    assert.equal(native.mesh.material.map,undefined);assert.equal(native.mesh.geometry.getIndex().count,6);
    const head=native.mesh.geometry.getAttribute('aHead');assert.equal(head.array.length,1440*4);assert.equal(head.getX(0),4);assert.equal(head.getZ(0),-10);
    native.setDistance(500);native.setFrame(frame);assert.equal(native.mesh.geometry.instanceCount,2);
    native.setQualityBudget(1);native.setFrame(frame);assert.equal(native.mesh.geometry.instanceCount,1);
    const crossing=packet([[4,0,-8,0,0,-8,.08,1,1,1,.5]]);native.setFrame(crossing);
    assert.equal(native.mesh.geometry.getAttribute('aTail').getX(0),4,'a near trail crossing the protected corridor collapses to its safe head');
    let geometryDisposed=0,materialDisposed=0;native.mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);native.mesh.material.addEventListener('dispose',()=>materialDisposed++);
    native.dispose();native.dispose();assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(source.disposed,true);
    const shader=native.mesh.material.vertexShader;assert.match(shader,/modelViewMatrix/);assert.match(shader,/projectionMatrix/);
});
test('native source and XR consumer keep shared data and Three ownership separate',()=>{
    const source=readFileSync('src/visuals/WormholeNativeSource.ts','utf8');assert.doesNotMatch(source,/from ['"].*(?:\/xr\/|\/ui\/|\/audio\/|\/state\/|three)/);
    const consumer=readFileSync('src/xr/scene/XrNativeWormhole.ts','utf8');assert.doesNotMatch(consumer,/from ['"].*\/visuals\//);
    assert.doesNotMatch(consumer,/CanvasTexture|WebGLRenderTarget|new Worker|new OffscreenCanvas/);
});

function sceneHarness(nativeFailure=''){
    const context={clearRect(){},fillRect(){},fillText(){},measureText:()=>({width:0})};
    const load=createLoader({three:THREE},{document:{createElement:()=>({getContext:()=>context})}});
    const natives=[],canvases=[];
    const canvasFactory=options=>{const s={canvas:{width:options.width,height:options.height},async prepare(){},render(){return true;},setPresentation(){},dispose(){this.disposed=true;}};canvases.push(s);return s;};
    const nativeFactory=()=>{if(nativeFailure==='create')throw Error('unsupported');const s={frame:null,focalPoint:{x:0,y:0},spatialFrame:null,lastRenderMs:0,
        async prepare(){if(typeof nativeFailure==='function')await nativeFailure();if(nativeFailure==='prepare')throw Error('native failure');},render(){return false;},setPresentation(){},dispose(){this.disposed=true;}};natives.push(s);return s;};
    const scene=new(load('xr/scene/RhythmGameScene.ts').RhythmGameScene)(new THREE.Scene(),undefined,canvasFactory,nativeFactory);
    const defaults=load('xr/XrBackgroundSettings.ts').DEFAULT_XR_BACKGROUND_SETTINGS;
    return{scene,natives,canvases,defaults};
}
test('starting native avoids the raster factory, switching Hybrid restores it and disposes native resources',async()=>{
    const h=sceneHarness();await h.scene.setBackgroundSettings({...h.defaults,presentationMode:'native-grains'});await h.scene.setWormholeEnabled(true);
    assert.equal(h.canvases.length,0);assert.equal(h.natives.length,1);assert.equal(h.scene.nativeWormholeActive,true);
    await h.scene.setBackgroundSettings({...h.defaults,presentationMode:'hybrid'});assert.equal(h.natives[0].disposed,true);assert.equal(h.canvases.length,1);
    await h.scene.setBackgroundSettings({...h.defaults,presentationMode:'native-grains'});assert.equal(h.canvases[0].disposed,true);assert.equal(h.natives.length,2);
    await h.scene.setWormholeEnabled(false);assert.equal(h.scene.root.getObjectByName('wormhole-native-grains').visible,false);
    await h.scene.setWormholeEnabled(true);assert.equal(h.natives.length,2,'off/on reuses idle geometry');h.scene.dispose();assert.equal(h.natives[1].disposed,true);
});
test('unsupported or failing native creation/preparation falls back to the retained Hybrid source',async()=>{
    for(const failure of ['create','prepare']){const h=sceneHarness(failure);await h.scene.setBackgroundSettings({...h.defaults,presentationMode:'native-grains'});
        await h.scene.setWormholeEnabled(true);assert.equal(h.scene.nativeWormholeActive,false);assert.equal(h.canvases.length,1);
        assert.match(h.scene.backgroundRasterLabel,/Hybrid.*unavailable/);if(h.natives[0])assert.equal(h.natives[0].disposed,true);h.scene.dispose();}
});
test('native source ignores stale preset publication after a newer prepare and remains bounded after seeks',async()=>{
    const pending=[];let now=0;const load=createLoader({}, {performance:{now:()=>now},fetch:()=>new Promise(resolve=>pending.push(resolve))});
    const source=new(load('visuals/WormholeNativeSource.ts').WormholeNativeSource)();const old=analysis(load);old.performancePlan.points=[{id:'old',time:0,preset:'old.json'}];
    const preparing=source.prepare(old);await source.prepare(null);pending[0]({ok:true,json:async()=>({visualTuning:{wormholeSpiral:5}})});await preparing;
    source.render(1,false);assert.equal(source.frame.generation,2);
    const buffer=source.frame.data;for(const time of [4,.2,3,.2]){now+=100;source.render(time,false);assert.equal(source.frame.data,buffer);assert.ok(source.frame.count<=1440);}
    source.dispose();
});

test('late native preparation failure respects a newer Off choice and cannot recreate a disposed scene',async()=>{
 for(const action of ['off','dispose']){let reject;const h=sceneHarness(()=>new Promise((resolve,fail)=>{reject=fail;}));
  await h.scene.setBackgroundSettings({...h.defaults,presentationMode:'native-grains'});const pending=h.scene.setWormholeEnabled(true);
  if(action==='off')await h.scene.setWormholeEnabled(false);else h.scene.dispose();
  reject(Error('delayed failure'));await pending;assert.equal(h.canvases.length,0,action);assert.equal(h.natives[0].disposed,true);
  await h.scene.setWormholeEnabled(true);assert.equal(h.canvases.length,action==='off'?1:0,action);h.scene.dispose();
 }
});
