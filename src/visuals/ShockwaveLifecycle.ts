import type { VisualMode } from '../types';

export class ShockwaveLifecycle<T> {
    readonly items: T[] = [];
    private lastVisualMode: VisualMode;

    constructor(initialMode: VisualMode) {
        this.lastVisualMode = initialMode;
    }

    syncMode(mode: VisualMode): boolean {
        if (mode === this.lastVisualMode) return false;
        this.items.length = 0;
        this.lastVisualMode = mode;
        return true;
    }

    emit(mode: VisualMode, create: () => T): boolean {
        if (!modeUsesShockwaves(mode)) return false;
        this.items.push(create());
        return true;
    }
}

export function modeUsesShockwaves(mode: VisualMode): boolean {
    return mode !== 'cosmic-wormhole' && mode !== 'hero';
}
