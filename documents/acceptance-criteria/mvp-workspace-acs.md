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
- Preview quality is independent of saved artistic tuning; both desktop and mobile can
  select Reduced load. Shared preview/export requirements are [VT-11](visual-tuning-presets-and-playback-ui-acs.md#vt-11-playback-performance-and-grain-appearance).

## MVP-3 Journey and preset handoff

- Moves/time edits stay ordered and constrained by neighbors; creation rejects occupied
  morph spans. Grid snapping, nudging and duration changes use shared pure helpers.
- Regeneration confirms replacement of manual edits. Strength and transition choices
  affect the current point while respecting morph constraints and the wormhole floor.
- Cached plan views refresh on source, scale or content change; edits reset the trigger
  cursor. Preset/morph authority is applied atomically after async loading.
- Stale trigger responses cannot apply to another moment. MVP stays in its wormhole mode.
- Superseded file loads must not publish stale post-analysis plan or saved tuning; this
  facade guard is independent of worker request ids. Ready follows accepted plan and saved
  tuning preparation. Superseded errors must not hide a newer ready workspace.
- Reverse regeneration completion keeps the latest Activity/Variation plan. Preset responses
  from an earlier load or plan cannot apply even when point ids repeat, including requests
  started while regeneration is pending. An old preload cannot refill a cleared track cache.
- Saving snapshots the current tuning and must not publish a stale fingerprint or payload
  after a new load. Legacy generator fallback retains its original captured inputs.
- Controller coverage lives in `tests/mvp-async-lifecycle.test.mjs`; browser/audio lifecycle
  acceptance remains broader than these controlled asynchronous boundary tests.

## MVP-4 Export and ownership

- Capability checks control available resolutions and display warnings before export.
- Progress, stop/save and cancellation delegate to the existing export workflow.
- Export dimensions/density are independent of preview caps and browser DPR.
- Only the MVP composition entrypoint creates renderer/audio subsystems. Leaf controls
  use callbacks; the facade coordinates state, audio requests, plan and export handoffs.
- No alternate DSP, playback clock, semantic domain policy or render engine is introduced.
