// Semantic / dramaturgy layer (ADR-003). Style-independent, offline, deterministic
// chain computed once per track:
//   TrackAnalysis -> buildNarrative -> generateIntents -> (Choreography, Resolver).
// This barrel must stay free of p5/DOM/runtime-state imports.

export { buildNarrative } from './NarrativeEngine';
export { generateIntents, findIntentForTime } from './IntentGenerator';
export { processChoreography } from './ChoreographyEngine';
export { planMotifs, selectSubdivision, stableHash } from './MotifPlanner';
export { planTransitions } from './TransitionPlanner';
export { applyInvert, applyMirror, applyEcho, applyOperators, sampleMotifGrammar, ACTION_ANTONYMS } from './PatternGrammar';
export type { ActionMap, MotifGrammarSample } from './PatternGrammar';
export { resolveSemanticState } from './motifResolver';
export { SemanticResolver } from './SemanticResolver';
export type { SemanticResolveResult } from './SemanticResolver';
export { MAX_VISUAL_SCORE_FRAMES, VISUAL_SCORE_VERSION, normalizeVisualScorePlan } from './visualScoreValidation';
export { NeutralSemanticStyleMapper } from './mapper';
export type { SemanticStyleInput, SemanticStyleMapper } from './mapper';
export { ALLOWED_TUNING_KEYS, SemanticRuntimeAdapter } from './SemanticRuntimeAdapter';
