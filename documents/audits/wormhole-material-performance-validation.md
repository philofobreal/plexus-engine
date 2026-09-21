# Wormhole Material Performance Validation

Evidence collected 2026-09-21; organized by material subsystem 2026-09-22.
Current contract: [playback performance](../features/playback-performance.md).
Geometry provenance: [accepted material architecture](wormhole-nebula-grain-material-architecture-gate.md).

## Carrier coverage and line appearance

The narrowed scanline strip preserved the exact capsule test and deposition order across
720 cases, including clipped, degenerate and near-horizontal segments. The long diagonal
case visited 985 candidates instead of 6241 (84% fewer). This is work-count evidence, not FPS.
The two regression groups passed 29 and 80 tests; the raster suite was rerun with 16 tests.

Real p5/backend/identity fixtures exercised Rounded/Square, line stroke and Reset through
the actual AdvancedTuningPanel. At equal 640x360 backing size, Square preview/export pixels
matched, and material before/after pixels matched. Material at amount 1 hides vector caps.
The user accepted the Square look; real-device speed was not measured by that fixture.

## Material activation and resolution

Morph tests cover exact zero when the authored Nebula target is zero, a positive morph
step is taken and the next amount is at most 1e-4. Integration tests verify zero raster/weave
work when off and reactivation in preview/export. Five stateless budgets avoid continual
resizes while continuous shading detail remains intact. Compact resolution has an accepted
softness/brightness tradeoff documented in [preview validation](preview-rendering-validation.md).

## Bloom smoothing

768 filter comparisons and 120 complete material resolves matched the frozen prior filter
byte for byte. They include single rows/columns, odd/portrait sizes, zero/constant/impulse/
varying inputs, clamped coefficients, pass counts and all preview/export tiers. Four
independent Number recurrences and Float32 reverse-boundary reloads preserve arithmetic.

| L0 defining the halo sizes | Former two-layer smoothing | RGBA traversal |
| --- | ---: | ---: |
| 240x135 | 0.462 ms | 0.195 ms |
| 480x270 | 1.856 ms | 0.637 ms |
| 640x360 | 3.245 ms | 1.122 ms |

The warmed Node benchmark used median batch means from nine alternating-order batches of
40 frames after three warmups; input restoration was outside timing. This isolates a
58-66% filter-time saving, not full-frame cost. Browser composites matched across 30
synthetic frames of 180 carriers, with 9,904,634 nonzero color samples and zero byte differences.

## Fully offscreen carriers

The six-raster-pixel conservative margin rejects only segments with both endpoints beyond
the same expanded edge. Against the frozen old accumulator, 200 edge cases and 720
cumulative deposits plus resolved buffers matched exactly. Four excluded directions made
zero attenuation-exponential calls; a segment crossing the image with both endpoints
outside still emitted pixels. Thirty browser frames of 360 moving carriers had zero
composite byte differences and 12,854,135 nonzero color samples.

| Raster | Former accumulation | Early rejection |
| --- | ---: | ---: |
| 240x135 | 1.637 ms | 1.572 ms |
| 480x270 | 2.722 ms | 2.484 ms |
| 640x360 | 3.300 ms | 3.119 ms |

This benchmark deliberately used 720 carriers, 75% offscreen, with nine alternating batches
of 12 frames after three warmups. It establishes a 4-9% saving for that workload, not a
real-track offscreen ratio or FPS improvement. Noise factoring/caching experiments were
discarded because they did not reliably improve the whole kernel; noise laws are unchanged.

## Pixel conversion

360 comparisons covered Bayer positions, odd/single-row/column and all tier sizes,
non-unit/negative/non-finite gains, half-code inputs and malformed source channels.
All ImageData bytes and upload/draw counts matched the frozen prior conversion loop.

| Raster | Former conversion | RGBA traversal |
| --- | ---: | ---: |
| 240x135 | 0.204 ms | 0.182 ms |
| 480x270 | 0.787 ms | 0.719 ms |
| 640x360 | 1.383 ms | 1.248 ms |

The benchmark used mock upload/draw calls, three warmups and nine alternating batches of
40 conversions. It measures 9-11% less CPU preparation time, excluding real uploads/GPU work.
Thirty actual-browser composites across three gains/blend modes had zero byte differences
and 8,797,327 nonzero color samples. Source multiplication order and byte rounding remain exact.

## Validation commands and scope

Geometry-only background/long-run/vertical-bend fixtures explicitly decline raster
acquisition and assert that no refused surface is drawn. The star-only long-run scene
also suppresses grain-copy repopulation while retaining all route/continuity thresholds.
This fixture policy does not replace actual material-output tests. See the
[local development review](local-development-review.md#repair-completed-in-this-review).

Historical integrated runs covering bloom, culling and conversion passed 91, 93 and 94 tests
respectively; these overlap and must not be summed. Node/local package entrypoints were
used because npm was unavailable. No packages were installed.

```powershell
node --test tests/raster-conversion.test.mjs tests/material-culling.test.mjs tests/bloom-smoothing.test.mjs tests/wormhole-grain-material-raster.test.mjs tests/wormhole-grain-material-integration.test.mjs tests/wormhole-nebula-raster-surface.test.mjs tests/styles-deterministic.test.mjs tests/contracts.test.mjs tests/paused-renderer.test.mjs tests/grain-line-caps.test.mjs tests/material-preview-budget.test.mjs
node --test tests/grain-line-caps.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/morphing.test.mjs tests/renderer-boundary.test.mjs
$env:PLEXUS_BLOOM_BENCH='1'; node --test tests/bloom-smoothing.test.mjs
$env:PLEXUS_CULLING_BENCH='1'; node --test tests/material-culling.test.mjs
$env:PLEXUS_CONVERSION_BENCH='1'; node --test tests/raster-conversion.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git diff --check
```

Benchmark switches were used in separate shell invocations; timings are not test thresholds.
Type checks, production builds, whitespace and local-link checks passed. The large-chunk
warning remains. Full in-app browser fixtures used real material/surface code and screenshot
inspection, with synthetic carriers rather than user tracks. They were removed afterwards.
No new encoded exports, sustained device FPS/GPU measurements or full-repository runs were
performed for these kernel changes. No commits/deployment. Scoped diffs were reviewed.
