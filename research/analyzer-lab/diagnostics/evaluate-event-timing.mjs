// Offline, human-annotation evaluation. Importing this module performs no I/O.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TIMING_TOLERANCES_SECONDS = Object.freeze([0.002, 0.01, 0.025, 0.05]);
const ownObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requiredText = value => typeof value === 'string' && value.trim().length > 0;

function validateInput(input) {
    if (!ownObject(input) || input.schemaVersion !== 'event-timing-evaluation-input-v1')
        throw new Error('Expected event-timing-evaluation-input-v1');
    const identity = input.identity;
    if (!ownObject(identity) || typeof identity.pcmSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(identity.pcmSha256)
        || !Number.isSafeInteger(identity.sampleRate) || identity.sampleRate < 1000 || identity.sampleRate > 384000
        || !Number.isSafeInteger(identity.sampleCount) || identity.sampleCount <= 0 || identity.channel !== 0)
        throw new Error('Invalid declared PCM identity or sample clock');
    const duration = identity.sampleCount / identity.sampleRate;
    const validTime = value => Number.isFinite(value) && value >= 0 && value < duration;
    for (const name of ['baseline', 'candidate']) {
        const events = input[name];
        if (!Array.isArray(events) || events.some((event, index) => !ownObject(event) || !validTime(event.time)
            || (index > 0 && event.time < events[index - 1].time)))
            throw new Error(`${name} must contain sorted finite events inside the declared PCM clock`);
    }
    const annotation = input.annotation;
    if (!ownObject(annotation) || annotation.status !== 'human-reviewed'
        || annotation.eventType !== 'audible-percussive-onset' || !requiredText(annotation.annotator)
        || !requiredText(annotation.provenance))
        throw new Error('Independent human-reviewed audible-percussive-onset annotation required');
    if (!Array.isArray(annotation.onsets) || annotation.onsets.some((time, index) => !validTime(time)
        || (index > 0 && time <= annotation.onsets[index - 1])))
        throw new Error('Annotation onsets must be strictly increasing inside the declared PCM clock');
    if (!Array.isArray(annotation.completeIntervals) || annotation.completeIntervals.some((interval, index) =>
        !Array.isArray(interval) || interval.length !== 2 || !interval.every(Number.isFinite)
        || interval[0] < 0 || interval[0] >= interval[1] || interval[1] > duration
        || (index > 0 && interval[0] < annotation.completeIntervals[index - 1][1])))
        throw new Error('Complete intervals must be sorted nonoverlapping [start,end) PCM intervals');
    // Optional provenance is retained verbatim, but must remain finite JSON data.
    for (const key of ['parameter', 'parameters', 'protocol']) {
        if (input[key] !== undefined) {
            const visit = value => {
                if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
                if (typeof value === 'number' && Number.isFinite(value)) return;
                if (Array.isArray(value)) { value.forEach(visit); return; }
                if (ownObject(value)) { Object.values(value).forEach(visit); return; }
                throw new Error(`${key} must be finite JSON data`);
            };
            visit(input[key]);
        }
    }
    return duration;
}

function partition(entries, intervals) {
    const included = intervals.map(() => []), excludedIndexes = [];
    let intervalIndex = 0;
    for (const entry of entries) {
        while (intervalIndex < intervals.length && entry.time >= intervals[intervalIndex][1]) intervalIndex++;
        if (intervalIndex < intervals.length && entry.time >= intervals[intervalIndex][0])
            included[intervalIndex].push(entry);
        else excludedIndexes.push(entry.index);
    }
    return { included, excludedIndexes };
}

function nearestRank(sorted, quantile) {
    return sorted.length ? sorted[Math.ceil(sorted.length * quantile) - 1] : null;
}

function score(predictions, annotations, toleranceSeconds, exposureSeconds) {
    const matches = [];
    let predictionCount = 0, annotationCount = 0;
    predictions.forEach((events, intervalIndex) => {
        const truth = annotations[intervalIndex];
        predictionCount += events.length;
        annotationCount += truth.length;
        let eventIndex = 0, annotationIndex = 0;
        // Ordered equal-width tolerance intervals: earliest feasible pair maximizes
        // cardinality. This deliberately does not minimize matched timing error.
        while (eventIndex < events.length && annotationIndex < truth.length) {
            const event = events[eventIndex], onset = truth[annotationIndex];
            if (event.time < onset.time - toleranceSeconds) { eventIndex++; continue; }
            if (event.time > onset.time + toleranceSeconds) { annotationIndex++; continue; }
            matches.push({ eventIndex: event.index, annotationIndex: onset.index, intervalIndex,
                eventTime: event.time, annotationTime: onset.time, errorSeconds: event.time - onset.time });
            eventIndex++;
            annotationIndex++;
        }
    });
    const truePositives = matches.length, falsePositives = predictionCount - truePositives,
        falseNegatives = annotationCount - truePositives;
    const absoluteErrors = matches.map(match => Math.abs(match.errorSeconds)).sort((a, b) => a - b);
    return { toleranceSeconds, predictionCount, annotationCount, truePositives, falsePositives, falseNegatives,
        precision: predictionCount ? truePositives / predictionCount : null,
        recall: annotationCount ? truePositives / annotationCount : null,
        f1: predictionCount + annotationCount ? 2 * truePositives / (predictionCount + annotationCount) : null,
        falsePositivesPerMinute: exposureSeconds > 0 ? falsePositives * 60 / exposureSeconds : null,
        matchedOnlyTiming: { sampleCount: truePositives,
            signedBiasSeconds: truePositives ? matches.reduce((sum, match) => sum + match.errorSeconds, 0) / truePositives : null,
            absoluteErrorP50Seconds: nearestRank(absoluteErrors, 0.5),
            absoluteErrorP95Seconds: nearestRank(absoluteErrors, 0.95) }, matches };
}

function metricDelta(baseline, candidate) {
    const subtract = (before, after) => before === null || after === null ? null : after - before;
    const delta = { toleranceSeconds: baseline.toleranceSeconds };
    for (const key of ['predictionCount', 'annotationCount', 'truePositives', 'falsePositives', 'falseNegatives',
        'precision', 'recall', 'f1', 'falsePositivesPerMinute']) delta[key] = subtract(baseline[key], candidate[key]);
    delta.matchedOnlyTiming = {};
    for (const key of ['sampleCount', 'signedBiasSeconds', 'absoluteErrorP50Seconds', 'absoluteErrorP95Seconds'])
        delta.matchedOnlyTiming[key] = subtract(baseline.matchedOnlyTiming[key], candidate.matchedOnlyTiming[key]);
    return delta;
}

/** The artifact declares one PCM clock for predictions and independent manual labels.
 * No audio decoding, hash verification, library truth, tuning or promotion is performed. */
export function evaluateTimingInput(input) {
    const durationSeconds = validateInput(input);
    const intervals = input.annotation.completeIntervals;
    const annotation = partition(input.annotation.onsets.map((time, index) => ({ time, index })), intervals);
    const baseline = partition(input.baseline.map((event, index) => ({ time: event.time, index })), intervals);
    const candidate = partition(input.candidate.map((event, index) => ({ time: event.time, index })), intervals);
    const exposureSeconds = intervals.reduce((sum, [start, end]) => sum + end - start, 0);
    const baselineMetrics = TIMING_TOLERANCES_SECONDS.map(tolerance =>
        score(baseline.included, annotation.included, tolerance, exposureSeconds));
    const candidateMetrics = TIMING_TOLERANCES_SECONDS.map(tolerance =>
        score(candidate.included, annotation.included, tolerance, exposureSeconds));
    return { schemaVersion: 'event-timing-evaluation-result-v1', evaluator: 'manual-percussive-timing-v1',
        identity: { pcmSha256: input.identity.pcmSha256, sampleRate: input.identity.sampleRate,
            sampleCount: input.identity.sampleCount, channel: 0 }, identityVerification: 'declared-only-no-pcm-read',
        durationSeconds, annotation: { status: input.annotation.status, annotator: input.annotation.annotator,
            eventType: input.annotation.eventType, provenance: input.annotation.provenance,
            completeIntervals: intervals.map(interval => [...interval]), onsets: [...input.annotation.onsets] },
        ...(input.parameter !== undefined ? { parameter: structuredClone(input.parameter) } : {}),
        ...(input.parameters !== undefined ? { parameters: structuredClone(input.parameters) } : {}),
        ...(input.protocol !== undefined ? { protocol: structuredClone(input.protocol) } : {}),
        policy: { tolerancesSeconds: [...TIMING_TOLERANCES_SECONDS], intervals: 'half-open-independent-matching',
            matching: 'maximum-cardinality-earliest-feasible-pair', timing: 'matched-only-positive-error-is-late',
            quantiles: 'nearest-rank-absolute-error', delta: 'candidate-minus-baseline',
            groundTruthSource: 'declared-independent-human-review', promotion: 'none' },
        exposureSeconds, excluded: { baselineEventIndexes: baseline.excludedIndexes,
            candidateEventIndexes: candidate.excludedIndexes, annotationIndexes: annotation.excludedIndexes },
        baseline: baselineMetrics, candidate: candidateMetrics,
        delta: baselineMetrics.map((metric, index) => metricDelta(metric, candidateMetrics[index])) };
}

function runCli(args) {
    const flags = new Map();
    if (args.length !== 4) throw new Error('Use --input INPUT_JSON --output NEW_OUTPUT_JSON');
    for (let index = 0; index < args.length; index += 2) {
        if (!['--input', '--output'].includes(args[index]) || flags.has(args[index])
            || !args[index + 1] || args[index + 1].startsWith('--'))
            throw new Error('Use --input INPUT_JSON --output NEW_OUTPUT_JSON');
        flags.set(args[index], args[index + 1]);
    }
    if (flags.size !== 2) throw new Error('Use --input INPUT_JSON --output NEW_OUTPUT_JSON');
    const inputPath = resolve(flags.get('--input')), outputPath = resolve(flags.get('--output'));
    const bytes = readFileSync(inputPath), result = evaluateTimingInput(JSON.parse(bytes.toString('utf8')));
    const sha256 = value => createHash('sha256').update(value).digest('hex');
    result.artifactProvenance = { inputPath, inputSha256: sha256(bytes),
        evaluatorSourceSha256: sha256(readFileSync(fileURLToPath(import.meta.url))), nodeVersion: process.version };
    // Exclusive creation protects all existing reports and input artifacts, including aliases.
    writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ output: outputPath, exposureSeconds: result.exposureSeconds,
        identityVerification: result.identityVerification }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { runCli(process.argv.slice(2)); }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
