# XR rhythm game: spatial and desktop play

`/plexus-engine/xr/` is the independent Three.js/WebXR host described in
[ADR-009](../adr/ADR-009-xr-rhythm-game-host.md). All three hosts reuse the shared offline analyzer
and automatic cue-placement pipeline; their rendering and playback instances remain independent.
It is an implementation candidate, pending physical Quest acceptance.

## Controls

Choose an audio track, then Play or Space. On desktop, aim at the approaching block and
left-click blue / right-click pink when it reaches the hit markers. Space pauses/resumes;
Play becomes Restart after natural track end. Clicking an early or wrong-color block does
not score. The context menu is suppressed only on the game canvas. No pointer lock,
keyboard movement, or extra control mode is needed. Desktop clicks assist the arrow direction;
VR must follow it. Dot targets accept any direction, and gold glyphs identify a paired accent.

In VR, trigger starts/resumes/restarts and grip squeeze pauses. Physical blade movement
scores; trigger presses during play do not pause. Exit, hidden session, viewer tracking
loss, or reference-space reset pauses audio and clears motion history. Resume is explicit.
An immersive entry pauses desktop playback before relocating the stage.

## Spatial contract (meters)

- Stage: 3.4 m wide, from 10 m ahead to 2 m behind the starting player, at floor level.
- Hit plane: 0.85 m ahead. Horizontal lane centers: -0.45 / 0 / +0.45 m.
- Middle row: eye height minus 0.55 m, floored at 0.70 m. Low/high rows: +/-0.34 m.
  At 1.65 m eye height the rows are 0.76 / 1.10 / 1.44 m.
- Notes: 0.32 m chamfered target modules (exact cube bounds). Dots mean free cuts; arrows indicate blade travel, not the entry side.
- Sabers: 0.90 m blade, 0.18 m handle; blade spans grip-local Z -0.10 to -1.00 m.
- Notes approach at 4 m/s over 2 s. First two seconds contain no targets, without shifting
  music timestamps. Missed notes continue through the plane, underneath/behind the player.
- Viewer X/Z and horizontal facing determine initial placement on every VR entry or reset.
  Rendering and strikes share the inverse playfield transform, including yaw.

These are provisional design values, not measured ergonomic certification. The
[BSMG mapping guidance](https://bsmg.wiki/mapping/basic-mapping.html) motivates consistent
musical emphasis, readable distribution, and avoiding obstructed sightlines. Exact distances
and our event-to-row mapping are Plexus design choices. The
[WebXR input model](https://immersive-web.github.io/webxr/input-explainer.html) defines the
negative-Z grip axis used for both the rendered blade and collision samples.

## Deterministic chart policy

Only published BeatEvents create notes. The beat grid alone is intentionally insufficient:
the analyzer preserves timing through silence. Empty events produce an explanatory empty
chart, not metronome gameplay. The onset detector is unchanged; analyzer v5 corrects impact cue
publication and retains significant moments across the complete track.

With a Visual OS plan, the offline score uses the same automation points as the background.
See [musical choreography](xr-musical-choreography.md) for texture, pair and direction rules.
The same phrase planner runs when a plan is unavailable, using audible onset spacing. Timing
confidence no longer disables directions, and quiet/FX-heavy music still gets variations and
local accent pairs throughout its playable phrases. Type labels are not interpreted as snare
or hi-hat detection. High center notes remain excluded to preserve the incoming view.

Global spacing between onset groups is at least 0.25 s (a pair shares one onset), same-hand recovery at least 0.40 s. Requested row/lane
changes are reduced until same-hand target travel fits 1.2 m/s between accepted notes.
This is a target-transition budget, not an enforced physical swing speed. All choices derive
from sorted immutable events and accepted-note order; no RNG or frame history is involved.

## Timing, judging and lifecycle

AudioEngine.getCurrentTime() remains the sole song clock. `RhythmLayout.notePosition` supplies
identical coordinates to rendering and judging, including late travel beyond the hit plane.
Perfect <=80 ms; good <=110 ms; unresolved notes miss after 160 ms. The last interval provides
lifecycle grace rather than additional scoring. Calibration on Quest is still required.

VR strikes sweep nine points along the complete blade between valid frames, relative to
note motion, against a 0.22 m target radius. This bounded approximation handles fast tip and
mid-blade contact; it is not a rigid-body solver. The first sample after connect/resume,
tracking loss, or a frame gap over 100 ms cannot score. Desktop ray picking translates a
single button press into the same domain judge; its deliberate click replaces the physical
speed threshold and explicitly assists direction only for the ray-selected note. VR arrows
require at least 0.2 m/s of in-plane blade movement within 50 degrees of the arrow. Incoming
note motion cannot satisfy this test. Each note resolves at most once.

XrPlaybackBinding consumes audio state events once: seek resets the practice score/cursors;
position notifications do not reset again. Natural end resolves remaining notes and finishes
once; restart resets score and chart state. The XR composition opts into `loopPlayback:false`
and `heroMetronome:false` on AudioEngine without writing State. Dashboard defaults remain.
AudioEngine rejects superseded work after file reading, decoding, and worker messages.
The host disables file selection while decoding/analyzing and removes old game state on load.

## Rendering and validation boundaries

Three bounded instanced batches draw blocks, dots and arrows; no per-frame note meshes.
Hit flashes retain their actual strike position for 220 ms. HUD texture updates only when
its values change. The stage has no opaque hit wall, shadows, or post-processing.
72 Hz is requested only if specifically supported; otherwise the browser's choice remains.

Desktop drawing now stops after the final invalidated frame in idle, ready, paused and finished
states; resize, transport, load and the background toggle wake it as needed. Hidden desktop
tabs stop drawing. Playing is capped at 60 submissions/s and approximately 1920x1080 physical
pixels (DPR capped at 1.25); MSAA is disabled. XR keeps headset-driven submissions during pause
for head tracking, but stationary note buffers are reused.

Scene visuals (`src/xr/scene/`, decorative only, never gameplay geometry) use three static
draws plus the unchanged three note batches: `XrRunway` owns a procedurally generated
floor `DataTexture` (built once, never re-uploaded), one merged additive linework mesh
(rails, hit-plane floor line, calibration reticle) and one merged additive hit gate in playfield
space. Floor travel is `phase = frac(songTime * noteSpeedMps / tileLength)` written to the texture
offset, so seek reproduces the image, pause freezes it and nothing accumulates. Targets are one
unlit instanced batch whose chamfered geometry bakes per-face shading and a luminous front bevel,
multiplied by the hand colour. The HUD is a transparent instrument frame redrawn only on change.

The optional Wormhole is one world-anchored plane at 40 m (ADR-009 Addendum F; the three-plane 2.5D
mode of Addendum E is no longer used by `/xr/` because of its frame-time cost). Monocular depth cues
(strength 0.7 in XR, 0.6 in the MVP) thicken near grains and thin, dim and haze far ones. The game
menu's **Visuals** tab sets the raster (Performance 640x360 / Balanced 768x432 / High 960x540 /
Ultra 1280x720 default), the update rate (24 Hz / 36 Hz default, aligned to whole headset frames),
**Line stroke** (the MVP Advanced slider, default 34) and **Sharpness** (default 100). Uploads happen
only on changed frames.
Where the browser supports it, the background rasterizes in a dedicated worker on an OffscreenCanvas
and reaches the scene as a transferred `ImageBitmap` (ADR-009 Addendum G), so the headset frame loop
never waits for Canvas2D; otherwise the same source runs in-thread. Opened with `?xrDiagnostics=1`,
the game menu's main and pause screens show a two-second performance line -- display fps,
background fps and ms, and the background's stage times (tune, layers, grains, weave, blur, comp,
xfer) -- so the cost can be read inside the headset (ADR-009 Addendum U). The grain material
(Nebula) is rendered on the GPU from the worker's carrier list when the renderer supports
half-float targets (ADR-009 Addendum W); `?xrMaterial=cpu` forces the former worker raster for
comparison.

The **Gameplay** section sets note speed (Normal 4 m/s, Fast 7 m/s, Hyper 10 m/s default) and saber
length (0.9 / 1.0 / 1.1 m default, or Auto). The start frame's distance is derived from an average adult reach so
that everything the saber can touch is already judged (default 1.20 m with a 0.175 s early "good"
window); the runway lengthens with speed (12 / 16 / 18 m) and targets emerge from its far end
(ADR-009 Addendum I). These settings rewind but never change the chart.

Scoring follows the track's dramaturgy (ADR-009 Addendum J): each hit earns 100 (perfect) or 50
(good) x the combo multiplier (1/2/4/8x) x its section's weight (1-2, from the section's role and
measured difficulty). A section finished without a miss pays a bonus, all-perfect a second one. The
finish screen shows the rank (SS/S/A/B/C) and accuracy against the track's maximum.

Under the start frame a thin song map shows the track's sections (width = duration, taller =
more rewarding) with a playhead, the current section's weight, a flawless diamond and a short
"CLEAR / FLAWLESS +points" flash when a section completes cleanly. The floor ring at the player's
origin repeats the timeline clockwise from straight ahead, fills each completed section to its
accuracy (gold when flawless) and shows the combo multiplier on its side arcs (ADR-009 Addendum K).

Before every new section a gate in that section's colour, labelled with its name and score weight,
travels down the runway with the targets and docks into the start frame exactly when the section
begins (ADR-009 Addendum L).

The Tall play space (Gameplay > Play space) widens the rows and adds a rare overhead row a quarter
meter above the eyes on big moments (drops, peaks, the top of a build): reach up and chop down,
then the same hand gets a short rest. The start frame grows with the rows, the score display moves
beside the runway, and the Auto saber length becomes 1.1 m (ADR-009 Addendum M).

Ultra (Choreography > Difficulty) goes beyond Expert: faster hand moves, more two-hand accents,
always-directional runs and sixteenths where the music has them, but with structure: calm parts
stay relaxed, a dense run lasts at most four bars, and every section change is preceded by a short
silence while its gate arrives. Judging windows are the same as on every other difficulty
(ADR-009 Addendum N).

Inside the headset a floating menu runs the game: Start, Pause (grip), Resume / Restart, every
setting in the Gameplay / Choreography / Visuals / Character tabs, the results after each song, and
Exit VR. Point with a controller laser and pull the trigger; a thumbstick flick switches tabs
(ADR-009 Addendum O). The same menu is drawn on the desktop (see below).

Visuals > Note design switches the targets between Classic blocks and Shard crystals whose tip
points the way to cut; a struck target splits into two glowing halves with a burst of sparks
(ADR-009 Addendum Q). For a sharper Wormhole in the headset, Background quality Ultra
(1280 x 720) and Sharpness apply a GPU unsharp mask to the plane (ADR-009 Addendum P).

The game menu is drawn in the 3D view on the desktop as well (Escape or the gear button; mouse or
arrow keys + Enter): Gameplay, Choreography, Visuals (Wormhole on / off, note design, quality,
update rate, Line stroke, Sharpness) and Character (the MVP's Visual character: Intensity, Motion,
Depth, Detail). The HTML panel only loads music and starts play or VR (ADR-009 Addendums R, S).
The **Material** tab holds the MVP Advanced tuning panel's Grain material sliders (Grain material,
Material detail, Material bloom, Material weave, Spiral twist, Spiral arms, Grain density; 50 is
neutral, defaults 50 / 100 / 100 / 100 / 4 / 50 / 50), live and remembered like every setting
(ADR-009 Addendum V).

Every menu setting comes from one description (`src/xr/XrSettings.ts`, ADR-009 Addendum H) and is
remembered per browser (`plexus.xr.settings`). Game settings regenerate the chart and rewind;
background settings apply live, even mid-song.

A first visit starts from the authored player defaults (ADR-009 Addendum T): Tall / Hyper / Long;
Ultra, Active, Expressive, Alternate, Even, Crossover; the Wormhole on with Shard targets at Ultra /
36 Hz, Line stroke 34, Sharpness 100; Character 100 / 100 / 10 / 100. A browser that already saved
settings keeps its own values. The gameplay library's historical defaults (and the pinned default
chart) are unchanged.

The hit gate announces the musical section (`src/xr/scene/XrSectionCallout.ts`). It uses the
analyzer's published `TrackAnalysis.sections` with the MVP dramaturgy panel's labels and hues
(repeated labels are numbered, e.g. "DROP 2"), passed by `XrAppController` as plain data. One bar
before a boundary (4 beats, clamped to 1.2-3 s and to half the previous section) a caption strip on
the gate's top edge decodes "NEXT > <section>", four blocks count the beats down and an outer frame
pulses on each beat while its colour drifts to the new section's hue; on arrival the frame snaps
outward (ease-out-back, 0.6 s) and the caption decodes into the new name. Everything is a pure
function of song time (pause freezes, seek lands exactly); the caption canvas redraws only when its
quantized state changes (none while steady, a bounded handful per transition) and the frame is a
material colour/scale write. Cost: two draws (additive frame, caption strip). The caption sits below
the line of sight to the highest incoming row, and the in-VR HUD is raised to stay clear of it.

The track bends toward the Wormhole's apparent vanishing point. `CosmicWormholeIdentity` publishes
`routeFocus` (its horizon projection, the same one that places the lens center) through the optional
read-only `CanvasVisualSource.focalPoint`; XR never inspects pixels or re-simulates the route.
`src/xr/scene/XrTrackPath.ts` is the only curve: a lateral/vertical shear `A * u^2` of forward
distance, exactly zero closer than 2.5 m, saturating at 2.4 m lateral / 1 m vertical, with the far
tangent aimed at the focal point. Notes, floor and rails project through it; XR blade samples and
desktop picking un-project through it, so rendered and judged targets cannot diverge. Road length,
hit plane, gate, lanes and rows are unchanged. Floor/rail vertices are preallocated and rewritten
only when the path revision changes. With the Wormhole off the track is straight.

The **Wormhole** background (Visuals > Wormhole) uses the actual MVP CosmicWormholeIdentity,
not a substitute particle shader. It defaults on (ADR-009 Addendum T). Its macro settings are the
Character tab's sliders (intensity=1, motion=1, depth=0.10, detail=1 by default); the user's
authored Advanced positions live in `src/config/xrWormholeTuning.ts`. These are normalized slider
gains, not absolute effect values. The shared resolver applies macros, control bounds, then
Advanced gains/selectors to each live preset. Nebula amount is 0.5 (detail, bloom, weave 1), Spiral
0.04, grain density 0.5, lineWeight 0.34 (the Line stroke default); grain shape is square and all
three Post FX controls are zero (ADR-009 Addenda R, T).

The default balanced/paired MVP journey, preset merge and semantic functions are reused with
private render state. No saved edits or playback state are imported from another page. The
original 2D image is projected behind the playfield; it is not a new stereoscopic tunnel. The
background has a separate budget (player raster, 24/36 Hz frame-aligned), with no repeated drawing or texture
uploads while paused, and no background work while disabled. Resolution and cadence differ
from a full-size MVP preview; parameter meaning and identity geometry are shared.

See [criteria](../acceptance-criteria/xr-rhythm-game-mvp-acs.md),
[delivery review and validation evidence](../audits/xr-rhythm-game-delivery-review.md), and
[Quest checklist](../audits/xr-rhythm-game-quest3-manual-test.md). No physical Quest, frame-time,
memory, or latency acceptance is implied by desktop or mocked-device tests.
