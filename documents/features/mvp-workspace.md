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

Explicit saves store macros, advanced tuning and the complete journey per analyzed track in localStorage under
`plexus-mvp-meta-tuning:v1:` plus a SHA-256 fingerprint of rounded BPM, duration, section
starts and bar count. Renaming the same file does not affect the key. This is an analysis
descriptor fingerprint, not an audio-content identity: different tracks can share it,
and changed analysis can produce another key. Missing entries, JSON parse failures and
unavailable storage return no saved payload; save failure is reported in the panel. The
facade resets per-track controls before restoration, so an unsaved track starts with
neutral tuning and Balanced/Paired generation. Stored tuning uses known keys, finite
bounded values and defaults. Old saves without Grain line ends
default to Rounded. Advanced Reset restores advanced controls only, retaining macros.
Preview quality uses the independent same-origin `plexus.previewQuality` preference.

**Track dramaturgy > Save automation** explicitly saves a versioned `journey`: the effective
plan (including manual edits/deletions and point metadata), Activity, Variation, morph scale
and edited flag. **Advanced tuning > Save** saves effects only. Both update the same localStorage
entry, preserving the other previously saved slice. Neither action implicitly commits the
other panel's current unsaved edits; no automatic save runs on edit, navigation or unload.
Automation Save captures an independent snapshot and is refused while initial loading
or regeneration is pending. Accepted restoration publishes the effective plan before ready,
resets the plan view/trigger cursor and preloads its presets. The fresh generated plan remains
the baseline. Effect-only legacy entries still restore; a malformed journey is discarded as
a unit while valid tuning survives. Duplicate IDs, invalid control enums, out-of-track points
and unsafe preset filenames are rejected. Empty saved journeys are intentional and preserved.
Editor viewport/layer preferences are not part of individual musical panel saves; a full history
checkpoint includes them as described below.
See the [task and manual test record](../audits/sequential-development-plan.md).

The dramaturgy toolbar and Advanced tuning panel display their own unsaved status. The facade
uses the same content-signature mechanism for both save domains, comparing against the last
loaded/generated or explicitly saved snapshot. Journey comparison excludes edited/source
bookkeeping flags. Point edits, creation, deletion, movement, nudging, morph scale and
regeneration participate, as do Visual character macros, Advanced sliders, selectors and Reset.
No-op edits and exact reversions are clean for musical content. Playback/editor viewport changes
participate in the separate history/workspace dirty domain. Any dirty domain enables exit protection; saving one panel only clears its own
baseline. Pending regeneration also enables protection. Failed saves and newer edits made during
a pending save remain dirty. Comparisons run on edits/publication, never in the draw loop.

Selecting a replacement track opens one dialog describing which domains are unsaved. It offers
**Save automation**, **Save visual tuning**, **Save history + workspace**, **Save all and continue**, **Discard and continue**,
and **Keep editing**. Individual save buttons are disabled for clean domains. Saving just one
domain keeps the dialog open while any other remains unsaved. Save history and Save all both
publish the complete checkpoint and both musical slices in one localStorage write. A failed
record write preserves the previous record; a later localStorage capability-activation failure
can leave panel settings saved but must report failure and keep dirty state. Continuation requires
all domains clean or an explicit discard. Save failure retains the dialog/current track.
Escape keeps editing; duplicate attempts cannot replace the pending destination. The native
dialog supplies focus containment and blocks background interaction.

Close/reload/address-bar navigation/browser Back use a dirty-only `beforeunload` listener.
Browsers require their own generic confirmation here: a custom save button cannot be inserted
into that prompt. After choosing to stay, the same application dialog offers **Save automation**,
**Save visual tuning**, **Save history + workspace**, **Save all** and **Keep editing**. After panel
changes are saved, **Do not keep history** explicitly opts out of session retention and closes the
dialog; it cannot discard dirty panel settings in returned-page mode.
Choosing to leave discards unsaved edits; the app cannot force retention.
Browser warnings require prior interaction and are not guaranteed on mobile process termination.
See [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).

## Journey editing

The dramaturgy toolbar provides **Undo / Redo** with 300 retained artistic edits per loaded
track. Default scope is dramaturgy; **Include visual tuning** adds Visual character and Advanced
tuning. Both domains retain independent snapshots in one journal, so switching the scope keeps
history and never overwrites unrelated controls. The switch is not itself undoable. A new edit
clears all redo, including entries hidden by the current scope. Save preserves history; returning
to saved content through undo/redo clears its musical unsaved status. History resets on ordinary
track loads; a valid saved checkpoint can restore it after file reselection following reload.
Playback, file loads, Save/export and view/quality preferences are excluded from undo commands
but durable workspace preferences are included in a checkpoint. The separate dashboard does not
share this MVP history.

### History and workspace checkpoint

**Save session** opens the shared dialog proactively. **Save history + workspace** and **Save all**
save both musical domains, generated/effective plans, edited flags, generation settings, morph,
the 300-step undo/redo journal and scope, selected moment, timeline visibility, snap/follow/draw,
zoom/pan, layers, tuning drawer, mobile inspector visibility, preview quality, export resolution,
loop setting, paused playhead position and normalized raw visual target. Playback is paused at
save so the position remains coherent. Identical adjacent snapshots are interned. The scope
switch remains outside undo history, but changing it makes the workspace require a fresh save.

Only JSON and a file content hash are persisted. **No audio file, sample data or IndexedDB audio
cache is created.** On reload the user selects the audio again; matching bytes (even renamed)
plus compatible analysis fingerprint/duration restore the full checkpoint before use. Different
bytes with equal filenames, lengths or analysis descriptors never receive the journal. An unmatched
pending checkpoint remains in memory for later selection of its matching file during this visit;
an explicit new checkpoint replaces it. The existing panel-save key uses SHA-256 of rounded BPM,
duration, section starts and bar count; it is preserved for compatibility. The additional full-file
SHA-256 digest is computed once during file loading, outside playback/render, to establish identity.
This is byte identity, not perceptual matching: re-encoding or metadata-byte changes do not match.

A small localStorage capability points to the latest checkpoint in the existing per-track
localStorage record. Startup consumes this capability and removes its checkpoint field while
preserving musical saves. Restoration is single-use: **save again before the next departure**.
The first subsequent edit/play/seek/view/scope change invalidates a saved capability with one small
write; history is not serialized per gesture/frame. Individual panel saves do not keep an older
history alive. Opting out or leaving without a fresh save cannot resurrect it on another reload.
This is a next-visit workspace checkpoint, not a cross-tab history library or backup. A newer tab's
checkpoint wins for the same track; token comparison prevents an older tab deleting the newer one.
The capability survives tab closure. The first subsequent page visit consumes it; other tabs cannot replay it again.

The stored checkpoint budget is 1,500,000 characters (up to about 3 MB in UTF-16), in addition
to the 300-command limit. Larger raw snapshots use lossless `history-delta-v1` string differences
between same-domain history snapshots; small and older plain v1 checkpoints remain compatible.
Encoding runs only on explicit save, with a 32,000,000-character expanded-input budget and bounded
decoding. All retained commands and both branches survive encoding; unusually large or poorly
compressible histories can still exceed the budget. Capture, validation, size and storage failures
keep edits dirty, release the saving lock and display actionable errors in the shared modal so
the user can retry or save the musical panels separately. Commands are never silently trimmed.
Browsers may evict local data. Full-file hashing
temporarily reads the file into memory during loading, but no bytes are persisted or uploaded.

Runtime-only state is deliberately reconstructed: decoded audio/worker analysis, renderer/GPU
buffers, random particle transients, source nodes, drag/focus/tooltip/modal state and export progress.
Restoration is paused through AudioEngine's seek path; a native fullscreen request and playback
need a new gesture. Export resolution falls back to 720p if a new device cannot support the saved
choice. These are platform/lifecycle boundaries, not missing musical settings. Governance:
[Session Persistence](../governance/session-persistence.md).

Point edits/addition/deletion, morph scale and accepted regeneration are reversible; regeneration
restores the generated baseline, effective journey and generation controls together. A continuous
range drag or held adjustment key is one step. Undo invalidates old preset requests and pending
drag previews. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo, regardless of focused page element.
These shortcuts deliberately take precedence over native text undo. A real pending time draft
commits before undo, but an unchanged rounded time display does not. IME/Alt input stays native;
modal decisions and loading/generation/export block background history changes. Browser chrome
is outside webpage shortcut control. See [task 2 design and manual tests](../audits/sequential-development-plan.md#task-2-scoped-undoredo).

The timeline reuses GestureEngine and TimelineCanvas. Its toolbar exposes snap, follow,
draw, zoom, morph scale, and waveform/RMS/buildup/automation layer visibility. Selecting a
moment exposes its time, Strength and transition. Strength 0-100 maps to plan intensity
0.1-4. Transition choices request Smooth (4 s/easeInOut), Balanced (2 s/easeInOut) or Fast
(0.6 s/linear); available time and the wormhole morph floor remain authoritative.

Morph Scale proportionally multiplies every current base morph duration. Its maximum is the
smallest `(next start - current start - 0.02 s) / current base duration` across the entire
journey, with the track end as the final boundary. This accounts for both the current widths
and remaining gaps; there is no 400% ceiling when the track has more room. The slider's
right endpoint matches the controller limit; fractional endpoints are accepted without
hundredth-step rounding. The value and accessible text show percentages to at most two
decimal places, and the tooltip explains that transitions must finish before the next moment.
When the safe maximum equals the 25% minimum, the slider is disabled and re-enables when the
plan permits a wider range. Base durations stay unchanged. Plan edits recompute the bound and
record any necessary scale reduction in the same undo entry. Saves/restoration use the same
track-duration bound, including a single-point journey. The shared view cache also tracks
duration changes. See [Morph scale investigation](../audits/mvp-control-bug-investigation.md).

Generated Visual OS plans merge starts too close to fit a 100 ms morph plus the 20 ms margin;
a succeeding scene birth takes priority over an unplayable transient scene. Terminal stubs
are omitted. This prevents near-coincident generated points from imposing an artificial
global shrink (for example, a 64 ms scene causing a 44% ceiling). Previously saved journeys
retain their points; explicit regeneration applies the corrected generation to old data.

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
publication repair, the task-1 per-track isolation repair and the still-open paused journey
seek defect. Controller lifecycle regression tests cover reverse completion and stale handoffs;
they do not certify the whole browser/audio lifecycle. The acceptance criteria describe the
intended contract; remaining open findings prevent claiming full compliance.
