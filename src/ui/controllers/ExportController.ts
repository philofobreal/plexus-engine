import type { ExportCapabilities } from '../../export/ExportTypes';
import type { ExportConfig } from '../../export/WebMExporter';

export interface ExportCallbacks {
    onExportStart: (config: ExportConfig) => void;
    onExportStop: () => void;
    onExportCancel: () => void;
}

type ExportEls = {
    exportResolution: HTMLElement;
    exportAspect: HTMLElement;
    exportWatermark: HTMLElement;
    exportVideoBtn: HTMLElement;
    stopExportBtn: HTMLElement;
    cancelExportBtn: HTMLElement;
    status: HTMLElement;
};

export class ExportController {
    private els: ExportEls;
    private callbacks: ExportCallbacks;
    private canExportFlag = false;

    constructor(els: ExportEls, callbacks: ExportCallbacks) {
        this.els = els;
        this.callbacks = callbacks;
        this.initBindings();
    }

    applyCapabilityReport(report: ExportCapabilities): void {
        const resolutionSelect = this.els.exportResolution as HTMLSelectElement;

        if (report.preferredBackend === 'none') {
            (this.els.exportVideoBtn as HTMLButtonElement).disabled = true;
            this.els.status.innerText = report.warnings[0] || 'Video export is not supported in this browser.';
        }

        if (report.warnings.length > 0) {
            const warning = document.createElement('div');
            warning.className = 'export-capability-warning';
            warning.style.color = '#ffd166';
            warning.style.fontSize = '12px';
            warning.style.marginTop = '6px';
            warning.textContent = `⚠️ ${report.warnings.join(' ')}`;
            this.els.exportVideoBtn.insertAdjacentElement('afterend', warning);
            console.warn(report.warnings.join(' '));
        }

        if (!report.isMobile) return;

        const fourKOption = Array.from(resolutionSelect.options).find(o => o.value === '4K');
        if (fourKOption) { fourKOption.disabled = true; fourKOption.hidden = true; }

        const fullHdOption = Array.from(resolutionSelect.options).find(o => o.value === '1080p');
        if (fullHdOption && !fullHdOption.textContent?.includes('Not recommended')) {
            fullHdOption.textContent = `${fullHdOption.textContent || '1080p'} (Not recommended on mobile)`;
        }

        if (resolutionSelect.value === '4K') resolutionSelect.value = '1080p';
    }

    setCanExport(canExport: boolean): void {
        this.canExportFlag = canExport;
        (this.els.exportVideoBtn as HTMLButtonElement).disabled = !canExport;
    }

    setExportActive(isActive: boolean): void {
        (this.els.exportResolution as HTMLSelectElement).disabled = isActive;
        (this.els.exportAspect as HTMLSelectElement).disabled = isActive;
        (this.els.exportWatermark as HTMLInputElement).disabled = isActive;
        (this.els.exportVideoBtn as HTMLButtonElement).disabled = isActive;
        (this.els.stopExportBtn as HTMLButtonElement).disabled = !isActive;
        (this.els.cancelExportBtn as HTMLButtonElement).disabled = !isActive;
        this.els.stopExportBtn.classList.toggle('is-hidden', !isActive);
        this.els.cancelExportBtn.classList.toggle('is-hidden', !isActive);
    }

    resetExportUi(): void {
        (this.els.exportResolution as HTMLSelectElement).disabled = false;
        (this.els.exportAspect as HTMLSelectElement).disabled = false;
        (this.els.exportWatermark as HTMLInputElement).disabled = false;
        (this.els.exportVideoBtn as HTMLButtonElement).disabled = !this.canExportFlag;
        (this.els.exportVideoBtn as HTMLButtonElement).innerText = 'Export';
        (this.els.stopExportBtn as HTMLButtonElement).disabled = true;
        this.els.stopExportBtn.classList.add('is-hidden');
        (this.els.cancelExportBtn as HTMLButtonElement).disabled = true;
        this.els.cancelExportBtn.classList.add('is-hidden');
    }

    setExportProgress(progress: number): void {
        (this.els.exportVideoBtn as HTMLButtonElement).innerText = `Exporting: ${Math.round(progress * 100)}%`;
    }

    setStopButtonDisabled(disabled: boolean): void {
        (this.els.stopExportBtn as HTMLButtonElement).disabled = disabled;
    }

    setExportButtonText(text: string): void {
        (this.els.exportVideoBtn as HTMLButtonElement).innerText = text;
    }

    getConfig(): ExportConfig {
        const resolution = (this.els.exportResolution as HTMLSelectElement).value as ExportConfig['resolution'];
        const aspectRatio = (this.els.exportAspect as HTMLSelectElement).value as ExportConfig['aspectRatio'];
        const watermark = (this.els.exportWatermark as HTMLInputElement).checked;
        return { resolution, aspectRatio, fps: 60, watermark };
    }

    private initBindings(): void {
        this.els.exportVideoBtn.addEventListener('click', () => {
            if ((this.els.exportVideoBtn as HTMLButtonElement).disabled) return;
            this.callbacks.onExportStart(this.getConfig());
        });

        this.els.stopExportBtn.addEventListener('click', () => {
            this.callbacks.onExportStop();
            (this.els.stopExportBtn as HTMLButtonElement).disabled = true;
            (this.els.exportVideoBtn as HTMLButtonElement).innerText = 'Finalizing...';
        });

        this.els.cancelExportBtn.addEventListener('click', () => {
            this.callbacks.onExportCancel();
        });
    }
}
