# WH-04: MVP Offscreen session and GPU material

2026-11-08, Europe/Budapest. Base: ed1bf89. Integration owner: this session.
Owners: visuals/session/GPU, thin worker adapter, shared types, MVP composition,
existing preview UI and documentation. Audio/analyzer, XR scene defaults, dashboard
worker integration and product export scheduling are unchanged.

## Delivered behavior

The existing MVP **Offscreen worker** choice now uses the qualified shared GPU
material/weave/bloom kernel when a real shader/FBO/draw probe succeeds. Reference
Canvas lines remain inside the worker: the unqualified GPU-line profile is not
promoted. Geometry and carrier preparation also remain in the worker. There is no
CPU material deposition, resolve, blur or RGBA readback on the supported fast path.

The choice already has localStorage and Copy support; explicit saved Compatible/
WebGL choices are respected. Fresh MVP installs already default to Offscreen.
The menu now reports the observed active renderer and includes it in Copy.
GPU failure falls back inside the worker with the complete compatible material;
worker startup/channel/deadline failure falls back to the existing main renderer.
The observed fallback never overwrites the saved preference.

Preview retains the existing maximum 30 Hz / 960-pixel long edge (Reduced: 640).
The final p5 presentation surface still follows its existing quality policy.
There is no new quality reduction, preview lead, change to musical timing or
export format. Dashboard activation is WH-05; product GPU export is WH-06;
Takarékos/Turbó export policy is WH-07.

## Ownership, identity and bounded work

- WormholeHostRenderSession owns one existing CosmicWormholeIdentity and its
  surfaces/GPU resources. It consumes an already resolved host frame. It does not
  resolve macros/presets, run a second director, infer music or read State/audio/UI.
- wormholeHostRender.worker is the message/validation/bitmap-transfer adapter.
  Prepare disposes the previous session; reset re-anchors the existing session.
  Transfer failure closes its untransferred bitmap; terminal failure disposes resources.
- WormholeHostWorkerSource is a preview broker. p5 draw only snapshots bounded
  resolved values and presents a completed image. Worker creation, analysis
  projection and postMessage happen in a scheduled microtask outside draw.
  There is one flight, one latest desired snapshot, one retained bitmap and one
  deadline. Repeated unchanged paused input does no render work.
- Full render-analysis projection crosses once per publication/generation. It
  excludes unused acoustic activity. There is no per-frame full-analysis clone
  or JSON.stringify(frame). Scalar snapshots detect changes; nested live frame/
  tuning/spectrum/anchor data is copied before deferred submission.
- The production producer negotiates a context nonce in prepare/ready and uses
  the common protocol-1 preview stamp: context, generation, request serial,
  presentation revision and song time. Both worker and receiver validate it.
  Image dimensions, raster label and finite render timing must also match.
  Wrong/stale results close their bitmap. Old-generation failures cannot poison
  a newer request. The unnegotiated v1 CPU adapter remains an explicit historical
  reference path; a production producer cannot silently accept an old ready packet.
- Resize, density, transparency, depth cue, skybox/display change and seek
  invalidate the appropriate generation/revision. New load replaces analysis.
  Dispose cancels queued startup, clears the timer, closes the image and
  terminates the worker. Hidden tabs cannot accumulate an unbounded request queue.

## Composition and GPU boundary

The session uses Canvas2D for the base and reference lines, then uploads that
surface directly. A null byte-buffer is valid only with an explicit same-size
surface; the original byte-input validator remains strict by default.
GPU targets, shaders and uploads are reused. The existing UHD area/carrier/field
limits remain; normal preview uses the much smaller independent cap.

The informational spectrum is drawn to a separately cleared, lazily allocated
foreground surface. The final shader composites it source-over after the
material, preserving alpha. Disabled overlay uses a complete 1x1 texture.
Default shader operation without overlay is unchanged. XR shader bodies and the
XR adapters are untouched.

PostFX runs once after final identity composition. With a worker image it reads
that image's retained tuning, director, modulation and song time, rather than
newer live values. This uses the existing injected readers; global State is never
swapped around an await. Export retains its synchronous readers and clock.
The multi-identity dashboard composition handshake remains WH-05.

The fast adapter retains the qualified mixed precision: Float16 additive
accumulation, Float32 resolve/IIR, reference quantization and alpha conventions.
Unsupported or lost GPU resources are disposed. Runtime GPU failure explicitly
re-anchors the compatible identity and renders the complete frame again, rather
than presenting material-free base pixels.

## Evidence and limits

Exact predecessor source and changed test predicate identities are retained in
[the Git/SHA256 manifest](../tests/wormhole-wh04-predecessor.json).
Existing cases remain; changes to mocks add the negotiated context/stamp and
deferred scheduling, not weaker behavior. The old source-location PostFX guard
now pins injected frame readers; a functional renderer test verifies the actual
image/time/tuning pairing and synchronous export isolation.

Actual Chrome production-session checks cover material On/Off, opaque/alpha,
high density, foreground On/Off, 1920x1080 layout / 960x540 raster, context loss,
and the original host/compositor/export-isolation cases. Eight new canonical
Canvas comparisons pass the unchanged WH-01 gates. CPU field-raster requests
are zero in those fast-path samples; context loss restores at least three CPU
layers. The large opaque/alpha maximum dark-tile differences are .310/.546
against the fixed .75 limit. The full eight-case raw/base/material/line WH-01
pack retains SHA256 937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f.

Performance is measured outside deterministic test assertions:
- Actual PlexusRenderer CPU draw/submission wall time, including p5 copy, has
  approximately .2 ms median with material in Offscreen mode in the recorded
  run, versus 17.7 ms in Compatible mode. These modes retain their different,
  already-existing preview raster caps; this is not a matched-resolution GPU
  speedup or a whole application/frame-rate claim.
- Separate matched old-CPU-worker/new-GPU-worker requests use identical
  1920x1080 logical size, 960x540 raster and resolved history. Four warmups and
  eight AB/BA measured pairs yielded 22.5 -> 15.2 ms median request-to-bitmap-ack
  latency; p95 48.6 -> 35.0 ms. Small desktop/headless sample, device dependent,
  concurrent system load: no universal multiplier, mobile/Quest or export claim.
- The legacy WebGL worker comparison separately reports a .774 dark tile,
  outside the .75 canonical gate. This negative result is retained; thresholds
  are not loosened. That legacy WebGL image is not the accepted Canvas
  reference. The additional same-layout canonical Canvas samples above pass.
  Pixel identity with the legacy WebGL raster is therefore not claimed.
- A too-short initial profile reported no worker progress; its failed run is
  retained. The reusable profile now uses at least 1.4 s and 20 samples per
  variant/round, validates actual worker progress and forward/reverse order.
  Forced noLoop pause measurement uses actual elapsed presentation time.
  Twenty settled samples do zero identity or PostFX work.

Full test/build/browser/release receipts, exact commands and failed attempts:
logs/wh04/acceptance.json and adjacent ignored logs. No dependency installed.
Commands use Node/npm: npm run build; npm test -- --test-reporter=tap
--test-concurrency=4; the explicit twenty-file Node suite in the receipt;
node research/export/wormhole-baseline.mjs capture/verify; the retained GPU lab
and actual-browser performance runner. Guarded Node Pages publication replaces
the Bun-only deploy script. Headless Chrome/network checks require the
authorized sandbox-external tool path; this is actual browser automation,
not an HTTP-only or physical-device result. diff_export.ps1 is not used;
the focused source diff, retained predicates, links and whitespace are reviewed.

## Manual handoff and next cursor

In MVP choose Wormhole renderer: Offscreen worker. The active hint should say
GPU material in worker on supported devices, or identify the compatible fallback.
Check playback, pause/resume, rewind, presets/macros, material/weave/bloom and
the spectrum overlay. Expect lower main-thread load and more responsive
controls, with the accepted appearance. Also try switching to Compatible and
back, and hiding/reopening the tab.

Physical mobile/Quest, a new complete 4K video and sustained thermal behavior
are not qualified here. MP4 default, mobile 4K, accepted 10-bit settings and
Wall/Cockpit defaults remain. After deploy stop for manual acceptance.
Next: WH-05 dashboard activation and complete cross-host composition, then
WH-06 export, WH-07 profiles and WH-08 platform qualification.


## Final validation summary

The complete cumulative run has 2174 cases: 2165 passed, nine retained preset
failures, zero skipped/cancelled, 1037172.2817 ms. Every failure name and full
message matches the WH-03b receipt exactly. The final twenty-file targeted run
has 271/271 passes, 79109.2381 ms; the final broker/reader subset also has
49/49 passes. TypeScript and production Vite build succeed.

The final browser suite has 25/25 host/session cases, including eight canonical
GPU/Canvas comparisons and real context-loss material fallback. The shared GPU
laboratory also passes all eight original numeric/temporal/bitmap cases.
225 active Node files remain; 13 predecessor source/predicate identities are
verified from Git. Seven changed documents have 209 valid local links.
No protected snapshots, shaders or quality thresholds were regenerated.

A final production Pages receipt binds source, input inventory, built assets,
release marker and public routes. Public browser startup/backend switching and
GPU laboratory are checked separately; a successful build alone does not count
as that check. After publication the session stops for the user's manual test.
