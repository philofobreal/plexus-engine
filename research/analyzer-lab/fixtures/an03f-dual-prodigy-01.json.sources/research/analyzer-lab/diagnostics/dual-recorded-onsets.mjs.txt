// Local PCM bridge; these candidate streams are never accepted gameplay events.
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createLoader} from '../../../tests/helpers/xr-loader.mjs';

if (process.argv.length !== 4) throw new Error('Use REQUEST_JSON NEW_OUTPUT_JSON');
const request = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
if (request.format !== 'f32le' || !Number.isSafeInteger(request.sampleCount) || request.sampleCount <= 0)
    throw new Error('Expected explicit nonempty f32le PCM');
const bytes = readFileSync(request.pcmPath);
if (bytes.length !== request.sampleCount * 4) throw new Error('PCM size mismatch');
const samples = Float32Array.from({length: request.sampleCount}, (_, i) => bytes.readFloatLE(i * 4));
const load = createLoader({}, {Float32Array, Float64Array});
const v5 = load('analyzer/DifferenceOnsets.ts').extractDifferenceOnsets(samples, request.sampleRate);
const v7 = load('analyzer/PeakOnsets.ts').extractPeakOnsets(samples, request.sampleRate);
const v6 = load('analyzer/ContinuationOnsets.ts').extractContinuationOnsets(samples, request.sampleRate);
writeFileSync(resolve(process.argv[3]), JSON.stringify({
    peakV7: v7.candidates.map(c => c.time), sampleRate: request.sampleRate, sampleCount: samples.length,
    differenceV5: v5.candidates.map(c => c.time), continuationV6: v6.candidates.map(c => c.time),
    rejected: v6.rejected.map(r => ({time: r.candidate.time, evidenceSource: r.candidate.evidenceSource, reason: r.reason}))
}) + '\n', {flag: 'wx'});
