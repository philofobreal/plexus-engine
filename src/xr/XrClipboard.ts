// Copies a text to the system clipboard from a menu click (desktop mouse or keyboard, or a headset
// controller's trigger). The async Clipboard API needs a user activation and a secure context; the
// older execCommand route covers browsers without it. Resolves to whether the text reached the
// clipboard, so the menu can say so instead of failing silently.

export async function copyTextToClipboard(text: string, doc: Document | undefined = globalThis.document): Promise<boolean> {
    // Started synchronously inside the click/select handler, while its user activation is valid.
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
        try { await clipboard.writeText(text); return true; } catch { /* fall back below */ }
    }
    if (!doc?.body) return false;
    const area = doc.createElement('textarea');
    try {
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        doc.body.appendChild(area);
        area.select();
        return doc.execCommand('copy');
    } catch {
        return false;
    } finally {
        area.remove();
    }
}
