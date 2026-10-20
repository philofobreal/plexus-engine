// NDJSON stdout protocol: one independently reproducible PCM/truth/candidate case per line.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { challengeSpecs, challengeFixture, pcmBytes, sha256 } from '../../../tests/fixtures/acoustic-onset-challenges.mjs';
import { createStageTracer, strengthOrderedNms, KERNEL_SHA256 } from './trace-an02-stages.mjs';

export function* exportChallenges() {
    const {extractAcousticOnsets} = createLoader({}, {Float32Array, Float64Array})('analyzer/AcousticOnsets.ts');
    const trace = createStageTracer();
    for (const spec of challengeSpecs()) {
        const f = challengeFixture(spec), before = pcmBytes(f.samples);
        const actual = extractAcousticOnsets(f.samples, spec.sampleRate), traced = trace(f.samples, spec.sampleRate);
        assert.equal(JSON.stringify(traced.output), JSON.stringify(actual), 'Trace must preserve actual kernel output');
        assert.deepEqual(pcmBytes(f.samples), before, 'Analyzer/tracer must not mutate input');
        const separation = Math.max(1, Math.round(spec.sampleRate * .015));
        yield {type: 'case', spec, sampleCount: f.samples.length, duration: f.duration, negativeStart: f.negativeStart,
            truthSamples: f.truthSamples, truthSha256: f.truthSha256, pcmSha256: f.pcmSha256, pcmF32leBase64: before.toString('base64'),
            candidates: {plexusV1: actual.candidates, gatedStrengthNms: strengthOrderedNms(traced.gated, separation),
                ungatedStrengthNms: strengthOrderedNms(traced.refined, separation)},
            stages: {peakFrames: traced.peaks, refined: traced.refined, gated: traced.gated}, instrumentationParity: true};
    }
    const paths = ['src/analyzer/AcousticOnsets.ts', 'src/analyzer/math/FFT.ts', 'src/analyzer/math/SpectralFlatness.ts',
        'src/analyzer/TemporalSmoother.ts', 'src/analyzer/signalContract.ts', 'tests/helpers/xr-loader.mjs',
        'tests/fixtures/acoustic-onset-challenges.mjs', 'research/analyzer-lab/diagnostics/trace-an02-stages.mjs',
        'research/analyzer-lab/diagnostics/export-an02-challenges.mjs', 'research/analyzer-lab/docs/AN-02-C2-EXPERIMENT.md'];
    yield {type: 'identity', nodeVersion: process.version, kernelSha256: KERNEL_SHA256,
        sourceHashes: Object.fromEntries(paths.map(path => [path, sha256(readFileSync(path))]))};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.slice(2).join(' ') !== '--stream') throw new Error('Use --stream from repository root');
    for (const row of exportChallenges()) console.log(JSON.stringify(row));
}
