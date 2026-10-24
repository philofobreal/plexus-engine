import test from'node:test';import assert from'node:assert/strict';
import{createLoader}from'./helpers/xr-loader.mjs';
import{bandSpecs,bandFixture}from'./fixtures/band-onset-robustness.mjs';
function legacyAppend(candidates,proposals,separation){for(const p of proposals)if(!candidates.some(c=>Math.abs(c.sampleIndex-p.sampleIndex)<separation))candidates.push(p);}
const load=createLoader({}, {Float32Array,Float64Array}),append=load('analyzer/BandProposalIndex.ts').appendSeparatedBandProposals;

test('sample buckets preserve strict distance, prior ownership, proposal order and original object metadata',()=>{
 const base=[{sampleIndex:14,id:'prior'}],proposals=[{sampleIndex:7,id:'edge'},{sampleIndex:8,id:'too-near'},
  {sampleIndex:21,id:'edge2'},{sampleIndex:27,id:'blocked'},{sampleIndex:28,id:'edge3'}];
 const a=base.slice(),b=base.slice();legacyAppend(a,proposals,7);append(b,proposals,7);assert.deepEqual(a,b);
 assert.equal(b.map(p=>p.id).join(),'prior,edge,edge2,edge3');assert.equal(b[1],proposals[0]);
 assert.throws(()=>append([],[],0));assert.throws(()=>append([],[],1.5));
});

test('deterministic crowded and sparse sample-index matrices match the complete previous merge exactly',()=>{
 let seed=44271;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(const separation of [1,2,7,309,672])for(let caseNo=0;caseNo<40;caseNo++){
  const base=Array.from({length:caseNo},(_,i)=>({sampleIndex:next()%5000,id:'b'+i}));
  const proposals=Array.from({length:300},(_,i)=>({sampleIndex:next()%8000,id:'p'+i,metadata:{support:i}})).sort((a,b)=>a.sampleIndex-b.sampleIndex);
  const a=base.slice(),b=base.slice();legacyAppend(a,proposals,separation);append(b,proposals,separation);assert.deepEqual(a,b);
 }
});

test('sparse merge removes quadratic sample-index reads without a wall-clock test threshold',()=>{
 const measure=fn=>{let reads=0;const proposals=Array.from({length:1000},(_,i)=>({get sampleIndex(){reads++;return i*20;}}));fn([],proposals,7);return reads;};
 const old=measure(legacyAppend),now=measure(append);assert.ok(old>900000);assert.ok(now<5000);assert.ok(old>now*100);
});

test('full captured physical-band output is unchanged on all 112 authored transfer conditions',()=>{
 const before=createLoader({'./BandProposalIndex':{appendSeparatedBandProposals:legacyAppend}},{Float32Array,Float64Array})('analyzer/BandOnsets.ts').extractBandOnsets,after=load('analyzer/BandOnsets.ts').extractBandOnsets;
 for(const spec of bandSpecs()){
  const fixture=bandFixture(spec);assert.equal(JSON.stringify(before(fixture.samples,spec.sampleRate)),JSON.stringify(after(fixture.samples,spec.sampleRate)),spec.id);
 }
});
