import { PreviewQualityPreference } from '../config/previewQuality';
import './previewQualityControl.css';

const STORAGE_KEY = 'plexus.previewQuality';

export function createPreviewQualityControl(automaticCompact: boolean) {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(STORAGE_KEY); } catch { /* Session-only preference. */ }
    const preference = new PreviewQualityPreference(automaticCompact, saved);
    const root = document.createElement('div');
    root.className = 'preview-quality-control';
    const label = document.createElement('label');
    label.textContent = 'Preview quality';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Preview quality');
    for (const [value, text] of [['auto', 'Automatic'], ['reduced', 'Reduced load']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.append(option);
    }
    select.value = preference.mode;
    select.addEventListener('change', () => {
        preference.setMode(select.value);
        try { window.localStorage.setItem(STORAGE_KEY, preference.mode); } catch { /* Still applies live. */ }
    });
    label.append(select);
    const hint = document.createElement('p');
    hint.textContent = 'Reduced load uses a softer, lower-resolution preview. Export resolution stays independent.';
    root.append(label, hint);
    return { root, preference, setMode(mode: 'auto' | 'reduced') {
        preference.setMode(mode);
        select.value = preference.mode;
        try { window.localStorage.setItem(STORAGE_KEY, preference.mode); } catch { /* Live setting still restored. */ }
    } };
}
