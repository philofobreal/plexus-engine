# T06a native grains/trails spike: inventory and contract

Integration owner: this chat. Owners: shared visuals/types producer, XR scene/GPU consumer and
XR player settings. User accepted T05c and authorized T06. This is the first partial spike,
not the complete native Wormhole. Native mode stays opt-in until physical Quest measurements.

## Inventory before implementation

| Existing family | T06a representation | Cost / remaining gate |
| --- | --- | --- |
| Grains and trails | Actual preprojection head/tail positions from CosmicWormholeIdentity; one instanced ribbon mesh, bounded 1440 grains | <= 2880 triangles per eye; one draw per eye; shared private simulation CPU cost measured separately |
| Coherent spiral / arm density | Existing signed flow geometry and arm brightness, same seeds, releases and tuning | Included in grain evaluation; no second tunnel model |
| Weave connections / filament material | Not migrated in this spike | Future spatial links and material law; do not silently retain a raster pass |
| Wall / membrane / cracks / caustics / mosaic | Not migrated in this spike | Future spatial shells/curves or explicitly accepted image pass, with per-eye overdraw budget |
| Nebula / haze / bloom | Grain brightness only; volume and raster halo absent | Future bounded volume/material representation; measure fill per eye |
| Starfield / galaxies / skybox / deep field | Not migrated in this spike | Future depth shells or justified far image pass, bounded instances and cost |
| Lens / refraction / ring tint / vignette | Not migrated in this spike | Future eye-specific optic representation; must measure stereo consistency and cost |
| Existing decorative XR spatial particles/wisps | Hidden in native-grains mode to avoid a second tunnel | Retained unchanged when returning to Hybrid |

`Hybrid` keeps the existing complete raster background and optional decorative spatial field.
`Native grains (experimental)` deliberately shows grains/trails alone, with no background canvas,
OffscreenCanvas, bitmap texture or raster worker. It is not labelled complete native3d.

## Plain-data spatial schema v1

This is separate from GrainLineFrame/GrainMaterialFrame (raster pixels) and WormholeSpatialFrame
(aggregate character). Fixed capacity 1440, stride 16 Float32 values, one reused 90 KiB buffer:
stable pool id; head xyz; tail xyz; radius metres; normalized sRGB rgb; opacity; absolute release
generation; deterministic seed; normalized depth; reserved zero. IDs are stable across frames;
release generation changes on the existing identity's release law. No renderer-owned simulation.

Positions are sampled by the shared route projection helper BEFORE perspective division, not
reconstructed from pixel endpoints. The frame uses eye-line origin under the stage root, +x right,
+y up, forward -z, with 0.05 metres per identity world unit. XR places that root at the sampled
eye height/recenter pose; it does not follow head rotation. The source flips the identity's y-down
and z-forward signs once. The consumer uses the actual per-eye view/projection matrices.
The identity's existing horizontal/vertical route, depth/release, signed flow and transition math
remain the sole producer. Native widths are derived from the resolved stroke at its actual depth,
bounded in metres; trail lengths and near/gameplay clearance are bounded by the XR consumer.

Frame metadata: schema version, preparation generation, monotonically increasing accepted-frame
serial and exact songTime used for that sample. The main-thread source lends its buffer until the
next accepted render/prepare/dispose. XR copies active records synchronously to fixed GPU attributes;
no transferable lease or worker queue is needed. Stale preparation results cannot publish assets.
The raster v1/v2 worker protocols remain unchanged. A native source never creates a canvas.

Presentation mode is a device/XR renderer choice, persisted and copied with player settings.
Presets keep owning artistic grain geometry, signed twist, colours, depth, density and movement.
Mode is not injected into presets: per-preset renderer rebuilds would change hardware policy and
would not apply to the Studio/MVP hosts. No new artistic constant becomes an undisclosed toggle.
Hybrid remains the normalized legacy default. Missing/failed native factory falls back to Hybrid;
the actual presentation/fallback is exposed in the diagnostics label. Switching back disposes
native buffers/material and restores the retained hybrid settings. Quality budgets, distance and
sharpness have documented native meanings; raster-only material/lens families remain unsupported.

## Acceptance gates

Prove no canvas/OffscreenCanvas/Worker allocation in the native source; actual identity-derived
geometry, bounded stable buffers/IDs and same signed preset controls; menu/localStorage/Copy;
legacy normalization and Hybrid restoration; disposal/superseded preparation/fallback; true left/right
eye parallax, opaque occlusion and near clip in a real Three/WebGL browser harness. Record draw
calls, triangle count and CPU sample costs. Physical Quest timing, comfort, cockpit clearance and
GPU timer measurements remain manual; desktop stereo probes cannot promote a headset default.
