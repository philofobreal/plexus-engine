import type { TrackAnalysis } from '../../types';
import type { VisualTuningKey } from '../../config/visualTuning';
import type { MvpMacroTuning } from './macroTuningMapper';

export interface StoredMetaTuning {
    version: 1;
    macros: MvpMacroTuning;
    advancedBoosts: Record<VisualTuningKey, number>;
}

const STORAGE_PREFIX = 'plexus-mvp-meta-tuning:v1:';

/**
 * Filename-independent SHA-256 key for rounded analysis descriptors, not raw audio identity.
 * Renaming unchanged input preserves the key. Re-encoding or changed analysis may change it;
 * different tracks with identical descriptors can share a key. See the MVP feature contract.
 */
export async function computeTrackFingerprint(analysis: TrackAnalysis): Promise<string> {
    const fingerprintSource = {
        bpm: Math.round(analysis.bpm * 100) / 100,
        duration: Math.round(analysis.duration * 100) / 100,
        sectionStarts: analysis.sections.map((s) => Math.round(s.start * 10) / 10),
        barCount: analysis.bars.length
    };
    const bytes = new TextEncoder().encode(JSON.stringify(fingerprintSource));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isStoredMetaTuning(value: unknown): value is StoredMetaTuning {
    if (!value || typeof value !== 'object') return false;
    const v = value as Partial<StoredMetaTuning>;
    return v.version === 1 && typeof v.macros === 'object' && typeof v.advancedBoosts === 'object';
}

/** Reads never throw: a corrupt/missing entry or an unavailable localStorage (private mode, quota)
 *  is treated the same as "nothing saved yet". */
export function loadMetaTuning(fingerprint: string): StoredMetaTuning | null {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + fingerprint);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        return isStoredMetaTuning(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** Returns whether the save actually succeeded, so the UI can tell the user if it silently
 *  couldn't (private browsing, storage quota, disabled storage). */
export function saveMetaTuning(fingerprint: string, data: StoredMetaTuning): boolean {
    try {
        localStorage.setItem(STORAGE_PREFIX + fingerprint, JSON.stringify(data));
        return true;
    } catch {
        return false;
    }
}
