// One-time static geometry authoring helpers for the XR scene (ADR-009). Everything here runs
// during construction only; nothing is called from a render hot path.

import * as THREE from 'three';

export interface ColoredPart {
    readonly geometry: THREE.BufferGeometry;
    readonly color: number;
    /** Optional per-vertex brightness multiplier, evaluated once in the part's final space. */
    readonly shade?: (x: number, y: number, z: number) => number;
}

/** Merges disposable parts into one non-indexed, vertex-colored geometry (one draw call). */
export function mergeColoredParts(parts: readonly ColoredPart[]): THREE.BufferGeometry {
    const flat = parts.map(part => (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry));
    const total = flat.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0);
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const color = new THREE.Color();
    let offset = 0;
    flat.forEach((geometry, index) => {
        const part = parts[index];
        const source = geometry.getAttribute('position');
        color.setHex(part.color);
        for (let i = 0; i < source.count; i++, offset++) {
            const x = source.getX(i), y = source.getY(i), z = source.getZ(i);
            const shade = part.shade ? part.shade(x, y, z) : 1, o = offset * 3;
            positions[o] = x; positions[o + 1] = y; positions[o + 2] = z;
            colors[o] = color.r * shade; colors[o + 1] = color.g * shade; colors[o + 2] = color.b * shade;
        }
    });
    for (let i = 0; i < parts.length; i++) {
        if (flat[i] !== parts[i].geometry) flat[i].dispose();
        parts[i].geometry.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    merged.computeBoundingSphere();
    return merged;
}

/** Axis-aligned box centered at (x, y, z). */
export function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
    return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** Flat floor ring arc lying in the XZ plane; theta 90 degrees points forward (-Z). */
export function floorArc(inner: number, outer: number, startDeg: number, lengthDeg: number, y: number): THREE.BufferGeometry {
    const segments = Math.max(2, Math.ceil(lengthDeg / 6));
    return new THREE.RingGeometry(inner, outer, segments, 1, THREE.MathUtils.degToRad(startDeg), THREE.MathUtils.degToRad(lengthDeg))
        .rotateX(-Math.PI / 2).translate(0, y, 0);
}

/** Radial floor tick centered at angle `deg`, spanning radii [from, to]. */
export function floorTick(from: number, to: number, deg: number, width: number, y: number): THREE.BufferGeometry {
    const angle = THREE.MathUtils.degToRad(deg), radius = (from + to) / 2;
    return new THREE.PlaneGeometry(width, to - from).rotateZ(angle - Math.PI / 2)
        .translate(Math.cos(angle) * radius, Math.sin(angle) * radius, 0).rotateX(-Math.PI / 2).translate(0, y, 0);
}
