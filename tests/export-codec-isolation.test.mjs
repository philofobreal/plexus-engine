import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTransferSink,probeNativeCodec,codecProbeConfigurations,copyInspectionPacket,decodeInspectionPackets,inspectionVp9Color} from '../research/export/codec-isolation.mjs';

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
