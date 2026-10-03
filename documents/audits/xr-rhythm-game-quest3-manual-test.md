# XR rhythm game MVP: Meta Quest 3 manual acceptance test

Contract: [XR rhythm game MVP](../features/xr-rhythm-game-mvp.md) /
[acceptance criteria](../acceptance-criteria/xr-rhythm-game-mvp-acs.md). This checklist has not
been executed on physical Quest 3 hardware as part of this change; see the [delivery review](xr-rhythm-game-delivery-review.md) for
what was and was not validated. Record actual measured results here (device, Quest OS version,
Meta Quest Browser version, date) when a real headset run is performed -- do not mark an item
passed without having actually run it.

## Preconditions

- The build is served over HTTPS (or `https://localhost` via a trusted dev certificate) and
  reachable from the headset's network.
- `/plexus-engine/xr/` is opened as a top-level page in Meta Quest Browser, never inside an
  iframe.

## Checklist

1. Open the deployed `/plexus-engine/xr/` URL.
2. Confirm the page loads normally (launch screen visible, no error).
3. Confirm WebXR support detection succeeds (status text reads "supported").
4. Select a real audio file.
5. Confirm decode/analyzer progress text updates.
6. Confirm the chart is created (BPM/duration/note-count text appears).
7. Press Enter VR.
8. Confirm the immersive session starts.
9. Confirm headset tracking (view follows head movement).
10. Confirm both Touch Plus controllers connect (saber geometry appears on both grips).
11. Confirm left/right handedness is correct (left controller shows the left-hand color/lane).
12. Confirm saber geometry follows grip transforms with no lag/offset.
13. Start the game with a controller trigger.
14. Confirm music begins only once (no doubled playback).
15. Confirm notes approach without visible music drift over a multi-minute track.
16. Strike notes physically with the sabers.
17. Confirm correct-hand hits register.
18. Confirm wrong-hand attempts are rejected.
19. Confirm misses are registered for unstruck notes.
20. Confirm score/combo update and are readable in the in-VR HUD.
21. Confirm an optional haptic pulse on hit where the controller supports it.
22. Pause via grip squeeze; verify trigger during play does not pause.
23. Resume via trigger.
24. Restart via trigger from the finished state.
25. Confirm no duplicated notes/events after pause/resume/restart.
26. Confirm the track reaches a finished state at the end.
27. Restart after track end and confirm a clean replay.
28. Exit immersive mode during playback; confirm audio pauses and score remains.
29. Re-enter facing a different direction/position; confirm stage relocation, no phantom hit, and explicit trigger resume.
30. Confirm no duplicate render loops or duplicated controller listeners after the second entry
    (frame rate stays stable, inputs are not double-registered).
31. Load a second track.
32. Confirm no first-track game/chart state leaks into the second track's session.
33. Inspect frame rate/frame time on-device (Meta Quest Browser performance overlay or equivalent).
34. Verify the MVP sustains the 72 Hz target under normal chart load.

## Result log

| Date | Device/OS | Browser version | Result | Notes |
| --- | --- | --- | --- | --- |
| _not yet run_ | | | | |


## Spatial and stability acceptance additions

- Test a real 3-5 minute track; record peak memory, median/p95/p99 frame time, and actual
  refresh rate. Do not mark 72 Hz accepted based solely on a requested frame rate.
- At different eye heights, confirm all three rows are readable and reachable without
  stepping, excessive reach, or overhead swings. Measure input/audio offset before tightening windows.
- Confirm the runway extends underneath and behind the starting position; HUD does not
  obstruct targets and high center targets never occur.
- Test wrist-only rotation, rapid blade crossings, and mid-blade cuts; compare visual blade
  contact to score. Cover controller reconnect, hidden session and lost viewer/grip tracking.
- Recenter/reset reference space during play: audio pauses, stage relocates once, then
  trigger resumes without a spurious strike.
- Check the first 2 s lead-in, silent breakdowns, natural end with a final unresolved note,
  restart, failed load followed by successful load, and second-track replacement.
- Desktop: left/right mouse hit matching colors, wrong color/early click rejected, Space
  pauses/resumes, natural end enables Restart. Switching into VR pauses desktop playback.
- Musical score: compare intro/build/drop/release patterns with the Wormhole journey; confirm
  comfortable recovery across automation boundaries and the absence of invented targets in silence.
- Follow all eight arrow directions at 72/90/120 Hz where supported; reverse-direction and
  incoming-only contact must not score. Dots allow any direction. Check wrist and mid-blade cuts.
- Play horizontal, diagonal and vertically separated gold-glyph pairs. Confirm independent
  two-hand scoring, adequate preparation/rest gaps, no forced crossed blades and no target occlusion.

## Redesign, settings, callout and depth additions (2026-09-27)

Record results in the result log above; desktop results never substitute for headset runs.

- Presentation: runway motion comfort at 4 m/s (vection), shimmer on rails/reticle with MSAA
  off, HUD text legible at 2.8 m and ~13-22 degrees above eye height, target and arrow legibility at
  spawn distance, hit gate visible in peripheral vision without covering targets.
- Command drawer: opens by default, closes on play, Escape/keyboard focus behaviour, Enter VR
  still starts a session from the drawer, no desktop chrome visible inside VR.
- Track path: on bent presets (spiral, overdrive, galaxy) the far runway and targets curve
  toward the Wormhole center while targets inside reach never shift; vertical bend comfort.
- Game settings: Easy -> Expert is clearly felt; Expert remains physically playable; Crossover
  crossings never make sabers collide; Call & Response one-arm fatigue; Together pairs comfortable;
  changing settings rewinds and regenerates without reloading the track.
- Section callout: readable while slicing, countdown and arrival animation noticeable but not
  distracting, flash intensity comfortable.
- Wormhole background (single plane, ADR-009 Addendum F): stable 72 Hz with the Wormhole on at
  Balanced / 24 Hz; compare 36 Hz and High; Line stroke 0 / 50 / 100 visibly thin / neutral / thick;
  record `data-xr-background-ms` and GPU frame time per quality.
- Authored player defaults (ADR-009 Addendum T): on a browser without saved settings the game
  starts Tall / Hyper / Long, Ultra / Active / Expressive / Crossover, Shard targets with the
  Wormhole on at Ultra / 36 Hz, Line stroke 34, Sharpness 100, Depth 10. Record whether the default
  stays at 72 Hz with a smooth enough background; if not, note which of Balanced / 24 Hz / Nebula
  would have to change.
- Authored Wormhole defaults (ADR-009 Addendum R): with the Nebula on, the background's update
  rate in the headset (watch for a visibly choppy background) and whether judging stays smooth;
  Character sliders change the look live; Wormhole on / off works from the in-VR menu.
- Desktop game menu (ADR-009 Addendum S): Escape / gear open it (pausing), mouse hover + click and
  arrow keys + Enter work, Escape goes back / resumes, the HTML panel only loads music and starts.
- Wormhole sharpness (ADR-009 Addendum P): compare High vs Ultra and Sharpness 0 / 50 / 100 in the
  headset: lines read crisper without visible halos or shimmer; Ultra keeps a steady frame rate
  (watch for stutter in dense scenes; fall back to High if it appears).
- Note design and slicing (ADR-009 Addendum Q): Shard tips read as the cut direction at full
  runway distance and at Fast/Hyper speed; the cut line and gems are clear; every hit splits into
  halves with sparks that feel tied to the swing, never distracting from the next target.
- In-VR menu (ADR-009 Addendum O): on entering VR the menu floats comfortably in front of you and
  reads sharply; the lasers hit what you aim at (both hands), hovering ticks, the trigger chooses;
  Start, grip -> Pause, Resume, Restart, Exit VR all work; Settings tabs switch by laser and by a
  thumbstick flick; changing Difficulty or Play space in VR regenerates and rewinds without
  leaving the headset; the Results screen appears after the song; the sabers return when play
  starts and no stray cut happens while the menu is open.
- Ultra (ADR-009 Addendum N): on a few real tracks (slow, ~128 BPM, fast) Ultra feels clearly harder
  than Expert in drops and peaks, yet the breathers are felt: calm parts relax, long runs end, and
  the moment before each section gate arrives is quiet. No run feels physically impossible.
- Tall play space (ADR-009 Addendum M): with Play space = Tall, the overhead row is reachable with a
  comfortable stretch (not a jump) and only appears on big moments; the rest after it is felt; the
  four rows read clearly inside the taller start frame; the score display beside the runway is
  readable with a glance and never in the saber's path; Auto saber = 1.1 m feels right. Re-check
  at a short and a tall player's eye height (the rows follow the measured eye height).
- Section gates (ADR-009 Addendum L): each new section is announced by a gate that is visible
  early, never hides a target, follows the bending runway and lands on the start frame exactly on
  the section change (together with the callout's arrival flash); Fast/Hyper gates stay readable.
- Displays (ADR-009 Addendum K): the song map under the start frame is readable but not
  distracting while slicing; the playhead tracks the music; the CLEAR / FLAWLESS flash is noticed;
  looking down, the floor ring's timeline, section results and multiplier arcs read at a glance.
- Scoring (ADR-009 Addendum J): the HUD multiplier climbs 1-2-4-8x and drops a tier on a miss;
  drops/peaks feel more rewarding than intros/breakdowns; the finish line shows a plausible rank
  and accuracy.
- Reach and speed (ADR-009 Addendum I): with arms fully extended, every target the saber touches
  registers (no "touched but not counted" hits) at Normal / Fast / Hyper and Short / Normal / Long;
  the 1.20 m start frame is comfortable to reach with the blade's middle-to-outer part; early hits
  grade "good"; Fast/Hyper targets read early enough and emerge smoothly from the runway's end;
  the longer runway does not cause discomfort when it bends.
- Off-thread background (ADR-009 Addendum G): compare `/xr/?xrDiagnostics=1` with
  `/xr/?xrDiagnostics=1&xrBackgroundThread=main` — the worker build must hold 72 Hz where the
  in-thread one drops frames; background beat flashes stay in sync with the music; toggling
  quality mid-song does not stall the game.
