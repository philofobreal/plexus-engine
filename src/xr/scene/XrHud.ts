// Minimal in-VR HUD (ADR-009): a single canvas-backed texture on a plane, redrawn only
// when its displayed values actually change -- not every frame.

import * as THREE from 'three';
import type { RhythmSessionSnapshot } from '../../gameplay';

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            ctx.fillText(line, x, cy);
            line = word;
            cy += lineHeight;
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
    private lastSignature = '';

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512;
        this.canvas.height = 256;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas context unavailable for XR HUD');
        this.ctx = ctx;

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        const geometry = new THREE.PlaneGeometry(1.25, 0.625);
        const material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false });
        this.mesh = new THREE.Mesh(geometry, material);

        this.draw('idle', 0, 0, 'Select a track to begin.');
    }

    update(snapshot: RhythmSessionSnapshot, instruction: string): void {
        const signature = `${snapshot.state}|${snapshot.score}|${snapshot.combo}|${instruction}`;
        if (signature === this.lastSignature) return;
        this.lastSignature = signature;
        this.draw(snapshot.state, snapshot.score, snapshot.combo, instruction);
    }

    private draw(state: string, score: number, combo: number, instruction: string): void {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(6, 8, 20, 0.72)';
        ctx.fillRect(0, 0, width, height);

        ctx.textBaseline = 'top';
        ctx.fillStyle = '#eaf2ff';
        ctx.font = '700 46px system-ui, sans-serif';
        ctx.fillText(`Score ${score}`, 24, 18);

        ctx.fillStyle = '#9fd1ff';
        ctx.font = '600 30px system-ui, sans-serif';
        ctx.fillText(`Combo x${combo}`, 24, 88);

        ctx.fillStyle = '#c9d6f0';
        ctx.font = '600 26px system-ui, sans-serif';
        ctx.fillText(state.toUpperCase(), 24, 138);

        ctx.fillStyle = '#8ea0c8';
        ctx.font = '400 22px system-ui, sans-serif';
        wrapText(ctx, instruction, 24, 188, width - 48, 26);

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

