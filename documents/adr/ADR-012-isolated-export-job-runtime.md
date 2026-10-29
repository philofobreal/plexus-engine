# ADR-012: Immutable export job and isolated render runtime

## Status

Proposed by T01 on 2026-10-23; isolated snapshot/runtime not implemented.
T19a (2026-10-29) hardens the existing export lifecycle and serial worker startup
without accepting the complete proposed architecture. Integration owner: this chat.
Owners: export, visuals/state contracts, MVP facade/UI, build.
Related: [ADR-011](ADR-011-shared-wormhole-frame-context.md),
[plan](../audits/xr-development-plan.md), [baseline](../audits/xr-development-baseline.md).

Delivered prerequisite: [T19a lifecycle contract](../features/export-lifecycle.md).
The legacy global render-state path remains; background editing is not enabled.

## Problem

WebCodecsBackend.start calls p5.noLoop, assigns the export target, writes global
State.isExporting/exportTime and redraws the same renderer. Encoding in a worker does not isolate
that rendering from editing. Current ExportBackend has start/progress, stopAndSave and cancel;
worker messages have no job ID. A minimizable panel alone cannot provide safe background editing.

## Proposed job and snapshot boundary (T19)

One coordinator in export owns one active job, its cancellation, render context, encoder/worker,
asset/video resources, snapshot lease and single completion result. MVP facade captures a
consistent revision and passes validated data; leaf controls only dispatch commands and project
state. A changed load/plan revision while preparing rejects or restarts preparation before
publishing the job; never mix two tracks or partially captured edits.

Proposed ExportSnapshot descriptor schema v1 contains:

- snapshot/job IDs, audio content ID and analysis identity/algorithm/clock; copied immutable
  analysis publication and generated/edited plan, morph scale and resolved semantic policy;
- resolved preset payloads with content hashes, initial tuning/macros/Advanced boosts, visual
  identity/transition/PostFX configuration and seed; no future mutable asset lookup;
- frame dimensions/aspect/fps/duration, watermark, metadata layers, video asset identity and
  timing, optional caption-plan version/identity; absent captions mean an empty overlay;
- decoder/font/asset readiness requirements and explicit version fields for render sampling.

The descriptor is data-only; a separate private resource lease holds PCM/video/assets. It is
not the MVP SessionCheckpoint and is not written to localStorage. For the first implementation,
copy each PCM channel once into job-owned arrays before enabling unrestricted new-file loading.
Never transfer AudioEngine's live channel buffer or detach it. A later zero-copy policy requires
proof of immutable lifetime. Worker chunks use bounded recycled transfer buffers.

Admission estimates `channels * sampleCount * 4` plus analysis/assets, decoder queues, targets and
encoder buffers with headroom. Compare with a documented device/capability budget established in
T19; refuse or offer lower output settings on failure, never silently claim a memory guarantee.
For scale, 5 minutes of stereo 48 kHz float PCM alone costs 115,200,000 bytes per copy.
OPFS streaming must avoid retaining the full encoded output as an additional RAM copy.

## Render/time ownership

An isolated renderer context owns its tuning/interpolation, director, transient state, event/cue
cursors, identity instances, compositor and PostFX buffers. Reuse existing effects and shared
pure functions. Inject a render-state view; never swap the global State around awaited work.
Composition constructs contexts; export coordinates them. Before extracting this boundary update
architecture/state/export contracts and their tests under the integration owner.

Clock is exactly `frameIndex / fps`. Repeated/seeked frame sampling must pass ADR-011's deterministic
gate. Preview continues to use AudioEngine and its own context. Export has a separate video
decoder/seek resource and frozen fonts/overlays. No FFT/onset reconstruction or alternate live clock.
Move render work off-thread where supported; otherwise measured cooperative main-thread slices
yield between bounded batches. A worker encoder alone is not a UI-responsiveness solution.

## Job control and transport v1

Propose `ExportJobProtocol` version 1, independent of the currently unversioned encoder messages.
Every request/response echoes `{protocol, jobId, generation, commandSerial}`; frame messages add
frameIndex/timestampUs. Job generation invalidates late progress/completion. A legacy backend
adapter preserves current ExportBackend.start's Promise/Blob and controls during migration;
the isolated coordinator must not clear its active job reference until teardown acknowledges
termination. Existing WebM support remains available while the new path is opt-in.

States: preparing -> rendering -> encoding (drain) -> finalizing -> completed. Encoding may
overlap rendering; report its counters separately. Preparing/rendering/encoding may transition
to stopping (save request), finalizing and completed; cancel goes to cancelled after cleanup;
errors go to failed. Finalizing already contains the complete or saved prefix: Stop is idempotent.
Cancel during finalizing still suppresses result/download if completion was not already published.
Completed/cancelled/failed are terminal. No second active job while cancellation cleanup is pending.

The accepted prefix consists of contiguous encoder-acknowledged frames `[0,N)`, with audio clipped
at the same `N/fps` boundary (sample rounding policy pinned in tests). Stop closes input admission,
drains accepted work and finalizes that prefix; N=0 reports no saveable content. Cancel keeps the
existing discard confirmation, stops/terminates all work after confirmation and downloads nothing.
Both commands are latched once, with Cancel overriding an uncompleted Stop. Double clicks and
late completions cannot cause a second finalize, result or download. A user cancellation is not
reported as an encoder failure.

Render requests: one in flight. Encoder admission: at most two queued frames, plus explicitly
bounded worker internal queues; block/yield at the boundary. Close every VideoFrame/ImageBitmap,
return buffers and release decoders, targets, object URLs, workers, temp OPFS and snapshot refs
on every terminal path. Cleanup is idempotent, including failed preparation and capability errors.

Progress is a phase and counters, with optional phase-local fraction. Overall 100% only after
usable result publication; unavailable encode totals remain indeterminate. Panel hiding keeps
the job alive, with a persistent reopen/status/Stop/Cancel affordance. Editing affects only the
next job. Navigation to another host/tab close has a leave guard; a browser worker does not
survive document teardown. Server persistence is a different capability, not part of this claim.

## Versions, fallback and rollback

Propose composition flag `isolatedExportRuntime`, initially off. Snapshot v1, job protocol v1 and
renderer sampling version are distinct from analyzer algorithm/cache versions. Backend/asset
capability failures before input admission may select the legacy path with its declared UI
limitations; never restart silently after partial output. Rollback disables new job starts,
lets an active isolated job finish/cancel cleanly, then restores the old backend. No state swapping.
T20 adds a container/codec capability only after its format decision; T21 supplies an immutable
caption plan. Neither requires a second exporter state machine.

## Acceptance

Snapshot mutation/new-load races, editing/playback during export, stale job messages and every
Stop/Cancel phase are integration tests. Real multi-minute WebM full/prefix exports must decode
with audio synchronization; compare decoded frames/timestamps rather than hardware-encoder bytes.
Proposed control-latency, memory and UI gates are in the plan. MP4/FFmpeg/WASM/survival across
navigation are not claimed by a job scaffold. Existing baseline failures remain recorded.
