import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { challengeSpecs, challengeFixture, pcmBytes } from './fixtures/acoustic-onset-challenges.mjs';
import { exportChallenges } from '../research/analyzer-lab/diagnostics/export-an02-challenges.mjs';
import { instrumentSource, strengthOrderedNms } from '../research/analyzer-lab/diagnostics/trace-an02-stages.mjs';

test('C2 frozen matrix has 144 distinct PCM cases, 432 truth events and complete negative exposure', () => {
    const fixtures = challengeSpecs().map(challengeFixture);
    assert.equal(fixtures.length, 144);
    assert.equal(new Set(fixtures.map(f => f.pcmSha256)).size, 144);
    assert.equal(fixtures.reduce((n, f) => n + f.truthSamples.length, 0), 432);
    const negatives = fixtures.filter(f => f.negativeStart !== null);
    assert.equal(negatives.length, 36);
    assert.ok(Math.abs(negatives.reduce((n, f) => n + f.duration - f.negativeStart, 0) - 25.2) < 1e-10);
    for (const f of fixtures) {
        assert.equal(f.duration, .8);
        assert.deepEqual(pcmBytes(challengeFixture(f.spec).samples), pcmBytes(f.samples));
        assert.ok(f.truthSamples.every(t => Number.isInteger(t) && t >= 0 && t < f.samples.length));
    }
});

test('C2 truth is generator sample start, and dense/quiet/cutoff strata retain their authored conditions', () => {
    for (const spec of challengeSpecs()) {
        const f = challengeFixture(spec);
        if (spec.family === 'density') {
            assert.deepEqual(f.truthSamples, Array.from({length: 6}, (_, i) => Math.round((.25 + i * spec.gapSeconds) * spec.sampleRate)));
        }
        if (spec.family === 'isolated') {
            assert.equal(f.samples[f.truthSamples[0] - 1], 0);
            if (spec.kind === 'noise') assert.notEqual(f.samples[f.truthSamples[0]], 0);
            // The pluck's mathematical start is zero-valued; its next sample carries energy.
            if (spec.kind === 'pluck') { assert.equal(f.samples[f.truthSamples[0]], 0); assert.notEqual(f.samples[f.truthSamples[0] + 1], 0); }
        }
        if (spec.family === 'negative' && spec.kind === 'cutoff')
            assert.ok(f.samples.subarray(Math.round(.6 * spec.sampleRate)).every(v => v === 0));
    }
    assert.throws(() => challengeFixture({sampleRate: 12345}), /Undeclared sample rate/);
});

test('C2 actual kernel and observation-only trace agree on every case without input mutation', () => {
    let count = 0, identity;
    for (const row of exportChallenges()) {
        if (row.type === 'identity') { identity = row; continue; }
        count++;
        assert.equal(row.instrumentationParity, true);
        assert.ok(row.stages.peakFrames.length >= row.stages.refined.length);
        assert.ok(row.stages.refined.length >= row.stages.gated.length);
        assert.ok(row.stages.gated.length >= row.candidates.plexusV1.length);
        const expected = row.stages.refined.filter(p => !p.floorRejected && !p.relativeRejected && !p.endpointRejected);
        assert.deepEqual(row.stages.gated.map(p => p.sampleIndex), expected.map(p => p.sampleIndex));
        for (const provider of ['gatedStrengthNms', 'ungatedStrengthNms']) {
            const points = row.candidates[provider];
            const separation = Math.round(row.spec.sampleRate * .015);
            for (let i = 1; i < points.length; i++) assert.ok(points[i].sampleIndex - points[i - 1].sampleIndex >= separation);
        }
    }
    assert.equal(count, 144);
    assert.ok(identity.sourceHashes['src/analyzer/AcousticOnsets.ts']);
});

test('C2 tracer rejects changed kernel bytes rather than silently measuring another implementation', () => {
    const source = readFileSync('src/analyzer/AcousticOnsets.ts', 'utf8');
    assert.match(instrumentSource(source), /trace.refined.push/);
    assert.throws(() => instrumentSource(source + '\n'), /Unreviewed acoustic kernel identity/);
});

test('strength-ordered NMS preserves separated ends of a rising chain and pins ties/exact boundary', () => {
    const proposals = [{sampleIndex: 0, strength: 1}, {sampleIndex: 10, strength: 2}, {sampleIndex: 20, strength: 3}];
    const before = JSON.stringify(proposals);
    assert.deepEqual(strengthOrderedNms(proposals, 15), [proposals[0], proposals[2]]);
    assert.equal(JSON.stringify(proposals), before);
    assert.deepEqual(strengthOrderedNms([{sampleIndex: 10, strength: 1}, {sampleIndex: 0, strength: 1}, {sampleIndex: 15, strength: 1}], 15),
        [{sampleIndex: 0, strength: 1}, {sampleIndex: 15, strength: 1}]);
    assert.deepEqual(strengthOrderedNms([{sampleIndex: 0, strength: 1}, {sampleIndex: 0, strength: 2}], 1), [{sampleIndex: 0, strength: 2}]);
});

test('research NMS rejects malformed proposal clock/strength and separation', () => {
    for (const separation of [0, 1.5, Infinity]) assert.throws(() => strengthOrderedNms([], separation), /Invalid separation/);
    for (const proposal of [{sampleIndex: -1, strength: 1}, {sampleIndex: .5, strength: 1},
        {sampleIndex: 1, strength: NaN}, {sampleIndex: 1, strength: 0}])
        assert.throws(() => strengthOrderedNms([proposal], 1), /Invalid proposal/);
});
