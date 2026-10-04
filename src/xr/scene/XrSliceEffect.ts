// Slice effect for struck targets (ADR-009 Addendum Q): the target splits into two halves along
// the cut plane that fly apart and fade, with a short burst of sparks along the cut. A pure
// function of song time and the session's resolved note states (`resolvedAt`): pausing freezes
// it, seeking lands on the exact state, nothing accumulates. Pools are allocated once; per frame
// only instance matrices and colours are written (two instanced draws, both additive).

import * as THREE from 'three';
import { CUT_VECTORS, notePosition, type NoteRuntimeState, type RhythmGameConfig } from '../../gameplay';
import type { XrNoteDesign } from '../XrAppearanceSettings';
import { createShardGeometry, createTargetGeometry, TARGET_COLORS } from './RhythmNoteField';
import type { XrTrackPath } from './XrTrackPath';

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

/** Half-body geometry: the target cut along its local Y-Z plane (each half is offset per instance). */
function halfGeometry(design: XrNoteDesign, size: number): THREE.BufferGeometry {
    return (design === 'shard' ? createShardGeometry(size) : createTargetGeometry(size)).scale(0.5, 1, 1);
}

export class XrSliceEffect {
    readonly halves: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly sparks: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    private readonly size: number;
    private design: XrNoteDesign = 'classic';
    private readonly dummy = new THREE.Object3D();
    private readonly origin = new THREE.Vector3();
    private readonly color = new THREE.Color();
    /** Slices drawn by the last update (diagnostics/tests). */
    activeSlices = 0;

    constructor(noteSizeMeters: number) {
        this.size = noteSizeMeters;
        const additive = (vertexColors: boolean) => new THREE.MeshBasicMaterial({ vertexColors, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        this.halves = new THREE.InstancedMesh(halfGeometry(this.design, this.size), additive(true), MAX_SLICES * 2);
        this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.05, 0.008), additive(false), MAX_SLICES * SPARKS_PER_SLICE);
        for (const mesh of [this.halves, this.sparks]) {
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.setColorAt(0, this.color.setRGB(1, 1, 1)); // allocates the colour buffer once
        }
        this.halves.name = 'sliceHalves';
        this.sparks.name = 'sliceSparks';
    }

    /** Halves match the target style (presentation only). */
    setDesign(design: XrNoteDesign): void {
        if (design === this.design) return;
        this.design = design;
        this.halves.geometry.dispose();
        this.halves.geometry = halfGeometry(design, this.size);
    }

    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig, path?: XrTrackPath): void {
        let slices = 0, halves = 0, sparks = 0;
        for (const entry of notes) {
            if (slices >= MAX_SLICES) break;
            if (entry.status !== 'hit' || entry.resolvedAt === undefined) continue;
            const age = songTime - entry.resolvedAt;
            if (!(age >= 0 && age < SLICE_EFFECT_SEC)) continue;
            slices++;
            const t = age / SLICE_EFFECT_SEC, note = entry.note;
            notePosition(note, entry.resolvedAt, this.origin, config);
            path?.projectPlayfieldPoint(this.origin);
            // Cut frame: local +Y along the cut, local +X across it (free cuts take a hand diagonal).
            const cut = note.cutDirection && note.cutDirection !== 'any' ? note.cutDirection : note.hand === 'right' ? 'down-right' : 'down-left';
            const [ux, uy] = CUT_VECTORS[cut];
            const angle = Math.atan2(uy, ux) - Math.PI / 2;
            const nx = uy, ny = -ux; // across the cut (in the target plane)
            const hand = TARGET_COLORS[note.hand];
            const fade = (1 - t) * (1 - t);
            for (let side = -1; side <= 1; side += 2) {
                const across = side * (this.size * 0.25 + SEPARATION_MPS * age), along = FOLLOW_THROUGH_MPS * age;
                this.dummy.position.set(this.origin.x + nx * across + ux * along, this.origin.y + ny * across + uy * along,
                    this.origin.z + config.noteSpeedMps * CARRY * age);
                this.dummy.rotation.set(0, side * 6 * age, angle + side * 2.5 * age);
                this.dummy.scale.setScalar(1 - 0.35 * t);
                this.dummy.updateMatrix();
                this.halves.setMatrixAt(halves, this.dummy.matrix);
                // White-hot at the cut, cooling to the hand colour while it fades.
                this.halves.setColorAt(halves, this.color.copy(HOT).lerp(hand, Math.min(1, t * 2.5)).multiplyScalar(fade));
                halves++;
            }
            for (let k = 0; k < SPARKS_PER_SLICE; k++) {
                // Mostly along the cut, fanned up to 70 degrees either side; 1.5-3.5 m/s.
                const spread = (hash01(note.id, k) - 0.5) * 2.4, speed = 1.5 + 2 * hash01(note.id, k + 31);
                const dx = Math.cos(spread) * ux + Math.sin(spread) * nx, dy = Math.cos(spread) * uy + Math.sin(spread) * ny;
                const vx = dx * speed, vy = dy * speed - SPARK_GRAVITY * age;
                this.dummy.position.set(this.origin.x + dx * speed * age, this.origin.y + dy * speed * age - 0.5 * SPARK_GRAVITY * age * age,
                    this.origin.z + (config.noteSpeedMps * CARRY + (hash01(note.id, k + 67) - 0.3)) * age);
                this.dummy.rotation.set(0, 0, Math.atan2(vy, vx) - Math.PI / 2);
                this.dummy.scale.set(1, 0.6 + speed * 0.4 * (1 - t), 1);
                this.dummy.updateMatrix();
                this.sparks.setMatrixAt(sparks, this.dummy.matrix);
                this.sparks.setColorAt(sparks, this.color.copy(hand).lerp(HOT, 0.5).multiplyScalar((1 - t) * (1 - t) * (1 - t)));
                sparks++;
            }
        }
        this.activeSlices = slices;
        this.halves.count = halves; this.sparks.count = sparks;
        for (const mesh of [this.halves, this.sparks]) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    }

    dispose(): void {
        for (const mesh of [this.halves, this.sparks]) { mesh.removeFromParent(); mesh.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); }
    }
}
