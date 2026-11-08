import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function fixture(options={}) {
    const codecs=[],frames=[],packets=[],registered=[];
    class Native extends EventTarget {
        state='unconfigured'; encodeQueueSize=0;
        constructor(init){super();this.init=init;codecs.push(this);}
        configure(config){if(options.configureError)throw Error('configuration failed');this.config=config;this.state='configured';}
        encode(frame,config){this.last={frame,config};if(options.blocked)this.encodeQueueSize=4;}
        async flush(){if(options.callbackError)this.init.error(Error('native callback'));}
        close(){this.state='closed';this.closes=(this.closes??0)+1;}
        emit(timestamp=0){this.init.output({timestamp,duration:0},{decoderConfig:{codec:'vp09.02.51.10',colorSpace:{primaries:'bt709',transfer:'iec61966-2-1'}}});}
    }
    class Frame {constructor(source,init){Object.assign(this,init);this.source=source;frames.push(this);}close(){this.closes=(this.closes??0)+1;}}
    const module=createLoader({'../../src/export/mp4-export.worker':{},mediabunny:{CustomVideoEncoder:class{},
        EncodedPacket:{fromEncodedChunk:chunk=>({clone:overrides=>({...chunk,...overrides})})},registerEncoder:c=>registered.push(c)}},
        {VideoEncoder:Native,VideoFrame:Frame,EventTarget,Event,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,20)),clearTimeout})('../research/export/native-packet.worker.ts');
    const encoder=new module.NativePacketEncoder();
    encoder.config={codec:'vp09.02.51.10',framerate:60,width:3840,height:2160,bitrate:64000000,latencyMode:'quality',bitrateMode:'constant'};
    encoder.onPacket=(packet,metadata)=>{if(options.packetError)throw Error('packet callback');packets.push({packet,metadata});};
    const source={identity:'borrowed bitmap'},sample={timestamp:1/60,toCanvasImageSource:()=>source};
    return {encoder,codecs,frames,packets,registered,source,sample,Class:module.NativePacketEncoder};
}

test('native packet candidate uses canonical WebM-style input and preserves packet metadata/GOP without owning the sample',async()=>{
    const f=fixture(),before=structuredClone(f.encoder.config);f.encoder.init();
    const options={keyFrame:true};await f.encoder.encode(f.sample,options);
    assert.equal(f.frames[0].timestamp,16667);assert.equal(f.frames[0].duration,undefined);assert.equal(f.frames[0].source,f.source);assert.equal(f.frames[0].closes,1);
    assert.equal(f.codecs[0].last.config,options);assert.equal(f.sample.timestamp,1/60);assert.deepEqual(f.encoder.config,before);
    f.codecs[0].emit(16667);assert.equal(f.packets[0].packet.duration,1/60);assert.equal(f.packets[0].metadata.decoderConfig.colorSpace.transfer,'iec61966-2-1');
    assert.equal(f.codecs[0].config.alpha,'discard');assert.equal(f.codecs[0].config.hardwareAcceleration,undefined);
    await f.encoder.flush();f.encoder.close();f.encoder.close();assert.equal(f.codecs[0].closes,1);assert.equal(f.registered[0],f.Class);
});

test('native packet candidate waits for bounded native capacity and releases listeners on dequeue, close and timeout',async()=>{
    for(const outcome of ['dequeue','close','timeout']){
        const f=fixture({blocked:true});f.encoder.init();const result=f.encoder.encode(f.sample,{keyFrame:false});
        if(outcome==='dequeue'){f.codecs[0].encodeQueueSize=3;f.codecs[0].dispatchEvent(new Event('dequeue'));await result;}
        else {if(outcome==='close')f.encoder.close();await assert.rejects(result,outcome==='close'?/closed/:/timed out/);}
        f.encoder.close();assert.equal(f.codecs[0].closes,1);assert.equal(f.frames[0].closes,1);
    }
});

test('native packet candidate retains callback errors and refuses stale output and reuse after teardown',async()=>{
    for(const options of [{callbackError:true},{packetError:true}]){
        const f=fixture(options);f.encoder.init();
        if(options.packetError)f.codecs[0].emit();
        await assert.rejects(f.encoder.flush(),options.packetError?/packet callback/:/native callback/);
        f.encoder.close();const length=f.packets.length;f.codecs[0].emit();f.codecs[0].init.error(Error('late'));assert.equal(f.packets.length,length);
        assert.throws(()=>f.encoder.init(),/one initialization/);await assert.rejects(f.encoder.encode(f.sample,{}));
    }
});

test('native packet registration is VP9 ten-bit only and initialization failures release its codec',()=>{
    const f=fixture({configureError:true});assert.throws(()=>f.encoder.init(),/configuration failed/);assert.equal(f.codecs[0].closes,1);
    assert.equal(f.Class.supports('vp9',{codec:'vp09.02.51.10'}),true);
    for(const [codec,config]of [['avc',{codec:'avc1.640033'}],['vp9',{codec:'vp09.00.51.08'}],['vp9',{codec:'vp09.02.51.10',alpha:'keep'}]])assert.equal(f.Class.supports(codec,config),false);
    const missing=fixture();delete missing.encoder.config.framerate;assert.throws(()=>missing.encoder.init(),/frame rate/);assert.equal(missing.codecs.length,0);
});
