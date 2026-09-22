import type { ExportCapabilities, ExportConfig, ExportResolution } from '../../export/ExportTypes';

export interface ExportDialogCallbacks {
    onStart: (config: ExportConfig) => void;
    onStop: () => void;
    onCancel: () => void;
}

export class ExportDialog {
    readonly root: HTMLElement;
    private readonly startBtn: HTMLButtonElement;
    private readonly stopBtn: HTMLButtonElement;
    private readonly cancelBtn: HTMLButtonElement;
    private readonly progressBar: HTMLElement;
    private readonly statusEl: HTMLElement;
    private readonly capabilityWarningEl: HTMLElement;
    private readonly resolutionBtns: HTMLButtonElement[];
    private readonly callbacks: ExportDialogCallbacks;
    private isActive = false;
    private blockedMessage: string | null = null;

    constructor(callbacks: ExportDialogCallbacks) {
        this.callbacks = callbacks;
        this.root = document.createElement('div');
        this.root.className = 'mvp-modal-scrim mvp-hidden';
        this.root.innerHTML = `
            <div class="mvp-modal" role="dialog" aria-modal="true" aria-label="Export video">
                <h2 class="mvp-modal-title">Export video</h2>
                <div class="mvp-field">
                    <div class="mvp-field-row"><span>Resolution</span></div>
                    <div class="mvp-segmented mvp-export-resolution">
                        <button type="button" data-res="720p" class="is-active">720p</button>
                        <button type="button" data-res="1080p">1080p</button>
                        <button type="button" data-res="4K">4K</button>
                    </div>
                </div>
                <div class="mvp-capability-warning mvp-hidden"></div>
                <div class="mvp-modal-progress mvp-hidden"><div class="mvp-modal-progress-bar"></div></div>
                <div class="mvp-modal-status"></div>
                <div class="mvp-modal-actions">
                    <button type="button" class="mvp-btn mvp-export-cancel">Cancel</button>
                    <button type="button" class="mvp-btn mvp-export-stop mvp-hidden">Stop &amp; save</button>
                    <button type="button" class="mvp-btn mvp-btn-accent mvp-export-start">Export</button>
                </div>
            </div>
        `;
        this.startBtn = this.root.querySelector('.mvp-export-start')!;
        this.stopBtn = this.root.querySelector('.mvp-export-stop')!;
        this.cancelBtn = this.root.querySelector('.mvp-export-cancel')!;
        this.progressBar = this.root.querySelector('.mvp-modal-progress-bar')!;
        this.statusEl = this.root.querySelector('.mvp-modal-status')!;
        this.capabilityWarningEl = this.root.querySelector('.mvp-capability-warning')!;
        this.resolutionBtns = Array.from(this.root.querySelectorAll('.mvp-export-resolution button'));

        this.resolutionBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                this.resolutionBtns.forEach((b) => b.classList.remove('is-active'));
                btn.classList.add('is-active');
            });
        });

        this.startBtn.addEventListener('click', () => {
            if (this.isActive) return;
            this.callbacks.onStart(this.getConfig());
        });
        // Stop & save keeps everything captured so far — no confirmation needed, it's non-destructive.
        this.stopBtn.addEventListener('click', () => {
            if (!this.isActive) return;
            this.callbacks.onStop();
        });
        // Cancel while exporting throws away the footage captured so far, so — industry standard
        // for a destructive action — confirm before actually discarding it.
        this.cancelBtn.addEventListener('click', () => {
            if (!this.isActive) { this.close(); return; }
            if (!window.confirm('Discard the video captured so far? This cannot be undone.')) return;
            this.callbacks.onCancel();
        });
        this.root.addEventListener('click', (e) => { if (e.target === this.root && !this.isActive) this.close(); });
    }

    private getConfig(): ExportConfig {
        const active = this.root.querySelector('.mvp-export-resolution button.is-active') as HTMLElement | null;
        const resolution = (active?.dataset.res ?? '720p') as ExportResolution;
        return { resolution, aspectRatio: '16:9', fps: 60, watermark: false };
    }

    open(): void {
        this.root.classList.remove('mvp-hidden');
        this.statusEl.textContent = this.blockedMessage ?? '';
    }

    getResolution(): ExportResolution { return this.getConfig().resolution; }
    restoreResolution(resolution: ExportResolution): void {
        const selected = this.resolutionBtns.find(b => b.dataset.res === resolution && !b.disabled)
            ?? this.resolutionBtns.find(b => b.dataset.res === '720p');
        this.resolutionBtns.forEach(b => b.classList.toggle('is-active', b === selected));
    }

    close(): void {
        this.root.classList.add('mvp-hidden');
    }

    setActive(isActive: boolean): void {
        this.isActive = isActive;
        this.startBtn.classList.toggle('mvp-hidden', isActive);
        this.stopBtn.classList.toggle('mvp-hidden', !isActive);
        this.cancelBtn.textContent = 'Cancel';
        this.root.querySelector('.mvp-modal-progress')!.classList.toggle('mvp-hidden', !isActive);
        // A resolution the platform can't actually export (e.g. 4K on this device) stays disabled
        // regardless of export-in-progress state; see applyCapabilityReport.
        this.resolutionBtns.forEach((btn) => {
            if (btn.dataset.capabilityDisabled !== 'true') btn.disabled = isActive;
        });
        if (!isActive) this.progressBar.style.width = '0%';
    }

    setProgress(progress: number): void {
        this.progressBar.style.width = `${Math.round(progress * 100)}%`;
    }

    setStatus(message: string): void {
        this.statusEl.textContent = message;
    }

    /**
     * Applies a detected export-capability report (see ExportCapabilityDetector, mirroring
     * ExportController.applyCapabilityReport on the advanced dashboard): disables the whole
     * dialog with an explanatory status when the platform can't export at all, and disables the
     * 4K option specifically when the platform can export but not at that resolution (mobile
     * memory limits). Any other warning renders as a small persistent note under Resolution.
     */
    applyCapabilityReport(report: ExportCapabilities): void {
        if (report.preferredBackend === 'none') {
            this.blockedMessage = report.warnings[0] || 'Video export is not supported in this browser.';
            this.startBtn.disabled = true;
            this.statusEl.textContent = this.blockedMessage;
        }

        if (!report.canExport4K) {
            const fourK = this.resolutionBtns.find((btn) => btn.dataset.res === '4K');
            if (fourK) {
                fourK.disabled = true;
                fourK.dataset.capabilityDisabled = 'true';
                fourK.title = '4K export is disabled on this device.';
                if (fourK.classList.contains('is-active')) {
                    fourK.classList.remove('is-active');
                    (this.resolutionBtns.find((btn) => btn.dataset.res === '720p') ?? this.resolutionBtns[0])?.classList.add('is-active');
                }
            }
        }

        if (report.warnings.length > 0) {
            this.capabilityWarningEl.textContent = report.warnings.join(' ');
            this.capabilityWarningEl.classList.remove('mvp-hidden');
        }
    }
}
