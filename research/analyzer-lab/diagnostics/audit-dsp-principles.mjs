// Diagnostic snapshot, not a golden test. Loader timings are not production benchmarks.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';

const load = createLoader({}, {Float32Array,Float64Array,Uint8Array,Int32Array,Math,Number,Error});
const { FFT } = load('analyzer/math/FFT.ts');
const { FeatureExtractor } = load('analyzer/FeatureExtractor.ts');
const { normalizeArray } = load('analyzer/FeatureNormalizer.ts');
const { applyEMA } = load('analyzer/TemporalSmoother.ts');
const { trackBeats } = load('analyzer/BeatTracker.ts');
const { GridAligner } = load('analyzer/GridAligner.ts');
const { NoveltyAnalyzer } = load('analyzer/NoveltyAnalyzer.ts');
const { extractLowFrequencies } = load('analyzer/LowFrequencyExtractor.ts');
const { estimateTempo } = load('analyzer/TempoEstimator.ts');
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const results = {};
const finiteStats = values => ({min:Math.min(...values),max:Math.max(...values),finite:Array.from(values).every(Number.isFinite)});

// Verify valid radix-2 FFT independently against its defining DFT equation.
results.fftReference = [8,16,64].map(size => {
  const fft = new FFT(size);
  const input = Float32Array.from({length:size},(_,i)=>Math.sin(i*0.41)+0.3*Math.cos(i*0.87));
  fft.re.set(input);
  fft.transform();
  let maxError = 0;
  for (let k=0;k<size;k++) {
    let re=0,im=0;
    for (let j=0;j<size;j++) { re += input[j]*Math.cos(2*Math.PI*k*j/size); im -= input[j]*Math.sin(2*Math.PI*k*j/size); }
    maxError = Math.max(maxError,Math.hypot(fft.re[k]-re,fft.im[k]-im));
  }
  return {size,maxError};
});
results.fftInvalidSize = [NaN,4.5,1024.5].map(size => {
  try { const fft = new FFT(size); return {input:String(size),accepted:true,size:fft.size,arrayLength:fft.re.length}; }
  catch (e) { return {input:String(size),accepted:false,error:e.message}; }
});

results.flatness = [];
for (const amplitude of [0.1,1e-6,1e-8,1e-10]) {
  let state=123;
  const samples = Float32Array.from({length:1024*32},()=>{ state=(Math.imul(state,1664525)+1013904223)>>>0;return (state/2**32*2-1)*amplitude; });
  const f=new FeatureExtractor(samples,44100,1024); f.process();
  results.flatness.push({amplitude,flatness:finiteStats(f.flatnessT),pitchConfidence:finiteStats(f.pitchConfidenceT)});
}
const corrupt=new Float32Array(1024*8).fill(0.1);corrupt[100]=Infinity;
const cf=new FeatureExtractor(corrupt,44100,1024);cf.process();
results.nonfiniteSample={rms:finiteStats(cf.rmsT),flux:finiteStats(cf.fluxT),normalizedRms:finiteStats(normalizeArray(cf.rmsT,cf.typRms))};
const publicCorrupt=Float32Array.from({length:44100},(_,i)=>.1*Math.sin(2*Math.PI*440*i/44100));publicCorrupt[100]=Infinity;
try {
  const analysis=analyzeAudio({samples:publicCorrupt,sampleRate:44100});
  const nonfinite=[];
  const scan=(value,path)=>{
    if(typeof value==='number'&&!Number.isFinite(value))nonfinite.push(path);
    else if(value&&typeof value==='object')for(const [key,child]of Object.entries(value))scan(child,`${path}.${key}`);
  };
  scan(analysis,'result');
  results.publicNonfiniteSample={returned:true,nonfiniteCount:nonfinite.length,firstPaths:nonfinite.slice(0,20)};
} catch(e){results.publicNonfiniteSample={returned:false,error:e.message};}

results.emaPhysicalResponse = [];
for (const rate of [22050,44100,48000,96000]) for (const hop of [512,1024,2048]) {
  const input=new Float32Array(Math.ceil(rate/hop)).fill(1);input[0]=0;
  const output=applyEMA(input,0.1);
  const crossing=Array.from(output).findIndex(v=>v>=1-Math.exp(-1));
  results.emaPhysicalResponse.push({rate,hop,theoreticalTauSec:-hop/rate/Math.log(0.9),crossingSec:crossing*hop/rate});
}

results.beatGap=[];
for (const rate of [44100,48000]) for (const bpm of [120,128,174]) {
  const hop=1024, fps=rate/hop, length=Math.round(60*fps), env=new Float32Array(length), truth=[];
  for(let time=0.2;time<60;time+=60/bpm) { truth.push(time); if(time<12||time>=48) env[Math.round(time*fps)]=1; }
  const beats=trackBeats(env,fps*60/bpm,rate,hop).beatTimes;
  const middle=beats.filter(t=>t>=15&&t<45);
  const gapPeriods=middle.slice(1).map((t,i)=>t-middle[i]);
  const errors=middle.map(t=>Math.min(...truth.map(ref=>Math.abs(t-ref))));
  const activeErrors=beats.filter(t=>(t>=2&&t<11)||(t>=49&&t<59)).map(t=>Math.min(...truth.map(ref=>Math.abs(t-ref))));
  const unsupported=trackBeats(new Float32Array(length),fps*60/bpm,rate,hop);
  results.beatGap.push({rate,bpm,targetPeriodSec:60/bpm,usedPeriodFrames:Math.round(fps*60/bpm),gapBeats:middle.length,meanGapSec:gapPeriods.reduce((a,b)=>a+b,0)/gapPeriods.length,maxGapBeatErrorSec:Math.max(...errors),meanGapBeatErrorSec:errors.reduce((a,b)=>a+b,0)/errors.length,maxActiveBeatErrorSec:Math.max(...activeErrors),silenceBeats:unsupported.beatTimes.length});
}

results.tempoChange=[];
for (const secondBpm of [140,174]) {
  const rate=44100,hop=1024,fps=rate/hop,env=new Float32Array(Math.round(60*fps)),truth=[];
  for(let t=0.2;t<30;t+=.5){env[Math.round(t*fps)]=1;truth.push(t);}
  for(let t=30;t<60;t+=60/secondBpm){env[Math.round(t*fps)]=1;truth.push(t);}
  const features={totalFrames:env.length,fluxT:env,typFlux:1,onsetEnvT:env};
  const grid=new GridAligner(features,rate,hop);grid.calculate();
  const lateTruth=truth.filter(t=>t>=35&&t<59);
  const lateMatch=lateTruth.filter(t=>grid.beats.some(b=>Math.abs(b-t)<=.07)).length/lateTruth.length;
  results.tempoChange.push({secondBpm,estimated:grid.estimatedBPM,lateOnsetRecall70ms:lateMatch,confidences:grid.timingConfidence,tempoCandidates:grid.tempoCandidates});
}

// A small onset exactly at a frame boundary is windowed to zero; compare nearby offsets.
results.hannImpulses=[];
for(const offset of [0,1,64,256,512,768,1023]){
  const samples=new Float32Array(1024*8);samples[1024*3+offset]=1;
  const f=new FeatureExtractor(samples,44100,1024);f.process();
  results.hannImpulses.push({offset,rms: f.rmsT[3],flux:f.fluxT[3],onset:f.onsetEnvT[3],percussive:f.percussiveT[3]});
}
results.hannTempoPhase=[];
for(const offset of [0,512,1023]) {
  const samples=new Float32Array(1024*21*25);
  for(let frame=21;frame<21*24;frame+=21) samples[frame*1024+offset]=1;
  const f=new FeatureExtractor(samples,44100,1024);f.process();
  const grid=new GridAligner(f,44100,1024);grid.calculate();
  results.hannTempoPhase.push({offset,truthBpm:60*44100/(21*1024),estimatedBpm:grid.estimatedBPM,tempoConfidence:grid.tempoConfidence,beats:grid.beats.length,candidates:grid.tempoCandidates.length,onsetMax:Math.max(...f.onsetEnvT)});
}

// Tail samples are present in the declared audio duration but never enter the main FFT.
const tail=new Float32Array(1024*8+512);tail[1024*8+256]=1;
const tailFeatures=new FeatureExtractor(tail,44100,1024);tailFeatures.process();
results.tailOmission={sampleLength:tail.length,totalFrames:tailFeatures.totalFrames,observedRmsMax:Math.max(...tailFeatures.rmsT),observedFluxMax:Math.max(...tailFeatures.fluxT)};

results.lowFrequencyClock=[];
for (const rate of [8000,22050,44100,48000,96000]) {
  const samples=Float32Array.from({length:Math.round(rate*3)},(_,i)=>i/rate>=1&&i/rate<2?0.3*Math.sin(2*Math.PI*40*(i/rate-1)):0);
  const t=performance.now();const f=extractLowFrequencies(samples,rate,1024);
  const threshold=Array.from(f.subFlux).findIndex(v=>v>.1);
  const peak=Array.from(f.subFlux).reduce((a,v,i)=>v>f.subFlux[a]?i:a,0);
  results.lowFrequencyClock.push({rate,windowSize:2**Math.ceil(Math.log2(rate*.12)),windowSec:2**Math.ceil(Math.log2(rate*.12))/rate,firstFluxAbovePoint1:threshold*1024/rate,peakFluxSec:peak*1024/rate,elapsedMs:performance.now()-t});
}

results.noveltyRamp=[];
for(const duration of [10,60,180]) {
  const rate=44100,hop=1024,n=Math.round(duration*rate/hop);
  const af=Array.from({length:n},(_,i)=>({e:i/(n-1),perceptualSpectrum:[0,0,0,0]}));
  const vf=Array.from({length:n},()=>({density:0,fx:0,melody:0,brightness:0,tension:0,vocal:0}));
  const novelty=new NoveltyAnalyzer(vf,af,hop,rate);
  const start=performance.now();const curve=novelty.getCurveValues();const curveMs=performance.now()-start;
  const pstart=performance.now();const peaks=novelty.getPeaks();const peakMs=performance.now()-pstart;
  results.noveltyRamp.push({duration,curveMax:Math.max(...curve),peaks:peaks.length,first:peaks.slice(0,2),curveMs,peakMs});
}

// Analytical limits, not a wall-clock test: number of static bin/band overlaps per five minutes.
results.perceptualWork={fiveMinuteSamples48000:300*48000,frames:Math.floor(300*48000/1024),binBandOverlapCalls:Math.floor(300*48000/1024)*511*24};
const out=resolve('research/analyzer-lab/.cache/analyzer-principles-audit');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'dsp-results.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
