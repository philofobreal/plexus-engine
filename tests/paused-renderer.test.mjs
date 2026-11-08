import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function createHarness(applyAutomatedSpiral, createWormholeWorker, gain, postProbe, identities, createExactWormholeSource) {
  let p;
  let time = 0;
  let draws = 0;
  let updates = 0;
  let position;
  const cache = new Map();
  const preference = { compactMaterialPreview: false, pixelRatioCap: 2, maxBackingLongEdge: 1920 };
  const boost = {};
  class FakeP5 {
    constructor(sketch) {
      p = this;
      this.windowWidth = this.width = 1280;
      this.windowHeight = this.height = 720;
      this.frameCount = 0;
      this.deltaTime = 1000 / 30;
      this.density = 2;
      sketch(this);
      this.setup();
    }
    createCanvas(w, h) { this.width=w;this.height=h;this.canvas={width:w,height:h,dataset:{}};
      this.drawingContext={canvas:this.canvas,save(){},restore(){},setTransform(){},clearRect(){},drawImage(){}};
      return {parent(){},elt:this.canvas}; }
    remove() {}
    redraw() { this.frameCount++; this.draw(); return Promise.resolve(); }
    createGraphics(width,height) { const canvas={width,height},g={width,height,elt:canvas,
      pixelDensity:()=>this.density,clear(){},remove(){},resizeCanvas(w,h){this.width=w;this.height=h;canvas.width=w;canvas.height=h;}};
      g.drawingContext={canvas,save(){},restore(){},setTransform(){},clearRect(){},drawImage(){}};
      return g; }
    pixelDensity(value) { if (value !== undefined) this.density = value; return this.density; }
    resizeCanvas(w, h) { this.width = w; this.height = h; }
    frameRate() {}
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, {
      exports, Worker: class {}, OffscreenCanvas: class {}, window: { devicePixelRatio: 2 },
      require(id) {
        if (id === 'p5') return FakeP5;
        if (id === './Particle') return { Particle: class {} };
        const base = resolve(dirname(file), id);
        return load(existsSync(base) && base.endsWith('.ts') ? base : existsSync(base + '.ts') ? base + '.ts' : resolve(base, 'index.ts'));
      }
    });
    return exports;
  }
  const { State } = load(resolve('src/state/store.ts'));
  if (postProbe) { const Pipeline=load(resolve('src/visuals/PostFxPipeline.ts')).PostFxPipeline;
    Pipeline.prototype.render=function(host,time){postProbe(this.readState(),time);}; }
  const { startPlexusRenderer } = load(resolve('src/visuals/PlexusRenderer.ts'));
  const identity = { id: createWormholeWorker ? 'cosmic-wormhole' : 'test', draw() { draws++; }, syncPosition() {} };
  startPlexusRenderer('preview', {
    setExportTarget() {}, updateDashboard() { updates++; },
    applyAutomatedSpiral,
    getTuningForMorph(target) { Object.assign(boost, target, overrides); gain?.(boost, target); return boost; }
  }, {
    getCurrentTime: () => time,
    addPositionChangedListener(listener) { position = listener; },
    addPlaybackEndedListener() {}, syncMetronomeState() {}
  }, { get: id => identities?.[id] ?? identity, forEach: fn => identities ? Object.values(identities).forEach(fn) : fn(identity) }, undefined, { previewQuality: preference, createWormholeWorker, createExactWormholeSource });
  const overrides = {};
  return {
    State, p, preference, overrides, flags: load(resolve('src/config/featureFlags.ts')).featureFlags,
    get draws() { return draws; }, get updates() { return updates; },
    tick(count = 1) { for (let i = 0; i < count; i++) { p.frameCount++; p.draw(); } },
    seek(value) { time = value; position(value); },
    advance(value) { time += value; }
  };
}

test('unchanged welcome and paused previews do not redraw identities or dashboard canvases', () => {
  const h = createHarness();
  h.tick(600);
  assert.equal(h.draws, 1);
  assert.equal(h.updates, 1);
  h.State.duration = 8;
  h.tick(1);
  const draws = h.draws, updates = h.updates;
  h.tick(600);
  assert.equal(h.draws, draws);
  assert.equal(h.updates, updates);
});

test('actual MVP/dashboard renderer follows semantic time once with aliased gains, pause and plan removal',()=>{
 const h=createHarness(undefined,undefined,(out,target)=>{out.wormholeSpeed=target.wormholeSpeed*2;});
 h.State.visualMode='cosmic-wormhole';h.State.duration=8;
 const base={...h.State.targetTuning,wormholeSpeed:.35,transitionSpeed:0};
 h.State.targetTuning={...base};h.State.semanticBaseTuning={...base};h.State.visualTuning={...base,wormholeSpeed:.7};
 const f=(time,progress)=>({time,motifId:'a',actions:{accelerate:progress},activeOperators:[],motifIntensity:0,motifDensity:0,motifMotion:0,novelty:0,
  transition:{behavior:'morph',progress,preserve:[],fromMotif:'void-minimal',toMotif:'tunnel-drive'}});
 const plan={version:1,frames:[f(2,0),f(3,.5),f(3.999999,1)],score:{version:1,motifs:[],transitions:[{fromMotifId:'a',toMotifId:'b',startTime:2,duration:2,behavior:'morph',curve:'linear',preserve:[]}]}};
 h.State.visualChoreography=plan;h.seek(2.5);h.tick();
 assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.2)<1e-10,'base.7 + gained semantic1.5 exactly once');
 const canonical=h.State.currentChoreography,token=h.State.activeVisualTransitionId;
 h.seek(2.75);h.tick();assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.95)<1e-10);
 assert.equal(h.State.currentChoreography,canonical);assert.equal(h.State.activeVisualTransitionId,token);
 h.tick(120);assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.95)<1e-10);
 h.seek(2.5);h.tick();assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-2.2)<1e-10);
 h.State.visualChoreography=null;h.tick();assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-.7)<1e-10);
 assert.equal(h.State.targetTuning.wormholeSpeed,.35);
 h.State.visualChoreography=plan;h.tick();h.flags.semanticResolver=false;h.tick();
 assert.ok(Math.abs(h.State.visualTuning.wormholeSpeed-.7)<1e-10);assert.equal(h.State.targetTuning.wormholeSpeed,.35);
});

test('the host spiral channel runs once after tuning with the canonical live/export time, including seeks', () => {
  const calls = [];
  const anchor = { id: 'automation:p', time: 2 };
  const h = createHarness((time, tuning) => { calls.push(time); tuning.wormholeSpiralDirection = -.5; return anchor; });
  h.State.isPlaying = true;
  h.seek(2.5); h.tick();
  assert.equal(calls.at(-1), 2.5); assert.equal(h.State.visualTuning.wormholeSpiralDirection, -.5);
  assert.equal(h.State.spiralTransitionAnchor, anchor);
  h.State.isExporting = true; h.State.exportTime = 7.25; h.tick();
  assert.equal(calls.at(-1), 7.25, 'the export clock is used even though live transport is elsewhere');
  h.State.isExporting = false; h.seek(.1); h.tick();
  assert.equal(calls.at(-1), .1); assert.equal(calls.length, h.draws, 'one application per identity frame');
});

test('low-frequency frame publication agrees across playback, seek and export without mutating analysis', () => {
  const h = createHarness();
  h.State.duration = 4; h.State.sampleRate = 1024; h.State.hopSize = 1024;
  h.State.frames = Array.from({ length: 4 }, (_, i) => Object.freeze({ e: 0.3, eRatio: 0.3,
    densityProj: 0, melodyProj: 0, fxProj: 0, perceptualSpectrum: new Array(24).fill(0), state: 'LOW',
    subEnergy: i * 0.2, bassEnergy: i * 0.1, subFlux: i * 0.05, bassFlux: i * 0.08 }));
  h.State.trackAnalysis.features = Array.from({ length: 4 }, () => ({ melody: 0, vocal: 0, fx: 0, density: 0, brightness: 0, tension: 0 }));
  h.State.visualTuning.audioSensitivity = h.State.targetTuning.audioSensitivity = 1;
  const keys = ['subEnergy','bassEnergy','subFlux','bassFlux'];
  const values = () => keys.map(k => h.State.modulation[k]);
  h.State.isPlaying = true; h.seek(2); h.tick();
  const live = values(); assert.deepEqual(live, keys.map(k => h.State.frames[2][k]));
  h.seek(0); h.tick(); assert.ok(values().every(v => v === 0));
  h.seek(2); h.tick(); assert.deepEqual(values(), live);
  h.State.isPlaying = false; h.State.isExporting = true; h.State.exportTime = 2; h.tick();
  assert.deepEqual(values(), live);
  assert.equal(h.State.frames[2].subEnergy, 0.4);
  h.State.frames[1] = { e: 0, eRatio: 0, densityProj: 0, melodyProj: 0, fxProj: 0, perceptualSpectrum: new Array(24).fill(0), state: 'LOW' };
  h.State.exportTime = 1; h.tick(); assert.ok(values().every(v => v === 0));
});

test('pause settles once, resume and every export frame bypass the idle gate', () => {
  const h = createHarness();
  h.State.duration = 8;
  h.State.isPlaying = true;
  h.tick(60);
  assert.equal(h.draws, 60);
  h.State.isPlaying = false;
  h.tick(90);
  assert.equal(h.State.playbackFade, 0);
  const settled = h.draws;
  h.tick(600);
  assert.equal(h.draws, settled);
  h.State.isPlaying = true;
  h.tick(1);
  assert.equal(h.draws, settled + 1);
  h.State.isPlaying = false;
  h.State.playbackFade = 0;
  h.State.isExporting = true;
  for (let i = 0; i < 5; i++) { h.State.exportTime = i / 60; h.tick(); }
  assert.equal(h.draws, settled + 6);
});

test('in-place tuning, reused MVP boost results, seek, mode, quality and resize invalidate paused pixels', () => {
  const h = createHarness();
  h.tick(3);
  const actions = [
    () => { h.State.visualTuning.lineWeight += 1; },
    () => { h.State.targetTuning.wormholeGrainShape = 1; },
    () => { h.overrides.wormholeGrainShape = 0; },
    () => { h.seek(0); }, // Explicit same-position reset must also refresh.
    () => { h.seek(4); },
    () => { h.State.visualMode = 'classic'; },
    () => { h.preference.pixelRatioCap = 1.25; h.preference.maxBackingLongEdge = 1280; h.preference.compactMaterialPreview = true; },
    () => { h.p.windowWidth = 1600; h.p.windowResized(); },
    () => { h.State.trackAnalysis = { ...h.State.trackAnalysis }; }
  ];
  for (const action of actions) {
    const before = h.draws;
    action();
    h.tick(3);
    assert.ok(h.draws > before, 'changed input must refresh paused preview');
    const after = h.draws;
    h.tick(120);
    assert.equal(h.draws, after, 'changed input must settle back to zero repeated draws');
  }
});


test('real renderer factory uses worker preview, invalidates paused frames, resets on seek and bypasses async frames for export', () => {
  const sources=[];let invalidation;
  const h=createHarness(undefined, invalidate=>{
    invalidation=invalidate;const source={draws:0,resets:0,disposed:0,rasterKind:'offscreen-webgl',
      draw(state,target,depth,transparent,playing){this.draws++;this.time=state.currentTime;return true;},
      reset(){this.resets++;},dispose(){this.disposed++;}};sources.push(source);return source;
  });
  h.preference.wormholeRenderer='offscreen';h.tick();
  assert.equal(sources.length,1);assert.equal(sources[0].draws,1);assert.equal(h.draws,0);
  h.tick(30);assert.equal(sources[0].draws,1);
  invalidation();h.tick();assert.equal(sources[0].draws,2);
  h.seek(4);h.tick();assert.equal(sources[0].resets,1);assert.equal(sources[0].time,4);
  h.State.isExporting=true;h.State.exportTime=7.25;h.tick();
  assert.equal(h.draws,1);assert.equal(sources[0].draws,3);assert.equal(sources[0].disposed,1);
  assert.equal(h.p.canvas.dataset.wormholeRaster,'compatible');
  h.State.isExporting=false;h.tick();assert.equal(sources.length,2);
  h.preference.wormholeRenderer='compatible';h.tick();assert.equal(sources[1].disposed,1);
  h.preference.wormholeRenderer='offscreen';h.tick();assert.equal(sources.length,3);
  h.p.remove();assert.equal(sources[2].disposed,1);
});

test('worker image and PostFX use the same frozen tuning, signals and song time',()=>{
    const seen=[],source={rasterKind:'offscreen-gpu-material',presentedFrame:null,draw(){return true;},reset(){},dispose(){}};
    const h=createHarness(undefined,()=>source,undefined,(s,time)=>seen.push({time,tuning:s.visualTuning,director:s.directorOutput,modulation:s.modulation}));
    source.presentedFrame={currentTime:1,visualTuning:{...h.State.visualTuning,postFxFragmentAmount:.8},
        directorOutput:{...h.State.directorOutput,glitchIntensity:.9},modulation:{...h.State.modulation,spectralChaos:.7}};
    h.preference.wormholeRenderer='offscreen';h.State.visualMode='cosmic-wormhole';h.State.isPlaying=true;
    h.advance(4);h.tick();
    assert.equal(seen.at(-1).time,1);assert.equal(seen.at(-1).tuning,source.presentedFrame.visualTuning);
    assert.equal(seen.at(-1).director,source.presentedFrame.directorOutput);
    assert.equal(seen.at(-1).modulation,source.presentedFrame.modulation);
    assert.notEqual(seen.at(-1).tuning,h.State.visualTuning,'live state is never swapped or mutated for async composition');
    h.State.isExporting=true;h.State.exportTime=2;h.tick();
    assert.equal(seen.at(-1).time,2);assert.equal(seen.at(-1).tuning,h.State.visualTuning,'export keeps its synchronous owner');
});

for (const wormholeIncoming of [true,false]) test('renderer presents a complete worker/native pair once, in direction '+wormholeIncoming,()=>{
 const posts=[],native=[],sources=[];let active;
 const identities={classic:{id:'classic',usesSharedSimulation:true,syncPosition(){},draw(b,p,w,c){native.push({...c});}},
  'cosmic-wormhole':{id:'cosmic-wormhole',draw(){throw Error('Worker fast path must not draw main Wormhole');},syncPosition(){}}};
 const h=createHarness(undefined,()=>{
  const source={rasterKind:'offscreen-gpu-material',presentedFrame:null,pending:null,awaiting:false,disposed:0,
   draw(state,target,depth,transparent,playing,display,pair){
    if(pair&&!this.pending&&!this.awaiting){this.pending={currentTime:state.currentTime,visualTuning:{...state.visualTuning},
     modulation:{...state.modulation},directorOutput:{...state.directorOutput}};pair.capture(this.pending);}
    if(this.presentedFrame)target.presentRaster({});return true;
   },complete(){this.presentedFrame=this.pending;this.pending=null;this.awaiting=true;},
   acknowledgePresented(frame){assert.equal(frame,this.presentedFrame);this.awaiting=false;},reset(){},dispose(){this.disposed++;}};
  sources.push(source);active=source;return source;
 },undefined,(state,time)=>posts.push({state,time}),identities);
 h.preference.wormholeRenderer='offscreen';h.State.isPlaying=true;
 h.State.visualMode=wormholeIncoming?'cosmic-wormhole':'classic';
 h.State.visualModeTransition={from:wormholeIncoming?'classic':'cosmic-wormhole',to:h.State.visualMode,startTimeSec:0,durationSec:1,generation:10};
 h.advance(.1);h.tick();h.advance(.1);h.tick();
 assert.equal(native.length,2);assert.ok(native.every(c=>c.advanceSharedSimulation));assert.equal(posts.length,0,'no PostFX on retained pixels');
 active.complete();h.advance(.1);h.tick();
 assert.equal(posts.length,1);assert.equal(posts[0].time,.1);assert.equal(posts[0].state.visualTuning,active.presentedFrame.visualTuning);
 assert.equal(native.length,3);assert.ok(h.State.visualModeTransition,'only the completed song time can finish a transition');
 h.advance(.9);h.tick();assert.equal(posts.length,1);active.complete();h.advance(.1);h.tick();
 assert.equal(posts.length,2);assert.ok(Math.abs(posts[1].time-1.2)<1e-12);assert.equal(h.State.visualModeTransition,null);
 assert.equal(native.length,5);h.p.remove();assert.equal(sources[0].disposed,1);
});

test('renderer worker failure after counterpart capture never advances native simulation twice',()=>{
 let advances=0,draws=0,wormhole=0;
 const identities={classic:{id:'classic',usesSharedSimulation:true,syncPosition(){},draw(b,p,w,c){draws++;if(c.advanceSharedSimulation)advances++;}},
  'cosmic-wormhole':{id:'cosmic-wormhole',draw(){wormhole++;},syncPosition(){}}};
 const h=createHarness(undefined,()=>({rasterKind:'fallback',acknowledgePresented(){},reset(){},dispose(){},
  draw(state,target,depth,transparent,playing,display,pair){pair.capture({currentTime:state.currentTime});return false;}}),undefined,()=>{},identities);
 h.preference.wormholeRenderer='offscreen';h.State.isPlaying=true;h.State.visualMode='cosmic-wormhole';
 h.State.visualModeTransition={from:'classic',to:'cosmic-wormhole',startTimeSec:0,durationSec:1,generation:1};
 h.advance(.2);h.tick();assert.equal(advances,1);assert.equal(draws,2,'the fallback redraw borrows the already advanced pool');
 assert.equal(wormhole,1);assert.equal(h.p.canvas.dataset.wormholeRaster,'fallback');h.p.remove();
});


for (const direction of ['steady','incoming','outgoing']) test('exact export renderer barrier pairs captured signals and one PostFX: '+direction,async()=>{
 const posts=[],native=[],requests=[];let released=0,disposed=0;
 const identities={classic:{id:'classic',usesSharedSimulation:true,syncPosition(){},draw(b,p,w,c){native.push({...c});}},
  'cosmic-wormhole':{id:'cosmic-wormhole',draw(){assert.fail('exact frame must not use main-thread Wormhole');},syncPosition(){}}};
 const source={async prepare(){},requestFrame(index,frame){return new Promise(resolve=>requests.push({index,frame:structuredClone(frame),resolve}));},dispose(){disposed++;}};
 const h=createHarness(undefined,undefined,undefined,(s,time)=>posts.push({time,tuning:s.visualTuning,isExporting:s.isExporting}),identities,()=>source);
 h.preference.wormholeRenderer='offscreen';h.State.isExporting=true;h.State.exportTime=0;
 h.State.visualMode=direction==='outgoing'?'classic':'cosmic-wormhole';
 if(direction!=='steady')h.State.visualModeTransition={from:direction==='incoming'?'classic':'cosmic-wormhole',to:h.State.visualMode,startTimeSec:-.5,durationSec:1,generation:1};
 const port=h.p.__plexusExportFramePort;assert.equal(await port.begin({jobId:'renderer',width:1280,height:720,fps:60}),true);
 let finished=false;const rendering=port.renderFrame(0).then(()=>{finished=true;});await Promise.resolve();
 assert.equal(finished,false);assert.equal(posts.length,0);assert.equal(requests.length,1);
 assert.equal(native.length,direction==='steady'?0:1);assert.ok(native.every(c=>c.advanceSharedSimulation));
 const r=requests[0];assert.equal(r.index,0);assert.equal(r.frame.frameCount,1);assert.equal(r.frame.density,1);assert.equal(r.frame.compact,false);
 h.State.visualTuning.postFxFragmentAmount=.999;h.State.currentTime=99;
 r.resolve({frame:r.frame,bitmap:{},raster:'gpu-material',release(){released++;}});await rendering;
 assert.equal(posts.length,1);assert.equal(posts[0].time,0);assert.equal(posts[0].isExporting,true);
 assert.equal(posts[0].tuning,r.frame.visualTuning);assert.notEqual(posts[0].tuning,h.State.visualTuning);
 assert.equal(released,1);assert.equal(h.p.canvas.dataset.exportRaster,'exact-gpu-material');
 port.dispose();h.p.remove();assert.equal(disposed,1);
});
