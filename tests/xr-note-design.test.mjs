import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument } from './helpers/fake-dom.mjs';
import { gpuSlicePose } from './helpers/xr-slice-motion.mjs';
import { noteColorAt, noteMatrixAt } from './helpers/xr-note-motion.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const { RhythmNoteField, createShardGeometry, createGemGeometry, createCutLineGeometry, SHARD_SHAPE, TARGET_COLORS } = load('xr/scene/RhythmNoteField.ts');
const { XrSliceEffect, SLICE_EFFECT_SEC, MAX_SLICES, SPARKS_PER_SLICE } = load('xr/scene/XrSliceEffect.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope, normalizeXrSettings, XR_SETTING_SECTIONS } = load('xr/XrSettings.ts');
const { createXrSettingsStore } = load('xr/XrSettingsStore.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: config, CUT_VECTORS, notePosition } = load('gameplay/index.ts');

const size = config.noteSizeMeters;
const note = (over = {}) => ({ id: 'n', time: 5, lane: 0, row: 1, hand: 'left', intensity: 1, sourceType: 1, cutDirection: 'up-right', ...over });
const pending = n => ({ note: n, status: 'pending', judgement: null });
const hit = (n, at) => ({ note: n, status: 'hit', judgement: 'perfect', resolvedAt: at });
/** Rendered (shader-placed) target transforms of a note field pool. */
const position = (field, key, i) => new THREE.Vector3().setFromMatrixPosition(noteMatrixAt(field, key, i));
/** Rendered (shader-placed) slice instance position and colour. */
const slicePosition = (effect, kind, i) => gpuSlicePose(effect, kind, i).apply(new THREE.Vector3());
const axisY = (field, key, i) => new THREE.Vector3(0, 1, 0).transformDirection(noteMatrixAt(field, key, i));

test('a Shard points its long tip along the cut, carries a front cut line, and stays inside the target footprint', () => {
    const shard = createShardGeometry(size); shard.computeBoundingBox();
    const box = shard.boundingBox;
    assert.ok(Math.abs(box.max.y - SHARD_SHAPE.tip * size) < 1e-6 && Math.abs(box.min.y + SHARD_SHAPE.tail * size) < 1e-6);
    assert.ok(box.max.y > -box.min.y * 1.3, 'asymmetric: the tip reads as a direction');
    assert.ok(box.max.x - box.min.x < size && box.max.z - box.min.z < size, 'no wider or deeper than a Classic block');
    const colors = shard.getAttribute('color'), positions = shard.getAttribute('position');
    let front = 0, back = 1;
    for (let i = 0; i < positions.count; i += 3) {
        const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
        if (z > 0) front = Math.max(front, colors.getX(i)); else back = Math.min(back, colors.getX(i));
    }
    assert.ok(front > 0.8 && back < 0.2, 'lit front facets, dark back');
    const line = createCutLineGeometry(size); line.computeBoundingBox();
    assert.ok(line.boundingBox.max.z > SHARD_SHAPE.halfDepth * size, 'the line sits on the front ridge');
    assert.ok(line.boundingBox.max.y > SHARD_SHAPE.tip * size * 0.9 && line.boundingBox.min.y < -SHARD_SHAPE.tail * size * 0.9, 'tail to tip');
    const gem = createGemGeometry(size); gem.computeBoundingBox();
    assert.ok(Math.abs(gem.boundingBox.max.y + gem.boundingBox.min.y) < 1e-6, 'free-cut gems are symmetric');
});

test('the note field switches designs in place: shards and cut lines share the cut rotation, free cuts become turning gems', () => {
    const field = new RhythmNoteField();
    const before = field.mesh.geometry;
    field.setDesign('shard');
    assert.equal(field.design, 'shard'); assert.notEqual(field.mesh.geometry, before);
    const directed = Object.keys(CUT_VECTORS).map((cutDirection, i) => pending(note({ id: `d${i}`, cutDirection, hand: i % 2 ? 'right' : 'left' })));
    const free = pending(note({ id: 'free', cutDirection: 'any', hand: 'right' }));
    field.update([...directed, free], 4.5, config);
    assert.equal(field.mesh.count, 8); assert.equal(field.arrows.count, 8); assert.equal(field.markers.count, 1);
    directed.forEach((entry, i) => {
        const [x, y] = CUT_VECTORS[entry.note.cutDirection], tip = axisY(field, 'mesh', i);
        assert.ok(Math.abs(tip.x - x) < 1e-6 && Math.abs(tip.y - y) < 1e-6, `${entry.note.cutDirection}: the tip points along the cut`);
        assert.ok(axisY(field, 'arrows', i).distanceTo(tip) < 1e-9 && position(field, 'arrows', i).distanceTo(position(field, 'mesh', i)) < 1e-9, 'line on its shard');
        assert.ok(position(field, 'mesh', i).distanceTo(new THREE.Vector3().copy(notePosition(entry.note, 4.5, {}, config))) < 1e-6, 'same place as judged');
    });
    const color = noteColorAt(field, 'markers', 0);
    assert.equal(color.getHex(), TARGET_COLORS.right.getHex(), 'gems carry the hand colour');
    assert.equal(field.markers.material.vertexColors, true);
    const spin = () => new THREE.Quaternion().setFromRotationMatrix(noteMatrixAt(field, 'markers', 0));
    const a = spin(); field.update([free], 4.6, config); assert.ok(spin().angleTo(a) > 0.05, 'gems turn with song time');
    field.update([free], 4.6, config); const still = spin(); field.update([free], 4.6, config);
    assert.ok(spin().angleTo(still) < 1e-3, 'and freeze when it stops (float32 matrices)');
    field.setDesign('classic');
    field.update([...directed, free], 4.5, config);
    assert.equal(field.mesh.count, 9, 'classic: one block per target'); assert.equal(field.markers.material.vertexColors, false);
    field.dispose();
});

test('a struck target splits across its cut, flies apart with sparks and is gone after the effect time', () => {
    const effect = new XrSliceEffect(size);
    const n = note({ id: 'cut', cutDirection: 'right', hand: 'right', lane: 2 });
    const entry = hit(n, 5);
    effect.update([entry, pending(note({ id: 'p' }))], 5.1, config);
    assert.equal(effect.halves.count, 2); assert.equal(effect.sparks.count, SPARKS_PER_SLICE); assert.equal(effect.activeSlices, 1);
    const a = slicePosition(effect, 'halves', 0), b = slicePosition(effect, 'halves', 1), origin = new THREE.Vector3().copy(notePosition(n, 5, {}, config));
    const apart = b.clone().sub(a);
    assert.ok(Math.abs(apart.x) < 1e-6 && apart.y < -0.2, 'a horizontal cut separates the halves vertically');
    assert.ok(a.z > origin.z && b.z > origin.z, 'the debris keeps moving toward the player');
    effect.update([entry], 5.01, config);
    const early = gpuSlicePose(effect, 'halves', 0).color;
    effect.update([entry], 5 + SLICE_EFFECT_SEC * 0.8, config);
    const late = gpuSlicePose(effect, 'halves', 0).color;
    assert.ok(early.g > early.r * 0.8 && late.r + late.g + late.b < (early.r + early.g + early.b) * 0.2, 'white-hot, then fading');
    const frozen = slicePosition(effect, 'halves', 0);
    effect.update([entry], 5 + SLICE_EFFECT_SEC * 0.8, config);
    assert.ok(slicePosition(effect, 'halves', 0).distanceTo(frozen) < 1e-12, 'a pure function of song time');
    effect.update([entry], 5 + SLICE_EFFECT_SEC + 0.01, config);
    assert.equal(effect.halves.count, 0); assert.equal(effect.sparks.count, 0);
    effect.update([entry], 4.9, config); assert.equal(effect.halves.count, 0, 'nothing before the hit (seeking back)');
    const many = Array.from({ length: MAX_SLICES + 5 }, (_, i) => hit(note({ id: `m${i}` }), 5));
    effect.update(many, 5.05, config);
    assert.equal(effect.halves.count, MAX_SLICES * 2, 'bounded pool');
    effect.setDesign('shard');
    effect.halves.geometry.computeBoundingBox();
    assert.ok(Math.abs(effect.halves.geometry.boundingBox.max.y - SHARD_SHAPE.tip * size) < 1e-6, 'shard halves');
    effect.dispose();
});

test('Note design is a live Visuals setting, persisted per browser, applied to the scene without touching the chart', () => {
    const descriptor = XR_SETTINGS.find(d => d.id === 'noteDesign');
    assert.equal(descriptor.section, 'background'); assert.equal(descriptor.scope, 'presentation');
    assert.equal(XR_SETTING_SECTIONS.find(s => s.id === 'background').title, 'Visuals');
    assert.equal(descriptor.read(DEFAULT_XR_SETTINGS), 'shard', 'Shard is the /xr/ default (ADR-009 Addendum T)');
    const classic = descriptor.write(DEFAULT_XR_SETTINGS, 'classic');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, classic), 'presentation');
    assert.equal(normalizeXrSettings({ appearance: { noteDesign: 'blob' } }).appearance.noteDesign, 'shard');
    const memory = new Map();
    const store = createXrSettingsStore({ getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) });
    store.save(classic);
    assert.equal(createXrSettingsStore({ getItem: k => memory.get(k) ?? null, setItem() {}, removeItem() {} }).load().appearance.noteDesign, 'classic');
    const scene = new RhythmGameScene(new THREE.Scene());
    scene.setNoteDesign('shard');
    assert.equal(scene.noteField.design, 'shard');
    assert.ok(scene.playfield.children.includes(scene.sliceEffect.halves) && scene.playfield.children.includes(scene.sliceEffect.sparks));
    const snapshot = { state: 'playing', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 1 };
    scene.update([hit(note(), 5)], 5.05, snapshot, '');
    assert.equal(scene.sliceEffect.halves.count, 2, 'the scene drives the slice effect');
    scene.dispose();
});
