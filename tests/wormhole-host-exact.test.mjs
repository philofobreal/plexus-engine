import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function harness(config = { jobId:'export-a',fps:30,width:3840,height:2160 }) {
    const messages=[],tasks=[],timers=new Map();let stopped=0,created=0,timer=0;
    const port={onmessage:null,onerror:null,onmessageerror:null,
        postMessage(message){messages.push(structuredClone(message));},terminate(){stopped++;}};
    const load=createLoader({'./wormholeHostRender.worker.ts?worker':{}},{
        setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout(id){timers.delete(id);}});
    const {State}=load('state/store.ts');
    const {WormholeHostExactSource}=load('visuals/WormholeHostExactSource.ts');
    const source=new WormholeHostExactSource(()=>{created++;return port;},fn=>tasks.push(fn));
    const {frames,events,trackAnalysis,sampleRate,hopSize,bpm}=State;
    const analysis={frames,events,trackAnalysis,sampleRate,hopSize,bpm};
    const flush=()=>{while(tasks.length)tasks.shift()();};
    const respond=m=>port.onmessage({data:m});
    const prepare=signal=>source.prepare(analysis,config,signal);
    const ready=()=>{const m=messages.at(-1);respond({type:'ready',generation:m.generation,contextId:m.contextId,exact:m.exact});};
    const frame=(index=0)=>({width:config.width,height:config.height,density:1,compact:false,depthCue:.6,transparent:false,
        skybox:false,frameCount:index+1,reset:false,currentTime:index/config.fps,isExporting:true,exportTime:index/config.fps,
        visualTuning:State.visualTuning,targetTuning:State.targetTuning,currentFrame:State.currentFrame,currentFeatures:State.currentFeatures,
        modulation:State.modulation,directorOutput:State.directorOutput,beatDecay:.3,denseImpactFlash:.2,playbackFade:1,
        activeVisualTransitionId:'automation:a',spiralTransitionAnchor:{id:'automation:a',time:0},musicDisplay:{mode:'spectrum',size:.6,opacity:1}});
    const image=()=>({width:config.width,height:config.height,closed:0,close(){this.closed++;}});
    const complete=(request=messages.at(-1),bitmap=image(),overrides={})=>{
        respond({type:'frame',generation:request.generation,serial:request.serial,stamp:request.stamp,bitmap,raster:'gpu-material',renderMs:2,...overrides});return bitmap;};
    return {load,State,source,config,analysis,port,messages,tasks,timers,flush,respond,prepare,ready,frame,image,complete,
        async start(){const p=prepare();flush();ready();await p;},get stopped(){return stopped;},get created(){return created;}};
}

test('exact host configuration admits full-resolution aspects and rejects forged/unsupported contracts',()=>{
    const {assertWormholeHostExactConfig:validate}=harness().load('types/WormholeHostFrame.ts');
    for(const fps of [30,60])for(const [width,height] of [[1280,720],[720,1280],[720,720],[3840,2160],[2160,3840],[2160,2160]])
        validate({jobId:'job',fps,width,height});
    const valid={jobId:'job',fps:30,width:3840,height:2160};
    for(const value of [null,[],{...valid,extra:true},{...valid,jobId:''},{...valid,jobId:'x'.repeat(129)},
        {...valid,fps:24},{...valid,width:3841},{...valid,height:0},{...valid,width:7680,height:4320},
        {...valid,height:Infinity},Object.create(valid)])assert.throws(()=>validate(value));
});

test('exact preparation is deferred, negotiates job/size/fps and projects analysis only once',async()=>{
    const h=harness();h.analysis.trackAnalysis={...h.analysis.trackAnalysis,musicActivity:{unused(){throw Error('unused evidence');}}};
    const p=h.prepare();assert.equal(h.created,0);h.flush();assert.equal(h.created,1);
    const prepared=h.messages[0];assert.equal(prepared.exact.jobId,'export-a');assert.equal(prepared.exact.width,3840);
    assert.equal('musicActivity' in prepared.analysis.trackAnalysis,false);assert.equal(h.analysis.frames,h.State.frames);
    h.ready();await p;
    for(let i=0;i<3;i++){const p=h.source.requestFrame(i,h.frame(i));h.flush();const b=h.complete();const lease=await p;
        assert.equal(lease.bitmap,b);lease.release();}
    assert.equal(h.messages.filter(m=>m.type==='prepare').length,1);
    assert.ok(h.messages.filter(m=>m.type==='render').every(m=>!('analysis' in m)));
    await assert.rejects(h.prepare(),/again/);h.source.dispose();assert.equal(h.stopped,1);assert.equal(h.timers.size,0);
});

for(const fps of [30,60])test('exact '+fps+'fps keeps UHD and captured inputs, with one request or image lease',async()=>{
    const h=harness({jobId:'job-'+fps,fps,width:3840,height:2160});await h.start();
    const input=h.frame(1),original=structuredClone(input);const p=h.source.requestFrame(1,input);
    input.visualTuning.wormholeSpeed=99;input.currentFrame.perceptualSpectrum[0]=99;
    input.modulation.rhythmicImpulse=99;input.spiralTransitionAnchor.time=99;input.musicDisplay.opacity=0;
    assert.equal(h.messages.length,1,'render submission is outside the host draw');
    await assert.rejects(h.source.requestFrame(2,h.frame(2)),/Release/);h.flush();
    const request=h.messages.at(-1);assert.equal(request.frame.density,1);assert.equal(request.frame.compact,false);
    assert.equal(request.frame.visualTuning.wormholeSpeed,original.visualTuning.wormholeSpeed);
    assert.equal(request.frame.currentFrame.perceptualSpectrum[0],original.currentFrame.perceptualSpectrum[0]);
    assert.equal(request.frame.modulation.rhythmicImpulse,original.modulation.rhythmicImpulse);
    assert.equal(request.frame.spiralTransitionAnchor.time,0);assert.equal(request.frame.musicDisplay.opacity,1);
    assert.equal(request.stamp.songTime,1/fps);assert.equal(request.stamp.timestampUs,Math.round(1e6/fps));
    const bitmap=h.complete(),lease=await p;assert.equal(lease.frame.currentTime,1/fps);assert.equal(lease.stamp.jobId,h.config.jobId);
    await assert.rejects(h.source.requestFrame(2,h.frame(2)),/Release/);assert.equal(bitmap.closed,0);
    lease.release();lease.release();assert.equal(bitmap.closed,1);
    const next=h.source.requestFrame(2,h.frame(2));h.flush();h.complete();(await next).release();
    assert.equal(h.messages.at(-1).stamp.frameIndex,2,'60fps request is never coalesced to preview 30Hz');h.source.dispose();
});

test('exact requests admit repeats/explicit forward segments, never implicitly replace or rewind work',async()=>{
    const h=harness();await h.start();let previousSerial=0;
    for(const index of [0,1,1,120]){const p=h.source.requestFrame(index,h.frame(index));h.flush();
        assert.ok(h.messages.at(-1).serial>previousSerial);previousSerial=h.messages.at(-1).serial;h.complete();(await p).release();}
    const n=h.messages.length;await assert.rejects(h.source.requestFrame(119,h.frame(119)),/backwards/);assert.equal(h.messages.length,n);
    h.source.dispose();
});

test('exact admission rejects preview scaling, incompatible clocks and geometry before posting',async()=>{
    const h=harness();await h.start();const n=h.messages.length;
    for(const change of [{density:.5},{compact:true},{isExporting:false},{width:1920},{height:1080},{currentTime:1},
        {exportTime:1},{frameCount:3}])await assert.rejects(h.source.requestFrame(0,{...h.frame(),...change}));
    for(const i of [-1,NaN,Infinity,.5,Number.MAX_SAFE_INTEGER+1])await assert.rejects(h.source.requestFrame(i,h.frame()));
    h.flush();assert.equal(h.messages.length,n);const p=h.source.requestFrame(0,h.frame());h.flush();h.complete();(await p).release();h.source.dispose();
});

test('old preview-only or wrong exact readiness fails rather than silently downgrading the protocol',async()=>{
    for(const exact of [undefined,{jobId:'wrong',fps:30,width:3840,height:2160},{jobId:'export-a',fps:60,width:3840,height:2160}]){
        const h=harness(),p=h.prepare();h.flush();const m=h.messages[0];
        h.respond({type:'ready',generation:m.generation,contextId:m.contextId,...(exact?{exact}:{})});
        await assert.rejects(p);assert.equal(h.stopped,1);assert.equal(h.timers.size,0);h.source.dispose();
    }
});

test('stale/malformed image identities close, cannot resolve a request, and valid response still owns its exact companion',async()=>{
    const h=harness();await h.start();const p=h.source.requestFrame(1,h.frame(1));h.flush();const request=h.messages.at(-1);
    for(const change of [{contextId:'other'},{generation:2},{jobId:'other'},{requestSerial:99},{presentationRevision:99},
        {frameIndex:2,songTime:2/30,timestampUs:Math.round(2e6/30)},{mode:'preview'},{timestampUs:17}]){
        const bitmap=h.image();h.complete(request,bitmap,{stamp:{...request.stamp,...change}});assert.equal(bitmap.closed,1);
    }
    assert.equal(h.timers.size,1);h.complete(request);const lease=await p;assert.equal(lease.frame.currentTime,1/30);
    const duplicate=h.complete(request);assert.equal(duplicate.closed,1);assert.equal(lease.bitmap.closed,0);lease.release();h.source.dispose();
});

test('invalid dimensions, raster or render duration fail closed and terminate once',async()=>{
    for(const change of [{width:1920},{raster:'unknown'},{renderMs:NaN},{renderMs:-1}]){
        const h=harness();await h.start();const p=h.source.requestFrame(0,h.frame());h.flush();const bitmap=h.image();
        if(change.width)bitmap.width=change.width;h.complete(h.messages.at(-1),bitmap,change.width?{}:change);
        await assert.rejects(p,/Invalid exact/);assert.equal(bitmap.closed,1);assert.equal(h.stopped,1);assert.equal(h.timers.size,0);h.source.dispose();
    }
});

test('abort before startup, in flight and disposal release timers, pending work and late images',async()=>{
    const cold=harness(),initial=new AbortController(),p=cold.prepare(initial.signal);initial.abort();cold.flush();
    await assert.rejects(p,/cancelled/);assert.equal(cold.created,0);assert.equal(cold.timers.size,0);cold.source.dispose();
    for(const command of ['abort','dispose']){
        const h=harness();await h.start();const signal=new AbortController(),p=h.source.requestFrame(0,h.frame(),signal.signal);h.flush();
        const request=h.messages.at(-1);command==='abort'?signal.abort():h.source.dispose();await assert.rejects(p);
        const late=h.complete(request);assert.equal(late.closed,1);assert.equal(h.stopped,1);assert.equal(h.timers.size,0);
        h.source.dispose();assert.equal(h.stopped,1);
    }
    const h=harness();await h.start();const frame=h.source.requestFrame(0,h.frame());h.flush();const b=h.complete();const lease=await frame;
    h.source.dispose();lease.release();h.source.dispose();assert.equal(b.closed,1);assert.equal(h.stopped,1);
});

test('worker startup/posting/channel/deadline failures reject and a fresh job can retry',async()=>{
    for(const fail of [h=>h.port.onerror({}),h=>h.port.onmessageerror({}),h=>[...h.timers.values()][0]()]){
        const h=harness(),p=h.prepare();h.flush();fail(h);await assert.rejects(p);assert.equal(h.stopped,1);assert.equal(h.timers.size,0);h.source.dispose();
    }
    const h=harness();await h.start();h.port.postMessage=()=>{throw Error('post failed');};const p=h.source.requestFrame(0,h.frame());h.flush();
    await assert.rejects(p,/post failed/);assert.equal(h.stopped,1);assert.equal(h.timers.size,0);
    const Source=h.load('visuals/WormholeHostExactSource.ts').WormholeHostExactSource;
    const retry=new Source(()=>h.port,fn=>h.tasks.push(fn));h.port.postMessage=m=>h.messages.push(structuredClone(m));
    const prepared=retry.prepare(h.analysis,{...h.config,jobId:'retry'});h.flush();h.ready();await prepared;
    const frame=retry.requestFrame(0,h.frame());h.flush();h.complete();const lease=await frame;
    assert.notEqual(lease.stamp.contextId,h.messages[0].contextId);assert.equal(lease.stamp.jobId,'retry');lease.release();retry.dispose();
});

function workerHarness(){
    const replies=[],renders=[],repeats=[];let closed=0,disposed=0,transferFail=false;
    class Session{render(frame){renders.push(frame);return {bitmap:{close(){closed++;}},raster:'gpu-material'};}repeat(){repeats.push(true);return {bitmap:{close(){closed++;}},raster:'gpu-material'};}dispose(){disposed++;}reset(){}}
    const scope={postMessage(message){if(transferFail&&message.type==='frame')throw Error('transfer failed');replies.push(message);}};
    createLoader({'./WormholeHostRenderSession':{WormholeHostRenderSession:Session}},
        {self:scope,performance:{now:()=>0}})('visuals/wormholeHostRender.worker.ts');
    const config={jobId:'job',fps:60,width:3840,height:2160};
    const send=data=>scope.onmessage({data});
    const prepare=()=>send({type:'prepare',generation:1,contextId:'context',exact:config,analysis:{}});
    const request=(index=0,serial=1)=>({type:'render',generation:1,serial,
        stamp:{protocol:1,contextId:'context',generation:1,requestSerial:serial,presentationRevision:0,
            mode:'exact',jobId:'job',frameIndex:index,fps:60,songTime:index/60,timestampUs:Math.round(index*1e6/60)},
        frame:{width:3840,height:2160,density:1,compact:false,currentTime:index/60,exportTime:index/60,isExporting:true,frameCount:index+1}});
    return {send,prepare,request,replies,renders,repeats,config,set transferFail(v){transferFail=v;},get closed(){return closed;},get disposed(){return disposed;}};
}

test('real worker adapter binds exact negotiation and validates full-resolution clock, job and request order',()=>{
    const h=workerHarness();h.prepare();assert.equal(h.replies[0].exact.jobId,'job');
    for(const [index,serial] of [[0,1],[1,2],[1,3],[60,4]])h.send(h.request(index,serial));
    assert.equal(h.renders.length,3);assert.equal(h.repeats.length,1);assert.equal(h.replies.at(-1).stamp.timestampUs,1e6);
    h.send(h.request(59,5));assert.equal(h.replies.at(-1).type,'failure');assert.equal(h.renders.length,3);assert.equal(h.repeats.length,1);assert.equal(h.disposed,1);
});

test('real worker rejects a preview packet in exact mode, forged job/size/fps and repeated serial',()=>{
    for(const mutate of [r=>r.stamp.mode='preview',r=>r.stamp.jobId='other',r=>r.frame.density=.5,
        r=>r.frame.exportTime=99,r=>r.stamp.fps=30,r=>r.frame.compact=true,r=>r.serial=2]){
        const h=workerHarness();h.prepare();const r=h.request();mutate(r);h.send(r);
        assert.equal(h.replies.at(-1).type,'failure');assert.equal(h.renders.length,0);assert.equal(h.disposed,1);
    }
    const h=workerHarness();h.prepare();h.send(h.request());h.send(h.request());assert.equal(h.renders.length,1);assert.equal(h.replies.at(-1).type,'failure');
});

test('worker transfer failure closes the untransferred image and invalidates its session',()=>{
    const h=workerHarness();h.prepare();h.transferFail=true;h.send(h.request());
    assert.equal(h.closed,1);assert.equal(h.disposed,1);assert.equal(h.replies.at(-1).type,'failure');
});

test('stale generations and foreign reset contexts cannot poison a current exact session',()=>{
    const h=workerHarness();h.prepare();
    h.send({type:'reset',generation:0,contextId:'context'});
    h.send({type:'reset',generation:1,contextId:'other'});
    h.send({...h.request(),generation:0});
    assert.equal(h.disposed,0);assert.equal(h.replies.length,1);h.send(h.request());assert.equal(h.renders.length,1);
    h.send({type:'reset',generation:1,contextId:'context'});assert.equal(h.replies.at(-1).type,'failure');assert.equal(h.disposed,1);
});

test('a negotiated preview session rejects exact packets and a newer job retires its predecessor',()=>{
    const h=workerHarness();h.send({type:'prepare',generation:1,contextId:'context',analysis:{}});
    h.send(h.request());assert.equal(h.renders.length,0);assert.equal(h.replies.at(-1).type,'failure');
    const fresh=workerHarness();fresh.prepare();fresh.send({type:'prepare',generation:2,contextId:'new',exact:{...fresh.config,jobId:'next'},analysis:{}});
    assert.equal(fresh.disposed,1);fresh.send(fresh.request());assert.equal(fresh.renders.length,0);
    const req=fresh.request();req.generation=req.stamp.generation=2;req.stamp.contextId='new';req.stamp.jobId='next';fresh.send(req);assert.equal(fresh.renders.length,1);
});

test('a repeated exact frame with changed companions is rejected before replaying the image',()=>{
    const h=workerHarness();h.prepare();h.send(h.request());const repeat=h.request(0,2);repeat.frame.depthCue=.5;
    h.send(repeat);assert.equal(h.replies.at(-1).type,'failure');assert.equal(h.renders.length,1);assert.equal(h.repeats.length,0);
});

for(const [gpuMaterial,probeFails] of [[true,false],[false,false],[true,true]])test('session repeats completed pixels once, GPU '+gpuMaterial+' probe failure '+probeFails,()=>{
    const canvases=[];let draws=0,materialCalls=0,gpuDisposals=0,loseGpu=false;
    class Surface{
        constructor(width,height){this.width=width;this.height=height;this.marker=0;canvases.push(this);}
        getContext(){const surface=this;return {clearRect(){surface.marker=0;},drawImage(source){surface.marker=source.marker;},save(){},restore(){},setTransform(){}};}
        transferToImageBitmap(){const bitmap={width:this.width,height:this.height,marker:this.marker,close(){}};this.marker=0;return bitmap;}
    }
    class Backend{
        constructor(w,h,create){this.canvas=create(w,h);}
        setPreviewSize(w,h,density){this.canvas.width=w*density;this.canvas.height=h*density;}
    }
    class Identity{
        constructor(state){this.state=state;}setDepthCue(){}setMusicDisplay(){}setMaterialSink(){}setMusicDisplayBackend(){}syncPosition(){}
        draw(backend){draws++;backend.canvas.marker=42+this.state.currentTime;}
    }
    class Gpu{
        constructor(canvas,precision){if(probeFails)throw Error('Float32 blend unavailable');assert.equal(precision,'float32');this.canvas=canvas;}render(){}compositeExactMaterial(material,dest){if(loseGpu)throw Error('Context lost');materialCalls++;dest.marker+=100;}dispose(){gpuDisposals++;}
    }
    const load=createLoader({'./CosmicWormholeIdentity':{CosmicWormholeIdentity:Identity},'./Canvas2DRendererBackend':{Canvas2DRendererBackend:Backend},
        './WebGLRendererBackend':{WebGLRendererBackend:class {}},'./gpu/WormholeGpuRaster':{WormholeGpuRaster:Gpu}},
        {OffscreenCanvas:Surface,Float32Array});
    const Session=load('visuals/WormholeHostRenderSession.ts').WormholeHostRenderSession,session=new Session({},gpuMaterial);
    const input={...harness({jobId:'test',fps:30,width:1280,height:720}).frame(),musicDisplay:undefined};
    const first=session.render(input,true),repeat=session.repeat();
    assert.equal(first.bitmap.marker,gpuMaterial&&!probeFails?142:42);assert.equal(repeat.bitmap.marker,first.bitmap.marker);
    assert.equal(draws,1);assert.equal(materialCalls,gpuMaterial&&!probeFails?1:0);assert.notEqual(repeat.bitmap,first.bitmap,'fresh lease, same completed image');
    const next=session.render({...input,currentTime:1/30,exportTime:1/30,frameCount:2},true);
    assert.equal(draws,2);assert.notEqual(next.bitmap.marker,repeat.bitmap.marker);
    if(gpuMaterial&&!probeFails){loseGpu=true;assert.throws(()=>session.render({...input,currentTime:2/30,exportTime:2/30,frameCount:3},true),/new compatible job/);
        assert.equal(draws,3,'failed exact frame must not replay/re-anchor the identity');assert.throws(()=>session.repeat());
        assert.throws(()=>session.render(input,true),/new compatible job/);assert.equal(draws,3);}
    session.reset();assert.throws(()=>session.repeat(),/unavailable/);
    session.dispose();session.dispose();assert.equal(gpuDisposals,gpuMaterial&&!probeFails?1:0);assert.throws(()=>session.repeat());
    assert.ok(canvases.every(c=>c.width===1&&c.height===1),'release every full-size CPU surface');
});
