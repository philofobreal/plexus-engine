# ADR-009: XR Rhythm Game Host

## Status

Accepted and implemented; runtime candidate awaiting physical Quest 3 acceptance.

## Date

2026-09-22

## Context

The dashboard (`/`) and MVP (`/mvp/`) are both p5/Canvas2D surfaces composed around
`VisualRendererBackend`, a 2D rendering contract (ADR-008). A browser-based VR rhythm-game
foundation for Meta Quest 3 / Meta Quest Browser needs WebXR `immersive-vr`, a real 3D scene
graph, and Touch Plus controller tracking. None of that fits `VisualRendererBackend`: it has
no camera, no depth, no controller input, and retrofitting `z` onto its 2D primitives would
turn a settled 2D contract into an ambiguous 2D/3D hybrid that neither p5 nor a spatial
renderer could implement cleanly.

The existing `AudioEngine` (`src/audio/`), the offline analyzer (`src/analyzer/`), and their
published outputs (`State.events`, `State.trackAnalysis`, BPM/grid data) are reused through explicit host options:
a rhythm chart is a deterministic function of already-published beat/section data, and the
canonical song clock (`AudioEngine.getCurrentTime()`) is renderer-agnostic.

## Decision

- `/xr/` is a third, independent Vite MPA entry, parallel to `/` (dashboard) and `/mvp/`
  (ADR-008), not a mode of either. `xr/index.html` loads `src/xr/main.ts`, which is the sole
  composition root for this page: only it constructs `AudioEngine`, the Three.js
  `WebGLRenderer`, and the gameplay/runtime/scene objects, mirroring how `src/main.ts` and
  `src/ui/mvp/main.ts` are the only composition roots for their pages.
- `src/gameplay/` is pure, renderer-independent game-domain logic (chart construction, judging,
  session state). It must not import Three.js, WebXR, DOM, `AudioEngine`, or global `State`,
  enforced by `tests/gameplay-purity.test.mjs`. It may import shared `src/types/` contracts. This
  mirrors the `src/analyzer/` and `src/semantics/` purity boundaries already established by
  `architecture-contract.md` and ADR-003.
- `src/xr/` owns all Three.js/WebXR runtime concerns: renderer/session lifecycle
  (`XrRuntime`), controller input normalization (`XrInputAdapter`), capability/perf policy
  (`XrCapabilityDetector`, `XrPerformanceProfile`), the 3D scene (`scene/`), and the
  composition/coordination facade (`XrAppController`). Nothing outside `src/xr/` may import
  Three.js or WebXR APIs.
- `AudioEngine` remains the only playback clock and the only owner of decode/worker/playback
  lifecycle. The XR game reads time exclusively through `AudioEngine.getCurrentTime()`; no
  second `AudioContext`, no second analysis worker, no timing derived from `XRFrame`,
  `performance.now()`, a Three.js `Clock`, or accumulated `deltaTime`. XR frame delta is usable
  only for controller velocity and purely visual interpolation, never for musical position.
- The offline analyzer remains the sole owner of musical detection. `RhythmChartBuilder` (`src/gameplay/`) treats
  `State.events` / `State.trackAnalysis` as immutable, consumed once after analysis completes,
  and never re-derives beats or runs realtime detection.
- XR game state (chart, session, score, controller pose) is local to `src/xr/`/`src/gameplay/`
  instances owned by `XrAppController`. No new fields are added to the shared `src/state/Store` for
  it, and nothing under `src/xr/` ever writes to `State`. `XrAppController` alone reads the
  existing analysis-publication fields (`State.events`, `State.frames`, `State.sampleRate`, `State.hopSize`, `State.trackAnalysis`, `State.bpm`,
  `State.duration`) after `AudioEngine.onAnalysisComplete` fires -- the same read pattern
  `DashboardUI`/`MvpVisualController` already use, since that shared store is `AudioEngine`'s only
  publication channel for analysis output. `src/xr/runtime/` and `src/xr/scene/` modules never
  import `src/state/`; they receive plain data parameters from `XrAppController` instead.
- Each page keeps its own runtime, exactly as the dashboard and MVP already do not share a
  running track, `AudioContext`, or in-memory `State` (ADR-008). Opening `/xr/` alongside
  either other surface is unrelated pages, not a synchronized multi-view.
- `VisualRendererBackend` is not extended, implemented, or bypassed by the Three.js path. The
  spatial renderer draws directly with Three.js APIs inside `src/xr/scene/`; the 2D contract
  remains a 2D contract owned by `src/visuals/`. The optional background adapter described
  below implements it there, without adding Three.js or XR methods to the interface.

## Addendum A: shared MVP Wormhole background (2026-09-26)

The user requested the actual MVP Wormhole and exact MVP macro/Advanced slider semantics.

- `src/xr/main.ts` may import **only** `WormholeCanvasSource` from `src/visuals/`, passing a lazy
  factory through the `CanvasVisualSource` contract. Scene/runtime code still cannot import
  visuals/UI or read/write `State`.
- `WormholeCanvasSource` is an embedded-host adapter, the visual counterpart of the MVP facade.
  Its bounded import exception is recorded in the architecture contract: the analyzer's
  empty-analysis factory, the shared automation preset merge/runtime helpers, and pure
  `src/semantics/` functions. It never imports `src/state/`, `src/ui/`, `src/audio/`, `src/xr/`
  or `three`, never regenerates the plan it is given, and fetches only that plan's preset
  assets. `tests/gameplay-purity.test.mjs` guards these limits.
- The source uses an injected, private `WormholeRenderState`; the MVP identity keeps `State` as
  its default. No temporary global-state swapping, second AudioEngine, p5 instance, RAF, or
  analysis worker. Transient decays are the closed-form, seek-safe equivalent of the renderer's
  per-frame rates and share its constants.
- The actual `CosmicWormholeIdentity` draws through a Canvas2D primitive backend and the existing
  material-raster surface. Three consumes one 960x540 canvas texture on a world-anchored
  backdrop. It is a projected 2D background, not stereo tunnel geometry. Background updates are
  capped at 30 Hz, texture uploads occur only when the canvas changes, and paused/off
  backgrounds do no ongoing rendering. Gameplay/headset cadence remains owned by `XrRuntime`.
- Config owns shared macro/Advanced gain resolution (`src/config/`); automation owns the shared
  MVP preset merge (`applyMvpWormholePreset`). MVP modules import these directly. The
  background uses the same default balanced/paired Visual OS journey, fallback generator,
  preset assets, semantic functions and visual identity. The XR host does not import saved MVP
  track edits or another page's playback session.
- `XrAppController` prepares one automation plan offline through
  `automation/prepareWormholePerformance` (its only automation import) and passes it as plain
  data to both gameplay and the canvas source. Gameplay translates existing semantic metadata
  into motor textures, directions and accent pairs; it does not import automation/semantic
  implementations or derive a second musical narrative. See the
  [musical score rules](../features/xr-musical-choreography.md).
- The opt-in `?xrDiagnostics=1` flag is parsed once by `src/xr/main.ts` and injected; runtime and
  visual modules never read `window.location`.

## Addendum B: whole-track phrases (2026-09-26)

Gameplay develops semantic families over bounded phrases across the entire populated track.
Grid confidence selects the spacing scaffold, not the availability of arrows or two-hand
accents. Low-confidence spacing uses published onset intervals, never a second beat grid.
Automation gestures choose entry textures; phrase development varies subsequent textures.

Automatic automation points reach both XR consumers through the shared cue-evidenced
publication gate, which also applies to the dashboard and MVP. That rule is owned by ADR-005:
see its [cue-evidenced publication addendum](ADR-005-visual-os-style-system.md#addendum-cue-evidenced-automation-publication-2026-09-26).
Analyzer version 5 requires actual onset evidence for percussive impact cues and preserves
significant moments across the full track, invalidating older cached analyses. No DSP, cue
detection or plan regeneration occurs during rendering.

## Consequences

`/xr/` can evolve its own scene complexity, controller model, and performance profile without
touching the dashboard, MVP, `VisualRendererBackend`, or the analyzer. The gameplay domain
stays testable headlessly (deterministic chart/judge/session tests, no browser). The cost is a
third composition root and a third build target to keep green; `vite.config.ts`'s `rollupOptions.input`
must keep `main`, `mvp`, and `xr` in sync with `documents/governance/architecture-contract.md`'s
composition-entrypoint list, and `AGENTS.md`'s module ownership map lists `src/gameplay/`
and `src/xr/` alongside the existing owners. The Wormhole adapter is a second consumer of the
MVP preset/tuning pipeline, so changes to `src/config/` gain resolution or
`applyMvpWormholePreset` affect both hosts.

See [XR rhythm game MVP feature](../features/xr-rhythm-game-mvp.md),
[acceptance criteria](../acceptance-criteria/xr-rhythm-game-mvp-acs.md),
[delivery review](../audits/xr-rhythm-game-delivery-review.md), and
[ADR-008](ADR-008-mvp-host-and-shared-renderer.md) for the sibling composition-root precedent.
