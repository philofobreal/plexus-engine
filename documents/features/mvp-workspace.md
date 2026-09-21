# MVP music-video workspace

The `/plexus-engine/mvp/` surface is a focused Cosmic Wormhole workspace. The dashboard
at `/plexus-engine/` remains the multi-identity editing surface. Both use the same audio,
offline analysis, Visual OS, renderer and export implementation. They are separate page
instances; opening both does not share a running track, audio context or in-memory State.

## Load, playback and layout

Drop/select an audio file, wait for analysis, then use the preview transport to play,
pause, restart or seek. Dragging the scrubber previews the intended position; committing
the gesture requests an engine seek. AudioEngine remains the playback clock and lifecycle
owner. The initial automatic journey uses the wormhole style pack and falls back to the
legacy plan generator if needed. Activity starts Balanced and variation starts Paired.

The facade guards post-analysis work with a load revision and plan revisions, independently
of AudioEngine's worker request guard. A superseded plan, preset response or tuning restore
cannot publish to the current track. Ready is emitted only after the accepted plan and
saved-tuning lookup finish. Initial preparation rejects regeneration/save requests; subsequent
regeneration publishes only the latest request. Legacy fallback uses the original captured
analysis and duration. Saves capture tuning at invocation and refuse a superseded track.

The preview is 16:9. Desktop places the moment inspector beside the workspace; narrow
layouts use a bottom sheet. Fullscreen includes the preview, transport and quick tuning
drawer. The journey canvas stops scheduling its own redraws while hidden or in fullscreen
and restores its visibility choice on exit. Visible timeline redraws are coalesced and
skip unchanged pixel positions/inputs, separately from the renderer's paused-frame gate.

## Visual character and advanced tuning

Four Visual character macros modify the current preset/automation values:

| Macro | Affected character |
| --- | --- |
| Intensity | Audio response, buildup intensity and inverse drop dampening |
| Motion | Speed, warp, jitter, radius modulation amount and transition speed |
| Depth | Tunnel depth/coherence, galaxy/starfield balance and rings |
| Detail | Grain material amount/detail/bloom/weave, spiral twist/arms, grain density and post FX amount |

Sliders use a bounded gain curve: bottom is 0x, center is neutral 1x, top is 4x; results
are clamped to each underlying tuning control's bounds. Drop dampening uses the mirrored
slider fraction so higher Intensity consistently strengthens impact.

Advanced tuning groups grain material, post FX and line controls. Continuous controls
apply gains after the macros. Grain line ends is an absolute Rounded/Square choice;
**Line stroke** controls thickness. This is the square-ended vector appearance, separate
from Nebula's soft material. **Preview quality** selects Automatic or Reduced load on
desktop as well as mobile; it is independent of artistic tuning and export resolution.
See [playback performance](playback-performance.md) for budgets, pause behavior and the
visible quality tradeoff. Controls unused by the wormhole, such as line hue/distance,
are omitted. MVP's config-owned surface override sets optics Off.

The renderer reads a host projection in this order: raw tuning -> macro gains -> advanced
gains/choices -> normal renderer morph. It does not write the boosted values back to
`State.targetTuning` or semantic base tuning, so moving sliders cannot compound gains or
erase preset/Strength changes. The facade copies the current raw values into one retained
scratch object; the mapper writes directly into it and reuses its fixed macro-key list.
The two-argument mapper API still returns a fresh partial result. Scratch output must be
distinct from raw input and must not be retained as an immutable snapshot by consumers.

## Saving and resetting

Save stores macros and advanced tuning per analyzed track in localStorage under
`plexus-mvp-meta-tuning:v1:` plus a SHA-256 fingerprint of rounded BPM, duration, section
starts and bar count. Renaming the same file does not affect the key. This is an analysis
descriptor fingerprint, not an audio-content identity: different tracks can share it,
and changed analysis can produce another key. Missing entries, JSON parse failures and
unavailable storage return no saved payload; save failure is reported in the panel. The
current facade retains the preceding track's boosts in that case instead of resetting
them: this is the open per-track isolation defect R3 in the
[local review](../audits/local-development-review.md). Stored
numeric fields currently have only shallow validation, so structurally valid malformed
values remain a validation gap. Old saves without Grain line ends
default to Rounded. Advanced Reset restores advanced controls only, retaining macros.
Preview quality uses the independent same-origin `plexus.previewQuality` preference.

## Journey editing

The timeline reuses GestureEngine and TimelineCanvas. Its toolbar exposes snap, follow,
draw, zoom, morph scale, and waveform/RMS/buildup/automation layer visibility. Selecting a
moment exposes its time, Strength and transition. Strength 0-100 maps to plan intensity
0.1-4. Transition choices request Smooth (4 s/easeInOut), Balanced (2 s/easeInOut) or Fast
(0.6 s/linear); available time and the wormhole morph floor remain authoritative.

Shared pure editing helpers constrain moves and morph durations against neighbors, snap
to the available grid, nudge by beat (0.5 s fallback), and reject creation inside occupied
morph spans. Time edits sort the plan. Manual edits invalidate the cached plan view and
trigger cursor. Regeneration asks before replacing edits and resets morph scale to 1.

Dashboard and MVP share `AutomationPlanViewCache`, retaining a scaled view while source,
scale and content signature match. MVP additionally uses `resolveAutomationTrigger` and
`semanticPlanRuntime`; Dashboard currently retains its own equivalent trigger/semantic
orchestration. These helpers do not move planning or DSP into UI or the renderer.
Preset application uses normalized/identity-filtered tuning and atomic morph authority;
an asynchronous preset response must still match the load, plan revision and pending trigger
id. Publishing a regenerated plan also invalidates requests from the previously playing plan.
MVP keeps the
wormhole identity and ignores foreign mode switches/nested performance-plan replacement.

## Export

The export dialog offers 720p, 1080p and 4K landscape at 60 fps, with capability warnings
and unavailable choices disabled. It displays progress and delegates stop/save/cancel
to the normal export workflow. UI does not encode audio/video. Preview Reduced load does
not reduce encoded dimensions or material export budgets. See [offline export](offline-webm-export.md).

## Implementation and validation

Vite builds both HTML entries with `appType: 'mpa'`; `/mvp/` must not silently fall back to
the dashboard. `src/ui/mvp/main.ts` is the explicit composition entrypoint. MvpUI owns DOM
composition, MvpVisualController owns application handoffs, config owns surface defaults,
and the shared renderer owns drawing. See [ADR-008](../adr/ADR-008-mvp-host-and-shared-renderer.md).

- [MVP acceptance criteria](../acceptance-criteria/mvp-workspace-acs.md)
- [Integration review and validation](../audits/mvp-renderer-integration-audit.md)
- [Preview/export validation](../audits/preview-rendering-validation.md)
- [Material validation](../audits/wormhole-material-performance-validation.md)

This describes implemented behavior, not certification of every device or race scenario.
The [local review](../audits/local-development-review.md) records the repaired asynchronous
publication defect and the still-open paused journey seek and per-track default-isolation
defects. Controller lifecycle regression tests cover reverse completion and stale handoffs;
they do not certify the whole browser/audio lifecycle. The acceptance criteria describe the
intended contract; remaining open findings prevent claiming full compliance.
