import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const plain=value=>JSON.parse(JSON.stringify(value));
const archives={
    'visuals/PlexusRenderer.ts':['documents/tests/PlexusRenderer.pre-wh03a.ts','997de9c01073809618bc39d84df0d523a18972f2d669b5fa02970d94854fbac8'],
    'visuals/WormholeFrameContext.ts':['documents/tests/WormholeFrameContext.pre-wh03a.ts','43f522dca0bf810dc4ce10aef68ca19a906ee3a0a4a66aa9a5d4c6dc6c9e1d62']
};
function harness(predecessor=false) {
    const cache=new Map();let p, time=0,position=()=>{},ended=()=>{},updates=0,emits=0;const gainInputs=[];
    class FakeP5 {
        constructor(sketch){p=this;this.windowWidth=this.width=640;this.windowHeight=this.height=360;this.frameCount=0;this.deltaTime=1000/60;this.density=1;sketch(this);this.setup();}
        createCanvas(w,h){this.width=w;this.height=h;this.canvas={dataset:{}};return {parent(){},elt:this.canvas};}
        createGraphics(width,height){return {width,height,pixelDensity:()=>this.density};}
        remove(){} frameRate(){} resizeCanvas(w,h){this.width=w;this.height=h;}
        pixelDensity(value){if(value!==undefined)this.density=value;return this.density;}
    }
    class Identity {constructor(state){this.state=state;} syncPosition(){} setMusicDisplay(){} setSkyboxEnabled(){} setWallEnabled(){} }
    function load(relative){
        const file=path.isAbsolute(relative)?relative:path.resolve('src',relative);
        if(cache.has(file))return cache.get(file);
        const key=path.relative(path.resolve('src'),file).replaceAll('\\','/');
        if(key==='visuals/CosmicWormholeIdentity.ts')return {CosmicWormholeIdentity:Identity};
        const source=fs.readFileSync(predecessor&&archives[key]?archives[key][0]:file,'utf8');
        const exports={};cache.set(file,exports);
        const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
        vm.runInNewContext(code,{exports,console,window:{devicePixelRatio:1},require(id){
            if(id==='p5')return FakeP5;
            if(id==='./Particle')return {Particle:class {}};
            if(id==='./Shockwave')return {Shockwave:class {constructor(){emits++;}}};
            const base=path.resolve(path.dirname(file),id);
            return load(fs.existsSync(base+'.ts')?base+'.ts':fs.existsSync(base)&&base.endsWith('.ts')?base:path.join(base,'index.ts'));
        }},{filename:file});return exports;
    }
    return {load,gainInputs,get p(){return p;},get updates(){return updates;},get emits(){return emits;},
        start(gain=1,bridge){
            const {State}=load('state/store.ts'),{startPlexusRenderer}=load('visuals/PlexusRenderer.ts');
            const buffer={};
            startPlexusRenderer('test',{setExportTarget(){},updateDashboard(){updates++;},
                getTuningForMorph(raw){gainInputs.push(JSON.stringify(raw));Object.assign(buffer,raw);buffer.wormholeSpeed=raw.wormholeSpeed*gain;return buffer;},
                applyAutomatedTuning(t,out){out.wormholeCurve=.1+(t%1)*.2;return true;},
                applyAutomatedSpiral(t,out){out.wormholeSpiralDirection=t<1?1:-1;return {id:'fixture',time:1};}
            },{getCurrentTime:()=>time,addPositionChangedListener(fn){position=fn;},addPlaybackEndedListener(fn){ended=fn;},syncMetronomeState(){}},
            {get:()=>({id:'test',draw(){},syncPosition(){}}),forEach(fn){fn({syncPosition(){}});}},bridge);
            return State;
        },tick(t,seek=false,deltaSec=1/60){p.deltaTime=deltaSec*1000;time=t;if(seek)position(t);p.frameCount++;p.draw();},end(){ended();}
    };
}
function fixture(load) {
    const {createEmptyTrackAnalysis}=load('analyzer/normalizeAnalysisResult.ts');const trackAnalysis=createEmptyTrackAnalysis();
    const frames=Array.from({length:30},(_,i)=>Object.freeze({e:.2+(i%7)/10,eRatio:.9,densityProj:.4,melodyProj:.2,fxProj:.1,
        subEnergy:i/40,bassEnergy:i/60,subFlux:.2,bassFlux:.1,state:i<15?'LOW':'HIGH',perceptualSpectrum:Object.freeze(Array(24).fill(i/40))}));
    trackAnalysis.features=frames.map(()=>Object.freeze({melody:.2,vocal:.1,fx:.2,density:.4,brightness:.5,tension:.3}));
    trackAnalysis.buildupConfidence=frames.map((_,i)=>i/30);trackAnalysis.spectralPivot=frames.map(()=>.2);
    trackAnalysis.cues=[{time:.5,kind:'build',intensity:.7},{time:1.5,kind:'pattern',intensity:.8,patternId:'p'}];
    return {frames,events:[{time:.2,type:1,intensity:.7},{time:.7,type:2,intensity:.9}],sampleRate:10,hopSize:1,bpm:120,trackAnalysis,duration:3};
}
// WH-03b deliberately replaces transport envelopes/publication timing. Their old full-state
// predicate is retained at documents/tests/wormhole-wh03b-predecessor.json's Git identity;
// dedicated cadence/seek tests below replace that portion. Gain/semantic/channel order stays exact.
const stateView=s=>plain({tuning:s.visualTuning,target:s.targetTuning,
    transition:s.activeVisualTransitionId,anchor:s.spiralTransitionAnchor,choreo:s.currentChoreography});
const motif=(time,amount)=>({time,motifId:'a',actions:{accelerate:amount},activeOperators:[],motifIntensity:0,motifDensity:0,motifMotion:0,novelty:0,
    transition:{behavior:'morph',progress:amount,preserve:[],fromMotif:'void-minimal',toMotif:'tunnel-drive'}});

test('retained WH-03a runtime predecessors have their original identities',()=>{
    for(const [file,hash] of Object.values(archives))assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);
});
for(const gain of [1,2])test(`actual host tuning/semantic preparation equals its independent predecessor through transport changes, gain ${gain}`,()=>{
    const old=harness(true),current=harness(),a=old.start(gain),b=current.start(gain);
    for(const [h,s] of [[old,a],[current,b]]){
        Object.assign(s,fixture(h.load));s.visualMode='cosmic-wormhole';s.isPlaying=true;
        s.targetTuning.wormholeSpeed=.4;s.targetTuning.transitionSpeed=2;
        s.semanticBaseTuning={...s.targetTuning};
    }
    const unchanged=JSON.stringify(a.frames);
    const check=(t,seek=false)=>{const oi=old.gainInputs.length,ni=current.gainInputs.length;old.tick(t,seek);current.tick(t,seek);assert.deepEqual(stateView(b),stateView(a),`time ${t}`);assert.equal(current.emits,old.emits);if(old.gainInputs.length>oi&&current.gainInputs.length>ni)assert.deepEqual(current.gainInputs.slice(ni).filter((v,i,a)=>i===0||v!==a[i-1]),old.gainInputs.slice(oi).filter((v,i,a)=>i===0||v!==a[i-1]));};
    for(const t of [0,.1,.2,.7,1.4])check(t);
    a.isPlaying=b.isPlaying=false;for(let i=0;i<80;i++)check(1.4);
    a.isExporting=b.isExporting=true;a.exportTime=b.exportTime=1.6;check(2.8);
    a.isExporting=b.isExporting=false;check(.1,true);
    const plan={version:1,frames:[motif(0,0),motif(1,.5),motif(2,1)],score:{version:1,motifs:[],transitions:[{fromMotifId:'a',toMotifId:'b',startTime:0,duration:2,behavior:'morph',curve:'linear',preserve:[]}]}};
    a.visualChoreography=plain(plan);b.visualChoreography=plain(plan);check(.5,true);check(.8);check(1.5);check(.3,true);
    for(const h of [old,current])h.load('config/featureFlags.ts').featureFlags.semanticResolver=false;
    check(.7);a.visualChoreography=b.visualChoreography=null;check(.7);
    old.end();current.end();check(0);assert.equal(JSON.stringify(a.frames),unchanged);assert.equal(JSON.stringify(b.frames),unchanged);
});
for(const gains of ['raw','meta'])test(`embedded tuning/semantic preparation equals its independent predecessor with ${gains} gain and preset/presentation changes`,()=>{
    const pair=[harness(true),harness()].map(h=>{
        const {cloneDefaultVisualTuning}=h.load('config/visualTuning.ts');
        const context=new (h.load('visuals/WormholeFrameContext.ts').WormholeFrameContext)({version:1,rawTuning:{...cloneDefaultVisualTuning(),wormholeSpeed:.4,dropAnticipation:.3},
            macros:{intensity:.6,motion:.7,depth:.4,detail:.8},boosts:{lineWeight:.3},policy:{gains,semanticResolver:false,semanticChoreography:false}});
        const analysis=fixture(h.load);context.prepare(analysis);
        context.preparePlan({version:1,source:'edited',points:[{id:'a',time:0,preset:'a',confidence:1,intensity:.8,reason:'build'},
            {id:'b',time:1,preset:'b',confidence:1,intensity:.6,reason:'drop'}]},new Map([['a',{wormholeSpeed:.7}],['b',{wormholeSpeed:.2,wormholeSpiralDirection:-1}]]));
        return {h,context,analysis};
    });
    const [a,b]=pair;const before=JSON.stringify(a.analysis);let previous=null;
    for(const [t,playing,jump,snap] of [[0,true,true,true],[.1,true,false,false],[.8,true,false,false],[1.2,true,false,false],[.4,false,true,true],[2,false,true,false],[.2,true,true,true]]){
        a.context.step(t,playing,1/60,previous,jump,snap);b.context.step(t,playing,1/60,previous,jump,snap);
        assert.deepEqual(stateView(b.context.state),stateView(a.context.state),`time ${t}`);
        for(const c of [a.context,b.context])c.setPresentation({spiralDirection:t<1?'left':'auto',macros:{motion:.3},wall:{mode:'off'}});
        previous=t;
    }
    a.context.rewind();b.context.rewind();a.context.step(1,true,1/60,null,true,true);b.context.step(1,true,1/60,null,true,true);
    assert.deepEqual(stateView(b.context.state),stateView(a.context.state));assert.equal(JSON.stringify(a.analysis),before);assert.equal(JSON.stringify(b.analysis),before);
});
test('non-Wormhole semantic cursor/memo agrees with predecessor after plan swaps, style changes and backward seek',()=>{
    const pair=[harness(true),harness()].map(h=>{const s=h.start();Object.assign(s,fixture(h.load));s.visualMode='classic';s.semanticBaseTuning={...s.targetTuning};return{h,s};});
    const plans=[{version:1,frames:[motif(0,.1),motif(1,.6)]},{version:1,frames:[motif(0,.8)]}];
    for(const [t,mode,index] of [[0,'classic',0],[1.2,'classic',0],[.2,'classic',0],[.8,'temporal',0],[.4,'classic',1]]){
        for(const {h,s} of pair){s.visualMode=mode;if(s.visualChoreography?.frames.length!==plans[index].frames.length)s.visualChoreography=plain(plans[index]);h.tick(t);}
        assert.deepEqual(stateView(pair[1].s),stateView(pair[0].s));
    }
});
test('time-based semantic bridge keeps gain and base restoration ordering equal to predecessor',()=>{
    const pair=[harness(true),harness()].map(h=>{
        const {State}=h.load('state/store.ts'),{SemanticRendererBridge}=h.load('visuals/PlexusRenderer.ts');
        const {SemanticResolver}=h.load('semantics/SemanticResolver.ts'),{SemanticRuntimeAdapter}=h.load('semantics/SemanticRuntimeAdapter.ts');
        const resolver=new SemanticResolver();resolver.setPlan({version:'1.0',trackHash:'wh03a',frames:[
            {timeSec:0,durationSec:2,narrativeState:'DEVELOPMENT',primaryPattern:'FLOW',actions:{EXPAND:.5},motion:{speed:.3,complexity:.2,variation:{seed:1,phraseIndex:0,variationIndex:0}},confidence:1}]});
        const bridge=new SemanticRendererBridge();bridge.setSemanticAdapter(new SemanticRuntimeAdapter(resolver,()=>State.semanticBaseTuning??State.targetTuning));
        const s=h.start(2,bridge);Object.assign(s,fixture(h.load));s.visualMode='cosmic-wormhole';s.semanticBaseTuning={...s.targetTuning};return{h,s,resolver};
    });
    for(const t of [0,.3,1,1.5,.2,3]){for(const {h} of pair)h.tick(t,true);
        assert.deepEqual(stateView(pair[1].s),stateView(pair[0].s));assert.deepEqual(pair[1].h.gainInputs,pair[0].h.gainInputs);}
    for(const {h,resolver} of pair){resolver.setPlan(null);h.tick(.3,true);}
    assert.deepEqual(stateView(pair[1].s),stateView(pair[0].s));
});
test('resolved frame view is explicitly borrowed, serializable, gain-free and detached after a synchronous clone',()=>{
    const h=harness(),s=h.start(2),{borrowResolvedWormholeFrame}=h.load('visuals/VisualFramePreparation.ts');
    const before=JSON.stringify(s.visualTuning),view=borrowResolvedWormholeFrame(s);
    assert.equal(view.version,1);assert.equal(view.tuningStage,'resolved');assert.equal(view.ownership,'borrowed-until-clone');
    assert.equal(view.values.visualTuning,s.visualTuning);assert.equal(JSON.stringify(s.visualTuning),before);
    const snapshot=structuredClone(view);s.visualTuning.wormholeSpeed=100;assert.notEqual(snapshot.values.visualTuning.wormholeSpeed,100);
    assert.deepEqual(plain(snapshot),plain(JSON.parse(JSON.stringify(snapshot))));assert.ok(!('frames' in view.values));
});
test('shared preparation copies analysis while preserving distinct host/embedded missing-field policies',()=>{
    const h=harness(),s=h.start(),{publishAnalysisFrame,prepareFrameSignals}=h.load('visuals/VisualFramePreparation.ts');
    Object.assign(s,fixture(h.load));const frame={e:.3,state:'LOW',perceptualSpectrum:[]};s.frames=[Object.freeze(frame)];s.currentFrame.subEnergy=.7;
    publishAnalysisFrame(s,0,'embedded');assert.equal(s.currentFrame.subEnergy,.7);
    publishAnalysisFrame(s,0,'host');assert.equal(s.currentFrame.subEnergy,0);assert.notEqual(s.currentFrame,s.frames[0]);
    let count=0,last;const director={update(...args){count++;last=args;return {state:'LOW',glitchIntensity:0};}};
    s.visualTuning.dropAnticipation=.2;s.frames=[frame,frame,frame];s.currentTime=0;
    const modulation=s.modulation;prepareFrameSignals(s,director,0,0,'host',false);assert.equal(last[7],undefined);
    prepareFrameSignals(s,director,0,0,'embedded',false);assert.equal(last[7],frame);assert.equal(count,2);assert.equal(s.modulation,modulation);
});
test('shared morph retains aliased gain results before base lookup and applies semantic overlay after channels only once',()=>{
    const h=harness(),{cloneDefaultVisualTuning}=h.load('config/visualTuning.ts'),{VisualFramePreparation}=h.load('visuals/VisualFramePreparation.ts');
    const prep=new VisualFramePreparation(),visual=cloneDefaultVisualTuning(),target={...visual,wormholeSpeed:.6},base={...visual,wormholeSpeed:.2},scratch={};
    const order=[],resolve=raw=>{order.push(raw.wormholeSpeed);Object.assign(scratch,raw);scratch.wormholeSpeed*=2;return scratch;};
    const resolved=prep.beginTuning(visual,target,()=>{order.push('base');return base;},resolve,1/60,true);
    assert.deepEqual(order,[.6,'base',.2]);assert.equal(resolved.wormholeSpeed,.4);assert.equal(visual.wormholeSpeed,.4);
    visual.wormholeSpeed+=.1;prep.finishTuning(visual);assert.ok(Math.abs(visual.wormholeSpeed-1.3)<1e-12);
    prep.finishTuning(visual);assert.ok(Math.abs(visual.wormholeSpeed-1.3)<1e-12);
    prep.beginTuning(visual,target,null,resolve,1/60,true);prep.finishTuning(visual);assert.equal(visual.wormholeSpeed,1.2);
    assert.equal(target.wormholeSpeed,.6);assert.equal(base.wormholeSpeed,.2);
});
test('preparation modules have no state/renderer/audio/DOM/clock dependency',()=>{
    for(const file of ['VisualFramePreparation.ts','HostVisualFramePreparation.ts']){
        const source=fs.readFileSync('src/visuals/'+file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
        for(const statement of ast.statements)if(ts.isImportDeclaration(statement))assert.doesNotMatch(statement.moduleSpecifier.text,/state\/|ui\/|audio\/|PlexusRenderer|CosmicWormhole|three|p5/);
        const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
        assert.doesNotMatch(code,/\b(?:document|window|performance|requestAnimationFrame)\b|Date\.now|new Worker|\.getContext\(/);
    }
});

// WH-03b timing oracles use independent equations and actual facade calls.
test('musical impulses use actual event age at 24/30/36/60 Hz, including pause and seek',()=>{
    const snapshots=[];
    for(const hz of [24,30,36,60]){
        const h=harness(),s=h.start();Object.assign(s,fixture(h.load));s.isPlaying=true;
        s.events=[{time:.203,type:1,intensity:.8},{time:.703,type:2,intensity:.9}];
        s.trackAnalysis.cues=[{time:.501,kind:'fx',intensity:.9},{time:.521,kind:'fx',intensity:.01}];
        const frozen=JSON.stringify([s.frames,s.events,s.trackAnalysis]);const samples=[];
        for(let i=0;i<=hz;i++)h.tick(i/hz,false,1/hz);
        const expectedBeat=.88**((1-.703)*60+1),expectedDense=.85**((1-.703)*60+1);
        const expectedCue=.9**((1-.501)*60+1)*.9;
        for(const [actual,expected] of [[s.beatDecay,expectedBeat],[s.denseImpactFlash,expectedDense],[s.cueDecay,expectedCue]])
            assert.ok(Math.abs(actual-expected)<1e-12,hz+'Hz actual event age');
        assert.ok(Math.abs(s.playbackFade-1)<1e-12);
        samples.push(s.beatDecay,s.denseImpactFlash,s.cueDecay,s.rotationPhase,s.currentFrame.e,s.currentFeatures.melody);
        s.isPlaying=false;
        h.tick(1,false,1/hz);const pause=plain({beat:s.beatDecay,dense:s.denseImpactFlash,cue:s.cueDecay,frame:s.currentFrame,features:s.currentFeatures});
        for(let i=1;i<hz;i++)h.tick(1,false,1/hz);
        assert.deepEqual(plain({beat:s.beatDecay,dense:s.denseImpactFlash,cue:s.cueDecay,frame:s.currentFrame,features:s.currentFeatures}),pause,'paused music never ages or repeatedly dampens');
        assert.ok(s.playbackFade<1e-12,'one elapsed second fades the host presentation');
        h.tick(.1,true,1/hz);assert.equal(s.beatDecay,0);assert.equal(s.denseImpactFlash,0);assert.equal(s.cueDecay,0);
        h.tick(.73,true,1/hz);assert.ok(Math.abs(s.beatDecay-.88**((.73-.703)*60+1))<1e-12,'seek reconstructs actual decay');
        s.isExporting=true;s.exportTime=1;h.tick(2.5,false,1/hz);assert.ok(Math.abs(s.beatDecay-expectedBeat)<1e-12,'export clock exclusively');
        assert.equal(JSON.stringify([s.frames,s.events,s.trackAnalysis]),frozen,'publication immutable');
        snapshots.push(samples);
    }
    for(const values of snapshots.slice(1))for(let i=0;i<values.length;i++)assert.ok(Math.abs(values[i]-snapshots[0][i])<1e-10,'cadence invariant field '+i);
});
test('transient sampler agrees with brute-force peak equation after duplicate times, empty publications and arbitrary seeks',()=>{
    const h=harness(),{VisualTransientSampler,decayOverSeconds,advancePlaybackFade,integratedFadeFrames}=h.load('visuals/transientDecay.ts');
    const sampler=new VisualTransientSampler(),events=[{time:.13,type:1},{time:.2,type:2},{time:.2,type:1}],
        cues=[{time:0,intensity:.9},{time:.2,intensity:.01},{time:.2,intensity:.7},{time:.22,intensity:.1}];
    const before=JSON.stringify([events,cues]);let result;
    for(const t of [0,.1,.2,.21,1,900,.1,.2]){
        const value=sampler.sample(events,cues,t);
        if(result)assert.equal(value,result,'bounded reused result');result=value;
        const prior=events.filter(e=>e.time<=t),dense=prior.filter(e=>e.type===2);
        const last=prior.at(-1),heavy=dense.at(-1);
        const cue=Math.max(0,...cues.filter(c=>c.time<=t).map(c=>c.intensity*.9**((t-c.time)*60+1)));
        assert.ok(Math.abs(value.cue-cue)<1e-12);
        assert.equal(value.beat,last?.time===undefined?0:.88**((t-last.time)*60+1));
        assert.equal(value.dense,heavy?.time===undefined?0:.85**((t-heavy.time)*60+1));
    }
    assert.equal(JSON.stringify([events,cues]),before);
    assert.deepEqual(plain(sampler.sample([],[],.3)),{beat:0,dense:0,cue:0});
    assert.equal(decayOverSeconds(.9,0),1);assert.equal(decayOverSeconds(.9,NaN),1);
    assert.equal(advancePlaybackFade(.7,false,12),.7,'embedded pause holds fade');
    for(const active of [false,true]){
        let fade=.3,phase=0;
        for(let i=0;i<120;i++){phase+=integratedFadeFrames(fade,active,1/60);fade=advancePlaybackFade(fade,active,1/60,true);}
        assert.ok(Math.abs(phase-integratedFadeFrames(.3,active,2))<1e-10,'exact integral across saturation');
    }
});
test('embedded and host share envelopes without inventing first-frame fade elapsed time',()=>{
    const h=harness(),s=h.start();Object.assign(s,fixture(h.load));
    const seed={version:1,rawTuning:{...s.targetTuning},macros:{intensity:.5,motion:.5,depth:.5,detail:.5},boosts:{},
        policy:{gains:'raw',semanticResolver:false,semanticChoreography:false}};
    const c=new (h.load('visuals/WormholeFrameContext.ts').WormholeFrameContext)(seed);
    s.trackAnalysis.cues=[{time:.501,kind:'fx',intensity:.9},{time:.521,kind:'fx',intensity:.01}];
    c.prepare({...fixture(h.load),trackAnalysis:s.trackAnalysis});s.isPlaying=true;
    h.tick(0);c.step(0,true,1/60,null,false,true);assert.equal(s.playbackFade,0);assert.equal(c.state.playbackFade,0);
    for(let i=1;i<=36;i++){h.tick(i/36,false,1/36);c.step(i/36,true,1/36,(i-1)/36,false,false);}
    assert.ok(Math.abs(c.state.playbackFade-s.playbackFade)<1e-12);
    for(const key of ['beatDecay','denseImpactFlash'])assert.equal(c.state[key],s[key]);
    const {VisualTransientSampler}=h.load('visuals/transientDecay.ts');
    const cue=new VisualTransientSampler().sample(s.events,s.trackAnalysis.cues,1).cue;
    assert.ok(Math.abs(s.cueDecay-cue)<1e-12);
    c.dispose();
});
