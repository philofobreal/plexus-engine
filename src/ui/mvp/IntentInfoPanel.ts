import { intentDescription, intentLabel } from './mvpFormat';

export interface IntentInfoAnchor {
    /** Viewport-relative coordinates of the tapped/clicked segment (e.g. touch/click clientX/Y). */
    x: number;
    y: number;
}

/**
 * Dismissible info callout for a dramaturgical-intent timeline segment (ESTABLISH / RECOVER /
 * EXPAND / ...). One instance, reused for every tap: on wide viewports it renders as a small
 * popover pinned near the tapped point (clamped to stay on-screen, the same positioning
 * pattern DashboardUI's metric tooltip uses); on narrow viewports it renders as a full-width
 * bar pinned to the bottom of the screen so a thumb can reach the close button. Dismiss via the
 * close button, a tap outside, or Escape.
 */
export class IntentInfoPanel {
    readonly root: HTMLElement;
    private readonly titleEl: HTMLElement;
    private readonly bodyEl: HTMLElement;
    private isOpen = false;
    private readonly onDocPointerDown = (event: PointerEvent): void => {
        if (!this.isOpen) return;
        const target = event.target as Node | null;
        if (target && this.root.contains(target)) return;
        this.hide();
    };
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') this.hide();
    };

    constructor() {
        this.root = document.createElement('div');
        this.root.className = 'mvp-intent-panel mvp-hidden';
        this.root.setAttribute('role', 'dialog');
        this.root.innerHTML = `
            <div class="mvp-intent-panel-header">
                <span class="mvp-intent-panel-title"></span>
                <button type="button" class="mvp-intent-panel-close" aria-label="Close">&times;</button>
            </div>
            <p class="mvp-intent-panel-body"></p>
        `;
        this.titleEl = this.root.querySelector('.mvp-intent-panel-title')!;
        this.bodyEl = this.root.querySelector('.mvp-intent-panel-body')!;
        this.root.querySelector('.mvp-intent-panel-close')!.addEventListener('click', () => this.hide());
    }

    show(intent: string, anchor: IntentInfoAnchor, isMobile: boolean): void {
        this.titleEl.textContent = intentLabel(intent);
        this.bodyEl.textContent = intentDescription(intent);

        this.root.classList.remove('mvp-hidden');
        this.root.classList.toggle('mvp-intent-panel-sheet', isMobile);
        this.root.classList.toggle('mvp-intent-panel-popover', !isMobile);

        if (!isMobile) {
            // Measure after making visible (dimensions are 0 while display:none), then clamp so
            // the popover never renders off-screen near an edge.
            this.root.style.left = '0px';
            this.root.style.top = '0px';
            const rect = this.root.getBoundingClientRect();
            const gap = 12;
            const maxLeft = window.innerWidth - rect.width - gap;
            const maxTop = window.innerHeight - rect.height - gap;
            const left = Math.max(gap, Math.min(anchor.x - rect.width / 2, maxLeft));
            const top = Math.max(gap, Math.min(anchor.y + 16, maxTop));
            this.root.style.left = `${left}px`;
            this.root.style.top = `${top}px`;
        } else {
            this.root.style.left = '';
            this.root.style.top = '';
        }

        if (!this.isOpen) {
            this.isOpen = true;
            document.addEventListener('pointerdown', this.onDocPointerDown, true);
            document.addEventListener('keydown', this.onKeyDown);
        }
    }

    hide(): void {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.root.classList.add('mvp-hidden');
        document.removeEventListener('pointerdown', this.onDocPointerDown, true);
        document.removeEventListener('keydown', this.onKeyDown);
    }
}
