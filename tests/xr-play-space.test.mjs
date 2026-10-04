import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';
import { fakeDocument } from './helpers/fake-dom.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const { buildRhythmChart, notePosition, CUT_VECTORS, DEFAULT_RHYTHM_GAME_CONFIG: config, DIFFICULTIES, HAND_PATTERNS, HAND_ZONES,
    playSpaceConfig, TALL_ROW_SPACING_METERS, OVERHEAD_ROW, LANE_HAND } = load('gameplay/index.ts');
const { difficultyProfile } = load('gameplay/RhythmGenerationProfile.ts');
const { overheadMoveRows, OVERHEAD_PREP_SEC, OVERHEAD_REST_SEC, LONG_REST_SEC } = load('gameplay/RhythmOverheadPolicy.ts');
const { resolvePlayProfile, saberReachMeters, PLAY_SPACE_STAGE, NOTE_SPEED_PRESETS, XR_SABER_LENGTHS } = load('xr/XrPlayProfile.ts');
const { SCENE_CONFIG, DEFAULT_STAGE_LAYOUT } = load('xr/scene/SceneConfig.ts');
const { RhythmGameScene, SIDE_HUD_POSE } = load('xr/scene/RhythmGameScene.ts');
const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope, resolveGameConfig, resolvePlayFromSettings } = load('xr/XrSettings.ts');

const sources = chartSources();
const golden = JSON.parse(readFileSync('tests/fixtures/xr-chart-default-golden.json', 'utf8'));
const sha = chart => createHash('sha256').update(JSON.stringify(chart)).digest('hex');
const tall = playSpaceConfig(config, 'tall');
const xOf = n => n.xOffsetMeters ?? LANE_HAND[n.lane].xOffsetMeters;
/** Drop / peak scenes and a build above 0.65 energy, from the source's automation points. */
const bigSceneAt = (source, time) => {
    const point = (source.performancePlan?.points ?? []).filter(p => p.time <= time).at(-1);
    const situation = point?.meta?.automationSituation;
    return ['drop-short', 'drop-long', 'drop-after-build', 'peak-sustain'].includes(situation)
        || (situation === 'buildup-ramp' && (point.meta.behaviour?.energy ?? 0) > 0.65);
};
const combos = DIFFICULTIES.flatMap(difficulty => ['macro', 'balanced', 'active'].flatMap(activity => HAND_ZONES.map((zones, z) =>
    ({ difficulty, activity, zones, handPattern: HAND_PATTERNS[z], playSpace: 'tall' }))));

test('Standard is the historical chart byte for byte; Tall only widens the row spacing of the configuration', () => {
    for (const [name, source] of Object.entries(sources)) {
        assert.equal(sha(buildRhythmChart(source, config, { playSpace: 'standard' })), golden[name].sha256, name);
        assert.equal(buildRhythmChart(source, config).some(n => n.row === OVERHEAD_ROW), false);
    }
    assert.equal(playSpaceConfig(config, 'standard'), config, 'identity, not a copy');
    assert.equal(tall.rowSpacingMeters, TALL_ROW_SPACING_METERS);
    assert.deepEqual({ ...tall, rowSpacingMeters: config.rowSpacingMeters }, { ...config });
});

test('Tall charts keep every timing, spacing, parity and reach invariant, and the overhead row follows its rules', () => {
    let overheads = 0, twoHand = 0;
    for (const [name, source] of Object.entries(sources)) {
        const onsets = new Set(source.events.map(e => e.time));
        for (const settings of combos) {
            const label = `${name} ${JSON.stringify(settings)}`;
            const chart = buildRhythmChart(source, config, settings);
            assert.equal(JSON.stringify(chart), JSON.stringify(buildRhythmChart(source, config, { ...settings })), `${label}: deterministic`);
            const standard = buildRhythmChart(source, tall, { ...settings, playSpace: 'standard' });
            const demand = difficultyProfile(settings.difficulty);
            const minSame = config.minSameHandSpacingSec * demand.sameHandSpacingScale;
            const travel = config.maxHandTravelMps * demand.travelScale;
            // Re-voicing: the Tall chart is the same plan (at the Tall spacing) with rows lifted and a few rests made.
            const byId = new Map(standard.map(n => [n.id, n]));
            assert.ok(chart.length <= standard.length && standard.length - chart.length <= 2 * chart.filter(n => n.row === OVERHEAD_ROW).length, label);
            const last = {};
            for (const n of chart) {
                assert.ok(onsets.has(n.time), label);
                const original = byId.get(n.id);
                assert.ok(original, `${label}: no invented target`);
                assert.deepEqual({ ...n, row: original.row }, { ...original }, `${label}: only the row may change`);
                assert.ok([0, 1, 2, OVERHEAD_ROW].includes(n.row));
                if (n.row === OVERHEAD_ROW) {
                    overheads++;
                    assert.notEqual(original.row, OVERHEAD_ROW);
                    assert.ok(xOf(n) !== 0, `${label}: the incoming view stays clear`);
                    assert.ok(['down', 'down-left', 'down-right', 'any'].includes(n.cutDirection), `${label}: an overhead chop`);
                    assert.ok(bigSceneAt(source, n.time), `${label}: only big moments (${n.time})`);
                    if (n.pairId) {
                        const partner = chart.find(o => o.pairId === n.pairId && o !== n);
                        if (partner.row === OVERHEAD_ROW) {
                            twoHand++;
                            assert.ok(demand.strictSequences && n.pairLayout === 'horizontal', `${label}: two hands overhead only on Hard+ accents`);
                        }
                    }
                }
                const p = last[n.hand];
                if (p) {
                    const dt = n.time - p.time;
                    assert.ok(dt >= minSame - 1e-8, `${label}: same-hand spacing`);
                    if (p.cutDirection !== 'any' && n.cutDirection !== 'any' && dt < 1.5) {
                        const u = CUT_VECTORS[p.cutDirection], v = CUT_VECTORS[n.cutDirection];
                        assert.ok(u[0] * v[0] + u[1] * v[1] <= 0.1, `${label}: cut parity`);
                    }
                    let rows = Math.abs(n.row - p.row);
                    if (n.row === OVERHEAD_ROW) {
                        rows = overheadMoveRows(p, n, true);
                        assert.ok(dt >= Math.max(OVERHEAD_PREP_SEC, minSame) - 1e-9, `${label}: preparation before an overhead target`);
                        assert.ok(rows <= demand.maxRowStep || dt >= LONG_REST_SEC, `${label}: row step into the overhead row`);
                    } else if (p.row === OVERHEAD_ROW) {
                        rows = overheadMoveRows(n, p, false);
                        assert.ok(dt >= Math.max(OVERHEAD_REST_SEC, minSame) - 1e-9, `${label}: mandatory rest after an overhead target (${dt})`);
                        assert.ok(rows <= demand.maxRowStep || dt >= LONG_REST_SEC, `${label}: row step out of the overhead row`);
                    }
                    assert.ok(Math.hypot(xOf(n) - xOf(p), rows * TALL_ROW_SPACING_METERS) <= dt * travel + 1e-8, `${label}: reach`);
                }
                last[n.hand] = n;
            }
        }
    }
    assert.ok(overheads > 50, `the overhead row is used (${overheads})`);
    assert.ok(twoHand > 0, 'big Hard+ accents raise both hands');
});

test('the overhead row is rare and musical: big sections only, one bar apart, two bars per hand', () => {
    const source = sources['journey-128-confident'], beat = 60 / 128;
    const chart = buildRhythmChart(source, config, { playSpace: 'tall' });
    const overhead = chart.filter(n => n.row === OVERHEAD_ROW);
    assert.ok(overhead.length >= 3 && overhead.length <= 12, `Normal: a handful per 96 s (${overhead.length})`);
    for (const n of overhead) assert.ok((n.time >= 36 && n.time < 64) || n.time >= 86, `inside the build top, drop or peak (${n.time})`);
    const moments = [...new Set(overhead.map(n => n.time))];
    for (let i = 1; i < moments.length; i++) assert.ok(moments[i] - moments[i - 1] >= 4 * beat - 1e-6, 'one bar apart');
    for (const hand of ['left', 'right']) {
        const times = overhead.filter(n => n.hand === hand).map(n => n.time);
        for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 8 * beat - 1e-6, `${hand}: two bars apart`);
    }
});

test('the Tall profile widens the rows, puts the overhead row a quarter meter above the eyes and keeps everything judged', () => {
    const profile = resolvePlayProfile({}, 'tall');
    assert.equal(profile.config.rowSpacingMeters, TALL_ROW_SPACING_METERS);
    assert.equal(profile.playSpace, 'tall');
    assert.equal(resolvePlayProfile({}, 'tall'), profile, 'memoized');
    assert.equal(resolvePlayProfile({}, 'arena'), resolvePlayProfile(), 'unknown space -> Standard');
    assert.equal(resolvePlayProfile().config.rowSpacingMeters, config.rowSpacingMeters);
    const overhead = notePosition({ row: OVERHEAD_ROW, lane: 0 }, 0, {}, profile.config).y;
    assert.ok(Math.abs(overhead - SCENE_CONFIG.hitHeightBelowEyesMeters - 0.25) < 1e-9, 'overhead row = eye + 0.25 m');
    for (const space of ['standard', 'tall']) {
        const stage = resolvePlayProfile({}, space).stage, spacing = resolvePlayProfile({}, space).config.rowSpacingMeters;
        const bottom = stage.frameCenterYMeters - stage.frameHalfHeightMeters, top = stage.frameCenterYMeters + stage.frameHalfHeightMeters;
        assert.ok(Math.abs(-spacing - bottom - 0.26) < 1e-9 && Math.abs(top - (stage.rowCount - 2) * spacing - 0.26) < 1e-9,
            `${space}: the frame keeps the standard margin around its rows`);
    }
    assert.deepEqual({ ...resolvePlayProfile().stage, playfieldForwardMeters: 0, runwayFrontZMeters: 0, spawnFadeMeters: 0 },
        { ...DEFAULT_STAGE_LAYOUT, playfieldForwardMeters: 0, runwayFrontZMeters: 0, spawnFadeMeters: 0 }, 'Standard frame is the historical one');
    assert.equal(resolvePlayProfile({ saberLength: 'auto' }).bladeLengthMeters, 1);
    assert.equal(resolvePlayProfile({ saberLength: 'auto' }, 'tall').bladeLengthMeters, 1.1);
    assert.equal(resolvePlayProfile({ saberLength: 'short' }, 'tall').bladeLengthMeters, 0.9, 'explicit lengths are kept');
    for (const noteSpeed of Object.keys(NOTE_SPEED_PRESETS)) for (const saberLength of XR_SABER_LENGTHS) {
        const { config: c, stage, bladeLengthMeters } = resolvePlayProfile({ noteSpeed, saberLength }, 'tall');
        const touch = saberReachMeters(bladeLengthMeters) + c.noteSizeMeters / 2;
        assert.ok(touch <= stage.playfieldForwardMeters + c.earlyGoodWindowSec * c.noteSpeedMps + 1e-9, `${noteSpeed}/${saberLength}: no unsensed zone`);
    }
});

test('Play space is a chart-scope Gameplay setting; Auto follows it', () => {
    const descriptor = XR_SETTINGS.find(d => d.id === 'playSpace');
    assert.equal(descriptor.section, 'gameplay'); assert.equal(descriptor.scope, 'chart');
    assert.equal(descriptor.choices.map(c => c.value).join(), 'standard,tall');
    assert.equal(descriptor.read(DEFAULT_XR_SETTINGS), 'tall', 'the /xr/ player default (ADR-009 Addendum T)');
    const standardSettings = descriptor.write(DEFAULT_XR_SETTINGS, 'standard');
    assert.equal(resolvePlayFromSettings(standardSettings).stage.rowCount, 3);
    const tallSettings = descriptor.write(standardSettings, 'tall');
    assert.equal(changeScope(standardSettings, tallSettings), 'chart');
    assert.equal(resolveGameConfig(tallSettings).rowSpacingMeters, TALL_ROW_SPACING_METERS);
    assert.equal(resolvePlayFromSettings(tallSettings).stage.rowCount, 4);
    assert.equal(descriptor.write(standardSettings, 'huge').generation.playSpace, 'tall', 'invalid -> the /xr/ default');
    const saber = XR_SETTINGS.find(d => d.id === 'saberLength');
    const auto = saber.write(tallSettings, 'auto');
    assert.equal(resolvePlayFromSettings(auto).bladeLengthMeters, 1.1);
});

test('the scene grows the start frame, moves the callout, gates and song map with it and puts the HUD beside the runway', () => {
    const scene = new RhythmGameScene(new THREE.Scene());
    const standard = resolvePlayProfile(), tallProfile = resolvePlayProfile({}, 'tall');
    const box = mesh => { mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox; };
    scene.setGameConfig(standard.config); scene.setStageLayout(standard.stage);
    const standardGate = box(scene.runway.gate).clone(), hudStandard = scene.hud.mesh.position.clone();
    const songMapStandard = scene.songMap.root.position.y;
    assert.ok(Math.abs(songMapStandard + 0.71) < 1e-9, 'the historical song map height');
    scene.setGameConfig(tallProfile.config); scene.setStageLayout(tallProfile.stage);
    const stage = tallProfile.stage, top = stage.frameCenterYMeters + stage.frameHalfHeightMeters;
    const gate = box(scene.runway.gate);
    assert.ok(Math.abs(gate.max.y - (top + 0.007)) < 1e-6 && gate.max.y > standardGate.max.y + 0.4, 'the hit gate grows upward');
    assert.ok(Math.abs(gate.min.y - standardGate.min.y + 0.06) < 1e-6, 'and slightly downward');
    assert.ok(Math.abs(scene.sectionCallout.root.position.y - stage.frameCenterYMeters) < 1e-12);
    const frame = box(scene.sectionCallout.frame);
    assert.ok(Math.abs(frame.max.y - (stage.frameHalfHeightMeters + 0.039)) < 1e-6, 'callout outline around the taller frame');
    assert.ok(Math.abs(scene.sectionGates.halfHeightMeters - (stage.frameHalfHeightMeters + 0.035)) < 1e-12, 'gates dock onto it');
    const noteHalf = config.noteSizeMeters / 2, overheadTop = 2 * TALL_ROW_SPACING_METERS + noteHalf;
    assert.ok(stage.frameCenterYMeters + scene.sectionGates.halfHeightMeters - 0.006 > overheadTop + 0.1, 'gates never hide the overhead row');
    assert.ok(Math.abs(scene.songMap.root.position.y - (stage.frameCenterYMeters - stage.frameHalfHeightMeters - 0.11)) < 1e-12);
    const hud = scene.hud.mesh;
    assert.ok(Math.abs(hud.position.x - SIDE_HUD_POSE.x) < 1e-12 && hud.position.x < -1.4, 'HUD beside the runway');
    assert.ok(hud.rotation.y > 0 && hud.scale.x < 1, 'turned toward the player');
    assert.ok(Math.abs(hud.position.x) - 0.625 * hud.scale.x > 0.835 + 0.1, 'clear of the gates and every lane');
    scene.setGameConfig(standard.config); scene.setStageLayout(standard.stage);
    assert.deepEqual(scene.hud.mesh.position.toArray(), hudStandard.toArray(), 'back above the runway');
    assert.equal(scene.hud.mesh.rotation.y, 0);
    assert.deepEqual(box(scene.runway.gate).max.toArray(), standardGate.max.toArray());
    assert.ok(Math.abs(scene.songMap.root.position.y - songMapStandard) < 1e-12);
    scene.dispose();
});
