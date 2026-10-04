// Section gates travelling down the runway (ADR-009 Addendum L). Each upcoming section sends an
// outline frame -- the start frame's corner brackets in the section's colour, with "<NAME> xweight"
// on its header rail -- that moves with the targets and docks into the start frame exactly when the
// section begins, where the section callout's arrival animation takes over.
//
// Pure function of canonical song time (z = (songTime - sectionStart) x note speed): pausing freezes
// it, seeking lands on the exact state. Gates have no fill and stay outside the lanes and rows, so
// they never hide a target. Cost: one instanced bracket draw plus one label draw per visible gate
// (at most two); the label atlas is drawn once per chart.

import * as THREE from 'three';
import type { RhythmGameConfig } from '../../gameplay';
import { boxAt, mergeColoredParts, type ColoredPart } from './SceneGeometry';
import type { ScoreOverview } from './XrScoreOverview';
import type { XrTrackPath } from './XrTrackPath';

/** Gates visible at once (the nearest upcoming boundaries). */
export const MAX_VISIBLE_GATES = 2;
/** Gate outline half-extents: identical to the start frame's callout frame, so a gate docks into it. */
export const GATE_HALF_WIDTH = 0.835;
/** Standard play space; `setFrame` follows the start frame of the active play space. */
export const GATE_HALF_HEIGHT = 0.635;
/** The outline sits this far outside the start frame's inner corner lines (as the callout frame does). */
const GATE_OUTSET = 0.035;
/** Labels fade out over the last stretch so they never collide with the start frame's caption. */
const LABEL_FADE_METERS = 1.2;
const LABEL_WIDTH = 0.62;
const LABEL_HEIGHT = LABEL_WIDTH / 8;
const ATLAS_WIDTH = 512;
const ATLAS_ROW = 64;
/** Fixed atlas size (the GPU texture is never resized); sections past it get a gate without a label. */
export const GATE_LABEL_ROWS = 32;
const FONT = '"Segoe UI", "Roboto", system-ui, sans-serif';
/** Brightness and scale of a gate as it spawns, before fading in (matches the targets). */
const SPAWN_BRIGHTNESS = 0.12;
const SPAWN_SCALE = 0.85;

/** One gate on screen: which section it announces and where it is. */
export interface GateState {
    /** Overview section index the gate announces. */
    section: number;
    /** Playfield z (negative = ahead of the start frame). */
    z: number;
    /** Distance travelled since spawning, in meters. */
    travelled: number;
}

/**
 * Upcoming gates at a song time, nearest first, at most `MAX_VISIBLE_GATES`. A gate exists for
 * every section after the first while its start is within the approach time. Allocation-free:
 * writes into `out` and returns the number of gates.
 */
export function gatesAt(overview: ScoreOverview, songTime: number, speedMps: number, approachSec: number, out: GateState[]): number {
    let count = 0;
    if (!Number.isFinite(songTime) || !(speedMps > 0) || !(approachSec > 0)) return 0;
    for (let i = 1; i < overview.sections.length && count < out.length; i++) {
        const remaining = overview.sections[i].start - songTime;
        if (remaining <= 0) continue;
        if (remaining > approachSec) break; // sections are ordered: later ones are even farther
        const gate = out[count++];
        gate.section = i;
        gate.z = -remaining * speedMps;
        gate.travelled = (approachSec - remaining) * speedMps;
    }
    return count;
}

function gateParts(halfHeight: number): ColoredPart[] {
    const parts: ColoredPart[] = [];
    const x = GATE_HALF_WIDTH, y = halfHeight, arm = 0.24, t = 0.012, d = 0.008;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        parts.push({ geometry: boxAt(arm, t, d, sx * (x - arm / 2), sy * y, 0), color: 0xffffff });
        parts.push({ geometry: boxAt(t, arm, d, sx * x, sy * (y - arm / 2), 0), color: 0xffffff });
    }
    // Header rail segments on both sides of the label, and a faint sill.
    for (const sx of [-1, 1]) parts.push({ geometry: boxAt(0.2, 0.006, d, sx * (LABEL_WIDTH / 2 + 0.12), y, 0), color: 0xffffff, shade: () => 0.6 });
    parts.push({ geometry: boxAt(0.5, 0.004, d, 0, -y, 0), color: 0xffffff, shade: () => 0.35 });
    return parts;
}

export class XrSectionGates {
    readonly root = new THREE.Group();
    readonly brackets: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly labels: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
    private readonly atlasCanvas: HTMLCanvasElement;
    private readonly atlas: THREE.CanvasTexture;
    private readonly gates: GateState[] = Array.from({ length: MAX_VISIBLE_GATES }, () => ({ section: -1, z: 0, travelled: 0 }));
    private readonly dummy = new THREE.Object3D();
    private readonly color = new THREE.Color();
    private readonly point = { x: 0, y: 0, z: 0 };
    private overview: ScoreOverview | null = null;
    private spawnFadeMeters = 0;
    private atlasDraws = 0;
    private centerY = 0;
    private halfHeight = GATE_HALF_HEIGHT;

    constructor(doc: Document = document) {
        this.brackets = new THREE.InstancedMesh(mergeColoredParts(gateParts(GATE_HALF_HEIGHT)),
            new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
                toneMapped: false }), MAX_VISIBLE_GATES);
        this.brackets.name = 'sectionGates';
        this.brackets.count = 0;
        this.brackets.frustumCulled = false;
        this.brackets.setColorAt(0, this.color.setRGB(1, 1, 1)); // allocates the instance colour buffer once
        this.brackets.renderOrder = -5;
        this.atlasCanvas = doc.createElement('canvas');
        this.atlasCanvas.width = ATLAS_WIDTH; this.atlasCanvas.height = ATLAS_ROW * GATE_LABEL_ROWS;
        this.atlas = new THREE.CanvasTexture(this.atlasCanvas);
        this.atlas.colorSpace = THREE.SRGBColorSpace;
        this.atlas.generateMipmaps = false;
        this.atlas.minFilter = THREE.LinearFilter;
        this.root.add(this.brackets);
        for (let i = 0; i < MAX_VISIBLE_GATES; i++) {
            // Each label samples its own atlas row; clones share the one uploaded image.
            const label = new THREE.Mesh(new THREE.PlaneGeometry(LABEL_WIDTH, LABEL_HEIGHT),
                new THREE.MeshBasicMaterial({ map: this.atlas.clone(), transparent: true, depthWrite: false, toneMapped: false }));
            label.name = `sectionGateLabel${i}`;
            label.visible = false;
            label.renderOrder = -4;
            this.labels.push(label);
            this.root.add(label);
        }
        this.root.visible = false;
    }

    /** Label atlas draws so far (once per chart). */
    get atlasDrawCount(): number { return this.atlasDraws; }

    setOverview(overview: ScoreOverview | null): void {
        this.overview = overview && overview.sections.length > 1 ? overview : null;
        this.root.visible = this.overview !== null;
        this.brackets.count = 0;
        for (const label of this.labels) label.visible = false;
        if (this.overview) this.drawAtlas(this.overview);
    }

    /**
     * Start frame extent of the play space (center height and inner half-height, playfield meters):
     * the outline is rebuilt once so a gate still docks exactly onto the frame.
     */
    setFrame(centerY: number, innerHalfHeight: number): void {
        const halfHeight = innerHalfHeight + GATE_OUTSET;
        if (!Number.isFinite(centerY) || !(innerHalfHeight > 0) || (centerY === this.centerY && halfHeight === this.halfHeight)) return;
        this.centerY = centerY; this.halfHeight = halfHeight;
        this.brackets.geometry.dispose();
        this.brackets.geometry = mergeColoredParts(gateParts(halfHeight));
    }

    /** Outer half-height of the gate outline (follows the start frame). */
    get halfHeightMeters(): number { return this.halfHeight; }

    /** Targets and gates emerge over the same distance (0 = no fade, the historical stage). */
    setSpawnFade(meters: number): void {
        this.spawnFadeMeters = Number.isFinite(meters) && meters > 0 ? meters : 0;
    }

    update(songTime: number, config: Pick<RhythmGameConfig, 'noteSpeedMps' | 'approachTimeSec'>, path?: XrTrackPath): void {
        const overview = this.overview;
        if (!overview) return;
        const count = gatesAt(overview, songTime, config.noteSpeedMps, config.approachTimeSec, this.gates);
        for (let i = 0; i < MAX_VISIBLE_GATES; i++) {
            const label = this.labels[i];
            if (i >= count) { label.visible = false; continue; }
            const gate = this.gates[i], section = overview.sections[gate.section];
            const emerge = this.spawnFadeMeters > 0 ? Math.min(1, gate.travelled / this.spawnFadeMeters) : 1;
            // The whole gate plane shears with the track path (offset depends on z only).
            this.point.x = 0; this.point.y = 0; this.point.z = gate.z;
            path?.projectPlayfieldPoint(this.point);
            this.dummy.position.set(this.point.x, this.point.y + this.centerY, gate.z);
            this.dummy.scale.setScalar(SPAWN_SCALE + (1 - SPAWN_SCALE) * emerge);
            this.dummy.updateMatrix();
            this.brackets.setMatrixAt(i, this.dummy.matrix);
            this.brackets.setColorAt(i, this.color.setHex(section.color).multiplyScalar(SPAWN_BRIGHTNESS + (1 - SPAWN_BRIGHTNESS) * emerge));
            const scale = this.dummy.scale.x;
            label.position.set(this.point.x, this.point.y + this.centerY + (this.halfHeight + LABEL_HEIGHT / 2 + 0.012) * scale, gate.z);
            label.scale.setScalar(scale);
            label.material.opacity = emerge * Math.min(1, -gate.z / LABEL_FADE_METERS);
            label.visible = label.material.opacity > 0.01 && gate.section <= GATE_LABEL_ROWS;
            label.material.map!.offset.y = 1 - gate.section / GATE_LABEL_ROWS;
        }
        this.brackets.count = count;
        this.brackets.instanceMatrix.needsUpdate = true;
        if (this.brackets.instanceColor) this.brackets.instanceColor.needsUpdate = true;
    }

    dispose(): void {
        this.root.removeFromParent();
        this.brackets.dispose(); this.brackets.geometry.dispose(); this.brackets.material.dispose();
        for (const label of this.labels) { label.geometry.dispose(); label.material.map?.dispose(); label.material.dispose(); }
        this.atlas.dispose();
    }

    /** One row per gated section (sections 1..n-1, row = section - 1): "<TITLE>  x<weight>" in its colour. */
    private drawAtlas(overview: ScoreOverview): void {
        this.atlasDraws++;
        const rows = Math.min(GATE_LABEL_ROWS, overview.sections.length - 1);
        const ctx = this.atlasCanvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, ATLAS_WIDTH, ATLAS_ROW * GATE_LABEL_ROWS);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        for (let r = 0; r < rows; r++) {
            const section = overview.sections[r + 1];
            const hex = `#${section.color.toString(16).padStart(6, '0')}`;
            const y = r * ATLAS_ROW + ATLAS_ROW / 2;
            ctx.fillStyle = 'rgba(2, 6, 16, 0.5)';
            ctx.fillRect(0, r * ATLAS_ROW + 8, ATLAS_WIDTH, ATLAS_ROW - 16);
            ctx.fillStyle = hex;
            ctx.font = `800 34px ${FONT}`;
            ctx.fillText(`${section.title}  ×${section.weight.toFixed(1)}`, ATLAS_WIDTH / 2, y + 1);
        }
        for (const label of this.labels) {
            const map = label.material.map!;
            map.repeat.set(1, 1 / GATE_LABEL_ROWS);
            map.needsUpdate = true;
        }
        this.atlas.needsUpdate = true;
    }
}
