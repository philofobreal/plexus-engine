import type { MotifChoreographyFrame } from '../types';
import type { ChoreographyFrame } from '../types/semantics';

/** Stable identity for an ADR-003 frame. Called only when the active frame object changes. */
export function motifTransitionId(frame: MotifChoreographyFrame | null): string | null {
    if (!frame) return null;
    const motif = frame.motifId ?? frame.motif ?? '';
    const position = typeof frame.phrasePosition === 'number' && Number.isFinite(frame.phrasePosition)
        ? frame.phrasePosition
        : '';
    return `motif:${frame.time}:${motif}:${position}`;
}

/** Stable identity for an ADR-004 score frame. Called only when the active frame object changes. */
export function semanticScoreTransitionId(frame: ChoreographyFrame | null): string | null {
    if (!frame) return null;
    const variation = frame.motion.variation;
    return `score:${frame.timeSec}:${variation.phraseIndex}:${variation.variationIndex}:${frame.primaryPattern}`;
}
