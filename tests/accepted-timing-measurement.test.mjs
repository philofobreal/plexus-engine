import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compareAuthoredTimingVersions } from '../research/analyzer-lab/diagnostics/measure-accepted-timing-v2.mjs';
import { loadRetainedTiming } from './helpers/retained-timing-loader.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const basePath = 'research/analyzer-lab/fixtures/accepted-timing-authored-01.json';
const v2Path = 'research/analyzer-lab/fixtures/accepted-timing-v2-development-01.json';

test('all 340 historical v1 and v2 controls replay their measured source tree with exact outputs and tradeoffs', () => {
    const old = JSON.parse(readFileSync(basePath)), saved = JSON.parse(readFileSync(v2Path));
    const refineAcceptedEventTiming = loadRetainedTiming(v2Path);
    const result = compareAuthoredTimingVersions(refineAcceptedEventTiming, old);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), saved.authored);
    assert.equal(result.historicalV1IdenticalCaseCount, 340);
    assert.equal(result.summary.v1.negativeRefinements, 22); assert.equal(result.summary.v2.negativeRefinements, 0);
    assert.equal(result.positiveRegressions.length, 24);
    assert.equal(result.summary.v1.timing[2].after.matchedCount, 148);
    assert.equal(result.summary.v2.timing[2].after.matchedCount, 132);
});

test('retained measured source bytes stay immutable; current evolution requires exact reviewed source hashes', () => {
    const saved = JSON.parse(readFileSync(v2Path));
    const evolution = JSON.parse(readFileSync('research/analyzer-lab/fixtures/accepted-timing-integration-source-evolution-01.json'));
    assert.equal(evolution.predecessor, v2Path);
    assert.equal(evolution.predecessorSha256, sha(readFileSync(v2Path)));
    assert.equal(evolution.oldMeasurementsRewritten, false);
    const changed = [];
    assert.equal(sha(readFileSync(basePath)), saved.predecessorSha256);
    for (const [path, expected] of Object.entries(saved.sourceHashes)) {
        const source = readFileSync(v2Path + '.sources/' + path + '.txt');
        assert.equal(sha(source), expected);
        const current = readFileSync(path);
        if (current.toString('utf8').replaceAll('\r\n', '\n') !== source.toString('utf8').replaceAll('\r\n', '\n')) {
            changed.push(path);
            const change = evolution.changes.find(c => c.path === path && c.predecessorSha256 === expected);
            assert.ok(change?.reviewedBy && change?.reviewedReason, path);
            assert.equal(sha(current), change.replacementSha256, path);
        }
    }
    assert.deepEqual(evolution.changes.map(c => c.path).sort(), changed.sort(), 'each actual source change has exactly one reviewed migration');
});

test('recorded evidence preserves counts and abstentions without asserting unannotated accuracy', () => {
    const saved = JSON.parse(readFileSync(v2Path)), r = saved.recorded;
    assert.equal(r.groundTruth, null); assert.equal(r.accuracy, null);
    assert.equal(r.summary.acceptedCountBefore, 659); assert.equal(r.summary.acceptedCountAfterV1, 659);
    assert.equal(r.summary.acceptedCountAfterV2, 659);
    assert.equal(r.summary.v2Statuses.refined, 85); assert.equal(r.summary.v2Statuses['gradual-attack'], 6);
    assert.equal(r.summary.v2Statuses.ambiguous, 27);
    for (const row of r.rows) { assert.equal(row.groundTruth, null); assert.equal(row.accuracy, null); }
});

test('fresh combined-analyzer replay retains all nine PCM identities and unchanged timing while preserving the wider-support evidence', () => {
    const currentPath = 'research/analyzer-lab/fixtures/accepted-timing-v2-dc1-integration-01.json';
    const saved = JSON.parse(readFileSync(v2Path)), current = JSON.parse(readFileSync(currentPath));
    assert.equal(current.predecessorSha256, sha(readFileSync(basePath)));
    for (const [path, digest] of Object.entries(current.sourceHashes))
        assert.equal(sha(readFileSync(currentPath + '.sources/' + path + '.txt')), digest);
    assert.equal(current.sourceHashes['src/analyzer/AcceptedEventTiming.ts'], sha(readFileSync('src/analyzer/AcceptedEventTiming.ts')));
    assert.deepEqual(current.authored.summary, saved.authored.summary);
    assert.deepEqual(current.authored.positiveRegressions, saved.authored.positiveRegressions);
    assert.equal(current.recorded.groundTruth, null); assert.equal(current.recorded.accuracy, null);
    assert.equal(current.recorded.rows.length, 9);
    for (const row of current.recorded.rows) {
        const old = saved.recorded.rows.find(r => r.pcmSha256 === row.pcmSha256);
        assert.ok(old);
        assert.equal(row.requestSha256, old.requestSha256);
        assert.deepEqual(row.acceptedBefore, old.acceptedBefore);
        assert.deepEqual(row.acceptedAfterV1, old.acceptedAfterV1);
        assert.deepEqual(row.acceptedAfterV2, old.acceptedAfterV2);
        assert.deepEqual(row.v1Observations, old.v1Observations);
        for (const [i, o] of row.v2Observations.entries()) {
            const before = old.v2Observations[i];
            const timing = value => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('support')));
            assert.deepEqual(timing(o), timing(before));
            assert.ok(o.supportStartSample <= before.supportStartSample && o.supportEndSample >= before.supportEndSample);
        }
    }
});

test('tonal-mixture falsification remains explicit instead of claiming general attack isolation', () => {
    const report = JSON.parse(readFileSync('research/analyzer-lab/fixtures/accepted-timing-tonal-stress-integration-01.json'));
    assert.equal(report.caseCount, 336);
    assert.equal(report.rows.length, 336);
    assert.equal(report.changes.length, 0);
    assert.deepEqual(report.statuses, report.baselineStatuses);
    assert.equal(report.statuses.refined, 8, 'eight known false refinements remain disclosed');
    assert.equal(report.productionPromotion, false); assert.equal(report.recordedAccuracy, null);
    const evolution = JSON.parse(readFileSync('research/analyzer-lab/fixtures/t10a-source-evolution.json'));
    for (const [path, digest] of Object.entries(report.sourceHashes)) {
        if (path === 'src/analyzer/BandOnsets.ts') {
            // Exact-output search optimization: keep the measured predecessor immutable,
            // and require the explicitly reviewed replacement plus helper identity.
            assert.equal(sha(readFileSync(evolution.predecessorSource)), digest);
            assert.equal(evolution.predecessorSha256, digest);
            assert.equal(sha(readFileSync(path)), evolution.replacementSha256);
            assert.equal(sha(readFileSync(evolution.helper.path)), evolution.helper.sha256);
            assert.equal(evolution.oldMeasurementsRewritten, false);
        } else assert.equal(sha(readFileSync(path)), digest);
    }
});
