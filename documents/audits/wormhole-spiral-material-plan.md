# Wormhole spiral geometry + depth-stratified grain material

Status: **SHIPPED**
Date: 2026-08-21
Amends: [`wormhole-nebula-grain-material-architecture-gate.md`](wormhole-nebula-grain-material-architecture-gate.md)

## 1. Why the accepted gate was not enough

The gate delivered a carrier-derived material, but the shipped result reads as a blurred copy of the
legacy grain lines. Two causes, only one of which lives in the material module:

1. **The carrier handoff carries no depth.** `ResolvedWormholeGrainCarrier` exposes two endpoints,
   alpha, stroke weight, colour, seed, generation, phase, and energy. Nothing tells the material
   whether it is rendering a streak passing the camera or a mote at the far end of the tunnel, so
   every carrier received the same kernel character and the same halo. The result is a uniform aura
   on everything and no near/far reading at all.

2. **The geometry has no angular coherence, so there is nothing to connect.**
   `wormholeGrainFlowAngle` advects every grain with `character.flowRate` and a per-grain
   `flowDirection` of `+/-1`; its own contract comment states that this is deliberately *not* a
   shared rotation. Grains in one angular sector at neighbouring depth layers therefore sit at
   randomly scattered angles. No raster material can recover a spiral arm from that: the arms do
   not exist in the geometry. Measured on the authored defaults, the total angular advection between
   the far plane and the near plane is under two degrees.

A material-only change can fix (1). Only a geometry change can fix (2).

## 2. Packages

| # | Package | Owner | Contract impact |
|---|---|---|---|
| **S1** | Coherent spiral twist added alongside the existing per-grain advection | `WormholeGrainField` | new parameter on `wormholeGrainFlowAngle`; zero twist reproduces today's value exactly |
| **S2** | Spiral arm density wave modulating already-resolved alpha and stroke weight | `CosmicWormholeIdentity` | none; a scalar multiplier at the existing resolve site |
| **S3** | `depth` on the carrier handoff plus a depth-stratified material law | gate amendment + `wormholeGrainMaterialRaster` | `ResolvedWormholeGrainCarrier` gains one field |
| **S4** | Connective weave carriers between neighbouring grains | `CosmicWormholeIdentity` | material-only carriers; no legacy line equivalent |
| **S5** | Opt-in grain density copies | `CosmicWormholeIdentity` | pool grows; the default active set is bit-identical to today |

## 3. S1 - coherent spiral twist

`wormholeGrainFlowAngle` gains a `spiralTurns` argument and returns

```
forwardProgress * signedRate * amplitude + forwardProgress * spiralTurns * TWO_PI
```

`forwardProgress = 1 - depthT` already exists, so the twist is a pure function of depth, never of
wall-clock time or frame count: the field does not rotate on its own, it twists as the camera
travels. With `spiralTurns == 0` the returned value is identical to today's, bit for bit.

Tuning key `wormholeSpiral` (0..4 turns, default **0**).

## 4. S2 - arm density wave

At the existing alpha/weight resolve site, using values already computed there:

```
armPhase = arms * projectedThetaNow - spiralTurns * ARM_TWIST_RATIO * TWO_PI * (1 - depthT)
armFactor = (1 - ARM_CONTRAST) + ARM_CONTRAST * pow(0.5 + 0.5 * cos(armPhase), ARM_SHARPNESS)
```

The crest angle rotates with depth, which is what makes the bright ridge a spiral on screen instead
of a set of radial spokes. Alpha is multiplied by `armFactor`, stroke weight by a softened
`0.55 + 0.45 * armFactor` so arms read as brightness first and mass second.

Tuning key `wormholeSpiralArms` (0..6 arms, default **0** = no density wave).

## 5. S3 - depth-stratified material

`ResolvedWormholeGrainCarrier` gains `depth` (the identity's existing `depthT`, 0 at the near plane,
1 at the far plane). Everything the material does is then stratified by it:

- **Kernel**: core radius scales with `nearness^2`, halo extent with `nearness^2.2`. A far mote is a
  crisp sub-pixel point with no halo; a near streak is a broad, soft, banded body. This is the
  "aura on everything" fix.
- **Extinction**: `transmittance = exp(-EXTINCTION * depth)`. Perspective concentrates every far
  stratum onto a handful of pixels around the vanishing point, so without a transmittance law the
  throat is always the brightest thing on screen. With it, the throat stays a hole and the light
  lives in the arms. A separate smoothstep damps the deepest stratum further.
- **Detail frequency**: filament and fibre frequencies rise with depth, so far strata are
  fine-grained and near strata carry broad structure.
- **Atmospheric tint**: a bounded two-anchor tint cools the far strata and warms the near ones.

The module also replaces the splat chain with a single analytic capsule evaluation per covered
pixel, which removes the bead-chain artefact and makes cost proportional to covered area rather
than samples times kernel area.

## 6. S4 - connective weave

The identity records each grain's already-resolved head into a constructor-allocated
`Float32Array`. After the grain loop, a weave pass connects neighbours **without any additional
projection or route sampling**:

- *arm neighbours*: same band, adjacent depth layer (pool index `i` and `i + BANDS`);
- *ring neighbours*: same depth layer, adjacent band, and only in the deeper strata where grains are
  close enough for a ring to read.

An arm link is not a chord. Both endpoints already carry their own resolved trail direction, which
is the local arm tangent, so the link is a Hermite curve through the two heads with those tangents,
emitted as a few short capsule carriers. A link is never brighter than its dimmer endpoint, is
dropped above a screen-length cap, and exists only while the material raster is active - the legacy
line path is untouched.

Tuning key `wormholeNebulaWeave` (0..1, default **0.6**), which is inert while
`wormholeNebulaAmount` is 0.

## 7. S5 - opt-in density

`POOL_SIZE` becomes `BANDS * DEPTH_LAYERS * GRAIN_COPIES_MAX`. Copy 0 occupies pool indices
`0..359` with the *unchanged* seed, theta, and depth-phase formulas, so at the default density the
active set, its seeds, and its draw order are exactly today's. `wormholeGrainDensity` (0..1, default
**0**) selects 1..4 active copies, and the draw loop is bounded by the active count, so the default
path does no extra work.

`DEPTH_LAYERS` stays 15: it is the depth-coherence and ring-step quantiser, and changing it would
alter existing depth behaviour.

## 8. Determinism and performance

Unchanged obligations: no `Math.random`, no wall clock, no frame counter, no per-frame allocation,
bounded work per carrier. The material's hash moves from a `Math.sin` mantissa trick to integer
mixing, which makes it bit-identical across engines rather than merely across runs in one engine.

Weave carriers add raster work proportional to their count, and density copies multiply the grain
loop. Both default to off, and both must be measured before a preset raises them.

## 9. Tests

1. `wormholeSpiral == 0` reproduces the current flow angle exactly.
2. `wormholeSpiralArms == 0` leaves alpha and weight untouched.
3. Default density draws the same grain set, in the same order, as before the change.
4. Depth stratification: a far carrier's support is strictly smaller than an identical near one's.
5. Extinction is monotonic in depth and never negative.
6. Weave: no additional `projectWormholeTubePoint` or route sample; link alpha never exceeds either
   endpoint; zero links at `wormholeNebulaWeave == 0` or while the raster is inactive.
7. Carrier-bounded output, bloom provenance, amount-zero equivalence, and determinism gates from the
   architecture gate stay green.

## 10. Implementation result (2026-08-21)

**Status: shipped.** All five packages landed on `codex/wormhole-grain-material`.

- S1/S2 (`wormholeSpiral`, `wormholeSpiralArms`) and S5 (`wormholeGrainDensity`) are wired as
  conditioning for the Nebula material, exactly like the S4 weave: the identity force-zeroes all
  three whenever `wormholeNebulaAmount` is 0 (including performance mode), so the legacy default
  render — the default case across the app — is untouched regardless of their tuning value.
  Verified: `amount=0` with `wormholeSpiral=3, wormholeSpiralArms=6, wormholeGrainDensity=1` draws
  the byte-identical historical line set.
- Their own defaults are **not** zero. Once a scene turns the master Amount on, `wormholeSpiral`
  defaults to 1.2 turns, `wormholeSpiralArms` to 2, `wormholeGrainDensity` to 0.34 (2 of the 4
  grain-copy tiers), and `wormholeNebulaWeave` to 0.6 — the combination validated against the
  reference look, so enabling Amount alone reproduces it without five additional knob turns.
- Density 0.34 (2 copies, not 4) was a deliberate perf/appearance trade: measured accumulate cost
  scaled from ~3.75ms (1 copy) to ~15.5ms (4 copies) on the reference frame; 2 copies lands near
  ~7.7ms, and further copies buy comparatively little extra density for the cost.
- Two accumulator-level cost cuts were required to get there: pixels below a per-carrier negligible-
  contribution threshold skip the noise evaluations entirely, and weave carriers (by far the more
  numerous class) use a one-octave texture pass with no filament breakup and no micro-detail pass,
  since they read as gas rather than structure. Neither changes a grain carrier's own material.
- All five packages are exposed on the visual tuning panel (`visualTuning.ts` `TUNING_PARAMS`,
  group "Wormhole"), each with its own bounded range, matching every other wormhole control.
- Full regression: the complete Node test suite passes with 772/772 tests, including the spiral
  material, depth-integrity, preset-contrast, seek/export determinism, and long-run continuity
  gates. The five inherited failures were resolved by restoring the documented deep-drift
  geometry and opacity contract.
