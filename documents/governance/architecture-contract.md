# Architecture Contract

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## System Shape

The app is a Vite TypeScript project with explicit runtime layers:

- Composition: `src/main.ts`
- Audio playback and analysis orchestration: `src/audio/`
- Offline analyzer core: `src/analyzer/`
- Offline analyzer worker adapter: `src/audio/analyzer.worker.ts`
- Shared mutable state: `src/state/`
- Shared static contracts: `src/types/`
- DOM controls and dashboard projection: `src/ui/`
- Offline export orchestration and encoding: `src/export/`
- p5 canvas rendering and backend adaptation: `src/visuals/`

The UI layer has an explicit internal shape:

- `src/ui/DashboardUI.ts` is the facade/orchestrator. It owns cross-controller coordination, timeline interaction state, dashboard projection, preset/performance-plan handoff, `State` writes, and `AudioEngine` calls. It composes the focused controller classes and timeline submodules but must not re-accumulate all DOM listener code, raw pointer normalization, or low-level canvas drawing logic.
- `src/ui/controllers/PlaybackController.ts` owns playback-surface DOM bindings: file selection, play/stop buttons, center play button, seekbar drag state, loop toggle, fullscreen button, canvas click/double-click handling, surface keyboard shortcuts, playback labels, time display, BPM badge, and playback enable/disable state. It delegates intent through callbacks and must not own Web Audio source lifecycle or analysis publication.
- `src/ui/controllers/TuningController.ts` owns tuning and presentation-control DOM bindings: tuning-panel visibility and dragging, metadata-driven tuning controls, preset selector projection, preset brush selector, copy-config feedback, metrics toggle, and visual mode select. It delegates preset loading and state-changing decisions through callbacks and must not normalize preset payloads outside the established config helpers.
- `src/ui/controllers/ExportController.ts` owns export-control DOM bindings: resolution/aspect selectors, capability warnings, export button state, progress labels, stop/cancel controls, and active export UI state. It delegates export workflow start/stop/cancel through callbacks and must not encode video, slice audio, or manage worker messages directly.
- `src/ui/GestureEngine.ts` is the deep interaction module. It normalizes pointer, wheel, mouse, and touch events into stable semantic callbacks (`onStart`, `onMove`, `onEnd`, `onHover`, `onZoom`, `onDoubleClick`) and has no knowledge of music sections, playback state, presets, or rendering.
- `src/ui/TimelineCanvas.ts` is the deep declarative timeline renderer. It renders from a `RenderState` payload, owns HDPI canvas sizing and waveform offscreen cache internals, and must not read global `State` directly or handle user input.

## Dependency And Module Boundary Map

Allowed dependency directions:

- `main.ts` may import audio, UI, visuals, CSS, and shared types.
- `src/audio/` may import `src/state/`, `src/types/`, `src/analyzer/`, and worker modules.
- `src/analyzer/` may import `src/types/` and analyzer-local modules only. It must remain environment-independent and must not import Worker APIs, DOM, p5, UI, renderer modules, `AudioEngine`, or shared mutable runtime state.
- `src/audio/analyzer.worker.ts` may import `src/analyzer/` and `src/types/` only. It must remain a message adapter around `analyzeAudio()`.
- `src/ui/` may import `src/audio/`, `src/state/`, and types.
- `src/ui/DashboardUI.ts` may import `src/export/WebMExporter.ts` to orchestrate user-triggered exports, but it must treat the exporter as a black-box workflow module.
- `src/export/WebMExporter.ts` may import `src/state/` and its worker module. It may receive `AudioEngine` through construction and use only the public `getAudioBuffer()` surface.
- `src/export/export.worker.ts` must remain dependency-free from DOM, p5, UI, audio engine, renderer, and shared mutable state. It may use worker globals, WebCodecs, `Blob`, typed arrays, local pure TypeScript EBML helpers, and the Origin Private File System API (`navigator.storage.getDirectory()`) for direct-to-disk chunk streaming.
- Within `src/ui/`, `DashboardUI.ts` may compose `GestureEngine.ts` and `TimelineCanvas.ts`; those submodules must stay independent from each other.
- Within `src/ui/`, `DashboardUI.ts` may compose focused controllers from `src/ui/controllers/`. Controllers may depend on DOM APIs, callback interfaces, and narrow state reads needed for UI projection, but they must delegate application decisions back to `DashboardUI`.
- UI controllers must not import `src/audio/AudioEngine.ts`, analyzer workers, renderer modules, or export worker modules. Export UI may reference export capability/config types but must not perform export encoding or worker orchestration.
- `GestureEngine.ts` may depend on DOM event and geometry APIs plus shared callback types, but must not import `src/state/`, `src/audio/`, `src/visuals/`, or timeline rendering modules.
- `TimelineCanvas.ts` may depend on canvas APIs and shared render types, but must not import `src/state/`, `src/audio/`, `src/visuals/`, or gesture modules.
- `src/visuals/P5RendererBackend.ts`, `P5RenderTargetCompositor.ts`, `Particle.ts`, `Shockwave.ts`, and `PlexusRenderer.ts` may import p5.
- Effect modules and visual identity modules under `src/visuals/` must draw through `VisualRendererBackend` rather than direct p5 APIs.
- `src/visuals/` may import `src/state/`, visual classes, config helpers, renderer backend contracts, and types.
- `src/state/` may import types only.
- `src/types/` must not import app runtime modules.

Forbidden dependency directions:

- Analyzer core to Worker APIs, DOM, p5, UI, renderer, audio engine, or shared mutable state.
- Worker adapter to DOM, p5, UI, renderer, audio engine, shared mutable state, or duplicated analyzer logic.
- State to UI, audio engine, renderer, worker, DOM, or p5.
- Renderer to UI implementation details except through an explicit composition boundary.
- UI to worker internals or DSP algorithms.
- Export worker to application runtime modules.
- Renderer-owned polling for export loop state. Export loop/no-loop ownership belongs to `WebMExporter`.
- Gesture or timeline renderer submodules to application-level state ownership. Gesture input stays generic; timeline rendering receives data through `RenderState`.
- Types to runtime modules.

Mode-specific visual implementations should live in separate `VisualIdentity` implementations under `src/visuals/`. The renderer entrypoint may orchestrate playback synchronization and delegate drawing, but it must not accumulate multiple full effect implementations inline or hard-code visual-mode drawing branches.

`StyleRegistry` is the deep style-management module. It may hide registered identities behind a private map and expose only simple registration/lookup methods. Application composition should create a registry instance and pass it into the renderer; modules must not rely on a writable unmanaged global registry.

`VisualRendererBackend` is the render boundary for effect modules. The p5 implementation lives in `P5RendererBackend`; future WebGPU, shader, or mock backends must implement the same draw-command contract.

### Visual Identity Lifecycle And Phase 1 Composition

- `VisualIdentity.draw()` receives a renderer-owned `VisualIdentityDrawContext`. During dual rendering, exactly one eligible identity receives `advanceSharedSimulation: true`; the other renders the already-advanced shared pools. If the incoming identity does not use shared simulation, ownership remains with the outgoing identity until the transition completes.
- `VisualIdentity.syncPosition?(timeSec)` is an optional, idempotent discontinuity hook. `PlexusRenderer` invokes it for every registered identity after play/seek/stop position synchronization. It may re-anchor deterministic visual state but must not initiate playback or automation decisions.
- `requestVisualModeChange()` is the sole runtime writer of `State.visualMode`. It flips the logical mode synchronously and records at most one transition using playback time or exact export time. Active dual-render duration is clamped to `0.1..4.0` seconds.
- `requestVisualModeChange()` also owns creation/replacement of `State.visualModeTransition`; it clears the record for paused/stopped switching. `IdentityTransitionController` is the only renderer consumer allowed to clear a completed or backward-time transition record; a record whose `to` no longer matches the logical mode is bypassed. Effect modules and UI controllers must neither read/write the record nor infer transition lifecycle from `State.visualMode`.
- `IdentityTransitionController` owns Phase 1 A-to-B replacement and is the only module allowed to invoke `RenderTargetCompositor`. Inactive rendering bypasses compositor targets. Active rendering uses exactly two persistent buffers and finishes in one identity.
- Composition uses Canvas2D `source-over` with explicit `A * (1 - alpha) + B * alpha` weights; additive `lighter` blending is forbidden for identity replacement. Both transition buffers are cleared at the start of every active transition frame so transparent, chroma-key, and video-backplate modes cannot retain ghost pixels. Offscreen targets remain renderer-private and identities receive only `VisualRendererBackend`.
- Effect/identity modules must not allocate, retain, resize, clear, or composite render targets; import `P5RenderTargetCompositor`; call Canvas compositing APIs; write `State.visualMode`/`State.visualModeTransition`; or advance/delete shared particles and shockwaves when their draw context has `advanceSharedSimulation: false`.
- The wormhole continuous depth distribution and authored ring character are separate concerns. `wormholeDepthCoherence` may deterministically compress immutable phase cohorts into a ribbed look, while progressive seek-induced distribution damage remains forbidden.
- Wormhole route geometry is owned by the wormhole identity, not by preset frequency or automation state. `wormholeWarp` and `wormholeCurve` are local grain-flow controls. Signed `wormholePathBend` controls the bounded horizontal target heading and `wormholePathBendVertical` the independent vertical route component; neither is a lateral deformation scalar or an indefinitely accumulated turn-rate command. Lower targets must counter-steer continuously, and zero must converge to the exact straight heading without a camera teleport. `bendMirror` is an automation direction flag applied once to mirrorable preset targets, not a renderer multiplier. The camera-local projection follows the route tangent without roll, camera shake, whole-canvas rotation, horizon jumps, or identity-foreign route ownership. Visible foreground look-ahead is derived from distance-smoothed route history, so a retarget cannot rewrite in-flight geometry at stationary song time. Cosmos layers keep their authored coordinates and projection depth rigid at each layer depth: bend may translate them through route parallax, but must not stretch, rotate, or rescale their point field. The continuous tuning morph is the sole automation response for live route/speed/continuity/material values; a bend-only delta must not also trigger transition-disturbance geometry. Automation-triggered presets with an explicit foreign `visualMode` must not write active identity-owned wormhole keys; `visualMode`-less presets stay backward compatible. The ownership registry lives in config, not UI logic.

## Lifecycle Ownership

- File decode and analysis request creation belong to audio.
- Worker compute lifecycle belongs to audio plus worker; publication of accepted results belongs to audio.
- Analyzer computation belongs to `src/analyzer/`, not to the worker. `analyzeAudio()` is the single offline analysis orchestration implementation. `FeatureExtractor` owns FFT-derived feature extraction, `GridAligner` owns BPM/grid alignment, ordered tempo candidates, half/double-time ambiguity annotation, and tempo confidence, `SectionAnalyzer` owns bar and section analysis including critically low tempo/grid energy-reactive fallback, and `DramaturgyBuilder` owns beats, cues, and recurring pattern output.
- The analyzer worker message handler is a thin typed response boundary. It destructures `AnalysisRequest`, calls `analyzeAudio()`, forwards progress, posts success, and formats errors. It must not contain DSP, scoring, threshold, BPM detection, dramaturgy, Spectral Pivot, or result-normalization logic.
- Playback start, pause, seek, stop, and end belong to audio.
- Offline export frame timing, p5 loop suppression, export canvas resize/restore, `VideoFrame` capture, audio slicing, watermark drawing, hardware encoder queue synchronization, and stop/cancel semantics belong to `src/export/WebMExporter.ts`.
- WebM byte layout, WebCodecs encoder lifecycle, and muxing belong to `src/export/export.worker.ts`.
- Event consumption for visual effects belongs to visuals, but event index reset rules are part of the playback synchronization contract.
- DOM enable/disable states and dashboard text belong to UI.

## Public Contracts

Shared interfaces must live in `src/types/`. When a schema crosses a worker boundary, define both request and response types before wiring runtime behavior.

Worker result payloads must be append-only unless a coordinated migration updates every consumer. Optional fields are acceptable only when consumers define deterministic defaults. Required analyzer contract additions must update `AnalysisResult`, `TrackAnalysis`, normalization, empty-state templates, schema fixtures, worker consumers, and mock states in the same change.

## State Authority

Every shared state field needs a clear owner:

- Audio owns duration, sample rate, play state, timing, analysis result publication, and accepted worker metadata.
- Audio owns analysis reset isolation. Resetting `State.trackAnalysis` must create a fresh deep copy of the empty analysis template so nested arrays and objects cannot be shared across track loads.
- Analyzer owns canonical `TrackAnalysis` normalization and the empty analysis template. Analyzer normalization must accept explicit fallback context, such as `fallbackBpm`, instead of reading shared runtime state. Legacy analyzer payloads without confidence metadata must normalize to confidence `0` and `tempoCandidates: []`.
- Analyzer confidence metadata belongs under `TrackAnalysis` and root `AnalysisResult`. It must not be duplicated into `RenderState` unless a renderer-owned use case is introduced and documented.
- Visuals own render-derived decay values and visual-only transient state.
- Visuals own `State.modulation`, derived from accepted frame/features plus transient beat/cue decays.
- `State.modulation` must keep a stable object reference during rendering. Visuals update it through `writeModulationBus(State.modulation, ...)`, and transient reset must zero its fields in place instead of assigning `State.modulation = { ... }`.
- UI owns DOM projection and user input dispatch.
- UI may expose analyzer confidence and alternate tempo candidates only through explicitly gated debug surfaces such as `featureFlags.analyzerDebugOverlay`; these fields are not default user-facing dashboard metrics.
- Visual mode intent is owned by UI/preset projection, but the state mutation API is owned by `src/state/visualModeTransition.ts`. UI and validated preset loading must route changes through `requestVisualModeChange()` rather than assigning `State.visualMode` directly. The same module creates/replaces the transition record; renderer-owned `IdentityTransitionController` consumes it and clears completed/backward-time records.
- UI owns `State.targetTuning` writes from sliders and presets; visuals own interpolation into `State.visualTuning`.
- `State.isExporting` and `State.exportTime` are export-owned render clock fields. `WebMExporter` writes them during offline export; `PlexusRenderer` and timeline/dashboard projections consume them. Export must reset both fields in cleanup.
- State module owns shape and initialization defaults.

When ownership is ambiguous, add a small explicit API or handoff contract instead of adding hidden direct writes.

The visual identity transition decision and its rationale are recorded in `../adr/ADR-006-renderer-owned-visual-identity-crossfade.md`.

## Semantic Dramaturgy Layer (ADR-003)

The semantic layer is the style-independent description of dramatic intent. It is separate from both visual styles and physical presets, and its boundary is binding. See `../adr/ADR-003-semantic-layer-boundary.md`.

- The chain `Narrative -> Intent -> MotifVisualScorePlan -> MotifChoreographyFrame` lives under `src/semantics/` and is pure, offline, and deterministic. `MotifVisualScorePlan` is a typed, JSON-serializable AST, not a string-parsed language. `MotifPlanner`, `PatternGrammar`, and `TransitionPlanner` may import shared types but must not import p5, DOM, `src/state/`, `src/visuals/`, `src/ui/`, or `src/audio/`. Identical `TrackAnalysis` must yield identical narrative, score, and choreography plans regardless of selected style.
- The complete ADR-003 slow-channel pipeline is `Narrative -> Intent -> MotifVisualScorePlan -> MotifChoreographyFrame -> resolveSemanticState -> targetTuning`. Motif and transition fields extend the existing action frame contract; consumers that only read `actions` remain valid.
- These stages run once per track (or on timeline edit), not in the render loop. The ADR-003 `resolveSemanticState` function in `motifResolver.ts` runs when a choreography frame, style, or base lookup changes (renderer-side memoization), not unconditionally every frame, with action deltas applied on top of the active style's base preset.
- Channel ownership is split and must never overlap. The ADR-003 motif resolver resolves a `MotifChoreographyFrame` into `State.targetTuning` only (the slow parameter-morph channel). `VisualDirectorFSM` keeps sole ownership of `State.modulation`, `State.directorOutput`, and per-frame `frame.state` (the fast audio-reactive channel). The resolver must not write the modulation bus or director output, and the FSM must not read `MotifChoreographyFrame`.
- Resolved tuning must stay within the `visualTuningControls` min/max bounds; the resolver is responsible for clamping every parameter it writes.
- The layer is gated by `featureFlags.semanticResolver` and is off by default (pass-through). When off, the legacy `performancePlan` automation owns `State.targetTuning` writes as before. When on, the resolver owns `State.targetTuning` and the legacy automation trigger must yield; the earlier "UI owns `State.targetTuning` writes" rule is superseded for the duration semantic mode is active.
- Styles consume the abstract `MotifChoreographyFrame` actions; each style is free to translate the same action into its own geometry. Styles and presets must not leak back into the narrative/intent/choreography stages.
- Any change that lets the FSM consume semantic input requires a new ADR; it must not be introduced ad hoc.

## Time-Based Visual Score Runtime (ADR-004)

The ADR-004 time-based runtime is a separate consumer path alongside the pure, offline ADR-003 pipeline. See `../adr/ADR-004-visual-score-dsl-and-semantic-integration.md`.

- `SemanticResolver` has deterministic, externally side-effect-free output semantics and resolves only a validated snapshot of the active time-based `VisualScorePlan`. Validation accepts only schema version `1.0`, rejects plans above `100000` frames, and atomically rejects malformed frames. Its private cursor mutation is permitted solely as a lookup cache and must not change results.
- `SemanticRuntimeAdapter` is the only ADR-004 component allowed to write `State.targetTuning`. It is an explicit runtime boundary but must receive its target through composition and must not import `src/state/`.
- `featureFlags.semanticChoreography` may suppress the ADR-003 motif resolver only while an active `VisualScorePlan` exists. With no active plan, ADR-003 or legacy performance automation retains authority.
- This phase contains no ADR-004 producer. `TrackAnalysis.externalVisualScorePlan` is an explicitly external pass-through payload, never analyzer-owned output. A `VisualScorePlan` may be consumed when supplied, but analyzer-side narrative intent or plan generation is not implemented.

## Visual OS Style System (ADR-005)

The Visual OS style layer is a renderer-independent scene-translation pipeline that CONSUMES
the ADR-003 semantic output and emits a standard `PerformanceAutomationPlan`. It is the
DEFAULT dramaturgy/automation generator (the Dramaturgy strategy) and lives under
`src/automation/`; the legacy `performancePlanGenerator` is the fallback when a style pack
cannot be resolved or the pipeline returns an empty plan, and it stays the owner of the
explicit `Strict Alternating` and `Hero Rhythm` strategies. `featureFlags.forceLegacyDramaturgy`
(default off) is a debug/legacy override only; it must never be the condition for normal
operation. See `../adr/ADR-005-visual-os-style-system.md`.

- The existing `src/semantics/` ADR-003 chain is the ONLY component permitted to derive
  musical semantics (Narrative, Intent, Sections, Motifs) from `TrackAnalysis`. The Visual OS
  modules consume that output and select style-permitted realizations of it. Re-deriving any
  musical semantics inside `src/automation/` is a forbidden parallel system.
- Single-writer ownership of the new stages:
  - `variationEngine` scores candidate motifs only. It is pure, deterministic, read-only, and
    never mutates state or selects. Capability tier scores come from the data-driven
    `StyleCapabilityMatrix.weights`, not hard-coded constants.
  - `choreographyDirector` selects per-scene realizations and owns the hard anti-repetition
    `VariationPolicy` (bans A->A and short-gap A->B->A). It builds `SceneIntent[]` and the
    narrative-shaped `SceneEvolution` lifecycle. It consumes, never re-derives.
  - `styleTranslator` resolves StylePack inheritance and emits the renderer-INDEPENDENT
    `VisualScene` (`Style Resolver -> Visual Grammar -> Capability Filter -> Behaviour
    Resolver`). Inheritance resolution validates cycles, missing parents, and unknown enum
    members atomically.
  - `globalVisualNarrative` consumes `VisualScenePlan` and owns the track-level arc plus
    per-scene narrative bias. It MUST NOT inspect raw audio or derive musical sections.
  - `automationSituationClassifier` maps existing scene semantics to an abstract
    `AutomationSituation`; `longScenePlanner` maps situation + duration to scene-internal
    macro-form sections.
  - `movementGrammar` resolves abstract `MovementGesture` values. It may consume the resolved
    style movement vocabulary, behaviour, narrative, role, variation mode, and memory snapshot,
    but MUST NOT name target handles, presets, tuning keys, or renderer concepts.
  - `variationMemory` is instantiated once per performance-plan build. It is never a module-
    global runtime store and never persists across builds. The adapter is its only lifecycle
    owner; planners receive defensive snapshots.
  - `microChoreographyPlanner` combines situation, long-scene sections, behaviour and movement
    vocabularies, variation, timing, and memory into `ChoreographySegment[]` with bounded
    `AutomationEnvelope`s.
  - `scenePlanAdapter` is the Renderer Adapter tier: the SINGLE place an opaque
    `VisualScene.targetStateReference` is resolved to a concrete preset (via the pack
    `targetMap`). It emits `PerformanceAutomationPlan { version: 1, source: 'auto', points }`
    only, maps choreography envelopes into intensity waypoints under the Activity cap, and MUST
    NOT import or write `src/state/`.
  - `visualOsPlanner` is pure orchestration; `visualOsPlanLoader` is the IO boundary (loads
    `style-packs.json`) and FAILS SAFE by returning null so the caller uses the legacy
    generator.
- Renderer Independence Contract: domain types (`VisualScene`, `Motif`, `VisualVocabulary`,
  `BehaviourState`, `SceneEvolution`, `MovementGesture`, `LongSceneSection`,
  `GlobalVisualNarrative`, `VariationMemoryState`) carry no renderer/tuning quantities (no tuning keys,
  preset filenames, `opacity`, `particleCount`, p5/DOM). The only place a style names a
  concrete preset is `StyleTargetReference` in `style-packs.json` `targetMap`, consumed
  exclusively by `scenePlanAdapter`.
- The Visual OS adapter never writes `State.targetTuning`. Runtime state writes remain with
  the existing runtime/UI path that consumes the returned `PerformanceAutomationPlan`,
  exactly as for the legacy generator. The fallback to `performancePlanGenerator` is silent
  and produces the same contract, so the runtime/UI consumers are agnostic to which generator
  ran.
- `DramaturgyActivityLevel` (`macro` / `balanced` / `active`) is a normal user-facing control,
  not a feature flag. The adapter resolves it to a segment-length density scale plus a hard
  per-scene point cap (1 / 5 / 8); explicit test overrides win. It controls density only and
  must never re-derive semantics. `DramaturgyVariantMode` controls choreography complexity and
  remains orthogonal to Activity.
- The top-right Visual Mode drives the default Visual OS style pack via the pure, DOM-free
  `generatorRouting` module (`shouldUseVisualOs`, `stylePackForVisualMode`): the main visual
  styles select the matching style pack (ids are 1:1 except `temporal` -> `base-temporal`)
  instead of a separate temporal substyle path. The timeline pack selector is an explicit
  override that the Visual Mode re-aligns. Each `style-packs.json` pack must declare an
  explicit, full `targetMap` (all narratives plus a sparse `default`); inheritance is a safety
  net, not a substitute for per-pack coverage.
- `scenePlanAdapter` may annotate each `PerformanceAutomationPoint` with optional, renderer-
  INDEPENDENT `meta` (motif, palette/material family, normalized behaviour summary, evolution
  phase, scene id, stylePack/substyle, automation situation, vocabulary id, variant role,
  movement gesture, long-scene phase, global arc role, opaque targetStateReference). `meta` must never carry
  tuning keys, preset filenames as values beyond the existing `preset` field, or any renderer
  quantity. It is optional everywhere: legacy and imported-legacy plans omit it, and the
  Copy/Load (`dramaturgyTransfer`) path validates, normalizes, and round-trips it without ever
  rejecting a point because of it.
- `src/automation/` Visual OS modules may import `src/types/` and the pure `src/semantics/`
  output helpers. They must not import `src/state/`, `src/visuals/`, `src/ui/`,
  `src/audio/`, `src/analyzer/`, or p5 (the IO loader may use `fetch`/`import.meta`).
