// PR 8's separate reticle adapted to the minimal role sidecar (ADR-009 Addendum AJ).
// One bounded instanced draw; no target restyling, collision, score or independent clock.
import * as THREE from 'three';
import { DEFAULT_RHYTHM_GAME_CONFIG, MAX_RHYTHM_NOTE_ROLES, RHYTHM_NOTE_ROLE_KINDS, notePosition,
    type JudgementGrade, type NoteRuntimeState, type RhythmGameConfig, type RhythmNote, type RhythmNoteRoleKind,
    type RhythmNoteRolePlan } from '../../gameplay';
import { markAttributesWritten } from './InstanceUploads';
import { TRACK_BEND_GLSL, writeTrackBendUniform, type XrTrackPath } from './XrTrackPath';

export const HALO_CAPACITY = 16;
export const HALO_BURST_SEC = 0.45;
export const ROLE_COLORS: Readonly<Record<RhythmNoteRoleKind, THREE.Color>> = {
    energy: new THREE.Color(0xffc23d), signal: new THREE.Color(0xe8fbff),
    sync: new THREE.Color(0xa77bff), stabilize: new THREE.Color(0xff8fe0),
    accent: new THREE.Color(0xffda88), phrase: new THREE.Color(0xe8fbff), section: new THREE.Color(0xcbbaff)
};
/** Legacy glyph=0, accent=1, phrase=2, section=3; also the pending overflow priority. */
export const ROLE_GLYPHS: Readonly<Record<RhythmNoteRoleKind, number>> = {
    energy: 0, signal: 0, sync: 0, stabilize: 0, accent: 1, phrase: 2, section: 3
};
const PENDING = 0, BURST = 1, MISSED = 2;

const VERTEX = /* glsl */`
${TRACK_BEND_GLSL}
attribute vec4 aHaloBase; // canonical x/y, epoch-relative note time and resolution time
attribute vec4 aHaloStyle; // role RGB, mode
attribute float aHaloRole;
attribute float aHaloPart;
uniform float uNoteTime;
uniform float uNoteSpeed;
uniform float uNoteApproach;
uniform float uNoteSize;
uniform float uNoteSpawnFade;
uniform float uTrackForward;
uniform float uSpin;
uniform float uPulse;
varying vec3 vColor;
varying vec2 vLocal;
varying float vRole;
varying float vPart;
void main() {
    bool burst = aHaloStyle.w > 0.5 && aHaloStyle.w < 1.5;
    float at = burst ? aHaloBase.w : uNoteTime;
    vec3 centre = vec3(aHaloBase.xy, (at - aHaloBase.z) * uNoteSpeed);
    centre.xy += xrTrackPathOffset(centre.z - uTrackForward);
    float ahead = aHaloBase.z - uNoteTime;
    float emerge = uNoteSpawnFade > 0.0 ? clamp((uNoteApproach - ahead) * uNoteSpeed / uNoteSpawnFade, 0.0, 1.0) : 1.0;
    float age = burst ? max(0.0, uNoteTime - aHaloBase.w) : 0.0;
    float scale = burst ? 1.0 + age * 4.5 : (0.7 + 0.3 * emerge) * uPulse;
    float spin = burst || aHaloRole > 0.5 ? 0.0 : uSpin;
    vLocal = position.xy; vRole = aHaloRole; vPart = aHaloPart;
    vec3 local = position * scale * uNoteSize;
    local.xy = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * local.xy;
    float strength = burst ? 1.8 * (1.0 - clamp(age / ${HALO_BURST_SEC.toFixed(2)}, 0.0, 1.0)) : aHaloStyle.w > 1.5 ? 0.2 : 0.25 + 0.75 * emerge;
    vColor = aHaloStyle.rgb * strength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + local + vec3(0.0, 0.0, 0.004), 1.0);
}`;
const FRAGMENT = /* glsl */`
varying vec3 vColor;
varying vec2 vLocal;
varying float vRole;
varying float vPart;
void main() {
    // Outer silhouettes alone carry meaning: the hand colour/cut glyph stays untouched.
    if (vRole > 0.5 && vRole < 1.5 && (vPart > 0.5 || abs(vLocal.x) < 0.36)) discard;
    if (vRole > 1.5 && vRole < 2.5 && (vPart > 0.5 || min(abs(vLocal.x), abs(vLocal.y)) < 0.21)) discard;
    gl_FragColor = vec4(vColor, 1.0);
    #include <colorspace_fragment>
}`;

/** Unit-size thin reticle: ring and four ticks, merged into one non-indexed geometry. */
export function createHaloGeometry(): THREE.BufferGeometry {
    const ring = new THREE.RingGeometry(0.66, 0.72, 40);
    const parts = [ring.toNonIndexed()]; ring.dispose();
    for (let k = 0; k < 4; k++) {
        const tick = new THREE.PlaneGeometry(0.035, 0.16).translate(0, 0.83, 0).rotateZ(k * Math.PI / 2);
        parts.push(tick.toNonIndexed()); tick.dispose();
    }
    const positions = new Float32Array(parts.reduce((n, part) => n + part.getAttribute('position').count * 3, 0));
    const markers = new Float32Array(positions.length / 3);
    let offset = 0;
    for (const part of parts) {
        const array = part.getAttribute('position').array;
        if (offset > 0) markers.fill(1, offset / 3, (offset + array.length) / 3);
        positions.set(array, offset); offset += array.length; part.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aHaloPart', new THREE.BufferAttribute(markers, 1));
    geometry.computeBoundingSphere();
    return geometry;
}

export class XrNoteHalos {
    readonly mesh: THREE.InstancedMesh;
    readonly uniforms = {
        uNoteTime: { value: 0 }, uNoteSpeed: { value: DEFAULT_RHYTHM_GAME_CONFIG.noteSpeedMps },
        uNoteApproach: { value: DEFAULT_RHYTHM_GAME_CONFIG.approachTimeSec }, uNoteSize: { value: DEFAULT_RHYTHM_GAME_CONFIG.noteSizeMeters },
        uNoteSpawnFade: { value: 0 }, uTrackBend: { value: writeTrackBendUniform(new THREE.Vector4()) as THREE.Vector4 },
        uTrackForward: { value: 0 }, uSpin: { value: 0 }, uPulse: { value: 1 }
    };
    writes = 0;
    /** Eligible instances omitted this frame; newest live bursts then chart-order notes win. */
    overflow = 0;
    private readonly roles = new Map<string, RhythmNoteRoleKind>();
    private readonly resolved = new Set<string>();
    private readonly bursts = Array.from({ length: HALO_CAPACITY }, () => ({ note: null as RhythmNote | null, time: 0 }));
    private readonly selected = new Array<RhythmNote | null>(HALO_CAPACITY).fill(null);
    private readonly modes = new Int8Array(HALO_CAPACITY);
    private readonly times = new Float64Array(HALO_CAPACITY);
    private readonly writtenIds: string[] = [];
    private readonly writtenModes: number[] = [];
    private readonly writtenTimes: number[] = [];
    private readonly base: THREE.InstancedBufferAttribute;
    private readonly style: THREE.InstancedBufferAttribute;
    private readonly glyph: THREE.InstancedBufferAttribute;
    private readonly position = { x: 0, y: 0, z: 0 };
    private slotCount = -1;
    private epoch = 0;
    private writtenConfig: RhythmGameConfig | null = null;
    private writtenPath: XrTrackPath | undefined;
    private pathRevision = -1;
    private disposed = false;

    constructor() {
        const geometry = createHaloGeometry();
        this.base = new THREE.InstancedBufferAttribute(new Float32Array(HALO_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
        this.style = new THREE.InstancedBufferAttribute(new Float32Array(HALO_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
        this.glyph = new THREE.InstancedBufferAttribute(new Float32Array(HALO_CAPACITY), 1).setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aHaloBase', this.base); geometry.setAttribute('aHaloStyle', this.style);
        geometry.setAttribute('aHaloRole', this.glyph);
        const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
        this.mesh = new THREE.InstancedMesh(geometry, material, HALO_CAPACITY);
        this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.name = 'xr-note-halos';
    }

    setPlan(plan: RhythmNoteRolePlan | null): void {
        if (this.disposed) return;
        this.roles.clear();
        if (plan?.version === 1) for (const assignment of plan.roles) {
            if (typeof assignment.noteId === 'string' && !this.roles.has(assignment.noteId) && RHYTHM_NOTE_ROLE_KINDS.includes(assignment.role))
                this.roles.set(assignment.noteId, assignment.role);
            if (this.roles.size >= MAX_RHYTHM_NOTE_ROLES) break;
        }
        this.reset();
    }
    roleOf(id: string): RhythmNoteRoleKind | null { return this.roles.get(id) ?? null; }

    reset(): void {
        this.resolved.clear();
        for (const burst of this.bursts) burst.note = null;
        this.selected.fill(null);
        this.slotCount = -1; this.mesh.count = 0; this.overflow = 0;
    }

    /** Session notifications alone start hit bursts. Seek-skipped notes never burst. */
    onNoteResolved(note: RhythmNote, grade: JudgementGrade | null, songTime: number, skipped: boolean): void {
        if (this.disposed || !this.roles.has(note.id) || this.resolved.has(note.id) || !Number.isFinite(songTime)) return;
        this.resolved.add(note.id);
        if (skipped || grade === null) return;
        // Reuse an expired/free slot, otherwise replace the oldest burst. No unbounded effect list.
        let slot = this.bursts[0];
        for (const candidate of this.bursts) {
            if (!candidate.note || songTime - candidate.time >= HALO_BURST_SEC) { slot = candidate; break; }
            if (candidate.time < slot.time) slot = candidate;
        }
        slot.note = note; slot.time = songTime;
    }

    setSpawnFade(meters: number): void { this.uniforms.uNoteSpawnFade.value = Number.isFinite(meters) && meters > 0 ? meters : 0; }

    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, path?: XrTrackPath): void {
        if (this.disposed || !this.roles.size || !Number.isFinite(songTime)) return;
        let slots = 0, eligible = 0;
        const select = (note: RhythmNote, mode: number, time: number) => {
            eligible++;
            if (slots >= HALO_CAPACITY) return;
            this.selected[slots] = note; this.modes[slots] = mode; this.times[slots] = time; slots++;
        };
        for (const burst of this.bursts) if (burst.note) {
            const age = songTime - burst.time;
            if (age >= HALO_BURST_SEC || age < 0) { burst.note = null; continue; }
            select(burst.note, BURST, burst.time);
        }
        for (let priority = 3; priority >= 0; priority--) for (const entry of notes) {
            const role = this.roles.get(entry.note.id);
            if (!role || ROLE_GLYPHS[role] !== priority || entry.status === 'hit') continue;
            if (entry.status === 'missed' && songTime - (entry.resolvedAt ?? entry.note.time) > config.resolvedNoteLifetimeSec) continue;
            select(entry.note, entry.status === 'missed' ? MISSED : PENDING, entry.resolvedAt ?? entry.note.time);
        }
        this.overflow = Math.max(0, eligible - HALO_CAPACITY);
        let changed = slots !== this.slotCount || config !== this.writtenConfig || path !== this.writtenPath;
        for (let i = 0; i < slots; i++) if (this.writtenIds[i] !== this.selected[i]!.id
            || this.writtenModes[i] !== this.modes[i] || this.writtenTimes[i] !== this.times[i]) changed = true;
        if (changed) this.write(slots, songTime, config, path);
        if (path && path.revision !== this.pathRevision) {
            this.pathRevision = path.revision; path.writeBendUniform(this.uniforms.uTrackBend.value);
            this.uniforms.uTrackForward.value = path.playfieldForwardMeters;
        }
        const u = this.uniforms;
        u.uNoteTime.value = songTime - this.epoch; u.uNoteSpeed.value = config.noteSpeedMps;
        u.uNoteApproach.value = config.approachTimeSec; u.uNoteSize.value = config.noteSizeMeters;
        u.uSpin.value = (songTime * 1.4) % (Math.PI * 2); u.uPulse.value = 1 + 0.05 * Math.sin(songTime * 9);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.reset(); this.roles.clear();
        this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose();
    }

    private write(slots: number, songTime: number, config: RhythmGameConfig, path: XrTrackPath | undefined): void {
        this.writes++; this.epoch = songTime; this.slotCount = slots; this.writtenConfig = config;
        if (path !== this.writtenPath) {
            this.writtenPath = path; this.pathRevision = -1;
            if (!path) { writeTrackBendUniform(this.uniforms.uTrackBend.value); this.uniforms.uTrackForward.value = 0; }
        }
        const base = this.base.array as Float32Array, style = this.style.array as Float32Array;
        for (let i = 0; i < slots; i++) {
            const note = this.selected[i]!, color = ROLE_COLORS[this.roles.get(note.id)!], o = i * 4;
            notePosition(note, note.time, this.position, config);
            base[o] = this.position.x; base[o + 1] = this.position.y; base[o + 2] = note.time - this.epoch; base[o + 3] = this.times[i] - this.epoch;
            style[o] = color.r; style[o + 1] = color.g; style[o + 2] = color.b; style[o + 3] = this.modes[i];
            this.glyph.setX(i, ROLE_GLYPHS[this.roles.get(note.id)!]);
            this.writtenIds[i] = note.id; this.writtenModes[i] = this.modes[i]; this.writtenTimes[i] = this.times[i];
        }
        this.mesh.count = slots;
        markAttributesWritten([this.base, this.style, this.glyph], slots);
    }
}
