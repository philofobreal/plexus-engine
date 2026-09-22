# MVP workspace acceptance criteria

Contract: [MVP workspace](../features/mvp-workspace.md). Ownership:
[ADR-008](../adr/ADR-008-mvp-host-and-shared-renderer.md).
These are product criteria, not a record of execution order. Evidence and outstanding
gaps live in the [integration audit](../audits/mvp-renderer-integration-audit.md).

## MVP-1 Entry and playback

- Both production HTML entries resolve to their own workspace. MVP starts Cosmic Wormhole.
- File load/analysis status and transport state remain coherent. UI requests playback;
  AudioEngine owns source lifecycle, song time and worker publication.
- Scrubbing commits through the engine; pause/resume/restart/seek remain responsive.
- Desktop inspector, narrow-layout sheet and fullscreen tuning/transport remain usable.
  A hidden journey canvas does not keep its own redraw loop running.

## MVP-2 Tuning projection and persistence

- Centered macros preserve the raw preset/automation values within control bounds.
  Repeated edits cannot compound gains or overwrite raw/semantic tuning.
- Detail includes every exposed grain-material parameter and post FX amount. Intensity
  handles drop dampening inversely; advanced gains apply after macro gains.
- Reusing output yields the same values as the fresh-output API across changing raw values
  and macro positions. It retains unmapped fields and never mutates the raw input.
- Square/Rounded is absolute, survives Save/reload, and defaults to Rounded for old saves.
  Advanced Reset restores advanced settings while retaining macros.
- Per-track storage uses the documented descriptor fingerprint and handles unavailable
  storage. Do not promise collision-free audio identity or cross-tab live state sharing.
- The dramaturgy panel has its own explicit Save automation button. Advanced tuning Save
  changes effects only; each save preserves the other previously saved slice under one key.
  Reload restores manual points/deletions, presets, Strength, transitions, Activity/Variation,
  morph scale and edited status before ready. Empty plans remain empty. Legacy effect-only
  saves still work; invalid journey data cannot prevent valid effects from restoring.
- Edits never auto-save. Point/morph/generation changes and Visual character/Advanced tuning
  changes (sliders, selectors, Reset) use the same dirty tracking and exit protection. Each
  panel shows its own unsaved status; no-op edits and exact reversions are clean. Saving one
  domain cannot clear the other; failed saves and edits during save stay dirty.
- Track replacement uses one modal with Save automation, Save visual tuning, Save all and
  continue, Save history + workspace, Discard and continue, Keep editing. Clean domains have disabled save buttons.
  Saving only one domain keeps the modal open until the remaining edits are saved or explicitly
  discarded. Save history/Save all write both musical slices and the checkpoint in one localStorage update. Failed saves
  block continuation; Escape cancels replacement. The modal traps focus and makes the background
  inert. Rapid repeated requests must not change the destination being reviewed.
- Close/reload/browser navigation requests the browser's standard beforeunload warning only
  while any of the three domains is dirty. After staying, the same modal offers individual saves,
  history Save and Save all. Once musical panels are clean, Do not keep history explicitly opts out.
  Do not promise custom browser-prompt
  text/buttons or guaranteed protection on mobile process termination. No implicit unload save.
- Unsaved tracks start from default tuning and Balanced/Paired generation. Loading A,
  unsaved B, then A must restore A without leaking A's controls into B.
- Preview quality is independent of saved artistic tuning; both desktop and mobile can
  select Reduced load. Shared preview/export requirements are [VT-11](visual-tuning-presets-and-playback-ui-acs.md#vt-11-playback-performance-and-grain-appearance).

## MVP-3 Journey and preset handoff

- Undo/Redo defaults to dramaturgy and retains 300 edits total per loaded track. Include visual
  tuning adds macro/Advanced edits, retains histories when toggled and is never itself recorded.
  Restoring one domain cannot overwrite the other. New edits clear redo in both scopes.
- Continuous sliders and held range keys group into one step; no-ops/exact gesture reversions
  add none. Add/delete/move/nudge/time/preset/strength/transition/morph and accepted regeneration
  undo/redo correctly. Generation restores baseline/effective plans, edited flag and options.
- Panel saves preserve history; Undo/Redo never serialize history to storage. Musical dirty state follows
  actual content against saved baselines. Ordinary track load resets history; a validated matching-file
  checkpoint restores both branches and scope. The switch is saved as a preference, never an undo step.
- Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y act globally within the page, including canvas and
  editable focus. A pending time edit commits first; an untouched rounded time is not an edit.
  Modal decisions, loading, regeneration and export block history; IME/Alt stays native.
- Undo cancels uncommitted drag previews and invalidates late preset responses. Toolbar buttons,
  counts, tooltips and restored controls agree with the model. Pure/input/controller coverage:
  `tests/mvp-history.test.mjs` and `tests/mvp-async-lifecycle.test.mjs`.

- Moves/time edits stay ordered and constrained by neighbors; creation rejects occupied
  morph spans. Grid snapping, nudging and duration changes use shared pure helpers.
- Morph Scale's displayed range ends at the controller's safe limit, even below 100% or
  between hundredths. Dragging and Home/End must reach the actual endpoints without snapping
  back. Value/accessible text agree; a 25%-only range disables and later widening re-enables
  the control. All current morph lengths grow by the same factor until the first pair would
  overlap (20 ms margin), or the final morph reaches the track end. Do not cap at 400% when
  more space exists. Include unequal lengths, edits changing the limiting pair, a single point,
  and scales above 400% surviving save/reload and undo/redo; base durations stay unchanged.
  A point edit and its required scale clamp must form one undo entry.
- Generated scene starts must accommodate the minimum morph and spacing margin. Test a
  64 ms opening scene (formerly a hidden 44% cap), consecutive tiny scenes, exactly playable
  boundaries and terminal stubs. Existing saved/user-authored plans are not silently replaced.
- Regeneration confirms replacement of manual edits. Strength and transition choices
  affect the current point while respecting morph constraints and the wormhole floor.
- Cached plan views refresh on source, scale, duration or content change; edits reset the trigger
  cursor. Preset/morph authority is applied atomically after async loading.
- Stale trigger responses cannot apply to another moment. MVP stays in its wormhole mode.
- Superseded file loads must not publish stale post-analysis plan or saved tuning; this
  facade guard is independent of worker request ids. Ready follows accepted plan and saved
  tuning preparation. Superseded errors must not hide a newer ready workspace.
- Reverse regeneration completion keeps the latest Activity/Variation plan. Preset responses
  from an earlier load or plan cannot apply even when point ids repeat, including requests
  started while regeneration is pending. An old preload cannot refill a cleared track cache.
- Each explicit save snapshots its own tuning or effective journey slice, refuses pending
  initial loading/regeneration, and must not publish a stale fingerprint or payload
  after a new load. Legacy generator fallback retains its original captured inputs.
- Controller/storage/guard coverage lives in `tests/mvp-async-lifecycle.test.mjs`,
  `tests/mvp-track-storage.test.mjs` and `tests/mvp-unsaved-changes.test.mjs`; browser/audio lifecycle
  acceptance remains broader than these controlled asynchronous boundary tests.

## MVP-4 Export and ownership

- Capability checks control available resolutions and display warnings before export.
- Progress, stop/save and cancellation delegate to the existing export workflow.
- Export dimensions/density are independent of preview caps and browser DPR.
- Only the MVP composition entrypoint creates renderer/audio subsystems. Leaf controls
  use callbacks; the facade coordinates state, audio requests, plan and export handoffs.
- No alternate DSP, playback clock, semantic domain policy or render engine is introduced.

## MVP-5 Opt-in history/workspace restoration

- Separate history Save and Save all include every durable state listed in the feature contract,
  including current musical snapshots and both history branches. Panel-only saves leave history dirty.
- No audio bytes/Blob/IndexedDB persistence. Reload waits for user file selection. Same bytes under
  a new filename match; different bytes with equal analysis descriptors do not. Existing musical-save
  keys remain compatible. Content hashing runs once per file load, never during editing or rendering.
- Consume the restore capability before replay; another reload without explicit re-save starts with no
  old history. Invalidated, discarded, malformed, foreign-token and missing checkpoints fail closed.
- Reload restores scope, journal, controls, views and paused position through the existing owners.
  Reconstruct worker/audio/render runtime; do not resume export/autoplay/native fullscreen.
- Startup/file hash/analysis and save races cannot overwrite a newer track or clear newer edits.
  Save errors leave the modal open. Token activation failure after the local write is reported as a
  partial failure, never false success or claimed rollback.
- 300 retained commands and the serialized-size budget are both enforced. No silent history trimming,
  unbounded journal growth or large per-event/per-frame storage writes.
- A detailed 80-point journey with 300 small edits saves through lossless encoding within the stored
  budget and restores every command. Both branches, mixed domains, Unicode and legacy plain v1
  checkpoints retain exact values. Invalid references and excessive expansion fail closed.
- Capture exceptions release the saving lock; retry can succeed. Size, validation, storage and
  superseded-workspace failures produce actionable modal text while preserving dirty state.
- Node coverage: `tests/mvp-session-persistence.test.mjs`, `tests/mvp-checkpoint-encoding.test.mjs`,
  controller lifecycle and shared dialog suites.
  Browser and user acceptance must verify save, reload, file reselection, working Undo/Redo and a
  second reload without re-save. See the task-2 checkpoint manual list in the sequential audit.

## MVP-6 Sub and bass response

- Fresh analysis publishes bounded separate 20-60 Hz and 60-180 Hz body/change signals.
  Sustained tones retain body while their change signal settles; silence and near-silence
  do not normalize to full strength. Shared normalization retains relative band levels.
- Body/change signals affect modulation and local Wormhole grain character. A sustained note
  must not repeatedly trigger kicks or shockwaves. Audio sensitivity applies exactly once.
- Preview, seek and export select the same precomputed scalar signals for the same timestamp;
  renderer/UI never compute FFTs. Old frames default missing new fields to zero.
- Automated coverage: `analyzer-low-frequency`, analyzer schema/parity/golden suites,
  `modulation`, `paused-renderer`, `wormhole-motion-profile` and deterministic style smoke.
  The user accepted the implementation on 2026-09-22; retain real music
  and perceived artistic response as regression checks for later changes.
- Algorithm, limits and ownership: [Sub and bass response](../features/analyzer-low-frequency.md).
