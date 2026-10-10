// World Formation plan contracts and the Musical World Director (ADR-010, T01/T02): determinism,
// JSON safety, empty-input fallbacks, bounds, chart immutability and musical scenarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';

const load = createLoader({});
const gameplay = load('gameplay/index.ts');
const { buildWorldPlan } = load('gameplay/WorldDirector.ts');
const types = load('gameplay/WorldTypes.ts');
const timeline = load('gameplay/WorldTimeline.ts');
const sources = chartSources();

const chartOf = (source, settings = {}) => gameplay.buildRhythmChart(source, gameplay.DEFAULT_RHYTHM_GAME_CONFIG, settings);
const section = (start, end, label, energy) => ({ start, end, label, energy });

/** A clear intro / verse / build / drop / break / drop / outro journey over a long track. */
function clearTrack(durationSec = 192) {
    const beat = 60 / 128;
    const events = [];
    for (let t = 2; t < durationSec - 1; t += beat / 2) events.push({ time: +t.toFixed(4), intensity: 0.5 + 0.4 * Math.abs(Math.sin(t)), type: 1 });
    const sections = [section(0, 16, 'intro', 0.25), section(16, 56, 'verse', 0.55), section(56, 72, 'build', 0.7), section(72, 104, 'drop', 1),
        section(104, 124, 'break', 0.3), section(124, 156, 'drop', 0.95), section(156, durationSec, 'outro', 0.3)];
    const beats = Array.from({ length: Math.floor(durationSec / beat) }, (_, i) => +(i * beat).toFixed(4));
    return { durationSec, events, beats, barStarts: beats.filter((_, i) => i % 4 === 0), timingConfidence: 0.9, sections };
}

function worldSource(source, sections, extra = {}) {
    return { durationSec: source.durationSec, chart: chartOf(source), sections, timingConfidence: source.timingConfidence,
        planPoints: source.performancePlan?.points, ...extra };
}

function assertValidPlan(plan) {
    assert.equal(plan.version, 1);
    assert.ok(plan.phases.length >= 1);
    assert.equal(plan.phases[0].start, 0);
    assert.equal(plan.phases.at(-1).end, plan.durationSec);
    for (let i = 1; i < plan.phases.length; i++) {
        assert.equal(plan.phases[i].start, plan.phases[i - 1].end, 'phases are contiguous');
        assert.ok(plan.phases[i].end > plan.phases[i].start);
        assert.equal(plan.phases[i].index, i);
    }
    assert.equal(plan.eras[0].era, 'localhost');
    assert.equal(plan.eras[0].start, 0);
    for (let i = 1; i < plan.eras.length; i++) assert.ok(plan.eras[i].start > plan.eras[i - 1].start, 'era starts ascend');
    for (const phase of plan.phases) for (const value of Object.values(phase.character)) assert.ok(value >= 0 && value <= 1);
    assert.ok(plan.roles.length <= types.MAX_WORLD_ROLES);
    assert.ok(plan.events.length <= types.MAX_WORLD_EVENTS);
    for (let i = 1; i < plan.roles.length; i++) assert.ok(plan.roles[i].time >= plan.roles[i - 1].time);
    for (let i = 1; i < plan.events.length; i++) assert.ok(plan.events[i].time >= plan.events[i - 1].time);
    assert.equal(new Set(plan.events.map(e => e.id)).size, plan.events.length, 'event ids are unique');
    assert.equal(new Set(plan.structures.map(s => s.id)).size, plan.structures.length, 'structure ids are unique');
    for (const s of plan.structures) {
        if (!s.scheduled) continue;
        assert.ok(s.buildEnd >= s.buildStart && s.buildEnd <= plan.durationSec + 1e-9, `${s.id} build window inside the song`);
        assert.ok(s.contributionEnd >= s.contributionStart);
    }
    const e = plan.encounter;
    if (e) {
        assert.ok(e.detectionStart <= e.syncStart && e.syncStart < e.syncEnd && e.syncEnd <= e.resolutionEnd && e.resolutionEnd <= plan.durationSec);
        assert.ok(e.anchorCount <= 8);
    }
    // structuredClone keeps NaN / Infinity / undefined (and moves the vm-realm objects into this realm).
    assert.deepEqual(JSON.parse(JSON.stringify(plan)), structuredClone(plan), 'the plan survives a JSON round trip unchanged');
}

test('identical inputs give byte-identical plans; cloned inputs too', () => {
    const source = clearTrack();
    const input = worldSource(source, source.sections, { cues: [{ time: 40, intensity: 0.8, confidence: 0.9, kind: 'impact' }] });
    const a = JSON.stringify(buildWorldPlan(input));
    const b = JSON.stringify(buildWorldPlan(structuredClone(input)));
    assert.equal(a, b);
    assert.equal(a, JSON.stringify(buildWorldPlan(input)));
});

test('the director never mutates the chart or any other input', () => {
    const source = clearTrack();
    const input = worldSource(source, source.sections, { cues: [{ time: 40, intensity: 0.8, confidence: 0.9, kind: 'impact' }] });
    const before = JSON.stringify(input);
    buildWorldPlan(input);
    assert.equal(JSON.stringify(input), before);
});

test('empty and hostile inputs fall back to valid plans', () => {
    for (const duration of [0, -5, Number.NaN, Infinity]) {
        const plan = buildWorldPlan({ durationSec: duration, chart: [] });
        assertValidPlan(plan);
        assert.equal(plan.encounter, null);
        assert.equal(plan.roles.length, 0);
        assert.ok(plan.structures.every(s => s.prebuilt), 'the dormant hall: only the standing pylons');
    }
    assert.deepEqual(buildWorldPlan(null), types.createEmptyWorldPlan(0));
    const hostile = buildWorldPlan({ durationSec: 60, chart: [{ id: 'x', time: Number.NaN }, null, { id: 'y', time: 500 }],
        sections: [null, { start: 10, end: 5, label: 'drop' }, { start: 0, end: 20, label: 'bogus' }, { start: Number.NaN, end: 4, label: 'intro' }],
        cues: [null, { time: Number.NaN }], planPoints: [null, { time: Number.NaN }] });
    assertValidPlan(hostile);
    assert.equal(hostile.encounter, null);
    const noSections = buildWorldPlan({ durationSec: 60, chart: [] });
    assertValidPlan(noSections);
    assert.ok(noSections.eras.length >= 2, 'without music evidence the hall still forms over time');
});

test('a clear intro / build / drop / break / drop / outro track forms the full world with one encounter', () => {
    const source = clearTrack();
    const plan = buildWorldPlan(worldSource(source, source.sections));
    assertValidPlan(plan);
    assert.deepEqual(Array.from(plan.eras, e => e.era), ['localhost', 'seeder', 'network', 'fenom', 'resolution']);
    const e = plan.encounter;
    assert.ok(e, 'a late, long, dense drop hosts the encounter');
    assert.equal(e.syncStart, 124, 'the returning drop after the break is preferred');
    assert.ok(e.anchorCount >= 3);
    assert.ok(e.stabilizeNoteId);
    assert.equal(plan.eras.find(x => x.era === 'network').start, 104, 'the network forms in the break after the first drop');
    assert.equal(plan.eras.find(x => x.era === 'resolution').start, e.resolutionEnd,
        'the world settles in the published outro, once the encounter has resolved');
    const roles = new Set(plan.roles.map(r => r.role));
    for (const role of ['energy', 'signal', 'sync', 'stabilize']) assert.ok(roles.has(role), `role ${role}`);
    assert.ok(plan.structures.filter(s => s.kind === 'ring').every(s => s.scheduled && s.buildEnd <= e.syncStart + 1e-9),
        'the rings stand before synchronization begins');
    // Character: industrial first, lattice later, anomaly only in the encounter.
    const character = { industry: 0, construction: 0, lattice: 0, flow: 0, anomaly: 0 };
    timeline.characterAt(plan, 10, character);
    assert.ok(character.industry > 0.5 && character.lattice === 0 && character.anomaly === 0);
    timeline.characterAt(plan, 115, character);
    assert.ok(character.lattice > 0.5 && character.flow > 0.5, 'the break shows the organic flow');
    timeline.characterAt(plan, 130, character);
    assert.equal(character.anomaly, 1);
    assert.equal(timeline.encounterStageAt(plan, e.syncStart - 1), 'detection');
    assert.equal(timeline.encounterStageAt(plan, e.syncStart + 1), 'synchronization');
    assert.equal(timeline.encounterStageAt(plan, e.syncEnd + 0.1), 'resolution');
    assert.equal(timeline.encounterStageAt(plan, e.resolutionEnd), null);
});

test('special roles are a sidecar: valid unpaired chart notes, spaced, never altered', () => {
    const source = clearTrack();
    const input = worldSource(source, source.sections);
    const plan = buildWorldPlan(input);
    const byId = new Map(input.chart.map((note, index) => [note.id, { note, index }]));
    let previous = -Infinity;
    for (const role of plan.roles) {
        const entry = byId.get(role.noteId);
        assert.ok(entry, 'a role names a chart note');
        assert.equal(entry.index, role.noteIndex);
        assert.equal(entry.note.time, role.time);
        assert.equal(entry.note.pairId, undefined, 'pairs stay ordinary');
        assert.ok(role.time - previous >= 1.5 - 1e-9, 'roles are at least 1.5 s apart');
        previous = role.time;
    }
    assert.equal(new Set(plan.roles.map(r => r.noteId)).size, plan.roles.length);
    // The chart built with the plan is the chart built without it.
    assert.equal(JSON.stringify(input.chart), JSON.stringify(chartOf(source)));
});

test('repeated drops produce surges whose consecutive variants differ, the returning one stronger', () => {
    const source = clearTrack();
    const plan = buildWorldPlan(worldSource(source, source.sections));
    const surges = plan.events.filter(e => e.kind === 'surge');
    assert.equal(surges.length, 2);
    assert.notEqual(surges[0].variant, surges[1].variant);
    for (let seed = 0; seed < 20; seed++) {
        // Any chart variation re-seeds; consecutive surge variants still never repeat.
        const chart = chartOf(source).slice(seed);
        const variants = buildWorldPlan({ durationSec: source.durationSec, chart, sections: source.sections }).events.filter(e => e.kind === 'surge').map(e => e.variant);
        for (let i = 1; i < variants.length; i++) assert.notEqual(variants[i], variants[i - 1]);
    }
});

test('a long steady groove forms the world without inventing a climax', () => {
    const source = clearTrack(180);
    const plan = buildWorldPlan(worldSource(source, [section(0, 180, 'verse', 0.6)]));
    assertValidPlan(plan);
    assert.equal(plan.encounter, null);
    assert.equal(plan.events.filter(e => e.kind === 'surge').length, 0);
    assert.ok(plan.structures.filter(s => s.kind !== 'ring').every(s => s.scheduled), 'the hall and the network still form');
    assert.ok(plan.structures.filter(s => s.kind === 'ring').every(s => !s.scheduled), 'the anomaly stays dormant');
    assert.ok(plan.eras.some(e => e.era === 'network'));
});

test('sparse ambient material without sections or a plan degrades to a calm world', () => {
    const source = sources['sparse-no-plan'];
    const plan = buildWorldPlan(worldSource(source, []));
    assertValidPlan(plan);
    assert.equal(plan.encounter, null);
    assert.equal(plan.events.filter(e => e.kind === 'surge' || e.kind === 'scan').length, 0, 'no evidence, no major events');
    assert.ok(plan.roles.every(r => r.role === 'energy' || r.role === 'signal'));
});

test('weak timing never snaps events: they sit on section starts, era starts or confident cues', () => {
    const source = sources['journey-100-unreliable'];
    const sections = [section(0, 30, 'intro', 0.3), section(30, 50, 'build', 0.7), section(50, 80, 'drop', 1), section(80, 96, 'outro', 0.2)];
    const cues = [{ time: 41.3, intensity: 0.9, confidence: 0.7, kind: 'impact' }, { time: 63.7, intensity: 0.9, confidence: 0.9, kind: 'impact' }];
    const plan = buildWorldPlan(worldSource(source, sections, { cues }));
    assertValidPlan(plan);
    assert.equal(plan.timingReliable, false);
    const scans = plan.events.filter(e => e.kind === 'scan');
    assert.deepEqual(Array.from(scans, s => s.time), [63.7], 'only the cue confident enough for weak timing');
    const allowed = new Set([...sections.map(s => s.start), ...plan.eras.map(e => e.start), ...cues.map(c => c.time),
        ...plan.roles.map(r => r.time), plan.phases.find(p => p.start > 0)?.start]);
    if (plan.encounter) for (const t of [plan.encounter.detectionStart, plan.encounter.syncStart, plan.encounter.syncEnd]) allowed.add(t);
    for (const event of plan.events) assert.ok(allowed.has(event.time), `${event.id} at ${event.time} has evidence`);
});

test('a high-density fast chart stays bounded', () => {
    const source = sources['journey-174-confident'];
    const chart = chartOf(source, { difficulty: 'ultra', activity: 'active' });
    const sections = [section(0, 20, 'intro', 0.3), section(20, 44, 'build', 0.7), section(44, 80, 'drop', 1), section(80, 96, 'outro', 0.2)];
    const plan = buildWorldPlan({ durationSec: source.durationSec, chart, sections, timingConfidence: 0.85 });
    assertValidPlan(plan);
    assert.ok(chart.length > 200);
    assert.ok(plan.roles.length <= types.MAX_WORLD_ROLES);
    assert.ok(plan.roles.length < chart.length / 5, 'special targets stay a small subset');
    assert.ok(JSON.stringify(plan).length < 64 * 1024, 'the plan stays small');
});

test('a short track without room for an encounter still has a world and no anomaly', () => {
    const source = clearTrack(40);
    const plan = buildWorldPlan(worldSource(source, [section(0, 8, 'intro', 0.3), section(8, 30, 'drop', 1), section(30, 40, 'outro', 0.2)]));
    assertValidPlan(plan);
    assert.equal(plan.encounter, null);
    assert.ok(plan.structures.some(s => s.scheduled && !s.prebuilt), 'construction still happens');
});

test('the plan ignores preset names: only the renderer-independent meta matters', () => {
    const source = sources['journey-128-confident'];
    const sections = [section(0, 48, 'build', 0.6), section(48, 96, 'drop', 1)];
    const renamed = { ...source, performancePlan: { ...source.performancePlan,
        points: source.performancePlan.points.map(p => ({ ...p, preset: 'something-else.json' })) } };
    assert.equal(JSON.stringify(buildWorldPlan(worldSource(source, sections))), JSON.stringify(buildWorldPlan(worldSource(renamed, sections))));
});

test('varied music produces different dramaturgy and different seeds', () => {
    const a = buildWorldPlan(worldSource(clearTrack(), clearTrack().sections));
    const b = buildWorldPlan(worldSource(clearTrack(180), [section(0, 180, 'verse', 0.6)]));
    assert.notEqual(a.seed, b.seed);
    assert.notDeepEqual(Array.from(a.eras, e => e.era), Array.from(b.eras, e => e.era));
});

test('character crossfades are bounded and continuous across a phase boundary', () => {
    const source = clearTrack();
    const plan = buildWorldPlan(worldSource(source, source.sections));
    const out = { industry: 0, construction: 0, lattice: 0, flow: 0, anomaly: 0 };
    const at = t => ({ ...timeline.characterAt(plan, t, out) });
    for (const phase of plan.phases.slice(1)) {
        const before = at(phase.start - 1e-4), after = at(phase.start + 1e-4);
        for (const key of Object.keys(before)) assert.ok(Math.abs(before[key] - after[key]) < 0.01, `no jump at ${phase.start} (${key})`);
    }
    assert.equal(timeline.phaseAt(plan, -5).index, 0);
    assert.equal(timeline.phaseAt(plan, 1e6).index, plan.phases.length - 1);
});
