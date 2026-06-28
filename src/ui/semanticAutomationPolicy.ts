export interface SemanticAutomationFlags {
    semanticResolver: boolean;
    semanticChoreography: boolean;
}

export function isSemanticTuningActive(
    flags: SemanticAutomationFlags,
    hasTimeBasedPlan: boolean,
    hasMotifPlan: boolean
): boolean {
    return (flags.semanticChoreography && hasTimeBasedPlan)
        || (flags.semanticResolver && hasMotifPlan);
}
