import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';
const load = createLoader({ three: THREE });
const { buildRhythmChart, validateRhythmMovement: validate, guardRhythmMovement: guard, mirrorRhythmChart: mirror,
    rhythmStroke, movingHandDistance, DEFAULT_RHYTHM_GAME_CONFIG: config, DIFFICULTIES, HAND_PATTERNS,
    buildScoringPlan, RhythmGameSession, notePosition, MAX_MOVEMENT_ISSUES } = load('gameplay/index.ts');
const n = (id, time, extra = {}) => ({ id, time, lane: 0, row: 1, hand: 'left', intensity: .8, sourceType: 1, cutDirection: 'any', ...extra });
const json = v => JSON.parse(JSON.stringify(v));
const codes = (chart, settings = {}) => validate(chart, config, settings).issues.map(i => i.code);

test('movement validator detects unreachable rows, invalid target data, order, duplicate ids and same-hand density', () => {
    assert.ok(codes([n('a', 2, { row: 3 })]).includes('unreachable-target'));
    assert.ok(validate([n('a', 2, { row: 3, cutDirection: 'down' })], config, { playSpace: 'tall' }).valid);
    assert.ok(codes([n('a', 2, { xOffsetMeters: 2 })]).includes('unreachable-target'));
    assert.ok(codes([n('a', NaN)]).includes('invalid-target'));
    assert.ok(codes([n('a', 3), n('b', 2)]).includes('unordered'));
    assert.ok(codes([n('a', 2), n('a', 4)]).includes('duplicate-id'));
    assert.ok(codes([n('a', 2), n('b', 2.1)]).includes('same-hand-density'));
    const many = Array.from({ length: 400 }, (_, i) => n('a' + i, i * .01));
    const report = validate(many); assert.equal(report.issues.length, MAX_MOVEMENT_ISSUES); assert.ok(report.issueCount > report.issues.length);
});

test('stroke recovery catches a route missed by target-centre travel and admits a properly prepared reversal', () => {
    // Centre travel .34 m in .40 s is below 1.2 m/s; the downstroke ends below the next entry.
    const chart = [n('a', 2, { cutDirection: 'down' }), n('b', 2.4, { row: 2, cutDirection: 'down' })];
    assert.ok(.34 / .4 < config.maxHandTravelMps);
    assert.ok(codes(chart).includes('return-speed'));
    assert.ok(validate([chart[0], n('b', 2.8, { row: 2, cutDirection: 'up' })]).valid);
    const stroke = rhythmStroke(chart[0], config); assert.ok(stroke.entry.y > stroke.exit.y);
});

test('temporal hand-path collision uses closest approach, with no false collision at different song intervals', () => {
    const a = { start: 0, end: 1, a: { x: -1, y: 0 }, b: { x: 1, y: 0 }, id: 'a' };
    const b = { start: 0, end: 1, a: { x: 1, y: 0 }, b: { x: -1, y: 0 }, id: 'b' };
    assert.equal(movingHandDistance(a, b), 0);
    assert.equal(movingHandDistance(a, { ...b, start: 2, end: 3 }), Infinity);
    assert.equal(movingHandDistance(a, { ...b, a: { x: 1, y: .2 }, b: { x: -1, y: .2 } }), .2);
    const chart = [n('l0', 2), n('r0', 2, { hand: 'right', lane: 2 }),
        n('l1', 3.5, { lane: 2 }), n('r1', 3.5, { hand: 'right', lane: 0 })];
    assert.ok(codes(chart).includes('hand-collision'), 'opposite transition paths cross despite separated target centres');
    assert.ok(validate(guard(chart).chart).valid);
});

test('shared-space moves reserve clearance both before and after; same-time pairs remain atomic', () => {
    const crossed = n('cross', 3, { lane: 2 });
    assert.ok(codes([n('r', 2.7, { hand: 'right', lane: 2 }), crossed]).includes('cross-clearance'));
    assert.ok(codes([crossed, n('r', 3.3, { hand: 'right', lane: 2 })]).includes('cross-clearance'));
    const pair = [n('l', 3, { pairId: 'p', pairLayout: 'horizontal' }),
        n('r', 3, { hand: 'right', lane: 0, pairId: 'p', pairLayout: 'horizontal' })];
    assert.ok(codes(pair).includes('hand-collision'));
    const repaired = guard(pair); assert.equal(repaired.chart.length, 2); assert.ok(validate(repaired.chart).valid);
    assert.equal(repaired.revoicedNotes, 2, 'both hands repaired atomically');
    assert.ok(codes([pair[0]]).includes('invalid-pair'));
});

test('Tall overhead preparation and post-chop rest are explicit motor constraints', () => {
    const overhead = n('high', 3, { row: 3, cutDirection: 'down' });
    assert.ok(codes([n('before', 2.6, { row: 2 }), overhead], { playSpace: 'tall' }).includes('overhead-rest'));
    assert.ok(codes([overhead, n('after', 3.5, { row: 2 })], { playSpace: 'tall' }).includes('overhead-rest'));
    assert.ok(validate([overhead, n('after', 4, { row: 2 })], config, { playSpace: 'tall' }).valid);
    const low = n('low', 3.8, { row: 0, cutDirection: 'down' });
    const revoiced = guard([overhead, low], config, { playSpace: 'tall' });
    assert.equal(revoiced.chart.length, 2); assert.ok(revoiced.chart[1].row <= 2, 'no invented overhead after a row fallback');
    for (const key of ['id', 'time', 'hand', 'cutDirection', 'intensity', 'sourceType']) assert.equal(revoiced.chart[1][key], low[key]);
});

test('either-hand targets retain their meaning and can use the feasible opposite hand', () => {
    const chart = [n('left', 2), n('either', 2.3, { hand: 'either', lane: 2 })];
    assert.ok(validate(chart).valid);
    const safe = guard(chart).chart; assert.equal(safe[1].hand, 'either');
    assert.deepEqual(json(safe), chart);
});

test('guarded corpus covers every difficulty, hand pattern, zone and play space with deterministic validated charts', () => {
    let runs = 0, legacyIssues = 0, dropped = 0, retainedPairs = 0, overhead = 0;
    for (const source of Object.values(chartSources())) for (const difficulty of DIFFICULTIES)
        for (const handPattern of HAND_PATTERNS) for (const zones of ['split', 'shared', 'cross']) for (const playSpace of ['standard', 'tall']) {
            const settings = { difficulty, handPattern, zones, playSpace, activity: runs % 2 ? 'active' : 'balanced',
                variation: runs % 3 ? 'expressive' : 'stable', handLead: runs % 2 ? 'right' : 'even' };
            const legacy = buildRhythmChart(source, config, settings), safeSettings = { ...settings, motionSafety: 'guarded' };
            const before = JSON.stringify(source), safe = buildRhythmChart(source, config, safeSettings);
            assert.ok(validate(safe, config, safeSettings).valid, JSON.stringify(safeSettings));
            assert.equal(JSON.stringify(safe), JSON.stringify(buildRhythmChart(json(source), config, safeSettings)));
            assert.equal(JSON.stringify(source), before); assert.ok(safe.length > 0);
            assert.ok(safe.every(n => source.events.some(e => e.time === n.time)), 'no invented/shifted onset');
            for (const id of new Set(safe.filter(n => n.pairId).map(n => n.pairId))) assert.equal(safe.filter(n => n.pairId === id).length, 2);
            assert.ok(validate(guard(safe, config, safeSettings).chart, config, safeSettings).valid);
            legacyIssues += validate(legacy, config, settings).issueCount; dropped += Math.max(0, legacy.length - safe.length);
            retainedPairs += safe.filter(n => n.pairId).length; overhead += safe.filter(n => n.row === 3).length; runs++;
        }
    assert.equal(runs, 480); assert.ok(legacyIssues > 0 && dropped > 0); assert.ok(retainedPairs > 0 && overhead > 0);
});

test('left/right lead reflection keeps demand, notes, max score and section rewards equal across all profiles', () => {
    const source = chartSources()['journey-128-confident'];
    const sections = [{ start: 0, end: 48, label: 'build' }, { start: 48, end: 96, label: 'drop' }];
    for (const difficulty of DIFFICULTIES) for (const handPattern of HAND_PATTERNS) for (const playSpace of ['standard', 'tall']) {
        const settings = { difficulty, handPattern, playSpace, zones: 'cross', motionSafety: 'guarded', activity: 'active', variation: 'expressive' };
        const left = buildRhythmChart(source, config, { ...settings, handLead: 'left' });
        const right = buildRhythmChart(source, config, { ...settings, handLead: 'right' });
        assert.deepEqual(json(right), json(mirror(left))); assert.deepEqual(json(mirror(right)), json(left));
        assert.deepEqual(json(buildScoringPlan(left, sections)), json(buildScoringPlan(right, sections)));
        assert.ok(validate(right, config, settings).valid);
    }
});

test('movement choice uses menu/localStorage/Copy, chart scope, and preserves absent legacy normalization', () => {
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, normalizeXrSettings, changeScope } = load('xr/XrSettings.ts');
    const { createXrSettingsStore } = load('xr/XrSettingsStore.ts');
    const { settingsReport } = load('xr/XrMenuModel.ts');
    const descriptor = XR_SETTINGS.find(d => d.id === 'motionSafety');
    const safe = descriptor.write(DEFAULT_XR_SETTINGS, 'guarded'); assert.equal(changeScope(DEFAULT_XR_SETTINGS, safe), 'chart');
    const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
    createXrSettingsStore(storage).save(safe); assert.equal(createXrSettingsStore(storage).load().generation.motionSafety, 'guarded');
    assert.equal(JSON.parse(settingsReport(safe).split('JSON: ')[1]).generation.motionSafety, 'guarded');
    const legacy = descriptor.write(safe, 'legacy'); assert.equal(legacy.generation.motionSafety, undefined);
    assert.deepEqual(json(legacy), json(DEFAULT_XR_SETTINGS));
    assert.equal(normalizeXrSettings({ generation: { motionSafety: 'bad' } }).generation.motionSafety, undefined);
});

test('near-hit canonical position stays stable under far bend; real swept strikes and desktop assist share the session judge', () => {
    const { XrTrackPath } = load('xr/scene/XrTrackPath.ts');
    const path = new XrTrackPath(); path.setFocus(.7, -.4);
    const note = n('a', 5, { cutDirection: 'down' });
    for (const time of [4.99, 5, 5.01]) {
        const p = notePosition(note, time, new THREE.Vector3(), config);
        const projected = path.projectPlayfieldPoint(p.clone());
        assert.ok(projected.distanceTo(p) < 1e-10);
    }
    const real = new RhythmGameSession(), desktop = new RhythmGameSession();
    for (const s of [real, desktop]) { s.loadChart([note]); s.start(); }
    const attempt = { songTime: 5.02, previousSongTime: 4.98, hand: 'left', speed: 2,
        previousPosition: { x: -.45, y: .12, z: 0 }, position: { x: -.45, y: -.12, z: 0 } };
    path.unprojectStrike(attempt);
    assert.equal(real.attemptStrike(attempt)?.grade, 'perfect');
    assert.equal(desktop.attemptStrike({ songTime: 5.02, hand: 'left', position: { x: -.45, y: 0, z: .08 }, speed: 1, desktopTargetId: note.id })?.grade, 'perfect');
    assert.deepEqual(json(real.getSnapshot()), json(desktop.getSnapshot()));
});
