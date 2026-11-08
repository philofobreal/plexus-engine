# WH-07a: bounded WebM Turbo and explicit MP4 fallback

Date: 2026-11-08, Europe/Budapest. Integration owner: this chat's agent.
Predecessor: `77c0d5b`; original source/test identities are retained in
[the predecessor manifest](../tests/wormhole-wh07-predecessor.json).
Status: implementation, cumulative/local quality and speed qualification complete. Release/public receipts are retained in `logs/wh07/final-*.json` and the session checkpoint; stop for manual acceptance.
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
