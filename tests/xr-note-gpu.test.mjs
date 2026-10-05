// Note travel on the GPU (ADR-009, XR performance pass): event-scope instance data plus song-time
// and track-path uniforms must reproduce the former CPU matrices and colours (both designs, spawn
// fade, missed / paired styling, gems, path bends, seek / pause / restart), CPU judging must keep
// matching the rendered targets, and instance data must be written only when the drawn set changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { legacyNotePoses, noteColorAt, noteMatrixAt, notePositionAt } from './helpers/xr-note-motion.mjs';

const load = createLoader({ three: THREE });
const { RhythmNoteField, NOTE_MOTION_GLSL, TARGET_COLORS } = load('xr/scene/RhythmNoteField.ts');
const { XrTrackPath, TRACK_BEND_GLSL } = load('xr/scene/XrTrackPath.ts');
const { resolvePlayProfile } = load('xr/XrPlayProfile.ts');
const gameplay = load('gameplay/index.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: config, CUT_VECTORS, notePosition } = gameplay;
const reference = { CUT_VECTORS, notePosition, TARGET_COLORS };
const KEYS = ['mesh', 'markers', 'arrows'];
const CUTS = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right', 'any'];
const SAMPLES = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.12, -0.05), new THREE.Vector3(-0.08, 0.02, 0.07)];

const note = (i, over = {}) => ({ id: `n${i}`, time: 4 + i * 0.11, lane: i % 3, row: i % 4, hand: ['left', 'right', 'either'][i % 3],
    intensity: 1, sourceType: 1, cutDirection: CUTS[i % CUTS.length], ...(i % 5 === 0 ? { pairId: `p${i}` } : {}),
    ...(i % 7 === 3 ? { xOffsetMeters: 0.31 } : {}), ...over });
const pending = n => ({ note: n, status: 'pending', judgement: null });
const missed = (n, at) => ({ note: n, status: 'missed', judgement: null, resolvedAt: at });

/** Asserts every drawn instance of the field matches the former CPU pose. */
function assertParity(field, notes, time, cfg, path, label) {
    const legacy = legacyNotePoses(notes, time, cfg, { design: field.design, spawnFadeMeters: field.uniforms.uNoteSpawnFade.value }, reference, path);
    for (const key of KEYS) {
        assert.equal(field[key].count, legacy[key].length, `${label} ${key} count`);
        legacy[key].forEach(({ matrix, color }, i) => {
            const got = noteMatrixAt(field, key, i), rgb = noteColorAt(field, key, i);
            for (const v of SAMPLES) {
                const a = v.clone().applyMatrix4(got), b = v.clone().applyMatrix4(matrix);
                assert.ok(a.distanceTo(b) < 2e-6, `${label} ${key}[${i}] at ${time}: ${a.toArray()} vs ${b.toArray()}`);
            }
            for (const c of ['r', 'g', 'b']) assert.ok(Math.abs(rgb[c] - color[c]) < 1e-6, `${label} ${key}[${i}] colour`);
        });
    }
}

test('the note shader is the documented placement and every pool installs it with the shared track bend', () => {
    // tests/helpers/xr-note-motion.mjs mirrors exactly these expressions.
    assert.match(NOTE_MOTION_GLSL, /noteAhead = aNoteBase\.z - uNoteTime/);
    assert.match(NOTE_MOTION_GLSL, /clamp\( \( uNoteApproach - noteAhead \) \* uNoteSpeed \/ uNoteSpawnFade, 0\.0, 1\.0 \)/);
    assert.match(NOTE_MOTION_GLSL, /noteScale = 0\.6 \+ \( 1\.0 - 0\.6 \) \* noteEmerge/);
    assert.match(NOTE_MOTION_GLSL, /vec3 noteCentre = vec3\( aNoteBase\.xy, \( uNoteTime - aNoteBase\.z \) \* uNoteSpeed \)/);
    assert.match(NOTE_MOTION_GLSL, /noteCentre\.xy \+= xrTrackPathOffset\( noteCentre\.z - uTrackForward \)/);
    assert.match(NOTE_MOTION_GLSL, /noteSpin = aNoteBase\.w \+ uNoteTime \* 1\.6/);
    assert.match(NOTE_MOTION_GLSL, /noteCentre\.z \+= uNoteSize \* noteScale \* 0\.5 \+ 0\.003/);
    assert.match(NOTE_MOTION_GLSL, /vNoteColor = aNoteStyle\.rgb \* \( 0\.12 \+ \( 1\.0 - 0\.12 \) \* noteEmerge \)/);
    const field = new RhythmNoteField();
    for (const [key, cacheKey] of [['mesh', 'xr-note-bodies'], ['markers', 'xr-note-markers'], ['arrows', 'xr-note-arrows']]) {
        const mesh = field[key];
        const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
        mesh.material.onBeforeCompile(shader, null);
        assert.ok(shader.vertexShader.includes(TRACK_BEND_GLSL), `${key}: the one track bend, not a copy`);
        assert.ok(shader.vertexShader.includes(`#include <begin_vertex>${NOTE_MOTION_GLSL}`));
        assert.match(shader.fragmentShader, /#include <color_fragment>\n\tdiffuseColor\.rgb \*= vNoteColor;/);
        for (const name of Object.keys(field.uniforms)) assert.equal(shader.uniforms[name], field.uniforms[name], `${key}: shared ${name}`);
        assert.equal(mesh.material.customProgramCacheKey(), cacheKey);
        assert.equal(mesh.instanceColor, null, 'colour comes from the shader');
        for (const name of ['aNoteBase', 'aNoteStyle']) assert.ok(mesh.geometry.getAttribute(name).isInstancedBufferAttribute);
    }
    field.dispose();
});

test('GPU targets equal the former CPU matrices and colours for every design, lane, row, cut, speed, spawn fade and path bend', () => {
    const notes = Array.from({ length: 24 }, (_, i) => (i % 6 === 4 ? missed(note(i), 4 + i * 0.11 + 0.1) : pending(note(i))));
    const hyper = resolvePlayProfile({ noteSpeed: 'hyper' });
    const bentDefault = new XrTrackPath(); bentDefault.setFocus(0.4, -0.3);
    const bentHyper = new XrTrackPath(); bentHyper.setLayout(hyper.stage); bentHyper.setFocus(-0.6, 0.5);
    let checked = 0;
    for (const design of ['classic', 'shard']) for (const spawn of [0, 1.5]) for (const [cfg, path] of [[config, undefined], [config, bentDefault],
        [{ ...config, noteSpeedMps: 7, approachTimeSec: 1.6 }, bentDefault], [hyper.config, bentHyper]]) {
        const field = new RhythmNoteField(); field.setDesign(design); field.setSpawnFade(spawn);
        for (const time of [2.1, 2.9, 3.6, 4.4, 5.05, 5.9, 6.6]) {
            field.update(notes, time, cfg, path);
            assertParity(field, notes, time, cfg, path, `${design} fade ${spawn} ${cfg.noteSpeedMps} m/s ${path ? 'bent' : 'straight'}`);
            checked += field.mesh.count + field.markers.count + field.arrows.count;
        }
        field.dispose();
    }
    assert.ok(checked > 1000, `${checked} instances compared`);
});

test('CPU judging positions and the rendered targets stay one projection apart, exactly', () => {
    const path = new XrTrackPath(); path.setFocus(0.35, 0.25);
    const notes = [pending(note(2, { time: 5 })), pending(note(7, { time: 5.6 }))];
    const field = new RhythmNoteField(); field.update(notes, 4, config, path);
    notes.forEach((entry, i) => {
        const rendered = notePositionAt(field, 'mesh', i), canonical = notePosition(entry.note, 4, new THREE.Vector3(), config);
        assert.ok(rendered.distanceTo(path.projectPlayfieldPoint(canonical.clone())) < 1e-6);
        assert.ok(path.unprojectPlayfieldPoint(rendered.clone()).distanceTo(canonical) < 1e-6, 'strike un-projection lands on the judged target');
        assert.ok(rendered.x !== canonical.x, 'far target visibly follows the bend');
    });
    field.dispose();
});

test('instance data is written per drawn-set change, never per frame; pause and path changes only move uniforms', () => {
    const chart = Array.from({ length: 60 }, (_, i) => note(i, { time: 3 + i * 0.2 }));
    const session = new gameplay.RhythmGameSession(config); session.loadChart(chart); session.start();
    const field = new RhythmNoteField(), path = new XrTrackPath();
    let frames = 0;
    for (let f = 0; f < 72 * 8; f++) {
        const t = f / 72;
        for (const e of session.getActiveNotes(t)) if (e.status === 'pending' && t >= e.note.time && e.note.id.endsWith('2')) { e.status = 'hit'; e.resolvedAt = t; }
        session.update(t);
        path.setFocus(Math.sin(t) * 0.3, Math.cos(t) * 0.2); // the Wormhole moves the path every frame
        field.update(session.getActiveNotes(t), t, config, path);
        if (field.mesh.count) frames++;
        if (f % 11 === 0) assertParity(field, session.getActiveNotes(t), t, config, path, `play ${t.toFixed(3)}`);
    }
    assert.ok(frames > 400);
    assert.ok(field.writes < frames / 4, `instance data written ${field.writes}x over ${frames} drawn frames`);
    // Paused: same song time, same path -> no write, no upload, same uniforms.
    const active = session.getActiveNotes(5.5);
    field.update(active, 5.5, config, path);
    const writes = field.writes, versions = KEYS.flatMap(k => ['aNoteBase', 'aNoteStyle'].map(n => field[k].geometry.getAttribute(n).version));
    const uniforms = JSON.stringify(field.uniforms);
    for (let i = 0; i < 72; i++) field.update(active, 5.5, config, path);
    assert.equal(field.writes, writes);
    assert.deepEqual(KEYS.flatMap(k => ['aNoteBase', 'aNoteStyle'].map(n => field[k].geometry.getAttribute(n).version)), versions);
    assert.equal(JSON.stringify(field.uniforms), uniforms);
    // A path change re-aims the targets through the uniform alone.
    path.setFocus(-0.4, 0.4); field.update(active, 5.5, config, path);
    assert.equal(field.writes, writes);
    assertParity(field, active, 5.5, config, path, 'path moved');
    for (const key of KEYS) assert.equal(field[key].instanceMatrix.version, 0, 'instance matrices are never uploaded');
    field.dispose();
});

test('seek and restart reconstruct the exact field without history', () => {
    const chart = Array.from({ length: 40 }, (_, i) => note(i, { time: 3 + i * 0.25 }));
    const session = new gameplay.RhythmGameSession(config); session.loadChart(chart); session.start();
    const field = new RhythmNoteField(); field.setSpawnFade(1.5);
    for (let f = 0; f < 72 * 9; f++) { const t = f / 72; session.update(t); field.update(session.getActiveNotes(t), t, config); }
    const check = (t, label) => {
        const fresh = new RhythmNoteField(); fresh.setSpawnFade(1.5);
        const active = session.getActiveNotes(t);
        field.update(active, t, config); fresh.update(active, t, config);
        assert.ok(field.mesh.count > 2, `${label}: targets on screen`);
        assertParity(field, active, t, config, undefined, label); assertParity(fresh, active, t, config, undefined, `${label} fresh`);
        for (const key of KEYS) for (let i = 0; i < field[key].count; i++) {
            assert.ok(noteMatrixAt(field, key, i).equals(noteMatrixAt(fresh, key, i)) || SAMPLES.every(v =>
                v.clone().applyMatrix4(noteMatrixAt(field, key, i)).distanceTo(v.clone().applyMatrix4(noteMatrixAt(fresh, key, i))) < 1e-9), `${label} ${key}[${i}]`);
        }
        fresh.dispose();
    };
    session.seek(4.2); check(4.2, 'backward seek');
    session.seek(7.7); check(7.7, 'forward seek');
    session.restart(); check(2.2, 'restart');
    field.dispose();
});

test('capacity, colours and pools: overflow is bounded, missed / paired styling holds, buffers never reallocate', () => {
    const field = new RhythmNoteField();
    const arrays = KEYS.map(k => ['aNoteBase', 'aNoteStyle'].map(n => field[k].geometry.getAttribute(n).array));
    const many = Array.from({ length: config.maxActiveNotes + 30 }, (_, i) => pending(note(i, { time: 5 + i * 0.01, cutDirection: 'down' })));
    field.update(many, 4, config);
    assert.equal(field.mesh.count, config.maxActiveNotes);
    assertParity(field, many, 4, config, undefined, 'overflow');
    const free = Array.from({ length: config.maxActiveNotes }, (_, i) => pending(note(i, { time: 5 + i * 0.01, cutDirection: 'any' })));
    field.update(free, 4, config);
    assertParity(field, free, 4, config, undefined, 'classic free cuts fill bodies and dots');
    field.setDesign('shard'); field.update(free, 4.2, config);
    assertParity(field, free, 4.2, config, undefined, 'shard gems');
    assert.ok(KEYS.every((k, i) => ['aNoteBase', 'aNoteStyle'].every((n, j) => field[k].geometry.getAttribute(n).array === arrays[i][j])));
    field.dispose();
});
