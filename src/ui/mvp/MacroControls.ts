import type { MvpMacroTuning } from './macroTuningMapper';

type MacroKey = keyof MvpMacroTuning;

const MACROS: Array<{ key: MacroKey; label: string; icon: string }> = [
    { key: 'intensity', label: 'Intensity', icon: '☼' },
    { key: 'motion', label: 'Motion', icon: '◐' },
    { key: 'depth', label: 'Depth', icon: '▣' },
    { key: 'detail', label: 'Detail', icon: '✦' }
];

export interface MacroControlsCallbacks {
    onChange: (macros: MvpMacroTuning) => void;
    onOpenAdvanced: () => void;
}

/**
 * The four MVP macro sliders (design doc §3): the primary visual tuning surface end users see,
 * plus an entry point into the per-parameter Advanced tuning panel for anyone who wants more.
 * Each is a boost/cut applied to its own group of preset-authored keys (see macroTuningMapper.ts
 * and metaTuningBoost.ts) -- 50% is neutral (no change), not "off". Saving is handled from a
 * single combined button on the Advanced tuning panel, covering both panels' settings together.
 */
export class MacroControls {
    readonly root: HTMLElement;
    private readonly sliders: Record<MacroKey, HTMLInputElement>;
    private readonly outputs: Record<MacroKey, HTMLElement>;

    constructor(callbacks: MacroControlsCallbacks) {
        const { onChange, onOpenAdvanced } = callbacks;

        this.root = document.createElement('div');
        this.root.className = 'mvp-panel mvp-macro-controls';
        this.root.innerHTML = `
            <div class="mvp-panel-eyebrow">Visual character</div>
            ${MACROS.map((m) => `
                <div class="mvp-field">
                    <div class="mvp-field-row"><span>${m.label}</span><output data-macro-output="${m.key}">50%</output></div>
                    <input type="range" class="mvp-slider" data-macro="${m.key}" min="0" max="100" step="1" value="50" aria-label="${m.label}">
                </div>
            `).join('')}
            <button type="button" class="mvp-macro-advanced-link">
                Advanced tuning
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
        `;

        this.sliders = {} as Record<MacroKey, HTMLInputElement>;
        this.outputs = {} as Record<MacroKey, HTMLElement>;
        for (const m of MACROS) {
            this.sliders[m.key] = this.root.querySelector(`[data-macro="${m.key}"]`)!;
            this.outputs[m.key] = this.root.querySelector(`[data-macro-output="${m.key}"]`)!;
            this.sliders[m.key].addEventListener('input', () => {
                this.outputs[m.key].textContent = `${this.sliders[m.key].value}%`;
                onChange(this.readValues());
            });
        }
        this.root.querySelector('.mvp-macro-advanced-link')!.addEventListener('click', () => onOpenAdvanced());
    }

    private readValues(): MvpMacroTuning {
        return {
            intensity: Number(this.sliders.intensity.value) / 100,
            motion: Number(this.sliders.motion.value) / 100,
            depth: Number(this.sliders.depth.value) / 100,
            detail: Number(this.sliders.detail.value) / 100
        };
    }

    setValues(macros: MvpMacroTuning): void {
        for (const m of MACROS) {
            const pct = Math.round(macros[m.key] * 100);
            this.sliders[m.key].value = String(pct);
            this.outputs[m.key].textContent = `${pct}%`;
        }
    }
}
