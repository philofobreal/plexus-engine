export interface SemanticAutomationFlags {
    semanticResolver: boolean;
    semanticChoreography: boolean;
}

export function shouldYieldPerformanceAutomation(
    flags: SemanticAutomationFlags,
    hasTimeBasedPlan: boolean
): boolean {
    return flags.semanticResolver || (flags.semanticChoreography && hasTimeBasedPlan);
}
