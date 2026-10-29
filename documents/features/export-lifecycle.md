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
