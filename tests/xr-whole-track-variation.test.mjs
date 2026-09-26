import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader();
const { buildRhythmChart, notePosition, DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');
const point = (time, gesture = 'orbit') => ({ id: `p-${time}`, time, preset: 'opaque.json', sectionId: 's',
    reason: 'break', confidence: 0.3, intensity: 0.5, morphDurationSec: 1, morphCurve: 'linear',
    meta: { automationSituation: 'breakdown-long', movementGesture: gesture, variantRole: 'primary' } });

for (const step of [0.33, 0.7, 1.1]) for (const confidence of [0.1, 0.9]) {
    test(`whole-track variety survives sustained quiet FX-only material: onset ${step}s, confidence ${confidence}`, () => {
        const durationSec = 360;
        const events = Array.from({ length: Math.floor(durationSec / step) }, (_, i) => ({ time: i * step, intensity: 0.18 + (i % 7) * 0.01, type: 3 }));
        const chart = buildRhythmChart({ events, durationSec, beats: events.map(e => e.time), timingConfidence: confidence,
            performancePlan: { version: 1, source: 'auto', points: [point(0)] } });
        for (let q = 0; q < 4; q++) {
            const notes = chart.filter(n => n.time >= q * 90 && n.time < (q + 1) * 90);
            assert.ok(notes.filter(n => n.cutDirection !== 'any').length > notes.length / 2);
            assert.ok(new Set(notes.map(n => n.cutDirection).filter(d => d !== 'any')).size >= 3);
            assert.ok(notes.some(n => n.cutDirection === 'left' || n.cutDirection === 'right'), 'lateral cuts appear throughout the track');
            assert.ok(new Set(notes.map(n => n.pairLayout).filter(Boolean)).size >= 2);
            assert.equal(new Set(notes.map(n => n.row)).size, 3);
            assert.ok(new Set(notes.map(n => n.texture)).size >= 3);
        }
        const last = {};
        for (const n of chart) {
            assert.ok(events.some(e => e.time === n.time));
            if (last[n.hand]) {
                const p = last[n.hand], a = notePosition(n, n.time, {}), b = notePosition(p, p.time, {});
                assert.ok(n.time - p.time >= config.minSameHandSpacingSec - 1e-8);
                assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= (n.time - p.time) * config.maxHandTravelMps + 1e-8);
            }
            last[n.hand] = n;
        }
    });
}

test('automation gesture changes alter both layout vocabulary and audible-onset selection after the cue', () => {
    const events = Array.from({ length: 160 }, (_, i) => ({ time: i / 4, intensity: 0.5, type: 1 }));
    const build = gesture => buildRhythmChart({ events, durationSec: 40, beats: [], timingConfidence: 0.2,
        performancePlan: { version: 1, source: 'auto', points: [point(0, 'orbit'), point(20, gesture)] } });
    const echo = build('ripple'), pulse = build('pulse');
    assert.deepEqual(JSON.parse(JSON.stringify(echo.filter(n => n.time < 19))), JSON.parse(JSON.stringify(pulse.filter(n => n.time < 19))));
    assert.notDeepEqual(echo.filter(n => n.time >= 20 && n.time < 24).map(n => n.time), pulse.filter(n => n.time >= 20 && n.time < 24).map(n => n.time));
    assert.equal(echo.find(n => n.time >= 20).texture, 'echo');
    assert.ok(echo.filter(n => n.time >= 20).every(n => n.automationId === 'p-20'));
});

test('missing automation still gives variety, but silence and single onsets never get invented pairs', () => {
    const events = Array.from({ length: 120 }, (_, i) => ({ time: i / 2, intensity: 0.4, type: 1 })).filter(e => e.time < 20 || e.time > 40);
    const chart = buildRhythmChart({ events, durationSec: 60, beats: [] });
    assert.ok(chart.some(n => n.pairId)); assert.ok(chart.some(n => n.cutDirection !== 'any'));
    assert.ok(chart.every(n => n.time < 20 || n.time > 40));
    assert.equal(buildRhythmChart({ events: [{ time: 3, intensity: 0.5, type: 1 }], durationSec: 5, beats: [] }).length, 1);
});
