import type { PerformanceAutomationPlan, PerformanceAutomationPoint, VisualTuningConfig } from '../types';

/** Finds the point whose preset owns the current timeline position. */
export function findActiveAutomationPoint(
    plan: PerformanceAutomationPlan | null,
    currentTime: number
): PerformanceAutomationPoint | null {
    if (!plan?.points.length || !Number.isFinite(currentTime)) return null;
    let activePoint: PerformanceAutomationPoint | null = null;
    for (const point of plan.points) {
        if (point.time > currentTime) break;
        activePoint = point;
    }
    return activePoint;
}

/** Reasserts the active automation point after a preset payload has been normalized/applied. */
export function applyAutomationMorphAuthority(
    target: VisualTuningConfig,
    point: Pick<PerformanceAutomationPoint, 'intensity' | 'morphDurationSec' | 'morphCurve'>
): void {
    target.audioSensitivity = point.intensity;
    target.morphDurationSec = point.morphDurationSec;
    target.morphCurveValue = point.morphCurve === 'linear' ? 0 : point.morphCurve === 'exponential' ? 2 : 1;
}
