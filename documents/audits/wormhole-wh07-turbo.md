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


## WH-07b5: predictive detail-loss boundary and short profile study (2026-11-08)

The user waived a redundant manual test for unchanged WH-07b4 runtime, requested
the remaining task/subtask list and authorized the next task. The list was given:
WH-07b5 isolation, MP4 Turbo qualification, deferred mobile WH-06c2/e, WH-08
full-song/platform/default/rollback work, T21b/c caption layout/editor/fonts/
transitions/burn-in, T22 launcher/Studio, T23 auth/backend and T24 staging/domain.
T25 remains a per-delivery test/docs/release gate; Wall/T15 deferred, WH-06d
withdrawn. This step remains research-only; no `src/` or normal export change.

### Last correct region and identical payloads

The opt-in native packet worker gains a separate laboratory observation channel.
Ordinary product messages still delegate to the existing worker handler. Before
`VideoEncoder.encode`, a192x32 crop reads the actual VideoFrame's six binary ID
cells. Capture is capped at63 inputs/packets and64MiB encoded data. Encoded bytes
are copied before transfer; transferring observations cannot detach the muxer's
packet data. Frames close in finally, native codecs/listeners/timers and probe
surfaces release on closure/failure, and late callbacks cannot add reports. The
library sample may carry inherited duration; the report records the actual value.
No new product worker message, preference, renderer, clock or resource owner.

The short fixture reuses the exact GPU renderer and real MP4 PCM/OPFS/FFmpeg
path but stops at one eight-picture2160x2160/30fps job, VP9 profile2/10-bit,
14Mbit/s, quality latency and constant bitrate. This is not the user's full
3840x2160/60fps workload. Earlier main-thread bitmap IDs and the new worker-side
VideoFrame IDs both read1..8. The native output already reads1,2,3,4,4,6,7,8.
The same owned VP9 packets are placed into video-only WebM and MP4 references,
then compared to the real product-path MP4 with original PCM-to-AAC. All packet
hashes match exactly in all three files. Both browser and independent native
FFmpeg decode the same changed-region loss. Explicit observed BT.709/sRGB/full-
range metadata is retained in the references, matching WH-07b3's finalizer tags.
No second lossy video encode is involved.

Per-frame full-image FFmpeg hashes are all distinct: this is **not an entire
missing/duplicated picture or missing timestamp**. A brief changed32x32 region
is reconstructed as its previous state while the rest of the image changes.
This establishes the boundary at native encoding/reconstruction for this fixture;
it does not prove a particular driver, library defect, temporal filter or general
browser bug. A lossy encoder's detail decisions are a plausible explanation,
not measured internals. Readback can affect scheduling, so no timing result is
claimed; the observed reference still reproduces the negative.

### Controlled profiles and result

| Profile | Native and all three file decodes | Run suffix |
| --- | --- | --- |
| Reference predictive, before changes | 1,2,3,4,4,6,7,8 | `3739883d-680d-46e0-914e-f989939f1a61` |
| Reference all-key control | 1..8 | `4a5b523b-272e-4af7-9603-6ab2cb17c144` |
| Predictive plus `contentHint: detail` | 1..8 | `1fa1ae98-b4d0-4707-9133-da80c86b4bfb` |
| Predictive plus `contentHint: text` | 1..8 | `8ab023f4-bb7a-4d3d-acc1-61083e301d6f` |
| Predictive plus variable bitrate | 1..8 | `1d53956a-c075-48b2-9f72-f50c75737298` |
| Reference predictive, repeated last | 1,2,3,4,4,6,7,8 | `6567fd3b-28e8-453b-bf8d-c758146d8927` |

Directories are `logs/wh01/run-<suffix>`, with `predictive-detail.json`, original
files and independent `predictive-detail-artifacts.json`. Eighteen files give
144 independently FFmpeg-decoded frame IDs. Native/container browser consumers
are additional observations. Detail/text yield identical encoded packet data
here; variable-rate data differs. The repeated reference reproduces the original
negative, avoiding a warmup-only interpretation. An initial fixture was placed
outside the HTML script and therefore had no callable diagnostic; its failed
log remains and is excluded from media evidence. The script placement was fixed
before these six runs. No earlier fixture or result is overwritten.

`detail` is the preferred **next candidate**, retaining constant bitrate,
quality mode, codec, precision and the tested one-second GOP. It is not production
promotion or proof of full-song/perceptual/mobile quality. Hints are advisory:
[WebCodecs contentHint](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-contenthint)
allows browser-specific handling and does not guarantee a particular algorithm.
Quality mode keeps its no-frame-drop contract; no switch to realtime is made.
Variable bitrate changes the size/quality budget and remains a separate control.

```text
node research/export/wormhole-baseline.mjs capture --detail-host
node research/export/wormhole-baseline.mjs capture --detail-host --mp4-inter-frame --detail-profile=reference
node research/export/wormhole-baseline.mjs capture --detail-host --mp4-inter-frame --detail-profile=detail
node research/export/wormhole-baseline.mjs capture --detail-host --mp4-inter-frame --detail-profile=text
node research/export/wormhole-baseline.mjs capture --detail-host --mp4-inter-frame --detail-profile=variable
```

The original export matrix/default benchmark/exact browser body remain. The new
`detailOnly` path explicitly returns one diagnostic case and never claims the
full matrix. Profile names are allowlisted and the detail runner cannot silently
mix with another export benchmark. Four additive tests cover owned transfer,
actual inherited duration, finite profiles without caller mutation, capture
limits/readback failure and laboratory message validation/delegation. All four
previous native-packet tests remain, with more faithful frame/data fixtures.

### Next gate

**WH-07b6** qualifies the detail-oriented predictive candidate on the full retained
source/encoded/audio/aspect/FPS/Stop/Cancel/retry matrix, then measures separate
uninstrumented whole jobs against the accepted all-key Economy control. Preserve
same-GOP secondary comparisons where isolating adapter cost; a changed predictive
profile is an explicitly new quality candidate, not an unchanged-pixel/GOP claim.
Only a fully qualified candidate can enable actual MP4 Turbo through the existing
menu/storage/Copy/fallback. A short marker study cannot waive image/temporal,
resource or >=15% speed gates. Default all-key and the user's accepted runtime
remain until then. Mobile10-bit and WH-08 follow in the recorded order.

Validation commands, source/predecessor identities and profile artifacts are bound in
[the WH-07b5 receipt](../tests/wormhole-wh07b5-research.json); final public identities
are in `logs/wh07b5/final-*.json` and the session checkpoint.


Build and explicit research-worker TypeScript check passed. Targeted **127/127**;
cumulative **2261 / 2252 pass / exactly the same nine baseline names AND full
messages / zero skip or cancel**,563421.2952ms. All233 previous active Node files
remain, now233; the existing native-packet suite grows from4 to8 cases. Protected
exact browser body and eight fixed baseline hashes remain. Each diagnostic
`pass:true` means successful observation/payload comparison, not that the
reference profile passed quality; the two negative reference outcomes remain.
No new product runtime, software codec, dependency, golden reset or Graphify
rebuild. Node/npm with workspace TEMP; the existing guarded Node Pages publisher
replaces the package's Bun-only deploy command. `diff_export.ps1` is unnecessary
for this bounded research handoff; no PR requested. No physical/full-song/editor/
thermal gate is claimed. No redundant user video test is needed for unchanged
product runtime; full candidate quality and speed remain WH-07b6.


## WH-07b6 — predictive detail qualification rejected (2026-11-09)

**Decision: retain the accepted product export.** The lab-only `detail` hint and
one-second GOP pass the earlier short marker counterexample, but fail actual
source fidelity. `src/` is unchanged. WebM Turbo remains accepted; requested MP4
Turbo still reports Economy fallback. The candidate is not a new production
codec, hardware policy, worker pool, preference or quality downgrade.

### Quality before promotion

The existing full cohort remains intact: 18 Economy and21 Turbo/fallback cases,
36 real files per run, with independent frame IDs, audio and Stop/Cancel/retry.
Candidate `run-0266be6e-f927-4e04-8848-51c7afd2a37f` and accepted all-key control
`run-91b1935b-4dda-48d4-894e-092c109ece53` pass these gates; candidate also passes
37 host, eight retained baseline and21 exact-source cases. This existing cohort
lacked 4K60 VP9 MP4, so it alone could not qualify the requested target.

An additive own-source cohort covers 720p/1080p/UHD at30/60fps, square/portrait
60fps, the one-second key boundary (63 pictures), and ten-bit Stop/Cancel/retry:
13 cases,12 real files,351 actual input pictures per run. Source PNGs are
captured immediately after the marker overlay, before native submission. Control
`run-74b0aa3d-3033-43bb-8d7c-7e84af1e23c1` and candidate
`run-db1cc4d0-96fd-4db4-a62f-5395a95ea680` have **all351 source hashes equal**.
The independent FFmpeg RGB16 comparison measures each decode against its own
input, then compares candidate fidelity with all-key fidelity, picture by picture.
All12 files fail the retained source-regression limits (SSIM drop<=0.0001,
PSNR drop<=0.1dB): maximum measured loss **0.008862 SSIM /8.32dB PSNR**.
Correct marker IDs and ten-bit pixel format do not imply preserved texture.
Negative evidence and the original gates remain; no promotion is justified.

The earlier lossy-output-versus-lossy-output comparison also remains archived:
10/36 fail SSIM>=0.995 and PSNR>=40dB. Six changed VP9 files differ, but four
unchanged classic-transition cases also differ. `Particle` uses `p.random` during
initialization/turning and these actual input pictures were not captured. Those
four differences cannot be attributed to the candidate codec. Nor does a
difference between two lossy outputs determine which is closer to the input.
The separately matched own-source comparison above resolves that ambiguity for
the12 candidate files. Neither gate was relaxed to erase an adverse result.

Own-source PNGs are QA artifacts only: at most63/case,16MiB each,512MiB/run,
kept under ignored `logs/wh01` UUID directories, never committed/published or
allocated by production export. Both captures and all raw FFmpeg stats remain.
Original WH-01 raw/temporal policies, all eight baseline hashes and the exact
browser source body are unchanged. No replacement fixtures or golden reset.

### Separately measured throughput

After Node and FFmpeg quality work finished, an unobserved run used three
alternating whole-job pairs for720p60/240pictures/8Mbps and UHD60/90pictures/
64Mbps. Timed work includes actual GPU-rendered export and finalization, but
excludes QA readback/artifact copying. Run `run-0a70df5f-de6c-4f60-a526-ab3c174bf283`
retains all12 actual MP4 files and stage reports.

| Target | Pair1 | Pair2 | Pair3 | Median paired time saving |
| --- | ---: | ---: | ---: | ---: |
| 720p60 | 3.38% | 1.67% | 5.64% | 3.38% |
| UHD60 | 16.63% | 16.98% | 20.23% | 16.98% |

Control/candidate median times separately:4727.2/4619.9ms and5750.4/4672.5ms.
The median of paired percentages is deliberately distinguished from the ratio
of these independently sorted medians. The benchmark's historical `cooperative`
label denotes the candidate category; both requests still resolve through the
existing MP4 Economy policy. No newly qualified cooperative scheduler is claimed.
These short workloads are not a full-song/mobile/thermal guarantee. UHD speed
alone cannot override quality failure;720p also misses the15% speed threshold.

Requested CBR and precision remain8/14/64Mbps and ten-bit. Short-file
bytes/duration are nevertheless substantially smaller with the candidate; e.g.
UHD60 control about68.05 versus12.25Mbps, including audio/container overhead.
This is an observed short-window file average, not elementary-video bitrate or
proof of particular native rate-control internals. A hint is advisory and a
configured bitrate does not prove preserved texture. More CPU workers alone
would not fix the demonstrated fidelity loss.

### Implementation, tests and next gate

`NativePacketEncoder` adds only an explicit laboratory configuration message;
without it, the prior all-key/default path and ordinary product message delegation
remain. Predictive mode enforces contiguous source indices and rounded one-second
key boundaries. With observation disabled it creates no probe canvas, sample
archive or pixel readback. Original frame/options/config ownership is retained,
with two host frame/PCM leases and four-entry native admission. Internal browser
codec resource use is opaque; these bounds do not measure total GPU/CPU RAM.

Nine new cases extend two existing Node suites: predictive ownership/contiguity/
channel validation, strict per-picture scoring, malformed/truncated/out-of-order
stats, own-source thresholds and infinite PSNR. All original blocks and233 active
Node files remain. Build and explicit research-worker TypeScript check pass.
Targeted147/147; full2270/2261 pass/**the exact same nine baseline names AND full
messages**/zero skipped or cancelled,516233.3981ms. No dependency install,
Graphify rebuild or product source edit. Commands, source predecessors, fixed
policies, failures and artifact hashes are in the
[WH-07b6 receipt](../tests/wormhole-wh07b6-research.json). Final release and public
QA identities are bound under ignored `logs/wh07b6/final-*.json` and the checkpoint.

**Next WH-07b7:** a bounded quality-first native rate/quantizer feasibility study,
reusing the captured source images. The user accepts larger files. Query support,
then actually encode/decode and measure per-picture fidelity before a new speed
claim. WebCodecs VP9 per-picture quantizer range is0..255 (not libvpx's0..63);
no quantizer profile is implemented or qualified by this task. Retain ten-bit,
clocks/audio, OPFS, bounded queues and accepted quality. See the
[VP9 codec registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/)
and [FFmpeg SSIM/PSNR documentation](https://ffmpeg.org/ffmpeg-filters.html#ssim).
Only after quality/resource/15% speed gates may the existing MP4 Turbo menu route
change, followed by the user's manual test. WH-06c2/e mobile ten-bit fallback
remains later, then WH-08 long-song/platform/thermal qualification, T21b/c caption
placement/fonts/transitions/editor/burn-in, T22-T24 and the repeated T25 gate.
WH-06d8-bit quality work remains withdrawn; Wall/T15 remains deferred.

For this bounded research handoff `diff_export.ps1` was considered but unnecessary;
no PR requested. Node25.2.1/npm11.6.2 with workspace TEMP; the Bun-only package
deploy is replaced by existing guarded `node scripts/release-pages.mjs`
prepare/publish/verify. No physical device/editor/full-song success is claimed.
No redundant whole-video manual test is required for unchanged product runtime.


## WH-07b7 — native quality-control feasibility (2026-11-09)

Owner: research worker/fixture, tests and documentation, one integration owner.
The user authorized continuation and confirmed that unchanged product behavior
needs no redundant full-video manual test. This stage investigates native VP9
quality control; it does not change product export, menu/storage/Copy, scheduling,
codec selection, OPFS, audio or the accepted ten-bit defaults.

### Repeatable inputs and isolated codec question

The previous accepted all-key capture retains351 real input PNGs across12 short
cases, including UHD30/60,1080p30/60,720p30/60,portrait/square,one-second GOP
boundary and short Stop/retry prefixes. This experiment reuses exactly those
PNGs; it does not regenerate the visual renderer or overwrite the old results.

`encodeSourceProfile` extends the existing lab-only `codec-isolation.mjs`. The
existing isolation worker accepts one `quality_replay` job from its one-use
browser wrapper, queries the native configuration, encodes the given pictures,
and returns owned packet copies. New config is `bitrateMode: quantizer`,
`latencyMode: quality`,ten-bit VP9,`contentHint: detail`,one-second keys and an
explicit per-picture `vp9.quantizer`. Values0,16,32,64 sample the API's0..255
range. There is no requested bitrate in quantizer mode;8/14/64Mbps remain only
in the separately encoded all-key control, selected by pixel area like product.
Support-query recognition and actual encode/decode are distinct observations.
The WebCodecs specification and VP9 registration are works in progress and do
not require a browser to implement this codec or mode:
[WebCodecs](https://www.w3.org/TR/webcodecs/#videoencoderconfig),
[VP9 registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/).

Loopback CLI:

```sh
node research/export/wormhole-baseline.mjs capture --quantizer-source=logs/wh01/run-74b0aa3d-3033-43bb-8d7c-7e84af1e23c1
node research/export/wormhole-baseline.mjs analyze-replay RUN logs/wh01/source-comparison-9fd1e979-d27e-4be7-b4c4-f3f9c43fdf01/comparison.json
```

The source server permits only names present in the verified manifest, checks
PNG signatures/dimensions and every SHA, and enforces16MiB/input,512MiB/archive.
The native replay keeps one loaded bitmap, closes each created VideoFrame,
limits native admission to four and63 pictures, and caps packet output at64MiB.
The deadline closes native resources and late loading results; callback errors,
unsupported/unrecognized configs and packet limits are recorded separately.
The one-use worker terminates after completion/failure/deadline. Short QA muxing
uses bounded in-memory WebM buffers; this is not a replacement for production
progressive OPFS and is not evidence for long-file RAM behavior. Native codec
internal memory and CPU/media-engine assignment remain opaque.

All-key and four quantizer profiles are requested for every case. The browser
checks actual native decode IDs; FFmpeg independently checks every output ID,
frame count,dimensions and `yuv420p10le`. Full decoded frames are compared with
the retained PNGs in RGB16 using unchanged SSIM/PSNR evaluation. Candidate
source fidelity is checked against both the replay all-key control and the
previously accepted product all-key source scores, not just against another
lossy candidate. Per-picture regression limits remain SSIM drop0.0001 and
PSNR drop0.1dB; every picture must satisfy them. The analyzer's `eligible` means
this short native/fidelity gate only, never production promotion.

These are no-audio native-codec WebM probes of source prefixes. They do not
repeat Stop/Cancel behavior, verify MP4 FFmpeg metadata/muxing, measure whole-job
speed, certify hardware acceleration or qualify physical mobile. Those remain
integration gates. Even a better-looking high-rate profile needs codec-level/
peak-rate conformity, realistic storage admission, output byte limits and
whole-job throughput before promotion. The existing MP4 Economy fallback and
accepted WebM Turbo remain unchanged.

### Regression retention

Five meaningful cases extend the existing codec-isolation suite: quantizer0/255
and63-picture keys/ownership; invalid inputs before allocation; unsupported and
unrecognized modes; callback/size/load/context/packet/queue failure cleanup; and
late source closure after deadline. All original cases,protected browser exact
body,fixed image policies and233 active Node suites remain. There is no new test
file,dependency,golden change or Graphify rebuild. Scoped Graphify found no
unique `NativePacketEncoder` node; direct source inspection established the seam.
The first local harness run failed on an out-of-scope `check` helper before any
valid artifact handoff; its log/build remain and it is not quality evidence.
The wrapper now uses an explicit bound check. Commands,predecessor identities,
raw results and hashes are retained in the versioned
[WH-07b7 receipt](../tests/wormhole-wh07b7-research.json); final publication and
public-default QA are bound under ignored `logs/wh07b7/final-*.json` and checkpoint.


### Measured outcome

The corrected capture is `logs/wh01/run-9f1cab3d-b176-4cc5-8aa5-ecf36dcfcaf3`;
analysis is `logs/wh01/replay-comparison-9cced45e-3da7-4452-8738-a38e7a84eaa6`.
All60 real WebM files encode and independently decode1755 ordered IDs and are
actually `yuv420p10le`. All12 replay all-key controls exactly reproduce the
accepted product source SSIM/PSNR scores,so the retained-input replay is a valid
control for this question. Audio/MP4 lifecycle are outside this pilot.

| Native profile | Files / pictures | Files satisfying both fidelity references | Total short-file bytes |
| --- | --- | ---: | ---: |
| All-key accepted-style control | 12 /351 | 12 | 25,900,895 |
| Quantizer0 | 12 /351 | 12 | 161,840,400 |
| Quantizer16 | 12 /351 | 1 | 5,603,636 |
| Quantizer32 | 12 /351 | 1 | 2,230,307 |
| Quantizer64 | 12 /351 | 1 | 1,010,099 |

Quantizer0 improves source fidelity on **every measured picture**: minimum
SSIM improvement0.001214 and minimum PSNR improvement2.07dB. This does not mean
lossless RGB or HDR: source/color conversion and4:2:0 chroma still apply. The
larger quantizers each fail11 of12 cases; the surviving case is the two-picture
Stop prefix,not a full cohort pass. Worst losses against accepted product for
q16/q32/q64 are respectively0.002541/0.004860/0.007755 SSIM and2.81/4.68/7.11dB.

For UHD60/63 pictures,q0's no-audio WebM is59,904,232bytes versus8,893,521bytes
for control. The user permits larger files; size alone does not reject q0.
However,whole-job speed,declared codec level/peak rate,realistic progressive
storage admission and long-job resource stability have not been qualified.
The hard64MiB QA cap was not exceeded. No speed measurement is taken from this
PNG-loading,packet-copying,decode-instrumented run or concurrent Node/FFmpeg work.
No CPU/GPU assignment is inferred from query success.

**Decision:** native quality control is feasible and q0 passes the short fidelity
gate; production promotion remains false. Next **WH-07b8** narrows the0..16 range
(e.g.1,2,4,8,with explicit key-picture policy),retaining q0 as the quality control,
and qualifies a selected profile in the actual MP4/audio/OPFS/Stop/Cancel/retry
path. Only a profile preserving the accepted fidelity may proceed to separate
uninstrumented whole-job trials against Economy,three alternating pairs and the
retained15% gate per claimed target. Reuse retained inputs and existing research
owners; do not repeat a full visual render to explore quantization. Keep larger
files if needed; do not silently reduce precision,FPS,resolution or texture.
A candidate must have honest codec-level and storage bounds before integration.
No new preference or mobile ten-bit solution is delivered by WH-07b7.


A concrete conformance limitation was also measured: the UHD60 q0 native payload
is59,903,313bytes over63/60 seconds,or456.406Mbit/s,while native decoder metadata
still advertises `vp09.02.51.10`. The
[VP9 level table](https://www.webmproject.org/vp9/levels/) limits5.1 average video
rate to120Mbit/s. This is packet-only data,not container/audio overhead or a
whole-song projection. Native query and local decode success therefore do not
establish a conforming level. q0 remains a positive fidelity control;it is not
promotion-ready under the current advertised level. WH-07b8 must qualify a
quality-preserving profile with honest level/rate and storage bounds,not simply
raise metadata or silently lower quality. No accepted product encoding changed.


Build and both MJS syntax checks pass; targeted152/152. Cumulative
**2275 /2266 pass /exactly the same nine baseline names AND full messages /
zero skipped or cancelled**,919389.3174ms. All233 old active Node suites remain,
with five additive cases in the existing codec-isolation suite;200 local doc
references pass. Node25.2.1/npm11.6.2,workspace TEMP/TMP `logs/wh07b7/temp`.
The cumulative run overlapped only non-timed native/quality research,not a speed
benchmark. Existing chunk-size warnings are informational. The Bun-only package
deploy is replaced by the existing guarded Node publisher prepare/publish/verify.
`diff_export.ps1` was considered unnecessary for this bounded research increment;
no PR requested. No new physical device/full-song/editor qualification or redundant
manual video test is claimed. WH-07b8 has not started at this handoff.


## WH-07b8 — narrow quality range and actual MP4 boundary (2026-11-09)

One integration owner covers the research worker, browser fixture, evaluator,
tests and docs. The user authorized the next task after WH-07b7. Production
`src/`, accepted WebM Turbo and explicit MP4 Economy fallback remain unchanged.
No new user preference or software codec is introduced.

The opt-in `--quality-refine` cohort retains WH-07b7's original default cases and
adds a separate `refine-v1` manifest: all-key control plus quantizers1,2,4,8 over
the same twelve cases/351 retained PNGs. Both accepted-product and replay-control
per-picture fidelity gates remain fixed. `evaluateReplayBounds` additionally
checks declared VP9 Profile2/level5.1 metadata, padded picture size/luma rate,
complete short-stream average video rate<=120Mbit/s and a conservative four-packet
window<=46Mbit. These checks do not certify tile counts,reference buffers or all
alt-ref/bitstream constraints. The primary definitions are the
[WebM VP9 level table](https://www.webmproject.org/vp9/levels/) and
[VP9 WebCodecs registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/).

The existing NativePacketEncoder lab adapter adds a finite, opt-in
`wh07_quality_profile` message/`configureNativeQuality(1|2|4|8)`. Each codec instance
captures the selection, removes the requested bitrate from its private effective
config, uses native quantizer mode/detail hint and explicit per-frame quantizer,
and keeps one-second keys/contiguous indices. Caller config/options/sample remain
borrowed and unchanged. Original observation configuration resets the selection;
fresh workers retain accepted all-key/default behavior. Probe capture stays off.
The lab backend still reuses product MP4 original PCM/AAC,FFmpeg video-copy and
progressive OPFS ownership,with unchanged two host frame/PCM leases and native
four-entry admission. Browser internal codec memory remains opaque.

Invocations:

```sh
node research/export/wormhole-baseline.mjs capture --quantizer-source=logs/wh01/run-74b0aa3d-3033-43bb-8d7c-7e84af1e23c1 --quality-refine
node research/export/wormhole-baseline.mjs analyze-replay REFINE_RUN logs/wh01/source-comparison-9fd1e979-d27e-4be7-b4c4-f3f9c43fdf01/comparison.json
node research/export/wormhole-baseline.mjs capture --export-host --profile-source --quality-candidate=4
```

Candidate flags are local-lab only and cannot combine with public release/GOP
transforms/other adapters. Existing matrix/exact source fixture/default profiles
are retained. The actual MP4 cohort adds the already existing bounded packet
inspector after encoding, outside any speed measurement. It observes real
container decoder metadata and copied packet sizes,with independent decode
variants; source PNGs are captured only in the existing QA-only source cohort.
No product message protocol or storage policy is silently overridden by this
adapter. Thus a short successful export does not establish long-job storage
admission or support for the actual quantizer configuration before allocation.

Three new Node cases cover declared-rate thresholds,burst windows,padded sample
limits,invalid metadata and the retained q0 negative control. Two additional
native-packet cases cover per-instance quantizer/GOP/ownership and finite channel
validation/reference reset. All original cases and233 active test files remain;
there is no new test file,dependency,golden reset or Graphify rebuild. Scoped
Graphify returned no unique encodeSourceProfile node; direct source inspection
confirmed the seam. The late CLI-only addition calls the pre-existing packet
inspector; the native encoder and new test bodies were fixed before the full Node
run started. Actual browser validation covers that additive I/O branch.


### Results and decision

Refinement capture `run-5cb078b3-bd68-4418-8d7d-a322bb10131c` produces60 actual
ten-bit WebM files/1755 independently decoded ordered IDs. Analysis
`replay-comparison-413293f5-48d5-4e58-871b-a8aa6dbca04f` retains every negative
result and unchanged fidelity thresholds.

| Quantizer | Fidelity-pass files | Sampled5.1-bound files | Both gates |
| --- | ---: | ---: | ---: |
| 1 | 6/12 | 11/12 | 5/12 |
| 2 | 6/12 | 11/12 | 5/12 |
| 4 | 6/12 | 11/12 | 5/12 |
| 8 | 4/12 | 12/12 | 4/12 |

Values1/2/4 produce identical native packet hashes for all twelve sources on this
recorded browser. They are not three independent quality improvements; do not
infer the implementation's internal quantizer mapping from this observation.
For q1/2/4,worst accepted-source loss remains0.001179 SSIM /1.50dB PSNR; q8
loses up to0.001878 /2.25dB. The q4 UHD60 native average108.205Mbit/s fits the
sampled5.1 rate bound, but portrait60's156.993Mbit/s does not. No global profile
qualifies. These are complete short-file averages,not full-song estimates.

Actual product-path q4 capture `run-b54f7385-78f7-47f1-8676-1381b045d8e2` completes
13 cases,12 real MP4 files/351 ordered frame IDs,original stereo AAC and
Stop/Cancel/retry. All351 actual input PNG hashes match the accepted control.
`source-comparison-35b69c04-fa2a-4155-8e9d-e4a21e8a6872` rejects6/12 files on
source fidelity,exactly like native replay. All12 MP4 VP9 packet sequences equal
the corresponding native q4 replay hashes,and all351 source SSIM/PSNR scores
match. Therefore this candidate's measured loss already exists before MP4 muxing;
the container is not introducing this additional texture error.

In UHD60,the q4 quality gate fails at picture15 and19..59 (zero-based),while
keys are0 and60; the next key/prefix passes again. This supports investigating
shorter prediction spans,but does not prove a particular temporal filter,driver
or internal reference mechanism. Do not reduce quality limits after seeing a
failed result. Since quality is not qualified,whole-job speed trials were not
run and no new Turbo gain is claimed.

### Separate MP4 metadata finding

The retained packet inspector also exposes a format-metadata issue: actual MP4
container decoder configurations declare levels31/40/50 even for selected60fps
cases. For example UHD60 reports `vp09.02.50.10...` and1080p60 reports
`vp09.02.40.10...`; their sample rates require higher levels in the existing
`vp9ExportCodec` policy. q4's measured average rate also exceeds its declared
container level in10/12 short files. Native replay's fixed5.1 configuration must
not be confused with these actual MP4 container declarations.

Demux inspection of the retained **accepted all-key** control independently
confirms the same UHD60/1080p60 level declarations. Thus this is not introduced
by the q4 adapter and is not a claim that the user-accepted image is degraded.
It is a separate compatibility defect,with no proven causal attribution to the
user's earlier visual-flow report. The exact metadata-loss boundary (native
configuration,intermediate mux,FFmpeg copy/final mux) still needs isolation.
Do not guess a fix or merely relabel a too-high-rate stream.

Short success also does not qualify existing long-file admission for q4: the
product budget uses nominal8/14/64Mbit/s with1.5x headroom and2MiB fixed overhead.
A q4 UHD60 sample at108Mbit/s can fit this short budget yet exceed its long-job
96Mbit/s steady video allowance. The current preflight probes the original CBR
configuration,not the new quantizer profile. Both concerns block promotion.
All accepted product settings/streaming OPFS remain unchanged in this task.

**Next WH-07b9 takes priority:** isolate and fix MP4 VP9 level-metadata parity
against actual frame rate/configuration/rate,using copy/remux controls before
choosing the smallest shared export-owned solution. Preserve every compressed
video/audio packet and bounded OPFS,then validate metadata,decode/seek and both
hosts. A real product change requires the user's manual test. Do not infer that
an encoder `-level` option necessarily affects stream-copy output.

**After that WH-07b10:** investigate shorter GOPs against the observed q4 drift,
with retained q0 as the positive quality control and genuinely queried/decoded
higher levels only if their output conforms. Check actual quantizer preflight,
rate/level bounds and realistic storage admission before any production profile.
Only a quality-preserving candidate proceeds to separate three-pair whole-job
speed tests and the15% gate per target. Native constant-quantizer scanning alone
is exhausted for the sampled1/2/4/8 range. Mobile10-bit remains deferred; WH-08,
T21b/c andT22-T24 keep their subsequent positions.

Validation: build,research-worker explicit TypeScript and MJS syntax pass;
focused29/29,targeted157/157. Full2280/2271 pass/**the exact same nine baseline
names AND full messages**/zero skipped or cancelled,990701.033ms. All233 old
active Node files,old test blocks,protected exact browser body and eight baseline
reference hashes remain. The negative quality command exits1 as its designed
rejection; this is not a new Node regression. No dependencies,golden or Graphify
rebuild. Node25.2.1/npm11.6.2 with workspace TEMP/TMP `logs/wh07b8/temp`. Existing
chunk-size warnings are informational. The Bun-only package deploy uses the
existing guarded Node publisher prepare/publish/verify. `diff_export.ps1` was
considered unnecessary for this bounded research increment; no PR requested.
Commands,source identities and retained evidence:
[WH-07b8 receipt](../tests/wormhole-wh07b8-research.json). Final release/public QA
are bound under ignored `logs/wh07b8/final-*.json` and checkpoint. No new manual
whole-video test is necessary for this unchanged product runtime.


## WH-07b9 — preserve the actual VP9 MP4 level (2026-11-09)

Production compatibility fix, not a new encoding profile. The accepted all-key
10-bit MP4 already declared levels below its FPS/rate requirement: UHD60 50
instead of 51, 1080p60 40 instead of 41, and 720p60 31 instead of 40. UHD30 at
the retained 64 Mbit/s also requires 51. This does not establish the cause of
previous visual flow artifacts, and makes no new speed or mobile claim.

The bounded UHD60/eight-picture boundary run observed native codec 51 and
reconstructed the same encoded packets with the production fragmented MP4 mux
options: its intermediate also declares 51, while the old final MP4 declares
50. The intermediate is a same-packet reconstruction, not a dump of OPFS.
The exact shipped FFmpeg 5.1.10 WASM was then exercised under Node: copy and
copy plus `-r 60` produce 50; `-level:v 51`, with or without `-r`, produces 51.
All four outputs retain all eight encoded packet hashes and independent decoded
video hashes. This bounded, video-only MEMFS experiment is not browser timing
or a claim about long-export memory. The FFmpeg 5.1 MP4 VP9 writer passes no
frame rate when deriving an unspecified level; its picture-size fallback explains
the result. Sources: [FFmpeg 5.1 VP9 configuration writer](https://ffmpeg.org/doxygen/5.1/vpcc_8c_source.html),
[VP9 level limits](https://www.webmproject.org/vp9/levels/).

The existing pure `ExportPreparation` policy now supplies a finite `-level:v`
argument. It preserves the higher explicit native level and floors by padded
picture size, dimensions, FPS, nominal/observed complete-prefix bitrate and
observed rolling four-picture byte burst. The existing MP4 worker owns only
job-local counters and at most four numeric packet sizes; no additional packet
archive, readback, producer, queue or clock. Unsupported native levels or
measured bounds are rejected rather than falsely lowered. This is bounded
metadata policy, not complete VP9 tile/reference/bitstream certification.
The existing video-copy finalizer, explicit color metadata, PCM-to-AAC path,
streaming OPFS leases, Stop/Cancel, defaults and all-key protection remain.
No new module, dependency, user option or WASM software video codec.

The actual 12-file matrix covers UHD60/30, portrait/square/landscape, 1080p60/30,
720p60/30, ten-bit Stop-and-save, Cancel and retry. Against the retained accepted
all-key controls, all 351 video packets, AAC packets, timestamps/durations/types,
audio configurations and independently decoded video hashes match. Seven MP4s
change exactly one byte (the level); five are entirely byte-identical. Thus the
accepted image and audio are preserved. Local full regression additionally passes
8 fixed baselines, 37 host rows, 21 exact rows/four full-size samples, 18 Economy
and 21 requested-Turbo rows: 36 real files/770 decoded frame IDs, including twelve
ten-bit files. MP4 Turbo still explicitly uses Economy; WebM Turbo remains accepted.

Validation: build and MJS syntax pass; focused 16/16, targeted 160/160. Full
2283 tests/2274 pass/the same nine baseline names AND entire messages/zero skipped
or cancelled, 1111577.7016 ms. All 233 active predecessor test files, original
preparation test blocks, protected exact browser body and eight reference hashes
remain. The first full-browser attempt caught an accidental diagnostic-only
scope error in its Turbo loop; its failed raw run is retained, the loop restored,
and the complete matrix rerun successfully. No product fallback was hidden.
Later CLI additions only strengthen offline packet/decode auditing and allow the
same separate profile matrix against the public release; no subsequent runtime
or Node test-body change. No golden/Graphify/dependency changes. `diff_export.ps1`
was considered unnecessary for this bounded change; no PR requested.

Node 25.2.1/npm 11.6.2 run the declared scripts. Existing chunk-size warnings are
informational. The package deploy command requires Bun, so the established guarded
Node release script prepare/publish/verify is used. Raw source, failed and successful
runs remain ignored and immutable. Commands, hashes and ownership evidence:
[WH-07b9 acceptance receipt](../tests/wormhole-wh07b9-acceptance.json).
Final source/Pages/public-QA binding is recorded in `logs/wh07b9/final-*.json`
and the checkpoint after publication. Manual gate: a short 4K60 MP4 (10-bit
VP9 + AAC), Stop & save, playback, seeking and audio, with accepted quality
retained. No full-song regeneration is required for this metadata-only fix.
Stop here for user acceptance; then WH-07b10 shorter prediction spans/q0 control,
valid level/rate/storage/preflight and separate whole-job speed qualification.
Mobile S22 native 10-bit remains deferred to WH-06c2/e, then WH-08, T21b/c,
T22-T24; T25 maintains handoffs. No candidate quality or speed promotion in b9.
