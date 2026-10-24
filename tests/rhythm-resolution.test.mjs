import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const gameplay = createLoader()('gameplay/index.ts');
const { RhythmGameSession, DEFAULT_RHYTHM_GAME_CONFIG, buildRhythmNoteRolePlan, MAX_RHYTHM_NOTE_ROLES } = gameplay;
const plain = value => JSON.parse(JSON.stringify(value));
const chart = () => [
    { id: 'a', time: 1, lane: 0, row: 1, hand: 'left', intensity: .8, sourceType: 1 },
    { id: 'b', time: 2, lane: 2, row: 1, hand: 'right', intensity: .8, sourceType: 1 },
    { id: 'c', time: 3, lane: 0, row: 1, hand: 'left', intensity: .8, sourceType: 1 }
];
const strike = (time = 1) => ({ songTime: time, hand: 'left', position: { x: -.45, y: 0, z: 0 }, speed: 1 });
function observed() {
    const session = new RhythmGameSession();
    const events = [];
    session.setResolutionObserver({
        onRunReset() { events.push(['reset', session.getState(), plain(session.getSnapshot())]); },
        onNoteResolved(note, grade, songTime, skipped) { events.push([note.id, grade, songTime, skipped, plain(session.getSnapshot())]); }
    });
    session.loadChart(chart()); session.start(); events.length = 0;
    return { session, events };
}

test('role sidecar is deterministic, chart ordered and independent of world narrative or chart mutation', () => {
    const notes = chart(); const before = JSON.stringify(notes);
    const roles = [{ noteId: 'c', role: 'signal' }, { noteId: 'a', role: 'energy' }, { noteId: 'a', role: 'sync' },
        { noteId: 'missing', role: 'stabilize' }, { noteId: 'b', role: 'invalid' }];
    const plan = buildRhythmNoteRolePlan(notes, roles);
    assert.deepEqual(plain(plan), { version: 1, roles: [{ noteId: 'a', role: 'energy' }, { noteId: 'c', role: 'signal' }] });
    assert.equal(JSON.stringify(buildRhythmNoteRolePlan(notes, roles)), JSON.stringify(plan));
    assert.equal(JSON.stringify(notes), before);
    roles[1].role = 'sync';
    assert.equal(plan.roles[0].role, 'energy');
    assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.roles) && Object.isFrozen(plan.roles[0]));
    assert.deepEqual(plain(buildRhythmNoteRolePlan(notes)), { version: 1, roles: [] });
});

test('role sidecar caps output in chart order and rebuilding discards stale ids', () => {
    const notes = Array.from({ length: MAX_RHYTHM_NOTE_ROLES + 30 }, (_, i) => ({ ...chart()[0], id: String(i), time: i }));
    const roles = notes.map(note => ({ noteId: note.id, role: 'sync' })).reverse();
    const plan = buildRhythmNoteRolePlan(notes, roles);
    assert.equal(plan.roles.length, MAX_RHYTHM_NOTE_ROLES);
    assert.equal(plan.roles[0].noteId, '0');
    assert.equal(plan.roles.at(-1).noteId, String(MAX_RHYTHM_NOTE_ROLES - 1));
    assert.equal(buildRhythmNoteRolePlan(chart(), plan.roles).roles.length, 0);
});

test('observer sees a committed hit once, then only unresolved misses at finish', () => {
    const { session, events } = observed();
    assert.ok(session.attemptStrike(strike()));
    assert.equal(session.attemptStrike(strike()), null);
    assert.deepEqual(events.map(event => event.slice(0, 4)), [['a', 'perfect', 1, false]]);
    assert.equal(events[0][4].hitCount, 1);
    assert.ok(events[0][4].score > 0);
    session.finish(); session.finish(); session.update(20);
    assert.deepEqual(events.map(event => event.slice(0, 4)), [['a', 'perfect', 1, false], ['b', null, 2, false], ['c', null, 3, false]]);
    assert.equal(events[1][4].state, 'finished');
    assert.equal(events[1][4].missCount, 2);
    assert.equal(events[1][4].sections[0].resolved, 3);
});

test('natural misses are idempotent and pause/resume do not reset or resolve notes', () => {
    const { session, events } = observed();
    session.pause(); session.update(2.5); session.resume();
    assert.equal(events.length, 0);
    session.update(2.5); session.update(2.5);
    assert.deepEqual(events.map(event => event.slice(0, 4)), [['a', null, 2.5, false], ['b', null, 2.5, false]]);
    assert.equal(events[0][4].missCount, 2);
});

test('seek resets before skipped notifications, rewind allows exactly one new resolution per run', () => {
    const { session, events } = observed();
    session.seek(2.5);
    assert.deepEqual(events.map(event => event[0]), ['reset', 'a', 'b']);
    assert.deepEqual(events.slice(1).map(event => event.slice(0, 4)), [['a', null, 2.5, true], ['b', null, 2.5, true]]);
    assert.equal(events[0][2].missCount, 2);
    session.update(2.5); assert.equal(events.length, 3);
    session.seek(0); session.attemptStrike(strike());
    assert.deepEqual(events.slice(3).map(event => event.slice(0, 4)), [['reset', 'playing', events[3][2]], ['a', 'perfect', 1, false]]);
    const count = events.length; session.seek(NaN); assert.equal(events.length, count);
});

test('load, config, restart and clear reset after their final state, without stale chart notifications', () => {
    const { session, events } = observed();
    assert.equal(session.setConfig(DEFAULT_RHYTHM_GAME_CONFIG), false);
    assert.equal(events.length, 0);
    session.pause(); session.setConfig(DEFAULT_RHYTHM_GAME_CONFIG);
    assert.equal(events.at(-1)[1], 'ready');
    session.restart(); assert.equal(events.at(-1)[1], 'playing');
    session.loadChart([{ ...chart()[0], id: 'new' }]);
    assert.equal(events.at(-1)[1], 'ready');
    session.start(); session.attemptStrike(strike());
    assert.equal(events.at(-1)[0], 'new');
    session.clear(); assert.equal(events.at(-1)[1], 'idle');
    assert.equal(events.at(-1)[2].totalNotes, 0);
    session.update(10); assert.ok(!events.some(event => ['a', 'b', 'c'].includes(event[0])));
});

test('observer receives a detached frozen note and cannot rewrite the authoritative chart', () => {
    const session = new RhythmGameSession(); const notes = chart();
    session.loadChart(notes); session.start();
    let received;
    session.setResolutionObserver({ onRunReset() {}, onNoteResolved(note) { received = note; note.time = 999; } });
    assert.ok(session.attemptStrike(strike()));
    assert.notEqual(received, notes[0]); assert.ok(Object.isFrozen(received));
    assert.equal(notes[0].time, 1);
    assert.equal(session.getSnapshot().hitCount, 1);
    assert.deepEqual(plain(session.getResolutionObserverFailure()), { phase: 'resolved', reason: 'callback-threw' });
});

for (const operation of ['hit', 'update', 'seek', 'finish', 'reset']) {
    test(`throwing observer is detached without changing committed ${operation} gameplay`, () => {
        const reference = new RhythmGameSession(); const session = new RhythmGameSession();
        for (const target of [reference, session]) { target.loadChart(chart()); target.start(); }
        let calls = 0;
        const fail = () => { calls++; throw new Error('consumer failure'); };
        session.setResolutionObserver({ onRunReset: fail, onNoteResolved: fail });
        const apply = target => operation === 'hit' ? target.attemptStrike(strike()) : operation === 'update' ? target.update(5)
            : operation === 'seek' ? target.seek(2.5) : operation === 'finish' ? target.finish() : target.restart();
        assert.deepEqual(plain(apply(session) ?? null), plain(apply(reference) ?? null));
        assert.deepEqual(plain(session.getSnapshot()), plain(reference.getSnapshot()));
        session.finish(); reference.finish();
        assert.deepEqual(plain(session.getSnapshot()), plain(reference.getSnapshot()));
        assert.equal(calls, 1);
        assert.equal(session.getResolutionObserverFailure().phase, operation === 'seek' || operation === 'reset' ? 'reset' : 'resolved');
    });
}

for (const [name, mutate] of [
    ['clear', s => s.clear()], ['loadChart', s => s.loadChart([])], ['config', s => s.setConfig(DEFAULT_RHYTHM_GAME_CONFIG)],
    ['start', s => s.start()], ['pause', s => s.pause()], ['resume', s => s.resume()], ['restart', s => s.restart()],
    ['finish', s => s.finish()], ['seek', s => s.seek(0)], ['update', s => s.update(20)],
    ['strike', s => s.attemptStrike(strike(3))], ['active cursor', s => s.getActiveNotes(20)],
    ['observer replacement', s => s.setResolutionObserver(null)]
]) {
    test(`notification-only observer cannot reenter ${name}`, () => {
        const { session } = observed();
        session.setResolutionObserver({ onRunReset() {}, onNoteResolved() { mutate(session); } });
        assert.ok(session.attemptStrike(strike()));
        assert.equal(session.getState(), 'playing');
        assert.equal(session.getSnapshot().hitCount, 1);
        assert.equal(session.getSnapshot().missCount, 0);
        assert.equal(session.getResolutionObserverFailure().reason, 'callback-threw');
        session.finish(); assert.equal(session.getSnapshot().missCount, 2);
    });
}

test('observer absent, normal, detached and fault-replaced paths have identical gameplay snapshots', () => {
    const reference = new RhythmGameSession(); const { session, events } = observed();
    reference.loadChart(chart()); reference.start();
    const actions = [s => s.attemptStrike(strike()), s => s.pause(), s => s.resume(), s => s.seek(2.5),
        s => s.restart(), s => s.update(1.5), s => s.finish(), s => s.clear()];
    for (let i = 0; i < actions.length; i++) {
        if (i === 4) session.setResolutionObserver(null);
        actions[i](session); actions[i](reference);
        assert.deepEqual(plain(session.getSnapshot()), plain(reference.getSnapshot()));
    }
    assert.equal(session.getResolutionObserverFailure(), null);
    const count = events.length; session.restart(); assert.equal(events.length, count);
    session.setResolutionObserver({ onRunReset() { throw new Error(); }, onNoteResolved() {} }); session.clear();
    assert.ok(session.getResolutionObserverFailure());
    session.setResolutionObserver({ onRunReset() { events.push(['new-reset']); }, onNoteResolved() {} });
    session.loadChart(chart()); assert.equal(session.getResolutionObserverFailure(), null);
    assert.equal(events.at(-1)[0], 'new-reset');
});

test('accidental async observer is detached and its rejection is consumed', async () => {
    const { session } = observed();
    session.setResolutionObserver({ onRunReset() {}, async onNoteResolved() { throw new Error('async consumer'); } });
    assert.ok(session.attemptStrike(strike()));
    assert.deepEqual(plain(session.getResolutionObserverFailure()), { phase: 'resolved', reason: 'async-callback' });
    await Promise.resolve(); await Promise.resolve();
    session.finish(); assert.equal(session.getSnapshot().hitCount, 1);
});
