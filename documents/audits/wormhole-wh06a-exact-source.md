# WH-06a: full-resolution resolved-input exact source

2026-11-08, Europe/Budapest. Base: 278b86e. One integration owner: this session.
Owners: visuals/session/GPU/broker, thin worker adapter, shared data contracts,
research validation and docs. The export coordinator, codecs, PCM, OPFS, audio,
host entrypoints, user renderer preferences and XR scene have no implementation
changes in this part.

## Delivery boundary and next part

WH-06 is split into two handoffs under the epic's existing decomposition rule.
This part supplies and qualifies the exact source. **WH-06b connects it to the
dashboard and MVP export jobs**, their composition barrier and existing formats.
The current product export remains on its accepted Compatible path. This is not
a new export option, the return of Isolated Wormhole, a Turbó profile, or proof
of a faster complete video. WH-07 adds the selectable scheduling profile after
WH-06b; WH-08 owns long/platform qualification.

The reusable browser gate is the existing host-backend smoke page, with an
opt-in **Validate exact 720p / 4K source frames** button. It reports the exact
source matrix separately from the retained 37 preview/host checks. The gallery
offers four full-size dense 4K reference/GPU PNGs, including alpha. It does not
encode a video or create automatic downloads/storage records.

## Contract and ownership

WormholeHostExactSource owns one worker for one prepared job. Prepare negotiates
the job ID, 30/60 fps and fixed even output dimensions with the existing common
worker. A preview-only ready response cannot silently satisfy this negotiation.
Dimensions retain the UHD area ceiling; there is no 960-pixel preview cap or
device-RAM claim. Frames require density 1, compact false, isExporting true,
frameCount = frameIndex + 1, and both song/export time = frameIndex / fps.
Integer microsecond timestamps and every common stamp identity are validated.

The broker permits one outstanding request OR one leased image, with no queued
latest-wins replacement. It copies bounded borrowed tuning/frame/spectrum/signals/
anchor/display inputs before deferred submission. The copy helper is shared with
the preview producer; its old copying behavior is preserved. The unused acoustic
activity tree stays outside render analysis. Analysis crosses only at prepare;
PCM is neither read nor transferred by this source.

Context/generation/request serial/presentation revision/job/fps/index/time and
returned dimensions must match before a frame is accepted. Malformed/stale images
close; duplicate replies cannot replace an owned lease. Release, failure, abort
and disposal close the image once and terminate/clear the source's resources.
Prepare has a 15-second deadline; a frame has 30 seconds. Retry needs a fresh
source/job; an exact source cannot be re-prepared or reset into another job.
Stale generations and foreign reset contexts cannot poison the active session.

Explicit forward frame segments are accepted for a host which leaves and re-enters
Wormhole. Backward indices are refused. The source never drops a submitted request;
the WH-06b coordinator must still prove the complete contiguous encoded timeline.
An identical index may repeat only with unchanged captured inputs. A bounded
scalar comparison validates that condition without full-analysis JSON or planning.
These are resolved host inputs, not another semantic/gain/director or 60 Hz
replay engine. Cross-FPS/history invariance of every host plan is not established
by comparing a candidate with its reference at the same requested FPS.

## Exact material and repeat correction

The common session and shader kernels remain shared. Exact material uses **Float32
accumulation** and the existing Float32 resolve/IIR passes; the live preview keeps
its accepted Float16 accumulation profile. Float32 blending support is checked, with real floating-target/shader draw probes; the first material frame remains guarded.
Missing capability uses complete Canvas material in the worker. This precision
is computation precision, not a change to video codec, pixel bit depth or format.

The original direct GPU final sum differed from Canvas on large transparent dark
regions. Native Canvas performs RGBA8 sampling/rounding at each layer; summing
once in the final GPU shader is not equivalent. The exact adapter therefore
computes material/weave carrier deposition, resolve, bloom and quantization on the GPU, blits only
the bounded material layers through its small drawing buffer, then uses native
Canvas lighter composition in the original layer order. Spectrum remains after
the material. There is no readPixels, per-pixel CPU conversion or CPU material
deposition/resolve/blur in the supported fast path. Browser-internal surface-copy
cost is not claimed to be zero. The preview's shader/composition law is unchanged.

The layer pipeline is extracted once inside WormholeGpuRaster and used by both
presentations. Exact avoids allocating full-size GPU base/line/output surfaces;
its material grids remain bounded by the existing 640x360 field budget. One
completed full-size Canvas is retained and one reusable transfer surface produces
fresh ImageBitmaps. An optional spectrum surface is separate. No frame queue or
per-repeat material render is added. These surfaces must be included in WH-06b's
job resource accounting; a surface count is not a measurement of free RAM/VRAM.

Repeating a consumed image now copies the completed pixels instead of drawing the
identity/material again. Repeats are bit-exact and cannot advance geometry or
associate a previous image with changed PostFX companions.

Startup/first-frame GPU failure can use complete compatible rendering. After an
exact frame has completed, a GPU failure on a later unique frame is **terminal**:
the source requires a new compatible job instead of silently re-anchoring the
animation halfway through a video. An already cached image can still repeat after
GPU loss. The existing preview fallback behavior is unchanged. This closes a
potential source of visual discontinuity; it is not proof about past encoded files.

## Evidence and retained negative results

The [predecessor manifest](../tests/wormhole-wh06a-predecessor.json) retains exact
Git/SHA identities. Existing Node tests and all 37 original host checks remain.
No shader baseline, preset baseline, historical result or quality threshold is
replaced. The earlier intermediate whole-suite log remains in logs/wh06a/full.tap;
the final whole suite is separate in full-final.tap.

Early direct composition, intermediate per-stage rounding and native composition
with Float16 were retained as failed probes. Full-size alpha dark-tile errors
reached about 1.298 versus the fixed 0.75 gate. The final Float32/native profile
passes without changing that gate. New repeats initially exposed physical
re-render differences; completed-image replay fixes the behavior without weakening
the bit-exact repeat assertion.

Final real Chrome source gate: **21/21**, including 720p/4K, landscape/portrait/
square, 30/60 fps, alpha/spectrum, material Off, evolving controls, dense
material/weave at song time 3, repeated consumed images, actual context loss,
fresh compatible fallback and real-worker abort/retry. The direct exact GPU probe
records zero CPU field-raster calls. A mid-job GPU failure fails closed. Four
3840x2160 dense PNGs are retained with hashes; numerical and visual inspection
preserve shape, gradients and detail. Sample PNGs are not a whole-song/video test.

The worst final dark-tile error is 0.444781 against 0.75; maximum mean error is
0.000683331 eight-bit code values against 1.5. Repeated images are bit-exact.
The retained preview GPU laboratory passes 8/8 and original host checks 37/37.
The WH-01 full raw/base/material/line reference pack retains SHA256
937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f.

Build and 26-file targeted regressions pass: **336/336**. The final cumulative
Node result is **2203 total / 2194 pass / 9 fail / zero skip/cancel**. The nine
known authored-preset failures must match WH-05 by name and full assertion text;
the closing receipt validates this comparison rather than reclassifying failures
as passes. There are 226 active Node test files. Exact-focused post-change checks
also pass 40/40 across the exact broker/session, old preview broker and GPU contract.

Commands and exact file lists are recorded in logs/wh06a/acceptance.json:
`npm run build`; `npm test -- --test-reporter=tap --test-concurrency=4`;
`node --test --test-reporter=tap --test-concurrency=4` with the retained explicit
26-file list; `node research/export/wormhole-baseline.mjs capture --exact-host`;
`node research/export/wormhole-baseline.mjs verify`;
`node research/export/wormhole-baseline.mjs capture --exact-host --public-release=ID`
for the actual deployed host/exact fixture, keeping the scalar reference local;
`node research/export/wormhole-gpu-spike.mjs capture float16 cpu-lines` and `verify`.
No dependency install or Graphify rebuild. Node/npm are available. The guarded
Node publisher replaces the Bun-dependent package deploy command. diff_export.ps1
is unnecessary for this scoped feature; source/build/test manifests are retained.

## WH-06b acceptance work still required

1. Inject the job-bound exact source at both composition roots and expose an
   explicit frame-completion barrier to export. p5 draw remains synchronous;
   no live State swapping, second resolver, async target writes after teardown
   or preview bitmap reuse is permitted.
2. Compose the exact image, native crossfade counterpart and PostFX at one captured
   song time. Await completion before the existing video/metadata/capture/encoder
   handoff. Keep one shared-pool advancement and one final PostFX pass.
3. Preserve all current WebM/MVP MP4 and accepted 10-bit profiles, aspect ratios,
   sample rounding, audio buffers, workspace lock and OPFS ownership. Preserve older FPS APIs through Compatible when outside the exact 30/60 profile. Match the
   Compatible reference with the same resolved input sequence and requested FPS.
4. Prove full/prefix decoding, PTS/DTS/frame order, A/V end alignment, Stop/Cancel
   precedence, late replies, failure/retry and cleanup on the integrated jobs.
   Remove display waits only where the authoritative exact barrier makes them
   unnecessary; do not artificially slow the eventual Takarékos profile.
5. Record actual output/whole-job timing. This part has no speed multiplier, new
   full-song 4K export, physical mobile/Quest qualification, or codec-quality claim.

Stop after commit/push/deploy for manual acceptance. On the test page, run the
exact button and expect pass true in every row; compare the dense image pairs
and optionally inspect their full-resolution PNGs. WH-06b is the next task.

## Closing receipt

Implementation commit: 29847ba. Final full Node duration: 717398.1894 ms;
26-file targeted duration: 149890.0123 ms. All nine failure names and complete
messages match WH-05. The 9-source predecessor manifest and 226 active test files
are verified. Nine changed/new documents have 235 valid local file references.
Whitespace and build checks pass. Full-suite diagnostics and all intermediate
candidate artifacts remain in logs/wh06a; no failed probe is promoted or erased.

Accepted raw-image run: logs/wh01/run-f1452b0c-53c5-4143-9ef4-a07b7f4e0c1d.
Preview GPU regression: logs/wh02/run-48bd77dc-5efa-4f66-a1d0-edfeb816b0a6.
The four saved dense PNG hashes and final release/public identities are recorded
in logs/wh06a/acceptance.json and the sibling XR-FEJLESZTESI-STATUSZ.md checkpoint.
The source gate passes 21/21; the product/export and physical-device gates remain
assigned to WH-06b/08, not implicitly accepted by this receipt.

Exact targeted command:

```text
node --test --test-reporter=tap --test-concurrency=4 tests/wormhole-host-worker.test.mjs tests/wormhole-music-display.test.mjs tests/wormhole-render-contract.test.mjs tests/paused-renderer.test.mjs tests/visual-frame-preparation.test.mjs tests/semantics-integration.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/contracts.test.mjs tests/performance-optimizations.test.mjs tests/visual-mode-transition.test.mjs tests/postfx-fragmentation.test.mjs tests/wormhole-lifecycle.test.mjs tests/wormhole-determinism.test.mjs tests/xr-gpu-material.test.mjs tests/xr-gpu-lines.test.mjs tests/xr-webgl-backend.test.mjs tests/export-isolated.test.mjs tests/export-deterministic.test.mjs tests/wormhole-exact-frame.test.mjs tests/wormhole-exact-worker.test.mjs tests/wormhole-depth-integrity.test.mjs tests/material-preview-budget.test.mjs tests/preview-quality.test.mjs tests/styles-deterministic.test.mjs tests/wormhole-host-exact.test.mjs tests/wormhole-gpu-raster.test.mjs
```
