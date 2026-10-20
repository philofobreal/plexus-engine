import type { PerformanceAutomationPoint } from '../types';
import type { CueAnchorRole, CueEvidenceAnchor } from './cueEvidence';

/** Use only roles of already accepted anchors; no new musical event or boundary is inferred. */
export function preferredAutomationAnchors(point: PerformanceAutomationPoint, anchors: readonly CueEvidenceAnchor[]): {
    candidates: CueEvidenceAnchor[]; role?: CueAnchorRole;
} {
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
