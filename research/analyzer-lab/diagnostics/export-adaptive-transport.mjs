// Actual integrated v1/v2/v3 payload for independent Python schema validation.
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {challengeFixture} from '../../../tests/fixtures/acoustic-onset-challenges.mjs';
if (process.argv.length !== 2) throw new Error('No arguments accepted');
const {analyzeAudio} = createLoader({}, {Float32Array, Float64Array})('analyzer/analyzeAudio.ts');
const f = challengeFixture({family: 'density', sampleRate: 8000, kind: 'noise', gapSeconds: .008, pattern: 'equal'});
console.log(JSON.stringify(analyzeAudio({samples: f.samples, sampleRate: 8000,
    options: {adaptiveOnsets: true, predictiveOnsets: true, acousticOnsets: {}}})));
