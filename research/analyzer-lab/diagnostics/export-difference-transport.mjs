// Actual selected v5 multi-tone wire payload for independent schema/timing checks.
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';
import {residualFixture} from '../../../tests/fixtures/residual-onset-robustness.mjs';
if (process.argv.length !== 2) throw new Error('No arguments accepted');
const {analyzeAudio} = createLoader({}, {Float32Array, Float64Array})('analyzer/analyzeAudio.ts');
const f = residualFixture({family: 'positive', sampleRate: 22050, bed: 'poly', gap: .007, amplitude: .02, phase: .37});
console.log(JSON.stringify(analyzeAudio({samples: f.samples, sampleRate: 22050,
    options: {adaptiveOnsets: true, adaptiveOnsetVersion: 5, predictiveOnsets: true, acousticOnsets: {}}})));
