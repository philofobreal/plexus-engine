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
    // ADR-005 Visual OS style system. The Visual OS pipeline (semantic chain ->
    // ChoreographyDirector -> StyleTranslator -> scenePlanAdapter) is now the DEFAULT
    // dramaturgy/automation generator; the legacy generatePerformancePlan is only the
    // fallback when a style pack cannot be resolved. This flag is a debug/legacy override
    // ONLY: when true the Dramaturgy strategy bypasses Visual OS and uses the legacy
    // generator directly. It is NOT the condition for normal operation.
    forceLegacyDramaturgy: false
};
