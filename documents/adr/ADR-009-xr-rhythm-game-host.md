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
  visual modules never read `window.location`. (Since Addendum X the player can also switch the
  in-headset diagnostics on in Settings > System; the flag forces them on.)

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

## Addendum C: Wormhole-facing track path (2026-09-27)

`CanvasVisualSource` gains one optional read-only field, `focalPoint` (normalized x/y, +y up). The
Wormhole identity fills it from its existing horizon projection; no renderer internals are exposed.
XR owns a single pure track-path projection (`src/xr/scene/XrTrackPath.ts`) applied after canonical
`notePosition()`; rendering projects through it and XR hit testing un-projects through it.
`src/gameplay/` is unchanged and remains renderer-independent.

*Update (2026-10-05, XR performance pass):* the runway floor and rails no longer rewrite and
re-upload vertex positions when the path changes. Their geometry is static; `XrTrackPath` exports
`TRACK_BEND_GLSL`, the vertex-shader twin of `trackBendWeight` / `trackPathOffset` (operation for
operation), and `installTrackBend` adds it after `begin_vertex` of the runway materials. The path
writes one `uTrackBend` vec4 (far-end amplitudes, bend start, bend end); CPU projection and strike
un-projection still use the TypeScript functions. Tests pin the GLSL text, a float32 mirror of it
against CPU samples, the exact straight zone and unchanged buffer versions.

*Update (2026-10-05, XR performance pass):* targets travel on the GPU too. `RhythmNoteField` keeps
choosing the drawn targets on the CPU (the session's bounded active window, the same pools and
order) and writes event-scope instance data -- canonical lane/row x, y from `notePosition`, note
time relative to a write epoch, cut angle or gem phase, base colour and mode -- only when the drawn
set or a target's status changes. `NOTE_MOTION_GLSL` derives the canonical travel z from a
song-time uniform and bends the centre with the same `TRACK_BEND_GLSL` and `uTrackBend` (plus the
hit-plane distance), then applies spawn growth / brightness, cut roll, the Classic glyph lift and
the turning gem. A path change is a uniform update; judging keeps `notePosition` and
`unprojectStrike`. A WebGL transform-feedback check against the former CPU matrices (both designs,
spawn fade, three paths, song times up to 300 s) measured at most 5.2e-6 m and 1.5e-7 colour
difference.

*Update (2026-10-05, XR performance pass, per-frame state):* `RhythmGameSession.getSnapshot()`
returns a frozen snapshot and hands out the same object while no field changed (any change yields
a new one; `sections` stays the run's live read-only results). The progress ring re-projects its
section arcs only when a note resolves or a new run starts, the song map keys its caption
numerically, and the results line is rebuilt only when the result changes.

## Addendum D: player generation settings (2026-09-27)

`buildRhythmChart` takes optional `RhythmGenerationSettings` (Difficulty, Activity, Variation, hand
pattern, hand lead, zones), pure gameplay data; defaults reproduce the historical chart byte-for-byte. Activity and
Variation keep their ADR-005 meanings and are also forwarded to `prepareWormholePerformance`, so the
shared plan and the Wormhole follow them as in the MVP. `XrAppController` regenerates from its
captured analysis snapshot under the existing load-generation token; it never re-analyzes.

*Update (2026-10-05, XR performance pass):* chart and plan preparation stay on the main thread.
Measured in desktop Chromium on a 5-minute track (14,062 analysis hops, 43 sections, ~480 notes):
`prepareWormholePerformance` 5-7 ms per Activity/Variation combination, `buildRhythmChart` ~1 ms,
`loadChart` (scoring plan) ~0.2 ms, score overview and section timeline <0.1 ms. A planning worker
would first have to receive `trackAnalysis`, which carries per-hop arrays: `structuredClone` of it
alone took 12-18 ms, more than the work it would move. Revisit if preparation exceeds ~50 ms on
the target headset, or if the analysis comes to live in a worker that could plan without a copy.
The larger hitch was the Wormhole worker `prepare` message, which copied the whole analysis,
frames included, on every plan change too, although only `performancePlan` differs then (~23-36
ms `postMessage` for the same track). A regenerated plan now crosses alone (`prepare-plan`, ~0.1
ms); the worker re-prepares from its kept copy (see worker communication). Load and turning the
background on still send the analysis once.

## Addendum E: Wormhole depth cues and 2.5D stereo planes (2026-09-27)

`CosmicWormholeIdentity` gains two host presentation options, both default-off (byte-identical
legacy output): `setDepthCue(amount)` (size constancy, atmospheric attenuation and haze from each
grain's already-computed depth) and `setDepthLayers({ mid, near })` (routes vector-path grains by
depth to extra raster targets with complementary crossfades; background layers stay on the main
backend). The MVP composition root sets depth cue 0.6; the dashboard keeps 0. `CanvasVisualSource`
gains an optional read-only `layers` list (far -> near). `WormholeCanvasSource({ depthLayers,
depthCue })` renders one simulation into a 960x540 far plane and two 768x432 nearer planes;
`WormholeBackdrop` places them at 40 / 22 / 12 m (additive nearer planes, angularly identical,
anchored to the sampled eye height). `VisualRendererBackend` is unchanged. Material-active frames
keep a single surface.

## Addendum F: single-plane background and player presentation controls (2026-10-03)

Headset frame pacing outranks the 2.5D separation. The XR composition root no longer requests
`depthLayers`: the Wormhole is one world-anchored plane at 40 m (depth cue 0.7 kept). Addendum E's
identity options and the `CanvasVisualSource.layers` contract stay available and unchanged.

- `CanvasVisualSourceFactory` takes optional construction options (`width`, `height`), and
  `CanvasVisualSource` gains an optional `setPresentation({ lineStroke, maxFrameRateHz })`. Line
  stroke is the MVP Advanced "Line stroke" slider position (0..1, 0.5 neutral) layered on a private
  copy of `XR_WORMHOLE_BOOSTS`; it never changes presets, the plan or tuning ownership, and applies
  directly (not morphed), redrawing once even while paused.
- `src/xr/XrBackgroundSettings.ts` (pure data) owns the player choices: quality Performance
  640x360 / Balanced 768x432 (default) / High 960x540, update rate 24 Hz (default) / 36 Hz, and
  Line stroke (default 1, the historical XR value). A quality change rebuilds the one plane.
- While playing, `WormholeBackdrop` redraws on a fixed whole-frame divider of the display cadence
  (`ceil(displayHz / rate)`: 72 Hz -> every 3rd / 2nd frame) instead of drifting 2/3-frame gaps;
  paused and seek frames always reach the source. The headset cadence is `XRSession.frameRate`
  (72 when unreported); the desktop preview assumes its 60 Hz cap.
- Foveation rises from 0.3 to 0.5. `?xrDiagnostics=1` publishes the last redraw's CPU time
  (`data-xr-background-ms`).
- Next step (iteration-2 plan T7): move the raster into a dedicated worker on `OffscreenCanvas`
  (done: Addendum G).

## Addendum G: off-thread Wormhole rasterization (2026-10-03)

Canvas2D rasterization of the real identity took ~13 ms per redraw on a desktop CPU, on the same
thread as the XR frame loop, so a redraw could cost a headset frame. The background now
rasterizes in a dedicated worker.

- `src/visuals/wormholeRender.worker.ts` hosts one `WormholeCanvasSource` (unchanged identity,
  tuning, plan consumption and preset fetches) on `OffscreenCanvas`. `Canvas2DRendererBackend`
  and the source accept an injected surface factory; the DOM canvas stays the default.
- `src/visuals/WormholeWorkerSource.ts` implements `CanvasVisualSource` on the main thread. Each
  `render` presents the newest finished frame zero-copy (`ImageBitmap` into a `bitmaprenderer`
  canvas, which `WormholeBackdrop` uploads as before) and requests the next. The frame carries its
  own focal point, so the track bend always matches the image shown.
- While playing, a request targets the song time at which its frame will be shown (one host
  interval ahead); a frame slower than the interval is shown one interval later, never queued.
- `CanvasVisualSource` gains two optional host callbacks: `onFrameReady` (a frame arrived outside
  `render`, so an idle desktop host renders once more) and `onError` (a failure after preparation;
  the controller reports it and turns the background off). `lastRenderMs` reports the worker's
  raster time for `?xrDiagnostics=1`.
- `src/xr/main.ts` selects the worker when `Worker`, `OffscreenCanvas.transferToImageBitmap` and a
  `bitmaprenderer` context exist, otherwise the in-thread source; `?xrBackgroundThread=main` forces
  the in-thread source for A/B comparison.
- Protocol, generations, copy/transfer and termination rules: see
  [worker communication](../governance/worker-communication.md#wormhole-render-worker-xr-background).

## Addendum H: one settings description, scoped changes and per-viewer persistence (2026-10-03)

The iteration-2 features add many player settings, and the in-VR menu (plan T10) must show the same
ones as the desktop drawer. Settings are therefore described once, as data.

- `src/xr/XrSettings.ts` owns `XrSettings` (`generation` + `background`) and `XR_SETTINGS`, one
  descriptor per setting: section, label, control (segmented choice or range), `read`/`write`
  against the settings object, and a **scope**:
  - `chart`: regenerate from the captured analysis and rewind (Difficulty, Activity, Variation,
    hands, zones -- unchanged Addendum D behaviour);
  - `session`: keep the chart, swap the gameplay configuration and rewind (reserved for note speed,
    saber length and play space, plan T3/T8);
  - `presentation`: apply live without touching chart, score or playback (background quality,
    update rate, Line stroke).
  A change set is handled by its strongest scope. `resolveGameConfig(settings)` derives the
  `RhythmGameConfig`; with today's settings it returns `DEFAULT_RHYTHM_GAME_CONFIG`, so the golden
  default chart is unchanged.
- `XrCommandDrawer` renders its settings sections from `XR_SETTINGS` and reports
  `onSettingsChange(settings, scope)`; it decides nothing. `XrAppController` routes by scope.
- `RhythmGameSession.setConfig` swaps the configuration between runs only (refused while playing;
  resets runtime state, keeps the chart). `RhythmGameScene.setGameConfig` updates note placement and
  floor travel; the note pool keeps its construction capacity. Desktop picking uses the same config.
- `src/xr/XrSettingsStore.ts` persists one versioned localStorage record
  (`plexus.xr.settings`, version 1) per viewer. It is a convenience, not session state: reads are
  normalized, unknown versions and corrupt records fall back to defaults, and reads/writes never
  throw. Saves happen on player changes only (never per frame) and skip unchanged values. The
  composition root injects the storage; no other XR module touches `window`. The MVP checkpoint
  contract (session-persistence governance) does not apply to this record.

## Addendum I: note speed, saber length, reach-derived stage and runway length (2026-10-03)

Players touched targets that the judge could not sense yet: the early "good" window covered only
0.44 m beyond the hit plane at 4 m/s, while a 0.9 m saber reaches ~1.6 m. The stage is now derived
from a reach model (`src/xr/XrPlayProfile.ts`, pure):

- Session-scope settings (Addendum H): note speed Normal 4 m/s / 2.0 s, Fast 7 m/s / 1.6 s,
  Hyper 10 m/s / 1.4 s; saber blade Short 0.9 / Normal 1.0 (default) / Long 1.1 m.
- Reach = shoulder offset (-0.08) + arm (0.62) + blade base (0.10) + blade + lean (0.10). The hit
  plane distance P satisfies reach + half a target <= P + early window x speed, clamped to
  0.85-1.20 m; any remainder widens `RhythmGameConfig.earlyGoodWindowSec` (new, default equal to
  `goodWindowSec`). The judge accepts early strikes up to that window and late ones up to
  `goodWindowSec`; perfect stays symmetric. Default profile: P 1.20 m, early window 0.175 s.
  Every judged target lies inside the straight track zone (< 2.5 m), for every combination.
- Runway length = P + spawn distance + 2.5 m, rounded up to whole 2 m floor tiles, at most 18 m
  (12 / 16 / 18 m). Targets grow and brighten over their first 1.5 m. `XrTrackPath` re-aims its far
  tangent for the actual runway end; the single background plane at 40 m is beyond every runway.
- `XrStageLayout` (hit plane, runway front, spawn fade) is the player-dependent part of the stage;
  `DEFAULT_STAGE_LAYOUT` is the historical stage that scenes start from. `RhythmGameScene.setStageLayout`
  rebuilds the runway once and moves the playfield; `XrInputAdapter.setBladeLength` changes the
  drawn blade and the judged tip together.
- The chart is always built with `DEFAULT_RHYTHM_GAME_CONFIG`: these settings change judging, travel
  and the stage, never the chart, so a change rewinds without regenerating. The golden default chart
  is unchanged.

## Addendum J: dramaturgy-weighted scoring (2026-10-03)

The score rewards the musical structure. `src/gameplay/RhythmScoring.ts` (pure) builds a scoring
plan once per chart from the chart and the analyzer's published sections, which `XrAppController`
passes to `RhythmGameSession.loadChart(chart, sections)` as plain data.

- Section weight in [1, 2] = 1 + 0.5 x label factor + 0.5 x demand. Label factors: intro / break /
  outro 0, verse 0.2, build 0.4, drop 0.8, peak 1. Demand = target density scaled by the share of
  arrows, pairs, crossings and row jumps, relative to the track's most demanding section.
- A hit earns perfect 100 / good 50 x combo multiplier x section weight (rounded). The multiplier
  climbs 1 -> 2 -> 4 -> 8 after 2, 4 and 8 consecutive hits; a miss drops one tier.
- A section finished without a miss earns 25% of its base points (100 per note) x weight; all
  perfect adds another 25%. The maximum score assumes every note perfect, so accuracy =
  score / maximum, and the rank is SS >= 95%, S >= 90%, A >= 80%, B >= 65%, otherwise C.
- Without published sections there is one neutral section (weight 1, no bonuses), so the first hit
  is still worth 100. Seek and restart reset the whole ledger; notes skipped by a seek count as
  missed for their section without touching the multiplier.
- The snapshot gains optional `multiplier`, `maxScore` and live per-section results (`sections`:
  hits, perfects, misses, points, bonus, completion time) for the HUD and the T5 displays. The HUD
  shows the multiplier; the finish instruction shows the rank and accuracy.

## Addendum K: song structure and score displays (2026-10-03)

The player sees where the song is, how it is built and how the score is going, without a panel.
`XrAppController` passes `buildScoreOverview(scoringPlan, duration)` (plain data) to the scene;
both displays are pure functions of canonical song time and the session snapshot.

- **Song map** (`XrSongMap`, playfield space under the start frame): one segment per section,
  width proportional to its duration, height growing with its score weight; the played part lit,
  the rest dim, plus a playhead. One caption line shows the current section, its weight (e.g.
  "x1.6") and a flawless diamond (filled while the section has no miss); when a section completes
  with a bonus it flashes "<SECTION> CLEAR / FLAWLESS +points" for 2.5 s. The strip canvases are
  drawn once per chart; per frame only a scale, a position and a texture repeat change; the
  caption redraws only on quantized changes.
- **Progress ring** (`XrProgressRing`, floor at the player's origin, replacing the static reticle
  arcs; the orientation ticks remain): one additive shader draw. Outer band: the timeline (section
  arcs clockwise from straight ahead, played arcs lit, playhead). Inner band: each completed
  section fills its arc to its accuracy (gold flawless, section colour clean, dark missed). Side
  arcs: the combo multiplier, four steps per side. Only uniforms change per frame; at most 32
  sections are drawn (the last arc absorbs any overflow).
- The HUD keeps its position; it moves with the taller play space (plan T8).
- Note: the in-app browser pane's screenshots can show the WebGL view shifted after the drawer
  closes; a direct canvas read-back shows the frame is correct (a capture artifact, not a render
  defect).

## Addendum L: section gates on the runway (2026-10-03)

Every section after the first sends a gate down the runway so the player feels the next part
coming, the same way targets arrive. `XrSectionGates` (playfield space) is a pure function of
canonical song time and the shared overview (Addendum K):

- A gate is the start frame's corner-bracket outline (identical half-extents 0.835 x 0.635 m, so
  it docks onto the callout frame) in the next section's colour, with "<SECTION> xweight" on its
  header rail. It spawns one approach time before the boundary and travels at note speed
  (z = (songTime - sectionStart) x speed), so it reaches the start frame exactly when the section
  begins; the callout's arrival animation then takes over and the "NEXT" countdown is unchanged.
- No fill; the outline stays > 0.15 m outside every lane and row, so no target is hidden. Gates
  shear with the shared track path, emerge over the stage's spawn-fade distance like targets, and
  their label fades over the last 1.2 m so it never overlaps the start frame's caption.
- At most two gates show (the nearest boundaries). Cost: one instanced bracket draw plus one label
  draw per visible gate; labels come from a fixed 32-row atlas drawn once per chart (the GPU texture
  is never resized; sections past row 32 get an unlabeled gate).

## Addendum M: the Tall play space (2026-10-03)

The player can open the play space upward with real overhead swings. A new **Play space** setting
(Gameplay section, chart scope, `RhythmGenerationSettings.playSpace`) chooses Standard (the
historical stage; the default chart stays byte-identical) or Tall.

- **Rows.** Tall widens the row spacing to 0.40 m (`playSpaceConfig`, the one source for chart
  generation, rendering and judging) and adds an overhead row 3: with the middle row 0.55 m below
  the eyes, the rows sit at eye -0.95 / -0.55 / -0.15 / +0.25 m.
- **Choreography** (`liftOverheadTargets`, pure, deterministic). After the score planner, a few
  targets are re-voiced to the overhead row; timing, hands, lanes and cuts never change. Only on a
  big moment (a drop / peak scene or the top of a build, judged by the scene's texture family, not
  the member a phrase developed into), an onset at or above its phrase's median on a beat (top
  quarter when the grid is unreliable), a downward or free cut (an overhead chop), never in the
  center lane. Rare: one bar between overhead moments, two bars per hand. The hand has at least
  0.5 s to prepare and a mandatory rest of at least 0.75 s (one beat) after; when its next single
  targets fall inside the rest they are left out (at most two, and only if cut parity and reach
  still hold). Reach and row steps use the difficulty's envelope, with one row of stroke credit
  (an upward cut before ends high; the chop itself ends a row lower); after a 1.5 s rest only
  travel counts. Both hands go overhead together only on a horizontal accent pair at Hard and
  above (top-quarter onset); on vertical / diagonal pairs the upper hand may.
- **Stage.** The start frame grows to the rows (inner -0.66 .. 1.06 m, same 0.26 m margin); the
  hit gate gets a fourth row tick; the callout frame, section gates and song map follow it
  (`XrStageLayout.frameCenterYMeters / frameHalfHeightMeters / rowCount`). The score HUD moves
  beside the runway (left, 1 m past the hit plane, turned toward the player, scaled 0.72) so the
  overhead row and the taller caption keep the space above the runway.
- **Saber.** A new **Auto** blade length follows the play space: 1.0 m in Standard, 1.1 m in Tall.
  The reach model (Addendum I) then places the start frame as for any blade.
- Changing the play space regenerates the chart from the captured analysis (no re-analysis) and
  applies the new stage, configuration and blade; playback rewinds.
- The optional "Arena" step (wider lanes, side targets) is deferred until Tall is accepted on a
  headset.

## Addendum N: Ultra difficulty (2026-10-03)

A fifth Difficulty, **Ultra**, sits above Expert. Same timing windows (decision K5); energy / fail
states are deferred. It is a difficulty profile like the others (`RhythmDifficultyProfile`), so
only published onsets ever become targets.

- **Demand.** Global floor 0.6 -> 0.45 x (0.1125 s), same-hand floor 0.75 -> 0.55 x (0.22 s), hand
  travel 5/3 -> 2.2 x, density ceiling 0.5 -> 0.3 x, hard-move chains 4 -> 6, crossing propensity
  2.4 -> 3. Sixteenths therefore fit only where the music has them and the floors allow them (up to
  ~133 BPM); eighth runs are the core. Single targets are always directional (no breathing dots);
  a pair may still free a cut whose reversal would collide the sabers.
- **More two-hand accents.** Every hand pattern gets Together's accent windows at twice their
  length (two bars on impact / drive); the preparation gap before a pair is 0.5 s instead of 0.8 s.
- **Structured pauses.** Calm scenes (the breath family: intro, breakdown, transition, outro) keep
  Normal density; a dense run (gaps under 0.9 beat) lasts at most four bars, then a beat of rest;
  and before every published section change there is a silence of two beats (one at slow tempos,
  beat > 0.5 s), which coincides with the section gate (Addendum L) docking. The host passes the
  analyzer's section starts as plain data (`RhythmChartSource.sectionStarts`); every other
  difficulty ignores them, and the profiles below Ultra carry neutral structure fields, so their
  charts are unchanged.
- **Measured.** On a sixteenth-rich 128 BPM fixture Ultra is ~+55% over Expert (drop 3.6 -> 5.8
  targets/s) with a sparser intro; at 100 BPM +15% (Expert already reaches sixteenths); at 140+
  BPM no further onset fits the floors, so density stays comparable and Ultra's demand is hand
  speed, pairs, crossings, directional runs and the structure. On eighth-only material Expert is
  already saturated.

## Addendum O: in-VR menu and the tabbed desktop menu (2026-10-03)

The game is now fully playable from inside the headset; the browser is only needed to load music.

- **Shared model.** `src/xr/XrMenuModel.ts` (pure: no Three.js, no DOM) defines the screens, their
  layout on a 1024 x 704 canvas and what each item does. Settings come from the one settings
  description (`XR_SETTINGS`, `XR_SETTING_SECTIONS`, Addendum H), so the VR menu and the desktop
  drawer list the same settings in the same tabs and order; finished-song results use one
  formatter (`formatResults`) on both.
- **Screens.** Main (track ready: Start, Settings, Exit VR), Pause (Resume, Restart, Settings,
  Exit VR), Results (rank, accuracy, points, max combo, hits / misses, flawless sections; Play
  again, Settings, Exit VR) and Settings (Gameplay / Choreography / Background tabs; choices as
  segmented buttons, ranges as a - value + stepper in tenths; the hovered option's hint, noting
  when a change restarts the song). Back always returns to the screen the session state implies.
- **VR panel** (`scene/XrMenuPanel`): one canvas texture on a 1.28 x 0.88 m plane, placed 1.3 m in
  front of the head (0.12 m below the eyes) when it opens, drawn without depth test over the
  frozen stage, redrawn only when the displayed state changes. Rays are hit-tested analytically
  (front side only).
- **Input.** The menu is open whenever an immersive session is not playing. Sabers hide and
  controller lasers appear (`XrInputAdapter.setPointerMode`), sized to the hit distance; the hand
  that last pulled its trigger leads hovering; hovering ticks the controller; the trigger chooses
  the item that hand points at (a trigger at nothing does nothing). Grip pauses the song and
  opens Pause; inside Settings it goes back. A thumbstick flick switches Settings tabs.
- **Settings in VR.** Every scope is allowed in the headset: chart-scope changes regenerate from
  the captured analysis (the immersive lock is removed), session changes rewind, presentation
  applies live; the desktop drawer mirrors each change.
- **Desktop drawer.** Settings sections are tabs (WAI-ARIA tab pattern, arrow / Home / End keys);
  the Wormhole switch moved into the Background tab; how-to-play text folds into a "How to play"
  disclosure; a results line appears when a song ends, and the drawer opens on pause and on the
  song's end (it still closes when play starts).
- Not in this step: a Comfort tab (recentering, arm-length calibration), a resume countdown, and
  the Wormhole on / off switch inside VR.

## Addendum P: a sharper Wormhole in the headset (2026-10-03)

The single background plane spans ~106 x 74 degrees, so even High (960 x 540) gives ~9 px per
degree against a ~20 px/degree Quest 3 eye buffer: the texture is always magnified, and its fine
lines read soft.

- **Ultra raster** 1280 x 720 (~12 px/degree), drawn off the main thread like the others (Addendum
  G); about 1.8x High's raster and upload cost, so it is a choice, not the default.
- **GPU sharpening** (Visuals > Sharpness, 0-100, default 50, live): the plane's material samples the
  texture with a halo-limited unsharp mask -- centre + gain x (centre - mean of the four texel
  neighbours), clamped to the neighbourhood's min/max so edges steepen without bright or dark
  rings. Five texture fetches, no extra pass, no redraw or upload; 0 is the plain sample. Measured in
  real WebGL at 4x magnification: a hard edge's ramp narrows from four pixels to two or three.
- Further headroom (not done): a higher WebXR framebuffer scale sharpens everything, including the
  background, at a GPU cost that should be measured on the headset first.

## Addendum Q: note designs and the slice effect (2026-10-03)

- **Note design** (Visuals tab, presentation scope, `XrSettings.appearance`, persisted): Classic
  (chamfered block + arrow / dot glyph) or Shard: an asymmetric diamond crystal whose long tip
  points along the cut (local +Y onto the judge's `CUT_VECTORS`, like the arrow glyph) with a
  glowing cut line on its front ridge; free cuts are slowly turning symmetric gems. The same three
  instanced draws swap geometry in place; positions, judging, chart and score are unchanged.
- **Slice effect** (`XrSliceEffect`): a struck target is no longer flashed by the note field; it
  splits along the cut plane into two halves (the target's own geometry, halved) that drift apart
  across the cut, follow through along it and keep a third of the note speed toward the player,
  white-hot cooling to the hand colour while fading, plus ten sparks fanned along the cut with
  gravity. A pure function of song time and `resolvedAt` (pause freezes, seeks are exact), 0.32 s,
  at most 12 concurrent slices from preallocated pools: two additive instanced draws.
- *Update (2026-10-05, XR performance pass):* the note and slice pools stream their instance
  buffers (`DynamicDrawUsage`, colour buffers preallocated) and flag only the drawn prefix for
  upload (`src/xr/scene/InstanceUploads.ts`); an empty batch uploads nothing. On a dense
  synthetic chart this cut instance uploads from ~25.5 KB to ~2 KB per frame (Node count of what
  three.js would send, not a headset measurement).
- *Update (2026-10-05, XR performance pass):* slice halves and sparks move on the GPU. The CPU
  still decides which hits are live (chart order, at most 12) and writes event-scope instance
  attributes only when that set or its inputs change: hit origin (through the track path), hit
  time relative to a write epoch, cut frame and side, the hashed spark direction / speed / drift
  and the hand colour. `SLICE_HALF_GLSL` / `SLICE_SPARK_GLSL` evaluate separation, follow-through,
  carry, gravity, rotation, scale and fade from one song-time uniform; instance matrices are no
  longer written. Instance data is rebuilt from canonical session state, so seeks stay exact. A
  WebGL transform-feedback check against the former CPU matrices measured at most 4.3e-6 m and
  2.7e-8 colour difference.
- The settings tab formerly titled "Background" is now "Visuals" (target style + Wormhole); DOM
  control names keep the `xr-background-` prefix.

## Addendum R: authored XR Wormhole defaults and the Visual character controls (2026-10-03)

- **Authored defaults.** `XR_WORMHOLE_BOOSTS` (src/config/xrWormholeTuning.ts) now carries the
  user's XR values: Nebula amount 0.5 with detail, bloom and weave 1, spiral 0.04 (arms 0.5), grain
  density 0.5, grain shape 1, line alpha 1, line weight 0.98 (also the Line stroke default), Post FX
  fragment 0. The XR host is the only consumer; MVP and dashboard tuning are untouched.
- **Cost (measured, desktop, off-thread, same song window).** The Nebula raster is no longer
  bypassed: one background redraw went from 6.1 ms median / 7.5 ms p90 (High) to 31.6 / 39.7 ms,
  and Ultra to 31.7 / 42.9 ms, so the background refreshes ~5-8 times per second instead of the
  requested 24 even on a desktop CPU (the worker keeps the main thread and judging smooth). The
  Quest's CPU is slower; reducing the Nebula's raster cost in XR is the obvious next step.
- **Visual character in the menu.** The MVP's four macro sliders (Intensity, Motion, Depth, Detail;
  50 = neutral) are player settings (`background.character`, presentation scope, persisted),
  defaulting to the host's authored macros (100 / 100 / 30 / 100). They reach the source through
  `CanvasVisualPresentation.macros` (worker included); a change snaps the tuning (no musical
  morph) and redraws a paused canvas. The Wormhole on / off switch is a setting too
  (`background.wormhole`, off by default; a background failure turns it off and saves that).

## Addendum S: the game menu lives in the canvas, on the desktop too (2026-10-03)

- **One menu.** Settings, pause and results exist only in the canvas game menu (Addendum O's
  `XrMenuModel` / `XrMenuPanel`), in the headset and on the desktop. Tabs: Gameplay, Choreography,
  Visuals, Character. The HTML track panel keeps only what must be HTML: the native file picker,
  Play / Resume and Enter VR (both need a real user gesture) and their status lines.
- **Desktop.** The panel floats in front of the page camera at the headset distance. It opens on
  the title screen, on pause and at the song's end, with Escape or the gear button next to the
  track-panel button (pausing a playing song), and closes when play starts. Games' conventions:
  the mouse hovers and a left click chooses (clicks never cut while it is open); arrow keys move
  a visible focus (left / right past a row's end flip the tab), Enter chooses; Escape goes back
  from Settings, resumes from Pause and otherwise closes. Space still plays / pauses; keys in form
  controls keep their own meaning. Tab is left to the page, so the track panel's file picker and
  buttons stay reachable from the keyboard while the menu is open. No Exit VR item on the desktop;
  footer hints describe the input in use.
- **Accessibility trade-off.** A canvas menu has no accessibility tree: screen readers do not
  read the settings, pause or results screens that Addendum O's WAI-ARIA tabbed drawer exposed.
  What remains accessible is the HTML track panel (labelled file input, Play / Resume, Enter VR,
  live status and error lines) and the labelled gear button with `aria-expanded` and
  `aria-keyshortcuts`. Keyboard play is complete (Escape, arrows, Enter, Space). An announced
  focus (a live region naming the focused item) is the next step if screen-reader use matters.
- Supersedes Addendum O's tabbed desktop drawer; the shared settings description and the
  per-browser store are unchanged, so every setting -- including Play space, Ultra, Note design,
  quality Ultra, Sharpness, Wormhole and the Visual character -- persists like its siblings.

## Addendum T: authored player defaults (2026-10-03)

A first visit (no stored record) now starts from the user's authored menu values instead of the
historical game:

| Tab | Setting | Default |
| --- | --- | --- |
| Gameplay | Play space / Note speed / Saber length | Tall / Hyper / Long |
| Choreography | Difficulty / Activity / Variation | Ultra / Active / Expressive |
| Choreography | Hands / Lead / Zones | Alternate / Even / Crossover |
| Visuals | Wormhole / Note design | On / Shard |
| Visuals | Background quality / update | Ultra / 36 Hz |
| Visuals | Line stroke / Sharpness | 34 / 100 |
| Character | Intensity / Motion / Depth / Detail | 100 / 100 / 10 / 100 |

- **Where they live.** The /xr/ host owns its player defaults: `DEFAULT_XR_GENERATION_SETTINGS`
  (`src/xr/XrSettings.ts`), `DEFAULT_XR_PLAY_SETTINGS`, `DEFAULT_XR_APPEARANCE_SETTINGS` and
  `DEFAULT_XR_BACKGROUND_SETTINGS`. Line stroke and the Visual character stay one authored set with
  the source's starting tuning (`XR_WORMHOLE_BOOSTS.lineWeight` 0.34, `XR_WORMHOLE_MACROS.depth`
  0.1), which supersedes Addendum R's 0.98 / 0.3. Every other authored Wormhole value is unchanged.
- **The gameplay library keeps its historical defaults.** `DEFAULT_RHYTHM_GENERATION_SETTINGS`
  (Normal, Balanced, Paired, Split, Standard) is unchanged, so the pinned default chart
  (`tests/fixtures/xr-chart-default-golden.json`) is byte-identical. `normalizeGenerationSettings`
  takes the host's defaults as an optional second argument; the XR host passes its own, so a
  missing or invalid field falls back to the XR default.
- **Stored records win.** A browser that already saved settings keeps them (every saved record
  is complete); only fields missing from an older record take the new defaults. Choosing the
  values again, or clearing the site's data, returns to the defaults.
- **Cost.** These are the heaviest presentation values: the Wormhole on at the 1280 x 720 raster,
  36 Hz requested, the Nebula on (Addendum R's measurement: ~32 ms per redraw on a desktop CPU,
  so the background updates well below the requested rate) and full sharpening. Judging is
  unaffected (the worker keeps the main thread free). If the headset run shows a choppy background
  or frame drops, Balanced / 24 Hz remains one menu choice away; the Quest checklist records it.
- Tests: `tests/xr-settings.test.mjs` pins every default against the table above; the controller,
  scene and store suites check a first visit end to end. Mechanics tests (menus, scopes, pacing,
  regeneration) start from a fixed historical baseline (`tests/helpers/xr-historical-settings.mjs`)
  so they do not depend on the shipped defaults.

## Addendum U: background profiling for headset runs (2026-10-04)

A beat-locked keyframe mode ("Beat blend": keyframes on the beat grid, rendered ahead and blended on
the GPU) was built on 2026-10-03 and reverted the next day: on the Meta Quest 3 it ran worse than
rendering every update (most likely because blending doubled the texture reads of the largest
surface on an already GPU-bound headset). Before the next optimization the cost must be measured
where it matters, on the headset, per stage.

- **Stages.** `CosmicWormholeIdentity.setStageClock` (opt-in, null by default, output-neutral; a test
  compares the drawn lines and raster composites with and without it) times the background layers,
  the grain loop (lines plus Nebula carrier accumulation), the weave, the Nebula resolve (bloom /
  haze) and the three-layer composite. `WormholeCanvasSource({ profile })` adds its tuning / director
  work (`tune`) and the identity total; the render worker adds the bitmap transfer (Canvas2D may
  defer raster work until then).
- **Transport.** Only with `?xrDiagnostics=1` (since Addendum X also with Settings > System >
  Diagnostics On): the worker `init` carries `profile: true` and frames
  carry optional `stages` (additive, protocol 1); normal runs neither time nor send anything.
- **Readout in the headset.** `BackgroundDiagnostics` averages two seconds of play into one line --
  display rate, background frames shown per second and their raster ms, the quality and rate in
  use, then the stage times -- shown on the game menu's main and pause screens (and mirrored on
  the overlay's `data-xr-background-stages`). Pausing ends a window without a summary.
- **First desktop reading** (synthetic 128 BPM track, Ultra / 36 Hz, worker): the weave varied from
  2.8 to 14.4 ms between song sections and was the largest stage in the drop; grains 3.6-5.3,
  layers 3.1-3.4, resolve 1.0-1.7, composite 0.4-0.8, transfer 0.2-0.3 ms. So the Nebula's cost is
  not mainly the blur but the weave and the per-grain carrier work, and it depends on the music.
- **Next step** decided from Quest readings: moving the Nebula material (carrier accumulation,
  weave, resolve) to the GPU in the main WebGL context, with the worker sending only the carrier
  list. Multiple workers were rejected (duplicated simulation, cross-worker state drift, no
  SharedArrayBuffer on GitHub Pages, faster thermal throttling on the headset); a WebGL / WebGPU
  context inside the worker was rejected (same physical GPU, a second context and a copy back).

## Addendum V: the MVP Grain material sliders in the game menu (2026-10-04)

- **What.** A fifth settings tab, **Material**, holds the MVP Advanced tuning panel's whole "Grain
  material" group (`ADVANCED_BOOST_GROUPS`): Grain material, Material detail, Material bloom,
  Material weave, Spiral twist, Spiral arms, Grain density -- the MVP labels and order, 0-100 with
  50 = neutral gain on what the preset authors (the MVP Advanced boost semantics, exactly like Line
  stroke). A test pins the tab to the MVP group, so a key added there must be added here too.
- **Defaults** are the authored XR boosts (`XR_WORMHOLE_BOOSTS`, Addendum R): 50 / 100 / 100 / 100
  / 4 / 50 / 50, one authored set with the source's starting tuning.
- **Plumbing.** `background.grain` (presentation scope, persisted with every other setting in
  `plexus.xr.settings`) reaches the source as `CanvasVisualPresentation.grainMaterial` (boosts by
  tuning key, through the worker unchanged). The source accepts only the seven Grain material keys,
  clamps to [0, 1], and applies a change directly (no musical morph), redrawing a paused canvas.
  Setting ids are prefixed (`grainAmount` ...) to stay unique across tabs.
- The Character tab's Detail macro still scales the same family (macro -> clamp -> Advanced order,
  as in the MVP). These sliders are the knobs to try against the profiling line (Addendum U):
  Material detail and weave are the expensive ones.

## Addendum W: the grain material renders on the GPU (2026-10-04)

**Problem.** On the Meta Quest 3 any grain material (any Grain material / detail / weave setting
above zero) dropped the frame rate. The material was a CPU raster inside the background worker:
every carrier evaluated per covered raster pixel (up to 1024) with three or four integer-hash value
noises, then a resolve, two bloom gathers with recursive smoothing and three full-canvas 'lighter'
composites. That fixed cost starts the moment the material is on, whatever its detail, and the
worker competes with the main thread for the headset's CPU.

**Decision.** The background keeps simulating the Wormhole and drawing its lines on the CPU; the
grain material moves to the GPU in the main WebGL context.

- **Shared per-carrier setup.** `prepareWormholeGrainCarrier` (src/visuals/wormholeGrainMaterialRaster.ts)
  now holds the per-carrier part of `accumulateWormholeGrainCarrier`, which runs it and then the
  unchanged per-pixel law. The split is byte-identical (4000 random carriers compared against the
  previous implementation: 0 differing values), so the MVP's CPU material is exactly as before.
- **Carrier output.** `CosmicWormholeIdentity.setMaterialSink` (opt-in, null by default): with a
  sink, a material frame hands every grain and weave carrier to it -- the same carriers, in the
  same order, as the CPU deposits (tested) -- and requests no CPU raster, resolve or composite; line
  work is identical. `GrainCarrierCollector` packs the prepared constants (24 floats per carrier,
  `src/types/GrainMaterialFrame.ts`); `WormholeCanvasSource({ externalMaterial })` exposes them as
  `materialFrame`, and the render worker transfers an exactly sized copy with each frame.
  *Update (2026-10-05, XR performance pass):* the copy now goes into a buffer from a bounded pool
  (at most three) that the host transfers back after copying the carriers (`release-material`), so
  steady play allocates no carrier arrays on either thread (browser check: 48 frames of ~3900
  carriers, ~370 KB each, cycled through 2 buffers). See worker communication.
- **GPU rendering** (`src/xr/scene/GrainMaterialRenderer.ts`): instanced capsule quads evaluate the
  per-pixel law in GLSL 3 (the integer hash and value noises operation for operation) into a
  half-float L0 with additive blending; full-screen passes resolve L0 (premultiplied), gather L1 /
  L2 with the CPU's emission-weighted means and smooth them with separable Gaussians of the CPU
  filters' variance (sigma 3.46 / 6.12 texels). The passes run in the backdrop plane's
  onBeforeRender (the three.js Reflector pattern: XR camera handling off, render target, clear
  state and viewport restored), once per new background frame. The backdrop shader adds the three
  layers in sRGB space and clamps, as Canvas2D 'lighter' did.
- **Fallback.** Used when the renderer can render to half-float targets (`supportsGpuGrainMaterial`);
  otherwise, or with `?xrMaterial=cpu` (A/B comparison; replaced by Settings > System > Material
  renderer in Addendum X), the worker keeps the CPU raster. The diagnostics line names the path
  ("GPU material" / "CPU material").
- **Measured** (desktop, Ultra 1280 x 720, real worker and WebGL): GPU vs CPU image mean absolute
  difference 0.16 / 255 with no pixel above 16, material brightness 95% of the CPU's; the
  background's CPU time per frame fell from ~26 ms (weave 14.4, grains 5.3) to 8.4 ms (weave 0.2,
  blur / composite 0) in the drop; the GPU passes cost ~0.7 ms per new background frame. Quest
  numbers are pending (the GPU share is larger on a mobile GPU, but only on frames with a new
  background image).

## Addendum X: Material renderer and Diagnostics switches in Settings > System (2026-10-04)

**Context.** On the Meta Quest 3 the GPU grain material (Addendum W) holds an enjoyable frame rate
with any Material setting (user reading, 2026-10-04). The CPU path and the profiling line were only
reachable through URL flags, which a headset player cannot type comfortably.

**Decision.** A sixth game-menu tab, **System**, holds two presentation switches, saved in the
per-viewer record (`plexus.xr.settings`, still version 1: the new `system` group is optional and a
record without it takes the defaults):

- **Material renderer** -- GPU (default) / CPU. GPU applies where the renderer supports it
  (`supportsGpuGrainMaterial`); elsewhere the CPU raster runs and the diagnostics line says
  "CPU material". It replaces the `?xrMaterial=cpu` flag, which is removed.
- **Diagnostics** -- Off (default) / On. On profiles the background's stages and shows the
  two-second line of Addendum U on the menu's main and pause screens (and its overlay mirrors).
  Off measures nothing. `?xrDiagnostics=1` still forces it on (and keeps the runtime's canvas
  counters for automation) without changing the saved switch. Switching it drops the previous line
  and the overlay mirrors, so nothing stale is shown.

**Mechanics.** `src/xr/XrSystemSettings.ts` holds the pure group (normalized: unknown values take
the defaults). Carrier output (`externalMaterial`) and stage profiling (`profile`) are fixed when a
background source is created (worker `init`), so the controller hands the scene one *background
pipeline* (`RhythmGameScene.setBackgroundPipeline({ gpuMaterial, profile })`) and a change rebuilds
an existing background plane exactly like a Background quality change (re-prepared from the
captured analysis; the chart, score and playback are untouched). Before the first background the
pipeline is only recorded. The worker protocol is unchanged.

## Addendum Y: optional Crystal background quality (2026-10-05)

**Context.** The player asked for a crystal-clear Wormhole that can be chosen from the game menu.
The plane is 106 x 60 m at 40 m, so it spans ~106 x 74 degrees, and a flat plane's texel density
rises toward its edges (1 / cos^2 of the view angle). Ultra (1280 x 720) gives ~8.4 px/degree
straight ahead, against a Quest 3 eye buffer of ~20 px/degree: the image is magnified.

**Decision.** A fifth Background quality, **Crystal**, rasterizes at 1920 x 1080: ~12.6 px/degree
straight ahead (1.5x Ultra's line detail). It is optional and listed last; the default stays Ultra
(Addendum T). The menu hint first recommended 24 Hz with it on Quest 3. The headset showed no
frame-rate cost, and Addendum Z's cadence fitting covers late frames, so the hint no longer does.

- 2560 x 1440 was rejected. At ~16.9 px/degree straight ahead it would exceed the eye buffer off
  axis (beyond ~25 degrees), so the unmipmapped `LinearFilter` texture would be minified and its
  thin lines would shimmer. It would also upload 14.7 MB per background frame. (Addendum Z later
  adds it as the optional, mipmapped Max quality.)
- **Measured** (desktop Chromium, real app, GPU material, the same track section): worker raster
  8.5 ms at Crystal vs 7.6-8.4 ms at Ultra. A direct per-size benchmark gave 7.4 / 7.8 / 8.5 / 9.8 ms
  for 1280 / 1600 / 1920 / 2560 widths. The GPU grain material grid is a fixed pixel budget
  (`resolveWormholeGrainMaterialRasterSize`), so it does not grow with the raster.
- **Main-thread copy.** None on desktop: `ImageBitmap` to texture is a GPU-side copy. The cost moves
  to the headset GPU: 8.3 MB per new background frame (2.25x Ultra), plus the Canvas2D fill. On
  the Quest these share the GPU with the XR frame; 24 Hz caps that work. Quest numbers are pending.
- **Mechanics.** No new setting group or protocol. `XrBackgroundQuality` gains `crystal`, and a
  saved choice survives normalization. Switching to Crystal rebuilds the one plane like any other
  quality change. The sharpening texel size follows the canvas.

## Addendum Z: background cadence that fits the worker, cheaper strokes, and Max quality (2026-10-05)

**Context.** On the Quest 3, Crystal cost no frame rate. The diagnostics line, however, read 72
display fps against ~18 background fps at most settings, and Grain density moved the background
rate more than anything else.

**Why 18.** The background only receives a new request on its whole-frame redraw ticks (Addendum
F): at 36 Hz on a 72 Hz display, every second frame (27.8 ms). A worker frame that takes longer
than one tick misses the next one and is shown on the tick after, so any worker time between 27.8
and 55.6 ms yields exactly 72 / 4 = 18 fps, and the worker idles for the rest of the interval.
The display stays at 72 because the raster is off the main thread (Addendum G).

The worker's time hardly depends on resolution: desktop raster 7.4 / 7.8 / 8.5 / 9.8 ms for 1280 /
1600 / 1920 / 2560 widths. It does scale with Grain density, which activates 1-4 copies of the
360-grain field, each grain stroked in Canvas2D. A frame strokes ~2750 lines; without them the
worker's draw time fell by ~40% (desktop).

**Decision.**

- **Cadence that fits.** `WormholeWorkerSource` measures the request -> frame latency
  (`CanvasVisualSource.frameLatencyMs`, smoothed). `WormholeBackdrop` widens its divider to the
  smallest whole number of display frames the latency fits (plus 2 ms slack). It never goes below
  the requested rate, and it narrows only with 15% headroom. A worker slightly slower than 27.8
  ms now runs at 24 fps instead of 18, still on a steady whole-frame phase. The proxy also
  calibrates its presentation lead to the song-time delay at which frames are actually shown.
  This corrects the ~1 interval by which late frames lagged the music. Neither feeds gameplay or
  the song clock.
- **Cheaper strokes.** `Canvas2DRendererBackend` (used only by the XR Wormhole) sets one opaque
  `strokeStyle` per colour and carries stroke alpha in `globalAlpha`, instead of a fresh `rgba()`
  string per line. Fills, gradients, field rasters and the frame clear draw at alpha 1. An
  out-of-range alpha clamps like `rgba()` would. An A/B on the same frames was pixel-identical
  (max difference 0) and cut the worker's recording time 5.5 -> 4.4 ms (density 0.5) and 6.2 -> 4.4
  ms (density 1); full frames 8.2 -> 7.0 and 9.1 -> 7.4 ms (desktop).
- **Max quality** (2560 x 1440, ~16.9 px/degree straight ahead) is listed after Crystal. It
  exceeds the eye-buffer density beyond ~25 degrees off axis, so its plane texture alone is
  mipmapped (`XR_BACKGROUND_MIPMAPPED`; trilinear, regenerated with each new background frame).
  The centre is magnified and unchanged.
- The diagnostics line names the paced rate and latency, e.g. `36 Hz paced 24 Hz, 31 ms latency`.

Quest numbers are pending. The expected effect is a higher background rate at the same density,
or a higher density at the same rate.

*Update (2026-10-05, Quest 3 reading):* the display frame rate dropped noticeably with these
changes in the headset. More background frames per second means more GPU work, and that work
competes with the XR frame: the Canvas2D raster in the browser's GPU process, the upload, the
GPU material, and with Max the mipmap chain. Adaptive cadence is therefore opt-in: Settings >
System > **Background pacing**, Fixed (the pre-Addendum-Z behaviour, default) / Adaptive (live).
The cheaper strokes stay; they never exceed the requested rate, and 24 Hz caps the background's
GPU work.

## Addendum AA: GPU grain trail lines (2026-10-05)

**Context.** Grain density multiplies the grains (1-4 copies), and each grain also strokes a
Canvas2D trail line: the part of the line-to-material crossfade that is not material. A
1920 x 1080 frame strokes ~1845 background lines plus 311 (one copy) to ~1240 (four copies)
grain trail lines. On the headset, those anti-aliased strokes are rasterized by the browser's GPU
process on the same GPU as the XR frame.

**Decision.** An opt-in Settings > System > **Grain lines**: Canvas (default) / GPU. GPU needs the
GPU material (Addendum W); with the CPU material the lines stay on the canvas. A change rebuilds
the background plane, like the Material renderer.

- **Producer.** `CosmicWormholeIdentity.setLineSink` (only with a material sink, only on material
  frames): the crossfade strokes go to the sink instead of the backend. The identity's other lines
  are unchanged, and so are frames without material. `GrainLineCollector` stores exactly what
  `Canvas2DRendererBackend` would have used (`GrainLineFrame`, 9 floats per line). Colour is
  rounded and clamped like a CSS colour, alpha clamped like `rgba()`, with the backend's minimum
  width and the frame's cap shape. Transparent strokes are skipped.
- **Transport.** The worker is told at `init` (`externalLines`). The lines travel right after the
  carriers in the frame's pooled buffer (Addendum W / pool), so they are transferred once and
  returned with it. The proxy exposes `lineFrame` with the material's lifetime. Additive, protocol
  version 1.
- **GPU.** `GrainLineRenderer` runs in the backdrop plane's onBeforeRender, once per new
  background frame, in two steps:
  1. One instanced quad per line goes into an RGBA8 target. Coverage is capsule (round cap) or
     box (square cap) distance with a one-pixel ramp; sub-pixel widths fade like a hairline.
     Lines are composited premultiplied source-over in record order, in sRGB-encoded values, as
     Canvas2D blends.
  2. A composite pass lays the re-encoded canvas under them into an sRGB target at canvas size.
     It carries Max's mipmaps when chosen.

  The plane samples that target where it sampled the canvas, so sharpening and the GPU material
  apply on top exactly as before. The per-display-frame cost is unchanged.
- **Measured** (desktop Chromium, real WebGL, 1280 x 720, five frames of a real track): image mean
  absolute difference against the CPU-stroked canvas 0.000-0.037 / 255. Fewer than 0.1% of channel
  values differ by more than 8. On line pixels the mean difference is 0.3-3.3 against a mean line
  contribution of 3.4-43.
  - Synthetic strokes (widths 0.3-7) match in total energy within 0.99-1.05. Square caps differ
    by ~0.5 per touched pixel. Round caps differ by 2-3 because Skia shapes the cap end
    differently.
  - Cost (1920 x 1080, four copies): the line pass plus composite take 0.4 ms of GPU time per new
    background frame (timer query). The canvas raster falls from 7.3 to 6.4 ms, and the worker's
    recording time is about unchanged (4.4 vs 4.2 ms). The worker-side gain is small on a desktop.
    The point is the headset GPU's Canvas2D stroke raster, which Quest numbers must confirm.

## Addendum AB: a slow background frame is playback, not a seek (2026-10-05)

**Context.** During XR playback the Wormhole centre sometimes jumped to its next position instead
of gliding there during an automation transition. This showed up with Crystal / Max and Addendum Z.
`WormholeCanvasSource.render` treated any playing step longer than 0.25 s (or backward) as a seek.
It then put the tuning on its target at once and called `identity.syncPosition`, which rebuilds the
integrated route converged on the final bend. With the worker, one slow background frame on the
Quest produces exactly such a step in normal playback. The per-frame lead calibration (Addendum Z)
adds to the step, so the effective threshold fell to ~0.2 s. Reproduced in Node: one 0.3 s frame in
the middle of a 0 -> 0.8 turn resynchronized the route, and the bend went 0.719 -> 0.800 in one step.
The desktop request sequence had no backward requests; the lead alone never makes them go back.

**Decision.**

- **One rule** in the source contract: `isContinuousPlaybackStep(songStep, wallStep)` in
  `src/types/CanvasVisualSource.ts`. A playing step is uninterrupted playback when song time
  advanced by about as much as the wall clock (`CONTINUOUS_PLAYBACK_TOLERANCE_SEC` = 0.1 s) and by
  at most `CONTINUOUS_PLAYBACK_MAX_STEP_SEC` (1 s). A seek moves song time with no wall time
  passing. The wall clock only classifies the step. Positions always come from the song clock (no
  second song clock).
- **Proxy.** `WormholeWorkerSource` classifies each playing request against the previous one, using
  host song time and the wall time between the requests. A continuous request carries
  `continuous: true` (additive, protocol version 1), and its time is never earlier than the previous
  request's. Pauses, the first frame after a pause or a preparation, and seeks are never continuous.
- **Source.** `CanvasVisualSource.render(songTime, playing, continuous?)`. A continuous step is never
  a jump: the tuning morphs over the real step (`applyTuningMorph` composes exponentially, so one long
  step equals the frames it replaced) and the route keeps integrating, in sub-steps. The worker always
  passes a boolean. An in-thread caller that omits the flag gets the same rule, applied to the
  source's own wall clock since its last drawn frame. Steps that are not continuous keep the
  historical rule (backward, or more than 0.25 s, is a seek). The change therefore only removes
  resynchronizations of real playback.

`tests/xr-wormhole-continuity.test.mjs` covers this:
- a slow frame mid-transition equals uniform playback, with no route resync;
- seeks, restarts, backward steps and steps over 1 s still resync;
- the in-thread wall-clock classification;
- the proxy flags and monotonic request times;
- the worker forwarding the flag.

## Addendum AC: the Wormhole spatial field (2026-10-11)

**Context.** The Wormhole is a distant image. The player stands on a runway in real space, but
nothing of the tunnel reaches that space, so the background reads as a screen rather than a place.
The goal: the tunnel's energy continues into the room around the route, while the 2D Wormhole stays
dominant at distance and gameplay stays readable and untouched.

**Decision.** A decorative, opt-out spatial field (`src/xr/scene/XrWormholeSpatialField.ts`) driven
only by the displayed background frame. It is never gameplay: it does not hit-test, does not judge,
and does not touch the chart or the session.

- **Data seam.** `CosmicWormholeIdentity.frameDrive` records what a drawn frame actually used: the
  travel in horizons, the canonical travel rate, the coherent spiral in turns (0 without the grain
  material it conditions), the grain hue and colour, and the depth-haze colour.
  It is write-only and changes nothing in the identity's output. `resolveWormholeSpatialFrame`
  (`src/visuals/wormholeSpatialFrame.ts`) turns that, plus the source's morphed `state.visualTuning`,
  into a plain-data `WormholeSpatialFrame` (`src/types/`). The fields are presence, occupancy, radius,
  depth, the projected tube spread, the spiral turns, turbulence, streak, wisp, colours and transients;
  all are finite and clamped. The resolver reads tuning values, never preset names or semantic
  metadata, and no XR module reads `State`.
- **Worker synchronization.** The record travels with its frame: in thread through
  `WormholeCanvasSource.spatialFrame`, off thread as the frame's structured-cloned `spatial` field
  (additive, protocol version 1). The proxy adopts it only when it presents that frame, like the
  focal point. `CanvasVisualSource.spatialFrame` therefore always describes the image on screen.
  `WormholeBackdrop.spatialFrame` is null while the background is off, not ready, or hidden.
- **The 2D grain law, in real depth.** A 2D grain is released on the tube wall at the tunnel's far
  end and approaches at normalized depth u (1 at release, falling by exactly one per horizon of
  travel). It appears `tubeSpread / u` canvas heights from the vanishing point, and the backdrop
  shows a canvas height across height / distance of tangent (`BACKDROP_TAN_PER_HEIGHT`). So the
  grains emerge on a circle of tangent `BACKDROP_TAN_PER_HEIGHT x tubeSpread` that follows the
  Wormhole's radius and depth, and they race outward as 1 / u toward the edges. A spatial entity
  released at distance d0 on that circle (radius tangent x d0 around the route) and placed at
  d0 x u, with the grains' own u (`XrSpatialFlights`), appears on exactly the same circle at
  release, flows at the image's speed and accelerates toward the edges exactly like it. It then
  passes beside and behind the player (u < 0).
- **Spiral.** The coherent twist is the image's own: the frame's spiral turns times forward progress
  (1 - u), live as in the 2D image and continued between frames by `XrFrameSignal`. The image's
  angles grow clockwise on the canvas (y down), so the field mirrors them for its y-up space: both
  turn the same way on screen. Each particle adds its own flow current (signed by its seed), fixed
  per flight.
- **Particles (one draw).** 80 fixed seeds in one `THREE.Points`. A release samples the circle, the
  release distance and occupancy once, into a dynamic `aRelease` attribute (distance, radius, flow,
  shown; written only when a particle restarts). The particles' u (80 floats) is uploaded per frame
  from double-precision travel. A particle in flight never sways with the music; brightness, colour
  and streaks follow the displayed frame live.
  - Release distances lie between 0.25 x and 0.8 x the backdrop distance (at least 12 m), in front of
    the plane. The radius stays between the 2.4 m clearance (outside the start frame, the note
    corridor and the rails) and 16 m. Where it can, the release keeps the along-route speed
    (distance x travel rate) under 30 m/s. A tunnel too narrow for the clearance at any distance in
    range releases nothing.
  - Streaks are the particle's own recent path, as long as the 2D grain trails (streak x 2/24 s of
    travel), bounded at 0.9 m and 40 px. Points are capped at 22 px.
- **Wisps (at most one more draw).** Eight instanced, camera-facing soft quads: the Nebula's soft
  volume, carried by the same law. They are released on the same circle, 4.4-12 m from the route, and
  turn with the same spiral plus a slow drift of their own. They dissolve between 18 and 8 m ahead of
  the player and fade below the runway floor's level. Peak opacity is 0.12, toward the Wormhole's haze.
  They are shown by the soft-volume (Nebula / weave) tendency, and each quad hugs its ellipse, so no
  fill is wasted. With no tendency, every quad collapses to a point while the draw stays submitted,
  so the shader never compiles mid-song.
- **Time authority.** Song time only, with no new clock. `XrFrameSignal` (`src/xr/scene/`) continues
  a value of the displayed frame to the song time being drawn. It extrapolates along the frame's
  rate or the slope between frames, bounded (0.25 s for travel, 0.1 s for the spiral and the focal
  point), and crossfades into each new frame over 60 ms of song time. Travel never steps back
  between fresh starts. Pause holds the field. A seek (any step back, or a jump over 1 s), a hidden
  field, or a moved backdrop releases every particle anew from the current frame, so the same song
  time and frame give the same placement after any seek. So does a restart: the old playthrough's
  stale frame stays on screen until the first new frame arrives, and that frame is older and its
  travel lower. A frame older than the last one, or a travel drop of more than 1.5 horizons (beyond
  any extrapolation overshoot), starts the flow over from it. Otherwise the field held the old,
  larger travel and froze until the song caught up. `XrFrameSignal` likewise treats an older frame as
  a seek, so the runway's focal point does not blend from the stale one either.
- **Path authority.** `XrTrackPath` remains the single curve. Past the runway the route continues
  along its far-end tangent (`trackBendWeightExtended` and its GLSL twin
  `TRACK_BEND_EXTENDED_GLSL`), which by construction reaches the focal point on the backdrop while
  the runway's bend is unsaturated. The runway's bend saturates for comfort (2.4 m lateral, 1 m
  vertical), so a focal point near the image's edge (a role whose centre sits low, or a hard turn)
  would leave the tangent far short of it. A far-aim remainder (`uTrackFarAim`, weight
  ((d - end) / (backdrop - end))^2: zero value and slope at the runway's end) carries the rest, so the
  extension always lands on the focal point at the backdrop. Like the 2D tunnel's centre line, the
  field's centre turns toward the vanishing point with depth. Gameplay never uses the extension. The runway's focal point passes through `XrFrameSignal` too: a
  raw focus that steps at 24-36 Hz bent the runway, and everything on it, in visible steps.
- **Background distance.** Visuals > Background distance is 40 / 100 / 200 m (default 200). The plane
  scales with its distance, so the image keeps its angles, raster density and fill. The track's far
  tangent re-aims at the moved plane, and the field's release distances follow it. The camera far
  plane is 600 m.
- **Rendering layers.** Backdrop -100..-98, wisps -22, particles -20, floor -10, then the stage
  linework. The field and wisps blend additively, test depth and never write it.
- **Disabled and fallback behaviour.** Settings > System > **Spatial field** is Off / Particles /
  Full (default Particles; stored with the background settings). Off means no draw at all. The field
  hides itself, with no draw, whenever:
  - there is no background frame (Wormhole off, not ready, hidden, or a source without spatial
    state);
  - the frame has no presence;
  - the song time or the travel is not finite.
- **Performance.** At most 2 draw calls, fixed buffers, no textures, and no per-frame JS
  allocation. Per frame the field writes uniforms and 88 depth floats, plus 4 floats for each
  particle or wisp that restarts (one upload per frame however many restart).
  Quest 3, with the background on the worker: 72 fps at Crystal 24 / 36 Hz with Spatial field Off,
  Particles and Full. Full showed about 3% timing-late frames where Particles showed 0%; this was
  accepted.

An earlier rare-ring layer was removed after the headset review (it did not belong to the image).
A first field moved at a matched speed from a fixed far end. The headset review found it turned the
wrong way, did not emerge from the image's circle, and its wisps stood still. It was replaced by the
grain law above.
- **Authored defaults (2026-10-11).** The user's setup is the new default:
  - Ultra / 36 Hz at 200 m, Line stroke 20, Sharpness 100;
  - Character 100 / 100 / 30 / 100;
  - Material 30 / 100 / 100 / 100, spiral 30, arms 50, density 50;
  - System: GPU material, Diagnostics on, GPU grain lines, adaptive pacing, WebGL background raster (Addendum AF);
  - Spatial field Particles (Full adds the wisps).

  Depth 30 makes every role's radius / depth fall between about 0.35 and 2.8, so the spatial depth
  reading spans log2 scale -2 to 3.5. Gameplay defaults are unchanged.
`tests/xr-wormhole-spatial.test.mjs` covers the seam: the resolver, the worker transport and the
presentation timing. `tests/xr-wormhole-spatial-field.test.mjs` covers the field:
- the grain law (circle, 1 / u acceleration, spiral direction against `wormholeGrainFlowAngle`) and seeks;
- the frame signal;
- clearances, layers and modes;
- streaks and wisps.

## Addendum AD: measuring and sharing a headset run (2026-10-11)

**Context.** A Quest report "drops to 56-65 fps with the Wormhole on" could not be explained from
the existing line. The cause turned out to be the A/B checklist URL `?xrBackgroundThread=main`,
which forces the background onto the main thread, and nothing on screen said so.

**Decision.** These are diagnostics only; nothing is measured while Diagnostics is off.

- The label names the background's thread: `worker`, or `MAIN THREAD (<reason>)`. The reason is
  the URL switch or the missing capability (`wormholeWorkerUnsupportedReason`).
- `Main ms bg a/m, other a/m`: the main-thread cost (update plus render call), split between display
  frames that showed a new background frame and the others.
- `late N% (bg x%, other y%)`: display intervals over 1.5 nominal frames, split by the kind of frame
  that ran long. A late share at a full display rate is timing jitter, not a lost frame.
- `GPU ms a/m`: `EXT_disjoint_timer_query_webgl2` around the render call (`GpuFrameTimer`), polled
  without stalling, with disjoint results dropped. The Quest Browser exposes no timer, so the line
  then reads `GPU ms n/a (no timer)`.
- Settings bar: **Copy settings** copies every setting as the menu shows it, plus the exact JSON.
  **Copy diagnostics** copies the line followed by the same settings report. Each copy uses the
  Clipboard API, falling back to the copy command; when both are blocked, the text goes to the
  console. The outcome replaces the hint line until the next menu action.
- **Reset defaults** returns every setting, Diagnostics included, to its authored default after a
  second click; any other choice cancels it. Gameplay changes restart the song as usual.

`tests/xr-background-diagnostics.test.mjs` and `tests/xr-menu.test.mjs` cover these.

## Addendum AE: background passes before the eye pass (2026-10-11)

In the headset, fast-moving sabers juddered now and then with the Wormhole on, and never with it
off. The display rate and the main-thread costs stayed clean (72 fps, late 0%). The judder is the
signature of a headset frame the GPU finished too late: the compositor shows the previous frame
again, the head motion is reprojected, but the controllers stop for a frame.

On a frame that brings a new background, the backdrop uploads the 1920 x 1080 canvas (Crystal) and
runs its off-screen passes: the line composite (Addendum AA) and the material layers (Addendum W,
about eight passes). They ran inside the plane's onBeforeRender, that is, in the middle of the
headset's eye pass. On Quest's tiled GPU, each switch away from the eye framebuffer stores its tiles
to memory and loads them back afterwards, which is a large extra cost on exactly those frames.

- `WormholeBackdrop.prerender(renderer)` uploads the new canvas (`initTexture`) and runs the line
  and material passes. The host calls it after the scene update and before the render, while the
  frame's XR target is bound but not yet drawn (`RhythmGameScene.prerender`, called from the
  controller's frame).
- The plane's onBeforeRender stays as a fallback for a host that skips `prerender`. Each pass runs
  once per new frame, so the eye pass then finds nothing left to do.
- Images and timing are unchanged: the same passes run on the same frame, just earlier.
- The desktop GPU timer brackets only the scene render, so these passes no longer count toward its
  GPU ms.

**Background raster (follow-up, same day).** The judder lessened but stayed, even at Performance
quality, 24 Hz and every Character and Material slider at 0. The runway and the targets stopped
together with the sabers, so whole headset frames were missed. With everything that runs on the
headset GPU per frame already minimal, the remaining suspect is the worker's own canvas. A Chromium
OffscreenCanvas 2D context is GPU-accelerated by default: its strokes are recorded in the worker
but replayed on the browser's GPU thread, the same thread that runs the headset frame's WebGL
commands. Each background redraw therefore competes with the headset frame there, and the worker's
measured milliseconds do not show it.

- Settings > System > **Background raster**: GPU (default, the earlier path) or CPU.
  - CPU creates every drawing surface's 2D context with `willReadFrequently: true`, which keeps it
    in software. The worker then rasterizes on its own thread, and the headset GPU only receives the
    finished image through one texture upload.
  - The option travels as the additive `init.softwareRaster` (still protocol version 1). It also
    applies to the in-thread source.
  - Changing it rebuilds the background plane, like the other System switches. Reset restores GPU.
- The diagnostics line names the raster (`CPU raster` / `GPU raster`). With the CPU raster the
  worker's stage times include the real raster cost.
- **Headset result:** the CPU raster judders *more* often, and with the GPU raster the judder does not
  grow from the lowest to the highest background resolution. So the raster's amount of work is not
  the cause, and GPU stayed the default (until WebGL replaced it, Addendum AF). CPU remains as a
  comparison option. The cause still open is
  a fixed per-update cost: the frame's hand-off from the worker to the headset's WebGL context.

**Upload ahead (follow-up).** Until now a worker frame waited until the redraw slot. There it was laid
on the `bitmaprenderer` canvas, and that canvas was re-uploaded into the one texture the previous
headset frames had been sampling, inside the headset frame. Both the cross-context hand-off and the
re-specification of a texture still in use can make the GPU wait, whatever the resolution.

- The worker proxy keeps a received frame as `stagedImage` (with `stagedSerial`; `shownSerial`
  names the frame presented). These are optional `CanvasVisualSource` members; the protocol is
  unchanged.
- When the frame arrives (`onFrameReady`, a worker message, between headset frames), the backdrop
  uploads the ImageBitmap straight into the one of two raw textures that is not shown, and calls
  `flush`. The browser then runs the upload before the next headset frame instead of inside it.
- When `render` presents that frame, the backdrop switches the line composite to that texture and
  uploads nothing in the headset frame. The canvas still receives the bitmap (zero copy), and a frame
  that could not go ahead takes the canvas path as before. This applies, for example, to the first
  frame (before a renderer is known) or while the plane is hidden.
- WebGL ignores the flip and premultiply unpack flags for an ImageBitmap. So the composite reads the
  raw texture flipped back and un-premultiplied in the encoded bytes, which is exactly what the
  canvas texture holds. In Chromium the two paths differ by at most 1 / 255 per channel.
- Scope: GPU grain lines only, the default. Only the line composite reads the canvas with
  `texelFetch`; the plane's own filtered sampling keeps the canvas path.
- The diagnostics line says `upload ahead` when the frame on screen came this way.

**Passes ahead (follow-up).** The upload ahead made the judder rarer, but not gone. The line
composite and the material layers still ran inside the headset frame that presented a frame, and
they rendered into the very targets the previous headset frames had been sampling.

- Both renderers are double-buffered when the backdrop works ahead (`doubleBuffered`). The line
  composite has two outputs. The material has two sets of its sampled layers (resolved L0 and
  smoothed L1 / L2, each with its blur spare); the carrier accumulation stays shared. `render`
  draws into the one not shown, and `present` shows it. A material set is shown only once it has
  been rendered; a frame without material switches the material off at presentation.
- When a frame arrives, the backdrop also takes the staged frame's lines and carriers
  (`stagedLineFrame`, `stagedMaterialFrame`, copied synchronously), renders the composite and the
  layers, and flushes once.
- Presenting it switches the plane to the new composite, the material uniforms to the new set (the
  layer uniforms follow the set shown) and the material switch to that frame's. In the headset
  frame nothing is uploaded, rendered or re-specified.
- The fallback (canvas path) renders into the target not shown and presents it immediately. Single
  buffering (without ahead) behaves exactly as before.
- In Chromium the composites and the material layers of both paths agree to within 1 / 255
  (composite) and bit for bit (layers).

**Right after a headset frame (follow-up).** The judder became much rarer. What remained followed the
Background quality: none at the lowest quality, rare at the highest. That is the resolution-bound
ahead work (upload, composite, material). It ran at the moment the frame arrived, which is random
relative to the headset frames, so it could land just before one and delay it.

A tried fix queued the work right after the next headset frame (a `MessageChannel` task). It put
off a redraw slot by one display frame whenever its frame was not prepared yet. In the headset it
juddered more, even at the lowest quality. Adaptive pacing sizes the cadence so that frames arrive
just before their slot, so nearly every slot was put off, and the background cadence became uneven.
It was reverted: the work runs again the moment a frame arrives, which measured best.

**What the measurements show (Ultra, OVR Metrics Tool).** 72 fps, 0 stale frames, GPU utilization
27 %, app GPU time 2.3-2.5 ms of the 13.9 ms budget, CPU utilization 43 %, CPU / GPU clock level 2.
The FPS graph still dips now and then. So the headset GPU is far from its budget, and the remaining
hitches are not GPU load. Two readings the line could not show were added to it:

- `max N ms`: the longest display interval of the window, after the late share. A hitch shorter
  than the 1.5-interval late threshold now shows too.
- `ahead a/m`: the main-thread ms of the work done when a frame arrives, listed with Main ms. It
  runs between display frames, so the frame costs never included it.

`tests/xr-gpu-lines.test.mjs` covers the order: upload, then the passes, nothing inside the eye
pass, and nothing on frames without a new background. `tests/xr-wormhole-worker.test.mjs` covers
the raster option from the proxy to the surfaces; `tests/xr-gpu-lines.test.mjs` also covers the upload
and passes ahead (on arrival, flushed, double-buffered, nothing uploaded or rendered when presented,
fallbacks) and the proxy's staged frame; `tests/xr-gpu-material.test.mjs` covers the double-buffered
layers; `tests/xr-settings.test.mjs`,
`tests/xr-menu.test.mjs` and `tests/xr-controller-regeneration.test.mjs` cover the setting, its
default, its reset and the rebuild. The headset check (sabers, runway and targets smooth with the
Wormhole on, CPU against GPU raster) is in the Quest manual test.

## Addendum AF: a WebGL raster for the background (2026-10-11)

After Addendum AE the headset's own frames were clean, at Crystal and at Performance:
- the longest display interval stayed at 14.9-16.0 ms, so no frame was missed;
- the main thread spent 1-2 ms per frame;
- the GPU used 2.3-2.8 ms of the 13.9 ms budget (26-35 %);
- there were no stale frames.

Rare hitches were still felt, and at Crystal more than at Performance. What these measurements cannot
see is the browser's own GPU thread. A Chromium OffscreenCanvas 2D context records the worker's
strokes and replays them there one Skia operation at a time, thousands per Wormhole frame. That
thread also submits the headset's frames.

- `WebGLRendererBackend` (`src/visuals/`) implements the identity's `VisualRendererBackend` with
  WebGL2 on the same surface factory (an OffscreenCanvas in the worker). The identity's drawing
  code is unchanged.
  - Every line and filled circle is recorded in painter's order and drawn as one instance of one
    instanced draw. A filled circle is a zero-length round line as wide as the circle. Line
    coverage is `GrainLineRenderer`'s Canvas2D match: capsule or box, a one-pixel ramp, sub-pixel
    widths fading like a hairline.
  - A radial gradient, a ring tint, a field raster or a clear first draws the batch, so the order
    is kept. A frame takes a handful of draw calls.
  - Blending is premultiplied source-over on the stored (sRGB-encoded) values, like Canvas2D.
  - Radial gradients interpolate their stops unpremultiplied (concentric, padded).
  - `compositeRingTint` copies the frame drawn so far and applies the W3C blend formulas
    (saturation, overlay, screen, soft-light) without fixed-function blending, clipped to the
    angular wedge.
  - Field rasters (the CPU material) use the Canvas path's exact 8-bit pixels; the conversion is
    now the shared `writeFieldRasterPixels`. They are premultiplied on upload, filtered bilinearly,
    and blended source-over, `screen` (exact as ONE, ONE_MINUS_SRC_COLOR) or `lighter`.
  - Triangles and shapes, which the Wormhole does not use, fill without antialiasing.
  - The source calls `finish()` after the identity drew, which draws the batch and flushes.
- Settings > System > **Background raster** gains **WebGL**, the new default (user decision,
  2026-10-11). GPU, the Canvas2D path, and CPU stay selectable for comparison. Reset restores WebGL.
  - The option travels as the additive `init.webglRaster`. The worker reports what runs in
    `prepared.raster`, and the proxy exposes it as `rasterKind`. Both are protocol version 1.
  - `WormholeCanvasSource` falls back to Canvas2D when WebGL2 or its shaders are unavailable.
  - The diagnostics line says `WebGL raster`, or `GPU (no WebGL)` after a fallback.
  - Depth-layer planes, the MVP's, stay Canvas2D.
- The image leaves the worker as before: an ImageBitmap with its top row first, premultiplied. The
  upload ahead and the passes ahead (Addendum AE) take it unchanged.

Checked in Chromium on real Wormhole frames (galaxy, overdrive and collapse plans, 960 x 540), against
Canvas2D:
- with the XR pipeline (GPU material and lines), the mean difference was 0.04-0.06 / 255 per channel,
  with identical mean levels, and about 100 of 518 000 pixels differed by more than 24 / 255 (line
  edges);
- with the CPU material, the mean difference was 0.2-0.6 / 255;
- in the worker at 1920 x 1080, every frame arrived and the worker reported `webgl`.

In the headset the user judged it good and made it the default.

`tests/xr-webgl-backend.test.mjs` covers, against a recording WebGL double:
- the batching and its order, the records, and the Canvas2D state rules;
- the premultiplied clear, the ring tint's copy and blend, and the field raster's bytes and blend
  functions;
- the fallback, the worker's report and the proxy.

`tests/raster-conversion.test.mjs` keeps the shared conversion byte-identical to the frozen legacy
loop.

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
