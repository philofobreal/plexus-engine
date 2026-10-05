// Song map under the start frame (ADR-009 Addendum K): the track's structure as a thin strip of
// section segments (width proportional to duration, section colours), a played portion and a
// playhead, plus one discreet caption line: the current section's score weight, a flawless marker
// and, when a section completes cleanly, a short "CLEAR / FLAWLESS +points" flash.
//
// Cost: the segment canvases are drawn once per chart; per frame only a scale, a position and a
// texture repeat change (no upload). The caption canvas redraws only when its quantized content
// changes (a handful of times per section).

import * as THREE from 'three';
import type { RhythmSessionSnapshot } from '../../gameplay';
import {
    createOverviewState, FLAWLESS_COLOR, formatPoints, overviewStateAt, SECTION_FLASH_SEC, type OverviewState, type ScoreOverview
} from './XrScoreOverview';

/** Strip size and placement in playfield meters (just below the hit gate's lower brackets). */
export const SONG_MAP_WIDTH = 1.6;
const STRIP_HEIGHT = 0.024;
const STRIP_Y = -0.71;
/** The strip hangs this far below the start frame's inner bottom edge (-0.6 in the Standard space). */
const STRIP_BELOW_FRAME = 0.11;
const CAPTION_WIDTH_PX = 768;
const CAPTION_HEIGHT_PX = 56;
const CAPTION_WIDTH = 0.96;
const CAPTION_HEIGHT = CAPTION_WIDTH * CAPTION_HEIGHT_PX / CAPTION_WIDTH_PX;
const STRIP_PX = 1024;
const FLASH_STEPS = 5;
const FONT = '"Segoe UI", "Roboto", system-ui, sans-serif';

function cssHex(color: number, alpha = 1): string {
    const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    return texture;
}

function additive(map: THREE.Texture | null, color = 0xffffff): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ map, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}

export class XrSongMap {
    readonly root = new THREE.Group();
    readonly strip: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    readonly played: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly playhead: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    readonly caption: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    private readonly dimCanvas: HTMLCanvasElement;
    private readonly litCanvas: HTMLCanvasElement;
    private readonly captionCanvas: HTMLCanvasElement;
    private readonly dimTexture: THREE.CanvasTexture;
    private readonly litTexture: THREE.CanvasTexture;
    private readonly captionTexture: THREE.CanvasTexture;
    private overview: ScoreOverview | null = null;
    private readonly state: OverviewState = createOverviewState();
    private lastTime = Number.NaN;
    private lastScore = Number.NaN;
    private lastMisses = Number.NaN;
    /** Caption state last drawn (numeric: no per-frame string). NaN forces a redraw. */
    private lastKey = Number.NaN;
    private redraws = 0;

    constructor(doc: Document = document) {
        const canvas = (w: number, h: number) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
        this.dimCanvas = canvas(STRIP_PX, 8);
        this.litCanvas = canvas(STRIP_PX, 8);
        this.captionCanvas = canvas(CAPTION_WIDTH_PX, CAPTION_HEIGHT_PX);
        this.dimTexture = canvasTexture(this.dimCanvas);
        this.litTexture = canvasTexture(this.litCanvas);
        this.captionTexture = canvasTexture(this.captionCanvas);
        this.strip = new THREE.Mesh(new THREE.PlaneGeometry(SONG_MAP_WIDTH, STRIP_HEIGHT), additive(this.dimTexture));
        this.strip.name = 'songMapStrip';
        // Left-anchored played portion: scale.x and the texture repeat follow progress together.
        this.played = new THREE.Mesh(new THREE.PlaneGeometry(SONG_MAP_WIDTH, STRIP_HEIGHT).translate(SONG_MAP_WIDTH / 2, 0, 0),
            additive(this.litTexture));
        this.played.name = 'songMapPlayed';
        this.played.position.set(-SONG_MAP_WIDTH / 2, 0, 0.001);
        this.playhead = new THREE.Mesh(new THREE.PlaneGeometry(0.006, STRIP_HEIGHT * 2.2), additive(null, 0xffffff));
        this.playhead.name = 'songMapPlayhead';
        this.playhead.position.z = 0.002;
        this.caption = new THREE.Mesh(new THREE.PlaneGeometry(CAPTION_WIDTH, CAPTION_HEIGHT),
            new THREE.MeshBasicMaterial({ map: this.captionTexture, transparent: true, depthWrite: false, toneMapped: false }));
        this.caption.name = 'songMapCaption';
        this.caption.position.y = -(STRIP_HEIGHT / 2 + 0.012 + CAPTION_HEIGHT / 2);
        this.root.add(this.strip, this.played, this.playhead, this.caption);
        this.root.position.set(0, STRIP_Y, 0.004);
        for (const mesh of [this.strip, this.played, this.playhead, this.caption]) mesh.renderOrder = -4;
        this.root.visible = false;
    }

    /** Hangs the strip under the start frame of the active play space (inner bottom edge, playfield y). */
    setFrameBottom(frameBottomY: number): void {
        if (Number.isFinite(frameBottomY)) this.root.position.y = frameBottomY - STRIP_BELOW_FRAME;
    }

    /** Caption canvas redraws so far (redraws happen only on display changes). */
    get redrawCount(): number { return this.redraws; }

    setOverview(overview: ScoreOverview | null): void {
        this.overview = overview && overview.sections.length ? overview : null;
        this.root.visible = this.overview !== null;
        this.lastTime = Number.NaN; this.lastKey = Number.NaN;
        if (this.overview) this.drawStrips(this.overview);
    }

    update(songTime: number, snapshot: RhythmSessionSnapshot): void {
        const overview = this.overview;
        if (!overview) return;
        // Section results change only with the score or the miss count; time drives everything else.
        if (songTime === this.lastTime && snapshot.score === this.lastScore && snapshot.missCount === this.lastMisses) return;
        this.lastTime = songTime; this.lastScore = snapshot.score; this.lastMisses = snapshot.missCount;
        const state = overviewStateAt(overview, snapshot.sections, songTime, this.state);
        const p = state.progress;
        this.played.scale.x = Math.max(1e-4, p);
        this.litTexture.repeat.x = Math.max(1e-4, p);
        this.playhead.position.x = -SONG_MAP_WIDTH / 2 + p * SONG_MAP_WIDTH;
        const flashStep = state.hasFlash ? Math.min(FLASH_STEPS - 1, Math.floor(state.flash.age / SECTION_FLASH_SEC * FLASH_STEPS)) : -1;
        // Flash captions are negative keys, steady captions non-negative (current >= -1).
        const key = state.hasFlash ? -1 - (state.flash.index * FLASH_STEPS + flashStep) : (state.current + 1) * 2 + (state.flawless ? 1 : 0);
        if (key !== this.lastKey) { this.lastKey = key; this.drawCaption(overview, state, flashStep); }
    }

    dispose(): void {
        this.root.removeFromParent();
        for (const mesh of [this.strip, this.played, this.playhead, this.caption]) { mesh.geometry.dispose(); mesh.material.dispose(); }
        for (const texture of [this.dimTexture, this.litTexture, this.captionTexture]) texture.dispose();
    }

    /** Dim (future) and lit (played) strips: one segment per section, small gaps between. */
    private drawStrips(overview: ScoreOverview): void {
        for (const [canvas, alpha, texture] of [[this.dimCanvas, 0.28, this.dimTexture], [this.litCanvas, 1, this.litTexture]] as const) {
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(79, 216, 255, 0.08)';
            ctx.fillRect(0, 3, canvas.width, 2); // the track's full length, even where no section is
            for (const section of overview.sections) {
                const x0 = Math.round(section.start / overview.durationSec * canvas.width) + 1;
                const x1 = Math.round(Math.min(section.end, overview.durationSec) / overview.durationSec * canvas.width) - 1;
                if (x1 <= x0) continue;
                // Heavier (more rewarding) sections are drawn taller.
                const h = Math.round(4 + 4 * (section.weight - 1));
                ctx.fillStyle = cssHex(section.color, alpha);
                ctx.fillRect(x0, (canvas.height - h) / 2, x1 - x0, h);
            }
            texture.needsUpdate = true;
        }
    }

    private drawCaption(overview: ScoreOverview, state: OverviewState, flashStep: number): void {
        this.redraws++;
        const ctx = this.captionCanvas.getContext('2d');
        if (!ctx) return;
        const w = CAPTION_WIDTH_PX, h = CAPTION_HEIGHT_PX;
        ctx.clearRect(0, 0, w, h);
        ctx.textBaseline = 'middle';
        if (state.hasFlash) {
            const section = overview.sections[state.flash.index];
            const fade = 1 - flashStep / FLASH_STEPS;
            const color = state.flash.kind === 'flawless' ? FLAWLESS_COLOR : section.color;
            ctx.textAlign = 'center';
            ctx.font = `800 30px ${FONT}`;
            ctx.fillStyle = cssHex(color, 0.25 + 0.75 * fade);
            ctx.fillText(`${section.title}  ${state.flash.kind === 'flawless' ? 'FLAWLESS' : 'CLEAR'}  +${formatPoints(state.flash.bonus)}`, w / 2, h / 2);
        } else if (state.current >= 0) {
            const section = overview.sections[state.current];
            ctx.textAlign = 'left';
            ctx.font = `600 22px ${FONT}`;
            ctx.fillStyle = 'rgba(139, 166, 196, 0.85)';
            ctx.fillText(section.title, 16, h / 2);
            ctx.textAlign = 'right';
            ctx.font = `700 24px ${FONT}`;
            ctx.fillStyle = cssHex(section.color, 0.95);
            ctx.fillText(`×${section.weight.toFixed(1)}`, w - 52, h / 2);
            // Flawless marker: a filled diamond while the section is clean, hollow once broken.
            ctx.save();
            ctx.translate(w - 26, h / 2); ctx.rotate(Math.PI / 4);
            if (state.flawless) { ctx.fillStyle = cssHex(FLAWLESS_COLOR, 0.95); ctx.fillRect(-7, -7, 14, 14); }
            else { ctx.strokeStyle = 'rgba(139, 166, 196, 0.6)'; ctx.lineWidth = 2; ctx.strokeRect(-6, -6, 12, 12); }
            ctx.restore();
        }
        this.captionTexture.needsUpdate = true;
    }
}
