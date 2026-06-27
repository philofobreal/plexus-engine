# ADR-005: Visual OS Style System (Renderer-Independent Scene Translation)

## Status

Accepted - implemented behind the disabled `USE_VISUAL_OS_V2` feature flag. While the flag
is off, runtime behavior is identical to the legacy path. When on, the runtime UI plan
generation route is served by the Visual OS pipeline through an adapter that
re-materializes the existing `PerformanceAutomationPlan` contract, with automatic fallback
to the legacy generator if a style pack cannot be resolved.

## Date

2026-06-27

## Context

Plexus Engine already owns a complete, governed, offline dramaturgy pipeline:

```
TrackAnalysis
  -> src/semantics/NarrativeEngine.buildNarrative()        (MusicalNarrativePlan)
  -> src/semantics/IntentGenerator.generateIntents()       (DramaturgicalIntentPlan)
  -> src/semantics/{MotifPlanner,PatternGrammar,TransitionPlanner,ChoreographyEngine}
                                                            (MotifVisualScorePlan + frames)
  -> src/semantics/motifResolver.resolveSemanticState()    (State.targetTuning)   [ADR-003]

TrackAnalysis.externalVisualScorePlan (imported)
  -> src/semantics/SemanticResolver                         (deterministic resolve)
  -> src/semantics/SemanticRuntimeAdapter                   (State.targetTuning)   [ADR-004]

TrackAnalysis (+ presets)
  -> src/automation/performancePlanGenerator.generatePerformancePlan()
                                                            (PerformanceAutomationPlan)  [legacy]
```

The legacy `performancePlanGenerator` is the path the UI and runtime consume today: it
emits `PerformanceAutomationPlan { version: 1, source, points: PerformanceAutomationPoint[] }`
where each point binds a `time` to a concrete `preset` filename plus morph metadata.

The motivating need is a richer, **style-aware** description of *what should be shown* -
one that can express a style's vocabulary, its capability constraints, and the
evolution of a scene over its lifetime - **without** leaking renderer or preset
specifics into the dramaturgy. Today, style selection is two ad hoc heuristics:
`performancePlanGenerator.choosePreset()` (preset-filename keyword matching +
`scorePresetForSection`) and the per-style action translation hard-coded inside
`motifResolver`. There is no declarative, inheritable style description, no notion of
"this style forbids this motif", and no separation between a scene's *form* and its
*material*.

### Critical constraint (from the directive and from `AGENTS.md`)

> The goal is not a new architecture but the **evolutionary** extension of the existing
> Plexus architecture. Every new layer must justify which current problem it solves,
> which existing layer it replaces or complements, and what long-term extensibility it
> buys. Avoid unjustified abstractions and parallel systems.

This is decisive. Because `src/semantics/` already implements Narrative -> Intent ->
Choreography deterministically and is protected by the semantic-determinism tests and
the anti-pattern catalog, **re-implementing** that chain under new names
(`SceneIntent`, a second `ChoreographyDirector`, a second variation engine) would be a
prohibited parallel system (`anti-patterns.md` -> "parallel systems",
"Per-frame narrative recompute", "Physical Preset Coupling in Dramaturgy"). The Visual
OS layer must therefore **consume the existing semantic output** and add only what is
genuinely missing: the declarative style layer and the renderer-independent
`VisualScene`.

### Renderer Independence Contract

The domain model is forbidden from naming renderer-specific quantities. `opacity`,
`particleCount`, `lineAlpha`, `wormholeWarp`, p5 calls, and concrete
`visualTuningControls` keys are **renderer/runtime concepts**. They may appear only in
the adapter/runtime tier. Every domain entity below (`VisualScene`, `Motif`,
`VisualVocabulary`, `Behaviour`, `SceneEvolution`) is expressed in style-relative,
normalized, intent-level terms.

## Decision

Adopt a **Style Translation layer that sits on top of the existing `src/semantics/`
dramaturgy output**, produces a renderer-independent `VisualScene` / `VisualScenePlan`,
and is bridged back to the unchanged `PerformanceAutomationPlan` contract by a new
adapter. Everything is gated by `USE_VISUAL_OS_V2` (default `false`).

### 1. Layer Diagram & Domain Pipeline Ownership (Single Writer Principle)

Each datum has exactly one writer. Reuse is marked `[existing]`; new code is `[new]`.

| Stage | Owner (module) | Writes / Produces | Status |
|---|---|---|---|
| **Audio Analysis** | `src/analyzer/` (`analyzeAudio`) | `TrackAnalysis` | `[existing]` |
| **Narrative** (dramaturgical structure / Sections) | `src/semantics/NarrativeEngine` | `MusicalNarrativePlan` (`NarrativeSegment[]`) | `[existing]` |
| **Intent** | `src/semantics/IntentGenerator` | `DramaturgicalIntentPlan` (`IntentPoint[]`) | `[existing]` |
| **Choreography** (scene order & selection) | `src/automation/choreographyDirector` orchestrating `src/semantics/{MotifPlanner,PatternGrammar,TransitionPlanner,ChoreographyEngine}` | `SceneIntent[]` + `SceneEvolution` phases, derived from `MotifVisualScorePlan` / `MotifChoreographyFrame` | `[new orchestrator over existing engines]` |
| **Variation Engine** (candidate scoring ONLY) | `src/automation/variationEngine` | `CandidateScore[]` - pure, read-only, mutates no state | `[new]` |
| **Style Translation Pipeline** | `src/automation/styleTranslator` | `VisualScene` / `VisualScenePlan` (renderer-independent) | `[new]` |
| **Renderer Adapter** | `src/automation/scenePlanAdapter` | `PerformanceAutomationPlan` (compatible `preset`/`meta` references only) | `[new]` |
| **Runtime** (interpolation & frame state) | `applyTuningMorph` + `VisualDirectorFSM` + `motifResolver`/`SemanticRuntimeAdapter` | `State.visualTuning`, `State.modulation`, `State.targetTuning` | `[existing]` |

**Candidate semantics - hard boundary.** The existing `src/semantics/` ADR-003 chain is
the *only* component permitted to derive musical semantics (Narrative, Intent, Sections,
Motifs) from `TrackAnalysis`. A "candidate" scored by the Variation Engine and selected
by the Choreography Director is **a style-permitted realization of already-generated
semantic output** (e.g. an alternative `VisualMotif` from the style's
`preferred`/`supported` set, or a deterministic seeded variation of the existing
`MotifPhrase`), never a newly-derived narrative, intent, section, or motif. Re-deriving
semantics in `src/automation/` is an architectural violation.

Authority rules that do not move:
- `State.targetTuning` continues to be written **only** by the existing runtime/UI
  adapter path (UI/preset writes, or `motifResolver`/`SemanticRuntimeAdapter` when their
  flags are on). The Visual OS adapter **never** writes `State.targetTuning` or any
  other runtime state. It only emits a `PerformanceAutomationPlan`, exactly like
  `performancePlanGenerator` does today.
- `State.modulation` / `State.directorOutput` remain solely `VisualDirectorFSM`-owned.
- The Variation Engine is read-only: it scores candidates and returns scores. It never
  selects, mutates, or persists. Selection belongs to the Choreography stage.

### 2. Style Translation Pipeline decomposition

Replace the implicit, monolithic "choose a preset" step with an explicit, testable chain:

```
SceneIntent (+ SceneEvolution phase, from Choreography)
  -> Style Resolver     : resolve the active StylePack by flattening its inheritance chain
  -> Visual Grammar     : map intent + motif role -> candidate Motifs (form) and Vocabulary (material)
  -> Capability Filter  : drop forbidden motifs/vocab, prefer 'preferred', keep 'supported'
  -> Behaviour Resolver : apply the StylePack's behaviour rules to the surviving candidates
  -> VisualScene        : renderer-independent output
```

`VisualScene` (renderer-independent, no tuning keys):

```ts
interface VisualScene {
  timeSec: number;
  durationSec: number;
  stylePack: string;          // resolved pack id
  substyle?: string;          // resolved substyle id within the pack
  motif: VisualMotif;         // FORM - reuses the existing src/types VisualMotif union
  vocabulary: VisualVocabulary; // MATERIAL - new, style-relative
  behaviour: BehaviourState;  // normalized, style-relative dynamics (0..1 fields, NO tuning keys)
  evolution: SceneEvolutionPhase; // 'birth' | 'growth' | 'peak' | 'release' | 'death'
  transition?: SceneTransition;   // reuses TransitionBehavior vocabulary
  targetStateReference: string;   // OPAQUE handle resolved to a concrete preset/tuning ONLY in the adapter
}
```

The **Phase-3 fix** is encoded here: the translator produces only `VisualScene`. The
concrete `preset`/tuning mapping is performed **exclusively** by `scenePlanAdapter`
(Renderer Adapter tier). `targetStateReference` is an opaque, style-relative handle
(e.g. `"dark-techno-minimal#peak"`), never a preset filename and never a tuning vector.
This keeps the Renderer Independence Contract intact at the domain boundary.

### 3. Style Pack Metadata & Inheritance

New asset: `public/visual-tuning-presets/style-packs.json` (sibling to the existing
preset files; the existing `temporal1.json`..`default.json` remain the concrete tuning
targets the adapter maps onto). A StylePack declares:

- `extends?: string` - single-parent inheritance.
- `capabilities: StyleCapabilityMatrix` - `{ preferred, supported, forbidden }` over
  `VisualMotif` plus palettes, with an optional data-driven `weights: { preferred,
  supported }` (default `0.9` / `0.4`). The weights are the per-tier capability scores the
  Variation Engine applies, so the matrix is genuinely data-driven rather than the weights
  living hard-coded in the scorer. A pack may legitimately weight `supported` above
  `preferred`.
- `vocabulary` - the materials this pack speaks.
- `behaviour` - style-relative behaviour rules (normalized).
- `targetMap` - maps `targetStateReference` handles to **adapter-tier** preset ids /
  tuning references (this is the only place packs touch concrete presets).

Inheritance example: `base-temporal -> dark-techno -> dark-techno-minimal`. Resolution
flattens the parent chain at load time (child overrides parent; `forbidden` is additive
and cannot be re-enabled by a child unless explicitly re-`preferred`/`supported`).
Resolution is deterministic, depth-limited, and rejects cycles and missing parents
atomically - mirroring the ADR-004 `setPlan` validation discipline.

### 4. Form vs. Material

- **Motif** = *form* - reuses the existing `VisualMotif` union in `src/types/index.ts`
  (`pulse-field`, `orbit-system`, `tunnel-drive`, ...). No new form vocabulary is
  invented; the Visual OS reuses what `MotifPlanner` already speaks.
- **VisualVocabulary** = *material* - new, style-relative descriptor of texture/material
  language (e.g. line-weight character, glow character, palette family) expressed as
  normalized, renderer-independent fields. This is the genuinely missing axis today.

### 5. Scene Evolution (new lifecycle concept)

A scene is not static. `SceneEvolution` describes a scene's lifecycle as ordered phases
`birth -> growth -> peak -> release -> death`, each a normalized envelope. It is layered
onto the existing `MotifPhrase` time spans (`startTime`/`endTime`, `intensity`,
`density`, `motion`) rather than replacing them. The envelope shape is **narrative-driven**
(`NARRATIVE_EVOLUTION` per `NarrativeType`), so the same scene intensity reads differently
under a build vs. a breakdown - this is what makes the concept load-bearing rather than a
constant. The adapter expands the lifecycle into intensity waypoints (see section 6), under a
density cap so it never floods the timeline.

### 6. Integration & Adapter (backward-compatible migration)

```
USE_VISUAL_OS_V2 === false (default):
  unchanged. performancePlanGenerator / ADR-003 / ADR-004 own everything exactly as today.

USE_VISUAL_OS_V2 === true:
  TrackAnalysis
    -> [existing] buildNarrative -> generateIntents -> Motif* plan
    -> choreographyDirector (orchestrates the above)            -> SceneIntent[] + SceneEvolution
    -> variationEngine (scores candidates, read-only)
    -> styleTranslator (Style Resolver..Behaviour Resolver)     -> VisualScenePlan
    -> scenePlanAdapter                                          -> PerformanceAutomationPlan
    -> (unchanged) existing runtime / UI consume the plan as before
```

`scenePlanAdapter` rules (the Phase-3 contract boundary):
- Output is exactly `PerformanceAutomationPlan { version: 1, source: 'auto', points }`.
- The `targetTuning` mapping is realized **only** as compatible
  `PerformanceAutomationPoint.preset` / `meta` values or a validated tuning-target
  reference - never a direct `State.targetTuning` write.
- The adapter does **not** import or write `src/state/`. Runtime state continues to be
  written only by the existing runtime/UI adapter, after the plan flows through the
  normal path.
- `SceneEvolution` phases are expanded into `PerformanceAutomationPoint` intensity
  waypoints (the preset is constant within a scene; audio-sensitivity follows the
  birth..death envelope), so the existing morph engine reproduces the lifecycle. A
  per-scene **density cap** (`minWaypointSpacingSec`, `maxWaypointsPerScene`) keeps the
  birth anchor and thins the rest, so short scenes collapse to a single point and long
  scenes never flood the timeline.

Selection / anti-repetition (`choreographyDirector`):
- The Variation Engine only *scores* (soft history penalty). The director enforces a hard
  `VariationPolicy` that **bans A->A and short-gap A->B->A** repetition during selection,
  degrading gracefully (relax to immediate-repeat-only, then last resort) when too few
  style-permitted candidates exist. The semantic layer is never consulted for new motifs.
- Degenerate scenes (e.g. a trailing frame with zero duration in the no-score fallback)
  are filtered out so the plan never carries meaningless points.

### Future Extension (explicitly Out of Scope)

A **Learning Path** seam is reserved but **not implemented**: renderer feedback + user
edits -> style tuning (adjusting StylePack `behaviour`/`targetMap` weights over time).
The architecture leaves room for it (StylePacks are data; the adapter is the single
tuning-binding point), but no producer, persistence, or feedback channel is built in
this phase. No code path reads or writes learning state.

## Consequences

Positive:
- No parallel dramaturgy. The governed, tested `src/semantics/` chain stays the single
  source of narrative/intent/choreography truth; Visual OS is a consumer on top.
- The Renderer Independence Contract is enforced structurally: tuning/preset binding
  exists only in `scenePlanAdapter`.
- Declarative, inheritable styles replace two ad hoc preset-selection heuristics and add
  capability constraints that are impossible to express today.
- Zero behavior change while `USE_VISUAL_OS_V2` is off; the migration is adapter-shaped,
  not a rewrite, matching the ADR-003/004 strategy.

Tradeoffs / risks (flagged for human review):
1. **Lossy VisualScene -> preset mapping (primary review item).** `VisualScene` carries
   motif (form), vocabulary (material), behaviour, and micro-events, but
   `PerformanceAutomationPoint` only carries a preset filename + intensity + morph. The
   mapping is deterministic and documented, but whether the `targetMap` preset choices
   actually produce the intended looks per style is a **designer judgment** tests cannot
   prove. `microEvents` are intentionally not yet emitted by the adapter (carried for a
   future renderer that consumes `VisualScene` directly).
2. **Heuristic constants need a musical/design pass.** `NARRATIVE_EVOLUTION` envelopes,
   `MOTIF_ENERGY` + scoring weights in the variation engine, and the whole
   `style-packs.json` (capabilities, weights, biases, `targetMap`) are first-draft values.
3. **Choreography/Variation overlap.** `choreographyDirector` and `variationEngine`
   orchestrate the existing `src/semantics/` engines and must never re-derive
   narrative/intent/motifs. Guarded by a purity test; keep it that way on future edits.
4. **No live-browser smoke of the V2 path.** With the flag off the runtime is identical to
   today (verified); with it on, there is no UI to select a style pack (defaults to
   `base-temporal`), so the V2 path is validated only headlessly.
5. **`src/types/` growth.** `VisualScene`, `VisualVocabulary`, `StyleCapabilityMatrix`,
   `SceneEvolution` etc. must remain type-only and dependency-light per the contract.

Resolved during implementation (previously flagged): SceneEvolution is now load-bearing
(narrative-shaped envelope expanded under a density cap); the capability matrix is
data-driven via `weights`; anti-repetition is a hard policy; style-pack inheritance
validates cycles/missing-parents/unknown enums atomically and falls back to legacy.

## Alternatives Considered

- **Parallel Visual OS dramaturgy** (new SceneIntent/Choreography/Variation that
  re-derive narrative from `TrackAnalysis`): **Rejected.** Violates the directive's
  critical principle and `anti-patterns.md` (parallel systems, per-frame/duplicated
  narrative). Largest diff, highest regression risk against semantic-determinism tests.
- **Translator writes `State.targetTuning` directly** (skip the `PerformanceAutomationPlan`
  bridge): **Rejected.** Breaks the Renderer Independence Contract and the single-writer
  rule for `targetTuning`; would create a third realtime tuning writer.
- **Style packs as code, not data:** **Rejected.** Forfeits inheritance, hot-authoring,
  and the Learning Path seam; reintroduces preset coupling into modules.

## Implementation References

- `src/config/featureFlags.ts` - add `USE_VISUAL_OS_V2: false`.
- `src/types/index.ts` - add `VisualScene`, `VisualScenePlan`, `VisualVocabulary`,
  `StyleCapabilityMatrix`, `SceneEvolution`/`SceneEvolutionPhase`, `SceneIntent`,
  `BehaviourState` (type-only; reuse `VisualMotif`, `TransitionBehavior`).
- `src/automation/variationEngine.ts` (new, pure read-only scoring).
- `src/automation/choreographyDirector.ts` (new, orchestrates `src/semantics/`).
- `src/automation/styleTranslator.ts` (new, Style Resolver -> Behaviour Resolver).
- `src/automation/scenePlanAdapter.ts` (new, VisualScenePlan -> PerformanceAutomationPlan).
- `public/visual-tuning-presets/style-packs.json` (new asset, inheritance).
- `src/automation/performancePlanGenerator.ts` (unchanged; default path when flag off).
- `src/semantics/*` (unchanged; consumed, not modified).
- `documents/governance/architecture-contract.md`, `anti-patterns.md` (update in the
  migration's final task to record the Visual OS ownership line).
- Tests: `tests/visual-os.test.mjs` (new - style inheritance, capability filtering,
  renderer-independence guard, adapter->plan contract, flag-off no-op).
