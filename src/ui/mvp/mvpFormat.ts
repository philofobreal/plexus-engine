export function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

export function formatTimeTenths(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

/** Parses "M:SS" or "M:SS.t" back into seconds; returns null (leave unchanged) when unparseable. */
export function parseTimeInput(text: string, maxSeconds: number): number | null {
    const match = /^(\d+):(\d+(?:\.\d+)?)$/.exec(text.trim());
    if (!match) return null;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.max(0, Math.min(maxSeconds, minutes * 60 + seconds));
}

/** Capitalizes an automation reason / section label into a user-facing moment name. */
export function momentLabel(reason: string): string {
    if (reason === 'manual' || reason === 'harmonicShift') return 'Moment';
    return reason.charAt(0).toUpperCase() + reason.slice(1);
}

/** Plain-English label for an ADR-003 dramaturgical IntentType (see semantics/IntentGenerator). */
export function intentLabel(intent: string): string {
    return intent.charAt(0).toUpperCase() + intent.slice(1);
}

const INTENT_DESCRIPTIONS: Record<string, string> = {
    establish: 'Setting the scene — the visual finds its footing.',
    anticipate: 'Building tension — energy is gathering.',
    compress: 'Tightening up — the visual pulls in before a release.',
    expand: 'Opening up — the visual grows and spreads out.',
    release: 'Letting go — tension resolves outward.',
    celebrate: 'Full bloom — the most expressive moment of the track.',
    recover: 'Cooling down — the visual eases back after a peak.',
    contrast: 'A shift in character — a deliberate change of texture.',
    return: 'Coming home — the visual echoes an earlier moment.',
    sustain: 'Holding steady — the visual settles into a groove.'
};

/** User-facing (non-technical) one-liner for a dramaturgical intent segment. */
export function intentDescription(intent: string): string {
    return INTENT_DESCRIPTIONS[intent] ?? 'A shift in the visual journey.';
}

/** Strips the .json extension for display (mirrors DashboardUI.formatPresetName). */
export function formatPresetName(fileName: string): string {
    return fileName.replace(/\.json$/i, '');
}
