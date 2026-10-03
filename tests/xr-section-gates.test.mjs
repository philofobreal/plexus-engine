import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument } from './helpers/fake-dom.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const { gatesAt, XrSectionGates, MAX_VISIBLE_GATES, GATE_HALF_WIDTH, GATE_HALF_HEIGHT, GATE_LABEL_ROWS } = load('xr/scene/XrSectionGates.ts');
const { buildScoreOverview } = load('xr/scene/XrScoreOverview.ts');
const { XrSectionCallout } = load('xr/scene/XrSectionCallout.ts');
const { XrTrackPath } = load('xr/scene/XrTrackPath.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: config, LANE_HAND } = load('gameplay/index.ts');

const section = (start, end, label, weight = 1.4) => ({ start, end, label, weight, noteCount: 4 });
const overview = buildScoreOverview({ sections: [section(0, 10, 'intro'), section(10, 20, 'build'), section(20, 21, 'drop', 1.9),
    section(21, 30, 'break'), section(30, 40, 'outro')] }, 40);
const slots = () => Array.from({ length: MAX_VISIBLE_GATES }, () => ({ section: -1, z: 0, travelled: 0 }));

test('a gate spawns one approach time early, travels with the targets and docks exactly when its section starts', () => {
    const out = slots(), speed = config.noteSpeedMps, approach = config.approachTimeSec;
    assert.equal(gatesAt(overview, 5, speed, approach, out), 0, 'the first section has no gate; the next is still too far');
    assert.equal(gatesAt(overview, 10 - approach + 1e-6, speed, approach, out), 1);
    assert.equal(out[0].section, 1);
    assert.ok(Math.abs(out[0].z + approach * speed) < 1e-4, 'spawns at the far end of the approach');
    assert.ok(out[0].travelled < 1e-4);
    gatesAt(overview, 9.5, speed, approach, out);
    assert.ok(Math.abs(out[0].z + 0.5 * speed) < 1e-9, 'moves at note speed');
    assert.equal(gatesAt(overview, 10, speed, approach, out), 0, 'gone the moment its section starts (the callout takes over)');
    assert.equal(gatesAt(overview, 19.5, speed, approach, out), 2, 'close boundaries show at most two gates');
    assert.deepEqual(out.map(g => g.section), [2, 3]);
    assert.ok(out[0].z > out[1].z, 'nearest first');
    for (const bad of [[Number.NaN, speed, approach], [5, 0, approach], [5, speed, -1]]) assert.equal(gatesAt(overview, ...bad, out), 0);
});

test('a gate outline docks onto the start frame and stays clear of every lane and row', () => {
    const callout = new XrSectionCallout(doc), gates = new XrSectionGates(doc);
    callout.frame.geometry.computeBoundingBox(); gates.brackets.geometry.computeBoundingBox();
    const frame = callout.frame.geometry.boundingBox, gate = gates.brackets.geometry.boundingBox;
    // Geometry is stored as float32.
    assert.ok(Math.abs((frame.max.x - 0.004) - GATE_HALF_WIDTH) < 1e-6 && Math.abs((gate.max.x - 0.006) - GATE_HALF_WIDTH) < 1e-6, 'same corner lines');
    assert.ok(Math.abs((frame.min.y + 0.004) + GATE_HALF_HEIGHT) < 1e-6 && Math.abs((gate.min.y + 0.006) + GATE_HALF_HEIGHT) < 1e-6);
    const noteHalf = config.noteSizeMeters / 2;
    const widestLane = Math.max(...LANE_HAND.map(l => Math.abs(l.xOffsetMeters))) + noteHalf;
    const highestRow = config.rowSpacingMeters + noteHalf;
    assert.ok(GATE_HALF_WIDTH - 0.006 > widestLane + 0.15, 'no target can be hidden behind a bracket');
    assert.ok(GATE_HALF_HEIGHT - 0.006 > highestRow + 0.1);
    callout.dispose(); gates.dispose();
});

test('gates follow the track path, fade in like targets, hide their label near arrival and never redraw their atlas', () => {
    const gates = new XrSectionGates(doc), path = new XrTrackPath();
    gates.setOverview(overview);
    assert.equal(gates.atlasDrawCount, 1);
    assert.equal(gates.root.visible, true);
    path.setFocus(0.4, 0.3);
    gates.setSpawnFade(1.5);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), color = new THREE.Color();
    const sample = time => {
        gates.update(time, config, path);
        gates.brackets.getMatrixAt(0, matrix); matrix.decompose(position, new THREE.Quaternion(), scale);
        gates.brackets.getColorAt(0, color);
        return { position: position.clone(), scale: scale.x, brightness: color.r + color.g + color.b, label: gates.labels[0] };
    };
    const spawn = sample(10 - config.approachTimeSec + 0.01), mid = sample(8.5);
    assert.equal(gates.brackets.count, 1);
    assert.ok(spawn.scale < mid.scale && spawn.brightness < mid.brightness, 'emerges from the far end');
    const expected = path.projectPlayfieldPoint({ x: 0, y: 0, z: mid.position.z });
    assert.ok(Math.abs(mid.position.x - expected.x) < 1e-6 && Math.abs(mid.position.y - expected.y) < 1e-6, 'sheared with the track (float32 matrix)');
    assert.ok(mid.position.x > 0, 'the far track bends toward the focal point');
    assert.ok(mid.label.visible && mid.label.material.opacity > 0.9);
    assert.ok(Math.abs(mid.label.material.map.offset.y - (1 - 1 / GATE_LABEL_ROWS)) < 1e-12, 'first gated section, first atlas row');
    const close = sample(9.95);
    assert.ok(close.label.material.opacity < 0.2, 'the label fades before it reaches the start frame caption');
    assert.ok(Math.abs(close.position.x) < 1e-12, 'inside the straight zone it is exactly on axis');
    for (let i = 0; i < 100; i++) gates.update(9.95, config, path);
    assert.equal(gates.atlasDrawCount, 1, 'labels are never redrawn during play');
    gates.update(12, config, path);
    assert.equal(gates.brackets.count, 0); assert.ok(gates.labels.every(l => !l.visible));
    gates.setOverview(buildScoreOverview({ sections: [section(0, 5, 'intro')] }, 5));
    assert.equal(gates.root.visible, false, 'a single-section track has no gates');
    gates.dispose();
});

test('the scene drives gates from its overview, game config, path and stage fade', () => {
    const scene = new RhythmGameScene(new THREE.Scene());
    scene.setScoreOverview(overview);
    scene.setGameConfig({ ...config, noteSpeedMps: 7, approachTimeSec: 1.6 });
    const idle = { state: 'playing', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 };
    scene.update([], 9, idle, '');
    const matrix = new THREE.Matrix4(); scene.sectionGates.brackets.getMatrixAt(0, matrix);
    assert.ok(Math.abs(new THREE.Vector3().setFromMatrixPosition(matrix).z + 7) < 1e-6, 'one second out at 7 m/s');
    assert.ok(scene.playfield.children.includes(scene.sectionGates.root));
    scene.setScoreOverview(null);
    assert.equal(scene.sectionGates.root.visible, false);
    scene.dispose();
});
