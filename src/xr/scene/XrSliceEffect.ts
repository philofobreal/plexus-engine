// Slice effect for struck targets (ADR-009 Addendum Q): the target splits into two halves along
// the cut plane that fly apart and fade, with a short burst of sparks along the cut. A pure
// function of song time and the session's resolved note states (`resolvedAt`): pausing freezes
// it, seeking lands on the exact state, nothing accumulates. Pools are allocated once (two
// additive instanced draws).
//
// Motion runs on the GPU. The CPU writes event-scope instance data -- hit origin, hit time, cut
// frame, side, the deterministic spark direction / speed / drift and the hand colour -- only when
// the set of live slices changes (a hit, an expiry, a seek) or its inputs do (path, config). Every
// frame the vertex shader evaluates separation, follow-through, carry, gravity, rotation, scale and
// fade from one song-time uniform. Hit times are stored relative to an epoch (the song time of the
// last write) so the uniform stays small and float32-exact; the instance data is always rebuilt
// from canonical session state, so a seek reconstructs the exact image without any history.

import * as THREE from 'three';
import { CUT_VECTORS, notePosition, type NoteRuntimeState, type RhythmGameConfig } from '../../gameplay';
import type { XrNoteDesign } from '../XrAppearanceSettings';
import { createShardGeometry, createTargetGeometry, TARGET_COLORS } from './RhythmNoteField';
import type { XrTrackPath } from './XrTrackPath';
import { markAttributesWritten } from './InstanceUploads';

/** How long a slice lasts, in seconds (inside the session's resolved-note window for typical hits). */
export const SLICE_EFFECT_SEC = 0.32;
/** Concurrent slices drawn (older ones beyond it are skipped; at most a few overlap in practice). */
export const MAX_SLICES = 12;
export const SPARKS_PER_SLICE = 10;
/** Halves drift apart across the cut at this speed, and follow through along it (m/s). */
const SEPARATION_MPS = 0.9;
const FOLLOW_THROUGH_MPS = 0.5;
/** Fraction of the note speed the debris keeps toward the player. */
const CARRY = 0.35;
const SPARK_GRAVITY = 2.5;
const HOT = new THREE.Color(0xf2fdff);

/** Deterministic [0, 1) hash of a note id and an index (spark directions and speeds). */
function hash01(id: string, index: number): number {
    let h = 0x811c9dc5 ^ Math.imul(index + 1, 0x9e3779b1);
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
}

const glslFloat = (value: number): string => (Number.isInteger(value) ? `${value}.0` : String(value));

/** Shared declarations; `aSliceOrigin.w` is the hit time relative to the write epoch. */
const SLICE_DECLARATIONS = /* glsl */ `
attribute vec4 aSliceOrigin;
attribute vec4 aSliceMotion;
attribute vec3 aSliceHand;
uniform float uSliceTime;
uniform float uSliceCarry;
uniform float uSliceHalfOffset;
uniform vec3 uSliceHot;
varying vec3 vSliceColor;`;

/**
 * Half kinematics (`aSliceMotion` = cut x, cut y, side, cut angle): drift apart across the cut,
 * follow through along it, carry toward the player, tumble, shrink, cool from white-hot to the
 * hand colour while fading. Outside [0, SLICE_EFFECT_SEC) the instance collapses to its origin.
 */
export const SLICE_HALF_GLSL = /* glsl */ `
	float sliceAge = uSliceTime - aSliceOrigin.w;
	float sliceT = sliceAge / ${glslFloat(SLICE_EFFECT_SEC)};
	float sliceLive = step( 0.0, sliceAge ) * ( 1.0 - step( ${glslFloat(SLICE_EFFECT_SEC)}, sliceAge ) );
	vec2 sliceCut = aSliceMotion.xy;
	float sliceSide = aSliceMotion.z;
	float sliceAcross = sliceSide * ( uSliceHalfOffset + ${glslFloat(SEPARATION_MPS)} * sliceAge );
	float sliceAlong = ${glslFloat(FOLLOW_THROUGH_MPS)} * sliceAge;
	vec3 slicePosition = aSliceOrigin.xyz + vec3( vec2( sliceCut.y, -sliceCut.x ) * sliceAcross + sliceCut * sliceAlong, uSliceCarry * sliceAge );
	float sliceYaw = sliceSide * 6.0 * sliceAge;
	float sliceRoll = aSliceMotion.w + sliceSide * 2.5 * sliceAge;
	vec3 sliceLocal = transformed * ( 1.0 - 0.35 * sliceT );
	sliceLocal = vec3( cos( sliceRoll ) * sliceLocal.x - sin( sliceRoll ) * sliceLocal.y, sin( sliceRoll ) * sliceLocal.x + cos( sliceRoll ) * sliceLocal.y, sliceLocal.z );
	sliceLocal = vec3( cos( sliceYaw ) * sliceLocal.x + sin( sliceYaw ) * sliceLocal.z, sliceLocal.y, -sin( sliceYaw ) * sliceLocal.x + cos( sliceYaw ) * sliceLocal.z );
	transformed = mix( aSliceOrigin.xyz, slicePosition + sliceLocal, sliceLive );
	vSliceColor = mix( uSliceHot, aSliceHand, min( 1.0, sliceT * 2.5 ) ) * ( ( 1.0 - sliceT ) * ( 1.0 - sliceT ) );`;

/**
 * Spark kinematics (`aSliceMotion` = direction x, direction y, speed, z drift): ballistic flight
 * with gravity, aligned with the current velocity, stretched by speed, cooling while fading.
 */
export const SLICE_SPARK_GLSL = /* glsl */ `
	float sliceAge = uSliceTime - aSliceOrigin.w;
	float sliceT = sliceAge / ${glslFloat(SLICE_EFFECT_SEC)};
	float sliceLive = step( 0.0, sliceAge ) * ( 1.0 - step( ${glslFloat(SLICE_EFFECT_SEC)}, sliceAge ) );
	vec2 sliceDirection = aSliceMotion.xy;
	float sliceSpeed = aSliceMotion.z;
	vec3 slicePosition = aSliceOrigin.xyz + vec3( sliceDirection * sliceSpeed * sliceAge, ( uSliceCarry + aSliceMotion.w ) * sliceAge );
	slicePosition.y -= 0.5 * ${glslFloat(SPARK_GRAVITY)} * sliceAge * sliceAge;
	float sliceRoll = atan( sliceDirection.y * sliceSpeed - ${glslFloat(SPARK_GRAVITY)} * sliceAge, sliceDirection.x * sliceSpeed ) - ${glslFloat(Math.PI / 2)};
	vec3 sliceLocal = transformed * vec3( 1.0, 0.6 + sliceSpeed * 0.4 * ( 1.0 - sliceT ), 1.0 );
	sliceLocal = vec3( cos( sliceRoll ) * sliceLocal.x - sin( sliceRoll ) * sliceLocal.y, sin( sliceRoll ) * sliceLocal.x + cos( sliceRoll ) * sliceLocal.y, sliceLocal.z );
	transformed = mix( aSliceOrigin.xyz, slicePosition + sliceLocal, sliceLive );
	vSliceColor = mix( aSliceHand, uSliceHot, 0.5 ) * ( ( 1.0 - sliceT ) * ( 1.0 - sliceT ) * ( 1.0 - sliceT ) );`;

/** Uniforms shared by both slice materials (live objects; written by `update`). */
export interface SliceUniforms {
    readonly uSliceTime: { value: number };
    readonly uSliceCarry: { value: number };
    readonly uSliceHalfOffset: { value: number };
    readonly uSliceHot: { value: THREE.Color };
}

function sliceMaterial(vertexColors: boolean, motion: string, cacheKey: string, uniforms: SliceUniforms): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ vertexColors, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        if (!shader.vertexShader.includes('#include <begin_vertex>') || !shader.fragmentShader.includes('#include <color_fragment>')) {
            throw new Error('Slice effect: unexpected built-in shader chunks.');
        }
        shader.vertexShader = `${SLICE_DECLARATIONS}\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>${motion}`);
        shader.fragmentShader = `varying vec3 vSliceColor;\n${shader.fragmentShader}`
            .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vSliceColor;');
    };
    material.customProgramCacheKey = () => cacheKey;
    return material;
}

const SLICE_ATTRIBUTES = [['aSliceOrigin', 4], ['aSliceMotion', 4], ['aSliceHand', 3]] as const;

/** Per-instance event data (origin + epoch-relative hit time, motion constants, hand colour), allocated once. */
function sliceAttributes(count: number): THREE.InstancedBufferAttribute[] {
    return SLICE_ATTRIBUTES.map(([, itemSize]) => new THREE.InstancedBufferAttribute(new Float32Array(count * itemSize), itemSize)
        .setUsage(THREE.DynamicDrawUsage));
}

function attach(geometry: THREE.BufferGeometry, attributes: readonly THREE.InstancedBufferAttribute[]): THREE.BufferGeometry {
    attributes.forEach((attribute, i) => geometry.setAttribute(SLICE_ATTRIBUTES[i][0], attribute));
    return geometry;
}

/** Half-body geometry: the target cut along its local Y-Z plane (each half is offset per instance). */
function halfGeometry(design: XrNoteDesign, size: number): THREE.BufferGeometry {
    return (design === 'shard' ? createShardGeometry(size) : createTargetGeometry(size)).scale(0.5, 1, 1);
}

export class XrSliceEffect {
    readonly halves: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly sparks: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    /** Shader inputs shared by both draws (song time relative to the write epoch, carry, half offset, hot colour). */
    readonly uniforms: SliceUniforms;
    private readonly size: number;
    private design: XrNoteDesign = 'classic';
    private readonly halfAttributes: THREE.InstancedBufferAttribute[];
    private readonly sparkAttributes: THREE.InstancedBufferAttribute[];
    private readonly origin = new THREE.Vector3();
    /** The written slice set (note ids and hit times, in draw order) and the inputs it was built from. */
    private readonly slotIds: string[] = [];
    private readonly slotHits: number[] = [];
    private slotCount = 0;
    private writtenConfig: RhythmGameConfig | null = null;
    private writtenPath: XrTrackPath | undefined;
    private writtenPathRevision = -1;
    private epoch = 0;
    /** Slices drawn by the last update (diagnostics/tests). */
    activeSlices = 0;
    /** Instance-data writes so far: once per changed slice set, never per frame (diagnostics/tests). */
    writes = 0;

    constructor(noteSizeMeters: number) {
        this.size = noteSizeMeters;
        this.uniforms = { uSliceTime: { value: 0 }, uSliceCarry: { value: 0 }, uSliceHalfOffset: { value: noteSizeMeters * 0.25 },
            uSliceHot: { value: HOT.clone() } };
        this.halfAttributes = sliceAttributes(MAX_SLICES * 2);
        this.sparkAttributes = sliceAttributes(MAX_SLICES * SPARKS_PER_SLICE);
        this.halves = new THREE.InstancedMesh(attach(halfGeometry(this.design, this.size), this.halfAttributes),
            sliceMaterial(true, SLICE_HALF_GLSL, 'xr-slice-halves', this.uniforms), MAX_SLICES * 2);
        this.sparks = new THREE.InstancedMesh(attach(new THREE.BoxGeometry(0.008, 0.05, 0.008), this.sparkAttributes),
            sliceMaterial(false, SLICE_SPARK_GLSL, 'xr-slice-sparks', this.uniforms), MAX_SLICES * SPARKS_PER_SLICE);
        // Instance matrices stay identity and are never re-uploaded: the shader places every instance.
        for (const mesh of [this.halves, this.sparks]) { mesh.count = 0; mesh.frustumCulled = false; }
        this.halves.name = 'sliceHalves';
        this.sparks.name = 'sliceSparks';
    }

    /** Halves match the target style (presentation only); the instance data moves to the new geometry. */
    setDesign(design: XrNoteDesign): void {
        if (design === this.design) return;
        this.design = design;
        this.halves.geometry.dispose();
        this.halves.geometry = attach(halfGeometry(design, this.size), this.halfAttributes);
    }

    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig, path?: XrTrackPath): void {
        // Membership is decided on the CPU (bounded by the active window); motion is not.
        let slices = 0, changed = config !== this.writtenConfig || path !== this.writtenPath;
        for (const entry of notes) {
            if (slices >= MAX_SLICES) break;
            if (entry.status !== 'hit' || entry.resolvedAt === undefined) continue;
            const age = songTime - entry.resolvedAt;
            if (!(age >= 0 && age < SLICE_EFFECT_SEC)) continue;
            if (this.slotIds[slices] !== entry.note.id || this.slotHits[slices] !== entry.resolvedAt) changed = true;
            this.slotIds[slices] = entry.note.id; this.slotHits[slices] = entry.resolvedAt;
            slices++;
        }
        if (slices !== this.slotCount) changed = true;
        // Hit origins follow the shared track path (they lie in its straight zone for every judged hit).
        if (!changed && slices > 0 && path && path.revision !== this.writtenPathRevision) changed = this.originsMoved(notes, slices, config, path);
        if (changed) this.write(notes, slices, songTime, config, path);
        this.uniforms.uSliceTime.value = songTime - this.epoch;
        this.uniforms.uSliceCarry.value = config.noteSpeedMps * CARRY;
        this.activeSlices = slices;
        this.halves.count = slices * 2; this.sparks.count = slices * SPARKS_PER_SLICE;
    }

    dispose(): void {
        for (const mesh of [this.halves, this.sparks]) { mesh.removeFromParent(); mesh.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); }
    }

    /**
     * Index in `notes` (from `from`) of the live slice entry `update` recorded in `slot`, or -1.
     * Slots follow chart order, so successive slots are found by one forward scan (no allocation).
     */
    private slotIndex(notes: readonly NoteRuntimeState[], from: number, slot: number): number {
        for (let i = from; i < notes.length; i++) {
            const entry = notes[i];
            if (entry.status === 'hit' && entry.note.id === this.slotIds[slot] && entry.resolvedAt === this.slotHits[slot]) return i;
        }
        return -1;
    }

    /** Hit origin of a slice in rendered playfield space. */
    private originOf(entry: NoteRuntimeState, config: RhythmGameConfig, path: XrTrackPath | undefined): THREE.Vector3 {
        notePosition(entry.note, entry.resolvedAt!, this.origin, config);
        path?.projectPlayfieldPoint(this.origin);
        return this.origin;
    }

    /** A new path revision moves the written origins only if the projection actually changed them. */
    private originsMoved(notes: readonly NoteRuntimeState[], slices: number, config: RhythmGameConfig, path: XrTrackPath): boolean {
        this.writtenPathRevision = path.revision;
        const written = this.halfAttributes[0].array as Float32Array;
        for (let slot = 0, n = 0; slot < slices; slot++, n++) {
            if ((n = this.slotIndex(notes, n, slot)) < 0) break;
            const o = this.originOf(notes[n], config, path), w = slot * 8;
            if (Math.fround(o.x) !== written[w] || Math.fround(o.y) !== written[w + 1] || Math.fround(o.z) !== written[w + 2]) return true;
        }
        return false;
    }

    /** Rewrites the event-scope instance data of the current slice set from canonical state. */
    private write(notes: readonly NoteRuntimeState[], slices: number, songTime: number, config: RhythmGameConfig, path: XrTrackPath | undefined): void {
        this.writes++;
        this.epoch = songTime;
        this.slotCount = slices;
        this.writtenConfig = config; this.writtenPath = path; this.writtenPathRevision = path ? path.revision : -1;
        const [halfOrigin, halfMotion, halfHand] = this.halfAttributes.map(a => a.array as Float32Array);
        const [sparkOrigin, sparkMotion, sparkHand] = this.sparkAttributes.map(a => a.array as Float32Array);
        for (let slot = 0, n = 0; slot < slices; slot++, n++) {
            if ((n = this.slotIndex(notes, n, slot)) < 0) break;
            const entry = notes[n], note = entry.note, origin = this.originOf(entry, config, path), hitTime = entry.resolvedAt! - this.epoch;
            // Cut frame: local +Y along the cut, local +X across it (free cuts take a hand diagonal).
            const cut = note.cutDirection && note.cutDirection !== 'any' ? note.cutDirection : note.hand === 'right' ? 'down-right' : 'down-left';
            const [ux, uy] = CUT_VECTORS[cut];
            const angle = Math.atan2(uy, ux) - Math.PI / 2;
            const nx = uy, ny = -ux; // across the cut (in the target plane)
            const hand = TARGET_COLORS[note.hand];
            for (let s = 0; s < 2; s++) {
                const i = slot * 2 + s;
                halfOrigin[i * 4] = origin.x; halfOrigin[i * 4 + 1] = origin.y; halfOrigin[i * 4 + 2] = origin.z; halfOrigin[i * 4 + 3] = hitTime;
                halfMotion[i * 4] = ux; halfMotion[i * 4 + 1] = uy; halfMotion[i * 4 + 2] = s === 0 ? -1 : 1; halfMotion[i * 4 + 3] = angle;
                halfHand[i * 3] = hand.r; halfHand[i * 3 + 1] = hand.g; halfHand[i * 3 + 2] = hand.b;
            }
            for (let k = 0; k < SPARKS_PER_SLICE; k++) {
                // Mostly along the cut, fanned up to 70 degrees either side; 1.5-3.5 m/s.
                const spread = (hash01(note.id, k) - 0.5) * 2.4, speed = 1.5 + 2 * hash01(note.id, k + 31);
                const i = slot * SPARKS_PER_SLICE + k;
                sparkOrigin[i * 4] = origin.x; sparkOrigin[i * 4 + 1] = origin.y; sparkOrigin[i * 4 + 2] = origin.z; sparkOrigin[i * 4 + 3] = hitTime;
                sparkMotion[i * 4] = Math.cos(spread) * ux + Math.sin(spread) * nx;
                sparkMotion[i * 4 + 1] = Math.cos(spread) * uy + Math.sin(spread) * ny;
                sparkMotion[i * 4 + 2] = speed;
                sparkMotion[i * 4 + 3] = hash01(note.id, k + 67) - 0.3;
                sparkHand[i * 3] = hand.r; sparkHand[i * 3 + 1] = hand.g; sparkHand[i * 3 + 2] = hand.b;
            }
        }
        markAttributesWritten(this.halfAttributes, slices * 2);
        markAttributesWritten(this.sparkAttributes, slices * SPARKS_PER_SLICE);
    }
}
