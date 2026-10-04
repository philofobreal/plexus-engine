// Compact track panel for the /xr/ desktop page (ADR-009 Addendum S): a persistent corner button
// plus a slide-out panel that overlays the renderer without resizing it. It holds only what must be
// HTML -- choosing an audio file (a native file picker), the Play / Resume transport and Enter VR
// (both need a real user gesture) -- with their status lines. Every setting, pause, results and
// help screen lives in the game menu drawn inside the canvas (`XrMenuModel` / `XrMenuPanel`), on the
// desktop and in the headset alike; the second corner button (or Escape) opens it.
//
// This module owns only DOM structure, open/close state, Escape-to-close and focus handling.
// XrAppController keeps every behavioral decision and wires the exposed elements.

export type XrDrawerStatus = 'idle' | 'busy' | 'ready' | 'error';

const PANEL_ID = 'xr-command-drawer';
/** Spoken form of the menu button's status light (the LED itself is decorative). */
const STATUS_TEXT: Record<XrDrawerStatus, string> = { idle: 'no track loaded', busy: 'analyzing', ready: 'track ready', error: 'error' };

export class XrCommandDrawer {
    /** Pointer-transparent chrome layer; hidden entirely while an immersive session presents. */
    readonly root: HTMLDivElement;
    /** Opens / closes the track panel. */
    readonly menuButton: HTMLButtonElement;
    /** Opens the in-canvas game menu (settings, pause, results); Escape does the same. */
    readonly gameMenuButton: HTMLButtonElement;
    /** The track panel (keeps the historical `xr-launch-overlay` class). */
    readonly panel: HTMLDivElement;
    readonly fileInput: HTMLInputElement;
    readonly trackTitleEl: HTMLParagraphElement;
    readonly progressEl: HTMLParagraphElement;
    readonly errorEl: HTMLParagraphElement;
    readonly trackInfoEl: HTMLParagraphElement;
    readonly capabilityEl: HTMLParagraphElement;
    readonly enterVrButton: HTMLButtonElement;
    readonly previewButton: HTMLButtonElement;
    /** The game menu button asks the host to open (or close) the canvas menu. */
    onGameMenu: (() => void) | null = null;
    private readonly doc: Document;
    private opened = false;
    private status: XrDrawerStatus = 'idle';
    private readonly handleKeyDown = (event: KeyboardEvent) => {
        // Escape closes the panel when focus is inside it; otherwise it belongs to the game menu.
        if (event.key !== 'Escape' || !this.opened || this.root.hidden) return;
        const active = this.doc.activeElement;
        if (!active || !this.panel.contains(active)) return;
        event.preventDefault();
        this.close();
    };

    constructor(doc: Document = document) {
        this.doc = doc;
        const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => {
            const element = doc.createElement(tag);
            if (className) element.className = className;
            return element;
        };
        this.root = el('div', 'xr-chrome');

        this.menuButton = el('button', 'xr-menu-button');
        this.menuButton.type = 'button';
        this.menuButton.setAttribute('aria-controls', PANEL_ID);
        const icon = el('span', 'xr-menu-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.append(el('span'), el('span'), el('span'));
        const led = el('span', 'xr-menu-status');
        led.setAttribute('aria-hidden', 'true');
        this.menuButton.append(icon, led);
        this.menuButton.addEventListener('click', () => this.toggle());

        this.gameMenuButton = el('button', 'xr-menu-button xr-game-menu-button');
        this.gameMenuButton.type = 'button';
        this.gameMenuButton.title = 'Game menu (Esc)';
        this.gameMenuButton.setAttribute('aria-label', 'Game menu: settings, pause and results (Escape)');
        this.gameMenuButton.setAttribute('aria-keyshortcuts', 'Escape');
        const gear = el('span', 'xr-game-menu-icon');
        gear.setAttribute('aria-hidden', 'true');
        gear.textContent = '⚙';
        this.gameMenuButton.append(gear);
        this.gameMenuButton.addEventListener('click', () => { this.onGameMenu?.(); this.gameMenuButton.blur(); });

        this.panel = el('div', 'xr-launch-overlay xr-drawer');
        this.panel.id = PANEL_ID;
        this.panel.setAttribute('role', 'region');
        this.panel.setAttribute('aria-label', 'Plexus XR track');

        const title = el('h1', 'xr-launch-title');
        title.textContent = 'Plexus XR';

        this.fileInput = el('input', 'xr-file-input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'audio/*';
        this.fileInput.setAttribute('aria-label', 'Choose audio track');

        this.trackTitleEl = el('p', 'xr-track-title');
        this.progressEl = el('p', 'xr-progress');
        this.progressEl.setAttribute('aria-live', 'polite');
        this.errorEl = el('p', 'xr-error');
        this.errorEl.setAttribute('role', 'alert');
        this.trackInfoEl = el('p', 'xr-track-info');
        this.capabilityEl = el('p', 'xr-capability');
        this.capabilityEl.textContent = 'Checking WebXR support...';

        this.enterVrButton = el('button', 'xr-enter-button');
        this.enterVrButton.type = 'button';
        this.enterVrButton.textContent = 'Enter VR';
        this.enterVrButton.disabled = true;
        this.previewButton = el('button', 'xr-preview-button');
        this.previewButton.type = 'button';
        this.previewButton.textContent = 'Play';
        this.previewButton.disabled = true;
        const actions = el('div', 'xr-actions');
        actions.append(this.previewButton, this.enterVrButton);
        const hint = el('p', 'xr-menu-hint');
        hint.textContent = 'Settings, pause and results: game menu (⚙ or Esc).';

        this.panel.append(title, this.fileInput, this.trackTitleEl, this.progressEl, this.errorEl, this.trackInfoEl,
            actions, this.capabilityEl, hint);
        this.root.append(this.menuButton, this.gameMenuButton, this.panel);
        doc.addEventListener('keydown', this.handleKeyDown);
        this.setStatus('idle');
        this.open();
    }

    get isOpen(): boolean { return this.opened; }

    open(): void { this.apply(true); }

    /** Closes the panel; focus inside it returns to the menu button instead of being lost. */
    close(): void {
        const active = this.doc.activeElement;
        const focusInside = !!active && this.panel.contains(active);
        this.apply(false);
        if (focusInside) this.menuButton.focus({ preventScroll: true });
    }

    toggle(): void {
        if (this.opened) this.close(); else this.open();
    }

    /** Reflects whether the canvas game menu is open (for assistive technology). */
    setGameMenuOpen(open: boolean): void {
        this.gameMenuButton.setAttribute('aria-expanded', String(open));
    }

    setStatus(status: XrDrawerStatus): void {
        if (this.status === status && this.menuButton.dataset.status === status) return;
        this.status = status;
        this.menuButton.dataset.status = status;
        this.menuButton.title = STATUS_TEXT[status];
        this.applyLabel();
    }

    /** Immersive sessions hide the desktop chrome without changing the panel's open state. */
    setVisible(visible: boolean): void {
        this.root.hidden = !visible;
    }

    dispose(): void {
        this.doc.removeEventListener('keydown', this.handleKeyDown);
        this.root.remove();
    }

    private apply(open: boolean): void {
        this.opened = open;
        this.panel.dataset.open = String(open);
        this.panel.inert = !open;
        this.panel.setAttribute('aria-hidden', String(!open));
        this.menuButton.setAttribute('aria-expanded', String(open));
        this.applyLabel();
    }

    private applyLabel(): void {
        this.menuButton.setAttribute('aria-label', `${this.opened ? 'Close' : 'Open'} track panel, ${STATUS_TEXT[this.status]}`);
    }
}
