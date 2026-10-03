// Section callout on the hit gate (ADR-009): the "target destruction zone" announces which part of
// the track is playing, using the analyzer's published sections (the same labels and palette the
// MVP dramaturgy panel shows). An approaching section is pre-announced one bar ahead with a
// decoding "NEXT" caption, a beat countdown and beat-synced frame pulses; on arrival the frame
// snaps outward and the caption decodes into the new name.
//
// Everything is a pure function of canonical song time: pausing freezes it, seeking lands on the
// exact state. The caption canvas is redrawn only when its quantized display state changes, and the
// frame animation is a material colour + transform write per frame (no allocation, no upload).

import * as THREE from 'three';
import type { TrackSection, TrackSectionLabel } from '../../types';
import { boxAt, mergeColoredParts, type ColoredPart } from './SceneGeometry';

/** Section display names and colours (hues follow the MVP dramaturgy panel palette). */
export const SECTION_STYLE: Readonly<Record<TrackSectionLabel, { readonly name: string; readonly color: number }>> = {
    intro: { name: 'INTRO', color: 0x4aa8ff },
    verse: { name: 'VERSE', color: 0xcfe8ff },
    build: { name: 'BUILD-UP', color: 0xffb347 },
    drop: { name: 'DROP', color: 0xff4fae },
    break: { name: 'BREAKDOWN', color: 0x9a6bff },
    peak: { name: 'PEAK', color: 0x39e6ff },
    outro: { name: 'OUTRO', color: 0x9aa6b8 }
};

export interface SectionCue {
    readonly start: number;
    readonly end: number;
    readonly label: TrackSectionLabel;
    /** Display name, numbered when the label occurs more than once (e.g. "DROP 2"). */
    readonly title: string;
    /** Pre-announcement window before this section starts, in seconds (0 for the first). */
    readonly leadIn: number;
    /** Beat length used for the countdown and pulses. */
    readonly beatSec: number;
}

const ARRIVAL_SEC = 0.6;
const REVEAL_SEC = 0.45;
const REVEAL_STEPS = 12;
const LEAD_BEATS = 4;

/** Builds the callout timeline once per chart from published analysis (pure, deterministic). */
export function buildSectionTimeline(sections: readonly TrackSection[], beats: readonly number[], timingConfidence: number,
    durationSec: number): SectionCue[] {
    const valid = sections.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && SECTION_STYLE[s.label])
        .slice().sort((a, b) => a.start - b.start);
    const totals = new Map<TrackSectionLabel, number>();
    for (const s of valid) totals.set(s.label, (totals.get(s.label) ?? 0) + 1);
    const seen = new Map<TrackSectionLabel, number>();
    const reliable = timingConfidence >= 0.5 && beats.length >= 2;
    return valid.map((section, i) => {
        const occurrence = (seen.get(section.label) ?? 0) + 1;
        seen.set(section.label, occurrence);
        const beatSec = reliable ? localBeat(beats, section.start) : 0.5;
        const previous = valid[i - 1];
        const leadIn = previous ? Math.min(Math.max(1.2, Math.min(3, LEAD_BEATS * beatSec)), (section.start - previous.start) * 0.5) : 0;
        const name = SECTION_STYLE[section.label].name;
        return { start: section.start, end: Math.min(section.end, durationSec > 0 ? durationSec : section.end), label: section.label,
            title: (totals.get(section.label) ?? 0) > 1 ? `${name} ${occurrence}` : name, leadIn, beatSec };
    });
}

function localBeat(beats: readonly number[], time: number): number {
    let lo = 0, hi = beats.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >>> 1; if (beats[mid] <= time) lo = mid; else hi = mid - 1; }
    const i = Math.min(lo, beats.length - 2);
    const beat = beats[i + 1] - beats[i];
    return Number.isFinite(beat) && beat >= 0.25 && beat <= 1.5 ? beat : 0.5;
}

export type CuePhase = 'none' | 'steady' | 'lead-in' | 'arrival';

/** Mutable, caller-owned cue state (no allocation per frame). */
export interface CueState {
    phase: CuePhase;
    current: number;
    next: number;
    /** Lead-in: 0..1 progress; arrival: seconds since the boundary. */
    progress: number;
    arrivalAge: number;
    /** Lead-in countdown blocks remaining (LEAD_BEATS..1). */
    beatsRemaining: number;
    /** Fraction of the current beat elapsed during a lead-in (drives pulses). */
    beatFraction: number;
}

export function createCueState(): CueState {
    return { phase: 'none', current: -1, next: -1, progress: 0, arrivalAge: 0, beatsRemaining: 0, beatFraction: 0 };
}

/** Pure projection of song time onto the callout timeline. */
export function sectionCueAt(timeline: readonly SectionCue[], songTime: number, out: CueState): CueState {
    out.phase = 'none'; out.current = -1; out.next = -1; out.progress = 0; out.arrivalAge = 0; out.beatsRemaining = 0; out.beatFraction = 0;
    if (!timeline.length || !Number.isFinite(songTime)) return out;
    let lo = 0, hi = timeline.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >>> 1; if (timeline[mid].start <= songTime) lo = mid; else hi = mid - 1; }
    const current = timeline[lo].start <= songTime ? lo : 0;
    out.current = current;
    out.phase = 'steady';
    const age = songTime - timeline[current].start;
    if (current > 0 && age >= 0 && age < ARRIVAL_SEC) { out.phase = 'arrival'; out.arrivalAge = age; out.progress = age / ARRIVAL_SEC; }
    const upcoming = timeline[current].start <= songTime ? current + 1 : current;
    const next = timeline[upcoming];
    if (next && upcoming > 0 && out.phase !== 'arrival') {
        const remaining = next.start - songTime;
        if (remaining > 0 && remaining <= next.leadIn) {
            out.phase = 'lead-in';
            out.next = upcoming;
            out.progress = 1 - remaining / next.leadIn;
            const beatsLeft = remaining / next.beatSec;
            out.beatsRemaining = Math.max(1, Math.min(LEAD_BEATS, Math.ceil(beatsLeft - 1e-9)));
            out.beatFraction = 1 - (beatsLeft - Math.floor(beatsLeft));
            if (out.beatFraction >= 1) out.beatFraction = 0;
        }
    }
    return out;
}

/** Deterministic [0, 1) hash for scramble glyphs. */
function hash01(a: number, b: number): number {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
}
const SCRAMBLE = '#/\\<>=+*_01';

const CAPTION_WIDTH = 768;
/** Caption strip size in playfield meters (canvas aspect matches). */
export const CAPTION_PLANE_WIDTH = 0.84;
export const CAPTION_PLANE_HEIGHT = CAPTION_PLANE_WIDTH * 88 / 768;
const CAPTION_HEIGHT = 88;
const GATE_X = 0.8;
const GATE_Y = 0.6;
const BASE_GLOW = 0.32;

function easeOutBack(t: number): number {
    const c = 1.70158, u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
}

/**
 * Hit-gate section callout: an animated outer frame (additive, one draw) and a canvas caption strip
 * above the gate (one draw). Lives in playfield space next to the static gate.
 */
export class XrSectionCallout {
    readonly root = new THREE.Group();
    readonly frame: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly caption: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    readonly texture: THREE.CanvasTexture;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private timeline: readonly SectionCue[] = [];
    private readonly cue = createCueState();
    private readonly colorA = new THREE.Color();
    private readonly colorB = new THREE.Color();
    private lastKey = Number.NaN;
    private lastTime = Number.NaN;
    private redraws = 0;
    private frameCenterY = 0;
    private frameHalfHeight = GATE_Y;

    constructor(doc: Document = document) {
        this.canvas = doc.createElement('canvas');
        this.canvas.width = CAPTION_WIDTH;
        this.canvas.height = CAPTION_HEIGHT;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas context unavailable for the section callout');
        this.ctx = ctx;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        this.caption = new THREE.Mesh(new THREE.PlaneGeometry(CAPTION_PLANE_WIDTH, CAPTION_PLANE_HEIGHT),
            new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false }));
        this.caption.name = 'sectionCaption';
        this.caption.position.set(0, GATE_Y + 0.04 + CAPTION_PLANE_HEIGHT / 2, 0.004);
        this.caption.renderOrder = -4;
        this.frame = new THREE.Mesh(mergeColoredParts(XrSectionCallout.frameParts(GATE_Y)),
            new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
                depthWrite: false, toneMapped: false }));
        this.frame.name = 'sectionFrame';
        this.frame.renderOrder = -5;
        this.root.add(this.frame, this.caption);
        this.root.visible = false;
    }

    /**
     * Start frame extent (play space, ADR-009 Addendum M): center height and inner half-height in
     * playfield meters. The outline is rebuilt once and the caption rides on its top edge.
     */
    setFrame(centerY: number, halfHeight: number): void {
        if (!Number.isFinite(centerY) || !(halfHeight > 0)) return;
        if (centerY === this.frameCenterY && halfHeight === this.frameHalfHeight) return;
        this.frameCenterY = centerY; this.frameHalfHeight = halfHeight;
        this.frame.geometry.dispose();
        this.frame.geometry = mergeColoredParts(XrSectionCallout.frameParts(halfHeight));
        this.caption.position.y = halfHeight + 0.04 + CAPTION_PLANE_HEIGHT / 2;
        // The root pivots on the frame's center, so the arrival pulse scales around it.
        this.root.position.y = centerY;
    }

    /** Canvas redraws so far (diagnostics/tests: redraws happen only on display changes). */
    get redrawCount(): number { return this.redraws; }

    setTimeline(timeline: readonly SectionCue[]): void {
        this.timeline = timeline;
        this.lastKey = Number.NaN;
        this.lastTime = Number.NaN;
        this.root.visible = timeline.length > 0;
    }

    /** Per-frame, allocation-free projection of song time onto the frame and caption. */
    update(songTime: number): void {
        // Non-finite clocks (never expected from AudioEngine) leave the last valid display in place.
        if (!this.timeline.length || !Number.isFinite(songTime) || songTime === this.lastTime) return;
        this.lastTime = songTime;
        const cue = sectionCueAt(this.timeline, songTime, this.cue);
        if (cue.phase === 'none') return;
        const current = this.timeline[cue.current];
        let glow = BASE_GLOW, scale = 1;
        this.colorA.setHex(SECTION_STYLE[current.label].color);
        if (cue.phase === 'lead-in') {
            const next = this.timeline[cue.next];
            this.colorB.setHex(SECTION_STYLE[next.label].color);
            this.colorA.lerp(this.colorB, cue.progress);
            const pulse = Math.exp(-cue.beatFraction * 6);
            glow = BASE_GLOW + 0.4 * pulse * (0.5 + 0.5 * cue.progress);
            scale = 1 + 0.018 * pulse;
        } else if (cue.phase === 'arrival') {
            const t = cue.progress;
            glow = BASE_GLOW + (1 - BASE_GLOW) * (1 - t) * (1 - t);
            scale = 1 + 0.1 * (1 - easeOutBack(Math.min(1, t * 1.4)));
        }
        this.frame.material.color.copy(this.colorA).multiplyScalar(glow);
        this.frame.scale.set(scale, scale, 1);
        const key = this.displayKey(cue);
        if (key !== this.lastKey) {
            this.lastKey = key;
            this.draw(cue);
        }
    }

    dispose(): void {
        this.root.removeFromParent();
        this.frame.geometry.dispose(); this.frame.material.dispose();
        this.caption.geometry.dispose(); this.caption.material.dispose();
        this.texture.dispose();
    }

    /** Numeric key of everything the caption shows; the canvas is redrawn only when it changes. */
    private displayKey(cue: CueState): number {
        const phase = cue.phase === 'lead-in' ? 1 : cue.phase === 'arrival' ? 2 : 0;
        const leadReveal = cue.phase === 'lead-in' ? Math.min(REVEAL_STEPS, Math.floor(cue.progress * this.timeline[cue.next].leadIn / REVEAL_SEC * REVEAL_STEPS)) : 0;
        const arrivalReveal = cue.phase === 'arrival' ? Math.min(REVEAL_STEPS, Math.floor(cue.arrivalAge / REVEAL_SEC * REVEAL_STEPS)) : 0;
        return (((cue.current * 3 + phase) * 16 + leadReveal + arrivalReveal) * 8 + cue.beatsRemaining);
    }

    private draw(cue: CueState): void {
        this.redraws++;
        const ctx = this.ctx, w = CAPTION_WIDTH, h = CAPTION_HEIGHT;
        const current = this.timeline[cue.current];
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        // Low-alpha backing keeps the caption legible over the Wormhole without a solid card.
        ctx.fillStyle = 'rgba(2, 6, 16, 0.55)';
        ctx.fillRect(0, 8, w, h - 16);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        const font = '"Segoe UI", "Roboto", system-ui, sans-serif';
        if (cue.phase === 'lead-in') {
            const next = this.timeline[cue.next];
            const reveal = Math.min(1, cue.progress * next.leadIn / REVEAL_SEC);
            const nextColor = cssHex(SECTION_STYLE[next.label].color);
            ctx.fillStyle = 'rgba(139, 166, 196, 0.9)';
            ctx.font = `600 26px ${font}`;
            ctx.fillText(current.title, 18, h / 2);
            ctx.fillStyle = nextColor;
            ctx.font = `700 26px ${font}`;
            const prefix = 'NEXT ▸';
            const prefixX = 18 + ctx.measureText(current.title).width + 26;
            ctx.fillText(prefix, prefixX, h / 2);
            ctx.font = `800 46px ${font}`;
            ctx.fillText(scramble(next.title, reveal, cue.next), prefixX + ctx.measureText(prefix).width + 44, h / 2);
            // Countdown: one block per remaining beat.
            for (let i = 0; i < LEAD_BEATS; i++) {
                ctx.fillStyle = i < cue.beatsRemaining ? nextColor : 'rgba(139, 166, 196, 0.25)';
                ctx.fillRect(w - 18 - (LEAD_BEATS - i) * 30, h / 2 - 11, 22, 22);
            }
        } else {
            const color = cssHex(SECTION_STYLE[current.label].color);
            const reveal = cue.phase === 'arrival' ? Math.min(1, cue.arrivalAge / REVEAL_SEC) : 1;
            ctx.fillStyle = color;
            ctx.fillRect(18, h / 2 - 17, 6, 34);
            ctx.font = `800 50px ${font}`;
            const title = scramble(current.title, reveal, cue.current);
            const titleWidth = ctx.measureText(current.title).width;
            ctx.fillText(title, (w - titleWidth) / 2, h / 2 + 1);
            ctx.fillStyle = 'rgba(139, 166, 196, 0.85)';
            ctx.font = `600 22px ${font}`;
            ctx.textAlign = 'right';
            ctx.fillText(`S${String(cue.current + 1).padStart(2, '0')}`, w - 18, h / 2);
        }
        // Hairline edges framing the strip.
        ctx.fillStyle = 'rgba(79, 216, 255, 0.35)';
        ctx.fillRect(0, 8, w, 1);
        ctx.fillRect(0, h - 9, w, 1);
        this.texture.needsUpdate = true;
    }

    private static frameParts(halfHeight: number): ColoredPart[] {
        const parts: ColoredPart[] = [];
        const x = GATE_X + 0.035, y = halfHeight + 0.035, arm = 0.2, t = 0.008, d = 0.006;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
            parts.push({ geometry: boxAt(arm, t, d, sx * (x - arm / 2), sy * y, 0.002), color: 0xffffff });
            parts.push({ geometry: boxAt(t, arm, d, sx * x, sy * (y - arm / 2), 0.002), color: 0xffffff });
        }
        // Header rail the caption sits on.
        parts.push({ geometry: boxAt(CAPTION_PLANE_WIDTH + 0.02, 0.005, d, 0, halfHeight + 0.036, 0.002), color: 0xffffff });
        return parts;
    }
}

function cssHex(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
}

/** Left-to-right decode: revealed characters settle, the rest cycle deterministic glyphs. */
export function scramble(text: string, reveal: number, seed: number): string {
    if (reveal >= 1) return text;
    const settled = Math.floor(text.length * Math.max(0, reveal));
    const step = Math.floor(reveal * REVEAL_STEPS);
    let out = text.slice(0, settled);
    for (let i = settled; i < text.length; i++) {
        out += text[i] === ' ' ? ' ' : SCRAMBLE[Math.floor(hash01(seed * 131 + i, step) * SCRAMBLE.length)];
    }
    return out;
}
