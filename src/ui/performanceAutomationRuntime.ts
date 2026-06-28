import type { PerformanceAutomationPlan, PerformanceAutomationPoint } from '../types';

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
