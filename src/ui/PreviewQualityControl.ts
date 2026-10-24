import { PreviewQualityPreference } from '../config/previewQuality';
import './previewQualityControl.css';

const STORAGE_KEY = 'plexus.previewQuality';
const RENDERER_KEY = 'plexus.wormholeRenderer';

export function createPreviewQualityControl(automaticCompact: boolean, offscreenAvailable = false) {
    let saved: string | null = null;
    let renderer: string | null = null;
    try { saved = window.localStorage.getItem(STORAGE_KEY); } catch { /* Session-only preference. */ }
    try { renderer = window.localStorage.getItem(RENDERER_KEY); } catch { /* Session-only preference. */ }
    const selectedRenderer = renderer === 'offscreen' && !offscreenAvailable ? 'compatible'
        : renderer ?? (offscreenAvailable ? 'offscreen' : 'compatible');
    const preference = new PreviewQualityPreference(automaticCompact, saved, selectedRenderer);
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
    const rendererLabel = document.createElement('label');
    rendererLabel.textContent = 'Wormhole renderer';
    const rendererSelect = document.createElement('select');
    rendererSelect.setAttribute('aria-label', 'Wormhole renderer');
    const renderers = [['compatible', 'Compatible'], ['webgl', 'WebGL (experimental)']];
    if (offscreenAvailable) renderers.unshift(['offscreen', 'Offscreen worker']);
    for (const [value, text] of renderers) {
        const option = document.createElement('option'); option.value = value; option.textContent = text; rendererSelect.append(option);
    }
    rendererSelect.value = preference.wormholeRenderer;
    rendererSelect.addEventListener('change', () => {
        preference.setRendererMode(rendererSelect.value);
        try { window.localStorage.setItem(RENDERER_KEY, preference.wormholeRenderer); } catch { /* Applies live. */ }
    });
    rendererLabel.append(rendererSelect);
    const rendererHint = document.createElement('p');
    rendererHint.textContent = offscreenAvailable
        ? 'Offscreen worker moves Wormhole drawing and material off the main thread. Preview: up to 30 fps / 960 px (Reduced: 640 px). Export keeps its full-quality synchronous renderer. Unsupported workers fall back to Compatible. Saved on this device, independently of presets.'
        : 'Experimental GPU drawing for Wormhole preview and export. Falls back to compatible drawing if unavailable. This device setting is independent of presets.';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy preview settings';
    copy.addEventListener('click', async () => {
        try {
            const payload = JSON.stringify({ version: 1, previewQuality: preference.mode,
                wormholeRenderer: preference.wormholeRenderer }, null, 2);
            // Keep the synchronous user gesture on browsers with restricted async clipboard access.
            // The dashboard uses the same textarea fallback for its existing Copy actions.
            const area = document.createElement('textarea');
            const previousFocus = document.activeElement as HTMLElement | null;
            let copied = false;
            try {
                area.value = payload; area.setAttribute('readonly', 'true');
                area.style.position = 'fixed'; area.style.left = '-10000px';
                document.body.appendChild(area); area.select();
                copied = document.execCommand('copy');
            } catch { /* Try the asynchronous clipboard below. */ }
            finally { area.remove(); previousFocus?.focus(); }
            if (!copied) await navigator.clipboard.writeText(payload);
            copy.textContent = 'Copied preview settings';
        } catch { copy.textContent = 'Could not copy — try again'; }
    });
    root.append(label, hint, rendererLabel, rendererHint, copy);
    return { root, preference, setMode(mode: 'auto' | 'reduced') {
        preference.setMode(mode);
        select.value = preference.mode;
        try { window.localStorage.setItem(STORAGE_KEY, preference.mode); } catch { /* Live setting still restored. */ }
    } };
}
