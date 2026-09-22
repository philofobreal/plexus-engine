import type { TrackAnalysis } from '../../types';
import type { VisualTuningKey } from '../../config/visualTuning';
import type { MvpMacroTuning } from './macroTuningMapper';
import { defaultMvpMacroTuning } from './macroTuningMapper';
import { advancedBoostKeys, defaultAdvancedBoosts } from './metaTuningBoost';
import { normalizeStoredJourney, type StoredJourney } from './journeyStorage';

export interface StoredMetaTuning {
    version: 1;
    macros: MvpMacroTuning;
    advancedBoosts: Record<VisualTuningKey, number>;
    journey?: StoredJourney;
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

export function normalizeStoredMetaTuning(value: unknown, duration: number): StoredMetaTuning | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Partial<StoredMetaTuning>;
    if (v.version !== 1 || !v.macros || typeof v.macros !== 'object' || Array.isArray(v.macros)
        || !v.advancedBoosts || typeof v.advancedBoosts !== 'object' || Array.isArray(v.advancedBoosts)) return null;
    const macros = { ...defaultMvpMacroTuning };
    const advancedBoosts = defaultAdvancedBoosts();
    for (const key of Object.keys(macros) as Array<keyof MvpMacroTuning>) {
        const value = v.macros[key];
        if (typeof value === 'number' && Number.isFinite(value)) macros[key] = Math.min(1, Math.max(0, value));
    }
    for (const key of advancedBoostKeys) {
        const value = v.advancedBoosts[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            advancedBoosts[key] = key === 'wormholeGrainShape' ? (value === 1 ? 1 : 0) : Math.min(1, Math.max(0, value));
        }
    }
    const journey = normalizeStoredJourney(v.journey, duration);
    return { version: 1, macros, advancedBoosts, ...(journey ? { journey } : {}) };
}

/** Reads never throw: a corrupt/missing entry or an unavailable localStorage (private mode, quota)
 *  is treated the same as "nothing saved yet". */
export function loadMetaTuning(fingerprint: string, duration = Infinity): StoredMetaTuning | null {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + fingerprint);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        return normalizeStoredMetaTuning(parsed, duration);
    } catch {
        return null;
    }
}

/** Returns whether the save actually succeeded, so the UI can tell the user if it silently
 *  couldn't (private browsing, storage quota, disabled storage). */
export function saveMetaTuning(fingerprint: string, data: StoredMetaTuning): boolean {
    return saveTrackChanges(fingerprint, { tuning: data });
}

/** Explicit automation save preserves the last SAVED effects, not live unsaved sliders. */
export function saveJourney(fingerprint: string, journey: StoredJourney): boolean {
    return saveTrackChanges(fingerprint, { journey });
}

export interface TrackSaveChanges {
    tuning?: Pick<StoredMetaTuning, 'macros' | 'advancedBoosts'>;
    journey?: StoredJourney;
    checkpoint?: unknown;
}

/** One explicit write for either panel or all dirty sections in the shared leave dialog. */
export function saveTrackChanges(fingerprint: string, changes: TrackSaveChanges): boolean {
    try {
        const previous = readForUpdate(fingerprint);
        const journey = changes.journey ?? previous?.journey;
        localStorage.setItem(STORAGE_PREFIX + fingerprint, JSON.stringify({
            version: 1,
            macros: changes.tuning?.macros ?? previous?.macros ?? { ...defaultMvpMacroTuning },
            advancedBoosts: changes.tuning?.advancedBoosts ?? previous?.advancedBoosts ?? defaultAdvancedBoosts(),
            ...(journey ? { journey } : {}),
            ...(changes.checkpoint ? { checkpoint: changes.checkpoint }
                : previous?.checkpoint ? { checkpoint: previous.checkpoint } : {})
        }));
        return true;
    } catch {
        return false;
    }
}

/** Keep storage access outside the parse catch: failed reads must not overwrite another slice. */
function readForUpdate(fingerprint: string): (StoredMetaTuning & { checkpoint?: unknown }) | null {
    const raw = localStorage.getItem(STORAGE_PREFIX + fingerprint);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw), tuning = normalizeStoredMetaTuning(parsed, Infinity);
        return tuning ? { ...tuning, ...(parsed.checkpoint ? { checkpoint: parsed.checkpoint } : {}) } : null;
    }
    catch { return null; }
}

export function readTrackCheckpoint(fingerprint: string): unknown {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + fingerprint) ?? 'null')?.checkpoint ?? null;
}

/** Compare the token before deleting: another tab's newer checkpoint is never removed. */
export function removeTrackCheckpoint(fingerprint: string, token: string): void {
    const key = STORAGE_PREFIX + fingerprint, raw = localStorage.getItem(key);
    if (!raw) return;
    const value = JSON.parse(raw);
    if (value?.checkpoint?.token !== token) return;
    delete value.checkpoint;
    localStorage.setItem(key, JSON.stringify(value));
}
