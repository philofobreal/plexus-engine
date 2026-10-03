import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }) };
const load = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
const { resolvePlayProfile, saberReachMeters, REACH_MODEL, NOTE_SPEED_PRESETS, SABER_BLADE_LENGTHS } = load('xr/XrPlayProfile.ts');
const { SCENE_CONFIG, DEFAULT_STAGE_LAYOUT } = load('xr/scene/SceneConfig.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { XrInputAdapter } = load('xr/runtime/XrInputAdapter.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: base, judgeStrike, notePosition } = load('gameplay/index.ts');
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
/** Normal speed with the Normal saber (the /xr/ defaults are Hyper / Long since ADR-009 Addendum T). */
const NORMAL = { noteSpeed: 'normal', saberLength: 'normal' };

test('the Normal profile moves the start frame to 1.2 m, widens only the early window and lengthens the runway', () => {
    const profile = resolvePlayProfile(NORMAL);
    assert.equal(profile.bladeLengthMeters, 1);
    assert.ok(close(profile.reachMeters, 1.74));
    assert.ok(close(profile.stage.playfieldForwardMeters, 1.2));
    assert.ok(close(profile.config.earlyGoodWindowSec, 0.175));
    assert.equal(profile.config.goodWindowSec, base.goodWindowSec, 'the late window is unchanged');
    assert.equal(profile.config.perfectWindowSec, base.perfectWindowSec);
    assert.equal(profile.stage.runwayFrontZMeters, -12);
    const fast = resolvePlayProfile({ ...NORMAL, noteSpeed: 'fast' }), hyper = resolvePlayProfile({ ...NORMAL, noteSpeed: 'hyper' });
    assert.ok(close(fast.stage.playfieldForwardMeters, 1.13)); assert.ok(close(fast.config.earlyGoodWindowSec, base.goodWindowSec));
    assert.equal(fast.stage.runwayFrontZMeters, -16);
    assert.equal(hyper.stage.playfieldForwardMeters, REACH_MODEL.minHitPlaneMeters); assert.equal(hyper.stage.runwayFrontZMeters, -18);
    assert.ok(close(resolvePlayProfile({ ...NORMAL, saberLength: 'short' }).config.earlyGoodWindowSec, 0.15));
    assert.equal(resolvePlayProfile({ ...NORMAL, noteSpeed: 'fast' }), fast, 'memoized: equal settings, identical profile');
    assert.equal(resolvePlayProfile({ noteSpeed: 'warp', saberLength: 7 }), resolvePlayProfile(), 'hostile input -> defaults');
    const defaults = resolvePlayProfile();
    assert.equal(defaults.settings.noteSpeed, 'hyper');
    assert.equal(defaults.bladeLengthMeters, 1.1, 'the /xr/ defaults: Hyper with the Long saber');
});

test('for every speed and saber, everything the saber can touch is judged, inside the straight track zone, on a whole-tile runway', () => {
    for (const noteSpeed of Object.keys(NOTE_SPEED_PRESETS)) for (const saberLength of Object.keys(SABER_BLADE_LENGTHS)) {
        const { config, stage, bladeLengthMeters } = resolvePlayProfile({ noteSpeed, saberLength });
        const label = `${noteSpeed}/${saberLength}`;
        const touch = saberReachMeters(bladeLengthMeters) + config.noteSizeMeters / 2;
        const judgedFrom = stage.playfieldForwardMeters + config.earlyGoodWindowSec * config.noteSpeedMps;
        assert.ok(touch <= judgedFrom + 1e-9, `${label}: no touched-but-not-sensed zone (${touch} > ${judgedFrom})`);
        assert.ok(stage.playfieldForwardMeters >= REACH_MODEL.minHitPlaneMeters - 1e-9 && stage.playfieldForwardMeters <= REACH_MODEL.maxHitPlaneMeters + 1e-9, label);
        assert.ok(config.earlyGoodWindowSec >= config.goodWindowSec, label);
        assert.ok(judgedFrom <= SCENE_CONFIG.trackBendStartMeters, `${label}: every judged target is on the straight track`);
        const runway = -stage.runwayFrontZMeters, spawn = stage.playfieldForwardMeters + config.noteSpeedMps * config.approachTimeSec;
        assert.ok(spawn < runway, `${label}: targets spawn on the runway`);
        assert.ok(runway <= REACH_MODEL.maxRunwayLengthMeters, label);
        assert.ok(close(((runway + SCENE_CONFIG.runwayBackZMeters) / SCENE_CONFIG.runwayTileLengthMeters) % 1, 0), `${label}: whole floor tiles`);
    }
});

test('the judge accepts the widened early window only before the note; late strikes keep the historical bound', () => {
    const { config } = resolvePlayProfile(NORMAL);
    const entry = () => ({ note: { id: 'n', time: 5, lane: 0, row: 1, hand: 'left', intensity: 1, sourceType: 1, cutDirection: 'any' }, status: 'pending', judgement: null });
    const strike = (time, cfg) => {
        const position = notePosition(entry().note, time, {}, cfg);
        return judgeStrike({ songTime: time, hand: 'left', position, speed: 1 }, [entry()], cfg);
    };
    assert.equal(strike(4.85, base), null, 'historical config: 0.15 s early is not sensed');
    assert.equal(strike(4.85, config)?.grade, 'good', 'profile: the reachable early zone is judged');
    assert.equal(strike(4.8, config), null, 'beyond the early window');
    assert.equal(strike(5.12, config), null, 'late bound unchanged');
    assert.equal(strike(5.05, config)?.grade, 'perfect');
});

test('a new stage moves the start frame, rebuilds the runway to its length and re-aims the path; default scenes stay historical', () => {
    const scene = new RhythmGameScene(new THREE.Scene());
    assert.equal(scene.stageLayout, DEFAULT_STAGE_LAYOUT);
    assert.equal(scene.playfield.position.z, -SCENE_CONFIG.playfieldForwardMeters);
    scene.placeForViewer(0.4, 1.7, -0.2, 0.3);
    const profile = resolvePlayProfile({ noteSpeed: 'hyper' });
    const oldRunway = scene.runway;
    scene.setGameConfig(profile.config);
    scene.setStageLayout(profile.stage);
    assert.notEqual(scene.runway, oldRunway);
    assert.equal(scene.playfield.position.z, -profile.stage.playfieldForwardMeters);
    assert.ok(close(scene.root.position.x, 0.4) && close(scene.root.rotation.y, 0.3), 'viewer placement is kept');
    scene.runway.floor.geometry.computeBoundingBox();
    assert.equal(scene.runway.floor.geometry.boundingBox.min.z, profile.stage.runwayFrontZMeters);
    assert.ok(scene.root.children.includes(scene.runway.floor) && !scene.root.children.includes(oldRunway.floor));
    scene.path.setFocus(0.3, 0.2);
    // Every judged target stays exactly in place; the far end bends toward the focal point.
    const judged = profile.stage.playfieldForwardMeters + profile.config.earlyGoodWindowSec * profile.config.noteSpeedMps;
    for (let z = 0; z >= profile.stage.playfieldForwardMeters - judged; z -= 0.05) {
        assert.deepEqual(scene.path.projectPlayfieldPoint({ x: 0.45, y: 0, z }), { x: 0.45, y: 0, z });
    }
    const far = scene.path.projectPlayfieldPoint({ x: 0, y: 0, z: profile.stage.runwayFrontZMeters + profile.stage.playfieldForwardMeters });
    assert.ok(far.x > 0 && far.y > 0);
    scene.dispose();
});

test('targets emerge from the far end only when the stage asks for it', () => {
    const scene = new RhythmGameScene(new THREE.Scene());
    const { config, stage } = resolvePlayProfile();
    scene.setGameConfig(config);
    const notes = [{ note: { id: 'a', time: 10, lane: 0, row: 1, hand: 'left', intensity: 1, sourceType: 1, cutDirection: 'any' }, status: 'pending', judgement: null }];
    const color = new THREE.Color(), matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
    const sample = time => {
        scene.noteField.update(notes, time, config, scene.path);
        scene.noteField.mesh.getColorAt(0, color); scene.noteField.mesh.getMatrixAt(0, matrix);
        matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
        return { r: color.r, s: scale.x };
    };
    const spawnTime = 10 - config.approachTimeSec;
    const legacy = sample(spawnTime);
    assert.ok(close(legacy.s, 1), 'historical stage: full size at spawn');
    scene.setStageLayout(stage);
    const atSpawn = sample(spawnTime), halfway = sample(spawnTime + stage.spawnFadeMeters / 2 / config.noteSpeedMps), arrived = sample(9);
    assert.ok(atSpawn.s < halfway.s && halfway.s < arrived.s && close(arrived.s, 1));
    assert.ok(atSpawn.r < halfway.r && halfway.r < arrived.r && close(arrived.r, legacy.r, 1e-6));
    scene.dispose();
});

test('the saber blade length changes the drawn blade and the judged tip together', () => {
    const grips = [new THREE.Group(), new THREE.Group()], rays = [new THREE.Group(), new THREE.Group()];
    const adapter = new XrInputAdapter({ xr: { getControllerGrip: i => grips[i], getController: i => rays[i] } }, new THREE.Scene());
    rays[1].dispatchEvent({ type: 'connected', data: { handedness: 'left' } });
    const tipDistance = () => {
        const inverse = new THREE.Matrix4();
        grips[1].rotation.y = 0; grips[1].updateMatrixWorld(true);
        adapter.update(1 / 72, 1);
        grips[1].rotation.y = 0.2; grips[1].updateMatrixWorld(true);
        adapter.update(1 / 72, 1.014);
        const attempt = adapter.getStrikeAttempt('left', 1.014, inverse);
        return Math.hypot(attempt.position.x, attempt.position.y, attempt.position.z);
    };
    assert.ok(close(tipDistance(), 1.0, 1e-6), 'historical 0.9 m blade: tip at 1.0 m from the grip');
    adapter.setBladeLength(1.1);
    assert.ok(close(tipDistance(), 1.2, 1e-6));
    const blade = grips[1].children[0].children[0];
    assert.ok(close(blade.scale.y, 1.1 / 0.9)); assert.ok(close(blade.position.z, (-0.1 - 1.2) / 2));
    adapter.dispose();
});
