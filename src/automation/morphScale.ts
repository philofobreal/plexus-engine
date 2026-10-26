import type { PerformanceAutomationPlan } from '../types';
import { canAnticipateAutomationPoint, isAutomaticCuePoint } from './performanceAutomationRuntime.ts';

export interface MorphScaleOptions {
    safetyMarginSec?: number;
    minScale?: number;
    maxScale?: number;
    durationSec?: number;
}

export function getAutomationPlanViewSignature(plan: PerformanceAutomationPlan): string {
    return JSON.stringify(plan.points.map((point) => [
        point.id,
        point.time,
        point.preset,
        point.intensity,
        point.morphDurationSec,
        point.morphCurve,
        point.locked,
        point.reason,
        point.cuePlacement,
        point.bendMirror,
        point.spiralDirection
    ]));
}

const DEFAULT_MARGIN_SEC = 0.02;
const DEFAULT_MIN_SCALE = 0.25;
const UNBOUNDED_PLAN_FALLBACK = 4;

export function computeMaxMorphScale(plan: PerformanceAutomationPlan | null | undefined, options: MorphScaleOptions = {}): number {
    const minScale = positive(options.minScale, DEFAULT_MIN_SCALE);
    // A finite plan boundary, not an arbitrary percentage, limits proportional growth.
    const explicitMax = Math.max(minScale, positive(options.maxScale, Infinity));
    const margin = nonNegative(options.safetyMarginSec, DEFAULT_MARGIN_SEC);
    const duration = positive(options.durationSec, Infinity);
    const points = sortedPoints(plan);
    let limit = explicitMax;
    let found = false;
    for (let i = 0; i < points.length; i++) {
        const morph = points[i].morphDurationSec;
        if (!(Number.isFinite(morph) && morph > 0)) continue;
        const room = morphRoom(points, i, duration, margin);
        if (!Number.isFinite(room)) continue;
        limit = Math.min(limit, Math.max(0, room) / morph);
        found = true;
    }
    return clamp(found ? limit : Math.min(explicitMax, UNBOUNDED_PLAN_FALLBACK), minScale, explicitMax);
}

export function clampMorphScale(plan: PerformanceAutomationPlan | null | undefined, scale: number, options: MorphScaleOptions = {}): number {
    const minScale = positive(options.minScale, DEFAULT_MIN_SCALE);
    const maxScale = computeMaxMorphScale(plan, { ...options, minScale });
    return clamp(Number.isFinite(scale) ? scale : 1, minScale, maxScale);
}

export function applyMorphScale(plan: PerformanceAutomationPlan | null, scale: number, options: MorphScaleOptions = {}): PerformanceAutomationPlan | null {
    if (!plan) return null;
    const safeScale = clampMorphScale(plan, scale, options);
    const margin = nonNegative(options.safetyMarginSec, DEFAULT_MARGIN_SEC);
    const sorted = sortedPoints(plan);
    const duration = positive(options.durationSec, Infinity);
    const roomByPoint = new Map(sorted.map((point, i) => [point, morphRoom(sorted, i, duration, margin)]));
    return {
        ...plan,
        points: plan.points.map((point) => {
            const scaled = point.morphDurationSec * safeScale;
            const room = roomByPoint.get(point) ?? scaled;
            // The authoring floor applies to base durations, not this proportional view.
            // Reapplying it here would stretch short morphs and contradict the bound.
            return { ...point, morphDurationSec: Math.max(0, Math.min(scaled, Math.max(0, room))) };
        })
    };
}

function morphRoom(points: PerformanceAutomationPlan['points'], i: number, duration: number, margin: number): number {
    const point = points[i];
    if (point.time === 0 && isAutomaticCuePoint(point)) return Infinity; // Already established.
    return canAnticipateAutomationPoint(point, points[i - 1])
        ? point.time - points[i - 1].time - margin
        : Math.min(points[i + 1]?.time ?? Infinity, duration) - point.time - margin;
}

function sortedPoints(plan: PerformanceAutomationPlan | null | undefined) {
    return [...(plan?.points ?? [])].sort((a, b) => a.time - b.time);
}
function positive(value: number | undefined, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback; }
function nonNegative(value: number | undefined, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
