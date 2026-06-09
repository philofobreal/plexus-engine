import type { ExportBackendId, ExportCapabilities } from './ExportTypes';

export class ExportCapabilityDetector {
    private static cachedReport: ExportCapabilities | null = null;

    static isWebCodecsSupported(): boolean {
        return typeof window !== 'undefined' && typeof window.VideoEncoder !== 'undefined';
    }

    static isWebCodecsAudioSupported(): boolean {
        return typeof window !== 'undefined' && typeof window.AudioEncoder !== 'undefined';
    }

    static isMobile(): boolean {
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
        const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
        const narrowViewport = typeof window !== 'undefined' ? Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 820 : false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
            || (touchPoints > 1 && narrowViewport);
    }

    static async detectCapabilities(): Promise<ExportCapabilities> {
        const webcodecsSupported = this.isWebCodecsSupported();
        const isMobile = this.isMobile();
        const canExport4K = !isMobile;
        const preferredBackend: ExportBackendId = webcodecsSupported ? 'webcodecs' : 'none';
        const warnings: string[] = [];

        if (!webcodecsSupported) {
            warnings.push('Offline export requires a modern browser (Safari 16.4+ or Chrome 94+).');
        }
        if (!canExport4K) {
            warnings.push('4K rendering disabled on mobile viewports due to system memory limits.');
        }

        const report = {
            webcodecsSupported,
            webcodecsCodecs: {
                vp9: webcodecsSupported,
                vp8: webcodecsSupported
            },
            canExport4K,
            isMobile,
            preferredBackend,
            warnings
        };
        this.cachedReport = report;
        return report;
    }

    static getReport(): ExportCapabilities {
        if (this.cachedReport) return this.cachedReport;

        const webcodecsSupported = this.isWebCodecsSupported();
        const isMobile = this.isMobile();
        const preferredBackend: ExportBackendId = webcodecsSupported ? 'webcodecs' : 'none';
        const warnings: string[] = [];
        if (!webcodecsSupported) {
            warnings.push('Offline export requires a modern browser (Safari 16.4+ or Chrome 94+).');
        }
        if (isMobile) {
            warnings.push('4K rendering disabled on mobile viewports due to system memory limits.');
        }
        return {
            webcodecsSupported,
            webcodecsCodecs: {
                vp9: webcodecsSupported,
                vp8: webcodecsSupported
            },
            canExport4K: !isMobile,
            isMobile,
            preferredBackend,
            warnings
        };
    }
}
