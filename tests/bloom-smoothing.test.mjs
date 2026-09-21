import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { smoothBloomLayerInPlace as legacySmooth } from './helpers/legacy-bloom-smoothing.mjs';

const source = readFileSync('src/visuals/wormholeGrainMaterialRaster.ts', 'utf8');
// Expose the private filter only in this test copy, leaving the production API unchanged.
function load(text) {
  const exports = {};
  const js = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function('exports', js)(exports);
  return exports;
}
const current = load(source + '\nexport { smoothBloomLayerInPlace };');
const start = source.indexOf('function smoothBloomLayerInPlace(');
const end = source.indexOf('\n/**', start);
assert.ok(start > 0 && end > start);
const reference = load(source.slice(0, start) + legacySmooth.toString() + source.slice(end));
const bytes = buffer => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

function fixture(cols, rows, pattern) {
  const buffer = new Float32Array(cols * rows * 4);
  let seed = 17;
  for (let i = 0; i < buffer.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    buffer[i] = pattern === 0 ? 0 : pattern === 1 ? (i % 4 + 1) / 4
      : pattern === 2 ? (i === Math.floor(rows / 2) * cols * 4 + Math.floor(cols / 2) * 4 + 3 ? 1 : 0)
      : (seed / 4294967296) * (i % 11 === 0 ? 4 : 1);
  }
  return buffer;
}

test('RGBA bloom traversal preserves every Float32 bit of the former filter', () => {
  let cases = 0;
  for (const [cols, rows] of [[1,1],[1,37],[41,1],[2,2],[7,11],[11,7],[80,45],[107,60],[160,90],[213,120],[60,107],[80,80]]) {
    for (const pattern of [0,1,2,3]) for (const passes of [0,1,3,5]) for (const keep of [0,0.4,0.5,1]) {
      const actual = fixture(cols, rows, pattern), expected = actual.slice();
      current.smoothBloomLayerInPlace(actual, cols, rows, passes, keep);
      legacySmooth(expected, cols, rows, passes, keep);
      assert.deepEqual(bytes(actual), bytes(expected), `${cols}x${rows}, pattern ${pattern}, passes ${passes}, keep ${keep}`);
      cases++;
    }
  }
  assert.equal(cases, 768);
});

test('complete material resolve and bloom match the legacy filter at preview/export tiers', () => {
  let cases = 0;
  for (const [width,height] of [[1920,1080],[1080,1920]]) {
    for (const [exporting,compact] of [[false,false],[false,true],[true,false]]) {
      for (const detail of [0,0.25,0.5,0.75,1]) {
        const {cols,rows} = current.resolveWormholeGrainMaterialRasterSize(width,height,detail,exporting,{},compact);
        const c1 = Math.max(1,Math.round(cols/3)), r1 = Math.max(1,Math.round(rows/3));
        const c2 = Math.max(1,Math.round(cols/8)), r2 = Math.max(1,Math.round(rows/8));
        for (const [amount,bloom] of [[0,1],[0.2,0],[0.5,0.5],[1,1]]) {
          const a = [fixture(cols,rows,3),new Float32Array(c1*r1*4),new Float32Array(c2*r2*4)];
          const b = a.map(v=>v.slice());
          // Stale bloom data must also be replaced in bypass cases.
          a[1].fill(0.7); a[2].fill(0.3); b[1].fill(0.7); b[2].fill(0.3);
          for (const [module,buffers] of [[current,a],[reference,b]]) {
            module.resolveWormholeGrainMaterial(buffers[0],cols,rows,buffers[1],c1,r1,buffers[2],c2,r2,amount,bloom);
          }
          for (let layer=0;layer<3;layer++) assert.deepEqual(bytes(a[layer]),bytes(b[layer]));
          cases++;
        }
      }
    }
  }
  assert.equal(cases,120);
});

// Opt-in microbenchmark; timings are evidence, never a flaky pass/fail threshold.
if (process.env.PLEXUS_BLOOM_BENCH === '1') test('bloom smoothing microbenchmark', () => {
  const median = values => values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
  for (const [cols,rows] of [[240,135],[480,270],[640,360]]) {
    const layers = [[Math.round(cols/3),Math.round(rows/3),3,0.5],[Math.round(cols/8),Math.round(rows/8),5,0.4]];
    const buffers = layers.map(([c,r])=>fixture(c,r,3));
    const seed = buffers.map(v=>v.slice());
    const measure = fn => {
      let elapsed = 0;
      for (let frame=0;frame<40;frame++) {
        buffers.forEach((buffer,i)=>buffer.set(seed[i]));
        const before = performance.now();
        layers.forEach(([c,r,p,k],i)=>fn(buffers[i],c,r,p,k));
        elapsed += performance.now()-before;
      }
      return elapsed/40;
    };
    for (let warmup=0;warmup<3;warmup++) { measure(legacySmooth); measure(current.smoothBloomLayerInPlace); }
    const old=[], optimized=[];
    for (let round=0;round<9;round++) {
      if(round%2) { optimized.push(measure(current.smoothBloomLayerInPlace)); old.push(measure(legacySmooth)); }
      else { old.push(measure(legacySmooth)); optimized.push(measure(current.smoothBloomLayerInPlace)); }
    }
    console.log(JSON.stringify({l0:`${cols}x${rows}`,legacyMs:median(old),optimizedMs:median(optimized)}));
  }
});
