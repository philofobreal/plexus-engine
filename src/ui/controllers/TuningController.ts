import { visualTuningControls, type VisualTuningKey } from '../../config/visualTuning';
import { State } from '../../state/store';
import { featureFlags } from '../../config/featureFlags';

export interface TuningCallbacks {
    onTuningChange: (key: VisualTuningKey, value: number) => void;
    onPresetLoad: (fileName: string) => void;
    onPresetBrushChange: (fileName: string) => void;
    onCopyConfig: () => void;
    onMetricsToggle: () => void;
    onVisualModeChange: (mode: string) => void;
}

type TuningEls = {
    tuningPanel: HTMLElement;
    tuningDragHandle: HTMLElement;
    toggleTuningPanel: HTMLElement;
    tuningControls: HTMLElement;
    presetList: HTMLElement;
    copyVisualConfig: HTMLElement;
    copyConfigStatus: HTMLElement;
    timelinePresetBrush: HTMLElement;
    toggleMetrics: HTMLElement;
    metricsGrid: HTMLElement;
    visualMode: HTMLElement;
    strictP1: HTMLElement;
    strictP2: HTMLElement;
    strictP3: HTMLElement;
    strictP4: HTMLElement;
};

export class TuningController {
    private els: TuningEls;
    private callbacks: TuningCallbacks;
    private tuningDragOffset = { x: 0, y: 0 };

    constructor(els: TuningEls, callbacks: TuningCallbacks) {
        this.els = els;
        this.callbacks = callbacks;
        this.initBindings();
    }

    setTuningPanelOpen(isOpen: boolean): void {
        this.els.tuningPanel.classList.toggle('is-hidden', !isOpen);
        this.els.toggleTuningPanel.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    syncVisualTuningControls(): void {
        for (const control of visualTuningControls) {
            const value = State.targetTuning[control.key];
            const input = this.els.tuningControls.querySelector<HTMLInputElement>(`input[data-tuning-key="${control.key}"]`);
            const select = this.els.tuningControls.querySelector<HTMLSelectElement>(`select[data-tuning-key="${control.key}"]`);
            const output = document.getElementById(`visual-tuning-value-${control.key}`);
            if (input) input.value = value.toString();
            if (select) select.value = value.toString();
            if (output) output.textContent = this.formatControlValue(value, control);
        }
    }

    updatePresetList(presets: string[]): void {
        const html = presets.length
            ? presets.map(f => `<option value="${this.escapeHtml(f)}">${this.escapeHtml(this.formatPresetName(f))}</option>`).join('')
            : `<option value="">No presets</option>`;
        this.els.presetList.innerHTML = html;
        this.els.timelinePresetBrush.innerHTML = html;
        const def = presets.find(f => f.toLowerCase() === 'default.json');
        if (def) {
            (this.els.presetList as HTMLSelectElement).value = def;
            (this.els.timelinePresetBrush as HTMLSelectElement).value = def;
        }
        (this.els.presetList as HTMLSelectElement).disabled = presets.length === 0;
        (this.els.timelinePresetBrush as HTMLSelectElement).disabled = presets.length === 0;

        const noneOption = `<option value="">(None)</option>`;
        const strictHtml = noneOption + (presets.length
            ? presets.map(f => `<option value="${this.escapeHtml(f)}">${this.escapeHtml(this.formatPresetName(f))}</option>`).join('')
            : '');
        for (const el of [this.els.strictP1, this.els.strictP2, this.els.strictP3, this.els.strictP4]) {
            el.innerHTML = strictHtml;
        }
    }

    showCopyStatus(text: string, clearAfterMs = 1600): void {
        this.els.copyConfigStatus.innerText = text;
        if (clearAfterMs > 0) {
            window.setTimeout(() => { this.els.copyConfigStatus.innerText = ''; }, clearAfterMs);
        }
    }

    initVisualTuningControls(): void {
        const container = this.els.tuningControls;
        container.innerHTML = '';
        const groups = new Map<string, HTMLElement>();

        for (const control of visualTuningControls) {
            if (control.key === 'wormholeSkybox' && !featureFlags.wormholeSkybox) continue;
            let group = groups.get(control.group);
            if (!group) {
                group = document.createElement('section');
                group.className = 'tuning-group';
                group.innerHTML = `<h2>${control.group}</h2>`;
                groups.set(control.group, group);
                container.appendChild(group);
            }
            const row = document.createElement('label');
            row.className = 'tuning-control';
            const valueId = `visual-tuning-value-${control.key}`;
            const value = State.targetTuning[control.key];
            const controlMarkup = control.options
                ? `<select data-tuning-key="${control.key}" aria-label="${control.label}">
                    ${control.options.map(o => `<option value="${o.value}"${o.value === value ? ' selected' : ''}>${this.escapeHtml(o.label)}</option>`).join('')}
                   </select>`
                : `<input type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" data-tuning-key="${control.key}" aria-label="${control.label}">`;
            row.innerHTML = `
                <span class="tuning-label"${control.description ? ` title="${this.escapeHtml(control.description)}"` : ''}>${this.escapeHtml(control.label)}</span>
                ${controlMarkup}
                <output id="${valueId}" class="tuning-value">${this.formatControlValue(value, control)}</output>
            `;
            group.appendChild(row);
        }

        const onUpdate = (event: Event) => {
            const input = event.target as HTMLInputElement | HTMLSelectElement;
            const key = input.dataset.tuningKey as VisualTuningKey | undefined;
            if (!key) return;
            const value = Number(input.value);
            this.callbacks.onTuningChange(key, value);
            const control = visualTuningControls.find(c => c.key === key);
            const output = document.getElementById(`visual-tuning-value-${key}`);
            if (output && control) output.textContent = this.formatControlValue(value, control);
        };
        container.addEventListener('input', onUpdate);
        container.addEventListener('change', onUpdate);
    }

    private initBindings(): void {
        this.els.toggleTuningPanel.addEventListener('click', () => {
            this.setTuningPanelOpen(this.els.tuningPanel.classList.contains('is-hidden'));
        });

        this.els.copyVisualConfig.addEventListener('click', () => {
            this.callbacks.onCopyConfig();
        });

        const loadPreset = () => {
            const fileName = (this.els.presetList as HTMLSelectElement).value;
            if (fileName) this.callbacks.onPresetLoad(fileName);
        };
        this.els.presetList.addEventListener('input', loadPreset);
        this.els.presetList.addEventListener('change', loadPreset);

        this.els.timelinePresetBrush.addEventListener('change', () => {
            const val = (this.els.timelinePresetBrush as HTMLSelectElement).value;
            this.callbacks.onPresetBrushChange(val);
        });

        this.els.toggleMetrics.addEventListener('click', () => {
            this.callbacks.onMetricsToggle();
        });

        (this.els.visualMode as HTMLSelectElement).addEventListener('change', (e) => {
            this.callbacks.onVisualModeChange((e.target as HTMLSelectElement).value);
        });

        this.initDragHandle();
    }

    private initDragHandle(): void {
        this.els.tuningDragHandle.addEventListener('pointerdown', (event) => {
            const target = event.target as HTMLElement;
            if (target.closest('button, input, select, textarea, label')) return;
            const panel = this.els.tuningPanel;
            const rect = panel.getBoundingClientRect();
            this.tuningDragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            panel.classList.add('is-dragging');
            panel.style.position = 'fixed';
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.marginTop = '0';
            this.els.tuningDragHandle.setPointerCapture(event.pointerId);
        });

        this.els.tuningDragHandle.addEventListener('pointermove', (event) => {
            if (!this.els.tuningPanel.classList.contains('is-dragging')) return;
            const panel = this.els.tuningPanel;
            const rect = panel.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            const left = Math.min(Math.max(0, event.clientX - this.tuningDragOffset.x), maxLeft);
            const top = Math.min(Math.max(0, event.clientY - this.tuningDragOffset.y), maxTop);
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        });

        const endDrag = (event: PointerEvent) => {
            if (!this.els.tuningPanel.classList.contains('is-dragging')) return;
            this.els.tuningPanel.classList.remove('is-dragging');
            if (this.els.tuningDragHandle.hasPointerCapture(event.pointerId)) {
                this.els.tuningDragHandle.releasePointerCapture(event.pointerId);
            }
        };
        this.els.tuningDragHandle.addEventListener('pointerup', endDrag);
        this.els.tuningDragHandle.addEventListener('pointercancel', endDrag);
    }

    private formatControlValue(value: number, control: { unit?: string; options?: Array<{ value: number; label: string }> }): string {
        const option = control.options?.find(o => o.value === value);
        if (option) return option.label;
        const decimals = value >= 10 || Number.isInteger(value) ? 0 : 2;
        return `${value.toFixed(decimals)}${control.unit || ''}`;
    }

    private escapeHtml(value: string): string {
        return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
    }

    private formatPresetName(fileName: string): string {
        return fileName.replace(/\.json$/i, '');
    }
}
