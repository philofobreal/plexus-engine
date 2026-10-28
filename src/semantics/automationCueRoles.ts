import type { PerformanceAutomationPoint, TrackAnalysis } from '../types';
import type { CueAnchorRole, CueEvidenceAnchor } from './cueEvidence';
import { sustainedCueContrast } from './cueEvidence.ts';

/** A measured scene start is an estimate, not a hard acoustic boundary. Only a nearby
 * accepted structural anchor with stronger sustained contrast can refine its entry.
 * No new cue, meter phase, section label or instrument identity is inferred here.
 */
export function refineSceneEntry(point: PerformanceAutomationPoint, anchors: readonly CueEvidenceAnchor[],
    analysis: TrackAnalysis, previousTime: number, current?: CueEvidenceAnchor): CueEvidenceAnchor | undefined {
    const placement = point.cuePlacement;
    if (placement?.role !== 'scene-entry' || point.time !== placement.start || point.time === 0) return undefined;
    const tempo = analysis.tempo || analysis.bpm, beat = 60 / tempo;
    if (!Number.isFinite(beat) || beat < 0.2 || beat > 1.5) return undefined;
    // Two beats address local phase uncertainty without trusting a potentially shifted downbeat.
    // Never cross an original predecessor, including an omitted or user-owned proposal.
    const radius = Math.min(2, 2 * beat), lower = Math.max(0, previousTime + 0.12, point.time - radius);
    const upper = Math.min(placement.end, point.time + radius);
    const prior = sustainedCueContrast(analysis, point.time, beat);
    if (prior === undefined) return undefined;
    const currentSupport = current ? sustainedCueContrast(analysis, current.time, beat) : undefined;
    const candidates = anchors.filter(a => a.time >= lower && a.time < upper && a.roles?.includes('structure'))
        .map(a => ({ anchor: { ...a, ...(a.roleEvidence?.structure ?? {}) }, support: sustainedCueContrast(analysis, a.time, beat) }))
        .filter((a): a is { anchor: CueEvidenceAnchor; support: number } => a.support !== undefined
            && a.support >= 0.05 && a.support > Math.max(prior, currentSupport ?? 0) + 0.02)
        .sort((a, b) => b.support - a.support || Math.abs(a.anchor.time - point.time) - Math.abs(b.anchor.time - point.time)
            || a.anchor.time - b.anchor.time);
    return candidates[0]?.anchor;
}

/** Use only roles of already accepted anchors; no new musical event or boundary is inferred. */
export function preferredAutomationAnchors(point: PerformanceAutomationPoint, anchors: readonly CueEvidenceAnchor[]): {
    candidates: CueEvidenceAnchor[]; role?: CueAnchorRole;
} {
    const placement = point.cuePlacement;
    if (placement) {
        const desired: Partial<Record<typeof placement.role, CueAnchorRole[]>> = {
            'scene-entry': [`section:${point.reason}` as CueAnchorRole, 'structure'],
            attack: ['attack'], release: ['release'], structure: ['structure'], melody: ['melody'], fx: ['fx']
        };
        for (const role of desired[placement.role] ?? []) {
            const candidates = anchors.filter(a => a.roles?.includes(role));
            if (candidates.length) return { candidates: candidates.map(a => ({ ...a, ...(a.roleEvidence?.[role] ?? {}) })), role };
        }
        return { candidates: [] }; // No unrelated beat/FX fallback for an explicit purpose.
    }
    // Retained only for old, explicitly opted-in experimental plans without emitted intent.
    const birth = point.meta?.evolutionPhase === 'birth' || (!point.meta && !point.id.startsWith('micro-'));
    const desired: CueAnchorRole[] = birth && point.reason !== 'harmonicShift' && point.reason !== 'manual'
        ? [`section:${point.reason}`, 'structure']
        : point.meta?.variantRole === 'release' || point.meta?.evolutionPhase === 'release' || point.reason === 'break'
        ? ['release'] : point.reason === 'harmonicShift' ? ['melody'] : ['attack'];
    for (const role of desired) {
        const candidates = anchors.filter(a => a.roles?.includes(role));
        if (candidates.length) return { candidates: candidates.map(a => ({ ...a, ...(a.roleEvidence?.[role] ?? {}) })), role };
    }
    return { candidates: [...anchors] };
}
