import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

async function sourceFixture(amount=1,detail=.8,bloom=.7){
    let clock=0;const forbidden=()=>{throw Error('Native material allocated a browser raster/worker');};
    const load=createLoader({}, {performance:{now:()=>clock},document:{createElement:forbidden},
        OffscreenCanvas:class{constructor(){forbidden();}},Worker:class{constructor(){forbidden();}}});
    const raw=load('config/visualTuning.ts').cloneDefaultVisualTuning();
    Object.assign(raw,{wormholeNebulaAmount:amount,wormholeNebulaDetail:detail,wormholeNebulaBloom:bloom,wormholeNebulaWeave:1,wormholeSpiral:.8,wormholeGrainDensity:1});
    const source=new(load('visuals/WormholeNativeSource.ts').WormholeNativeSource)({version:1,rawTuning:raw,
        macros:{intensity:.5,motion:.5,depth:.5,detail:.5},boosts:{},policy:{gains:'raw',semanticResolver:false,semanticChoreography:false}});
    const analysis={frames:[],events:[],sampleRate:44100,hopSize:1024,bpm:128,duration:10,
        trackAnalysis:load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis(),performancePlan:{version:1,source:'edited',points:[]}};
    const before=JSON.stringify(analysis);await source.prepare(analysis);source.render(2.125,false);assert.equal(JSON.stringify(analysis),before);
    return {source,advance:t=>{clock+=100;source.render(t,false);}};
}
test('native material carries authored settings and original release phase/energy in aligned fixed metadata',async()=>{
    const h=await sourceFixture(),f=h.source.frame,m=f.material;
    assert.equal(m.amount,1);assert.equal(m.detail,.8);assert.equal(m.bloom,.7);
    assert.equal(m.grains.length,1440*3);assert.equal(m.weave.length,4320*3);assert.ok(f.weave.count>0);
    for(const [data,count,segments]of[[m.grains,f.count,f.data],[m.weave,f.weave.count,f.weave.data]])for(let i=0;i<count;i++){
        assert.ok(Number.isFinite(data[i*3]));assert.ok(data[i*3+1]>=0&&data[i*3+1]<=1);assert.ok(data[i*3+2]>=0&&data[i*3+2]<=1);
        assert.equal(segments[i*16+15],0,'reserved geometry offset stays zero');
    }
    const grains=m.grains,weave=m.weave;for(const t of [5,.3,2.125]){h.advance(t);assert.equal(h.source.frame.material.grains,grains);assert.equal(h.source.frame.material.weave,weave);}
    const off=await sourceFixture(0);assert.equal(off.source.frame.material.amount,0);assert.equal(off.source.frame.weave.count,0);off.source.dispose();h.source.dispose();assert.equal(h.source.frame,null);
});
test('material extent follows depth/detail/bloom with exact zero bypass and strict metre bounds',()=>{
    const {nativeMaterialShape}=createLoader({three:THREE})('xr/scene/NativeWormholeMaterial.ts'),shape={core:0,halo:0,support:0};
    nativeMaterialShape(.02,.1,0,1,1,1,1,shape);assert.deepEqual(shape,{core:.02,halo:.02,support:.02});
    for(const depth of[0,.25,.5,.75,1])for(const detail of[0,.5,1])for(const bloom of[0,.5,1]){
        nativeMaterialShape(.08,depth,1,detail,bloom,1,1,shape);assert.ok(shape.core>0&&shape.core<=.1);assert.ok(shape.halo>=shape.core&&shape.halo<=.24);assert.ok(shape.support>=shape.halo&&shape.support<=.6);
        if(bloom===0)assert.equal(shape.support,shape.halo);
    }
    nativeMaterialShape(.02,.1,1,0,0,.8,.8,shape);const low=shape.support;
    nativeMaterialShape(.02,.1,1,1,0,.8,.8,shape);assert.ok(shape.support>low);const noBloom=shape.support;
    nativeMaterialShape(.02,.1,1,1,1,.8,.8,shape);assert.ok(shape.support>noBloom);
    const near=shape.support;nativeMaterialShape(.02,.9,1,1,1,.8,.8,shape);assert.ok(shape.support<near);
});
const record=(x,z)=>[x,0,z,x,0,z-.2,.02,1,.5,.2,.5];
function packet(records=[record(4,-10)]){const data=new Float32Array(records.length*16);records.forEach((r,i)=>data.set([i,...r,1,12,.2,0],i*16));return{version:1,generation:1,serial:1,songTime:0,count:records.length,data};}
function renderer(){return createLoader({three:THREE})('xr/scene/XrNativeWormhole.ts').XrNativeWormhole;}
test('material metadata stays aligned after culling and predecessor packets reset the shader to zero',()=>{
    const Native=renderer(),native=new Native({dispose(){}}),frame=packet([record(0,-1),record(4,-10)]);
    frame.material={amount:.7,detail:.8,bloom:.9,grains:new Float32Array([.1,.2,.3,4.2,.8,.6]),weave:new Float32Array(0)};
    native.setFrame(frame);assert.equal(native.mesh.geometry.instanceCount,1);
    const surface=native.mesh.geometry.getAttribute('aSurface');assert.ok(Math.abs(surface.getX(0)-4.2)<1e-5);assert.ok(Math.abs(surface.getY(0)-.8)<1e-5);
    assert.equal(native.mesh.material.uniforms.uAmount.value,.7);assert.equal(native.mesh.material.uniforms.uBloom.value,.9);
    assert.equal(native.mesh.geometry.getAttribute('aRadii').count,1440);assert.equal(native.weaveMesh.geometry.getAttribute('aRadii').count,4320);
    const radius=native.mesh.geometry.getAttribute('aRadii').getW(0);assert.ok(radius<=.6);
    native.setFrame(packet());assert.equal(native.mesh.material.uniforms.uAmount.value,0);assert.equal(native.weaveMesh.material.uniforms.uAmount.value,0);
    for(const material of[{...frame.material,amount:NaN},{...frame.material,bloom:2},{...frame.material,grains:new Float32Array(0)}])assert.throws(()=>native.setFrame({...frame,material}),/Invalid.*material/);
    native.setFrame({...packet(),count:0});assert.equal(native.mesh.geometry.instanceCount,0);native.dispose();
});
test('material uses actual eye viewport and quality fill cap, stays behind stage and disposes both batches',()=>{
    const Native=renderer(),native=new Native({dispose(){}});native.setQualityBudget(360);
    for(const mesh of[native.mesh,native.weaveMesh]){
        mesh.onBeforeRender({getCurrentViewport:out=>out.set(0,0,1024,768)});
        assert.equal(mesh.material.uniforms.uViewportHeight.value,768);assert.equal(mesh.material.uniforms.uPixelLimit.value,12);
        assert.equal(mesh.material.uniforms.uViewportWidth.value,1024);
        assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.depthWrite,false);assert.ok(mesh.renderOrder<-10);
    }
    native.setQualityBudget(1440);assert.equal(native.mesh.material.uniforms.uPixelLimit.value,18);
    let disposed=0;for(const mesh of[native.mesh,native.weaveMesh]){mesh.geometry.addEventListener('dispose',()=>disposed++);mesh.material.addEventListener('dispose',()=>disposed++);}
    native.dispose();native.dispose();assert.equal(disposed,4);
});
test('existing material controls retain menu normalization, storage and Copy with native selected',()=>{
    const load=createLoader(),{DEFAULT_XR_SETTINGS,XR_SETTINGS}=load('xr/XrSettings.ts');let settings=XR_SETTINGS.find(d=>d.id==='presentationMode').write(DEFAULT_XR_SETTINGS,'native-grains');
    for(const [id,value]of[['grainAmount',70],['grainDetail',30],['grainBloom',60]])settings=XR_SETTINGS.find(d=>d.id===id).write(settings,value);
    const values=new Map(),store=load('xr/XrSettingsStore.ts').createXrSettingsStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});store.save(settings);
    assert.deepEqual(JSON.parse(JSON.stringify(store.load())),JSON.parse(JSON.stringify(settings)));const report=load('xr/XrMenuModel.ts').settingsReport(store.load(),'native-material');
    assert.match(report,/Grain material: 70/);assert.match(report,/Material detail: 30/);assert.match(report,/Material bloom: 60/);assert.match(report,/Native grains/);
});
