import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { noteMatrixAt } from './helpers/xr-note-motion.mjs';
import { readFileSync } from 'node:fs';
const load = createLoader({ three: THREE });
const { buildRhythmChart, judgeStrike, notePosition, CUT_VECTORS, DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');
const { rhythmTexture } = load('gameplay/RhythmChoreography.ts');
const { RhythmNoteField } = load('xr/scene/RhythmNoteField.ts');
const { desktopStrikeForRay } = load('xr/DesktopInputAdapter.ts');
const point = (meta, time = 0) => ({ id: `p${time}`, time, sectionId: 's', preset: 'opaque.json', confidence: 0.9,
    intensity: 0.8, reason: 'section', morphDurationSec: 1, morphCurve: 'linear', meta });
const source = (meta = { automationSituation: 'drop-long' }) => ({ durationSec: 32,
    events: Array.from({ length: 128 }, (_, i) => ({ time: i * 0.25, intensity: i % 8 === 0 ? 0.95 : 0.65, type: 1 })),
    beats: Array.from({ length: 65 }, (_, i) => i * 0.5), barStarts: Array.from({ length: 17 }, (_, i) => i * 2),
    timingConfidence: 0.9, performancePlan: { version: 1, source: 'auto', points: [point(meta)] } });
const plain = v => JSON.parse(JSON.stringify(v));
const pending = note => ({ note, status: 'pending', judgement: null });

test('score is deterministic, immutable and every pair/single comes from an audible onset', () => {
    const s = source(), before = JSON.stringify(s), chart = buildRhythmChart(s);
    assert.deepEqual(plain(chart), plain(buildRhythmChart(plain(s))));
    assert.equal(JSON.stringify(s), before);
    assert.ok(chart.every(n => s.events.some(e => e.time === n.time)));
    assert.equal(new Set(chart.map(n => n.id)).size, chart.length);
    assert.equal(buildRhythmChart({ ...s, events: [] }).length, 0);
    assert.equal(buildRhythmChart({ ...s, events: [{ time: 99, intensity: 1, type: 1 }] }).length, 0);
});

test('confident impact accents include horizontal, vertical and diagonal complete two-hand pairs', () => {
    const chart = buildRhythmChart(source());
    assert.deepEqual(new Set(chart.filter(n => n.pairId).map(n => n.pairLayout)), new Set(['horizontal', 'vertical', 'diagonal']));
    const pairs = new Map();
    for (const n of chart.filter(n => n.pairId)) pairs.set(n.pairId, [...(pairs.get(n.pairId) ?? []), n]);
    assert.ok(pairs.size >= 3, 'phrases across the track contain accents');
    for (const pair of pairs.values()) {
        assert.equal(pair.length, 2); assert.equal(pair[0].time, pair[1].time);
        assert.deepEqual(new Set(pair.map(n => n.hand)), new Set(['left', 'right']));
        const a = notePosition(pair[0], pair[0].time, {}), b = notePosition(pair[1], pair[1].time, {});
        assert.ok(a.x < 0 && b.x > 0);
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > config.noteSizeMeters);
    }
});

test('dense charts preserve each hand recovery/travel budgets and opposite cut parity across role changes', () => {
    for (const tempo of [0.3, 0.5, 0.85]) {
        const s = source(); s.beats = s.beats.map((_, i) => i * tempo); s.barStarts = s.barStarts.map((_, i) => i * tempo * 4);
        s.performancePlan.points.push(point({ movementGesture: 'orbit' }, 8), point({ automationSituation: 'buildup-ramp' }, 16));
        const last = {}, directions = {};
        for (const n of buildRhythmChart(s)) {
            const p = last[n.hand];
            if (p) {
                const dt = n.time - p.time, a = notePosition(n, n.time, {}), b = notePosition(p, p.time, {});
                assert.ok(dt >= config.minSameHandSpacingSec - 1e-8);
                assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= dt * config.maxHandTravelMps + 1e-8);
                if (directions[n.hand] && n.cutDirection !== 'any' && dt < 1.5) {
                    const u = CUT_VECTORS[directions[n.hand]], v = CUT_VECTORS[n.cutDirection];
                    assert.ok(u[0] * v[0] + u[1] * v[1] <= 0.1);
                }
            }
            last[n.hand] = n;
            if (n.cutDirection !== 'any') directions[n.hand] = n.cutDirection;
        }
    }
});

test('downbeat accents tolerate onsets on either side of the grid without moving their timestamps', () => {
    for (const offset of [-0.03, 0.03]) {
        const s = source(); s.events = s.events.map(e => ({ ...e, time: e.time + offset }));
        const chart = buildRhythmChart(s), pairs = chart.filter(n => n.pairId);
        assert.ok(pairs.length >= 6);
        assert.ok(pairs.every(n => s.events.some(e => e.time === n.time)));
    }
});

test('musical roles produce distinct textures, density, echo response windows and spatial waves', () => {
    const breath = buildRhythmChart(source({ variantRole: 'sparse' }));
    const pulse = buildRhythmChart(source({ movementGesture: 'pulse' }));
    const drive = buildRhythmChart(source({ movementGesture: 'drive' }));
    const weave = buildRhythmChart(source({ movementGesture: 'orbit' }));
    const echo = buildRhythmChart(source({ variantRole: 'secondary' }));
    assert.ok(breath.length < pulse.length && pulse.length < drive.length);
    assert.ok(breath.some(n => n.cutDirection !== 'any') && breath.some(n => n.pairId));
    assert.equal(new Set(weave.map(n => n.row)).size, 3);
    assert.ok(new Set(echo.map(n => n.texture)).size >= 3, 'a long echo scene develops contrasting phrases');
    assert.equal(rhythmTexture({ automationSituation: 'buildup-ramp' }), 'build');
    assert.equal(rhythmTexture({ globalArcRole: 'resolution', automationSituation: 'drop-long' }), 'breath');
});

test('low timing confidence retains arrows and pairs anchored to real onsets', () => {
    const chart = buildRhythmChart({ ...source(), timingConfidence: 0.1 });
    assert.ok(chart.length > 0); assert.ok(chart.some(n => n.cutDirection !== 'any') && chart.some(n => n.pairId));
});

test('real Cosmic Wormhole Visual OS output drives score provenance through intro, build, drop and release', () => {
    const { buildVisualOsPerformancePlan } = load('automation/visualOsPlanner.ts');
    const { EMPTY_TRACK_ANALYSIS } = load('analyzer/normalizeAnalysisResult.ts');
    const section = (label, start, end, energy) => ({ label, start, end, energy, density: energy, dominantFeature: 'rhythm', avgRms: energy, peakRms: energy });
    const s = source(), analysis = { ...EMPTY_TRACK_ANALYSIS, duration: 32, bpm: 120, tempo: 120, bpmConfidence: 0.9, gridConfidence: 0.9,
        timingConfidence: { overall: 0.9, tempo: 0.9, beat: 0.9, grid: 0.9 }, beats: s.beats, barStarts: s.barStarts,
        sections: [section('intro', 0, 8, 0.2), section('build', 8, 16, 0.75), section('drop', 16, 24, 0.95), section('break', 24, 32, 0.2)] };
    const packs = JSON.parse(readFileSync('public/visual-tuning-presets/style-packs.json', 'utf8'));
    s.performancePlan = buildVisualOsPerformancePlan(analysis, packs, { duration: 32, stylePackId: 'cosmic-wormhole', activityLevel: 'balanced', variantMode: 'paired' });
    assert.ok(s.performancePlan.points.length > 3);
    const chart = buildRhythmChart(s);
    assert.ok(new Set(chart.map(n => n.texture)).size >= 3);
    for (const n of chart) {
        const active = s.performancePlan.points.filter(p => p.time <= n.time).at(-1);
        assert.equal(n.automationId, active.id);
    }
});

test('all eight arrows enforce physical XY direction; reversed, sideways and incoming-only motion fail', () => {
    for (const [direction, [x, y]] of Object.entries(CUT_VECTORS)) {
        const n = { id: direction, time: 5, lane: 0, row: 1, hand: 'left', intensity: 1, sourceType: 1, cutDirection: direction };
        const swing = (dx, dy) => ({ songTime: 5.02, previousSongTime: 4.98, hand: 'left', speed: 10,
            position: { x: -0.45 + dx * 0.3, y: dy * 0.3, z: 0.08 },
            previousPosition: { x: -0.45 - dx * 0.3, y: -dy * 0.3, z: -0.08 } });
        assert.ok(judgeStrike(swing(x, y), [pending(n)]), direction);
        assert.equal(judgeStrike(swing(-x, -y), [pending(n)]), null, direction);
        assert.equal(judgeStrike(swing(-y, x), [pending(n)]), null, direction);
        assert.equal(judgeStrike(swing(0, 0), [pending(n)]), null, direction);
    }
});

test('desktop direction assist preserves aim, matching color and timing for each member of a pair', () => {
    const pair = buildRhythmChart(source()).filter(n => n.pairId).slice(0, 2);
    for (const n of pair) {
        const position = notePosition(n, n.time, {});
        const ray = new THREE.Ray(new THREE.Vector3(position.x, position.y, 3), new THREE.Vector3(0, 0, -1));
        const strike = desktopStrikeForRay(ray, pair.map(pending), n.time, n.hand);
        assert.equal(strike.desktopTargetId, n.id);
        assert.ok(judgeStrike(strike, pair.map(pending)));
        assert.equal(judgeStrike({ ...strike, hand: n.hand === 'left' ? 'right' : 'left' }, pair.map(pending)), null);
        assert.equal(judgeStrike({ ...strike, songTime: n.time + 0.3 }, pair.map(pending)), null);
    }
});

test('direction tolerance is independent of headset refresh rate', () => {
    const n = { id: 'up', time: 5, lane: 0, row: 1, hand: 'left', cutDirection: 'up' };
    for (const hz of [60, 72, 90, 120, 144, 240]) {
        const dt = 1 / hz;
        const strike = speed => ({ songTime: 5, previousSongTime: 5 - dt, hand: 'left', speed: 1,
            position: { x: -0.45, y: 0, z: 0 }, previousPosition: { x: -0.45, y: -speed * dt, z: 0 } });
        assert.ok(judgeStrike(strike(0.6), [pending(n)]), `${hz} Hz`);
        assert.equal(judgeStrike(strike(0.1), [pending(n)]), null, `${hz} Hz`);
    }
});

test('instanced glyph rotation agrees with judge vectors and changing batches clears stale arrows', () => {
    const field = new RhythmNoteField();
    const notes = Object.keys(CUT_VECTORS).map((cutDirection, i) => pending({ id: String(i), time: 5, lane: 0, row: 1, hand: 'left', cutDirection }));
    field.update(notes, 5); assert.equal(field.arrows.count, 8); assert.equal(field.markers.count, 0);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < notes.length; i++) {
        noteMatrixAt(field, 'arrows', i, matrix); // the shader's placement (GPU travel)
        const v = new THREE.Vector3(0, 1, 0).transformDirection(matrix), expected = CUT_VECTORS[notes[i].note.cutDirection];
        assert.ok(Math.abs(v.x - expected[0]) < 1e-6 && Math.abs(v.y - expected[1]) < 1e-6);
    }
    field.update([pending({ ...notes[0].note, cutDirection: 'any' })], 5);
    assert.equal(field.arrows.count, 0); assert.equal(field.markers.count, 1); field.dispose();
});
