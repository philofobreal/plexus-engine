# ADR-012: Immutable export job and isolated render runtime

WH-07a (2026-11-08) adds a device/job throughput preference and one bounded
terminal performance observation through the existing facade. Qualified WebM
may use event-driven admission and task yields; requested Turbo for MP4 retains
Economy with an explicit promotion reason. The exact frame barrier, two-frame
limit, PCM/OPFS ownership and single job state machine remain. See
[WH-07a](../audits/wormhole-wh07-turbo.md).

WH-07b3 (2026-11-08) preserves native VP9 color metadata in the existing MP4
worker's video-copy finalizer, with SDR defaults only when unspecified. The pure
export metadata leaf adds no resource owner, wire message, queue or pixel
conversion; Economy/all-key protection remains until a separately qualified
MP4 Turbo candidate. See the same audit for packet/decoder and actual-file proof.


WH-07b9 extends the existing pure `ExportPreparation` level policy with a
finite MP4 stream-copy level argument. The MP4 worker owns native-level and
prefix-rate/four-packet-burst observations, storing four numbers, not packet
copies. The policy preserves the higher native level, rejects unsupported bounds
and adds no resource, protocol, clock or preference owner. Existing OPFS and
PCM-to-AAC finalization remain. This is metadata preservation, not a new encoding
profile or full bitstream certification. See the same WH-07 audit.

WH-06c1 (2026-11-08) adds an observational export diagnostic response and a
UI-owned 30/60 fps preference. The existing coordinator, exact-source frame
barrier, codec acceptance, queue bounds and OPFS lifetimes remain authoritative.
It introduces no second job state machine, new WASM codec or silent fallback.
See [diagnostic ownership and acceptance](../audits/wormhole-wh06c1-export-diagnostics.md).


## Status

WH-06b (2026-11-08) integrates the internal exact source through
HostExportFramePort, not the retired isolated product mode. Export owns begin,
contiguous index/fps, Stop/Cancel, encoder/PCM/OPFS and target teardown. Visuals
own cloned frame input, native pairing, the one PostFX completion seam and worker
lease disposal. The target is retained until redraw/deferred writes quiesce.
No mutable State swap, async p5.draw, new product runtime selector or RAM gate.
Optional VP9 10-bit MP4 now uses independent pictures after a retained-detail
regression was independently decoded. See [WH-06b](../audits/wormhole-wh06b-export-integration.md).
Earlier task-scoped statements below retain their historical scope.

WH-06a (2026-11-08) delivers the internal exact resolved-frame source under the
existing common visual session, without restoring the isolated product mode.
Its broker supplies a job/stamp-bound full-size image and captured values, one
request OR lease, explicit abort/deadlines/release and pixel-stable repeats.
No encoder, PCM, OPFS, workspace lock or export facade is changed. WH-06b must
inject this source, await an explicit frame-completion barrier and preserve the
existing integrated job controls/output checks. A mid-job GPU failure must not
silently re-anchor the animation; a new compatible job is required instead.
See [WH-06a scope, evidence and next gates](../audits/wormhole-wh06a-exact-source.md).

WH-01 (2026-11-07) records the [common render contract](../audits/wormhole-wh01-contract-baseline.md).
Future exact adapters consume the common session internally under the existing
export coordinator. This does not reinstate MVP's isolated product choice,
workspace concurrency or fixed admission. Job/encoder/PCM/OPFS and Stop/Cancel
stay export-owned. Production integration remains WH-06 with output acceptance.

WH-03a's shared preparation arithmetic is also consumed by the retained
private context. No snapshot, PCM, job, encoder, async lease or export UI
ownership changes. In particular, the synchronous borrowed frame view cannot
be retained as an immutable export snapshot. Canonical sampling stays WH-03b.

T19e retired the isolated runtime and its dependent UI from MVP export. The
MVP uses Compatible, with compact export status and workspace locking through
cleanup. The isolated runtime remains available to research fixtures. See the
[retirement record](../features/export-lifecycle.md#scheduled-retirement-from-mvp-export).

T01 proposed this architecture on 2026-10-23 and T19b partially implemented
it on 2026-10-29 as an opt-in MVP mode. T19c4 added the minimizable panel.
T19c5 used the frozen job to enable concurrent editing, playback and track
replacement. The descriptions below record that implementation and the
remaining architecture proposal.
T19a (2026-10-29) hardens the existing export lifecycle and serial worker startup
without accepting the complete proposed architecture. Integration owner: this chat.
Owners: export, visuals/state contracts, MVP facade/UI, build.
Related: [ADR-011](ADR-011-shared-wormhole-frame-context.md),
[plan](../audits/xr-development-plan.md), [baseline](../audits/xr-development-baseline.md).

Delivered prerequisite: [T19a lifecycle contract](../features/export-lifecycle.md).
Compatible retains the global render-state path and reserves the workspace until
export settles. See the [T19c5 workflow](../features/export-lifecycle.md#t19c5-background-work-during-isolated-export-2026-11-04).
T19a was accepted on 2026-10-29. The user's additional conditional WASM export
request is [scheduled across T19b/T19c/T20a](../features/export-lifecycle.md#scheduled-export-acceleration---user-direction-2026-10-29).
It grants no second render pipeline, codec replacement or unmeasured speed claim.

T19c1/c2 add configuration-specific codec admission, configurable planning limits,
bounded copies/pools and owned-file cleanup. T19c3 adds document-local finished-file
release after explicit download-finished confirmation and actual-output acceptance
fixtures. Durable cross-tab/orphan quota management, complete format/dense-scene
acceptance and reliable peak-memory evidence remain open. The delivered resource
policy is described in the [T19c3 contract](../features/export-lifecycle.md#t19c3---real-output-acceptance-and-explicit-cache-release-2026-10-31).

## Problem

In Compatible, WebCodecsBackend.start calls p5.noLoop, assigns the export target,
writes global State.isExporting/exportTime and redraws the same renderer. Isolated
jobs own a private rendering context and a frozen input lease. The worker encoder
still uses start/progress, stopAndSave and cancel without job IDs.

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
