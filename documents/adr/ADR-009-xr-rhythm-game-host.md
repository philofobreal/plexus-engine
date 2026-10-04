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

## Addendum C: Wormhole-facing track path (2026-09-27)

`CanvasVisualSource` gains one optional read-only field, `focalPoint` (normalized x/y, +y up). The
Wormhole identity fills it from its existing horizon projection; no renderer internals are exposed.
XR owns a single pure track-path projection (`src/xr/scene/XrTrackPath.ts`) applied after canonical
`notePosition()`; rendering projects through it and XR hit testing un-projects through it.
`src/gameplay/` is unchanged and remains renderer-independent.

## Addendum D: player generation settings (2026-09-27)

`buildRhythmChart` takes optional `RhythmGenerationSettings` (Difficulty, Activity, Variation, hand
pattern, hand lead, zones), pure gameplay data; defaults reproduce the historical chart byte-for-byte. Activity and
Variation keep their ADR-005 meanings and are also forwarded to `prepareWormholePerformance`, so the
shared plan and the Wormhole follow them as in the MVP. `XrAppController` regenerates from its
captured analysis snapshot under the existing load-generation token; it never re-analyzes.

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
- **Transport.** Only with `?xrDiagnostics=1`: the worker `init` carries `profile: true` and frames
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
- **GPU rendering** (`src/xr/scene/GrainMaterialRenderer.ts`): instanced capsule quads evaluate the
  per-pixel law in GLSL 3 (the integer hash and value noises operation for operation) into a
  half-float L0 with additive blending; full-screen passes resolve L0 (premultiplied), gather L1 /
  L2 with the CPU's emission-weighted means and smooth them with separable Gaussians of the CPU
  filters' variance (sigma 3.46 / 6.12 texels). The passes run in the backdrop plane's
  onBeforeRender (the three.js Reflector pattern: XR camera handling off, render target, clear
  state and viewport restored), once per new background frame. The backdrop shader adds the three
  layers in sRGB space and clamps, as Canvas2D 'lighter' did.
- **Fallback.** Used when the renderer can render to half-float targets (`supportsGpuGrainMaterial`);
  otherwise, or with `?xrMaterial=cpu` (A/B comparison), the worker keeps the CPU raster. The
  diagnostics line names the path ("GPU material" / "CPU material").
- **Measured** (desktop, Ultra 1280 x 720, real worker and WebGL): GPU vs CPU image mean absolute
  difference 0.16 / 255 with no pixel above 16, material brightness 95% of the CPU's; the
  background's CPU time per frame fell from ~26 ms (weave 14.4, grains 5.3) to 8.4 ms (weave 0.2,
  blur / composite 0) in the drop; the GPU passes cost ~0.7 ms per new background frame. Quest
  numbers are pending (the GPU share is larger on a mobile GPU, but only on frames with a new
  background image).

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
