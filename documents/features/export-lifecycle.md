# Staged export lifecycle

## T19c resource follow-up - staged for quota-aware delivery

User direction, 2026-10-29: replace the premature fixed 384 MiB refusal with real
output-capability checks and configurable admission; deliver bounded subtasks and
pause after each deployment for manual feedback. No new WASM exporter is implied.

| Slice | Scope | Handoff |
| --- | --- | --- |
| T19c1 | Exact worker configuration/probe, memory policy and MVP controls | Implemented below; manual short 4K export gate pending |
| T19c2 | Reduce copied analysis/PCM overhead where ownership allows; review surface/queue/storage lifetimes | Implemented after T19c1 acceptance; manual handoff below |
| T19c3 | Multi-minute/large-output, decoded full/prefix sync, cancellation/retry and resource/performance evidence | After T19c2; no measured claim until real runs |

The original T19c persistent/minimizable controls and background-editing acceptance
remain scheduled after these resource prerequisites. T20 and conditional WASM
promotion do not advance automatically. T15 remains skipped.

### T19c2 - bounded copies, reusable PCM and owned storage, 2026-10-30

The user accepted T19c1 and authorized this resource slice. Export owns snapshot
capture, transfer-buffer pooling and temporary-file leases; visuals owns private
PostFX disposal. One integration owner covers the shared worker/host contract.
No analyzer, musical timing, preset, display setting, WASM kernel or output-format
change is introduced. Compatible remains default and the existing Auto/manual
planning ceilings are unchanged.

Snapshot capture now copies validated plain data directly instead of making a
whole-input JSON string and reparsing it. JSON data normalization is retained:
undefined object members are omitted, undefined/sparse array slots become null,
negative zero becomes zero and object key order remains JSON-compatible. Safe
own __proto__ handling avoids changing the new object's prototype. Shared input
subtrees have one frozen private copy. Tests compare the complete normalized
payload and analysis SHA-256 with the independent old JSON reference; live input
is never frozen or changed. Admission no longer builds a giant entries-array and
also counts sparse slots before allocating/copying PCM. Cycles on custom array
properties still fail. Hashing retains its existing JSON/SHA algorithm: it still
needs a transient analysis string and UTF-8 bytes; it is not streaming or zero-copy.

No further analysis fields are stripped: semantic/director consumers can require
the full remaining track publication. The existing render projection continues
to omit only musicActivity/rhythmOnsets. The single private PCM copy per channel
and small defensive preset copies remain. This preserves snapshot isolation and
future editing safety instead of borrowing mutable playback storage.

The host reuses audioPlanar buffers that the worker already returns after
AudioData.close. It keeps at most two buffers, each at most two channels times
ceil(sampleRate/fps) floats. Smaller final/alternating slices use a bounded view;
every used sample is overwritten with the same half-open channel slices. Detached,
oversized and duplicate pooled buffers are not retained. Transfer still detaches
only job-owned chunks, never the playback channel. The existing two-frame/queue
backpressure remains. Teardown drops the pool; Copy diagnostics reports allocation,
reuse and pool-ceiling counters. A real structuredClone transfer test at1000Hz/60fps
checks every sample for six frames: two allocations/four reuses versus six old
per-frame allocations. This is allocation evidence, not a browser speed/RAM claim.

CanvasPostFxSurface.dispose shrinks its owned lazy snapshot to1x1 and drops its
context and borrowed target references. PostFxPipeline forwards disposal and the
private export runtime invokes it before dropping the chain. The live target is
never resized by the PostFX surface. Tests verify idempotence and that a borrowed
3840x2160 output survives disposal. Browser/driver physical-memory reclamation is
not measured or guaranteed by the canvas-size assertion.

The worker no longer enumerates/deletes all temp_plexus_export_* files at startup.
The host generates an owned unique filename and passes optional storageFile;
legacy requests generate their own unique name. Names cannot contain a path.
Worker startup/frame failures close held encoders and sync file handles. On
failure/Cancel, host teardown terminates the worker first, then removes only its
own file, with bounded lock retries and a1500ms overall cleanup deadline. Missing
files count as removed. Unavailable/locked storage stays cleanup-pending in Copy
diagnostics, without replacing Cancel/the original error or touching other jobs.
The coordinator retains its reservation through teardown and discards an
unpublished file if Cancel wins a queued backend completion. Discard is memoized
once per job so repeated cleanup cannot double the timeout. A new request clears
its old cleanup key before validation, protecting the previous published result.

Successful full/Stop-prefix results are deliberately retained on disk. getFile()
does not give a portable guarantee that bytes remain readable after their backing
entry is removed. An anchor download/URL revocation also does not acknowledge
that a download finished. The optional backend discardResult() boundary can be
used when a result is known to be unneeded; the current MVP does not guess this
from a timer. A completed-cache quota/retention policy and real cross-job File
readability/locked-file tests remain T19c3 acceptance work. Tab/process termination
can leave orphan files; no safe automatic orphan sweep is claimed here.
References: [File API snapshot state](https://www.w3.org/TR/FileAPI/),
[File System getFile behavior](https://fs.spec.whatwg.org/#api-filesystemfilehandle).

Fourteen new cases in tests/export-resources.test.mjs cover copy/reference/hash
parity, sparse hostile input, real transfer ownership and sample identity, lease
isolation, retries/missing/stalled/failed storage, full/Stop/Cancel/error cleanup,
worker handle closure, PostFX ownership and late-result cancellation. The older
deterministic VM harness now injects the real storage helper instead of leaving a
stripped import undefined; its encoder-start polling is bounded rather than an
infinite wait. All eight original cases/assertions remain, with the exact source
archived in documents/tests/export-deterministic.pre-t19c2.mjs.snapshot. Initial
harness failures/interrupted polling are retained in logs/t19c2, not rewritten as
passes. The production TypeScript build uses erasable class fields; no dependency
or compiler policy was changed.

Validation: the complete run has2087 cases /2078 pass /9 failures, all matching
the retained baseline names/assertion messages; zero skips/cancellations. This run
predates the final cleanup memoization/reused-backend guard. All17 affected files
then pass245/245 on final source, including the additional guard case. The union
has2088 distinct cases, not a second complete or all-green run. Build and diff
checks pass. There are213 active files /276 test-tree identities:274 prior
identities remain byte-exact, and the reviewed harness predecessor is archived.
The final source inventory has414 build inputs. Full code-only Graphify refresh
contains943 files /8970 nodes /19087 canonical edges /21688 raw edges, with zero
dangling canonical endpoints and no LLM use. Changed-document checks verify139
local references and the resource-section heading. Receipts stay with task logs.

Commands (Node25.2.1/npm11.6.2; guarded Node publisher replaces Bun-based deploy):

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-concurrency=2 tests/export-resources.test.mjs tests/export-preparation.test.mjs tests/export-isolated.test.mjs tests/export-opus-muxer.test.mjs tests/export-lifecycle.test.mjs tests/export-deterministic.test.mjs tests/export-capability.test.mjs tests/postfx-fragmentation.test.mjs tests/contracts.test.mjs tests/gameplay-purity.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-changes.test.mjs tests/wormhole-frame-context.test.mjs tests/wormhole-exact-frame.test.mjs tests/wormhole-raster-pass.test.mjs tests/visual-mode-transition.test.mjs tests/styles-deterministic.test.mjs
git diff --check
```

Actual browser/full-prefix decode, long4K and physical memory/Quest measurements
are deferred to the agreed T19c3 matrix; none is claimed by Node mocks. No browser
was driven in this slice. No analyzer/lab/Python inputs or dependency changed,
so Python was not rerun or counted as current coverage. diff_export.ps1 is skipped:
focused diffs, protected identities and the handoff receipt suffice without its
unrelated fetch/artifact. Exact commands/results and release identity are retained
in logs/t19c2/handoff.json. Pause after commit/push/deploy for manual acceptance;
do not start T19c3 or the later interaction/WASM work automatically.

Manual check: export the same Isolated track/settings and compare appearance,
audio/end timing and Stop-prefix playback; Cancel/retry and two concurrent tabs
must not invalidate each other's results. Copy diagnostics now includes resources.

### T19c1 - exact capability trial and export planning limits

Production MVP isolated export now requests `preflight:true`. A dedicated worker
checks the exact width/height/fps/bitrate/rate-control/latency configuration using
VideoEncoder.isConfigSupported, and stereo Opus support at the actual sample
rate. VP9 profile 0/8-bit level is selected from picture size (32px edge padding),
luma rate, bitrate and maximum dimension; 4K60 requests level 5.1 instead of the
legacy level 1.0 string. VP8 is an explicitly reported alternative at unchanged
dimensions/fps if the preferred candidate is unsupported or fails its trial.
Neither resolution nor fps is silently reduced. Hardware acceleration is not
claimed: the browser can select a software encoder.

The trial creates one private output-size OffscreenCanvas, encodes three coloured
frames and optional stereo PCM, flushes both codecs and finalizes a bounded WebM.
Exactly three video packets and required audio output are checked. Trial mux
output is capped at 8 MiB and codec flush at 10 seconds/candidate; the host's existing
30-second operation deadline bounds the entire preparation, including capability
queries. All trial frames/AudioData/encoders/canvas references are released in
finally. Probe packets never enter the saved file or advance its frame-zero clock.
Only after the probe succeeds does the worker create the normal OPFS file and
configure the verified encoder. `export_prepared` gates real host frames/bitmaps;
Cancel/Stop/failure during that wait terminates the worker without captured frames.
The synthetic trial is not a decoded-file, real-Wormhole quality, throughput,
whole-job memory or long-duration guarantee.

The frozen snapshot/private renderer is still prepared before the worker trial;
avoiding that preparation cost on unsupported devices is not delivered here.
Compatible/Studio and older direct API callers omit the new flag and retain their
legacy path. Generic capability reports still carry their old device heuristic;
a tagged heuristic alone no longer disables 4K in the production MVP. Explicit
non-heuristic restrictions and missing WebCodecs remain respected.

MVP Export adds `Export memory limit`: Auto (up to 2 GiB), 512 MiB, 1 GiB, 2 GiB.
This controls isolated snapshot admission; it is not a physical-memory allocation,
free-RAM measurement, or guarantee about browser/GPU/codec peak use. Auto uses a
fixed 2 GiB application ceiling and displays a high-demand notice above 1 GiB.
It deliberately does not pretend to detect all 32 GB or current available RAM.
The existing estimate still includes PCM, descriptor copies, five pixel surfaces
and codec headroom; reducing this estimate/actual copies belongs to T19c2.
Manual limits are validated before PCM access. Rejection shows both the estimated
MiB and selected ceiling and offers an actionable alternative. The setting uses
`plexus.exportMemoryLimit`, is locked during jobs, ignored by Compatible and is
included in Copy. Invalid/unavailable storage uses Auto/session defaults. The
selected codec and probe dimensions/count/bytes are copied with the final isolated
profile. Source of truth: ExportSnapshot, ExportPreparation, worker and MVP dialog.
The added controls reuse the existing select styling; the export modal scrolls
within the viewport and its action row wraps on constrained screens.

Validation adds ten cases in `tests/export-preparation.test.mjs`: known VP9 level
boundaries, exact trial configuration and teardown, VP8 recovery, missing APIs,
unsupported video/audio, empty output/stalled flush, budget-before-PCM, MVP
storage/Copy/locking/device-heuristic handling, real backend preparation gating,
Stop/Cancel/errors and a worker-through-OPFS integration using controlled codecs.
These are not hardware codec tests. All earlier test sources remain active; the
browser fixture was extended with resolution selection and production preflight,
retaining its exact predecessor in
`documents/tests/export-isolated-smoke.pre-t19c1.html.snapshot`.

Final automated results: full2074 /2065 pass /9 failures matching the retained
baseline names and assertion messages exactly, with zero skipped/cancelled cases.
The final affected export replay passes62/62. The full run and replay overlap;
they are not summed or presented as a second all-green suite. The last change
after those functional inputs was scoped modal scrolling/wrapping CSS, followed
by a successful build. Earlier Node test sources remain unchanged;273 previous
test-tree identities are byte-exact, and the one changed browser fixture retains
its exact archive. There are212 active files /275 test-tree identities and413
production build inputs. Code-only Graphify refresh:941 files,8934 nodes,19023
canonical edges,21620 raw edges, zero dangling canonical endpoints; no LLM.
Changed-document checks verify139 local links and the new resource-section anchor.

Commands (Node25.2.1/npm11.6.2; no dependency installation):

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-concurrency=2 tests/export-preparation.test.mjs tests/export-isolated.test.mjs tests/export-lifecycle.test.mjs tests/export-capability.test.mjs tests/export-opus-muxer.test.mjs
git diff --check
```

The complete suite took909.2 seconds while concurrent validation/AST work was
running; this is regression runtime, not an export performance measurement.
Release uses the existing guarded Node prepare/publish/verify workflow because
the package deploy script is Bun-dependent.

Browser automation could not create the Chrome test tab: two creation timeouts,
with an intervening lookup confirming that no test tab existed. No native/headless
workaround or repeated retry loop was used. The built fixture serves HTTP200;
this is HTTP-only evidence, not a passed 4K export. Actual full/prefix/Cancel and
decoded-image/stereo acceptance remain manual-pending. Node/build/counts,
identities, known failures, exact commands and release verification are recorded in
`logs/t19c1/handoff.json`. No analyzer/lab/Python/dependency changed; Python is not
rerun or counted as current coverage. `diff_export.ps1` is skipped because focused
diffs and retained identities cover this bounded handoff without its fetch/artifact.

Primary references: [WebCodecs configuration checks](https://www.w3.org/TR/webcodecs/#dom-videoencoder-isconfigsupported),
[WebM VP9 levels](https://www.webmproject.org/vp9/levels/),
[VP9 registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/).

Manual check: choose Isolated Wormhole, Auto and 4K on the reference track; verify
the preparation/result and stereo/video duration. Try 512 MiB for a demanding job,
then a larger limit, Copy/reload, Stop-prefix and Cancel/retry. Default Compatible
remains available. No long-job or RAM-guarantee claim closes T19c2/T19c3.

## Historical T19a and T19b delivery

Implemented 2026-10-29. One integration owner covers export, worker ordering and
Studio/MVP controls. The following historical T19a section describes the lifecycle
prerequisite. The T19b section records the additional opt-in isolated MVP path.

## Delivered behavior

`WebMExporter` reserves one job synchronously, before asynchronous capability
detection. That same reservation remains until `startExport()` settles after
backend teardown. Stop and Cancel are latched, duplicate commands are harmless,
and Cancel overrides an unfinished Stop. No backend is started after a pending
preparation was cancelled or stopped. Stop before any submitted frame reports
`No video frames were captured before stopping.` rather than returning empty video.
Output configuration is copied before the first await. This small copy is not the
musical/PCM/preset snapshot proposed in ADR-012.

The reservation's object identity gates progress. Cancel suppresses an already
queued result and its download even if a backend resolves rather than rejects.
Neither the MVP facade nor Studio controls releases its active-job UI early.
MVP keeps its existing discard confirmation, latches the buttons and displays
preparing/stopping/cancelling/result/error text. The controls unlock after cleanup.
Normal output still uses the public `Promise<Blob>`/Stop/Cancel backend API.

`WebCodecsBackend` places allocation inside try/finally, restores its owned p5
loop once and disposes the graphics target on failed preparation as well as normal
completion. Cancel terminates the encoder worker and interrupts media, bitmap and
finalization waits. Late-created bitmaps are closed instead of transferred.
Media event listeners and wait timers are removed on completion/interruption.
Worker errors wake pending work. Browser operations, encoder drain and queue
backpressure each have a 30-second stalled-operation deadline, not a 30-second
whole-export limit. Stop interrupts frame production, but does not abort the
finalization that must save its prefix. At most two frames await worker admission
acknowledgement; encoder queue telemetry remains a separate pacing signal.

The existing worker serializes start/frame/finalize commands. Asynchronous OPFS
initialization therefore cannot be overtaken by frame admission or finalization.
The dedicated worker's frame acknowledgements mean encoder input admission, not
that compressed output has already been flushed. Finalize flushes accepted video
and audio after all preceding commands. Prefix PCM retains the existing half-open
sample slices `[floor(i*sampleRate/fps), floor((i+1)*sampleRate/fps))` and video
timestamps `round(i*1e6/fps)`. The playback AudioBuffer is never transferred.

## Limits and next slice

The renderer still uses p5 `noLoop`, `__plexusExportTarget` and global
`State.isExporting/exportTime`. This slice does not enable unrestricted editing,
new-track loading or playback during export. There is no minimizable background
job panel, new format, new setting, or new worker protocol/ID envelope. Dedicated
worker ownership and coordinator object identity guard the current path; the
versioned transport remains a later T19 integration.

T19b must capture a validated immutable musical snapshot and private PCM/resource
lease, then wire a separate render context and a truthful capability/memory gate.
T19c can expose background editing, persistent controls/navigation protection and
complete multi-minute full/prefix/cancel acceptance. Do not mark ADR-012 fully
implemented or advance to T20 on the basis of these lifecycle repairs. OPFS
job-specific cancellation cleanup and storage policy also remain part of that
resource-lease migration; the existing temporary-file policy is not redesigned here.

## Validation

- `npm run build`.
- `node --test tests/export-lifecycle.test.mjs tests/export-deterministic.test.mjs tests/export-capability.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-changes.test.mjs tests/contracts.test.mjs`.
- Full cumulative `npm test -- --test-reporter=tap --test-concurrency=4` with fresh
  workspace-local TEMP/TMP. Previous active tests/fixtures remain unchanged.
- `tests/browser/export-lifecycle-smoke.html` uses the actual coordinator, backend,
  worker, OPFS and MVP dialog with synthetic stereo PCM and canvas. Full two-second
  output, a twelve-frame prefix from a two-minute source, and Cancel are separate
  checks. Saved results must decode with stereo audio and a nonblank 720p frame.
  This fixture is not a full-renderer or two-minute completed export claim.

Exact outcomes, browser accessibility limits, source/test identities and release
verification belong in `logs/t19a/handoff.json`. A served test page alone is only
HTTP evidence. Stop after deployment for manual export testing.

## T19b - opt-in isolated MVP Wormhole export, 2026-10-29

MVP Export > Rendering offers `Compatible (current)` (default) and
`Isolated Wormhole (preview)`. The device/job choice uses `plexus.exportRuntime`
localStorage and Copy settings & diagnostics. Studio remains compatible. The
MVP still pauses playback and keeps its modal locked during export; minimizing,
free editing and navigation while exporting are T19c, not delivered behavior.

Composition injects `WormholeExportRuntime` through shared type-only contracts.
The facade captures a resolved plan, cached preset payloads, raw seed/macros/
boosts/semantic policy, render analysis, music display/sky and output controls.
Snapshot v1 includes the audio content SHA-256, analysis and preset hashes,
original morph scale, frame dimensions/fps and title/watermark. Configuration and
plain data are copied before hashing awaits. The scaled plan is not scaled again
inside the private context. Load/plan/session/tuning/morph revision changes during
hashing reject preparation before constructing the renderer.

`ExportSnapshot` imports no State, audio, UI or visuals. It admits resources
before PCM copying and owns one copied Float32Array per mono/stereo channel;
playback buffers are never transferred. A 384 MiB engineering estimate includes
PCM, doubled descriptor size, five pixel surfaces and 64 MiB codec headroom.
This is not a measured browser/process peak-RAM guarantee or Quest budget.
Invalid clocks, nonfinite data/PCM, cycles, unsupported dimensions/fps and missing
presets fail visibly. The plain descriptor is deeply frozen; private typed PCM
views are borrowed by trusted encoding code and released with the lease.

WebMExporter owns the reservation, abort signal and runtime/PCM lease through
backend teardown. The backend borrows it. Failed preparation/capability/render,
Stop before frame zero, Cancel and normal completion all release ownership.
Cancel still wins over a queued successful result. The isolated branch never
reads/writes live State, p5 or AudioEngine; dependency proxies assert this.
The private source/output and injected-state PostFX reuse existing rendering
logic. The final composite receives PostFX once. No preset fetch or second
musical analysis is introduced. Existing default PostFX state readers are intact.

The export sampler advances canonical 60 Hz ticks sequentially at supported
30/60 output fps. Repeat requests do not advance simulation; backward requests
and presentation changes reset/replay. Tests compare identity draw commands and
scalars against the retained arbitrary-frame rewind oracle, including gaps and
scaled transitions. Sixty-one consecutive 60fps requests perform 61 canonical
draws rather than replaying every prefix. This is an operation-count improvement,
not a measured whole-job speedup or new WASM kernel.

Optional profile output distinguishes snapshot/hash/renderer preparation,
render requests, bitmap work, queue waits, finalize waits and worker
preparation/input-window/video flush/audio flush/mux-file finalization. Intervals
can overlap; input-window time includes host gaps. Synchronous encode-call
telemetry is submission cost, not asynchronous codec CPU time. Copy includes
configuration and the last report, never PCM or the full analysis. No comparative
browser throughput, peak memory or 5+ minute performance gate has passed yet.

### Opus correction found during actual output inspection

A real two-second Chrome output decoded to 1.94 seconds: the old muxer hard-coded
80 ms CodecDelay while generating zero Opus pre-skip. It now retains the encoder's
valid stereo OpusHead and derives CodecDelay from pre-skip at 48 kHz; SeekPreRoll
remains the separate 80 ms value. The inspected encoder reported 312 samples,
or 6.5 ms; this value is read, not hard-coded. Missing optional raw-Opus
description uses an explicit zero-pre-skip header. Invalid headers are rejected.
One final audio packet is held for DiscardPadding to the submitted sample boundary.
Streaming waits for audio configuration before writing the header and buffers at
most 16 MiB of earlier clusters. This does not accumulate the whole output in RAM.
An audio encoder failure fails isolated export rather than silently saving video.

Primary references: [WebCodecs Opus registration](https://www.w3.org/TR/webcodecs-opus-codec-registration/)
and [Matroska A_OPUS mapping](https://www.matroska.org/technical/codec_specs.html).

### Validation and open gates

- `npm test -- --test-reporter=tap --test-concurrency=4`: 2060 cases, 2051 pass,
  9 failures matching the retained baseline names and assertion messages exactly,
  no skips/cancellations. This run precedes the last Opus/audio-error and revision
  refinements. All 15 affected files then replayed on final source: 221/221 pass.
  The union includes 26 new cases; this is not a second complete all-green run.
- `npm run build` passes (existing chunk-size warning); `git diff --check` passes.
  Full commands, inventories and omissions: `logs/t19b/validation.json`.
- `tests/export-isolated.test.mjs` has 23 cases and
  `tests/export-opus-muxer.test.mjs` has 3 independent EBML/Opus byte checks.
  Existing lifecycle assertions are unchanged. Its bounded polling helper now
  yields up to 2000 x 1 ms instead of 200 setImmediate spins, avoiding CPU-load
  dependent false timeouts. The exact predecessor is retained in
  `documents/tests/export-lifecycle.pre-t19b.mjs.snapshot` with identities in the
  local validation receipt. No old golden or result was overwritten.
- The real-browser fixture is `tests/browser/export-isolated-smoke.html`:
  synthetic stereo, private renderer, coordinator/worker/OPFS, full/prefix/Cancel,
  decode duration and nonblank video assertions. Opus metadata was inspected and
  corrected duration/video metadata observed. The final rerun was interrupted:
  Computer Use could not safely determine the current Windows browser URL.
  No final browser full/prefix/Cancel or pixel pass is claimed. No screenshot,
  long-duration or physical Quest proof exists for this change.
- No analyzer/lab/Python inputs, dependencies or algorithms changed; Python was
  not rerun and historical results are not counted as new coverage. No dependency
  was added. Node/npm ran validation; guarded Node release tooling replaces the
  Bun-dependent package deploy script. `diff_export.ps1` was skipped: focused
  diffs/inventories provide this handoff without its unrelated fetch/artifact.
- Retention: 270 previous test-tree identities remain byte-exact; the one reviewed
  helper replacement has its exact archived predecessor. There are now 211 active
  test files / 274 test-tree identities and 412 production build inputs. Full local
  code-only Graphify refresh: 939 files, 8905 nodes, 18974 canonical edges,
  21564 raw edges and zero dangling canonical endpoints; no LLM extraction/labels.
  Documentation checks cover 174 local links and all eight root-contract
  inheritance declarations. Generated graph/logs stay ignored.

Manual handoff: compare Compatible and Isolated on a short Wormhole track; verify
title/preset/morph/PostFX and stereo duration, Stop-prefix playback and Cancel
without download. Check saved choice and Copy. Default promotion is withheld.
T19c follows manual feedback: real multi-minute/resource/latency evidence,
job-specific OPFS cleanup and versioned commands, persistent/minimizable controls
and only then background editing. Conditional WASM remains evidence-gated below.

## Scheduled export acceleration - user direction, 2026-10-29

The user accepted T19a and requested that professionally justified WASM export
acceleration be included in the current work. T20 already included an FFmpeg/WASM
comparison; the following makes profiling and its decision gate explicit during
T19 instead of postponing all performance work until a new container is added.
This is an accepted work schedule, not an implemented backend or measured speedup.

| Step | Scheduled owner/task | Deliverable and decision |
| --- | --- | --- |
| Establish real costs | T19b, export/private renderer integration owner | Optional job-local stage measurements in the isolated path: snapshot/PCM copy, preparation, simulation, raster/PostFX/composition, bitmap/readback/transfer, encoder admission/queue/output/flush, mux/OPFS and usable result. Baseline and candidate share one harness |
| Fix avoidable work | T19b before any kernel port | Check sequential exact sampling and replay/checkpoint cost, repeated allocations/copies and queue waits. Preserve the existing canonical arbitrary-frame reference; prove monotonic/repeated/backward/seek/fps parity before replacing replay |
| Test a candidate | T19c if a measured CPU bottleneck is already isolated; otherwise T20a | A small bulk-array WASM kernel only where it can improve the whole job; prototype stays outside the default production path. Existing GPU raster/WebCodecs remain comparison baselines |
| Evaluate codec/format needs | T20a after its format decision | Compare direct browser WebCodecs plus muxer, compatible remux, optional ffmpeg.wasm and available server-native FFmpeg as distinct capabilities. Never assume WASM is the fastest encoder or require a second lossy transcode |
| Promote or reject | Within the task that produces evidence | Production integration only after whole-job speed, parity/quality, memory, cancellation and fallback gates pass. A rejected candidate is recorded and does not block the main export migration |

Two inspected starting facts must not be mistaken for measurements. In
`export.worker.ts`, `totalEncodeTimeMs` times the synchronous `encoder.encode()`
call; it does not measure asynchronous codec completion. T19b must name this
enqueue/submission cost honestly and measure output/flush separately, without
summing overlapping render/encode stages into a fictitious total. In
`WormholeCanvasSource.renderExact`, each request rewinds and replays canonical
60 Hz ticks from song zero. Repeating this for all frames of a long export can
cause quadratic replay work. This reference is not yet the current export path;
do not silently wire it into long exports or claim a current export bottleneck
without profiling. Retain it as the independent correctness oracle for a future
efficient sequential/private sampler.

Freeze fixture identities, output settings, code/build hashes, browser/device,
trial order and quality tolerances before comparison. Start with bounded profiling
at 720p/1080p and a short clip plus dense Wormhole content; expand only a viable
candidate to the existing 5+ minute, aspect, 4K/capability and concurrent-editor
acceptance matrix. Use at least three alternating paired full-job trials in each
claimed target stratum; report every ordered trial, cold load/compile, warm reuse,
copy costs and output-finalization time. Keep startup and warmed measurements
separate. Kernel microbenchmarks and Node mocks are not browser export speed proof.

Use the existing proposed WASM promotion target: >=15% lower median whole-job time
in declared target strata and <=5% slowdown in protected strata, including cold
overhead where claimed. In addition, the candidate must stay within the same
predeclared export admission/peak-memory and UI-control budgets. Where reliable
memory counters are absent, mark that gate unmeasured rather than asserting a RAM
guarantee. No flaky speed threshold belongs in the normal CI test suite.

For a numeric-only port, preserve scalar/event/frame identity within tolerances
chosen before the candidate run. For a different encoder, compare decoded frame
content, timestamps, A/V sync and predeclared quality criteria; hardware-encoded
byte equality is not required. Full and Stop-prefix files must decode; Cancel and
missing/failed WASM initialization must clean up and retain the working backend.
Keep download/compile failure, stale job output, duplicate controls and worker
termination in the regression suite. Any user-facing backend choice uses the
existing menu/storage/Copy policy and is independent of artistic presets.

WASM stays lazy and worker-owned with bounded resident buffers and a documented
bulk ABI. Prefer scalar/single-thread first. SIMD/threads require capability checks
and measured value; SharedArrayBuffer/COOP/COEP changes require a separate asset,
cross-host and XR compatibility gate. Check the exact chosen FFmpeg build's
libraries/licenses and output memory/OPFS behavior before adding dependencies.

Primary references, inspected 2026-10-29:

- [W3C WebCodecs hardware acceleration](https://www.w3.org/TR/webcodecs/#hardware-acceleration): browser-native codec access can use hardware; the preference is a hint, not proof that hardware is in use.
- [ffmpeg.wasm performance](https://ffmpegwasm.netlify.app/docs/performance/): its published, older test compares WASM with native FFmpeg, not this application's WebCodecs pipeline. It is a reason to measure, not a transferable speed ratio.
- [ffmpeg.wasm FAQ](https://ffmpegwasm.netlify.app/docs/faq/): threading has CPU/memory tradeoffs and the core's license follows its FFmpeg/library build. These facts do not justify replacing the existing backend without application evidence.
