import type { PerformanceAutomationPlan, PerformanceAutomationPoint } from '../types';

export type AutomationPointEdit = Partial<Pick<PerformanceAutomationPoint,
    'time' | 'preset' | 'intensity' | 'morphDurationSec' | 'morphCurve' | 'locked'>>;

export function findAutomationPointById(
    plan: PerformanceAutomationPlan | null | undefined,
    id: string
): PerformanceAutomationPoint | null {
    return plan?.points.find((point) => point.id === id) ?? null;
}

export function removeAutomationPointById(plan: PerformanceAutomationPlan, id: string): boolean {
    const nextPoints = plan.points.filter((point) => point.id !== id);
    if (nextPoints.length === plan.points.length) return false;
    plan.points = nextPoints;
    return true;
}

export function updateAutomationPointById(
    plan: PerformanceAutomationPlan | null | undefined,
    id: string,
    edit: AutomationPointEdit
): PerformanceAutomationPoint | null {
    const point = findAutomationPointById(plan, id);
    if (!point) return null;
    Object.assign(point, edit);
    return point;
}

export function baseMorphDurationFromScaled(displayedDuration: number, scale: number): number {
    return displayedDuration / Math.max(0.01, scale);
}
