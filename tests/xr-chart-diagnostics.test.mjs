import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';
import { harness } from './helpers/xr-controller-harness.mjs';

const load = createLoader();
const { buildRhythmChart, buildRhythmChartWithDiagnostics, DEFAULT_RHYTHM_GAME_CONFIG: config,
    DIFFICULTIES, HAND_PATTERNS } = load('gameplay/index.ts');
const { DEFAULT_XR_SETTINGS } = load('xr/XrSettings.ts');
const { diagnosticsReport, menuLayout, DEFAULT_MENU_STATE } = load('xr/XrMenuModel.ts');
const json = value => JSON.stringify(value);
const plain = value => JSON.parse(json(value));
const settle = () => new Promise(setImmediate);

function accounting(source, result) {
    const { chart, diagnostics: d } = result;
    assert.equal(d.sourceEvents, source.events.length);
    assert.equal(d.decisions.length, source.events.length);
    assert.equal(d.retainedEvents + d.skippedEvents, d.sourceEvents);
    assert.equal(Object.values(d.rejected).reduce((sum, count) => sum + count, 0), d.skippedEvents);
    assert.equal(d.notes, chart.length);
    assert.equal(d.hands.left + d.hands.right + d.hands.either, chart.length);
    const notes = new Map(chart.map(n => [n.id, n]));
    const ids = [];
    for (let i = 0; i < d.decisions.length; i++) {
        const row = d.decisions[i];
        assert.equal(row.sourceIndex, i);
        assert.equal(row.outcome === 'retained', row.noteIds.length > 0);
        assert.equal(row.time, Number.isFinite(source.events[i].time) ? source.events[i].time : null);
        assert.equal(row.hands.length, row.noteIds.length);
        for (let j = 0; j < row.noteIds.length; j++) {
            const note = notes.get(row.noteIds[j]);
            assert.ok(note, 'a retained ID belongs to the final chart');
            assert.equal(note.time, source.events[i].time);
            assert.equal(note.sourceType, source.events[i].type);
            assert.equal(row.hands[j], note.hand, 'read the final hand after reflection, never the ID suffix');
            ids.push(note.id);
        }
        if (row.outcome === 'movement-rejected') assert.ok(row.movementIssues.length);
    }
    assert.equal(ids.length, new Set(ids).size);
    assert.equal(ids.length, chart.length, 'every final note is accounted exactly once');
    assert.equal(d.revoicedNotes, d.decisions.filter(r => r.revoiced).reduce((sum, r) => sum + r.noteIds.length, 0));
}

test('detailed and legacy builders produce identical charts across profiles, safety modes and mirrored leads', () => {
    const source = chartSources()['journey-128-confident'];
    const before = json(source);
    let pairs = 0, motor = 0, revoiced = 0, overhead = 0;
    for (const difficulty of DIFFICULTIES) for (const handPattern of HAND_PATTERNS)
        for (const variant of [{}, { motionSafety: 'guarded', handLead: 'right', playSpace: 'tall' },
            { chartProfile: 'musical-v1', zones: 'cross', variation: 'expressive', activity: 'active' }]) {
            const settings = { difficulty, handPattern, ...variant };
            const result = buildRhythmChartWithDiagnostics(source, config, settings);
            assert.equal(json(result.chart), json(buildRhythmChart(source, config, settings)));
            assert.equal(json(result), json(buildRhythmChartWithDiagnostics(source, config, settings)), 'deterministic diagnostics');
            accounting(source, result);
            pairs += result.diagnostics.decisions.filter(r => r.noteIds.length === 2).length;
            motor += result.diagnostics.rejected['movement-rejected'] ?? 0;
            revoiced += result.diagnostics.revoicedNotes;
            overhead += result.diagnostics.rejected['overhead-rest'] ?? 0;
        }
    assert.ok(pairs && motor && revoiced && overhead, 'cover real pairs, rejected groups and retained revoicings');
    assert.equal(json(source), before, 'source is not mutated');
});

test('unsorted, duplicate-time and invalid events keep original source indices and first actual rejection reasons', () => {
    const source = { durationSec: 12, beats: [], events: [
        { time: 5, intensity: 1, type: 1 }, { time: NaN, intensity: 1, type: 1 },
        { time: 1, intensity: 0, type: 1 }, { time: 13, intensity: NaN, type: 1 },
        { time: 3, intensity: Infinity, type: 1 }, { time: 3.5, intensity: .01, type: 1 },
        { time: 5, intensity: 1, type: 1 }, { time: 2, intensity: 1, type: 2 },
        { time: 9, intensity: 1, type: 1 }
    ] };
    const result = buildRhythmChartWithDiagnostics(source);
    accounting(source, result);
    assert.deepEqual(plain(result.diagnostics.decisions.slice(1, 6).map(r => r.outcome)),
        ['invalid-time', 'before-approach', 'after-duration', 'invalid-intensity', 'below-intensity-floor']);
    assert.ok(result.diagnostics.decisions[0].noteIds.length);
    const duplicate = result.diagnostics.decisions[6];
    assert.equal(duplicate.outcome, 'spacing', 'the real policy gate, not a fabricated acoustic duplicate/confidence score');
    assert.ok(duplicate.spacing.earliestTime > 5);
    assert.ok(duplicate.spacing.requiredGapSec > 0);
    assert.doesNotThrow(() => JSON.parse(json(result.diagnostics)), 'non-finite event times serialize as null');
    for (const durationSec of [0, -1, NaN, Infinity]) {
        const invalid = buildRhythmChartWithDiagnostics({ ...source, durationSec });
        accounting(source, invalid);
        assert.equal(invalid.diagnostics.rejected['invalid-duration'], source.events.length);
    }
    accounting({ events: [] }, buildRhythmChartWithDiagnostics({ durationSec: 10, beats: [], events: [] }));
});

test('chart-only diagnostics are visible and copyable before playback, with complete per-event JSON', async () => {
    const h = harness({ diagnostics: true });
    await h.loadTrack();
    const report = h.controller.chartDiagnostics;
    assert.ok(report);
    assert.equal(h.engine.plays.length, 0);
    assert.equal(h.controller.backgroundDiagnostics.summary, '');
    assert.match(h.controller.menuContext().chartDiagnostics, /^Chart: \d+\/\d+ events/);
    assert.match(h.drawer.chartDiagnosticsEl.textContent, /Skipped \d+; revoiced/);
    const layout = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'settings' }, h.controller.menuContext());
    assert.equal(layout.items.find(i => i.id === 'action:copy-diagnostics').disabled, false);
    let copied;
    h.controller.copyToClipboard = text => { copied = text; };
    h.controller.runMenuCommand({ type: 'copy-diagnostics' });
    assert.match(copied, /intensity is not confidence/);
    const payload = JSON.parse(copied.split('Chart JSON: ')[1].split('\n')[0]);
    assert.equal(payload.decisions.length, h.source.events.length);
    assert.equal(payload.notes, h.controller.session.chart.length);
    assert.match(copied, /Plexus XR settings/);
    assert.equal(JSON.parse(h.controller.overlay.dataset.xrChartSelection).decisions, undefined,
        'DOM carries summary only; full JSON serializes on Copy');
    assert.match(diagnosticsReport('', DEFAULT_XR_SETTINGS, 'Song', report), /accepted BeatEvents \(including FX transients\)/);
    h.controller.dispose();
});

test('Diagnostics toggles reuse captured analysis without altering playback, chart or saved generation settings', async () => {
    const quiet = { ...DEFAULT_XR_SETTINGS, system: { ...DEFAULT_XR_SETTINGS.system, diagnostics: false } };
    const saved = [];
    const h = harness({ settingsStore: { load: () => quiet, save: s => saved.push(plain(s)) } });
    await h.loadTrack();
    assert.equal(h.controller.chartDiagnostics, null);
    h.engine.play(0);
    const chart = h.chart(), stops = h.engine.stops.length, plans = h.prepareCalls.length;
    h.pick('on', 'system', 'diagnostics'); await settle();
    assert.ok(h.controller.chartDiagnostics);
    assert.ok(h.drawer.chartDiagnosticsEl.textContent);
    assert.equal(h.engine.loads, 1);
    assert.equal(h.prepareCalls.length, plans);
    assert.equal(h.engine.stops.length, stops);
    assert.equal(h.chart(), chart);
    assert.equal(h.controller.session.getState(), 'playing');
    h.pick('off', 'system', 'diagnostics'); await settle();
    assert.equal(h.controller.chartDiagnostics, null);
    assert.equal(h.controller.menuContext().chartDiagnostics, undefined);
    assert.equal(h.drawer.chartDiagnosticsEl.textContent, '');
    assert.equal(h.controller.overlay.dataset.xrChartSelection, undefined);
    assert.equal(h.controller.overlay.dataset.xrScore, undefined);
    assert.deepEqual(saved.map(s => s.system.diagnostics), [true, false]);
    h.controller.dispose();
});

test('async regeneration, new loads, errors and disposal never expose a stale chart report', async () => {
    const h = harness({ diagnostics: true }); await h.loadTrack();
    const original = h.controller.chartDiagnostics;
    let resolve;
    h.setPrepare(() => new Promise(done => { resolve = done; }));
    h.pick('active'); await settle();
    assert.equal(h.controller.chartDiagnostics, null);
    assert.equal(h.drawer.chartDiagnosticsEl.textContent, '');
    resolve(h.source.performancePlan); await settle();
    assert.ok(h.controller.chartDiagnostics);
    assert.notEqual(h.controller.chartDiagnostics, original);
    h.drawer.fileInput.files = [{ name: 'next.wav' }];
    h.drawer.fileInput.dispatchEvent(new Event('change'));
    assert.equal(h.controller.chartDiagnostics, null, 'cleared at load start, before analysis completion');
    h.engine.onAnalysisError('fixture failure');
    assert.equal(h.controller.chartDiagnostics, null);
    h.controller.dispose();
    assert.equal(h.controller.chartDiagnostics, null);
});


test('unrelated presentation errors retain a valid chart report; new charts invalidate old performance measurements', async () => {
    const h = harness({ diagnostics: true }); await h.loadTrack();
    const report = h.controller.chartDiagnostics;
    h.controller.showError('VR session fixture failure');
    assert.equal(h.controller.chartDiagnostics, report, 'chart remains valid after a display/session error');
    h.engine.play(0);
    for (let i = 0; i < 150; i++) h.runtime.callback(null, 1 / 60);
    assert.ok(h.controller.backgroundDiagnostics.summary);
    assert.ok(h.controller.overlay.dataset.xrBackgroundStages);
    h.pick('expert'); await settle();
    assert.ok(h.controller.chartDiagnostics, 'new report available');
    assert.equal(h.controller.backgroundDiagnostics.summary, '');
    assert.equal(h.controller.overlay.dataset.xrBackgroundStages, undefined);
    let copied;
    h.controller.copyToClipboard = text => { copied = text; };
    h.controller.runMenuCommand({ type: 'copy-diagnostics' });
    assert.match(copied, /Chart selection/);
    assert.doesNotMatch(copied, /Display .* fps/);
    h.engine.play(0);
    for (let i = 0; i < 150; i++) h.runtime.callback(null, 1 / 60);
    assert.ok(h.controller.backgroundDiagnostics.summary);
    h.drawer.fileInput.files = [{ name: 'another.wav' }];
    h.drawer.fileInput.dispatchEvent(new Event('change'));
    assert.equal(h.controller.backgroundDiagnostics.summary, '');
    assert.equal(h.controller.overlay.dataset.xrBackgroundStages, undefined);
    h.controller.dispose();
});
