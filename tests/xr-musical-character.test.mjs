import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { harness } from './helpers/xr-controller-harness.mjs';

const load = createLoader();
const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG: config, normalizeGenerationSettings,
    validateRhythmMovement, DIFFICULTIES, HAND_PATTERNS } = load('gameplay/index.ts');
const { planRhythmPhrases } = load('gameplay/RhythmPhrasePlanner.ts');
const json = value => JSON.stringify(value);
const clone = value => JSON.parse(json(value));
const settle = () => new Promise(setImmediate);
const sections = [
    { start: 0, end: 24, label: 'intro' }, { start: 24, end: 48, label: 'verse' },
    { start: 48, end: 80, label: 'build' }, { start: 80, end: 104, label: 'drop' },
    { start: 104, end: 128, label: 'break' }
];
const source = {
    durationSec: 128, sections, sectionStarts: sections.map(s => s.start), timingConfidence: 0.9,
    beats: Array.from({ length: 321 }, (_, i) => i * 0.4),
    barStarts: Array.from({ length: 81 }, (_, i) => i * 1.6),
    events: Array.from({ length: 1280 }, (_, i) => ({ time: i / 10,
        intensity: i % 16 === 0 ? 0.95 : 0.55 + i % 4 * 0.08, type: i % 16 === 0 ? 2 : i % 11 === 0 ? 3 : 1 }))
};
const musical = { chartProfile: 'musical-v1', difficulty: 'expert', activity: 'active', variation: 'expressive' };

test('Musical keeps calm phrases compact, develops builds and reserves wider motifs for peaks on the same source', () => {
    const settings = normalizeGenerationSettings(musical);
    const phrases = planRhythmPhrases(source.events, [], source.durationSec, source.beats, 0.9, settings, sections);
    for (const p of phrases) {
        const s = sections.find(s => p.start >= s.start && p.start < s.end);
        assert.ok(p.end <= s.end, 'a phrase never carries a preceding character past a section boundary');
        if (s.label === 'intro' || s.label === 'break') assert.ok(['breath', 'pulse', 'echo'].includes(p.texture));
        if (s.label === 'drop') assert.ok(['impact', 'weave', 'drive'].includes(p.texture));
    }
    const builds = phrases.filter(p => p.character.kind === 'build');
    assert.ok(builds.at(-1).character.energy > builds[0].character.energy);
    assert.ok(builds.at(-1).character.densityScale < builds[0].character.densityScale);
    assert.equal(builds[0].texture, 'pulse'); assert.ok(builds.some(p => p.texture === 'build'));
    const chart = buildRhythmChart(source, config, musical);
    const calm = chart.filter(n => n.time < 24 || n.time >= 104);
    const peak = chart.filter(n => n.time >= 80 && n.time < 104);
    assert.ok(calm.length > 0 && peak.length > 0);
    assert.ok(calm.every(n => n.row === 1 && Math.abs(n.xOffsetMeters) <= 0.35));
    assert.ok(peak.some(n => n.row !== 1));
    assert.ok(peak.length / 24 > calm.length / 48, 'identical onset supply produces denser peak than calm');
    assert.notEqual(json(chart), json(buildRhythmChart(source, config, { ...musical, chartProfile: 'legacy' })));
});

test('every difficulty/hand/zone/space/lead and unreliable meter retain movement, provenance, pairs and determinism', () => {
    let runs = 0, pairs = 0;
    const before = json(source);
    for (const difficulty of DIFFICULTIES) for (const handPattern of HAND_PATTERNS)
        for (const zones of ['split', 'shared', 'cross']) for (const playSpace of ['standard', 'tall'])
            for (const handLead of ['left', 'even', 'right']) {
                const settings = { ...musical, difficulty, handPattern, zones, playSpace, handLead,
                    activity: ['macro', 'balanced', 'active'][runs % 3], variation: ['stable', 'paired', 'expressive'][Math.floor(runs / 3) % 3] };
                const input = { ...source, ...(runs % 2 ? { beats: [], barStarts: [], timingConfidence: 0.1 } : {}) };
                const chart = buildRhythmChart(input, config, settings);
                assert.ok(chart.length > 0);
                const report = validateRhythmMovement(chart, config, settings);
                assert.ok(report.valid, `${json(settings)}: ${json(report.issues)}`);
                assert.equal(json(chart), json(buildRhythmChart(clone(input), config, settings)));
                for (const n of chart) {
                    const event = input.events[Number(n.id.split('-')[1])];
                    assert.equal(n.time, event.time); assert.equal(n.sourceType, event.type);
                    assert.equal(n.intensity, event.intensity);
                    if (zones === 'split') assert.equal(Math.sign(n.xOffsetMeters), n.hand === 'left' ? -1 : 1);
                    if (zones === 'shared') assert.ok(Math.sign(n.xOffsetMeters) !== (n.hand === 'left' ? 1 : -1));
                }
                for (const id of new Set(chart.filter(n => n.pairId).map(n => n.pairId))) {
                    const pair = chart.filter(n => n.pairId === id);
                    assert.equal(pair.length, 2); assert.equal(pair[0].time, pair[1].time); pairs++;
                }
                runs++;
            }
    assert.equal(runs, 360); assert.ok(pairs > 0); assert.equal(json(source), before);
});

test('Classic remains byte-identical; missing, gapped, overlapping or malformed sections fall back to Classic/Guarded', () => {
    assert.equal(json(buildRhythmChart(source)), json(buildRhythmChart({ ...source, sections: undefined })));
    const expected = json(buildRhythmChart(source, config, { ...musical, chartProfile: 'legacy', motionSafety: 'guarded' }));
    for (const invalid of [undefined, [], [{ start: 0, end: 128, label: 'vocal' }],
        [{ start: 0, end: 60, label: 'intro' }, { start: 61, end: 128, label: 'drop' }],
        [{ start: 0, end: 70, label: 'intro' }, { start: 60, end: 128, label: 'drop' }],
        [{ start: NaN, end: 128, label: 'intro' }], [{ start: 0, end: 120, label: 'intro' }]]) {
        assert.equal(json(buildRhythmChart({ ...source, sections: invalid }, config, musical)), expected);
    }
    assert.equal(json(buildRhythmChart({ ...source, events: [] }, config, musical)), '[]', 'grid/sections never create a target');
    const sparse = { ...source, events: [source.events[150], source.events[900]] };
    assert.ok(buildRhythmChart(sparse, config, musical).every(n => [15, 90].includes(n.time)), 'sustain and empty gaps stay empty');
});

test('long Musical Alternate/Even charts keep both hands active in every populated half-minute', () => {
    const long = { ...source, durationSec: 384,
        events: [0, 128, 256].flatMap(offset => source.events.map(e => ({ ...e, time: e.time + offset }))),
        sections: [0, 128, 256].flatMap(offset => sections.map(s => ({ ...s, start: s.start + offset, end: s.end + offset }))),
        beats: Array.from({ length: 961 }, (_, i) => i * .4), barStarts: Array.from({ length: 241 }, (_, i) => i * 1.6) };
    long.sectionStarts = long.sections.map(s => s.start);
    for (const difficulty of DIFFICULTIES) for (const activity of ['macro', 'balanced', 'active'])
        for (const zones of ['split', 'shared', 'cross']) for (const playSpace of ['standard', 'tall']) {
            const settings = { ...musical, difficulty, activity, zones, playSpace, handPattern: 'alternate', handLead: 'even' };
            const chart = buildRhythmChart(long, config, settings);
            assert.ok(validateRhythmMovement(chart, config, settings).valid);
            for (let start = 0; start < 360; start += 30) {
                const window = chart.filter(n => n.time >= start && n.time < start + 30);
                assert.ok(window.some(n => n.hand === 'left') && window.some(n => n.hand === 'right'), `${json(settings)}: ${start}s hand starvation`);
            }
        }
});

test('Musical is chart-scoped, grouped with Choreography, persisted and copied; Legacy movement returns to Classic explicitly', () => {
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, normalizeXrSettings, changeScope } = load('xr/XrSettings.ts');
    const { createXrSettingsStore } = load('xr/XrSettingsStore.ts');
    const { settingsReport } = load('xr/XrMenuModel.ts');
    const profile = XR_SETTINGS.find(d => d.id === 'chartProfile'), movement = XR_SETTINGS.find(d => d.id === 'motionSafety');
    assert.equal(profile.section, 'choreography'); assert.equal(profile.scope, 'chart');
    const settings = profile.write(DEFAULT_XR_SETTINGS, 'musical-v1');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, settings), 'chart'); assert.equal(movement.read(settings), 'guarded');
    let raw; const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
    createXrSettingsStore(storage).save(settings);
    assert.equal(json(createXrSettingsStore(storage).load()), json(settings));
    assert.match(settingsReport(settings), /\[Choreography\][\s\S]*Chart profile: Musical/);
    assert.match(settingsReport(settings), /"chartProfile":"musical-v1"/);
    assert.equal(profile.read(movement.write(settings, 'legacy')), 'legacy');
    assert.equal(movement.read(movement.write(settings, 'legacy')), 'legacy');
    assert.equal(profile.read(profile.write(settings, 'legacy')), 'legacy');
    assert.equal(movement.read(profile.write(settings, 'legacy')), 'guarded', 'Classic honors the current Movement selection');
    assert.equal(profile.read(normalizeXrSettings({ generation: { chartProfile: 'unknown' } })), 'legacy');
});

test('controller regenerates Musical from captured sections without analysis or plan restart; latest settings win', async () => {
    const h = harness(); await h.loadTrack(); const before = h.chart();
    h.engine.play(0); h.pick('musical-v1'); await settle();
    assert.equal(h.chart(), h.expected({ chartProfile: 'musical-v1' }));
    assert.notEqual(h.chart(), before); assert.equal(h.engine.loads, 1); assert.equal(h.prepareCalls.length, 1);
    assert.equal(h.sceneLog.analyses.filter(Boolean).length, 1);
    assert.equal(h.controller.session.getState(), 'ready'); assert.ok(h.engine.stops.includes(true));
    assert.match(h.drawer.trackInfoEl.textContent, /Musical \/ Guarded/);
    h.pick('legacy', 'choreography', 'motionSafety'); await settle();
    assert.equal(h.chart(), before); assert.equal(h.engine.loads, 1);
    const pending = {}; pending.promise = new Promise(resolve => { pending.resolve = resolve; });
    h.setPrepare(() => pending.promise); h.pick('active');
    h.pick('musical-v1'); h.pick('legacy', 'choreography', 'motionSafety');
    pending.resolve(h.source.performancePlan); await settle();
    assert.equal(h.chart(), h.expected({ activity: 'active' }));
    h.controller.dispose();
});

test('an open desktop menu refits on camera resize/zoom without a texture redraw or chart regeneration', async () => {
    const h = harness(); await h.loadTrack();
    const panel = h.controller.menuPanel, camera = h.runtime.camera;
    h.runtime.callback(null, 0.016); // Establish the initial displayed layout before measuring resize.
    const before = panel.redrawCount, chart = h.chart();
    camera.aspect = 0.4; camera.zoom = 1.5; camera.updateProjectionMatrix();
    h.runtime.callback(null, 0.016);
    const corners = panel.mesh.geometry.attributes.position;
    for (let i = 0; i < corners.count; i++) {
        const v = panel.mesh.localToWorld(h.controller.pointerRay.origin.clone().fromBufferAttribute(corners, i)).project(camera);
        assert.ok(Math.abs(v.x) <= 0.901 && Math.abs(v.y) <= 0.901);
    }
    assert.equal(panel.redrawCount, before); assert.equal(h.chart(), chart); assert.equal(h.engine.loads, 1);
    h.controller.dispose();
});
