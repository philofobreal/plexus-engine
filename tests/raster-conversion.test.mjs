import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {legacyConvert} from './helpers/legacy-raster-conversion.mjs';

const source=readFileSync('src/visuals/CanvasFieldRasterSurface.ts','utf8');
const start=source.indexOf('        let index = 0;'),end=source.indexOf('        state.ctx.putImageData',start);
assert.ok(start>0 && end>start);
const oldBody=legacyConvert.toString().slice(legacyConvert.toString().indexOf('{')+1,-1)
  .replaceAll('rows','state.rows').replaceAll('cols','state.cols').replaceAll('thresholds','DITHER_THRESHOLDS');
function load(text){
  const exports={};
  new Function('exports',ts.transpileModule(text,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText)(exports);
  return exports.CanvasFieldRasterSurface;
}
const Current=load(source),Previous=load(source.slice(0,start)+oldBody+source.slice(end));
function harness(Surface){
  let pixels,uploads=0,draws=0;
  const ctx={createImageData(w,h){pixels=new Uint8ClampedArray(w*h*4);return {data:pixels};},putImageData(){uploads++;}};
  const surface=new Surface(()=>({width:0,height:0,getContext:()=>ctx}));
  const target={save(){},restore(){},drawImage(){draws++;}};
  return {surface,target,get pixels(){return pixels;},get uploads(){return uploads;},get draws(){return draws;}};
}

test('batched RGBA conversion preserves every byte across Bayer positions, sizes, gains and malformed channels',()=>{
  const a=harness(Current),b=harness(Previous);
  let cases=0;
  for(const [cols,rows] of [[1,1],[1,17],[19,1],[7,9],[8,8],[17,19],[240,135],[480,270],[640,360],[135,240]]){
    const aa=a.surface.beginFieldRaster(0,cols,rows),bb=b.surface.beginFieldRaster(0,cols,rows);
    for(let pattern=0;pattern<4;pattern++){
      for(let i=0;i<aa.length;i++){
        const specials=[NaN,Infinity,-Infinity,-2,0,1,2,1/510];
        aa[i]=pattern===0?0:pattern===1?specials[i%specials.length]:pattern===2?((i%257)+0.5)/255:((Math.imul(i+1,1664525)>>>0)%100000)/100000;
      }
      bb.set(aa);
      for(const gain of [0,0.001,0.5,1,1.23456789,2,-1,NaN,Infinity]){
        a.surface.drawFieldRaster(0,a.target,0,0,1280,720,gain,'lighter');
        b.surface.drawFieldRaster(0,b.target,0,0,1280,720,gain,'lighter');
        assert.deepEqual(a.pixels,b.pixels,`${cols}x${rows} pattern ${pattern} gain ${gain}`);
        cases++;
      }
    }
  }
  assert.equal(cases,360);
  assert.equal(a.uploads,b.uploads);assert.equal(a.draws,b.draws);
});

if(process.env.PLEXUS_CONVERSION_BENCH==='1')test('float-to-byte conversion microbenchmark',()=>{
  const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
  for(const [cols,rows] of [[240,135],[480,270],[640,360]]){
    const a=harness(Current),b=harness(Previous);
    for(const h of [a,b]){
      const buffer=h.surface.beginFieldRaster(0,cols,rows);
      for(let i=0;i<buffer.length;i++)buffer[i]=(i%1021)/1021;
    }
    const measure=h=>{
      const before=performance.now();
      for(let i=0;i<40;i++)h.surface.drawFieldRaster(0,h.target,0,0,1920,1080,1,'lighter');
      return (performance.now()-before)/40;
    };
    for(let warmup=0;warmup<3;warmup++){measure(a);measure(b);}
    const fast=[],old=[];
    for(let round=0;round<9;round++){
      if(round%2){fast.push(measure(a));old.push(measure(b));}
      else{old.push(measure(b));fast.push(measure(a));}
    }
    console.log(JSON.stringify({size:`${cols}x${rows}`,previousMs:median(old),optimizedMs:median(fast)}));
  }
});
