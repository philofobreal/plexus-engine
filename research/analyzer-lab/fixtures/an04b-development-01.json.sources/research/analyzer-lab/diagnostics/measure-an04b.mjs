// Raw pitch + actual two-library comparison. Exclusive reports/source snapshots.
// node .../measure-an04b.mjs --split development|transfer|recorded --output NEW_JSON
// Transfer: --frozen-reference DEVELOPMENT_JSON. Recorded: --manifest PREPARED_JSON.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {hash,pcmBytes} from '../../../tests/fixtures/musical-entity-corpus.mjs';
import {pitchSpecs,renderPitchFixture} from '../../../tests/fixtures/pitch-candidate-corpus.mjs';

const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
if(!args.includes('--split')||!args.includes('--output')||!['development','transfer','recorded'].includes(value('--split')))
    throw new Error('Use --split development|transfer|recorded --output NEW_JSON');
const split=value('--split'),output=resolve(value('--output'));
if(existsSync(output)||existsSync(output+'.sources'))throw new Error('New result and source directory required');
const sourcePaths=['src/analyzer/PitchCandidates.ts','src/types/pitchCandidates.ts','src/semantics/pitchEvidence.ts',
    'src/analyzer/MusicalEntityTracker.ts','src/types/musicalEntities.ts','tests/helpers/xr-loader.mjs',
    'tests/fixtures/musical-entity-corpus.mjs','tests/fixtures/pitch-candidate-corpus.mjs',
    'tests/pitch-candidates.test.mjs','tests/pitch-evidence.test.mjs','research/analyzer-lab/diagnostics/measure-an04b.mjs',
    'research/analyzer-lab/diagnostics/compare_an04b_pitch.py','research/analyzer-lab/diagnostics/prepare_an04b_recorded.py',
    'research/analyzer-lab/src/plexus_analyzer_lab/adapters/pitch_pair.py',
    'research/analyzer-lab/src/plexus_analyzer_lab/adapters/audioflux_onsets.py',
    'research/analyzer-lab/docs/AN-04B-EXPERIMENT.md','research/analyzer-lab/fixtures/audioflux-runtime-lock-01.json'];
const bytes=Object.fromEntries(sourcePaths.map(p=>[p,readFileSync(p)]));
const sourceHashes=Object.fromEntries(sourcePaths.map(p=>[p,hash(bytes[p])]));
let reference=null;
if(split==='transfer'){
    if(!args.includes('--frozen-reference'))throw new Error('Frozen development reference required');
    const priorBytes=readFileSync(value('--frozen-reference')),prior=JSON.parse(priorBytes);
    if(prior.split!=='development'||JSON.stringify(prior.sourceHashes)!==JSON.stringify(sourceHashes))throw new Error('Changed frozen sources');
    const old=new Set(prior.cases.filter(c=>!c.spec.control).map(c=>JSON.stringify(c.spec)));
    if(pitchSpecs(split).filter(s=>['sine','harmonic'].includes(s.kind)).some(s=>old.has(JSON.stringify(s))))throw new Error('Repeated development tuple');
    reference={path:value('--frozen-reference'),sha256:hash(priorBytes)};
}
const cache=resolve('research/analyzer-lab/.cache/an04b-native/'+randomUUID());mkdirSync(cache,{recursive:true});
let inputs=[];
if(split==='recorded'){
    if(!args.includes('--manifest'))throw new Error('Recorded manifest required');
    const manifest=JSON.parse(readFileSync(value('--manifest')));
    inputs=manifest.cases.map(c=>{
        const b=readFileSync(c.pcmPath);if(hash(b)!==c.identity.pcmSha256||b.length!==c.identity.sampleCount*4)throw new Error('PCM hash mismatch');
        return {...c,decoder:manifest.decoder,samples:Float32Array.from({length:b.length/4},(_,i)=>b.readFloatLE(i*4)),
            spec:{kind:'recorded',original:c.original},truth:null};
    });
}else inputs=pitchSpecs(split).map((spec,i)=>{const f=renderPitchFixture(spec);
    const pcmPath=join(cache,`case-${i}.f32`);writeFileSync(pcmPath,pcmBytes(f.samples),{flag:'wx'});
    return {...f,caseId:`case-${i}`,pcmPath};});
const load=createLoader({}, {Float32Array,Float64Array});
const {extractPitchCandidates,pitchCandidatesToUnresolvedParts}=load('analyzer/PitchCandidates.ts');
const {trackMusicalEntities}=load('analyzer/MusicalEntityTracker.ts');
const {assessPitchCandidates}=load('semantics/pitchEvidence.ts');
const analyses=inputs.map(input=>{const start=performance.now(),analysis=extractPitchCandidates(input.samples,input.identity);
    return {analysis,dspMilliseconds:performance.now()-start};});
const request=join(cache,'input.json'),providerOutput=join(cache,'providers.json');
writeFileSync(request,JSON.stringify({cases:inputs.map(c=>({caseId:c.caseId,pcmPath:c.pcmPath,identity:c.identity}))}),{flag:'wx'});
const command=[resolve('research/analyzer-lab/diagnostics/compare_an04b_pitch.py'),'--input',request,'--output',providerOutput,
    '--runtime',resolve('research/analyzer-lab/.cache/audioflux-runtime-locked-01')];
const python=resolve('research/analyzer-lab/.venv/Scripts/python.exe'),child=spawnSync(python,command,{encoding:'utf8',timeout:120000});
writeFileSync(join(cache,'native.log'),(child.stdout||'')+(child.stderr||''),{flag:'wx'});
if(child.error||child.status!==0)throw new Error('Actual providers failed: '+(child.error||child.stderr));
const providerBytes=readFileSync(providerOutput),providers=JSON.parse(providerBytes);
if(providers.cases.length!==inputs.length||providers.inputManifestSha256!==hash(readFileSync(request)))throw new Error('Provider manifest mismatch');
const cents=(a,b)=>Math.abs(1200*Math.log2(a/b)),cases=[];
for(let i=0;i<inputs.length;i++){
    const input=inputs[i],{analysis,dspMilliseconds}=analyses[i],provider=providers.cases[i];
    if(provider.caseId!==input.caseId||JSON.stringify(provider.identity)!==JSON.stringify(input.identity)
        ||provider.parameters.frameLength!==analysis.frameLength||provider.parameters.hopLength!==analysis.hopLength)
        throw new Error('Frame/PCM identity mismatch');
    const assessment=assessPitchCandidates(analysis,provider.pairs);
    const registry=trackMusicalEntities(pitchCandidatesToUnresolvedParts(analysis),input.identity);
    const f0=input.truth?.frequencyHz,integerErrors=[],refinedErrors=[];
    if(f0)for(const frame of analysis.frames)if(frame.primary){
        integerErrors.push(cents(frame.primary.integerLagFrequencyHz,f0));refinedErrors.push(cents(frame.primary.frequencyHz,f0));
    }
    const pairTruthErrors=f0?provider.pairs.map(p=>cents(p.geometricMeanHz,f0)):null;
    cases.push({caseId:input.caseId,spec:input.spec,identity:input.identity,truth:input.truth,
        original:input.original??null,decoder:input.decoder??null,analysis,provider,assessment,dspMilliseconds,
        measurements:{frames:analysis.frames.length,proposals:analysis.frames.filter(f=>f.primary).length,
            acceptedReferencePairs:provider.pairs.length,qualified:assessment.qualifiedFrameIndices.length,
            integerErrorsCents:integerErrors,refinedErrorsCents:refinedErrors,pairTruthErrorsCents:pairTruthErrors,
            inferredSources:registry.sources.length,inferredMusicalMotifs:registry.musicalMotifs.length,recordedAccuracy:null}});
}
const mono=cases.filter(c=>c.truth?.category==='monophonic'),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const integer=mono.flatMap(c=>c.measurements.integerErrorsCents),refined=mono.flatMap(c=>c.measurements.refinedErrorsCents);
const report={experiment:'AN-04B',split,sourceHashes,frozenReference:reference,runtime:{node:process.version,python:providers.python},
    externalInference:{command:[python,...command],rawOutputSha256:hash(providerBytes),inputManifestSha256:providers.inputManifestSha256},
    cases,summary:{monophonicFrames:mono.reduce((n,c)=>n+c.measurements.frames,0),monophonicProposals:refined.length,
        integerMeanAbsoluteCents:mean(integer),refinedMeanAbsoluteCents:mean(refined),
        refinedWithin25Cents:refined.filter(v=>v<=25).length,refinedWithin50Cents:refined.filter(v=>v<=50).length,
        allFrames:cases.reduce((n,c)=>n+c.measurements.frames,0),allReferencePairs:cases.reduce((n,c)=>n+c.provider.pairs.length,0),
        allQualified:cases.reduce((n,c)=>n+c.assessment.qualifiedFrameIndices.length,0)},
    groundTruthType:split==='recorded'?'unavailable':'authored-periodicity-and-source-count',
    sourceIsolation:'unverified-mixture',confidence:null,productionPromotion:false};
mkdirSync(dirname(output),{recursive:true});mkdirSync(output+'.sources');
for(const [p,b] of Object.entries(bytes)){const path=output+'.sources/'+p;mkdirSync(dirname(path),{recursive:true});writeFileSync(path,b,{flag:'wx'});}
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({split,output,cases:cases.length,summary:report.summary,
    controls:cases.filter(c=>c.truth?.category!=='monophonic').map(c=>({kind:c.spec.kind,...c.measurements,
        integerErrorsCents:undefined,refinedErrorsCents:undefined,pairTruthErrorsCents:undefined}))},null,2));
