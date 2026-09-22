/** Read once per file selection, outside edit/save/render. No audio is stored. */
export async function computeAudioContentHash(file: File): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
