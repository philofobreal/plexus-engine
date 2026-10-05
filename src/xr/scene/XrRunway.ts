// Scene-owned runway/playfield visuals for the /xr/ host (ADR-009). Purely decorative: nothing
// here is gameplay geometry, and the gameplay coordinate system is never moved. Floor travel is
// a pure projection of canonical song time onto a texture offset (phase = f(songTime)), so
// seeking reproduces the exact image, pausing freezes it, and nothing accumulates per frame.
// Floor and rail geometry is static after construction: the track bend is applied in the vertex
// shader from the shared `XrTrackPath` uniform (`installTrackBend`), so a path change uploads four
// floats instead of rewriting and re-uploading vertex positions.

import * as THREE from 'three';
import type { RhythmGameConfig } from '../../gameplay';
import { DEFAULT_STAGE_LAYOUT, SCENE_CONFIG, START_FRAME_HALF_WIDTH_METERS, type XrStageLayout } from './SceneConfig';
import { boxAt, floorTick, mergeColoredParts, type ColoredPart } from './SceneGeometry';
import { installTrackBend, writeTrackBendUniform, type XrTrackPath } from './XrTrackPath';

export const RUNWAY_PALETTE = {
    left: 0x39cfff,
    right: 0xff4fae,
    trace: 0x8fe6ff,
    dim: 0x3d8fb0,
    faint: 0x245a70
} as const;

const TEXTURE_WIDTH = 256;
const TEXTURE_HEIGHT = 128;
/** Half-width of the playable gate frame around the lanes, in playfield meters (height: the stage layout). */
const GATE_X = START_FRAME_HALF_WIDTH_METERS;

/** Normalized [0, 1) floor-pattern phase for a song time; pure and seek-safe. */
export function runwayPhase(songTime: number, scrollSpeedMps: number, tileLengthMeters: number = SCENE_CONFIG.runwayTileLengthMeters): number {
    if (!Number.isFinite(songTime) || !Number.isFinite(scrollSpeedMps) || !(tileLengthMeters > 0)) return 0;
    const cycles = songTime * scrollSpeedMps / tileLengthMeters;
    return cycles - Math.floor(cycles);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/** Box-filtered line coverage: `distance` from the line center, all values in meters. */
function coverage(distance: number, halfWidth: number, pixel: number): number {
    return Math.min(1, Math.max(0, 0.5 + (halfWidth - Math.abs(distance)) / pixel));
}

/**
 * One HUD-corridor tile, generated once: near-black glass, lane guides, a segmented depth marker,
 * edge ticks and side chevrons pointing toward the player. U spans the runway width; V spans one
 * tile along the travel axis. Bytes are sRGB.
 */
export function createRunwayPixels(width = TEXTURE_WIDTH, height = TEXTURE_HEIGHT): Uint8Array {
    const pixels = new Uint8Array(width * height * 4);
    const runwayWidth = SCENE_CONFIG.runwayWidthMeters, tile = SCENE_CONFIG.runwayTileLengthMeters;
    const px = runwayWidth / width, pz = tile / height, aa = Math.max(px, pz);
    const cyan = [57, 207, 255], magenta = [255, 79, 174], steel = [70, 150, 190];
    for (let j = 0; j < height; j++) {
        const z = (j + 0.5) * pz; // distance into the tile, increasing away from the player
        for (let i = 0; i < width; i++) {
            const x = (i + 0.5) / width * runwayWidth - runwayWidth / 2, ax = Math.abs(x);
            const hand = x < 0 ? cyan : magenta;
            let r = 6, g = 9, b = 18;
            const add = (color: readonly number[], amount: number) => { r += color[0] * amount; g += color[1] * amount; b += color[2] * amount; };
            // Rail-side sheen gives the corridor its edge colour identity.
            add(hand, 0.16 * smoothstep(1.3, 1.7, ax) ** 2);
            // Lane guides between and beside the three lanes: continuous and dim.
            for (const guide of [0.225, 0.675]) add(steel, 0.3 * coverage(ax - guide, 0.006, aa));
            // Playfield boundary: dashed, slightly brighter.
            if ((z % 0.5) < 0.34) add(steel, 0.5 * coverage(ax - 0.9, 0.008, aa));
            // Segmented transverse depth marker at the start of each tile.
            if (ax < 1.62 && (ax % 0.34) > 0.06) add(steel, 0.55 * coverage(z - 0.03, 0.012, aa));
            // Mid-tile edge ticks only.
            if (ax > 1.28 && ax < 1.6) add(hand, 0.4 * coverage(z - tile / 2, 0.01, aa));
            // Side-corridor chevrons pointing toward the player (toward smaller z).
            const local = Math.abs(ax - 1.18);
            if (local < 0.18) for (const apex of [0.55, 0.72]) {
                const distance = (z - apex - local * 0.65) / Math.hypot(1, 0.65);
                add(hand, 0.42 * coverage(distance, 0.013, aa));
            }
            const o = (j * width + i) * 4;
            pixels[o] = Math.min(255, Math.round(r)); pixels[o + 1] = Math.min(255, Math.round(g));
            pixels[o + 2] = Math.min(255, Math.round(b)); pixels[o + 3] = 255;
        }
    }
    return pixels;
}

/** Floor opacity along the stage: glassy near the player, dissolving toward the Wormhole. */
export function runwayFloorAlpha(z: number, frontZ: number = DEFAULT_STAGE_LAYOUT.runwayFrontZMeters): number {
    return 0.9 * (1 - smoothstep(-2.5, frontZ, z)) * (1 - 0.4 * smoothstep(0.5, SCENE_CONFIG.runwayBackZMeters, z));
}

/** Vertices beyond the straight zone (the only ones the GPU bend can move); counted once. */
function bendableCount(geometry: THREE.BufferGeometry): number {
    const position = geometry.getAttribute('position');
    let count = 0;
    for (let i = 0; i < position.count; i++) if (-position.getZ(i) > SCENE_CONFIG.trackBendStartMeters - 1e-6) count++;
    return count;
}

function additiveMaterial(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false });
}

export class XrRunway {
    /** Travelling floor surface, in root (floor) space. Named `runway` for the spatial contract. */
    readonly floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    /** Static rails, hit-plane floor line and calibration reticle, merged into one batch. */
    readonly linework: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    /** Hit gate brackets/row ticks in playfield space; frames the targets without covering them. */
    readonly gate: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly texture: THREE.DataTexture;
    private scrollSpeedMps: number;
    /** `uTrackBend` shared by the floor and rail materials; written only from the track path. */
    readonly bendUniform = { value: new THREE.Vector4() };
    private readonly bendable: number;
    private appliedPathRevision = -1;
    private lastSongTime = Number.NaN;
    private currentPhase = 0;

    /** Scrolls at the note approach speed so targets and floor read as one travelling space. */
    /** `layout` sets the hit-plane line, the runway length and the gate's rows (default: the historical stage). */
    constructor(config: Pick<RhythmGameConfig, 'noteSpeedMps' | 'rowSpacingMeters'>, layout: XrStageLayout = DEFAULT_STAGE_LAYOUT) {
        this.scrollSpeedMps = config.noteSpeedMps;
        const front = layout.runwayFrontZMeters, back = SCENE_CONFIG.runwayBackZMeters;
        const length = back - front, tile = SCENE_CONFIG.runwayTileLengthMeters;

        this.texture = new THREE.DataTexture(createRunwayPixels(), TEXTURE_WIDTH, TEXTURE_HEIGHT, THREE.RGBAFormat);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.RepeatWrapping;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.generateMipmaps = true;
        this.texture.anisotropy = 4; // grazing-angle floor; clamped to the device maximum
        this.texture.repeat.set(1, length / tile);
        this.texture.needsUpdate = true;

        // V runs from the back edge (z = back) to the far edge (z = front).
        const floorGeometry = new THREE.PlaneGeometry(SCENE_CONFIG.runwayWidthMeters, length, 1, Math.round(length * 2))
            .rotateX(-Math.PI / 2).translate(0, 0, (front + back) / 2);
        const positions = floorGeometry.getAttribute('position');
        const colors = new Float32Array(positions.count * 4);
        for (let i = 0; i < positions.count; i++) colors.set([1, 1, 1, runwayFloorAlpha(positions.getZ(i), front)], i * 4);
        floorGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
        this.floor = new THREE.Mesh(floorGeometry, new THREE.MeshBasicMaterial({ map: this.texture, vertexColors: true,
            transparent: true, depthWrite: false, toneMapped: false }));
        this.floor.name = 'runway';
        this.floor.renderOrder = -10;
        // Bent vertices can leave the straight bounding sphere; the stage is always in view anyway.
        this.floor.frustumCulled = false;

        this.linework = new THREE.Mesh(mergeColoredParts(XrRunway.lineworkParts(layout)), additiveMaterial());
        this.linework.name = 'runwayLinework';
        this.linework.renderOrder = -5;
        this.linework.frustumCulled = false;
        // Exactly straight until a path is applied (zero amplitudes; the path supplies the bend end).
        writeTrackBendUniform(this.bendUniform.value);
        installTrackBend(this.floor.material, this.bendUniform, 'xr-track-bend');
        installTrackBend(this.linework.material, this.bendUniform, 'xr-track-bend');
        this.bendable = bendableCount(floorGeometry) + bendableCount(this.linework.geometry);
        this.gate = new THREE.Mesh(mergeColoredParts(XrRunway.gateParts(config.rowSpacingMeters, layout)), additiveMaterial());
        this.gate.name = 'hitGate';
        this.gate.renderOrder = -5;
        this.update(0);
    }

    get phase(): number { return this.currentPhase; }

    /** Floor travel follows the note speed; the next `update` re-projects the phase. */
    setScrollSpeed(speedMps: number): void {
        if (!Number.isFinite(speedMps) || speedMps === this.scrollSpeedMps) return;
        this.scrollSpeedMps = speedMps;
        this.lastSongTime = Number.NaN;
    }

    /** Vertices that can ever bend (floor rows and rail segments beyond the straight zone). */
    get bendableVertexCount(): number { return this.bendable; }

    /**
     * Bends floor and rails along the shared track path (GPU, uniform only). The hit gate (playfield
     * space) and every vertex inside the straight zone stay put. Returns true only when the path
     * revision changed; vertex buffers are never rewritten or re-uploaded.
     */
    applyPath(path: XrTrackPath): boolean {
        if (path.revision === this.appliedPathRevision) return false;
        this.appliedPathRevision = path.revision;
        path.writeBendUniform(this.bendUniform.value);
        return true;
    }

    /** Projects song time onto the floor pattern. Returns true only when the offset changed. */
    update(songTime: number): boolean {
        if (!Number.isFinite(songTime) || songTime === this.lastSongTime) return false;
        this.lastSongTime = songTime;
        const phase = runwayPhase(songTime, this.scrollSpeedMps);
        if (phase === this.currentPhase && this.texture.offset.y === phase) return false;
        this.currentPhase = phase;
        this.texture.offset.y = phase; // uniform-only change; the texture is never re-uploaded
        return true;
    }

    dispose(): void {
        for (const mesh of [this.floor, this.linework, this.gate]) {
            mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose();
        }
        this.texture.dispose();
    }

    private static lineworkParts(layout: XrStageLayout): ColoredPart[] {
        const parts: ColoredPart[] = [];
        const y = 0.006;
        const railFade = (z: number) => (1 - smoothstep(-2.5, layout.runwayFrontZMeters, z)) * (1 - 0.45 * smoothstep(0.5, SCENE_CONFIG.runwayBackZMeters, z));
        // Rails are split so per-vertex fading follows the floor dissolve, and every 0.5 m inside the
        // bend zone so they follow the curved track as a smooth polyline.
        const stops: number[] = [SCENE_CONFIG.runwayBackZMeters, 0.5];
        for (let z = -SCENE_CONFIG.trackBendStartMeters; z >= layout.runwayFrontZMeters - 1e-9; z -= 0.5) stops.push(z);
        // A runway length that is not a whole number of 0.5 m steps still ends exactly at its front.
        if (stops[stops.length - 1] > layout.runwayFrontZMeters + 1e-9) stops.push(layout.runwayFrontZMeters);
        for (const side of [-1, 1]) for (let i = 0; i < stops.length - 1; i++) {
            const near = stops[i], far = stops[i + 1];
            parts.push({ geometry: boxAt(0.03, 0.01, near - far, side * SCENE_CONFIG.runwayWidthMeters / 2, y, (near + far) / 2),
                color: side < 0 ? RUNWAY_PALETTE.left : RUNWAY_PALETTE.right, shade: (_x, _y, z) => railFade(z) });
        }
        // Hit-plane floor line with hand-coloured end caps.
        const hitZ = -layout.playfieldForwardMeters;
        parts.push({ geometry: boxAt(1.5, 0.004, 0.022, 0, y + 0.001, hitZ), color: RUNWAY_PALETTE.trace, shade: () => 0.8 });
        for (const side of [-1, 1]) parts.push({ geometry: boxAt(0.05, 0.004, 0.05, side * 0.78, y + 0.001, hitZ),
            color: side < 0 ? RUNWAY_PALETTE.left : RUNWAY_PALETTE.right });
        // Orientation ticks at the player's origin. The rings themselves are the live progress ring
        // (XrProgressRing, Addendum K); ticks sit between its timeline band and its multiplier arcs.
        for (const cardinal of [0, 90, 180, 270]) {
            const forward = cardinal === 90;
            parts.push({ geometry: floorTick(0.415, forward ? 0.46 : 0.445, cardinal, forward ? 0.018 : 0.012, y),
                color: forward ? RUNWAY_PALETTE.trace : RUNWAY_PALETTE.dim, shade: () => (forward ? 1 : 0.7) });
        }
        return parts;
    }

    private static gateParts(rowSpacing: number, layout: XrStageLayout): ColoredPart[] {
        const parts: ColoredPart[] = [];
        const arm = 0.14, thick = 0.014, depth = 0.01;
        const cy = layout.frameCenterYMeters, halfY = layout.frameHalfHeightMeters;
        for (const sx of [-1, 1]) {
            const color = sx < 0 ? RUNWAY_PALETTE.left : RUNWAY_PALETTE.right;
            for (const sy of [-1, 1]) {
                parts.push({ geometry: boxAt(arm, thick, depth, sx * (GATE_X - arm / 2), cy + sy * halfY, 0), color });
                parts.push({ geometry: boxAt(thick, arm, depth, sx * GATE_X, cy + sy * (halfY - arm / 2), 0), color });
            }
            // Row ticks mark the hit heights (row 0 is y = -spacing); a thin pylon links them.
            for (let row = -1; row <= layout.rowCount - 2; row++) {
                parts.push({ geometry: boxAt(0.06, 0.012, depth, sx * (GATE_X - 0.045), row * rowSpacing, 0), color });
                parts.push({ geometry: boxAt(0.03, 0.008, depth, sx * (GATE_X + 0.07), row * rowSpacing, 0), color, shade: () => 0.5 });
            }
            parts.push({ geometry: boxAt(0.008, 2 * halfY - 0.3, depth, sx * (GATE_X + 0.1), cy, 0), color, shade: () => 0.3 });
        }
        // Bottom center notch; the top center is reserved for the section callout caption.
        parts.push({ geometry: boxAt(0.08, 0.01, depth, 0, cy - (halfY + 0.04), 0), color: RUNWAY_PALETTE.trace, shade: () => 0.6 });
        return parts;
    }
}
