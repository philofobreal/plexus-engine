import type { VisualMode } from '../types';

export function shouldApplyVisualModePlanGeneration(
    requestId: number,
    latestRequestId: number,
    requestedMode: VisualMode,
    currentMode: VisualMode,
    performancePlanEdited: boolean
): boolean {
    return requestId === latestRequestId
        && requestedMode === currentMode
        && !performancePlanEdited;
}

