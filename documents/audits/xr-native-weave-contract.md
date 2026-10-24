# T06b: native connections and stage priority

Integration owner: this chat; affected owners: shared types/visuals, XR GPU presentation,
existing player setting hints and documentation. User accepted T06a, then reported missing
material and foreground dots. No audio, analyzer, worker protocol or judging changes.

## Spatial extension

The native v1 packet gains optional `weave: {count, data}` with the same 16-float metre segment
layout, a separate fixed capacity of 4320 and borrowed lifetime identical to its parent. Missing
weave is a valid predecessor packet and clears connections. Stable segment IDs are `poolId*3 +
part`: arm halves 0/1, ring chord 2. No raster pixel coordinates become spatial coordinates.

CosmicWormholeIdentity owns the original neighbours: next depth layer in the same band and
next band in the same layer/copy. Original visibility, central projection length gate, depth gate,
dimmer-end alpha and colour averaging remain. Spatial heads/tails are captured before perspective
division. Arm Hermite arcs use original 3D travel tangents, with two fixed segments; ring links
are chords. Weave and Nebula Amount remain preset-owned through the existing menu boost,
localStorage and Copy settings. Amount zero/performance mode bypasses connections. No new toggle.

Source memory: old 90 KiB grain packet plus 270 KiB connection packet and ~40 KiB identity scratch.
Consumer adds fixed attributes for 4320 connections (~186 KiB). At most two draws per eye,
11520 triangles at maximum quality (1440 grains + 4320 segments, two triangles each), zero textures,
no background canvas/OffscreenCanvas/worker/render target. Quality gives connections at most three
times the grain budget. Whole segments over 3 m, beyond cutoff/near plane, or intersecting the
2.52 m protected corridor within 12 m depth are rejected. Unsafe links are never shortened into
floating connectors. Live preview keeps the existing transient brightness history; this does not
extend T05c exact replay into a native exact sampler.

## Stage priority fix

Transparent sorting previously drew native dots after the translucent runway; true depth alone
cannot protect a runway that intentionally does not write depth. Both native batches now use the
opaque queue with explicit source-alpha blending, negative group/object order and depth writes off.
Opaque notes and all transparent stage surfaces draw afterward. This retains actual per-eye 3D
projection and alpha edges while making the Wormhole a presentation background. No additional
scene pass, depth clear or texture is required. GPU probes must cover both an opaque and a
transparent stage surface physically behind a deliberately overlapping grain/connection.

## Remaining scheduled T06 work

- **T06c next:** native grain material/filament appearance and preset-controlled Nebula Amount,
  Detail and Bloom/halo/haze representation, with bounded fill and eye-specific cost. T06b only
  adds connective strands; it does not claim the complete material effect is present.
- **T06d:** native starfield, galaxies, skybox and deep-field representation from the existing seeds.
- **T06e:** wall/membrane/cracks/caustics/mosaic representation and geometry budgets.
- **T06f:** lens/refraction/ring tint/vignette representation, stereo/near-clip/cockpit and physical
  Quest cost/comfort acceptance across the complete inventory. Alternate image passes require an
  explicit rationale/acceptance; they cannot silently restore an offscreen canvas in native mode.

These are tracked slices, each ending with deploy and manual feedback. Hybrid stays default.
