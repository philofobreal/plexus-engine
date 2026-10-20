// Actual headless v4 output, for independent JSON-schema and timing checks.
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {adaptiveFixture} from '../../../tests/fixtures/adaptive-onset-robustness.mjs';
if (process.argv.length !== 2) throw new Error('No arguments accepted');
const {analyzeAudio} = createLoader({}, {Float32Array, Float64Array})('analyzer/analyzeAudio.ts');
const f = adaptiveFixture({family: 'positive', sampleRate: 12000, bed: 'tone', gap: .006, phase: .41});
console.log(JSON.stringify(analyzeAudio({samples: f.samples, sampleRate: 12000,
    options: {adaptiveOnsets: true, adaptiveOnsetVersion: 4, predictiveOnsets: true, acousticOnsets: {}}})));
