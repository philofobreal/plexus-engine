// Desktop aiming translates a mouse click into the same timed domain strike as VR input.
// No second clock, game state, or scoring path.
import * as THREE from 'three';
import { DEFAULT_RHYTHM_GAME_CONFIG, notePosition, type NoteRuntimeState, type StrikeAttempt } from '../gameplay';
import type { ControllerHand } from './runtime/XrInputAdapter';

export function desktopStrikeForRay(ray: THREE.Ray, notes: readonly NoteRuntimeState[], songTime: number,
    hand: ControllerHand): StrikeAttempt | null {
    const target = new THREE.Vector3();
    let closestDepth = Infinity;
    let selected: THREE.Vector3 | null = null;
    let selectedId: string | undefined;
    for (const entry of notes) {
        if (entry.status !== 'pending') continue;
        notePosition(entry.note, songTime, target);
        const depth = target.clone().sub(ray.origin).dot(ray.direction);
        if (depth < 0 || depth >= closestDepth) continue;
        // Click targets match rendered block faces, with a small 2 cm pointing tolerance.
        const half = DEFAULT_RHYTHM_GAME_CONFIG.noteSizeMeters / 2 + 0.02;
        const bounds = new THREE.Box3(target.clone().addScalar(-half), target.clone().addScalar(half));
        if (!ray.intersectsBox(bounds)) continue;
        closestDepth = depth;
        selected = target.clone();
        selectedId = entry.note.id;
    }
    // Desktop clicks represent a deliberate cut; physical speed applies only to tracked VR input.
    return selected ? { songTime, hand, position: selected, speed: DEFAULT_RHYTHM_GAME_CONFIG.minStrikeSpeedMps, desktopTargetId: selectedId } : null;
}

export class DesktopInputAdapter {
    private readonly canvas: HTMLCanvasElement;
    onStrike: ((hand: ControllerHand, x: number, y: number) => void) | null = null;
    onTogglePlayback: (() => void) | null = null;
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
        if (event.code !== 'Space' || event.repeat) return;
        const element = event.target as HTMLElement | null;
        if (element?.closest('input, button, select, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
        this.onTogglePlayback?.();
    };
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        canvas.addEventListener('pointerdown', this.pointerDown);
        canvas.addEventListener('contextmenu', this.contextMenu);
        window.addEventListener('keydown', this.keyDown);
    }
    dispose(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDown);
        this.canvas.removeEventListener('contextmenu', this.contextMenu);
        window.removeEventListener('keydown', this.keyDown);
    }
}
