import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument } from './helpers/fake-dom.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const overviewModule = load('xr/scene/XrScoreOverview.ts');
const { buildScoreOverview, overviewStateAt, createOverviewState, sectionOutcome, sectionAccuracy, formatPoints, SECTION_FLASH_SEC,
    NEUTRAL_SECTION_COLOR, FLAWLESS_COLOR } = overviewModule;
const { XrSongMap } = load('xr/scene/XrSongMap.ts');
const { XrProgressRing, RING_MAX_SECTIONS } = load('xr/scene/XrProgressRing.ts');
const { XrRunway } = load('xr/scene/XrRunway.ts');
const { SECTION_STYLE } = load('xr/scene/XrSectionCallout.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: config, RhythmGameSession, notePosition } = load('gameplay/index.ts');

const planSection = (start, end, label, weight = 1.2, noteCount = 4) => ({ start, end, label, weight, noteCount });
const result = (index, over = {}) => ({ index, hits: 0, perfects: 0, misses: 0, resolved: 0, points: 0, bonus: 0, completedAt: null, ...over });
const snapshot = (over = {}) => ({ state: 'playing', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0, ...over });

test('the overview numbers repeated sections, keeps the palette and falls back to a neutral track', () => {
    const overview = buildScoreOverview({ sections: [planSection(0, 10, 'intro'), planSection(10, 30, 'drop'), planSection(30, 40, 'break'),
        planSection(40, 60, 'drop')] }, 60);
    assert.deepEqual(overview.sections.map(s => s.title), ['INTRO', 'DROP 1', 'BREAKDOWN', 'DROP 2']);
    assert.equal(overview.sections[1].color, SECTION_STYLE.drop.color);
    const neutral = buildScoreOverview({ sections: [{ start: 0, end: 5, label: null, weight: 1, noteCount: 3 }] }, Number.NaN);
    assert.equal(neutral.sections[0].title, 'TRACK'); assert.equal(neutral.sections[0].color, NEUTRAL_SECTION_COLOR);
    assert.equal(neutral.durationSec, 5, 'an unknown duration falls back to the last section end');
});

test('state follows song time: current section, progress, flawless marker and a bounded completion flash', () => {
    const overview = buildScoreOverview({ sections: [planSection(0, 10, 'build', 1.2, 2), planSection(10, 20, 'drop', 1.8, 2)] }, 20);
    const results = [result(0, { hits: 2, perfects: 2, resolved: 2, points: 500, bonus: 120, completedAt: 9 }), result(1, { misses: 1, resolved: 1 })];
    const state = createOverviewState();
    overviewStateAt(overview, results, -1, state);
    assert.equal(state.current, -1); assert.equal(state.progress, 0);
    overviewStateAt(overview, results, 5, state);
    assert.equal(state.current, 0); assert.equal(state.progress, 0.25); assert.equal(state.flawless, true); assert.equal(state.hasFlash, false);
    overviewStateAt(overview, results, 10.5, state);
    assert.equal(state.current, 1); assert.equal(state.flawless, false, 'a miss breaks the current section');
    assert.equal(state.hasFlash, true); assert.equal(state.flash.kind, 'flawless'); assert.equal(state.flash.bonus, 120);
    overviewStateAt(overview, results, 9 + SECTION_FLASH_SEC, state);
    assert.equal(state.hasFlash, false, 'the flash ends');
    overviewStateAt(overview, undefined, 25, state);
    assert.equal(state.progress, 1); assert.equal(state.flawless, true, 'no results yet: nothing is broken');
    assert.equal(sectionOutcome(overview.sections[0], results[0]), 'flawless');
    assert.equal(sectionOutcome(overview.sections[1], results[1]), 'pending', 'incomplete');
    assert.equal(sectionOutcome(overview.sections[1], { ...results[1], resolved: 2, completedAt: 15 }), 'missed');
    assert.equal(sectionOutcome(overview.sections[0], { ...results[0], perfects: 1 }), 'clean');
    assert.equal(sectionAccuracy(overview.sections[0], { ...results[0], perfects: 1 }), 0.75);
    assert.equal(formatPoints(1234567), '1 234 567');
});

test('the song map draws its strips once, moves only transforms per frame and redraws its caption a bounded number of times', () => {
    const map = new XrSongMap(doc);
    assert.equal(map.root.visible, false);
    const overview = buildScoreOverview({ sections: [planSection(0, 10, 'build', 1.2, 1), planSection(10, 20, 'drop', 1.9, 1)] }, 20);
    map.setOverview(overview);
    assert.equal(map.root.visible, true);
    const stripVersion = map.strip.material.map.version;
    const results = [result(0), result(1)];
    for (let i = 0; i <= 20 * 72; i++) {
        const t = i / 72;
        if (t >= 9 && results[0].completedAt === null) Object.assign(results[0], { hits: 1, perfects: 1, resolved: 1, bonus: 90, completedAt: 9 });
        map.update(t, snapshot({ score: results[0].bonus, sections: results }));
    }
    assert.equal(map.strip.material.map.version, stripVersion, 'segments never redraw during play');
    assert.ok(Math.abs(map.played.scale.x - 1) < 1e-9);
    assert.ok(Math.abs(map.playhead.position.x - 0.8) < 1e-9, 'the playhead reaches the right end');
    assert.ok(map.redrawCount <= 2 + 5 + 2, `caption redraws stay bounded (${map.redrawCount})`);
    const before = map.redrawCount;
    for (let i = 0; i < 100; i++) map.update(20, snapshot({ score: 90, sections: results }));
    assert.equal(map.redrawCount, before, 'a steady pause does no work');
    map.setOverview(null); assert.equal(map.root.visible, false);
    map.dispose();
});

test('the progress ring packs sections into uniforms and tracks progress, multiplier and outcomes', () => {
    const ring = new XrProgressRing();
    assert.equal(ring.mesh.visible, false);
    const overview = buildScoreOverview({ sections: [planSection(0, 5, 'intro', 1, 2), planSection(5, 20, 'peak', 2, 2)] }, 20);
    ring.setOverview(overview);
    const u = ring.uniforms;
    assert.equal(ring.mesh.visible, true); assert.equal(u.uCount.value, 2);
    assert.deepEqual(u.uSections.value[1].toArray(), [0.25, 1, 0, 0]);
    assert.equal(u.uColors.value[1].getHex(), SECTION_STYLE.peak.color);
    ring.update(10, snapshot({ multiplier: 4, sections: [result(0, { hits: 2, perfects: 1, resolved: 2, completedAt: 4 }), result(1)] }));
    assert.equal(u.uProgress.value, 0.5); assert.equal(u.uTier.value, 2);
    assert.deepEqual(u.uSections.value[0].toArray().slice(2), [0.75, 2], 'clean section filled to its accuracy');
    ring.update(10, snapshot({ sections: [result(0, { hits: 2, perfects: 2, resolved: 2, completedAt: 4 }), result(1)] }));
    assert.equal(u.uSections.value[0].w, 3, 'flawless');
    assert.equal(u.uTier.value, 0, 'a snapshot without a multiplier reads 1x');
    assert.equal(u.uGold.value.getHex(), FLAWLESS_COLOR);
    const many = buildScoreOverview({ sections: Array.from({ length: 40 }, (_, i) => planSection(i, i + 1, 'verse')) }, 40);
    ring.setOverview(many);
    assert.equal(u.uCount.value, RING_MAX_SECTIONS);
    assert.equal(u.uSections.value[RING_MAX_SECTIONS - 1].y, 1, 'the last arc absorbs the overflow');
    ring.dispose();
});

test('the floor keeps only orientation ticks inside the ring area; the live ring owns the circles', () => {
    const runway = new XrRunway(config);
    const position = runway.linework.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
        const r = Math.hypot(position.getX(i), position.getZ(i));
        if (r < 0.6 && Math.abs(position.getY(i)) < 0.02) assert.ok(r >= 0.405, `no static arc left at r=${r.toFixed(3)}`);
    }
    runway.dispose();
});

test('a real session drives the overview: a clean section flashes its bonus on the song map and fills the ring', () => {
    const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
    const scene = new RhythmGameScene(new THREE.Scene());
    const chart = [{ id: 'a', time: 3, lane: 0, row: 1, hand: 'left', intensity: 1, sourceType: 1 }];
    const session = new RhythmGameSession();
    session.loadChart(chart, [{ start: 0, end: 6, label: 'drop' }, { start: 6, end: 10, label: 'outro' }]);
    scene.setScoreOverview(buildScoreOverview(session.getScoringPlan(), 10));
    session.start();
    session.attemptStrike({ songTime: 3, hand: 'left', position: notePosition(chart[0], 3, {}), speed: 1 });
    scene.update([], 3.2, session.getSnapshot(), '');
    assert.equal(scene.progressRing.uniforms.uSections.value[0].w, 3, 'flawless drop');
    assert.ok(scene.songMap.redrawCount >= 1);
    assert.ok(scene.root.children.includes(scene.progressRing.mesh));
    scene.setScoreOverview(null);
    assert.equal(scene.progressRing.mesh.visible, false);
    scene.dispose();
});
