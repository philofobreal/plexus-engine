import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

function createLoader() {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module);
    const resolve = request => {
      const base = normalize(join(dirname(path), request));
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require: resolve, Math, Number, Object, Array, Map, Set });
    return module.exports;
  }
  return relative => load(join(SRC_ROOT, relative));
}

test('computeCrossfadeAlpha handles start, midpoint, completion, and backward time', () => {
  const load = createLoader();
  const { computeCrossfadeAlpha } = load('visuals/IdentityTransitionController.ts');
  assert.equal(computeCrossfadeAlpha(10, 10, 2), 0);
  assert.equal(computeCrossfadeAlpha(11, 10, 2), 0.5);
  assert.equal(computeCrossfadeAlpha(12, 10, 2), 1);
  assert.equal(computeCrossfadeAlpha(9, 10, 2), 1);
});

test('requestVisualModeChange flips synchronously, skips paused blending, and anchors export time', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange, clearVisualModeTransition } = load('state/visualModeTransition.ts');

  State.visualMode = 'classic';
  State.isPlaying = false;
  State.isExporting = false;
  requestVisualModeChange('temporal', { durationSec: 2 });
  assert.equal(State.visualMode, 'temporal');
  assert.equal(State.visualModeTransition, null);

  State.isExporting = true;
  State.exportTime = 42.25;
  requestVisualModeChange('cyberpunk', { durationSec: 1.5 });
  assert.equal(State.visualMode, 'cyberpunk');
  assert.equal(State.visualModeTransition.startTimeSec, 42.25);
  assert.equal(State.visualModeTransition.durationSec, 1.5);
  clearVisualModeTransition();
});

test('requestVisualModeChange clamps active dual rendering to 0.1..4 seconds', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange } = load('state/visualModeTransition.ts');
  State.visualMode = 'classic'; State.currentTime = 2; State.isPlaying = true; State.isExporting = false;
  requestVisualModeChange('temporal', { durationSec: 99 });
  assert.equal(State.visualModeTransition.durationSec, 4);
  requestVisualModeChange('cyberpunk', { durationSec: 0.001 });
  assert.equal(State.visualModeTransition.durationSec, 0.1);
});

test('Phase 1 compositor uses source-over and forbids additive lighter blending', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals/P5RenderTargetCompositor.ts'), 'utf8');
  assert.match(source, /globalCompositeOperation = 'source-over'/);
  assert.doesNotMatch(source, /globalCompositeOperation = 'lighter'/);
  assert.match(source, /globalAlpha = 1 - mix;[\s\S]*outgoing[\s\S]*globalAlpha = mix;[\s\S]*incoming/);
  const beginFrame = source.match(/beginFrame\([^]*?\n    \}/)?.[0] ?? '';
  assert.match(beginFrame, /this\.outgoing\.clear\(\)/);
  assert.match(beginFrame, /this\.incoming\.clear\(\)/);
  assert.doesNotMatch(beginFrame, /activeGeneration|generation !==/);
});

test('controller composites only while active and advances shared simulation exactly once', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange } = load('state/visualModeTransition.ts');
  const { IdentityTransitionController } = load('visuals/IdentityTransitionController.ts');
  const calls = [];
  const outgoing = { id: 'classic', usesSharedSimulation: true, draw: (_b, _p, _s, c) => calls.push(['out', c.advanceSharedSimulation, c.timeSec]) };
  const incoming = { id: 'temporal', usesSharedSimulation: true, draw: (_b, _p, _s, c) => calls.push(['in', c.advanceSharedSimulation, c.timeSec]) };
  const registry = { get: id => id === 'classic' ? outgoing : incoming };
  const compositor = {
    outgoingBackend: {}, incomingBackend: {}, beginCalls: 0, compositeCalls: 0,
    beginFrame() { this.beginCalls++; }, composite() { this.compositeCalls++; }
  };
  const backend = { width: 960, height: 540 };
  const controller = new IdentityTransitionController();

  State.visualMode = 'classic';
  State.currentTime = 5;
  State.isPlaying = true;
  State.isExporting = false;
  requestVisualModeChange('temporal', { durationSec: 2 });
  controller.draw(5.5, backend, compositor, registry, [], []);
  assert.deepEqual(calls, [['in', true, 5.5], ['out', false, 5.5]]);
  assert.equal(compositor.beginCalls, 1);
  assert.equal(compositor.compositeCalls, 1);

  calls.length = 0;
  controller.draw(7, backend, compositor, registry, [], []);
  assert.deepEqual(calls, [['in', true, 7]]);
  assert.equal(compositor.beginCalls, 1);
  assert.equal(compositor.compositeCalls, 1);
});

test('non-pool incoming identity delegates the single simulation advance to outgoing', () => {
  const load = createLoader();
  const { State } = load('state/store.ts');
  const { requestVisualModeChange } = load('state/visualModeTransition.ts');
  const { IdentityTransitionController } = load('visuals/IdentityTransitionController.ts');
  const calls = [];
  const outgoing = { id: 'classic', usesSharedSimulation: true, draw: (_b, _p, _s, c) => calls.push(['out', c.advanceSharedSimulation]) };
  const incoming = { id: 'cosmic-wormhole', draw: (_b, _p, _s, c) => calls.push(['in', c.advanceSharedSimulation]) };
  const registry = { get: id => id === 'classic' ? outgoing : incoming };
  const compositor = { outgoingBackend: {}, incomingBackend: {}, beginFrame() {}, composite() {} };
  State.visualMode = 'classic'; State.currentTime = 0; State.isPlaying = true; State.isExporting = false;
  requestVisualModeChange('cosmic-wormhole', { durationSec: 1 });
  new IdentityTransitionController().draw(0.5, { width: 1, height: 1 }, compositor, registry, [], []);
  assert.deepEqual(calls, [['out', true], ['in', false]]);
});

function sourceFiles(root) {
  const result = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) result.push(...sourceFiles(path));
    else if (path.endsWith('.ts')) result.push(path);
  }
  return result;
}

test('State.visualMode has one runtime writer', () => {
  const writers = sourceFiles(SRC_ROOT).filter(path => /State\.visualMode\s*=(?!=)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(writers.map(path => normalize(path)), [normalize(join(SRC_ROOT, 'state/visualModeTransition.ts'))]);
});


function pairHarness(incomingWormhole=true) {
  const load=createLoader(),{WorkerIdentityTransition}=load('visuals/WorkerIdentityTransition.ts');
  const helper=new WorkerIdentityTransition(),draws=[],composites=[],freezes=[];
  const scratch={},frozen={};let pending=null,shown=null,awaiting=false,key='',fail=false;
  const source={rasterKind:'offscreen-gpu-material',get presentedFrame(){return shown;},
    draw(state,target,depth,transparent,playing,display,pair){
      if(fail)return false;
      if(key!==pair.key){key=pair.key;pending=shown=null;awaiting=false;}
      if(!pending&&!awaiting){const frame={...state};pair.capture(frame);pending=frame;}
      if(shown)target.presentRaster({time:shown.currentTime});
      return true;
    },acknowledgePresented(frame){assert.equal(frame,shown);awaiting=false;},reset(){pending=shown=null;awaiting=false;},dispose(){}};
  const compositor={incomingBackend:scratch,outgoingBackend:frozen,beginFrame(){},composite(){},
    beginPairedFrame(){scratch.time=null;},freezePairedCounterpart(){frozen.time=scratch.time;freezes.push(scratch.time);},
    compositePaired(alpha,image,incoming){composites.push({alpha,workerTime:image.time,nativeTime:frozen.time,incoming});}};
  const w={id:'cosmic-wormhole'},other={id:'classic',usesSharedSimulation:true};
  const transition={from:incomingWormhole?'classic':'cosmic-wormhole',to:incomingWormhole?'cosmic-wormhole':'classic',generation:1,startTimeSec:0,durationSec:1};
  const input={time:0,transition,state:{currentTime:0},incoming:incomingWormhole?w:other,outgoing:incomingWormhole?other:w,
    source,compositor,target:{width:100,height:60,rasterPixelRatio:1,compactMaterialPreview:false,frameCount:1},
    depthCue:0,transparent:false,playing:true,revision:'0',particles:[],shockwaves:[],
    drawIdentity(identity,backend,pool,waves,context){assert.equal(identity,other);backend.time=context.timeSec;draws.push({...context});}};
  return {input,helper,draws,composites,freezes,step(t){input.time=input.state.currentTime=t;return helper.draw(input);},
    complete(){shown=pending;pending=null;awaiting=true;},fail(){fail=true;},stale(frame){shown=frame;awaiting=true;}};
}
for(const incoming of [false,true])test('paired transition keeps times/weights matched and native simulation once, Wormhole incoming '+incoming,()=>{
  const h=pairHarness(incoming);assert.equal(h.step(.1).frame,null);
  h.step(.2);h.step(.3);assert.deepEqual(h.freezes,[.1]);assert.equal(h.composites.length,0,'no incomplete image reaches main');
  h.complete();const accepted=h.step(.4).frame;assert.equal(accepted.currentTime,.1);
  assert.deepEqual(h.composites,[{alpha:.028000000000000004,workerTime:.1,nativeTime:.1,incoming}]);
  h.step(.5);assert.deepEqual(h.freezes,[.1,.5]);assert.equal(h.composites.length,1,'old worker image cannot mix with fresh native pixels');
  h.complete();h.step(.6);assert.equal(h.composites[1].nativeTime,.5);assert.equal(h.composites[1].workerTime,.5);
  assert.equal(h.draws.length,6);assert.ok(h.draws.every(c=>c.advanceSharedSimulation),'one native pool advance per host draw, including wait');
});
test('paired transition rejects mismatched metadata after replacement and reports fallback without a second advance',()=>{
  const h=pairHarness();h.step(.1);h.input.transition={...h.input.transition,generation:2};h.step(.2);
  h.stale({currentTime:.1});assert.equal(h.step(.3).frame,null);assert.equal(h.composites.length,0);
  h.complete();h.step(.4);assert.equal(h.composites[0].workerTime,.2);
  h.fail();const r=h.step(.5);assert.equal(r.handled,false);assert.equal(r.advanced,false);
  assert.equal(h.draws.length,4,'failed source leaves the normal controller as sole simulation owner');
});
test('only controller completion for the current generation can clear an asynchronous transition',()=>{
  const l=createLoader(),{State}=l('state/store.ts'),{requestVisualModeChange}=l('state/visualModeTransition.ts');
  const C=l('visuals/IdentityTransitionController.ts').IdentityTransitionController,c=new C();
  State.isPlaying=true;State.currentTime=1;State.visualMode='classic';requestVisualModeChange('cosmic-wormhole',{durationSec:1});
  const generation=State.visualModeTransition.generation;
  c.finishPairedFrame(generation+1,3);assert.ok(State.visualModeTransition);
  c.finishPairedFrame(generation,1.5);assert.ok(State.visualModeTransition);
  c.finishPairedFrame(generation,2);assert.equal(State.visualModeTransition,null);
});
