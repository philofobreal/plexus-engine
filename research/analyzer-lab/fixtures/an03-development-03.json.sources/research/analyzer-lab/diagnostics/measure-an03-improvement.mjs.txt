// Known C2 development regression: actual v1/v2 core output and immutable source snapshots.
// node ... --output NEW_JSON. No protected result overwrite or provider timestamp correction.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { challengeSpecs, challengeFixture, sha256 } from '../../../tests/fixtures/acoustic-onset-challenges.mjs';

if (process.argv.length !== 4 || process.argv[2] !== '--output') throw new Error('Use --output NEW_JSON from repo root');
const destination = resolve(process.argv[3]);
if (existsSync(destination)) throw new Error('Result must be new');
const baselinePath = 'research/analyzer-lab/fixtures/an02-c2-challenges.summary.json';
const baselineBytes = readFileSync(baselinePath);
assert.equal(sha256(baselineBytes), '90a9c24c960c7f518f787599b7cdb09a66ca3330d5798a42ec5a9f240ccd844a');
const baseline = JSON.parse(baselineBytes);
const load = createLoader({}, {Float32Array, Float64Array});
const {extractAcousticOnsets} = load('analyzer/AcousticOnsets.ts');
const {extractPredictiveOnsets} = load('analyzer/PredictiveOnsets.ts');
const cases = challengeSpecs().map((spec, i) => {
    const f = challengeFixture(spec), old = baseline.cases[i];
    assert.equal(f.pcmSha256, old.pcmSha256); assert.equal(f.truthSha256, old.truthSha256);
    const v1 = extractAcousticOnsets(f.samples, spec.sampleRate);
    assert.deepEqual(Array.from(v1.candidates, c => c.time), old.eventTimes.plexusV1);
    const v2 = extractPredictiveOnsets(f.samples, spec.sampleRate);
    return {spec, pcmSha256: f.pcmSha256, truthSha256: f.truthSha256, truthSamples: f.truthSamples,
        duration: f.duration, negativeStart: f.negativeStart, candidates: v2.candidates,
        eventTimes: {plexusV1: old.eventTimes.plexusV1, predictiveV2: v2.candidates.map(c => c.time), librosa512: old.eventTimes.librosa512}};
});
const sources = ['src/analyzer/PredictiveOnsets.ts', 'src/analyzer/AcousticOnsets.ts', 'src/analyzer/signalContract.ts',
    'src/types/predictiveOnsets.ts', 'src/analyzer/analyzeAudio.ts', 'src/analyzer/normalizeAnalysisResult.ts', 'src/analyzer/types.ts', 'src/types/index.ts',
    'tests/fixtures/acoustic-onset-challenges.mjs', 'tests/helpers/xr-loader.mjs', 'research/analyzer-lab/diagnostics/measure-an03-improvement.mjs',
    'research/analyzer-lab/diagnostics/score-an03-improvement.py'];
const snapshots = destination + '.sources';
if (existsSync(snapshots)) throw new Error('Source snapshot destination must be new');
mkdirSync(snapshots, {recursive: true});
const sourceHashes = {};
for (const path of sources) {
    const bytes = readFileSync(path); sourceHashes[path] = sha256(bytes);
    const target = snapshots + '/' + path + '.txt'; mkdirSync(dirname(target), {recursive: true});
    writeFileSync(target, bytes, {flag: 'wx'});
}
writeFileSync(destination, JSON.stringify({protocol: 'AN-03 known C2 development comparison; no holdout', nodeVersion: process.version,
    baselinePath, baselineSha256: sha256(baselineBytes), sourceHashes, sourceSnapshots: snapshots, cases}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output: destination, caseCount: cases.length}));
