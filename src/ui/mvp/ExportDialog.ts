import type { ExportCapabilities, ExportConfig, ExportResolution } from '../../export/ExportTypes';
import type { ExportProfile } from '../../types/ExportRenderJob';

export interface ExportDialogCallbacks {
    onStart: (config: ExportConfig) => void;
    onStop: () => void;
    onCancel: () => void;
    getCacheSummary?: () => { files: number; cleanupPending: number; scope: string };
    onClearCache?: () => Promise<{ removed: number; remaining: number }>;
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
    private controlPending = false;
    private blockedMessage: string | null = null;
    private readonly runtimeSelect: HTMLSelectElement;
    private readonly memorySelect: HTMLSelectElement;
    private readonly clearCacheBtn: HTMLButtonElement;
    private cacheClearing = false;
    private profile: ExportProfile | null = null;
    private readonly isolatedAvailable: boolean;

    constructor(callbacks: ExportDialogCallbacks, isolatedAvailable = false) {
        this.callbacks = callbacks;
        this.isolatedAvailable = isolatedAvailable;
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
                <div class="mvp-field"><label>Rendering
                    <select class="mvp-select mvp-export-runtime" aria-label="Export rendering">
                        <option value="compatible">Compatible (current)</option>
                        <option value="isolated-wormhole">Isolated Wormhole (preview)</option>
                    </select></label>
                    <small>Isolated uses a frozen track and private renderer. Codec support is tested before isolated export.</small>
                </div>
                <div class="mvp-field"><label>Export memory limit
                    <select class="mvp-select mvp-export-memory" aria-label="Export memory limit">
                        <option value="auto">Auto (up to 2 GiB)</option>
                        <option value="512">512 MiB</option>
                        <option value="1024">1 GiB</option>
                        <option value="2048">2 GiB</option>
                    </select></label>
                    <small>Isolated export planning limit, not reserved or detected free RAM. Auto warns above 1 GiB. A short codec test cannot guarantee a full export.</small>
                </div>
                <div class="mvp-capability-warning mvp-hidden"></div>
                <div class="mvp-modal-progress mvp-hidden"><div class="mvp-modal-progress-bar"></div></div>
                <div class="mvp-modal-status"></div>
                <div class="mvp-field">
                    <button type="button" class="mvp-btn mvp-export-clear-cache">Clear this tab's finished exports</button>
                    <small class="mvp-export-cache-status"></small>
                </div>
                <div class="mvp-modal-actions">
                    <button type="button" class="mvp-btn mvp-export-copy">Copy settings &amp; diagnostics</button>
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
        this.runtimeSelect = this.root.querySelector('.mvp-export-runtime')!;
        this.memorySelect = this.root.querySelector('.mvp-export-memory')!;
        this.clearCacheBtn = this.root.querySelector('.mvp-export-clear-cache')!;
        this.clearCacheBtn.addEventListener('click', () => { void this.clearCache(); });
        // The composition root wires its controller after constructing leaf views.
        this.clearCacheBtn.disabled = true;
        let memory = 'auto';
        try { memory = window.localStorage.getItem('plexus.exportMemoryLimit') ?? 'auto'; } catch { /* Session default. */ }
        this.memorySelect.value = ['512', '1024', '2048'].includes(memory) ? memory : 'auto';
        this.memorySelect.addEventListener('change', () => {
            if (this.isActive) return;
            try { window.localStorage.setItem('plexus.exportMemoryLimit', this.memorySelect.value); } catch { /* Session only. */ }
        });
        let stored: string | null = null;
        try { stored = window.localStorage.getItem('plexus.exportRuntime'); } catch { /* Session default. */ }
        this.runtimeSelect.value = isolatedAvailable && stored === 'isolated-wormhole' ? stored : 'compatible';
        this.memorySelect.disabled = !isolatedAvailable || this.runtimeSelect.value === 'compatible';
        const isolatedOption = this.runtimeSelect.querySelector<HTMLOptionElement>('[value="isolated-wormhole"]');
        if (isolatedOption) isolatedOption.disabled = !isolatedAvailable;
        this.runtimeSelect.addEventListener('change', () => {
            if (this.isActive) return;
            this.memorySelect.disabled = !this.isolatedAvailable || this.runtimeSelect.value === 'compatible';
            try { window.localStorage.setItem('plexus.exportRuntime', this.getConfig().runtime ?? 'compatible'); } catch { /* Session only. */ }
        });
        this.root.querySelector('.mvp-export-copy')!.addEventListener('click', () => {
            if (!navigator.clipboard?.writeText) { this.setStatus('Clipboard unavailable.'); return; }
            void navigator.clipboard.writeText(JSON.stringify({ export: this.getConfig(), diagnostics: this.profile,
                ...(this.callbacks.getCacheSummary ? { cache: this.callbacks.getCacheSummary() } : {}) }, null, 2))
                .catch(() => this.setStatus('Unable to copy export settings.'));
        });

        this.resolutionBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                this.resolutionBtns.forEach((b) => b.classList.remove('is-active'));
                btn.classList.add('is-active');
            });
        });

        this.startBtn.addEventListener('click', () => {
            if (this.isActive || this.cacheClearing) return;
            this.callbacks.onStart(this.getConfig());
        });
        // Stop & save keeps everything captured so far — no confirmation needed, it's non-destructive.
        this.stopBtn.addEventListener('click', () => {
            if (!this.isActive || this.stopBtn.disabled) return;
            this.controlPending = true;
            this.stopBtn.disabled = true;
            this.setStatus('Stopping and saving captured video…');
            this.callbacks.onStop();
        });
        // Cancel while exporting throws away the footage captured so far, so — industry standard
        // for a destructive action — confirm before actually discarding it.
        this.cancelBtn.addEventListener('click', () => {
            if (this.cancelBtn.disabled) return;
            if (!this.isActive) { this.close(); return; }
            if (!window.confirm('Discard the video captured so far? This cannot be undone.')) return;
            this.controlPending = true;
            this.stopBtn.disabled = true;
            this.cancelBtn.disabled = true;
            this.setStatus('Cancelling export…');
            this.callbacks.onCancel();
        });
        this.root.addEventListener('click', (e) => { if (e.target === this.root && !this.isActive) this.close(); });
    }

    private getConfig(): ExportConfig {
        const active = this.root.querySelector('.mvp-export-resolution button.is-active') as HTMLElement | null;
        const resolution = (active?.dataset.res ?? '720p') as ExportResolution;
        return { resolution, aspectRatio: '16:9', fps: 60, watermark: false,
            ...(this.isolatedAvailable && this.runtimeSelect.value === 'isolated-wormhole' ? { preflight: true } : {}),
            ...(this.isolatedAvailable && this.runtimeSelect.value === 'isolated-wormhole' && ['512', '1024', '2048'].includes(this.memorySelect.value)
                ? { memoryLimitMiB: Number(this.memorySelect.value) as 512 | 1024 | 2048 } : {}),
            ...(this.isolatedAvailable && this.runtimeSelect.value === 'isolated-wormhole' ? { runtime: 'isolated-wormhole' as const } : {}) };
    }

    open(): void {
        this.root.classList.remove('mvp-hidden');
        this.statusEl.textContent = this.blockedMessage ?? '';
        this.refreshCache();
    }

    private refreshCache(): void {
        const summary = this.callbacks.getCacheSummary?.();
        this.clearCacheBtn.disabled = this.isActive || this.cacheClearing || !this.callbacks.onClearCache || !summary?.files;
        this.root.querySelector('.mvp-export-cache-status')!.textContent = summary
            ? `${summary.files} finished file(s), ${summary.cleanupPending} pending cleanup. Only this tab since reload. Clear after downloads finish; other tabs and earlier visits are untouched.`
            : 'Cache cleanup is unavailable in this host.';
    }
    private async clearCache(): Promise<void> {
        if (this.clearCacheBtn.disabled || !this.callbacks.onClearCache) return;
        if (!window.confirm('Have all export downloads finished? This permanently removes this tab’s finished export files. Their previews or pending downloads may stop working. Downloaded copies are kept.')) return;
        this.cacheClearing = true;
        this.startBtn.disabled = true;
        this.refreshCache();
        this.setStatus('Clearing finished export files…');
        try {
            const result = await this.callbacks.onClearCache();
            this.setStatus(`Removed ${result.removed} export file(s). ${result.remaining} remain${result.remaining ? '; retry cleanup later' : ''}.`);
        } catch (error) { this.setStatus(error instanceof Error ? error.message : 'Export cleanup failed. Try again.'); }
        finally { this.cacheClearing = false; this.startBtn.disabled = Boolean(this.blockedMessage); this.refreshCache(); }
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
        this.refreshCache();
        this.runtimeSelect.disabled = isActive;
        this.memorySelect.disabled = isActive || !this.isolatedAvailable || this.runtimeSelect.value === 'compatible';
        if (isActive) this.profile = null;
        this.controlPending = false;
        this.stopBtn.disabled = !isActive;
        this.cancelBtn.disabled = false;
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
        if (this.isActive && !this.controlPending && progress < 1) this.setStatus('Exporting video…');
    }

    setStatus(message: string): void {
        this.statusEl.textContent = message;
    }
    setProfile(profile: ExportProfile): void { this.profile = profile; }

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

        const workerWillCheck4K = this.isolatedAvailable && report.fourKRestriction === 'device-heuristic';
        if (!report.canExport4K && !workerWillCheck4K) {
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
            this.capabilityWarningEl.textContent = workerWillCheck4K
                ? 'Isolated export checks 4K support at the selected output settings. Device type alone does not determine support.' : report.warnings.join(' ');
            this.capabilityWarningEl.classList.remove('mvp-hidden');
        }
    }
}
