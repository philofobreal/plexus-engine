import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { createLoader } from './helpers/xr-loader.mjs';
const load=createLoader({}, { Uint8Array, Float32Array });
const shaders=load('visuals/gpu/WormholeGpuShaders.ts');
const {validateGpuRasterInput,WormholeGpuRaster}=load('visuals/gpu/WormholeGpuRaster.ts');
const base=()=>new Uint8Array(16*16*4);
const lines=()=>({width:16,height:16,square:false,count:0,data:new Float32Array()});
const material=()=>({cols:16,rows:16,amount:.3,bloom:.5,detail:.6,count:1,data:new Float32Array(24)});

test('all nine extracted XR shader bodies retain their independently captured predecessor identities',()=>{
    const prior=JSON.parse(readFileSync('tests/fixtures/wormhole-gpu-shader-baseline.json','utf8'));
    assert.equal(prior.sourceCommit,'1cf7f56');
    assert.equal(Object.keys(prior.hashes).length,9);
    for(const [key,hash] of Object.entries(prior.hashes))assert.equal(createHash('sha256').update(shaders[key]).digest('hex'),hash,key);
});
test('shared shader module has no runtime dependency, resource construction or side effect',()=>{
    const source=ts.createSourceFile('shader.ts',readFileSync('src/visuals/gpu/WormholeGpuShaders.ts','utf8'),ts.ScriptTarget.Latest,true);
    for(const node of source.statements)assert.ok(ts.isVariableStatement(node),'Only shader/constants declarations');
    function visit(node){
        assert.ok(!ts.isNewExpression(node)&&!ts.isImportDeclaration(node)&&!ts.isAwaitExpression(node));
        if(ts.isCallExpression(node))assert.equal(node.expression.getText(source),'Math.sqrt','No I/O or GPU calls in shared leaf');
        ts.forEachChild(node,visit);
    }
    visit(source);
});
test('GPU boundary accepts current landscape/portrait grids and active typed ranges without mutation',()=>{
    const m=material(),l=lines(),b=base(),snapshot=m.data.slice();
    validateGpuRasterInput(16,16,b,m,l);assert.deepEqual(m.data,snapshot);
    m.cols=360;m.rows=640;validateGpuRasterInput(16,16,b,m,l);
    validateGpuRasterInput(16,16,b,null,l);
});
test('GPU boundary rejects malformed dimensions, base bytes and mismatched line geometry',()=>{
    for(const width of [0,-1,NaN,Infinity,1.5,8193])assert.throws(()=>validateGpuRasterInput(width,16,base(),null,lines()));
    assert.throws(()=>validateGpuRasterInput(16,16,base().subarray(4),null,lines()));
    assert.throws(()=>validateGpuRasterInput(16,16,base(),null,{...lines(),height:17}));
    assert.throws(()=>validateGpuRasterInput(16,16,base(),null,{...lines(),square:0}));
});
test('GPU boundary refuses unbounded counts, nonfinite input and unsupported material grids',()=>{
    for(const count of [-1,1.5,32769])assert.throws(()=>validateGpuRasterInput(16,16,base(),{...material(),count},lines()));
    const m=material();m.data[7]=NaN;assert.throws(()=>validateGpuRasterInput(16,16,base(),m,lines()));
    assert.throws(()=>validateGpuRasterInput(16,16,base(),{...material(),cols:640,rows:640},lines()));
    for(const amount of [NaN,-.1,1.1])assert.throws(()=>validateGpuRasterInput(16,16,base(),{...material(),amount},lines()));
    assert.throws(()=>validateGpuRasterInput(16,16,base(),null,{...lines(),count:1,data:new Float32Array(8)}));
});
test('GPU constructor reports unavailable contexts and invalid precision without a CPU promotion',()=>{
    assert.throws(()=>new WormholeGpuRaster({getContext:()=>null}),/WebGL2 unavailable/);
    assert.throws(()=>new WormholeGpuRaster({getContext:()=>null},'auto'),/Unsupported GPU precision/);
});
