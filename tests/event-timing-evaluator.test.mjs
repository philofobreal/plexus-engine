import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateTimingInput, TIMING_TOLERANCES_SECONDS } from '../research/analyzer-lab/diagnostics/evaluate-event-timing.mjs';

const makeInput = (overrides = {}) => ({ schemaVersion: 'event-timing-evaluation-input-v1',
    identity: { pcmSha256: 'a'.repeat(64), sampleRate: 8000, sampleCount: 80000, channel: 0 },
    baseline: [{ time: 1.02 }, { time: 3.02 }], candidate: [{ time: 1.001 }, { time: 3.001 }],
    annotation: { status: 'human-reviewed', annotator: 'Independent reviewer',
        eventType: 'audible-percussive-onset', onsets: [1, 3], completeIntervals: [[0, 10]],
        provenance: 'Reviewed exact decoded channel-0 PCM; attacks are audible starts.' }, ...overrides });

test('frozen tolerance curve reports matched-only timing, misses and candidate-minus-baseline deltas', () => {
    const result = evaluateTimingInput(makeInput());
    assert.deepEqual(result.policy.tolerancesSeconds, [0.002, 0.01, 0.025, 0.05]);
    assert.ok(Object.isFrozen(TIMING_TOLERANCES_SECONDS));
    assert.equal(result.baseline[0].truePositives, 0);
    assert.equal(result.baseline[0].falsePositives, 2);
    assert.equal(result.baseline[0].falseNegatives, 2);
    assert.equal(result.baseline[0].falsePositivesPerMinute, 12);
    assert.equal(result.baseline[0].matchedOnlyTiming.absoluteErrorP50Seconds, null);
    assert.equal(result.candidate[0].truePositives, 2);
    assert.equal(result.candidate[0].f1, 1);
    assert.ok(Math.abs(result.candidate[0].matchedOnlyTiming.signedBiasSeconds - 0.001) < 1e-12);
    assert.equal(result.delta[0].f1, 1);
    assert.equal(result.delta[0].falsePositivesPerMinute, -12);
    assert.equal(result.delta[0].matchedOnlyTiming.absoluteErrorP50Seconds, null);
    assert.ok(Math.abs(result.delta[2].matchedOnlyTiming.absoluteErrorP95Seconds + 0.019) < 1e-12);
    assert.equal(result.identityVerification, 'declared-only-no-pcm-read');
});

test('one-to-one matching maximizes cardinality rather than choosing nearest collision', () => {
    const input = makeInput({ baseline: [], candidate: [{ time: 0.99 }, { time: 1.01 }, { time: 1.01 }] });
    input.annotation.onsets = [1, 1.02];
    const score = evaluateTimingInput(input).candidate[2];
    assert.equal(score.truePositives, 2);
    assert.equal(score.falsePositives, 1);
    assert.deepEqual(score.matches.map(match => [match.eventIndex, match.annotationIndex]), [[0, 0], [1, 1]]);
    assert.equal(score.precision, 2 / 3);
});

test('maximum-cardinality results agree with exhaustive matching on deterministic collision cases', () => {
    const brute = (events, onsets, tolerance, index = 0, used = new Set()) => {
        if (index === onsets.length) return 0;
        let best = brute(events, onsets, tolerance, index + 1, used);
        events.forEach((event, eventIndex) => {
            if (!used.has(eventIndex) && event.time >= onsets[index] - tolerance && event.time <= onsets[index] + tolerance) {
                const next = new Set(used); next.add(eventIndex);
                best = Math.max(best, 1 + brute(events, onsets, tolerance, index + 1, next));
            }
        });
        return best;
    };
    let seed = 214;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let iteration = 0; iteration < 70; iteration++) {
        const events = Array.from({ length: 5 }, () => ({ time: 1 + Math.round(random() * 100) / 1000 }))
            .sort((a, b) => a.time - b.time);
        const onsets = [...new Set(Array.from({ length: 4 }, () => 1 + Math.round(random() * 100) / 1000))].sort((a, b) => a - b);
        const input = makeInput({ baseline: [], candidate: events }); input.annotation.onsets = onsets;
        const result = evaluateTimingInput(input);
        result.candidate.forEach(score => assert.equal(score.truePositives, brute(events, onsets, score.toleranceSeconds)));
    }
});

test('only complete half-open annotation intervals count; matches never cross an unannotated gap', () => {
    const events = [{ time: 0.5 }, { time: 1 }, { time: 1.995 }, { time: 2 }, { time: 2.02 }, { time: 2.05 }, { time: 3 }];
    const input = makeInput({ baseline: events, candidate: events });
    input.annotation.completeIntervals = [[1, 2], [2.02, 3]];
    input.annotation.onsets = [0.5, 1, 2, 2.02, 3];
    const result = evaluateTimingInput(input), score = result.candidate[3];
    assert.deepEqual(result.excluded.candidateEventIndexes, [0, 3, 6]);
    assert.deepEqual(result.excluded.annotationIndexes, [0, 2, 4]);
    assert.ok(Math.abs(result.exposureSeconds - 1.98) < 1e-12);
    assert.equal(score.truePositives, 2);
    assert.equal(score.falsePositives, 2);
    assert.ok(Math.abs(score.falsePositivesPerMinute - 120 / 1.98) < 1e-10);
    const gapInput = makeInput({ baseline: [], candidate: [{ time: 1.995 }] });
    gapInput.annotation.completeIntervals = [[1, 2], [2.02, 3]]; gapInput.annotation.onsets = [2.02];
    assert.equal(evaluateTimingInput(gapInput).candidate[3].truePositives, 0);
});

test('inclusive numeric tolerance limits and nearest-rank quantiles preserve explicit boundary policy', () => {
    const input = makeInput({ baseline: [], candidate: [{ time: 0.998 }, { time: 2.002 }, { time: 3.00200001 }] });
    input.annotation.onsets = [1, 2, 3];
    const score = evaluateTimingInput(input).candidate[0];
    assert.equal(score.truePositives, 2);
    assert.ok(Math.abs(score.matchedOnlyTiming.signedBiasSeconds) < 1e-12);
    const quantiles = makeInput({ baseline: [], candidate: [{ time: 1.001 }, { time: 2.002 }, { time: 3.009 }] });
    quantiles.annotation.onsets = [1, 2, 3];
    const timing = evaluateTimingInput(quantiles).candidate[1].matchedOnlyTiming;
    assert.ok(Math.abs(timing.absoluteErrorP50Seconds - 0.002) < 1e-12);
    assert.ok(Math.abs(timing.absoluteErrorP95Seconds - 0.009) < 1e-12);
});

test('empty positives, predictions and exposure remain undefined where appropriate', () => {
    const input = makeInput({ baseline: [], candidate: [] }); input.annotation.onsets = [];
    const empty = evaluateTimingInput(input).candidate[0];
    assert.equal(empty.precision, null); assert.equal(empty.recall, null); assert.equal(empty.f1, null);
    assert.equal(empty.falsePositivesPerMinute, 0); assert.equal(empty.matchedOnlyTiming.signedBiasSeconds, null);
    input.candidate = [{ time: 1 }];
    const negative = evaluateTimingInput(input).candidate[0];
    assert.equal(negative.precision, 0); assert.equal(negative.recall, null); assert.equal(negative.f1, 0);
    input.annotation.onsets = [1]; input.candidate = [];
    const misses = evaluateTimingInput(input).candidate[0];
    assert.equal(misses.precision, null); assert.equal(misses.recall, 0); assert.equal(misses.f1, 0);
    input.annotation.completeIntervals = [];
    const unavailable = evaluateTimingInput(input);
    assert.equal(unavailable.exposureSeconds, 0); assert.equal(unavailable.candidate[0].falsePositivesPerMinute, null);
    assert.deepEqual(unavailable.excluded.annotationIndexes, [0]);
});

test('invalid clocks, partial-invalid predictions and fabricated annotation status fail explicitly', () => {
    const invalid = [
        input => { input.schemaVersion = 'unknown'; },
        input => { input.identity.pcmSha256 = 'bad'; },
        input => { input.identity.pcmSha256 = BigInt('1'.repeat(64)); },
        input => { input.identity.sampleRate = 999; },
        input => { input.identity.sampleCount = 0; },
        input => { input.identity.channel = 1; },
        input => { input.baseline = [{ time: NaN }]; },
        input => { input.candidate.push({ time: 10 }); },
        input => { input.candidate = [{ time: 9 }, { time: 1 }]; },
        input => { input.candidate.push({ time: -1 }); },
        input => { input.annotation.status = 'two-library-agreement'; },
        input => { input.annotation.eventType = 'midi-note-on'; },
        input => { input.annotation.annotator = ' '; },
        input => { input.annotation.provenance = ''; },
        input => { input.annotation.onsets = [3, 1]; },
        input => { input.annotation.onsets = [1, 1]; },
        input => { input.annotation.completeIntervals = [[0, 2], [1, 3]]; },
        input => { input.annotation.completeIntervals = [[0, 11]]; },
        input => { input.annotation.completeIntervals = [[1, 1]]; },
        input => { input.protocol = { threshold: Infinity }; },
    ];
    invalid.forEach(change => { const input = makeInput(); change(input); assert.throws(() => evaluateTimingInput(input)); });
});

test('evaluation is deterministic, input-immutable and nested report provenance is independently copied', () => {
    const input = makeInput({ protocol: { name: 'Frozen review', strata: ['quiet-over-bass'] }, parameters: { mode: 'opt-in' } });
    const before = structuredClone(input), first = evaluateTimingInput(input), second = evaluateTimingInput(input);
    assert.deepEqual(first, second); assert.deepEqual(input, before);
    first.annotation.completeIntervals[0][0] = 8; first.annotation.onsets[0] = 8;
    first.protocol.strata.push('changed'); first.identity.sampleRate = 48000;
    assert.deepEqual(input, before); assert.deepEqual(second, evaluateTimingInput(input));
});

test('CLI creates a new report with hashes, refuses overwrite and rejects malformed flags/input', t => {
    const directory = mkdtempSync(join(tmpdir(), 'plexus-event-timing-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const inputPath = join(directory, 'input.json'), outputPath = join(directory, 'output.json');
    writeFileSync(inputPath, JSON.stringify(makeInput()));
    const executable = fileURLToPath(new URL('../research/analyzer-lab/diagnostics/evaluate-event-timing.mjs', import.meta.url));
    const run = args => spawnSync(process.execPath, [executable, ...args], { encoding: 'utf8' });
    const success = run(['--input', inputPath, '--output', outputPath]);
    assert.equal(success.status, 0, success.stderr);
    const bytes = readFileSync(outputPath, 'utf8'), report = JSON.parse(bytes);
    assert.match(report.artifactProvenance.inputSha256, /^[a-f0-9]{64}$/);
    assert.match(report.artifactProvenance.evaluatorSourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(run(['--input', inputPath, '--output', outputPath]).status, 1);
    assert.equal(readFileSync(outputPath, 'utf8'), bytes);
    assert.equal(run(['--input', inputPath, '--input', outputPath]).status, 1);
    const badOutput = join(directory, 'invalid-result.json');
    writeFileSync(inputPath, JSON.stringify(makeInput({ candidate: [{ time: 20 }] })));
    assert.equal(run(['--input', inputPath, '--output', badOutput]).status, 1);
    assert.equal(existsSync(badOutput), false);
});
