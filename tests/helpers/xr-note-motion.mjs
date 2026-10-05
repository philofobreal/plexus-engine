// Note field parity helpers (ADR-009, XR performance pass).
//
// `legacyNotePoses` is the pre-GPU CPU implementation of `RhythmNoteField.update`, kept verbatim as
// the behavioural reference (Object3D matrices and instance colours per body / marker / arrow).
// `noteMatrixAt` / `noteColorAt` mirror the field's vertex shader (`NOTE_MOTION_GLSL`, with the
// track bend of `TRACK_BEND_GLSL`) operation for operation from the instance attributes and
// uniforms the field actually wrote. `xr-note-gpu.test.mjs` pins the GLSL text; change them together.

import * as THREE from 'three';
import { glslTrackOffset } from './xr-track-bend.mjs';

const SPAWN_SCALE = 0.6, SPAWN_BRIGHTNESS = 0.12;

/** The pre-GPU CPU note field: { mesh: [{ matrix, color }], markers: [...], arrows: [...] } at `songTime`. */
export function legacyNotePoses(notes, songTime, config, { design = 'classic', spawnFadeMeters = 0, capacity = config.maxActiveNotes } = {},
    { CUT_VECTORS, notePosition, TARGET_COLORS }, path) {
    const WHITE = new THREE.Color(0xffffff), MISSED = new THREE.Color(0x3b2c47), PAIRED = new THREE.Color(0xffe2a0), GLYPH_MISSED = new THREE.Color(0x5d6478);
    const dummy = new THREE.Object3D(), bodyColor = new THREE.Color(), glyphColor = new THREE.Color();
    const out = { mesh: [], markers: [], arrows: [] };
    const put = (key, color) => out[key].push({ matrix: dummy.matrix.clone(), color: color.clone() });
    let count = 0, dots = 0, arrows = 0;
    const shard = design === 'shard';
    for (const entry of notes) {
        if (count + dots >= capacity) break;
        if (entry.status === 'hit') continue;
        const age = songTime - (entry.resolvedAt ?? entry.note.time);
        if (entry.status === 'missed' && age > config.resolvedNoteLifetimeSec) continue;
        notePosition(entry.note, songTime, dummy.position, config);
        path?.projectPlayfieldPoint(dummy.position);
        const emerge = spawnFadeMeters > 0 && entry.status === 'pending'
            ? Math.min(1, Math.max(0, (config.approachTimeSec - (entry.note.time - songTime)) * config.noteSpeedMps / spawnFadeMeters)) : 1;
        const scale = SPAWN_SCALE + (1 - SPAWN_SCALE) * emerge;
        const brightness = SPAWN_BRIGHTNESS + (1 - SPAWN_BRIGHTNESS) * emerge;
        const cut = entry.note.cutDirection;
        const directed = !!cut && cut !== 'any';
        const angle = directed ? Math.atan2(CUT_VECTORS[cut][1], CUT_VECTORS[cut][0]) - Math.PI / 2 : 0;
        bodyColor.copy(entry.status === 'missed' ? MISSED : TARGET_COLORS[entry.note.hand]);
        if (brightness < 1) bodyColor.multiplyScalar(brightness);
        glyphColor.copy(entry.status === 'missed' ? GLYPH_MISSED : entry.note.pairId ? PAIRED : WHITE);
        if (brightness < 1) glyphColor.multiplyScalar(brightness);
        dummy.scale.setScalar(scale);
        if (shard) {
            if (directed) {
                dummy.rotation.set(0, 0, angle); dummy.updateMatrix();
                put('mesh', bodyColor); put('arrows', glyphColor);
                count++; arrows++;
            } else {
                dummy.rotation.set(0, songTime * 1.6 + entry.note.time, 0); dummy.updateMatrix();
                put('markers', bodyColor);
                dots++;
            }
            continue;
        }
        dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); put('mesh', bodyColor);
        dummy.position.z += config.noteSizeMeters * scale / 2 + 0.003;
        dummy.rotation.z = angle;
        dummy.updateMatrix(); put(directed ? 'arrows' : 'markers', glyphColor);
        if (directed) arrows++; else dots++;
        count++;
    }
    return out;
}

const read = (attribute, i) => Array.from(attribute.array.subarray(i * attribute.itemSize, (i + 1) * attribute.itemSize));
const SHARED = { mesh: 'mesh', markers: 'markers', arrows: 'arrows' };

/** Shader state of instance `i` of `field[key]`: centre, scale, rotation and colour. */
function shaderState(field, key, i) {
    const geometry = field[SHARED[key]].geometry, u = field.uniforms;
    const [x, y, noteTime, angle] = read(geometry.getAttribute('aNoteBase'), i);
    const [r, g, b, flags] = read(geometry.getAttribute('aNoteStyle'), i);
    const emergeOn = flags >= 3.5 ? 1 : 0, mode = flags - 4 * emergeOn;
    const ahead = noteTime - u.uNoteTime.value;
    const emerge = emergeOn > 0.5 && u.uNoteSpawnFade.value > 0
        ? Math.min(1, Math.max(0, (u.uNoteApproach.value - ahead) * u.uNoteSpeed.value / u.uNoteSpawnFade.value)) : 1;
    const scale = SPAWN_SCALE + (1 - SPAWN_SCALE) * emerge, brightness = SPAWN_BRIGHTNESS + (1 - SPAWN_BRIGHTNESS) * emerge;
    const centre = new THREE.Vector3(x, y, (u.uNoteTime.value - noteTime) * u.uNoteSpeed.value);
    // `glslTrackOffset` is the float32 mirror of TRACK_BEND_GLSL (Task 1).
    const offset = glslTrackOffset(u.uTrackBend.value, centre.z - u.uTrackForward.value);
    centre.x += offset.x; centre.y += offset.y;
    const rotation = new THREE.Euler();
    if (mode > 1.5) rotation.set(0, angle + u.uNoteTime.value * 1.6, 0);
    else {
        if (mode > 0.5) centre.z += u.uNoteSize.value * scale * 0.5 + 0.003;
        rotation.set(0, 0, angle);
    }
    return { centre, scale, rotation, color: new THREE.Color(r * brightness, g * brightness, b * brightness) };
}

/** The shader's instance transform as a matrix (it is exactly T * R * S). */
export function noteMatrixAt(field, key, i, out = new THREE.Matrix4()) {
    const s = shaderState(field, key, i);
    return out.compose(s.centre, new THREE.Quaternion().setFromEuler(s.rotation), new THREE.Vector3(s.scale, s.scale, s.scale));
}

export function noteColorAt(field, key, i, out = new THREE.Color()) {
    return out.copy(shaderState(field, key, i).color);
}

export const notePositionAt = (field, key, i) => new THREE.Vector3().setFromMatrixPosition(noteMatrixAt(field, key, i));
