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
        const report = this.buildReport(false);
        this.cachedReport = report;
        return report;
    }

    /** MVP admits each 4K job at start instead of hiding 4K by device class. */
    static detectMvpCapabilities(): ExportCapabilities {
        return this.buildReport(true);
    }

    static getReport(): ExportCapabilities {
        return this.cachedReport ?? this.buildReport(false);
    }

    private static buildReport(useJobPreflight: boolean): ExportCapabilities {
        const webcodecsSupported = this.isWebCodecsSupported();
        const isMobile = this.isMobile();
        const heuristicRestricted = isMobile && !useJobPreflight;
        const preferredBackend: ExportBackendId = webcodecsSupported ? 'webcodecs' : 'none';
        const warnings: string[] = [];
        if (!webcodecsSupported) {
            warnings.push('Offline export requires a modern browser (Safari 16.4+ or Chrome 94+).');
        }
        if (heuristicRestricted) {
            warnings.push('4K rendering disabled on mobile viewports due to system memory limits.');
        }
        return {
            ...(heuristicRestricted ? { fourKRestriction: 'device-heuristic' as const } : {}),
            webcodecsSupported,
            webcodecsCodecs: {
                vp9: webcodecsSupported,
                vp8: webcodecsSupported
            },
            canExport4K: useJobPreflight ? webcodecsSupported : !isMobile,
            isMobile,
            preferredBackend,
            warnings
        };
    }
}
