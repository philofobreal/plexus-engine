export type QuickTuningTab = 'character' | 'tuning';

const TAB_ICONS: Record<QuickTuningTab, string> = {
    character: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
    tuning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V10M5 6V3M12 21v-7M12 10V3M19 21v-3M19 14V3M2 10h6M9 3h6M16 14h6"/></svg>'
};

const TAB_LABELS: Record<QuickTuningTab, string> = {
    character: 'Visual character',
    tuning: 'Advanced tuning'
};

/**
 * Collapsible right-edge rail + slide-out panel, living inside PreviewStage's parent (previewCol)
 * so it stays reachable both in the normal windowed layout and inside the native Fullscreen API,
 * which keeps only the fullscreen element and its descendants visible -- previewCol is the
 * element MvpUI puts into fullscreen (see MvpUI.toggleFullscreen), so anything outside it, like
 * the old static sideCol placement of MacroControls, simply disappears the moment fullscreen
 * engages. One component and one set of CSS rules, used identically in both states, makes "what
 * fullscreen looks like" and "what the normal view looks like" the same thing by construction
 * instead of two surfaces that could drift apart.
 *
 * Hosts exactly two fixed tabs (Visual character / Advanced tuning). Their content elements are
 * reparented into the panel body on open rather than cloned, so there is exactly one live DOM
 * instance of each panel and its internal state (scroll position, focus) survives switching tabs.
 */
export class QuickTuningDrawer {
    readonly root: HTMLElement;
    private readonly panelEl: HTMLElement;
    private readonly panelBody: HTMLElement;
    private readonly tabBtns: Record<QuickTuningTab, HTMLButtonElement>;
    private readonly content: Record<QuickTuningTab, HTMLElement>;
    private readonly onTabOpen?: (tab: QuickTuningTab) => void;
    private openTab: QuickTuningTab | null = null;

    private readonly onDocPointerDown = (event: PointerEvent): void => {
        if (this.openTab === null) return;
        const target = event.target as Node | null;
        if (target && this.root.contains(target)) return;
        this.close();
    };
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') this.close();
    };

    constructor(content: Record<QuickTuningTab, HTMLElement>, onTabOpen?: (tab: QuickTuningTab) => void) {
        this.content = content;
        this.onTabOpen = onTabOpen;

        this.root = document.createElement('div');
        this.root.className = 'mvp-quick-drawer';
        this.root.innerHTML = `
            <div class="mvp-quick-drawer-panel">
                <div class="mvp-quick-drawer-panel-body"></div>
            </div>
            <div class="mvp-quick-drawer-rail">
                <button type="button" class="mvp-quick-drawer-tab" data-tab="character" aria-label="${TAB_LABELS.character}" title="${TAB_LABELS.character}">${TAB_ICONS.character}</button>
                <button type="button" class="mvp-quick-drawer-tab" data-tab="tuning" aria-label="${TAB_LABELS.tuning}" title="${TAB_LABELS.tuning}">${TAB_ICONS.tuning}</button>
            </div>
        `;
        this.panelEl = this.root.querySelector('.mvp-quick-drawer-panel')!;
        this.panelBody = this.root.querySelector('.mvp-quick-drawer-panel-body')!;
        this.tabBtns = {
            character: this.root.querySelector('[data-tab="character"]')!,
            tuning: this.root.querySelector('[data-tab="tuning"]')!
        };
        (Object.keys(this.tabBtns) as QuickTuningTab[]).forEach((tab) => {
            this.tabBtns[tab].addEventListener('click', () => this.toggle(tab));
        });
    }

    /** Opens `tab` if closed or a different tab is open; collapses the drawer if `tab` is already open. */
    toggle(tab: QuickTuningTab): void {
        if (this.openTab === tab) { this.close(); return; }
        this.open(tab);
    }

    open(tab: QuickTuningTab): void {
        this.panelBody.replaceChildren(this.content[tab]);
        this.openTab = tab;
        this.panelEl.classList.add('is-open');
        (Object.keys(this.tabBtns) as QuickTuningTab[]).forEach((key) => {
            this.tabBtns[key].classList.toggle('is-active', key === tab);
        });
        document.addEventListener('pointerdown', this.onDocPointerDown, true);
        document.addEventListener('keydown', this.onKeyDown);
        this.onTabOpen?.(tab);
    }

    close(): void {
        if (this.openTab === null) return;
        this.openTab = null;
        this.panelEl.classList.remove('is-open');
        (Object.keys(this.tabBtns) as QuickTuningTab[]).forEach((key) => this.tabBtns[key].classList.remove('is-active'));
        document.removeEventListener('pointerdown', this.onDocPointerDown, true);
        document.removeEventListener('keydown', this.onKeyDown);
    }

    isOpen(): boolean {
        return this.openTab !== null;
    }

    /** Which tab is currently open, or null if the drawer is collapsed -- lets a caller refresh
     *  only the panel actually on screen instead of both, every frame. */
    getOpenTab(): QuickTuningTab | null {
        return this.openTab;
    }
}
