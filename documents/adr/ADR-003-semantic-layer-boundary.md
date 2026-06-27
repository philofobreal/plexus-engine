# ADR-003: Semantic Layer Boundary (Choreography vs. Director FSM)

## Status

Accepted

## Date

2026-06-27

## Context

A planned semantic chain will translate a track's musical structure into
style-independent visual intent before any preset or p5 drawing is chosen:

```
TrackAnalysis -> NarrativeEngine -> IntentGenerator -> MotifPlanner
              -> PatternGrammar -> TransitionPlanner -> ChoreographyEngine
              -> SemanticResolver -> targetTuning -> State / Render
```

The first three stages are pure, offline, environment-agnostic computation run once
when a track is analyzed (or when the timeline is edited). The `SemanticResolver`
runs in the render loop as an O(1) lookup over the precomputed choreography.

The renderer already contains a realtime semantic-ish module, `VisualDirectorFSM`
(`src/visuals/VisualDirectorFSM.ts`). It is NOT a passive emitter: each frame it
mutates the current audio frame's `state`, the `modulation` bus
(`densityDrive`, `kineticTension`, `macroMomentum`), and visual `features`, driven by
the *instantaneous* audio energy plus the offline `buildupConfidence` array and tuning.
It owns hysteresis, a noise gate, drop anticipation, and a glitch envelope. The
`PlexusRenderer` draw loop calls `writeModulationBus(...)` and then
`visualDirector.update(...)`, publishing the result to `State.directorOutput`
(`src/visuals/PlexusRenderer.ts`).

The open question was how the new `SemanticResolver` should relate to the existing
`VisualDirectorFSM`, because that decision fixes the shape of shared `State` and the
scope of the first migration task. The two are easy to mistake for redundant, but they
operate on different output channels at different time scales.

This decision is constrained by:

- `architecture-contract.md`: `State.modulation` must keep a stable object reference and
  is written through `writeModulationBus(State.modulation, ...)` / the FSM; the term
  "dramaturgy" is already governance-owned by the analyzer's `DramaturgyBuilder`.
- `testing-validation.md`: identical analyzer output must yield identical narrative,
  intent, and choreography plans regardless of style (semantic determinism).
- The migration must be incremental (adapter / pass-through), not a big-bang rewrite.

## Decision

Adopt complementary, non-overlapping ownership of the two output channels.

- The **slow, parameter-morph channel** is owned by `SemanticResolver`. It writes ONLY
  `State.targetTuning`, which the existing `applyTuningMorph` smooths into
  `State.visualTuning`. Over time this supersedes the `performancePlan` preset
  automation, but `performancePlan` is retained during the hybrid phase and the
  resolver starts in pass-through.
- The **fast, audio-reactive channel** is owned by `VisualDirectorFSM`. It continues to
  own the `modulation` bus, `directorOutput`, and per-frame `frame.state`, driven by
  instantaneous audio energy. Its `update()` signature is left untouched.
- The two layers MUST NOT write the same field.
- `ChoreographyFrame` is read ONLY by the `SemanticResolver`. The FSM does not receive
  the choreography.

`ChoreographyFrame.actions` is a `Record<ChoreographyAction, number>` (a plain,
JSON-serializable object), never a `Map`, so the plan stays serializable for storage,
timeline persistence, and the semantic-determinism test.

The intermediate representation is the **Visual Score DSL**: a typed,
JSON-serializable `VisualScorePlan` AST containing `MotifPhrase` and
`TransitionPhrase` values. It is not a string DSL and has no parser. `MotifPlanner`
uses deterministic motif memory and seeded variation; `PatternGrammar` samples its
operators into phrase fields; `TransitionPlanner` emits one typed transition for each
adjacent motif boundary. Timing confidence selects beat/bar subdivisions or a
phrase/section fallback before any runtime lookup occurs.

Sampled `motifIntensity`, `motifDensity`, `motifMotion`, and `novelty` values travel
with each `ChoreographyFrame`. The resolver weights motif deltas from those values,
so grammar operations change actual tuning output rather than metadata only.
Transitions use 3 to 16 progress frames based on duration and subdivision, with a
one-second maximum sampling interval for long morphs and handoffs.
Transition frames carry both `fromMotif` and `toMotif`; the resolver crossfades their
motif deltas by progress while rhythmic phase remains grammar-derived. Intent points
are matched to motif phrases by musical time, never by array index.

The new semantic modules live under a new `src/semantics/` namespace, not
`src/dramaturgy/`, to avoid colliding with the analyzer-owned "dramaturgy" term. The
offline stages stay environment-agnostic (no p5, DOM, or shared mutable runtime state),
matching the analyzer-core purity rules.

### Explicitly deferred

No seam is pre-built to feed choreography into the FSM. If a future, objective
performance or expressivity need justifies giving the FSM a read-only semantic hint, a
SEPARATE ADR will decide it. This ADR does not commit the architecture to that
direction; it keeps the evolution open without paying for an unproven abstraction now.

## Consequences

Positive:

- Smallest-diff migration: the tuned realtime feel of `VisualDirectorFSM` (hysteresis,
  noise gate, glitch envelope) is preserved untouched.
- Clean, testable ownership line: `targetTuning` vs. `modulation`/`directorOutput`,
  with no shared writes and no race between two realtime "directors".
- The offline stages are pure and deterministic, so semantic determinism can be tested
  headlessly without a renderer or style.
- Backward compatible: `performancePlan` and the resolver coexist during the hybrid
  phase via pass-through.

Tradeoffs:

- Two conceptually "semantic" systems coexist (offline choreography + realtime FSM);
  the FSM still reads `buildupConfidence` directly rather than the new intent plan, so
  buildup knowledge is not fully unified.
- Shared `State` grows new nullable plan fields plus a `currentChoreography` lookup
  field that must be reset on seek/playback-ended alongside the existing transient
  reset.
- The future read-only-hint option remains explicitly unresolved by design.

## Alternatives Considered

- **Resolver feeds the FSM (choreography as an FSM input):** Rejected for now. It would
  unify the dramatic source but requires touching the finely tuned thresholds and
  hysteresis, blurs the offline/realtime boundary, and raises regression risk against
  the director and styles-deterministic tests. Left open to a future ADR as a read-only
  hint only.
- **Resolver absorbs the FSM (single realtime authority):** Rejected. Largest rewrite,
  discards a working governance-recognized module, and is most likely to regress the
  visual feel and break existing tests. Contradicts the incremental migration strategy.

## Implementation References

- `src/types/index.ts` (new semantic types; `ChoreographyFrame.actions` as `Record`)
- `src/state/store.ts` (nullable plan fields + `currentChoreography`)
- `src/semantics/` (`NarrativeEngine.ts`, `IntentGenerator.ts`, `MotifPlanner.ts`,
  `PatternGrammar.ts`, `TransitionPlanner.ts`, `ChoreographyEngine.ts`,
  `SemanticResolver.ts`, `index.ts`)
- `src/visuals/VisualDirectorFSM.ts` (unchanged signature; owns `modulation` /
  `directorOutput`)
- `src/visuals/PlexusRenderer.ts` (resolver writes `targetTuning`; FSM untouched)
- `src/automation/performancePlanGenerator.ts` (retained during hybrid phase)
- `documents/governance/architecture-contract.md`,
  `documents/governance/anti-patterns.md` (to be updated in the migration's final task)
- `tests/semantics.test.mjs`, `tests/visual-score-dsl.test.mjs`,
  `tests/contracts.test.mjs`, `tests/styles-deterministic.test.mjs`
