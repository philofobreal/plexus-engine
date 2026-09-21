import { visualTuningControls, type VisualTuningKey } from '../../config/visualTuning';
import { ADVANCED_BOOST_GROUPS, boostFactor, NEUTRAL_BOOST, type AdvancedBoosts } from './metaTuningBoost';

function fractionToSliderValue(fraction: number): string {
    return String(Math.round(fraction * 100));
}

function sliderValueToFraction(raw: string): number {
    return Number(raw) / 100;
}

function formatBoost(fraction: number): string {
    return `×${boostFactor(fraction).toFixed(2)}`;
}

export interface AdvancedTuningPanelCallbacks {
    /** Slider position (0.5 = neutral), or an absolute option value for a selector. */
    onChange: (key: VisualTuningKey, fraction: number) => void;
    onReset: () => void;
    /** Persists the current Visual character + Advanced tuning boosts for the whole track (one
     *  combined save covering both panels -- see MvpVisualController.saveMetaTuningForTrack).
     *  Resolves to whether the save actually succeeded. */
    onSave: () => Promise<boolean>;
}

/**
 * Fine-grained per-parameter boost/cut controls for users who want more than the four macro
 * sliders -- the same grain-material/Post FX/Lines parameters the advanced dashboard's tuning
 * panel exposes, reusing its own metadata (label) so the naming matches precisely.
 *
 * Every slider is a boost, not an absolute value: 50% (center) means "don't touch this parameter,
 * let the preset/automation/dramaturgy layer's own value through unchanged"; away from center it
 * multiplies (above) or fades toward zero (below) whatever that layer *currently* authors, applied
 * fresh every render frame (see MvpVisualController.getBoostedTuning) rather than baked into any
 * one preset or moment. That is also why there is no more "automatic vs overridden" distinction
 * per key: every slider is always a boost, just a neutral (no-op) one by default -- "Reset" simply
 * returns every slider to that neutral center.
 * Discrete selectors (grain line ends) are absolute choices and reset to their first option.
 *
 * Plain embeddable content (no modal chrome of its own): it is mounted as one tab of
 * QuickTuningDrawer, which owns show/hide, so the same markup is reachable identically from the
 * normal windowed view and from native Fullscreen (see QuickTuningDrawer's own docs for why that
 * requires living inside previewCol rather than being a page-level overlay).
 */
export class AdvancedTuningPanel {
    readonly root: HTMLElement;
    private readonly sliders = new Map<VisualTuningKey, HTMLInputElement>();
    private readonly outputs = new Map<VisualTuningKey, HTMLElement>();
    private readonly selects = new Map<VisualTuningKey, HTMLSelectElement>();
    private readonly saveBtn: HTMLButtonElement;
    private readonly saveStatus: HTMLElement;
    private saveStatusTimer: number | null = null;

    constructor(callbacks: AdvancedTuningPanelCallbacks) {
        const { onChange, onReset, onSave } = callbacks;

        this.root = document.createElement('div');
        this.root.className = 'mvp-advanced-panel';
        this.root.innerHTML = `
            <div class="mvp-meta-save-row">
                <span class="mvp-panel-eyebrow">Advanced tuning</span>
                <button type="button" class="mvp-meta-save-btn" data-meta-save>Save</button>
            </div>
            <div class="mvp-advanced-body">
                ${ADVANCED_BOOST_GROUPS.map((group) => `
                    <div class="mvp-advanced-group">
                        <span class="mvp-advanced-group-title">${group.title}</span>
                        ${group.keys.map((key) => {
                            const control = visualTuningControls.find((c) => c.key === key);
                            if (!control) return '';
                            if (control.options) return `
                                <div class="mvp-field">
                                    <label class="mvp-field-row" for="mvp-advanced-${key}">${control.label}</label>
                                    <select id="mvp-advanced-${key}" class="mvp-select" data-advanced="${key}" aria-label="${control.label}">
                                        ${control.options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
                                    </select>
                                    <small>Grain lines only; material glow stays soft.</small>
                                </div>
                            `;
                            return `
                                <div class="mvp-field">
                                    <div class="mvp-field-row"><span>${control.label}</span><output data-advanced-output="${key}">${formatBoost(NEUTRAL_BOOST)}</output></div>
                                    <input type="range" class="mvp-slider" data-advanced="${key}" min="0" max="100" step="1" value="${fractionToSliderValue(NEUTRAL_BOOST)}" aria-label="${control.label}">
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
            </div>
            <div class="mvp-meta-save-status" data-meta-save-status></div>
            <button type="button" class="mvp-btn mvp-advanced-reset">Reset</button>
        `;

        this.saveBtn = this.root.querySelector('[data-meta-save]')!;
        this.saveStatus = this.root.querySelector('[data-meta-save-status]')!;

        for (const group of ADVANCED_BOOST_GROUPS) {
            for (const key of group.keys) {
                const control = visualTuningControls.find((c) => c.key === key);
                if (!control) continue;
                if (control.options) {
                    const select = this.root.querySelector<HTMLSelectElement>(`[data-advanced="${key}"]`)!;
                    this.selects.set(key, select);
                    select.addEventListener('change', () => onChange(key, Number(select.value)));
                    continue;
                }
                const slider = this.root.querySelector<HTMLInputElement>(`[data-advanced="${key}"]`)!;
                const output = this.root.querySelector<HTMLElement>(`[data-advanced-output="${key}"]`)!;
                this.sliders.set(key, slider);
                this.outputs.set(key, output);
                slider.addEventListener('input', () => {
                    const fraction = sliderValueToFraction(slider.value);
                    output.textContent = formatBoost(fraction);
                    onChange(key, fraction);
                });
            }
        }

        this.saveBtn.addEventListener('click', () => void this.handleSave(onSave));
        this.root.querySelector('.mvp-advanced-reset')!.addEventListener('click', () => onReset());
    }

    private async handleSave(onSave: AdvancedTuningPanelCallbacks['onSave']): Promise<void> {
        this.saveBtn.disabled = true;
        this.saveStatus.textContent = 'Saving...';
        if (this.saveStatusTimer !== null) window.clearTimeout(this.saveStatusTimer);
        try {
            const ok = await onSave();
            this.saveStatus.textContent = ok ? 'Saved for this track.' : "Couldn't save -- storage unavailable.";
        } catch {
            this.saveStatus.textContent = 'Save failed.';
        } finally {
            this.saveBtn.disabled = false;
            this.saveStatusTimer = window.setTimeout(() => { this.saveStatus.textContent = ''; }, 3200);
        }
    }

    setValues(boosts: AdvancedBoosts): void {
        for (const [key, select] of this.selects) {
            select.value = String(boosts[key] ?? 0);
        }
        for (const [key, slider] of this.sliders) {
            const fraction = boosts[key];
            if (typeof fraction !== 'number') continue;
            slider.value = fractionToSliderValue(fraction);
            this.outputs.get(key)!.textContent = formatBoost(fraction);
        }
    }
}
