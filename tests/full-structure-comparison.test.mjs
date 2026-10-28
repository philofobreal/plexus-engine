import test from 'node:test';
import assert from 'node:assert/strict';
import {matchBoundaries, compareStructures} from '../research/analyzer-lab/diagnostics/compare-full-structure.mjs';

const pcmSha256 = 'a'.repeat(64);
const segments = (starts, labels, end = 20) => starts.map((start, i) => ({start, end: starts[i + 1] ?? end, label: labels[i]}));
const source = () => ({durationSec: 20, pcmSha256,
    sections: segments([0, 5, 10, 15], ['intro', 'verse', 'drop', 'outro'])});
const oracles = () => [
    {family: 'aio', status: 'complete', durationSec: 20, pcmSha256,
        segments: segments([0, 5.2, 10.1, 15], ['intro', 'verse', 'chorus', 'outro'], 20.1)},
    {family: 'song', status: 'complete', durationSec: 20, pcmSha256,
        segments: segments([0, 5.1, 9.9, 15.1], ['intro', 'verse', 'chorus', 'outro'], 19.95)},
];

test('boundary assignment maximizes one-to-one cardinality before timing cost', () => {
    const r = matchBoundaries([.9, 1.8], [0, 1.1], .9);
    assert.equal(r.matched, 2); assert.deepEqual(r.pairs.map(p => [p.a, p.b]), [[0, 0], [1, 1]]);
    const closest = matchBoundaries([1, 1.2], [1.19], .25);
    assert.deepEqual(closest.pairs.map(p => p.a), [1]);
});

test('dense predictions cannot reuse one external boundary or hide unmatched support', () => {
    const r = matchBoundaries([4.8, 5, 5.2], [5], .5);
    assert.equal(r.matched, 1); assert.equal(r.agreementPrecision, 1 / 3); assert.equal(r.agreementRecall, 1);
    assert.deepEqual(r.unmatchedA, [4.8, 5.2]); assert.deepEqual(r.unmatchedB, []);
    assert.equal(matchBoundaries([], [], 1).agreementF1, null);
});

test('invalid, duplicate, sparse or oversized boundary arrays fail closed', () => {
    for (const bad of [[2, 1], [1, 1], [NaN], [-1], [, 1]]) assert.throws(() => matchBoundaries(bad, [], 1));
    assert.throws(() => matchBoundaries([], [], -1));
    assert.throws(() => matchBoundaries(Array.from({length: 2000}, (_, i) => i), Array.from({length: 2000}, (_, i) => i), 1));
});

test('full-song comparison excludes endpoints and keeps raw endpoint quantization visible', () => {
    const r = compareStructures(source(), oracles());
    assert.equal(r.sourceBoundaryCount, 3); assert.equal(r.consensus.length, 3);
    assert.deepEqual(r.tolerancesSec, [.5, 1, 3]);
    assert.equal(r.sourceVsConsensus[0].matched, 3);
    assert.ok(Math.abs(r.comparisons[0].rawEndpointDeltaSec - .1) < 1e-9);
    assert.equal(r.comparisons[0].sections.at(-1).end, 20);
    assert.equal(r.groundTruthStatus, false);
    assert.ok(r.consensus.every(x => x.groundTruthStatus === false && x.confidence === null && x.contributors.length === 2));
});

test('a single model family, partial predictions and incompatible PCM cannot become consensus', () => {
    const s = source(), p = oracles();
    assert.throws(() => compareStructures(s, [p[0]]));
    assert.throws(() => compareStructures(s, [p[0], {...p[1], family: 'aio'}]));
    for (const patch of [{status: 'failed'}, {pcmSha256: 'b'.repeat(64)}, {durationSec: undefined}, {durationSec: 19}])
        assert.throws(() => compareStructures(s, [p[0], {...p[1], ...patch}]));
});

test('gaps, overlaps, cropped beginnings and missing full-song tails are rejected', () => {
    for (const broken of [
        segments([1, 5], ['intro', 'verse']),
        [{start: 0, end: 4, label: 'intro'}, {start: 5, end: 20, label: 'verse'}],
        [{start: 0, end: 6, label: 'intro'}, {start: 5, end: 20, label: 'verse'}],
        segments([0, 5], ['intro', 'verse'], 19),
    ]) {
        const p = oracles(); p[1].segments = broken;
        assert.throws(() => compareStructures(source(), p));
    }
});

test('chorus is not translated to drop and equal-label subdivisions remain separately reported', () => {
    const s = source(), p = oracles();
    s.sections = segments([0, 5, 7, 10, 15], ['intro', 'verse', 'verse', 'drop', 'outro']);
    p[0].segments = segments([0, 5.2, 7, 10.1, 15], ['intro', 'verse', 'verse', 'chorus', 'outro']);
    p[1].segments = segments([0, 5.1, 7.1, 9.9, 15.1], ['intro', 'verse', 'verse', 'chorus', 'outro']);
    s.performancePlan = {points: [{time: 7.05, cueAnchor: {plannedTime: 7}, cuePlacement: {role: 'scene-entry'}}]};
    const r = compareStructures(s, p);
    assert.equal(r.sourceBoundaryCount, 4); assert.equal(r.sourceFunctionChangeCount, 3);
    assert.equal(r.consensus.length, 4); assert.equal(r.functionalConsensus.length, 3);
    assert.equal(r.automationSceneEntries.publishedAgreement[0].matched, 1);
    assert.equal(r.automationSceneEntries.publishedFunctionAgreement[0].matched, 0);
    assert.ok(r.comparisons[0].literalLabelAgreement.unknownSeconds >= 4.8);
    assert.ok(r.comparisons[0].literalLabelAgreement.comparableSeconds < 20);
    assert.ok(r.comparisons[0].literalLabelAgreement.disagreements.every(x => x.a !== 'drop' && x.b !== 'chorus'));
});

test('shared external evidence stays independent of source boundaries and never mutates inputs', () => {
    const s = source(), p = oracles();
    s.beats = [1, 2, 3]; s.barStarts = [1]; p[0].beats = [1.01, 2.01]; p[0].downbeats = [1.01];
    s.performancePlan = {points: [
        {time: 5.1, cueAnchor: {plannedTime: 5}, cuePlacement: {role: 'scene-entry'}},
        {time: 10, cueAnchor: {plannedTime: 10}, cuePlacement: {role: 'scene-entry'}},
        {time: 7, cueAnchor: {plannedTime: 7}, cuePlacement: {role: 'structure'}},
    ]};
    const snapshot = JSON.stringify({s, p});
    const r = compareStructures(s, p);
    assert.equal(r.metricalAgreement[0].beats[0].matched, 2);
    assert.equal(r.metricalAgreement[0].beats[0].countA, 3);
    assert.equal(r.metricalAgreement[1].beats, null);
    assert.equal(r.metricalAgreement[1].downbeats, null);
    assert.equal(r.automationSceneEntries.points, 2);
    assert.equal(r.automationSceneEntries.publishedAgreement[0].matched, 2);
    assert.deepEqual(r.automationSceneEntries.planned, [5, 10]);
    s.sections = segments([0, 2, 17], ['intro', 'verse', 'outro']);
    const changed = compareStructures(s, p);
    assert.deepEqual(r.consensus, changed.consensus);
    s.sections = source().sections;
    assert.equal(JSON.stringify({s, p}), snapshot);
    assert.ok(r.limitations.some(x => x.includes('related boundary-decoder bias')));
});
