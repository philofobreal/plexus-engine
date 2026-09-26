import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader({ three: THREE });
const { judgeStrike, notePosition, buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');
const { XrInputAdapter } = load('xr/runtime/XrInputAdapter.ts');
const note = (row = 1) => ({ note: { id: 'note', time: 5, lane: 0, row, hand: 'left', intensity: 0.8, sourceType: 1 }, status: 'pending', judgement: null });

test('moving note and render position agree in all rows, before/on/after beat', () => {
    for (const row of [0, 1, 2]) for (const time of [4.9, 5, 5.1]) {
        const n = note(row), position = notePosition(n.note, time, {});
        assert.ok(judgeStrike({ songTime: time, hand: 'left', position, speed: 1 }, [n]));
        const wrong = { ...position, y: position.y + config.rowSpacingMeters };
        assert.equal(judgeStrike({ songTime: time, hand: 'left', position: wrong, speed: 1 }, [note(row)]), null);
    }
    assert.ok(notePosition(note().note, 5.1, {}).z > 0);
});

test('fast sweep crosses target with both endpoints outside; mid-blade also hits', () => {
    assert.ok(judgeStrike({ songTime: 5.01, previousSongTime: 4.99, hand: 'left', speed: 20,
        position: { x: 0.05, y: 0, z: 0.04 }, previousPosition: { x: -0.95, y: 0, z: -0.04 } }, [note()]));
    assert.ok(judgeStrike({ songTime: 5, hand: 'left', speed: 1,
        position: { x: -0.45, y: 0, z: -0.5 }, basePosition: { x: -0.45, y: 0, z: 0.4 } }, [note()]));
    assert.equal(judgeStrike({ songTime: 5, hand: 'left', speed: 1,
        position: { x: NaN, y: 0, z: 0 } }, [note()]), null);
});

test('mapping respects semantic rows, side reach, hand recovery and travel budget', () => {
    const events = Array.from({ length: 240 }, (_, i) => ({ time: i * 0.27, intensity: 0.8, type: i % 3 + 1 }));
    const chart = buildRhythmChart({ events, durationSec: 70, beats: [] });
    assert.deepEqual(new Set(chart.map(n => n.row)), new Set([0, 1, 2]));
    const last = {};
    for (const n of chart) {
        assert.ok(n.hand === 'left' ? n.lane !== 2 : n.lane !== 0);
        assert.ok(!(n.row === 2 && n.lane === 1));
        if (last[n.hand]) {
            const p = last[n.hand], dt = n.time - p.time;
            assert.ok(dt >= config.minSameHandSpacingSec);
            const a = notePosition(n, n.time, {}), b = notePosition(p, p.time, {});
            assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= dt * config.maxHandTravelMps + 1e-9);
        }
        last[n.hand] = n;
    }
});

function controllers() {
    const grips = [new THREE.Group(), new THREE.Group()];
    const rays = [new THREE.Group(), new THREE.Group()];
    const scene = new THREE.Scene();
    const adapter = new XrInputAdapter({ xr: { getControllerGrip: i => grips[i], getController: i => rays[i] } }, scene);
    rays[1].dispatchEvent({ type: 'connected', data: { handedness: 'left' } });
    return { adapter, grips, rays, scene };
}

test('controller samples blade tip, handles rotation, gaps, lost tracking and re-entry without phantom strikes', () => {
    const { adapter, grips, rays } = controllers();
    const inverse = new THREE.Matrix4();
    adapter.update(1 / 72, 1); assert.equal(adapter.getStrikeAttempt('left', 1, inverse), null);
    grips[1].rotation.y = 0.2;
    adapter.update(1 / 72, 1.014);
    const a = adapter.getStrikeAttempt('left', 1.014, inverse);
    assert.ok(a.speed > 1); assert.ok(Math.abs(a.position.z) > 0.9);
    assert.equal(adapter.getStrikeAttempt('right', 1.014, inverse), null);
    adapter.update(0.5, 1.5); assert.equal(adapter.getStrikeAttempt('left', 1.5, inverse), null);
    adapter.update(1 / 72, 1.514); assert.equal(adapter.getStrikeAttempt('left', 1.514, inverse), null);
    adapter.update(1 / 72, 1.528, false); assert.equal(adapter.getStrikeAttempt('left', 1.528, inverse), null);
    adapter.resetMotion(); adapter.update(1 / 72, 2); assert.equal(adapter.getStrikeAttempt('left', 2, inverse), null);
    rays[1].dispatchEvent({ type: 'disconnected' }); assert.equal(adapter.getStrikeAttempt('left', 2, inverse), null);
    adapter.dispose();
});

test('input listeners are removed and grip meshes detached on dispose', () => {
    const { adapter, rays, grips } = controllers();
    let calls = 0; adapter.onTriggerPress = () => calls++;
    rays[1].dispatchEvent({ type: 'selectstart' }); assert.equal(calls, 1);
    adapter.dispose(); rays[1].dispatchEvent({ type: 'selectstart' }); assert.equal(calls, 1);
    assert.equal(grips[1].children.length, 0);
});

test('desktop clicks use the same moving target, timing, handedness and one-shot scoring', () => {
    const { desktopStrikeForRay } = load('xr/DesktopInputAdapter.ts');
    const { RhythmGameSession } = load('gameplay/index.ts');
    const game = new RhythmGameSession(); game.loadChart([note().note]); game.start();
    const position = notePosition(note().note, 5, new THREE.Vector3());
    const origin = new THREE.Vector3(0, 0.5, 3.5);
    const ray = new THREE.Ray(origin, position.clone().sub(origin).normalize());
    const active = game.getActiveNotes(5);
    assert.equal(game.attemptStrike(desktopStrikeForRay(ray, active, 5, 'right')), null);
    assert.ok(game.attemptStrike(desktopStrikeForRay(ray, active, 5, 'left')));
    assert.equal(game.getSnapshot().score, 100);
    assert.equal(desktopStrikeForRay(ray, game.getActiveNotes(5), 5, 'left'), null);
    assert.equal(desktopStrikeForRay(new THREE.Ray(origin, new THREE.Vector3(0, 1, 0)), [note()], 5, 'left'), null);
    const early = new RhythmGameSession(); early.loadChart([note().note]); early.start();
    const earlyPoint = notePosition(note().note, 4.7, new THREE.Vector3());
    const earlyRay = new THREE.Ray(origin, earlyPoint.sub(origin).normalize());
    const tooEarly = desktopStrikeForRay(earlyRay, early.getActiveNotes(4.7), 4.7, 'left');
    assert.ok(tooEarly); assert.equal(early.attemptStrike(tooEarly), null);
});

test('desktop input normalizes left/right clicks, prevents canvas menus, and cleans up Space listener', () => {
    const browserWindow = new EventTarget();
    const canvas = new EventTarget();
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
    const { DesktopInputAdapter } = createLoader({ three: THREE }, { window: browserWindow })('xr/DesktopInputAdapter.ts');
    const input = new DesktopInputAdapter(canvas);
    const clicks = []; let toggles = 0;
    input.onStrike = (...args) => clicks.push(args);
    input.onTogglePlayback = () => toggles++;
    for (const button of [0, 2]) {
        const event = new Event('pointerdown', { cancelable: true });
        Object.assign(event, { button, clientX: 410, clientY: 320 });
        canvas.dispatchEvent(event); assert.ok(event.defaultPrevented);
    }
    assert.equal(clicks[0][0], 'left'); assert.equal(clicks[1][0], 'right');
    assert.equal(Math.abs(clicks[0][1]), 0); assert.equal(Math.abs(clicks[0][2]), 0);
    const key = new Event('keydown', { cancelable: true });
    Object.assign(key, { code: 'Space', repeat: false });
    browserWindow.closest = () => null;
    browserWindow.dispatchEvent(key); assert.equal(toggles, 1);
    const menu = new Event('contextmenu', { cancelable: true }); canvas.dispatchEvent(menu); assert.ok(menu.defaultPrevented);
    input.dispose(); browserWindow.dispatchEvent(key); assert.equal(toggles, 1);
});

test('scene calibration includes viewer translation/yaw and re-entry; stage crosses player and notes keep scale', () => {
    const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: text => ({ width: text.length * 12 }) };
    const sceneLoader = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
    const { RhythmGameScene } = sceneLoader('xr/scene/RhythmGameScene.ts');
    const world = new THREE.Scene(); const scene = new RhythmGameScene(world);
    scene.placeForViewer(3, 1.65, 4, Math.PI / 2);
    const point = new THREE.Vector3(-0.45, 0.34, 0).applyMatrix4(scene.playfield.matrixWorld);
    point.applyMatrix4(scene.getWorldToPlayfield(new THREE.Matrix4()));
    assert.ok(point.distanceTo(new THREE.Vector3(-0.45, 0.34, 0)) < 1e-9);
    assert.equal(scene.noteField.mesh.geometry.parameters.width, 0.32);
    const runway = scene.root.getObjectByName('runway');
    const floorMatrix = new THREE.Matrix4(); runway.getMatrixAt(0, floorMatrix);
    const floorBounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)).applyMatrix4(floorMatrix);
    assert.equal(floorBounds.min.z, -10); assert.equal(floorBounds.max.z, 2);
    assert.ok(Math.abs(floorBounds.max.x - floorBounds.min.x - 3.4) < 1e-6);
    scene.placeForViewer(-2, 1.4, 1, 0);
    assert.equal(scene.root.position.x, -2); assert.ok(Math.abs(scene.playfield.position.y - 0.85) < 1e-9);
    assert.equal(scene.root.rotation.y, 0);
    scene.dispose(); assert.equal(world.children.length, 0);
});
