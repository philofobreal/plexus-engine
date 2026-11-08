import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function fixture() {
    const native = [], output = [], errors = [];
    class Native extends EventTarget {
        state = 'unconfigured';
        submitted = [];
        constructor(init) { super(); this.init=init; native.push(this); }
        static async isConfigSupported(config) { return {supported:config.codec==='vp09.02.51.10',config}; }
        configure(config) { this.config={...config};this.state='configured'; }
        encode(frame,options) { this.submitted.push({timestamp:frame.timestamp,key:options?.keyFrame}); }
        async flush() { if(this.failure)throw this.failure; }
        close() { this.state='closed';this.closed=(this.closed??0)+1; }
        emit(timestamp) { this.init.output({timestamp,type:'key'},{decoderConfig:{codec:'vp09.02.51.10'}}); }
    }
    const {PairedEncoder}=createLoader({'../../src/export/mp4-export.worker':{}},{VideoEncoder:Native,EventTarget,Event})('../research/export/paired-encoder.worker.ts');
    const codec=new PairedEncoder({output:(chunk,metadata)=>output.push({timestamp:chunk.timestamp,codec:metadata.decoderConfig.codec}),error:e=>errors.push(e)});
    codec.configure({codec:'vp09.02.51.10',width:3840,height:2160,bitrate:64_000_000});
    return {codec,native,output,errors,PairedEncoder};
}

test('paired research restores arbitrarily completed independent pictures with a four-picture bound', async()=>{
    const {codec,native,output}=fixture();
    for(const timestamp of [0,16667,33333,50000])codec.encode({timestamp},{keyFrame:true});
    assert.equal(native.length,2);
    assert.deepEqual(native.map(e=>e.submitted.map(s=>s.timestamp)),[[0,33333],[16667,50000]]);
    assert.equal(codec.encodeQueueSize,4);
    assert.throws(()=>codec.encode({timestamp:66667},{keyFrame:true}),/bound exceeded/);
    native[1].emit(50000);native[1].emit(16667);assert.equal(output.length,0);
    native[0].emit(0);assert.deepEqual(output.map(x=>x.timestamp),[0,16667]);
    native[0].emit(33333);await codec.flush();
    assert.deepEqual(output.map(x=>x.timestamp),[0,16667,33333,50000]);
    assert.ok(output.every(x=>x.codec==='vp09.02.51.10'));assert.equal(codec.encodeQueueSize,0);
    codec.close();codec.close();assert.ok(native.every(e=>e.closed===1));
});

test('paired research keeps dependent probe pictures on one native codec and delegates actual support queries', async()=>{
    const {codec,native,PairedEncoder}=fixture();
    codec.encode({timestamp:0},{keyFrame:true});codec.encode({timestamp:16667},{keyFrame:false});codec.encode({timestamp:33333},{keyFrame:false});
    assert.equal(native.length,1);assert.equal(native[0].submitted.length,3);
    for(const timestamp of [0,16667,33333])native[0].emit(timestamp);
    await codec.flush();codec.close();
    assert.equal((await PairedEncoder.isConfigSupported({codec:'unsupported'})).supported,false);
    assert.equal((await PairedEncoder.isConfigSupported({codec:'vp09.02.51.10'})).supported,true);
});

test('paired research refuses incomplete/failed flush and ignores old output/error callbacks after reset', async()=>{
    const {codec,native,output,errors}=fixture();
    codec.encode({timestamp:0},{keyFrame:true});
    await assert.rejects(codec.flush(),/missing output pictures/);
    native[0].failure=Error('native failure');await assert.rejects(codec.flush(),/native failure/);
    const old=native[0];codec.reset();old.emit(0);old.init.error(Error('late native failure'));
    assert.equal(output.length,0);assert.equal(errors.length,0);assert.equal(old.closed,1);
    codec.configure({codec:'vp09.02.51.10',width:1280,height:720});codec.encode({timestamp:0},{keyFrame:true});
    native[1].emit(0);await codec.flush();assert.deepEqual(output.map(x=>x.timestamp),[0]);codec.close();
});
