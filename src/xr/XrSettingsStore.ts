// Per-viewer persistence of the /xr/ player settings (ADR-009 Addendum H): one small, versioned
// localStorage record. A convenience only -- never shared, never authoritative: every read is
// normalized, and reads/writes never throw (private mode, quota, disabled storage, corrupt JSON).
// The composition root injects the storage; nothing here touches `window`.

import { DEFAULT_XR_SETTINGS, normalizeXrSettings, type XrSettings } from './XrSettings';

export const XR_SETTINGS_STORAGE_KEY = 'plexus.xr.settings';
const RECORD_VERSION = 1;

/** The subset of `Storage` the store uses. */
export interface XrSettingsStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface XrSettingsStore {
    load(): XrSettings;
    save(settings: XrSettings): void;
}

/** No storage: defaults on every load, saves are dropped. */
export const MEMORY_ONLY_SETTINGS_STORE: XrSettingsStore = { load: () => DEFAULT_XR_SETTINGS, save: () => {} };

export function createXrSettingsStore(storage: XrSettingsStorage | null | undefined): XrSettingsStore {
    if (!storage) return MEMORY_ONLY_SETTINGS_STORE;
    let lastWritten: string | null = null;
    return {
        load(): XrSettings {
            try {
                const raw = storage.getItem(XR_SETTINGS_STORAGE_KEY);
                if (!raw) return DEFAULT_XR_SETTINGS;
                const record: unknown = JSON.parse(raw);
                if (!record || typeof record !== 'object' || (record as { version?: unknown }).version !== RECORD_VERSION) return DEFAULT_XR_SETTINGS;
                lastWritten = raw;
                return normalizeXrSettings(record as Parameters<typeof normalizeXrSettings>[0]);
            } catch {
                return DEFAULT_XR_SETTINGS;
            }
        },
        save(settings: XrSettings): void {
            const value = JSON.stringify({ version: RECORD_VERSION, play: settings.play, generation: settings.generation, background: settings.background,
                appearance: settings.appearance, system: settings.system });
            if (value === lastWritten) return;
            try {
                storage.setItem(XR_SETTINGS_STORAGE_KEY, value);
                lastWritten = value;
            } catch {
                // Quota or disabled storage: the settings still apply to this visit.
            }
        }
    };
}
