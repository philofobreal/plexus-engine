// Reproducible known-fixture measurements. Run from the repository root.
// --transport prints an enabled real AnalysisResult for independent schema tests.
// --output PATH exclusively creates a compact measurement file; never updates goldens.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { impulsePhaseCorpus, attackCorpus, pairedSampleMetrics } from '../../../tests/fixtures/acoustic-onset-fixtures.mjs';

const load = createLoader({}, {Float32Array, Float64Array});
const {extractAcousticOnsets} = load('analyzer/AcousticOnsets.ts');
const {analyzeAudio} = load('analyzer/analyzeAudio.ts');
const argv = process.argv.slice(2);
const transport = argv.length === 1 && argv[0] === '--transport';
if (!transport && !(argv.length === 2 && argv[0] === '--output')) throw new Error('Use --transport or --output NEW_FILE');
if (transport) {
    const fixture = attackCorpus(8000, 'noise');
    console.log(JSON.stringify(analyzeAudio({samples: fixture.samples, sampleRate: fixture.sampleRate, options: {acousticOnsets: {}}})));
} else {
    const cases = [];
    const measureImpulse = (sampleRate, hopSize, phases, id) => {
        const f = impulsePhaseCorpus(sampleRate, phases);
        cases.push({id, sampleRate, windowSize: 512, hopSize,
            toleranceSamples: 0, ...pairedSampleMetrics(extractAcousticOnsets(f.samples, sampleRate, {hopSize}).candidates, f.truthSamples, 0)});
    };
    measureImpulse(44100, 128, Array.from({length: 1024}, (_, i) => i), 'legacy-all-1024');
    for (const sampleRate of [8000, 16000, 22050, 44100, 48000, 96000]) for (const hopSize of [128, 256]) {
        measureImpulse(sampleRate, hopSize, [...Array.from({length: hopSize}, (_, i) => i), 511, 512, 1023], `phase-${sampleRate}-${hopSize}`);
    }
    const attacks = [];
    for (const kind of ['noise', 'pluck']) for (const sampleRate of [8000, 44100, 48000]) {
        const f = attackCorpus(sampleRate, kind);
        const metrics = pairedSampleMetrics(extractAcousticOnsets(f.samples, sampleRate).candidates, f.truthSamples, Math.ceil(.012 * sampleRate));
        attacks.push({kind, sampleRate, toleranceSeconds: .012, ...metrics,
            signedMeanSeconds: metrics.signedMeanSamples / sampleRate, absoluteP95Seconds: metrics.absoluteP95Samples / sampleRate});
    }
    const endpoints = [];
    for (const hopSize of [128, 256]) for (const length of [1, 511, 512, 1024, 1025, 8265]) for (const at of [0, length - 1]) {
        const samples = new Float32Array(length); samples[at] = .5;
        const result = extractAcousticOnsets(samples, 44100, {hopSize});
        endpoints.push({hopSize, sampleCount: length, truthSample: at,
            ...pairedSampleMetrics(result.candidates, [at], 0),
            endpointAmbiguous: result.candidates[0]?.endpointAmbiguous ?? null});
    }
    let exposureSeconds = 0, falsePositives = 0, negativeCases = 0;
    for (const sampleRate of [8000, 44100, 48000]) for (const hz of [0, 40, 110, 440, 1000]) for (const phase of [0, Math.PI / 3]) {
        const samples = Float32Array.from({length: Math.round(sampleRate * .4) + 73}, (_, i) => hz === 0 ? .2 : .2 * Math.sin(2 * Math.PI * hz * i / sampleRate + phase));
        for (const input of [samples, Float32Array.from(samples, (v, i) => v * Math.max(0, 1 - i / samples.length))]) {
            negativeCases++;
            exposureSeconds += input.length / sampleRate - .08;
            falsePositives += extractAcousticOnsets(input, sampleRate).candidates.filter(c => c.time >= .08).length;
        }
    }
    const files = ['src/analyzer/AcousticOnsets.ts', 'src/analyzer/math/SpectralFlatness.ts', 'src/analyzer/TemporalSmoother.ts',
        'src/analyzer/signalContract.ts', 'src/analyzer/math/FFT.ts', 'src/types/acousticOnsets.ts',
        'tests/fixtures/acoustic-onset-fixtures.mjs', 'tests/helpers/xr-loader.mjs', 'research/analyzer-lab/diagnostics/measure-an02-candidates.mjs'];
    const sourceHashes = Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
    const summary = {protocol: 'AN-02 first cycle; authored known regression fixtures, no independent holdout',
        defaultAlgorithmVersion: 7, acousticAlgorithm: 'overlap-energy-rise-v1', nodeVersion: process.version, sourceHashes,
        impulseCases: cases, attackCases: attacks, endpointCases: endpoints,
        negatives: {caseCount: negativeCases, exposureSeconds, falsePositives, excludedInitialSecondsPerCase: .08,
            falsePositivesPerMinute: falsePositives / exposureSeconds * 60},
        limitations: ['Isolated energy-doubling candidates; not general onset recall or instrument identity.',
            'Maximum sample-power step may follow the authored noise/pluck beginning.',
            'Fixed samples imply different physical resolution across rates; raw flux strength is incomparable across settings.',
            '15 ms sequential pairwise suppression can merge close chains.',
            'Endpoint ambiguity, mixtures, ramps, recorded music and consumer promotion remain unvalidated.']};
    writeFileSync(argv[1], JSON.stringify(summary, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({output: argv[1], impulseTruth: cases.reduce((sum, c) => sum + c.truthCount, 0), negativeCases, falsePositives}));
}
