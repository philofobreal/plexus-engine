import type { PerformanceAutomationPlan } from '../types';
import { applyMorphScale, clampMorphScale, getAutomationPlanViewSignature } from './morphScale';

/**
 * Non-destructive morph-scale view cache: the base plan (State.performancePlan /
 * editedPerformancePlan) is never mutated by the scale. Shared by DashboardUI and the MVP
 * surface (MvpVisualController) so both apply State.automationMorphScale to a base plan the same
 * way and only rebuild the scaled copy when the source plan, scale, or plan content actually
 * changed -- not on every per-frame automation tick.
 */
export class AutomationPlanViewCache {
    private source: PerformanceAutomationPlan | null = null;
    private scale = NaN;
    private signature: string | null = null;
    private cache: PerformanceAutomationPlan | null = null;

    invalidate(): void {
        this.source = null;
        this.cache = null;
        this.scale = NaN;
        this.signature = null;
    }

    /**
     * Resolves the current morph-scale-applied view of `source`. `requestedScale` is clamped to
     * what the plan can support (`clampMorphScale`); when clamping actually changes the value,
     * `onScaleClamped` fires so the caller can persist the clamped scale back to
     * State.automationMorphScale and reset its "last triggered automation point" tracking (a
     * changed scale shifts every point's morph window). `onRebuild` fires only on an actual cache
     * rebuild, for callers that need to sync a side surface (e.g. a DOM control) to the new view.
     */
    getView(
        source: PerformanceAutomationPlan | null,
        requestedScale: number,
        durationSec: number,
        onScaleClamped: (clampedScale: number) => void,
        onRebuild?: (source: PerformanceAutomationPlan) => void
    ): PerformanceAutomationPlan | null {
        if (!source) return null;
        const clampedScale = clampMorphScale(source, requestedScale);
        if (clampedScale !== requestedScale) onScaleClamped(clampedScale);

        const signature = getAutomationPlanViewSignature(source);
        if (this.source !== source || this.scale !== clampedScale || this.signature !== signature) {
            this.source = source;
            this.scale = clampedScale;
            this.signature = signature;
            this.cache = applyMorphScale(source, clampedScale, { durationSec });
            onRebuild?.(source);
        }
        return this.cache;
    }
}
