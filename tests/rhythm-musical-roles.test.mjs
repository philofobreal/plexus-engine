import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';
const load = createLoader({ three: THREE });
const { buildRhythmMusicalRolePlan: plan, buildRhythmNoteRolePlan, MAX_RHYTHM_NOTE_ROLES, buildRhythmChart,
    RhythmGameSession, DEFAULT_RHYTHM_GAME_CONFIG: config, notePosition } = load('gameplay/index.ts');
const { XrNoteHalos, HALO_CAPACITY } = load('xr/scene/XrNoteHalos.ts');
const n = (id, time, phrase = 0, intensity = .4) => ({ id, time, phrase, intensity, lane: 0, row: 1, hand: 'left', sourceType: 1, cutDirection: 'any' });
const json = value => JSON.parse(JSON.stringify(value));

test('musical roles distinguish published section entries, authored phrase entries and local salient onsets', () => {
    const chart = [n('s', 1), n('a', 3, 0, .9), n('b', 4), n('p', 6, 1), n('c', 8, 1), n('d', 9, 1), n('s2', 12, 2)];
    const before = JSON.stringify(chart), sections = [{ start: 0, end: 10 }, { start: 10, end: 14 }];
    assert.deepEqual(json(plan(chart, sections).roles), [
        { noteId: 's', role: 'section' }, { noteId: 'a', role: 'accent' },
        { noteId: 'p', role: 'phrase' }, { noteId: 's2', role: 'section' }]);
    assert.equal(JSON.stringify(chart), before);
    assert.equal(JSON.stringify(plan(chart, sections)), JSON.stringify(plan(chart, sections)));
    assert.ok(Object.isFrozen(plan(chart, sections).roles));
});

test('flat intensities, absent phrases, empty/out-of-track/invalid sections do not invent musical meaning', () => {
    const noPhrase = [n('a', 1), n('b', 3)].map(({ phrase, ...rest }) => rest);
    assert.equal(plan(noPhrase, [{ start: 10, end: 20 }, { start: NaN, end: 5 }, { start: 3, end: 2 }]).roles.length, 0);
    assert.deepEqual(json(plan([n('a', 1), n('b', 3), n('c', 5)]).roles), [{ noteId: 'a', role: 'phrase' }]);
    assert.equal(plan([]).roles.length, 0);
});

test('priority, simultaneous-pair ties, density gap and global overflow are deterministic', () => {
    const chart = [n('left', 1), n('right', 1), n('near', 1.3, 1, .95), n('next', 3, 2)];
    const result = plan(chart, [{ start: 1, end: 2 }, { start: 1, end: 2 }]);
    assert.deepEqual(json(result.roles), [{ noteId: 'left', role: 'section' }, { noteId: 'next', role: 'phrase' }]);
    const many = Array.from({ length: MAX_RHYTHM_NOTE_ROLES + 20 }, (_, i) => n('n' + i, i * 2, i));
    const capped = plan(many, [{ start: many.at(-1).time, end: many.at(-1).time + 1 }]);
    assert.equal(capped.roles.length, MAX_RHYTHM_NOTE_ROLES);
    assert.equal(capped.roles.at(-1).role, 'section', 'late high-priority section retained over earlier low-priority phrase');
    assert.equal(new Set(capped.roles.map(r => r.noteId)).size, capped.roles.length);
});

test('all authored difficulties retain chart, judge, maximum score, accuracy, combo and section bonuses with roles', () => {
    const source = chartSources()['journey-128-confident'];
    const sections = [{ start: 0, end: 48, label: 'build' }, { start: 48, end: 96, label: 'drop' }];
    for (const difficulty of ['easy', 'normal', 'hard', 'ultra']) {
        const chart = buildRhythmChart(source, config, { difficulty }), before = JSON.stringify(chart);
        const sidecar = plan(chart, sections), halos = new XrNoteHalos(); halos.setPlan(sidecar);
        const a = new RhythmGameSession(), b = new RhythmGameSession();
        a.setResolutionObserver({ onRunReset: () => halos.reset(), onNoteResolved: (...args) => halos.onNoteResolved(...args) });
        for (const session of [a, b]) { session.loadChart(chart, sections); session.start(); }
        for (let i = 0; i < chart.length; i++) {
            const note = chart[i];
            // Same explicit desktop assist, including deterministic misses, on both sessions.
            if (i % 7 !== 0) for (const session of [a, b]) session.attemptStrike({
                songTime: note.time, hand: note.hand === 'right' ? 'right' : 'left',
                position: notePosition(note, note.time, {}, config), speed: 1, desktopTargetId: note.id });
            for (const session of [a, b]) session.update(note.time + config.missWindowSec + .001);
        }
        assert.deepEqual(json(a.getSnapshot()), json(b.getSnapshot()), difficulty);
        assert.deepEqual(json(a.getScoringPlan()), json(b.getScoringPlan()), difficulty);
        assert.equal(JSON.stringify(chart), before);
        assert.ok(sidecar.roles.every(r => chart.some(n => n.id === r.noteId)));
        halos.dispose();
    }
});

test('musical halo overflow keeps accepted bursts then section, phrase, accent and retains stable event-scope uploads', () => {
    const notes = Array.from({ length: 22 }, (_, i) => n('n' + i, 5 + i * .1));
    const assignments = notes.map((note, i) => ({ noteId: note.id, role: i === 21 ? 'section' : i === 20 ? 'phrase' : 'accent' }));
    const halos = new XrNoteHalos(); halos.setPlan(buildRhythmNoteRolePlan(notes, assignments));
    const pending = notes.map(note => ({ note, status: 'pending', judgement: null }));
    halos.update(pending, 4); assert.equal(halos.mesh.count, HALO_CAPACITY); assert.equal(halos.overflow, 6);
    const glyphs = halos.mesh.geometry.getAttribute('aHaloRole');
    assert.equal(glyphs.getX(0), 3); assert.equal(glyphs.getX(1), 2); assert.equal(glyphs.getX(2), 1);
    const writes = halos.writes; halos.update(pending, 4.1); assert.equal(halos.writes, writes);
    halos.onNoteResolved(notes[0], 'perfect', 5, false); halos.onNoteResolved(notes[0], 'perfect', 5, false);
    halos.update(pending.slice(1), 5.1);
    assert.equal(halos.mesh.geometry.getAttribute('aHaloStyle').getW(0), 1);
    assert.equal(halos.bursts.filter(b => b.note).length, 1);
    assert.deepEqual(glyphs.updateRanges, [{ start: 0, count: HALO_CAPACITY }]);
    halos.reset(); halos.update([], 0); assert.equal(halos.mesh.count, 0); halos.dispose();
});

test('Music menu mode persists and copies through the existing settings store without changing chart settings', () => {
    const { DEFAULT_XR_SETTINGS, XR_SETTINGS, normalizeXrSettings } = load('xr/XrSettings.ts');
    const { settingsReport } = load('xr/XrMenuModel.ts');
    const item = XR_SETTINGS.find(s => s.id === 'noteHalos'), music = item.write(DEFAULT_XR_SETTINGS, 'music');
    const { createXrSettingsStore } = load('xr/XrSettingsStore.ts');
    const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
    createXrSettingsStore(storage).save(music);
    assert.equal(createXrSettingsStore(storage).load().appearance.noteHalos, 'music');
    assert.equal(item.scope, 'presentation');
    assert.equal(normalizeXrSettings(json(music)).appearance.noteHalos, 'music');
    assert.deepEqual(json(music.generation), json(DEFAULT_XR_SETTINGS.generation));
    const report = settingsReport(music); assert.match(report, /Note halos: Music/);
    assert.equal(JSON.parse(report.split('JSON: ')[1]).appearance.noteHalos, 'music');
    assert.equal(DEFAULT_XR_SETTINGS.appearance.noteHalos, 'off');
});

test('production live mode handler rebuilds phrase/music plans, keeps observer and never restarts or replays hits', () => {
    const { XrAppController } = load('xr/XrAppController.ts');
    const controller = Object.create(XrAppController.prototype), session = new RhythmGameSession();
    const halos = new XrNoteHalos(), plans = [], observer = { onRunReset: () => halos.reset(), onNoteResolved: (...args) => halos.onNoteResolved(...args) };
    Object.assign(controller, { session, haloChart: [n('a', 1), n('b', 4, 1)], haloSections: [{ start: 0, end: 6 }],
        halosEnabled: false, haloObserverFailed: false, haloMode: 'off',
        scene: { resolutionObserver: observer, setNoteRolePlan(p) { plans.push(p); halos.setPlan(p); } },
        settings: { appearance: { noteHalos: 'phrase' } } });
    controller.applyNoteHalos(); assert.equal(plans.at(-1).roles[0].role, 'signal');
    controller.settings.appearance.noteHalos = 'music'; controller.applyNoteHalos();
    assert.equal(plans.at(-1).roles[0].role, 'section'); assert.equal(halos.mesh.count, 0);
    const count = plans.length; controller.applyNoteHalos(); assert.equal(plans.length, count);
    controller.settings.appearance.noteHalos = 'off'; controller.applyNoteHalos(); assert.equal(plans.at(-1), null);
    controller.haloChart = []; controller.settings.appearance.noteHalos = 'music'; controller.applyNoteHalos(true);
    assert.equal(plans.at(-1), null); halos.dispose();
});
