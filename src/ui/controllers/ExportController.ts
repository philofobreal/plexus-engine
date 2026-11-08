import { ExportDiagnosticJournal, EXPORT_FPS_KEY, normalizeExportFps, readExportDiagnostic, describeExportDiagnostic } from '../../export/ExportDiagnostics';
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
    exportFps?: HTMLElement | null;
    copyExportBtn?: HTMLElement | null;
    diagnosticStatus?: HTMLElement | null;
};

export class ExportController {
    private els: ExportEls;
    private callbacks: ExportCallbacks;
    private canExportFlag = false;
    private readonly diagnostics = new ExportDiagnosticJournal();

    constructor(els: ExportEls, callbacks: ExportCallbacks) {
        this.els = els;
        this.callbacks = callbacks;
        if (this.els.exportFps) {
            try { (this.els.exportFps as HTMLSelectElement).value=String(normalizeExportFps(localStorage.getItem(EXPORT_FPS_KEY))); } catch { /* Optional device preference. */ }
            this.els.exportFps.addEventListener('change',()=>{
                try { localStorage.setItem(EXPORT_FPS_KEY,String(normalizeExportFps((this.els.exportFps as HTMLSelectElement).value))); } catch { /* Storage may be disabled. */ }
            });
        }
        this.els.copyExportBtn?.addEventListener('click',()=>{
            if (!navigator.clipboard?.writeText) { this.els.status.innerText='Clipboard unavailable.'; return; }
            void navigator.clipboard.writeText(JSON.stringify({export:this.getConfig(),diagnostics:{...this.diagnostics.snapshot(),userAgent:navigator.userAgent?.slice(0,512)??'unavailable'}},null,2))
                .catch(()=>{this.els.status.innerText='Unable to copy export diagnostics.';});
        });
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

    recordDiagnostic(value: unknown): void { const report=readExportDiagnostic(value);if(!report)return;this.diagnostics.record(report);if(this.els.diagnosticStatus){this.els.diagnosticStatus.textContent=describeExportDiagnostic(report);this.els.diagnosticStatus.hidden=false;} }
    recordFailure(error: unknown): void { this.diagnostics.fail(error); }

    setExportActive(isActive: boolean): void {
        if (isActive) { this.diagnostics.begin(this.getConfig());if(this.els.diagnosticStatus)this.els.diagnosticStatus.hidden=true; }
        if (this.els.exportFps) (this.els.exportFps as HTMLSelectElement).disabled=isActive;
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
        if (this.els.exportFps) (this.els.exportFps as HTMLSelectElement).disabled=false;
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
        return { resolution, aspectRatio, fps: normalizeExportFps((this.els.exportFps as HTMLSelectElement | undefined)?.value), watermark };
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
