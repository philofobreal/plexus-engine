import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

async function sample(weave=1,amount=1) {
    let clock=0;
    const forbidden=()=>{throw Error('Native weave allocated a raster resource');};
    const load=createLoader({}, {performance:{now:()=>clock},document:{createElement:forbidden},
        OffscreenCanvas:class{constructor(){forbidden();}},Worker:class{constructor(){forbidden();}}});
    const raw=load('config/visualTuning.ts').cloneDefaultVisualTuning();
    Object.assign(raw,{wormholeNebulaAmount:amount,wormholeNebulaWeave:weave,wormholeSpiral:.8,wormholeGrainDensity:1});
    const source=new(load('visuals/WormholeNativeSource.ts').WormholeNativeSource)({version:1,rawTuning:raw,
        macros:{intensity:.5,motion:.5,depth:.5,detail:.5},boosts:{},policy:{gains:'raw',semanticResolver:false,semanticChoreography:false}});
    await source.prepare({frames:[],events:[],sampleRate:44100,hopSize:1024,bpm:128,duration:10,
        trackAnalysis:load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis(),performancePlan:{version:1,source:'edited',points:[]}});
    source.render(2.125,false);
    return {source,advance:time=>{clock+=100;source.render(time,false);}};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} vs ${b}`);
test('native weave uses original pool neighbours and metre endpoints without changing grain geometry',async()=>{
    const on=await sample(),off=await sample(0),frame=on.source.frame,w=frame.weave;
    assert.ok(w.count>0&&w.count<=4320);assert.equal(w.data.length,4320*16);assert.equal(off.source.frame.weave.count,0);
    assert.equal(frame.count,off.source.frame.count);
    for(let i=0;i<frame.count;i++)for(let c=0;c<=7;c++)assert.equal(frame.data[i*16+c],off.source.frame.data[i*16+c],`Weave cannot move grain ${i}, coordinate ${c}`);
    const grains=new Map();for(let i=0;i<frame.count;i++)grains.set(frame.data[i*16],i*16);
    let rings=0,arms=0;const ids=new Set();
    for(let i=0;i<w.count;i++){
        const o=i*16,id=w.data[o],a=Math.floor(id/3),part=id%3;assert.ok(!ids.has(id));ids.add(id);
        for(let c=0;c<16;c++)assert.ok(Number.isFinite(w.data[o+c]));
        const ga=grains.get(a);assert.ok(ga!==undefined);
        if(part===0||part===2)for(let c=0;c<3;c++)close(w.data[o+4+c],frame.data[ga+1+c]);
        if(part===2){const copyBase=a-a%360,within=a%360,band=within%24,b=copyBase+within-band+(band+1)%24;
            const gb=grains.get(b);assert.ok(gb!==undefined);for(let c=0;c<3;c++)close(w.data[o+1+c],frame.data[gb+1+c]);rings++;}
        if(part===1){const gb=grains.get(a+24);assert.ok(gb!==undefined);for(let c=0;c<3;c++)close(w.data[o+1+c],frame.data[gb+1+c]);arms++;}
    }
    assert.ok(rings>0&&arms>0);on.source.dispose();off.source.dispose();
});
test('weave geometry is bounded, repeatable after seeks and bypassed by its existing material master',async()=>{
    const h=await sample(),buffer=h.source.frame.weave.data;
    const expected=Array.from(buffer.slice(0,h.source.frame.weave.count*16)),expectedCount=h.source.frame.weave.count;
    h.advance(4);h.advance(2.125);assert.equal(h.source.frame.weave.data,buffer);assert.equal(h.source.frame.weave.count,expectedCount);
    // The live context retains its existing transient brightness history; compare geometry/IDs,
    // not exact-sampler brightness (the separate fixed-song replay contract owns that guarantee).
    for(let i=0;i<expectedCount;i++)for(let c=0;c<=7;c++)assert.equal(buffer[i*16+c],expected[i*16+c],`seek link ${i}, coordinate ${c}`);
    for(const t of [.2,8,1,9]){h.advance(t);assert.ok(h.source.frame.weave.count<=4320);}
    const off=await sample(1,0);assert.equal(off.source.frame.weave.count,0);h.source.dispose();assert.equal(h.source.frame,null);off.source.dispose();
});
function packet(records=[]){const data=new Float32Array(records.length*16);records.forEach((r,i)=>data.set([i,...r,0,0,0,0],i*16));return{version:1,generation:1,serial:1,songTime:0,count:records.length,data};}
const segment=(x,y,z,tx,ty,tz)=>[x,y,z,tx,ty,tz,.02,1,.5,.2,.5];
test('weave instance budget rejects whole unsafe connections and clears absent/stale packets',()=>{
    const Native=createLoader({three:THREE})('xr/scene/XrNativeWormhole.ts').XrNativeWormhole,native=new Native({dispose(){}});
    const frame=packet();frame.weave=packet([segment(4,0,-10,4,1,-10),segment(4,0,-8,-4,0,-8),
        segment(4,0,-10,4,0,-20),segment(4,0,-1,4,0,-.1),segment(4,0,-199,4,0,-201)]);
    native.setFrame(frame);assert.equal(native.weaveMesh.geometry.instanceCount,1);
    native.setQualityBudget(1);frame.weave=packet(Array.from({length:10},()=>segment(4,0,-10,4,1,-10)));
    native.setFrame(frame);assert.equal(native.weaveMesh.geometry.instanceCount,3);assert.equal(native.weaveMesh.geometry.getAttribute('aHead').count,4320);
    native.setFrame(packet());assert.equal(native.weaveMesh.geometry.instanceCount,0,'legacy v1 without weave clears the extension');
    assert.throws(()=>native.setFrame({...packet(),weave:{count:4321,data:new Float32Array(0)}}),/Invalid.*weave/);
    let disposed=0;native.weaveMesh.geometry.addEventListener('dispose',()=>disposed++);native.weaveMesh.material.addEventListener('dispose',()=>disposed++);
    native.dispose();native.dispose();assert.equal(disposed,2);
});
test('native grains and connections alpha blend in the background queue before opaque notes and transparent runway',()=>{
    const Native=createLoader({three:THREE})('xr/scene/XrNativeWormhole.ts').XrNativeWormhole,native=new Native({dispose(){}});
    assert.ok(native.root.renderOrder<-10);
    for(const mesh of [native.mesh,native.weaveMesh]){
        assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.blending,THREE.CustomBlending);
        assert.equal(mesh.material.blendSrc,THREE.SrcAlphaFactor);assert.equal(mesh.material.blendDst,THREE.OneMinusSrcAlphaFactor);
        assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.depthTest,true);assert.ok(mesh.renderOrder<-10);
    }
    native.dispose();
});
