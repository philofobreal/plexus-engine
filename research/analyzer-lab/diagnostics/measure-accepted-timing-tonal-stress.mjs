// Read-only diagnostic. Prints JSON; creates or overwrites no result or snapshot.
// From plexus-engine/: node inventory.local/dc-review-stress.mjs --project review-onset.local
// Optional --baseline ABSOLUTE_PROJECT_ROOT compares a retained predecessor in memory.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2), initialDirectory = process.cwd();
const value = flag => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing ${flag} value`);
    return resolve(initialDirectory, args[i + 1]);
};
const project = value('--project') ?? initialDirectory, baseline = value('--baseline');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const scriptPath = fileURLToPath(import.meta.url);
process.chdir(project);
const { createLoader } = await import(pathToFileURL(join(project, 'tests/helpers/xr-loader.mjs')));
const { acceptedTimingFixture } = await import(pathToFileURL(join(project,
    'research/analyzer-lab/diagnostics/measure-accepted-timing.mjs')));
const load = createLoader({}, { Float32Array, Float64Array });
const refine = load('analyzer/AcceptedEventTiming.ts').refineAcceptedEventTiming;
const predecessor = baseline ? load(join(baseline, 'src/analyzer/AcceptedEventTiming.ts')).refineAcceptedEventTiming : null;
const config = { kind: 'ramp', sampleRates: [8000, 22050, 44100, 48000],
    phases: [0, 1, .125, .25, .5, .75, .95], phaseConvention: '0 and 1 are sample offsets; others are feature-hop fractions',
    hopSize: 1024, gain: 1, polarity: 1, edge: null,
    ramp: 'Unchanged historical 70 Hz, 80 ms linear-rise negative control from acceptedTimingFixture',
    backgroundFrequenciesHz: [40, 70, 220, 440], backgroundAmplitudes: [.01, .05, .15],
    backgroundPhaseRadians: .3, backgroundDC: 0,
    mixture: 'Float32Array.from(ramp.samples, (x,i) => x + amplitude*sin(2*PI*hz*i/sampleRate + 0.3))' };
const statuses = {}, baselineStatuses = {}, rows = [], changes = [];
for (const sampleRate of config.sampleRates) for (const phase of config.phases)
    for (const hz of config.backgroundFrequenciesHz) for (const amplitude of config.backgroundAmplitudes) {
        const spec = { kind: 'ramp', sampleRate, phase, gain: 1, polarity: 1, edge: null };
        const fixture = acceptedTimingFixture(spec);
        assert.equal(fixture.truthSamples.length, 0, 'This remains a declared discrete-impact negative');
        const samples = Float32Array.from(fixture.samples, (x, i) =>
            x + amplitude * Math.sin(2 * Math.PI * hz * i / sampleRate + config.backgroundPhaseRadians));
        const bytes = Buffer.alloc(samples.length * 4);
        samples.forEach((sample, i) => bytes.writeFloatLE(sample, i * 4));
        const result = refine(samples, sampleRate, fixture.hopSize, fixture.events, 2);
        const observation = result.report.observations[0];
        statuses[observation.status] = (statuses[observation.status] ?? 0) + 1;
        const old = predecessor ? predecessor(samples, sampleRate, fixture.hopSize, fixture.events, 2).report.observations[0] : null;
        if (old) {
            baselineStatuses[old.status] = (baselineStatuses[old.status] ?? 0) + 1;
            if (old.status !== observation.status || old.time !== observation.time)
                changes.push({ spec, hz, amplitude, old, current: observation });
        }
        rows.push({ spec, background: { hz, amplitude, phaseRadians: config.backgroundPhaseRadians },
            pcmSha256: sha(bytes), sampleCount: samples.length, acceptedEvents: fixture.events,
            algorithm: result.report.algorithm, observation,
            ...(old ? { baselineObservation: old } : {}) });
    }
assert.equal(rows.length, 336);
const sources = ['src/analyzer/AcceptedEventTiming.ts', 'src/analyzer/BandOnsets.ts',
    'src/analyzer/ContinuationOnsets.ts', 'src/analyzer/DifferenceOnsets.ts', 'src/analyzer/ResidualOnsets.ts',
    'src/analyzer/signalContract.ts', 'tests/helpers/xr-loader.mjs',
    'research/analyzer-lab/diagnostics/measure-accepted-timing.mjs'];
const sourceHashes = Object.fromEntries(sources.map(source => [source, sha(readFileSync(source))]));
sourceHashes[relative(project, scriptPath).replaceAll('\\', '/')] = sha(readFileSync(scriptPath));
const result = { policy: 'New review stress diagnostics, not independent musical accuracy or promotion evidence',
    nodeVersion: process.version, config, sourceHashes,
    ...(baseline ? { baselineProject: baseline,
        baselineSourceHashes: Object.fromEntries(sources.slice(0, 6).map(source =>
            [source, sha(readFileSync(join(baseline, source)))])) } : {}),
    caseCount: rows.length, statuses, remainingNegativeRefinements: rows.filter(row => row.observation.status === 'refined'),
    ...(predecessor ? { baselineStatuses, changes } : {}),
    limitation: 'A pre-frame mean fixes constant DC contamination; it does not isolate attacks from AC tonal background. Refined negatives remain failures.',
    recordedAccuracy: null, productionPromotion: false, rows };
console.log(JSON.stringify(result, null, 2));
