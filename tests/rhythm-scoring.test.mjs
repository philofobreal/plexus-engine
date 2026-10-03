import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader();
const { buildScoringPlan, scoreRank, RhythmGameSession, notePosition, SECTION_LABEL_FACTOR } = load('gameplay/index.ts');
const scoring = load('gameplay/RhythmScoring.ts');

const note = (id, time, extra = {}) => ({ id, time, lane: 0, row: 1, hand: 'left', intensity: 1, sourceType: 1, ...extra });
const section = (start, end, label) => ({ start, end, label });
const hit = (session, n, offset = 0) => session.attemptStrike({ songTime: n.time + offset, hand: n.hand,
    position: notePosition(n, n.time + offset, {}), speed: 1 });

test('section weights mix dramaturgical role and measured demand in [1, 2]; notes join their section', () => {
    const chart = [note('a', 1), note('b', 5), note('c', 5.5, { cutDirection: 'down' }), note('d', 6, { pairId: 'p', hand: 'right', lane: 2 }),
        note('e', 6, { pairId: 'p' }), note('f', 13)];
    const plan = buildScoringPlan(chart, [section(4, 8, 'drop'), section(0, 4, 'intro'), section(8, 12, 'break'), section(12, 12, 'peak')]);
    assert.deepEqual(plan.sections.map(s => s.label), ['intro', 'drop', 'break'], 'sorted; empty spans dropped');
    assert.deepEqual([...plan.noteSection], [0, 1, 1, 1, 1, 2], 'a note after the last section joins it');
    const [intro, drop, release] = plan.sections;
    assert.equal(drop.demand, 1, 'the most demanding section defines the scale');
    assert.ok(intro.demand > 0 && intro.demand < 1);
    assert.equal(release.labelFactor, SECTION_LABEL_FACTOR.break);
    for (const s of plan.sections) {
        assert.ok(s.weight >= 1 && s.weight <= 2);
        assert.ok(Math.abs(s.weight - (1 + 0.5 * s.labelFactor + 0.5 * s.demand)) < 1e-12);
    }
    assert.ok(drop.weight > intro.weight && drop.clearBonus > intro.clearBonus);
    assert.equal(drop.clearBonus, Math.round(100 * 4 * 0.25 * drop.weight));
});

test('without published sections there is one neutral section and no bonus', () => {
    const plan = buildScoringPlan([note('a', 1), note('b', 2), note('c', 3)]);
    assert.equal(plan.bonuses, false); assert.equal(plan.sections.length, 1);
    assert.equal(plan.sections[0].weight, 1); assert.equal(plan.sections[0].clearBonus, 0);
    assert.equal(plan.maxScore, 100 + 100 + 200, 'third hit runs at 2x after two hits');
    assert.equal(buildScoringPlan([], []).maxScore, 0);
});

test('the combo multiplier climbs 1-2-4-8 after 2, 4 and 8 hits and drops one tier on a miss', () => {
    const state = scoring.createMultiplierState(), seen = [];
    for (let i = 0; i < 16; i++) { seen.push(scoring.multiplierOf(state)); scoring.advanceMultiplier(state); }
    assert.equal(seen.join(''), '1122224444444488');
    scoring.dropMultiplier(state); assert.equal(scoring.multiplierOf(state), 4);
    scoring.dropMultiplier(state); scoring.dropMultiplier(state); scoring.dropMultiplier(state);
    assert.equal(scoring.multiplierOf(state), 1, 'never below 1x');
});

test('a perfect run reaches exactly the maximum; a good costs the flawless bonus; a miss costs the section bonus', () => {
    const chart = [note('a', 3), note('b', 4), note('c', 5), note('d', 9), note('e', 10)];
    const sections = [section(2, 7, 'build'), section(7, 12, 'drop')];
    const run = grades => {
        const session = new RhythmGameSession();
        session.loadChart(chart, sections); session.start();
        chart.forEach((n, i) => {
            if (grades[i] === 'miss') { session.update(n.time + 0.5); return; }
            const result = hit(session, n, grades[i] === 'good' ? 0.1 : 0);
            assert.equal(result.grade, grades[i]);
        });
        session.update(20);
        return session;
    };
    const perfect = run(['perfect', 'perfect', 'perfect', 'perfect', 'perfect']);
    const snap = perfect.getSnapshot();
    assert.equal(snap.score, snap.maxScore);
    assert.equal(scoreRank(snap.score / snap.maxScore), 'SS');
    const plan = perfect.getScoringPlan();
    assert.deepEqual(snap.sections.map(s => s.bonus), plan.sections.map(s => s.clearBonus + s.flawlessBonus));
    assert.ok(snap.sections.every(s => s.completedAt !== null));

    const good = run(['perfect', 'good', 'perfect', 'perfect', 'perfect']).getSnapshot();
    assert.equal(good.sections[0].bonus, plan.sections[0].clearBonus, 'clean but not flawless');
    assert.equal(good.sections[1].bonus, plan.sections[1].clearBonus + plan.sections[1].flawlessBonus);

    const missed = run(['perfect', 'miss', 'perfect', 'perfect', 'perfect']).getSnapshot();
    assert.equal(missed.sections[0].bonus, 0); assert.equal(missed.sections[0].misses, 1);
    assert.equal(missed.multiplier, 2, 'after the miss the streak rebuilt to 2x');
    assert.ok(missed.score < good.score && good.score < snap.score);
    assert.equal(missed.score, missed.sections.reduce((sum, s) => sum + s.points, 0), 'section points add up to the score');
});

test('the same hit is worth more in a dramaturgically heavier section', () => {
    const points = label => {
        const session = new RhythmGameSession();
        const chart = [note('a', 3)];
        session.loadChart(chart, [section(0, 1, 'intro'), section(2, 6, label)]);
        session.start(); hit(session, chart[0]);
        return session.getSnapshot().sections[1].points - session.getSnapshot().sections[1].bonus;
    };
    assert.ok(points('peak') > points('verse'));
    assert.ok(points('verse') > points('outro'));
});

test('seek and restart reset the whole score ledger; skipped notes forfeit their section bonus', () => {
    const chart = [note('a', 3), note('b', 4), note('c', 9)];
    const session = new RhythmGameSession();
    session.loadChart(chart, [section(2, 6, 'drop'), section(6, 12, 'outro')]);
    session.start(); hit(session, chart[0]);
    assert.ok(session.getSnapshot().score > 0);
    session.seek(5);
    const snap = session.getSnapshot();
    assert.equal(snap.score, 0); assert.equal(snap.multiplier, 1);
    assert.equal(snap.sections[0].misses, 2); assert.equal(snap.sections[0].bonus, 0);
    assert.notEqual(snap.sections[0].completedAt, null);
    hit(session, chart[2]);
    assert.equal(session.getSnapshot().sections[1].bonus > 0, true, 'a later clean section still pays');
    session.restart();
    assert.ok(session.getSnapshot().sections.every(s => s.points === 0 && s.resolved === 0));
});

test('ranks follow accuracy thresholds', () => {
    assert.deepEqual([1, 0.95, 0.94, 0.9, 0.85, 0.8, 0.7, 0.65, 0.5, Number.NaN].map(scoreRank),
        ['SS', 'SS', 'S', 'S', 'A', 'A', 'B', 'B', 'C', 'C']);
});
