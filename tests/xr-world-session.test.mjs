// World Interaction Session (ADR-010, T05/T06/T08): the player's effect on the world comes only
// from the rhythm session's own decisions, applies once per note per run, never changes the official
// score, follows the seek policy, is identical for desktop and headset strikes, and resolves the
// special roles and the Fenom encounter into a world outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({});
const g = load('gameplay/index.ts');
const config = g.DEFAULT_RHYTHM_GAME_CONFIG;

/** A long, clearly structured track whose plan has every role and an encounter. */
function track() {
    const durationSec = 192, beat = 60 / 128, events = [];
    for (let t = 2; t < durationSec - 1; t += beat / 2) events.push({ time: +t.toFixed(4), intensity: 0.5 + 0.4 * Math.abs(Math.sin(t)), type: 1 });
    const beats = Array.from({ length: Math.floor(durationSec / beat) }, (_, i) => +(i * beat).toFixed(4));
    const sections = [[0, 16, 'intro', 0.25], [16, 56, 'verse', 0.55], [56, 72, 'build', 0.7], [72, 104, 'drop', 1], [104, 124, 'break', 0.3],
        [124, 156, 'drop', 0.95], [156, durationSec, 'outro', 0.3]].map(([start, end, label, energy]) => ({ start, end, label, energy }));
    const source = { durationSec, events, beats, barStarts: beats.filter((_, i) => i % 4 === 0), timingConfidence: 0.9 };
    const chart = g.buildRhythmChart(source, config, {});
    const plan = g.buildWorldPlan({ durationSec, chart, sections, timingConfidence: 0.9 });
    return { chart, plan, sections };
}

function setup({ observe = true } = {}) {
    const { chart, plan, sections } = track();
    const session = new g.RhythmGameSession(config);
    const world = new g.WorldInteractionSession();
    if (observe) session.setResolutionObserver(world);
    session.loadChart(chart, sections);
    world.load(plan);
    session.start();
    return { chart, plan, session, world };
}

const CUTS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0], 'up-left': [-Math.SQRT1_2, Math.SQRT1_2],
    'up-right': [Math.SQRT1_2, Math.SQRT1_2], 'down-left': [-Math.SQRT1_2, -Math.SQRT1_2], 'down-right': [Math.SQRT1_2, -Math.SQRT1_2] };

/** Headset-style swept blade through the target along its cut, exactly on time. */
function sweptStrike(note) {
    const p = g.notePosition(note, note.time, { x: 0, y: 0, z: 0 }, config);
    const [vx, vy] = CUTS[note.cutDirection] ?? [1, 0];
    const dt = 1 / 72, prevZ = -dt * config.noteSpeedMps;
    return { songTime: note.time, previousSongTime: note.time - dt, hand: note.hand === 'either' ? 'right' : note.hand, speed: 3,
        position: { x: p.x + vx * 0.15, y: p.y + vy * 0.15, z: 0 }, previousPosition: { x: p.x - vx * 0.15, y: p.y - vy * 0.15, z: prevZ } };
}

/** Desktop-style strike: the same timing through the desktop assist path. */
function desktopStrike(note) {
    const p = g.notePosition(note, note.time, { x: 0, y: 0, z: 0 }, config);
    const dt = 1 / 72;
    return { songTime: note.time, previousSongTime: note.time - dt, hand: note.hand === 'either' ? 'right' : note.hand, speed: 3,
        desktopTargetId: note.id, position: { x: p.x, y: p.y, z: 0 }, previousPosition: { x: p.x, y: p.y, z: -dt * config.noteSpeedMps } };
}

/** Plays the run: notes accepted by `hit(note, index)` are struck, everything else is missed. */
function play(session, chart, hit, strike = sweptStrike, until = Infinity) {
    for (let i = 0; i < chart.length && chart[i].time < until; i++) {
        session.update(chart[i].time - 0.001);
        if (hit(chart[i], i)) assert.ok(session.attemptStrike(strike(chart[i])), `note ${chart[i].id} is struck`);
    }
    if (until === Infinity) { session.update(1e6); session.finish(); }
}

const plain = value => JSON.parse(JSON.stringify(value));

test('the world counts exactly what the rhythm session decided', () => {
    const { chart, session, world } = setup();
    play(session, chart, (_, i) => i % 3 !== 0);
    const s = world.getSnapshot(), r = session.getSnapshot();
    assert.equal(s.hits, r.hitCount);
    assert.equal(s.misses, r.missCount);
    assert.equal(s.resolved, chart.length);
    assert.ok(s.formation > 0 && s.formation <= 1);
    assert.ok(s.coherence > 0 && s.coherence < 1);
    for (const q of s.structureQuality) assert.ok(q >= 0 && q <= 1);
    assert.ok(s.reactions.length > 0 && s.reactions.length <= 16, 'a bounded reaction log');
});

test('the official score is identical with and without the world observer', () => {
    const a = setup({ observe: true }), b = setup({ observe: false });
    const hit = (_, i) => i % 4 !== 1;
    play(a.session, a.chart, hit); play(b.session, b.chart, hit);
    assert.deepEqual(plain(a.session.getSnapshot()), plain(b.session.getSnapshot()));
    assert.equal(JSON.stringify(a.chart), JSON.stringify(b.chart), 'the chart is untouched');
});

test('each note applies once per run: a duplicate notification changes nothing', () => {
    const { chart, session, world } = setup();
    play(session, chart, () => true, sweptStrike, 30);
    const before = world.getSnapshot();
    const resolvedNote = chart.find(n => n.time < 30);
    world.onNoteResolved(resolvedNote, 'perfect', 31, false);
    world.onNoteResolved(resolvedNote, null, 31, false);
    assert.equal(world.getSnapshot(), before, 'the same frozen snapshot: nothing changed');
    world.onNoteResolved({ id: 'bogus', time: Number.NaN }, 'perfect', 1, false);
    world.onNoteResolved(null, 'perfect', 1, false);
    assert.equal(world.getSnapshot(), before, 'invalid notes are ignored');
});

test('snapshots are frozen, reused while unchanged and replaced on change', () => {
    const { chart, session, world } = setup();
    const a = world.getSnapshot();
    assert.ok(Object.isFrozen(a) && Object.isFrozen(a.structureQuality) && Object.isFrozen(a.reactions));
    assert.equal(world.getSnapshot(), a);
    session.update(chart[0].time - 0.001);
    session.attemptStrike(sweptStrike(chart[0]));
    const b = world.getSnapshot();
    assert.notEqual(b, a);
    assert.ok(b.revision > a.revision);
});

test('desktop and headset strikes produce the same world', () => {
    const a = setup(), b = setup();
    const hit = (_, i) => i % 5 !== 2;
    play(a.session, a.chart, hit, sweptStrike);
    play(b.session, b.chart, hit, desktopStrike);
    assert.equal(JSON.stringify(a.world.getSnapshot()), JSON.stringify(b.world.getSnapshot()));
    assert.deepEqual(plain(a.world.getOutcome()), plain(b.world.getOutcome()));
});

test('seek follows the session policy: a fresh run, skipped notes unrewarded and without reactions', () => {
    const { chart, session, world } = setup();
    play(session, chart, () => true, sweptStrike, 60);
    const progressed = world.getSnapshot();
    assert.ok(progressed.hits > 20);
    session.seek(80);
    const after = world.getSnapshot();
    const skipped = chart.filter(n => n.time + config.missWindowSec < 80).length;
    assert.equal(after.hits, 0, 'rewards from before the seek are gone');
    assert.equal(after.misses, skipped, 'skipped notes count as missed');
    assert.equal(after.coherence, 0.5, 'skipped notes do not move coherence');
    assert.equal(after.reactions.length, 0, 'and cause no reactions');
    assert.ok(after.structureEnergizedAt.every(t => t === -1), 'no structure keeps an earlier energy hit');
    // Rewinding to the start is an entirely fresh world.
    session.seek(0);
    const fresh = new g.WorldInteractionSession(); fresh.load(world.worldPlan);
    const { revision: _r1, ...rewound } = plain(world.getSnapshot()), { revision: _r2, ...clean } = plain(fresh.getSnapshot());
    assert.deepEqual(rewound, clean);
});

test('restart, a new start and a chart reload all reset the world', () => {
    const { chart, session, world, plan } = setup();
    play(session, chart, () => true, sweptStrike, 40);
    assert.ok(world.getSnapshot().hits > 0);
    session.restart();
    assert.equal(world.getSnapshot().hits, 0);
    play(session, chart, () => true, sweptStrike, 20);
    session.finish(); session.start();
    assert.equal(world.getSnapshot().resolved, 0);
    session.loadChart(chart); world.load(plan);
    assert.equal(world.getSnapshot().resolved, 0);
    world.load(null);
    assert.equal(world.getSnapshot().structureQuality.length, 4, 'no track: the dormant hall');
});

test('an energy target completes its structure early when hit and marks a fault when missed', () => {
    const { chart, plan, session, world } = setup();
    const energy = plan.roles.filter(r => r.role === 'energy');
    assert.ok(energy.length >= 2);
    const [first, second] = energy;
    play(session, chart, n => n.id === first.noteId, sweptStrike, first.time + 0.01);
    assert.ok(world.getSnapshot().reactions.some(r => r.kind === 'energize' && r.structure === first.structure && r.time === first.time));
    play(session, chart, () => false, sweptStrike, second.time + 1);
    const s = world.getSnapshot();
    assert.equal(s.structureEnergizedAt[first.structure], first.time, 'energized at the hit time');
    assert.ok(s.structureFaultAt[second.structure] > second.time, 'the missed energy target faults its structure');
    assert.equal(s.roleTally.energy.hit, 1);
    assert.equal(s.roleTally.energy.missed >= 1, true);
    assert.ok(s.reactions.some(r => r.kind === 'fault' && r.structure === second.structure));
});

test('a special note is mechanically an ordinary note: same judging, same score as its plain twin', () => {
    const { chart, plan } = track();
    const roleIds = new Set(plan.roles.map(r => r.noteId));
    const special = chart.find(n => roleIds.has(n.id));
    const run = observe => {
        const session = new g.RhythmGameSession(config), world = new g.WorldInteractionSession();
        if (observe) { session.setResolutionObserver(world); }
        session.loadChart(chart); world.load(plan); session.start();
        play(session, chart, n => n.time <= special.time, sweptStrike, special.time + 0.5);
        return session.getSnapshot();
    };
    assert.deepEqual(plain(run(true)), plain(run(false)));
});

test('a flawless run stabilizes the field; a run that misses the encounter leaves it unstable', () => {
    const perfect = setup();
    play(perfect.session, perfect.chart, () => true);
    const best = perfect.world.getOutcome();
    assert.equal(best.outcome, 'stabilized');
    assert.equal(best.anchorsHit, best.anchorsTotal);
    assert.ok(best.stability > 0.95);
    assert.ok(best.formation > 0.8);

    const { plan } = perfect;
    const e = plan.encounter;
    const poor = setup();
    play(poor.session, poor.chart, n => n.time < e.syncStart || n.time >= e.syncEnd);
    const worst = poor.world.getOutcome();
    assert.equal(worst.outcome, 'unstable');
    assert.equal(worst.anchorsHit, 0);

    const half = setup();
    play(half.session, half.chart, (n, i) => n.time < e.syncStart || n.time >= e.syncEnd || i % 2 === 0);
    assert.ok(['contained', 'unstable', 'stabilized'].includes(half.world.getOutcome().outcome));
    const mid = half.world.getOutcome().stability;
    assert.ok(mid > worst.stability && mid < best.stability, 'stability orders the runs');
});

test('without an encounter the outcome rates formation and coherence', () => {
    const durationSec = 120, beat = 0.5, events = [];
    for (let t = 2; t < durationSec - 1; t += beat) events.push({ time: t, intensity: 0.7, type: 1 });
    const beats = Array.from({ length: 240 }, (_, i) => i * beat);
    const chart = g.buildRhythmChart({ durationSec, events, beats, barStarts: beats.filter((_, i) => i % 4 === 0), timingConfidence: 0.9 }, config, {});
    const plan = g.buildWorldPlan({ durationSec, chart, sections: [{ start: 0, end: 120, label: 'verse', energy: 0.6 }] });
    assert.equal(plan.encounter, null);
    const outcomeOf = hit => {
        const session = new g.RhythmGameSession(config), world = new g.WorldInteractionSession();
        session.setResolutionObserver(world); session.loadChart(chart); world.load(plan); session.start();
        play(session, chart, hit);
        return world.getOutcome();
    };
    assert.equal(outcomeOf(() => true).outcome, 'formed');
    assert.equal(outcomeOf(() => false).outcome, 'fragmented');
    const all = outcomeOf(() => true);
    assert.equal(all.stability, null);
    assert.equal(all.anchorsTotal, 0);
});

test('objectives follow the eras and the encounter stages', () => {
    const { chart, plan, session, world } = setup();
    const at = t => g.currentWorldObjective(plan, world.getSnapshot(), t);
    assert.equal(at(0.5).title, 'LOCALHOST');
    const seeder = plan.eras.find(e => e.era === 'seeder').start;
    assert.equal(at(seeder + 1).title, 'SEEDER CONSTRUCTION');
    assert.equal(at(seeder + 1).role, 'energy');
    const e = plan.encounter;
    assert.equal(at(e.detectionStart + 0.5).title, 'FENOM DETECTED');
    play(session, chart, () => true, sweptStrike, e.syncStart + 6);
    const sync = at(e.syncStart + 6);
    assert.equal(sync.title, 'FENOM SYNCHRONIZATION');
    assert.match(sync.line, /Field anchors \d+\/\d+/);
    for (const t of [0, seeder, e.detectionStart, e.syncStart, e.syncEnd, plan.durationSec]) assert.match(at(t).line, /^[\x20-\x7e]+$/, 'ASCII line');
});
