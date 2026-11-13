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

export const MOBILE_CODEC_SCOPE = 'Three synthetic key pictures per configuration. Reports browser encoding, VP9 bitstream depth, and decoder results. Export quality, hardware assignment and long-job reliability require separate tests.';

export function mobileCodecProbeConfigurations() {
    // Match the landscape MP4 VP9 product policy. The test suite compares these strings to vp9ExportCodec.
    const product = [
        ['720p', 1280, 720, 8_000_000, [31, 40]],
        ['1080p', 1920, 1080, 14_000_000, [40, 41]],
        ['4K', 3840, 2160, 64_000_000, [51, 51]],
    ].flatMap(([resolution, width, height, bitrate, levels]) =>
        [30, 60].map((framerate, i) => ({
            id: 'vp9-' + resolution + '-' + framerate, group: 'product', family: 'VP9',
            codec: 'vp09.02.' + levels[i] + '.10', resolution, width, height, bitrate, framerate,
        })));
    const alternatives = [
        ['av1', 'AV1', 'av01.0.13M.10'],
        ['hevc', 'HEVC', 'hvc1.2.4.H153.B0'],
    ].flatMap(([name, family, codec]) => [
        ['720p', 1280, 720, 8_000_000], ['4K', 3840, 2160, 32_000_000],
    ].map(([resolution, width, height, bitrate]) => ({
        id: name + '-' + resolution + '-30', group: 'alternative', family, codec,
        resolution, width, height, bitrate, framerate: 30,
    })));
    return [
        {id:'vp9-8bit-control', group:'control', family:'VP9', codec:'vp09.00.31.08',
            resolution:'720p', width:1280, height:720, bitrate:8_000_000, framerate:30},
        ...product,
        {id:'vp9-4K-30-48mbps', group:'lower-rate', family:'VP9', codec:'vp09.02.50.10',
            resolution:'4K', width:3840, height:2160, bitrate:48_000_000, framerate:30},
        ...alternatives,
    ].map(row => ({...row, hardwareAcceleration:'no-preference'}));
}

/** Query -> encode -> decode, independently recorded; all resources close on
 * success, callback failure, timeout, rejection and an unsupported configuration.
 */
export async function probeNativeCodec(request, env = globalThis, timeoutMs = 8000, cohort = 'desktop') {
    const mobile = cohort === 'mobile';
    if (!mobile && cohort !== 'desktop') throw Error('Unknown codec probe cohort');
    const configurations = mobile ? mobileCodecProbeConfigurations() : codecProbeConfigurations();
    const fields = ['codec', 'width', 'height', 'framerate', 'bitrate', 'hardwareAcceleration'];
    if (mobile) fields.push('id');
    const selected = configurations.find(config => fields.every(key => config[key] === request?.[key]));
    if (!selected) throw Error('Unlisted codec probe');
    const {codec,width,height,framerate,bitrate,hardwareAcceleration} = selected;
    const config={codec,width,height,framerate,bitrate,hardwareAcceleration,latencyMode:'quality',bitrateMode:'constant'};
    const report={config,stage:'encoder-query',encoder:'not-checked',decoder:'not-checked',encodedFrames:0,decodedFrames:0,
        allKey:true,bytes:0,formats:[],timestamps:[],timings:{},scope:mobile ? MOBILE_CODEC_SCOPE : CODEC_PROBE_SCOPE};
    let encoder,decoder,canvas,timer,active=true;
    const chunks=[], formats=new Set(), now=()=>env.performance.now();
    const decodedTimestamps = [];
    if (mobile) Object.assign(report, {id: selected.id, group: selected.group, family: selected.family,
        resolution: selected.resolution, decodedTimestamps});
    let rejectFailure, failureReason;
    const failure=new Promise((_,reject)=>{rejectFailure=reject;}); void failure.catch(()=>{});
    const fail=error=>{if(active){failureReason??=error instanceof Error?error:Error(String(error?.message??error));rejectFailure(failureReason);}};
    const wait=async operation=>{const result=await Promise.race([operation,failure]);if(failureReason)throw failureReason;return result;};
    const started=now();
    try {
        timer=env.setTimeout(()=>fail(Error('Codec isolation probe timed out')),timeoutMs);
        if (!env.VideoEncoder?.isConfigSupported) {report.encoder='unavailable';return report;}
        const query=now(); const support=await wait(env.VideoEncoder.isConfigSupported(config));report.timings.queryMs=now()-query;
        report.encoder=support.supported?'supported':'unsupported';
        if (mobile && !support.supported && env.VideoDecoder?.isConfigSupported) {
            report.requestedDecoderQuery = 'not-checked';
            try {
                const decoder = await wait(env.VideoDecoder.isConfigSupported({codec, codedWidth:width, codedHeight:height}));
                report.requestedDecoderQuery = decoder.supported ? 'supported' : 'unsupported';
            } catch (error) {
                report.requestedDecoderQuery = 'error';
                if (failureReason) throw error;
            }
        }
        if (!support.supported) return report;
        if (mobile && Object.entries(config).some(([key, value]) => support.config?.[key] !== value)) {
            throw Error('The browser did not recognize the requested encoder configuration.');
        }
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
        if (mobile && codec.startsWith('vp09.')) {
            report.encodedVp9Depths = chunks.map(vp9KeyPictureBitDepth);
        }
        report.stage='decoder-query';
        if(!env.VideoDecoder?.isConfigSupported){report.decoder='unavailable';return report;}
        const decodeConfig=report.decoderConfig??{codec,codedWidth:width,codedHeight:height};
        const decodeSupport=await wait(env.VideoDecoder.isConfigSupported(decodeConfig));report.decoder=decodeSupport.supported?'supported':'unsupported';if(!decodeSupport.supported)return report;
        report.stage='decode';
        decoder=new env.VideoDecoder({error:fail,output:frame=>{
            try{if(!active)return;report.decodedFrames++;formats.add(frame.format??'opaque');
                if (mobile) decodedTimestamps.push(frame.timestamp);
                if(frame.displayWidth!==width || frame.displayHeight!==height)fail(Error('Unexpected decoded dimensions'));
            }finally{frame.close();}
        }});decoder.configure(decodeConfig);const decodeStart=now();
        for(const chunk of chunks)decoder.decode(chunk);
        await wait(decoder.flush());report.timings.decodeMs=now()-decodeStart;report.formats=[...formats];
        if(report.decodedFrames!==3)throw Error('Incomplete codec decode probe');
        if (mobile && decodedTimestamps.some((timestamp, index) => timestamp !== report.timestamps[index])) {
            throw Error('Decoded pictures returned out of order or with changed timestamps.');
        }
        report.decodedTenBitObserved=report.formats.length>0&&report.formats.every(f=>['I420P10','I422P10','I444P10','P010'].includes(f));
        report.stage='complete';
    } catch(error) {report.error={name:String(error?.name??'Error').slice(0,80),message:String(error?.message??error).slice(0,600)};}
    finally {
        active=false; if(timer!==undefined)env.clearTimeout(timer);
        for(const resource of [encoder,decoder])try{resource?.close();}catch{/* Already closed. */}
        if(canvas)canvas.width=canvas.height=1;chunks.length=0;report.timings.totalMs=now()-started;
        // Binary codec descriptions are not a public report; only the emitted name is retained.
        if(report.decoderConfig){report.emittedCodec=report.decoderConfig.codec;
            if (mobile) report.emittedCodecMatchesProfile = sameMobileProfile(codec, report.emittedCodec);
            const c=report.decoderConfig.colorSpace;if(c)report.emittedColorSpace=Object.fromEntries(['primaries','transfer','matrix','fullRange'].filter(k=>typeof c[k]==='string'||typeof c[k]==='boolean').map(k=>[k,c[k]]));
            delete report.decoderConfig;}
    }
    return report;
}

// VP9 uncompressed header, sections 6.2 and 6.2.2. Only Profile 0/2 key pictures
// are probed here. Inspect the first five bytes of each bounded packet.
function vp9KeyPictureBitDepth(chunk) {
    if (chunk.byteLength < 5) return null;
    // WebCodecs copyTo requires a destination large enough for the whole packet.
    // Each probe retains at most 16 MiB of compressed data and borrows one copy.
    const bytes = new Uint8Array(chunk.byteLength);
    chunk.copyTo(bytes);
    const header = bytes[0];
    const profile = ((header & 0x10) >> 3) | ((header & 0x20) >> 5);
    if ((header >> 6) !== 2 || (header & 0x0c) !== 0 || ![0, 2].includes(profile)
        || bytes[1] !== 0x49 || bytes[2] !== 0x83 || bytes[3] !== 0x42) return null;
    if (profile === 0) return 8;
    return (bytes[4] & 0x80) === 0 ? 10 : 12;
}

function sameMobileProfile(requested, emitted) {
    if (typeof emitted !== 'string') return null;
    const expected = requested.toLowerCase().split('.');
    const actual = emitted.toLowerCase().split('.');
    if (expected[0] === 'hvc1') return ['hvc1', 'hev1'].includes(actual[0]) && actual[1] === expected[1];
    return actual[0] === expected[0] && actual[1] === expected[1] && actual[3] === expected[3];
}

export function mobileCodecOutcome(row) {
    if (row.error) return 'probe-error';
    if (row.encoder === 'unavailable') return 'api-unavailable';
    if (row.encoder === 'unsupported') return 'encoder-unsupported';
    if (row.decoder === 'unsupported' || row.decoder === 'unavailable') return 'decoder-unavailable';
    if (row.stage !== 'complete') return 'incomplete';
    const encodedDepth = row.encodedVp9Depths;
    if (row.emittedCodecMatchesProfile === false) return 'different-encoded-profile';
    if (row.group === 'control') return encodedDepth?.length === 3 && encodedDepth.every(depth => depth === 8)
        ? 'control-pass' : 'bit-depth-unconfirmed';
    if (encodedDepth) {
        if (encodedDepth.length === 3 && encodedDepth.every(depth => depth === 10)) return 'ten-bit-confirmed';
        return 'ten-bit-unconfirmed';
    }
    if (row.decodedTenBitObserved && row.emittedCodecMatchesProfile === true) return 'ten-bit-confirmed';
    return 'ten-bit-unconfirmed';
}

/** Own the exact bytes before async iteration advances the demuxer's read cache.
 * This is a diagnostic copy only, never part of a product hot path. */
export function copyInspectionPacket(packet) {
    if (!(packet.data instanceof Uint8Array) || !packet.data.length || packet.data.length>64*1024*1024
        || !['key','delta'].includes(packet.type) || !Number.isFinite(packet.timestamp) || packet.timestamp<0
        || !Number.isFinite(packet.duration) || packet.duration<0) throw Error('Invalid inspection packet');
    return {data:packet.data.slice(),type:packet.type,timestamp:Math.trunc(packet.timestamp*1e6),duration:Math.trunc(packet.duration*1e6)};
}

/** Named CICP positions avoid confusing cp/tc with matrix coefficients. */
export function inspectionVp9Color(codec, {primaries,transfer}) {
    const fields=codec.split('.');if(fields.length!==9||fields[0]!=='vp09')throw Error('Full VP9 codec required');
    for(const [index,value] of [[5,primaries],[6,transfer]])if(value!==undefined){
        if(!Number.isInteger(value)||value<0||value>99)throw Error('Invalid CICP value');
        fields[index]=String(value).padStart(2,'0');
    }
    return fields.join('.');
}

/** Bounded independent decoder consumer, not an encoder or a product fallback. */
export async function decodeInspectionPackets(packets, config, {omitDuration=false}={}, env=globalThis) {
    if (!Array.isArray(packets)||!packets.length||packets.length>63
        || packets.reduce((n,p)=>n+p.data.byteLength,0)>64*1024*1024) throw Error('Inspection window exceeds bound');
    const report={supported:false,ids:[],timestamps:[],formats:[],submitted:0,pass:false};
    let decoder,canvas,timer,active=true,failureReason,rejectFailure;
    const failure=new Promise((_,reject)=>{rejectFailure=reject;});void failure.catch(()=>{});
    const fail=error=>{if(active){failureReason??=error instanceof Error?error:Error(String(error?.message??error));rejectFailure(failureReason);}};
    const wait=async p=>{const value=await Promise.race([p,failure]);if(failureReason)throw failureReason;return value;};
    try {
        timer=env.setTimeout(()=>fail(Error('Inspection decoder deadline')),15000);
        const support=await wait(env.VideoDecoder.isConfigSupported(config));report.supported=support.supported;
        if(!support.supported)return report;
        canvas=new env.OffscreenCanvas(192,32);const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Inspection surface unavailable');
        decoder=new env.VideoDecoder({error:fail,output:frame=>{
            try{if(!active)return;ctx.drawImage(frame,0,0);let id=0;
                for(let bit=0;bit<6;bit++)if(ctx.getImageData(bit*32+16,16,1,1).data[0]>128)id|=1<<bit;
                report.ids.push(id);report.timestamps.push(frame.timestamp);if(!report.formats.includes(frame.format??'opaque'))report.formats.push(frame.format??'opaque');
            }catch(error){fail(error);}finally{frame.close();}
        }});decoder.configure(config);
        for(const packet of packets) {
            while(decoder.decodeQueueSize>=4)await wait(new Promise(resolve=>env.setTimeout(resolve,1)));
            const chunk=new env.EncodedVideoChunk({data:packet.data,type:packet.type,timestamp:packet.timestamp,...(!omitDuration?{duration:packet.duration}:{})});
            decoder.decode(chunk);report.submitted++;
        }
        await wait(decoder.flush());report.pass=report.ids.length===packets.length&&report.ids.every((id,i)=>id===i+1);
    }catch(error){report.error={name:String(error?.name??'Error'),message:String(error?.message??error).slice(0,600)};}
    finally{active=false;if(timer!==undefined)env.clearTimeout(timer);try{decoder?.close();}catch{}if(canvas)canvas.width=canvas.height=1;}
    return report;
}

/** Short stream bounds only: not a VP9 tile/reference/alt-ref bitstream certification. */
export function evaluateReplayBounds({codec,width,height,fps,packetBytes}) {
    if (!/^vp09\.02\.51\.10(?:\.|$)/.test(codec) || ![width,height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=8384)
        || ![30,60].includes(fps) || !Array.isArray(packetBytes) || !packetBytes.length || packetBytes.length>63
        || !packetBytes.every(n=>Number.isSafeInteger(n)&&n>0) || packetBytes.reduce((a,b)=>a+b,0)>64*1024*1024) throw Error('Invalid replay bounds');
    const totalBytes=packetBytes.reduce((a,b)=>a+b,0),pixels=Math.ceil(width/32)*32*Math.ceil(height/32)*32;
    const videoBitsPerSecond=totalBytes*8*fps/packetBytes.length;
    const maxFourPictureBits=Math.max(...packetBytes.map((_,i)=>packetBytes.slice(i,i+4).reduce((a,b)=>a+b,0)*8));
    return {policy:'wh-07b8-vp9-51-sampled-v1',videoBitsPerSecond,maxFourPictureBits,
        pass:pixels<=8912896&&pixels*fps<=588251136&&videoBitsPerSecond<=120000000&&maxFourPictureBits<=46000000,
        scope:'Complete short-stream average, conservative four-packet window and padded picture/sample rate. No full-song, tile/reference/alt-ref or hardware guarantee.'};
}

/** WH-07b7: short, laboratory-only native rate-control feasibility. Source
 * loader lends one bitmap at a time; returned packets are owned QA copies,
 * capped at64MiB, not a replacement for the product's progressive OPFS path.
 */
export async function encodeSourceProfile(request, loadSource, env = globalThis, timeoutMs = 120000) {
    const {width,height,fps,bitrate,profile,quantizer,keyInterval,frames} = request ?? {};
    const usesQuantizer = profile === 'quantizer';
    const constantDetail = profile === 'constant-detail';
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 720 || height < 720
        || width > 3840 || height > 3840 || width * height > 3840 * 2160 || ![30,60].includes(fps)
        || ![8000000,14000000,64000000].includes(bitrate) || !['all-key', 'quantizer', 'constant-detail'].includes(profile)
        || (usesQuantizer ? !Number.isInteger(quantizer) || quantizer < 0 || quantizer > 255 : quantizer !== undefined)
        || (keyInterval !== undefined && (profile === 'all-key' || ![4, 12].includes(keyInterval)))
        || (constantDetail && keyInterval === undefined)
        || !Array.isArray(frames) || frames.length < 1 || frames.length > 63
        || frames.some((f,i)=>f.index !== i || !/^source-export-\d{3}-\d{3}\.png$/.test(f.name))) throw Error('Invalid source replay');
    const config={codec:'vp09.02.51.10',width,height,framerate:fps,latencyMode:'quality',alpha:'discard',
        ...(usesQuantizer ? {bitrateMode:'quantizer',contentHint:'detail'} : {bitrateMode:'constant',bitrate}),
        ...(constantDetail ? {contentHint:'detail'} : {})};
    const report={profile,...(usesQuantizer ? {quantizer} : {}),...(keyInterval !== undefined ? {keyInterval} : {}),config,encoder:'not-checked',stage:'query',
        frames:0,bytes:0,packets:[],scope:'Short native codec feasibility; no product MP4, whole-job speed, hardware or mobile qualification.'};
    let encoder,canvas,timer,active=true,reason,rejectFailure,detachQueue;
    const failure=new Promise((_,reject)=>{rejectFailure=reject;});void failure.catch(()=>{});
    const fail=error=>{if(active){reason??=error instanceof Error?error:Error(String(error));rejectFailure(reason);}};
    const wait=async promise=>{const result=await Promise.race([promise,failure]);if(reason)throw reason;return result;};
    try {
        timer=env.setTimeout(()=>fail(Error('Source replay timed out')),timeoutMs);
        if(!env.VideoEncoder?.isConfigSupported){report.encoder='unavailable';return report;}
        const support=await wait(env.VideoEncoder.isConfigSupported(config));
        report.encoder=support.supported?'supported':'unsupported';report.recognizedConfig=support.config;
        if(!support.supported)return report;
        if(support.config.bitrateMode!==config.bitrateMode)throw Error('Rate-control mode not recognized');
        if (keyInterval !== undefined && Object.entries(config).some(([key, value]) => support.config[key] !== value)) {
            throw Error('Short-GOP encoder configuration not recognized');
        }
        encoder=new env.VideoEncoder({error:fail,output:(chunk,metadata)=>{
            if(!active || reason)return;
            if(report.packets.length>=frames.length || report.bytes+chunk.byteLength>64*1024*1024){fail(Error('Source replay packet bound'));return;}
            const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);report.bytes+=data.byteLength;
            report.packets.push({data,type:chunk.type,timestamp:chunk.timestamp,duration:Math.round(1e6/fps)});
            if(metadata?.decoderConfig)report.decoderConfig=structuredClone(metadata.decoderConfig);
        }});encoder.configure(config);report.stage='encode';
        canvas=new env.OffscreenCanvas(width,height);const ctx=canvas.getContext('2d');if(!ctx)throw Error('Source replay canvas unavailable');
        for(const source of frames){
            // Failure during an asynchronous load must also close a late result.
            const loading=Promise.resolve().then(()=>loadSource(source));loading.then(bitmap=>{if(!active || reason)bitmap.close();},()=>{});
            const bitmap=await wait(loading);
            try {
                if(bitmap.width!==width || bitmap.height!==height)throw Error('Source replay dimensions changed');
                ctx.drawImage(bitmap,0,0);const frame=new env.VideoFrame(canvas,{timestamp:Math.round(source.index*1e6/fps)});
                try {encoder.encode(frame,{keyFrame:profile==='all-key'||source.index%(keyInterval ?? fps)===0,
                    ...(usesQuantizer?{vp9:{quantizer}}:{})});}finally{frame.close();}
            } finally {bitmap.close();}
            report.frames++;
            if(encoder.encodeQueueSize>=4)await wait(new Promise(resolve=>{
                const dequeued=()=>{if(encoder.encodeQueueSize<4){encoder.removeEventListener('dequeue',dequeued);resolve();}};
                encoder.addEventListener('dequeue',dequeued);detachQueue=()=>encoder.removeEventListener('dequeue',dequeued);dequeued();
            }));
        }
        await wait(encoder.flush());
        if(report.packets.length!==frames.length || report.packets.some((p,i)=>p.timestamp!==Math.round(i*1e6/fps))
            || !report.decoderConfig)throw Error('Incomplete or unordered replay packets');
        if (keyInterval !== undefined && report.packets.some((packet, index) => index % keyInterval === 0 && packet.type !== 'key')) {
            throw Error('Missing requested key picture');
        }
        report.stage='complete';
    } catch(error){report.error={name:String(error?.name??'Error').slice(0,80),message:String(error?.message??error).slice(0,600)};}
    finally {active=false;detachQueue?.();if(timer!==undefined)env.clearTimeout(timer);try{encoder?.close();}catch{}if(canvas)canvas.width=canvas.height=1;}
    return report;
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
    const send=(message,transfer=[])=>globalThis.postMessage(message,transfer);
    const sink=makeTransferSink(send);
    globalThis.onmessage=async({data})=>{
        if(data?.type==='quality_replay') {
            try {
                const report=await encodeSourceProfile(data.request,async source=>{
                    const response=await fetch(new URL('/_wh07-source/'+source.name,globalThis.location.origin));
                    if(!response.ok)throw Error('Source PNG unavailable');
                    return createImageBitmap(await response.blob());
                });
                send({type:'quality_replay_done',report},report.packets.map(p=>p.data.buffer));
            }catch(error){send({type:'quality_replay_error',message:String(error?.message??error)});}
        }else if(data?.type==='mobile_codec_matrix') {
            try {
                const cases = mobileCodecProbeConfigurations();
                for (const request of cases) {
                    const row = await probeNativeCodec(request, globalThis, 8000, 'mobile');
                    send({type:'mobile_codec_row', row:{...row, outcome:mobileCodecOutcome(row)}});
                }
                send({type:'mobile_codec_done'});
            } catch(error) {
                send({type:'mobile_codec_error', message:String(error?.message ?? error).slice(0, 600)});
            }
        }else if(data?.type==='codec_matrix') {
            try {
                const rows=[];for(const request of codecProbeConfigurations())rows.push(await probeNativeCodec(request));
                send({type:'codec_matrix_done',rows,userAgent:globalThis.navigator.userAgent,scope:CODEC_PROBE_SCOPE});
            }catch(error){send({type:'codec_matrix_error',message:String(error?.message??error)});}
        }else sink(data);
    };
}
