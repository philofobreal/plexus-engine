// Authored accepted-frame localization controls. Never event eligibility or recorded onset truth.
// node research/analyzer-lab/diagnostics/measure-accepted-timing.mjs --output NEW_JSON
// Optional: --pcm-cache EXACT_AN03F_CACHE; original f32le is analyzed without resampling/padding.
// Exports are import-safe for regression tests. CLI refuses to overwrite any result.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';

export const TIMING_CONFIG = Object.freeze({
    baselineCommit: '72800fe', sampleRates: [8000, 22050, 44100, 48000], hopSize: 1024,
    phaseOffsets: [0, 1, .125, .25, .5, .75, .95],
    phaseConvention: '0 and 1 are samples; other values are fractions of feature hop',
    tolerancesMs: [2, 10, 25, 50], noiseSeed: 0x51a73,
    frameStartMinimumSeconds: .12, durationAfterFrameSeconds: .2,
    noiseDecaySeconds: .022, noisePulseSeconds: .065, doubleSpacingSeconds: .011,
    kickHz: 70, kickDecaySeconds: .035, highHitMaxHz: 3200,
    bassHz: 70, bassGain: .3, quietNoiseGain: .025,
    oscillatorInitialPhaseRadians: .3, pulseGain: .8, dcAmplitude: .2,
    rampGain: .4, rampRiseSeconds: .08, gainSweep: [.01, .1, 1], polaritySweep: [-1, 1],
    gainPolarityPhase: .25, acceptedEvent: { type: 1, intensity: .8 },
    searchCapSeconds: .03, historySeconds: .06, tailSeconds: .03,
    clusterSpanSeconds: .003, pcmPeakFloor: 1e-6, cumulativeSampleBudget: 50000000,
    bandOptions: { innovationContrast: 16, continuationRatio: 1.3, physicalPeakContrast: 8, physicalFloor: 1e-4 },
    profile: { warmups: 1, measuredRuns: 3, wallClockConstraints: false },
});

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function seededNoise(seed) {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        return ((state >>> 0) / 4294967296) * 2 - 1;
    };
}

export function acceptedTimingSpecs() {
    const kinds = ['noise-decay', 'impulse', 'low-kick', 'high-hit', 'quiet-noise-over-bass',
        'double-attacks', 'sustain', 'dc', 'silence', 'ramp', 'cutoff'];
    const specs = [];
    for (const sampleRate of TIMING_CONFIG.sampleRates) {
        for (const phase of TIMING_CONFIG.phaseOffsets) for (const kind of kinds)
            specs.push({ kind, sampleRate, phase, gain: 1, polarity: 1, edge: null });
        for (const gain of [.01, .1, 1]) for (const polarity of [-1, 1])
            specs.push({ kind: 'noise-decay', sampleRate, phase: .25, gain, polarity, edge: null });
        for (const edge of ['start', 'end'])
            specs.push({ kind: 'noise-decay', sampleRate, phase: 0, gain: 1, polarity: 1, edge });
    }
    return specs;
}

export function acceptedTimingFixture(spec) {
    const { sampleRate, phase, gain = 1, polarity = 1, kind, edge = null } = spec;
    assert.ok(TIMING_CONFIG.sampleRates.includes(sampleRate));
    assert.ok(TIMING_CONFIG.phaseOffsets.includes(phase));
    assert.ok(Number.isFinite(gain) && gain > 0 && [-1, 1].includes(polarity));
    const hopSize = TIMING_CONFIG.hopSize;
    let frameStart = Math.ceil(TIMING_CONFIG.frameStartMinimumSeconds * sampleRate / hopSize) * hopSize;
    if (edge === 'start') frameStart = 0;
    const offset = phase <= 1 && Number.isInteger(phase) ? phase : Math.round(phase * hopSize);
    const onset = frameStart + offset;
    const count = edge === 'end' ? frameStart + 1
        : frameStart + hopSize + Math.ceil(TIMING_CONFIG.durationAfterFrameSeconds * sampleRate);
    const samples = new Float32Array(count), truthSamples = [];
    const noise = seededNoise(TIMING_CONFIG.noiseSeed);
    const pulse = (start, amplitude) => {
        for (let i = start; i < Math.min(count, start + Math.ceil(.065 * sampleRate)); i++)
            samples[i] += amplitude * noise() * Math.exp(-(i - start) / (.022 * sampleRate));
    };
    if (kind === 'sustain' || kind === 'cutoff' || kind === 'quiet-noise-over-bass')
        for (let i = 0; i < count; i++) samples[i] = .3 * Math.sin(2 * Math.PI * 70 * i / sampleRate + .3);
    switch (kind) {
        case 'noise-decay': pulse(onset, .8); truthSamples.push(onset); break;
        case 'quiet-noise-over-bass': pulse(onset, .025); truthSamples.push(onset); break;
        case 'double-attacks': {
            const second = onset + Math.round(.011 * sampleRate);
            pulse(onset, .8); pulse(second, .8); truthSamples.push(onset, second); break;
        }
        case 'impulse': samples[onset] = .8; truthSamples.push(onset); break;
        case 'low-kick':
        case 'high-hit': {
            const hz = kind === 'low-kick' ? 70 : Math.min(3200, .2 * sampleRate);
            for (let i = onset; i < count; i++) samples[i] = .8 * Math.sin(2 * Math.PI * hz * (i - onset) / sampleRate + .3)
                * Math.exp(-(i - onset) / (.035 * sampleRate));
            truthSamples.push(onset); break;
        }
        case 'dc': samples.fill(.2); break;
        case 'ramp':
            // Gradual 80 ms rise is a negative control for discrete impact localization.
            for (let i = onset; i < count; i++) samples[i] = .4 * Math.min(1, (i - onset) / (.08 * sampleRate))
                * Math.sin(2 * Math.PI * 70 * i / sampleRate);
            break;
        case 'cutoff': samples.fill(0, onset); break;
        case 'silence': case 'sustain': break;
        default: throw new Error(`Unknown authored control ${kind}`);
    }
    for (let i = 0; i < count; i++) samples[i] *= gain * polarity;
    const events = [{ time: frameStart / sampleRate, type: 1, intensity: .8 }];
    const bytes = Buffer.alloc(samples.length * 4);
    samples.forEach((v, i) => bytes.writeFloatLE(v, 4 * i));
    return { samples, sampleRate, hopSize, events, truthSamples,
        pcmSha256: sha256(bytes), truthSha256: sha256(JSON.stringify(truthSamples)),
        negativeExposureSeconds: truthSamples.length ? 0 : Math.min(hopSize, Math.ceil(.03 * sampleRate)) / sampleRate };
}

// Maximum-cardinality one-to-one matching. Chronological ties do not minimize errors.
export function matchTiming(truth, estimated, toleranceMs) {
    assert.ok(Number.isFinite(toleranceMs) && toleranceMs >= 0);
    assert.ok([...truth, ...estimated].every(t => Number.isFinite(t) && t >= 0));
    const owners = new Map();
    function augment(i, seen) {
        for (let j = 0; j < estimated.length; j++) {
            if (seen.has(j) || Math.abs(truth[i] - estimated[j]) > toleranceMs / 1000) continue;
            seen.add(j);
            if (!owners.has(j) || augment(owners.get(j), seen)) { owners.set(j, i); return true; }
        }
        return false;
    }
    for (let i = 0; i < truth.length; i++) augment(i, new Set());
    const pairs = [...owners].sort((a, b) => a[0] - b[0]).map(([estimateIndex, truthIndex]) => ({
        truthIndex, estimateIndex, signedErrorMs: 1000 * (estimated[estimateIndex] - truth[truthIndex]) }));
    return { matchedCount: pairs.length, misses: truth.length - pairs.length,
        unmatchedEstimates: estimated.length - pairs.length, pairs, ...errorStatistics(pairs.map(p => p.signedErrorMs)) };
}

function quantile(sorted, q) {
    if (!sorted.length) return null;
    const at = (sorted.length - 1) * q, low = Math.floor(at);
    return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low);
}

function errorStatistics(signed) {
    const absolute = signed.map(Math.abs).sort((a, b) => a - b);
    return { matchedOnlySignedBiasMs: signed.length ? signed.reduce((a, b) => a + b, 0) / signed.length : null,
        matchedOnlyAbsoluteP50Ms: quantile(absolute, .5), matchedOnlyAbsoluteP95Ms: quantile(absolute, .95) };
}

export function measureAcceptedFixture(refine, spec) {
    const fixture = acceptedTimingFixture(spec), beforeHash = fixture.pcmSha256;
    const result = refine(fixture.samples, fixture.sampleRate, fixture.hopSize, fixture.events);
    assert.equal(result.events.length, fixture.events.length, 'Accepted count changed');
    for (const [i, event] of result.events.entries()) {
        assert.equal(event.type, fixture.events[i].type); assert.equal(event.intensity, fixture.events[i].intensity);
        assert.ok(event.time >= fixture.events[i].time && event.time < fixture.events[i].time + fixture.hopSize / fixture.sampleRate);
    }
    const bytes = Buffer.alloc(fixture.samples.length * 4);
    fixture.samples.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
    assert.equal(sha256(bytes), beforeHash, 'Input PCM changed');
    const truth = fixture.truthSamples.map(i => i / fixture.sampleRate);
    const before = fixture.events.map(e => e.time), after = result.events.map(e => e.time);
    return { spec, pcmSha256: fixture.pcmSha256, truthSha256: fixture.truthSha256,
        sampleCount: fixture.samples.length, truthSamples: fixture.truthSamples, acceptedBefore: before, acceptedAfter: after,
        acceptedCountBefore: before.length, acceptedCountAfter: after.length, observations: result.report.observations,
        negativeExposureSeconds: fixture.negativeExposureSeconds,
        negativeRefinements: truth.length ? 0 : result.report.observations.filter(o => o.status === 'refined').length,
        timing: Object.fromEntries(TIMING_CONFIG.tolerancesMs.map(ms => [ms, {
            before: matchTiming(truth, before, ms), after: matchTiming(truth, after, ms) }])) };
}

export function summarizeAcceptedMeasurements(cases) {
    const statuses = {}, timing = {};
    for (const c of cases) for (const o of c.observations) statuses[o.status] = (statuses[o.status] ?? 0) + 1;
    for (const ms of TIMING_CONFIG.tolerancesMs) {
        timing[ms] = {};
        for (const variant of ['before', 'after']) {
            const rows = cases.filter(c => c.truthSamples.length).map(c => c.timing[ms][variant]);
            timing[ms][variant] = {
                matchedCount: rows.reduce((sum, r) => sum + r.matchedCount, 0),
                misses: rows.reduce((sum, r) => sum + r.misses, 0),
                unmatchedEstimates: rows.reduce((sum, r) => sum + r.unmatchedEstimates, 0),
                ...errorStatistics(rows.flatMap(r => r.pairs.map(p => p.signedErrorMs))) };
        }
    }
    return { caseCount: cases.length, acceptedCountBefore: cases.reduce((s, c) => s + c.acceptedCountBefore, 0),
        acceptedCountAfter: cases.reduce((s, c) => s + c.acceptedCountAfter, 0), statuses,
        negativeCaseCount: cases.filter(c => !c.truthSamples.length).length,
        negativeRefinements: cases.reduce((s, c) => s + c.negativeRefinements, 0),
        negativeExposureSeconds: cases.reduce((s, c) => s + c.negativeExposureSeconds, 0), timing };
}

function sourceFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path.replaceAll('\\', '/')] : [];
    });
}

function observedRun(fn) {
    const cpuStart = process.cpuUsage(), start = performance.now(), result = fn();
    const elapsedMs = performance.now() - start, cpu = process.cpuUsage(cpuStart);
    return { result, elapsedMs, cpuMs: (cpu.user + cpu.system) / 1000 };
}

function profileLocal(refine) {
    return TIMING_CONFIG.sampleRates.map(sampleRate => {
        const f = acceptedTimingFixture({ kind: 'noise-decay', sampleRate, phase: .25 });
        refine(f.samples, sampleRate, f.hopSize, f.events);
        const runs = []; let expected;
        for (let i = 0; i < 3; i++) {
            const { result, elapsedMs, cpuMs } = observedRun(() => refine(f.samples, sampleRate, f.hopSize, f.events));
            const resultSha256 = sha256(JSON.stringify(result));
            if (expected) assert.equal(resultSha256, expected); expected = resultSha256;
            runs.push({ elapsedMs, cpuMs, resultSha256 });
        }
        return { sampleRate, pcmSha256: f.pcmSha256, sampleCount: f.samples.length,
            acceptedEventCount: f.events.length, runs, medianMs: quantile(runs.map(r => r.elapsedMs).sort((a, b) => a - b), .5) };
    });
}

function measureRecorded(cache, load, refine) {
    const manifestPath = 'research/analyzer-lab/fixtures/an03f-dual-prodigy-01.json';
    const manifestBytes = readFileSync(manifestPath), prior = JSON.parse(manifestBytes);
    const byHash = new Map(prior.rows.map(r => [r.excerptWithContextPcmSha256, r]));
    const analyzeAudio = load('analyzer/analyzeAudio.ts').analyzeAudio;
    const rows = [];
    for (const name of readdirSync(cache).filter(n => n.endsWith('.request.json')).sort()) {
        const requestBytes = readFileSync(join(cache, name)), request = JSON.parse(requestBytes);
        assert.equal(request.format, 'f32le'); assert.ok(Number.isSafeInteger(request.sampleCount) && request.sampleCount > 0);
        const pcmPath = join(cache, name.replace('.request.json', '.f32le'));
        assert.equal(basename(request.pcmPath), basename(pcmPath));
        const bytes = readFileSync(pcmPath); assert.equal(bytes.length, 4 * request.sampleCount);
        const pcmSha256 = sha256(bytes), identity = byHash.get(pcmSha256);
        assert.ok(identity, 'PCM has no immutable recorded identity');
        assert.equal(request.sampleRate, identity.track.sampleRate);
        assert.equal(request.sampleCount, identity.contextEndSample - identity.contextStartSample);
        const samples = Float32Array.from({ length: request.sampleCount }, (_, i) => bytes.readFloatLE(i * 4));
        const { result: baseline, elapsedMs: baselineElapsedMs, cpuMs: baselineCpuMs } = observedRun(() =>
            analyzeAudio({ samples, sampleRate: request.sampleRate }));
        const { result: opted, elapsedMs: optedElapsedMs, cpuMs: optedCpuMs } = observedRun(() =>
            analyzeAudio({ samples, sampleRate: request.sampleRate, options: { eventTiming: 'local-band-v1' } }));
        const { result: local, elapsedMs: localInspectionElapsedMs, cpuMs: localInspectionCpuMs } = observedRun(() =>
            refine(samples, request.sampleRate, baseline.hopSize, baseline.events));
        assert.equal(baseline.events.length, opted.events.length);
        assert.equal(JSON.stringify(local.events), JSON.stringify(opted.events));
        const statuses = {};
        for (const [i, o] of opted.trackAnalysis.eventTiming.observations.entries()) {
            assert.equal(baseline.events[i].type, opted.events[i].type);
            assert.equal(baseline.events[i].intensity, opted.events[i].intensity);
            statuses[o.status] = (statuses[o.status] ?? 0) + 1;
        }
        const shifts = opted.events.map((e, i) => 1000 * (e.time - baseline.events[i].time));
        rows.push({ file: identity.file, fraction: identity.fraction, requestSha256: sha256(requestBytes),
            pcmSha256, sampleRate: request.sampleRate, sampleCount: samples.length, hopSize: baseline.hopSize,
            contextStartSample: identity.contextStartSample, excerptStartSample: identity.excerptStartSample,
            excerptEndSample: identity.excerptEndSample, groundTruth: null, accuracy: null,
            acceptedCountBefore: baseline.events.length, acceptedCountAfter: opted.events.length,
            statuses, shiftedCount: shifts.filter(v => v !== 0).length,
            maximumShiftMs: shifts.length ? Math.max(...shifts) : null,
            shiftedOnlyP50Ms: quantile(shifts.filter(v => v !== 0).sort((a, b) => a - b), .5),
            shiftedOnlyP95Ms: quantile(shifts.filter(v => v !== 0).sort((a, b) => a - b), .95),
            fullAnalysisCosts: { baselineElapsedMs, optedElapsedMs, localInspectionElapsedMs,
                baselineCpuMs, optedCpuMs, localInspectionCpuMs },
            acceptedBefore: baseline.events.map(e => e.time), acceptedAfter: opted.events.map(e => e.time),
            observations: opted.trackAnalysis.eventTiming.observations });
        console.log(JSON.stringify({ recorded: name, accepted: baseline.events.length, statuses }));
    }
    return { manifestSha256: sha256(manifestBytes), groundTruth: null, accuracy: null,
        policy: 'Exact retained original PCM replay; counts, shifts, abstentions and observed cost only',
        excerptSeconds: rows.reduce((s, r) => s + (r.excerptEndSample - r.excerptStartSample) / r.sampleRate, 0), rows };
}

export function runAcceptedTimingMeasurement({ output, pcmCache }) {
    const target = resolve(output);
    assert.ok(!existsSync(target), 'Exclusive new output required');
    const projectRelative = relative(resolve('.'), target);
    assert.ok(projectRelative && !projectRelative.startsWith('..') && !projectRelative.includes(':') && target.endsWith('.json'),
        'Output must be a new JSON inside the current project');
    const sources = [...sourceFiles('src/analyzer'), ...sourceFiles('src/types'),
        'tests/helpers/xr-loader.mjs', 'documents/research/onset-placement-experiment.md',
        'research/analyzer-lab/diagnostics/measure-accepted-timing.mjs'].sort();
    const snapshots = Object.fromEntries(sources.map(p => [p, readFileSync(p)]));
    const load = createLoader({}, { Float32Array, Float64Array });
    const refine = load('analyzer/AcceptedEventTiming.ts').refineAcceptedEventTiming;
    const cases = acceptedTimingSpecs().map(spec => measureAcceptedFixture(refine, spec));
    const localInspectionProfile = profileLocal(refine);
    const recorded = pcmCache ? measureRecorded(resolve(pcmCache), load, refine) : null;
    const sourceHashes = Object.fromEntries(Object.entries(snapshots).map(([p, bytes]) => {
        assert.equal(sha256(readFileSync(p)), sha256(bytes), `Source changed during measurement: ${p}`);
        return [p, sha256(bytes)];
    }));
    const report = { protocol: 'accepted-frame-local-timing-authored-v1', config: TIMING_CONFIG,
        nodeVersion: process.version, typescriptVersion: JSON.parse(readFileSync('node_modules/typescript/package.json')).version,
        sourceHashes, truthPolicy: 'Authored mathematical attack times, manually accepted frame starts; no production eligibility test',
        limits: ['Not independent music or human-reviewed audible onset annotations',
            'Matched-only timing excludes misses; coverage and negative refinements retained',
            'Double attack controls have two truths but exactly one manually accepted event',
            '30 ms search cap intentionally abstains for late positions in long feature frames',
            'Costs observed on this Node host only; no realtime or physical headset precision claim'],
        summary: summarizeAcceptedMeasurements(cases),
        bySampleRate: Object.fromEntries(TIMING_CONFIG.sampleRates.map(rate => [rate, summarizeAcceptedMeasurements(cases.filter(c => c.spec.sampleRate === rate))])),
        byKind: Object.fromEntries([...new Set(cases.map(c => c.spec.kind))].map(kind => [kind, summarizeAcceptedMeasurements(cases.filter(c => c.spec.kind === kind))])),
        cases, localInspectionProfile, recorded };
    writeFileSync(target, JSON.stringify(report) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ output: target, summary: report.summary, recordedRows: recorded?.rows.length ?? 0 }));
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
    runAcceptedTimingMeasurement(options);
}
