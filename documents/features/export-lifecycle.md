# Export lifecycle - T19a

Implemented 2026-10-29. One integration owner covers export, worker ordering and
Studio/MVP controls. This is the first bounded T19 slice, not isolated rendering.

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
