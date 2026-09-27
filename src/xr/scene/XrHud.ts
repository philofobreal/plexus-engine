// Minimal in-VR HUD (ADR-009): a single canvas-backed texture on a plane, redrawn only
// when its displayed values actually change -- not every frame. The instrument frame, scanlines
// and separators are part of that same redraw; they are never animated.

import * as THREE from 'three';
import type { RhythmSessionSnapshot } from '../../gameplay';

const WIDTH = 768;
const HEIGHT = 384;
const FONT = '"Segoe UI", "Roboto", system-ui, sans-serif';
const CYAN = '#4fd8ff';
const MAGENTA = '#ff5fb4';
const INK = '#eef8ff';
const MUTED = '#8ba6c4';
const STATE_COLORS: Record<string, string> = {
    playing: CYAN, paused: '#ffd37a', finished: MAGENTA, ready: '#bfefff', idle: MUTED
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
    const words = text.split(' ');
    let line = '';
    let cy = y, lines = 0;
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            ctx.fillText(line, x, cy);
            line = word;
            cy += lineHeight;
            if (++lines >= maxLines) return;
        } else {
            line = candidate;
        }
    }
    if (line) ctx.fillText(line, x, cy);
}

export class XrHud {
    readonly mesh: THREE.Mesh;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly texture: THREE.CanvasTexture;
    // Last displayed values, compared field by field (no per-frame signature string).
    private lastState = '';
    private lastScore = Number.NaN;
    private lastCombo = Number.NaN;
    private lastInstruction: string | null = null;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = WIDTH;
        this.canvas.height = HEIGHT;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas context unavailable for XR HUD');
        this.ctx = ctx;

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        // Displayed near 1:1 texel density; skipping mip generation keeps each redraw's upload small.
        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;

        const geometry = new THREE.PlaneGeometry(1.25, 0.625);
        const material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false });
        this.mesh = new THREE.Mesh(geometry, material);

        this.draw('idle', 0, 0, 'Select a track to begin.');
    }

    update(snapshot: RhythmSessionSnapshot, instruction: string): void {
        if (snapshot.state === this.lastState && snapshot.score === this.lastScore && snapshot.combo === this.lastCombo
            && instruction === this.lastInstruction) return;
        this.lastState = snapshot.state; this.lastScore = snapshot.score; this.lastCombo = snapshot.combo; this.lastInstruction = instruction;
        this.draw(snapshot.state, snapshot.score, snapshot.combo, instruction);
    }

    private rect(color: string, x: number, y: number, w: number, h: number): void {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);
    }

    /** Angular instrument frame: corner brackets, hairlines, notches and faint scanlines. */
    private drawFrame(): void {
        const left = 20, top = 20, right = WIDTH - 20, bottom = HEIGHT - 20, arm = 44, t = 3;
        // Low-alpha glass panel keeps text legible over the Wormhole without a solid card.
        this.rect('rgba(2, 6, 16, 0.46)', left, top, right - left, bottom - top);
        for (let y = top + 3; y < bottom; y += 4) this.rect('rgba(79, 216, 255, 0.035)', left, y, right - left, 1);
        this.rect('rgba(79, 216, 255, 0.32)', left + arm + 8, top, right - left - 2 * arm - 16, 1);
        this.rect('rgba(79, 216, 255, 0.22)', left + arm + 8, bottom - 1, right - left - 2 * arm - 16, 1);
        for (const [x, y, sx, sy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
            this.rect(CYAN, sx > 0 ? x : x - arm, sy > 0 ? y : y - t, arm, t);
            this.rect(CYAN, sx > 0 ? x : x - t, sy > 0 ? y : y - arm, t, arm);
        }
        // Magenta secondary accents and technical ticks.
        this.rect(MAGENTA, right - arm - 96, top - 1, 64, 3);
        this.rect(MAGENTA, left + arm + 20, bottom - 2, 28, 3);
        for (let i = 0; i < 5; i++) this.rect('rgba(79, 216, 255, 0.5)', left + 8, top + 96 + i * 16, i % 2 ? 6 : 12, 2);
    }

    private draw(state: string, score: number, combo: number, instruction: string): void {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.globalAlpha = 1;
        this.drawFrame();
        ctx.textBaseline = 'top';

        // Header: product mark and compact status label.
        ctx.textAlign = 'left';
        ctx.fillStyle = MUTED;
        ctx.font = `600 22px ${FONT}`;
        ctx.fillText('PLEXUS  //  XR', 44, 38);
        const stateColor = STATE_COLORS[state] ?? MUTED;
        const label = state.toUpperCase();
        ctx.font = `700 24px ${FONT}`;
        const labelWidth = Math.max(96, ctx.measureText(label).width + 36);
        const chipX = WIDTH - 44 - labelWidth, chipY = 34;
        this.rect(stateColor, chipX, chipY, 6, 32);
        this.rect('rgba(79, 216, 255, 0.10)', chipX + 6, chipY, labelWidth - 6, 32);
        this.rect(stateColor, chipX + 6, chipY + 31, labelWidth - 6, 1);
        ctx.fillStyle = stateColor;
        ctx.fillText(label, chipX + 22, chipY + 4);

        // Score: primary figure.
        ctx.fillStyle = MUTED;
        ctx.font = `600 22px ${FONT}`;
        ctx.fillText('SCORE', 44, 92);
        ctx.fillStyle = INK;
        const scoreText = String(score);
        ctx.font = `700 104px ${FONT}`;
        if (ctx.measureText(scoreText).width > 420) ctx.font = `700 76px ${FONT}`;
        ctx.fillText(scoreText, 40, 116);

        // Combo: prominent but secondary, separated by a ticked hairline.
        const divider = 488;
        this.rect('rgba(79, 216, 255, 0.35)', divider, 96, 1, 128);
        for (let i = 0; i < 5; i++) this.rect('rgba(79, 216, 255, 0.55)', divider - 4, 96 + i * 32, 9, 1);
        ctx.fillStyle = MUTED;
        ctx.font = `600 22px ${FONT}`;
        ctx.fillText('COMBO', divider + 28, 92);
        ctx.fillStyle = combo > 0 ? CYAN : 'rgba(139, 166, 196, 0.7)';
        ctx.font = `700 72px ${FONT}`;
        ctx.fillText(`×${combo}`, divider + 24, 124);

        // Instruction strip.
        this.rect('rgba(79, 216, 255, 0.28)', 44, 262, WIDTH - 88, 1);
        this.rect(CYAN, 44, 260, 36, 3);
        this.rect(MAGENTA, WIDTH - 80, 260, 36, 3);
        ctx.fillStyle = '#b4c8e2';
        ctx.font = `500 28px ${FONT}`;
        wrapText(ctx, instruction, 44, 280, WIDTH - 88, 34, 2);

        this.texture.needsUpdate = true;
    }

    setPosition(x: number, y: number, z: number): void {
        this.mesh.position.set(x, y, z);
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.MeshBasicMaterial).dispose();
        this.texture.dispose();
    }
}
