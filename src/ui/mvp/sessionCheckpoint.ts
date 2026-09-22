import { EditHistory, type HistoryArchive, type HistoryDomain, type HistorySnapshot } from './EditHistory';
import { normalizeStoredJourney } from './journeyStorage';
import { normalizeStoredMetaTuning } from './metaTuningStorage';
import { advancedBoostKeys } from './metaTuningBoost';
import { normalizeVisualTuningConfig, cloneDefaultVisualTuning } from '../../config/visualTuning';
import type { VisualTuningConfig, TimelineLayers } from '../../types';

export const MAX_CHECKPOINT_CHARS = 1_500_000;
export interface WorkspaceSnapshot {
    position: number;
    wasPlaying: boolean;
    fullscreen: boolean;
    selectedMomentId: string | null;
    timelineHidden: boolean;
    snap: boolean;
    follow: boolean;
    draw: boolean;
    zoom: number;
    pan: number;
    layers: TimelineLayers;
    drawer: 'character' | 'tuning' | null;
    sheetOpen: boolean;
    previewQuality: 'auto' | 'reduced';
    exportResolution: '720p' | '1080p' | '4K';
    loopPlayback: boolean;
    targetTuning: VisualTuningConfig;
}
export interface SessionCheckpoint {
    version: 1;
    token: string;
    fingerprint: string;
    duration: number;
    file: { name: string; size: number; hash: string };
    current: Record<HistoryDomain, HistorySnapshot>;
    history: HistoryArchive;
    workspace: WorkspaceSnapshot;
}

export function normalizeSessionSnapshot(domain: HistoryDomain, data: string, duration: number): HistorySnapshot | null {
    try {
        const v = JSON.parse(data);
        if (domain === 'tuning') {
            const tuning = normalizeStoredMetaTuning({ ...v, version: 1 }, duration);
            if (!tuning) return null;
            const normalized = { macros: tuning.macros, advancedBoosts: tuning.advancedBoosts };
            return { data: JSON.stringify(normalized), key: JSON.stringify([normalized.macros.intensity, normalized.macros.motion,
                normalized.macros.depth, normalized.macros.detail, ...advancedBoostKeys.map(k => normalized.advancedBoosts[k])]) };
        }
        const journey = normalizeStoredJourney({ version: 1, plan: v.plan, activityLevel: v.activity,
            variantMode: v.variant, morphScale: v.scale, edited: v.edited }, duration);
        const generated = normalizeStoredJourney({ version: 1, plan: v.generatedPlan, activityLevel: 'balanced',
            variantMode: 'paired', morphScale: 1, edited: false }, duration);
        if (!journey || !generated) return null;
        const normalized = { plan: journey.plan, generatedPlan: generated.plan, edited: journey.edited,
            activity: journey.activityLevel, variant: journey.variantMode, scale: journey.morphScale };
        return { data: JSON.stringify(normalized), key: JSON.stringify({ points: normalized.plan.points,
            activity: normalized.activity, variant: normalized.variant, scale: normalized.scale }) };
    } catch { return null; }
}

/** Data-only allowlist: runtime handles, callbacks, DOM and worker results cannot enter State. */
export function normalizeCheckpoint(value: unknown): SessionCheckpoint | null {
    try {
        const v = value as SessionCheckpoint;
        if (!v || v.version !== 1 || typeof v.token !== 'string' || !/^[\w-]{1,100}$/.test(v.token)
            || typeof v.fingerprint !== 'string' || !/^[\w-]{1,100}$/.test(v.fingerprint)
            || !Number.isFinite(v.duration) || v.duration <= 0 || v.duration > 86400
            || !v.file || typeof v.file.name !== 'string' || v.file.name.length > 512
            || !Number.isSafeInteger(v.file.size) || v.file.size <= 0
            || typeof v.file.hash !== 'string' || !/^[a-f0-9]{64}$/.test(v.file.hash)) return null;
        const journey = normalizeSessionSnapshot('journey', v.current?.journey?.data, v.duration);
        const tuning = normalizeSessionSnapshot('tuning', v.current?.tuning?.data, v.duration);
        if (!journey || !tuning) return null;
        const current = { journey, tuning }, history = new EditHistory();
        if (!history.importArchive(v.history, current, (domain, data) => normalizeSessionSnapshot(domain, data, v.duration))) return null;
        const w = v.workspace;
        if (!w || ['wasPlaying', 'fullscreen', 'timelineHidden', 'snap', 'follow', 'draw', 'sheetOpen', 'loopPlayback']
            .some(k => typeof w[k as keyof WorkspaceSnapshot] !== 'boolean')
            || ![w.position, w.zoom, w.pan].every(Number.isFinite) || w.position < 0 || w.position > v.duration
            || w.zoom < 1 || w.zoom > Math.max(16, v.duration / 5) || w.pan < 0 || w.pan > v.duration
            || ![null, 'character', 'tuning'].includes(w.drawer) || !['auto', 'reduced'].includes(w.previewQuality)
            || !['720p', '1080p', '4K'].includes(w.exportResolution)
            || (w.selectedMomentId !== null && typeof w.selectedMomentId !== 'string')
            || !w.layers || ['waveform', 'rms', 'buildup', 'automation', 'cues'].some(k => typeof w.layers[k as keyof TimelineLayers] !== 'boolean')) return null;
        const points = JSON.parse(journey.data).plan.points as Array<{ id: string }>;
        const workspace: WorkspaceSnapshot = {
            position: w.position, wasPlaying: w.wasPlaying, fullscreen: w.fullscreen,
            selectedMomentId: points.some(p => p.id === w.selectedMomentId) ? w.selectedMomentId : null,
            timelineHidden: w.timelineHidden, snap: w.snap, follow: w.follow, draw: w.draw, zoom: w.zoom, pan: w.pan,
            layers: { waveform: w.layers.waveform, rms: w.layers.rms, buildup: w.layers.buildup, automation: w.layers.automation, cues: w.layers.cues },
            drawer: w.drawer, sheetOpen: w.sheetOpen, previewQuality: w.previewQuality,
            exportResolution: w.exportResolution, loopPlayback: w.loopPlayback,
            targetTuning: normalizeVisualTuningConfig(w.targetTuning ?? {}, cloneDefaultVisualTuning())
        };
        return { version: 1, token: v.token, fingerprint: v.fingerprint, duration: v.duration,
            file: { name: v.file.name, size: v.file.size, hash: v.file.hash },
            current, history: history.exportArchive(), workspace };
    } catch { return null; }
}
