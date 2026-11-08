# WH-07a: bounded WebM Turbo and explicit MP4 fallback

Date: 2026-11-08, Europe/Budapest. Integration owner: this chat's agent.
Predecessor: `77c0d5b`; original source/test identities are retained in
[the predecessor manifest](../tests/wormhole-wh07-predecessor.json).
Status: implementation, cumulative/local quality and speed qualification complete. The user accepted faster 4K60 10-bit WebM with perfect perceived image quality. Release/public receipts are retained in `logs/wh07/final-*.json` and the session checkpoint. WH-07b may proceed; mobile 10-bit remains deferred.
WH-07 remains partial: this is its first functional handoff, not a claim of
qualified MP4 acceleration or physical-mobile performance.

## User decision and delivered behavior

The user chose **Turbo first, mobile 10-bit later**. WH-06e's new software video
encoder is deferred. The native encoder refusal recorded in WH-06c1 does not
block speeding up formats already supported by the browser. WH-06d 8-bit quality
work stays withdrawn; accepted 10-bit precision/detail is preserved.

Dashboard and MVP expose Economy/Turbo as a device/export preference, default
Economy, saved at `plexus.export.performance.v1`. Unknown/unavailable preferences
use Economy; no visual preset owns the option. The current request, effective
mode, final timing, source kind, queue/PCM resource bounds and outcome are
copyable. Controls lock during an active job. Each view keeps one bounded timing
report, resets it at the next attempt and owns its nested scalar records.

Turbo accelerates WebM through immediate encoder-capacity feedback and
event-driven admission. MP4 currently retains Economy even when Turbo is
requested, with the explicit reason `mp4-throughput-unqualified`. MVP's option
and help explain this before export; the final status/Copy identifies the
effective path. This prevents a speed-unqualified MP4 experiment being presented
as an accepted fast profile. MP4's default and all existing formats stay intact.

## Measured promotion, including rejected controls

The retained project gate is at least **15% lower median whole-job time on the
claimed target**, with unchanged quality and bounded resources. No slower
artificial Economy baseline was introduced. All trials use the actual product
exact GPU renderer, native WebCodecs, real audio, OPFS and MP4 FFmpeg finalize.

Three alternating control/candidate pairs measure each workload; repeated
initialization/warmup is explicit. Timings exclude QA readback, artifact copying,
hashing and independent decoding. Workloads use fixed synthetic music evidence,
dense material and real PostFX. The three exploratory WebM runs explicitly used
64 Mbit/s at 720p; final promotion measurements use the actual UI defaults
(8 Mbit/s at 720p, 64 Mbit/s at 4K), separately for both resolutions.
They are short renderer/encoder fixtures, not a
complete analyzed reference song or a physical Samsung test.

| Experiment | Native VP9 10-bit MP4 | VP9 10-bit WebM, 720p60 |
| --- | --- | --- |
| Existing constructor-injected cooperative control | No qualified gain | No qualified gain |
| Event-driven queue and time-budget yield | No qualified gain | 33.6–36.6% lower paired job time |
| Reusable task channel for browser yields | No qualified gain | 35.3–36.8% lower paired job time |

Every paired output in these three runs has **identical independently decoded
video pixels**, not merely matching packet timestamps. MP4 trials include
720p60/240 frames and 4K60/90 frames, three pairs each. The existing inter-frame
and duration experiments remain separate historical evidence.

Preserved run directories:

- Constructor control: `logs/wh01/run-a9a77d2b-3c34-43c4-9fc2-94cc6918b910`.
- First event-driven candidate: `logs/wh01/run-6f2696ba-65cd-4a24-a41b-1fbde24b922b`.
- Task-channel candidate: `logs/wh01/run-f90894dd-4cbd-4dcd-aebf-bc0c76de68ae`.

`build.json`, `turbo-benchmark.json` and `turbo-artifacts.json` bind each distinct
source/bundle/arguments and encoded/decoded identities. Later final public
qualification also measures 4K60 WebM and the explicit MP4 Economy fallback.
Do not reinterpret the rejected MP4 candidate as passing because WebM improved.

## Architecture and bounds

### CPU, GPU, browser codecs and WASM: separate responsibilities

| Stage | Owner and execution | What Turbo changes |
| --- | --- | --- |
| Musical state, automation, frame index and composition orchestration | Existing host JavaScript/CPU; exact song time is `frameIndex / fps` | No new clock, analysis or producer |
| Wormhole geometry and carrier preparation | The existing render worker executes JavaScript/CPU | No new geometry approximation |
| Material deposition, resolve, weave and bloom filtering | WebGL2 shaders in the render worker; exact accumulation/filtering retains Float32 | No lower precision, reduced density or raster resolution |
| Base lines/cosmos, per-layer composition, transitions and PostFX | Existing Canvas/host adapters; the browser may GPU-accelerate Canvas internally | Native sampling, layer order and completion barriers retained |
| Video compression | Browser `VideoEncoder` via WebCodecs in the encoder worker; VP9 profile 2 for the accepted 10-bit WebM | Same codec, bitrate and GOP; prompt queue feedback |
| WebM audio/container | Browser Opus `AudioEncoder` and the existing JavaScript WebM muxer | Same audio settings and bounded progressive output |
| MP4 audio/container | Current FFmpeg WASM core encodes AAC and copies the already encoded video into fragmented MP4 | WH-07a retains Economy for MP4; no video re-encoding by WASM |
| Temporary output and download | Worker-owned progressive OPFS files; explicit result/download ownership | Same disk streaming and bounded PCM/frame admission |

Web Workers move JavaScript off the UI thread; they do not automatically turn
that work into GPU computation. WASM also executes CPU code here, with its own
linear memory. Neither is a substitute for WebGL shaders or the browser's native
video encoder. GPU rendering, CPU orchestration and asynchronous codec work
already overlap; Turbo reduces avoidable polling/yield delays in that pipeline.
It does not split the movie into independent render chunks or start a farm of
video encoders. Stateful animation remains sequential and deterministic.

WebCodecs leaves the codec implementation to the browser. Even
`hardwareAcceleration: 'prefer-hardware'` is a hint, not a guaranteed hardware
selection or a usage meter. The default allows browser/device optimization;
forcing a preference can reduce support. See the primary
[W3C hardware-acceleration contract](https://www.w3.org/TR/webcodecs/#hardware-acceleration).
Our support/probe and wall-clock reports cannot attribute codec work to CPU,
3D GPU or the dedicated video engine. A Task Manager **Video Decode** graph is
not proof of which encoder performed the export.

### User acceptance and copied diagnostic scope

The user reports visibly faster export and perfect WebM image quality with
Windows Chrome 156, 3840x2160, 60 fps, Turbo, WebM 10-bit, no watermark.
Their copied configuration requests `vp09.02.51.10` at 64 Mbit/s and shows a
successful three-frame encoder/decoder preflight. This is separate manual
perceptual acceptance; it supplies no measured complete-job duration.
`encodedFrames: 3` / `decodedFrames: 3` describe that temporary codec probe,
not the movie's frame count. In this copy `performance` is null and the tab has
no finished cached file, so the copy alone cannot establish terminal job
timing, frame source or hardware assignment. It does not contradict the user's
observed successful export. The terminal performance report after completion
is the appropriate evidence for effective mode and duration. No whole-song,
thermal, Stop/Cancel or physical-mobile acceptance is inferred from this report.

- `ExportPerformance.ts` is a dependency-free policy/type/validation leaf.
  It owns strict mode normalization, the MP4 promotion fallback and a versioned,
  bounded scalar timing contract. It does not import State, audio, DOM or codecs.
- Export owns the job/scheduler. UI owns preference storage, display and Copy.
  The backend emits one terminal performance observation; facade/controller/view
  guard current-job identity. Observation errors cannot change the job result.
- Turbo still admits at most **two outstanding frames** and requires both the
  raw-frame acknowledgement and codec queue capacity. PCM retains two reusable
  buffers. No extra renderer/encoder worker, larger frame queue or whole-movie
  buffer is introduced. Render/encode overlap already existed; no new independent
  frame producer or timeline is claimed.
- WebM start messages may carry `queueEvents: true`. The worker additionally
  reports native `dequeue`, submission and output capacity. The original 50 ms
  periodic feedback stays as a backstop. Encoded-packet and PCM handling, codec
  configuration, bitrate, precision and GOP are unchanged.
- Turbo yields through one reusable MessageChannel on a time budget. It posts
  browser tasks, not an unbounded microtask loop; missing/unavailable channels
  use a timer fallback. Stop/Cancel release a pending yield, and teardown closes
  both ports. Prior-job callbacks cannot resume a replacement job. Economy and
  the injected historical research schedule retain their original behavior.
- Exact frame/PostFX completion, contiguous timestamps, source lease ownership,
  progressive OPFS writing, FFmpeg AAC/mux and cleanup remain authoritative.
  Timing records are overlapping host/worker wall clocks, not CPU/GPU usage;
  they cannot be summed. Backend totals exclude facade module/capability lookup
  and download dispatch. No new WASM video encoder is installed.

## Validation and reproduction

Retain every prior active Node test, source/host/image gate and negative
experiment. Additive fixture adaptations preserve all earlier assertions, while
checking the new mode and timing data independently. The original exact-source
test body remains protected by its prior SHA.

New checks cover identical PCM/frame input, strict explicit/default mode
precedence, MP4 promotion fallback, prompt queue events, unchanged admission,
Stop/Cancel/error/watchdog, one reusable yield channel and stale callbacks,
closed ports on retry, bounded/owned timing records, observer exceptions,
saved/copied controls, job locking and both hosts. Browser export QA keeps the
original 18 Economy rows separate and adds Turbo rows with real decoded frame
IDs, actual PostFX, crossfades, resize and Stop/Cancel/retry in both containers.
Real DOM checks and the published hosts verify preference and Copy wiring.

```text
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test tests/export-performance.test.mjs tests/export-scheduling.test.mjs tests/export-diagnostics.test.mjs tests/mvp-export-panel.test.mjs
node research/export/wormhole-baseline.mjs capture --exact-host --export-host --turbo-export-host --diagnostics-host [--turbo-host] [--public-release=ID]
node research/export/wormhole-baseline.mjs verify
git diff --check
```

Final build succeeds. Targeted: **245/245**, 41608.015 ms. Full cumulative:
**2239 cases / 2230 pass / exactly the same nine baseline failure names and full
messages / zero skips or cancellations**, 489115.9686 ms. The earlier new test's
cross-VM object-prototype comparison was corrected to compare owned scalar values;
its failed run is retained separately, and the complete closing runs pass it.

Local quality run: `logs/wh01/run-7594d048-f9ce-4eba-9e48-cad2997cc7ca`:
37 host checks, 21 source cases, four full-size PNGs, eight retained diagnostic UI
checks plus four new Turbo checks. The original 18 Economy rows/17 files remain
separate; 21 Turbo/fallback rows add 19 files. **770 frame IDs** are independently
decoded; all twelve 10-bit files retain their precision. The raw/PostFX image
thresholds and original exact-test body SHA are unchanged. One subsequent local
fixture difference only corrects the benchmark's unused bitrate defaults;
the final speed run and published QA bind the final source.

Final quiet speed run: `logs/wh01/run-4c15e786-5435-42d4-a8c8-a1a9c1c6c692`,
with the actual menu defaults, 24 files, three alternating pairs per workload.

| VP9 10-bit WebM target | Economy median | Turbo median | Reduction | Independent decoded pixels |
| --- | ---: | ---: | ---: | --- |
| 720p60 / 240 frames / 8 Mbit/s | 6244.6 ms | 3946.0 ms | 36.81% | Identical in all three pairs |
| 4K60 / 90 frames / 64 Mbit/s | 4611.2 ms | 3797.2 ms | 17.65% | Identical in all three pairs |

All individual pairs exceed the 15% speed gate at both claimed targets; all
resource reports stay within the two-frame/two-PCM-buffer policy. The MP4
rows in this final run verify the **explicit Economy fallback**, not a new
MP4 speedup. Their paired decoded pixels are also identical. The rejected MP4
experiments above remain the reason for that policy. Final source hashes,
commands, failures, artifacts and speed statistics are bound by the
[acceptance receipt](../tests/wormhole-wh07-acceptance.json). Node/npm and the existing guarded Node Pages publisher
are used; the package deploy command requires Bun. No dependency installation,
golden regeneration or Graphify rebuild is required. No physical-mobile,
full-song/thermal, total RAM/VRAM or universal speed multiplier is claimed.

## Manual handoff and next step

Compare the same supported 10-bit WebM settings/song in Economy and Turbo;
check final timing/Copy, gradients/detail, sound, Stop & save, Cancel and retry.
Verify reload keeps the choice. For MP4, Turbo remains a saved request but the
effective mode explicitly says Economy. Native 10-bit refusal on Samsung is
still expected for the previously rejected configuration; it is deferred work.

Stop after this first handoff. **WH-07b** investigates the remaining actual
MP4 render/encode bottleneck and promotes only a measured quality-preserving
candidate; it must not weaken the accepted precision/GOP or advertise the
rejected pacing control. Then the deferred mobile WH-06c2/WH-06e work and WH-08 long/platform
qualification, in that order unless the user reprioritizes. T21b/c and
T22–T24 follow the existing roadmap; Wall and WH-06d stay deferred/withdrawn.


## Public qualification and layout follow-up

Release `wh07a-webm-turbo-20261108T185100460Z`, source `3df577f`, passed the
37 host / 21 source / 18 Economy + 21 Turbo/fallback cases publicly, with
36 files / 770 independently decoded IDs and cross-host saved preferences.
Run: `logs/wh01/run-07fbb535-9c4d-487b-909b-f173d9faa07d`.
Visual inspection found the QA screenshots captured boot overlays before their
fade completed. A research-runner-only follow-up waits for both product loaders
to disappear and then two animation frames before capture. No product runtime,
quality gate or codec changes. Final Pages input hashes and the product artifacts
are compared against this already qualified release; the final public control/
layout check and its two PNGs close that observation. Earlier overlay screenshots
remain distinct evidence, not replaced or called accepted layouts.


The corrected layout capture also exposed missing shared select styling on FPS
and throughput controls. A scoped MVP CSS follow-up applies the existing dark
style consistently with full-width, touch-sized controls and block help text.
The real 412px layout check requires both selectors to be readable and touch
sized. This changes only export-dialog CSS; renderer/codec/worker source and
accepted video pixels remain unchanged. Build and targeted UI checks run again;
final release inputs and critical worker artifacts bind the follow-up.


## WH-07b1: MP4 bottleneck experiments, both rejected (2026-11-08)

The predecessor WebM Turbo was manually accepted. This is the next bounded
research handoff, **not completion of WH-07b or promotion of MP4 Turbo**.
Integration owner: this chat; visuals owns material composition, export owns
codec/queue/mux, research owns experimental worker adapters and reproduction,
UI/state/audio ownership is unchanged. No file under `src/` changed.

The original profiles put most MP4 wall time in `renderRequest`, with codec
probe, encode backpressure and FFmpeg finalization also material. Those are
wall-clock intervals, not CPU samples. They overlap across workers; adding them
or calling all render waits GPU computation would misstate the bottleneck.
The earlier scheduling-only negative experiments remain intact.

Two isolated candidates were implemented in laboratory worker entrypoints:

1. `research/export/stable-material.worker.ts`: keep a padded GPU presentation
   surface at material-grid dimensions instead of resizing the default drawing
   buffer for each of three layers. Duplicate a texel at each border, preserve
   Float32 passes and native per-layer Canvas additive composition. The old
   worker remains the control. This tests resource reuse, not lower resolution.
2. `research/export/paired-encoder.worker.ts`: two native `VideoEncoder`
   instances process independent VP9 key pictures, with timestamp-order output
   before the existing Mediabunny/OPFS/FFmpeg path. The render producer and its
   history remain sequential. Dependent three-frame probe pictures remain on
   the first encoder. At most four pending encoded pictures bound the reorder
   queue (the library's existing backpressure threshold); host raw/PCM admission
   remains unchanged. A reset/close generation rejects late output/errors.
   This is a deliberately constrained research facade, not a general replacement
   implementation of the WebCodecs interface or a product codec pool.

Both use the actual product backend, 10-bit VP9/all-key MP4, real audio/OPFS/
FFmpeg, 60 fps, 240 frames at 720p and 90 at 4K. Each target has three alternating
control/candidate pairs plus an explicit warmup. The paired-codec experiment
uses the original renderer, not the rejected stable-surface candidate. Export
intervals exclude artifact copies, hashing and independent FFmpeg decoding.
No deterministic CI assertion depends on wall-clock speed.

| Candidate | 720p median control / candidate | 4K median control / candidate | Promotion |
| --- | --- | --- | --- |
| Stable presentation surface | 6917.7 / 7423.7 ms (7.3% slower) | 11570.5 / 11265.8 ms (2.6% less time) | Rejected |
| Two native codecs | 7659.5 / 8365.0 ms (9.2% slower) | 11200.4 / 11431.0 ms (2.1% slower) | Rejected |

These are separate runs with their own controls, not comparable absolute device
performance scores or a guarantee on another machine. Individual paired gains
are mixed. Neither candidate meets the retained 15% per-target whole-job gate.
In each experiment **zero of six MP4 pairs** have identical independently decoded
pixel hashes. This is an identity failure, not proof of visible degradation;
no perceptual tolerance was loosened and no better image quality is claimed.
Stable-surface WebM rows also differ in scheduler and are not isolated material
speed evidence. The accepted product renderer, WebM Turbo, MP4 Economy, codec,
precision, bitrate/GOP, native/Compatible fallback and storage policy remain.

Retained evidence (harness completion is not promotion):

- Stable surface: `logs/wh01/run-437143c9-45d7-4a76-baa9-c3006a7b73bf`, 24 files.
- Native codec pair: `logs/wh01/run-379def75-469b-4f16-835a-00398ee794d5`, 12 files.
- Each run keeps `build.json`, `turbo-benchmark.json`, `turbo-artifacts.json`,
  encoded files and independent decoded hashes. `logs/wh07b/research-summary.json`
  binds the controls, per-pair timings, output identities and rejected decision.
- The paired worker gained an unused class export for Node access after capture;
  its hash-verified measured predecessor is retained in
  `logs/wh07b/paired-encoder-measured-source.ts.txt`. Its method body is unchanged.

Reproduce the isolated experiments (not ordinary user export):

```text
node research/export/wormhole-baseline.mjs capture --turbo-host --stable-material
node research/export/wormhole-baseline.mjs capture --turbo-host --paired-encoder --mp4-only
node --test tests/export-parallel-research.test.mjs
```

The default 24-row WH-07a benchmark and all earlier tests stay active. New flags
are opt-in and cannot combine the two candidates. The original 37 host rows and
immutable eight-case baseline pass in both runs. The new Node cases cover
out-of-order completion, packet identity, the pending-picture limit, dependent
probe routing, actual support delegation, missing/failed flush, reset/close,
late callbacks and fresh retry. Actual browser/FFmpeg output, not those mocks,
is the evidence used to reject speed/pixel promotion.

Next **WH-07b2**: isolate remaining native-codec and frame-transfer costs, including
capability-only measurements of available 10-bit hardware-codec paths if useful.
Do not add a product codec, silently substitute formats, raise the memory queue
or install a new software codec based on these failed experiments. A new codec
needs concrete quality, compatibility and device evidence before a product
decision. Mobile WH-06c2/e remains later. Stop after this research handoff and
its verified publication; the parent WH-07 remains partial.


### WH-07b1 validation and publication gate

`npm run build` passed. Targeted export/research suites passed **44/44**;
`node --test --test-reporter=tap tests/release-pages.test.mjs` passed **5/5** with
TEMP/TMP scoped to `logs/wh07b/temp`. The first invocation of the latter failed
four temporary Git fixtures in the sandbox's default temporary directory; its
original log is retained, not relabeled as a code baseline. The scoped rerun
and cumulative run use the writable workspace temporary directory.

`npm test -- --test-reporter=tap --test-concurrency=4` discovered all **230 active
files**, including the original 229 and the new research suite: **2242 tests,
2233 pass, exactly the same nine preset failure names AND full messages,
zero skips/cancels**, 552246.492 ms. The old release-guard test adds the two
laboratory worker inputs to its existing mutation checks; no original assertion
is removed. The original exact-source browser test body is unchanged. The
immutable baseline passes all eight cases and keeps SHA
`937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f`.

The guarded publisher now binds both new worker source files, not just the lab
HTML that imports them. The permanent [WH-07b1 research receipt](../tests/wormhole-wh07b1-research.json)
retains predecessor Git/SHA identities, measured sources, every pair and rejected
promotion, exact commands, full baseline failures, log hashes and test retention.
Node/npm and the existing Node Pages publisher are used because package deploy
requires Bun; no install, golden reset or Graphify rebuild. `diff_export.ps1`
is unnecessary for this bounded research/documentation handoff; no PR review
was requested. No physical phone, full-song/thermal or new-codec qualification
is claimed. Public release identity, unchanged runtime/worker hashes and final
host/control smoke are recorded in `logs/wh07b/final-*.json` and the session
checkpoint. Stop after publication; WH-07b2 has not started.
