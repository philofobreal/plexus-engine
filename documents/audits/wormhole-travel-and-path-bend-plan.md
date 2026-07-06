# Wormhole travel and route-field implementation record

## Scope

The cosmic-wormhole identity uses one canonical, forward-only travel distance. Geometry is a pure
function of song position, analyzed fixed-hop data, and tuning, so seek, live playback, export, and
30/60/120 FPS sampling reproduce the same result. There is no camera shake, roll, horizon jump, or
global sinusoid/wall-clock transform. The visual lens center stays stable while a route-local viewer
frame gives the world deterministic viewer-relative parallax.

## Route contract

`sampleWormholeRoute(routeDistance, depthT, bend)` returns:

```ts
{ offsetX, offsetY, tangentX, tangentY }
```

The sampler is distance-domain and deterministic. It uses an explicit arc-segment centerline with an
analytic local tangent. There are no hashed route targets, route cells, or per-section random
meanders. The visible route is intended to read as one choreographed turn, not as an offset field.

`depthT` applies only a mild lens/far-plane amplitude fade over the same centerline; it never
chooses a separate route, nulls the arc at the endpoints, or creates local S-turn topology. With
`wormholePathBend = 0`, all four returned values are literal positive zero, preserving the straight
baseline exactly. Route radius/curvature cadence are invariant: `wormholePathBend` scales only the
sampled centerline amplitude. It cannot change route topology, radius, or tangent cadence, so live
bend morphs stay on the same authored arc.

## Projection and trails

Grain projection samples the current route at `distanceNow + z` and the trail endpoint at
`distancePrev + prevZ`. The tail is therefore the projection of a real earlier route position, not a
screen-space estimate. Each point subtracts a viewer route sample at canonical travel distance plus
a fixed lookahead. A bounded first-order tangent term compensates viewer heading, so the tube remains
organized in front of the viewer instead of behaving like a screen-space snake. This changes the
reference frame, not the camera roll or horizon. `wormholeBackwardTrailCorrection()` remains a final route-local tube
cross-section invariant guard; normal presets are draw-tested so it is normally inactive. Measuring
this invariant from the fixed lens center would incorrectly classify legitimate centerline turns as
backward grain flow.

Release and seek snapshots read `State.visualTuning`, the tuning actually rendered on that frame, for
grain radius/depth/ring/coherence and per-generation material character. Route bend, travel speed,
and part of continuity are intentionally live/morphed at draw time so existing grains visibly follow
automation preset changes without waiting for the next generation release. Target tuning is not used
directly for spawn geometry; it must first become rendered tuning through the existing morph path.

## Background coupling

Grains, stars, galaxies, and the optional skybox sample the same viewer route field, but the field is
split into two independent mechanisms so that core stabilization and background sweep cannot cancel
each other:

- **`grainRouteRelative`** (core stabilization, grains only): each grain samples
  `sampleWormholeRoute()` at its own current/previous position and at the viewer's own
  lookahead position, then `wormholeViewerRelativeRoute()` subtracts the viewer sample. This keeps
  the tunnel core organized ahead of the fixed lens instead of translating the whole tube as a
  screen-space object.
- **Background viewer-frame world transform** (stars/galaxies/skybox): the background samples the
  same canonical arc once per frame via
  `sampleWormholeBackgroundViewerFrame(routeDistance, bend)`. The frame contains the viewer's lateral
  arc offset plus the arc tangent (`headingX`, `headingY`); `turnAngle` remains zero for compatibility
  so the cosmos is not rotated as a separate world plate. Every background object uses that shared
  frame; no star, galaxy, or skybox tile owns an independent route sample.

  `wormholeBackgroundWorldRelative(worldX, worldY, viewerFrame, worldScale)` performs the actual
  per-object transform in world units, **before** that layer's own perspective divide: translate by
  `viewerFrame.offset * worldScale` without rotating the whole cosmos. Current and previous star
  endpoints use their own viewer frames, so trail motion follows the same arc tangent as the
  foreground route. Near objects still move more on screen than distant ones because each layer
  applies its own perspective divide afterward. Stars still fade/thicken by their own `sNear` depth proximity as before; that
  visibility math is unrelated to the route-follow transform and unchanged. Galaxies only need a
  "now" frame (they are drawn as a single glow, not a line with two endpoints). The skybox has no
  independent depth to divide by, so its translate is expressed as a small fraction of its own tile
  radius (`SKYBOX_ROUTE_WORLD_FRACTION`) instead of a world-unit scale.

  A single master constant, `BACKGROUND_ROUTE_FOLLOW_SCALE`, scales every layer's world-scale weight
  together; each layer keeps its own relative strength below that (stars strongest, galaxies softer
  and wider, skybox faintest), replacing the old per-layer
  `STAR_ROTATION_GAIN_*`/`GALAXY_ROTATION_GAIN_*`/`SKYBOX_ROTATION_GAIN` constants, which existed only
  to fake a near/far differential that now falls out of the perspective divide for free.

  Because `sampleWormholeBackgroundViewerFrame` is a pure function of `routeDistance` and `bend`, this
  still needs no mutable per-frame accumulator: seeking to any timestamp reproduces the identical
  frame without replaying intervening frames. No layer adds an independent additive X/Y offset on top
  of the transform, and no layer owns an independent random background path.

### Near-plane guard for stars/galaxies

Stars and galaxies cycle depth the same way grains do (approaching the lens, then respawning at the
far plane), but -- unlike grains, which cull via `wormholeNearPlaneVisibility()` and `continue` -- they
previously had no near-plane guard at all, and their own alpha formula grew *brighter* as depth
approached zero. Since `1/z` diverges there, this was a pre-existing singularity (confirmed present
before any of the route-follow work above, independent of `wormholePathBend`): a star's projected
position could reach numerically extreme values at the exact moment it was drawn at peak brightness,
reading as a jarring flash. Stars/galaxies now compute `wormholeNearPlaneVisibility(z, maxZ)` and
multiply it into their own alpha (fading to zero through the near-plane zone, same shape as grains),
and additionally floor the *projection* depth only (`STAR_PROJECTION_Z_FLOOR` /
`GALAXY_PROJECTION_Z_FLOOR`, a fixed fraction of the horizon) so `1/z` stays bounded through that zone.
Unlike grains, this does not skip the draw call outright: skipping would desync `backend.lines[]` from
the star pool's index (relied on by direct-index test/diagnostic code), so the fade happens through
alpha instead of omission.

## Tuning semantics

- `wormholeWarp`: local per-grain spiral/advection amount around the tunnel. It does not bend the
  global route.
- `wormholeCurve`: local, per-grain flow curvature around the tunnel. It does not bend the global
  route.
- `wormholePathBend`: controls viewer route-following / cosmic turn cue in the viewer-local frame —
  `grainRouteRelative` for the foreground core, and the `sampleWormholeBackgroundViewerFrame` /
  `wormholeBackgroundWorldRelative` translate-only world transform for stars/galaxies/skybox. It does
  not introduce camera shake, roll, lens-center drift, or horizon jumps. It is an amplitude scalar for
  the sampled canonical arc only; it does not change route radius, topology, or tangent cadence.
- The canonical route centerline is a pure function of song-time-derived travel distance and the
  fixed arc model. Preset tuning can scale the sampled amplitude, but cannot author a separate random
  route or change the centerline's frequency. The wormhole identity still does not consume
  `State.modulation` as a route authoring source; if that changes later, it needs a separate explicit
  contract.
- Route bend, speed, and continuity are live draw-time inputs. Radius/depth/ring/coherence remain
  release/seek-snapshotted per grain, but existing grains do not wait for their next generation before
  the route arc, trail distance, or continuity response changes.
- The background cue always reads the effective live `wormholePathBend`, evaluated fresh
  every `draw()` call. It is intentionally **not** routed through a grain's frozen
  `releasePathBend` snapshot: the viewer's own route frame is not a per-grain attribute, so a live
  preset/tuning change is felt on the very next frame, not after the next grain-generation release.

Drive is the exact zero-bend baseline. Spiral has the strongest readable turn; drift and galaxy use
slow broad arcs; collapse and sparse use restrained structural arcs; punch and overdrive use stronger
arc amplitude without increasing route frequency or adding camera impulse.

## Material response (spectrum-distributed grain brightness)

Each grain owns a fixed `bandIndex` (0..23) mapped to a fixed angular sector (`BANDS = 24` sectors
around the tube), assigned once at construction and never touched afterward. This spatial mapping was
already correct, but grain *material* (alpha and stroke weight -- never position/geometry) previously
blended only a 12% live-spectrum shimmer against an 88% release-time snapshot
(`LIVE_GRAIN_SHIMMER = 0.12`), added specifically to keep a kick/bass hit from making the whole tube
pump. That older fix over-corrected: it also suppressed the identity's original circular-spectrograph
read, where an active frequency band visibly lit up its own angular sector and that bright arc migrated
around the tube as the active band changed. `LIVE_GRAIN_SHIMMER` is now `0.88` (live-dominant, with a
small release-snapshot grounding term so a grain never goes fully dark between spectrum frames). This
is safe against the original regression it was guarding against: kick/bass swarm reactions are a
wholly separate, still release-snapshotted mechanism (`releaseKick`/`releaseBass`/`kickGain`, decayed
by `wormholeKickReleaseEnvelope`), read nowhere in this energy blend, so raising the live weight here
cannot reintroduce a global per-kick pulse -- it only makes each grain's own band-energy material
response track its own band, which is a spatially distributed signal by construction, not a global one.
Grain structural geometry (`theta`, radius/depth/ring/coherence, flow identity) remains
release-snapshotted. Route bend, speed, and continuity are the explicit exceptions: they are live
draw-time transport/route controls so automation transitions stay performative.

## Verification

Regression coverage checks exact zero-bend output, no hashed route-cell targets, bend-as-amplitude-only
sampling, bend-invariant heading cadence, single-arc curvature sign behavior, continuous
forward/backward bend morphs, endpoint anchors, bounded grain-core centroid, route/background tangent
correlation, infrequent projected direction reversals, forward trails, low correction activation,
release/seek snapshot source, and seek/export/FPS
determinism. It additionally covers the background viewer-frame transform specifically:
`sampleWormholeBackgroundViewerFrame` is a bounded,
exact-zero pure function of travel distance at rest/zero-bend; `wormholeBackgroundWorldRelative` is an
exact, depth-agnostic identity at zero offset (callers divide by their own object's depth afterward,
which is what gives near objects a bigger on-screen shift than distant ones); the renderer wires
`backgroundViewerNow`/`backgroundViewerPrev` from live effective `wormholePathBend` (not a grain's
`releasePathBend`) once per frame, not once per object; stars read `backgroundViewerNow` for their
current endpoint and `backgroundViewerPrev` for their previous one; and neither the old additive pan
nor any independent random background route reappears as the primary cue
(`tests/wormhole-determinism.test.mjs`). Integration tests track individual stars'
screen-space polar angle across several independent multi-second draw windows under the spiral preset:
the angular sweep is visible on average across windows and reads as a continuous arc, the on-screen radius measurably diverges
from a same-depth zero-bend baseline, the foreground core centroid stays bounded throughout, a tracked
star's on-screen motion never snaps/teleports while visible across a ~40-second sequence (long enough
to cover a full star depth cycle, including near-plane transits), and a live
`State.visualTuning.wormholePathBend` change shifts a tracked star on the very next frame without a
`syncPosition()` call or any grain-generation release; the same sequence under the zero-bend `drive`
preset keeps every tracked star's angle and radius exactly frozen
(`tests/wormhole-background-turn-cue.test.mjs`). The spectrum material response is verified directly:
a single active frequency band lights up only the grains in its own angular sector, far brighter than
every other band's grains, and switching to a different active band immediately migrates the lit
sector rather than pulsing the whole field
(`tests/wormhole-depth-integrity.test.mjs`).

Automation behavior is covered by a draw-level regression: after an automation point begins, a
0.75-second morph step changes existing rendered grain geometry measurably without waiting for a new
grain release. Route curvature tests also assert that a visible arc span does not flip curvature sign
repeatedly, and background-heading tests assert that the background tangent remains correlated with
the canonical wormhole route tangent (`tests/wormhole-route-geometry.test.mjs`,
`tests/wormhole-depth-integrity.test.mjs`).

Automation/preset ownership is guarded separately. `src/config/identityTuningRegistry.ts` declares
the tuning keys owned by `cosmic-wormhole`. Automation-triggered presets with an explicit foreign
`visualMode` are filtered before normalization so they cannot write the active identity's owned
wormhole keys; manual preset loading and `visualMode`-less presets remain backward compatible. The
`vos-wh-*` factory presets explicitly carry their route/grain role keys but intentionally leave
`wormholeStarfield`, `wormholeGalaxy`, and `wormholeSkybox` as user-global background masters
(`tests/wormhole-clip-profile.test.mjs`, `tests/contracts.test.mjs`).
