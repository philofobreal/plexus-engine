import type { PerformanceAutomationPlan, PerformanceAutomationPoint, VisualTuningConfig } from '../types';

export interface AutomationMorphWindow { start: number; end: number; arrivalAtCue: boolean }
export function isAutomaticCuePoint(point: PerformanceAutomationPoint): boolean {
    return !!point.cuePlacement && !point.locked && point.reason !== 'manual';
}
export function canAnticipateAutomationPoint(point: PerformanceAutomationPoint, previous?: PerformanceAutomationPoint): boolean {
    return isAutomaticCuePoint(point) && !!previous && isAutomaticCuePoint(previous);
}

/** Render-only schedule. Canonical cue/trigger/event times and protected authored morphs stay intact. */
export function automationMorphWindow(point: PerformanceAutomationPoint, previous?: PerformanceAutomationPoint): AutomationMorphWindow {
    const duration = Number.isFinite(point.morphDurationSec) ? Math.max(0, point.morphDurationSec) : 0;
    // No look-ahead before a late initial state or across a user-owned/legacy predecessor.
    const arrivalAtCue = canAnticipateAutomationPoint(point, previous);
    if (point.time === 0 && point.cuePlacement) return { start: 0, end: 0, arrivalAtCue };
    return arrivalAtCue
        ? { start: Math.max(0, previous!.time, point.time - duration), end: point.time, arrivalAtCue }
        : { start: point.time, end: point.time + duration, arrivalAtCue: false };
}

/** Finite authored phase, independent of device cadence and manual smoothing speed. */
export function automationMorphProgress(point: Pick<PerformanceAutomationPoint, 'time' | 'morphDurationSec' | 'morphCurve'>, time: number,
    window?: AutomationMorphWindow): number {
    const start = window?.start ?? point.time, end = window?.end ?? point.time + Math.max(0, point.morphDurationSec);
    if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end) || time < start) return 0;
    if (end <= start || time >= end) return 1;
    const u = Math.max(0, Math.min(1, (time - start) / (end - start)));
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
