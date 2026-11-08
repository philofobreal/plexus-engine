# Staged export lifecycle

Current planning update, 2026-11-07: the requested
[cross-host Wormhole rendering epic](../audits/cross-host-wormhole-rendering-epic.md)
supersedes the export-only next-spike schedule. Dashboard and MVP playback and
all existing exports will share a worker/GPU core, with distinct preview and
exact-frame scheduling. WH-01 is the first implementation task; T20c2's GPU
experiment is WH-02 and production export integration is WH-06. This is a plan,
not a delivered backend or a reversal of MVP's Isolated Wormhole retirement.

WH-06a delivers the [job-bound exact resolved-input source](../audits/wormhole-wh06a-exact-source.md).
It negotiates full dimensions/30-or-60 fps and exact identities, copies inputs,
bounds request/image ownership and returns pixel-stable repeats. Exact Float32 GPU
material with native Canvas layer composition passes full-size alpha/dense gates;
startup Canvas fallback is complete and mid-job GPU loss fails closed. This part
does not change product export, codec, audio or storage. **WH-06b is the next
manual-gated task**: connect its completion barrier and preserve integrated job
controls and output acceptance. WH-07 adds Takarékos/Turbó after that handoff.

WH-05 delivered [dashboard activation and matched worker/native composition](../audits/wormhole-wh05-dashboard-composition.md).
Both live hosts now expose the same optimized preview. Captured-time crossfades
and PostFX do not change exact export scheduling. WH-06 is next after manual
acceptance; WH-07 adds the selectable Takarékos/Turbó policy. There is no new full
export speed claim, codec/bit-depth change or retired isolated MVP mode.

WH-04 delivered [MVP GPU material in the existing Offscreen worker](../audits/wormhole-wh04-mvp-gpu-session.md),
with owned frame snapshots, bounded submission and image-paired PostFX. Compatible
and worker fallbacks remain. Product export still uses its accepted synchronous
renderer; shared GPU export is WH-06 after WH-05 dashboard/composition. The
retired isolated MVP mode is not restored.

WH-03b delivered [song-time envelopes and canonical exact request scheduling](../audits/wormhole-wh03b-canonical-time.md).
Thirty/sixty-fps exact requests reuse forward simulation; repeated bitmap requests
redraw. The existing rewind oracle is retained. Preview policy is still separate;
this does not promote the retired MVP isolated mode or activate the GPU export.
WH-04 MVP GPU playback is delivered below; WH-05 is delivered above. WH-06 owns product export integration.

WH-01 delivered the [common frame contract and scalar kernel baseline](../audits/wormhole-wh01-contract-baseline.md).
Its raw inputs, repeatable images and fixed quality gates prepare the next WH-02 GPU
spike; no active export render path, codec, bit depth or speed profile changed.
Production integration is still WH-06. The existing Compatible path and accepted
10-bit quality remain the control; internal exact sessions will not restore the
retired Isolated product mode.

WH-02 now supplies the [shared GPU material laboratory and quality decision](../audits/wormhole-wh02-gpu-spike.md).
Reference IIR bloom and mixed precision meet the fixed image gates; full GPU line
coverage remains experimental, so the qualified laboratory profile keeps Canvas
lines inside the worker. This demonstrates the kernel, not accelerated production
export. WH-03a/03b prepare the common frame/timing seam before WH-04/05 playback
and WH-06 export integration. Existing MP4/WebM bit depth and defaults are unchanged.

WH-03a now shares [frame preparation arithmetic and a resolved data view](../audits/wormhole-wh03a-frame-preparation.md)
between the existing host and private context. Gain/projection order and borrowed
analysis ownership are preserved; the host worker still consumes resolved input
without a second director. Export job/codec/PCM/Stop/Cancel behavior is unchanged.
WH-03b timing and WH-04 MVP playback are delivered; WH-05 dashboard integration is delivered above.

## T19c resource follow-up - staged for quota-aware delivery

User direction, 2026-10-29: replace the premature fixed 384 MiB refusal with real
output-capability checks and configurable admission; deliver bounded subtasks and
pause after each deployment for manual feedback. No new WASM exporter is implied.

| Slice | Scope | Handoff |
| --- | --- | --- |
| T19c1 | Exact worker configuration/probe, memory policy and MVP controls | Accepted; real short/long 4K evidence in T19c3 |
| T19c2 | Reduce copied analysis/PCM overhead where ownership allows; review surface/queue/storage lifetimes | Accepted; ownership and pooling retained |
| T19c3 | Multi-minute/large-output, decoded full/prefix sync, cancellation/retry and resource/performance evidence | First real 4K acceptance/cache slice below; manual handoff and remaining gates explicit |

The original T19c persistent/minimizable controls and background-editing acceptance
remain scheduled after these resource prerequisites. T20 and conditional WASM
promotion do not advance automatically. T15 remains skipped.

### T19c3 - real output acceptance and explicit cache release, 2026-10-31

The user accepted T19c2. Export owns the document-local finished-file registry;
the MVP facade serializes cleanup against export, and its dialog exposes the
action. `Clear this tab's finished exports` requires confirmation that downloads
have finished. It removes only registered ended jobs, including retryable failed
cleanup. Counts and scope are included in Copy. Active jobs, files from other
tabs and previous visits are excluded; there is no directory enumeration, timer
based deletion or automatic orphan sweep. Downloaded copies are unaffected.
The registry retains names/cleanup leases, not output blobs or PCM. Cleanup
snapshots its candidates before awaits, coalesces each lease's removal and keeps
failures available for retry. Export and duplicate cleanup are locked in both
the facade and the view. This action is not a persistent artistic setting.

New jobs use `plexus_export_job_v1_*.webm`, outside the old worker's global
`temp_plexus_export_*` sweep namespace. Validation still accepts old typed
requests. This protects new results from an older cached worker's prefix sweep;
it does not grant the new host ownership of unknown historical files. Reload or
process termination can still leave orphans. A durable cross-tab ownership and
quota manager is a separate remaining gate, not an inferred free-storage promise.

The existing browser fixture now selects two-second or five-minute synthetic
stereo input and checks full output, Stop-prefix, Cancel and a fresh export after
Cancel. The independent acceptance reader in `tests/helpers/inspect-export-webm.mjs`
walks actual EBML blocks, checks every video timestamp against the frame clock,
Opus packet continuity, header pre-skip/CodecDelay and final DiscardPadding.
The predeclared container tolerance is 1 ms; decoded audio duration uses
1/60 s + 2 ms. Decoded video size and nonblank frames are checked near the start,
middle and end. Presented-frame callbacks synchronize pixel reads after seeking.
The reader is intentionally limited to this exporter's un-laced VP8/VP9 + Opus
layout, not a general-purpose demuxer. Hand-assembled EBML fixtures test its
expected clocks and rejection of gaps, duplicates, wrong endpoints and truncation.

The acceptance reader caps a whole-file copy at 64 MiB; this is a test bound,
not a production export limit. Whole-file audio decode adds a private decoded
PCM buffer and video checks allocate a readback canvas. Those test costs are
outside the export's reported whole-job time and must not be presented as exporter
peak RAM. Reliable process/GPU/free-RAM counters remain unmeasured. This synthetic
low-density fixture and an empty performance plan do not prove dense preset parity,
No Good musical accuracy, physical Quest performance or every browser's codecs.

Actual IAB/Chromium output: the five-minute 3840x2160/60 fps run passes with
18,000 video packets and 15,001 Opus packets, all inspected for continuity.
Its 62,636,619-byte output decodes to stereo 299.9995 s; container audio ends at
300000 ms. Nonblank frames decode at 0.5, 150 and 299.9 s. The 12-frame Stop-prefix
and Cancel-then-12-frame retry decode to 0.1995 s with a 200 ms container endpoint;
Cancel at 8 frames publishes no result and reports owned storage removed.
Earlier retained File headers remain readable after subsequent jobs. This is
same-document cross-job evidence, not a cross-tab deletion/lock experiment.

The full job takes 1,021,160.9 ms (~17 min 1 s) while cumulative Node tests and local
Graphify work overlap it. This is an observed loaded run, not an isolated benchmark
or speedup comparison. Render-request wall time is 565343.1 ms, queue wait 328554.6 ms,
bitmap work 15023.3 ms and finalization wait 157.6 ms. Worker input-window intervals
overlap host work; these values must not be summed into CPU/GPU time. Two audio
buffers serve 18,000 frames with 17,998 reuses; the pool ceiling is 12,800 bytes.
Admission estimates 381,865,828 bytes under Auto's 2 GiB planning ceiling; that is
neither measured peak RAM nor a detected/reserved amount of the reported 32 GB RAM.
The remaining cost justifies profiling private raster/queue/presentation waits
before selecting a WASM kernel, rather than claiming this run is fast.

The long run uses the retained `logs/t19c3/long-fixture.html` build; later fixture
changes add a real dialog, progress text and visible decoded previews. Production
renderer/worker/storage source is unchanged between those runs. Raw results,
initial failed attempts and final replay/validation receipts live in logs/t19c3.
No WASM export kernel or default-backend promotion is introduced.

Validation: `npm test -- --test-reporter=tap --test-concurrency=4` runs all 215
active files: 2100 cases, 2091 pass, nine exact retained baseline failures and no
skips/cancellations. All 19 affected files also pass 258/258. A final two-rule
dialog-layout CSS refinement receives a 61/61 export/UI replay and final
`npm run build` plus browser layout verification. `git diff --check` passes.
The complete run precedes the final composition correction: leaf construction
must not invoke the cache callback before MvpUI has wired its controller. Reads
now begin on dialog open; a new regression pins that order. The final 258-case
replay covers this correction, giving 2101 distinct cases across the runs, not a
second complete run. The eight earlier cache test bodies stay unchanged; their
exact predecessor is retained in documents/tests/export-cache.pre-t19c3-composition.mjs.snapshot.
The actual final production MVP starts, loads the two-second synthetic WAV,
finishes analysis and completes a 4K isolated export through the real dialog.
The download is observed and copied to logs/t19c3/mvp-4k-final.webm: 7,251,453 bytes,
120 video packets, 101 Opus packets, continuous timestamps and a 2000 ms audio
endpoint. This downloaded artifact receives independent packet inspection, not
a second full codec decode. The dialog correctly changes from zero to one owned
finished file. File-chooser/automation delays are not export-throughput evidence.
Thirteen new cases are added; 275 prior test-tree identities remain byte-exact and
the expanded browser fixture's predecessor is archived. The current tree contains
279 test sources/helpers/fixtures and 414 production inputs. Full code-only
Graphify: 946 files, 9004 nodes, 19145 canonical edges, 21750 raw edges, no dangling
canonical endpoints or LLM extraction. Python/lab tests are not rerun because
their source/contracts/inputs are untouched. Guarded Node release tooling replaces
the Bun-dependent package deploy script; no dependency is installed. Detailed
commands, baseline assertions, omitted gates and receipts: logs/t19c3.

Primary commands (Node 25.2.1 / npm 11.6.2):

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap --test-concurrency=2 tests/export-cache.test.mjs tests/export-isolated.test.mjs tests/export-preparation.test.mjs tests/export-lifecycle.test.mjs
node logs/t19c3/check.mjs
git diff --check
```

The exact 19-file affected-run command is retained in
logs/t19c3/targeted-final-command.txt. The browser fixture is built with local Vite
and served by the existing analyzer-lab Python interpreter's `http.server`; this
uses no new dependency or Python test run.

Manual handoff: choose MVP Export > Isolated Wormhole > Auto > 4K; inspect a saved
full track and Stop-prefix with audio, Cancel/retry, Copy plus actual OS paste.
After downloads finish, confirm `Clear this tab's finished exports` and check the
remaining count. The actual destructive browser action and live file-lock behavior
remain manual. Automated clipboard readback did not return the dialog JSON, so
only Node's Copy payload checks and visible dialog state are claimed. Stop for
feedback before further T19 interaction work. Reliable peak RAM, dense-scene image
parity, cross-tab locks, durable orphan/quota policy and physical Quest remain
explicit acceptance gaps; this is not complete ADR-012/T19 acceptance.

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

## T19c4 minimizable MVP export panel (2026-11-04)

The user requested the next scheduled delivery after reporting stable mobile export.
The MVP export dialog can now minimize into a compact panel and reopen through Details.
The same progress, status and Stop & save / Cancel controls stay attached to the running
job. The result remains visible in the compact panel until dismissed. Progress and late
preparation messages respect a pending Stop or Cancel.

MvpUI owns the active presentation job, workspace lock and one download per completion.
The facade gates preparation and diagnostic callbacks by exporter identity. It keeps
preparation timing local to that exporter. The active job keeps the rest of the MVP
workspace inert until cleanup settles, and the existing unload guard also protects
a clean page during export. Reload, tab close and navigation prompts depend on the
browser. Background editing, playback and track replacement are the next T19 delivery.

Validation uses Node 25.2.1 and npm 11.6.2. The production build and 78 targeted
tests pass, including three new panel, unload and job-lifecycle cases. The local
browser fixture builds with the production styles and returns HTTP 200. Both the
in-app browser and Chrome timed out attaching before interactive verification.
The cumulative result and retained baseline assertions are recorded in
`logs/t19c4/validation.json`. Previous test identities are retained byte for byte.

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap --test-concurrency=3 tests/mvp-export-panel.test.mjs tests/export-lifecycle.test.mjs tests/export-cache.test.mjs tests/export-isolated.test.mjs tests/export-preparation.test.mjs tests/mvp-unsaved-changes.test.mjs
git diff --check
```

Manual handoff on desktop and mobile:

1. Start an export, minimize it, verify changing progress and reopen Details.
2. Stop & save from the compact panel and confirm one playable partial download.
3. Start again, confirm Cancel and check that the workspace unlocks without a download.
4. During another run, attempt to reload, choose to stay, and verify the same export
   continues on browsers that present the unload prompt.

## T19c5 background work during isolated export (2026-11-04)

The user manually accepted T19c4. In the MVP, start Isolated Wormhole export and
minimize the panel. The editor becomes interactive after the first submitted frame.
The job keeps its copied soundtrack and frozen analysis, automation, presets and
tuning while the editor plays, edits or loads a different track. The existing
unsaved-edits prompt still guards replacement. Reopening Details temporarily locks
the editor. The compact panel keeps Stop & save and Cancel available. Compatible
keeps the workspace locked until its job settles. Entering native fullscreen
during an active job is disabled so its controls stay reachable.

MVP waits for any missing journey presets during cancellable preparation and
rechecks the captured revision before and after snapshot hashing. It rejects
a changed revision or an unavailable preset. A replacement track can restore its
own preferred resolution for the next job. Copy settings & diagnostics includes
`diagnosticExport` when a profile exists, so that profile can be read with the job
settings that produced it. No track audio or session data is written by the panel.

For manual acceptance, start a 1080p export of a recognizable song, minimize it,
play and edit the live preview, then replace the track. Confirm the unsaved-edits
dialog, the original audio and visual journey in the exported file, and a separate
retry with Stop & save or Cancel. Repeat with a long 4K track on supported hardware.

A local Chromium test exported the same eight-second No Good excerpt at 1080p60
twice, with the full MVP and isolated renderer. The second run played and edited
the live track, confirmed replacement, and played a Scienide excerpt before the
export finished. Both jobs submitted 480 frames with the same frozen analysis ID.
Both decoded at 1920×1080, with 7.9995 s of audio and correlation 0.99335 to the
original channel over the sampled interval. Downsampled first frames passed a
mean absolute pixel-difference tolerance of 4 on the 0–255 scale.

| 1080p60 run | Start to finished file | Render requests | Encoder queue wait | rAF interval p95 / p99 |
| --- | ---: | ---: | ---: | ---: |
| Editor idle | 20.70 s | 13.89 s | 5.26 s | 33.5 / 58.3 ms |
| Playback, edit and replacement | 23.67 s | 14.03 s | 7.46 s | 41.6 / 58.4 ms |

Four scheduled actions in the active run started after 4.7–33.9 ms. The timer
samples measure dispatch delay and do not qualify the product's acknowledgement
percentiles. The two jobs used the same machine while regression tests were
running. This pair is a functional comparison and a profiling sample. The cache
reported two finished files and zero pending cleanup.

A full 4K60 export of a 150-second No Good excerpt finished after track replacement.
It submitted 9,000 frames, produced a 573,152,141-byte file and completed in 661.97 s.
Chromium decoded nonblank frames at 0.5 s, 75 s and 149.8 s at 3840×2160.
Render requests took 508.49 s and the encoder queue wait 95.66 s. The observed rAF intervals were 100.1 ms at p95 and
158.3 ms at p99. Four sampled editor commands started after 38.4–228.5 ms.
These measurements include other local test load. Physical mobile and peak RAM,
repeated matched runs, full decoded pixel and audio parity, and command
acknowledgement qualification remain open.

The production build and the focused regressions exercise the readiness gate,
preserved playback, cold preset preparation, new-track load with frozen PCM and
visual inputs, resolution restoration, and the previously delivered job controls.
Run the following for the build, cumulative suite and affected tests.

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap --test-concurrency=3 tests/mvp-background-export.test.mjs tests/mvp-export-panel.test.mjs tests/mvp-async-lifecycle.test.mjs tests/export-isolated.test.mjs tests/export-lifecycle.test.mjs tests/export-cache.test.mjs tests/export-preparation.test.mjs tests/mvp-unsaved-changes.test.mjs
git diff --check
```

## T19d1 isolated export scheduling benchmark (2026-11-04)

The user accepted T19c5. The first acceleration control experiment compares the
current display-paced isolated export with an internal cooperative candidate.
Both use the same ordered Wormhole renderer, frozen PCM, worker codec probe, WebM
muxer, and two-frame admission bound. The candidate skips per-frame display waits,
keeps the task yield after every other submitted frame, and wakes the host from the
existing worker acknowledgements and queue-depth messages. It retains the 30-second
watchdog. Stop wakes a blocked queue and drains its submitted prefix. Cancel and
worker failures interrupt the wait and clean up as before. The worker's depth
report still arrives every 50 ms. No changes to the worker protocol or codec were needed.

The production factory selects display scheduling. Isolated Copy settings &
diagnostics adds the effective `scheduling`, `stagesMs.animationFrameWait`,
`stagesMs.mainThreadYield` and `resources.peakOutstandingFrames` fields. The
display interval is separated from the renderer request time. All stage times
are wall-clock waits. Two outstanding transfers do not bound total codec/GPU RAM.
The cooperative candidate is selectable by the local benchmark only.

The [benchmark page](../../tests/browser/export-scheduling-benchmark.html)
loads a local 1–10 second stereo excerpt and uses the production audio analyzer and
private renderer with the built-in Drive preset. It runs three alternating pairs at
the chosen resolution. It compares exact video/Opus packet clocks, hashes of both
decoded PCM channels and three sampled RGB frames per pair. The predeclared RGB
tolerance is at most 4 mean absolute levels on the 0–255 scale. The same page checks
a Stop prefix against both schedules, Cancel with no result, Stop on a fresh retry
and owned-file cleanup. The controls can also be checked on their own.
Choose a local clip, or serve `sample.wav` next to the benchmark. The audio remains
on the local machine. With Vite running, open
`/plexus-engine/tests/browser/export-scheduling-benchmark.html`.

```text
npm run dev -- --host 127.0.0.1
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap --test-concurrency=3 tests/export-scheduling.test.mjs tests/export-isolated.test.mjs tests/export-lifecycle.test.mjs tests/export-cache.test.mjs tests/export-preparation.test.mjs tests/mvp-background-export.test.mjs tests/mvp-export-panel.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-changes.test.mjs
git diff --check
```

The local Windows Chromium 156 benchmark used an eight-second excerpt from
No Good, cut at 45 seconds, and a fixed Drive preset. The fixture SHA-256 is
`63f76da30827d0fbc139236b4991f77c67848205bf35e9c5d72dbf1ed29fbe47`.
Each full job submitted 480 frames. Both resolutions used VP9 at the reported
level with Opus audio. Both decoded PCM hashes and three sampled 64×36 RGB frames
matched within each pair, with measured mean RGB difference 0. Full-frame
pixel parity across the video remains unmeasured.

| Resolution | Full-job median, display / cooperative | Gain | Render requests | Encoder queue wait | Timer excess p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1080p60, VP9 level 4.1 | 17.27 / 15.42 s | 10.7% | 12.35 / 12.55 s | 3.72 / 1.99 s | 22.2 / 45.1 ms |
| 4K60, VP9 level 5.1 | 19.02 / 16.49 s | 13.3% | 13.13 / 13.19 s | 4.33 / 2.28 s | 20.0 / 48.2 ms |

The timer values are medians of per-job p95 excess delay from a 25 ms timer,
with no live editor workload. User command latency, peak RAM and physical mobile
performance require their own measurements. Display wait fell from 0.21 s at
1080p and 0.20 s at 4K to zero. The largest saving was in encoder queue wait.
Both speed gains fell below the 15% promotion threshold. Ship the diagnostics
and retain the cooperative path as a local benchmark control.

The 1080p suite and the separate 4K controls run produced playable 90-frame
prefixes with both schedules, matched PCM, packet clocks and sampled pixels,
cancelled at eight frames without a result, and removed their retained files
after verification. An earlier
200 ms display-paced 4K prefix passed packet and audio checks but Chromium
reported a playback error. Retain that receipt and isolate the very-short-prefix
behavior before promoting a new schedule. The current evidence points first to
an ordered render worker and a direct measurement of canvas/codec handoff.
A WASM prototype requires a measured CPU kernel.

The production build and 130 focused cases passed. The cumulative suite had
2,110 cases, with 2,101 passed and nine exact retained baseline failures.
The local run receipts are under `logs/t19d1/`; the raw 4K pairs and later
control pass are preserved separately from their combined summary.

For the live release check, run a short Isolated Wormhole export and copy the
diagnostics after completion. Confirm that the schedule is `display`, the display
wait is recorded separately, and Stop & save still produces a playable prefix.

## T19d2 very short WebM Stop saves

On the same eight-second stereo excerpt used in T19d1, the production MVP
composition reproduced the Chromium demuxer seek failure on both the
12-frame and 90-frame 4K60 Stop saves. Video and audio packet clocks were
continuous. The standalone FFmpeg demuxer reported a video frame duration
of 4,715,209,459.135 seconds in the original file. The muxer encoded the
`DefaultDuration` payload as a float. It now writes an unsigned integer
count of nanoseconds per frame. [Matroska DefaultDuration](https://www.rfc-editor.org/rfc/rfc9559.html#section-5.1.4.1.13)

The corrected frame duration alone left the Chromium seek error reproducible.
Testing the same packets with only the regular Opus SimpleBlock keyframe bit
set made the 200 ms clip playable. The shared muxer now writes that bit on
normal Opus blocks. A final trimmed packet uses its existing BlockGroup and
DiscardPadding, with the Block keyframe bit reserved. No codec settings or
payloads need to change. [Matroska block flags and seek points](https://www.rfc-editor.org/rfc/rfc9559.html#section-10.2)

With both fixes applied, Chromium played the Compatible and Isolated
4K60 outputs to their 200 ms and 1,500 ms endpoints. The Compatible
Cancel produced no file, the retry produced a playable 200 ms file, and
a full Compatible export played to 8 s. The independent packet reader
verified contiguous video and audio and the audio endpoint for each output.
FFmpeg decoded and sought within the short exported files.

The local receipts under `logs/t19d2/` retain the failing files, the header
variants and the production-path rerun. For manual acceptance, use Stop & save
near the start of a 4K MVP export and play the downloaded file from the beginning.
Then try a full export or Cancel followed by a fresh export. The physical mobile
check remains open.

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap --test-concurrency=3 tests/export-webm-duration.test.mjs tests/export-opus-muxer.test.mjs tests/export-scheduling.test.mjs tests/export-isolated.test.mjs tests/export-lifecycle.test.mjs tests/export-cache.test.mjs tests/export-preparation.test.mjs tests/export-deterministic.test.mjs tests/mvp-background-export.test.mjs tests/mvp-export-panel.test.mjs
git diff --check
```

## Scheduled retirement from MVP export

T19e removed Isolated Wormhole from MVP export after the user accepted the
shared WebM playback fix. The export dialog offers resolution, compact status,
Stop & save, Cancel, downloads and finished-file cleanup. Copy export settings
includes the selected settings and this tab's cache counts. MVP no longer
consults the legacy runtime or memory preference keys. Session resolution is
restored through the existing capability check. On devices where Compatible
disables 4K, a saved 4K selection falls back to 720p.

Compatible reserves the workspace through export teardown. Minimizing keeps
the status and export controls accessible while playback, editing and file
replacement wait for the job to settle. The retirement covers only MVP export.
Wormhole preview, Studio and XR keep their existing entrypoints. Shared snapshot,
codec preparation and renderer benchmarks remain in the research fixtures.

The replacement tests cover stale configuration, saved resolution, copying
settings, blocking a deferred replacement and releasing the workspace after
the job. Three tests that required the retired UI or facade were removed from
the active suite. The previously active source and exact assertions are retained
at Git `6ed7857` and in the following archives.

- [Isolated export tests](../tests/export-isolated.pre-t19e.mjs.snapshot)
- [Export preparation tests](../tests/export-preparation.pre-t19e.mjs.snapshot)
- [Background export tests](../tests/mvp-background-export.pre-t19e.mjs.snapshot)
- [Compact panel tests](../tests/mvp-export-panel.pre-t19e.mjs.snapshot)

A local Chromium run started with both retired storage preferences present.
It restored 4K and 720p from the workspace, held the compact export lock,
rejected a track replacement while exporting, and released the workspace on
settlement. It played two 12-frame 4K60 Stop files and an eight-second
720p60 file to their endpoints. Cancel produced no file, and the cache owned
only the three successful outputs. Physical mobile remains a manual check.

Base any future acceleration proposal on matched measurements of Compatible,
starting with the remaining MVP path and testing on physical mobile before
promoting any user-selectable acceleration.

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap --test-concurrency=3 tests/mvp-background-export.test.mjs tests/mvp-export-panel.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-changes.test.mjs tests/export-isolated.test.mjs tests/export-preparation.test.mjs tests/export-cache.test.mjs tests/export-lifecycle.test.mjs tests/export-webm-duration.test.mjs tests/export-scheduling.test.mjs
git diff --check
```

## FFmpeg transition priority (T20a)

After T19e acceptance, the user moved FFmpeg ahead of the generic render-worker
experiment and T21 captions. The scope is MVP export. Use MP4/H.264/AAC as the
first candidate, and use the current Compatible WebM as the control and
available export option. Destination-specific playback and editor support still
need qualification. The proposed production path should encode the video once.

### T20a0 native reference

Native FFmpeg N-124279-g0f6ba39122-20260430 processed two actual Compatible
4K60 VP9/Opus files from T19d2, containing 12 and 90 frames from the eight-second
No Good reference excerpt. Each median below includes process startup and
local file I/O across three passes. The inputs were already encoded. These
measurements exclude browser rendering, WebAssembly startup, storage copies and
mobile performance. [FFmpeg streamcopy and transcoding](https://ffmpeg.org/ffmpeg.html#Streamcopy)

| Operation | 12 frames | 90 frames | Decoded output |
| --- | ---: | ---: | --- |
| FFmpeg WebM stream copy | 76 ms | 65 ms | Exact video and PCM hashes. Container duration is 20 ms longer than the decoded audio boundary. |
| FFmpeg MP4 stream copy | 73 ms | 71 ms | Exact video hash. VP9 and Opus remain. The native decoder produced 624 extra PCM samples per channel in each clip. |
| FFmpeg MP4 H.264/AAC transcode | 428 ms | 1,306 ms | Same dimensions and frame counts. The reported audio/video endpoints are 200 and 1,500 ms. Decoded AAC has padding and the decoded video differs from the original. |

The MP4 stream-copy result changes the container while retaining the input
codecs. For an H.264/AAC MP4 path, prefer testing browser encoders that produce
the target streams once, then using FFmpeg to assemble the MP4. Keep the
native re-encode as a reference. Validate AAC priming and final padding in
actual players and editors using a synchronized signal, in addition to
checking stream durations. The benchmark outputs and detailed JSON are local
under `logs/t20a/`. To repeat the native comparison with two short stereo exports:

```powershell
node research/export/ffmpeg-baseline.mjs logs/t20a path/to/short.webm path/to/longer.webm
```

### Delivery order

1. **T20a1 browser prototype — completed as research.** The hybrid browser
   export produced valid 720p, 1080p and 4K MP4 without re-encoding the video.
   The evidence and remaining limits are below.
2. **T20a2 MVP integration.**
   - **T20a2a — storage and same-format control.** Completed as research.
     Both MP4 paths use OPFS; the browser path is faster on the measured
     Chromium fixture, and the FFmpeg path has sample-exact audio endpoints.
   - **T20a2b — reduced core and admission.** The local research now has a
     small FFmpeg core without libx264, a per-job storage budget and full-track
     results. The browser path is the performance control; the FFmpeg path
     uses no browser AAC encoder and is the candidate for exact finalization.
   - **T20a2c — coordinator and UI.** MVP now offers MP4 beside WebM. The
     application probes the exact output, uses the current job controls and
     keeps one owned result. See the [MVP delivery](#t20a2c-mvp-mp4-choice).
3. **T20a3 release and promotion.**
   - **T20a3a — desktop output qualification.** Compare the released
     workers on a matched short fixture, a longer timeline and a supported
     4K case. Verify decoded outputs in the browser and with native FFmpeg.
   - **T20a3b — physical devices and target editors.** Run on desktop and
     physical Android and iOS with short prefixes, long runs and supported
     4K. Measure whole-job time, command latency, resource peaks, recovery
     and sync in the user's target players/editors. Mobile 4K is selectable
     in MVP and each job must pass its encoder preflight.
   - **T20a3c — default decision.** The user accepted the Android Chrome
     result and requested MP4 as the MVP default. Keep the existing 15%
     median threshold for any separate speed claim.
4. **Further work.** T21a establishes the caption parser. The recommended
   next export slice is same-format profiling, then an ordered render-worker
   prototype if rendering or frame transfer dominates. Qualify an optional
   fast mode on desktop and physical mobile before exposing it. Test
   threaded WASM only for a measured CPU bottleneck in WASM; multiple-fold
   whole-job improvement is a target, not a release claim. Studio and XR
   retain their own work streams.

GitHub Pages serves the web app as static assets. Begin with a browser-local
prototype in a dedicated worker. Verify the exact FFmpeg core's format and
encoder support, file-system behavior, download size and distribution terms.
The documented wasm wrapper requires access to the core's file system for
input and output. Measure that boundary before using it for large exports.
A threaded Emscripten core needs cross-origin isolation and a separate
non-threaded build for devices without it. A native hosted service would need
a separate runtime and an explicit product decision about processing user
media. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [ffmpeg.wasm architecture](https://ffmpegwasm.netlify.app/docs/overview/#architecture), [Emscripten pthreads](https://emscripten.org/docs/porting/pthreads.html)

### T20a1 browser evidence (2026-11-04)

The [local comparison](../../research/export/ffmpeg-browser.html) uses the real
Compatible WebM exporter, its worker and normal storage selection with synthetic
canvas and stereo PCM input. The two MP4 variants use the same frame clock,
scene and samples, with PCM16 WAV input to FFmpeg. The hybrid route uses browser
WebCodecs to encode H.264 into a video-only MP4; FFmpeg copies those packets and
encodes AAC once. The direct route encodes RGBA with libx264 and the same AAC
settings. Each FFmpeg run starts its own worker; browser asset caches are not
cleared between jobs. A fresh network load and download UI time are outside these
timings. Windows Chromium 156, no cross-origin isolation; the browser reported
8 logical processors and a 32 GiB device-memory hint.

| Full synthetic clip (12 frames, 30 fps) | Compatible VP9/Opus | Hybrid H.264/AAC | Direct WASM H.264/AAC |
| --- | ---: | ---: | ---: |
| 720p | 464 ms | 415 ms | 505 ms |
| 1080p | 471 ms | 524 ms | 787 ms |
| 4K | 648 ms | 861 ms | Declined by the fixture before allocation |

Values are medians of three runs from job start to finished Blob, before
validation. In the same order as the table, the three measurements per route
were `537/464/455, 638/415/413, 505/485/533` ms at 720p,
`471/466/493, 524/521/527, 786/787/823` ms at 1080p, and
`648/627/686, 805/861/919` ms at 4K. 720p hybrid worker initialization
varied from 130 to 354 ms. The hybrid FFmpeg command itself took 63–83 ms at 720p
and 4K; at 1080p it took 68–84 ms, versus 513–561 ms for direct FFmpeg.
Different codecs, rate control and short synthetic content prevent a
like-for-like quality or production speed claim.

In each run all 14 executed cases passed and direct 4K was declined as intended.
Each complete export contained 12 video packets and the 720p Stop case contained
the exact six-frame prefix. For both MP4 paths Chromium decoded 19,200 stereo
samples for the full clip and 9,600 for Stop. Compatible decoded 24 samples
fewer in each case. The image flash and stereo audio cue aligned at frame 3.
Hybrid H.264 packet SHA-256 values and timestamps matched the intermediate.
Compatible Cancel returned no result after frame 4; both FFmpeg variants
terminated their worker during an active command and returned no Blob, then
successfully ran the Stop case with a new worker.

Direct 1080p staged 99,532,800 bytes of raw RGBA for 12 frames plus transient
frame readback and a Blob copy. Direct 4K would stage 398,131,200 bytes, so the
prototype refuses it at its 96 MiB raw-input guard. In 4K the hybrid fed
36,451 bytes of compressed video plus 76,844 bytes of WAV and returned a
46,759-byte MP4. WORKERFS mounts the Blobs without a whole-file write into
MEMFS; the output still occupies MEMFS and is read into a transferable array
before construction of the result Blob. These are observed payload sizes
and known copies, not a peak browser, WASM or GPU memory measurement. Neither
whole-file buffering nor the bundled test core is a production design.

The core WASM is 32,232,419 bytes (SHA-256
`9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`).
It was used locally only. It includes libx264, which has
[GPL distribution implications](https://ffmpeg.org/legal.html). The hybrid
candidate does not use that encoder; evaluate a reproducible reduced build
without it, with appropriate notices and source availability, before shipping.
Chromium reported that it can encode browser AAC; actual output and fallbacks
on physical Android/iOS, long jobs, cold startup, 4K limits and destination
player/editor compatibility remain unqualified.

Reproduce from the project root, with the existing project dependencies:

```powershell
npm install --prefix logs/t20a1/vendor --no-audit --no-fund --ignore-scripts --save-exact @ffmpeg/ffmpeg@0.12.15 @ffmpeg/core@0.12.10 mediabunny@1.39.1
node research/export/serve-ffmpeg-browser.mjs
```

Open `http://127.0.0.1:5209/plexus-engine/research/export/ffmpeg-browser.html`,
select **Run export comparison** and inspect the JSON and verified download
links. The server binds only to loopback; the generated site, downloaded
packages and media are excluded from the production build and Git. The 37
targeted existing Node export tests also passed; this research did not change
application sources or the active regression inventory.

### T20a2a on-disk MP4 and same-format control

On the same [local fixture](../../research/export/ffmpeg-browser.html), select
**Run MP4 storage comparison**. The two paths start from the same canvas, PCM16
samples and clock, with the same requested H.264 and AAC bitrates. The browser
route streams H.264 and browser AAC to fragmented MP4 through Mediabunny.
The hybrid route streams its H.264 intermediate and WAV to OPFS, mounts them
read-only with WORKERFS and writes its fragmented MP4 through an Emscripten
device to an OPFS sync access handle in a dedicated worker. It never reads the
complete finished MP4 back through MEMFS. The fixture's playback validator
does read the result after timing.

| Synthetic job, 30 fps | Browser AAC + MP4 | Browser H.264 + FFmpeg |
| --- | ---: | ---: |
| 720p, 0.4 s | 228 ms | 723 ms |
| 4K, 0.4 s | 602 ms | 907 ms |
| 720p, 12 s | 1,034 ms | 1,707 ms |

These are one final Windows Chromium 156 run, from capture start to completed
OPFS file, before decode and fixture download. The hybrid column includes a
new worker for each job; initialization for these jobs took 145–335 ms.
The browser path was faster on all three tested samples. Matching format and
requested rate does not establish matched perceptual quality, production
performance or mobile availability.

Both 12-second outputs had 360 contiguous video packets and the stereo cues
at the beginning, middle and end measured 0 ms offset at 1 ms resolution.
The hybrid preserved every compressed video packet byte-for-byte. Its decoded
audio ended at exactly 576,000 samples per channel; browser AAC had 512 extra
samples (10.7 ms). Hybrid Stop saved the first six frames and exactly 9,600
audio samples per channel. An early fragment-header configuration shifted
the packet clock; delayed initialization metadata, edit lists and disabling
automatic timestamp shifts preserved the original clock in this fixture.

The 12-second hybrid stored 594,639 bytes of compressed video and 2,304,044
bytes of WAV, and wrote its 886,473-byte MP4 in 12 writes, with a largest
worker output write of 80,338 bytes. Staging used a 6,400-byte PCM slice and
observed video writes of at most 256 KiB. These sizes measure known file I/O,
not total memory use or an upper bound on encoder/fragment memory. The
24 MiB per-file guard is a research setting. A forced 16-byte output limit
was rejected. Cancel at the first FFmpeg write returned no file, waited for
the worker's storage handle to release, removed the scratch directory and
allowed a new job. All ten cases verified scratch removal. Two 4K samples
are available for manual playback from the fixture.

The original T20a1 browser regression still passes (14 executed cases and
the intended direct-4K refusal), as do 37 targeted Node export tests.
The experiment does not change any application code. Next: reduced core,
real-track storage and resource tests, player/editor compatibility with
fragmented MP4 and physical mobile qualification. See
[Mediabunny output targets](https://mediabunny.dev/guide/writing-media-files#output-targets)
and the [FFmpeg WASM custom-build guide](https://ffmpegwasm.netlify.app/docs/contribution/core/#custom-build--reduce-build-size).

### T20a2b reduced FFmpeg core and storage admission

The [local build recipe](../../research/export/ffmpeg-mp4-core.Dockerfile)
pins Emscripten 3.1.40 by image digest, FFmpeg 5.1.10 and the FFmpeg WASM
binding by source commit. It has one thread, a 32 MiB initial WASM linear
memory and a 256 MiB linear memory ceiling. The only intended job copies
browser-encoded H.264, reads PCM16 WAV, encodes AAC and writes MP4. There is
no video encoder, libx264, or network protocol in this FFmpeg build.
The WASM is 1,477,933 bytes versus the full core's 32,232,419 bytes
(95.4% smaller; SHA-256
`8e71567f34b4ccb3b06bb75057cec95e68e49462d876b5a2e1a2a20f0d515aee`).
The local build reports LGPL 2.1 or later for the selected FFmpeg components.
The dedicated worker is the only code loading it. The AAC fallback never
calls the browser audio encoder; actual codec discovery and fallback
selection belong to the MVP coordinator task.

The [admission policy](../../research/export/mp4-storage-admission.mjs)
starts with frame count, exact PCM extent and the requested bitrates.
It reserves all three coexisting OPFS files, with bitrate headroom for
variable output and a separate 64–256 MiB quota reserve. It checks the
origin estimate again before finalization and caps writes; missing or
insufficient estimates are reported before admitting the phase.
[StorageManager.estimate](https://storage.spec.whatwg.org/#dom-storagemanager-estimate)
is a browser origin estimate; it does not reserve bytes, report free physical
disk, or measure RAM. Actual write errors still require cleanup, and concurrent
tabs can consume storage after preflight. The factor and reserve are research
policy, not a platform guarantee.

| Local reference | Clip duration (s) | 720p budget | 4K projected budget | Actual 720p MP4 |
| --- | ---: | ---: | ---: | ---: |
| Goa | 365.767 | 0.913 GB | 3.930 GB | 38.926 MB |
| No Good | 410.567 | 1.024 GB | 4.411 GB | 43.352 MB |
| Scienide | 350.433 | 0.875 GB | 3.766 GB | 37.081 MB |

Decimal GB, excluding the separate reserve. The reference workload pairs real
music with a repeated 720p/30 pre-encoded visual fixture. The measured files are
smaller than the conservative requested-rate budget. These data exercise the
full-length storage and finalization seam, not MVP rendering or full-song
4K performance. The source tracks and generated fixtures stay local.

All three FFmpeg 5.1.10 jobs preserved the exact video packets and timestamps
(10,973 / 12,317 / 10,513 packets). Chromium decoded exactly 17,556,800 /
19,707,200 / 16,820,800 audio samples per channel. Active test windows
correlated 0.944–1.000 with the normalized PCM; quiet source windows stayed
quiet. This is a clock and signal check rather than a listening or perceptual
quality assessment. The worker's linear memory stayed at 32 MiB in each job;
this does not include the browser, decoder or OPFS implementation. The
largest output write was 114,493 bytes. Scratch removal was verified. The
measured times include a loopback fixture transfer and were collected with
the Node suite running, so they are not used for performance comparisons.

Reproduce from the project root after the T20a1 vendor setup:

```powershell
docker buildx build --file research/export/ffmpeg-mp4-core.Dockerfile --output type=local,dest=logs/t20a2b/core research/export
node research/export/prepare-mp4-track-fixtures.mjs '<local reference MP3 directory>'
node --test research/export/mp4-storage-admission.test.mjs
node research/export/serve-ffmpeg-browser.mjs
```

At the loopback page, **Run local track admission** uses the reduced core if
present and reports which build it actually used. Use `?core=reduced` with
**Run MP4 storage comparison** for the short 4K and Stop/Cancel/limit cases.
All ten cases passed on the reduced core, including exact Stop, forced
write-limit failure, cancellation cleanup and retry. The three Node research
tests cover frame/PCM budget math, exact admission boundaries and failure on
invalid quota or RIFF overflow. The 37 existing focused export tests passed.
The locally generated core includes the upstream license notices in its
output folder. Before serving it publicly, package the exact corresponding
sources and build instructions with the notices, check the applicable
distribution and codec obligations, and set an upstream update policy.
See [FFmpeg licensing](https://ffmpeg.org/legal.html) and
[FFmpeg security releases](https://ffmpeg.org/security.html). No binary or
reference media is included in Git or the Pages application build.

### T20a2c MVP MP4 choice

**Export video → Format** offers **WebM** and **MP4 (H.264 + AAC)**.
WebM was the initial default. Since T20a3c, MP4 is the default for new
profiles. The MVP remembers an explicit format choice locally and includes
it in copied MP4 settings. Resolution, frame
rate, workspace locking, Stop & save, Cancel, and the tab-owned cache use
the existing export coordinator. Only MVP supplies the alternate backend.

MP4 preflight checks the browser storage estimate and encodes one probe
frame at the requested size and rate. The worker loads the reduced FFmpeg
core only for MP4. It accepts the current renderer's same ordered frames
and exact PCM slices, writes H.264 and WAV to OPFS and lets FFmpeg copy video
and encode AAC into a fragmented MP4. There is a second storage check before
finalization and byte caps on writes. On success only the completed result
is retained; on cancellation or failure the coordinator terminates the worker
and discards only the job's directory. WebM is always an explicit choice;
a failed MP4 job does not silently download a different format.

Chromium verified a full 720p/60 synthetic clip (24 frames, 19,200 samples
per channel at 48 kHz) and a 4K/60 Stop clip (9 frames, 6,615 samples at
44.1 kHz). Both files played through the browser's video decoder. Cancel
during finalization returned no file; retry, unsupported-audio refusal and
cache cleanup passed. A separate smoke check loaded a synthetic track in
the actual MVP and completed Stop & save through the export menu.
The [browser fixture](../../tests/browser/mvp-mp4-smoke.html) exercises the
real coordinator and worker. Native browser AAC remains a performance
control from T20a2a; the new user-facing MP4 uses FFmpeg for AAC on every job.

The on-demand module, its licenses, the two corresponding source archives
and the build recipe are available from the export dialog's FFmpeg source
link. The initial MVP release still used the mobile 4K guard. Long real
renders, physical Android/iOS, 4K device limits and third-party playback
and editors remain T20a3 checks before default promotion.

### T20a3a desktop output qualification

The [loopback runner](../../research/export/mvp-export-qualification.mjs)
uses the released export coordinator and both encoder workers. It generates
the same canvas frames and PCM for each paired job, measures to finished
file (before decoding and local fixture capture), and validates every video
timestamp. It decodes matching picture/audio cues at the beginning, middle
and end. The separate real-render trial loads a 60-second excerpt of
**No Good** in the built MVP and uses its regular **Export** menu.

| Windows Chromium 156, 60 fps | WebM | FFmpeg MP4 |
| --- | ---: | ---: |
| 720p, 4 s (three runs, median) | 6.395 s | 3.326 s |
| 720p, 45 s (one pair) | 69.013 s | 29.840 s |
| 4K, 2 s (one pair) | 3.467 s | 4.033 s |

The three 720p short pairs were 6.424/3.328 s, 6.395/3.326 s and
6.267/3.288 s in WebM/MP4 order. The benchmark alternated execution order.
The first local job is included; network cold-start is not established.
MP4 finalization alone was 4.162 s on the 45-second job. These are
descriptive times for this renderer fixture and browser. VP9/Opus and
H.264/AAC differ in rate control and quality, so the 720p numbers do not
establish a matched-quality or general speed claim. MP4 was slower at 4K
on this sample. The results do not support changing the default.

The 45-second outputs contained all 2,700 frames. Chromium decoded
2,160,000 samples per channel for MP4 and 2,159,976 for WebM, at 48 kHz.
Across all synthetic exports, the three audio cue offsets were within
0.58 ms of the picture cue clock. Both 4K outputs had all 120 frames.
The browser runner checked its owned cache after each job.

Reproduce from the project root:

```powershell
npm run build
node research/export/mvp-export-qualification.mjs serve '<path to reference MP3>'
# Open http://127.0.0.1:5211/plexus-engine/research/export/mvp-export-qualification.html
# Run the matched benchmark. Then optionally load the reference and export 720p MP4.
node research/export/mvp-export-qualification.mjs verify
```

Native verification uses [ffprobe](https://ffmpeg.org/ffprobe.html) and
FFmpeg to decode the captured files, check track metadata and seek near
the end. Native FFmpeg read and sought all four synthetic files. Its AAC
decoder exposed 640 extra samples at 45 seconds (13.3 ms) and 256 at
two seconds (5.3 ms), while Chromium trimmed to the expected endpoint.
Native Opus ended at the expected sample in both fixtures. Record the
decoder-dependent AAC tail when checking editors and physical devices.

The actual MVP exported **No Good 1:00–2:00**, at 720p/60, to a
33,490,273-byte H.264/AAC file. Native FFmpeg decoded all **3,600 frames**
and sought to the final section. Its audio output contained 2,880,512 samples
per channel (512 samples or 10.7 ms beyond the 60-second picture).
Mono PCM windows at 3, 30 and 56 seconds correlated 0.9967, 0.9817 and
0.9970 with the source at the same clock positions. This checks content and
timing at those windows, not a listening score or full-song timing claim.

Audio and outputs remain in ignored local logs. This is one
desktop environment, without a total browser memory profile, physical
mobile results or editor-specific sign-off.
The prior full application regression completed with 2,102 successes and
the same nine known failures, out of 2,111. This qualification leaves
production inputs and the active regression inventory unchanged.

### T20a3 physical-device acceptance checklist

Use the deployed MVP and the same music excerpt on each device. Record the
device, OS and browser versions, resolution, export format and total time
from **Export** to the completed download. Measure the first run and at
least two subsequent runs separately; keep the same background and resolution
for WebM and MP4. Include any precise admission error. A device that cannot
run MP4 can still qualify the WebM fallback.

1. Export 720p MP4 normally. Open it from the device's Downloads/Files app in
   its normal player, then seek near the beginning, middle and end. Check
   for missing audio, freeze, a truncated end or perceptible drift.
2. Start a second job and press **Stop & save** after visible progress.
   Check that the downloaded prefix plays and seeks. Start again, press
   **Cancel**, verify there is no download, then immediately retry.
3. Repeat the same input and resolution with WebM. Check a longer track
   after the short cases work. Try 4K only where the app offers it. Test
   the selected MP4 file in the intended editor by importing it, scrubbing
   near the end and checking the decoded audio. Record app/version and
   the exact outcome.
4. Report any tab reload, crash, stall or inability to open the result.
   If a supported profiler is available, record peak browser process
   memory and remaining device storage separately from the origin quota.
   Do not extrapolate from the WASM linear memory to total device usage.

### T20a3b/T20a3c acceptance and default

The user reported successful operation of the MP4 export on physical
Android in Chrome. The exact phone/OS version, individual controls and
timings were not supplied. iOS and editor-specific compatibility remain
unverified. The user did not require an editor test to continue, and
explicitly selected MP4 as the default target format.

In MVP, a missing or unreadable format preference now selects MP4.
A previously saved WebM choice remains WebM. If MP4 preflight fails,
its existing explanation still offers WebM; export never silently changes
the requested format. This preference change is independent of speed,
4K admission and the remaining device coverage.

### MVP mobile 4K admission

The MVP offers 4K on mobile when WebCodecs is present. The shared capability
report and the Studio guard retain their previous behavior. The exact MP4
encoder and storage preflight still applies. MVP 4K WebM runs the existing
worker-side VP9/VP8 and Opus probe and requires its normal browser-local file.
Actual render surfaces are allocated only after the probe succeeds; the
temporary MP4 probe canvas is released immediately. A rejected or stopped
preflight does not begin rendering or silently select another resolution.
This does not promise that an entire 4K job can finish on every phone.
Desktop Chromium smoke verified playable 4K/60 Stop prefixes in both
formats after preflight: nine video frames, 6,615 decoded MP4 samples at
44.1 kHz and 7,176 decoded WebM samples at 48 kHz. Physical mobile 4K
still requires a device check.

### T21a timed Markdown caption format

One cue per explicit header. Times are two or three minute digits, two
second digits and three millisecond digits. An optional trailing style
selects `normal`, `small` or `title`:

```md
## 00:12.500 --> 00:17.000 [title]
**NEON PULSE**
_A tér a ritmussal nyílik._

## 00:32.000 --> 00:36.500
Új szakasz.
```

The [parser](../../src/presentation/timedCaptions.ts) treats cues as
`[start,end)`, permits adjacent cues, sorts by start and rejects overlap.
An empty document clears captions. Paragraphs, explicit line breaks and
single-level bold/italic are supported; other markup is inert text. Limits:
64,000 UTF-16 units per document, 256 cues, eight explicit lines per cue and
200 Unicode code points per line. A line-numbered error rejects the whole
edit. The optional track duration bounds cue endpoints. Valid plans are
immutable and resolve cues identically after seek or arbitrary-frame lookup.
No lyric recognition or automatic timing is performed.

The next caption slice adds a track-scoped timeline and preview, with a
bottom-center default, per-cue placement overrides and normalized
coordinates relative to the output frame. Use the [WebVTT cue-box model](https://www.w3.org/TR/webvtt1/#cues)
for position, width and alignment. Use the [EBU R95 16:9 graphics safe area](https://tech.ebu.ch/publications/r095/)
as a 5% inset baseline; 9:16 and 1:1 use separate safe-area profiles.
Preview and burn-in export will share the same font, layout and song clock.
The renderer will warn when a cue exceeds the safe box; it must not shrink
text without a readable minimum or silently crop words. A separate WebVTT
file can follow for switchable subtitles. T21a supplies the parser and
lookup only; no production caption rendering is wired yet.

Default to hard cuts for readable captions: no animation on entry, exit
or cue replacement, and no simultaneous fading text. Use reading-time and
frame-boundary guidance as advisory lint, without rewriting authored cues.
The [Netflix subtitle timing guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines)
is a production reference, not a mandatory delivery specification for this
feature. Offer optional 120–200 ms fades for graphic titles as a Plexus
design starting point, confined to each cue and visible in the timeline.
Warn when the fully visible hold is too short. Preview and export must
evaluate opacity from song time, including after a seek. Selection boxes,
safe-area guides and fade handles are editor controls and never burn in.

T21b includes a font picker with live samples, a saved per-track default
and an optional cue-level override. The initial Google Fonts shortlist is
Inter (readable neutral), Barlow Semi Condensed (compact), Exo 2 (electronic),
Chakra Petch (angular display) and IBM Plex Mono (HUD/monospace). The
[Google Fonts source metadata](https://github.com/google/fonts/tree/main/ofl)
lists Latin Extended, italic faces and OFL for all five. Before shipping,
verify the actual WOFF2 glyphs and styles, including Hungarian double acute,
then self-host the pinned files with license notices. Load only the needed
families and faces; preview, layout and export must use the same font metrics
and must surface missing fonts before recording. Keep the chooser and preview
in the next editor slice; no font assets are loaded by T21a.

## Optional accelerated export research (2026-11-04)

The user reports that their current mobile export is stable and slow. Preserve that workflow
and offer an explicit accelerated option if a candidate passes acceptance. The inspected
Pages release `2463f73` encodes VP9 or VP8 plus Opus with WebCodecs in a dedicated worker and
writes WebM to OPFS. Its WASM FFT runs in the audio analyzer. The reported mobile device,
browser and selected export mode have yet to be recorded for a matched comparison.

In the loaded T19c3 five-minute synthetic 4K/60 run, the whole job took 1,021 s. Host
instrumentation recorded about 565 s in render requests, 329 s waiting for queue capacity and
15 s creating bitmaps. Those figures identify work to investigate. They represent elapsed
stage times, with worker metrics overlapping them. The worker's synchronous `encode()` timing
measures submission. Use output timestamps, queue stalls and flush to measure codec throughput.
The isolated renderer currently draws through a DOM canvas and the export loop awaits a
display frame before each bitmap. Wormhole advances simulation in canonical song-time order.
Independent clip segments would need verified state checkpoints, ordered output and keyframe
boundaries. Assigning frame indices to a pool today would repeat simulation or change results.

| Candidate | Evaluation |
| --- | --- |
| Existing sequential rendering and WebCodecs with tighter scheduling | First control experiment. Measure the display-frame wait separately. For the isolated path, test cooperative scheduling and event-driven backpressure where the codec supports it. Keep bounded slots, watchdogs and reliable Stop/Cancel acknowledgements. Test the same codec, size, fps and quality target. |
| OffscreenCanvas render worker and WebCodecs | First parallel prototype. Keep one ordered simulation and overlap its output with encoding. Reuse the worker-compatible surface seams from preview, adapt export-only PostFX and overlays, and compare direct worker-to-worker frame transfer with a worker that owns both rendering and codec submission if transfer costs dominate. Measure internal copies and GPU/encoder contention. Regular worker messaging can use transferable frames. [HTML canvas specification](https://html.spec.whatwg.org/multipage/canvas.html), [WebCodecs specification](https://www.w3.org/TR/webcodecs/). |
| Native codec preference | If the encoder limits throughput, compare the browser default with `prefer-hardware` under the same output requirements and exact capability probe. The preference is a hint. Keep image quality, packet continuity and prefix validity in the comparison. [WebCodecs specification](https://www.w3.org/TR/webcodecs/#hardware-acceleration). |
| Small WASM or WASM SIMD kernel | Profile a pure CPU stage first. Try a bulk kernel inside the render worker and compare cold startup, transfer or copy costs and whole-job gain. Keep a reference implementation and an exact or predeclared tolerance. Split work across workers only if independent batches and bounded results demonstrate further benefit. |
| Threaded WASM and ffmpeg.wasm | A secondary experiment when evidence points to a parallel CPU kernel or a confirmed codec/format gap. Emscripten pthreads need cross-origin isolation and separate threaded/non-threaded builds. The live MVP HTML response checked for this review did not send COOP/COEP. Verify staging headers, assets, embedding and XR behavior before seeking approval for any hosting change. ffmpeg.wasm's published multithread result compares its own cores and native FFmpeg. Compare the actual browser pipeline, input/output buffering, mobile CPU and memory cost, codec quality and Stop-prefix behavior before selecting it. [Emscripten pthreads](https://emscripten.org/docs/porting/pthreads), [ffmpeg.wasm performance](https://ffmpegwasm.netlify.app/docs/performance/), [ffmpeg.wasm architecture](https://ffmpegwasm.netlify.app/docs/overview/). |
| Multiple render or encoder segments | Defer unless the preceding pipeline still misses the target and measurements isolate a bottleneck that segmentation can address. Require deterministic checkpoint restoration, independent keyframe starts, bounded reordering, continuous audio and a single contiguous prefix for Stop & save. Multiple encoders may compete for the same hardware. |

Keep the existing T19 interaction deliveries and collect the baseline with the editor active.
Run the scheduling comparison and parallel prototype in T19 after the job controls and
snapshot lifecycle are stable. Continue to T20a for codec/format experiments when indicated.
Record at least three alternating paired runs per claimed target stratum. Start with a short
1080p dense real track, then extend a viable candidate to a multi-minute run and 4K on supported
devices. Compare start-to-usable-file time, control latency, peak resources where observable,
queue/slot high-water marks and repeat-run stability. On physical mobile, record the device,
browser, effective codec and preset, then check sustained throughput over consecutive jobs
and recovery after switching apps. At 4K, each additional full RGBA buffer
represents roughly 31.6 MiB before any codec, GPU or driver allocation. Count buffers and
bound the queue. The existing promotion goals are at least 15% lower median whole-job time in
the target stratum, at most 5% slowdown in protected strata, and 1080p control acknowledgement
p95 ≤100 ms and p99 ≤250 ms. Preserve decoded frame and audio parity, the one-result rule,
Stop/Cancel/retry and cleanup. Record unsupported memory counters as unmeasured.

After acceptance, expose Standard and Accelerated in MVP export settings, using the existing
saved settings and Copy diagnostics policy. Keep the proven path as Standard. Record requested
and effective mode, exact codec settings and the fallback reason. Detect capabilities for the
selected output before frames are produced. A preparation failure can select Standard with a
visible reason. An in-progress failure follows the existing error/cleanup path and offers an
explicit Standard retry. The user requests a single platform-independent delivery. Use one
settings and job contract across desktop and mobile. Select the available execution path by
the exact output configuration and runtime capability checks. Qualify the accelerated mode
in the same release on representative desktop browsers and physical Android/Chrome and
iOS/Safari devices. Retain Standard on supported configurations where the accelerated
preflight fails and show the reason. Record the tested browser, device and output settings.
Give the accelerated option the same speed and stability gate on both device classes.

### T20b1 matched MP4 stage profiling

Use `node research/export/mvp-export-qualification.mjs profile` after
`npm run build`, then select **Profile matched MP4 exports** on the loopback
page printed by the runner. It uses the Compatible export backend and the
production MP4 worker, with a synthetic moving 2D scene and stereo PCM.
Each 720p/4 s and 4K/2 s group has three profiled runs and one unprofiled
control at 60 fps. A 720p/30 s run exposes duration-dependent work. The
harness verifies H.264 and AAC, the video packet count, contiguous video
timestamps, the decoded audio endpoint, and three decoded audiovisual cues within one
output frame. It writes the receipt to a new run directory under
`logs/t20b1`. The production UI leaves the profiling callback unset.

Host intervals cover worker admission, capture setup, render request,
display wait, composition, bitmap creation, PCM copy and transfer
submission, queue wait, finalization wait and cleanup. The worker
separates storage admission, codec probe, WASM load, H.264 submission,
PCM staging, H.264 drain, FFmpeg finalization and output cleanup.
H.264 submission includes backpressure. FFmpeg finalization includes AAC,
H.264 remuxing and storage writes. Host and worker intervals overlap, and
the transfer submission timer measures PCM copy plus synchronous dispatch.
The Compatible render-request timer ends at the p5 redraw call; p5 2.x
completes redraw asynchronously. In the synthetic fixture, redraw is a
synchronous canvas draw. These measurements cannot isolate GPU execution,
message delivery or pure codec CPU time.

Windows Headless Chrome 156, visible document, 60 fps, repeated after the
cumulative suite finished. Short rows show the median of each column
independently. Times are in milliseconds.

| MP4 fixture | Whole job | Host display wait | Host yield | Host queue wait | Worker H.264 submit | Worker FFmpeg finalize |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 720p, 4 s (3 runs) | 5,431 | 1,322 | 487 | 1,184 | 902 | 849 |
| 4K, 2 s (3 runs) | 4,492 | 353 | 143 | 2,330 | 2,614 | 312 |
| 720p, 30 s (1 run) | 20,854 | 9,729 | 4,076 | 3,047 | 2,280 | 2,623 |

All nine jobs passed. The largest measured audiovisual cue offset was
0.92 ms. The unprofiled controls took 4,228 ms and 4,577 ms at 720p and
4K respectively. Single controls and run-order effects do not quantify
profiling overhead. The local receipt is `logs/t20b1/run-*/mp4-profile.json`
with SHA-256 `cd77490d5b6b82a355ca865b4d3a8a3a1a1e42b3e9afaecde7e7b895606cc1d0`.
The separate `mp4-profile-with-test-load.json` receipt records the earlier
concurrent-load run. Real Wormhole rendering and physical mobile are
outside this baseline.

The scheduling candidate must await p5 redraw completion explicitly before
capturing, use the worker acknowledgement for bounded backpressure, and
keep a cooperative yield for input and cancellation. Compare that candidate
with display pacing on the actual Wormhole and PostFX renderer. Make the
render-worker decision after measuring the remaining render or transfer
bottleneck, using the same output requirements and Stop-prefix checks.
Track 4K encoder backpressure separately. The 4K queue wait overlaps the
H.264 submission interval and warrants profiling the encoder before
adding render workers.

### T20b2 real MVP MP4 pacing comparison

Run `npm run build` and `node research/export/mvp-export-qualification.mjs pacing "<reference MP3>"`.
Open the printed loopback page and select **Compare real MVP MP4 pacing**.
After the browser report completes, run
`node research/export/mvp-export-qualification.mjs verify-pacing`.
The runner builds the actual MVP entry point with a loopback-only bridge.
It decodes and analyzes seconds 60–64 from the supplied track in a fresh
MVP document for each measured job. The test forces one short burst
through the real PostFX pass and records the draw time of each captured
frame. It writes outputs and receipts under `logs/t20b2`.

The candidate awaits p5 redraw before capture, listens for encoder
capacity instead of polling, and yields to browser tasks on a time
budget. It keeps the initial preview handoff and the two-frame limit.
Cancellation terminates the worker immediately and keeps the capture
surface alive until an already running redraw settles. The normal MVP
export factory uses display pacing.

Three alternating pairs at 720p/60 and three at 4K/60 exercise the same
H.264/AAC configuration. The candidate also runs Cancel followed by a
Stop & save retry in the same MVP document. Native verification decodes
all saved frames, checks timestamps, codecs and audio alignment against
the reference PCM, and compares full-file hashes. When hashes differ,
the verifier reports downscaled structural similarity beside display
repeat controls. Timing covers export start through the usable MP4
result. Track analysis, fixture checks and copying output to the loopback
runner are outside the timed interval.

The Windows Headless Chrome 156 run used the No Good reference. Times are
three-run medians in seconds for each mode.

| MP4 | Display job | Candidate job | Candidate change | Candidate redraw wait | Candidate encoder queue | Candidate FFmpeg finalize |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 720p/60 | 11.519 | 12.444 | 8.0% slower | 10.472 | 0.041 | 0.339 |
| 4K/60 | 12.290 | 12.858 | 4.6% slower | 10.227 | 0.260 | 0.504 |

Each full run captured 240 ordered frames and executed the 33-frame
PostFX interval. All six MP4s at each resolution had the same SHA-256.
Both modes reached two outstanding frames. The Cancel check published
no file; the following Stop & save captured a 61-frame prefix. The
controls settled in 48 ms and 174 ms respectively, including cleanup or
finalization. These are single control observations.

Display pacing assigned roughly 10.5 s to the animation-frame wait
because that interval included asynchronous drawing. Explicit redraw
timing assigns roughly 10.2–10.5 s to drawing in the candidate, with
roughly 1.2 s in scheduled yields. The results reject promotion of this
pacing candidate. The next experiment splits the actual redraw into
simulation, Wormhole raster, composition and PostFX. Use those
measurements to choose the first bounded worker slice. The synthetic
4K result from T20b1 still describes the encoder-heavy case; the real
Wormhole workload measured here spends much more time rendering.
Long clips and physical mobile devices remain separate qualification cases.

### T20b3 MVP render stage profile

Run `npm run build`, then `node research/export/mvp-export-qualification.mjs render "<reference MP3>"`.
Open the printed loopback page and select **Profile real MVP render stages**.
Run `node research/export/mvp-export-qualification.mjs verify-render` after
the browser finishes. The existing fixture uses seconds 60–64 of the
reference, display pacing, H.264/AAC, 60 fps, and a 33-frame PostFX burst.
At 720p and 4K it runs three measured exports and one export with the
render probes disabled. The verifier decodes all files and requires
byte equality with the corresponding control.

The loopback build adds three checked source boundaries to the real p5
draw. The outer intervals cover host preparation (automation,
audio-state projection, modulation, director and dashboard), identity
draw, the PostFX pass, and draw tail. Wormhole's existing stage clock
subdivides identity work into background and motion setup, grains, weave,
material resolve, and material composition. Crossfade target
preparation, crossfade blending, and raster presentation are tracked as
nested intervals when used. The export stage report already measures
capture composition and bitmap creation separately.

The measurements record synchronous elapsed intervals in the host.
Deferred GPU work can appear in a later wait, and the grain phase
includes both geometry and raster writes. Nested timers overlap their
parent; use outer intervals to account for total draw time.

Windows Headless Chrome 156, No Good reference, Compatible raster.
The table reports independent medians of three four-second jobs at each
resolution. Stage times are totals across 240 frames, in seconds.

| Interval | 720p/60 | 4K/60 |
| --- | ---: | ---: |
| Whole export | 15.930 | 17.739 |
| Total inside p5 draw | 13.047 | 13.662 |
| Host preparation | 0.089 | 0.088 |
| Wormhole identity | 12.861 | 13.537 |
| ↳ Background and motion setup | 1.974 | 2.101 |
| ↳ Grain projection and accumulation | 4.475 | 4.791 |
| ↳ Weave | 4.841 | 5.062 |
| ↳ Material resolve | 1.160 | 1.201 |
| ↳ Material composition | 0.507 | 0.520 |
| PostFX | 0.018 | 0.028 |
| Capture composition outside p5 | 0.006 | 0.006 |

Grains and weave together represent about 71–72% of measured p5 draw
time. The 720p and 4K controls took 16.303 and 17.621 seconds. Single
controls establish output parity, with insufficient data to quantify
timer overhead. The crossfade and extra raster presentation intervals
recorded zero time in this clip. Other presets, transitions, video
backplates, longer clips and physical mobile still need coverage.

For T20b4, keep projection and weave in the same worker with the
identity's existing frame-local scratch data. Prototype one ordered
Wormhole raster with bounded in-flight frames, preserving host
automation, full export resolution and the material settings. Use the
existing host worker's identity and raster seam as a reference. Preview
uses a lower backing resolution and can skip timestamps; export requires
one result for every admitted timestamp. Measure worker time, transfer
and presentation, and the whole MP4 job against the display-paced
control. Qualify frame and audio output before any user-facing option.

### T20b4 full-resolution Wormhole worker prototype

Run `npm run build`, then `node research/export/mvp-export-qualification.mjs worker "<reference MP3>"`.
Select **Compare full-resolution Wormhole worker** and run
`node research/export/mvp-export-qualification.mjs verify-worker` after
the browser finishes. The loopback build adds an awaited raster handoff
to the actual MVP draw. The host runs the existing director, modulation
and automation. The worker receives projected analysis once and one
resolved frame per admitted timestamp. It runs the existing Wormhole
identity and material stages together and returns an owned bitmap at
export resolution. The host presents it, closes it and applies PostFX
before MP4 capture. The prototype has one raster request in flight and
uses the existing two-frame encoder limit.

The comparison uses the four-second reference at 720p and 4K, 60 fps,
three alternating pairs per resolution, and identical H.264/AAC
settings. The display-paced control uses the p5 raster. The candidate
awaits the raster response and uses the existing cooperative MP4
scheduler. The reused worker selects WebGL with Canvas2D fallback.
Round-trip time includes message dispatch, scheduling and transfer.
Its reported render interval also includes bitmap creation. Presentation
is a separate host interval. Cancel is issued during a pending raster
request. The next job saves and verifies a 61-frame prefix.

Native verification checks decoded frame timestamps, audio alignment
and the output dimensions. The exploratory gates are at least 15%
whole-job median improvement and minimum 0.98 downscaled SSIM among
matched clips. SSIM is a visual similarity screen. Longer jobs,
representative presets, transitions, backplates and physical device
qualification are required before any user-facing mode. The fixture
rejects transitions and backplates explicitly.

The Windows Headless Chrome 156 fixture chose the WebGL worker path.
Three-run medians in seconds are shown below for the same No Good excerpt.

| MP4 | Display job | Worker job | Change | Worker raster and bitmap | Host round trip | Host presentation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 720p/60 | 26.696 | 27.967 | 4.8% slower | 23.492 | 24.053 | 0.019 |
| 4K/60 | 25.767 | 29.643 | 15.0% slower | 22.889 | 23.988 | 0.022 |

Each successful full job admitted 240 ordered frames. Cancel discarded
the pending render and published no output. Stop & save produced the
next job's 61-frame prefix. The individual settlement times were 64 ms
and 512 ms. Raster and bitmap creation overlap the round-trip interval.
The desktop browser reported WebGL; the benchmark did not identify its
hardware renderer or qualify the Canvas2D worker fallback.

The worker placement did not pass the speed gate. The raster interval
dominated and the observed round-trip excess was about 0.6–1.1 seconds
per clip. Native verification passed for all 13 saved files, including
the Stop prefix. The lowest audio correlation with the reference was
0.9943. Minimum matched SSIM was 0.998456 at 720p and 0.998615 at 4K.
Prioritize reducing the grain and weave work itself before a more
involved change to the bitmap handoff. For the next speed experiment,
start with a frame-equivalent grain/weave optimization and compare the
whole MP4 job with the control. Keep this worker path available in the
local fixture.

### T20b5 conservative grain and weave scan bounds

Run `npm run build`, then `node research/export/mvp-export-qualification.mjs raster "<reference MP3>"`.
Select **Compare conservative raster bounds** and run
`node research/export/mvp-export-qualification.mjs verify-raster` after
the browser completes.

Beyond a carrier's core, the halo alone must exceed the existing
per-pixel threshold. The candidate solves that inequality once per
carrier, keeps the entire core and a margin around the halo cutoff,
and uses the resulting radius for the scan bounds. The visited pixels
still use the same shading and accumulation order. Both variants run
inside the loopback build of the actual MVP renderer.

The comparison uses three alternating 4K/60 pairs and one 720p/60
guard pair on the same four-second No Good excerpt. Both modes collect
the existing grain and weave timings. The verifier checks complete
decoded frames, audio alignment, and byte equality for each matched
MP4. Whole-job median gain at 4K is compared with the 15% speed gate.

The 4K median moved from 12.658 to 12.501 seconds per export. Grain and
weave time moved from 7.849 to 7.817 seconds. The 1.2% whole-job
difference falls below the speed gate. In the single 720p guard pair the
job time moved from 12.368 to 11.756 seconds while grain and weave time
increased from 7.450 to 7.825 seconds. That pair is a parity guard, with
insufficient repeats for a speed claim. All four MP4 pairs matched byte
for byte. All eight files passed native frame and audio verification.

The candidate stays in the local benchmark. A later acceleration
attempt should revisit this stage with a candidate that changes the
measured cost enough to justify longer desktop and physical mobile
tests. Proceed with T21b after the current manual handoff.

### T20c optional Turbo export plan

Start after the export quality baseline is accepted. Keep Standard as
the default. Standard and Turbo must preserve the same output format,
resolution, frame rate, audio sample range, timeline and quality policy.
The choice belongs to the MVP Export dialog, persists locally and is
included in Copy export settings. Its availability is checked per export
configuration, independent of artistic presets.

1. Reprofile complete jobs at the accepted quality settings. Compare
   queue waits, grain and weave, post-FX, pixel transfer, video encoding,
   audio and finalization. In T20b3 grain and weave took 71–72% of draw
   time. Moving the whole raster to a worker in T20b4 slowed 4K export by
   15%. The T20b5 scan-bound optimization gained 1.2% across the job.
2. Keep one sequential owner of simulation, automation and frame numbers.
   Prototype parallel grain and weave work on independent output tiles
   with overlap at their edges and stable accumulation within each tile.
   Compare a transferable-buffer CPU path with a GPU raster candidate
   where supported. Keep raster results resident until composition when
   practical. A worker location alone does not reduce raster work.
3. Pipeline completed frames into one ordered encoder. Start with two
   in-flight frames and recycle buffers. Admit frames against actual
   acknowledgements and encoder queue pressure. One 4K RGBA frame is
   about 32 MiB before encoder surfaces. Measure thermal throttling and
   peak resources on long jobs. Use worker-local codec and render probes
   before the full job starts. A failed Turbo preflight offers Standard.
   Stop saves the last contiguous prefix and Cancel cleans up only its job.
4. Promote Turbo per qualified configuration. Use three alternating
   Standard/Turbo pairs at each claimed target and require at least 15%
   lower median time from start through downloadable file, including a
   cold run. Check short and five-minute clips, MP4 and WebM, desktop and
   physical Android/iOS browsers, frame continuity, motion and image
   error against source frames, A/V sync, Stop, Cancel and retry.
5. Revisit segmented encoders or multithreaded WASM only if encoding or
   finalization becomes the measured bottleneck. Segmented encoders
   require independent keyframe starts, stable codec configuration and
   ordered remux with a single audio clock. The current MP4 FFmpeg core
   copies the WebCodecs video and encodes the audio. A faster FFmpeg core
   would affect only its own portion of the current pipeline.

The portable path uses dedicated workers and transferable frames or
buffers. WebCodecs, OffscreenCanvas and any SIMD kernel are capability
tested. Shared memory, when available, is an optional optimization with
a separate deployment gate.
[WebCodecs](https://www.w3.org/TR/webcodecs/#videoencoder-interface)
and [HTML OffscreenCanvas](https://html.spec.whatwg.org/multipage/canvas.html#the-offscreencanvas-interface).

### T20c1 parallel material tiles

The first Turbo experiment splits the material accumulation raster into
two or four disjoint horizontal row ranges. One host still advances
simulation, automation and frame numbers. Each worker visits all grain
and weave carriers in their original order, with the full-raster sample
coordinates, and writes only its own rows. This preserves contributions
crossing tile boundaries without combining independently rounded sums.
The scalar rasterizer's optional tile argument leaves ordinary callers
on the full-raster path.

`research/export/parallel-material.mjs` owns a bounded worker pool.
The carrier list uses Float64 transport to preserve the original JS
numbers. Transferable input and Float32 output buffers return to the
same worker for reuse when sizes match. Input allocation follows the
active carrier count. The host joins L0, runs the existing L1/L2 resolve,
composites the original layers, draws the musical display and applies
the existing PostFX pass. There is one material frame in flight, while
the unchanged encoder admits at most two completed frames. Replies must
match the frame serial, tile, carrier count and buffer sizes. Failure,
timeout and cancellation terminate the pool and reject pending work.

This is a loopback experiment for a steady Wormhole without a backplate.
The qualification build alone injects an awaited material handoff and
defers the musical display until the material completes. Production
`p.draw`, live preview, XR, the export menu and its defaults do not use
this prototype. Its private display interception must become an explicit
renderer contract before production integration.

Run `npm run build`, then
`node research/export/mvp-export-qualification.mjs parallel "<reference MP3>"`.
Open the printed URL, select the parallel comparison and then run
`node research/export/mvp-export-qualification.mjs verify-parallel`.
The optional `workers=4` query selects four workers; two is the fixture
default. Compare each worker count in a separate retained run.

The fixture uses the accepted MP4 VP9 Profile 2, 10-bit quality, 60 fps,
one-second keyframes and the same four-second No Good excerpt. Three
alternating 4K pairs and one 720p guard pair compare complete job times,
including worker startup and codec finalization. Cancel interrupts a
pending tile; the same host then retries Stop & save. Native validation
checks every decoded frame timestamp, codec precision, AAC alignment and
matched encoded video hashes. Transfer-byte counts describe traffic,
not peak memory; concurrent stage times must not be added to job time.

Windows Headless Chrome 156, Intel Core Ultra 7 258V, eight logical
processors, about 32 GiB system RAM. Both worker counts used the same
reference excerpt, whose SHA-256 is
`73277217ce1d12e9172cad562ff2f5ebf1f791180b0d9269b3f4fedde2998c9a`.
The three 4K pairs include the first worker start. The 720p result is a
single guard pair, insufficient for a speed claim.

| Workers | 4K control median | 4K candidate median | 4K job change | 720p guard change |
| --- | ---: | ---: | ---: | ---: |
| 2 | 32.510 s | 33.574 s | 3.3% slower | 4.5% slower |
| 4 | 30.362 s | 31.766 s | 4.6% slower | 11.6% slower |

All eight matched file pairs are byte-identical. Native validation
decoded all 3,962 saved frames in 18 files, including both Stop prefixes.
Minimum sampled audio correlation with the PCM reference was 0.9943.
Cancel during a pending material frame published no file; the same host
successfully retried Stop & save. Transfer traffic peaked at 6,007,200
bytes per material frame with two workers and 8,328,000 with four.
Two-worker median tile round-trip time totaled 18.994 seconds per 4K
job, versus 17.788 with four; resolve/presentation totaled 2.221 and
2.088 seconds. These intervals overlap other job stages.

Neither count passes the 15% whole-job speed gate; four also fails the
720p slowdown guard. Retain this as an unpromoted numerical reference.
No public Turbo choice is enabled. Receipts are under
`logs/t20c1-parallel-material`, with the first run located by
`two-worker-run.txt` and the second by `active-run.txt`. Their verification
receipt SHA-256 values are
`5729f1d969d3371b575161bc438c060eb7c5fba33a19ab61571bc04e05f68b98`
and `10c787e309bd8929dd7a79c8544361d9d4be38f04aebac846e2cda1eb5f30276`.
The first experiment retains a served-file hash inventory; the second
also retains a build manifest. Its historical `sourceCommit` is the
base commit with an uncommitted prototype, identified by its bundle
hashes. New manifests explicitly label the base commit and dirty state.

Following the user's GPU question, next is **T20c2, a bounded GPU
material-raster experiment**, before public UI integration. The XR
`GrainMaterialRenderer` already implements the carrier capsule law on
the GPU. Reuse its algorithm through a host-independent export adapter;
do not import the XR scene/runtime into MVP. Keep one owner of simulation
and frame numbers, and retain the original material resolution and
accepted 10-bit codec policy. Measure preparation/upload, accumulation,
resolve, GPU completion, canvas/bitmap handoff, encoding and whole-job
time, including cold initialization. Prefer resident GPU composition
where the host permits it; a GPU location alone is not a speed result.

The XR half-float accumulation differs numerically from the CPU path
and cannot inherit the byte-equality result above. Check render-target
capabilities and precision, and predeclare image-error, dark-gradient,
banding and temporal-continuity criteria against uncompressed scalar
reference frames before running the comparison. Preserve the numbered
frame, audio, PostFX, Stop/Cancel/retry and cleanup gates. Only a viable
candidate proceeds to paired complete exports and broader qualification.

A bulk scalar double-precision WASM kernel remains a reserve experiment
if GPU capability, image quality or transfer cost prevents qualification,
or if profiling still identifies CPU material work as a bottleneck.
It must preserve noise identity, carrier order and explicit Float32
raster stores, with transcendental/rounding checks. More JS workers
alone have not helped at the accepted export quality.

A viable candidate still needs long jobs, transitions, backplates,
WebM, portrait layouts, physical mobile, peak resources and fallback
qualification before the T20c menu/storage/Copy integration. T21b
follows the Turbo investigation and manual handoff.

Validation: `npm run build`, 185 targeted Node tests and a final
five-test worker-pool rerun passed. The standalone research-worker
type check passed with
`node node_modules/typescript/bin/tsc --ignoreConfig --allowJs --noEmit --target es2023 --module esnext --moduleResolution bundler --skipLibCheck research/export/parallel-material.worker.ts`.
`npm test -- --test-concurrency=4` ran all 2,136 cases: 2,121 passed,
nine failed with the retained baseline names and assertion evidence,
and six encountered sandbox filesystem/Git/PowerShell restrictions.
The same three platform test files passed all eight cases with workspace
`TEMP`/`TMP` and normal local permissions, without source changes. No
test was skipped. `acceptance.json` retains the raw full-run hash,
classifications, exact commands and hashes for all 222 active test files
and 41 helper/fixture files. The previous 2,129-case MP4 precision run
also completed with its same nine known failures.

### 4K/60 MP4 playback integrity follow-up

The reported 410.58-second No Good export (Windows Media Player, source
window 00:47–01:00) contains 24,635 consecutive video packet timestamps
and 411 keyframes at one-second intervals. The entire file decoded with
FFmpeg. It declared H.264 High Level 5.1 for 3840×2160 at 60 fps.
This output needs Level 5.2 by the H.264 Annex A macroblock processing
limit: 32,400 macroblocks per frame and 1,944,000 per second.
[ITU-T H.264 Annex A](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-H.264-202408-I%21%21PDF-E&lang=e&type=items)

The MP4 worker now selects the minimum applicable level using picture
size, frame rate and bitrate. It verifies that the browser can encode
and mux a real frame at those settings. If the preferred 4K configuration
is refused or reports a lower level, the probe tries variable rate control
at the same target bitrate. If the explicit codec configurations cannot
encode, it tries the browser's default AVC profile and level.
A working encoder may still report a lower AVC level. In that case MP4
keeps the browser's original bitstream and logs the reported and requested
levels in the worker console. Some players may rely on this declaration
when selecting a decoder.
MP4 capture also waits for p5 redraw completion. The display-paced
route still schedules its normal display callback, concurrently with
redraw, and waits for both before copying pixels.

Run `node research/export/mvp-export-qualification.mjs integrity` after
the build. The local fixture embeds a frame number in every 720p,
1080p and 4K frame. `verify-integrity` checks the decoded frame numbers,
encoded AVC levels, ordered timestamps and one-second keyframes.
The browser also checks audio endpoints and cue alignment. Chromium
and native FFmpeg verified all 960 decoded frame numbers across the
three resolutions, including 720 frames at 4K. The emitted levels
were 3.2, 4.2 and 5.2 respectively.

For player diagnosis, the three local 00:45–01:03 remuxes preserve video
samples while varying level signaling and then fragment layout. These
separate a player issue from motion already present in the rendering.
The signaling defect and redraw race are established independently;
the exact cause of the reported layer motion in Windows Media Player
still needs the matched playback check.

### 4K MP4 temporal quality against WebM

The original report covered 00:47–01:00 of No Good and persisted
after level signaling and container changes. The three remuxes had
identical decoded frames. Production FFmpeg copies the H.264 video and
encodes AAC; the browser video encoder owns video quality, rate control,
and keyframe decisions. [FFmpeg stream copy](https://ffmpeg.org/ffmpeg.html#Streamcopy)

Build the app, run
`node research/export/mvp-export-qualification.mjs motion "<reference MP3>"`,
and select **Compare 4K motion against WebM**. Run
`node research/export/mvp-motion-verify.mjs` after the browser completes.
The local fixture reanalyzes seconds 46–60 and uses the actual MVP
renderer. It compares 4K/60 WebM, the prior H.264 policy, and two
H.264 candidates with a 40 Mbit/s constant target and different
keyframe spacing. The 384×216 crop at (2176, 912) comes from the original
render before encoding. Its hash must agree for all four jobs.

Native decoding checks the full video clock and the audio endpoint,
and measures the luma crop separately in every second. Spatial error
is the mean absolute luma error. Temporal error is the mean absolute
difference between the decoded and reference inter-frame luma change.
Boundary error measures the same quantity at each whole-second edge.
This controlled excerpt has its own track analysis. It is a codec
comparison, with the original full-length playback still a manual case.

The matched 840-frame input was identical in the measured crop. The
following native results use 8-bit luma code units. The JSON receipt has
the results for every second from 00:46 through 00:59.

| 4K/60 export | Effective video Mbit/s | Spatial error | Temporal error | Whole-second boundary error |
| --- | ---: | ---: | ---: | ---: |
| Prior MP4, 28 Mbit/s variable target, 1 s keyframes | 23.711 | 1.2722 | 0.6022 | 0.5714 |
| WebM, 40 Mbit/s constant target, 1 s keyframes | 39.243 | 2.2862 | 0.5915 | 0.6910 |
| MP4, 40 Mbit/s constant target, 1 s keyframes | 28.705 | 1.2199 | 0.5740 | 0.5694 |
| MP4, 40 Mbit/s constant target, 2 s keyframes | 28.550 | 1.2180 | 0.5757 | 0.5648 |

The one-second candidate reduced temporal error by 4.7% overall and
improved 12 of the 13 measured seconds in the reported window. Moving
every other keyframe did not remove a recurring one-second error or
improve overall temporal fidelity. All variants retained ordered video
and audio correlation above 0.99 in the sampled windows. The test
identifies a quality improvement and leaves the precise cause of the
original layer reversal unconfirmed.

Production uses the 40 Mbit/s constant target for UHD MP4 and keeps the
one-second keyframes. If the actual browser probe rejects constant
rate control, it retries variable rate control at the same target.
Both paths admit storage at the configured target before starting.
The matched candidate used about 21% more bytes than the prior MP4.
Use `motion-production "<reference MP3>"` and
`node research/export/mvp-motion-verify.mjs --production` to check the
actual production worker without the experiment transforms.

### Full-length MP4 and WebM follow-up

The two November 6 exports supplied for the No Good playback report each
contain 24,635 decodable 3840×2160 frames at 60 fps. Their presentation
timestamps are continuous at the container's precision and DTS increases
throughout. MP4 has 411 one-second keys and WebM has the same cadence with
two additional keys. The complete video payloads averaged 9.88 Mbit/s
for MP4 and 30.89 Mbit/s for WebM. At 00:46–01:00 the rates were
10.44 and 35.75 Mbit/s. Native D3D11 and software H.264 decoding
matched byte for byte in the reduced luma comparison from 00:45–01:02.

The measured inter-frame luma changes in the two files correlate at
0.955 in the reported 00:47–01:00 window. The largest changes include
the same frames near 00:53.583 and 00:56.683. The formats diverge
more at whole-second boundaries than between them. This identifies
common image motion and a compression difference. The comparison
cannot assign the perceived reversal to an individual rendered layer.

The WebM capture path now waits for the requested p5 redraw, as MP4
already did. MVP 4K WebM requests 64 Mbit/s, with the prior 40 Mbit/s
target retried during preflight if needed. In the matched 840-frame
fixture, the mean temporal luma error fell from 0.5915 to 0.5667
and boundary error fell from 0.6910 to 0.6706. The test file grew
from 68.9 MB to 85.2 MB. Both numbers are measurements for this clip.

The 80 Mbit/s MP4 request with half-second keys and automatic encoder
selection barely moved the effective rate or the temporal error.
The 80 Mbit/s software preference with two-second keys and variable
rate control reduced mean temporal error from 0.5740 to 0.5265 but
raised whole-second boundary error from 0.5694 to 0.6011. Keep the
existing MP4 configuration. For the next MP4 quality experiment,
capture the exact render before compression and evaluate temporal
error at keyframe boundaries and in the surrounding frames against
that reference. Qualify the winning policy on the affected desktop
encoder and physical mobile before changing the default.

### Dark gradient precision in WebM

The replacement 4K WebM reported on November 7 uses VP9 Profile 0
with 8-bit limited-range YUV. In the dark lower-left glow at
01:25–01:32, over 99% of luma pixels occupy three adjacent codes in
each sampled whole-second frame. Several strong horizontal transitions
align with codec block rows. A five-second No Good excerpt reanalysis
compared the real MVP render before compression with the decoded export.
Compression made neighboring dark RGB pixels substantially more likely
to become identical. The raw render has its own fine dithering pattern.

MVP offers **WebM (10-bit gradients)** alongside the existing WebM and
MP4 choices. The format selection is saved locally and copied with the
export settings. VP9 Profile 2 uses a worker-side encode/decode preflight
at the requested size and frame rate. A refused profile gives an error
before the real job starts. Standard WebM remains the compatible choice.
The 10-bit file has a separate download name for comparison.
[W3C VP9 codec registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/)

In the matched 4K/60 desktop Chrome fixture, the mean absolute 8×8-tile
luma error in the dark corner fell from 2.36 to 0.40 RGB code units.
Five sampled frames were compared to their uncompressed renders.
The 10-bit clip was about 48% larger and the observed single run took
45 seconds versus 36 seconds. Some horizontal block structure remains
and blue-chroma error increased in the sampled region. Manual playback
on the affected system and physical mobile compatibility remain open.

### MP4 at the accepted WebM precision

The user accepted the 10-bit WebM quality and requested higher precision
where possible, plus equivalent MP4 output. A real 4K/60 desktop Chrome
probe encoded and decoded VP9 Profile 2 at 10 bits. The same browser
refused 12-bit VP9, 10-bit H.264, 10-bit HEVC and VP9 Profile 3.
AV1 accepted the configuration query but rejected actual encoding.
Those are observations for this browser and machine.

MVP offers **MP4 (10-bit VP9 + AAC)**. The format choice persists locally
and Copy export settings includes `mp4VideoCodec: "vp9-10bit"`.
This option uses the same VP9 profile, bitrate, frame rate and one-second
keyframe policy as the 10-bit WebM option. Its file name is
`plexus-visual (10-bit).mp4`. The worker checks real video encoding,
decoding and MP4 staging before allocating the full render target.
The 4K target is 64 Mbit/s, 1080p uses 14 Mbit/s and 720p uses 8 Mbit/s.
Temporary storage admission uses the corresponding rate.

VP9 has a defined MP4 binding. Player and editor support for VP9 in MP4
must be checked for the intended destination. The export menu describes
this requirement beside the format choice.
[WebM Project VP Codec ISO Media File Format Binding](https://www.webmproject.org/vp9/mp4/)

The FFmpeg 5.1.10 core now includes the VP9 parser and decoder so that
its demuxer can determine the pixel format before writing the VP codec
configuration box. Its CLI still copies the encoded video packets and
encodes the PCM audio as AAC. The JavaScript and WASM URLs include the
new build revision to avoid using a previously cached core. The build
recipe, notices and corresponding upstream sources remain alongside
the public core. The new WASM SHA-256 is
`430d6a10612772ead0349d0d823b34b0771f00eec82f9c9e1a5399747b9f4e0b`.

In the five-second 4K/60 No Good comparison, the 300-frame MP4 and the
accepted WebM fixture have identical encoded video packet hashes
`735dd69770d0db07b488c831c04008bb26a1d8d3dcf2ec67dfb32af32e621d15`.
Both source-image hashes also match. Native probing identifies VP9
Profile 2, 10-bit YUV and AAC in the MP4. This checks container
conversion against the already accepted codec policy.

Use `node research/export/mvp-export-qualification.mjs integrity-precision`
and then `verify-integrity-precision` for the numbered 720p, 1080p and
4K MP4 checks. Open `tests/browser/mvp-mp4-smoke.html?precision`
through the local development server for full, Stop, Cancel, retry,
audio, video-element playback and owned-storage checks. Physical
mobile playback and the user's destination player remain manual gates.

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
