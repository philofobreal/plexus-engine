import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
const drain=()=>new Promise(resolve=>setImmediate(resolve));
function fakeSource(){
    let shown=false;const data=new Float32Array(16),frame={version:1,generation:1,serial:0,songTime:0,count:1,data};
    return {get frame(){return shown?frame:null;},focalPoint:{x:0,y:0},spatialFrame:null,lastRenderMs:7,presentations:[],prepares:[],disposed:0,
        async prepare(a){shown=false;this.prepares.push(a);},setPresentation(p){this.presentations.push(structuredClone(p));},
        render(t,playing,continuous){shown=true;this.continuous=continuous;frame.songTime=t;frame.serial++;data.set([t,4,0,-10,4,0,-10.5,.02,1,.5,.2,.5,1,12,.2,0]);this.focalPoint={x:t,y:-t};this.spatialFrame={time:t,travel:t};return true;},
        dispose(){this.disposed++;}};
}
function harness({manual=false,real=false,mainFactory,workerFactory,timeout=5000}={}){
    let clock=0;const workers=[],workerSources=[],locals=[];
    const load=createLoader({'./createWormholeNativeWorker':{createWormholeNativeWorker:()=>{throw Error('No worker capability');}},three:THREE},
        {performance:{now:()=>clock},setTimeout,clearTimeout,ArrayBuffer,Float32Array,console,
            fetch:async()=>({ok:true,json:async()=>({visualTuning:{wormholeNebulaAmount:.4,wormholeNebulaWeave:.6}})})});
    const {createNativeWorkerHost}=load('visuals/WormholeNativeWorkerHost.ts');
    class Bridge {
        constructor(){this.onmessage=null;this.onerror=null;this.onmessageerror=null;this.posts=[];this.responses=[];this.terminated=0;this.transfers=0;
            this.host=createNativeWorkerHost((message,transfer=[])=>{
                const copied=structuredClone(message,{transfer});if(transfer.length){assert.equal(transfer[0].byteLength,0);this.transfers++;}
                if(manual)this.responses.push(copied);else queueMicrotask(()=>this.onmessage?.({data:copied}));
            },seed=>{const s=real?new(load('visuals/WormholeNativeSource.ts').WormholeNativeSource)(seed):fakeSource();workerSources.push(s);return s;});workers.push(this);
        }
        postMessage(message,transfer=[]){const copied=structuredClone(message,{transfer});this.posts.push({type:message.type,time:message.songTime,requestId:message.requestId,revision:message.revision,epoch:message.epoch});
            if(transfer.length)assert.equal(transfer[0].byteLength,0);queueMicrotask(()=>{if(!this.terminated)void this.host.receive(copied);});}
        deliver(){const m=this.responses.shift();assert.ok(m,'expected a worker response');this.onmessage?.({data:m});return m;}
        terminate(){this.terminated++;this.host.dispose();}
    }
    const options={workerFactory:workerFactory??(()=>new Bridge()),mainFactory:mainFactory??(()=>{const s=fakeSource();locals.push(s);return s;}),prepareTimeoutMs:timeout,renderTimeoutMs:timeout};
    const Proxy=load('visuals/WormholeNativeWorkerSource.ts').WormholeNativeWorkerSource;
    const source=new Proxy(options);
    return {source,load,options,Proxy,workers,workerSources,locals,clock:t=>{clock=t*1000;},
        async prepare(a=null){const p=source.prepare(a);await drain();if(manual)workers.at(-1).deliver();await p;}};
}
test('native worker clones analysis, transfers one reusable buffer, and adopts companions only with the displayed bank',async()=>{
    const h=harness(),analysis={frames:[{perceptualSpectrum:new Float32Array([.2,.4])}],events:[]},before=JSON.stringify(analysis);
    await h.prepare(analysis);assert.match(h.source.executionLabel,/worker geometry/);assert.equal(h.locals.length,0);
    assert.equal(analysis.frames[0].perceptualSpectrum.byteLength,8);assert.equal(JSON.stringify(analysis),before);
    h.source.render(1,false);await drain();assert.equal(h.source.frame,null);assert.equal(h.source.focalPoint.x,0);
    assert.equal(h.source.render(1,false),true);const first=h.source.frame,bytes=first.data.buffer,original=Array.from(first.data.slice(0,16));
    assert.equal(h.source.focalPoint.x,1);assert.equal(h.source.spatialFrame.time,1);assert.equal(h.source.lastRenderMs,7);
    h.source.render(2,false);await drain();assert.equal(h.source.frame,first);assert.deepEqual(Array.from(first.data.slice(0,16)),original);assert.equal(h.source.focalPoint.x,1);
    h.source.render(2,false);assert.notEqual(h.source.frame.data.buffer,bytes);assert.equal(bytes.byteLength,437760);assert.equal(h.source.focalPoint.x,2);
    h.source.render(3,false);await drain();h.source.render(3,false);assert.equal(h.source.frame.data.buffer,bytes,'two host banks alternate');
    assert.equal(h.workers[0].transfers,3);assert.equal(h.workers[0].posts.filter(p=>p.type==='release').length,3);
    h.source.dispose();h.source.dispose();assert.equal(h.workers[0].terminated,1);assert.equal(h.workerSources[0].disposed,1);assert.equal(h.source.frame,null);
});
test('backpressure retains only the latest next song time and host continuity survives worker latency',async()=>{
    const h=harness({manual:true});await h.prepare();h.clock(0);h.source.render(1,true);h.clock(.02);h.source.render(1.02,true);h.clock(.04);h.source.render(1.04,true);await drain();
    assert.equal(h.workers[0].posts.filter(p=>p.type==='render').length,1);h.workers[0].deliver();await drain();
    assert.deepEqual(h.workers[0].posts.filter(p=>p.type==='render').map(p=>p.time),[1,1.04]);h.workers[0].deliver();
    h.source.render(1.04,true);assert.equal(h.source.frame.songTime,1.04);assert.equal(h.workerSources[0].continuous,true);
    assert.ok(h.workers[0].posts.findIndex(p=>p.type==='release')<h.workers[0].posts.findLastIndex(p=>p.type==='render'));h.source.dispose();
});
test('seek, pause and settings revisions discard old geometry, merge boosts and wake a paused host',async()=>{
    const h=harness({manual:true});let wakes=0;h.source.onFrameReady=()=>wakes++;await h.prepare();
    h.source.render(3,true);await drain();h.source.render(1,false);h.source.setPresentation({grainMaterial:{wormholeNebulaBloom:.2}});
    h.source.setPresentation({grainMaterial:{wormholeNebulaDetail:.7},spiralDirection:'left'});h.source.render(1,false);
    h.workers[0].deliver();await drain();assert.equal(h.source.frame,null,'stale old-time/settings frame was not adopted');
    h.workers[0].deliver();assert.ok(wakes>=2);h.source.render(1,false);assert.equal(h.source.frame.songTime,1);
    const p=h.workerSources[0].presentations.at(-1);assert.equal(p.spiralDirection,'left');assert.equal(p.grainMaterial.wormholeNebulaBloom,.2);assert.equal(p.grainMaterial.wormholeNebulaDetail,.7);h.source.dispose();
});
test('reprepare settles the superseded preparation, terminates its worker and rejects captured late callbacks',async()=>{
    const h=harness({manual:true});const old=h.source.prepare(null);await drain();const first=h.workers[0],late=first.onmessage;
    const next=h.source.prepare(null);await old;await drain();assert.equal(first.terminated,1);late({data:first.responses[0]});assert.equal(h.source.frame,null);
    h.workers[1].deliver();await next;h.source.render(1,false);await drain();h.workers[1].deliver();h.source.render(1,false);assert.equal(h.source.frame.generation,2);h.source.dispose();
});
test('worker constructor, startup failure and decode errors use a visible native main fallback',async()=>{
    const unavailable=harness({workerFactory:()=>{throw Error('unsupported');}});await unavailable.prepare();assert.equal(unavailable.locals.length,1);assert.match(unavailable.source.executionLabel,/fallback: .*unsupported/);unavailable.source.render(2,false);assert.equal(unavailable.source.frame.songTime,2);unavailable.source.dispose();
    const startup=harness({manual:true}),preparing=startup.source.prepare(null);await drain();startup.workers[0].onmessage({data:{type:'error',version:1,generation:1,message:'prepare failed'}});await preparing;assert.equal(startup.workers[0].terminated,1);assert.equal(startup.locals.length,1);startup.source.dispose();
    for(const kind of['error','decode']){const h=harness();await h.prepare();const w=h.workers[0];if(kind==='error')w.onerror({message:'lost',preventDefault(){}});else w.onmessageerror({});await drain();
        assert.equal(w.terminated,1);assert.equal(h.locals.length,1);assert.match(h.source.executionLabel,/main geometry/);h.source.render(2,false);assert.equal(h.source.frame.songTime,2);h.source.dispose();assert.equal(h.locals[0].disposed,1);}
});
test('startup/render deadlines terminate stalled workers and prepare exactly one fallback',async()=>{
    const h=harness({manual:true,timeout:10});await h.source.prepare(null);assert.equal(h.workers[0].terminated,1);assert.equal(h.locals.length,1);assert.match(h.source.executionLabel,/startup timed out/);h.source.dispose();
    const render=harness({manual:true,timeout:10});await render.prepare();render.source.render(1,true);await new Promise(r=>setTimeout(r,30));
    assert.equal(render.workers[0].terminated,1);assert.equal(render.locals.length,1);assert.match(render.source.executionLabel,/render timed out/);render.source.dispose();
});
test('malformed or mismatched matching responses fail closed without displaying their packet',async()=>{
    for(const corrupt of[m=>m.songTime++,m=>m.count=1441,m=>m.buffer=new ArrayBuffer(4)]){
        const h=harness({manual:true});await h.prepare();h.source.render(1,false);await drain();const message=h.workers[0].responses[0];corrupt(message);h.workers[0].deliver();await drain();
        assert.equal(h.workers[0].terminated,1);assert.equal(h.locals.length,1);assert.equal(h.source.frame,null);h.source.dispose();}
});
test('unknown stale replies cannot clear the active request, and unchanged acknowledgements do not queue duplicate times',async()=>{
    const h=harness({manual:true});await h.prepare();h.workerSources[0].render=()=>false;h.source.render(1,false);await drain();
    const w=h.workers[0],real=w.responses[0];w.onmessage({data:{...real,requestId:999}});h.source.render(1,false);assert.equal(w.posts.filter(p=>p.type==='render').length,1);
    w.deliver();h.source.render(1,false);assert.equal(w.posts.filter(p=>p.type==='render').length,1);assert.equal(h.source.frame,null);h.source.dispose();
});
test('worker host refuses a render while its transfer buffer is leased',async()=>{
    const h=harness(),messages=[],host=h.load('visuals/WormholeNativeWorkerHost.ts').createNativeWorkerHost((m,t=[])=>messages.push(structuredClone(m,{transfer:t})),()=>fakeSource());
    await host.receive({type:'prepare',version:1,generation:1,analysis:null,presentation:{}});
    const request={type:'render',version:1,generation:1,requestId:1,epoch:1,revision:1,songTime:1,playing:false,continuous:false,presentation:{}};
    await host.receive(request);await host.receive({...request,requestId:2});assert.match(messages.at(-1).message,/still leased/);
    const frame=messages.find(m=>m.type==='frame');await host.receive({type:'release',version:1,generation:1,requestId:1,buffer:frame.buffer});
    await host.receive({...request,requestId:3,songTime:2});assert.equal(messages.at(-1).type,'frame');host.dispose();
});
test('actual shared native identity packets match the direct source across paused forward/backward samples',async()=>{
    const h=harness({real:true}),Native=h.load('visuals/WormholeNativeSource.ts').WormholeNativeSource;
    const analysis={frames:[],events:[],sampleRate:44100,hopSize:1024,bpm:128,duration:10,trackAnalysis:h.load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis(),performancePlan:{version:1,source:'edited',points:[]}};
    const direct=new Native();await direct.prepare(analysis);await h.prepare(analysis);
    for(const time of[2.125,3,.4,2.125]){h.source.render(time,false);await drain();h.source.render(time,false);direct.render(time,false,false);
        const a=h.source.frame,b=direct.frame;assert.equal(a.count,b.count);assert.equal(a.weave.count,b.weave.count);
        for(const [x,y,n]of[[a.data,b.data,a.count*16],[a.weave.data,b.weave.data,a.weave.count*16],[a.material.grains,b.material.grains,a.count*3],[a.material.weave,b.material.weave,a.weave.count*3]])assert.deepEqual(Array.from(x.slice(0,n)),Array.from(y.slice(0,n)));
        assert.equal(JSON.stringify(h.source.spatialFrame),JSON.stringify(direct.spatialFrame));}
    assert.equal(h.locals.length,0);h.source.dispose();direct.dispose();
});
test('scene adapter forwards asynchronous wakeups/errors and reports worker location/latency',()=>{
    const load=createLoader({three:THREE}),Native=load('xr/scene/XrNativeWormhole.ts').XrNativeWormhole,source={executionLabel:'worker geometry; no background canvas',frameLatencyMs:12,dispose(){}};
    const native=new Native(source);let wakes=0,error='';native.onFrameReady=()=>wakes++;native.onError=m=>error=m;
    source.onFrameReady();source.onError('unavailable');assert.equal(wakes,1);assert.equal(error,'unavailable');assert.equal(native.frameLatencyMs,12);assert.match(native.executionLabel,/worker geometry/);native.root.visible=false;source.onFrameReady();assert.equal(wakes,1);native.dispose();
});
