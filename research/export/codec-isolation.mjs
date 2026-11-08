// WH-07b2 laboratory only. No product import. The sink returns a JSON completion
// token, never a video; native probes qualify three pictures, not whole exports.
export function makeTransferSink(send, now = () => performance.now()) {
    let config, frames = 0, samples = 0, failed = false, started = 0;
    return message => {
        const bitmap = message?.type === 'encode_frame' ? message.bitmap : null;
        try {
            if (failed) return;
            if (message.type === 'start_export') {
                if (config || !Number.isSafeInteger(message.frames) || message.frames < 1 || message.frames > 1000
                    || ![30,60].includes(message.fps) || !Number.isSafeInteger(message.sourceSamples) || message.sourceSamples < 0
                    || !Number.isSafeInteger(message.sampleRate) || message.sampleRate < 8000 || message.sampleRate > 96000) throw Error('Invalid isolation start');
                config = {...message}; started = now(); send({type:'export_ready'});
            } else if (message.type === 'encode_frame') {
                if (!config || frames >= config.frames || message.timestampUs !== Math.round(frames * 1e6 / config.fps)) throw Error('Noncontiguous isolation picture');
                const end = Math.min(config.sourceSamples,Math.floor((frames+1)*config.sampleRate/config.fps));
                const count = end-samples;
                if (message.audioSampleCount !== count || !(message.audioPlanar instanceof Float32Array) || message.audioPlanar.length !== count*2) throw Error('Noncontiguous isolation PCM');
                frames++; samples=end;
                bitmap.close();
                send({type:'frame_encoded',timestampUs:message.timestampUs,audioBuffer:message.audioPlanar},[message.audioPlanar.buffer]);
                send({type:'queue_update',size:0});
                return;
            } else if (message.type === 'finalize_export') {
                if (!config || frames===0) throw Error('Empty isolation prefix');
                failed=true;
                send({type:'export_done',blob:new Blob([JSON.stringify({kind:'unencoded-pipeline-probe',frames,samples})],{type:'application/json'}),
                    timings:{unencodedInputWindow:Math.max(0,now()-started)}});
            } else throw Error('Unknown isolation message');
        } catch (error) {
            failed=true; send({type:'export_error',message:String(error?.message??error)});
        } finally {
            // Successful frame closed above before ownership/PCM acknowledgement.
            if (bitmap && bitmap.width !== 0) bitmap.close();
        }
    };
}

export const CODEC_PROBE_SCOPE = 'Three synthetic all-key pictures; no full-export speed, perceptual quality, container compatibility or hardware-attribution claim.';
export function codecProbeConfigurations() {
    // High tiers cover the fixed 64 Mbps 4K policy; lower-resolution probes use
    // the same declared ceiling. A refusal is specific to this configuration.
    return [
        {codec:'vp09.02.51.10',family:'VP9'},
        {codec:'av01.0.13H.10',family:'AV1'},
        // Also test a conforming Main-tier ceiling: 5.1 at 8 Mbps, 6.1 at
        // 64 Mbps (Main 5.1 is limited to 40 Mbps, so is not a valid 4K control).
        {codec:'av01.0.13M.10',family:'AV1-Main'},
        {codec:'hvc1.2.4.H153.B0',family:'HEVC'},
    ].flatMap(codec=>[['720p',1280,720,8_000_000],['4K',3840,2160,64_000_000]].flatMap(([resolution,width,height,bitrate])=>
        ['no-preference','prefer-hardware','prefer-software'].map(hardwareAcceleration=>({...codec,
            ...(codec.family==='AV1-Main'&&resolution==='4K'?{codec:'av01.0.17M.10'}:{}),resolution,width,height,bitrate,framerate:60,hardwareAcceleration}))));
}

/** Query -> encode -> decode, independently recorded; all resources close on
 * success, callback failure, timeout, rejection and an unsupported configuration.
 */
export async function probeNativeCodec(request, env = globalThis, timeoutMs = 8000) {
    const {codec,width,height,framerate,bitrate,hardwareAcceleration} = request;
    if (!codecProbeConfigurations().some(c=>['codec','width','height','framerate','bitrate','hardwareAcceleration'].every(k=>c[k]===request[k]))) throw Error('Unlisted codec probe');
    const config={codec,width,height,framerate,bitrate,hardwareAcceleration,latencyMode:'quality',bitrateMode:'constant'};
    const report={config,stage:'encoder-query',encoder:'not-checked',decoder:'not-checked',encodedFrames:0,decodedFrames:0,
        allKey:true,bytes:0,formats:[],timestamps:[],timings:{},scope:CODEC_PROBE_SCOPE};
    let encoder,decoder,canvas,timer,active=true;
    const chunks=[], formats=new Set(), now=()=>env.performance.now();
    let rejectFailure, failureReason;
    const failure=new Promise((_,reject)=>{rejectFailure=reject;}); void failure.catch(()=>{});
    const fail=error=>{if(active){failureReason??=error instanceof Error?error:Error(String(error?.message??error));rejectFailure(failureReason);}};
    const wait=async operation=>{const result=await Promise.race([operation,failure]);if(failureReason)throw failureReason;return result;};
    const started=now();
    try {
        timer=env.setTimeout(()=>fail(Error('Codec isolation probe timed out')),timeoutMs);
        if (!env.VideoEncoder?.isConfigSupported) {report.encoder='unavailable';return report;}
        const query=now(); const support=await wait(env.VideoEncoder.isConfigSupported(config));report.timings.queryMs=now()-query;
        report.encoder=support.supported?'supported':'unsupported'; if(!support.supported)return report;
        report.stage='encode';
        encoder=new env.VideoEncoder({error:fail,output:(chunk,metadata)=>{
            if(!active)return;
            if(report.bytes+chunk.byteLength>16*1024*1024){fail(Error('Codec probe output exceeds 16 MiB'));return;}
            report.bytes+=chunk.byteLength;report.encodedFrames++;report.allKey&&=chunk.type==='key';
            report.timestamps.push(chunk.timestamp);chunks.push(chunk);
            if(metadata?.decoderConfig && !report.decoderConfig) report.decoderConfig=structuredClone(metadata.decoderConfig);
        }});
        encoder.configure(config);
        canvas=new env.OffscreenCanvas(width,height); const ctx=canvas.getContext('2d');if(!ctx)throw Error('Codec probe canvas unavailable');
        const encodeStart=now();
        for(let i=0;i<3;i++) {
            const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,['#001020','#200010','#001820'][i]);gradient.addColorStop(1,'#245578');
            ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);ctx.fillStyle='#fff';ctx.fillRect(i*32,0,16,16);
            const frame=new env.VideoFrame(canvas,{timestamp:Math.round(i*1e6/framerate),duration:Math.round(1e6/framerate)});
            try{encoder.encode(frame,{keyFrame:true});}finally{frame.close();}
        }
        await wait(encoder.flush());report.timings.inputEncodeMs=now()-encodeStart;
        if(report.encodedFrames!==3 || !report.allKey || report.timestamps.some((t,i)=>t!==Math.round(i*1e6/framerate))) throw Error('Incomplete or unordered independent codec pictures');
        report.stage='decoder-query';
        if(!env.VideoDecoder?.isConfigSupported){report.decoder='unavailable';return report;}
        const decodeConfig=report.decoderConfig??{codec,codedWidth:width,codedHeight:height};
        const decodeSupport=await wait(env.VideoDecoder.isConfigSupported(decodeConfig));report.decoder=decodeSupport.supported?'supported':'unsupported';if(!decodeSupport.supported)return report;
        report.stage='decode';
        decoder=new env.VideoDecoder({error:fail,output:frame=>{
            try{if(!active)return;report.decodedFrames++;formats.add(frame.format??'opaque');
                if(frame.displayWidth!==width || frame.displayHeight!==height)fail(Error('Unexpected decoded dimensions'));
            }finally{frame.close();}
        }});decoder.configure(decodeConfig);const decodeStart=now();
        for(const chunk of chunks)decoder.decode(chunk);
        await wait(decoder.flush());report.timings.decodeMs=now()-decodeStart;report.formats=[...formats];
        if(report.decodedFrames!==3)throw Error('Incomplete codec decode probe');
        report.decodedTenBitObserved=report.formats.length>0&&report.formats.every(f=>['I420P10','I422P10','I444P10','P010'].includes(f));
        report.stage='complete';
    } catch(error) {report.error={name:String(error?.name??'Error').slice(0,80),message:String(error?.message??error).slice(0,600)};}
    finally {
        active=false; if(timer!==undefined)env.clearTimeout(timer);
        for(const resource of [encoder,decoder])try{resource?.close();}catch{/* Already closed. */}
        if(canvas)canvas.width=canvas.height=1;chunks.length=0;report.timings.totalMs=now()-started;
        // Binary codec descriptions are not a public report; only the emitted name is retained.
        if(report.decoderConfig){report.emittedCodec=report.decoderConfig.codec;delete report.decoderConfig;}
    }
    return report;
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
    const send=(message,transfer=[])=>globalThis.postMessage(message,transfer);
    const sink=makeTransferSink(send);
    globalThis.onmessage=async({data})=>{
        if(data?.type==='codec_matrix') {
            try {
                const rows=[];for(const request of codecProbeConfigurations())rows.push(await probeNativeCodec(request));
                send({type:'codec_matrix_done',rows,userAgent:globalThis.navigator.userAgent,scope:CODEC_PROBE_SCOPE});
            }catch(error){send({type:'codec_matrix_error',message:String(error?.message??error)});}
        }else sink(data);
    };
}
