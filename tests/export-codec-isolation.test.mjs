import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTransferSink,probeNativeCodec,codecProbeConfigurations,copyInspectionPacket,decodeInspectionPackets,inspectionVp9Color,encodeSourceProfile,evaluateReplayBounds} from '../research/export/codec-isolation.mjs';

const start={type:'start_export',frames:4,fps:60,sampleRate:48000,sourceSamples:3200};
const picture=(index,count=800)=>({type:'encode_frame',timestampUs:Math.round(index*1e6/60),audioSampleCount:count,audioPlanar:new Float32Array(count*2),
    bitmap:{width:1280,closes:0,close(){this.width=0;this.closes++;}}});

test('upstream isolation transfers contiguous PCM ownership and closes pictures, returning an explicit non-media prefix token', async()=>{
    const replies=[],sink=makeTransferSink((message,transfer)=>replies.push({message,transfer}),()=>100);
    sink(start);const a=picture(0),b=picture(1);sink(a);sink(b);sink({type:'finalize_export'});
    assert.equal(a.bitmap.closes,1);assert.equal(b.bitmap.closes,1);
    const acks=replies.filter(x=>x.message.type==='frame_encoded');assert.equal(acks.length,2);
    assert.equal(acks[0].transfer[0],a.audioPlanar.buffer);assert.equal(acks[0].message.audioBuffer,a.audioPlanar);
    const token=replies.find(x=>x.message.type==='export_done').message.blob;
    assert.equal(token.type,'application/json');assert.deepEqual(JSON.parse(await token.text()),{kind:'unencoded-pipeline-probe',frames:2,samples:1600});
    const late=picture(2);sink(late);assert.equal(late.bitmap.closes,1);assert.equal(replies.filter(x=>x.message.type==='export_done').length,1);
});

test('upstream isolation rejects gaps, invalid PCM and starts without acknowledging or leaking their pictures',()=>{
    for(const bad of ['gap','pcm']) {
        const messages=[],sink=makeTransferSink(m=>messages.push(m));sink(start);
        const frame=picture(bad==='gap'?1:0,bad==='pcm'?799:800);sink(frame);
        assert.equal(frame.bitmap.closes,1);assert.equal(messages.filter(m=>m.type==='frame_encoded').length,0);
        assert.equal(messages.at(-1).type,'export_error');sink({type:'finalize_export'});assert.equal(messages.filter(m=>m.type==='export_done').length,0);
    }
    const messages=[],sink=makeTransferSink(m=>messages.push(m));sink({...start,frames:1001});assert.equal(messages.at(-1).type,'export_error');
});

function fixture(options={}) {
    const resources={encoders:[],decoders:[],frames:[],canvas:[]};
    class Encoder {
        static async isConfigSupported(){if(options.hangQuery)return new Promise(()=>{});return {supported:options.supported!==false};}
        constructor(init){this.init=init;resources.encoders.push(this);}
        configure(config){this.config={...config};}
        encode(frame){this.init.output({type:'key',timestamp:frame.timestamp,byteLength:options.oversize?17*1024*1024:50},
            {decoderConfig:{codec:'vp09.02.51.10',description:new Uint8Array(4)}});}
        async flush(){if(options.hangEncode)return new Promise(()=>{});}
        close(){this.closes=(this.closes??0)+1;}
    }
    class Decoder {
        static async isConfigSupported(){return {supported:options.decoderSupported!==false};}
        constructor(init){this.init=init;resources.decoders.push(this);}
        configure(){}
        decode(){const frame={format:options.eightBit?'I420':'I420P10',displayWidth:1280,displayHeight:720,closed:0,close(){this.closed++;}};
            resources.frames.push(frame);this.init.output(frame);}
        async flush(){}
        close(){this.closes=(this.closes??0)+1;}
    }
    class Canvas {
        constructor(width,height){this.width=width;this.height=height;resources.canvas.push(this);}
        getContext(){return {createLinearGradient(){return {addColorStop(){}};},fillRect(){}};}
    }
    class Frame {
        constructor(_canvas,{timestamp}){this.timestamp=timestamp;this.closed=0;resources.frames.push(this);}
        close(){this.closed++;}
    }
    return {resources,env:{VideoEncoder:Encoder,VideoDecoder:Decoder,OffscreenCanvas:Canvas,VideoFrame:Frame,performance,setTimeout,clearTimeout}};
}
const request=()=>codecProbeConfigurations().find(c=>c.width===1280&&c.family==='VP9'&&c.hardwareAcceleration==='no-preference');

test('native codec probes preserve requested bit depth, separately observe decoded formats and close all temporary resources',async()=>{
    assert.equal(codecProbeConfigurations().length,24);
    const {env,resources}=fixture(),input=request(),original=structuredClone(input),report=await probeNativeCodec(input,env);
    assert.deepEqual(input,original);assert.equal(report.stage,'complete');assert.equal(report.encodedFrames,3);assert.equal(report.decodedFrames,3);assert.equal(report.decodedTenBitObserved,true);
    assert.deepEqual(report.timestamps,[0,16667,33333]);assert.equal(report.decoderConfig,undefined);assert.equal(report.emittedCodec,'vp09.02.51.10');
    assert.ok(resources.frames.every(f=>f.closed===1));assert.ok([...resources.encoders,...resources.decoders].every(c=>c.closes===1));assert.equal(resources.canvas[0].width,1);
    const snapshot=JSON.stringify(report);resources.encoders[0].init.output({byteLength:100,type:'key',timestamp:0});resources.encoders[0].init.error(Error('late'));
    const late={format:'I420',displayWidth:1280,displayHeight:720,close(){this.closed=true;}};resources.decoders[0].init.output(late);
    assert.equal(JSON.stringify(report),snapshot);assert.equal(late.closed,true);
    const eight=fixture({eightBit:true});const result=await probeNativeCodec(request(),eight.env);assert.equal(result.decodedTenBitObserved,false);assert.equal(result.config.codec,'vp09.02.51.10');
});

test('native codec probes retain unsupported encoder and decoder stages without claiming usable video',async()=>{
    const unsupported=fixture({supported:false}),r=await probeNativeCodec(request(),unsupported.env);
    assert.equal(r.encoder,'unsupported');assert.equal(r.encodedFrames,0);assert.equal(r.stage,'encoder-query');assert.equal(unsupported.resources.encoders.length,0);
    const decoder=fixture({decoderSupported:false}),d=await probeNativeCodec(request(),decoder.env);
    assert.equal(d.encoder,'supported');assert.equal(d.decoder,'unsupported');assert.equal(d.decodedFrames,0);assert.equal(d.stage,'decoder-query');assert.equal(decoder.resources.encoders[0].closes,1);
    await assert.rejects(probeNativeCodec({...request(),width:999},decoder.env),/Unlisted/);
});

test('native codec probes bound query and encoding waits and output bytes while retaining failure evidence and cleanup',async()=>{
    for(const options of [{hangQuery:true},{hangEncode:true},{oversize:true}]) {
        const {env,resources}=fixture(options),r=await probeNativeCodec(request(),env,15);
        assert.match(r.error.message,options.oversize?/16 MiB/:/timed out/);assert.notEqual(r.stage,'complete');
        assert.ok(resources.frames.every(f=>f.closed===1));assert.ok(resources.encoders.every(c=>c.closes===1));
        assert.ok(resources.canvas.every(c=>c.width===1&&c.height===1));assert.ok(r.bytes<=16*1024*1024);
    }
});

test('packet inspection owns bytes before a demux cache can change and rejects missing payload or invalid timing',()=>{
    const input={data:new Uint8Array([1,2,3]),type:'delta',timestamp:.033,duration:.034},owned=copyInspectionPacket(input);
    input.data.fill(0);assert.deepEqual([...owned.data],[1,2,3]);assert.equal(owned.timestamp,33000);assert.equal(owned.duration,34000);
    for(const change of [{data:new Uint8Array()},{type:'unknown'},{timestamp:NaN},{duration:-1}])assert.throws(()=>copyInspectionPacket({...input,...change}),/Invalid inspection/);
    const codec='vp09.02.50.10.01.02.02.01.01';
    assert.equal(inspectionVp9Color(codec,{primaries:1}),'vp09.02.50.10.01.01.02.01.01');
    assert.equal(inspectionVp9Color(codec,{transfer:1}),'vp09.02.50.10.01.02.01.01.01');
    assert.equal(inspectionVp9Color(codec,{primaries:1,transfer:1}),'vp09.02.50.10.01.01.01.01.01');
});

function decoderFixture(options={}) {
    const created=[],frames=[];let current=0;
    class Decoder {
        static async isConfigSupported(){return {supported:options.supported!==false};}
        constructor(init){this.init=init;created.push(this);}
        get decodeQueueSize(){return options.blocked?4:0;}
        configure(){}
        decode(chunk){if(options.drop&&chunk.type==='delta')return;const frame={id:chunk.data[0],timestamp:chunk.timestamp,format:'I420P10',close(){this.closed=(this.closed??0)+1;}};frames.push(frame);this.init.output(frame);}
        async flush(){if(options.error)this.init.error(Error('decoder callback failed'));}
        close(){this.closed=(this.closed??0)+1;}
    }
    class Canvas {
        getContext(){return {drawImage(frame){current=frame.id;},getImageData(x){const bit=(x-16)/32;return {data:[current&(1<<bit)?255:0]};}};}
    }
    const packets=[1,2,3].map((id,i)=>({data:new Uint8Array([id]),type:i?'delta':'key',timestamp:i*33333,duration:33333}));
    return {packets,created,frames,env:{VideoDecoder:Decoder,EncodedVideoChunk:class{constructor(init){Object.assign(this,init);}},OffscreenCanvas:Canvas,
        setTimeout:(callback,ms)=>setTimeout(callback,Math.min(ms,15)),clearTimeout}};
}

test('independent packet decoding requires every ordered picture, reports dropped deltas and closes late output',async()=>{
    for(const drop of [false,true]){
        const f=decoderFixture({drop}),r=await decodeInspectionPackets(f.packets,{codec:'vp09.02.51.10'},{},f.env);
        assert.equal(r.pass,!drop);assert.deepEqual(r.ids,drop?[1]:[1,2,3]);assert.equal(r.submitted,3);
        assert.ok(f.frames.every(x=>x.closed===1));assert.equal(f.created[0].closed,1);
        const before=JSON.stringify(r),late={id:9,close(){this.closed=true;}};f.created[0].init.output(late);
        assert.equal(late.closed,true);assert.equal(JSON.stringify(r),before);
    }
});

test('independent packet decoding preserves callback errors, bounds stalled queues and avoids unsupported allocation',async()=>{
    for(const options of [{error:true},{blocked:true},{supported:false}]){
        const f=decoderFixture(options),r=await decodeInspectionPackets(f.packets,{codec:'vp09.02.51.10'},{},f.env);
        assert.equal(r.pass,false);
        if(options.supported===false)assert.equal(f.created.length,0);
        else {assert.match(r.error.message,options.blocked?/deadline/:/callback failed/);assert.equal(f.created[0].closed,1);}
    }
    const f=decoderFixture();await assert.rejects(decodeInspectionPackets(Array.from({length:64},()=>f.packets[0]),{}, {},f.env),/bound/);
});


function replayFixture(options={}) {
 const created=[],bitmaps=[],frames=[],canvases=[];
 class Native extends EventTarget {
  encodeQueueSize=0;
  constructor(init){super();this.init=init;this.calls=[];created.push(this);}
  configure(config){this.config=config;if(options.configureError)throw Error('configure refused');}
  encode(frame,config){
   this.calls.push({timestamp:frame.timestamp,config});if(options.blocked)this.encodeQueueSize=4;
   if(options.callbackError){this.init.error(Error('encode callback'));return;}
   const data=new Uint8Array([1,2,3]);this.init.output({timestamp:frame.timestamp,type:config.keyFrame?'key':'delta',byteLength:options.oversized?64*1024*1024+1:data.length,copyTo:out=>out.set(data)},
    {decoderConfig:{codec:'vp09.02.51.10',codedWidth:1280,codedHeight:720}});
  }
  async flush(){}
  close(){this.closed=(this.closed??0)+1;}
 }
 Native.isConfigSupported=async config=>({supported:options.supported!==false,config:{...config,...(options.unrecognized?{bitrateMode:'constant'}:{})}});
 class Frame {constructor(canvas,config){Object.assign(this,config);frames.push(this);}close(){this.closed=(this.closed??0)+1;}}
 class Canvas {constructor(width,height){Object.assign(this,{width,height});canvases.push(this);}getContext(){return options.noContext?null:{drawImage(){}};}}
 const request={width:1280,height:720,fps:60,bitrate:8000000,profile:'quantizer',quantizer:16,
  frames:Array.from({length:3},(_,index)=>({index,name:'source-export-000-'+String(index).padStart(3,'0')+'.png'}))};
 const load=async()=>{const bitmap={width:options.wrongSize?720:1280,height:720,close(){this.closed=(this.closed??0)+1;}};bitmaps.push(bitmap);return bitmap;};
 const env={VideoEncoder:Native,VideoFrame:Frame,OffscreenCanvas:Canvas,setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,20)),clearTimeout};
 return {request,env,load,created,frames,bitmaps,canvases};
}

test('source replay applies explicit per-picture VP9 quantizer and bounded contiguous key frames without mutating input',async()=>{
 for(const q of [0,255]){
  const f=replayFixture();f.request.quantizer=q;f.request.frames=Array.from({length:63},(_,index)=>({index,name:'source-export-000-'+String(index).padStart(3,'0')+'.png'}));const before=structuredClone(f.request);
  const r=await encodeSourceProfile(f.request,f.load,f.env);assert.equal(r.stage,'complete');assert.equal(r.frames,63);assert.equal(r.packets.length,63);assert.equal(r.config.bitrateMode,'quantizer');assert.equal(r.config.bitrate,undefined);
  assert.deepEqual(f.created[0].calls.filter(x=>x.config.keyFrame).map(x=>x.timestamp),[0,1000000]);assert.ok(f.created[0].calls.every(x=>x.config.vp9.quantizer===q));assert.deepEqual(f.request,before);
  assert.ok(f.frames.every(x=>x.closed===1));assert.ok(f.bitmaps.every(x=>x.closed===1));assert.equal(f.canvases[0].width,1);assert.equal(f.created[0].closed,1);
  const beforeReport=JSON.stringify(r);f.created[0].init.output({byteLength:1},{});assert.equal(JSON.stringify(r),beforeReport);
 }
 const f=replayFixture();delete f.request.quantizer;f.request.profile='all-key';const r=await encodeSourceProfile(f.request,f.load,f.env);
 assert.equal(r.stage,'complete');assert.equal(r.config.bitrate,8000000);assert.equal(r.config.contentHint,undefined);assert.ok(f.created[0].calls.every(x=>x.config.keyFrame&&!x.config.vp9));
});

test('source replay refuses malformed dimensions, unbounded sources, quantizers and noncontiguous input before native allocation',async()=>{
 for(const patch of [{width:4096},{width:3840,height:3840},{fps:24},{bitrate:1},{profile:'unknown'},{quantizer:-1},{quantizer:256},{quantizer:1.5},{frames:[]},{frames:Array.from({length:64},(_,index)=>({index,name:'source-export-000-000.png'}))},{frames:[{index:1,name:'source-export-000-001.png'}]},{frames:[{index:0,name:'../escape.png'}]}]){
  const f=replayFixture();await assert.rejects(encodeSourceProfile({...f.request,...patch},f.load,f.env),/Invalid source replay/);assert.equal(f.created.length+f.canvases.length+f.bitmaps.length,0);
 }
});

test('source replay distinguishes native refusal and unrecognized rate control without allocating picture resources',async()=>{
 const f=replayFixture({supported:false}),r=await encodeSourceProfile(f.request,f.load,f.env);assert.equal(r.encoder,'unsupported');assert.equal(r.stage,'query');assert.equal(f.created.length+f.canvases.length,0);
 const g=replayFixture({unrecognized:true}),bad=await encodeSourceProfile(g.request,g.load,g.env);assert.match(bad.error.message,/not recognized/);assert.equal(g.created.length,0);
});

test('source replay closes all borrowed resources on codec, loading, size, cap and queue failures',async()=>{
 for(const options of [{configureError:true},{callbackError:true},{oversized:true},{blocked:true},{wrongSize:true},{noContext:true}]){
  const f=replayFixture(options),r=await encodeSourceProfile(f.request,f.load,f.env);assert.ok(r.error);assert.equal(f.created[0].closed,1);assert.ok(f.frames.every(x=>x.closed===1));assert.ok(f.bitmaps.every(x=>x.closed===1));if(f.canvases.length)assert.equal(f.canvases[0].width,1);
 }
 const f=replayFixture(),r=await encodeSourceProfile(f.request,()=>Promise.reject(Error('PNG load refused')),f.env);assert.match(r.error.message,/PNG load refused/);assert.equal(f.created[0].closed,1);
});

test('source replay closes a source that resolves after its timeout and never submits it',async()=>{
 const f=replayFixture();let resolve;const pending=new Promise(r=>resolve=r);const r=await encodeSourceProfile(f.request,()=>pending,f.env);assert.match(r.error.message,/timed out/);
 const bitmap=await f.load();resolve(bitmap);await new Promise(r=>setTimeout(r,0));assert.equal(bitmap.closed,1);assert.equal(f.created[0].calls.length,0);
});


test('sampled VP9 bounds retain the declared5.1 bitrate ceiling and reject the high-quality negative control',()=>{
 const base={codec:'vp09.02.51.10',width:3840,height:2160,fps:60};
 assert.equal(evaluateReplayBounds({...base,packetBytes:[250000]}).pass,true);
 assert.equal(evaluateReplayBounds({...base,packetBytes:[250001]}).pass,false);
 const q0=evaluateReplayBounds({...base,packetBytes:Array(63).fill(Math.floor(59903313/63))});assert.equal(q0.pass,false);assert.ok(q0.videoBitsPerSecond>456000000);
});

test('sampled VP9 bounds separately enforce four-picture bursts and padded luma sample rates',()=>{
 const base={codec:'vp09.02.51.10',width:3840,height:2160,fps:60};
 const burst=evaluateReplayBounds({...base,packetBytes:[2000000,2000000,1000000,1000000,...Array(59).fill(1)]});
 assert.ok(burst.videoBitsPerSecond<120000000);assert.equal(burst.maxFourPictureBits,48000000);assert.equal(burst.pass,false);
 assert.equal(evaluateReplayBounds({...base,width:4000,height:2400,packetBytes:[1]}).pass,false);
});

test('sampled VP9 bounds reject incomplete, malformed or unlisted metadata without mutating input',()=>{
 const base={codec:'vp09.02.51.10',width:1280,height:720,fps:60,packetBytes:[1000,2000]};const before=structuredClone(base);assert.equal(evaluateReplayBounds(base).pass,true);assert.deepEqual(base,before);
 for(const patch of [{codec:'vp09.02.50.10'},{fps:0},{width:Infinity},{height:0},{packetBytes:[]},{packetBytes:[-1]},{packetBytes:[1.5]},{packetBytes:Array(64).fill(1)},{packetBytes:[64*1024*1024+1]}])assert.throws(()=>evaluateReplayBounds({...base,...patch}),/Invalid replay bounds/);
});


test('short-GOP replay verifies the queried encoder settings and every requested key picture', async () => {
 for (const keyInterval of [4, 12]) {
  const f = replayFixture();
  const request = {...f.request, keyInterval, frames: Array.from({length: 26}, (_, index) => ({index, name: `source-export-000-${String(index).padStart(3, '0')}.png`}))};
  const report = await encodeSourceProfile(request, f.load, f.env);
  assert.equal(report.stage, 'complete');
  assert.deepEqual(report.packets.flatMap((p, i) => p.type === 'key' ? [i] : []), keyInterval === 4 ? [0, 4, 8, 12, 16, 20, 24] : [0, 12, 24]);
 }
 const f = replayFixture();
 const query = f.env.VideoEncoder.isConfigSupported;
 f.env.VideoEncoder.isConfigSupported = async config => {
  const answer = await query(config);
  delete answer.config.contentHint;
  return answer;
 };
 const report = await encodeSourceProfile({...f.request, keyInterval: 4}, f.load, f.env);
 assert.match(report.error.message, /configuration not recognized/);
 assert.equal(f.created.length, 0);
});

test('short-GOP constant rate retains its bitrate and rejects unbounded or mixed controls', async () => {
 const f = replayFixture();
 const request = {...f.request, profile: 'constant-detail', keyInterval: 4};
 delete request.quantizer;
 const report = await encodeSourceProfile(request, f.load, f.env);
 assert.equal(report.stage, 'complete');
 assert.equal(report.config.bitrate, request.bitrate);
 assert.equal(report.config.bitrateMode, 'constant');
 assert.equal(report.config.contentHint, 'detail');
 assert.ok(f.created[0].calls.every(call => !call.config.vp9));
 for (const patch of [{keyInterval: 0}, {keyInterval: 60}, {keyInterval: undefined}, {quantizer: 4}, {profile: 'all-key'}]) {
  await assert.rejects(encodeSourceProfile({...request, ...patch}, f.load, f.env), /Invalid source replay/);
 }
});
