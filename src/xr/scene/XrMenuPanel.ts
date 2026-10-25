// In-VR menu panel (ADR-009 Addendum O): one canvas texture on a world-space plane in front of
// the player, drawn from the pure `XrMenuModel` layout and redrawn only when the displayed state
// changes (hover, screen, tab, settings, status). Controller rays are hit-tested against the
// plane analytically; the panel never takes part in gameplay.

import * as THREE from 'three';
import { XR_INSTRUMENT_FONT, XR_INSTRUMENT_INK } from './XrInstrumentStyle';
import { MENU_CANVAS, menuItemAt, menuLayout, type XrMenuContext, type XrMenuItem, type XrMenuLayout, type XrMenuState,
    type XrMenuTextRole } from '../XrMenuModel';

// Preserve the former metres-per-canvas-pixel ratio: more space, the same physical font size.
export const MENU_PANEL_WIDTH_METERS = 1.6;
export const MENU_PANEL_HEIGHT_METERS = MENU_PANEL_WIDTH_METERS * MENU_CANVAS.height / MENU_CANVAS.width;
/** Distance from the eyes, and drop below eye height, of the panel's center when it opens. */
export const MENU_DISTANCE_METERS = 1.3;
export const MENU_BELOW_EYES_METERS = 0.12;

const FONT = XR_INSTRUMENT_FONT;
const CYAN = '#4fd8ff';
const MAGENTA = '#ff5fb4';
const TEXT_COLORS: Record<XrMenuTextRole, string> = {
    title: XR_INSTRUMENT_INK, heading: XR_INSTRUMENT_INK, label: '#cfe4f7', body: '#dbeaf8', muted: '#8ba6c4', value: XR_INSTRUMENT_INK, accent: '#ffd35c'
};
const TEXT_WEIGHTS: Record<XrMenuTextRole, number> = { title: 800, heading: 700, label: 600, body: 500, muted: 500, value: 700, accent: 800 };

const COMPACT_LABELS: Readonly<Record<string, string>> = {
    Gameplay: 'Play', Character: 'Char.', Material: 'Mat.', Cockpit: 'Cabin',
    Performance: 'Perf.', Balanced: 'Bal.', Crystal: 'Cryst.', Choreography: 'Choreo',
    Expressive: 'Expr.', Alternate: 'Alt.', Crossover: 'Cross',
    'Background quality': 'BG quality', 'Background update': 'BG update', 'Background distance': 'BG distance',
    'Background pacing': 'BG pacing', 'Background raster': 'BG raster', 'Material renderer': 'Renderer',
    'Copy settings': 'Copy config', 'Copy diagnostics': 'Copy stats', 'Reset defaults': 'Reset',
    'Confirm reset?': 'Reset?'
};

/** Keep the authored font readable: use a recognizable short name, then ellipsize if still needed. */
export function shortenMenuText(value: string, maxWidth: number, measure: (text: string) => number): string {
    if (measure(value) <= maxWidth) return value;
    const compact = COMPACT_LABELS[value] ?? value;
    if (measure(compact) <= maxWidth) return compact;
    if (measure('…') > maxWidth) return '';
    let end = compact.length;
    while (end > 0 && measure(compact.slice(0, end) + '…') > maxWidth) end--;
    return compact.slice(0, end).trimEnd() + '…';
}

export interface XrMenuHit {
    /** Item under the ray, or null on the panel's background. */
    readonly item: XrMenuItem | null;
    /** Ray length to the panel, in meters. */
    readonly distance: number;
}

export class XrMenuPanel {
    readonly root = new THREE.Group();
    readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly texture: THREE.CanvasTexture;
    private layoutValue: XrMenuLayout | null = null;
    private key = '';
    private lastState: XrMenuState | null = null;
    private lastContext: XrMenuContext | null = null;
    private redraws = 0;
    private readonly inverse = new THREE.Matrix4();
    private readonly localRay = new THREE.Ray();

    constructor(doc: Document = document) {
        this.canvas = doc.createElement('canvas');
        this.canvas.width = MENU_CANVAS.width;
        this.canvas.height = MENU_CANVAS.height;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas context unavailable for the XR menu');
        this.ctx = ctx;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        // Always readable: drawn last, over the (frozen) stage, without depth testing.
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(MENU_PANEL_WIDTH_METERS, MENU_PANEL_HEIGHT_METERS),
            new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
        this.mesh.name = 'xrMenuPanel';
        this.mesh.renderOrder = 20;
        this.root.add(this.mesh);
        this.root.visible = false;
    }

    /** The layout on display (null before the first update). */
    get layout(): XrMenuLayout | null { return this.layoutValue; }
    /** Canvas redraws so far (redraws happen only on display changes). */
    get redrawCount(): number { return this.redraws; }
    get visible(): boolean { return this.root.visible; }
    setVisible(visible: boolean): void { this.root.visible = visible; }

    /**
     * Rebuilds and redraws only when the displayed menu changed. Returns the current layout. State
     * and context are treated as immutable: the same two objects again skip even the comparison.
     */
    update(state: XrMenuState, context: XrMenuContext): XrMenuLayout {
        if (state === this.lastState && context === this.lastContext && this.layoutValue) return this.layoutValue;
        this.lastState = state; this.lastContext = context;
        const key = JSON.stringify([state, context]);
        if (key !== this.key || !this.layoutValue) {
            this.key = key;
            this.layoutValue = menuLayout(state, context);
            this.draw(this.layoutValue, state.hover);
        }
        return this.layoutValue;
    }

    /** Places the panel in front of a viewer (eye position and yaw), facing them. */
    placeFacing(x: number, eyeY: number, z: number, yaw: number): void {
        if (![x, eyeY, z, yaw].every(Number.isFinite)) return;
        this.root.position.set(x - Math.sin(yaw) * MENU_DISTANCE_METERS, eyeY - MENU_BELOW_EYES_METERS, z - Math.cos(yaw) * MENU_DISTANCE_METERS);
        this.root.rotation.set(0, yaw, 0);
        this.root.updateMatrixWorld(true);
    }

    /** Desktop menus follow pitch as well as yaw, remaining reachable after looking up or down. */
    placeForCamera(camera: THREE.PerspectiveCamera): void {
        // The wider panel must also fit narrow/portrait viewports. Move the whole plane rather
        // than compressing its controls; headset placement keeps its comfortable fixed distance.
        const halfFov = camera.getEffectiveFOV() * Math.PI / 360;
        const tangent = Math.tan(halfFov), aspect = camera.aspect;
        const distance = Number.isFinite(tangent) && tangent > 0 && Number.isFinite(aspect) && aspect > 0
            ? Math.max(MENU_DISTANCE_METERS, MENU_PANEL_WIDTH_METERS / (2 * tangent * aspect * .9),
                (MENU_PANEL_HEIGHT_METERS / 2 + MENU_BELOW_EYES_METERS) / (tangent * .9))
            : MENU_DISTANCE_METERS;
        this.root.position.set(0, -MENU_BELOW_EYES_METERS, -distance)
            .applyQuaternion(camera.quaternion).add(camera.position);
        this.root.quaternion.copy(camera.quaternion);
        this.root.updateMatrixWorld(true);
    }

    /** Where a world-space ray meets the visible panel (front side only), or null. */
    hitTest(ray: THREE.Ray): XrMenuHit | null {
        if (!this.root.visible || !this.layoutValue) return null;
        this.mesh.updateWorldMatrix(true, false);
        this.localRay.copy(ray).applyMatrix4(this.inverse.copy(this.mesh.matrixWorld).invert());
        const { origin, direction } = this.localRay;
        if (origin.z <= 0 || direction.z >= 0) return null;
        const t = -origin.z / direction.z;
        const x = origin.x + direction.x * t, y = origin.y + direction.y * t;
        if (Math.abs(x) > MENU_PANEL_WIDTH_METERS / 2 || Math.abs(y) > MENU_PANEL_HEIGHT_METERS / 2) return null;
        const px = (x / MENU_PANEL_WIDTH_METERS + 0.5) * MENU_CANVAS.width;
        const py = (0.5 - y / MENU_PANEL_HEIGHT_METERS) * MENU_CANVAS.height;
        return { item: menuItemAt(this.layoutValue, px, py), distance: t };
    }

    dispose(): void {
        this.root.removeFromParent();
        this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
    }

    private draw(layout: XrMenuLayout, hover: string | null): void {
        this.redraws++;
        const ctx = this.ctx, w = MENU_CANVAS.width, h = MENU_CANVAS.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(4, 10, 24, 0.94)';
        ctx.fillRect(0, 0, w, h);
        // Instrument frame: hairline border with hand-coloured corner ticks.
        ctx.fillStyle = 'rgba(79, 216, 255, 0.35)';
        ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2); ctx.fillRect(0, 0, 2, h); ctx.fillRect(w - 2, 0, 2, h);
        ctx.fillStyle = CYAN; ctx.fillRect(0, 0, 60, 5); ctx.fillRect(0, 0, 5, 60);
        ctx.fillStyle = MAGENTA; ctx.fillRect(w - 60, h - 5, 60, 5); ctx.fillRect(w - 5, h - 60, 5, 60);
        for (const entry of layout.items) this.drawItem(entry, entry.id === hover);
        ctx.textBaseline = 'middle';
        for (const line of layout.texts) {
            if (!line.text) continue;
            ctx.fillStyle = TEXT_COLORS[line.role];
            ctx.textAlign = line.align;
            const maxWidth = line.width ?? w - 2 * 40;
            const lines = this.wrap(line.text, line.size, TEXT_WEIGHTS[line.role], maxWidth, line.maxLines);
            lines.forEach((part, i) => {
                const label = this.fitText(part, line.size, TEXT_WEIGHTS[line.role], maxWidth);
                ctx.fillText(label, line.x, line.y + i * line.size * 1.2);
            });
        }
        this.texture.needsUpdate = true;
    }

    private drawItem(entry: XrMenuItem, hovered: boolean): void {
        const ctx = this.ctx;
        const accent = entry.primary ? MAGENTA : CYAN;
        ctx.globalAlpha = entry.disabled ? 0.35 : 1;
        ctx.fillStyle = entry.selected ? 'rgba(79, 216, 255, 0.28)' : entry.primary ? 'rgba(255, 95, 180, 0.22)'
            : hovered ? 'rgba(79, 216, 255, 0.16)' : 'rgba(20, 34, 58, 0.9)';
        ctx.fillRect(entry.x, entry.y, entry.w, entry.h);
        // Border: bright when hovered, accent underline when selected.
        ctx.fillStyle = hovered && !entry.disabled ? '#eef8ff' : 'rgba(79, 216, 255, 0.35)';
        const t = hovered && !entry.disabled ? 3 : 1;
        ctx.fillRect(entry.x, entry.y, entry.w, t); ctx.fillRect(entry.x, entry.y + entry.h - t, entry.w, t);
        ctx.fillRect(entry.x, entry.y, t, entry.h); ctx.fillRect(entry.x + entry.w - t, entry.y, t, entry.h);
        if (entry.selected || entry.primary) { ctx.fillStyle = accent; ctx.fillRect(entry.x, entry.y + entry.h - 4, entry.w, 4); }
        ctx.fillStyle = entry.selected || hovered ? '#ffffff' : '#dbeaf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = this.fitText(entry.label, entry.kind === 'step' ? 34 : entry.kind === 'button' ? 28 : 22,
            entry.selected || entry.primary ? 800 : 600, entry.w - 16);
        ctx.fillText(label, entry.x + entry.w / 2, entry.y + entry.h / 2 + 1);
        ctx.globalAlpha = 1;
    }

    /** Greedy word wrap at `size` into at most `maxLines` lines (the last line takes the rest). */
    private wrap(value: string, size: number, weight: number, maxWidth: number, maxLines: number): string[] {
        if (maxLines <= 1) return [value];
        this.ctx.font = `${weight} ${size}px ${FONT}`;
        const lines: string[] = [];
        let current = '';
        const words = value.split(' ');
        for (let i = 0; i < words.length; i++) {
            const candidate = current ? `${current} ${words[i]}` : words[i];
            if (current && this.ctx.measureText(candidate).width > maxWidth && lines.length < maxLines - 1) {
                lines.push(current);
                current = words[i];
            } else current = candidate;
        }
        lines.push(current);
        return lines;
    }

    private fitText(value: string, size: number, weight: number, maxWidth: number): string {
        this.ctx.font = `${weight} ${size}px ${FONT}`;
        return shortenMenuText(value, maxWidth, text => this.ctx.measureText(text).width);
    }
}
