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
- Wormhole depth: perceivable separation between near streaks and the far field, head-motion
  parallax, no double vision or eye strain, and stable frame rate (72/90 Hz) with the Wormhole on
  (record GPU frame time: three planes, two additive).
