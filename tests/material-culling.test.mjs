import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('src/visuals/wormholeGrainMaterialRaster.ts','utf8');
const carrierStart=source.indexOf('export function accumulateWormholeGrainCarrier(');
const carrierEnd=source.indexOf('\n/**',carrierStart);
assert.ok(carrierStart>0 && carrierEnd>carrierStart);
const previousSource=source.slice(0,carrierStart)+readFileSync('tests/helpers/legacy-material-carrier.mjs','utf8')+source.slice(carrierEnd);
function load(text,math=Math){
  const exports={};
  new Function('exports','Math',ts.transpileModule(text,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText)(exports,math);
  return exports;
}
const current=load(source), previous=load(previousSource);
const bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);

test('fully clipped carriers skip expensive setup but edge and crossing support is preserved',()=>{
  let exponentials=0;
  const math=Object.create(Math);
  math.exp=x=>{exponentials++;return Math.exp(x);};
  const fast=load(source,math),old=load(previousSource,math);
  for(const [x,y] of [[-50,30],[200,30],[30,-50],[30,200]]){
    const c={...carrier(0),tailX:x,headX:x+1,tailY:y,headY:y+1};
    const a=new Float32Array(128*72*4),b=a.slice();
    exponentials=0;old.accumulateWormholeGrainCarrier(b,128,72,128,72,c,1);
    assert.ok(exponentials>0);
    exponentials=0;fast.accumulateWormholeGrainCarrier(a,128,72,128,72,c,1);
    assert.equal(exponentials,0);
    assert.deepEqual(bytes(a),bytes(b));
  }
  let cases=0;
  for(const [cols,rows] of [[64,36],[36,64]])for(const horizontal of [true,false]){
    const edge=horizontal?cols:rows;
    for(const position of [-7,-6.5,-6,-5.9,0,edge/2,edge+5.9,edge+6,edge+6.5,edge+7]){
      for(const delta of [0,1,20,-20,2*edge]){
        const c={...carrier(1),strokeWeight:30,depth:0,materialPhase:cases%2?1e9:0.3};
        c.tailX=horizontal?position:cols/2;c.tailY=horizontal?rows/2:position;
        c.headX=horizontal?position+delta:cols/2;c.headY=horizontal?rows/2:position+delta;
        const a=new Float32Array(cols*rows*4),b=a.slice();
        current.accumulateWormholeGrainCarrier(a,cols,rows,cols,rows,c,1);
        previous.accumulateWormholeGrainCarrier(b,cols,rows,cols,rows,c,1);
        assert.deepEqual(bytes(a),bytes(b),`boundary case ${cases++}`);
      }
    }
  }
  assert.equal(cases,200);
  const c={...carrier(0),tailX:-20,headX:160,tailY:36,headY:36,depth:0};
  const a=new Float32Array(128*72*4),b=a.slice();
  current.accumulateWormholeGrainCarrier(a,128,72,128,72,c,1);
  previous.accumulateWormholeGrainCarrier(b,128,72,128,72,c,1);
  assert.deepEqual(bytes(a),bytes(b));assert.ok(a.some(v=>v>0));
});

function carrier(i,phase=0){
  const angle=i*2.399963+phase,radius=20+(i%30)*6;
  return {tailX:320+Math.cos(angle-0.15)*radius*0.85,tailY:180+Math.sin(angle-0.15)*radius*0.55,
    headX:320+Math.cos(angle)*radius,headY:180+Math.sin(angle)*radius*0.65,
    alpha:220,strokeWeight:4,colorR:95+i%80,colorG:125,colorB:255,seed:i+0.3,
    generation:2,materialPhase:phase,energy:0.8,depth:(i%30)/40,weave:i%3===0?1:0};
}

test('carrier accumulation and resolved material remain byte-identical at compact, desktop and export sizes',()=>{
  let cases=0;
  for(const [cols,rows] of [[240,135],[480,270],[640,360],[135,240]]){
    const a=new Float32Array(cols*rows*4),b=new Float32Array(a.length);
    for(let i=0;i<180;i++){
      const c=carrier(i,i/30);
      if(i%13===0){c.headX=c.tailX;c.headY=c.tailY;}
      if(i%17===0){c.tailX=-200;c.headX=850;}
      if(i%5===0){c.tailX+=1000;c.headX+=1000;}
      if(i%7===0){c.tailY-=1000;c.headY-=1000;}
      const args=[cols,rows,640,360,c,(i%11)/10];
      current.accumulateWormholeGrainCarrier(a,...args);previous.accumulateWormholeGrainCarrier(b,...args);
      assert.deepEqual(bytes(a),bytes(b),`carrier ${i} at ${cols}x${rows}`);cases++;
    }
    const dims=[[Math.round(cols/3),Math.round(rows/3)],[Math.round(cols/8),Math.round(rows/8)]];
    const aa=dims.map(([c,r])=>new Float32Array(c*r*4)),bb=aa.map(v=>v.slice());
    current.resolveWormholeGrainMaterial(a,cols,rows,aa[0],...dims[0],aa[1],...dims[1],0.8,0.8);
    previous.resolveWormholeGrainMaterial(b,cols,rows,bb[0],...dims[0],bb[1],...dims[1],0.8,0.8);
    for(const [x,y] of [[a,b],[aa[0],bb[0]],[aa[1],bb[1]]])assert.deepEqual(bytes(x),bytes(y));
  }
  assert.equal(cases,720);
});

if(process.env.PLEXUS_CULLING_BENCH==='1')test('carrier culling microbenchmark',()=>{
  const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
  const carriers=Array.from({length:720},(_,i)=>{
    const c=carrier(i,0.7);if(i%4!==0){c.tailX+=2000;c.headX+=2000;}return c;
  });
  for(const [cols,rows] of [[240,135],[480,270],[640,360]]){
    const buffer=new Float32Array(cols*rows*4);
    const measure=module=>{
      let elapsed=0;
      for(let frame=0;frame<12;frame++){
        buffer.fill(0);
        const t=performance.now();
        for(const c of carriers)module.accumulateWormholeGrainCarrier(buffer,cols,rows,640,360,c,1);
        elapsed+=performance.now()-t;
      }
      return elapsed/12;
    };
    for(let warmup=0;warmup<3;warmup++){measure(previous);measure(current);}
    const old=[],fast=[];
    for(let round=0;round<9;round++){
      if(round%2){fast.push(measure(current));old.push(measure(previous));}
      else{old.push(measure(previous));fast.push(measure(current));}
    }
    console.log(JSON.stringify({size:`${cols}x${rows}`,previousMs:median(old),optimizedMs:median(fast)}));
  }
});
