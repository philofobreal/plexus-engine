// Replay immutable AN-04B raw PCM/pitch, add harmonic model and stability evidence.
// node .../measure-an04c.mjs --split development|transfer|recorded --output NEW_JSON
// Transfer: --frozen-reference NEW_DEVELOPMENT_JSON. Recorded uses retained PCM manifest.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {hash,pcmBytes} from '../../../tests/fixtures/musical-entity-corpus.mjs';
import {renderPitchFixture} from '../../../tests/fixtures/pitch-candidate-corpus.mjs';
import {harmonicSpecs,renderHarmonicFixture} from '../../../tests/fixtures/harmonic-evidence-corpus.mjs';
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
if(!args.includes('--split')||!args.includes('--output')||!['development','transfer','recorded'].includes(value('--split')))
    throw new Error('Use --split development|transfer|recorded --output NEW_JSON');
const split=value('--split'),output=resolve(value('--output'));
if(existsSync(output)||existsSync(output+'.sources'))throw new Error('Exclusive result and snapshot required');
const sourcePaths=['src/analyzer/HarmonicEvidence.ts','src/types/harmonicEvidence.ts','src/analyzer/PitchCandidates.ts',
    'src/types/pitchCandidates.ts','tests/helpers/xr-loader.mjs','tests/fixtures/musical-entity-corpus.mjs',
    'tests/fixtures/pitch-candidate-corpus.mjs','tests/fixtures/harmonic-evidence-corpus.mjs','tests/harmonic-evidence.test.mjs',
    'research/analyzer-lab/diagnostics/measure-an04c.mjs','research/analyzer-lab/diagnostics/check_an04c_projection.py',
    'research/analyzer-lab/docs/AN-04C-EXPERIMENT.md'];
const sourceBytes=Object.fromEntries(sourcePaths.map(p=>[p,readFileSync(p)])),sourceHashes=Object.fromEntries(sourcePaths.map(p=>[p,hash(sourceBytes[p])]));
let frozenReference=null;
if(split==='transfer'){
    if(!args.includes('--frozen-reference'))throw new Error('Frozen development reference required');
    const data=readFileSync(value('--frozen-reference')),prior=JSON.parse(data);
    if(prior.split!=='development'||JSON.stringify(prior.sourceHashes)!==JSON.stringify(sourceHashes))throw new Error('Changed frozen harmonic sources');
    const seen=new Set(prior.cases.map(c=>JSON.stringify(c.spec)));
    if(harmonicSpecs(split).some(s=>seen.has(JSON.stringify(s))))throw new Error('Repeated harmonic tuple');
    frozenReference={path:value('--frozen-reference'),sha256:hash(data)};
}
const baselinePath='research/analyzer-lab/fixtures/an04b-'+(split==='transfer'?'transfer-frozen':split==='recorded'?'recorded-01':'development-01')+'.json';
const baselineBytes=readFileSync(baselinePath),baseline=JSON.parse(baselineBytes);
const cache=resolve('research/analyzer-lab/.cache/an04c/'+randomUUID());mkdirSync(cache,{recursive:true});
const load=createLoader({}, {Float32Array,Float64Array}),{extractPitchCandidates}=load('analyzer/PitchCandidates.ts'),
    {assessHarmonicEvidence}=load('analyzer/HarmonicEvidence.ts');
let inputs;
if(split==='recorded'){
    const manifest=JSON.parse(readFileSync('research/analyzer-lab/.cache/an04b-recorded-01/manifest.json'));
    inputs=manifest.cases.map(c=>{const data=readFileSync(c.pcmPath);if(hash(data)!==c.identity.pcmSha256)throw new Error('Recorded PCM mismatch');
        return {...c,samples:Float32Array.from({length:data.length/4},(_,i)=>data.readFloatLE(i*4)),spec:{kind:'recorded',original:c.original},truth:null};});
}else inputs=baseline.cases.map((c,i)=>({...renderPitchFixture(c.spec),caseId:`baseline-${i}`}))
    .concat(harmonicSpecs(split).map((s,i)=>({...renderHarmonicFixture(s),caseId:`new-${i}`})));
const cases=[],oracleFrames=[];
for(let i=0;i<inputs.length;i++){
    const input=inputs[i],pitch=extractPitchCandidates(input.samples,input.identity),prior=i<baseline.cases.length?baseline.cases[i]:null;
    if(prior&&(JSON.stringify(input.identity)!==JSON.stringify(prior.identity)||JSON.stringify(pitch)!==JSON.stringify(prior.analysis)))
        throw new Error('AN-04B raw identity/output changed');
    const start=performance.now(),evidence=assessHarmonicEvidence(input.samples,pitch),modelMilliseconds=performance.now()-start;
    const pcmPath=input.pcmPath??join(cache,`${input.caseId}.f32`);
    if(!input.pcmPath)writeFileSync(pcmPath,pcmBytes(input.samples),{flag:'wx'});
    const available=evidence.frames.filter(f=>f.residual?.status==='available');
    // Deterministic numeric sample, NOT selected by residual or desired result.
    for(const frameIndex of [...new Set([available[0]?.frameIndex,available.at(-1)?.frameIndex])].filter(x=>x!==undefined)){
        const f=pitch.frames[frameIndex];oracleFrames.push({caseId:input.caseId,frameIndex,identity:input.identity,pcmPath,
            startSample:f.supportStartSample,endSample:f.supportEndSample,frequencyHz:f.primary.frequencyHz});
    }
    const statusCounts={};for(const f of evidence.frames)statusCounts[f.status]=(statusCounts[f.status]??0)+1;
    const qualified=new Set(prior?.assessment.qualifiedFrameIndices??[]);
    cases.push({caseId:input.caseId,spec:input.spec,truth:input.truth,identity:input.identity,evidence,modelMilliseconds,
        baselineCaseId:prior?.caseId??null,rawPitchSha256:hash(JSON.stringify(pitch)),statusCounts,
        existingPitchQualified:qualified.size,steadyAndExistingPitchQualified:evidence.frames.filter(f=>f.status==='steady-harmonic-compatible'&&qualified.has(f.frameIndex)).length,
        externalPitchReferences:prior?'immutable-AN-04B-reuse':'unavailable-not-run',sourceIsolation:'unverified-mixture'});
}
const request=join(cache,'arithmetic-input.json'),numericOutput=join(cache,'arithmetic-output.json');
writeFileSync(request,JSON.stringify({frames:oracleFrames}),{flag:'wx'});
const command=[resolve('research/analyzer-lab/diagnostics/check_an04c_projection.py'),'--input',request,'--output',numericOutput];
const python=resolve('research/analyzer-lab/.venv/Scripts/python.exe'),child=spawnSync(python,command,{encoding:'utf8',timeout:120000});
writeFileSync(join(cache,'arithmetic.log'),(child.stdout??'')+(child.stderr??''),{flag:'wx'});
if(child.status!==0||child.error)throw new Error('Actual arithmetic providers failed: '+(child.stderr||child.error));
const numericBytes=readFileSync(numericOutput),numeric=JSON.parse(numericBytes);
if(numeric.inputSha256!==hash(readFileSync(request)))throw new Error('Arithmetic input mismatch');
for(const r of numeric.frames){
    const own=cases.find(c=>c.caseId===r.caseId).evidence.frames[r.frameIndex].residual;
    r.plexusMaxDifference=Math.max(...['numpy','scipy'].flatMap(p=>['fitResidualFraction','heldOutResidualFraction'].map(k=>Math.abs(own[k]-r.results[p][k]))));
}
const steady=cases.filter(c=>c.truth?.category==='monophonic'||c.spec.kind==='steady'),residuals=steady.flatMap(c=>c.evidence.frames.map(f=>f.residual).filter(r=>r?.status==='available'));
const mean=key=>residuals.length?residuals.reduce((a,r)=>a+r[key],0)/residuals.length:null;
const summary={cases:cases.length,frames:cases.reduce((n,c)=>n+c.evidence.frames.length,0),stationaryMonophonicModelFrames:residuals.length,
    fitMean:mean('fitResidualFraction'),heldOutMean:mean('heldOutResidualFraction'),
    independentFitMean:mean('independentColumnFitResidual'),independentHeldOutMean:mean('independentColumnHeldOutResidual'),
    steadyCompatibleFrames:cases.reduce((n,c)=>n+(c.statusCounts['steady-harmonic-compatible']??0),0),
    steadyAndExistingPitchQualified:cases.reduce((n,c)=>n+c.steadyAndExistingPitchQualified,0),
    arithmeticSamples:numeric.frames.length,arithmeticAgreed:numeric.frames.filter(f=>f.arithmeticAgreement).length,
    arithmeticMaxPlexusDifference:Math.max(0,...numeric.frames.map(f=>f.plexusMaxDifference))};
const report={experiment:'AN-04C',split,sourceHashes,frozenReference,baselineReference:{path:baselinePath,sha256:hash(baselineBytes)},
    runtime:{node:process.version},summary,cases,arithmetic:{...numeric,rawOutputSha256:hash(numericBytes),command:[python,...command]},
    sourceIsolationReference:'unavailable',recordedAccuracy:null,confidence:null,productionPromotion:false};
mkdirSync(dirname(output),{recursive:true});mkdirSync(output+'.sources');
for(const [p,b] of Object.entries(sourceBytes)){const path=output+'.sources/'+p;mkdirSync(dirname(path),{recursive:true});writeFileSync(path,b,{flag:'wx'});}
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({split,output,summary,controls:cases.filter(c=>c.caseId.startsWith('new-')||split==='recorded')
    .map(c=>({kind:c.spec.kind,truth:c.truth,status:c.statusCounts,qualified:c.steadyAndExistingPitchQualified}))},null,2));
