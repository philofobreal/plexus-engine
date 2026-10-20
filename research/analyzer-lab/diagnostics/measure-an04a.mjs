// AN-04A: supplied candidate association, not end-to-end separation/transcription.
// Run from project root: node .../measure-an04a.mjs --split development|transfer --output NEW_JSON
// Transfer additionally requires --frozen-reference DEVELOPMENT_JSON. Outputs are exclusive.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {hash,renderEntityCorpus,corpusSpecs,pairwiseAssociation} from '../../../tests/fixtures/musical-entity-corpus.mjs';

const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
if(!args.includes('--split')||!args.includes('--output')||!['development','transfer'].includes(value('--split')))
    throw new Error('Use --split development|transfer --output NEW_JSON [--frozen-reference DEVELOPMENT_JSON]');
const split=value('--split'),output=resolve(value('--output'));
if(existsSync(output)||existsSync(output+'.sources'))throw new Error('Exclusive new output required');
const sourcePaths=['src/analyzer/HarmonicTimbre.ts','src/analyzer/MusicalEntityTracker.ts','src/types/musicalEntities.ts',
    'src/semantics/musicalRelations.ts','tests/fixtures/musical-entity-corpus.mjs','tests/musical-entity-tracker.test.mjs',
    'tests/musical-relations.test.mjs','tests/helpers/xr-loader.mjs','research/analyzer-lab/diagnostics/measure-an04a.mjs',
    'research/analyzer-lab/docs/AN-04A-EXPERIMENT.md'];
const sourceBytes=Object.fromEntries(sourcePaths.map(p=>[p,readFileSync(p)]));
const sourceHashes=Object.fromEntries(sourcePaths.map(p=>[p,hash(sourceBytes[p])]));
let reference=null;
if(split==='transfer'){
    if(!args.includes('--frozen-reference'))throw new Error('Transfer requires the frozen development reference');
    const bytes=readFileSync(value('--frozen-reference')),prior=JSON.parse(bytes);
    if(prior.split!=='development'||JSON.stringify(prior.sourceHashes)!==JSON.stringify(sourceHashes))
        throw new Error('Source or protocol changed after development; retain a separate new experiment');
    const previousSpecs=new Set(prior.cases.map(c=>JSON.stringify(c.spec)));
    if(corpusSpecs(split).some(s=>previousSpecs.has(JSON.stringify(s))))throw new Error('Repeated development tuple');
    reference={path:value('--frozen-reference'),sha256:hash(bytes)};
}
const load=createLoader({}, {Float32Array});
const {extractHarmonicTimbre}=load('analyzer/HarmonicTimbre.ts');
const {trackMusicalEntities}=load('analyzer/MusicalEntityTracker.ts');
const {projectMusicalRelations}=load('semantics/musicalRelations.ts');
const cases=[];
for(const spec of corpusSpecs(split)){
    const fixture=renderEntityCorpus(spec,extractHarmonicTimbre),start=performance.now();
    const registry=trackMusicalEntities(fixture.observations,fixture.identity);
    const trackingMilliseconds=performance.now()-start,relations=projectMusicalRelations(registry);
    const baseline=fixture.observations.map((o,i)=>({observationId:o.id,sourceId:`new-source-${i}`,motifId:`new-motif-${i}`}));
    cases.push({spec,identity:fixture.identity,annotationMode:fixture.annotationMode,truthSha256:fixture.truthSha256,
        stems:fixture.stems,observations:fixture.observations,truth:fixture.truth,
        measurements:Object.fromEntries(['source','motif'].map(field=>[field,{
            noMemory:pairwiseAssociation(fixture.truth,baseline,field),tracker:pairwiseAssociation(fixture.truth,registry.assignments,field)}])),
        trackingMilliseconds,registry,relations});
}

// Explicit known limits. These are not included in the easy stationary-candidate score.
const base=cases[0],copy=x=>JSON.parse(JSON.stringify(x));
const first=copy(base.observations[0]);
const shift=(o,delta,id)=>({...copy(o),id,startSample:o.startSample+delta,endSample:o.endSample+delta,
    timbre:o.timbre?{...copy(o.timbre),supportStartSample:o.timbre.supportStartSample+delta,
        supportEndSample:o.timbre.supportEndSample+delta}:null,
    notes:o.notes.map(n=>({...n,startSample:n.startSample+delta,endSample:n.endSample+delta}))});
const controls=[];
const control=(name,observations,truth)=>{
    const registry=trackMusicalEntities(observations,base.identity);
    controls.push({name,observations,truth,registry,
        source:pairwiseAssociation(truth,registry.assignments,'source'),motif:pairwiseAssociation(truth,registry.assignments,'motif')});
};
control('indistinguishable-overlap',[first,{...copy(first),id:'other'}],
    [{observationId:first.id,source:'A',motif:'M'},{observationId:'other',source:'B',motif:'M'}]);
control('indistinguishable-sequential',[first,shift(first,2*base.identity.sampleRate,'other')],
    [{observationId:first.id,source:'A',motif:'M'},{observationId:'other',source:'B',motif:'M'}]);
const changed=shift(first,2*base.identity.sampleRate,'changed');
changed.timbre.values=copy(base.observations[1].timbre.values);
control('same-source-timbre-change',[first,changed],
    [{observationId:first.id,source:'A',motif:'M'},{observationId:'changed',source:'A',motif:'M'}]);
const unresolved=shift(first,2*base.identity.sampleRate,'mixture');unresolved.kind='unresolved-mixture';
control('unresolved-mixture',[first,unresolved],
    [{observationId:first.id,source:'A',motif:'M'},{observationId:'mixture',source:'A',motif:'M'}]);
const partial=shift(first,2*base.identity.sampleRate,'partial');partial.notes=partial.notes.slice(0,3);
control('partial-musical-motif',[first,partial],
    [{observationId:first.id,source:'A',motif:'M'},{observationId:'partial',source:'A',motif:'M'}]);

const aggregate=(field,variant)=>{
    const records=cases.map(c=>c.measurements[field][variant]);
    const counts=Object.fromEntries(['truePositive','falsePositive','falseNegative','trueNegative','unknownPairs','assigned','observations']
        .map(key=>[key,records.reduce((sum,r)=>sum+r[key],0)]));
    return {...counts,precision:counts.truePositive+counts.falsePositive?counts.truePositive/(counts.truePositive+counts.falsePositive):null,
        recall:counts.truePositive+counts.falseNegative?counts.truePositive/(counts.truePositive+counts.falseNegative):null,
        coverage:counts.assigned/counts.observations};
};
const report={experiment:'AN-04A',split,sourceHashes,frozenReference:reference,
    evidenceType:'authored-association-ground-truth',upstreamInputAssistance:['isolation','boundaries','fundamental','monophonic-notes'],
    externalReferenceStatus:'unavailable-no-two-compatible-providers',confidence:null,productionPromotion:false,
    independentRecordedMusicAccuracy:null,cases,controls,
    summary:Object.fromEntries(['source','motif'].map(field=>[field,{noMemory:aggregate(field,'noMemory'),tracker:aggregate(field,'tracker')}])),
    knownLimits:['identical sequential timbres can merge different sources','changed timbre can fragment one source',
        'partial/ornamented/polyphonic motif matching unavailable','candidate extraction and pitch are supplied'],
    cost:{trackingMedianMilliseconds:cases.map(c=>c.trackingMilliseconds).sort((a,b)=>a-b)[Math.floor(cases.length/2)],
        includesCandidateExtraction:false,actualMemoryPeak:null,hardwareGuarantee:false}};
mkdirSync(dirname(output),{recursive:true});mkdirSync(output+'.sources',{recursive:false});
for(const [p,bytes] of Object.entries(sourceBytes)){
    const destination=output+'.sources/'+p;mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,bytes,{flag:'wx'});
}
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,split,cases:cases.length,summary:report.summary,
    controls:controls.map(c=>({name:c.name,source:c.source,motif:c.motif})),cost:report.cost},null,2));
