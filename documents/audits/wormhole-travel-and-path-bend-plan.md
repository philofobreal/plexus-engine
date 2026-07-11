# Wormhole travel and route-frame implementation record

## Scope

The cosmic-wormhole identity uses one canonical, forward-only travel distance. Geometry is a pure
function of song position, analyzed fixed-hop data, and tuning, so seek, live playback, export, and
30/60/120 FPS sampling reproduce the same result. There is no camera shake, roll, horizon jump,
whole-canvas rotation, global sinusoid, or wall-clock transform.

The visual lens center stays fixed. The projection camera-local frame follows the route tangent
without roll, so a turn reads as travelling inside a hyperspace route rather than watching a bent
tube from outside.

## Route Contract

`sampleWormholeRouteFrame(distance, bend, out?)` returns:

```ts
{
  positionX, positionY,
  tangentX, tangentY,
  normalX, normalY,
  headingAngle,
  curvature,
  turnIntensity
}
```

The sampler integrates a smooth deterministic curvature envelope over long route segments. Heading is
the integral of curvature; position is the integrated route travel frame. Tangent and normal are
normalized perpendicular axes. `wormholePathBend = 0` is the exact straight baseline:
`positionX = 0`, `positionY = distance`, `headingAngle = 0`, `curvature = 0`, tangent `(0, 1)`,
normal `(1, 0)`.

`wormholePathBend` is route heading/curvature intensity. It is not a lateral deformation scalar,
screen-space pan, random meander, or preset-tuned scale mask.

The legacy `sampleWormholeRoute()` / `sampleWormholeBackgroundRoute()` helpers remain as exact
zero-bend compatibility wrappers, but the renderer uses route frames.

## Projection

`projectWormholeTubePoint()` (`WormholeGrainField.ts`) is the single, testable projection function
used by both foreground grain heads/tails and (indirectly, via the same camera-local dot-product
transform) the background layers. For a tube point it samples:

- the camera route frame at the current or previous camera travel distance;
- the point route frame at `cameraDistance + depth`;
- the grain's tube radial offset (`radius`, `theta`) along the point frame's route-local normal.

The world point is transformed into the camera route frame before perspective projection via plain
camera-local dot products -- no heading-shear compensation term of any kind. The route only turns in
its own horizontal plane, so the tube's vertical axis (`radialY`) never rotates with heading and needs
no transform beyond the shared perspective divide; this is what keeps both screen axes symmetric and
the projected cross-section circular at every bend, including the exact zero-bend baseline.

Keeping the far centerline lens-local (so a turn does not carry the whole cross-section's visual
centroid off-screen) is handled by splitting the delta into two additive parts instead of a shear:

- the grain's own radial contribution (`radius`, `theta`) -- always full strength, since this is what
  actually draws the circle;
- the route-curvature drift between the point's route position and the camera's route position --
  identical for every grain at a given depth regardless of angle, scaled by
  `FOREGROUND_ROUTE_DRIFT_WEIGHT` (1, undamped).

The drift term is theta-independent, so scaling it changes only how far the cross-section's centroid
drifts as the route turns -- it cannot bias the circle's shape the way scaling the *combined* delta
(the rejected, previous approach) did. An earlier revision damped this weight to 0.12 to keep the
lens "anchored" through a turn; that was screen-space stabilization by another name, and it silently
recentered every depth ring toward the lens regardless of the route's actual curvature, which reads
as a frontal tube viewed from outside rather than a turn the camera is actually following. Numeric
measurement (`tests/wormhole-route-geometry.test.mjs`) at full weight across a wider depth/bend sweep
than the original test covered also showed the *undamped* value keeps the cross-section closer to
circular at large depths/bends than the damped one did (the damped, theta-independent numerator no
longer cancels correctly against the theta-dependent projection denominator once depth is large
relative to the route's turn scale) -- so full weight is both the physically correct model and the
better numeric fit, not a tradeoff between the two.

This replaces the rejected model:

```ts
screen = project(point + routeOffset)
```

and the rejected "compensate with a per-axis heading shear" fix attempt:

```ts
localX = (radial + routeOffset) * FIXED_SCALE - headingDelta * z * COMPENSATION  // X only, asymmetric
localY = radialY + radialX * headingDelta * SMALL_FACTOR                        // different treatment
```

with the intended model:

```ts
local = inverse(cameraRouteFrame) * (routePointFrame * radial + routeCurvatureDrift * DRIFT_WEIGHT)
screen = project(local)
```

`sampleWormholeRouteFrame()` itself is a closed-form O(1) integration (a fixed handful of arithmetic
operations regardless of `distance`), not a per-4800-unit-segment loop from distance zero: the turn
sign pattern has period 4 in segment index and heading returns to exactly zero after every complete
period, so whole periods are skipped via one precomputed period displacement instead of iterated.

## Background

Stars, galaxies, and the optional skybox use the same route-local travel frame. Stars use current and
previous camera frames so trail direction follows camera heading delta and layer speed. Near stars
react more strongly through their own perspective divide; far stars and the skybox react weakly.

There is no separate background viewer-frame API, no independent background route, no whole-cosmos
rotation, and no oversized shared background scale. Background changes read the live effective
`wormholePathBend`, so preset/automation changes affect star trails immediately without waiting for a
grain generation release.

Stars and galaxies fade alpha through their own near-plane zone via `wormholeNearPlaneVisibility()`
and floor projection depth to avoid unbounded near-plane coordinates.

### Cosmos travel-rate and turn-reactivity sync (`WormholeCosmicSync.ts`)

Every layer's reactivity to travel speed and to route turning is derived from one shared, zero-import
pure module, `src/visuals/WormholeCosmicSync.ts`, instead of each layer inventing its own cue:

- `wormholeEffectiveTravelRate(wormholeSpeed, travelSpeedMotion)` is the single shared reference
  (equal to the foreground grains' pre-existing `vz / 10`).
- `wormholeForegroundTravelRate` / `wormholeStarTravelRate` / `wormholeGalaxyTravelRate` /
  `wormholeSkyboxTravelRate` scale that one reference by each layer's own existing parallax ratio
  (`STAR_SPEED_RATIO`, `GALAXY_SPEED_RATIO`, `SKYBOX_ROUTE_WORLD_FRACTION`, which stay owned by
  `CosmicWormholeIdentity.ts` since they are also used for non-speed lateral-scale purposes). The
  skybox variant is hard-capped so the most distant layer's reactivity stays bounded/minimal rather
  than becoming a major moving object.
- `wormholeParallaxStrength(turnIntensity)` is a small, bounded, symmetric amplitude boost (never a
  corrective/heading-shear term) applied to each layer's existing lateral-scale constant while the
  route is actively turning, so sideways parallax reads stronger through a turn than on a straight
  stretch, not just faster with speed.

Before this module existed, galaxies and the skybox tracked `wormholeSpeed` only through the slow,
bounded `WormholeAuthoredSpeedTimeline` offset baked into `travelDistance` -- measured (at
`wormholeSpeed = 8`) to reach only ~3.8x the baseline travel-distance rate, while foreground grains
and stars got a full ~8x instantaneous trail-length cue from a direct, live read of `wormholeSpeed`.
Galaxies and the skybox had no trail at all to carry that weaker signal, reading as "partial or
delayed" cosmos reactivity. Both layers now get the same kind of bounded, positional prev/current
motion cue grains and stars already had (a fainter echo of each galaxy at its own previous-frame
position; a short line instead of a static point for skybox dust), scaled by the shared rate above.

## Automation And Materials

Route bend, speed, and continuity are live draw-time inputs, read directly from `State.visualTuning`
(no additional automation-triggered multiplier). `State.visualTuning` itself already glides
continuously toward `State.targetTuning` every frame via `applyTuningMorph()`
(`src/config/visualTuning.ts`), starting from whatever the previously active value was -- never from
zero or from a fresh preset reload -- so an automation point activating never causes a value jump on
its own. Radius, depth, ring, and coherence remain release/seek-snapshotted per grain.

An earlier revision additionally scaled effective route/speed/continuity by an `automationResponse`
envelope that jumped to full strength the instant a point activated and decayed over the point's morph
duration, layered on top of the already-smooth glide above. That produced a real, visible snap/surge at
the trigger instant (up to +18-35% over the gliding value) even though the underlying value itself
never jumped -- exactly the "character still snaps" symptom this file's `automationResponse` had been
credited with avoiding. It has been removed; the continuous `applyTuningMorph` glide is now the sole
source of automation-driven change.

Grain material remains live-spectrum-dominant (`LIVE_GRAIN_SHIMMER = 0.88`): a grain's fixed
`bandIndex` maps to a fixed angular sector, so active frequency bands light their own sectors without
moving the tunnel geometry.

### Continuity completion record

The runtime steering cancel path no longer clears curvature when a target changes. It retargets
continuously, including bounded counter-steering when a curved role returns to the straight target.
Background parallax reads the distance-smoothed turn measure, while point geometry continues to use
the live route frame; a target change therefore cannot turn a one-frame curvature value into a
whole-background positional jump.

`syncPosition()` reconstructs each horizontal and vertical route with
`resetWormholeRouteStateConverged`, rather than starting from heading zero. The canonical transport
rate (`WormholeTransport.rateAt`) and authored future-rate timeline are also the source for foreground
trail separation, so foreground trail length and cosmic travel use the same rate vocabulary.

`wormholePathBend` is signed: positive and negative values are mirror directions on the horizontal
axis. `wormholePathBendVertical` supplies the independent signed screen-Y component without camera
roll. The scene-plan `mirrorable` metadata becomes the renderer-agnostic `bendMirror` flag and is
applied before tuning reaches the identity. Pair pacing consumes its duration/alternation metadata
and enforces the wormhole morph floor before activating a target.

## Verification

Regression coverage includes:

- exact zero-bend route frame baseline;
- normalized tangent/normal and perpendicularity;
- continuous heading;
- stable curvature sign inside a turn segment;
- seek-independent route sampling;
- camera-local centerline staying lens-local;
- foreground projection using route frames, not screen offsets;
- background star trail direction correlating with camera heading delta;
- drive preserving the straight route baseline;
- automation changing route/speed cues within one second without first-frame surge or grain-release
  dependency;
- **projected tube cross-section circularity** at multiple depths and bends (`wormhole-route-geometry.test.mjs`)
  -- a numeric check of the actual screen-space ring shape, not just the underlying route-frame math,
  since that is exactly the gap that let the previous 4:1-ellipse regression ship with a fully green
  suite;
- **no heading-shear compensation** anywhere in the render pipeline (`wormhole-determinism.test.mjs`),
  a source-level regression guard against reintroducing the rejected per-axis shear;
- closed-form route integration matching a brute-force per-segment reference, and route sampling cost
  not growing with distance (`wormhole-route-geometry.test.mjs`).
- a 30-minute, 1/60-second cyclic render run over all ten presets, including mirrored spiral and
  overdrive activations, with finite route/draw data, monotonic travel, bounded route/anchor buffers,
  and visible-star continuity (`wormhole-long-run.test.mjs`);
- playback/export exact draw-list agreement, converged-seek heading agreement, repeated-export byte
  determinism, 30/120 FPS-scaled continuity bounds, and a bounded route-sample count per draw
  (`wormhole-long-run.test.mjs`).
