// New frozen robustness matrix after code selection; preserve raw outputs and source hashes.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { robustnessSpecs, robustnessFixture } from '../../../tests/fixtures/predictive-onset-robustness.mjs';
import { pcmBytes, sha256 } from '../../../tests/fixtures/acoustic-onset-challenges.mjs';
import assert from 'node:assert/strict';
if (process.argv.length !== 4 || process.argv[2] !== '--output' || existsSync(process.argv[3])) throw new Error('Use --output NEW_JSON');
const load = createLoader({}, {Float32Array, Float64Array});
const {extractPredictiveOnsets} = load('analyzer/PredictiveOnsets.ts');
const {extractAcousticOnsets} = load('analyzer/AcousticOnsets.ts');
const cases = robustnessSpecs().map(spec => {
    const f = robustnessFixture(spec), before = pcmBytes(f.samples);
    const v2 = extractPredictiveOnsets(f.samples, spec.sampleRate), v1 = extractAcousticOnsets(f.samples, spec.sampleRate);
    assert.deepEqual(pcmBytes(f.samples), before);
    return {spec, pcmSha256: f.pcmSha256, truthSha256: f.truthSha256, truthSamples: f.truthSamples,
        duration: f.duration, negativeStart: f.negativeStart, candidates: v2.candidates,
        eventTimes: {plexusV1: Array.from(v1.candidates, c => c.time), predictiveV2: Array.from(v2.candidates, c => c.time)}};
});
const paths = ['src/analyzer/PredictiveOnsets.ts', 'src/types/predictiveOnsets.ts', 'src/analyzer/AcousticOnsets.ts',
    'src/analyzer/signalContract.ts', 'tests/fixtures/predictive-onset-robustness.mjs', 'research/analyzer-lab/diagnostics/measure-an03-robustness.mjs',
    'research/analyzer-lab/docs/AN-03-EXPERIMENT.md'];
writeFileSync(process.argv[3], JSON.stringify({protocol: 'AN-03 frozen synthetic robustness; not independent recordings',
    nodeVersion: process.version, sourceHashes: Object.fromEntries(paths.map(p => [p, sha256(readFileSync(p))])), cases}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output: process.argv[3], caseCount: cases.length}));
