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


## WH-07b2: pipeline isolation, codec probes and remux control (2026-11-08)

The user confirmed that the research-only predecessor needed no new manual
video test and authorized continuation. This handoff is a bounded diagnostic
step, **not an MP4 Turbo promotion**. Integration remains single-owned in this
chat: export/visuals behavior is read-only; research owns the new module,
fixtures and results, build owns the added input hash, docs owns the checkpoint.
No file under `src/`, codec policy, preset or menu default changes.

### Same producer, encoder removed as a diagnostic control

`codec-isolation.mjs` has a laboratory-only transfer sink that accepts the actual
backend's bitmap/PCM messages, verifies contiguous frame/sample indexes, closes
each image and returns the PCM lease. It performs no encoding or disk output;
its explicit `application/json` completion token is **not a video**. It is never
wired by a product composition root. The caller records these rows as
`media: false`, with `.json` names, and does not decode or offer them as exports.

The original exact GPU renderer, host/PostFX completion, frame capture and
transfer remain. Both arms use the existing MP4 Economy schedule. Each target
has three alternating pairs plus warmup, 60 fps, 240 frames at 720p or 90 at 4K.
Only full controls produce media: six 10-bit VP9/AAC MP4 files, independently
counted/decoded with FFprobe/FFmpeg. Video copying/decoding is outside timing.

| Target | Full MP4 median | Upstream-only median | Full render wait / upstream render wait |
| --- | --- | --- | --- |
| 720p60 | 7569.2 ms | 6093.1 ms | about 5900 / 4935 ms |
| 4K60 | 11281.2 ms | 2104.7 ms | about 7712 / 1682 ms |

Use exact values and individual observations in the
[WH-07b2 receipt](../tests/wormhole-wh07b2-research.json); table values are rounded.
These are different workloads, not a valid Turbo speed comparison or CPU/GPU
percentage. The unencoded arm omits preflight/codec/mux/storage, and workers
contend/overlap differently. The higher real render wait in the encoded 4K arm
shows why a host render interval cannot simply be called GPU computation time.
In this run bitmap construction itself accounts for tens of milliseconds, not
the seconds separating the arms. The evidence prioritizes the codec/interop
path before further small polling changes; it does not claim a precise additive
cost or attribution to a particular hardware engine.

### Native 10-bit configurations: query is not execution

Twenty-four sequential, output-size, three-picture all-key probes use desktop
Headless Chrome 156. Each records encoder query, real encode, decoder query,
real decode, timing scope, counts, requested preference and bounded errors.
A support query alone does not qualify a new product codec.

| Exact profile | No preference / software | Hardware preference |
| --- | --- | --- |
| VP9 profile 2, 10-bit, 720p/8 Mbps and 4K/64 Mbps | Encodes and decodes 3/3 | Encoder query refused |
| AV1 Main profile 10-bit, High tier 5.1; Main tier 5.1 at 720p and 6.1 at 4K | No-preference query can pass, actual initialization fails; software query refused | Query can pass, actual initialization fails |
| HEVC Main10, High tier 5.1, same sizes/rates | Encoder query refused | Encoder query refused |

All use 60 fps and the retained quality/constant-bitrate request. Refusals are
specific to these configurations, browser and environment, not proof that a
codec/GPU is globally unavailable. Main AV1 5.1 allows 40 Mbps, so the 64 Mbps
Main-tier test correctly uses 6.1; High 5.1 allows 160 Mbps. See the primary
[AOM level table](https://aomediacodec.github.io/av1-spec/#levels).

Hardware preferences are hints; neither support booleans nor overlapping timing
records identify actual CPU/video-engine assignment. See
[WebCodecs hardware acceleration](https://www.w3.org/TR/webcodecs/#hardware-acceleration).
The VP9 decoder exposes opaque frames here, so `decodedTenBitObserved: false`
means **unobserved**, not a demonstrated downgrade. The six full control files
are independently `yuv420p10le`. These synthetic three-picture probes do not
establish perceptual quality, long-export reliability, editor compatibility or
physical-phone support. There is no automatic codec substitution.

The helper bounds each probe to eight seconds and 16 MiB of encoded packets;
canvas, frames, codecs and timers release on rejection/failure/timeout/success.
Callback failures take priority over an already resolved flush. A new test
caught that race in the initial helper; it was fixed without weakening the test
and the original failed log remains. The completed pipeline capture predates
that codec-only correction and matrix expansion. Its sink is unchanged; the
original source/bundle is retained, and final codec results are a separate run.

### Accepted WebM packets copied to an MP4 reference

A second control copies the prior accepted 4K30/10-bit 36-picture frame-ID WebM
into fragmented MP4 with native FFmpeg `-c:v copy`. The video packet SHA-256s and
independently decoded full-frame stream hash stay identical; FFprobe retains
10-bit VP9. This is a small **native CLI** reference, not an implemented browser/
WASM export, speed claim or final working candidate. Its audio is an Opus-to-AAC
control; a product implementation must preserve original PCM-to-AAC ownership.
The current minimal WASM core accepts MOV/WAV, not Matroska/Opus, so a product
path would need an existing MP4 packet sink rather than feeding WebM to it.

The browser check does **not** pass. For the final corrected CFR control,
MediaBunny-demuxed packets fed to a separate native VideoDecoder produce only
frame IDs **1 and 31**, the two key pictures, instead of all 36. The earlier
CanvasSink seek check returns no image for picture 2. This is not yet attributed
to a driver, OS, encoder or library: actual demuxed payload bytes and decoder
configuration still need comparison against the accepted WebM route. Native
FFmpeg's complete decode alone cannot qualify the intended browser path.

The first explicit-CFR experiment mistakenly mixed the BSF input timebase with
the output track timebase, producing three-second spacing. It is retained as an
invalid experiment, not counted as codec evidence. The corrected expression
uses `N / (fps * TB)` and fixes spacing; browser interoperability still fails.
Neither negative is hidden or treated as a passed export. Do not remove the
product's all-key MP4 protection or change GOP based on this remux reference.

### Reproduction, validation and next gate

```text
node research/export/wormhole-baseline.mjs capture --isolate-host
node research/export/wormhole-baseline.mjs capture --codec-host
node research/export/wormhole-baseline.mjs capture --remux-reference=logs/wh01/run-07fbb535-9c4d-487b-909b-f173d9faa07d/export-006.webm --remux-cfr
```

The third command intentionally rejects the unqualified reference at its browser
gate. It saves the negative `reference-remux.json` before failing. Input is bounded
before allocation (64 MiB, 63 frame-ID pictures, at most 4K); source files are
never overwritten. The stable UUID run directories retain all controls,
negative experiments, flags, build/source hashes and outputs.

- Pipeline: `logs/wh01/run-66b4735c-2f84-4d8b-a4b7-2129f2a00fab`.
- Final codec matrix: `logs/wh01/run-d835d83c-7a7f-4fb1-8ea5-145a6d935c15`.
- Initial reference: `logs/wh01/run-457dd861-a1f7-4edd-af8e-4577cf78adef`.
- Invalid timebase: `logs/wh01/run-79908bf3-01b4-4e95-8a06-52f90979254c`.
- Corrected CFR seek failure: `logs/wh01/run-850e5a9d-0881-48cf-b8be-f0e645ede29c`.
- Separate native decoder failure: `logs/wh01/run-914cb611-c097-43f1-a0ad-c1693bca93f5`.

Build passed; targeted suites **54/54** including five new diagnostic cases and
the extended release guard. Cumulative **2247 / 2238 pass / exactly the same nine
baseline failure names AND full messages / zero skip or cancel**, 651581.6521 ms.
All 230 old active Node files remain, now 231; original exact-source browser
body/default benchmark/earlier experiments remain. Both main diagnostic runs
pass the 37 host cases and fixed eight-case baseline. New Node cases cover
non-media prefix identity, PCM/image ownership, gaps, format observation,
unsupported stages, callback precedence, late output, limits and cleanup.
Actual native/FFmpeg observations remain separate from those mocked contracts.

The publisher binds the new worker module in addition to the HTML that imports
it. Node/npm with workspace-scoped TEMP/TMP and the existing guarded Node Pages
publisher are used; package deploy requires Bun. No install, golden reset or
Graphify rebuild. `diff_export.ps1` is unnecessary for this bounded diagnostic
handoff; no PR review requested. Final release/public receipts are under
`logs/wh07b2/final-*.json` and the session checkpoint.

Next **WH-07b3** first compares demuxed packet bytes and decoder configurations
across WebM and MP4, then tests a shared native VP9 encoder and an MP4 encoded-
packet sink if warranted. Retain the working Economy all-key path, accepted
WebM Turbo and all quality/lifecycle/resource gates. No new codec, GOP change,
software encoder or larger queue is promoted here. MP4 Turbo and parent WH-07
remain partial; mobile 10-bit is still later. No new manual whole-video test is
needed for this diagnostic handoff, since product runtime is unchanged.

## WH-07b3: VP9 MP4 color-metadata interoperability (2026-11-08)

### Finding and scope

The user authorized the next task after the unchanged WH-07b2 diagnostic release.
This handoff **does change the production MP4 worker**. The integration owner in
this chat owns export, research/test integration and documentation; no State,
audio-analysis, shader, host preference or worker-message schema changes.

The accepted 4K30/10-bit, 36-picture WebM control and its native stream-copy MP4
have identical video packet SHA-256s, including bytes read by the browser demuxer.
The copied packet buffers remain unchanged after demux iteration: no evidence of
cache aliasing. Native FFmpeg also decodes identical full-frame YUV stream hashes.
The effective browser configurations differ in two color fields:

```text
WebM: vp09.02.50.10.01.01.01.01.01
 MP4: vp09.02.50.10.01.02.02.01.01
```

These are components 5 and 6 after splitting on dots (component 0 is `vp09`).
An independent native decoder with the original MP4 config returns IDs **1,31**;
software preference or a short VP9 config returns all 36. Hardware preferences
are hints, not verified CPU/GPU attribution. Duration omission and latency hints
do not fix this case. The effective metadata is causal for this environment;
these results do not identify a general OS, driver or MediaBunny defect.

Setting **both** primaries and transfer to BT.709 in the actual copied MP4 yields
all **36/36** native-decoded IDs, all **36/36** CanvasSink IDs and successful seek,
with every compressed video packet and the FFmpeg-decoded YUV stream unchanged.
This is a native CLI reference, not a browser/WASM speed qualification. Its
Opus-to-AAC control does not replace production's original PCM-to-AAC path.

The final native encoder matrix additionally records emitted `colorSpace`:
successful VP9 configurations emit BT.709 primaries, **sRGB transfer**
(`iec61966-2-1`), BT.709 matrix and full range. Production therefore preserves
that explicit sRGB transfer; it does not blindly apply the reference's BT.709
transfer to a known sRGB source. Missing/unspecified fields alone use the
existing SDR Canvas/WebM BT.709 defaults.

### Production change and boundaries

`src/export/Mp4Vp9Color.ts` is a pure, export-owned metadata helper with finite
CICP/name allowlists. Explicit full VP9 CICP fields take precedence, then named
`VideoColorSpace`, then the SDR fallback. It does not mutate input or alter pixel
format, matrix, range or image data. Explicit supported PQ/HLG declarations are
preserved rather than relabeled SDR; this does not introduce an HDR pipeline.

The existing MP4 worker captures the native encoded-packet callback's
`decoderConfig` into job-local metadata and supplies `-color_primaries` and
`-color_trc` to its existing FFmpeg WASM **video stream-copy** finalizer. H.264 is
unchanged. The all-key MP4 protection, 10-bit precision, bitrate, timestamps,
original PCM-to-AAC ownership, two-frame/two-buffer limits, progressive OPFS and
Stop/Cancel cleanup remain. There is no new preference, fallback codec, raw-frame
copy stage, software video encoder or new dependency.

This closes the specific WH-07b2 reference's browser interoperability gate. It
does not prove that every historical whole-song "backflow" had this cause, nor
that long-export/mobile/thermal or external-editor gates are closed. Keep the
all-key guard until the next candidate independently qualifies. **MP4 Turbo is
still an explicit Economy fallback.** This task makes no new speed claim.

### Evidence and reproducibility

```text
node research/export/wormhole-baseline.mjs capture --remux-reference=logs/wh01/run-07fbb535-9c4d-487b-909b-f173d9faa07d/export-006.webm --remux-cfr --inspect-remux
node research/export/wormhole-baseline.mjs capture --remux-reference=logs/wh01/run-07fbb535-9c4d-487b-909b-f173d9faa07d/export-006.webm --remux-cfr --remux-color709 --inspect-remux
node research/export/wormhole-baseline.mjs capture --codec-host
node research/export/wormhole-baseline.mjs capture --exact-host --export-host --turbo-export-host --diagnostics-host
```

The first command intentionally rejects the original unqualified MP4 after
saving its negative receipt; the second is the positive tagged-file control.
Input/output packet hashes and full configs are retained in `packet-inspection.json`.
The inspection owns bounded packet copies, uses separate fresh native decoders,
limits clips to 63 pictures/64 MiB and closes frames/codecs/timers on all exits.
Only the laboratory imports it; no product decoder override was added.

- Initial byte/config comparison: `logs/wh01/run-a82c9fed-7894-4fe3-bd5a-85c2a1996fc2`.
- Tagged-file positive control: `logs/wh01/run-253f47ff-c738-4109-84b6-3c1925bee250`.
- Emitted native color metadata: `logs/wh01/run-b9dd6847-34fd-407c-8ae3-7c5e125cf541`.
- Actual production browser/WASM output: `logs/wh01/run-339acd12-74be-4bb4-b0de-79c3631e4f56`.

The local integrated run passes 37 host, eight fixed baseline, 21 exact-source,
18 Economy and 21 Turbo/fallback cases. It creates 36 real files and verifies
them independently, including original PCM audio, frame identity, Stop/Cancel,
retry, 4K/30/60, ten-bit profiles and explicit VP9 MP4 color declarations. Final
published verification and cumulative counts are bound in
[the WH-07b3 receipt](../tests/wormhole-wh07b3-acceptance.json).

Earlier field-isolation attempts used mislabeled numeric positions (one corrected
attempt still duplicated the transfer-only variant). Their original logs remain
under `logs/wh07b3/color-isolation*.log`; they are not counted as proof of a
two-field interaction. The final named-index helper has normative full-string
tests. The actual positively tagged file, full packet equality and independent
browser decoding establish the accepted result. No old tests, fixtures or
negative receipts are removed or rewritten.

Build passed; targeted **119/119** and cumulative **2253 / 2244 pass / exactly
the same nine baseline failure names AND full messages / zero skip or cancel**,
504703.5622 ms. All 231 old active Node files remain, now 232. The eight fixed
WH-01 baseline hashes are unchanged. Local production code hashes match the
actual WASM output run; final public build/QA identities are recorded under
`logs/wh07b3/final-*.json` and the session checkpoint.

New production tests cover metadata precedence, CICP positions, explicit sRGB/
PQ/HLG, unspecified defaults, ownership and untrusted names. Additive diagnostic
tests cover packet copying, order/dropped deltas, callback failure precedence,
unsupported configs, stalled queues, bounds and late-output cleanup. Original
exact browser body and earlier test cases remain. Node/npm, workspace-scoped
TEMP/TMP and the existing guarded Node Pages publisher are used because the
package deploy script requires Bun; no dependency installation or golden reset.
`diff_export.ps1` is unnecessary for this bounded export fix; no PR requested.

References: [VP9 WebCodecs registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/),
[VP9 ISO media binding](https://github.com/webmproject/vp9-dash/blob/master/VPCodecISOMediaFileFormatBinding.md),
and inspected MediaBunny 1.39.1 `vpcC` writer/demuxer sources under `node_modules`.

### Manual gate and next task

After deployment, check a short **MP4 10-bit** export in the intended desktop
player: moving detail, gradients/hue/brightness, seeking and audio. Stop & save
can keep the first check short; a full No Good export is still necessary to
revisit 0:47–1:00 and after 1:25. Samsung's unsupported native VP9 10-bit encoder
is unchanged. Stop for this manual runtime gate before **WH-07b4**: measure a
shared native VP9 encoder/MP4 packet-sink candidate against the existing Economy
control with unchanged quality and the retained whole-job >=15% speed gate.
Then deferred mobile WH-06c2/e, WH-08, T21b/c, T22–T24. WH-07 remains partial.


## WH-07b4: native VP9 packet-path qualification (2026-11-08)

### Manual acceptance and hardware interpretation

The user accepted WH-07b3 with Windows Chrome 156, 4K60, 16:9, watermark Off,
VP9 10-bit MP4, requested Turbo: faster perceived export and good image quality,
with lower observed GPU usage. This is valuable manual acceptance, not a timed
paired speed measurement or CPU/GPU attribution. The supplied journal has
`performance: null`, a three-picture encode/decode preflight and a one-picture
MP4 packet probe. Those counts are not the exported movie's frame count.
Requested MP4 Turbo still resolves to the qualified Economy path. The metadata
fix did not move rendering or encoding work from GPU to CPU.

The responsibility table earlier in this audit remains authoritative. JS host
orchestration and worker geometry execute on CPU; WebGL2 material shaders on GPU;
Canvas composition/copy acceleration is browser-specific. The native WebCodecs
VP9 implementation may use CPU or a media engine; neither the copied journal nor
GPU percentages reveal its assignment. FFmpeg WASM runs CPU-side AAC encoding
and MP4 mux/video-copy, not a second video compression pass. OPFS remains
progressive disk output with bounded frame/PCM admission. Workers move CPU work
off the UI thread; WASM does not inherently imply GPU use or multithreading.
The shipped FFmpeg5.1.10 Docker recipe explicitly disables pthreads/w32threads/
os2threads. Its WASM linear memory starts at32MiB and can grow to256MiB; these
are core-memory limits, not total browser/process/GPU memory measurements. AAC
and mux therefore use the current CPU-side single-thread core in one worker;
the browser's native codec can independently schedule its own threads/media
resources. Progressive OPFS avoids retaining the entire finished movie in that
WASM heap or a whole-video JavaScript buffer. The renderer/codec still own
additional resources outside the WASM heap. Source:
`public/export/ffmpeg-5.1.10/ffmpeg-mp4-core.Dockerfile`.

The Video Decode graph does not identify the export encoder. Video Encode,
3D/Compute, process CPU and elapsed job time should be observed together, with
no universal percentage inferred. Lower GPU utilization may reflect less work,
more waiting or scheduling differences. See the linked W3C hardware contract.

### Controlled research and unchanged product ownership

Before introducing a new backend, reuse the existing retained inter-frame and
no-duration probes against the accepted metadata fix. The initial inter-frame
run retains correct inputs 1..8 but independently decodes 1,2,3,4,4,6,7,8 in a
2160x2160/30 fps 10-bit MP4. Browser and native FFmpeg agree. This is an actual
lost changed region, not merely seek rounding or a player-only issue. The
negative run and original file remain under
`logs/wh01/run-709b6f90-2bbf-48cd-b5d6-575f9e9f9e4d`; the independent byte/bar
inspection is `independent-failed-frame.json`. Color metadata alone therefore
cannot justify removing all-key protection for the entire matrix.

The new `research/export/native-packet.worker.ts` uses MediaBunny 1.39.1's
supported `CustomVideoEncoder` registration and encoded-packet hook. It is a
laboratory-only adapter around the same native browser VP9 encoder. It submits
`new VideoFrame(sample.toCanvasImageSource(), { timestamp: round(time*1e6) })`,
matching WebM-style constructor options. The library may supply an existing
VideoFrame whose duration is inherited; this adapter is not a zero-copy/raw-
bitmap or verified duration-free path. The separate `--mp4-no-duration` probe
constructs the initial sample without duration and still fails. Packet duration
remains exactly 1/fps. Key-frame options, bitrate, profile,
latency and native hardware selection are preserved; it adds no global codec
replacement, second encoder, renderer, audio owner or production preference.

It reuses the actual product MP4 worker for PCM-to-AAC, metadata preservation,
OPFS admission/write/finalization and cleanup. Native queue admission retains
four entries; the existing host retains two raw frame/PCM leases. Browser-owned
codec internals remain opaque, not a measured RAM bound. Deadline/error/close
paths remove dequeue listeners, close owned frames/codecs and ignore late
callbacks. The library continues to own packet mux backpressure. The lab input
is added to the existing release identity guard. Old exact browser body,
default benchmark, tests and failed probes remain; no source golden is reset.

Use the existing runner with `--export-host --native-packets` for candidate
quality and `--turbo-host --mp4-only --native-packets` for three alternating
full-job pairs at 720p60 and 4K60. Same-GOP comparisons retain all-key on both
sides; inter-frame experiments are explicitly separate profile research and
cannot claim unchanged-GOP Turbo promotion. No benchmark includes QA readback,
artifact copying or independent decode time. Keep accepted production Economy
until independent image/audio/lifecycle/resource and >=15% speed gates pass.
Final outcomes, commands, hashes and remaining task are bound in the
[WH-07b4 receipt](../tests/wormhole-wh07b4-research.json) and session checkpoint.


### Result: retain Economy, no candidate promoted

All three inter-frame trials fail the same square 4K30 frame-identity gate:

| Trial | Run directory suffix | Result |
| --- | --- | --- |
| Existing MP4, one-second GOP | `709b6f90-2bbf-48cd-b5d6-575f9e9f9e4d` | Input1..8, decode1,2,3,4,4,6,7,8 |
| Same, initial sample without duration | `e2810ce9-8ce0-48b5-9cfd-35563676d4b7` | Same browser failure |
| Native packet adapter, one-second GOP | `e532865a-b06d-44d5-ac75-47c965102fdb` | Same browser failure |

All are under `logs/wh01/run-<suffix>` with the original failed MP4, build flags
and negative receipt. No claim that duration, library wrapping or color tags
alone solve the remaining predictive-profile issue. Correct bitmap IDs are
observed before transfer; locating the last correct pixel boundary inside the
encoder worker remains a next-step requirement, not an attributed browser bug.

The separate same-GOP **all-key** throughput run is
`logs/wh01/run-96697767-f555-4631-8426-5fa55d121e81`. It completes 12 real MP4
files with audio/OPFS/WASM finalization, three alternating pairs per resolution.
All six control/candidate decoded full-frame stream hashes are identical.

| Profile | Control median ms | Native packet median ms | Time reduction |
| --- | ---: | ---: | ---: |
| 720p60, 8 Mbit/s, 240 frames | 5094.4 | 4835.9 | 5.07% |
| 4K60, 64 Mbit/s, 90 frames | 5945.0 | 6204.3 | -4.36% |

Every ordered trial remains in `turbo-benchmark.json`; individual gains are
3.02%,5.07%,0.79% at720p and3.94%,-4.36%,0.50% at4K. First4K trials take about
12/11.6s versus later5.8–6.2s: retain that variability rather than pool or discard
samples. These short whole-job observations cannot identify CPU/GPU shares or
universal speed. `pass:true` in the raw benchmark means the harness completed,
not that the >=15% promotion gate passed. It does not pass either target.

Production `src/` is unchanged from the user's accepted WH-07b3 release. The new
worker is imported only by the opt-in laboratory. A post-measurement explanatory
comment clarifies inherited duration; measured source is retained as
`logs/wh07b4/native-packet-measured-source.ts.txt`, with final bundle identity
checked at release. No new renderer, codec, queue, UI or fallback is promoted.
The hardware explanation is documented; this task adds no whole-song/manual
quality claim or mobile10-bit fix.

Next **WH-07b5** isolates short-detail loss with a tiny deterministic source:
record actual worker-side input immediately before VideoEncoder, compare exact
same pictures/VP9 payloads through WebM and MP4, inspect predictive frame/packet
behavior, then qualify a quality-preserving profile before another full-job speed
promotion attempt. Preserve original all-key control and the existing numeric,
frame-ID, source/raw quality, audio and lifecycle gates. A supported native codec
still owns its CPU/media-engine implementation; no forced GPU preference or
software codec is justified by these results. MP4 Turbo/WH-07 remains partial;
mobile10-bit is still later. Stop after this research handoff.


Build and the new research worker's explicit TypeScript check passed. Targeted
**123/123**; cumulative **2257 / 2248 pass / exactly the same nine baseline names
AND full messages / zero skip or cancel**,489556.6925ms. All232 previous active
Node files remain, now233; four additive native-packet lifetime/ownership cases.
The original exact browser body and eight fixed baseline hashes remain. The
first standalone TypeScript6 command required `--ignoreConfig`; its initial
TS5112 log remains, and the corrected explicit file check passed. No runtime
fallback, install, golden reset or Graphify rebuild. Node/npm with workspace TEMP
was used; deploy uses the existing guarded Node publisher because the package
script requires Bun. `diff_export.ps1` is unnecessary for this bounded lab/docs
handoff; no PR requested. Final public input/artifact/hash checks and startup/UI
QA are bound in `logs/wh07b4/final-*.json` and the checkpoint. Product runtime
identity preserves the prior full encoded QA and newly received manual result;
no redundant whole-video test is required for this unchanged-runtime handoff.
