// Slice effect parity helpers (ADR-009 Addendum Q, XR performance pass).
//
// `legacySlicePoses` is the pre-GPU CPU implementation of `XrSliceEffect.update`, kept verbatim as
// the behavioural reference (Object3D matrices and instance colours per half and spark).
// `gpuSlicePose` mirrors the effect's vertex shader (`SLICE_HALF_GLSL` / `SLICE_SPARK_GLSL`)
// operation for operation from the instance attributes and uniforms the effect actually wrote.
// `xr-slice-gpu.test.mjs` pins the GLSL text this mirrors; change them together.

import * as THREE from 'three';

const SLICE_EFFECT_SEC = 0.32, MAX_SLICES = 12, SPARKS_PER_SLICE = 10;
const SEPARATION_MPS = 0.9, FOLLOW_THROUGH_MPS = 0.5, CARRY = 0.35, SPARK_GRAVITY = 2.5;
const HOT = new THREE.Color(0xf2fdff);

function hash01(id, index) {
    let h = 0x811c9dc5 ^ Math.imul(index + 1, 0x9e3779b1);
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
}

/** The pre-GPU CPU slice effect: { halves: [{ matrix, color }], sparks: [...] } at `songTime`. */
export function legacySlicePoses(notes, songTime, config, size, { CUT_VECTORS, notePosition, TARGET_COLORS }, path) {
    const dummy = new THREE.Object3D(), origin = new THREE.Vector3();
    const halves = [], sparks = [];
    let slices = 0;
    for (const entry of notes) {
        if (slices >= MAX_SLICES) break;
        if (entry.status !== 'hit' || entry.resolvedAt === undefined) continue;
        const age = songTime - entry.resolvedAt;
        if (!(age >= 0 && age < SLICE_EFFECT_SEC)) continue;
        slices++;
        const t = age / SLICE_EFFECT_SEC, note = entry.note;
        notePosition(note, entry.resolvedAt, origin, config);
        path?.projectPlayfieldPoint(origin);
        const cut = note.cutDirection && note.cutDirection !== 'any' ? note.cutDirection : note.hand === 'right' ? 'down-right' : 'down-left';
        const [ux, uy] = CUT_VECTORS[cut];
        const angle = Math.atan2(uy, ux) - Math.PI / 2;
        const nx = uy, ny = -ux;
        const hand = TARGET_COLORS[note.hand];
        const fade = (1 - t) * (1 - t);
        for (let side = -1; side <= 1; side += 2) {
            const across = side * (size * 0.25 + SEPARATION_MPS * age), along = FOLLOW_THROUGH_MPS * age;
            dummy.position.set(origin.x + nx * across + ux * along, origin.y + ny * across + uy * along, origin.z + config.noteSpeedMps * CARRY * age);
            dummy.rotation.set(0, side * 6 * age, angle + side * 2.5 * age);
            dummy.scale.setScalar(1 - 0.35 * t);
            dummy.updateMatrix();
            halves.push({ matrix: dummy.matrix.clone(), color: new THREE.Color().copy(HOT).lerp(hand, Math.min(1, t * 2.5)).multiplyScalar(fade) });
        }
        for (let k = 0; k < SPARKS_PER_SLICE; k++) {
            const spread = (hash01(note.id, k) - 0.5) * 2.4, speed = 1.5 + 2 * hash01(note.id, k + 31);
            const dx = Math.cos(spread) * ux + Math.sin(spread) * nx, dy = Math.cos(spread) * uy + Math.sin(spread) * ny;
            const vx = dx * speed, vy = dy * speed - SPARK_GRAVITY * age;
            dummy.position.set(origin.x + dx * speed * age, origin.y + dy * speed * age - 0.5 * SPARK_GRAVITY * age * age,
                origin.z + (config.noteSpeedMps * CARRY + (hash01(note.id, k + 67) - 0.3)) * age);
            dummy.rotation.set(0, 0, Math.atan2(vy, vx) - Math.PI / 2);
            dummy.scale.set(1, 0.6 + speed * 0.4 * (1 - t), 1);
            dummy.updateMatrix();
            sparks.push({ matrix: dummy.matrix.clone(), color: new THREE.Color().copy(hand).lerp(HOT, 0.5).multiplyScalar((1 - t) * (1 - t) * (1 - t)) });
        }
    }
    return { halves, sparks };
}

const read = (attribute, i) => Array.from(attribute.array.subarray(i * attribute.itemSize, (i + 1) * attribute.itemSize));

/**
 * The shader's pose of instance `i` of `mesh` ('halves' or 'sparks'): a function mapping a local
 * vertex to its playfield position, plus the instance colour (null when the shader collapses it).
 */
export function gpuSlicePose(effect, kind, i) {
    const mesh = effect[kind], geometry = mesh.geometry, u = effect.uniforms;
    const [ox, oy, oz, hitTime] = read(geometry.getAttribute('aSliceOrigin'), i);
    const motion = read(geometry.getAttribute('aSliceMotion'), i);
    const [hr, hg, hb] = read(geometry.getAttribute('aSliceHand'), i);
    const hot = u.uSliceHot.value;
    const age = u.uSliceTime.value - hitTime;
    const t = age / SLICE_EFFECT_SEC;
    const live = age >= 0 && age < SLICE_EFFECT_SEC;
    const mix = (a, b, w) => a + (b - a) * w;
    if (kind === 'halves') {
        const [ux, uy, side, angle] = motion;
        const nx = uy, ny = -ux;
        const across = side * (u.uSliceHalfOffset.value + SEPARATION_MPS * age), along = FOLLOW_THROUGH_MPS * age;
        const px = ox + nx * across + ux * along, py = oy + ny * across + uy * along, pz = oz + u.uSliceCarry.value * age;
        const b = side * 6 * age, c = angle + side * 2.5 * age, scale = 1 - 0.35 * t;
        const w = Math.min(1, t * 2.5), fade = (1 - t) * (1 - t);
        return {
            live,
            color: live ? new THREE.Color(mix(hot.r, hr, w) * fade, mix(hot.g, hg, w) * fade, mix(hot.b, hb, w) * fade) : null,
            apply(v) {
                const sx = v.x * scale, sy = v.y * scale, sz = v.z * scale;
                const rx = Math.cos(c) * sx - Math.sin(c) * sy, ry = Math.sin(c) * sx + Math.cos(c) * sy, rz = sz;
                const qx = Math.cos(b) * rx + Math.sin(b) * rz, qz = -Math.sin(b) * rx + Math.cos(b) * rz;
                return live ? new THREE.Vector3(px + qx, py + ry, pz + qz) : new THREE.Vector3(ox, oy, oz);
            }
        };
    }
    const [dx, dy, speed, drift] = motion;
    const px = ox + dx * speed * age, py = oy + dy * speed * age - 0.5 * SPARK_GRAVITY * age * age, pz = oz + (u.uSliceCarry.value + drift) * age;
    const c = Math.atan2(dy * speed - SPARK_GRAVITY * age, dx * speed) - Math.PI / 2;
    const stretch = 0.6 + speed * 0.4 * (1 - t), fade = (1 - t) * (1 - t) * (1 - t);
    return {
        live,
        color: live ? new THREE.Color(mix(hr, hot.r, 0.5) * fade, mix(hg, hot.g, 0.5) * fade, mix(hb, hot.b, 0.5) * fade) : null,
        apply(v) {
            const sx = v.x, sy = v.y * stretch, sz = v.z;
            return live ? new THREE.Vector3(px + Math.cos(c) * sx - Math.sin(c) * sy, py + Math.sin(c) * sx + Math.cos(c) * sy, pz + sz)
                : new THREE.Vector3(ox, oy, oz);
        }
    };
}
