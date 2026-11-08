import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const { ExactExportFrameBridge } = createLoader()('visuals/ExactExportFrameBridge.ts');
const gate = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const config = { jobId:'test', width:1280, height:720, fps:60 };
function fixture() {
    const preparation=gate(), frames=[], reports=[]; let draws=0, disposals=0, releases=0, factoryCalls=0;
    const source={prepare:()=>preparation.promise, requestFrame(index,frame) {
        const g=gate(); frames.push({index,frame,...g}); return g.promise;
    },dispose(){disposals++;}};
    let onDraw=()=>{};
    const bridge=new ExactExportFrameBridge(()=>{factoryCalls++;return source;},()=>({}),()=>{draws++;return onDraw();},k=>reports.push(k));
    const complete=(i=frames.length-1)=>frames[i].resolve({frame:frames[i].frame,bitmap:{},raster:'gpu-material',release(){releases++;}});
    return {bridge,preparation,frames,reports,complete,set onDraw(v){onDraw=v;},get draws(){return draws;},
        get disposals(){return disposals;},get releases(){return releases;},get factoryCalls(){return factoryCalls;}};
}

test('exact bridge keeps redraw synchronous and waits for the owned image before completing a frame',async()=>{
    const h=fixture(), pixels=[]; h.preparation.resolve(); assert.equal(await h.bridge.begin(config),true);
    h.onDraw=()=>{assert.equal(h.bridge.allowDraw(),true);assert.equal(h.bridge.allowDraw(),false);assert.equal(h.bridge.frameIndex,0);h.bridge.submit({currentTime:0},lease=>pixels.push(lease.frame.currentTime));};
    assert.equal(h.bridge.allowDraw(),false,'no export-owned slot yet');
    let done=false;const rendering=h.bridge.renderFrame(0).then(()=>{done=true;}); await flush();
    assert.equal(h.draws,1);assert.equal(done,false);assert.deepEqual(pixels,[]);
    h.complete();await rendering;assert.deepEqual(pixels,[0]);assert.equal(h.releases,1);assert.equal(h.bridge.frameIndex,null);
    h.bridge.dispose();assert.equal(h.disposals,1);
});

test('native frames use redraw completion and permit later Wormhole frames on the same contiguous timeline',async()=>{
    const h=fixture();h.preparation.resolve();await h.bridge.begin(config);
    const drawing=gate();h.onDraw=()=>drawing.promise;let done=false;
    const first=h.bridge.renderFrame(0).then(()=>{done=true;});await flush();assert.equal(done,false);
    drawing.resolve();await first;assert.equal(h.frames.length,0);
    h.onDraw=()=>h.bridge.submit({},()=>{});const second=h.bridge.renderFrame(1);h.complete();await second;
    assert.equal(h.frames[0].index,1);h.bridge.dispose();
});

test('unsupported FPS keeps the original renderer without constructing a source',async()=>{
    const h=fixture();assert.equal(await h.bridge.begin({...config,fps:24}),false);assert.equal(h.factoryCalls,0);
});

test('startup failure falls back before any frame, and a fresh job may retry',async()=>{
    const h=fixture();h.preparation.reject(Error('worker unavailable'));assert.equal(await h.bridge.begin(config),false);
    assert.deepEqual(h.reports,['compatible-fallback']);assert.equal(h.draws,0);assert.equal(h.disposals,1);
    await assert.rejects(h.bridge.renderFrame(0),/not ready/);
});

test('Cancel during source preparation cannot silently restart compatible rendering',async()=>{
    const h=fixture();const starting=h.bridge.begin(config);h.bridge.cancel();h.preparation.resolve();
    await assert.rejects(starting,/cancelled/);assert.equal(h.draws,0);assert.ok(h.disposals>=1);h.bridge.dispose();
});

test('overlap, skipped indices and duplicate submissions cannot produce incomplete timelines',async()=>{
    const h=fixture();h.preparation.resolve();await h.bridge.begin(config);
    h.onDraw=()=>{h.bridge.submit({},()=>{});assert.throws(()=>h.bridge.submit({},()=>{}),/slot/);};
    await assert.rejects(h.bridge.renderFrame(1),/contiguous/);
    const frame=h.bridge.renderFrame(0);await assert.rejects(h.bridge.renderFrame(0),/contiguous/);h.complete();await frame;
    await assert.rejects(h.bridge.renderFrame(0),/contiguous/);h.bridge.dispose();
});

test('Cancel invalidates presentation but still waits for p5 redraw and releases a late image',async()=>{
    const h=fixture();h.preparation.resolve();await h.bridge.begin(config);const drawing=gate();
    h.onDraw=()=>{h.bridge.submit({},()=>assert.fail('late presentation'));return drawing.promise;};
    const frame=h.bridge.renderFrame(0);h.bridge.cancel();h.complete();await flush();
    assert.equal(h.releases,1);assert.equal(h.bridge.frameIndex,null);drawing.resolve();
    await assert.rejects(frame,/cancelled/);h.bridge.dispose();
});

test('worker failure after admission fails closed and releases the source; no compatible redraw occurs',async()=>{
    const h=fixture();h.preparation.resolve();await h.bridge.begin(config);h.onDraw=()=>h.bridge.submit({},()=>{});
    const frame=h.bridge.renderFrame(0);h.frames[0].reject(Error('exact GPU failed'));await assert.rejects(frame,/GPU failed/);
    assert.equal(h.draws,1);assert.equal(h.disposals,1);assert.equal(h.reports.at(-1),'exact-failed');h.bridge.dispose();
});

test('presentation/PostFX failure releases the leased image and fails the frame',async()=>{
    const h=fixture();h.preparation.resolve();await h.bridge.begin(config);
    h.onDraw=()=>h.bridge.submit({},()=>{throw Error('post failed');});const frame=h.bridge.renderFrame(0);h.complete();
    await assert.rejects(frame,/post failed/);assert.equal(h.releases,1);assert.equal(h.disposals,1);h.bridge.dispose();
});

test('redraw failure invalidates an already submitted image before teardown',async()=>{
    const h=fixture();h.preparation.resolve();await h.bridge.begin(config);
    h.onDraw=()=>{h.bridge.submit({},()=>assert.fail('failed redraw presented'));throw Error('draw failed');};
    const frame=h.bridge.renderFrame(0);await flush();assert.equal(h.disposals,1);h.complete();
    await assert.rejects(frame,/draw failed/);assert.equal(h.releases,1);h.bridge.dispose();
});


test('surface release waits for port disposal and is idempotent, including Stop invalidation',async()=>{
    let freed=0;const source={async prepare(){},dispose(){}};
    const bridge=new ExactExportFrameBridge(()=>source,()=>({}),()=>{},()=>{},()=>{freed++;});
    await bridge.begin(config);bridge.cancel();assert.equal(freed,0);bridge.dispose();bridge.dispose();assert.equal(freed,1);
});
