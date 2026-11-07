import { captureBaseline, sha256 } from './wormhole-baseline-capture.mjs';
import { compareRgba, compareTemporal, QUALITY_POLICY } from './wormhole-quality.mjs';
import { sameWormholeRenderFrame } from '../../src/types/WormholeRenderFrame';

const decode = block => Uint8Array.from(atob(block.bytes), x=>x.charCodeAt(0));
const floats = (block, size) => { const b=decode(block),v=new DataView(b.buffer);return size===8
    ? Float64Array.from({length:b.length/8},(_,i)=>v.getFloat64(i*8,true))
    : Float32Array.from({length:b.length/4},(_,i)=>v.getFloat32(i*4,true)); };
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const frozenReference=new URLSearchParams(location.search).has('frozen');
async function capturePixels(pixels){
    const bytes=new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength);let text='';
    for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return {format:'rgba8-straight-srgb',sha256:await sha256(bytes),bytes:btoa(text)};
}
function show(label,pixels,w,h,parent) {
    const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
    caption.textContent=label;canvas.width=w;canvas.height=h;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),w,h),0,0);
    figure.append(caption,canvas);parent.append(figure);
}
window.runWh02=async(precision=document.querySelector('#precision').value,cpuLines=document.querySelector('#lines').value==='reference')=>{
    const result=document.querySelector('#result'),views=document.querySelector('#views'),button=document.querySelector('#run');
    button.disabled=true;views.replaceChildren();let worker;
    try {
        result.textContent='Loading immutable WH-01 reference (or generating the same synthetic cases locally)...';
        const pack=frozenReference?await (await fetch('/baseline.json')).json():await captureBaseline();
        worker=new Worker(new URL('./wormhole-gpu.worker.ts',import.meta.url),{type:'module'});
        const rows=[],pixelPairs=[];let id=0;
        const exchange=payload=>new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(Error('GPU worker deadline exceeded')),60000);
            worker.onerror=error=>{clearTimeout(timer);reject(Error(error.message));};
            worker.onmessage=event=>{clearTimeout(timer);resolve(event.data);};
            worker.postMessage({protocol:1,id:++id,...payload});
        });
        const input=frame=>({precision,cpuLines,stamp:frame.stamp,width:frame.width,height:frame.height,
            base:decode(frame.base),raw:floats(frame.raw,8),material:frame.material.count?{...frame.material,data:floats(frame.material,4)}:null,
            lines:{...frame.lines,width:frame.width,height:frame.height,data:floats(frame.lines,4)}});
        for(const frame of pack.cases) {
            result.textContent='Rendering '+frame.id+' in worker';const start=performance.now(),reference=decode(frame.reference);
            const reply=await exchange(input(frame));
            if(!reply.pass)throw Error(reply.error);
            if(reply.protocol!==1||reply.id!==id||!sameWormholeRenderFrame(reply.stamp,frame.stamp)) {reply.bitmap?.close();throw Error('Mismatched GPU result');}
            const roundTripMs=performance.now()-start;
            // Exercise actual transferred bitmap on the receiving thread, then release its lease.
            const bitmapCanvas=document.createElement('canvas');bitmapCanvas.width=frame.width;bitmapCanvas.height=frame.height;
            bitmapCanvas.getContext('2d').drawImage(reply.bitmap,0,0);reply.bitmap.close();
            const bitmapPixels=bitmapCanvas.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
            const quality=compareRgba(reference,reply.pixels,frame.width,frame.height);
            const cpuReplay=compareRgba(reference,reply.cpuPixels,frame.width,frame.height);
            const bitmapParity=compareRgba(reply.pixels,bitmapPixels,frame.width,frame.height);
            const article=document.createElement('article'),heading=document.createElement('h2'),images=document.createElement('div');
            heading.textContent=frame.id+' — '+(quality.pass?'numeric gates pass':'quality gate failed');images.className='images';article.append(heading,images);views.append(article);
            const diff=new Uint8Array(reference.length);
            for(let i=0;i<diff.length;i+=4){for(let k=0;k<3;k++)diff[i+k]=Math.min(255,Math.abs(reference[i+k]-reply.pixels[i+k])*8);diff[i+3]=255;}
            show('Scalar reference',reference,frame.width,frame.height,images);show('GPU '+precision,reply.pixels,frame.width,frame.height,images);show('Difference ×8',diff,frame.width,frame.height,images);
            const captures=frozenReference?{candidate:await capturePixels(reply.pixels),cpu:await capturePixels(reply.cpuPixels),bitmap:await capturePixels(bitmapPixels)}:undefined;
            const row={id:frame.id,width:frame.width,height:frame.height,captures,precision,quality,cpuReplay,bitmapParity,roundTripMs,initializationMs:reply.initializationMs,
                warmup:reply.warmup,samples:reply.samples,cpuMs:median(reply.samples.map(s=>s.cpuMs)),gpuCompletedMs:median(reply.samples.map(s=>s.completedMs)),
                readbackMs:reply.readbackMs,bitmapMs:reply.bitmapMs,targetBytes:reply.targetBytes,renderer:reply.renderer,worker:reply.worker};
            rows.push(row);pixelPairs.push({reference,candidate:reply.pixels,width:frame.width,height:frame.height});
        }
        const temporal=[0,2].map(i=>({before:rows[i].id,after:rows[i+1].id,...compareTemporal(pixelPairs[i].reference,pixelPairs[i+1].reference,
            pixelPairs[i].candidate,pixelPairs[i+1].candidate,pixelPairs[i].width,pixelPairs[i].height)}));
        // Real worker rejection/recovery and GPU context/resource lifetime, not a fake encoder test.
        const original=input(pack.cases[0]),bad={...original,material:{...original.material,count:32769}};
        const rejected=await exchange(bad);if(rejected.pass)throw Error('Malformed GPU request accepted');
        const retry=await exchange(original);if(!retry.pass)throw Error('GPU retry failed: '+retry.error);
        const retryQuality=compareRgba(pixelPairs[0].reference,retry.pixels,original.width,original.height);retry.bitmap.close();
        const lost=await exchange({action:'lose-context',stamp:original.stamp});
        const recovered=await exchange({...original,stamp:{...original.stamp,generation:2}});
        if(!recovered.pass)throw Error('Context recreation failed: '+recovered.error);
        const recoveryQuality=compareRgba(pixelPairs[0].reference,recovered.pixels,original.width,original.height);recovered.bitmap.close();
        const tiny={...original,width:2,height:2,base:new Uint8Array(16).fill(255),material:null,raw:new Float64Array(),
            lines:{width:2,height:2,count:0,square:false,data:new Float32Array()},stamp:{...original.stamp,generation:2,presentationRevision:1}};
        const resized=await exchange(tiny);if(!resized.pass)throw Error('GPU resize failed');
        const resizeExact=resized.pixels.every(x=>x===255);resized.bitmap.close();
        const disposed=await exchange({action:'dispose',stamp:tiny.stamp});
        const lifecycle={malformedRejected:!rejected.pass,retryQuality,contextLossExercised:lost.contextLoss,
            recoveryQuality,resizeExact,disposed:disposed.pass};
        const report={version:1,precision,cpuLines,policy:QUALITY_POLICY,rows,temporal,lifecycle,
            pass:rows.every(r=>r.quality.pass&&r.bitmapParity.pass&&r.cpuReplay.pass)&&temporal.every(t=>t.pass)
                &&retryQuality.pass&&recoveryQuality.pass&&resizeExact&&disposed.pass,
            scope:'synthetic kernel/bitmap only; CPU and GPU material passes, not whole-job speed',userAgent:navigator.userAgent};
        const summary={...report,rows:rows.map(({captures,...row})=>row)};
        result.textContent=JSON.stringify(summary,null,2);window.wh02Report=summary;
        if(frozenReference){const saved=await fetch('/capture',{method:'POST',body:JSON.stringify(report)});if(saved.status!==201)throw Error('Report was not saved');}
        return summary;
    }catch(error){const report={pass:false,error:String(error)};result.textContent=JSON.stringify(report);return report;}
    finally{worker?.terminate();button.disabled=false;}
};
document.querySelector('#run').onclick=()=>window.runWh02();
