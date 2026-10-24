// Regression for removal of the rejected timing selector; other player settings survive.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createLoader} from './helpers/xr-loader.mjs';
const load=createLoader(),settings=load('xr/XrSettings.ts'),store=load('xr/XrSettingsStore.ts');
test('retired timing preferences are ignored and removed from storage without changing other settings',()=>{
 for(const eventTiming of ['base','local-band-v1','local-band-v2','local-band-q3']){
  const initial={version:1,wallDefaultRevision:1,...JSON.parse(JSON.stringify(settings.DEFAULT_XR_SETTINGS))};
  initial.system.eventTiming=eventTiming;initial.generation.difficulty='hard';initial.appearance.spiralDirection='left';
  let raw=JSON.stringify(initial);const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}};
  const restored=store.createXrSettingsStore(storage).load();assert.equal(restored.generation.difficulty,'hard');
  assert.equal(restored.appearance.spiralDirection,'left');assert.equal('eventTiming' in restored.system,false);
  assert.equal('eventTiming' in JSON.parse(raw).system,false);
  const report=load('xr/XrMenuModel.ts').settingsReport(restored);assert.equal(report.includes('Q3'),false);
  assert.equal(settings.XR_SETTINGS.some(d=>d.id==='eventTiming'),false);
  assert.equal(settings.XR_SETTING_SECTIONS.some(d=>d.id==='timing'),false);
 }
});
test('retired preference migration tolerates unavailable storage',()=>{
 const s=store.createXrSettingsStore({getItem:()=>JSON.stringify({version:1,system:{eventTiming:'local-band-q3',diagnostics:false}}),setItem(){throw Error('quota');}}).load();
 assert.equal('eventTiming' in s.system,false);assert.equal(s.system.diagnostics,false);
});
test('XR composition has one stable analyzer path; rejected Q3 cannot enter analysis or normalization',()=>{
 const source=fs.readFileSync('src/xr/main.ts','utf8');assert.equal(source.includes('eventTiming'),false);
 assert.equal(source.includes('new AudioEngine'),true);
 const a=load('analyzer/analyzeAudio.ts').analyzeAudio;
 assert.throws(()=>a({samples:new Float32Array(8000),sampleRate:8000,options:{eventTiming:'local-band-q3'}}));
 const normalize=load('types/eventTiming.ts').normalizeEventTiming;
 assert.equal(normalize({algorithm:'accepted-frame-band-timing-q3-lab-v1',policy:'experimental-opt-in'},1),undefined);
});
