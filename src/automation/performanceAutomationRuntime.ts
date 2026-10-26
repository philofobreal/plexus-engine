import type { PerformanceAutomationPlan, PerformanceAutomationPoint, VisualTuningConfig } from '../types';

/** Finite authored phase, independent of device cadence and manual smoothing speed. */
export function automationMorphProgress(point: Pick<PerformanceAutomationPoint, 'time' | 'morphDurationSec' | 'morphCurve'>, time: number): number {
    if (!Number.isFinite(time) || !Number.isFinite(point.time) || !Number.isFinite(point.morphDurationSec) || time < point.time) return 0;
    const duration = Number.isFinite(point.morphDurationSec) ? Math.max(0, point.morphDurationSec) : 0;
    if (duration === 0 || time >= point.time + duration) return 1;
    const u = Math.max(0, Math.min(1, (time - point.time) / duration));
    return point.morphCurve === 'linear' ? u : point.morphCurve === 'exponential'
        ? Math.expm1(5 * u) / Math.expm1(5) : u * u * (3 - 2 * u);
}

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

export type AutomationTriggerResult =
    | { kind: 'empty' }
    | { kind: 'inactive' }
    | { kind: 'unchanged' }
    | { kind: 'trigger'; point: PerformanceAutomationPoint };

/**
 * Decides what a per-frame automation tick should do this frame, given the current morph-scaled
 * plan view, playback time, and the id of the point last triggered. MvpVisualController.tick uses
 * this pure helper; DashboardUI currently retains its equivalent inline decision. Each host owns its
 * lastTriggeredAutomationPointId field and the actual preset-loading side effect on a 'trigger'
 * result (which differs enough between the two surfaces -- visualMode switching, nested plan
 * overrides -- that unifying it isn't worth the coupling). On 'empty' or 'inactive' the caller
 * should call setActiveVisualTransitionComponent('automation', null); 'inactive' additionally
 * means the caller should reset its lastTriggeredAutomationPointId to null (the previously-active
 * point is no longer under the playhead, e.g. after a seek before the first point).
 */
export function resolveAutomationTrigger(
    plan: PerformanceAutomationPlan | null,
    currentTime: number,
    lastTriggeredId: string | null
): AutomationTriggerResult {
    if (!plan?.points.length) return { kind: 'empty' };
    const activePoint = findActiveAutomationPoint(plan, currentTime);
    if (!activePoint) return { kind: 'inactive' };
    if (activePoint.id === lastTriggeredId) return { kind: 'unchanged' };
    return { kind: 'trigger', point: activePoint };
}
