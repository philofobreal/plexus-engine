import type { PerformanceAutomationPlan } from '../types';

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
        point.locked
    ]));
}

const DEFAULT_MARGIN_SEC = 0.02;
const DEFAULT_MIN_SCALE = 0.25;
const DEFAULT_MAX_SCALE = 4;

export function computeMaxMorphScale(plan: PerformanceAutomationPlan | null | undefined, options: MorphScaleOptions = {}): number {
    const minScale = positive(options.minScale, DEFAULT_MIN_SCALE);
    const uiMax = Math.max(minScale, positive(options.maxScale, DEFAULT_MAX_SCALE));
    const margin = nonNegative(options.safetyMarginSec, DEFAULT_MARGIN_SEC);
    const points = sortedPoints(plan);
    if (points.length < 2) return uiMax;
    let limit = uiMax;
    let found = false;
    for (let i = 0; i < points.length - 1; i++) {
        const morph = points[i].morphDurationSec;
        if (!(Number.isFinite(morph) && morph > 0)) continue;
        const room = points[i + 1].time - points[i].time - margin;
        if (!(Number.isFinite(room) && room > 0)) continue;
        limit = Math.min(limit, room / morph);
        found = true;
    }
    return clamp(found ? limit : uiMax, minScale, uiMax);
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
    const nextTimeById = new Map<string, number>();
    for (let i = 0; i < sorted.length - 1; i++) nextTimeById.set(sorted[i].id, sorted[i + 1].time);
    const duration = positive(options.durationSec, Infinity);
    return {
        ...plan,
        points: plan.points.map((point) => {
            const scaled = point.morphDurationSec * safeScale;
            const nextTime = nextTimeById.get(point.id);
            const room = nextTime !== undefined
                ? nextTime - point.time - margin
                : Number.isFinite(duration) ? duration - point.time - margin : scaled;
            return { ...point, morphDurationSec: Math.max(0.1, Math.min(scaled, Math.max(0.1, room))) };
        })
    };
}

function sortedPoints(plan: PerformanceAutomationPlan | null | undefined) {
    return [...(plan?.points ?? [])].sort((a, b) => a.time - b.time);
}
function positive(value: number | undefined, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback; }
function nonNegative(value: number | undefined, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
