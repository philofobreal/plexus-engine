# Wormhole Nebula Grain Material - corrected architecture gate

Status: **ACCEPTED AND IMPLEMENTED**
Date: 2026-08-19
Supersedes: `wormhole-nebula-material-plan.md` independent `(theta, log r)` background/lens field

Implementation result (2026-08-19): W1 was reverted, W2 was adapted to foreground carrier
semantics, W3 was replaced by `wormholeGrainMaterialRaster.ts`, W4 was retained as the generic
renderer-owned three-layer raster seam, and the incompatible W5 background integration was removed.

## 1. Corrected requirement

The Nebula is not an independent background field and does not own a second motion model. The
existing foreground wormhole grains are the sole geometry carriers. Their already-resolved head
and trail segments must become a continuous, filamented, foggy, multi-scale emissive material.

The material must inherit automatically, without reimplementation or approximation:

- grain depth phase and generation lifecycle;
- projected head and real previous-travel trail positions;
- per-grain angular flow and authored warp/curve;
- release-sampled radius/depth LFO geometry;
- depth coherence and temporary ring compression;
- horizontal and vertical route bend, smoothed route history, and camera-local projection;
- transition angular/radial deformation and material scales;
- trail reversal correction, near-plane culling, trail-length cap, and horizon fading;
- emission mode, release kick/LOW_DROP behavior, and per-band spectral material response.

No lens inverse is required or permitted for this carrier path. The gravitational lens remains a
background-layer concern. The grain material must not be forced into lens space.

## 2. Current foreground grain contract

### 2.1 Population and immutable identity

`CosmicWormholeIdentity` owns a constructor-allocated pool of 360 grains: 24 spectral bands times
15 depth layers. A `DustGrain` has a stable angular sector, normalized depth phase, band index,
seed, swarm/LOW_DROP cohort data, material character, and individual flow identity. No grain is
allocated during normal drawing.

`createWormholeGrainCharacter(seed)` in `WormholeGrainField.ts` authors deterministic fine-dust,
body-grain, and sparse-spark characters through `alphaScale`, `weightScale`, and `trailScale`, plus
independent `flowPhase`, `flowRate`, and `flowDirection`.

### 2.2 Release-snapshot geometry and material

At an absolute generation crossing, the identity snapshots kick, bass, density, band energy,
jitter, emission variant, and trail scale. `snapshotGrainGeometry()` snapshots the effective radius
and depth after their canonical-time LFOs, plus warp, curve, ring, and depth coherence. These values
stay fixed for that grain generation. Distance-domain envelopes decay kick, LOW_DROP, and ring
accents without frame-rate-dependent accumulation.

### 2.3 Authoritative projection sequence

For every visible grain, the existing draw loop performs this sequence once:

1. derive current and previous depth from immutable phase and canonical travel distance;
2. apply depth coherence and release-time ring compression;
3. compute grain-local current/previous angular flow;
4. apply grain-local transition angular/radius deformation;
5. sample horizontal and vertical integrated route history for head and trail;
6. project both endpoints through `projectWormholeTubePoint()` in the roll-free camera-local frame;
7. apply backward-trail correction and the projected trail-length cap;
8. resolve fade, emission, spectral/release alpha, and projected stroke weight;
9. issue the current `backend.line(tailX, tailY, headX, headY)` draw.

The values immediately before step 9 are the only accepted material carrier geometry. A material
module must consume those values directly. It must not read route state, tuning geometry, lens
state, depth phase, or analyzer data and must not project a grain again.

## 3. W1-W4 disposition

| Package | Decision | Corrected disposition |
|---|---|---|
| W1 - lens inverse | **REVERT** | Correct mathematics, wrong feature dependency. The foreground carrier already has final screen-space geometry; inverse lens mapping would create a second space and a second motion interpretation. Remove the new inverse exports/tests when implementation is authorized, unless a separately approved lens feature owns them. |
| W2 - tuning keys | **ADAPT** | Keep the three bounded/default-off keys and identity registry plumbing, but rewrite their contract: `Amount` crossfades legacy grain lines into grain-conditioned material, `Detail` controls carrier breakup/micro-detail/quality, and `Bloom` controls carrier-derived L1/L2 emission. Remove all lens-inverse/background-field wording. |
| W3 - pure background field | **REVERT** | Delete the standalone toroidal atlas, radial/geometry LUT, lens inverse sampling, spatial background palette, and their field tests. Replace the package with a pure grain-conditioned carrier raster module; do not adapt the old coordinate model. |
| W4 - renderer raster infrastructure | **KEEP** | The generic three-layer seam already provides lazy renderer-owned buffers, canvas/ImageData ownership, size caps, resize discipline, blend restoration, and an injectable canvas factory. Reuse it unchanged for the first implementation. Only its documentation and the caller's clear/accumulate/resolve usage change; the renderer remains unaware of wormholes or grains. |

The current tree also contains the old W5 background integration in `CosmicWormholeIdentity`
(`drawNebulaField` after the lensed deep field). It is incompatible with this gate and is
classified **REVERT/REPLACE**, but this gate does not perform that production edit.

## 4. Chosen architecture: grain-conditioned material raster

### 4.1 Single geometry handoff

Introduce a small, caller-owned scratch contract representing the already-resolved draw command:

```ts
interface ResolvedWormholeGrainCarrier {
    headX: number;
    headY: number;
    tailX: number;
    tailY: number;
    alpha: number;
    strokeWeight: number;
    colorR: number;
    colorG: number;
    colorB: number;
    seed: number;
    generation: number;
    materialPhase: number;
    energy: number;
}
```

The identity fills one reusable scratch object at the existing `backend.line()` call site, after
all projection and safety corrections. The legacy vector draw and the material accumulator consume
the same values. There is no segment list, no second grain loop, and no retained per-frame geometry.

`materialPhase` is derived from the grain's stable seed/generation and distance since release. It
may animate breakup along the carrier, but it must not move the carrier or introduce a second
screen-space flow.

### 4.2 Raster stages

The raster covers the viewport, not a lens-centered rectangle. Screen coordinates map directly to
the low-resolution carrier raster.

1. **Clear:** clear reused accumulation/output buffers at the start of an active material frame.
2. **Carrier splat:** for each accepted resolved grain segment, deposit a bounded anisotropic
   kernel along the exact tail-to-head line. Sampling count is based on raster-space segment length
   and hard-capped per grain. Offscreen samples are clipped.
3. **Filament breakup:** deterministic seed/generation/along-segment modulation fragments density
   inside the deposited support. It may thin, split, or brighten the carrier, but it cannot write
   outside a bounded dilation of that carrier.
4. **Micro-detail:** an independent high-frequency deterministic modulation affects only pixels
   where carrier density is nonzero. It is material variation, never geometry.
5. **Sharp resolve (L0):** accumulated color/emission/density is normalized and tone-mapped into the
   sharp emissive layer.
6. **Carrier-derived bloom (L1/L2):** threshold and downsample the resolved bright carrier into
   medium and large bloom buffers. L1/L2 never sample a separate field and never recompute grain
   geometry.
7. **Composite:** draw broad L2 haze, L1 bloom, then L0 sharp material after the wall stage, at the
   location currently occupied by the foreground grain render. The material therefore remains in
   front of the wall and behind no independent Nebula plate.

### 4.3 Amount and fallback semantics

- `wormholeNebulaAmount == 0`: exact legacy `backend.line()` path; zero raster acquisition, clear,
  accumulation, resolve, or blit.
- `0 < amount < 1`: crossfade the same resolved carrier between legacy vector coverage and raster
  material. No duplicate geometry is evaluated.
- `amount == 1`: raster material is primary; L0 preserves sharp filament structure while L1/L2 add
  only carrier-derived bloom.
- `performanceMode`: use the legacy vector path unless a separately measured reduced raster tier is
  approved. Performance mode must not remove the foreground grains.
- If the backend refuses a raster request, fall back to the legacy vector draw for that frame.

## 5. Ownership and dependency rules

| Responsibility | Owner | Forbidden |
|---|---|---|
| grain lifecycle, release snapshots, tuning reads, route sampling, projection, final carrier command | `CosmicWormholeIdentity` + existing `WormholeGrainField` helpers | second projection path, lens inverse, duplicated route/LFO logic |
| carrier splat, breakup, micro-detail, L0 resolve, L1/L2 derivation | new pure `wormholeGrainMaterialRaster.ts` | `State`, canvas, p5, route classes, lens modules, analyzer reads |
| buffers, ImageData, offscreen canvas, resize, conversion, blit | renderer-owned raster surface | grain semantics, tuning policy, procedural material decisions |
| tuning bounds/defaults/identity ownership | config and shared types | preset-specific hidden geometry or semantic deltas |

The pure material module receives only final carrier commands, raster dimensions, and bounded
material tuning. It cannot import `WormholeLensWarp`, `IntegratedWormholeRoute`, `State`, p5, DOM,
audio, analyzer, or UI modules.

## 6. Determinism and performance contract

- Every pixel is a pure function of current resolved carrier commands, stable grain seed/generation,
  material tuning, and canonical distance-derived phase.
- Buffers are cleared and rebuilt every frame; no previous-frame image/history is sampled.
- No `Math.random`, wall clock, `frameCount`, or delta-time accumulation.
- Seek/live/export equivalence follows automatically from the authoritative grain projection path.
- No per-frame grain, segment-array, canvas, ImageData, or unbounded collection allocation.
- Work is bounded by 360 carriers, a capped number of splat samples per carrier, fixed kernel radius,
  and capped raster dimensions.
- Performance measurements must separate: carrier accumulation, L0 resolve, bloom derivation,
  float-to-ImageData conversion, and three blits. Quality tiers require measured approval.

## 7. Required tests before implementation can pass the gate

1. **Disabled equivalence:** amount 0 produces the exact legacy line calls and zero raster calls.
2. **Single projection:** instrumentation proves route sampling and tube projection counts do not
   increase when material mode is enabled.
3. **Carrier identity:** every accumulated segment endpoint equals the legacy corrected/capped
   endpoint from the same grain and frame.
4. **Route inheritance:** horizontal, vertical, diagonal, counter-steer, and straight convergence
   alter the raster only through changed carrier endpoints; the material module has no route import.
5. **LFO inheritance:** radius/depth LFO effects enter only through release-snapshotted endpoints;
   no live geometry tuning read exists in the material module.
6. **Transition inheritance:** transition deformation changes carrier endpoints/material scalars once;
   the raster adds no second transition oscillator.
7. **Spectral inheritance:** band energy affects the same grain-local material command and never
   causes global geometry breathing.
8. **Carrier-bounded output:** nonzero material pixels stay within the declared maximum dilation of
   at least one accepted carrier segment.
9. **Bloom provenance:** L1/L2 are zero when L0 has no above-threshold carrier emission and cannot
   create structure absent from L0.
10. **Determinism:** identical input, repeated seek, live/export, and 30/60/120 FPS checkpoints are
    byte-identical at the same canonical song position.
11. **Lifecycle/performance:** lazy allocation, reuse, real-resize only, fallback on refusal, bounded
    work, and measured phase costs.
12. **Visual acceptance:** continuous filament/haze read, visible grain/trail direction, no
    independent background drift, no lens-space locking, no mosaic aliasing, deep center preserved,
    and sharp/bloom balance retained.

## 8. Implementation gate decision

**Gate result: corrected architecture accepted and production implementation completed.**

The implementation removes the incompatible old W5 background integration and establishes one
resolved-carrier handoff at the existing final grain line site. The legacy line path and the raster
accumulator consume the same corrected/capped endpoints; no old `(theta, log r)` field or lens
inverse dependency remains in the carrier path.
