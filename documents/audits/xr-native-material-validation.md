# T06c: native filament material, halo and haze

User accepted T06b and requested the missing material. Delivered carrier-local seeded fibre/filament,
continuous core/local halo, depth extinction/throat damping, colour perspective and two analytic
emission lobes for wider bloom/haze. The existing preset Amount/Detail/Bloom and player menu boosts
drive it, with unchanged localStorage and Copy settings. Zero Amount selects the exact old line
shader branch. This is a spatial material analogue, not raster gather/blur pixel parity or an
independent global volume. No source simulation is duplicated in Three.

Native v1 gains optional aligned phase/energy/raw-alpha metadata (67.5 KiB, fixed buffers); old
coordinates/stride/reserved offset stay intact. Missing metadata is a valid predecessor packet.
Two bounded batches remain: <=11520 triangles/eye, zero textures/render targets/background
canvases/OffscreenCanvas/workers. Support <=0.6 m and capped to 12/14/16/18 pixels per eye according
to existing quality (material-active branch). Real eye viewport/projection controls the cap.
Clearance includes the full halo support; T06b's background queue stays behind opaque notes and
the transparent runway/HUD. Hybrid remains default. [Design/budgets/remaining inventory](xr-native-material-contract.md).

Validation, Node v25.2.1 / npm 11.6.2:

- `npm run build`: TypeScript/Vite pass; established chunk-size warning only. Initial new shader
  used a constructor parameter property incompatible with erasableSyntaxOnly; corrected to an
  explicit field before the final build. Initial log retained.
- `node --test --test-reporter=tap tests/xr-native-material.test.mjs tests/xr-native-weave.test.mjs tests/xr-native-wormhole.test.mjs tests/gameplay-purity.test.mjs tests/xr-settings.test.mjs tests/xr-background-settings.test.mjs tests/xr-menu.test.mjs tests/xr-wormhole.test.mjs tests/xr-wormhole-continuity.test.mjs tests/wormhole-route-geometry.test.mjs tests/wormhole-frame-context.test.mjs tests/xr-controller-regeneration.test.mjs tests/wormhole-determinism.test.mjs tests/wormhole-exact-frame.test.mjs tests/visual-mode-transition.test.mjs tests/wormhole-depth-integrity.test.mjs tests/wormhole-lifecycle.test.mjs tests/contracts.test.mjs tests/styles-deterministic.test.mjs`: **271/271 pass**.
- `npm test -- --test-reporter=tap`: **1672 cases, 1663 pass, 9 exact T06b baseline names/messages**,
  zero skipped/cancelled. All 178 previous active test files byte-identical, plus five new cases in
  file 179. Five predecessor implementation archives retained; XR loader and accepted analyzer
  source evolution unchanged. No historical measurement or fixture rewritten.
- `git diff --check`: pass (existing CRLF advisories). `diff_export.ps1` skipped: scoped review,
  retained sources, cumulative identities and complete build-input manifest used instead.
- `node scripts/audit-native-material.mjs`: exact failure/retention and browser gates pass.
  [Machine evidence](xr-native-material-validation-data.json) includes exact commands and hashes.

Real WebGL probe: Amount-zero vs predecessor **0 pixel difference**; full vs zero differs in 416
pixels, partial vs full 379, Detail 394, Bloom 417. Wider bloom raises lit support 52 to 321 pixels
in the single-carrier fixture; empty geometry emits zero. Real overdrive fixture: 6922 coloured
pixels, 1357 grains + 2830 connection instances, **2 draws / 8374 triangles / 0 textures**. Near/far
stereo disparity ~2.03/0.56 pixels; near cull and all four opaque/transparent stage priority cases
pass. One source sample 5.1 ms is not a GPU/headset benchmark. No browser warnings/errors.

Local XR loaded the retained 28 s /128 BPM WAV, generated the same 42 notes/41 arrows/3 pairs,
played to Results (42 misses expected without input), changed Bloom 100->90->100 and restored
Hybrid with full starfield. Public release/asset/UI checks are recorded in
[deployment evidence](xr-native-material-deployment-data.json). OS clipboard paste and physical
Quest stereo/GPU/comfort testing remain manual. Existing Copy serializer/storage checks pass.
An initial new test compared objects across VM prototypes; corrected to compare their JSON value.
No predecessor assertion changed.

## Quest stutter follow-up

User reports native-mode main-thread stutter. Technical inspection confirms private context/route/
grain/weave evaluation is synchronous on the main thread; quality caps only the consumer. The
canvas worker does not serve native packets. The new retained 32-sample desktop profile, after
eight warmup samples and after cumulative tests completed, measured source CPU **2.1 ms p50 /3.0
ms p95**, copy **0.4/0.6 ms**, material command submission **0.2/0.3 ms**. This is a small desktop
fixture: submission time excludes asynchronous GPU execution, and paired submissions have a fixed
order. It neither reproduces Quest pacing nor proves a single cause. Raw samples and the runnable
`tests/browser/native-material-profile.html` are retained in the machine evidence.

**T06c2 takes priority next:** investigate/profile and isolate native geometry in a canvas-free
worker with bounded transferable ownership, stale generations/serials, latest-time coalescing and
fallback. No stutter fix or headset speedup is claimed in T06c. T06d stars/galaxies/skybox, T06e wall
and T06f optics/full Quest acceptance remain scheduled after it.

Publisher fallback: installed `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll` with
the T06c commit message, because the package deploy script invokes Bun. No dependency/lockfile or
package-script changes, source push, merge or force push. Manual gate: test native material Amount,
Detail/Bloom and stage visibility, saved/copied settings, Hybrid restoration, and report headset
pacing. Stop before T06c2 until feedback.
