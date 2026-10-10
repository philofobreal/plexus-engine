// Special-note halos (ADR-010, T06). A special note is an ordinary note -- same hand colour, cut,
// size, timing, collision and score -- with a world role kept in a sidecar by note id. The halo is
// a separate additive reticle that travels with its target (the note field's canonical lane/row
// position, the same song-time travel and the shared track bend), so the target itself is never
// restyled. On a hit the reticle stays at the strike point and bursts outward; on a miss it dims.
//
// One instanced draw; instance data is written only when the drawn set or a status changes.

import * as THREE from 'three';
import { DEFAULT_RHYTHM_GAME_CONFIG, notePosition, type NoteRuntimeState, type RhythmGameConfig, type WorldNoteRoleKind, type WorldPlan } from '../../gameplay';
import { markAttributesWritten } from './InstanceUploads';
import { TRACK_BEND_GLSL, writeTrackBendUniform, type XrTrackPath } from './XrTrackPath';

/** Role colours: gold energy, white signal, violet sync, magenta-white stabilize (never a hand colour). */
export const ROLE_COLORS: Readonly<Record<WorldNoteRoleKind, THREE.Color>> = {
    energy: new THREE.Color(0xffc23d),
    signal: new THREE.Color(0xe8fbff),
    sync: new THREE.Color(0xa77bff),
    stabilize: new THREE.Color(0xff8fe0)
};
/** How long the burst lasts after a hit, seconds. */
export const HALO_BURST_SEC = 0.45;
const HALO_CAPACITY = 16;
const MODE_PENDING = 0, MODE_BURST = 1, MODE_MISSED = 2;

const VERTEX = /* glsl */`
${TRACK_BEND_GLSL}
attribute vec4 aHaloBase;  // x, y, note time - epoch, hit time - epoch
attribute vec4 aHaloStyle; // rgb, mode
uniform float uNoteTime;
uniform float uNoteSpeed;
uniform float uNoteApproach;
uniform float uNoteSpawnFade;
uniform float uTrackForward;
varying vec3 vColor;
void main() {
    float mode = aHaloStyle.w;
    bool burst = mode > 0.5 && mode < 1.5;
    float at = burst ? aHaloBase.w : uNoteTime;
    vec3 centre = vec3(aHaloBase.xy, (at - aHaloBase.z) * uNoteSpeed);
    centre.xy += xrTrackPathOffset(centre.z - uTrackForward);
    float ahead = aHaloBase.z - uNoteTime;
    float emerge = uNoteSpawnFade > 0.0 ? clamp((uNoteApproach - ahead) * uNoteSpeed / uNoteSpawnFade, 0.0, 1.0) : 1.0;
    float age = burst ? max(0.0, uNoteTime - aHaloBase.w) : 0.0;
    float scale = burst ? 1.0 + age * 4.5 : (0.7 + 0.3 * emerge) * (1.0 + 0.05 * sin(uNoteTime * 9.0));
    float spin = burst ? 0.0 : uNoteTime * 1.4;
    vec3 local = position * scale;
    local = vec3(cos(spin) * local.x - sin(spin) * local.y, sin(spin) * local.x + cos(spin) * local.y, local.z);
    float strength = burst ? 1.8 * (1.0 - clamp(age / ${HALO_BURST_SEC.toFixed(2)}, 0.0, 1.0)) : mode > 1.5 ? 0.2 : 0.25 + 0.75 * emerge;
    vColor = aHaloStyle.rgb * strength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + local + vec3(0.0, 0.0, 0.004), 1.0);
}`;

const FRAGMENT = /* glsl */`
varying vec3 vColor;
void main() {
    gl_FragColor = vec4(vColor, 1.0);
    #include <colorspace_fragment>
}`;

/** A targeting reticle around the note: a thin ring with four outer ticks (one geometry). */
export function createHaloGeometry(size: number): THREE.BufferGeometry {
    const ring = new THREE.RingGeometry(size * 0.66, size * 0.72, 40);
    const parts: THREE.BufferGeometry[] = [ring.toNonIndexed()];
    ring.dispose();
    for (let k = 0; k < 4; k++) {
        const tick = new THREE.PlaneGeometry(size * 0.035, size * 0.16).translate(0, size * 0.83, 0).rotateZ(k * Math.PI / 2);
        parts.push(tick.toNonIndexed());
        tick.dispose();
    }
    const total = parts.reduce((n, p) => n + p.getAttribute('position').count, 0);
    const positions = new Float32Array(total * 3);
    let offset = 0;
    for (const part of parts) {
        positions.set(part.getAttribute('position').array as Float32Array, offset);
        offset += part.getAttribute('position').count * 3;
        part.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    return geometry;
}

export class XrNoteHalos {
    readonly mesh: THREE.InstancedMesh;
    readonly uniforms = {
        uNoteTime: { value: 0 }, uNoteSpeed: { value: DEFAULT_RHYTHM_GAME_CONFIG.noteSpeedMps }, uNoteApproach: { value: DEFAULT_RHYTHM_GAME_CONFIG.approachTimeSec },
        uNoteSpawnFade: { value: 0 }, uTrackBend: { value: writeTrackBendUniform(new THREE.Vector4()) as THREE.Vector4 }, uTrackForward: { value: 0 }
    };
    /** Instance writes so far (only when the drawn set or a status changes). */
    writes = 0;
    private readonly base: THREE.InstancedBufferAttribute;
    private readonly style: THREE.InstancedBufferAttribute;
    private roles = new Map<string, WorldNoteRoleKind>();
    private readonly slotIds: string[] = [];
    private readonly slotStatus: string[] = [];
    private slotCount = 0;
    private epoch = 0;
    private writtenConfig: RhythmGameConfig | null = null;
    private writtenPath: XrTrackPath | undefined;
    private pathRevision = -1;
    private readonly position = { x: 0, y: 0, z: 0 };

    constructor(noteSizeMeters: number = DEFAULT_RHYTHM_GAME_CONFIG.noteSizeMeters) {
        const geometry = createHaloGeometry(noteSizeMeters);
        this.base = new THREE.InstancedBufferAttribute(new Float32Array(HALO_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
        this.style = new THREE.InstancedBufferAttribute(new Float32Array(HALO_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aHaloBase', this.base);
        geometry.setAttribute('aHaloStyle', this.style);
        const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
        this.mesh = new THREE.InstancedMesh(geometry, material, HALO_CAPACITY);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.name = 'xr-note-halos';
    }

    /** The plan's role sidecar (null: no roles). The chart is never touched. */
    setPlan(plan: WorldPlan | null): void {
        this.roles = new Map((plan?.roles ?? []).map(role => [role.noteId, role.role]));
        this.slotCount = -1;
    }

    /** Role of a note id (diagnostics and tests). */
    roleOf(noteId: string): WorldNoteRoleKind | null { return this.roles.get(noteId) ?? null; }

    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, path?: XrTrackPath): void {
        let slots = 0, changed = config !== this.writtenConfig || path !== this.writtenPath || this.slotCount < 0;
        if (this.roles.size) {
            for (const entry of notes) {
                if (slots >= HALO_CAPACITY) break;
                if (!this.roles.has(entry.note.id)) continue;
                const age = songTime - (entry.resolvedAt ?? entry.note.time);
                if (entry.status === 'hit' && age > HALO_BURST_SEC) continue;
                if (entry.status === 'missed' && age > config.resolvedNoteLifetimeSec) continue;
                if (this.slotIds[slots] !== entry.note.id || this.slotStatus[slots] !== entry.status) changed = true;
                this.slotIds[slots] = entry.note.id; this.slotStatus[slots] = entry.status;
                slots++;
            }
        }
        if (slots !== this.slotCount) changed = true;
        if (changed) this.write(notes, slots, songTime, config, path);
        if (path && path.revision !== this.pathRevision) {
            this.pathRevision = path.revision;
            path.writeBendUniform(this.uniforms.uTrackBend.value);
            this.uniforms.uTrackForward.value = path.playfieldForwardMeters;
        }
        const u = this.uniforms;
        u.uNoteTime.value = songTime - this.epoch;
        u.uNoteSpeed.value = config.noteSpeedMps; u.uNoteApproach.value = config.approachTimeSec;
    }

    setSpawnFade(meters: number): void { this.uniforms.uNoteSpawnFade.value = Number.isFinite(meters) && meters > 0 ? meters : 0; }

    dispose(): void {
        this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose();
    }

    private write(notes: readonly NoteRuntimeState[], slots: number, songTime: number, config: RhythmGameConfig, path: XrTrackPath | undefined): void {
        this.writes++;
        this.epoch = songTime;
        this.slotCount = slots;
        this.writtenConfig = config;
        if (path !== this.writtenPath) {
            this.writtenPath = path; this.pathRevision = -1;
            if (!path) { writeTrackBendUniform(this.uniforms.uTrackBend.value); this.uniforms.uTrackForward.value = 0; }
        }
        const base = this.base.array as Float32Array, style = this.style.array as Float32Array;
        let i = 0;
        for (const entry of notes) {
            if (i >= slots) break;
            if (entry.note.id !== this.slotIds[i]) continue;
            const role = this.roles.get(entry.note.id)!;
            notePosition(entry.note, entry.note.time, this.position, config);
            const o = i * 4, color = ROLE_COLORS[role];
            const mode = entry.status === 'hit' ? MODE_BURST : entry.status === 'missed' ? MODE_MISSED : MODE_PENDING;
            base[o] = this.position.x; base[o + 1] = this.position.y; base[o + 2] = entry.note.time - this.epoch;
            base[o + 3] = (entry.resolvedAt ?? entry.note.time) - this.epoch;
            style[o] = color.r; style[o + 1] = color.g; style[o + 2] = color.b; style[o + 3] = mode;
            i++;
        }
        this.mesh.count = i;
        markAttributesWritten([this.base, this.style], i);
    }
}
