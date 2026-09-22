import type { DramaturgyActivityLevel, DramaturgyVariantMode, TimelineLayers } from '../../types';
import type { HistoryScope, HistoryStatus } from './EditHistory';

export interface TimelineToggleState {
    snap: boolean;
    follow: boolean;
    draw: boolean;
    zoomed: boolean;
}

export interface TimelineToolbarCallbacks {
    onToggleSnap: (value: boolean) => void;
    onToggleFollow: (value: boolean) => void;
    onToggleDraw: (value: boolean) => void;
    onToggleZoom: (value: boolean) => void;
    onMorphScaleChange: (scale: number) => void;
    onToggleLayer: (layer: keyof TimelineLayers, value: boolean) => void;
    /** Fires only after the user has confirmed the destructive-regenerate warning. */
    onRegenerate: (activity: DramaturgyActivityLevel, variant: DramaturgyVariantMode) => void;
    onSave: () => Promise<boolean>;
    onUndo: () => void;
    onRedo: () => void;
    onHistoryScopeChange: (scope: HistoryScope) => void;
}

const LAYER_OPTIONS: Array<{ key: keyof TimelineLayers; letter: string; label: string }> = [
    { key: 'waveform', letter: 'W', label: 'Waveform' },
    { key: 'rms', letter: 'R', label: 'Loudness (RMS)' },
    { key: 'buildup', letter: 'B', label: 'Buildup' },
    { key: 'automation', letter: 'A', label: 'Automation' }
];

const ACTIVITY_OPTIONS: Array<{ value: DramaturgyActivityLevel; label: string }> = [
    { value: 'macro', label: 'Calm' },
    { value: 'balanced', label: 'Balanced' },
    { value: 'active', label: 'Active' }
];

const VARIANT_OPTIONS: Array<{ value: DramaturgyVariantMode; label: string }> = [
    { value: 'stable', label: 'Stable' },
    { value: 'paired', label: 'Paired' },
    { value: 'expressive', label: 'Expressive' }
];

/**
 * The MVP surface's redesigned equivalent of the dramaturgy panel's toolbar (design doc guidance:
 * port the timeline's underlying functionality, but of its buttons keep only Snap / Follow /
 * Draw / Zoom + Morph Scale). Also carries the Activity/Variation regenerate controls (advanced
 * dashboard's "Activity: Balanced" / "Variation: Paired" selects), rebuilt as one-tap buttons
 * that regenerate the whole plan under a confirmation guard so a user can't lose manual edits by
 * accident.
 */
export class TimelineToolbar {
    readonly root: HTMLElement;
    private readonly toggleBtns: Record<keyof TimelineToggleState, HTMLButtonElement>;
    private readonly layerBtns: Record<keyof TimelineLayers, HTMLButtonElement>;
    private readonly morphSlider: HTMLInputElement;
    private readonly morphValue: HTMLElement;
    private readonly activityBtns: Record<DramaturgyActivityLevel, HTMLButtonElement>;
    private readonly variantBtns: Record<DramaturgyVariantMode, HTMLButtonElement>;
    private readonly callbacks: TimelineToolbarCallbacks;
    private pendingActivity: DramaturgyActivityLevel = 'balanced';
    private pendingVariant: DramaturgyVariantMode = 'paired';
    private readonly saveButton: HTMLButtonElement;
    private readonly saveStatus: HTMLElement;
    private saving = false;
    private canSave = false;
    private dirty = false;
    private readonly undoButton: HTMLButtonElement;
    private readonly redoButton: HTMLButtonElement;
    private readonly scopeCheckbox: HTMLInputElement;
    private readonly historyStatus: HTMLElement;

    constructor(callbacks: TimelineToolbarCallbacks) {
        this.callbacks = callbacks;
        this.root = document.createElement('div');
        this.root.className = 'mvp-timeline-toolbar';
        this.root.innerHTML = `
            <div class="mvp-toolbar-row mvp-toolbar-layers">
                <span class="mvp-toolbar-layers-label">Track dramaturgy</span>
                <button type="button" class="mvp-btn mvp-journey-save" disabled>Save automation</button>
                <div class="mvp-toolbar-layers-group">
                    ${LAYER_OPTIONS.map((o) => `<button type="button" class="mvp-toolbar-layer" data-layer="${o.key}" title="Toggle ${o.label}" aria-pressed="false" aria-label="Toggle ${o.label}">${o.letter}</button>`).join('')}
                </div>
            </div>
            <div class="mvp-journey-save-status" role="status" aria-live="polite">No unsaved changes.</div>
            <div class="mvp-toolbar-row mvp-history-controls">
                <button type="button" class="mvp-btn" data-history-undo disabled aria-keyshortcuts="Control+z Meta+z">Undo</button>
                <button type="button" class="mvp-btn" data-history-redo disabled aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y">Redo</button>
                <label class="mvp-history-scope" title="Off: dramaturgy only. On: dramaturgy, Visual character and Advanced tuning. Switching keeps history; playback, saves and view settings are excluded.">
                    <input type="checkbox" data-history-scope> Include visual tuning
                </label>
            </div>
            <div class="mvp-history-status" role="status" aria-live="polite" data-history-status>Dramaturgy · 0 undo / 0 redo · 300-step history</div>
            <div class="mvp-toolbar-row mvp-toolbar-toggles">
                <button type="button" class="mvp-toolbar-toggle" data-toggle="snap" title="Snap moments to the beat grid" aria-pressed="false" aria-label="Snap to grid">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 10a7 7 0 0 1 14 0v4a2 2 0 0 0 2 2h1a2 2 0 0 0-2-2V10a9 9 0 0 0-18 0v4a2 2 0 0 0-2 2h1a2 2 0 0 0 2-2V10z"/></svg>
                    <span>Snap</span>
                </button>
                <button type="button" class="mvp-toolbar-toggle" data-toggle="follow" title="Keep the playhead in view while zoomed" aria-pressed="false" aria-label="Follow playhead">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>
                    <span>Follow</span>
                </button>
                <button type="button" class="mvp-toolbar-toggle" data-toggle="draw" title="Tap the journey to place a moment" aria-pressed="false" aria-label="Draw / place moments">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                    <span>Draw</span>
                </button>
                <button type="button" class="mvp-toolbar-toggle" data-toggle="zoomed" title="Zoom in around the playhead" aria-pressed="false" aria-label="Zoom timeline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    <span>Zoom</span>
                </button>
            </div>
            <div class="mvp-toolbar-row mvp-toolbar-morph">
                <span class="mvp-toolbar-morph-label">Morph Scale</span>
                <input type="range" class="mvp-slider mvp-toolbar-morph-slider" min="0.25" max="4" step="any" value="1" aria-label="Automation morph scale">
                <output class="mvp-toolbar-morph-value">100%</output>
            </div>
            <div class="mvp-toolbar-row mvp-toolbar-generate">
                <div class="mvp-toolbar-generate-group">
                    <span class="mvp-toolbar-generate-label">Activity</span>
                    <div class="mvp-segmented mvp-toolbar-activity">
                        ${ACTIVITY_OPTIONS.map((o) => `<button type="button" data-activity="${o.value}">${o.label}</button>`).join('')}
                    </div>
                </div>
                <div class="mvp-toolbar-generate-group">
                    <span class="mvp-toolbar-generate-label">Variation</span>
                    <div class="mvp-segmented mvp-toolbar-variant">
                        ${VARIANT_OPTIONS.map((o) => `<button type="button" data-variant="${o.value}">${o.label}</button>`).join('')}
                    </div>
                </div>
            </div>
        `;

        this.saveButton = this.root.querySelector('.mvp-journey-save')!;
        this.saveStatus = this.root.querySelector('.mvp-journey-save-status')!;
        this.saveButton.addEventListener('click', () => void this.save());
        this.undoButton = this.root.querySelector('[data-history-undo]')!;
        this.redoButton = this.root.querySelector('[data-history-redo]')!;
        this.scopeCheckbox = this.root.querySelector('[data-history-scope]')!;
        this.historyStatus = this.root.querySelector('[data-history-status]')!;
        this.undoButton.addEventListener('click', () => callbacks.onUndo());
        this.redoButton.addEventListener('click', () => callbacks.onRedo());
        this.scopeCheckbox.addEventListener('change', () => callbacks.onHistoryScopeChange(this.scopeCheckbox.checked ? 'all' : 'journey'));

        this.layerBtns = {} as Record<keyof TimelineLayers, HTMLButtonElement>;
        for (const option of LAYER_OPTIONS) {
            const btn = this.root.querySelector<HTMLButtonElement>(`[data-layer="${option.key}"]`)!;
            this.layerBtns[option.key] = btn;
            btn.addEventListener('click', () => {
                const next = btn.getAttribute('aria-pressed') !== 'true';
                this.setLayer(option.key, next);
                this.callbacks.onToggleLayer(option.key, next);
            });
        }

        this.toggleBtns = {
            snap: this.root.querySelector('[data-toggle="snap"]')!,
            follow: this.root.querySelector('[data-toggle="follow"]')!,
            draw: this.root.querySelector('[data-toggle="draw"]')!,
            zoomed: this.root.querySelector('[data-toggle="zoomed"]')!
        };
        (Object.keys(this.toggleBtns) as Array<keyof TimelineToggleState>).forEach((key) => {
            this.toggleBtns[key].addEventListener('click', () => {
                const next = this.toggleBtns[key].getAttribute('aria-pressed') !== 'true';
                this.setToggle(key, next);
                if (key === 'snap') this.callbacks.onToggleSnap(next);
                else if (key === 'follow') this.callbacks.onToggleFollow(next);
                else if (key === 'draw') this.callbacks.onToggleDraw(next);
                else this.callbacks.onToggleZoom(next);
            });
        });

        this.morphSlider = this.root.querySelector('.mvp-toolbar-morph-slider')!;
        this.morphValue = this.root.querySelector('.mvp-toolbar-morph-value')!;
        this.morphSlider.addEventListener('input', () => {
            const scale = Number(this.morphSlider.value);
            this.updateMorphScaleLabel(scale);
            this.callbacks.onMorphScaleChange(scale);
        });

        this.activityBtns = {} as Record<DramaturgyActivityLevel, HTMLButtonElement>;
        for (const option of ACTIVITY_OPTIONS) {
            const btn = this.root.querySelector<HTMLButtonElement>(`[data-activity="${option.value}"]`)!;
            this.activityBtns[option.value] = btn;
            btn.addEventListener('click', () => this.requestRegenerate(option.value, this.pendingVariant));
        }
        this.variantBtns = {} as Record<DramaturgyVariantMode, HTMLButtonElement>;
        for (const option of VARIANT_OPTIONS) {
            const btn = this.root.querySelector<HTMLButtonElement>(`[data-variant="${option.value}"]`)!;
            this.variantBtns[option.value] = btn;
            btn.addEventListener('click', () => this.requestRegenerate(this.pendingActivity, option.value));
        }
    }

    private requestRegenerate(activity: DramaturgyActivityLevel, variant: DramaturgyVariantMode): void {
        if (!window.confirm('Regenerate the visual journey with these settings? Your current moments and manual edits will be replaced.')) return;
        this.pendingActivity = activity;
        this.pendingVariant = variant;
        this.setActive(this.activityBtns, activity);
        this.setActive(this.variantBtns, variant);
        this.callbacks.onRegenerate(activity, variant);
    }

    setSaveState(dirty: boolean, canSave: boolean): void {
        this.dirty = dirty;
        this.canSave = canSave;
        this.saveButton.disabled = this.saving || !canSave;
        if (!this.saving) this.saveStatus.textContent = dirty ? 'Unsaved automation changes.' : 'No unsaved changes.';
    }

    setHistoryState(state: HistoryStatus, enabled: boolean): void {
        this.undoButton.disabled = !enabled || state.undoLabel === null;
        this.redoButton.disabled = !enabled || state.redoLabel === null;
        this.undoButton.title = `${state.undoLabel ? `Undo: ${state.undoLabel}` : 'Nothing to undo'} (Ctrl/Cmd+Z)`;
        this.redoButton.title = `${state.redoLabel ? `Redo: ${state.redoLabel}` : 'Nothing to redo'} (Ctrl/Cmd+Shift+Z or Ctrl+Y)`;
        this.scopeCheckbox.checked = state.scope === 'all';
        this.historyStatus.textContent = `${state.scope === 'all' ? 'Dramaturgy + visual tuning' : 'Dramaturgy'} · ${state.undoCount} undo / ${state.redoCount} redo · 300-step history`;
    }

    private async save(): Promise<void> {
        if (this.saving || !this.canSave) return;
        this.saving = true;
        this.saveButton.disabled = true;
        this.saveStatus.textContent = 'Saving automation...';
        try {
            const ok = await this.callbacks.onSave();
            this.saveStatus.textContent = !ok ? 'Could not save automation. Your changes are still unsaved.'
                : this.dirty ? 'Snapshot saved; newer changes are still unsaved.' : 'Automation saved for this track.';
        } catch {
            this.saveStatus.textContent = 'Could not save automation. Your changes are still unsaved.';
        } finally {
            this.saving = false;
            this.saveButton.disabled = !this.canSave;
        }
    }

    private setActive<T extends string>(group: Record<T, HTMLButtonElement>, active: T): void {
        for (const key of Object.keys(group) as T[]) {
            group[key].classList.toggle('is-active', key === active);
        }
    }

    setLayer(key: keyof TimelineLayers, value: boolean): void {
        this.layerBtns[key].classList.toggle('is-active', value);
        this.layerBtns[key].setAttribute('aria-pressed', value ? 'true' : 'false');
    }

    setLayers(layers: TimelineLayers): void {
        for (const option of LAYER_OPTIONS) this.setLayer(option.key, layers[option.key]);
    }

    setToggle(key: keyof TimelineToggleState, value: boolean): void {
        this.toggleBtns[key].classList.toggle('is-active', value);
        this.toggleBtns[key].setAttribute('aria-pressed', value ? 'true' : 'false');
    }

    setToggles(state: TimelineToggleState): void {
        this.setToggle('snap', state.snap);
        this.setToggle('follow', state.follow);
        this.setToggle('draw', state.draw);
        this.setToggle('zoomed', state.zoomed);
    }

    setMorphScale(scale: number, maxScale: number): void {
        // Dense plans can safely allow less than 100%. The native track must end at
        // that same limit; step="any" also keeps fractional endpoints reachable.
        const min = Number(this.morphSlider.min);
        const max = Math.max(min, maxScale);
        this.morphSlider.max = String(max);
        this.morphSlider.value = String(scale);
        this.morphSlider.disabled = max <= min;
        this.morphSlider.title = `Maximum ${Number((max * 100).toFixed(2))}% for this journey. Transitions must finish before the next moment.`;
        this.morphValue.title = this.morphSlider.title;
        this.updateMorphScaleLabel(Number(this.morphSlider.value));
    }

    private updateMorphScaleLabel(scale: number): void {
        const label = `${Number((scale * 100).toFixed(2))}%`;
        this.morphValue.textContent = label;
        this.morphSlider.setAttribute('aria-valuetext', label);
    }

    setGenerationSelection(activity: DramaturgyActivityLevel, variant: DramaturgyVariantMode): void {
        this.pendingActivity = activity;
        this.pendingVariant = variant;
        this.setActive(this.activityBtns, activity);
        this.setActive(this.variantBtns, variant);
    }
}
