import type { PerformanceAutomationPlan, PerformanceAutomationPoint } from '../types';

/**
 * Pure (DOM-free) serialization and validation for copying/loading a dramaturgy
 * (performance-automation) plan through the clipboard. Kept out of `DashboardUI`
 * so the parsing, validation, and edge-case handling can be unit-tested in full.
 */

export const DRAMATURGY_CLIPBOARD_KIND = 'plexus-dramaturgy';
export const DRAMATURGY_CLIPBOARD_VERSION = 1;

const REASONS = ['intro', 'verse', 'build', 'drop', 'break', 'peak', 'outro', 'harmonicShift', 'manual'];
const CURVES = ['linear', 'easeInOut', 'exponential'];
const TIMING_MODES = ['bar-aligned', 'energy-reactive', 'novelty'];

export interface DramaturgyClipboardEnvelope {
    kind: string;
    version: number;
    exportedAt: string;
    duration: number | null;
    plan: PerformanceAutomationPlan;
}

export interface DramaturgyParseSuccess {
    ok: true;
    plan: PerformanceAutomationPlan;
    pointCount: number;
}

export interface DramaturgyParseFailure {
    ok: false;
    error: string;
}

export type DramaturgyParseResult = DramaturgyParseSuccess | DramaturgyParseFailure;

/** Serialize a plan into a tagged clipboard envelope (pretty-printed JSON). */
export function serializeDramaturgyPlan(plan: PerformanceAutomationPlan, duration: number | null = null): string {
    const sanitized = sanitizePlan(plan) ?? { version: 1, source: 'edited', points: [] };
    const envelope: DramaturgyClipboardEnvelope = {
        kind: DRAMATURGY_CLIPBOARD_KIND,
        version: DRAMATURGY_CLIPBOARD_VERSION,
        exportedAt: new Date().toISOString(),
        duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
        plan: sanitized
    };
    return JSON.stringify(envelope, null, 2);
}

/**
 * Parse clipboard text into a validated, normalized plan. Accepts a tagged
 * envelope, a bare plan, or a full visual-config payload that embeds a
 * `performancePlan`. Returns a precise error instead of throwing.
 */
export function parseDramaturgyPlan(text: unknown): DramaturgyParseResult {
    if (typeof text !== 'string') return fail('No clipboard text to read.');
    const trimmed = text.trim();
    if (!trimmed) return fail('Clipboard is empty.');

    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return fail('Clipboard does not contain valid JSON.');
    }
    if (!parsed || typeof parsed !== 'object') return fail('Clipboard JSON is not a dramaturgy object.');

    const candidate = extractPlanCandidate(parsed as Record<string, unknown>);
    if (candidate === null) return fail('Clipboard JSON is not a dramaturgy plan.');

    const sanitized = sanitizePlan(candidate);
    if (!sanitized) return fail('Dramaturgy plan is malformed (invalid structure or points).');

    return { ok: true, plan: sanitized, pointCount: sanitized.points.length };
}

function extractPlanCandidate(record: Record<string, unknown>): unknown {
    // Tagged envelope from serializeDramaturgyPlan.
    if (record.kind === DRAMATURGY_CLIPBOARD_KIND && record.plan && typeof record.plan === 'object') {
        return record.plan;
    }
    // Full visual-config payload that embeds a plan under `performancePlan`.
    if (record.performancePlan && typeof record.performancePlan === 'object' && !('points' in record)) {
        return record.performancePlan;
    }
    // Bare plan.
    if ('points' in record || 'version' in record) return record;
    return null;
}

function sanitizePlan(value: unknown): PerformanceAutomationPlan | null {
    if (!value || typeof value !== 'object') return null;
    const plan = value as { version?: unknown; points?: unknown };
    if (plan.version !== 1) return null;
    if (!Array.isArray(plan.points)) return null;

    const points: PerformanceAutomationPoint[] = [];
    for (const raw of plan.points) {
        const point = sanitizePoint(raw);
        if (!point) return null;
        points.push(point);
    }
    points.sort((a, b) => a.time - b.time);
    return { version: 1, source: 'edited', points };
}

function sanitizePoint(raw: unknown): PerformanceAutomationPoint | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== 'string' || c.id.length === 0) return null;
    if (!isFiniteNumber(c.time) || (c.time as number) < 0) return null;
    if (typeof c.sectionId !== 'string') return null;
    if (typeof c.preset !== 'string' || c.preset.length === 0) return null;
    if (!isFiniteNumber(c.confidence)) return null;
    if (!isFiniteNumber(c.intensity)) return null;
    if (typeof c.reason !== 'string' || !REASONS.includes(c.reason)) return null;
    if (!isFiniteNumber(c.morphDurationSec) || (c.morphDurationSec as number) <= 0) return null;
    if (typeof c.morphCurve !== 'string' || !CURVES.includes(c.morphCurve)) return null;
    if (c.analysisConfidence !== undefined && !isFiniteNumber(c.analysisConfidence)) return null;
    if (c.timingMode !== undefined && (typeof c.timingMode !== 'string' || !TIMING_MODES.includes(c.timingMode))) return null;
    if (c.locked !== undefined && typeof c.locked !== 'boolean') return null;

    // Rebuild from known fields only so unknown/extra properties are stripped.
    const point: PerformanceAutomationPoint = {
        id: c.id,
        time: c.time as number,
        sectionId: c.sectionId,
        preset: c.preset,
        confidence: clamp01(c.confidence as number),
        intensity: c.intensity as number,
        reason: c.reason as PerformanceAutomationPoint['reason'],
        morphDurationSec: c.morphDurationSec as number,
        morphCurve: c.morphCurve as PerformanceAutomationPoint['morphCurve']
    };
    if (c.analysisConfidence !== undefined) point.analysisConfidence = clamp01(c.analysisConfidence as number);
    if (c.timingMode !== undefined) point.timingMode = c.timingMode as PerformanceAutomationPoint['timingMode'];
    if (c.locked !== undefined) point.locked = c.locked as boolean;
    return point;
}

function isFiniteNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function fail(error: string): DramaturgyParseFailure {
    return { ok: false, error };
}
