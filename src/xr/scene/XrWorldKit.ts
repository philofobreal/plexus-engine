// World Formation kit (ADR-010): one small set of geometries and shader materials shared by the
// whole world, in one visual language -- dark graphite modules, smoked-glass crystals, thin
// emissive technical lines; cyan primary, restrained amber, violet / magenta only for the anomaly.
//
// Every draw is instanced from geometry authored once. Motion (rising structures, scaffold to
// solid, pulses, seeder loops, flow, ring alignment) is evaluated in the shaders from per-instance
// attributes written once per plan and from shared uniforms written per frame, so playback costs
// uniform updates, a small state attribute per changed snapshot and at most 12 drone matrices.

import * as THREE from 'three';

/** Palette (sRGB hex); converted to linear uniforms once. */
export const WORLD_PALETTE = {
    graphite: 0x10141b,
    steel: 0x3a4352,
    cyan: 0x39cfff,
    ice: 0xbfefff,
    amber: 0xffa63d,
    gold: 0xffd35c,
    violet: 0x9a6bff,
    magenta: 0xff4fae,
    white: 0xffffff
} as const;

/** Reaction codes shared by the CPU and the shaders. */
export const REACTION_CODE = { hit: 1, miss: 2, energize: 3, fault: 4, signal: 5, sync: 6, stabilize: 7, disrupt: 8 } as const;
export const MAX_SHADER_REACTIONS = 4;

/** Uniforms every world material reads (live objects; written by `XrWorld.update`). */
export interface WorldUniforms {
    readonly uTime: { value: number };
    /** industry, construction, lattice, flow */
    readonly uMix: { value: THREE.Vector4 };
    /** anomaly, stability, alignment, stage (0 none, 1 detection, 2 synchronization, 3 resolution) */
    readonly uField: { value: THREE.Vector4 };
    /** activation, coherence, formation, scan envelope */
    readonly uGlobal: { value: THREE.Vector4 };
    /** surge variant, age, strength, envelope */
    readonly uSurge: { value: THREE.Vector4 };
    /** scan side (-1/1), progress, 0, 0 */
    readonly uScan: { value: THREE.Vector4 };
    /** Latest reactions: time, structure, code, grade (1 perfect, 0.5 good, 0 none). */
    readonly uReact: { value: THREE.Vector4[] };
    readonly uCyan: { value: THREE.Color };
    readonly uIce: { value: THREE.Color };
    readonly uAmber: { value: THREE.Color };
    readonly uGold: { value: THREE.Color };
    readonly uViolet: { value: THREE.Color };
    readonly uMagenta: { value: THREE.Color };
    readonly uGraphite: { value: THREE.Color };
}

export function createWorldUniforms(): WorldUniforms {
    const color = (hex: number) => ({ value: new THREE.Color(hex) });
    return {
        uTime: { value: 0 }, uMix: { value: new THREE.Vector4(0.18, 0, 0, 0) }, uField: { value: new THREE.Vector4() },
        uGlobal: { value: new THREE.Vector4(0, 0.5, 0, 0) }, uSurge: { value: new THREE.Vector4() }, uScan: { value: new THREE.Vector4() },
        uReact: { value: Array.from({ length: MAX_SHADER_REACTIONS }, () => new THREE.Vector4(-1e6, -9, 0, 0)) },
        uCyan: color(WORLD_PALETTE.cyan), uIce: color(WORLD_PALETTE.ice), uAmber: color(WORLD_PALETTE.amber), uGold: color(WORLD_PALETTE.gold),
        uViolet: color(WORLD_PALETTE.violet), uMagenta: color(WORLD_PALETTE.magenta), uGraphite: color(WORLD_PALETTE.graphite)
    };
}

/** Uniform declarations and helpers shared by every world shader. */
export const WORLD_COMMON_GLSL = /* glsl */`
uniform float uTime;
uniform vec4 uMix;
uniform vec4 uField;
uniform vec4 uGlobal;
uniform vec4 uSurge;
uniform vec4 uScan;
uniform vec4 uReact[${MAX_SHADER_REACTIONS}];
uniform vec3 uCyan;
uniform vec3 uIce;
uniform vec3 uAmber;
uniform vec3 uGold;
uniform vec3 uViolet;
uniform vec3 uMagenta;
uniform vec3 uGraphite;

float worldHash(float n) { return fract(sin(n) * 43758.5453123); }

// Authored construction progress; an energized structure completes early (bounded speed-up).
float worldBuild(vec4 build, float energizedAt) {
    if (build.w > 0.5) return 1.0;
    float finish = build.y;
    if (energizedAt >= 0.0) finish = min(finish, max(energizedAt, build.x + 0.15));
    return clamp((uTime - build.x) / max(0.001, finish - build.x), 0.0, 1.0);
}

// Short local reactions of one structure: x = flash (hits, roles), y = disruption (misses, faults).
vec2 worldReaction(float structure) {
    vec2 r = vec2(0.0);
    for (int i = 0; i < ${MAX_SHADER_REACTIONS}; i++) {
        vec4 e = uReact[i];
        float age = uTime - e.x;
        if (age < 0.0 || age > 0.9 || abs(e.y - structure) > 0.5) continue;
        float fade = 1.0 - age / 0.9;
        if (e.z == 2.0 || e.z == 4.0 || e.z == 8.0) r.y = max(r.y, fade);
        else r.x = max(r.x, fade * (e.z >= 3.0 ? 1.0 : 0.35 + 0.35 * e.w));
    }
    return r;
}

// Atmospheric depth: far geometry recedes so the near targets keep the contrast.
float worldDepthFade(vec3 world) {
    return mix(1.0, 0.42, smoothstep(10.0, 40.0, distance(world, cameraPosition)));
}
`;

// ---- Structure bodies: hall panels, pylons, ribs (one opaque instanced draw) ----------------
export const BODY_KIND = { panel: 0, pylon: 1, rib: 2 } as const;

const BODY_VERTEX = /* glsl */`
attribute vec4 aPos;
attribute vec4 aSize;
attribute vec4 aBuild;
attribute vec4 aState;
varying vec3 vLocal;
varying vec3 vSize;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec4 vBuild;
varying vec4 vState;
varying float vKind;
varying float vSide;
void main() {
    vLocal = position + 0.5;
    vSize = aSize.xyz;
    vec3 p = position * aSize.xyz;
    p.y += aSize.y * 0.5;
    float c = cos(aPos.w), s = sin(aPos.w);
    p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z) + aPos.xyz;
    vNormalW = normalize(vec3(c * normal.x + s * normal.z, normal.y, -s * normal.x + c * normal.z));
    vBuild = aBuild;
    vState = aState;
    vKind = aSize.w;
    vSide = sign(aPos.x);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const BODY_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
varying vec3 vLocal;
varying vec3 vSize;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec4 vBuild;
varying vec4 vState;
varying float vKind;
varying float vSide;
void main() {
    bool hall = vBuild.z < -0.5;
    // Outlines appear two seconds before construction begins; unscheduled slots never do.
    if (!hall && uTime < vBuild.x - 2.0 && vBuild.w < 0.5) discard;
    // The Localhost walls recede as the information network emerges: they dematerialize from the
    // top into sparse scaffold lines, opening the hall toward the distance (never below 25%).
    float progress = hall ? 1.0 - 0.75 * smoothstep(0.2, 0.9, uMix.z) * (vKind < 0.5 ? 1.0 : 0.0) : worldBuild(vBuild, vState.y);
    vec3 edgeDist = (0.5 - abs(vLocal - 0.5)) * vSize;
    float h = vLocal.y * vSize.y;
    float buildLine = progress * vSize.y;
    float quality = hall ? 1.0 : vState.x;
    float industry = uMix.x;
    vec3 lineColor = mix(uCyan, uAmber, 0.35 * uMix.y * (1.0 - uMix.z));
    lineColor = mix(lineColor, uIce, 0.45 * uMix.z);
    if (h > buildLine) {
        // Scaffold: vertical edges and rings every 0.6 m, the outline the structure will fill.
        float edge = float((edgeDist.x < 0.035 && edgeDist.z < 0.035) || (edgeDist.y < 0.035 && (edgeDist.x < 0.035 || edgeDist.z < 0.035)));
        float ring = step(fract(h / 0.6), 0.05);
        if (edge + ring < 0.5) discard;
        float lead = hall ? 0.15 : smoothstep(2.0, 0.0, vBuild.x - uTime);
        gl_FragColor = vec4(mix(uCyan, uAmber, hall ? 0.0 : uMix.y) * (0.18 + 0.4 * lead) * worldDepthFade(vWorld), 1.0);
        #include <colorspace_fragment>
        return;
    }
    // Solid graphite with a soft key light.
    float light = 0.32 + 0.68 * max(0.0, dot(vNormalW, normalize(vec3(0.35, 1.0, 0.55))));
    vec3 color = uGraphite * light * (0.55 + 0.45 * industry);
    // Emissive technical lines per module kind.
    float strip = 0.0;
    if (vKind < 0.5) {
        // Sound panel: luminous floor and ceiling strips on the face toward the hall, panel seams.
        bool inner = dot(vNormalW, vec3(-vSide, 0.0, 0.0)) > 0.5;
        strip = inner ? max(step(abs(h - 0.35), 0.05), step(abs(h - (vSize.y - 0.6)), 0.04)) : 0.0;
        strip = max(strip, (inner ? 0.35 : 0.0) * step(edgeDist.z, 0.03));
    } else if (vKind < 1.5) {
        // Pylon: a vertical strip toward the corridor and bands every 1.8 m.
        bool inner = dot(vNormalW, vec3(-vSide, 0.0, 0.0)) > 0.5;
        strip = inner ? step(edgeDist.z, vSize.z * 0.5 - 0.05) * step(vSize.z * 0.5 - 0.11, edgeDist.z) : 0.0;
        strip = max(strip, 0.6 * step(fract(h / 1.8), 0.025));
    } else {
        // Rib: a strip along its underside.
        strip = vNormalW.y < -0.5 ? step(vSize.z * 0.5 - 0.05, edgeDist.z) : 0.0;
    }
    vec2 react = worldReaction(vBuild.z);
    float energized = vState.y >= 0.0 && uTime >= vState.y ? 1.0 : 0.0;
    float faulted = vState.z >= 0.0 && uTime >= vState.z ? 1.0 : 0.0;
    float flicker = quality < 0.45 ? 0.55 + 0.45 * step(0.35, worldHash(floor(uTime * 11.0) + vBuild.z * 7.0)) : 1.0;
    float glow = (hall ? 0.22 + 0.78 * uGlobal.x : 0.3 + 0.7 * uGlobal.x) * (0.28 + 0.72 * quality) * flicker;
    glow *= 1.0 - 0.6 * react.y;
    vec3 emit = lineColor * glow * (0.25 + 0.75 * industry);
    emit = mix(emit, uGold * glow, 0.55 * energized);
    emit = mix(emit, uMagenta * 0.5 * glow, faulted * (1.0 - energized) * 0.6);
    emit += uIce * react.x * 0.8;
    // Scan sweep up the scanned side, conduit-cascade surge wave toward the far hall.
    float scan = uGlobal.w * step(0.0, vSide * uScan.x) * smoothstep(0.35, 0.0, abs(vLocal.y - uScan.y));
    float wave = uSurge.w * (uSurge.x < 0.5 ? smoothstep(3.0, 0.0, abs(-vWorld.z - uSurge.y * 14.0)) : 0.4);
    emit += lineColor * (scan * 0.9 + wave * uSurge.z * 0.7);
    // The weld seam at the build line while rising.
    float seam = progress < 1.0 ? smoothstep(0.08, 0.0, abs(h - buildLine)) : 0.0;
    color += emit * strip + uAmber * seam * 1.2;
    gl_FragColor = vec4(color * worldDepthFade(vWorld), 1.0);
    #include <colorspace_fragment>
}`;

// ---- Hall floor (one opaque draw: two plates beside the corridor) ---------------------------
const FLOOR_VERTEX = /* glsl */`
varying vec3 vWorld;
varying vec3 vLocalPos;
void main() {
    vLocalPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FLOOR_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
varying vec3 vWorld;
varying vec3 vLocalPos;
void main() {
    float ax = abs(vLocalPos.x), z = vLocalPos.z;
    // Grid of luminous floor strips, revealed from the player outward by the activation.
    float gx = step(fract(ax / 1.8), 0.012), gz = step(fract(-z / 2.3), 0.01);
    float edge = smoothstep(0.08, 0.0, ax - 4.47);
    float reveal = smoothstep(0.0, 4.0, uGlobal.x * 40.0 + z + 2.0);
    float lines = max(max(gx, gz) * 0.5, edge) * (0.12 + 0.88 * reveal * uGlobal.x);
    vec3 line = mix(uCyan, uIce, 0.4 * uMix.z) * (0.25 + 0.75 * uMix.x);
    vec3 color = uGraphite * 0.35 + line * lines * 0.55;
    gl_FragColor = vec4(color * worldDepthFade(vWorld), 1.0);
    #include <colorspace_fragment>
}`;

// ---- Beams: conduits, lattice links, seed filaments, Fenom filaments (one additive draw) ----
export const BEAM_KIND = { conduit: 0, link: 1, seed: 2, filament: 3 } as const;

const BEAM_VERTEX = /* glsl */`
${WORLD_COMMON_GLSL}
attribute vec4 aFrom;
attribute vec4 aTo;
attribute vec4 aBuild;
attribute vec4 aState;
varying float vU;
varying float vLength;
varying float vKind;
varying vec4 vBuild;
varying vec4 vState;
varying vec3 vWorld;
void main() {
    vec3 dir = aTo.xyz - aFrom.xyz;
    float len = max(length(dir), 1e-4);
    vec3 d = dir / len;
    vec3 up = abs(d.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 side = normalize(cross(d, up));
    vec3 up2 = cross(side, d);
    // aBuild.w is the beam's pulse phase (beams are never prebuilt; hall beams use structure -1).
    float progress = aBuild.z < -0.5 ? 1.0 : worldBuild(vec4(aBuild.xyz, 0.0), aState.y);
    float along = position.y + 0.5;
    vU = along;
    vLength = len * progress;
    vKind = aTo.w;
    vBuild = aBuild;
    vState = aState;
    float width = aFrom.w;
    // Fenom filaments shiver while the field is unstable.
    vec3 jitter = aTo.w > 2.5 ? side * (1.0 - uField.y) * 0.12 * sin(uTime * 23.0 + along * 31.0 + aBuild.w) * uField.x : vec3(0.0);
    vec3 p = aFrom.xyz + d * (along * len * progress) + side * position.x * width + up2 * position.z * width + jitter;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const BEAM_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
varying float vU;
varying float vLength;
varying float vKind;
varying vec4 vBuild;
varying vec4 vState;
varying vec3 vWorld;
void main() {
    if (vBuild.z > -0.5 && uTime < vBuild.x) discard;
    float quality = vBuild.z < -0.5 ? 1.0 : vState.x;
    float d = vU * vLength;
    float ends = smoothstep(0.0, 0.25, d) * smoothstep(0.0, 0.25, vLength - d);
    vec2 react = worldReaction(vBuild.z);
    vec3 color;
    if (vKind < 0.5) {
        // Conduit: energy flowing toward the corridor; the hit that fed it rushes through.
        float pulse = smoothstep(0.82, 1.0, fract(d / 2.4 - uTime * 1.4 + vBuild.w));
        float base = (0.18 + 0.5 * quality) * (0.4 * uMix.x + 0.6 * max(uMix.y, 0.35 * uGlobal.x));
        float wave = uSurge.w * (uSurge.x < 0.5 ? smoothstep(3.0, 0.0, abs(-vWorld.z - uSurge.y * 14.0)) * uSurge.z : 0.0);
        color = mix(uCyan, uAmber, 0.5 * uMix.y) * (base + pulse * 0.6 * uGlobal.x + wave) + uIce * react.x;
        color *= 1.0 - 0.7 * react.y;
    } else if (vKind < 1.5) {
        // Lattice link: Max's ordered impulses, Egis's soft current through the same network.
        float impulse = smoothstep(0.9, 1.0, fract(d / 1.6 - uTime * 3.2 + vBuild.w));
        float current = 0.5 + 0.5 * sin(d * 0.9 - uTime * 0.8 + vBuild.w * 3.0);
        float flare = uSurge.x > 1.5 ? uSurge.w * uSurge.z : 0.0;
        color = uIce * uMix.z * ((0.12 + 0.35 * quality) + impulse * 0.9 + flare * 0.6)
            + mix(uViolet, uCyan, 0.5) * uMix.w * current * 0.35 + uIce * react.x * 1.2;
        color *= 1.0 - 0.7 * react.y;
    } else if (vKind < 2.5) {
        // Seed filament: fine shimmering threads from a seed core to its material.
        float shimmer = 0.5 + 0.5 * sin(d * 9.0 - uTime * 5.0 + vBuild.w);
        color = mix(uAmber, uCyan, 0.4) * uMix.y * (0.15 + 0.35 * shimmer);
    } else {
        // Fenom filament: violet field lines with electrical disturbances while unstable.
        float spark = step(0.93, worldHash(floor(uTime * 18.0) + floor(d * 4.0) + vBuild.w)) * (1.0 - uField.y);
        color = mix(uViolet, uMagenta, 0.5 + 0.5 * sin(d * 0.7 + uTime)) * uField.x * (0.2 + 0.5 * uField.y + spark * 1.4);
    }
    gl_FragColor = vec4(color * ends * worldDepthFade(vWorld), 1.0);
    #include <colorspace_fragment>
}`;

// ---- Lattice crystals (main nodes and satellites; one additive draw) ------------------------
const NODE_VERTEX = /* glsl */`
${WORLD_COMMON_GLSL}
attribute vec4 aNode;   // x, y, z, scale
attribute vec4 aBuild;
attribute vec4 aState;
varying vec3 vNormalW;
varying vec4 vBuild;
varying vec4 vState;
varying vec3 vWorld;
void main() {
    float progress = worldBuild(aBuild, aState.y);
    float grow = smoothstep(0.0, 1.0, progress) * (0.35 + 0.65 * uMix.z);
    float spin = uTime * 0.3 + aNode.x * 0.7 + aNode.z * 0.3;
    float c = cos(spin), s = sin(spin);
    vec3 p = vec3(c * position.x + s * position.z, position.y * 1.6, -s * position.x + c * position.z) * grow * aNode.w;
    vNormalW = normalize(vec3(c * normal.x + s * normal.z, normal.y, -s * normal.x + c * normal.z));
    vBuild = aBuild;
    vState = aState;
    vec4 world = modelMatrix * vec4(p + aNode.xyz, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const NODE_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
varying vec3 vNormalW;
varying vec4 vBuild;
varying vec4 vState;
varying vec3 vWorld;
void main() {
    if (uTime < vBuild.x) discard;
    vec3 view = normalize(cameraPosition - vWorld);
    float facet = 0.35 + 0.65 * abs(dot(vNormalW, normalize(vec3(0.2, 1.0, 0.4))));
    float rim = pow(1.0 - abs(dot(vNormalW, view)), 2.0);
    vec2 react = worldReaction(vBuild.z);
    float flare = uSurge.x > 1.5 ? uSurge.w * uSurge.z : 0.0;
    float quality = vState.x;
    vec3 crystal = mix(uIce, uCyan, rim) * (0.45 + 0.75 * quality) * facet + mix(uViolet, uCyan, rim) * uMix.w * 0.45 * rim;
    vec3 color = crystal * uMix.z * (0.75 + 0.5 * flare) + uIce * react.x * 1.5;
    color *= 1.0 - 0.6 * react.y;
    gl_FragColor = vec4(color * worldDepthFade(vWorld), 1.0);
    #include <colorspace_fragment>
}`;

// ---- Seeder units: seed cores, segmented collectors, folding fabricator arms (one draw) ----
export const SEEDER_KIND = { core: 0, collector: 1, arm: 2 } as const;

const SEEDER_VERTEX = /* glsl */`
${WORLD_COMMON_GLSL}
attribute vec4 aSeed;   // kind, side, unit, segment
attribute vec4 aPathA;  // from xyz, phase
attribute vec4 aPathB;  // to xyz, speed (0 = idle)
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vKind;
varying float vHead;
varying float vActive;
vec3 seederPath(vec3 a, vec3 b, float phase, float u) {
    vec3 mid = (a + b) * 0.5 + vec3(0.0, 0.0, 1.6 * sin(phase * 7.0));
    vec3 ab = mix(a, mid, u), bc = mix(mid, b, u);
    return mix(ab, bc, u);
}
void main() {
    float kind = aSeed.x;
    vKind = kind;
    vActive = aPathB.w > 0.0 ? 1.0 : 0.0;
    vec3 local = position;
    vec3 n = normal;
    vec3 origin;
    if (kind < 0.5) {
        // Seed core: compact dark cabinet with a slow hum while it fabricates.
        local *= vec3(1.0, 1.1, 1.0);
        origin = aPathA.xyz;
        vHead = 0.0;
    } else if (kind < 1.5) {
        // Collector segment: shuttles between material and the assembly point, the body trailing.
        float speed = max(aPathB.w, 0.05);
        float t = uTime - aSeed.w * 0.11;
        float s = fract(t * speed + aPathA.w);
        float u = 1.0 - abs(2.0 * s - 1.0);
        vec3 p0 = seederPath(aPathA.xyz, aPathB.xyz, aPathA.w, u);
        vec3 p1 = seederPath(aPathA.xyz, aPathB.xyz, aPathA.w, min(1.0, u + 0.02));
        vec3 tangent = normalize(p1 - p0 + vec3(1e-4, 0.0, 0.0));
        vec3 side = normalize(cross(tangent, vec3(0.0, 1.0, 0.0)) + vec3(0.0, 0.0, 1e-4));
        p0 += side * 0.07 * sin(u * 26.0 + uTime * 7.0 + aSeed.z);
        float yaw = atan(tangent.x, tangent.z);
        float c = cos(yaw), sn = sin(yaw);
        local *= vec3(0.16, 0.1, 0.24) * (aSeed.w < 0.5 ? 1.15 : 1.0 - 0.12 * aSeed.w);
        local = vec3(c * local.x + sn * local.z, local.y, -sn * local.x + c * local.z);
        n = vec3(c * n.x + sn * n.z, n.y, -sn * n.x + c * n.z);
        origin = p0 + vec3(0.0, 0.07, 0.0);
        vHead = aSeed.w < 0.5 ? 1.0 : 0.0;
    } else {
        // Fabricator arm: two segments folding over the assembly point.
        float a0 = 0.55 + 0.45 * sin(uTime * 2.4 + aSeed.z) * vActive;
        float a1 = a0 - 1.3 + 0.5 * sin(uTime * 3.1 + aSeed.z * 2.0) * vActive;
        float seg = aSeed.w;
        float angle = seg < 0.5 ? a0 : a1;
        vec3 base = aPathB.xyz + vec3(-aSeed.y * 0.9, 0.0, 0.0);
        vec3 joint = base + vec3(aSeed.y * sin(a0), cos(a0), 0.0) * 1.3;
        vec3 root = seg < 0.5 ? base : joint;
        local *= vec3(0.12, 1.3, 0.12);
        local.y += 0.65;
        float c = cos(angle), sn = sin(angle) * aSeed.y;
        local = vec3(c * local.x + sn * local.y, -sn * local.x + c * local.y, local.z);
        n = vec3(c * n.x + sn * n.y, -sn * n.x + c * n.y, n.z);
        origin = root;
        vHead = seg > 0.5 ? step(0.35, position.y) : 0.0;
    }
    vNormalW = normalize(n);
    vec4 world = modelMatrix * vec4(origin + local, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const SEEDER_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vKind;
varying float vHead;
varying float vActive;
void main() {
    float presence = max(uMix.y, 0.25 * uMix.x);
    if (presence < 0.02 && vKind > 0.5) discard;
    float light = 0.35 + 0.65 * max(0.0, dot(vNormalW, normalize(vec3(0.35, 1.0, 0.55))));
    vec3 color = uGraphite * 1.6 * light;
    float band = vKind < 0.5 ? step(abs(fract(vWorld.y * 1.7) - 0.5), 0.06) : 0.0;
    color += uAmber * (vHead * 0.9 + band * 0.6) * presence * (0.5 + 0.5 * vActive);
    color += uCyan * (vKind > 1.5 ? 0.25 : 0.0) * presence;
    gl_FragColor = vec4(color * worldDepthFade(vWorld), 1.0);
    #include <colorspace_fragment>
}`;

// ---- Egis flow: a slowly breathing spiral current of information points (one draw) --------
const FLOW_VERTEX = /* glsl */`
${WORLD_COMMON_GLSL}
uniform vec3 uFlowCentre;
uniform float uFlowTilt;
uniform float uViewportHeight;
attribute vec4 aFlowA; // radius, angle, height, speed
attribute vec4 aFlowB; // arm, size (meters), phase, brightness
varying float vAlpha;
varying vec3 vTint;
void main() {
    float r = aFlowA.x * (1.0 + 0.05 * sin(uTime * 0.45 + aFlowB.z));
    float angle = aFlowA.y + uTime * aFlowA.w * 7.0 / aFlowA.x + log(aFlowA.x) * 1.15;
    float scatter = (1.0 - uGlobal.y) * 0.9;
    vec3 p = vec3(cos(angle) * r, aFlowA.z + 0.6 * sin(uTime * 0.33 + aFlowB.z * 3.0), sin(angle) * r);
    p += scatter * vec3(sin(uTime * 2.1 + aFlowB.z * 5.0), sin(uTime * 1.7 + aFlowB.z * 3.0), cos(uTime * 1.9 + aFlowB.z * 7.0));
    float ct = cos(uFlowTilt), st = sin(uFlowTilt);
    p = vec3(p.x, ct * p.y + st * p.z, -st * p.y + ct * p.z) + uFlowCentre;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // A point is a world-sized glow: its pixel size follows the eye viewport and the projection.
    gl_PointSize = clamp(aFlowB.y * uViewportHeight * projectionMatrix[1][1] * 0.5 / max(1.0, -mv.z), 1.0, 14.0);
    float breathe = 0.75 + 0.25 * sin(uTime * 0.5 + aFlowB.z);
    float flare = uSurge.x > 1.5 ? uSurge.w * uSurge.z : 0.0;
    vAlpha = uMix.w * aFlowB.w * breathe * (0.7 + 0.5 * flare);
    vTint = mix(mix(uViolet, uCyan, fract(aFlowB.x * 0.37 + 0.2)), uIce, 0.25 * aFlowB.w);
    gl_Position = projectionMatrix * mv;
}`;

const FLOW_FRAGMENT = /* glsl */`
varying float vAlpha;
varying vec3 vTint;
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vTint * a, 1.0);
    #include <colorspace_fragment>
}`;

// ---- Fenom: stabilization rings, the dark focus and the iridescent membrane ----------------
const RING_VERTEX = /* glsl */`
${WORLD_COMMON_GLSL}
attribute vec4 aRing;   // radius, tiltX, tiltZ, index
attribute vec4 aBuild;
attribute vec4 aState;
varying float vAngle;
varying vec4 vBuild;
varying vec4 vState;
varying vec3 vWorld;
void main() {
    float progress = worldBuild(aBuild, aState.y);
    float grow = smoothstep(0.0, 1.0, progress);
    float misalign = 1.0 - uField.z;
    float jitter = (1.0 - uGlobal.y) * 0.08 * sin(uTime * 3.0 + aRing.w * 2.0) * uField.x;
    float spin = uTime * (0.18 + 0.07 * aRing.w) * (mod(aRing.w, 2.0) < 0.5 ? 1.0 : -1.0);
    vec3 p = position * aRing.x * grow;
    vAngle = atan(position.y, position.x);
    float cs = cos(spin), ss = sin(spin);
    p = vec3(cs * p.x - ss * p.y, ss * p.x + cs * p.y, p.z);
    float tx = aRing.y * misalign + jitter, tz = aRing.z * misalign;
    float cx = cos(tx), sx = sin(tx), cz = cos(tz), sz = sin(tz);
    p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
    p = vec3(cz * p.x - sz * p.y, sz * p.x + cz * p.y, p.z);
    vBuild = aBuild;
    vState = aState;
    vec4 world = modelMatrix * vec4(p + uFenomCentre, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const RING_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
varying float vAngle;
varying vec4 vBuild;
varying vec4 vState;
varying vec3 vWorld;
void main() {
    if (uTime < vBuild.x) discard;
    vec2 react = worldReaction(vBuild.z);
    float hue = 0.5 + 0.5 * sin(vAngle * 2.0 + uTime * 0.6);
    vec3 irid = mix(mix(uViolet, uCyan, hue), uMagenta, 0.3 * (1.0 - hue));
    float unstable = (1.0 - uField.y) * step(0.8, worldHash(floor(uTime * 14.0) + floor(vAngle * 3.0)));
    float intensity = uField.x * (0.22 + 0.5 * vState.x) * (0.55 + 0.45 * uField.y) * (1.0 - 0.6 * unstable);
    vec3 color = irid * intensity + uIce * react.x * 1.4 + uGold * uField.z * 0.15 * uField.x;
    color *= 1.0 - 0.5 * react.y;
    gl_FragColor = vec4(color * worldDepthFade(vWorld), 1.0);
    #include <colorspace_fragment>
}`;

const CORE_VERTEX = /* glsl */`
uniform vec3 uFenomCentre;
uniform float uCoreScale;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vLocalPos;
void main() {
    vLocalPos = position;
    vNormalW = normalize(normal);
    vec4 world = modelMatrix * vec4(position * uCoreScale + uFenomCentre, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const CORE_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vLocalPos;
void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - max(0.0, dot(vNormalW, view)), 3.0);
    float swirl = 0.5 + 0.5 * sin(atan(vLocalPos.y, vLocalPos.x) * 3.0 + vLocalPos.z * 4.0 - uTime * 1.3);
    vec3 irid = mix(uViolet, uMagenta, swirl);
    float calm = uField.y;
    vec3 color = vec3(0.004) + irid * rim * (1.2 - 0.5 * calm) * uField.x + uCyan * rim * calm * 0.3;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}`;

const MEMBRANE_FRAGMENT = /* glsl */`
${WORLD_COMMON_GLSL}
uniform float uMembrane;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vLocalPos;
void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    float facing = max(0.0, dot(vNormalW, view));
    float film = 0.5 + 0.5 * sin(facing * 9.0 + uTime * 0.7 + vLocalPos.y * 2.0);
    vec3 oily = mix(mix(uCyan, uViolet, film), uGold, 0.25 * (1.0 - film));
    float fresnel = pow(1.0 - facing, 2.2);
    float veins = pow(abs(sin(vLocalPos.x * 9.0 + uTime) * sin(vLocalPos.y * 11.0 - uTime * 0.6) * sin(vLocalPos.z * 7.0 + 1.3)), 6.0);
    float a = uMembrane * (fresnel * 0.8 + 0.08) + veins * (1.0 - uField.y) * uField.x * 0.6;
    gl_FragColor = vec4(oily * a, 1.0);
    #include <colorspace_fragment>
}`;

// ---- Factories ----------------------------------------------------------------------------
function worldMaterial(uniforms: WorldUniforms, vertexShader: string, fragmentShader: string, additive: boolean,
    extra: Record<string, THREE.IUniform> = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: { ...uniforms, ...extra } as unknown as Record<string, THREE.IUniform>,
        vertexShader, fragmentShader,
        ...(additive ? { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } : {}),
        toneMapped: false
    });
}

export function createBodyMaterial(u: WorldUniforms): THREE.ShaderMaterial { return worldMaterial(u, BODY_VERTEX, BODY_FRAGMENT, false); }
export function createFloorMaterial(u: WorldUniforms): THREE.ShaderMaterial { return worldMaterial(u, FLOOR_VERTEX, FLOOR_FRAGMENT, false); }
export function createBeamMaterial(u: WorldUniforms): THREE.ShaderMaterial { return worldMaterial(u, BEAM_VERTEX, BEAM_FRAGMENT, true); }
export function createNodeMaterial(u: WorldUniforms): THREE.ShaderMaterial { return worldMaterial(u, NODE_VERTEX, NODE_FRAGMENT, true); }
export function createSeederMaterial(u: WorldUniforms): THREE.ShaderMaterial { return worldMaterial(u, SEEDER_VERTEX, SEEDER_FRAGMENT, false); }
export function createFlowMaterial(u: WorldUniforms, centre: THREE.Vector3, tilt: number): THREE.ShaderMaterial {
    return worldMaterial(u, FLOW_VERTEX, FLOW_FRAGMENT, true, { uFlowCentre: { value: centre }, uFlowTilt: { value: tilt },
        uViewportHeight: { value: 1080 } });
}
export function createRingMaterial(u: WorldUniforms, centre: THREE.Vector3): THREE.ShaderMaterial {
    return worldMaterial(u, `uniform vec3 uFenomCentre;\n${RING_VERTEX}`, RING_FRAGMENT, true, { uFenomCentre: { value: centre } });
}
export function createCoreMaterial(u: WorldUniforms, centre: THREE.Vector3, scale: { value: number }): THREE.ShaderMaterial {
    return worldMaterial(u, CORE_VERTEX, CORE_FRAGMENT, false, { uFenomCentre: { value: centre }, uCoreScale: scale });
}
export function createMembraneMaterial(u: WorldUniforms, centre: THREE.Vector3, scale: { value: number }, membrane: { value: number }): THREE.ShaderMaterial {
    return worldMaterial(u, CORE_VERTEX, MEMBRANE_FRAGMENT, true, { uFenomCentre: { value: centre }, uCoreScale: scale, uMembrane: membrane });
}

/** Instanced draw over a shared geometry with preallocated per-instance vec4 attributes. */
export function instancedDraw(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number, names: readonly string[]):
    { mesh: THREE.InstancedMesh; attributes: Record<string, THREE.InstancedBufferAttribute> } {
    const attributes: Record<string, THREE.InstancedBufferAttribute> = {};
    for (const name of names) {
        attributes[name] = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        geometry.setAttribute(name, attributes[name]);
    }
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    // Instance matrices stay identity: the shaders place every instance.
    mesh.frustumCulled = false;
    return { mesh, attributes };
}

/** Dragonfly drone: a slim fuselage and two pairs of thin wings, vertex coloured (one draw). */
export function createDroneGeometry(): THREE.BufferGeometry {
    const parts: { geometry: THREE.BufferGeometry; color: THREE.Color }[] = [
        { geometry: new THREE.OctahedronGeometry(0.16, 0).scale(0.55, 0.45, 2.6), color: new THREE.Color(WORLD_PALETTE.steel) },
        { geometry: new THREE.BoxGeometry(1.1, 0.012, 0.12).translate(0, 0.03, -0.12), color: new THREE.Color(WORLD_PALETTE.cyan) },
        { geometry: new THREE.BoxGeometry(0.9, 0.012, 0.1).translate(0, 0.03, 0.12), color: new THREE.Color(WORLD_PALETTE.ice) },
        { geometry: new THREE.SphereGeometry(0.05, 6, 4).translate(0, 0, -0.42), color: new THREE.Color(WORLD_PALETTE.amber) }
    ];
    const flat = parts.map(p => (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry));
    const total = flat.reduce((n, g) => n + g.getAttribute('position').count, 0);
    const positions = new Float32Array(total * 3), colors = new Float32Array(total * 3);
    let offset = 0;
    flat.forEach((g, i) => {
        const source = g.getAttribute('position');
        for (let v = 0; v < source.count; v++, offset++) {
            positions.set([source.getX(v), source.getY(v), source.getZ(v)], offset * 3);
            colors.set([parts[i].color.r, parts[i].color.g, parts[i].color.b], offset * 3);
        }
        if (g !== parts[i].geometry) g.dispose();
        parts[i].geometry.dispose();
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
}
