import * as THREE from 'three';
import { CUT_VECTORS, DEFAULT_RHYTHM_GAME_CONFIG, notePosition, type NoteRuntimeState, type RhythmGameConfig } from '../../gameplay';
import { mergeColoredParts } from './SceneGeometry';
import type { XrTrackPath } from './XrTrackPath';
const COLORS = { left: new THREE.Color(0x39cfff), right: new THREE.Color(0xff4fae), either: new THREE.Color(0xffd35c) };
const WHITE = new THREE.Color(0xffffff);
const HIT = new THREE.Color(0xe8fbff);
const MISSED = new THREE.Color(0x3b2c47);
const PAIRED = new THREE.Color(0xffe2a0);
const GLYPH_MISSED = new THREE.Color(0x5d6478);

/**
 * Chamfered target module authored once: a faceted dark body with baked per-face shading and a
 * luminous front bevel. Vertex luminance is multiplied by the instance (hand) colour, so the
 * whole module stays a single unlit instanced draw. Bounds are exactly `size` on every axis.
 */
export function createTargetGeometry(size: number): THREE.BufferGeometry {
    const bevel = size * 0.11, half = size / 2 - bevel, chamfer = half * 0.36;
    const shape = new THREE.Shape();
    shape.moveTo(-half + chamfer, -half); shape.lineTo(half - chamfer, -half); shape.lineTo(half, -half + chamfer);
    shape.lineTo(half, half - chamfer); shape.lineTo(half - chamfer, half); shape.lineTo(-half + chamfer, half);
    shape.lineTo(-half, half - chamfer); shape.lineTo(-half, -half + chamfer); shape.closePath();
    const depth = size - 2 * bevel;
    const extruded = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel,
        bevelSize: bevel, bevelOffset: 0, bevelSegments: 1, curveSegments: 1 }).translate(0, 0, -depth / 2);
    const geometry = extruded.index ? extruded.toNonIndexed() : extruded;
    if (geometry !== extruded) extruded.dispose();
    geometry.deleteAttribute('uv');
    const position = geometry.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
        a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
        const normal = c.sub(b).cross(a.sub(b)).normalize();
        // Front cap: dark instrument panel behind the glyph. Front bevel: luminous perimeter.
        const luminance = normal.z > 0.95 ? 0.1
            : normal.z > 0.3 ? 1
            : normal.z < -0.3 ? 0.08
            : Math.max(0.06, 0.2 + 0.18 * normal.y + 0.05 * Math.abs(normal.x));
        colors.fill(luminance, i * 3, i * 3 + 9);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

/** Arrow glyph pointing along local +Y, so glyph rotation reuses the judge's CUT_VECTORS. */
function createArrowGeometry(size: number): THREE.BufferGeometry {
    const arrow = new THREE.Shape();
    arrow.moveTo(-size * 0.085, -size * 0.3); arrow.lineTo(size * 0.085, -size * 0.3);
    arrow.lineTo(size * 0.085, -size * 0.02); arrow.lineTo(size * 0.3, -size * 0.02);
    arrow.lineTo(0, size * 0.32); arrow.lineTo(-size * 0.3, -size * 0.02);
    arrow.lineTo(-size * 0.085, -size * 0.02); arrow.closePath();
    return new THREE.ShapeGeometry(arrow);
}

/** Free-cut glyph: dot inside a thin reticle ring, distinct from any arrow silhouette. */
function createDotGeometry(size: number): THREE.BufferGeometry {
    return mergeColoredParts([
        { geometry: new THREE.CircleGeometry(size * 0.1, 16), color: 0xffffff },
        { geometry: new THREE.RingGeometry(size * 0.19, size * 0.235, 24), color: 0xffffff }
    ]);
}

export class RhythmNoteField {
    readonly mesh: THREE.InstancedMesh;
    readonly markers: THREE.InstancedMesh;
    readonly arrows: THREE.InstancedMesh;
    private readonly dummy = new THREE.Object3D();
    private readonly capacity: number;
    constructor(config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG) {
        this.capacity = config.maxActiveNotes;
        const size = config.noteSizeMeters;
        this.mesh = new THREE.InstancedMesh(createTargetGeometry(size),
            new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), this.capacity);
        // Separate reusable glyph batches: dots are free cuts, arrows show blade travel direction.
        this.markers = new THREE.InstancedMesh(createDotGeometry(size),
            new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.capacity);
        this.arrows = new THREE.InstancedMesh(createArrowGeometry(size),
            new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.capacity);
        for (const mesh of [this.mesh, this.markers, this.arrows]) { mesh.count = 0; mesh.frustumCulled = false; }
    }
    /** `path` is the shared XR track projection; rendering never uses its own curve formula. */
    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, path?: XrTrackPath): void {
        let count = 0, dots = 0, arrows = 0;
        for (const entry of notes) {
            if (count >= this.capacity) break;
            const age = songTime - (entry.resolvedAt ?? entry.note.time);
            if (entry.status !== 'pending' && age > config.resolvedNoteLifetimeSec) continue;
            notePosition(entry.note, entry.status === 'hit' ? entry.resolvedAt ?? entry.note.time : songTime, this.dummy.position, config);
            path?.projectPlayfieldPoint(this.dummy.position);
            const scale = entry.status === 'hit' ? Math.max(0, 1 - age / config.resolvedNoteLifetimeSec) : 1;
            this.dummy.scale.setScalar(scale);
            this.dummy.rotation.z = 0;
            this.dummy.updateMatrix(); this.mesh.setMatrixAt(count, this.dummy.matrix);
            this.mesh.setColorAt(count, entry.status === 'hit' ? HIT : entry.status === 'missed' ? MISSED : COLORS[entry.note.hand]);
            this.dummy.position.z += config.noteSizeMeters * scale / 2 + 0.003;
            const cut = entry.note.cutDirection;
            const directed = cut && cut !== 'any';
            if (directed) { const [x, y] = CUT_VECTORS[cut]; this.dummy.rotation.z = Math.atan2(y, x) - Math.PI / 2; }
            const glyph = directed ? this.arrows : this.markers;
            const glyphIndex = directed ? arrows++ : dots++;
            this.dummy.updateMatrix(); glyph.setMatrixAt(glyphIndex, this.dummy.matrix);
            glyph.setColorAt(glyphIndex, entry.status === 'missed' ? GLYPH_MISSED : entry.note.pairId ? PAIRED : WHITE);
            count++;
        }
        this.mesh.count = count; this.markers.count = dots; this.arrows.count = arrows;
        for (const mesh of [this.mesh, this.markers, this.arrows]) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    }
    dispose(): void {
        for (const mesh of [this.mesh, this.markers, this.arrows]) { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    }
}
