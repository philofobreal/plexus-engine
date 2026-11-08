import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function harness(schedule = task => task()) {
    const messages = [], presented = [], timers = new Map(); let stopped = 0, invalidations = 0, id = 0;
    const port = { onmessage: null, onerror: null, onmessageerror: null,
        postMessage(message) { messages.push(structuredClone(message)); }, terminate() { stopped++; } };
    const load = createLoader({ './wormholeHostRender.worker.ts?worker': {} }, {
        setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); }
    });
    const { State } = load('state/store.ts');
    const { WormholeHostWorkerSource } = load('visuals/WormholeHostWorkerSource.ts');
    const source = new WormholeHostWorkerSource(() => invalidations++, () => port, schedule);
    const target = { width: 1920, height: 1080, rasterPixelRatio: 2, compactMaterialPreview: false, frameCount: 1,
        presentRaster(image) { presented.push(image); }, background() {} };
    const draw = (playing = false) => source.draw(State, target, .6, false, playing);
    const respond = message => port.onmessage({ data: message });
    const ready = () => respond({ type: 'ready', generation: messages.at(-1).generation, contextId: messages.at(-1).contextId });
    const image = () => ({ width:Math.max(1,Math.round(target.width*Math.min(target.rasterPixelRatio,(target.compactMaterialPreview?640:960)/Math.max(target.width,target.height)))),
        height:Math.max(1,Math.round(target.height*Math.min(target.rasterPixelRatio,(target.compactMaterialPreview?640:960)/Math.max(target.width,target.height)))),
        closed: 0, close() { this.closed++; } });
    const frame = (request = messages.at(-1), bitmap = image()) => {
        respond({ type: 'frame', generation: request.generation, serial: request.serial, stamp: request.stamp, bitmap, raster: 'webgl', renderMs: 7 }); return bitmap;
    };
    return { source, State, target, port, messages, presented, timers, draw, ready, frame, image, respond,
        get stopped() { return stopped; }, get invalidations() { return invalidations; } };
}

test('host worker copies immutable analysis once, sends resolved controls, bounds in-flight work and presents a bitmap', () => {
    const h = harness(); h.draw(); assert.equal(h.messages.length, 1); assert.equal(h.messages[0].type, 'prepare');
    h.ready(); h.draw(); const sent = h.messages.at(-1);
    assert.equal(sent.type, 'render'); assert.equal(sent.frame.depthCue, .6); assert.equal(sent.frame.width * sent.frame.density, 960);
    assert.equal(sent.frame.visualTuning.wormholeNebulaAmount, h.State.visualTuning.wormholeNebulaAmount);
    assert.equal(sent.frame.currentTime, h.State.currentTime); assert.equal(sent.frame.reset, true);
    assert.equal('analysis' in sent, false); assert.equal('frames' in sent.frame, false);
    for (let i = 0; i < 100; i++) { h.State.currentTime += .01; h.draw(true); }
    assert.equal(h.messages.length, 2, 'no queue behind a slow worker');
    const bitmap = h.frame(sent); h.draw();
    assert.equal(h.presented.at(-1), bitmap); assert.equal(h.source.rasterKind, 'offscreen-webgl');
    assert.equal(h.messages.filter(m => m.type === 'prepare').length, 1);
    assert.equal(h.messages.at(-1).frame.currentTime, h.State.currentTime, 'newest host clock, not old queued requests');
    h.source.dispose(); assert.equal(bitmap.closed, 1); assert.equal(h.stopped, 1); assert.equal(h.timers.size, 0);
});

test('settled pause does not loop on frame-ready; playback requests at most 30 Hz and keeps exact host time', () => {
    const h = harness(); h.draw(); h.ready(); h.draw(); h.frame();
    const count = h.messages.length;
    for (let i = 0; i < 40; i++) { h.target.frameCount++; h.draw(); }
    assert.equal(h.messages.length, count, 'frame counter must not dirty a paused frame');
    h.State.currentTime = .01; h.draw(true); assert.equal(h.messages.length, count);
    h.State.currentTime = .04; h.draw(true); assert.equal(h.messages.at(-1).frame.currentTime, .04);
    h.source.dispose();
});

test('same-position seek, backwards time, resize and analysis replacement reject stale images and release ownership', () => {
    const h = harness(); h.draw(); h.ready(); h.draw(); const oldRequest = h.messages.at(-1);
    h.source.reset(); const stale = h.frame(oldRequest); assert.equal(stale.closed, 1);
    h.ready(); h.draw(); const shown = h.frame(); h.draw();
    h.target.compactMaterialPreview = true; h.draw(); assert.equal(shown.closed, 1); h.ready(); h.draw();
    assert.equal(h.messages.at(-1).frame.width * h.messages.at(-1).frame.density, 640);
    const before = h.messages.at(-1); h.State.currentTime = -1; h.draw();
    assert.equal(h.messages.at(-1).type, 'reset'); assert.equal(h.frame(before).closed, 1);
    h.State.frames = []; h.draw(); assert.equal(h.messages.at(-1).type, 'prepare');
    assert.equal(h.messages.filter(m => m.type === 'prepare').length, 2);
    h.source.dispose();
});

test('worker failure, messageerror, startup failure and bounded deadlines fall back without leaked resources', () => {
    for (const fail of [h => h.port.onerror({}), h => h.port.onmessageerror({}), h => [...h.timers.values()][0]()]) {
        const h = harness(); h.draw(); fail(h);
        assert.equal(h.source.rasterKind, 'fallback'); assert.equal(h.draw(), false);
        assert.equal(h.stopped, 1); assert.equal(h.timers.size, 0); h.source.dispose();
    }
    const h = harness(); h.port.postMessage = () => { throw Error('unavailable'); };
    assert.equal(h.draw(), false); assert.equal(h.stopped, 1); assert.equal(h.timers.size, 0);
    h.source.dispose(); assert.equal(h.draw(), false);
});

test('offscreen renderer preference round-trips independently of quality', () => {
    const { PreviewQualityPreference } = createLoader()('config/previewQuality.ts');
    const p = new PreviewQualityPreference(false, 'auto', 'offscreen');
    assert.equal(p.wormholeRenderer, 'offscreen'); p.setMode('reduced'); assert.equal(p.wormholeRenderer, 'offscreen');
    p.setRendererMode('webgl'); p.setRendererMode('offscreen'); assert.equal(p.wormholeRenderer, 'offscreen');
});

test('worker draws the resolved state once without rerunning host automation; WebGL and Canvas2D obey quality/transparency', () => {
    for (const fallback of [false, true]) {
        const responses = [], draws = [], resizes = [], seeks = [];
        class Gpu {
            constructor() { if (fallback) throw Error('no WebGL'); }
            canvas = { transferToImageBitmap: () => ({ transferred: true }) };
            setSize(...args) { resizes.push(args); } finish() {} dispose() {}
        }
        class Cpu {
            canvas = { transferToImageBitmap: () => ({ transferred: true }) };
            setPreviewSize(...args) { resizes.push(args); }
        }
        class Identity {
            constructor(state) { this.state = state; }
            setDepthCue(v) { this.depth = v; } syncPosition(t) { seeks.push(t); }
            draw(backend) { draws.push({ state: structuredClone(this.state), depth: this.depth, compact: backend.compactMaterialPreview, transparent: backend.transparentBackground }); }
        }
        const scope = { postMessage(message, transfer) { responses.push({ message, transfer }); } };
        createLoader({ './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }, './Canvas2DRendererBackend': { Canvas2DRendererBackend: Cpu },
            './WebGLRendererBackend': { WebGLRendererBackend: Gpu } }, { self: scope, performance: { now: () => 0 } })('visuals/wormholeHostRender.worker.ts');
        const send = data => scope.onmessage({ data });
        const analysis = { frames: [], events: [], sampleRate: 48000, hopSize: 1024, bpm: 120, trackAnalysis: { features: [] } };
        send({ type: 'prepare', generation: 1, analysis });
        const frame = { currentTime: 2.5, visualTuning: { wormholeNebulaAmount: .8 }, currentFrame: { e: .7 }, depthCue: .6,
            width: 1920, height: 1080, density: .5, compact: true, transparent: true, frameCount: 4, reset: true };
        send({ type: 'render', generation: 1, serial: 1, frame });
        assert.equal(draws.length, 1); assert.equal(draws[0].state.visualTuning.wormholeNebulaAmount, .8);
        assert.equal(draws[0].state.currentTime, 2.5); assert.equal(draws[0].depth, .6); assert.deepEqual(seeks, [2.5]);
        assert.equal(responses.at(-1).message.raster, fallback ? 'canvas2d' : 'webgl');
        assert.equal(responses.at(-1).transfer.length, 1);
        assert.deepEqual(resizes[0], fallback ? [1920, 1080, .5, true, true] : [1920, 1080, .5]);
        send({ type: 'reset', generation: 2 }); send({ type: 'render', generation: 1, serial: 2, frame });
        assert.equal(draws.length, 1, 'old generation never rendered');
    }
});


test('MVP menu defaults to Offscreen on a fresh device and saves/copies/reloads an explicit choice', async () => {
    class Element {
        children=[];listeners={};style={};value='';textContent='';append(...nodes){this.children.push(...nodes);}
        setAttribute(){}addEventListener(key,fn){this.listeners[key]=fn;}select(){}remove(){}
    }
    const saved=new Map(),payloads=[];
    const load=createLoader({'./previewQualityControl.css':{}},{document:{createElement:()=>new Element()},
        window:{localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}},
        navigator:{clipboard:{writeText:async text=>payloads.push(JSON.parse(text))}}});
    const {createPreviewQualityControl}=load('ui/PreviewQualityControl.ts');
    const control=createPreviewQualityControl(false,true);
    assert.equal(control.preference.wormholeRenderer,'offscreen');
    const select=control.root.children[2].children[0];select.value='offscreen';select.listeners.change();
    await control.root.children.find(e => e.textContent === 'Copy preview settings').listeners.click();
    assert.equal(payloads[0].wormholeRenderer,'offscreen');assert.equal(saved.get('plexus.wormholeRenderer'),'offscreen');
    assert.equal(createPreviewQualityControl(false,true).preference.wormholeRenderer,'offscreen');
    assert.equal(createPreviewQualityControl(false,false).preference.wormholeRenderer,'compatible','Studio never silently selects unavailable worker');
    control.showWormholeRenderer('offscreen-gpu-material');
    assert.ok(control.root.children.some(e=>e.textContent?.includes('Active: GPU material in worker')));
    await control.root.children.find(e=>e.textContent==='Copied preview settings').listeners.click();
    assert.equal(payloads[1].activeWormholeRenderer,'offscreen-gpu-material');
    assert.equal(saved.get('plexus.wormholeRenderer'),'offscreen','observed fallback never overwrites choice');
});


test('MVP preparation omits unused acoustic activity without changing the host cache or cloning it per frame', () => {
    const h = harness(), evidence = { mustNeverClone: () => { throw Error('unused evidence'); } };
    h.State.trackAnalysis = { ...h.State.trackAnalysis, musicActivity: evidence };
    const publication = h.State.trackAnalysis;
    assert.equal(h.draw(), true); const prepared = h.messages[0].analysis;
    assert.equal('musicActivity' in prepared.trackAnalysis, false);
    assert.equal(h.State.trackAnalysis, publication); assert.equal(publication.musicActivity, evidence);
    assert.deepEqual(JSON.parse(JSON.stringify(prepared.trackAnalysis.features)), JSON.parse(JSON.stringify(publication.features)));
    h.ready(); h.draw(); h.frame(); h.draw();
    for (let i = 0; i < 10; i++) h.draw();
    assert.equal(h.messages.filter(m => m.type === 'prepare').length, 1);
    assert.ok(h.messages.filter(m => m.type === 'render').every(m => !('analysis' in m)));
    h.source.dispose();
});

test('deferred broker snapshots borrowed values before leaving draw and coalesces the latest pending frame',()=>{
    const tasks=[],h=harness(task=>tasks.push(task)),flush=()=>{while(tasks.length)tasks.shift()();};
    h.State.currentTime=1;h.State.currentFrame.e=.4;h.draw();
    assert.equal(h.messages.length,0,'worker construction/submission is outside draw');
    h.State.currentFrame.e=.99;flush();assert.equal(h.messages[0].type,'prepare');
    h.ready();flush();const first=h.messages.at(-1);
    assert.equal(first.frame.currentFrame.e,.4,'queued frame owns its snapshot');
    assert.equal(first.stamp.songTime,1);assert.equal(first.stamp.mode,'preview');
    for(const t of [2,3,4]){h.State.currentTime=t;h.draw(true);flush();}
    assert.equal(h.messages.filter(m=>m.type==='render').length,1,'one in flight');
    const malformed={...first,stamp:{...first.stamp,presentationRevision:99}};
    const rejected=h.frame(malformed);assert.equal(rejected.closed,1);
    const image=h.frame(first);flush();const next=h.messages.at(-1);
    assert.equal(next.frame.currentTime,4,'only latest desired request retained');
    assert.equal(h.messages.filter(m=>m.type==='render').length,2);
    h.source.reset();flush();assert.equal(image.closed,1);
    h.respond({type:'failure',generation:first.generation,contextId:first.stamp.contextId,message:'old failure'});
    assert.notEqual(h.source.rasterKind,'fallback','old generation cannot poison reset');
    const stale=h.frame(next);assert.equal(stale.closed,1);
    h.source.dispose();flush();assert.equal(h.stopped,1);assert.equal(h.timers.size,0);
});

test('display/density revisions invalidate queued images and disposed queued startup creates no worker',()=>{
    const tasks=[],h=harness(task=>tasks.push(task)),flush=()=>{while(tasks.length)tasks.shift()();};
    h.draw();h.source.dispose();flush();assert.equal(h.messages.length,0);
    const nextTasks=[],n=harness(task=>nextTasks.push(task)),tick=()=>{while(nextTasks.length)nextTasks.shift()();};
    n.draw();tick();n.ready();tick();const old=n.messages.at(-1);
    n.target.rasterPixelRatio=.25;n.draw();tick();
    assert.equal(n.frame(old).closed,1);
    n.ready();tick();const fresh=n.messages.at(-1);
    assert.ok(fresh.stamp.presentationRevision>old.stamp.presentationRevision);
    assert.ok(fresh.generation>old.generation);n.source.dispose();
});

test('negotiated worker rejects wrong context/stamp and disposes the session on transfer failure',()=>{
    const replies=[],sessions=[];
    class Session {
        constructor(a,gpu){this.analysis=a;this.gpu=gpu;this.disposed=0;sessions.push(this);}
        reset(){this.resetCalled=true;}
        render(){this.image={closed:0,close(){this.closed++;}};return {bitmap:this.image,raster:'gpu-material'};}
        dispose(){this.disposed++;}
    }
    let transferFails=false;
    const scope={postMessage(m){if(transferFails&&m.type==='frame')throw Error('transfer rejected');replies.push(m);}};
    createLoader({'./WormholeHostRenderSession':{WormholeHostRenderSession:Session}},{self:scope,performance:{now:()=>0}})('visuals/wormholeHostRender.worker.ts');
    const send=data=>scope.onmessage({data});
    const stamp={protocol:1,contextId:'mvp',generation:1,requestSerial:1,presentationRevision:0,songTime:2,mode:'preview'};
    send({type:'prepare',generation:1,contextId:'mvp',analysis:{}});
    assert.equal(sessions[0].gpu,true);
    send({type:'render',generation:1,serial:1,stamp,frame:{currentTime:2}});
    assert.equal(replies.at(-1).raster,'gpu-material');assert.deepEqual(replies.at(-1).stamp,stamp);
    send({type:'reset',generation:2,contextId:'different'});
    send({type:'render',generation:1,serial:2,stamp:{...stamp,requestSerial:2},frame:{currentTime:2}});
    assert.equal(replies.at(-1).type,'frame','wrong-context reset leaves generation untouched');
    send({type:'render',generation:1,serial:3,stamp:{...stamp,requestSerial:3,songTime:3},frame:{currentTime:2}});
    assert.equal(replies.at(-1).type,'failure');assert.equal(replies.at(-1).contextId,'mvp');
    assert.equal(sessions[0].disposed,1);
    send({type:'prepare',generation:2,contextId:'mvp',analysis:{}});
    transferFails=true;
    send({type:'render',generation:2,serial:1,stamp:{...stamp,generation:2},frame:{currentTime:2}});
    assert.equal(replies.at(-1).type,'failure');
    assert.equal(sessions[1].image.closed,1,'failed transfer retains producer ownership until close');
    assert.equal(sessions[1].disposed,1,'failed transfer disposes all session resources');
});

test('GPU material session consumes carriers once, separates foreground, reuses targets and releases on loss/dispose',()=>{
    const draws=[],gpus=[],surfaces=[],identities=[];
    class Cpu {constructor(){this.canvas={width:1,height:1,transferToImageBitmap:()=>({cpu:true})};surfaces.push(this);}
        setPreviewSize(w,h,d,c,t){this.width=w;this.height=h;this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);this.compactMaterialPreview=c;}
        background(){} }
    class Legacy extends Cpu{}
    class Gpu {constructor(){this.canvas={transferToImageBitmap:()=>({gpu:true})};this.calls=[];this.disposed=0;gpus.push(this);}
        render(...args){this.calls.push(args);if(this.lost)throw Error('context lost');}dispose(){this.disposed++;}}
    class Identity {constructor(s){this.state=s;identities.push(this);}setMaterialSink(s){this.sink=s;}setMusicDisplay(){}setMusicDisplayBackend(b){this.overlay=b;}
        setDepthCue(v){this.depth=v;}syncPosition(t){this.position=t;}draw(b){draws.push({sink:this.sink,overlay:this.overlay,backend:b});this.sink?.begin(2,2,b.width,b.height,.5,.6,.4);}}
    const l=createLoader({'./Canvas2DRendererBackend':{Canvas2DRendererBackend:Cpu},'./WebGLRendererBackend':{WebGLRendererBackend:Legacy},
        './gpu/WormholeGpuRaster':{WormholeGpuRaster:Gpu},'./CosmicWormholeIdentity':{CosmicWormholeIdentity:Identity}},
        {OffscreenCanvas:class{constructor(w,h){this.width=w;this.height=h;}}});
    const Session=l('visuals/WormholeHostRenderSession.ts').WormholeHostRenderSession;
    const s=new Session({frames:[],events:[],trackAnalysis:{features:[]}});
    const f={width:640,height:360,density:.5,compact:false,transparent:true,frameCount:2,currentTime:3,
        depthCue:.6,reset:true,musicDisplay:{mode:'spectrum',size:.5,opacity:1}};
    assert.equal(s.render(f).raster,'gpu-material');assert.equal(draws.length,1);assert.ok(draws[0].sink);assert.ok(draws[0].overlay);
    assert.equal(gpus[0].calls.at(-1)[2],null,'no CPU RGBA readback/allocation');
    assert.equal(gpus[0].calls.at(-1)[4].count,0,'unqualified GPU lines stay off');
    s.render({...f,reset:false,musicDisplay:undefined});assert.equal(gpus.length,1);assert.equal(draws.at(-1).overlay,null);
    gpus[0].lost=true;assert.equal(s.render(f).raster,'canvas2d');assert.equal(gpus[0].disposed,1);
    assert.equal(draws.at(-1).sink,null,'fallback cannot omit CPU material');assert.equal(draws.at(-1).overlay,null);
    s.dispose();s.dispose();assert.equal(gpus[0].disposed,1);
    for(const surface of surfaces)assert.equal(surface.canvas.width,1);
    assert.throws(()=>s.render(f),/disposed/);
});


test('paired preview admits one frozen counterpart and requires presentation ack before reuse',()=>{
    const h=harness(),captures=[],pair={key:'transition:1',revision:'flags:0',capture:frame=>captures.push(frame)};
    const draw=()=>h.source.draw(h.State,h.target,.6,false,false,undefined,pair);
    h.State.currentTime=1;draw();assert.equal(captures.length,0,'prepare cannot capture a counterpart yet');
    h.ready();draw();assert.equal(captures.length,1);
    const first=h.messages.at(-1);h.State.visualTuning.lineAlpha=.2;draw();
    assert.equal(captures.length,1,'flight counterpart is not overwritten');
    h.frame(first);const shown=h.source.presentedFrame;draw();
    assert.equal(captures.length,1,'unpresented reply owns its frozen target');
    assert.equal(shown,captures[0]);
    h.source.acknowledgePresented(shown);draw();
    assert.equal(captures.length,2,'paused control change observed during flight is not lost');
    assert.equal(h.messages.at(-1).frame.visualTuning.lineAlpha,.2);
    h.source.dispose();
});

test('leaving a paired transition reuses the valid pure-Wormhole image without a black flash',()=>{
    const h=harness(),pair={key:'transition:9',capture(){}};
    const draw=p=>h.source.draw(h.State,h.target,.6,false,false,undefined,p);
    draw(pair);h.ready();draw(pair);const request=h.messages.at(-1),image=h.frame(request);
    h.source.acknowledgePresented(h.source.presentedFrame);
    draw(undefined);assert.equal(h.presented.at(-1),image);assert.equal(image.closed,0);
    assert.equal(h.messages.filter(m=>m.type==='reset').length,0,'no needless generation reset at completion');
    h.source.dispose();assert.equal(image.closed,1);
});
