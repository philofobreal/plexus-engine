// Slice effect on the GPU (ADR-009 Addendum Q, XR performance pass): event-scope instance data plus
// a song-time uniform must reproduce the former CPU matrices and colours exactly (seek, pause and
// expiry included), and instance data must be written only when the live slice set changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { gpuSlicePose, legacySlicePoses } from './helpers/xr-slice-motion.mjs';

const load = createLoader({ three: THREE });
const { XrSliceEffect, SLICE_EFFECT_SEC, MAX_SLICES, SPARKS_PER_SLICE, SLICE_HALF_GLSL, SLICE_SPARK_GLSL } = load('xr/scene/XrSliceEffect.ts');
const { TARGET_COLORS } = load('xr/scene/RhythmNoteField.ts');
const { XrTrackPath } = load('xr/scene/XrTrackPath.ts');
const gameplay = load('gameplay/index.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: config, CUT_VECTORS, notePosition } = gameplay;
const reference = { CUT_VECTORS, notePosition, TARGET_COLORS };
const size = config.noteSizeMeters;

const CUTS = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right', 'any'];
const note = (i, over = {}) => ({ id: `s${i}`, time: 5 + i * 0.05, lane: i % 3, row: i % 3, hand: i % 2 ? 'right' : 'left',
    intensity: 1, sourceType: 1, cutDirection: CUTS[i % CUTS.length], ...over });
/** Struck slightly early or late, like real hits (the judged window stays in the straight zone). */
const hit = (n, delta = 0) => ({ note: n, status: 'hit', judgement: 'perfect', resolvedAt: n.time + delta });
const SAMPLE_VERTICES = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.2, -0.05), new THREE.Vector3(-0.07, 0.03, 0.04)];

/** Asserts every drawn instance of the effect matches the former CPU pose at `songTime`. */
function assertParity(effect, notes, songTime, cfg = config, path, label = '') {
    const legacy = legacySlicePoses(notes, songTime, cfg, size, reference, path);
    assert.equal(effect.halves.count, legacy.halves.length, `${label} halves`);
    assert.equal(effect.sparks.count, legacy.sparks.length, `${label} sparks`);
    for (const [kind, expected] of [['halves', legacy.halves], ['sparks', legacy.sparks]]) {
        expected.forEach(({ matrix, color }, i) => {
            const pose = gpuSlicePose(effect, kind, i);
            assert.ok(pose.live, `${label} ${kind}[${i}] live`);
            for (const v of SAMPLE_VERTICES) {
                const want = v.clone().applyMatrix4(matrix), got = pose.apply(v);
                assert.ok(got.distanceTo(want) < 2e-6, `${label} ${kind}[${i}] at ${songTime}: ${got.toArray()} vs ${want.toArray()}`);
            }
            for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(pose.color[channel] - color[channel]) < 2e-6, `${label} ${kind}[${i}] colour`);
        });
    }
}

test('the shader programs are the documented kinematics and both materials install them', () => {
    // tests/helpers/xr-slice-motion.mjs mirrors exactly these expressions.
    assert.match(SLICE_HALF_GLSL, /sliceAcross = sliceSide \* \( uSliceHalfOffset \+ 0\.9 \* sliceAge \)/);
    assert.match(SLICE_HALF_GLSL, /sliceAlong = 0\.5 \* sliceAge/);
    assert.match(SLICE_HALF_GLSL, /sliceYaw = sliceSide \* 6\.0 \* sliceAge/);
    assert.match(SLICE_HALF_GLSL, /sliceRoll = aSliceMotion\.w \+ sliceSide \* 2\.5 \* sliceAge/);
    assert.match(SLICE_HALF_GLSL, /transformed \* \( 1\.0 - 0\.35 \* sliceT \)/);
    assert.match(SLICE_HALF_GLSL, /mix\( uSliceHot, aSliceHand, min\( 1\.0, sliceT \* 2\.5 \) \) \* \( \( 1\.0 - sliceT \) \* \( 1\.0 - sliceT \) \)/);
    assert.match(SLICE_SPARK_GLSL, /slicePosition\.y -= 0\.5 \* 2\.5 \* sliceAge \* sliceAge/);
    assert.match(SLICE_SPARK_GLSL, /atan\( sliceDirection\.y \* sliceSpeed - 2\.5 \* sliceAge, sliceDirection\.x \* sliceSpeed \)/);
    assert.match(SLICE_SPARK_GLSL, /0\.6 \+ sliceSpeed \* 0\.4 \* \( 1\.0 - sliceT \)/);
    assert.match(SLICE_SPARK_GLSL, /mix\( aSliceHand, uSliceHot, 0\.5 \)/);
    for (const glsl of [SLICE_HALF_GLSL, SLICE_SPARK_GLSL]) {
        assert.match(glsl, new RegExp(`sliceT = sliceAge / ${SLICE_EFFECT_SEC}`));
        assert.match(glsl, /transformed = mix\( aSliceOrigin\.xyz, slicePosition \+ sliceLocal, sliceLive \)/);
    }
    const effect = new XrSliceEffect(size);
    for (const [mesh, key, glsl] of [[effect.halves, 'xr-slice-halves', SLICE_HALF_GLSL], [effect.sparks, 'xr-slice-sparks', SLICE_SPARK_GLSL]]) {
        const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
        mesh.material.onBeforeCompile(shader, null);
        assert.ok(shader.vertexShader.includes(`#include <begin_vertex>${glsl}`), key);
        assert.match(shader.fragmentShader, /#include <color_fragment>\n\tdiffuseColor\.rgb \*= vSliceColor;/);
        for (const name of Object.keys(effect.uniforms)) assert.equal(shader.uniforms[name], effect.uniforms[name], `${key}: shared ${name}`);
        assert.equal(mesh.material.customProgramCacheKey(), key);
        assert.equal(mesh.material.blending, THREE.AdditiveBlending);
        assert.equal(mesh.material.depthWrite, false);
        assert.equal(mesh.instanceColor, null, 'colour comes from the shader');
        for (const name of ['aSliceOrigin', 'aSliceMotion', 'aSliceHand']) assert.ok(mesh.geometry.getAttribute(name).isInstancedBufferAttribute, name);
    }
    assert.equal(effect.halves.material.vertexColors, true); assert.equal(effect.sparks.material.vertexColors, false);
    effect.dispose();
});

test('GPU poses equal the former CPU matrices and colours at every age, cut, hand, speed and path', () => {
    const notes = CUTS.map((_, i) => hit(note(i), (i % 3 - 1) * 0.04));
    const bent = new XrTrackPath(); bent.setFocus(0.4, -0.3);
    for (const cfg of [config, { ...config, noteSpeedMps: 7 }]) for (const path of [undefined, bent]) {
        const effect = new XrSliceEffect(size);
        const first = Math.min(...notes.map(n => n.resolvedAt)), last = Math.max(...notes.map(n => n.resolvedAt));
        // t = 0, mid-effect, just before expiry, after expiry -- for every slice, in one sweep.
        const times = [first, first + 0.001, first + SLICE_EFFECT_SEC / 2, last, last + SLICE_EFFECT_SEC / 2, last + SLICE_EFFECT_SEC - 1e-4,
            last + SLICE_EFFECT_SEC, last + 1];
        for (const time of times) { effect.update(notes, time, cfg, path); assertParity(effect, notes, time, cfg, path, `${cfg.noteSpeedMps}m/s ${path ? 'bent' : 'straight'}`); }
        assert.equal(effect.halves.count, 0, 'all expired');
        effect.dispose();
    }
});

test('pause and repeated updates at one song time write nothing and change nothing', () => {
    const effect = new XrSliceEffect(size), notes = [hit(note(0)), hit(note(1), 0.02)];
    effect.update(notes, 5.1, config);
    const writes = effect.writes, versions = ['aSliceOrigin', 'aSliceMotion', 'aSliceHand'].map(n => effect.halves.geometry.getAttribute(n).version);
    const uniforms = JSON.stringify(effect.uniforms);
    for (let i = 0; i < 120; i++) effect.update(notes, 5.1, config);
    assert.equal(effect.writes, writes);
    assert.deepEqual(['aSliceOrigin', 'aSliceMotion', 'aSliceHand'].map(n => effect.halves.geometry.getAttribute(n).version), versions);
    assert.equal(JSON.stringify(effect.uniforms), uniforms);
    assertParity(effect, notes, 5.1);
    assert.equal(effect.halves.instanceMatrix.version, 0, 'instance matrices are never uploaded');
    effect.dispose();
});

test('a backward seek reconstructs the exact state without history; frames inside a set only move the uniform', () => {
    const chart = Array.from({ length: 30 }, (_, i) => note(i, { time: 2 + i * 0.13 }));
    const session = new gameplay.RhythmGameSession(config); session.loadChart(chart); session.start();
    const effect = new XrSliceEffect(size);
    let frames = 0, liveFrames = 0;
    for (let f = 0; f < 72 * 7; f++) {
        const t = f / 72;
        for (const e of session.getActiveNotes(t)) if (e.status === 'pending' && t >= e.note.time && !e.note.id.endsWith('7')) { e.status = 'hit'; e.resolvedAt = t; }
        session.update(t);
        effect.update(session.getActiveNotes(t), t, config);
        frames++; if (effect.activeSlices) liveFrames++;
        if (f % 9 === 0) assertParity(effect, session.getActiveNotes(t), t, config, undefined, `play ${t.toFixed(3)}`);
    }
    assert.ok(liveFrames > 100);
    assert.ok(effect.writes < liveFrames / 3, `instance data written ${effect.writes}x over ${liveFrames} live frames`);
    // Seek backwards to a time inside a slice: a fresh effect and the long-lived one agree exactly.
    const back = 2 + 9 * 0.13 + 0.1, states = session.getActiveNotes(back).map(e => ({ ...e }));
    const played = hit(note(9, { time: 2 + 9 * 0.13 }), 0);
    const notes = [...states.filter(e => e.note.id !== 's9'), played];
    effect.update(notes, back, config);
    const fresh = new XrSliceEffect(size); fresh.update(notes, back, config);
    assertParity(effect, notes, back); assertParity(fresh, notes, back);
    for (const kind of ['halves', 'sparks']) for (let i = 0; i < effect[kind].count; i++) {
        const a = gpuSlicePose(effect, kind, i), b = gpuSlicePose(fresh, kind, i);
        for (const v of SAMPLE_VERTICES) assert.ok(a.apply(v).distanceTo(b.apply(v)) < 1e-9);
    }
    // Seeking before the hit draws nothing.
    effect.update([played], played.resolvedAt - 0.01, config);
    assert.equal(effect.halves.count, 0);
    effect.dispose(); fresh.dispose();
});

test('the slice set is bounded and in chart order; a path change re-writes only when it moves a hit origin', () => {
    const effect = new XrSliceEffect(size);
    const many = Array.from({ length: MAX_SLICES + 5 }, (_, i) => hit(note(i, { time: 5 }), 0));
    effect.update(many, 5.05, config);
    assert.equal(effect.halves.count, MAX_SLICES * 2); assert.equal(effect.sparks.count, MAX_SLICES * SPARKS_PER_SLICE);
    assertParity(effect, many, 5.05);
    const path = new XrTrackPath();
    effect.update(many, 5.06, config, path);
    const writes = effect.writes;
    for (let i = 1; i < 20; i++) { path.setFocus(Math.sin(i) * 0.4, Math.cos(i) * 0.3); effect.update(many, 5.06 + i / 1000, config, path); }
    assert.equal(effect.writes, writes, 'judged hits sit in the straight zone: a bending path never rewrites them');
    assertParity(effect, many, 5.079, config, path);
    // A (synthetic) far hit origin follows the path, like the former per-frame projection did.
    const far = [hit(note(0, { time: 9 }), -3.1)];
    effect.update(far, 5.95, config, path);
    const before = effect.writes;
    path.setFocus(0.1, 0.1); effect.update(far, 5.96, config, path);
    assert.equal(effect.writes, before + 1);
    assertParity(effect, far, 5.96, config, path);
    effect.dispose();
});

test('a design switch keeps the instance data on the new halves geometry', () => {
    const effect = new XrSliceEffect(size), notes = [hit(note(2))];
    effect.update(notes, 5.2, config);
    const attributes = ['aSliceOrigin', 'aSliceMotion', 'aSliceHand'].map(n => effect.halves.geometry.getAttribute(n));
    const old = effect.halves.geometry;
    let disposed = false; old.addEventListener('dispose', () => { disposed = true; });
    effect.setDesign('shard');
    assert.ok(disposed && effect.halves.geometry !== old);
    assert.deepEqual(['aSliceOrigin', 'aSliceMotion', 'aSliceHand'].map(n => effect.halves.geometry.getAttribute(n)), attributes);
    effect.update(notes, 5.2, config);
    assertParity(effect, notes, 5.2);
    effect.dispose();
});
