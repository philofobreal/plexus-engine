// Actual headless transport for independent Python JSON Schema validation.
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { challengeFixture } from '../../../tests/fixtures/acoustic-onset-challenges.mjs';
if (process.argv.length !== 2) throw new Error('No arguments accepted');
const {analyzeAudio} = createLoader({}, {Float32Array, Float64Array})('analyzer/analyzeAudio.ts');
const f = challengeFixture({family: 'mixture', sampleRate: 8000, kind: 'noise', ratio: .1, phase: 0});
console.log(JSON.stringify(analyzeAudio({samples: f.samples, sampleRate: 8000, options: {predictiveOnsets: true, acousticOnsets: {}}})));
