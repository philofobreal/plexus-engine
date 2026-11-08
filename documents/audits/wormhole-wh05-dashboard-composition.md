# WH-05: dashboard worker and paired identity composition

2026-11-08, Europe/Budapest. Base: b9376e7. Integration owner: this session.
Owners: visuals/compositor/broker, dependency-light internal types, dashboard
composition, existing preview UI and docs. Audio, analysis, XR scene, worker wire,
product export codecs and scheduling have no implementation changes.

## Delivered behavior

The main dashboard now injects the same WormholeHostWorkerSource as MVP. Its
existing Wormhole renderer menu enables Offscreen worker, storage and Copy, and
reports the observed GPU/compatible-worker/main fallback. Fresh installations
use the existing Offscreen preference default; explicit saved choices survive.
Native non-Wormhole styles are identified as native rather than worker failure.

Both hosts use the same renderer. A worker Wormhole/native style transition now
matches the native image, worker image, crossfade progress and PostFX to one
captured song time. A worker wait retains the previous completed composite on a
stable surface and does not apply PostFX repeatedly to it. Resolution/density
changes invalidate the surface instead of accepting an incompatible old pair.

This fixes a real asynchronous composition hazard: an older Wormhole image must
not be mixed with a newer native image or a newer transition weight. Native
particle/shockwave simulation nevertheless continues once per main draw, so a
busy worker does not slow or double-step that simulation. There is no new audio
clock, music analysis, gain/preset resolver or director inside this coordinator.

## Bounded ownership

- WorkerIdentityTransition is a renderer-private companion coordinator. Transition
  creation/replacement remains in requestVisualModeChange; completion remains in
  IdentityTransitionController and accepts only the current generation's completed
  image time. No effect owns transition state.
- The compositor's two existing persistent p5.Graphics are reused: incoming is
  current native scratch, outgoing freezes the admitted counterpart. No per-pair
  surface or additional image queue is allocated. Both are disposed with p5.
- WormholeHostPairing adds an optional synchronous capture callback and explicit
  presentation acknowledgement to the internal source port. No wire/schema change.
  Capture follows the owned input copy, before deferred submission. Paired mode
  admits only when ready, with no flight/pending/unpresented image. Scalar changes
  while blocked retain a revision until admission, including paused edits.
- The helper presents only an exact captured-frame reference accepted by the
  existing context/generation/serial/presentation/time stamp validation. Rapid
  replacement, rewind, new analysis and presentation changes invalidate old work.
  Leaving a pair for steady Wormhole retains its valid bitmap to avoid black flash.
- Crossfade alpha and injected PostFX tuning/director/modulation/time use the
  admitted snapshot. State is never swapped around an await. The source owns and
  closes bitmaps; the helper borrows one only during its synchronous call.
- Worker failure uses the synchronous controller. If capture already advanced the
  native pool, fallback draws borrow the advanced pool without stepping it again.
  GPU failure retains the complete compatible worker material fallback from WH-04.

The established synchronous Canvas source-over composition is shared unchanged.
The paired path is checked byte-for-byte against it for opaque/partial alpha,
both directions and five mix values. This task does not redesign blending laws.
Resizing compositor targets also invalidates their drawing-state caches.

## Validation and retained evidence

Exact predecessor bytes are retained by Git identity and SHA256 in
[the manifest](../tests/wormhole-wh05-predecessor.json). No old test is removed.
The PostFX source-location guard now checks the conditional completed-frame seam;
functional renderer tests independently verify captured values and export bypass.
The existing browser case now permits legitimate asynchronous wait draws while
still requiring one director per draw and one post pass per completed frame.

Nine added Node cases cover paired broker admission/ack/paused edits, pure-Wormhole
exit, both directions, replacement/stale metadata, controller completion, the
actual renderer's captured PostFX values and failure after native capture.

Actual Chrome passes 37 host/session checks, retaining the original 25. New cases
cover Classic and Temporal in both directions, exactly 75 particle updates per
host draw during paired waits/presentation, no PostFX while waiting, no new graphics
targets, replacement/rewind/density resize, chroma/spectrum, a live host-owned video
stream with canvas alpha, and four exact paired/synchronous compositor comparisons.
The video check verifies the host-layer contract; it is not a claim of testing
every video file/decoder or the full DashboardUI video-import workflow.

The eight canonical production GPU/Canvas comparisons retain fixed WH-01 quality
gates, zero CPU material raster calls on the fast path and complete CPU fallback
after real context loss. The eight-case full raw/base/material/line baseline pack
retains SHA256 937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f.
Initial local probes exposed two test assumptions: backward time before the
recorded start legitimately clears an old transition; a resized canvas does not
retain old pixels. Corrected tests separately re-arm the transition and apply the
retained-pixels assertion only to a stable-size surface. Failed probe logs remain.

Final cumulative/build/release evidence is recorded in logs/wh05/acceptance.json.
The closing results below summarize the required runs; the local receipt retains exact failure messages and artifact hashes.

Commands: npm run build; npm test -- --test-reporter=tap --test-concurrency=4;
node --test --test-reporter=tap --test-concurrency=4 with the explicit files listed
in the receipt; node research/export/wormhole-baseline.mjs capture and verify;
node research/export/wormhole-gpu-spike.mjs capture float16 cpu-lines and verify.
The GPU runner also supports --public-release=ID to test both deployed hosts,
menu switching, persisted choices, active-backend hints and nonblank output before
its retained local image/temporal/lifecycle checks. No dependency installation or
Graphify rebuild. Node/npm are the available runners; release uses the guarded
Node publisher because the package deploy script is Bun-dependent.

## Manual acceptance and continuation

In dashboard and MVP select Wormhole renderer > Offscreen worker. Expect
Active: GPU material in worker when supported, otherwise an explicit fallback.
Check play/pause/resume/seek, tuning/material/weave/bloom and spectrum. While
playing in dashboard, switch Wormhole to Classic/Temporal and back: no mixed-time
jump, duplicated flash or stuck transition; other styles keep their normal motion.
Try a video backplate, resize and Compatible/Offscreen switching. A saved explicit
choice should remain after reload.

Stop after delivery for manual acceptance. Next is WH-06 exact shared GPU export,
then WH-07 selectable Takarékos/Turbó and WH-08 platform qualification. WH-05 does
not accelerate full video export or change MP4/WebM/bit depth. No new full-song
4K export or physical mobile/Quest qualification is claimed. Wall/T15 deferrals,
Cockpit Off default, MP4 default, mobile 4K and accepted 10-bit quality remain.

## Closing validation receipt

- Production TypeScript/Vite build succeeds; only the existing large-chunk advisory.
- Full cumulative Node: **2183 total, 2174 pass, 9 fail, zero skipped/cancelled**,
  1193083.7679 ms. All nine failure names and complete assertion messages match
  WH-04 exactly. They remain failures concerning authored preset visibility,
  depth/separation and speed ordering; no snapshot or gate was rewritten.
- Targeted 24-file regression: **310/310**, 251363.2582 ms. The shorter renderer
  integration run also passed 11/11. Source changes after those tests affect
  research-runner shutdown/public verification and docs only, not product runtime.
- Real Chrome host/session: **37/37**. Shared GPU laboratory: **8/8**, including
  temporal/bitmap/lifecycle checks; verify independently recomputes raw pixel metrics.
  Both capture commands finish with exit code zero. Earlier failed probes remain.
- **225 active Node files**, **15 immutable Git/SHA predecessor sources**.
  Nine changed/new Markdown documents have 220 valid local file references.
  Whitespace and predecessor hash checks pass. No active test case is removed.
- Product implementation: a7b8447; research capture/public-check follow-up: db8348b.
  Guarded Pages publication and actual public-host evidence are retained with the
  final source/release identities in logs/wh05/acceptance.json and the sibling
  XR-FEJLESZTESI-STATUSZ.md checkpoint. Deployment does not imply physical-device
  or full-song export qualification.

Exact targeted command:

```text
node --test --test-reporter=tap --test-concurrency=4 tests/wormhole-host-worker.test.mjs tests/wormhole-music-display.test.mjs tests/wormhole-render-contract.test.mjs tests/paused-renderer.test.mjs tests/visual-frame-preparation.test.mjs tests/semantics-integration.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/contracts.test.mjs tests/performance-optimizations.test.mjs tests/visual-mode-transition.test.mjs tests/postfx-fragmentation.test.mjs tests/wormhole-lifecycle.test.mjs tests/wormhole-determinism.test.mjs tests/xr-gpu-material.test.mjs tests/xr-gpu-lines.test.mjs tests/xr-webgl-backend.test.mjs tests/export-isolated.test.mjs tests/export-deterministic.test.mjs tests/wormhole-exact-frame.test.mjs tests/wormhole-exact-worker.test.mjs tests/wormhole-depth-integrity.test.mjs tests/material-preview-budget.test.mjs tests/preview-quality.test.mjs tests/styles-deterministic.test.mjs
```
