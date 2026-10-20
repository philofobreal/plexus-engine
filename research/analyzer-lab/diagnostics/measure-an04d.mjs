// Prefix-only frequency/coefficients; fixed stationary and linear-envelope forecast hypotheses.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {hash,pcmBytes} from '../../../tests/fixtures/musical-entity-corpus.mjs';
import {renderPitchFixture} from '../../../tests/fixtures/pitch-candidate-corpus.mjs';
import {forecastSpecs,renderForecastFixture} from '../../../tests/fixtures/harmonic-forecast-corpus.mjs';
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
if(!args.includes('--split')||!args.includes('--output')||!['development','transfer','recorded'].includes(value('--split')))
    throw new Error('Use --split development|transfer|recorded --output NEW_JSON');
const split=value('--split'),output=resolve(value('--output'));
if(existsSync(output)||existsSync(output+'.sources'))throw new Error('Exclusive result/snapshot required');
const paths=['src/analyzer/HarmonicForecast.ts','src/types/harmonicForecast.ts','src/analyzer/PitchCandidates.ts',
    'src/types/pitchCandidates.ts','tests/helpers/xr-loader.mjs','tests/fixtures/musical-entity-corpus.mjs',
    'tests/fixtures/pitch-candidate-corpus.mjs','tests/fixtures/harmonic-forecast-corpus.mjs','tests/harmonic-forecast.test.mjs',
    'research/analyzer-lab/diagnostics/measure-an04d.mjs','research/analyzer-lab/diagnostics/check_an04d_projection.py',
    'research/analyzer-lab/diagnostics/compare_an04b_pitch.py','research/analyzer-lab/src/plexus_analyzer_lab/adapters/pitch_pair.py',
    'research/analyzer-lab/src/plexus_analyzer_lab/adapters/audioflux_onsets.py','research/analyzer-lab/docs/AN-04D-EXPERIMENT.md'];
const sourceBytes=Object.fromEntries(paths.map(p=>[p,readFileSync(p)])),sourceHashes=Object.fromEntries(paths.map(p=>[p,hash(sourceBytes[p])]));
let frozenReference=null;
if(split==='transfer'){
    if(!args.includes('--frozen-reference'))throw new Error('Frozen development reference required');
    const bytes=readFileSync(value('--frozen-reference')),prior=JSON.parse(bytes);
    if(prior.split!=='development'||JSON.stringify(prior.sourceHashes)!==JSON.stringify(sourceHashes))throw new Error('Changed frozen forecast sources');
    const seen=new Set(prior.cases.map(c=>JSON.stringify(c.spec)));
    if(forecastSpecs(split).some(s=>seen.has(JSON.stringify(s))))throw new Error('Repeated transfer tuple');
    frozenReference={path:value('--frozen-reference'),sha256:hash(bytes)};
}
const baselinePath='research/analyzer-lab/fixtures/an04b-'+(split==='transfer'?'transfer-frozen':split==='recorded'?'recorded-01':'development-01')+'.json';
const baselineBytes=readFileSync(baselinePath),baseline=JSON.parse(baselineBytes);
const cache=resolve('research/analyzer-lab/.cache/an04d/'+randomUUID());mkdirSync(cache,{recursive:true});
const {fitHarmonicForecast,evaluateHarmonicForecast}=createLoader({}, {Float32Array,Float64Array})('analyzer/HarmonicForecast.ts');
let inputs;
if(split==='recorded'){
    const manifest=JSON.parse(readFileSync('research/analyzer-lab/.cache/an04b-recorded-01/manifest.json'));
    inputs=manifest.cases.map(c=>{const bytes=readFileSync(c.pcmPath);if(hash(bytes)!==c.identity.pcmSha256)throw new Error('Recorded PCM hash mismatch');
        return {...c,samples:Float32Array.from({length:bytes.length/4},(_,i)=>bytes.readFloatLE(i*4)),spec:{kind:'recorded',original:c.original},truth:null};});
}else inputs=baseline.cases.map((c,i)=>({...renderPitchFixture(c.spec),caseId:`baseline-${i}`}))
    .concat(forecastSpecs(split).map((s,i)=>({...renderForecastFixture(s),caseId:`new-${i}`})));
const cases=[],numericFrames=[],pitchCases=[];
for(let ci=0;ci<inputs.length;ci++){
    const input=inputs[ci];
    if(ci<baseline.cases.length&&JSON.stringify(input.identity)!==JSON.stringify(baseline.cases[ci].identity))throw new Error('Historical PCM identity changed');
    const n=2**Math.ceil(Math.log2(.08*input.identity.sampleRate)),hop=Math.round(.02*input.identity.sampleRate),total=n*1.5;
    const count=Math.max(0,1+Math.floor((input.samples.length-total)/hop));
    if(count>4096||count*n*33**2>500000000)throw new Error('Forecast clip work budget exceeded');
    const pcmPath=input.pcmPath??join(cache,`${input.caseId}.f32`);
    if(!input.pcmPath)writeFileSync(pcmPath,pcmBytes(input.samples),{flag:'wx'});
    const frames=[],startTime=performance.now();
    for(let frameIndex=0;frameIndex<count;frameIndex++){
        const start=frameIndex*hop,prefix=input.samples.slice(start,start+n),suffix=input.samples.slice(start+n,start+total),
            identity={pcmSha256:hash(pcmBytes(prefix)),sampleRate:input.identity.sampleRate,sampleCount:n,
                timelineOffsetSeconds:input.identity.timelineOffsetSeconds+start/input.identity.sampleRate};
        const forecast=fitHarmonicForecast(prefix,identity),evaluation=evaluateHarmonicForecast(forecast,suffix);
        frames.push({frameIndex,supportStartSample:start,prefixEndSample:start+n,supportEndSample:start+total,forecast,evaluation});
    }
    const modelMilliseconds=performance.now()-startTime,available=frames.filter(f=>f.forecast.status==='available'&&f.evaluation.every(r=>r.heldOutResidualFraction!==null));
    for(const frameIndex of [...new Set([available[0]?.frameIndex,available.at(-1)?.frameIndex])].filter(x=>x!==undefined)){
        const f=frames[frameIndex];numericFrames.push({caseId:input.caseId,frameIndex,pcmPath,identity:input.identity,
            startSample:f.supportStartSample,trainingSamples:n,frequencyHz:f.forecast.frequencyHz});
    }
    for(const frameIndex of [...new Set([0,count-1])].filter(x=>x>=0)){
        const f=frames[frameIndex],prefixPath=join(cache,`${input.caseId}-prefix-${frameIndex}.f32`);
        writeFileSync(prefixPath,pcmBytes(input.samples.slice(f.supportStartSample,f.prefixEndSample)),{flag:'wx'});
        pitchCases.push({caseId:`${input.caseId}:${frameIndex}`,parentCaseId:input.caseId,frameIndex,
            pcmPath:prefixPath,identity:f.forecast.identity});
    }
    const mean=(kind,key)=>{const values=frames.map(f=>key==='heldOutResidualFraction'?f.evaluation.find(r=>r.kind===kind)?.[key]:f.forecast.models.find(r=>r.kind===kind)?.[key]).filter(v=>v!==null&&v!==undefined);
        return {samples:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};};
    cases.push({caseId:input.caseId,spec:input.spec,truth:input.truth,identity:input.identity,frames,modelMilliseconds,
        prefixSamples:n,suffixSamples:n/2,hopSamples:hop,unobservedTailSamples:input.samples.length-(count?((count-1)*hop+total):0),
        modelSummary:['stationary','linear-envelope'].map(kind=>({kind,fit:mean(kind,'fitResidualFraction'),heldOut:mean(kind,'heldOutResidualFraction')})),
        sourceIsolation:'unverified-mixture',referenceAccuracy:null});
}
const python=resolve('research/analyzer-lab/.venv/Scripts/python.exe');
function run(script,request,extra=[]){
    const requestPath=join(cache,script+'-input.json'),resultPath=join(cache,script+'-output.json');
    writeFileSync(requestPath,JSON.stringify(request),{flag:'wx'});
    const command=[resolve('research/analyzer-lab/diagnostics/'+script+'.py'),'--input',requestPath,'--output',resultPath,...extra],
        child=spawnSync(python,command,{encoding:'utf8',timeout:120000});
    writeFileSync(join(cache,script+'.log'),(child.stdout??'')+(child.stderr??''),{flag:'wx'});
    if(child.status!==0||child.error)throw new Error('Actual providers failed: '+(child.stderr||child.error));
    const bytes=readFileSync(resultPath),report=JSON.parse(bytes);
    if((report.inputSha256??report.inputManifestSha256)!==hash(readFileSync(requestPath)))throw new Error('Provider input mismatch');
    return {...report,rawOutputSha256:hash(bytes),command:[python,...command]};
}
const arithmetic=run('check_an04d_projection',{frames:numericFrames});
for(const r of arithmetic.frames){
    const f=cases.find(c=>c.caseId===r.caseId).frames[r.frameIndex],own={...f.forecast.models.find(m=>m.kind===r.kind),...f.evaluation.find(m=>m.kind===r.kind)};
    r.plexusMaxDifference=Math.max(...['numpy','scipy'].flatMap(p=>['fitResidualFraction','heldOutResidualFraction'].map(k=>Math.abs(own[k]-r.results[p][k]))));
}
const pitch=run('compare_an04b_pitch',{cases:pitchCases},['--runtime',resolve('research/analyzer-lab/.cache/audioflux-runtime-locked-01')]);
for(const p of pitch.cases){
    const [caseId,index]=p.caseId.split(':'),f=cases.find(c=>c.caseId===caseId).frames[Number(index)],candidate=f.forecast.frequencyHz;
    if(JSON.stringify(p.identity)!==JSON.stringify(f.forecast.identity)||p.raw['librosa-yin'].length!==1||p.raw['audioflux-ncf'].length!==1)
        throw new Error('Isolated prefix provider geometry mismatch');
    p.ownFrequencyHz=candidate;p.ownQualified=candidate!==null&&p.pairs.length===1&&p.pairs[0].votes.every(v=>Math.abs(1200*Math.log2(candidate/v.frequencyHz))<=25);
    p.parentCaseId=caseId;p.parentFrameIndex=Number(index);
}
const summary={cases:cases.length,frames:cases.reduce((n,c)=>n+c.frames.length,0),availableFrames:cases.reduce((n,c)=>n+c.frames.filter(f=>f.forecast.status==='available').length,0),
    arithmeticModels:arithmetic.frames.length,arithmeticAgreed:arithmetic.frames.filter(f=>f.arithmeticAgreement).length,
    arithmeticMaxPlexusDifference:Math.max(0,...arithmetic.frames.map(f=>f.plexusMaxDifference)),pitchSampledPrefixes:pitch.cases.length,
    pitchAgreedPrefixes:pitch.cases.filter(p=>p.pairs.length===1).length,pitchOwnQualifiedPrefixes:pitch.cases.filter(p=>p.ownQualified).length};
const report={experiment:'AN-04D',split,sourceHashes,frozenReference,baselineReference:{path:baselinePath,sha256:hash(baselineBytes)},
    runtime:{node:process.version},summary,cases,arithmetic,pitch,confidence:null,sourceIsolationReference:'unavailable',recordedAccuracy:null,productionPromotion:false};
mkdirSync(dirname(output),{recursive:true});mkdirSync(output+'.sources');
for(const [p,bytes] of Object.entries(sourceBytes)){const path=output+'.sources/'+p;mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({split,output,summary,controls:cases.filter(c=>c.caseId.startsWith('new-')||split==='recorded').map(c=>({kind:c.spec.kind,models:c.modelSummary,milliseconds:c.modelMilliseconds}))},null,2));
