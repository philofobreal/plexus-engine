import type { MorphCurve, PerformanceAutomationPoint } from '../../types';
import { formatPresetName, formatTimeTenths, momentLabel, parseTimeInput } from './mvpFormat';

export type TransitionPreset = 'smooth' | 'balanced' | 'fast';

const TRANSITION_PRESETS: Record<TransitionPreset, { morphDurationSec: number; morphCurve: MorphCurve; label: string }> = {
    smooth: { morphDurationSec: 4.0, morphCurve: 'easeInOut', label: 'Smooth' },
    balanced: { morphDurationSec: 2.0, morphCurve: 'easeInOut', label: 'Balanced' },
    fast: { morphDurationSec: 0.6, morphCurve: 'linear', label: 'Fast' }
};

const INTENSITY_MIN = 0.1;
const INTENSITY_RANGE = 3.9;

export function strengthPercentFromIntensity(intensity: number): number {
    return Math.round(Math.min(1, Math.max(0, (intensity - INTENSITY_MIN) / INTENSITY_RANGE)) * 100);
}

export function intensityFromStrengthPercent(pct: number): number {
    return INTENSITY_MIN + (Math.min(100, Math.max(0, pct)) / 100) * INTENSITY_RANGE;
}

function nearestTransitionPreset(morphDurationSec: number): TransitionPreset {
    let best: TransitionPreset = 'balanced';
    let bestDist = Infinity;
    for (const key of Object.keys(TRANSITION_PRESETS) as TransitionPreset[]) {
        const dist = Math.abs(TRANSITION_PRESETS[key].morphDurationSec - morphDurationSec);
        if (dist < bestDist) { bestDist = dist; best = key; }
    }
    return best;
}

export interface MomentInspectorCallbacks {
    onTimeChange: (id: string, time: number) => void;
    onPresetChange: (id: string, fileName: string) => void;
    onStrengthChange: (id: string, strengthPct: number) => void;
    onTransitionChange: (id: string, preset: TransitionPreset) => void;
    onNudge: (id: string, deltaBeats: number) => void;
    onDelete: (id: string) => void;
    onClose?: () => void;
}

/** "Selected Moment" panel (desktop side column) / bottom-sheet content (mobile) — one instance, reparented by MvpUI. */
export class MomentInspector {
    readonly root: HTMLElement;
    private readonly titleEl: HTMLElement;
    private readonly timeInput: HTMLInputElement;
    private readonly presetSelect: HTMLSelectElement;
    private readonly strengthSlider: HTMLInputElement;
    private readonly strengthValue: HTMLElement;
    private readonly transitionBtns: Record<TransitionPreset, HTMLButtonElement>;
    private readonly emptyState: HTMLElement;
    private readonly formEl: HTMLElement;
    private readonly callbacks: MomentInspectorCallbacks;
    private point: PerformanceAutomationPoint | null = null;

    constructor(callbacks: MomentInspectorCallbacks) {
        this.callbacks = callbacks;
        this.root = document.createElement('div');
        this.root.className = 'mvp-panel mvp-moment-inspector';
        this.root.innerHTML = `
            <div class="mvp-panel-eyebrow">Selected moment</div>
            <div class="mvp-panel-title"><span class="mvp-moment-title">Climax</span><span class="mvp-dot"></span></div>
            <div class="mvp-empty-hint mvp-moment-empty">Tap a point on the Musical Journey below to select a moment.</div>
            <div class="mvp-moment-form mvp-hidden">
                <div class="mvp-field">
                    <div class="mvp-field-row"><span>Time</span></div>
                    <input type="text" class="mvp-time-input mvp-moment-time" inputmode="decimal" aria-label="Moment time">
                </div>
                <div class="mvp-field">
                    <div class="mvp-field-row"><span>Visual</span></div>
                    <select class="mvp-select mvp-moment-preset" aria-label="Visual preset"></select>
                </div>
                <div class="mvp-field">
                    <div class="mvp-field-row"><span>Strength</span><output class="mvp-moment-strength-value">0%</output></div>
                    <input type="range" class="mvp-slider mvp-moment-strength" min="0" max="100" step="1" value="50" aria-label="Strength">
                </div>
                <div class="mvp-field">
                    <div class="mvp-field-row"><span>Transition</span></div>
                    <div class="mvp-segmented mvp-moment-transition">
                        <button type="button" data-preset="smooth">Smooth</button>
                        <button type="button" data-preset="balanced">Balanced</button>
                        <button type="button" data-preset="fast">Fast</button>
                    </div>
                </div>
                <div class="mvp-field">
                    <div class="mvp-field-row"><span>Timing nudge</span></div>
                    <div class="mvp-nudge-row">
                        <button type="button" data-delta="-4">-1 bar</button>
                        <button type="button" data-delta="-1">-beat</button>
                        <button type="button" data-delta="1">+beat</button>
                        <button type="button" data-delta="4">+1 bar</button>
                    </div>
                </div>
                <button type="button" class="mvp-delete-btn">Delete moment</button>
            </div>
        `;

        this.titleEl = this.root.querySelector('.mvp-moment-title')!;
        this.emptyState = this.root.querySelector('.mvp-moment-empty')!;
        this.formEl = this.root.querySelector('.mvp-moment-form')!;
        this.timeInput = this.root.querySelector('.mvp-moment-time')!;
        this.presetSelect = this.root.querySelector('.mvp-moment-preset')!;
        this.strengthSlider = this.root.querySelector('.mvp-moment-strength')!;
        this.strengthValue = this.root.querySelector('.mvp-moment-strength-value')!;
        this.transitionBtns = {
            smooth: this.root.querySelector('[data-preset="smooth"]')!,
            balanced: this.root.querySelector('[data-preset="balanced"]')!,
            fast: this.root.querySelector('[data-preset="fast"]')!
        };

        this.timeInput.addEventListener('change', () => {
            if (!this.point) return;
            const parsed = parseTimeInput(this.timeInput.value, Number.MAX_SAFE_INTEGER);
            if (parsed !== null) this.callbacks.onTimeChange(this.point.id, parsed);
            else this.timeInput.value = formatTimeTenths(this.point.time);
        });

        this.presetSelect.addEventListener('change', () => {
            if (!this.point) return;
            this.callbacks.onPresetChange(this.point.id, this.presetSelect.value);
        });

        this.strengthSlider.addEventListener('input', () => {
            if (!this.point) return;
            const pct = Number(this.strengthSlider.value);
            this.strengthValue.textContent = `${pct}%`;
            this.callbacks.onStrengthChange(this.point.id, pct);
        });

        for (const key of Object.keys(this.transitionBtns) as TransitionPreset[]) {
            this.transitionBtns[key].addEventListener('click', () => {
                if (!this.point) return;
                this.callbacks.onTransitionChange(this.point.id, key);
            });
        }

        this.root.querySelectorAll('.mvp-nudge-row button').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!this.point) return;
                const delta = Number((btn as HTMLElement).dataset.delta);
                this.callbacks.onNudge(this.point.id, delta);
            });
        });

        this.root.querySelector('.mvp-delete-btn')!.addEventListener('click', () => {
            if (!this.point) return;
            this.callbacks.onDelete(this.point.id);
        });
    }

    /** `availablePresets` is the full manifest list; the point's own preset is included even if
     *  it somehow fell out of that list (e.g. a hand-authored plan), so the select never silently
     *  shows the wrong value. */
    show(point: PerformanceAutomationPoint, availablePresets: readonly string[]): void {
        this.point = point;
        this.emptyState.classList.add('mvp-hidden');
        this.formEl.classList.remove('mvp-hidden');
        this.titleEl.textContent = momentLabel(point.reason);
        this.timeInput.value = formatTimeTenths(point.time);
        const presetOptions = availablePresets.includes(point.preset) ? availablePresets : [point.preset, ...availablePresets];
        this.presetSelect.innerHTML = presetOptions
            .map((fileName) => `<option value="${fileName}">${formatPresetName(fileName)}</option>`)
            .join('');
        this.presetSelect.value = point.preset;
        const pct = strengthPercentFromIntensity(point.intensity);
        this.strengthSlider.value = String(pct);
        this.strengthValue.textContent = `${pct}%`;
        const active = nearestTransitionPreset(point.morphDurationSec);
        for (const key of Object.keys(this.transitionBtns) as TransitionPreset[]) {
            this.transitionBtns[key].classList.toggle('is-active', key === active);
        }
    }

    clear(): void {
        this.point = null;
        this.titleEl.textContent = 'No moment selected';
        this.emptyState.classList.remove('mvp-hidden');
        this.formEl.classList.add('mvp-hidden');
    }

    getSelectedId(): string | null {
        return this.point?.id ?? null;
    }

    /** Global history commits a focused time draft first, so a later blur cannot resurrect it. */
    commitPendingTime(): void {
        if (this.point && document.activeElement === this.timeInput
            && this.timeInput.value !== formatTimeTenths(this.point.time)) {
            this.timeInput.dispatchEvent(new Event('change'));
        }
    }
}

export { TRANSITION_PRESETS };
