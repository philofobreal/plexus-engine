import { State } from './store';

export type VisualTransitionSource = 'automation' | 'semantic-score' | 'motif';

/** Updates one source slot and recomposes the effective identity only when that slot changes. */
export function setActiveVisualTransitionComponent(source: VisualTransitionSource, id: string | null): string | null {
    if (source === 'automation') {
        if (State.activeAutomationTransitionId === id) return State.activeVisualTransitionId;
        State.activeAutomationTransitionId = id;
    } else if (source === 'semantic-score') {
        if (State.activeSemanticScoreTransitionId === id) return State.activeVisualTransitionId;
        State.activeSemanticScoreTransitionId = id;
    } else {
        if (State.activeMotifTransitionId === id) return State.activeVisualTransitionId;
        State.activeMotifTransitionId = id;
    }

    State.activeVisualTransitionId = composeVisualTransitionId(
        State.activeAutomationTransitionId,
        State.activeSemanticScoreTransitionId,
        State.activeMotifTransitionId
    );
    return State.activeVisualTransitionId;
}

export function resetActiveVisualTransitions(): void {
    State.activeAutomationTransitionId = null;
    State.activeSemanticScoreTransitionId = null;
    State.activeMotifTransitionId = null;
    State.activeVisualTransitionId = null;
}

export function composeVisualTransitionId(
    automationId: string | null,
    semanticScoreId: string | null,
    motifId: string | null
): string | null {
    let identity = automationId ?? '';
    if (semanticScoreId) identity += `${identity ? '|' : ''}${semanticScoreId}`;
    if (motifId) identity += `${identity ? '|' : ''}${motifId}`;
    return identity || null;
}
