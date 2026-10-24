import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { glslTrackOffset } from './helpers/xr-track-bend.mjs';

const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: text => ({ width: text.length * 12 }) };
const load = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
const { XrNoteHalos, HALO_CAPACITY, HALO_BURST_SEC } = load('xr/scene/XrNoteHalos.ts');
const { XrTrackPath, TRACK_BEND_GLSL } = load('xr/scene/XrTrackPath.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { buildHaloPreviewPlan } = load('xr/XrHaloPreview.ts');
const { RhythmGameSession, buildRhythmNoteRolePlan, DEFAULT_RHYTHM_GAME_CONFIG: config, notePosition } = load('gameplay/index.ts');
const note = (i, extra = {}) => ({ id: `n${i}`, time: 5 + i, lane: i % 3, row: i % 4,
    hand: ['left', 'either', 'right'][i % 3], intensity: .8, sourceType: 1, ...extra });
const pending = n => ({ note: n, status: 'pending', judgement: null });
const plan = notes => buildRhythmNoteRolePlan(notes, notes.map(n => ({ noteId: n.id, role: 'signal' })));
const values = (halos, name, i = 0) => Array.from(halos.mesh.geometry.getAttribute(name).array.subarray(i * 4, (i + 1) * 4));
const same = value => JSON.parse(JSON.stringify(value));

test('halo preview marks existing phrase starts deterministically without assigning new music or changing notes', () => {
    const notes = [note(0, { phrase: 0 }), note(1, { phrase: 0 }), note(2, { phrase: 1 }), note(3), note(4, { phrase: 2 })];
    const before = JSON.stringify(notes);
    assert.deepEqual(same(buildHaloPreviewPlan(notes).roles), [0, 2, 4].map(i => ({ noteId: `n${i}`, role: 'signal' })));
    assert.equal(JSON.stringify(buildHaloPreviewPlan(notes)), JSON.stringify(buildHaloPreviewPlan(notes)));
    assert.equal(JSON.stringify(notes), before);
    assert.equal(buildHaloPreviewPlan([note(0)]).roles.length, 0, 'no invented phrase fallback');
    const dense = [note(0, { phrase: 0, time: 1 }), note(1, { phrase: 1, time: 1.2 }), note(2, { phrase: 2, time: 3 })];
    assert.equal(buildHaloPreviewPlan(dense).roles.map(r => r.noteId).join(), 'n0,n2');
});

test('halo is a separate bounded instanced reticle; empty, null and unsupported plans draw nothing', () => {
    const halos = new XrNoteHalos(); const n = note(0);
    assert.ok(halos.mesh instanceof THREE.InstancedMesh);
    assert.equal(halos.mesh.instanceMatrix.count, HALO_CAPACITY);
    assert.equal(halos.mesh.material.depthWrite, false);
    assert.equal(halos.mesh.material.blending, THREE.AdditiveBlending);
    assert.ok(halos.mesh.geometry.getAttribute('position').count < 300);
    halos.update([pending(n)], 4); assert.equal(halos.mesh.count, 0);
    halos.setPlan(plan([n])); halos.update([pending(n)], 4); assert.equal(halos.mesh.count, 1);
    halos.setPlan({ version: 999, roles: plan([n]).roles }); halos.update([pending(n)], 4); assert.equal(halos.mesh.count, 0);
    halos.setPlan(null); assert.equal(halos.roleOf(n.id), null);
    halos.dispose();
});

test('halo centres follow canonical rows, offsets, speed and shared bend, with uniform-only path/time updates', () => {
    const halos = new XrNoteHalos(), path = new XrTrackPath();
    const notes = Array.from({ length: 4 }, (_, i) => note(i, { time: 5, xOffsetMeters: .19, row: i }));
    halos.setPlan(plan(notes)); path.setFocus(.7, -.3); halos.setSpawnFade(1.4);
    const cfg = { ...config, rowSpacingMeters: .4, noteSpeedMps: 7, noteSizeMeters: .42 };
    halos.update(notes.map(pending), 4.5, cfg, path);
    const writes = halos.writes;
    const shader = halos.mesh.material.vertexShader;
    assert.ok(shader.includes(TRACK_BEND_GLSL));
    assert.match(shader, /\(at - aHaloBase.z\) \* uNoteSpeed/);
    assert.match(shader, /xrTrackPathOffset\(centre.z - uTrackForward\)/);
    for (const time of [4.5, 4.6, 5]) {
        halos.update(notes.map(pending), time, cfg, path);
        for (let i = 0; i < notes.length; i++) {
            const [x, y, nt] = values(halos, 'aHaloBase', i);
            const z = (halos.uniforms.uNoteTime.value - nt) * halos.uniforms.uNoteSpeed.value;
            const bend = glslTrackOffset(halos.uniforms.uTrackBend.value, z - halos.uniforms.uTrackForward.value);
            const expected = path.projectPlayfieldPoint(notePosition(notes[i], time, {}, cfg));
            assert.ok(new THREE.Vector3(x + bend.x, y + bend.y, z).distanceTo(expected) < 2e-6);
        }
    }
    path.setFocus(-.4, .2); halos.update(notes.map(pending), 5, cfg, path);
    assert.equal(halos.writes, writes, 'moving path/time does not rewrite instances');
    assert.equal(halos.uniforms.uNoteSize.value, .42);
    assert.equal(halos.uniforms.uNoteSpawnFade.value, 1.4);
    halos.update(notes.map(pending), 5, cfg);
    assert.equal(halos.uniforms.uTrackForward.value, 0);
    assert.equal(halos.uniforms.uTrackBend.value.x, 0);
    halos.dispose();
});

test('session hit bursts survive active-note expiry, freeze at accepted target time, and expire by song time', () => {
    const halos = new XrNoteHalos(), n = note(0);
    halos.setPlan(plan([n]));
    halos.onNoteResolved(n, 'perfect', 5.05, false);
    halos.onNoteResolved(n, 'perfect', 5.05, false);
    halos.update([], 5.4);
    assert.equal(halos.mesh.count, 1, 'retained independently of the shorter active-note lifetime');
    assert.equal(values(halos, 'aHaloStyle')[3], 1);
    const [, , nt, resolved] = values(halos, 'aHaloBase');
    assert.ok(Math.abs((resolved - nt) * halos.uniforms.uNoteSpeed.value - .2) < 1e-6);
    const writes = halos.writes;
    halos.update([], 5.4); assert.equal(halos.writes, writes, 'pause is stable');
    halos.update([], 5.05 + HALO_BURST_SEC + .001); assert.equal(halos.mesh.count, 0);
    halos.dispose();
});

test('misses dim without hit bursts; skipped notes and reset/seek never manufacture a burst', () => {
    const halos = new XrNoteHalos(), n = note(0);
    halos.setPlan(plan([n]));
    halos.onNoteResolved(n, null, 5.2, false);
    halos.update([{ note: n, status: 'missed', judgement: null, resolvedAt: 5.2 }], 5.21);
    assert.equal(values(halos, 'aHaloStyle')[3], 2);
    halos.reset(); halos.onNoteResolved(n, null, 10, true); halos.update([], 10);
    assert.equal(halos.mesh.count, 0);
    halos.reset(); halos.onNoteResolved(n, 'good', 5, false); halos.update([], 5.1);
    assert.equal(halos.mesh.count, 1);
    halos.reset(); assert.equal(halos.mesh.count, 0);
    halos.update([pending(n)], 4.9); assert.equal(values(halos, 'aHaloStyle')[3], 0);
    halos.onNoteResolved(n, 'perfect', 5, false); halos.update([], 5.1); assert.equal(halos.mesh.count, 1, 'new run resolves again');
    halos.dispose();
});

test('overflow is deterministic and uploads only the drawn bounded prefix', () => {
    const notes = Array.from({ length: HALO_CAPACITY + 8 }, (_, i) => note(i));
    const halos = new XrNoteHalos(); halos.setPlan(plan(notes)); halos.update(notes.map(pending), 0);
    assert.equal(halos.mesh.count, HALO_CAPACITY); assert.equal(halos.overflow, 8);
    assert.ok(Math.abs(values(halos, 'aHaloBase', 15)[2] - 20) < 1e-6, 'chart-order pending prefix');
    for (const name of ['aHaloBase', 'aHaloStyle']) assert.deepEqual(halos.mesh.geometry.getAttribute(name).updateRanges, [{ start: 0, count: HALO_CAPACITY * 4 }]);
    for (const n of notes) halos.onNoteResolved(n, 'perfect', n.time, false);
    halos.update([], notes.at(-1).time + .1);
    assert.equal(halos.mesh.count, 1, 'only unexpired song-time burst remains');
    halos.setPlan(plan(notes));
    for (const n of notes) halos.onNoteResolved(n, 'perfect', 30, false);
    halos.update([], 30.1); assert.equal(halos.mesh.count, HALO_CAPACITY);
    const ids = halos.bursts.filter(b => b.note).map(b => b.note.id);
    assert.equal(new Set(ids).size, HALO_CAPACITY);
    assert.ok(!ids.includes('n0') && ids.includes('n23'), 'oldest bursts replaced');
    halos.dispose();
});

test('replacing a plan with reused ids clears old effects and changes role colour immediately', () => {
    const halos = new XrNoteHalos(), n = note(0);
    halos.setPlan(plan([n])); halos.onNoteResolved(n, 'perfect', 5, false); halos.update([], 5.1);
    halos.setPlan(buildRhythmNoteRolePlan([n], [{ noteId: n.id, role: 'energy' }]));
    assert.equal(halos.mesh.count, 0);
    halos.update([pending(n)], 4.9); assert.equal(values(halos, 'aHaloStyle')[3], 0);
    assert.equal(halos.roleOf(n.id), 'energy');
    assert.ok(values(halos, 'aHaloStyle')[0] > values(halos, 'aHaloStyle')[2]);
    halos.dispose();
});

test('real scene/session lifecycle preserves score parity and clears effects on restart, seek, new chart and clear', () => {
    const scene = new RhythmGameScene(new THREE.Scene()), session = new RhythmGameSession(), reference = new RhythmGameSession();
    const n = note(0, { lane: 0, row: 1 });
    scene.setNoteRolePlan(plan([n])); session.setResolutionObserver(scene.resolutionObserver);
    for (const s of [session, reference]) { s.loadChart([n]); s.start(); s.attemptStrike({ songTime: 5, hand: 'left', position: { x: -.45, y: 0, z: 0 }, speed: 1 }); }
    assert.deepEqual(same(session.getSnapshot()), same(reference.getSnapshot()));
    scene.update([], 5.1, session.getSnapshot(), ''); assert.equal(scene.noteHalos.mesh.count, 1);
    session.restart(); assert.equal(scene.noteHalos.mesh.count, 0);
    session.seek(10); scene.update(session.getActiveNotes(10), 10, session.getSnapshot(), ''); assert.equal(scene.noteHalos.mesh.count, 0);
    session.loadChart([n]); assert.equal(scene.noteHalos.mesh.count, 0);
    session.clear(); scene.setNoteRolePlan(null); assert.equal(scene.noteHalos.roleOf(n.id), null);
    session.setResolutionObserver(null); scene.dispose();
});

test('halo dispose releases its GPU resources once and rejects stale notifications/updates', () => {
    const halos = new XrNoteHalos(), parent = new THREE.Group(), n = note(0); parent.add(halos.mesh);
    const counts = { mesh: 0, geometry: 0, material: 0 };
    halos.mesh.addEventListener('dispose', () => counts.mesh++);
    halos.mesh.geometry.addEventListener('dispose', () => counts.geometry++);
    halos.mesh.material.addEventListener('dispose', () => counts.material++);
    halos.setPlan(plan([n])); halos.dispose(); halos.dispose();
    halos.setPlan(plan([n])); halos.onNoteResolved(n, 'perfect', 5, false); halos.update([pending(n)], 5.1);
    assert.equal(halos.mesh.count, 0); assert.equal(parent.children.length, 0);
    assert.deepEqual(counts, { mesh: 1, geometry: 1, material: 1 });
});
