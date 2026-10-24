# T06b: native weave and stage priority

The user accepted T06a, requested the next task, then clarified that the full material must remain
scheduled and native dots must go behind the runway/notes. This slice adds original-neighbour
spatial connections and fixes background sorting. Full filament/halo/haze material is **T06c next**;
the remaining stars, wall and optics have explicit T06d-f slices in the [contract](xr-native-weave-contract.md).
Hybrid remains the default. No new artistic/player switch, dependency, worker schema or audio change.

Existing preset Nebula Weave and Amount drive the native connections through the existing Material
menu boosts, localStorage and Copy. True preprojection heads/tails produce spatial arm arcs and
ring chords. Fixed buffers, original pool topology and safe whole-link rejection prevent growth and
cross-corridor streaks. Legacy v1 packets without the additive weave extension remain valid.

Both native batches use source-alpha blending in the background opaque queue, before opaque notes
and the transparent runway. They still use actual eye projection and depth tests, with depth writes
off. No offscreen background canvas, raster worker, texture, depth reset or extra scene pass.

Validation commands (Node v25.2.1, npm 11.6.2):

- `npm run build`: TypeScript + Vite pass; only the established chunk-size warning.
- `node --test --test-reporter=tap tests/xr-native-weave.test.mjs tests/xr-native-wormhole.test.mjs tests/gameplay-purity.test.mjs tests/xr-settings.test.mjs tests/xr-background-settings.test.mjs tests/xr-menu.test.mjs tests/xr-wormhole.test.mjs tests/xr-wormhole-continuity.test.mjs tests/wormhole-route-geometry.test.mjs tests/wormhole-frame-context.test.mjs tests/xr-controller-regeneration.test.mjs tests/wormhole-determinism.test.mjs tests/wormhole-exact-frame.test.mjs tests/visual-mode-transition.test.mjs tests/wormhole-depth-integrity.test.mjs tests/wormhole-lifecycle.test.mjs tests/contracts.test.mjs tests/styles-deterministic.test.mjs`: **266/266 pass**.
- `npm test -- --test-reporter=tap`: **1667 tests, 1658 pass, 9 exact T06a baseline failures**,
  no skipped/cancelled. All 177 previous test files byte-identical; one new file, four cases.
- `git diff --check`: pass (existing CRLF advisories). `diff_export.ps1` skipped in favour of scoped
  review, five retained source predecessors, test identities and complete deployment input hashes.
- `node scripts/audit-native-weave.mjs`: exact baseline name/message, predecessor/hash, browser and
  capacity gates pass; [machine results](xr-native-weave-validation-data.json).

Real WebGL probe: grain and connection near/far eye disparity **2.029/1 px**, opaque and transparent
stage priority all four cases pass (red sum 3101 to 0), near cull pass. Real overdrive fixture:
1358 grain carriers / 1357 drawn; 2940 connection segments / 2830 drawn; **2 draws, 8374 triangles,
0 textures**, one 5.6 ms source CPU sample. This is desktop evidence, not a Quest timing benchmark.
Ceiling is two draws / 11520 triangles per eye, bounded by selected quality and spatial rejection.

Local XR loaded the retained 28 s WAV (128 BPM, 42 notes, 41 arrows, 3 pairs), selected native,
played/paused and displayed the no-canvas/worker diagnostic. Material tab retained Weave 100.
Hybrid preference restored. No console warnings/errors in the probe or local UI.

Initial new tests overclaimed byte-identical live brightness across different context histories.
Their failed log is retained; corrected checks cover identical geometry/IDs after seek, not the
separate exact sampler's brightness contract. No predecessor test, fixture or measurement changed.

Deployment uses the installed Node `gh-pages` entrypoint because the package's deploy script invokes
Bun. No script/lockfile/runtime migration. [Publication evidence](xr-native-weave-deployment-data.json)
records the exact Pages commit, parent, release, public byte checks and UI smoke.

Manual checks: System > Wormhole mode > Native grains (experimental); confirm dots/strands stay
behind the runway and notes, Material weave changes connections, zero weave removes only those
connections, and Hybrid restores the complete prior look. Check headset comfort/performance and
saved/copied settings. Physical Quest and OS clipboard paste remain manual. Stop for feedback;
T06c does not start in this delivery.
