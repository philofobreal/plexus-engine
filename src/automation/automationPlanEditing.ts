import type { BarAnalysis, MorphCurve, PerformanceAutomationPlan, PerformanceAutomationPoint, TrackSection } from '../types';

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

export function clampAutomationTime(time: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(time) ? time : min));
}

/**
 * Resolves the [lo, hi] window `movingPointId` may occupy without overlapping a neighbouring
 * point's [time, time + morphDurationSec) span, biasing toward whichever neighbour the proposed
 * time is already closer to. Shared by the advanced timeline drag handler and any simplified
 * editor so both honour the same non-overlap contract.
 */
export function constrainAutomationPointTime(
    plan: PerformanceAutomationPlan | null | undefined,
    movingPointId: string,
    morphDurationSec: number,
    proposedTime: number,
    totalDurationSec: number
): number {
    const dur = morphDurationSec;
    if (!plan?.points.length) return clampAutomationTime(proposedTime, 0, Math.max(0, totalDurationSec - dur));
    const others = plan.points.filter((point) => point.id !== movingPointId).sort((a, b) => a.time - b.time);
    if (!others.length) return clampAutomationTime(proposedTime, 0, Math.max(0, totalDurationSec - dur));

    let minStart = 0;
    let maxEnd = totalDurationSec;
    for (const other of others) {
        const os = other.time;
        const oe = other.time + other.morphDurationSec;
        if (oe <= proposedTime) {
            minStart = Math.max(minStart, oe);
        } else if (os >= proposedTime + dur) {
            maxEnd = Math.min(maxEnd, os);
        } else {
            const distLeft = Math.abs(proposedTime - (os - dur));
            const distRight = Math.abs(proposedTime - oe);
            if (distLeft <= distRight) { maxEnd = Math.min(maxEnd, os); }
            else { minStart = Math.max(minStart, oe); }
        }
    }
    const lo = minStart;
    const hi = Math.max(lo, maxEnd - dur);
    return clampAutomationTime(proposedTime, lo, hi);
}

/** Rounds `time` to the nearest beat on the analyzed bar grid; a no-op when fewer than two bars exist. */
export function snapTimeToNearestGrid(time: number, bars: Pick<BarAnalysis, 'start'>[], totalDurationSec: number): number {
    if (bars.length < 2) return time;
    const secondsPerBar = bars[1].start - bars[0].start;
    const secondsPerBeat = secondsPerBar / 4;
    const firstBar = bars[0].start;
    const beatIndex = Math.round((time - firstBar) / secondsPerBeat);
    return clampAutomationTime(firstBar + beatIndex * secondsPerBeat, 0, totalDurationSec);
}

/** Moves a point by a signed number of beats (grid-derived), re-applying the non-overlap contract. */
export function nudgeAutomationPointTime(
    plan: PerformanceAutomationPlan | null | undefined,
    id: string,
    deltaBeats: number,
    bars: Pick<BarAnalysis, 'start'>[],
    totalDurationSec: number
): PerformanceAutomationPoint | null {
    const point = findAutomationPointById(plan, id);
    if (!point) return null;
    const secondsPerBeat = bars.length >= 2 ? (bars[1].start - bars[0].start) / 4 : 0.5;
    const proposed = clampAutomationTime(point.time + deltaBeats * secondsPerBeat, 0, totalDurationSec);
    point.time = constrainAutomationPointTime(plan, id, point.morphDurationSec, proposed, totalDurationSec);
    return point;
}

export interface CreateAutomationPointOptions {
    preset: string;
    intensity: number;
    morphCurve: MorphCurve;
    defaultMorphDurationSec: number;
}

/** Inserts a new manual point at `time`, refusing to land inside an existing point's morph span. */
export function createAutomationPointAtTime(
    plan: PerformanceAutomationPlan,
    time: number,
    totalDurationSec: number,
    sections: TrackSection[],
    options: CreateAutomationPointOptions
): PerformanceAutomationPoint | null {
    if (totalDurationSec <= 0) return null;
    const pointTime = clampAutomationTime(time, 0, totalDurationSec);
    for (const existing of plan.points) {
        if (pointTime >= existing.time && pointTime < existing.time + existing.morphDurationSec) return null;
    }

    let allowedDuration = options.defaultMorphDurationSec;
    for (const existing of plan.points) {
        if (existing.time > pointTime) {
            allowedDuration = Math.min(allowedDuration, existing.time - pointTime);
        }
    }
    allowedDuration = Math.max(0.1, allowedDuration);

    const sectionIdx = Math.max(0, sections.findIndex((s) => pointTime >= s.start && pointTime <= s.end));
    const section = sections[sectionIdx];
    const point: PerformanceAutomationPoint = {
        id: `manual-${Date.now().toString(36)}-${Math.round(pointTime * 1000).toString(36)}`,
        time: pointTime,
        sectionId: section ? `${sectionIdx}:${section.label}:${pointTime.toFixed(3).replace('.', '-')}` : `manual:${pointTime.toFixed(3).replace('.', '-')}`,
        preset: options.preset,
        confidence: 1,
        intensity: options.intensity,
        reason: 'manual',
        morphDurationSec: allowedDuration,
        morphCurve: options.morphCurve
    };
    plan.points.push(point);
    plan.points.sort((a, b) => a.time - b.time);
    return point;
}

/** Caps a proposed morph duration for `pointId` at [0.1, 20]s and at the start of the next point
 *  in `plan` (by time), so a lengthened transition can never grow into (or past) a following
 *  point's own morph span. Shared by the advanced timeline drag handler and any simplified editor. */
export function constrainMorphDuration(
    plan: PerformanceAutomationPlan | null | undefined,
    pointId: string,
    pointTime: number,
    proposedDuration: number,
    totalDurationSec: number
): number {
    if (!plan?.points.length) return clampAutomationTime(proposedDuration, 0.1, 20);
    let maxDuration = Math.min(20, Math.max(0.1, totalDurationSec - pointTime));
    for (const other of plan.points) {
        if (other.id !== pointId && other.time > pointTime) {
            maxDuration = Math.min(maxDuration, other.time - pointTime);
        }
    }
    return clampAutomationTime(proposedDuration, 0.1, Math.max(0.1, maxDuration));
}
