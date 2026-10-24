# Review checkpoint — 2026-10-24

Integration owner: this chat. Scope: accumulated T00–T11a source, documentation, tests and release
workflow, plus the user's explicit MVP Offscreen/material request. Independent read-only audits
covered analyzer/contracts/docs, gameplay/XR and visual/worker lifecycles; one owner implements
all shared-contract changes. No dependency installation or algorithm/preset retuning.

## Confirmed fixes

- A late native preparation failure now respects Background Off and scene disposal. It cannot
  recreate the Hybrid background after teardown. Explicit subsequent On can still use fallback.
- Exact-worker preparation now has a generation-bound 15 s deadline after capability negotiation.
  Replacement, success, errors, messageerror and dispose cancel the correct timer/resources.
- Pages preparation now builds the actual clean committed source through `npm run build`.
  Preparation/publication/verification bind HEAD and the full build-input inventory, including
  imported build scripts and newly added/removed inputs. Stale dist cannot be relabelled as new
  source. Historical task publishers fail before doing I/O; their original implementation stays
  below the guard as audit history. Only the reusable publisher is operational. No source copies
  are generated for a release: hashes and ignored local logs suffice.
- Worker documentation now states the optional T11a accepted-event contract and unsupported
  capabilities. Old tracker handoffs are labelled completed; the authoritative resume point is
  versioned here and in [the tracker](xr-development-tracker.md).

## MVP performance delivery

`Advanced tuning → Wormhole renderer → Offscreen worker` moves the identity's geometry,
material carrier accumulation, weave, resolve, pixel conversion, raster and bitmap creation
into a worker. It reuses the XR rendering primitives and OffscreenCanvas/ImageBitmap approach.
The MVP remains the one preset/semantic/director/gain owner and sends resolved frame inputs,
not a second plan/analysis/clock implementation. Full immutable analysis crosses once per load;
normal frames carry small control records. Playback PCM is never transferred.

One request may be in flight. The host presents a retained bitmap; old-generation bitmaps are
closed after seek/load/resize. Unchanged paused input does not request another frame. Failure,
timeout or messageerror terminates the worker and falls back to Compatible; cycling the renderer
allows retry. WebGL initialization failure inside the worker uses its Canvas2D backend. The
main-thread GPU surface is released when Offscreen takes over.

Preview is capped at 30 Hz / 960 backing pixels on the long edge, Reduced at 640. The final p5
canvas still follows the existing preview-size policy. This is a softer preview, not full-resolution
pixel parity. PostFX and UI remain on the main thread. Export bypasses asynchronous bitmaps,
retains its full-resolution synchronous Compatible renderer and releases the worker; T19 remains
unimplemented. Renderer removal/mode exit terminate the worker. Menu choice is saved in
localStorage and Copy preview settings. Fresh MVP defaults to Offscreen; existing explicit choices
remain respected. Studio keeps its existing options and does not silently run an unavailable worker.

Desktop browser measurement uses the real `startPlexusRenderer` host/compositor, same raw controls,
1920×1080 logical size, moving song-time input, zero/active material (amount .65, detail .8), two
opposite-order rounds, eight warmups and twenty measured calls per variant per round. No build or
test suite ran concurrently. Each row has 40 main-thread redraw/submission samples; this includes
the final p5 copy but does not wait for GPU completion. Worker progress was checked (ten new frames
during the last twenty sampled calls in each worker case), rather than timing a frozen bitmap.

| Material | Preview | Compatible p50 / p95 ms | Main WebGL p50 / p95 ms | Offscreen p50 / p95 ms |
| --- | --- | --- | --- | --- |
| Off | Auto | 8.3 / 11.5 | 2.9 / 3.5 | 0.4 / 0.7 |
| Off | Reduced | 8.4 / 11.2 | 2.9 / 5.1 | 0.4 / 0.7 |
| Active | Auto | 13.7 / 16.8 | 7.2 / 8.7 | 0.3 / 0.6 |
| Active | Reduced | 11.1 / 15.2 | 5.3 / 6.4 | 0.3 / 0.6 |

Offscreen's last reported material frame cost was 9.1 ms Auto / 5.8 ms Reduced **inside the worker**;
work moved off-thread, it did not disappear. A settled pause caused zero identity/PostFX draws
over twenty redraw callbacks. Lightweight callbacks/tuning comparisons still run. These are desktop
main-thread measurements, not FPS, total energy or Quest guarantees. Preview resolution/cadence
also differ, so do not interpret the ratio as equal-quality GPU throughput.

The existing browser harness now includes this repeatable profiling button; no parallel benchmark
file family was created. At an uncapped 320×180 fixture, the resolved worker bitmap versus p5
reference has normalized mean absolute error .0002982, changed fraction .0000174, within the
existing .025/.08 gate. All visual/host/crossfade/export/context-loss gates passed. This small
fixture validates transport/drawing, not full-size preview sharpness or timing alignment on Quest.

## Validation and release

Current local evidence is ignored under `logs/review/`: performance/visual JSON, screenshots,
build output and TAP. Historical reports retain their original identities and limitations.
The repository's `.gitattributes` already preserves exact archived source/test bytes across
checkout. No rejected T10 experiments, generated audio, model binaries, environments or logs are
added to Git. Two user reference images are intentional versioned design inputs.
The bulk diff-export script was considered and skipped because it would duplicate all archived
source and decode binary reference images as text. Live git diff, staged diff, name inventories,
exact-byte retention checks and direct source reads were used for this review.

Full suite: **1770 tests / 1761 pass / nine exact retained baseline failures**, zero skips or cancellations, 304.733 s. Both failure names and assertion messages match the prior baseline, including projected-motion numbers; no new regression was observed. Targeted worker/lifecycle/renderer regressions: **41/41**. Release guards: **4/4** (also run by the full suite). Production TypeScript/Vite build and whitespace checks pass; the existing chunk-size notice is informational. All 17 browser visual/host/export/context-loss gates pass. Real Scienide MVP load, Offscreen selection, play, pause and paused seek passed without warnings/errors. Menu storage/Copy payload/reload are covered by UI tests; the browser command probe confirms the selected Offscreen JSON and accepted copy command. Physical clipboard readback through the in-app browser is not used as evidence. The audio is cleared after smoke testing.

Commands: `npm run build`; `npm test -- --test-reporter=tap`; `git diff --check`;
`node --test tests/wormhole-host-worker.test.mjs tests/paused-renderer.test.mjs tests/wormhole-raster-pass.test.mjs tests/xr-native-wormhole.test.mjs tests/wormhole-exact-frame.test.mjs`;
`node --test tests/release-pages.test.mjs`.
Node 25.2.1/npm 11.6.2 are used. Git/temp fixtures require execution outside the restricted sandbox;
the initial sandbox-only Git config denial is environmental and the same tests pass with those
permissions. Bun and Python pytest are unavailable; no Python inference code changed, no Python
suite ran, no golden snapshots were regenerated. Physical Quest comfort/frame pacing remains manual.

Source is committed in subsystem sections and pushed to `codex/xr-development-baseline`; no
master merge or force push is part of this handoff. Release uses
`node scripts/release-pages.mjs prepare review-mvp-worker`, then `publish` and `verify`.
The public [release marker](https://philofobreal.github.io/plexus-engine/release.json) identifies
the deployed source HEAD and artifact. Local `logs/pages-release/verification.json` and final
handoff record the concrete Pages commit; historical task release records are not rewritten.

## Manual handoff and exact resume point

Expect a lighter MVP main thread and a softer 30 Hz background preview in Offscreen mode.
Try material-heavy presets, macro/material controls, play/pause/resume, forward/backward seek,
file replacement, renderer/quality changes and preference reload/Copy. Check an export at its
chosen resolution. In XR, verify Off stays Off through background failure or scene exit and the
existing chart/cockpit remains familiar. Do not expect new note meanings or detector accuracy.

**T11a delivered; T11 partial; T12 not started.** Next product work is the actual evidence-backed
onset/offset/sustain/dominance producer, with task-local evidence/acceptance clarification. Tonal/
vocal recognition remains unsupported, dominance unknown. Wall stays Off/Galaxies 0 by default;
further Wall development remains deferred. Pause for the user's manual test after deployment.
