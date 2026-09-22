import type { DramaturgyActivityLevel, DramaturgyVariantMode, PerformanceAutomationPlan } from '../../types';
import { parseDramaturgyPlan } from '../../automation/dramaturgyTransfer';
import { clampMorphScale } from '../../automation/morphScale';

/** User-authored playback control, stored alongside the track's visual tuning. */
export interface StoredJourney {
    version: 1;
    plan: PerformanceAutomationPlan;
    activityLevel: DramaturgyActivityLevel;
    variantMode: DramaturgyVariantMode;
    morphScale: number;
    edited: boolean;
}

/** Reject the entire journey on invalid control data; valid tuning remains recoverable. */
export function normalizeStoredJourney(value: unknown, duration = Infinity): StoredJourney | null {
    if (!value || typeof value !== 'object') return null;
    const entry = value as Partial<StoredJourney>;
    if (entry.version !== 1 || !['macro', 'balanced', 'active'].includes(entry.activityLevel ?? '')
        || !['stable', 'paired', 'expressive'].includes(entry.variantMode ?? '')
        || typeof entry.edited !== 'boolean' || typeof entry.morphScale !== 'number'
        || !Number.isFinite(entry.morphScale) || entry.morphScale <= 0) return null;
    const parsed = parseDramaturgyPlan(JSON.stringify(entry.plan));
    if (!parsed.ok) return null;
    const ids = new Set<string>();
    for (const point of parsed.plan.points) {
        if (ids.has(point.id) || point.time > duration || point.intensity < 0.1 || point.intensity > 4
            || !/^[\w .-]+\.json$/i.test(point.preset) || point.preset.toLowerCase() === 'index.json') return null;
        ids.add(point.id);
    }
    parsed.plan.source = entry.plan?.source === 'auto' ? 'auto' : 'edited';
    return {
        version: 1, plan: parsed.plan, activityLevel: entry.activityLevel!, variantMode: entry.variantMode!,
        // Storage writes may not know the track duration (especially a single-point plan).
        // Defer geometric clamping until load supplies that boundary; never impose a 400% fallback.
        morphScale: Number.isFinite(duration)
            ? clampMorphScale(parsed.plan, entry.morphScale, { durationSec: duration })
            : Math.max(0.25, entry.morphScale), edited: entry.edited
    };
}
