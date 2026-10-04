import * as THREE from 'three';
import { CUT_VECTORS, DEFAULT_RHYTHM_GAME_CONFIG, notePosition, type NoteRuntimeState, type RhythmGameConfig } from '../../gameplay';
import { mergeColoredParts } from './SceneGeometry';
import type { XrTrackPath } from './XrTrackPath';
import type { XrNoteDesign } from '../XrAppearanceSettings';
/** Hand colours of the targets (shared with the slice effect). */
export const TARGET_COLORS = { left: new THREE.Color(0x39cfff), right: new THREE.Color(0xff4fae), either: new THREE.Color(0xffd35c) } as const;
const COLORS = TARGET_COLORS;
const WHITE = new THREE.Color(0xffffff);
const MISSED = new THREE.Color(0x3b2c47);
const PAIRED = new THREE.Color(0xffe2a0);
const GLYPH_MISSED = new THREE.Color(0x5d6478);
/** Scale and brightness of a target at its spawn point when the stage fades targets in. */
const SPAWN_SCALE = 0.6;
const SPAWN_BRIGHTNESS = 0.12;

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

/**
 * Flat-shaded, vertex-coloured copy of a geometry: each face gets a baked luminance from its
 * outward normal (the instance colour multiplies it), so a crystal stays one unlit instanced draw.
 */
function bakeFacets(source: THREE.BufferGeometry, luminance: (normal: THREE.Vector3) => number): THREE.BufferGeometry {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.deleteAttribute('uv');
    geometry.deleteAttribute('normal');
    const position = geometry.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), centroid = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
        a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
        centroid.copy(a).add(b).add(c).divideScalar(3);
        const normal = c.clone().sub(b).cross(a.clone().sub(b)).normalize();
        if (normal.dot(centroid) < 0) {
            // Inward winding (the shape is convex around its origin): swap two corners so the
            // outside is the rendered front face, and light the facet by its outward normal.
            position.setXYZ(i + 1, c.x, c.y, c.z); position.setXYZ(i + 2, b.x, b.y, b.z);
            normal.negate();
        }
        colors.fill(luminance(normal), i * 3, i * 3 + 9);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

/** Shard proportions relative to the target size: tip (toward the cut) and tail lengths, half-width, half-depth. */
export const SHARD_SHAPE = { tip: 0.64, tail: 0.3, halfWidth: 0.36, halfDepth: 0.2 } as const;

/** Crystal facet lighting: bright front facets (upper brightest, one side a little dimmer), dark back. */
function crystalLuminance(normal: THREE.Vector3): number {
    if (normal.z < -0.2) return 0.12;
    return (normal.y > 0 ? 1 : 0.78) * (normal.x >= 0 ? 1 : 0.86) * (0.75 + 0.25 * Math.max(0, normal.z));
}

/**
 * Directed Shard target: an asymmetric diamond bipyramid along local +Y whose long tip points the
 * way to cut (local +Y is rotated onto the judge's CUT_VECTORS, like the Classic arrow glyph).
 */
export function createShardGeometry(size: number): THREE.BufferGeometry {
    const { tip, tail, halfWidth, halfDepth } = SHARD_SHAPE;
    const top = new THREE.Vector3(0, tip * size, 0), bottom = new THREE.Vector3(0, -tail * size, 0);
    const ring = [new THREE.Vector3(halfWidth * size, 0, 0), new THREE.Vector3(0, 0, halfDepth * size),
        new THREE.Vector3(-halfWidth * size, 0, 0), new THREE.Vector3(0, 0, -halfDepth * size)];
    const vertices: number[] = [];
    for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        for (const v of [top, p, q, bottom, q, p]) vertices.push(v.x, v.y, v.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    return bakeFacets(geometry, crystalLuminance);
}

/** Free-cut Shard target: a symmetric gem (no direction to read), slowly turning. */
export function createGemGeometry(size: number): THREE.BufferGeometry {
    return bakeFacets(new THREE.OctahedronGeometry(size * 0.4, 0), crystalLuminance);
}

/** The glowing cut line along the Shard's front ridge, from tail to tip (rotated like the shard). */
export function createCutLineGeometry(size: number): THREE.BufferGeometry {
    const { tip, tail, halfDepth } = SHARD_SHAPE;
    const ridge = (y0: number, z0: number, y1: number, z1: number) => {
        const dy = y1 - y0, dz = z1 - z0, length = Math.hypot(dy, dz);
        // Lifted off the ridge along its outward normal so it never z-fights the facets.
        const ny = -dz / length, nz = dy / length, lift = 0.004 * Math.sign(nz || 1);
        return new THREE.BoxGeometry(size * 0.035, length, size * 0.02).rotateX(Math.atan2(dz, dy))
            .translate(0, (y0 + y1) / 2 + ny * lift, (z0 + z1) / 2 + Math.abs(nz) * Math.abs(lift));
    };
    return mergeColoredParts([
        { geometry: ridge(-tail * size, 0, 0, halfDepth * size), color: 0xffffff, shade: () => 0.7 },
        { geometry: ridge(0, halfDepth * size, tip * size, 0), color: 0xffffff }
    ]);
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
    private readonly bodyColor = new THREE.Color();
    private readonly glyphColor = new THREE.Color();
    private readonly size: number;
    private designValue: XrNoteDesign = 'classic';
    /** Distance over which pending targets grow and brighten after spawning (0 = off, historical). */
    private spawnFadeMeters = 0;
    constructor(config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG) {
        this.capacity = config.maxActiveNotes;
        const size = config.noteSizeMeters;
        this.size = size;
        this.mesh = new THREE.InstancedMesh(createTargetGeometry(size),
            new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), this.capacity);
        // Separate reusable glyph batches: dots are free cuts, arrows show blade travel direction.
        this.markers = new THREE.InstancedMesh(createDotGeometry(size),
            new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.capacity);
        this.arrows = new THREE.InstancedMesh(createArrowGeometry(size),
            new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.capacity);
        for (const mesh of [this.mesh, this.markers, this.arrows]) { mesh.count = 0; mesh.frustumCulled = false; }
    }
    get design(): XrNoteDesign { return this.designValue; }

    /**
     * Swaps the target style in place (presentation only; the same three instanced draws).
     * Classic: block body + arrow / dot glyph. Shard: shard body + glowing cut line; free cuts are gems
     * drawn by the marker batch.
     */
    setDesign(design: XrNoteDesign): void {
        if (design === this.designValue) return;
        this.designValue = design;
        const shard = design === 'shard', size = this.size;
        const swap = (mesh: THREE.InstancedMesh, geometry: THREE.BufferGeometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
        swap(this.mesh, shard ? createShardGeometry(size) : createTargetGeometry(size));
        swap(this.markers, shard ? createGemGeometry(size) : createDotGeometry(size));
        swap(this.arrows, shard ? createCutLineGeometry(size) : createArrowGeometry(size));
        // Gems carry baked facet shading like the bodies; dot glyphs are flat.
        const markerMaterial = this.markers.material as THREE.MeshBasicMaterial;
        markerMaterial.vertexColors = shard;
        markerMaterial.needsUpdate = true;
    }

    setSpawnFade(meters: number): void {
        this.spawnFadeMeters = Number.isFinite(meters) && meters > 0 ? meters : 0;
    }

    /**
     * `path` is the shared XR track projection; rendering never uses its own curve formula. Struck
     * targets are not drawn here: the slice effect (`XrSliceEffect`) splits them from the hit time.
     */
    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, path?: XrTrackPath): void {
        let count = 0, dots = 0, arrows = 0;
        const shard = this.designValue === 'shard';
        for (const entry of notes) {
            if (count + dots >= this.capacity) break;
            if (entry.status === 'hit') continue;
            const age = songTime - (entry.resolvedAt ?? entry.note.time);
            if (entry.status === 'missed' && age > config.resolvedNoteLifetimeSec) continue;
            notePosition(entry.note, songTime, this.dummy.position, config);
            path?.projectPlayfieldPoint(this.dummy.position);
            // Pending targets emerge from the far end: a pure function of their distance from spawn.
            const emerge = this.spawnFadeMeters > 0 && entry.status === 'pending'
                ? Math.min(1, Math.max(0, (config.approachTimeSec - (entry.note.time - songTime)) * config.noteSpeedMps / this.spawnFadeMeters)) : 1;
            const scale = SPAWN_SCALE + (1 - SPAWN_SCALE) * emerge;
            const brightness = SPAWN_BRIGHTNESS + (1 - SPAWN_BRIGHTNESS) * emerge;
            const cut = entry.note.cutDirection;
            const directed = !!cut && cut !== 'any';
            const angle = directed ? Math.atan2(CUT_VECTORS[cut][1], CUT_VECTORS[cut][0]) - Math.PI / 2 : 0;
            this.bodyColor.copy(entry.status === 'missed' ? MISSED : COLORS[entry.note.hand]);
            if (brightness < 1) this.bodyColor.multiplyScalar(brightness);
            this.glyphColor.copy(entry.status === 'missed' ? GLYPH_MISSED : entry.note.pairId ? PAIRED : WHITE);
            if (brightness < 1) this.glyphColor.multiplyScalar(brightness);
            this.dummy.scale.setScalar(scale);
            if (shard) {
                if (directed) {
                    // Shard body and its cut line share one transform: the tip points along the cut.
                    this.dummy.rotation.set(0, 0, angle);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(count, this.dummy.matrix); this.mesh.setColorAt(count, this.bodyColor);
                    this.arrows.setMatrixAt(arrows, this.dummy.matrix); this.arrows.setColorAt(arrows, this.glyphColor);
                    count++; arrows++;
                } else {
                    // Free cut: a turning gem in the hand colour (rotation is a pure function of song time).
                    this.dummy.rotation.set(0, songTime * 1.6 + entry.note.time, 0);
                    this.dummy.updateMatrix();
                    this.markers.setMatrixAt(dots, this.dummy.matrix); this.markers.setColorAt(dots, this.bodyColor);
                    dots++;
                }
                continue;
            }
            this.dummy.rotation.set(0, 0, 0);
            this.dummy.updateMatrix(); this.mesh.setMatrixAt(count, this.dummy.matrix);
            this.mesh.setColorAt(count, this.bodyColor);
            this.dummy.position.z += config.noteSizeMeters * scale / 2 + 0.003;
            this.dummy.rotation.z = angle;
            const glyph = directed ? this.arrows : this.markers;
            const glyphIndex = directed ? arrows++ : dots++;
            this.dummy.updateMatrix(); glyph.setMatrixAt(glyphIndex, this.dummy.matrix);
            glyph.setColorAt(glyphIndex, this.glyphColor);
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
