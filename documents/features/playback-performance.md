# Playback performance and wormhole grain appearance

Current implementation: 2026-09-22. Applies to both `/plexus-engine/` and
`/plexus-engine/mvp/`, which share `PlexusRenderer` and the Cosmic Wormhole identity.
This document describes the current preview, export and material rendering contracts.

## User controls

**Preview quality** is available in MVP **Advanced tuning** (also in fullscreen) and at
the top of the dashboard **Tuning** panel. **Automatic** uses the startup viewport policy;
**Reduced load** selects the compact canvas and material budgets even on desktop. Changes
apply on the next rendered frame without reloading, losing the loaded track or changing
artistic tuning. The same-origin browser preference is saved as `plexus.previewQuality`,
independently of per-track Save/Reset and presets. Other already-open pages read it on their
next reload. If storage is unavailable, the control still works for the current session.
This preview choice is separate from the existing artistic `performanceMode` vector bypass.

In MVP, open **Advanced tuning**, then **Lines**, and choose **Grain line ends**:
**Rounded** is the default; **Square** gives foreground grain strokes square ends.
Increasing **Line stroke** makes those segments thicker and the square shape more visible.
This is a vector line-cap choice, not a full-screen mosaic or pixelation filter.
Nebula material and bloom keep their soft appearance. At Nebula amount 1, the foreground
vector lines are completely replaced by material, so their cap choice is not visible.
The dashboard exposes the same choice in its Lines tuning group.

MVP saves this selector as an absolute choice in the existing per-track Advanced tuning
payload. Reset restores Rounded; old saves without the key use Rounded. Continuous
Advanced tuning sliders still multiply the underlying tuning. `wormholeGrainShape` is
0 for Rounded and 1 for Square, belongs to the wormhole identity, and snaps immediately
during tuning morphs, including while paused. Preview and export use the same line command.

Visual character and Advanced tuning can change rendering cost substantially. More
visible carriers, thicker/longer strokes, material coverage and bloom increase drawing
or raster work. The optimizations below reduce particular costs; they do not make all
settings equally cheap or guarantee a frame rate on every device.

## Rendering contracts

### Material activation

Exponential tuning interpolation previously approached zero without reaching it, keeping
the material path active. `applyTuningMorph` now snaps `wormholeNebulaAmount` to exact zero
when its target is exactly zero, a positive morph step is being taken, and the next
absolute value is at most `1e-4`. Positive authored targets, frozen clocks and unrelated
tuning values are unaffected. At zero the identity bypasses material acquisition,
accumulation and resolve; raising the amount reactivates the material normally.

### Material resolution tiers

Only the raster pixel budget quantizes detail to `0, 0.25, 0.5, 0.75, 1` (nearest tier).
Shading continues to receive continuous detail. A fixed-aspect detail sweep now has at
most five sizes, so it no longer reallocates buffers for almost every interpolation step.
Existing renderer-owned surfaces are reused when dimensions match. Viewport/aspect changes
can still require resizing. Selection has no hysteresis, frame-time feedback or render
history, preserving seek and export determinism.

### Grain appearance and scanline coverage

The material rasterizer intersects each row with an enclosing strip of the grain capsule
before testing candidates. It keeps the original capsule acceptance test, shading
arithmetic and accumulation order; it does not skip alternating rows or interpolate
missing image content. Near-horizontal and extreme-coordinate cases use exhaustive bounds.
The Square selector is a separate appearance choice; it is not the source of this saving.
Line-cap state is restored after each backend command, including on failure.

Across 720 regression cases, optimized float buffers match exhaustive coverage byte for
byte. One long diagonal case examines 985 candidates instead of 6241 (84% fewer). This is
a work-count result, not a measured application FPS improvement. See
[material validation](../audits/wormhole-material-performance-validation.md).

### Preview quality policy

Both entrypoints capture `(min-width: 1024px)` at startup for **Automatic**. A narrower
viewport selects the compact policy; fullscreen, rotation and canvas resizing do not
reclassify it. **Reduced load** can explicitly select the compact policy at any time,
including on desktop. This is viewport classification plus a user preference, not device detection.
The host passes `compactMaterialPreview` through the direct backend and both transition
backends; the pure raster module never queries the browser or frame rate.

| Material L0 budget at 16:9 | Detail 0 | Detail 1 |
| --- | ---: | ---: |
| Desktop preview | 320 x 180 | 480 x 270 |
| Compact preview | 240 x 135 | 320 x 180 |
| Export, either host | 480 x 270 | 640 x 360 |

Intermediate tiers interpolate the pixel budget, not the dimensions. Other aspect ratios
retain the viewport shape, subject to integer rounding and existing hard caps. L1/L2
derive from the resolved L0 material. Performance mode retains the vector bypass.

The 390x220 browser fixture used 44.1-55.2% fewer total L0/L1/L2 pixels. Compact material
was softer and brighter, especially at full material intensity; the user accepted this
appearance. Cold frame timings were mixed, so this is not a speedup or FPS claim. See
[preview and export validation](../audits/preview-rendering-validation.md).

### Canvas sizing and density

The installed p5 2 renderer initializes a new main canvas at device density during
`createCanvas()`, replacing an earlier `pixelDensity()` setting. Setup now creates the
canvas, then applies the shared size/density policy before the first draw, transition
target construction and export-host registration. This fixes startup for both surfaces;
the MVP no longer needs its observer/periodic size check to correct that initial state.

| Effective preview policy | Density cap | Backing-store long-edge cap |
| --- | ---: | ---: |
| Desktop | 2 | 1920 device pixels |
| Compact | 1.25 | 1280 device pixels |

The lower applicable cap wins, so a large CSS canvas can use density below 1. CSS size
and layout remain unchanged. `windowResized` on the dashboard and container observation
on MVP continue to apply the existing policy. The default renderer without cap options
keeps p5's default behavior. Transition graphics inherit the corrected initial density.
This does not avoid p5's transient allocation during `createCanvas`. Export and transition sampling also
handle subsequent target density changes and removes export's inherited-density dependency.
See [preview and export validation](../audits/preview-rendering-validation.md).

### Export sampling and transition surfaces

`WebCodecsBackend` explicitly sets its export graphics to density 1: one backing pixel
per requested output pixel. Thus 1080p landscape draws at 1920x1080 regardless of preview
density, browser DPR, startup viewport, or Reduced load selection. This removes both
preview undersampling and accidental device-dependent supersampling; it does not promise
pixel-identical output to the old oversampled exports. Encoded dimensions and material
export budgets remain unchanged.

The compositor's two persistent transition surfaces now follow the active destination's
density and dimensions on each active transition frame. They use export density during
export and return to preview density on a subsequent live transition. Unchanged frames
do not reset density or resize the surfaces. This also fixes density drift after preview
resizing or changing quality. Compositing uses an identity Canvas2D transform because its
coordinates are backing pixels; the destination's p5 density must not scale them twice.
The original transform is restored afterwards. Direct and transition backends read the same live compact
preference; the pure material code still makes stateless decisions from explicit inputs.

The renderer checks scalar policy values once per draw and only re-reads container size
when the quality caps actually change (in addition to its existing resize handling).
Automatic/Reduced load is reversible and retains the user's Square/Rounded choice.
See [preview and export validation](../audits/preview-rendering-validation.md) and
[offline export](offline-webm-export.md).

### Paused frame reuse

The shared renderer previously redrew the complete scene at 30 callbacks/second while
paused with a loaded track (15 on the empty screen). This kept material rasterization and
dashboard canvas drawing active even when song time and visible inputs were unchanged.

`PausedPreviewGate` now allows the existing pause fade to finish, then retains the settled
image. Unchanged idle callbacks return before identity drawing, material work, post FX,
analysis decay and dashboard redraw. A lightweight comparison still runs at the existing
callback cadence; this change does not stop p5's loop or take loop ownership from export.
The p5 frame counter can therefore advance even when no new scene pixels are drawn.

Current tuning, raw/boosted target values, quality, actual canvas changes, song position,
mode, analysis/plan references, feature flags and video-color inputs invalidate the snapshot.
Numeric values are compared because tuning and MVP boost objects are reused in place.
Explicit position/end notifications invalidate it too. Changed paused frames also update
the dashboard, regardless of the normal every-fourth-frame UI cadence. Playback, export
and the fade-out bypass the gate, so resume and every offline export frame render normally.
Song-time morph behavior remains unchanged. Future visible inputs must join the snapshot
or explicitly invalidate the gate.

The real p5 fixture changed from 30 scene draws and 7-8 dashboard updates per second to
zero repeated draws/updates while idle. This is application work-count evidence, not a
claim of zero total system GPU use: desktop composition and other applications share the
GPU. See [preview and export validation](../audits/preview-rendering-validation.md).

### Bloom smoothing

Nebula's medium and broad halos retain the same forward/reverse smoothing filter, pass
counts and coefficients. The implementation now processes adjacent RGBA values together
instead of traversing each row/column separately for every channel. It computes the pixel
address once per step and retains four independent double-precision recurrence values,
including the original Float32 reload at each reverse boundary. It adds no scratch buffers,
frame history, quality changes or settings.

Across 768 filter cases and 120 full material resolves, all Float32 output bytes matched
the frozen previous implementation. A browser comparison also found zero differing canvas
bytes across 30 synthetic carrier frames. The warmed Node microbenchmark measured roughly
58-66% less time for the two bloom smoothing operations together, saving about 0.27-2.12 ms
at the tested compact/desktop/export sizes. This is CPU filter timing, not total frame time
or an application FPS/GPU percentage claim. The shared implementation applies to both hosts
and export. See [material validation](../audits/wormhole-material-performance-validation.md).

### Offscreen material rejection

The rasterizer now checks each resolved segment against the viewport plus the existing
maximum material dilation of six raster pixels. When both endpoints lie beyond the same
expanded edge, the entire material capsule is outside the image and returns before depth
attenuation, kernel and noise setup. Crossing trails and any potentially visible halo keep
the original exact raster path. This applies to grain and weave carriers on both hosts and
in export, without changing geometry, presets, budgets, bloom or Square line ends.

The benefit depends on how many carriers are outside the viewport. A synthetic batch of
720 carriers with 75% fully outside measured about 4-9% less accumulation time; this is not
a full playback FPS claim. The noise arithmetic remains unchanged: alternative factoring
and caching experiments did not reliably improve the full kernel and were discarded.
See [material validation](../audits/wormhole-material-performance-validation.md).

### Raster pixel conversion

`CanvasFieldRasterSurface` converts each pixel's four float channels into its retained
ImageData in one loop step. The previous inner channel loop is unrolled, while each
channel retains the exact multiplication order, Bayer threshold and Uint8ClampedArray
rounding. All buffer ownership, uploads, compositing, quality budgets and reuse stay intact.

The isolated conversion benchmark measured about 9-11% less CPU time at the tested sizes.
All 360 byte comparisons and 30 browser composite frames matched the previous converter.
This improves pixel preparation on both hosts and export; it is not a measured GPU-upload
or total playback speedup. See [material validation](../audits/wormhole-material-performance-validation.md).

## MVP tuning projection

The MVP mapper accepts a reusable output and keeps its fixed macro-key list at module
initialization. MvpVisualController writes into its existing scratch tuning after copying
the current raw tuning, removing the fresh partial object and Object.keys array previously
created on each projection. Raw tuning, gain arithmetic, clamping and advanced-control
order are unchanged. The two-argument API still returns a fresh partial result.

The 1,000-case regression compares reused and fresh outputs while varying raw values and
macros, checking input immutability and retained unmapped fields. This removes two known
temporary allocations per invocation, not all render allocations, and does not establish
a measured FPS or garbage-collection-time improvement. See [MVP workspace](mvp-workspace.md)
and [integration validation](../audits/mvp-renderer-integration-audit.md).

## Testing the current result

1. Reload the desired surface. To test compact behavior on a desktop, make the viewport
   narrower than 1024 CSS pixels **before** reloading.
2. Load a track and replay the same section with the same settings. Compare normal and
   fullscreen playback, including a resize and return to the original size.
3. Select Square and vary Line stroke with Nebula amount below 1. Check that the square
   segments remain visible; Save/Reset should retain/restore the documented choice.
4. Fade Nebula amount to zero, then raise it. Sweep detail slowly; material must react
   without continually resizing its buffers inside one tier. Seek back and replay.
5. On desktop, toggle Preview quality between Automatic and Reduced load during playback.
   Export the same short section at 1080p in both modes; both files must remain 1920x1080.
6. Pause and allow a few seconds for the existing fade to settle. The unchanged image
   should no longer be redrawn. Check seek, grain ends, preview quality, resize and resume;
   each must still respond. When comparing GPU use, keep other active tabs/apps constant.
7. With Grain material and Material bloom above zero, replay a fixed section at the same
   settings. The halo softness, color and intensity should remain unchanged; compare both
   Automatic and Reduced load. Square/Rounded and the pause optimization remain in effect.
8. Watch the picture edges during flight, route bends and fullscreen changes with material
   enabled. Filaments and halos should enter/leave continuously, with the same appearance.

The targeted automated suites cover morph completion, tier selection, exact raster
equivalence, backend caps, MVP value mapping, compact/export separation and initial/resize
density and live quality changes. Validation notes distinguish synthetic fixtures from real playback. Real-phone
FPS and sustained playback remain device checks; no full WebGL rewrite, interlacing or
viewport-meta workaround has been implemented.

## Ownership and related documentation

Application entrypoints own preview policy; `PlexusRenderer` owns canvas sizing;
`P5RendererBackend` owns drawing state; the renderer-owned raster surface owns buffers;
`wormholeGrainMaterialRaster` owns pure carrier shading; configuration and MVP own the
selector contract and its UI. The integration owner coordinated these changes without
adding audio analysis, worker protocols or playback timing sources.

- [Visual tuning and playback UI](visual-tuning-presets-and-playback-ui.md)
- [Acceptance criteria, VT-11](../acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md#vt-11-playback-performance-and-grain-appearance)
- [Nebula architecture gate](../audits/wormhole-nebula-grain-material-architecture-gate.md)
