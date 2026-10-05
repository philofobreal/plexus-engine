// Floor progress ring at the player's origin (ADR-009 Addendum K), replacing the static reticle arcs.
// One additive shader draw on a flat ring, read clockwise from straight ahead:
//
// - outer band (r 0.36-0.40): the song timeline, one arc per section in its colour; played arcs lit,
//   the rest dim, with a bright playhead;
// - inner band (r 0.22-0.25): each completed section fills its arc in proportion to its accuracy --
//   gold when flawless, its colour when clean, dark when a note was missed;
// - side arcs (r 0.47-0.49): the combo multiplier, four steps per side (cyan left, pink right).
//
// Per frame only uniforms change: progress and multiplier tier, plus the section result vectors
// when a section's outcome changes. No geometry or texture is ever uploaded during play.

import * as THREE from 'three';
import type { RhythmSessionSnapshot, SectionResult } from '../../gameplay';
import { RUNWAY_PALETTE } from './XrRunway';
import { FLAWLESS_COLOR, sectionAccuracy, sectionOutcome, type ScoreOverview } from './XrScoreOverview';

/** Sections beyond this are merged into the last arc (analyzer output stays far below it). */
export const RING_MAX_SECTIONS = 32;
const OUTCOME_CODE = { pending: 0, missed: 1, clean: 2, flawless: 3 } as const;

const VERTEX = /* glsl */`
varying vec2 vPos;
void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */`
#define MAX_SECTIONS ${RING_MAX_SECTIONS}
varying vec2 vPos;
uniform vec4 uSections[MAX_SECTIONS]; // start, end (song fractions), accuracy, outcome
uniform vec3 uColors[MAX_SECTIONS];
uniform int uCount;
uniform float uProgress;
uniform float uTier;
uniform vec3 uLeft;
uniform vec3 uRight;
uniform vec3 uGold;
const float TAU = 6.28318530718;

float band(float r, float inner, float outer) {
    return smoothstep(inner - 0.003, inner + 0.001, r) * (1.0 - smoothstep(outer - 0.001, outer + 0.003, r));
}

void main() {
    float r = length(vPos);
    // 0 straight ahead, increasing clockwise seen from above.
    float t = fract(atan(vPos.x, vPos.y) / TAU + 1.0);
    vec3 color = vec3(0.0);
    float timeline = band(r, 0.36, 0.40);
    float results = band(r, 0.22, 0.25);
    for (int i = 0; i < MAX_SECTIONS; i++) {
        if (i >= uCount) break;
        vec4 s = uSections[i];
        bool inside = t >= s.x + 0.0025 && t < s.y - 0.0025;
        if (!inside) continue;
        color += uColors[i] * timeline * (t < uProgress ? 0.95 : 0.2);
        float filled = step(t, s.x + (s.y - s.x) * s.z);
        if (s.w > 2.5) color += uGold * results * filled;
        else if (s.w > 1.5) color += uColors[i] * results * filled * 0.85;
        else if (s.w > 0.5) color += uColors[i] * results * filled * 0.18;
        else color += uColors[i] * results * 0.05;
    }
    float head = 1.0 - smoothstep(0.0015, 0.004, abs(t - uProgress));
    color += vec3(1.0) * head * band(r, 0.345, 0.415);
    // Multiplier steps: 4 per side around the left (270 deg) and right (90 deg), both lighting up
    // from the front toward the back.
    float sideArc = band(r, 0.47, 0.49);
    if (sideArc > 0.0) {
        float right = (t - 0.1667) / 0.1667; // 60..120 deg -> 0..1
        float left = (0.8333 - t) / 0.1667;  // 300..240 deg -> 0..1
        float u = right >= 0.0 && right < 1.0 ? right : left >= 0.0 && left < 1.0 ? left : -1.0;
        if (u >= 0.0) {
            float stepIndex = floor(u * 4.0);
            float gap = step(0.1, fract(u * 4.0)) * step(fract(u * 4.0), 0.9);
            float lit = stepIndex <= uTier ? 1.0 : 0.16;
            color += (right >= 0.0 && right < 1.0 ? uRight : uLeft) * sideArc * gap * lit;
        }
    }
    gl_FragColor = vec4(color, 1.0);
}`;

export class XrProgressRing {
    readonly mesh: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>;
    private readonly sections: THREE.Vector4[];
    private readonly colors: THREE.Color[];
    private overview: ScoreOverview | null = null;
    private count = 0;
    /** Results the section vectors were last projected from (they change only with a hit, a miss or a new run). */
    private lastResults: readonly SectionResult[] | undefined | null = null;
    private lastHits = -1;
    private lastMisses = -1;

    constructor() {
        this.sections = Array.from({ length: RING_MAX_SECTIONS }, () => new THREE.Vector4());
        this.colors = Array.from({ length: RING_MAX_SECTIONS }, () => new THREE.Color());
        const material = new THREE.ShaderMaterial({
            vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false,
            uniforms: {
                uSections: { value: this.sections }, uColors: { value: this.colors }, uCount: { value: 0 },
                uProgress: { value: 0 }, uTier: { value: 0 },
                uLeft: { value: new THREE.Color(RUNWAY_PALETTE.left) }, uRight: { value: new THREE.Color(RUNWAY_PALETTE.right) },
                uGold: { value: new THREE.Color(FLAWLESS_COLOR) }
            }
        });
        // Flat on the floor at the player's origin; local +y is straight ahead (-Z).
        this.mesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.52, 160, 1), material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = 0.008;
        this.mesh.name = 'progressRing';
        this.mesh.renderOrder = -6;
        this.mesh.visible = false;
    }

    get uniforms(): Record<string, THREE.IUniform> { return this.mesh.material.uniforms; }

    setOverview(overview: ScoreOverview | null): void {
        this.overview = overview && overview.sections.length ? overview : null;
        this.mesh.visible = this.overview !== null;
        this.count = 0;
        this.lastResults = null;
        if (!this.overview) { this.uniforms.uCount.value = 0; return; }
        const { sections, durationSec } = this.overview;
        this.count = Math.min(RING_MAX_SECTIONS, sections.length);
        for (let i = 0; i < this.count; i++) {
            const section = sections[i];
            // The last arc absorbs any sections past the uniform budget.
            const end = i === this.count - 1 ? sections[sections.length - 1].end : section.end;
            this.sections[i].set(section.start / durationSec, Math.min(1, end / durationSec), 0, OUTCOME_CODE.pending);
            this.colors[i].setHex(section.color);
        }
        this.uniforms.uCount.value = this.count;
    }

    /** Progress, multiplier and section outcomes; uniforms only. */
    update(songTime: number, snapshot: RhythmSessionSnapshot): void {
        const overview = this.overview;
        if (!overview) return;
        const progress = Math.min(1, Math.max(0, (Number.isFinite(songTime) ? songTime : 0) / overview.durationSec));
        if (this.uniforms.uProgress.value !== progress) this.uniforms.uProgress.value = progress;
        const tier = Math.max(0, Math.log2(snapshot.multiplier ?? 1));
        if (this.uniforms.uTier.value !== tier) this.uniforms.uTier.value = tier;
        const results = snapshot.sections;
        // Section outcomes change only when a note resolves (hit / miss) or a new run starts (new results array).
        if (results === this.lastResults && snapshot.hitCount === this.lastHits && snapshot.missCount === this.lastMisses) return;
        this.lastResults = results; this.lastHits = snapshot.hitCount; this.lastMisses = snapshot.missCount;
        for (let i = 0; i < this.count; i++) {
            const result = results?.[i], section = overview.sections[i];
            const outcome = OUTCOME_CODE[sectionOutcome(section, result)];
            const accuracy = outcome === OUTCOME_CODE.pending ? 0 : sectionAccuracy(section, result);
            const vector = this.sections[i];
            if (vector.w !== outcome || vector.z !== accuracy) { vector.z = accuracy; vector.w = outcome; }
        }
    }

    dispose(): void {
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
