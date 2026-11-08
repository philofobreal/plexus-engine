# WH-06b: shared exact GPU source in product export

Date: 2026-11-08. Integration owner: this chat. Owners: visuals (resolved frame,
composition and PostFX), export (job, encoder, PCM and OPFS), composition roots
(factories), MVP UI (existing format explanation), docs/research (evidence).

## Delivered behavior

Dashboard WebM and MVP WebM/MP4 now use the WH-06a exact source when the existing
persisted Wormhole renderer choice is **Offscreen worker** and the browser can
start it. This is internal to the existing Compatible product workflow. No
Isolated Wormhole choice, workspace concurrency, new preference schema, URL
switch or fixed RAM admission gate is introduced. Explicit Compatible/WebGL
choices retain their synchronous path. Unsupported exact frame rates (other
than 30/60) also retain that path rather than becoming a new export refusal.

The existing menu, localStorage and Copy behavior select the renderer. The
Takarékos/Turbó scheduler and expanded effective-mode diagnostics remain WH-07.
This task does not claim a complete-video speed multiplier.

## Ownership and completion

`HostExportFramePort` is a dependency-light structural contract attached by the
renderer to its p5 instance. Both composition roots inject a fresh
`WormholeHostExactSource` factory. Export imports the port type, not a visual
runtime, and reserves its existing job/target/encoder resources.

`ExactExportFrameBridge.begin()` prepares the job-bound analysis once, outside
draw. The renderer reuses its position-sync hook to align host event/cue cursors
and identity discontinuities at song zero. There is still one host tuning/gain,
automation, analysis publication, transient sampler and director owner. No
second interpretation or mutable State replacement runs across an await.

For each requested index, export clears its target and awaits `renderFrame()`.
p5.draw stays synchronous: it resolves the frame once, captures bounded inputs
and any native counterpart, and queues one exact request. Worker I/O remains
deferred by the source. The bridge awaits both p5.redraw and the completion
promise. Only then can video/background/metadata composition, ImageBitmap
capture, PCM slicing and encoder submission proceed. Display-rAF waits are
removed only for this authoritative exact barrier; legacy scheduling remains.

Transitions retain the existing two compositor objects and Canvas source-over
law. Native simulation advances once at the requested time. Its frozen pixels,
worker image, alpha and PostFX use that same frame; no preview bitmap enters the
export. Only IdentityTransitionController completes transition state. PostFX has
one invocation seam and reads the owned resolved snapshot on deferred completion,
including the export-active flag, rather than newer State.

Source startup failure can return to the synchronous renderer before any frame
is submitted. A complete worker Canvas fallback is also supported by WH-06a.
A mid-job GPU/worker failure fails the job; it never restarts animation silently.
Retry uses a new source/job. The accepted exact Float32/native material and the
preview Float16 profile retain their previous kernels and quality gates.

## Stop, Cancel and resources

Encoder admission remains at most two outstanding frames; there is one render
request OR image lease and no latest-wins export queue. All accepted timestamps
remain rounded integer microseconds derived from index/fps. Audio endpoint
rounding, reusable PCM buffers, format preflight, metadata/video seeking and OPFS
retention/discard contracts remain export-owned.

Stop invalidates pending rendering and saves only the already submitted
contiguous prefix. Cancel wins over Stop, terminates workers and suppresses the
result. Encoder errors also interrupt a pending render. The target survives
until p5.redraw and deferred presentation quiesce; cancellation is not a race
that permits late canvas writes. Source disposal happens before target removal
or preview-loop restoration. Late images close and each lease releases in a
finally block, including PostFX/presentation failure.

After a quiescent exact job the renderer shrinks its two reusable transition backing stores
to 1x1 and releases its PostFX snapshot. It restores its existing live position
hook; the next preview draw recreates appropriate preview storage lazily. The
worker owns a completed full-size Canvas, a reusable transfer Canvas, bounded
material grids and optional full-size spectrum overlay. Export owns its graphics
and capture Canvas; PostFX and an active transition add their own surfaces, while
the encoder owns bounded admitted images. These are explicit resources, not
measured free RAM/VRAM or a promise about browser process memory. GPU disposal and
Canvas resizing request release; physical reclamation remains browser-owned.

## MP4 quality finding

The new diagnostic puts a six-bit frame ID on the completed target after raw
quality comparison and checks every encoded/decoded image, not just timestamps.
It found a pre-existing detail remnant with VP9 10-bit in MP4: input IDs 1..8 were
correct, but both browser and independent FFmpeg decoding read
`1,2,3,4,4,6,7,8` in one portrait case. Complete-frame hashes differed, so this was
a local retained detail, not proof of a duplicated whole frame or a bad GPU clock.
Removing VideoFrame duration in an actual instrumented worker did not fix it.

The independent-picture experiment passed the same strict ID test. The existing
optional high-precision MP4 profile therefore now uses `keyFrameInterval: 0`;
its 10-bit VP9 output, AAC audio, FFmpeg stream-copy finalization and storage
bounds remain. Normal H.264 MP4 retains its previous GOP, and WebM is unchanged.
The existing 10-bit MP4 note explains the possible larger files and player/editor
compatibility. This is an empirical local correction, not a universal codec bug
claim or a guarantee about every full-song export.

The first WebM false alarm was the test querying an ideal 60-Hz time before the
next container timestamp rounded to milliseconds. The test now samples the
actual validated packet timestamp. It still asserts count/order and <=1.1 ms
clock error, plus exact decoded IDs in two independent decoders; no quality gate
was relaxed. Failed experiments and artifacts remain separate immutable runs.

## Validation and reproduction

The predecessor manifest retains Git/SHA identities of affected previous source
and tests. All previous cases remain active; no golden, numeric gate, fixture or
known-failure assertion was removed. The immutable WH-01 CPU pack must retain
SHA-256 `937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f`.

Commands (Node/npm available; no dependency install or Graphify rebuild):

- `npm run build` (TypeScript and production Vite).
- `npm test -- --test-reporter=tap --test-concurrency=4` (complete cumulative suite).
- Explicit targeted Node suites listed in the closing receipt.
- `node research/export/wormhole-baseline.mjs capture --exact-host --export-host`.
- `node research/export/wormhole-baseline.mjs verify`.
- `node research/export/wormhole-gpu-spike.mjs capture float16 cpu-lines` and `verify`.
- Guarded Node Pages prepare/publish/verify; the package deploy script is
  Bun-dependent, so it is not the available deployment runner.

The browser runner retains the 37 host and 21 exact-source gates and four
full-resolution PNGs, then runs actual p5/worker/encoder/OPFS exports. The export
matrix spans all three aspects at 720p and 4K, WebM 8/10-bit, MP4 H.264 and VP9
10-bit, 30/60 where specified. Encoded 4K samples here are 30 fps; raw-source 4K
60 fps is separately tested. It includes both-direction native transitions,
PostFX exactly once, bounded shared-pool steps, 36/48-frame timeline stress,
Stop, Cancel and retry. Browser demux/decode checks dimensions, codecs, frame
IDs, timestamps, stereo tone and audio endpoint. FFprobe and FFmpeg independently
check output metadata, 10-bit pixel formats and every decoded ID.

Research variants `--mp4-no-duration` and `--mp4-inter-frame` reproduce rejected
candidates; `--mp4-all-intra` pins the promoted picture policy. Transform hooks
run in the actual worker build and assert their source boundary; manifests bind
source hashes, bundles and arguments. The small-site runner serves the same
public FFmpeg/WASM files as production. Bounded QA copies preserve short artifacts
before OPFS cleanup; no video/audio/model output enters source control.

Raw/PostFX comparisons use the existing WH-01 strict RGBA/dark-tile gates.
QA readback/comparison work is deliberately outside the product path. Test-job
elapsed times include that instrumentation and must not be used as speed claims.
No new physical-mobile, Quest, complete-song, thermal or editor qualification is
claimed. The user's earlier Android acceptance applies to that earlier build.

## Closing evidence

The [compact receipt](../tests/wormhole-wh06b-acceptance.json) binds exact commands,
source hashes, immutable predecessors, artifact hashes and the nine unchanged
baseline failure messages. Final full cumulative Node: **2224 / 2215 pass / 9
known failures / 0 skipped or cancelled**, 576479.1425 ms. All nine names/messages
match WH-06a exactly. Targeted: 228/228; after the draw-ownership review, 106/106
and the nine preview-density cases pass. A prior full run's extra failure was an
obsolete generic test stub, not suppressed: the fixture now loads the real
bridge, retains every original assertion, and the final cumulative run closes it.
Node v25.2.1/npm 11.6.2 ran the checks without dependency installation.

Browser closing run: `logs/wh01/run-37865dea-0ce1-491e-865f-1f15afbfdb35`.
37/37 host checks, 21/21 exact-source cases, four full-size PNGs, 18 integrated
export cases, 17 files, **382 independently decoded frame IDs**, six 10-bit files.
48 strict CPU-reference versus GPU/completed-PostFX images pass; maximum dark-tile
error 0.08499375 against the unchanged 0.75-code gate. Actual PostFX writes are
required, not merely its bypass. Each transition job produces 24 paired frames,
including a real resize and unsolicited redraws without extra simulation/PostFX.
Preview GPU: 8/8, `logs/wh02/run-48e54b8e-e93a-41eb-8153-8dcd5f762109`; its raw
metrics are independently recomputed. The WH-01 pack hash remains unchanged.

The WH-06a exact test body remains byte-identical (SHA-256
`6b6a19bceaecfecdf213a9af053c9ee2f08e95509955982b07bc140008abd42c`).
Fourteen original file predecessors and four review-stage predecessors are bound
to immutable Git/SHA identities. No preset, golden or acceptance gate is loosened.
The original VP9 inter-frame failure and video remain under
`logs/wh01/run-f088871e-1f5f-47df-9da4-54b9a6a210e5`; rejected duration and successful
independent-picture experiments remain distinct source/bundle-bound runs.
Production build and git diff whitespace checks pass. Vite's large-chunk notice
is retained as informational output. Full-song, physical-device and performance
multiplier limits above still apply.

Public qualification also passed the 37 host / 21 source / 18 integrated cases
and 17 files / 382 decoded IDs on release `wh06b-export-gpu-20261108T134240071Z`;
public dashboard/MVP renderer switching and persistence passed. It exposed one
stale menu help sentence, corrected in a copy-only follow-up (including an ASCII
frequency separator). Preview/density tests and the production build are rerun;
renderer, worker, codec behavior and the earlier output receipts are unchanged.
The final live release identity is retained in the session checkpoint.

## Manual acceptance and continuation

In dashboard and MVP choose Wormhole renderer > Offscreen worker. Export a short
clip first, then the normal full song. Check the same scene/material/spectrum,
stable animation without mixed-time transitions, clean sound, beginning/end,
seek in the saved file, Stop & save, Cancel and immediate retry. Compare
Compatible when useful. MVP's default remains MP4 and mobile 4K is still offered.
Optional 10-bit MP4 can be larger; test playback in the intended player/editor.

Stop after this handoff. Next, only after manual acceptance: WH-07 selectable
Takarékos/Turbó profiles with measured end-to-end scheduling overlap, shared menu,
storage and Copy; WH-08 long/platform qualification. T21b/T21c and T22-T24 remain
after the epic; T15 and Wall stay deferred.
