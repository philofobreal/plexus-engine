import { buildNarrative, generateIntents, processChoreography } from '../semantics';
import { featureFlags } from '../config/featureFlags';
import { State } from '../state/store';
import { isSemanticTuningActive } from './semanticAutomationPolicy';

/**
 * Computes the offline narrative -> intent -> choreography chain (ADR-003) and publishes it to
 * shared state. Gated by featureFlags.semanticResolver; when off this is a no-op and the legacy
 * performancePlan automation remains the sole authority. Used by MvpVisualController;
 * DashboardUI retains its equivalent orchestration. Both call the same pure semantic domain
 * functions, but each page has its own State.trackAnalysis and runtime instance.
 */
export function computeAndPublishSemanticPlan(): void {
    if (!featureFlags.semanticResolver) return;
    const narrative = buildNarrative(State.trackAnalysis);
    const intent = generateIntents(narrative);
    const choreography = processChoreography(intent, State.trackAnalysis);
    State.semanticNarrative = narrative;
    State.dramaturgicalIntent = intent;
    State.motifVisualScorePlan = choreography.score ?? null;
    State.visualChoreography = choreography;
    State.currentChoreography = null;
}

/**
 * Freezes the look the resolver modulates around. Kept separate from
 * computeAndPublishSemanticPlan so recomputing the plan after a timeline edit never re-bakes the
 * resolver's deltas into the base. Snapshot only from a clean targetTuning (track load / preset
 * load). `hasTimeBasedPlan` is caller-supplied because DashboardUI and the MVP surface each track
 * their own ADR-004 SemanticResolver instance.
 */
export function snapshotSemanticBaseTuning(hasTimeBasedPlan: boolean): void {
    const isActive = isSemanticTuningActive(featureFlags, hasTimeBasedPlan, State.visualChoreography !== null);
    if (!isActive) return;
    State.semanticBaseTuning = { ...State.targetTuning };
}
