// T06e2 user-requested default-Off regression. No new Wall functionality.
import test from 'node:test';import assert from 'node:assert/strict';
import{createLoader}from'./helpers/xr-loader.mjs';
const load=createLoader();
const{createXrSettingsStore,XR_SETTINGS_STORAGE_KEY:key}=load('xr/XrSettingsStore.ts');
const{normalizeXrSettings,DEFAULT_XR_SETTINGS}=load('xr/XrSettings.ts');
function memory(record){let raw=JSON.stringify(record);return{getItem:()=>raw,setItem:(k,v)=>{assert.equal(k,key);raw=v;},read:()=>JSON.parse(raw)};}
function context(){const raw=load('config/visualTuning.ts').cloneDefaultVisualTuning();Object.assign(raw,{wormholeOpticsEnabled:1,wormholeWall:1,wormholeWallRefraction:1,wormholeWallCaustics:1,wormholeWallWaves:1,wormholeWallCracks:1,wormholeLens:0,wormholeNebulaAmount:0,wormholeGalaxy:0,wormholeStarfield:0,wormholeSkybox:0});const seed={version:1,rawTuning:raw,macros:{intensity:.5,motion:.5,depth:.5,detail:.5},boosts:{},policy:{gains:'raw',semanticResolver:false,semanticChoreography:false}};const C=load('visuals/WormholeFrameContext.ts').WormholeFrameContext;return new C(seed);}
function backend(){const b={width:960,height:540,frameCount:0};for(const k of['background','noStroke','noFill','fill','stroke','strokeWeight','line','circle','triangle','beginShape','vertex','endShape','radialGlow','radialDim','compositeRingTint','drawFieldRaster'])b[k]=()=>{};b.beginFieldRaster=()=>null;return b;}

test('pre-fix saved Wall opt-ins reset Off in both Hybrid and Native while every other player setting survives',()=>{
 for(const presentationMode of['hybrid','native-grains'])for(const mode of['on','preset']){
  const expected=normalizeXrSettings({play:{noteSpeed:'fast'},background:{quality:'high',distanceMeters:500,presentationMode,wall:{mode,material:'mosaic',amount:.7,waves:.8}},appearance:{spiralDirection:'left'}});
  const storage=memory({version:1,...expected}),actual=createXrSettingsStore(storage).load();
  assert.equal(actual.background.wall.mode,'off');assert.equal(JSON.stringify({...actual,background:{...actual.background,wall:{...actual.background.wall,mode}}}),JSON.stringify(expected));
 }
 assert.equal(DEFAULT_XR_SETTINGS.background.wall.mode,'off');
});

test('after migration an explicit manual Wall choice persists and unchanged saves remain deduplicated',()=>{
 const storage=memory({version:1,background:{wall:{mode:'on'}}}),store=createXrSettingsStore(storage);
 const baseline=store.load();assert.equal(baseline.background.wall.mode,'off');store.save(baseline);assert.equal(storage.read().wallDefaultRevision,1);
 const manual={...baseline,background:{...baseline.background,wall:{...baseline.background.wall,mode:'on'}}};store.save(manual);
 const restored=createXrSettingsStore(storage).load();assert.equal(restored.background.wall.mode,'on');assert.equal(storage.read().version,1);
 const before=JSON.stringify(storage.read());store.save(manual);assert.equal(JSON.stringify(storage.read()),before);
});

test('invalid migration markers and denied storage keep the safe Wall default without throwing',()=>{
 for(const wallDefaultRevision of[null,0,'1',true,{},-1])assert.equal(createXrSettingsStore(memory({version:1,wallDefaultRevision,background:{wall:{mode:'on'}}})).load().background.wall.mode,'off');
 const denied=createXrSettingsStore({getItem(){throw Error('Denied');},setItem(){throw Error('Quota');}});assert.equal(denied.load().background.wall.mode,'off');assert.doesNotThrow(()=>denied.save(DEFAULT_XR_SETTINGS));
});

test('Hybrid Wall Off skips the original raster wall even with saturated authored values, across prepare, rewind and mode changes',()=>{
 const c=context(),b=backend();let walls=0;const wrap=()=>{const original=c.identity.drawWall.bind(c.identity);c.identity.drawWall=(...args)=>{walls++;return original(...args);};};wrap();
 c.setPresentation({wall:{mode:'on'}});c.step(1,false,1,null,true,true);c.identity.draw(b,[],[]);assert.equal(walls,1,'positive control exercises the actual raster wall');
 c.setPresentation({wall:{mode:'off'}});c.step(1,false,0,1,false,true);c.identity.draw(b,[],[]);assert.equal(walls,1);
 for(const k of['wormholeWall','wormholeWallRefraction','wormholeWallCaustics','wormholeWallWaves','wormholeWallCracks'])assert.equal(c.state.visualTuning[k],0,k);
 c.rewind();wrap();c.step(2,false,1,null,true,true);c.identity.draw(b,[],[]);assert.equal(walls,1);c.prepare(null);wrap();c.step(1,false,1,null,true,true);c.identity.draw(b,[],[]);assert.equal(walls,1);c.dispose();
});

test('Wall Off remains zero under authored preset transitions and does not rewrite the preset asset',()=>{
 const c=context(),asset={visualTuning:{wormholeOpticsEnabled:1,wormholeWall:1,wormholeWallCaustics:1,wormholeWallWaves:1,wormholeWallCracks:1}},before=JSON.stringify(asset);
 const p={id:'wall',time:0,preset:'wall',intensity:1,confidence:1,reason:'build',morphDurationSec:1,morphCurve:'linear'};
 c.preparePlan({version:1,source:'edited',points:[p]},new Map([['wall',asset]]));c.setPresentation({wall:{mode:'off'}});c.step(2,false,1,null,true,true);
 assert.equal(c.state.visualTuning.wormholeWall,0);assert.equal(c.state.visualTuning.wormholeWallWaves,0);assert.equal(JSON.stringify(asset),before);c.dispose();
});

test('old default galaxy glows migrate to zero, explicit nondefault values survive and a new manual 100 persists',()=>{
 for(const presentationMode of['hybrid','native-grains']){
  const storage=memory({version:1,background:{presentationMode,cosmos:{stars:.7,galaxies:1,sky:.3},wall:{mode:'on'}}}),store=createXrSettingsStore(storage),s=store.load();
  assert.equal(s.background.wall.mode,'off');assert.equal(s.background.cosmos.galaxies,0);assert.equal(s.background.cosmos.stars,.7);assert.equal(s.background.cosmos.sky,.3);
  store.save({...s,background:{...s.background,cosmos:{...s.background.cosmos,galaxies:1}}});assert.equal(createXrSettingsStore(storage).load().background.cosmos.galaxies,1);
 }
 assert.equal(createXrSettingsStore(memory({version:1,background:{cosmos:{galaxies:.6}}})).load().background.cosmos.galaxies,.6);
});

test('the clean Hybrid baseline eliminates actual galaxy radial glows while preserving the original grain strokes',()=>{
 const c=context(),b=backend();let glows=0,lines=0;b.radialGlow=()=>glows++;b.line=()=>lines++;
 c.setPresentation({wall:{mode:'off'},cosmos:{stars:0,galaxies:1,sky:0}});c.step(1,false,1,null,true,true);c.identity.draw(b,[],[]);assert.ok(glows>0,'positive control identifies independent galaxy glows');const baseline=lines;
 glows=0;lines=0;c.setPresentation({cosmos:{galaxies:0}});c.step(1,false,0,1,false,true);c.identity.draw(b,[],[]);assert.equal(glows,0);assert.equal(lines,baseline,'the grain layer remains');c.dispose();
});
