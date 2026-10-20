// Recompute v4/v5 on identical authored fixtures; exclusive immutable results.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {challengeSpecs, challengeFixture, sha256} from '../../../tests/fixtures/acoustic-onset-challenges.mjs';
import {robustnessSpecs, robustnessFixture} from '../../../tests/fixtures/predictive-onset-robustness.mjs';
import {adaptiveSpecs, adaptiveFixture} from '../../../tests/fixtures/adaptive-onset-robustness.mjs';
import {residualSpecs, residualFixture} from '../../../tests/fixtures/residual-onset-robustness.mjs';
import {differenceSpecs, differenceFixture} from '../../../tests/fixtures/difference-onset-robustness.mjs';

if (![4, 5].includes(process.argv.length) || process.argv[2] !== '--output'
    || (process.argv.length === 5 && process.argv[4] !== '--frozen')) throw new Error('Use --output NEW_JSON [--frozen]');
const frozen = process.argv[4] === '--frozen', output = resolve(process.argv[3]);
if (existsSync(output) || existsSync(output + '.sources')) throw new Error('Output must be new');
const load = createLoader({}, {Float32Array, Float64Array});
const {extractResidualOnsets} = load('analyzer/ResidualOnsets.ts');
const {extractDifferenceOnsets} = load('analyzer/DifferenceOnsets.ts');
const baselinePaths = ['research/analyzer-lab/fixtures/an03c-development-final.json',
    'research/analyzer-lab/fixtures/an03c-robustness-frozen.json'];
const sourcePaths = ['src/analyzer/DifferenceOnsets.ts', 'src/analyzer/ResidualOnsets.ts',
    'src/analyzer/signalContract.ts', 'tests/helpers/xr-loader.mjs',
    'tests/fixtures/acoustic-onset-challenges.mjs', 'tests/fixtures/predictive-onset-robustness.mjs',
    'tests/fixtures/adaptive-onset-robustness.mjs', 'tests/fixtures/residual-onset-robustness.mjs',
    'tests/fixtures/difference-onset-robustness.mjs',
    'src/types/differenceOnsets.ts', 'src/types/residualOnsets.ts', 'src/types/adaptiveOnsets.ts', 'src/types/predictiveOnsets.ts',
    'src/analyzer/analyzeAudio.ts', 'src/analyzer/normalizeAnalysisResult.ts', 'src/analyzer/types.ts', 'src/types/index.ts',
    'tests/fixtures/analyzer/analysis-result.schema.json',
    'research/analyzer-lab/diagnostics/measure-an03d.mjs', 'research/analyzer-lab/diagnostics/score-an03d.py'];
const cases = [], baselineHashes = {};
for (const [matrix, specs, fixture, path, offset] of (frozen ? [['frozen', differenceSpecs(), differenceFixture, null, 0]] : [
    ['c2', challengeSpecs(), challengeFixture, baselinePaths[0], 0],
    ['an03', robustnessSpecs(), robustnessFixture, baselinePaths[0], 144],
    ['an03b', adaptiveSpecs(), adaptiveFixture, baselinePaths[0], 189],
    ['an03c', residualSpecs(), residualFixture, baselinePaths[1], 0]])) {
    const bytes = path ? readFileSync(path) : null, old = bytes ? JSON.parse(bytes) : null;
    if (old) {
        baselineHashes[path] = sha256(bytes);
        assert.equal(sha256(readFileSync('src/analyzer/ResidualOnsets.ts')), old.sourceHashes['src/analyzer/ResidualOnsets.ts']);
    }
    for (let i = 0; i < specs.length; i++) {
        const f = fixture(specs[i]);
        if (old) {
            assert.equal(f.pcmSha256, old.cases[i + offset].pcmSha256);
            assert.equal(f.truthSha256, old.cases[i + offset].truthSha256);
        }
        const v4 = extractResidualOnsets(f.samples, specs[i].sampleRate);
        if (old) assert.deepEqual(Array.from(v4.candidates, c => c.time), old.cases[i + offset].eventTimes.residualV4);
        const v5 = extractDifferenceOnsets(f.samples, specs[i].sampleRate);
        cases.push({matrix, spec: specs[i], pcmSha256: f.pcmSha256, truthSha256: f.truthSha256,
            truthSamples: f.truthSamples, duration: f.duration, negativeStart: f.negativeStart,
            candidates: v5.candidates, eventTimes: {residualV4: v4.candidates.map(c => c.time), differenceV5: v5.candidates.map(c => c.time)}});
    }
}
mkdirSync(output + '.sources', {recursive: true});
const sourceHashes = {};
for (const path of sourcePaths) {
    const bytes = readFileSync(path), target = output + '.sources/' + path + '.txt';
    sourceHashes[path] = sha256(bytes); mkdirSync(dirname(target), {recursive: true}); writeFileSync(target, bytes, {flag: 'wx'});
}
writeFileSync(output, JSON.stringify({protocol: frozen ? 'AN-03D frozen synthetic transfer; not recordings' : 'AN-03D known development; no holdout',
    nodeVersion: process.version, baselineHashes, sourceHashes, cases}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, cases: cases.length}));
