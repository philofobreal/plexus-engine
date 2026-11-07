// WH-02 local research wire only; one request at a time, terminated by the laboratory owner.
import { WormholeGpuRaster, type WormholeGpuPrecision } from '../../src/visuals/gpu/WormholeGpuRaster';
import { assertWormholeRenderFrameStamp } from '../../src/types/WormholeRenderFrame';
import type { GrainMaterialFrame } from '../../src/types/GrainMaterialFrame';
import type { GrainLineFrame } from '../../src/types/GrainLineFrame';
import type { WormholeRenderFrameStamp } from '../../src/types/WormholeRenderFrame';
import { accumulateWormholeGrainCarrier, resolveWormholeGrainMaterial } from '../../src/visuals/wormholeGrainMaterialRaster';
import { CanvasFieldRasterSurface } from '../../src/visuals/CanvasFieldRasterSurface';
import { GrainCarrierCollector } from '../../src/visuals/GrainCarrierCollector';
import { CARRIER_FIELDS } from './parallel-material-data.mjs';

type Request = { protocol: 1; id: number; stamp: WormholeRenderFrameStamp; precision: WormholeGpuPrecision;
    width: number; height: number; base: Uint8Array; material: GrainMaterialFrame | null;
    lines: GrainLineFrame; raw: Float64Array; cpuLines?: boolean; action?: 'lose-context' | 'dispose' };
const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null;
    postMessage(value: unknown, transfer?: Transferable[]): void };
let gpu: WormholeGpuRaster | null = null, previous = 0;
const scalarCanvas = new OffscreenCanvas(1,1), ctx = scalarCanvas.getContext('2d')!;
const surface = new CanvasFieldRasterSurface(() => new OffscreenCanvas(1,1) as unknown as HTMLCanvasElement);
const lineCanvas=new OffscreenCanvas(1,1),lineContext=lineCanvas.getContext('2d')!;
const collector=new GrainCarrierCollector();

function strokeLines(ctx: OffscreenCanvasRenderingContext2D, lines: GrainLineFrame): void {
    ctx.globalCompositeOperation='source-over';ctx.lineCap=lines.square?'square':'round';
    for(let i=0;i<lines.count*9;i+=9) {
        const d=lines.data;ctx.lineWidth=d[i+4];ctx.strokeStyle=`rgba(${Math.round(d[i+5]*255)},${Math.round(d[i+6]*255)},${Math.round(d[i+7]*255)},${d[i+8]})`;
        ctx.beginPath();ctx.moveTo(d[i],d[i+1]);ctx.lineTo(d[i+2],d[i+3]);ctx.stroke();
    }
}

function scalar(input: Request): void {
    const { width,height,base,material,lines,raw }=input;
    if(scalarCanvas.width!==width)scalarCanvas.width=width;
    if(scalarCanvas.height!==height)scalarCanvas.height=height;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(base),width,height),0,0);
    strokeLines(ctx,lines);
    if(!material)return;
    const {cols,rows}=material,w1=Math.max(1,Math.round(cols/3)),h1=Math.max(1,Math.round(rows/3));
    const w2=Math.max(1,Math.round(cols/8)),h2=Math.max(1,Math.round(rows/8));
    const l0=surface.beginFieldRaster(0,cols,rows)!,l1=surface.beginFieldRaster(1,w1,h1)!,l2=surface.beginFieldRaster(2,w2,h2)!;
    l0.fill(0);const carrier:Record<string,number>={};
    for(let i=0;i<raw.length;i+=15) {
        CARRIER_FIELDS.forEach((key:string,k:number)=>{carrier[key]=raw[i+k];});
        accumulateWormholeGrainCarrier(l0,cols,rows,width,height,carrier as unknown as Parameters<typeof accumulateWormholeGrainCarrier>[5],material.detail);
    }
    resolveWormholeGrainMaterial(l0,cols,rows,l1,w1,h1,l2,w2,h2,material.amount,material.bloom);
    for(const layer of [2,1,0] as const) surface.drawFieldRaster(layer,ctx as unknown as CanvasRenderingContext2D,0,0,width,height,1,'lighter');
}

scope.onmessage = ({data}) => {
    try {
        if(data.protocol!==1 || !Number.isSafeInteger(data.id) || data.id<=previous)throw Error('Invalid research request');
        previous=data.id;assertWormholeRenderFrameStamp(data.stamp);
        if(data.action){
            if(data.action!=='lose-context'&&data.action!=='dispose')throw Error('Unknown research action');
            const extension=data.action==='lose-context'?gpu?.gl.getExtension('WEBGL_lose_context'):null;
            extension?.loseContext();gpu?.dispose();gpu=null;
            scope.postMessage({protocol:1,id:data.id,stamp:data.stamp,pass:true,action:data.action,contextLoss:!!extension});return;
        }
        if(!(data.raw instanceof Float64Array)||data.raw.length%15||data.raw.length>32768*15||!data.raw.every(Number.isFinite))throw Error('Invalid raw reference');
        const coldStart=performance.now();
        if(!gpu||gpu.precision!==data.precision){gpu?.dispose();gpu=new WormholeGpuRaster(new OffscreenCanvas(1,1),data.precision);}
        const initializationMs=performance.now()-coldStart, gl=gpu.gl;
        const samples=[];let warmup;
        const render=()=>{
            // Include the real producer's raw -> Float32 carrier preparation, not just a cached upload.
            let material=data.material;
            if(material){
                collector.begin(material.cols,material.rows,data.width,data.height,material.detail,material.amount,material.bloom);
                const carrier:Record<string,number>={};
                for(let i=0;i<data.raw.length;i+=15){
                    CARRIER_FIELDS.forEach((key:string,k:number)=>{carrier[key]=data.raw[i+k];});
                    collector.carrier(carrier as unknown as Parameters<GrainCarrierCollector['carrier']>[0]);
                }
                material=collector.frame;
                if(!material||material.count!==data.material!.count)throw Error('Prepared carrier mismatch');
            }
            if(data.cpuLines){
                if(lineCanvas.width!==data.width)lineCanvas.width=data.width;
                if(lineCanvas.height!==data.height)lineCanvas.height=data.height;
                lineContext.putImageData(new ImageData(new Uint8ClampedArray(data.base),data.width,data.height),0,0);strokeLines(lineContext,data.lines);
            }
            gpu!.render(data.width,data.height,data.base,material,data.cpuLines?{...data.lines,count:0}:data.lines,data.cpuLines?lineCanvas:undefined);
        };
        for(let i=0;i<4;i++) {
            let cpuMs=0,issueMs=0,completedMs=0;
            const cpu=()=>{const t=performance.now();scalar(data);cpuMs=performance.now()-t;};
            const timedRender=()=>{const t=performance.now();render();
                issueMs=performance.now()-t;gl.finish();completedMs=performance.now()-t;};
            if(i%2){cpu();timedRender();}else{timedRender();cpu();}
            if(i)samples.push({cpuMs,issueMs,completedMs});else warmup={cpuMs,issueMs,completedMs};
        }
        // Rerender immediately before readback: default drawing buffers need not survive a task boundary.
        render();gl.finish();
        const readStart=performance.now(),pixels=gpu.readPixels(),readbackMs=performance.now()-readStart;
        const bitmapStart=performance.now(),bitmap=(gpu.canvas as OffscreenCanvas).transferToImageBitmap();
        const bitmapMs=performance.now()-bitmapStart;
        const cpuPixels=ctx.getImageData(0,0,data.width,data.height).data;
        const debug=gl.getExtension('WEBGL_debug_renderer_info');
        scope.postMessage({protocol:1,id:data.id,stamp:data.stamp,pass:true,pixels,cpuPixels,bitmap,
            initializationMs,warmup,samples,readbackMs,bitmapMs,targetBytes:gpu.targetBytes,
            renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),worker:true},
            [pixels.buffer,cpuPixels.buffer,bitmap]);
    } catch(error) {
        gpu?.dispose();gpu=null;
        scope.postMessage({protocol:1,id:data?.id,stamp:data?.stamp,pass:false,error:String(error)});
    }
};
