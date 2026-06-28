# Anti-Patterns

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

Stop and redesign if a change introduces any pattern below.

## Architecture Anti-Patterns

- Hidden shared state writes without a documented owner.
- Circular dependencies between audio, UI, renderer, worker, and state modules.
- Importing runtime-heavy dependencies into `src/types/`.
- Worker code importing DOM, p5, UI, renderer, or shared mutable state.
- UI code reaching into worker internals or DSP implementation details.
- Renderer code controlling playback lifecycle.

## Semantic Layer Anti-Patterns (ADR-003)

- **Physical Preset Coupling in Dramaturgy.** Hard-coding physical preset names or file names (for example `temporal1.json`) into the music analysis, narrative, intent, or choreography stages. The semantic chain must stay style- and preset-independent; preset binding belongs to the motif resolver (`resolveSemanticState`) / automation layer.
- **String-Based DSLs.** Introducing runtime regex/string-parsed domain languages is forbidden. Use structured, typed, JSON-serializable ASTs for all choreography and dramaturgy plans.
- **Mutable or random score generation.** Storing functions, `Map`, `Set`, renderer objects, or unseeded random values in either an ADR-003 `MotifVisualScorePlan` or ADR-004 `VisualScorePlan`. Score variation must derive from stable analysis fields and deterministic seeds.
- **Cross-channel writes.** Letting the motif resolver (`resolveSemanticState`) touch the modulation bus / `directorOutput`, or letting `VisualDirectorFSM` read `MotifChoreographyFrame`. The two channels are separate by contract; bridging them requires a new ADR.
- **Per-frame narrative recompute.** Running `buildNarrative` / `generateIntents` / `processChoreography` inside the render loop. They are offline, run-once stages; only `resolveSemanticState` runs per frame.
- **Semantic State Smuggling.** Direct writes to `State.modulation` or `State.directorOutput` from semantic layers are forbidden.
- **Non-deterministic Variation.** Using `Math.random()` in choreography is forbidden; variation must derive from `VariationModel.seed`.

## Visual OS Style System Anti-Patterns (ADR-005)

- **Parallel Dramaturgy.** Re-deriving musical semantics (Narrative, Intent, Sections, Motifs) from `TrackAnalysis` inside `src/automation/` Visual OS modules. They must consume the ADR-003 `src/semantics/` output and only select style-permitted realizations of it.
- **Renderer Leakage Into the Domain.** Putting renderer/tuning concepts (tuning keys, preset filenames, `opacity`, `particleCount`, p5/DOM) into `VisualScene` or any Visual OS domain type. The only place a style names a concrete preset is `StyleTargetReference` (`style-packs.json` `targetMap`), consumed exclusively by `scenePlanAdapter`.
- **Adapter State Writes.** Writing `State.targetTuning` (or any runtime state) from `scenePlanAdapter`, `styleTranslator`, `choreographyDirector`, or `variationEngine`. The adapter emits a `PerformanceAutomationPlan` only; runtime state stays with the existing runtime/UI path.
- **Impure Variation Engine.** Letting `variationEngine` mutate state, select, or persist. It is pure, deterministic, read-only scoring; selection belongs to `choreographyDirector`.
- **Global Mutable Choreography Memory.** Keeping recent targets, gestures, or situations in module-global state, browser storage, or runtime `State`. `VariationMemory` is local to one plan build and planners receive defensive snapshots.
- **Raw-Audio Global Narrative.** Deriving a second narrative from audio inside `globalVisualNarrative`, `longScenePlanner`, or `movementGrammar`. These modules may consume only the already-generated `VisualScenePlan` and semantic scene context.
- **Preset-Shaped Movement Gestures.** Encoding preset names, target handles, tuning keys, or renderer operations as `MovementGesture` values. Movement vocabulary is an abstract style language; binding remains adapter-only.
- **Hard-Coded Style Movement Language.** Ignoring `style-packs.json` `movementVocabulary` when a resolved style/substyle vocabulary exists. Situation defaults are fallback only; global and long-scene biases may reorder only style-permitted gestures.
- **Soft-Only Anti-Repetition.** Relying on the history scoring penalty alone. A hard `VariationPolicy` (ban A->A and short-gap A->B->A) must enforce variation during selection.
- **Unbounded Scene Expansion.** Expanding `SceneEvolution` into automation points without a density cap (`minWaypointSpacingSec` / `maxWaypointsPerScene`), flooding the timeline.
- **Hard-Coded Capability Weights.** Baking per-tier capability scores into the scorer instead of the data-driven `StyleCapabilityMatrix.weights`.
- **Tuning Keys In Automation Meta.** Putting renderer/tuning quantities (tuning keys, `opacity`, `particleCount`, p5/DOM, or a second preset reference) into the optional `PerformanceAutomationPoint.meta`. `meta` carries only renderer-independent provenance (motif, palette/material family, normalized behaviour, evolution phase, scene/style ids, opaque target handle); the concrete preset binding stays in `PerformanceAutomationPoint.preset`. `meta` must be optional everywhere and never break legacy plan import/export.
- **Flag-Gated Default Generation.** Making normal dramaturgy generation depend on a feature flag. Visual OS is the default generator with a silent legacy fallback; `featureFlags.forceLegacyDramaturgy` is a debug/legacy override only and must never be the condition for normal operation. Re-introducing a parallel "select the generator" flag for the normal path is forbidden.
- **Non-ASCII In Visual OS Source/Docs.** Using em-dashes, box-drawing, arrows, or smart quotes in Visual OS source or ADR/governance text; keep them ASCII to avoid mojibake in diffs and governance docs.

## Realtime Audio Anti-Patterns

- Realtime FFT, beat detection, or spectral analysis in p5 `draw()`.
- Reusing an `AudioBufferSourceNode`.
- Manual source stop without clearing `onended`.
- Deriving canonical playback time from UI or frame count.
- Accidentally detaching playback audio data by transferring a buffer still needed by the main thread.

## Event And State Anti-Patterns

- Beat event indexes that are not reset on seek, load, stop, and end.
- Worker results that can overwrite newer loads.
- Mutating worker result arrays from renderer or UI code.
- Async state transitions without a request id or cancellation path.
- Multiple modules claiming ownership of the same state field.

## Render Anti-Patterns

- `new Particle()` during normal draw loop.
- Unbounded shockwave or event object growth.
- Async work inside `draw()`.
- DOM updates every frame when throttling is sufficient.
- Replacing squared-distance checks with unconditional square roots in hot loops.
- Direct p5 drawing calls inside effect modules. All effect drawing must go through `VisualRendererBackend`; p5-specific calls belong in backend adapters or p5-owned primitives.
- Reading raw analyzer fields for animation intensity when an equivalent `State.modulation` signal exists.

## Documentation Anti-Patterns

- Duplicating canonical rules from `AGENTS.md` into compatibility shims.
- Letting product history in `v0.1/` or `v0.2/` override current governance.
- Updating governance docs without checking links and drift from `AGENTS.md`.
- Encoding-damaged legacy markdown rewrites that mix broad cleanup with behavioral changes.
- Scattering platform/runtime workarounds across subsystem docs instead of centralizing them in `platform-operations.md`.

## Platform Anti-Patterns

- Assuming `bun`, `npm`, or shell shims are available on PATH without checking.
- Treating a dev-server background process as healthy without an HTTP reachability check.
- Reporting browser smoke validation as complete when only build or HTTP startup was verified.
- Adding a new dependency only to run simple contract tests that Node's built-in test runner can cover.
- Forgetting `diff_export.ps1` when a PR-style complete snapshot, handoff artifact, or broad review context is explicitly useful.
- Staging or committing generated `branch_pr_snapshot.md`.
- Running `diff_export.ps1` blindly when its `git fetch` side effect or generated local artifact is irrelevant to the task.
