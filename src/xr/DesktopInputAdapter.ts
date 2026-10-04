// Desktop aiming translates a mouse click into the same timed domain strike as VR input.
// No second clock, game state, or scoring path.
import * as THREE from 'three';
import { DEFAULT_RHYTHM_GAME_CONFIG, notePosition, type NoteRuntimeState, type RhythmGameConfig, type StrikeAttempt } from '../gameplay';
import type { ControllerHand } from './runtime/XrInputAdapter';
import type { XrTrackPath } from './scene/XrTrackPath';

/** `path` is the shared XR projection: rays test rendered targets, strikes report canonical positions. */
export function desktopStrikeForRay(ray: THREE.Ray, notes: readonly NoteRuntimeState[], songTime: number,
    hand: ControllerHand, path?: XrTrackPath, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG): StrikeAttempt | null {
    const target = new THREE.Vector3();
    let closestDepth = Infinity;
    let selected: THREE.Vector3 | null = null;
    let selectedId: string | undefined;
    for (const entry of notes) {
        if (entry.status !== 'pending') continue;
        notePosition(entry.note, songTime, target, config);
        path?.projectPlayfieldPoint(target);
        const depth = target.clone().sub(ray.origin).dot(ray.direction);
        if (depth < 0 || depth >= closestDepth) continue;
        // Click targets match rendered block faces, with a small 2 cm pointing tolerance.
        const half = config.noteSizeMeters / 2 + 0.02;
        const bounds = new THREE.Box3(target.clone().addScalar(-half), target.clone().addScalar(half));
        if (!ray.intersectsBox(bounds)) continue;
        closestDepth = depth;
        selected = target.clone();
        path?.unprojectPlayfieldPoint(selected);
        selectedId = entry.note.id;
    }
    // Desktop clicks represent a deliberate cut; physical speed applies only to tracked VR input.
    return selected ? { songTime, hand, position: selected, speed: config.minStrikeSpeedMps, desktopTargetId: selectedId } : null;
}

/**
 * Keys the in-canvas game menu understands (Addendum S). Tab is deliberately not one of them: it
 * keeps moving the page focus, so keyboard users always reach the track panel's file picker and
 * buttons. `next` / `previous` remain the model's reading-order steps (Enter with nothing focused).
 */
export type DesktopMenuKey = 'escape' | 'enter' | 'next' | 'previous' | 'left' | 'right' | 'up' | 'down';
const MENU_KEYS: Readonly<Record<string, DesktopMenuKey>> = {
    Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'
};

export class DesktopInputAdapter {
    private readonly canvas: HTMLCanvasElement;
    onStrike: ((hand: ControllerHand, x: number, y: number) => void) | null = null;
    onTogglePlayback: (() => void) | null = null;
    /** Pointer position over the canvas in normalized device coordinates, or null when it leaves. */
    onPointerMove: ((x: number | null, y: number | null) => void) | null = null;
    /** A menu key; return true when the menu used it (the browser default is then suppressed). */
    onMenuKey: ((key: DesktopMenuKey) => boolean) | null = null;
    private readonly pointerMove = (event: PointerEvent) => {
        const bounds = this.canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        this.onPointerMove?.((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    };
    private readonly pointerLeave = () => this.onPointerMove?.(null, null);
    private readonly pointerDown = (event: PointerEvent) => {
        if (event.button !== 0 && event.button !== 2) return;
        const bounds = this.canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        event.preventDefault();
        this.onStrike?.(event.button === 0 ? 'left' : 'right',
            (event.clientX - bounds.left) / bounds.width * 2 - 1,
            -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    };
    private readonly contextMenu = (event: Event) => event.preventDefault();
    private readonly keyDown = (event: KeyboardEvent) => {
        const element = event.target as HTMLElement | null;
        // Form controls keep their own keys (a focused button activates on Space / Enter).
        const inControl = typeof element?.closest === 'function'
            && !!element.closest('input, button, select, textarea, [contenteditable="true"]');
        const menuKey = MENU_KEYS[event.key];
        // Inside the track panel Escape closes the panel (XrCommandDrawer); elsewhere the menu owns it.
        if (menuKey && !inControl && !event.repeat) {
            if (this.onMenuKey?.(menuKey)) event.preventDefault();
            return;
        }
        if (event.code !== 'Space' || event.repeat || inControl) return;
        event.preventDefault();
        this.onTogglePlayback?.();
    };
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        canvas.addEventListener('pointerdown', this.pointerDown);
        canvas.addEventListener('pointermove', this.pointerMove);
        canvas.addEventListener('pointerleave', this.pointerLeave);
        canvas.addEventListener('contextmenu', this.contextMenu);
        window.addEventListener('keydown', this.keyDown);
    }
    dispose(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDown);
        this.canvas.removeEventListener('pointermove', this.pointerMove);
        this.canvas.removeEventListener('pointerleave', this.pointerLeave);
        this.canvas.removeEventListener('contextmenu', this.contextMenu);
        window.removeEventListener('keydown', this.keyDown);
    }
}
