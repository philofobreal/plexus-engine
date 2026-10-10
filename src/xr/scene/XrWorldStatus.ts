// World status plate (ADR-010, T09): one small canvas under the score HUD naming the world's
// current era, the objective and two bars (formation, coherence). It follows the HUD's pose, so it
// sits where the player already looks for the score, and it never covers the runway. Redrawn only
// when a displayed value changes (title, line, whole percents), never per frame.

import * as THREE from 'three';
import type { WorldNoteRoleKind } from '../../gameplay';

const WIDTH = 768;
const HEIGHT = 136;
const FONT = '"Segoe UI", "Roboto", system-ui, sans-serif';
const ROLE_CSS: Readonly<Record<WorldNoteRoleKind | 'none', string>> = {
    energy: '#ffc23d', signal: '#e8fbff', sync: '#b48cff', stabilize: '#ff8fe0', none: '#4fd8ff'
};
/** Plate size in HUD-local meters (the HUD plane is 1.25 x 0.625) and its offset below the HUD. */
export const WORLD_STATUS_SIZE = { width: 1.25, height: 1.25 * HEIGHT / WIDTH, offsetY: -0.43 } as const;

export interface WorldStatusView {
    readonly title: string;
    readonly line: string;
    readonly role: WorldNoteRoleKind | null;
    /** [0, 1] */
    readonly formation: number;
    readonly coherence: number;
}

export class XrWorldStatus {
    readonly mesh: THREE.Mesh;
    /** Canvas redraws so far (diagnostics and tests). */
    redraws = 0;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly texture: THREE.CanvasTexture;
    private lastTitle = '';
    private lastLine = '';
    private lastRole: WorldNoteRoleKind | null | undefined = undefined;
    private lastFormation = -1;
    private lastCoherence = -1;

    constructor(doc: Document = document) {
        this.canvas = doc.createElement('canvas');
        this.canvas.width = WIDTH; this.canvas.height = HEIGHT;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas context unavailable for the world status');
        this.ctx = ctx;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_STATUS_SIZE.width, WORLD_STATUS_SIZE.height),
            new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false }));
        this.mesh.position.set(0, WORLD_STATUS_SIZE.offsetY, 0);
        this.mesh.name = 'xr-world-status';
        this.mesh.visible = false;
    }

    /** Shows a view (null hides the plate). Redraws only when what it shows changed. */
    update(view: WorldStatusView | null): void {
        this.mesh.visible = view !== null;
        if (!view) return;
        const formation = Math.round(view.formation * 100), coherence = Math.round(view.coherence * 100);
        if (view.title === this.lastTitle && view.line === this.lastLine && view.role === this.lastRole
            && formation === this.lastFormation && coherence === this.lastCoherence) return;
        this.lastTitle = view.title; this.lastLine = view.line; this.lastRole = view.role;
        this.lastFormation = formation; this.lastCoherence = coherence;
        this.draw(view, formation, coherence);
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.texture.dispose();
        this.mesh.removeFromParent();
    }

    private draw(view: WorldStatusView, formation: number, coherence: number): void {
        const ctx = this.ctx, accent = ROLE_CSS[view.role ?? 'none'];
        this.redraws++;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = 'rgba(2, 6, 16, 0.5)';
        ctx.fillRect(20, 8, WIDTH - 40, HEIGHT - 16);
        ctx.fillStyle = accent;
        ctx.fillRect(20, 8, 5, HEIGHT - 16);
        ctx.fillRect(20, 8, 70, 2);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = accent;
        ctx.font = `700 28px ${FONT}`;
        ctx.fillText(view.title, 44, 20);
        ctx.fillStyle = '#b4c8e2';
        ctx.font = `500 24px ${FONT}`;
        let line = view.line;
        while (line.length > 8 && ctx.measureText(line).width > 470) line = `${line.slice(0, -4)}...`;
        ctx.fillText(line, 44, 70);
        // Two bars: formation (the hall the player built) and coherence (recent accuracy).
        const bar = (label: string, value: number, y: number, color: string) => {
            ctx.fillStyle = '#8ba6c4';
            ctx.font = `600 18px ${FONT}`;
            ctx.fillText(label, 540, y);
            ctx.fillStyle = 'rgba(79, 216, 255, 0.15)';
            ctx.fillRect(540, y + 24, 180, 8);
            ctx.fillStyle = color;
            ctx.fillRect(540, y + 24, 180 * value / 100, 8);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#eef8ff';
            ctx.fillText(`${value}%`, 720, y);
            ctx.textAlign = 'left';
        };
        bar('FORMATION', formation, 20, '#ffc23d');
        bar('COHERENCE', coherence, 70, '#4fd8ff');
        this.texture.needsUpdate = true;
    }
}
