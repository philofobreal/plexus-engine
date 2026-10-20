// Exclusive frozen selected-DSP transfer: do not retune after reading these outputs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {bandSpecs,bandFixture} from '../../../tests/fixtures/band-onset-robustness.mjs';
import {sha256} from '../../../tests/fixtures/acoustic-onset-challenges.mjs';
import {matchOnsets} from '../../../tests/helpers/onset-matching.mjs';

if(process.argv.length!==4||process.argv[2]!=='--output')throw new Error('Use --output NEW_JSON');
const output=resolve(process.argv[3]);
if(existsSync(output)||existsSync(output+'.sources'))throw new Error('Exclusive new output required');
const load=createLoader({}, {Float32Array,Float64Array});
const {extractBandOnsets}=load('analyzer/BandOnsets.ts');
const {extractContinuationOnsets}=load('analyzer/ContinuationOnsets.ts');
const sources=['src/analyzer/BandOnsets.ts','src/types/bandOnsets.ts','src/analyzer/ContinuationOnsets.ts',
    'src/analyzer/DifferenceOnsets.ts','src/analyzer/ResidualOnsets.ts','src/analyzer/signalContract.ts',
    'tests/fixtures/band-onset-robustness.mjs','tests/fixtures/acoustic-onset-challenges.mjs',
    'tests/helpers/xr-loader.mjs','tests/helpers/onset-matching.mjs',
    'research/analyzer-lab/diagnostics/measure-an03g-transfer.mjs','research/analyzer-lab/docs/AN-03G-EXPERIMENT.md'];
const bytes=Object.fromEntries(sources.map(p=>[p,readFileSync(p)])),cases=[],totals={};
for(const spec of bandSpecs()){
    const f=bandFixture(spec),variants={v6:extractContinuationOnsets(f.samples,spec.sampleRate),v8:extractBandOnsets(f.samples,spec.sampleRate)},measurements={};
    for(const [k,v] of Object.entries(variants)){
        const t=v.candidates.map(c=>c.time),sum=totals[k]??={matches2ms:0,extras2ms:0,matches25ms:0,extras25ms:0,negatives:0,negativeExposure:0};
        if(f.negativeStart!==null){const n=t.filter(t=>t>=f.negativeStart).length;measurements[k]={negatives:n};sum.negatives+=n;sum.negativeExposure+=f.duration-f.negativeStart;}
        else{
            measurements[k]=Object.fromEntries([.002,.025].map(tolerance=>[tolerance,matchOnsets(f.truthSamples.map(i=>i/spec.sampleRate),t,tolerance)]));
            sum.matches2ms+=measurements[k]['0.002'].matchedCount;sum.extras2ms+=measurements[k]['0.002'].falsePositives;
            sum.matches25ms+=measurements[k]['0.025'].matchedCount;sum.extras25ms+=measurements[k]['0.025'].falsePositives;
        }
    }
    cases.push({spec,pcmSha256:f.pcmSha256,truthSha256:f.truthSha256,truthSamples:f.truthSamples,
        duration:f.duration,negativeStart:f.negativeStart,variants,measurements});
}
const sourceHashes={};
for(const [p,b] of Object.entries(bytes)){
    assert.equal(sha256(readFileSync(p)),sha256(b),'Source changed during frozen measurement');sourceHashes[p]=sha256(b);
    const target=output+'.sources/'+p+'.txt';mkdirSync(dirname(target),{recursive:true});writeFileSync(target,b,{flag:'wx'});
}
writeFileSync(output,JSON.stringify({protocol:'AN-03G frozen related generator; no independent music truth',nodeVersion:process.version,sourceHashes,totals,cases},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,cases:cases.length,totals}));
