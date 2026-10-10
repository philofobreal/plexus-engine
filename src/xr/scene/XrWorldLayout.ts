// World Formation layout (ADR-010): where every structure slot, unit and drone of the world stands,
// in stage-root meters (player at the origin, forward = -Z, floor y = 0). Pure math, no Three.js:
// the renderer and the tests share it. The readability volume around the runway and the targets'
// approach is never entered by world geometry (the runway bends at most 2.4 m sideways / 1 m up
// beyond 2.5 m, the Tall overhead row tops out near eye height + 0.25 m).

import type { WorldStructureKind } from '../../gameplay/WorldTypes';

export interface Vec3 { x: number; y: number; z: number }

/** Clear corridor half-width (runway half-width 1.7 m + maximum lateral bend 2.4 m + margin). */
export const CLEAR_HALF_WIDTH = 4.3;
/** Clear height over the corridor near the player, and beyond the runway's far end. */
export const CLEAR_HEIGHT_NEAR = 4.6;
export const CLEAR_HEIGHT_FAR = 3.6;
/** Where the near clearance ends (beyond the longest runway, 18 m, plus margin). */
export const CLEAR_NEAR_Z = -21;

/** True when a point would sit in the targets' readability volume. */
export function insideReadabilityVolume(x: number, y: number, z: number): boolean {
    if (Math.abs(x) >= CLEAR_HALF_WIDTH) return false;
    if (z > 3) return y < 2.6 && Math.abs(x) < 1.2; // behind the player: only the player's own space
    return y < (z > CLEAR_NEAR_Z ? CLEAR_HEIGHT_NEAR : CLEAR_HEIGHT_FAR);
}

// ---- Localhost hall and Seeder structures -------------------------------------------------
export const PYLON_X = 6.2;
export const PYLON_HEIGHT = 7.2;
export const PYLON_WIDTH = 0.5;
export const RIB_HEIGHT = 0.34;
/** Conduits run along the corridor at this distance from the centre line. */
export const CONDUIT_X = 4.62;
export const WALL_X = 11.6;
export const WALL_HEIGHT = 8.4;
export const HALL_NEAR_Z = 2;
export const HALL_FAR_Z = -34;
export const FLOOR_INNER_X = 4.45;

export function pylonDepthZ(depth: number): number { return -7 - 4.6 * depth; }

/** Pylon slot 2k stands left at depth k, 2k + 1 right. Returns its base centre. */
export function pylonBase(slot: number): Vec3 {
    const depth = Math.floor(slot / 2), side = slot % 2 === 0 ? -1 : 1;
    return { x: side * PYLON_X, y: 0, z: pylonDepthZ(depth) };
}

/** Rib k spans the pylon pair at depth k, on their tops. */
export function ribCentre(slot: number): Vec3 { return { x: 0, y: PYLON_HEIGHT + RIB_HEIGHT / 2, z: pylonDepthZ(slot) }; }
export const RIB_LENGTH = 2 * PYLON_X + PYLON_WIDTH;

/** A conduit's two floor segments: from its pylon inward to the corridor rail, then toward the player. */
export function conduitSegments(slot: number): [Vec3, Vec3][] {
    const base = pylonBase(slot), side = Math.sign(base.x);
    const inner = { x: side * CONDUIT_X, y: 0.03, z: base.z };
    return [[{ x: side * (PYLON_X - PYLON_WIDTH / 2), y: 0.03, z: base.z }, inner], [inner, { x: inner.x, y: 0.03, z: base.z + 4.6 }]];
}

/** Sound-panel wall modules per side (static hall shell), near to far. */
export const WALL_PANELS_PER_SIDE = 16;
export function wallPanelCentre(index: number): Vec3 {
    const side = index < WALL_PANELS_PER_SIDE ? -1 : 1, k = index % WALL_PANELS_PER_SIDE;
    const step = (HALL_NEAR_Z - HALL_FAR_Z) / WALL_PANELS_PER_SIDE;
    return { x: side * WALL_X, y: WALL_HEIGHT / 2, z: HALL_NEAR_Z - step * (k + 0.5) };
}
export const WALL_PANEL_DEPTH = (HALL_NEAR_Z - HALL_FAR_Z) / WALL_PANELS_PER_SIDE - 0.12;

/** Seed cores: compact Seeder machines near each wall, between the second and third pylon pair. */
export function seedCore(side: -1 | 1): Vec3 { return { x: side * 9.4, y: 0.55, z: -14.5 }; }
/** Material nodes the collectors gather from (per side, near the wall). */
export function materialNode(side: -1 | 1, k: number): Vec3 { return { x: side * (10.2 - (k % 2) * 0.9), y: 0.04, z: -5.5 - 6.2 * k }; }
export const MATERIAL_NODES_PER_SIDE = 5;

// ---- Tudatter lattice ---------------------------------------------------------------------
/** Lattice node k: a crystalline information node above the hall, rising from the pylon rows. */
export function latticeNode(slot: number): Vec3 {
    const side = slot % 2 === 0 ? -1 : 1, depth = Math.floor(slot / 2);
    return { x: side * (4.2 + 0.9 * (depth % 2)), y: 10.2 + 1.3 * depth, z: -9.5 - 6.4 * depth };
}
/** Satellite crystals around a node (non-structural detail). */
export const SATELLITES_PER_NODE = 2;
export function latticeSatellite(slot: number, k: number): Vec3 {
    const node = latticeNode(slot), angle = (slot * 2.399 + k * Math.PI) % (2 * Math.PI);
    return { x: node.x + Math.cos(angle) * 1.4, y: node.y + (k === 0 ? 0.9 : -0.7), z: node.z + Math.sin(angle) * 1.4 };
}
/** Top of the pylon a lattice node grows from (continuity: Seeder structures become information nodes). */
export function latticeAnchor(slot: number): Vec3 {
    // The pylon one depth further on the same side (slot + 2 keeps the side parity).
    const base = pylonBase(Math.min(11, slot + 2));
    return { x: base.x, y: PYLON_HEIGHT, z: base.z };
}

// ---- Egis flow and the Fenom anomaly ------------------------------------------------------
export const FLOW_CENTRE: Vec3 = { x: 0, y: 13.5, z: -24 };
export const FLOW_INNER_RADIUS = 6;
export const FLOW_OUTER_RADIUS = 18;
/** Disc tilt toward the player (radians); its lowest point stays far above the corridor. */
export const FLOW_TILT = 0.2;

/** High above the targets' spawn area and in front of the 40 m Wormhole plane (camera far plane: 50 m). */
export const FENOM_CENTRE: Vec3 = { x: 0, y: 11, z: -34 };
export const FENOM_RING_RADII: readonly number[] = [3.1, 4.25, 5.4];
export const FENOM_CORE_RADIUS = 1.3;
export const FENOM_MEMBRANE_RADIUS = 2.4;
export const FENOM_FILAMENTS = 12;

export function structureAnchor(kind: WorldStructureKind, slot: number): Vec3 {
    switch (kind) {
        case 'pylon': { const b = pylonBase(slot); return { x: b.x, y: PYLON_HEIGHT * 0.5, z: b.z }; }
        case 'conduit': return conduitSegments(slot)[0][1];
        case 'rib': return ribCentre(slot);
        case 'node': return latticeNode(slot);
        case 'ring': return { ...FENOM_CENTRE };
    }
}

// ---- Dragonfly drones ---------------------------------------------------------------------
/** Patrol: slow figure-eight orbits high over each side of the hall (deterministic per drone). */
export function dronePatrol(index: number, time: number, out: Vec3): Vec3 {
    const side = index % 2 === 0 ? -1 : 1, lane = Math.floor(index / 2);
    const phase = index * 1.618 + time * (0.16 + 0.015 * (lane % 3));
    out.x = side * (8.2 + 1.6 * Math.sin(phase * 2));
    out.y = 9.5 + 1.2 * (lane % 3) + 0.5 * Math.sin(phase * 1.3);
    out.z = -18 + 11 * Math.sin(phase);
    return out;
}

/** Scan: a pass along one pylon row at pylon-top height, inspecting the structures. */
export function droneScan(index: number, progress: number, variant: number, out: Vec3): Vec3 {
    const side = (index + variant) % 2 === 0 ? -1 : 1;
    const p = Math.min(1, Math.max(0, progress));
    out.x = side * (PYLON_X + 0.9 + 0.35 * (index % 3));
    out.y = 5.2 + 0.8 * (index % 3) + 0.6 * Math.sin(p * Math.PI * 4 + index);
    out.z = -4 + (HALL_FAR_Z + 6) * p - 1.4 * (index % 3);
    return out;
}

/** Formation: a rotating geometric ring over the far hall (polygon per variant). */
export function droneFormation(index: number, count: number, time: number, variant: number, out: Vec3): Vec3 {
    const angle = (index / Math.max(1, count)) * Math.PI * 2 + time * (variant % 2 === 0 ? 0.35 : -0.35);
    const radius = 5.6 + (variant === 2 ? 1.2 * Math.cos(angle * 3) : 0);
    out.x = Math.cos(angle) * radius;
    out.y = 10.5 + Math.sin(angle) * radius * 0.45;
    out.z = -26 + Math.sin(angle) * radius * 0.5;
    return out;
}

/** Field: synchronized orbits around the Fenom on its ring radii, drawing the field together. */
export function droneField(index: number, count: number, time: number, alignment: number, out: Vec3): Vec3 {
    const ring = index % FENOM_RING_RADII.length;
    const angle = (index / Math.max(1, count)) * Math.PI * 2 + time * (0.5 + 0.15 * ring);
    const radius = FENOM_RING_RADII[ring] + 1.1;
    const wobble = (1 - alignment) * 0.9 * Math.sin(time * 1.7 + index);
    out.x = FENOM_CENTRE.x + Math.cos(angle) * radius;
    // Flattened vertically so the lowest drone stays above the far clearance (y > 3.6 m).
    out.y = FENOM_CENTRE.y + Math.sin(angle) * radius * 0.7 + wobble;
    out.z = FENOM_CENTRE.z + 1.5 + Math.sin(angle * 2 + index) * 0.6;
    return out;
}
