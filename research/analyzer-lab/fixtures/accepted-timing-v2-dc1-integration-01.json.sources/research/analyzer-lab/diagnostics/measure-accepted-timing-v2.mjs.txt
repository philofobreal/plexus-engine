// Known development/regression matrix, reused after the v1 ramp failure motivated v2.
// node research/analyzer-lab/diagnostics/measure-accepted-timing-v2.mjs --output NEW_JSON [--pcm-cache EXACT_CACHE]
// Import-safe; no detector tuning, historical result replacement, or recorded accuracy claim.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { TIMING_CONFIG, acceptedTimingSpecs, measureAcceptedFixture, summarizeAcceptedMeasurements, sha256 }
    from './measure-accepted-timing.mjs';

export const V2_CONFIG = Object.freeze({
    predecessor: 'research/analyzer-lab/fixtures/accepted-timing-authored-01.json',
    protocol: 'documents/research/onset-placement-v2-experiment.md',
    firstWindowSeconds: .001, bodyWindowSeconds: .012, minimumMeanPowerRatio: .25,
    sourceVersion: 2, analyzerOption: 'local-band-v2',
    controlPolicy: 'Same 340 known development/regression controls; no independent musical holdout',
});

function plain(value) { return JSON.parse(JSON.stringify(value)); }

function sourcesUnder(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? sourcesUnder(path) : path.endsWith('.ts') ? [path.replaceAll('\\', '/')] : [];
    });
}

function observedRun(fn) {
    const cpuStart = process.cpuUsage(), start = performance.now(), result = fn();
    const elapsedMs = performance.now() - start, cpu = process.cpuUsage(cpuStart);
    return { result, elapsedMs, cpuMs: (cpu.user + cpu.system) / 1000 };
}

export function compareAuthoredTimingVersions(refine, historical) {
    const specs = acceptedTimingSpecs();
    assert.equal(specs.length, historical.cases.length, 'Historical controls lost');
    const v1 = [], v2 = [], cases = [];
    for (const [index, spec] of specs.entries()) {
        const first = measureAcceptedFixture((...args) => refine(...args, 1), spec);
        assert.deepEqual(plain(first), historical.cases[index], `Historical v1 output changed at control ${index}`);
        const second = measureAcceptedFixture((...args) => refine(...args, 2), spec);
        v1.push(first); v2.push(second);
        cases.push({ historicalCaseIndex: index, spec, pcmSha256: second.pcmSha256,
            truthSha256: second.truthSha256, truthSamples: second.truthSamples, sampleCount: second.sampleCount,
            acceptedBefore: second.acceptedBefore, acceptedCountBefore: second.acceptedCountBefore,
            acceptedCountAfterV1: first.acceptedCountAfter, acceptedCountAfterV2: second.acceptedCountAfter,
            negativeExposureSeconds: second.negativeExposureSeconds,
            v1: { acceptedAfter: first.acceptedAfter, observations: first.observations,
                negativeRefinements: first.negativeRefinements, timing: first.timing },
            v2: { acceptedAfter: second.acceptedAfter, observations: second.observations,
                negativeRefinements: second.negativeRefinements, timing: second.timing } });
    }
    const strata = (key, values) => Object.fromEntries(values.map(value => [value, {
        v1: summarizeAcceptedMeasurements(v1.filter(c => c.spec[key] === value)),
        v2: summarizeAcceptedMeasurements(v2.filter(c => c.spec[key] === value)) }]));
    const positiveRegressions = cases.filter(c => c.truthSamples.length).flatMap(c => {
        const losses = TIMING_CONFIG.tolerancesMs.filter(ms => c.v2.timing[ms].after.matchedCount < c.v1.timing[ms].after.matchedCount);
        const changedToAbstention = c.v1.observations.some((o, i) => o.status === 'refined' && c.v2.observations[i].status !== 'refined');
        return losses.length || changedToAbstention ? [{ historicalCaseIndex: c.historicalCaseIndex, spec: c.spec,
            lostMatchTolerancesMs: losses, changedToAbstention,
            v1Statuses: c.v1.observations.map(o => o.status), v2Statuses: c.v2.observations.map(o => o.status) }] : [];
    });
    return { historicalV1IdenticalCaseCount: cases.length,
        summary: { v1: summarizeAcceptedMeasurements(v1), v2: summarizeAcceptedMeasurements(v2) },
        bySampleRate: strata('sampleRate', TIMING_CONFIG.sampleRates),
        byPhase: strata('phase', TIMING_CONFIG.phaseOffsets),
        byKind: strata('kind', [...new Set(specs.map(s => s.kind))]),
        positiveRegressions, cases };
}

function measureRecorded(cache, load, refine, historical) {
    const oldByHash = new Map(historical.recorded.rows.map(row => [row.pcmSha256, row]));
    const analyzeAudio = load('analyzer/analyzeAudio.ts').analyzeAudio, rows = [];
    for (const name of readdirSync(cache).filter(n => n.endsWith('.request.json')).sort()) {
        const requestBytes = readFileSync(join(cache, name)), request = JSON.parse(requestBytes);
        assert.equal(request.format, 'f32le');
        assert.ok(Number.isSafeInteger(request.sampleCount) && request.sampleCount > 0);
        const pcmPath = join(cache, name.replace('.request.json', '.f32le'));
        assert.equal(basename(request.pcmPath), basename(pcmPath));
        const bytes = readFileSync(pcmPath), pcmSha256 = sha256(bytes), old = oldByHash.get(pcmSha256);
        assert.equal(bytes.length, 4 * request.sampleCount);
        assert.ok(old, 'No immutable historical PCM identity');
        assert.equal(request.sampleRate, old.sampleRate); assert.equal(request.sampleCount, old.sampleCount);
        assert.equal(sha256(requestBytes), old.requestSha256);
        const samples = Float32Array.from({ length: request.sampleCount }, (_, i) => bytes.readFloatLE(i * 4));
        const { result: baseline, elapsedMs: baselineElapsedMs, cpuMs: baselineCpuMs } = observedRun(() =>
            analyzeAudio({ samples, sampleRate: request.sampleRate }));
        assert.deepEqual(plain(baseline.events.map(e => e.time)), old.acceptedBefore, 'Historical default times changed');
        const { result: first, elapsedMs: v1LocalElapsedMs, cpuMs: v1LocalCpuMs } = observedRun(() =>
            refine(samples, request.sampleRate, baseline.hopSize, baseline.events, 1));
        assert.deepEqual(plain(first.events.map(e => e.time)), old.acceptedAfter, 'Historical v1 times changed');
        assert.deepEqual(plain(first.report.observations), old.observations, 'Historical v1 observations changed');
        const { result: opted, elapsedMs: optedV2ElapsedMs, cpuMs: optedV2CpuMs } = observedRun(() =>
            analyzeAudio({ samples, sampleRate: request.sampleRate, options: { eventTiming: 'local-band-v2' } }));
        const { result: second, elapsedMs: v2LocalElapsedMs, cpuMs: v2LocalCpuMs } = observedRun(() =>
            refine(samples, request.sampleRate, baseline.hopSize, baseline.events, 2));
        assert.equal(JSON.stringify(second.events), JSON.stringify(opted.events));
        assert.equal(baseline.events.length, opted.events.length);
        const statuses = {}, previousStatuses = {};
        for (const [i, o] of second.report.observations.entries()) {
            assert.equal(baseline.events[i].type, opted.events[i].type);
            assert.equal(baseline.events[i].intensity, opted.events[i].intensity);
            statuses[o.status] = (statuses[o.status] ?? 0) + 1;
            previousStatuses[first.report.observations[i].status] = (previousStatuses[first.report.observations[i].status] ?? 0) + 1;
        }
        const shifts = opted.events.map((e, i) => 1000 * (e.time - baseline.events[i].time));
        rows.push({ file: old.file, fraction: old.fraction, requestSha256: sha256(requestBytes), pcmSha256,
            sampleRate: request.sampleRate, sampleCount: samples.length, hopSize: baseline.hopSize,
            contextStartSample: old.contextStartSample, excerptStartSample: old.excerptStartSample, excerptEndSample: old.excerptEndSample,
            groundTruth: null, accuracy: null, historicalDefaultAndV1OutputIdentical: true,
            acceptedCountBefore: baseline.events.length, acceptedCountAfterV1: first.events.length, acceptedCountAfterV2: opted.events.length,
            v1Statuses: previousStatuses, v2Statuses: statuses,
            v1ShiftedCount: old.shiftedCount, v2ShiftedCount: shifts.filter(v => v !== 0).length,
            maximumV2ShiftMs: shifts.length ? Math.max(...shifts) : null,
            costs: { baselineElapsedMs, baselineCpuMs, v1LocalElapsedMs, v1LocalCpuMs,
                optedV2ElapsedMs, optedV2CpuMs, v2LocalElapsedMs, v2LocalCpuMs },
            acceptedBefore: baseline.events.map(e => e.time), acceptedAfterV1: first.events.map(e => e.time),
            acceptedAfterV2: opted.events.map(e => e.time), v1Observations: first.report.observations,
            v2Observations: second.report.observations });
        console.log(JSON.stringify({ recorded: name, accepted: baseline.events.length, v1Statuses: previousStatuses, v2Statuses: statuses }));
    }
    assert.equal(rows.length, historical.recorded.rows.length, 'Historical recorded clips lost');
    const summary = { clips: rows.length,
        nominalExcerptSeconds: rows.reduce((s, r) => s + (r.excerptEndSample - r.excerptStartSample) / r.sampleRate, 0),
        acceptedCountBefore: rows.reduce((s, r) => s + r.acceptedCountBefore, 0),
        acceptedCountAfterV1: rows.reduce((s, r) => s + r.acceptedCountAfterV1, 0),
        acceptedCountAfterV2: rows.reduce((s, r) => s + r.acceptedCountAfterV2, 0),
        v1Statuses: {}, v2Statuses: {}, costs: {},
        v1ShiftedCount: rows.reduce((s, r) => s + r.v1ShiftedCount, 0),
        v2ShiftedCount: rows.reduce((s, r) => s + r.v2ShiftedCount, 0) };
    for (const row of rows) {
        for (const version of ['v1Statuses', 'v2Statuses']) for (const [status, count] of Object.entries(row[version]))
            summary[version][status] = (summary[version][status] ?? 0) + count;
        for (const [name, value] of Object.entries(row.costs)) summary.costs[name] = (summary.costs[name] ?? 0) + value;
    }
    return { policy: 'Exact retained PCM; default and v1 historical identity; v2 coverage, shifts and host cost only',
        groundTruth: null, accuracy: null, costsPolicy: 'Single observed run per mode; not controlled performance or headset evidence', summary, rows };
}

export function runAcceptedTimingV2Measurement({ output, pcmCache }) {
    const target = resolve(output), projectRelative = relative(resolve('.'), target), bundle = target + '.sources';
    assert.ok(!existsSync(target) && !existsSync(bundle), 'Exclusive new output and source bundle required');
    assert.ok(projectRelative && !projectRelative.startsWith('..') && !projectRelative.includes(':') && target.endsWith('.json'),
        'Output must be a new JSON inside the current project');
    const predecessorBytes = readFileSync(V2_CONFIG.predecessor), historical = JSON.parse(predecessorBytes);
    assert.equal(historical.protocol, 'accepted-frame-local-timing-authored-v1');
    const sources = [...sourcesUnder('src/analyzer'), ...sourcesUnder('src/types'),
        'tests/helpers/xr-loader.mjs', 'documents/research/onset-placement-experiment.md', V2_CONFIG.protocol,
        'research/analyzer-lab/diagnostics/measure-accepted-timing.mjs',
        'research/analyzer-lab/diagnostics/measure-accepted-timing-v2.mjs'].sort();
    const snapshots = Object.fromEntries(sources.map(p => [p, readFileSync(p)]));
    const load = createLoader({}, { Float32Array, Float64Array });
    const refine = load('analyzer/AcceptedEventTiming.ts').refineAcceptedEventTiming;
    const authored = compareAuthoredTimingVersions(refine, historical);
    const recorded = pcmCache ? measureRecorded(resolve(pcmCache), load, refine, historical) : null;
    const sourceHashes = Object.fromEntries(Object.entries(snapshots).map(([p, bytes]) => {
        assert.equal(sha256(readFileSync(p)), sha256(bytes), `Source changed during measurement: ${p}`);
        return [p, sha256(bytes)];
    }));
    assert.equal(sha256(readFileSync(V2_CONFIG.predecessor)), sha256(predecessorBytes), 'Predecessor result changed');
    const report = { protocol: 'accepted-frame-local-timing-development-v2', config: V2_CONFIG,
        sharedFixtureConfig: TIMING_CONFIG, nodeVersion: process.version,
        typescriptVersion: JSON.parse(readFileSync('node_modules/typescript/package.json')).version,
        predecessorSha256: sha256(predecessorBytes), sourceHashes,
        truthPolicy: 'Authored mathematical attack times and manually accepted frames; known development/regression matrix',
        limits: ['Same generator and all previously viewed controls; no independent musical holdout',
            'Gate selected from known ramp failure geometry, not validated universal audible onset threshold',
            'Coverage, negative refinements and every positive regression retained; matched-only errors exclude misses',
            'Recorded audible onset accuracy remains unknown; no physical XR precision claim'],
        authored, recorded };
    for (const [p, bytes] of Object.entries(snapshots)) {
        const destination = join(bundle, p + '.txt'); mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, bytes, { flag: 'wx' });
    }
    writeFileSync(target, JSON.stringify(report) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ output: target, sourceCount: sources.length, authored: authored.summary,
        positiveRegressions: authored.positiveRegressions.length, recorded: recorded?.summary ?? null }));
    return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
        assert.ok(['--output', '--pcm-cache'].includes(args[i]) && args[i + 1], 'Use --output NEW_JSON [--pcm-cache EXACT_CACHE]');
        const key = args[i] === '--output' ? 'output' : 'pcmCache';
        assert.ok(!Object.hasOwn(options, key), 'Duplicate CLI option'); options[key] = args[i + 1];
    }
    assert.ok(options.output, 'Use --output NEW_JSON [--pcm-cache EXACT_CACHE]');
    runAcceptedTimingV2Measurement(options);
}
