# T05b Studio/MVP shared Wormhole backend

Integration owner: this chat. Owners: visuals, composition, preview configuration/UI and docs.
Starting point: user accepted T05a. Preserve all existing uncommitted work and cumulative tests.

Decision before implementation: Studio/MVP keep their existing, already resolved host frame and
identity simulation. Their renderer remains the single owner of tuning/gains, semantics, event
cursors, modulation and director updates. Instantiating the embedded XR simulation beside it
would double that work and substitute different preview history. ADR-011 permits the existing
identity path; T05b shares the WebGL backend at the renderer presentation seam instead. XR keeps
its private `WormholeFrameContext` and its existing authored policy. No global State swap.

A renderer-owned raster pass draws only the existing Wormhole identity, then hands its completed
image to the existing p5 target. The same seam handles direct, crossfade and offscreen export
targets. The crossfade remains source-over; PostFX remains once after the final composite.
Logical/CSS geometry and backing density are separate. Video backgrounds request transparent
clears. Resize, unavailable WebGL and context loss must have bounded resource behavior.

Rollout remains opt-in as agreed in T01. The device-level renderer preference is in the existing
preview settings menu, saved in localStorage and included in Copy preview settings. It is not
an artistic preset parameter: a preset must not force GPU availability on another device. Default
is Compatible; WebGL is experimental pending the manual gate. Existing XR defaults are unchanged.

Predeclared browser A/B gates: same resolved numeric geometry/inputs, fixed song times and seed;
normalized RGBA mean absolute error <= 0.025 and changed-pixel fraction (>32/255 channel error)
<= 0.08 for the controlled raster fixture. Retain both images and measured failures. Exact edge
pixels are not expected between Canvas2D and analytic WebGL coverage. Test transparent/chroma,
video clear policy, high density, resize, fallback/context loss and final composition separately.
No encoded-video determinism or physical Quest performance claim; T05c/T19 own exact sampling
and isolated export. Do not regenerate historical goldens.

## Implementation and ownership

`WormholeRasterPass` is called by the renderer's one identity-draw callback. It never applies a
preset/gain, consumes an event, updates a director or creates another identity. The same existing
identity gets its same particle/shockwave arrays, draw context, canonical song time and frame count.
Only Wormhole uses WebGL; other identities retain p5. `IdentityTransitionController` keeps its
existing participant order and single shared-pool owner. The callback also resolves offscreen
export/crossfade targets before presentation, while PostFX stays after the whole draw branch.

WebGL logical width/height and physical backing size are separate; density-aware stroke coverage
preserves the subpixel law at DPR > 1. Viewport and destination-texture copies use backing pixels.
Compact material budgets follow the destination. Video backgrounds clear the GPU image to alpha
zero; chroma/transparent tuning remains authored by the identity. `presentRaster` clears and copies
in backing pixels with saved/restored context state. One lazy GPU surface is reused across size,
density and export changes. Disposing the renderer releases that surface, buffers, VAOs and programs.

Missing WebGL/shader initialization latches a compatibility fallback instead of retrying each
frame. Context loss invalidates an idle preview and falls back on the next accepted draw without
advancing the same frame twice. Cycle Compatible then WebGL to retry. The XR local source reports
one context-loss callback; without a callback (the worker) it throws into the existing typed failure
response. XR does not silently swap its texture canvas or add another per-frame image copy, and
its existing error/re-enable policy remains in charge. XR defaults and protocol-v1 buffer bounds
are unchanged. Full GPU/Quest promotion is not implied by these desktop checks.

The Preview quality panel now has a device preference, Wormhole renderer. Studio exposes it under
Tuning; MVP under Advanced tuning. `plexus.wormholeRenderer` stores Compatible/WebGL independently
of presets, artistic history and per-track saves. Missing/invalid values use Compatible. Copy
preview settings includes both quality and renderer. The copy action supports a synchronous
textarea command and the async Clipboard API fallback; it never saves audio or mutates dramaturgy.

## Evidence and cumulative retention

Exact commands and hashes are in [validation data](xr-shared-backend-validation-data.json).
Node v25.2.1 / npm 11.6.2 are the available runners. `npm run build` passes TypeScript and Vite;
the existing >500 kB chunk warnings remain informational. No dependency or lockfile changes.
The final targeted suite has 197 passing cases, including nine new raster/UI cases plus two
additional real-backend/source loss tests. `npm test -- --test-reporter=tap` is the full cumulative
gate; earlier active tests are retained. `git diff --check` checks tracked whitespace. No goldens,
protected analyzer bytes/results or the shared historical test loader were rewritten.

Two static seam assertions now require the renderer callback's exact call spelling while retaining
the single final PostFX seam. Their complete preceding sources and five preceding implementation
sources are retained with hashes checked against T05a deployment/test inventories in
`documents/tests/t05b-retention.json`. They are inert predecessor sources, not an alternative test
suite or a claim of a full historical renderer replay. New behavioral tests check one draw,
context forwarding, resource reuse/disposal, loss/failure retry bounds, the transition simulation
owner, live/export destination isolation, density/backdrop dimensions and menu persistence/copy.

The real browser harness runs p5 reference drawing versus shared WebGL with matched state at 3 s.
All paired PNGs are retained under `logs/t05b/images/`; numeric evidence is `browser-ab.json` and
`browser-loss.json`. Tolerances above were recorded before running this comparison and unchanged.

| Fixture | Normalized RGBA MAE | Pixels with channel error >32/255 |
| --- | ---: | ---: |
| Opaque | 0.00029817 | 0.001736% |
| DPR 2 | 0.00017865 | 0% |
| Transparent | 0.01463877 | 5.664931% |
| Chroma | 0.00022857 | 0.001736% |
| Video backplate | 0.01522871 | 7.840278% |

The transparent/video fixtures show measurable backend differences close to the declared changed-
pixel bound; they are retained, not treated as exact parity. The opt-in remains experimental.
Resize uses one surface and 400x225 logical / 500x281 backing pixels. Real direct, crossfade and
offscreen-export frames each execute exactly one PostFX/director/gain call; offscreen output is
640x360 and leaves live pixels unchanged. Forced `WEBGL_lose_context` gives one invalidation and
compatibility fallback. Browser console error logs are empty for these checks.

The retained XR Canvas2D/WebGL2/worker harness also passes at right/zero/left, with +0.8 turns,
zero within 1.3e-15 and -0.5499910301333368 turns and matching shown song time. Its console error
log is empty. This exercises the real offscreen worker against the density-1 backend defaults.

Actual MVP and Studio UI both select the WebGL path and load the retained 7 s / 128 BPM synthetic
WAV. Studio play/pause/repeated 35.7/10/35.7 percent seek succeeds. MVP's renderer selection survives
reload and is visible in its Advanced tuning menu. No real user file/session was used. The existing
Vite server is reused. The synthetic MVP workspace guard was handled before the dev-server reload.

Copy evidence: the browser's synchronous copy command returned true and its selected JSON contains
`version: 1`, `previewQuality: auto`, `wormholeRenderer: webgl` (`browser-copy-command.json`). The
automation clipboard reader/paste returned an older T04b test plan instead; that discrepancy is
retained as `mvp-clipboard-read-stale.json`, and the OS clipboard roundtrip remains a manual check.
This is not presented as verified native paste fidelity. The async and synchronous code branches
are both covered in the targeted suite.

## Release and manual gate

Use the existing GitHub Pages target. The available-runtime publisher is
`node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m 'Deploy T05b: shared Wormhole backend for Studio and MVP'`;
the repository's `deploy` script invokes Bun, so the installed Node entrypoint is used instead.
No source push/merge or force push. Prior release is T05a Pages tree
`ae3b0983a475da740d877fc217930699605ad436`; publish it in a new commit to roll back, or choose
Compatible in the menu immediately. `diff_export.ps1` is skipped: bounded source review, retained
predecessors and source-input manifests provide the handoff without a broad historical snapshot.

Expected result: choose WebGL (experimental) for shared batched Wormhole GPU drawing, with the
existing artistic presets/macros and transitions. Compatible retains the prior path. Compare both
on the same track, pause/seek, resize, switch identities, test transparent/chroma/video output and
an export. Check reload and Copy preview settings. Performance is not guaranteed by the current
desktop sample; no physical Quest, encoded-video parity, worker-v2 exact sampling or isolated
immutable export job is claimed. Pause for manual feedback before T05c.

Final cumulative result: 1646 cases, 1637 pass, nine failures whose names and full messages exactly
match T05a, no skips/cancellations. Discovery retains all 174 preceding active files among 175;
218 current test/helper/fixture/browser source identities are recorded. The first full run before
the additional copy-compatibility case also had only nine baseline failures (1636/1645 pass).

Release: `t05b-shared-backend-20261024T011714918Z`, Pages commit
`9b1ae0d8bd3e7691d0b74f66f860418611d658bf`, parent T05a
`ae3b0983a475da740d877fc217930699605ad436`. Pages is built; the public release marker,
all 16 HTML/asset byte hashes and four routes match. All 322 source inputs still match the
checkout. [Deployment data](xr-shared-backend-deployment-data.json) records these identities.

Fresh public MVP loaded the 7 s / 128 BPM synthetic track. Its initial renderer was Compatible;
selecting WebGL produced the actual `webgl` raster marker. Playback, pause and repeated Seek
357/100/357 of 1000 succeeded, ending paused. The public Copy button reported success; native
clipboard roundtrip retains the limitation above. Console errors are empty. The original Compatible
device preference was restored after the test. Public menu/image screenshots are retained in
`logs/t05b/deploy/`; the marked tab remains available for the user.
