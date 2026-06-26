// Semantic / dramaturgy layer (ADR-003). Style-independent, offline, deterministic
// chain computed once per track:
//   TrackAnalysis -> buildNarrative -> generateIntents -> (Choreography, Resolver).
// This barrel must stay free of p5/DOM/runtime-state imports.

export { buildNarrative } from './NarrativeEngine';
export { generateIntents } from './IntentGenerator';
export { processChoreography } from './ChoreographyEngine';
export { applyInvert, applyMirror, applyEcho, applyOperators, ACTION_ANTONYMS } from './PatternGrammar';
export type { ActionMap } from './PatternGrammar';
export { resolveSemanticState } from './SemanticResolver';
