export const featureFlags = {
    heroEffect: false,
    analyzerDebugOverlay: false,
    wormholeSkybox: false,
    // Semantic dramaturgy layer (ADR-003). Off by default = pass-through: the legacy
    // performancePlan automation owns targetTuning and nothing changes. When on, the
    // offline narrative/intent/choreography chain drives targetTuning via SemanticResolver.
    semanticResolver: false
};
