# ADR-007: Renderer-Owned Post FX Pipeline And Temporal Fragmentation

## Status

Accepted and implemented.

## Date

2026-08-16

## Context

The engine had no way to treat a finished frame as an image. Every visual accent had to be authored
inside a visual identity, which couples an image-level idea to one identity's geometry and forces it
to be re-implemented per identity.

The concrete need is a dramaturgical accent, not a new visual identity: at short, musically
motivated moments the finished frame should break into horizontal/rectangular fragments, a few of
which slide sideways, with a fast attack and a fast decay. Between accents the engine must stay on
exactly the path it has today.

Three existing contracts constrain the solution:

- ADR-006 gives `P5RenderTargetCompositor` to the identity replacement crossfade. It is not a
  general post-process surface, and turning it into one would blur an already-settled ownership.
- ADR-001/ADR-003 keep `State.modulation` and `State.directorOutput` owned by `VisualDirectorFSM`.
  A post effect must consume them read-only and must not become a second dramaturgy engine.
- `AGENTS.md` forbids realtime DSP in the render loop, and the anti-pattern catalog forbids
  unseeded randomness in generated visual behavior.

There is also a rendering-mechanics constraint: the destination of a frame is the live canvas in
playback and an offscreen `p5.Graphics` during export (`__plexusExportTarget`), and the live canvas
carries p5's pixel-density transform.

## Decision

1. **One seam, after the finished frame.** `PlexusRenderer` calls `PostFxPipeline.render()` once per
   `draw()`, immediately after the identity draw branch. In steady state that is after the direct
   identity draw; during an ADR-006 transition it is after `composite()`. The chain therefore runs
   exactly once per rendered frame, on the final composite, never once per participating identity.
2. **A separate renderer-owned seam, not an extension of the compositor.** `P5RenderTargetCompositor`
   is untouched and remains the property of identity replacement. The post chain owns its own
   modules: `PostFxTypes` (contract), `CanvasPostFxSurface` (buffer + destination resolution),
   `PostFxPipeline` (orchestration), and one effect implementation per accent.
3. **Identities gain nothing.** A `VisualIdentity` still receives only `VisualRendererBackend` plus
   `VisualIdentityDrawContext`. Identities cannot create, resize, retain, or composite a post target,
   and the post contract is not reachable from them.
4. **Self-blit instead of redirected identity rendering.** On an active frame the pipeline copies the
   finished destination into one persistent buffer (`copy` composition, exact pixels and alpha) and
   the effects write displaced fragments back into the destination. The identity is never redirected
   to an offscreen surface, so `background()`, chroma-key, transparent, and video-backplate semantics
   are unchanged, and an inactive frame performs no blit at all.
5. **Device-pixel math.** Effects run under `setTransform(1, 0, 0, 1, 0, 0)` inside a save/restore
   pair and address the destination in raw device pixels. One plan is therefore correct for a HiDPI
   live canvas and for an export target of any resolution, and p5's own context state is restored.
6. **Determinism.** Fragment decisions are a pure function of song time, the already-published render
   signals, tuning, and surface size, computed with an integer avalanche hash. No runtime RNG, no
   wall clock, no cross-frame state. Live and export make the same decisions at the same song time,
   and a seek reproduces frame-by-frame playback.
7. **Burst-coherent time grids.** Band boundaries and spans come from a topology grid
   (`TOPOLOGY_SLOT_SEC = 0.75 s`, longer than a gated burst); which bands move and how far comes from
   an activation grid (`ACTIVATION_STEP_SEC = 0.18 s`). One accent keeps one fragmentation and
   re-jumps a few times inside it, instead of re-cutting the frame at strobe rate.
8. **Musical activation is borrowed, never re-derived.** `State.directorOutput.glitchIntensity` owns
   the lifecycle (it snaps to 1.0 on `GLITCH_LOW_DROP` entry and decays as `exp(-4t)`, which is the
   required fast attack and fast decay). Below `FRAGMENT_GATE = 0.12` the effect is fully bypassed,
   which bounds an accent to roughly half a second. `State.modulation.spectralChaos` shapes
   fragmentation complexity and never gates, so sustained chaos cannot produce a continuous glitch.
   `State.modulation.rhythmicImpulse` scales the one-shot displacement within bounds. No new beat
   detection, no realtime DSP, no second dramaturgy state machine.
9. **X-only displacement in v1.** Source and destination rects are the same size and share the same Y
   range; a wrap copy closes the cleared span, and `|shiftX|` is clamped below the span width. No
   scale, no crop, no vertical offset, so no alpha hole can appear in transparent or chroma output.
10. **Performance mode is a full bypass.** With `performanceMode >= 0.5` the pipeline returns before
    resolving a target: no probe, no snapshot, no buffer allocation, no planning. The low-latency
    contract wins over the accent.
11. **Paused/stopped is an explicit bypass.** The guard is `!State.isPlaying && !State.isExporting`,
    not an indirect reliance on the envelope reaching zero, so a still frame is bit-identical to what
    the identity drew.
12. **Fixed chain order.** `POST_FX_CHAIN_ORDER` declares the intended chain
    (`fragmentation`, `chromatic-aberration`, `local-displacement`, `temporal-echo`,
    `spatial-glitch`). Effects are sorted by it, so composition order cannot silently reorder the
    chain. Only `fragmentation` is implemented; the other ids are reserved names, not stubs.

### Tuning ownership, and what "semantic" ownership means here

Three renderer-level keys are added to the existing metadata-driven tuning system:
`postFxFragmentAmount` (master, default `0`), `postFxFragmentDisplacement`, `postFxFragmentDensity`.
`0` on the master is a full bypass, so the default output is pixel-identical to the pre-ADR-007
engine, and no new slider UI code exists (the tuning panel builds groups from control metadata).

They are renderer-level, not identity-owned, so they are deliberately absent from
`identityOwnedTuningKeys`: the accent applies to whatever identity is on screen.

Two distinct notions must not be conflated:

- **Being a valid tuning key** means the key exists in `visualTuningConfig` / `visualTuningControls`.
  That only makes it a handled, bounded, morphable, preset-serializable parameter: the semantic
  resolver copies it through from the base preset and clamps it to the control's min/max like any
  other key.
- **Being semantically owned** means the dramaturgy actually drives the key, which happens only when
  a real semantic delta targets it (an entry in the resolver's action/transition delta tables).

The post FX keys are valid tuning keys but receive no semantic delta, so the semantic layer neither
owns nor modifies them; they stay under user/preset control while the accent's lifecycle stays with
`glitchIntensity`. Should a future delta table target them, ownership would move with that delta, not
with their mere presence in the control list.

## Consequences

- A normal frame is unchanged: the pipeline exits on state guards or on the per-effect probe, with
  no offscreen render, no composite, and no allocation.
- An active accent frame costs one full-frame snapshot blit shared by the whole chain, plus at most
  eight clipped fragment blits (four moving fragments, each with its wrap copy) whose combined area
  is a fraction of the frame. That is roughly `1.2` to `1.5` full-frame blit equivalents, for about
  half a second per accent, and it is additive to the ADR-006 crossfade cost rather than entangled
  with it. Indicative single-machine measurement (Chromium, pixel density 1, worst-case four moving
  fragments): `0.23 ms/frame` at 1280x720, `0.31 ms` at 1920x1080, `0.72 ms` at 3840x2160, against
  `0.003 ms` for an inactive 3840x2160 frame. At 60 FPS the 4K accent uses about four percent of the
  frame budget while it lasts.
- The renderer owns one additional persistent buffer, allocated lazily on the first active frame and
  resized only when the destination dimensions change. A session that never enables the accent
  allocates nothing. Simultaneous full-surface framebuffer budget at RGBA8, worst case (active
  crossfade plus a running export plus an active accent), where the post buffer follows the
  destination resolution:

  | Case | Live canvas | Crossfade targets | Export offscreen + capture | Post buffer | Total |
  | --- | --- | --- | --- | --- | --- |
  | 1080p live, no export | 8.3 MB | 16.6 MB | - | 8.3 MB | 33.2 MB |
  | 1080p live, 1080p export | 8.3 MB | 16.6 MB | 16.6 MB | 8.3 MB | 49.8 MB |
  | 1080p live, 4K export | 8.3 MB | 16.6 MB | 66.4 MB | 33.2 MB | 124.5 MB |
  | 4K live, no export | 33.2 MB | 66.4 MB | - | 33.2 MB | 132.8 MB |

  The post buffer is the only new row; it adds 20 to 36 percent to the pre-ADR-007 totals, and only
  from the first active accent onward. A live surface at pixel density 2 scales every live-side row
  by four, which is a pre-existing property of the crossfade targets as well.
- Export inherits the effect through the same seam with no export-side wiring, because the
  destination resolution already honours `__plexusExportTarget`.
- The video backplate is not fragmented: only canvas pixels are rearranged, and the backplate stays
  behind them. This is intentional and keeps the backplate contract intact.
- Because there is no refractory state (that would be both a second dramaturgy decision and a break
  in time-purity), the FSM's own `MIN_STATE_DURATION` remains the only limit on how often an accent
  can re-arm.

## Rejected Alternatives

- **Extend `P5RenderTargetCompositor` into a post-process system:** violates the ADR-006 ownership of
  identity replacement and mixes two unrelated lifecycles in one class.
- **Redirect identity rendering into a post offscreen every frame:** costs a full blit on every
  frame, or forces an activity decision before drawing, and complicates background/backplate
  semantics.
- **Let identities own the effect:** breaks the backend boundary, re-implements the accent per
  identity, and cannot guarantee a single application on a crossfaded frame.
- **A dedicated post-FX beat/onset detector:** forbidden realtime DSP in the render loop and a second
  dramaturgy authority next to `VisualDirectorFSM`.
- **Random slice selection:** breaks export reproducibility and the deterministic-variation rule.
- **Degrade instead of bypass in performance mode:** even a degraded chain keeps the full-frame
  snapshot blit, which is exactly what the low-latency profile is meant to avoid.
- **Frame-history fragments in v1:** a previous-frame source is a separate effect (`temporal-echo`)
  with its own buffer lifecycle and its own render-cadence caveats; folding it into the first effect
  would have coupled two independent decisions.

## Verification

`tests/postfx-fragmentation.test.mjs` covers bypass at zero strength/amount, the performance-mode and
paused/stopped bypasses, lazy single allocation and resize-on-change, live/export decision identity,
determinism and burst coherence, chaos shaping without gating, fragment bounds and wrap-closability,
the cleared-and-fully-refilled same-size/same-Y blit contract, the absence of randomness and of
identity/transition/shared-simulation authority, the single renderer seam after the finished frame,
and the renderer-level tuning defaults.
