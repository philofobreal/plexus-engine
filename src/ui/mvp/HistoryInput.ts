interface HistoryInputCallbacks {
    undo: () => void;
    redo: () => void;
    beginGesture: () => void;
    endGesture: () => void;
    /** Blocks background edits during a modal decision, loading, regeneration or export. */
    blocked: () => boolean;
}

const RANGE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/** Capture-phase routing deliberately overrides native text undo on this editing surface,
 * per the MVP's focus-independent shortcut contract. No activeElement allow/deny list.
 */
export class HistoryInput {
    private range: EventTarget | null = null;
    private readonly host: Window;
    private readonly callbacks: HistoryInputCallbacks;
    constructor(host: Window, callbacks: HistoryInputCallbacks) {
        this.host = host;
        this.callbacks = callbacks;
        host.addEventListener('keydown', this.keyDown, true);
        host.addEventListener('keyup', this.keyUp, true);
        host.addEventListener('pointerdown', this.pointerDown, true);
        host.addEventListener('pointerup', this.finish, true);
        host.addEventListener('pointercancel', this.finish, true);
        host.addEventListener('focusout', this.focusOut, true);
        host.addEventListener('blur', this.finish);
    }

    private isRange(target: EventTarget | null): boolean {
        const element = target as HTMLInputElement | null;
        return element?.tagName === 'INPUT' && element.type === 'range';
    }
    private start(target: EventTarget | null): void {
        if (this.range === target) return;
        this.finish();
        this.range = target;
        this.callbacks.beginGesture();
    }
    private readonly finish = (): void => { this.range = null; this.callbacks.endGesture(); };
    private readonly focusOut = (event: FocusEvent): void => { if (event.target === this.range) this.finish(); };
    private readonly pointerDown = (event: PointerEvent): void => {
        if (this.isRange(event.target) && !this.callbacks.blocked()) this.start(event.target);
        else this.finish();
    };
    private readonly keyUp = (event: KeyboardEvent): void => {
        if (RANGE_KEYS.has(event.key)) this.finish();
    };
    private readonly keyDown = (event: KeyboardEvent): void => {
        if (event.isComposing || event.keyCode === 229 || event.altKey) return;
        const key = event.key.toLowerCase();
        const modifier = event.ctrlKey || event.metaKey;
        const undo = modifier && key === 'z' && !event.shiftKey;
        const redo = modifier && (key === 'z' && event.shiftKey || key === 'y' && !event.shiftKey);
        if (undo || redo) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.finish();
            if (!event.repeat && !this.callbacks.blocked()) {
                if (undo) this.callbacks.undo(); else this.callbacks.redo();
            }
            return;
        }
        if (!modifier && this.isRange(event.target) && RANGE_KEYS.has(event.key) && !this.callbacks.blocked()) {
            this.start(event.target);
            // Keep the browser's range behavior, but do not let timeline Home/End shortcuts run.
            event.stopPropagation();
        }
    };

    dispose(): void {
        this.finish();
        this.host.removeEventListener('keydown', this.keyDown, true);
        this.host.removeEventListener('keyup', this.keyUp, true);
        this.host.removeEventListener('pointerdown', this.pointerDown, true);
        this.host.removeEventListener('pointerup', this.finish, true);
        this.host.removeEventListener('pointercancel', this.finish, true);
        this.host.removeEventListener('focusout', this.focusOut, true);
        this.host.removeEventListener('blur', this.finish);
    }
}
