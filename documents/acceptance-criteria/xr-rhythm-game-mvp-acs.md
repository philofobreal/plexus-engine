# XR rhythm game MVP acceptance criteria

Contract: [XR rhythm game MVP](../features/xr-rhythm-game-mvp.md). Ownership:
[ADR-009](../adr/ADR-009-xr-rhythm-game-host.md). These are product criteria for the MVP scope
only; see the feature doc's non-goals for what is deliberately out of scope.

## XR-1 Ownership and build

- `/`, `/mvp/`, and `/xr/` each build as independent Vite MPA entries under the existing base
  path. Building `/` and `/mvp/` is unaffected by the new entry.
- Shared, non-XR-specific behavior changes delivered alongside (cue-evidenced automation
  publication per the ADR-005 addendum, analyzer v5 impact cues and uncapped significant moments)
  also apply to `/` and `/mvp/`; they are owned by ADR-005 and the analyzer, not by this entry.
- Opening `/xr/` in a non-XR desktop browser does not throw; it renders a minimal desktop 3D
  preview and a clear WebXR-unsupported status instead of a blank page or an exception.
- `src/gameplay/` contains no import of `three`, `src/xr/`, DOM, or WebXR runtime modules;
  `tests/gameplay-purity.test.mjs` enforces this.
- Only `src/xr/main.ts` constructs `AudioEngine`, the Three.js renderer, and the gameplay/runtime
  wiring for this page.
- `VisualRendererBackend` gains no `z`/3D members and is not implemented by the Three.js path.

## XR-2 Musical determinism

- For the same analyzed track, `RhythmChartBuilder` output is deterministic: identical input
  produces an identical, time-sorted chart; empty/sparse/invalid-timing input produces a valid,
  possibly-empty chart rather than throwing; dense clusters are thinned to the configured minimum
  spacing between onset groups; events beyond track duration are dropped; analyzer arrays are never mutated.
- The same prepared Visual OS plan drives targets and optional Wormhole. Semantic roles select
  distinct textures, directional cuts and reachable two-hand accents without creating notes in silence.
- Horizontal, diagonal and vertically separated pairs preserve hand corridors. Arrows agree with
  swept-blade judging at different headset refresh rates; desktop retains explicit click assistance.
- Rendered note world position is a pure function of `note.time - AudioEngine.getCurrentTime()`
  each frame, not of accumulated per-frame velocity. Pausing, a dropped frame, or a refresh-rate
  change cannot introduce spatial drift; a note snaps to its correct position immediately after
  any synchronization (play, seek, restart).
- A note resolves at most once (hit or miss). `RhythmGameSession` maintains a bounded cursor
  around current song time rather than scanning the full chart every frame.
- Restart explicitly resynchronizes `AudioEngine` position, the chart cursor, judged-note state,
  score/combo, and the rendered note pool together; no stale note/judgement can survive a
  restart or reappear after it.

Whole-track regression coverage also requires quiet, low-confidence and type-3-heavy fixtures
to retain directional phrases, three target rows and multiple pair layouts in every populated
quarter. Cue-placement tests require exact detected evidence, before/after context checks,
full-track coverage beyond 32 significant moments, and preservation of manual/locked points.
No targets are invented to fill silence. See `xr-whole-track-variation.test.mjs`,
`automation-cue-alignment.test.mjs`, and `analyzer-cue-evidence.test.mjs`.

## XR-3 WebXR and controllers

- Immersive support is feature-detected via `navigator.xr?.isSessionSupported('immersive-vr')`,
  never via user-agent sniffing. Unsupported/missing WebXR degrades to the desktop preview with a
  status message, never a thrown error.
- Entering VR requires an explicit user gesture (a button activation), uses
  `renderer.xr.setReferenceSpaceType('local-floor')`, and uses `renderer.setAnimationLoop(...)` as
  the immersive render-loop owner (no manual `requestAnimationFrame` loop competing with it).
- Both controller grips are tracked; handedness comes from the connected `XRInputSource`, never
  from controller index 0/1 assumptions. Saber/baton geometry is simple, locally authored
  geometry -- no externally downloaded controller model is required for the MVP.
- Haptic feedback is capability-detected and its absence never breaks gameplay or throws.
- Session start/end/resize/dispose leave no running animation loop, no leaked listener, and no
  duplicated controller binding after a second immersive entry in the same page load.

## XR-4 Judging, score, and HUD

- Hit judgement requires: the note is unresolved, hand matches (or the note accepts either
  hand), song time is inside the configured hit window, the swept blade intersects the moving
  note's target volume, and strike speed exceeds the configured minimum. When multiple candidate
  notes qualify, the judge picks deterministically (smallest timing error, then stable note
  order).
- Wrong hand, low velocity, and spatial miss each fail to register a hit without crashing or
  double-resolving the note; the note still misses through the normal miss-boundary path if
  never validly struck.
- A miss resets combo; a hit increments score and combo and produces a bounded-lifetime visual
  flash from the preallocated pool, never a newly allocated mesh.
- The pre-VR command drawer (corner menu button, `aria-expanded`, Escape closes, focus returns to
  the button, overlays without resizing the canvas) shows file selection, track title, analysis
  progress/error, BPM/duration once ready, chart note count, WebXR capability status, game
  settings, Play and an Enter VR control; errors reopen it and desktop play closes it. The in-VR HUD shows only
  score, combo, game state, and a start/pause/restart instruction, drawn on a canvas-backed
  texture updated only when its displayed values change (not every frame).

## XR-5 Performance

- The note pool is fixed-capacity (instanced mesh or preallocated mesh pool); no note mesh is
  created or destroyed inside the render loop.
- No per-frame DSP, spectral analysis, or worker spawning occurs in the XR render path; no
  unbounded per-frame allocation in the hot loop (reused `Vector3`/`Matrix4` scratch objects).
- `XrPerformanceProfile` requests a 72 Hz session frame rate when the platform exposes frame-rate
  selection and never fails session startup when it does not; conservative foveation is applied
  only when the platform supports it.

## XR-6 Regression and validation

- The XR suite listed in `../governance/testing-validation.md` (XR rhythm game host changes) passes,
  including `tests/gameplay-purity.test.mjs`.
- `npm run build` (tsc + `vite build` across all three MPA entries) passes.
- Existing dashboard/MVP tests remain green; no analyzer golden-master snapshot changes.
- Manual Quest 3 hardware validation is tracked separately in the
  [Quest 3 manual test checklist](../audits/xr-rhythm-game-quest3-manual-test.md) and is never
  claimed as passed without an actual headset test having been run. Automated and browser evidence
  is recorded in the [delivery review](../audits/xr-rhythm-game-delivery-review.md).

## XR-7 Spatial, lifecycle and desktop stabilization

The detailed spatial and input contract is in the [feature](../features/xr-rhythm-game-mvp.md).

- All targets use three body-relative rows with deterministic semantic assignment and
  same-hand reach constraints; the floor crosses the player position and extends behind it.
- Rendered notes and judged targets use one pure position function. Swept blade contact
  catches fast crossings and mid-blade hits; invalid/gapped pose histories cannot score.
- Trigger never pauses active play; grip squeeze does. XR exit/hidden/tracking-loss pauses
  audio. Re-entry recalibrates full placement (translation and yaw) once, with explicit resume.
- Natural end finishes once with loop disabled. XR generates neither Hero stems nor sources.
- Actual AudioEngine event-order tests cover pause/seek/play/end, stale reading/decoding/worker
  results, listener cleanup, and dashboard default compatibility.
- Desktop left/right clicks use the shared timing/hand/score judge. Space toggles playback;
  no headset, pointer lock, or second game state machine is required.
- Gameplay import tests inspect multiline imports/re-exports and reject dynamic loading.

## XR-8 Presentation redesign

- Runway, hit gate, calibration reticle and targets are scene-owned decoration: no gameplay
  dimension, `notePosition()` or judging input changes. Floor travel is
  `phase = frac(songTime * noteSpeed / 2 m)` (pause freezes, seek reproduces, no accumulation).
- Targets are one unlit instanced batch (chamfered module, exact `noteSizeMeters` bounds); glyphs
  keep their batches and `CUT_VECTORS` rotation; hit/missed/paired/free-cut states stay distinct.
- The HUD and every canvas redraw only when their displayed state changes; nothing allocates in
  `RhythmGameScene.update()`; every geometry/material/texture is disposed exactly once.

## XR-9 Wormhole-facing track path

- The track bends toward `CanvasVisualSource.focalPoint` (the identity's horizon projection); no
  pixel inspection or second route simulation.
- `XrTrackPath` is the only curve: exactly zero within 2.5 m, bounded far displacement, road
  length unchanged. Rendering projects and XR strikes/desktop picks un-project through it.
- The path is a pure function of the current focus; seeking or disabling the Wormhole never
  accumulates curvature (disabled = straight).

## XR-10 Player generation settings

- Difficulty, Activity, Variation, Hands, Lead and Zones are pure gameplay inputs. Defaults
  (Normal/Balanced/Paired/Alternate/Even/Own side) reproduce the pre-settings chart byte-for-byte.
- Every combination is deterministic and keeps spacing (Difficulty floors), reach, cut parity,
  pair, row, onset-only and zone-safety invariants (crossings need the other hand clear; the
  center lane is exclusive and never uses the high row; pairs never cross).
- Changing a setting stops and rewinds playback and regenerates from the captured analysis:
  no re-analysis or reload; Activity/Variation re-prepare the shared plan only when they change;
  stale asynchronous results never publish; settings are locked while presenting in VR.

## XR-11 Section callout

- The hit gate names the analyzer's current section (MVP labels/hues, numbered repeats), pre-
  announces the next one a bar ahead with a beat countdown and animates arrival, all as a pure
  function of song time; non-finite clocks are ignored. The caption stays below the incoming
  sight line and clear of the HUD; the timeline reaches the scene even if settings change mid-load.

## XR-12 Wormhole depth

- Depth cue and depth layers are host presentation options that default off with byte-identical
  output; the MVP uses cue 0.6, XR uses 0.7 plus three fixed planes (40/22/12 m, beyond the
  gameplay volume, angularly identical, additive nearer planes, eye-height anchored).
- One simulation feeds all planes; grains crossfade between planes (shares always sum to 1);
  material-active frames keep one surface; textures upload only on changed Wormhole frames.

