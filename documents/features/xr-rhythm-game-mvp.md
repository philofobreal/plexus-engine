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
- Notes: 0.32 m cubes. Dots mean free cuts; arrows indicate blade travel, not the entry side.
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
for head tracking, but stationary note buffers are reused. The static runway is one instanced batch.

The optional **Wormhole background** checkbox uses the actual MVP CosmicWormholeIdentity,
not a substitute particle shader. It defaults off. Its macro settings are intensity=1, motion=1,
depth=0.30, detail=1; the user's updated Advanced positions live in
`src/config/xrWormholeTuning.ts`. These are normalized slider gains, not absolute effect values.
The shared resolver applies macros, control bounds, then Advanced gains/selectors to each live
preset. Nebula amount and Spiral are zero, lineWeight is 1; grain shape is square and all
three Post FX controls are zero. The material-on renderer remains covered by a separate fixture.

The default balanced/paired MVP journey, preset merge and semantic functions are reused with
private render state. No saved edits or playback state are imported from another page. The
original 2D image is projected behind the playfield; it is not a new stereoscopic tunnel. The
background has a separate 960x540 / 30 Hz maximum budget, with no repeated drawing or texture
uploads while paused, and no background work while disabled. Resolution and cadence differ
from a full-size MVP preview; parameter meaning and identity geometry are shared.

See [criteria](../acceptance-criteria/xr-rhythm-game-mvp-acs.md),
[delivery review and validation evidence](../audits/xr-rhythm-game-delivery-review.md), and
[Quest checklist](../audits/xr-rhythm-game-quest3-manual-test.md). No physical Quest, frame-time,
memory, or latency acceptance is implied by desktop or mocked-device tests.
