# Preview, Idle Rendering And Export Validation

Evidence collected 2026-09-21; reorganized by subsystem 2026-09-22.
Current contract: [playback performance](../features/playback-performance.md).
Owners: application composition/config for quality selection, renderer for live/transition
surfaces and idle invalidation, export backend for explicit output sampling.

## Quality budgets and first-frame density

Synthetic real-p5/identity fixtures exercised both host sizing policies. The startup
breakpoint is 1024 CSS pixels; Reduced load can select compact budgets on any desktop.
At 390x220, total L0/L1/L2 material pixels decreased as follows:

| Detail | Desktop budget | Compact budget | Reduction |
| --- | ---: | ---: | ---: |
| 0 | 65260 | 36510 | 44.1% |
| 0.5 | 105561 | 50520 | 52.1% |
| 1 | 145770 | 65260 | 55.2% |

Eight frames at three detail settings and partial/full material rendered successfully.
Compact material was softer/brighter; RGB sums increased about 5% at amount 0.35 and 19%
at amount 1 in that fixture. This is not a perceptual metric or measured FPS gain. Cold
timings were mixed. A failed screenshot attempt was replaced by direct fixture PNG inspection.

p5 initializes a main renderer's device density during createCanvas, so caps are applied
after creation. At actual DPR 1.5 the first displayed frame and transition targets were:

| Host policy | CSS size | Backing size | Density |
| --- | ---: | ---: | ---: |
| Main window | 1280x720 | 1920x1080 | 1.5 |
| Compact container | 390x220 | 487x275 | 1.25 |
| Large container | 2560x1440 | 1920x1080 | 0.75 |

All were nonblank on the first frame. This does not eliminate p5's temporary allocation
inside createCanvas. Initial tests corrected an incomplete p5 mock and an unsupported
TypeScript constructor parameter property; the completed density suite passed 8 tests,
and its combined regression run passed 127. Compact-budget validation covered 92 distinct
tests. These historical counts overlap and are not a cumulative test total.

## Live preference and export isolation

At CSS 1920x1080, Automatic produced a 1920x1080 canvas; Reduced load produced 1280x720
at density 2/3. Switching back restored it without reload. Reload persisted the choice.
The real MVP analyzed an eight-second generated WAV; playback, the Advanced tuning
selector, fullscreen and returning from fullscreen were exercised. The control remained
inside the fullscreen subtree. Dashboard control placement was also checked.

Two real three-frame, 30 FPS WebM exports from Reduced load used explicit density 1 and
1920x1080 output: direct rendering produced 43027 bytes; an active classic-to-wormhole
transition produced 49229 bytes. Both transition targets followed export dimensions/density
on all frames. The compositor restores its transform after backing-pixel composition.
Preview policy does not imply lower export sampling. Old supersampled exports need not
match the explicit-density output pixel for pixel.

The integrated quality/export checks and corrected geometry mock covered 121 distinct
tests. The geometry mock explicitly declines raster acquisition, retaining vector fallback;
material integration tests cover the accepted-raster path.

## Settled pause

Before idle gating, a loaded paused fixture drew the entire scene 30 times and updated the
dashboard 7-8 times per second. After the fade settled, both counts were zero across
thousands of p5 callbacks. Shape, quality, seek and resize refreshed the frame, then settled
again. Playback resumed normally; explicit export redraw bypassed idle gating.

A second fixture used the real MVP UI, AudioEngine and renderer with an eight-second WAV.
At song time 5.51 seconds after transport pause it reported playing=false, fade=0,
draws=0 and UI updates=0, with the retained frame stable on a later check. The dedicated
pause regression run covered 104 distinct tests, including hundreds of idle callbacks,
mutable tuning/boosts, same-position seek, resume and five export-mode frames.

p5's lightweight callback continues. These counts demonstrate removed application drawing,
not 0% whole-system GPU usage; compositor/other applications still use the GPU and allocated
canvas memory remains available for reuse.

## Reproduction and limits

Node was available, npm was not; local package entrypoints supplied the declared test/build
operations without dependency installation. Relevant successful commands from validation:

```text
node --test tests/preview-quality.test.mjs tests/renderer-preview-density.test.mjs tests/material-preview-budget.test.mjs tests/export-deterministic.test.mjs tests/export-capability.test.mjs tests/visual-mode-transition.test.mjs tests/contracts.test.mjs tests/wormhole-grain-material-integration.test.mjs tests/styles-deterministic.test.mjs
node --test tests/wormhole-depth-integrity.test.mjs tests/wormhole-lifecycle.test.mjs
node --test tests/paused-renderer.test.mjs tests/renderer-preview-density.test.mjs tests/morphing.test.mjs tests/export-deterministic.test.mjs tests/contracts.test.mjs tests/styles-deterministic.test.mjs tests/visual-mode-transition.test.mjs
node --test tests/postfx-fragmentation.test.mjs tests/wormhole-lifecycle.test.mjs tests/ui-interaction.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git diff --check
```

Type checking/build/whitespace and local documentation links passed; the existing Vite
large-chunk warning remains. Browser smoke was actual in-app automation, with synthetic
fixtures distinguished above from real UI/audio and encoded-export checks. Temporary
fixtures/tabs were removed. Real-phone FPS, long exports, 4K encoding and the entire test
repository were not validated by these runs. No commits/deployment; scoped diffs sufficed.
