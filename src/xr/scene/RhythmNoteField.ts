// Instanced targets of the /xr/ host (ADR-009): three draws (bodies, free-cut markers, directed
// glyphs) from fixed-capacity pools, in Classic or Shard design.
//
// Travel runs on the GPU. Which targets are drawn stays a CPU decision over the session's bounded
// active window, and the CPU writes event-scope instance data -- canonical lane/row position, note
// time (relative to a write epoch), cut angle or gem phase, base colour, drawing mode -- only when
// that drawn set or a target's status changes (spawn, hit, miss, expiry, seek, design, config).
// Every frame the vertex shader derives the canonical travel z from the song-time uniform, bends
// it with the shared track path (`TRACK_BEND_GLSL`; `XrTrackPath` stays the one parameter
// authority and CPU judging keeps `notePosition`), and applies spawn growth / brightness, cut
// rotation, the Classic glyph lift and the turning gem. A path change is a uniform update.

import * as THREE from 'three';
import { CUT_VECTORS, DEFAULT_RHYTHM_GAME_CONFIG, notePosition, type CutDirection, type NoteRuntimeState, type RhythmGameConfig } from '../../gameplay';
import { mergeColoredParts } from './SceneGeometry';
import { markAttributesWritten } from './InstanceUploads';
import { TRACK_BEND_GLSL, writeTrackBendUniform, type XrTrackPath } from './XrTrackPath';
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

const glslFloat = (value: number): string => (Number.isInteger(value) ? `${value}.0` : String(value));
const TWO_PI = Math.PI * 2;
/** Free-cut gems turn at this rate (radians per song second). */
const GEM_SPIN = 1.6;
/** Instance drawing modes (`aNoteStyle.w`, plus 4 when the target emerges from spawn). */
const MODE_ROLL = 0, MODE_GLYPH = 1, MODE_GEM = 2, EMERGES = 4;
/** Roll of each directed cut (the judge's finite vector set, computed once): local +Y onto CUT_VECTORS. */
const CUT_ANGLES = Object.fromEntries(Object.entries(CUT_VECTORS).map(([cut, [x, y]]) => [cut, Math.atan2(y, x) - Math.PI / 2])) as
    Record<Exclude<CutDirection, 'any'>, number>;

const NOTE_DECLARATIONS = /* glsl */ `
attribute vec4 aNoteBase;
attribute vec4 aNoteStyle;
uniform float uNoteTime;
uniform float uNoteSpeed;
uniform float uNoteApproach;
uniform float uNoteSpawnFade;
uniform float uNoteSize;
uniform float uTrackForward;
varying vec3 vNoteColor;
${TRACK_BEND_GLSL}`;

/**
 * Target placement (`aNoteBase` = canonical x, y, epoch-relative note time, cut angle or gem phase;
 * `aNoteStyle` = base colour, mode). Canonical z is `notePosition`'s (song time - note time) x
 * speed; the centre then follows the track path exactly like `XrTrackPath.projectPlayfieldPoint`.
 */
export const NOTE_MOTION_GLSL = /* glsl */ `
	float noteEmergeOn = step( 3.5, aNoteStyle.w );
	float noteMode = aNoteStyle.w - 4.0 * noteEmergeOn;
	float noteAhead = aNoteBase.z - uNoteTime;
	float noteEmerge = ( noteEmergeOn > 0.5 && uNoteSpawnFade > 0.0 )
		? clamp( ( uNoteApproach - noteAhead ) * uNoteSpeed / uNoteSpawnFade, 0.0, 1.0 ) : 1.0;
	float noteScale = ${glslFloat(SPAWN_SCALE)} + ( 1.0 - ${glslFloat(SPAWN_SCALE)} ) * noteEmerge;
	vec3 noteCentre = vec3( aNoteBase.xy, ( uNoteTime - aNoteBase.z ) * uNoteSpeed );
	noteCentre.xy += xrTrackPathOffset( noteCentre.z - uTrackForward );
	vec3 noteLocal = transformed * noteScale;
	if ( noteMode > 1.5 ) {
		float noteSpin = aNoteBase.w + uNoteTime * ${glslFloat(GEM_SPIN)};
		noteLocal = vec3( cos( noteSpin ) * noteLocal.x + sin( noteSpin ) * noteLocal.z, noteLocal.y, -sin( noteSpin ) * noteLocal.x + cos( noteSpin ) * noteLocal.z );
	} else {
		if ( noteMode > 0.5 ) noteCentre.z += uNoteSize * noteScale * 0.5 + 0.003;
		noteLocal = vec3( cos( aNoteBase.w ) * noteLocal.x - sin( aNoteBase.w ) * noteLocal.y, sin( aNoteBase.w ) * noteLocal.x + cos( aNoteBase.w ) * noteLocal.y, noteLocal.z );
	}
	transformed = noteCentre + noteLocal;
	vNoteColor = aNoteStyle.rgb * ( ${glslFloat(SPAWN_BRIGHTNESS)} + ( 1.0 - ${glslFloat(SPAWN_BRIGHTNESS)} ) * noteEmerge );`;

/** Uniforms shared by the three note materials (live objects; written by `update`). */
export interface NoteUniforms {
    readonly uNoteTime: { value: number };
    readonly uNoteSpeed: { value: number };
    readonly uNoteApproach: { value: number };
    readonly uNoteSpawnFade: { value: number };
    readonly uNoteSize: { value: number };
    readonly uTrackBend: { value: THREE.Vector4 };
    readonly uTrackForward: { value: number };
}

function installNoteMotion(material: THREE.MeshBasicMaterial, uniforms: NoteUniforms, cacheKey: string): void {
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        if (!shader.vertexShader.includes('#include <begin_vertex>') || !shader.fragmentShader.includes('#include <color_fragment>')) {
            throw new Error('Note field: unexpected built-in shader chunks.');
        }
        shader.vertexShader = `${NOTE_DECLARATIONS}\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>${NOTE_MOTION_GLSL}`);
        shader.fragmentShader = `varying vec3 vNoteColor;\n${shader.fragmentShader}`
            .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vNoteColor;');
    };
    material.customProgramCacheKey = () => cacheKey;
}

const NOTE_ATTRIBUTES = ['aNoteBase', 'aNoteStyle'] as const;

/** Per-instance event data of one pool (`aNoteBase`, `aNoteStyle`), allocated once. */
function noteAttributes(capacity: number): THREE.InstancedBufferAttribute[] {
    return NOTE_ATTRIBUTES.map(() => new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage));
}

function attach(geometry: THREE.BufferGeometry, attributes: readonly THREE.InstancedBufferAttribute[]): THREE.BufferGeometry {
    attributes.forEach((attribute, i) => geometry.setAttribute(NOTE_ATTRIBUTES[i], attribute));
    return geometry;
}

/** Which pool an entry draws into, given the design (the same rules as the former CPU path). */
function drawsBody(shard: boolean, directed: boolean): boolean { return !shard || directed; }

export class RhythmNoteField {
    readonly mesh: THREE.InstancedMesh;
    readonly markers: THREE.InstancedMesh;
    readonly arrows: THREE.InstancedMesh;
    /** Shader inputs shared by the three draws. */
    readonly uniforms: NoteUniforms;
    private readonly capacity: number;
    private readonly size: number;
    private designValue: XrNoteDesign = 'classic';
    /** Distance over which pending targets grow and brighten after spawning (0 = off, historical). */
    private spawnFadeMeters = 0;
    private readonly attributes: Map<THREE.InstancedMesh, THREE.InstancedBufferAttribute[]> = new Map();
    private readonly position = { x: 0, y: 0, z: 0 };
    /** The written drawn set (entry, note id and status per slot) and the inputs it was built from. */
    private readonly slotEntries: (NoteRuntimeState | null)[] = [];
    private readonly slotIds: string[] = [];
    private readonly slotStatus: string[] = [];
    private slotCount = 0;
    private writtenConfig: RhythmGameConfig | null = null;
    private writtenDesign: XrNoteDesign | null = null;
    private writtenPath: XrTrackPath | undefined;
    private writtenPathRevision = -1;
    private epoch = 0;
    /** Instance-data writes so far: once per changed drawn set, never per frame (diagnostics/tests). */
    writes = 0;

    constructor(config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG) {
        this.capacity = config.maxActiveNotes;
        const size = config.noteSizeMeters;
        this.size = size;
        this.uniforms = { uNoteTime: { value: 0 }, uNoteSpeed: { value: config.noteSpeedMps }, uNoteApproach: { value: config.approachTimeSec },
            uNoteSpawnFade: { value: 0 }, uNoteSize: { value: size }, uTrackBend: { value: writeTrackBendUniform(new THREE.Vector4()) as THREE.Vector4 },
            uTrackForward: { value: 0 } };
        const material = (options: THREE.MeshBasicMaterialParameters, key: string) => {
            const created = new THREE.MeshBasicMaterial(options);
            installNoteMotion(created, this.uniforms, key);
            return created;
        };
        const pool = (geometry: THREE.BufferGeometry, options: THREE.MeshBasicMaterialParameters, key: string) => {
            const attributes = noteAttributes(this.capacity);
            const mesh = new THREE.InstancedMesh(attach(geometry, attributes), material(options, key), this.capacity);
            this.attributes.set(mesh, attributes);
            return mesh;
        };
        this.mesh = pool(createTargetGeometry(size), { vertexColors: true, toneMapped: false }, 'xr-note-bodies');
        // Separate reusable glyph batches: dots are free cuts, arrows show blade travel direction.
        this.markers = pool(createDotGeometry(size), { color: 0xffffff, toneMapped: false }, 'xr-note-markers');
        this.arrows = pool(createArrowGeometry(size), { color: 0xffffff, toneMapped: false }, 'xr-note-arrows');
        // Instance matrices stay identity and are never re-uploaded: the shader places every instance.
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
        const swap = (mesh: THREE.InstancedMesh, geometry: THREE.BufferGeometry) => {
            mesh.geometry.dispose(); mesh.geometry = attach(geometry, this.attributes.get(mesh)!);
        };
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
        this.uniforms.uNoteSpawnFade.value = this.spawnFadeMeters;
    }

    /**
     * `path` is the shared XR track projection; rendering never uses its own curve parameters. Struck
     * targets are not drawn here: the slice effect (`XrSliceEffect`) splits them from the hit time.
     */
    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, path?: XrTrackPath): void {
        // Which targets are drawn (and in which pool) is decided here, over the bounded active window.
        let count = 0, dots = 0, slots = 0;
        let changed = config !== this.writtenConfig || this.designValue !== this.writtenDesign || path !== this.writtenPath;
        const shard = this.designValue === 'shard';
        for (const entry of notes) {
            if (count + dots >= this.capacity) break;
            if (entry.status === 'hit') continue;
            const age = songTime - (entry.resolvedAt ?? entry.note.time);
            if (entry.status === 'missed' && age > config.resolvedNoteLifetimeSec) continue;
            if (this.slotEntries[slots] !== entry || this.slotIds[slots] !== entry.note.id || this.slotStatus[slots] !== entry.status) changed = true;
            this.slotEntries[slots] = entry; this.slotIds[slots] = entry.note.id; this.slotStatus[slots] = entry.status;
            slots++;
            const cut = entry.note.cutDirection, directed = !!cut && cut !== 'any';
            if (drawsBody(shard, directed)) count++; else dots++;
            if (!shard && !directed) dots++;
        }
        if (slots !== this.slotCount) changed = true;
        if (changed) this.write(slots, songTime, config, path);
        if (path && path.revision !== this.writtenPathRevision) {
            this.writtenPathRevision = path.revision;
            path.writeBendUniform(this.uniforms.uTrackBend.value);
            this.uniforms.uTrackForward.value = path.playfieldForwardMeters;
        }
        const u = this.uniforms;
        u.uNoteTime.value = songTime - this.epoch;
        u.uNoteSpeed.value = config.noteSpeedMps; u.uNoteApproach.value = config.approachTimeSec; u.uNoteSize.value = config.noteSizeMeters;
    }

    dispose(): void {
        for (const mesh of [this.mesh, this.markers, this.arrows]) { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    }

    /** Rewrites every drawn target's event-scope data from canonical state (note, status, config). */
    private write(slots: number, songTime: number, config: RhythmGameConfig, path: XrTrackPath | undefined): void {
        this.writes++;
        this.epoch = songTime;
        this.slotCount = slots;
        this.writtenConfig = config; this.writtenDesign = this.designValue;
        if (path !== this.writtenPath) {
            this.writtenPath = path;
            this.writtenPathRevision = -1;
            // Without a path the targets travel straight.
            if (!path) { writeTrackBendUniform(this.uniforms.uTrackBend.value); this.uniforms.uTrackForward.value = 0; }
        }
        const shard = this.designValue === 'shard';
        const [bodyBase, bodyStyle] = this.attributes.get(this.mesh)!.map(a => a.array as Float32Array);
        const [markerBase, markerStyle] = this.attributes.get(this.markers)!.map(a => a.array as Float32Array);
        const [arrowBase, arrowStyle] = this.attributes.get(this.arrows)!.map(a => a.array as Float32Array);
        let count = 0, dots = 0, arrows = 0;
        const position = this.position;
        let noteTime = 0;
        const put = (base: Float32Array, style: Float32Array, i: number, angle: number, color: THREE.Color, mode: number) => {
            const o = i * 4;
            base[o] = position.x; base[o + 1] = position.y; base[o + 2] = noteTime; base[o + 3] = angle;
            style[o] = color.r; style[o + 1] = color.g; style[o + 2] = color.b; style[o + 3] = mode;
        };
        for (let slot = 0; slot < slots; slot++) {
            const entry = this.slotEntries[slot]!, note = entry.note;
            // Canonical lane/row placement from the gameplay authority (z = 0 at the note time; travel is the GPU's).
            notePosition(note, note.time, position, config);
            noteTime = note.time - this.epoch;
            const emerges = entry.status === 'pending' ? EMERGES : 0;
            const cut = note.cutDirection, directed = !!cut && cut !== 'any';
            const angle = directed ? CUT_ANGLES[cut] : 0;
            const body = entry.status === 'missed' ? MISSED : COLORS[note.hand];
            const glyph = entry.status === 'missed' ? GLYPH_MISSED : note.pairId ? PAIRED : WHITE;
            if (shard) {
                if (directed) {
                    // Shard body and its cut line share one transform: the tip points along the cut.
                    put(bodyBase, bodyStyle, count++, angle, body, MODE_ROLL + emerges);
                    put(arrowBase, arrowStyle, arrows++, angle, glyph, MODE_ROLL + emerges);
                } else {
                    // Free cut: a turning gem in the hand colour (rotation is a pure function of song time).
                    put(markerBase, markerStyle, dots++, (this.epoch * GEM_SPIN + note.time) % TWO_PI, body, MODE_GEM + emerges);
                }
                continue;
            }
            put(bodyBase, bodyStyle, count++, 0, body, MODE_ROLL + emerges);
            if (directed) put(arrowBase, arrowStyle, arrows++, angle, glyph, MODE_GLYPH + emerges);
            else put(markerBase, markerStyle, dots++, 0, glyph, MODE_GLYPH + emerges);
        }
        this.mesh.count = count; this.markers.count = dots; this.arrows.count = arrows;
        // Only the drawn prefix of each pool is uploaded; an empty batch uploads nothing.
        markAttributesWritten(this.attributes.get(this.mesh)!, count);
        markAttributesWritten(this.attributes.get(this.markers)!, dots);
        markAttributesWritten(this.attributes.get(this.arrows)!, arrows);
    }
}
