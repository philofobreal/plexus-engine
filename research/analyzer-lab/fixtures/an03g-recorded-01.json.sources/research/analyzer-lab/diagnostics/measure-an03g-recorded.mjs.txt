// Replay exact retained PCM against immutable dual-library predictions; no provider rerun claim.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {sha256} from '../../../tests/fixtures/acoustic-onset-challenges.mjs';

if(process.argv.length!==8||process.argv[2]!=='--references'||process.argv[4]!=='--pcm-cache'||process.argv[6]!=='--output')
    throw new Error('Use --references OLD_DUAL_JSON --pcm-cache EXACT_PCM_CACHE --output NEW_JSON');
const priorPath=resolve(process.argv[3]),cache=resolve(process.argv[5]),output=resolve(process.argv[7]);
if(existsSync(output)||existsSync(output+'.sources'))throw new Error('Exclusive new output required');
const priorBytes=readFileSync(priorPath),prior=JSON.parse(priorBytes),inputs=new Map();
assert.equal(prior.referencePolicy,'librosa AND audioflux class-matched one-to-one agreement <=25ms; unaccepted outputs remain unknown');
for(const name of readdirSync(cache).filter(n=>n.endsWith('.f32le'))){
    const p=join(cache,name),b=readFileSync(p);inputs.set(sha256(b),p);
}
const sources=['src/analyzer/BandOnsets.ts','src/types/bandOnsets.ts','src/analyzer/ContinuationOnsets.ts',
    'src/analyzer/DifferenceOnsets.ts','src/analyzer/ResidualOnsets.ts','src/analyzer/signalContract.ts',
    'src/semantics/acousticEvidence.ts','src/types/acousticEvidence.ts','tests/helpers/xr-loader.mjs',
    'tests/fixtures/acoustic-onset-challenges.mjs','research/analyzer-lab/diagnostics/measure-an03g-recorded.mjs'];
const snapshots=Object.fromEntries(sources.map(p=>[p,readFileSync(p)])),load=createLoader({}, {Float32Array,Float64Array});
const {extractBandOnsets}=load('analyzer/BandOnsets.ts');
const {assessAcousticOnsets}=load('semantics/acousticEvidence.ts');
const rows=[];let totalCandidates=0,totalQualified=0;
for(const r of prior.rows){
    const path=inputs.get(r.excerptWithContextPcmSha256);
    if(!path)throw new Error('Exact retained PCM unavailable; regenerate with the preserved dual-library program');
    const b=readFileSync(path),sampleCount=r.contextEndSample-r.contextStartSample;
    assert.equal(b.length,4*sampleCount);assert.equal(sha256(b),r.excerptWithContextPcmSha256);
    const samples=Float32Array.from({length:sampleCount},(_,i)=>b.readFloatLE(i*4));
    const result=extractBandOnsets(samples,r.track.sampleRate);
    const identity={pcmSha256:sha256(b),sampleRate:r.track.sampleRate,sampleCount,
        timelineOffsetSeconds:r.contextStartSample/r.track.sampleRate};
    const start=r.excerptStartSample/r.track.sampleRate,end=r.excerptEndSample/r.track.sampleRate;
    const candidates=result.candidates.filter(c=>identity.timelineOffsetSeconds+c.time>=start&&identity.timelineOffsetSeconds+c.time<end);
    for(const t of r.eventTimes.continuationV6)assert.ok(candidates.some(c=>identity.timelineOffsetSeconds+c.time===t),'Previous recording timestamp lost');
    const assessment=assessAcousticOnsets(candidates,r.strictReference.acceptedReferences.map(ref=>({...ref,identity})),identity);
    const qualified=assessment.events.filter(e=>e.reference!==null).length;
    totalCandidates+=candidates.length;totalQualified+=qualified;
    rows.push({file:r.file,fraction:r.fraction,identity,excerptStartSample:r.excerptStartSample,
        excerptEndSample:r.excerptEndSample,metadata:Object.fromEntries(Object.entries(result).filter(([k])=>k!=='candidates')),
        candidates,assessment,acceptedReferenceCount:r.strictReference.acceptedReferences.length,qualified});
    console.log(JSON.stringify({file:r.file,fraction:r.fraction,candidates:candidates.length,qualified}));
}
const sourceHashes={};
for(const [p,b] of Object.entries(snapshots)){
    assert.equal(sha256(readFileSync(p)),sha256(b),'Measurement source changed');sourceHashes[p]=sha256(b);
    const target=output+'.sources/'+p+'.txt';mkdirSync(dirname(target),{recursive:true});writeFileSync(target,b,{flag:'wx'});
}
writeFileSync(output,JSON.stringify({protocol:'AN-03G new Plexus DSP on exact AN-03F PCM; frozen actual dual-library outputs reused',
    priorReferencePath:priorPath,priorReferenceSha256:sha256(priorBytes),sourceHashes,nodeVersion:process.version,
    groundTruth:null,accuracy:null,totalCandidates,totalQualified,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,totalCandidates,totalQualified}));
