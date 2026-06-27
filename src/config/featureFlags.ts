export const featureFlags = {
    heroEffect: false,
    analyzerDebugOverlay: false,
    wormholeSkybox: false,
    // Semantic dramaturgy layer (ADR-003). Off by default = pass-through: the legacy
    // performancePlan automation owns targetTuning and nothing changes. When on, the
    // offline narrative/intent/choreography chain drives targetTuning via the
    // resolveSemanticState function in motifResolver.ts.
    semanticResolver: false,
    // ADR-004 time-based Visual Score runtime. Disabled until a score producer is wired.
    semanticChoreography: false,
    // ADR-005 Visual OS style system. Off by default = legacy generatePerformancePlan owns
    // plan generation. When on, the Visual OS pipeline (semantic chain -> ChoreographyDirector
    // -> StyleTranslator -> scenePlanAdapter) produces the PerformanceAutomationPlan instead,
    // falling back to the legacy generator if a style pack cannot be resolved.
    USE_VISUAL_OS_V2: false
};
