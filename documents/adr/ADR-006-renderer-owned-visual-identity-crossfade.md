# ADR-006: Renderer-Owned Visual Identity Crossfade

## Status

Accepted and implemented.

## Date

2026-07-04

## Context

Visual mode changes previously had only the selected `State.visualMode` and a direct registry-to-identity draw path. A real replacement transition needs both identities for a bounded period, but delaying the logical mode switch would make UI, preset routing, automation, and export state disagree. Letting identities own overlays or render targets would also leak p5/composition concerns into effect modules and could advance shared particles and shockwaves twice per frame.

The transition must remain deterministic under the live song clock, offline export clock, seek/backward time, transparent/chroma output, and identities that do not use the shared particle pool.

## Decision

1. `requestVisualModeChange()` in `src/state/visualModeTransition.ts` is the only runtime writer of `State.visualMode`. It changes the logical mode synchronously.
2. During playback or export, the same function creates/replaces one `VisualModeTransition` record with `generation`, `from`, `to`, `startTimeSec`, and `durationSec`. Playback uses `State.currentTime`; export uses `State.exportTime`. Paused/stopped switching clears the record. Duration is clamped to `0.1..4.0` seconds.
3. `PlexusRenderer` owns one `IdentityTransitionController` and one `P5RenderTargetCompositor`. The compositor creates exactly two persistent `p5.Graphics` targets during renderer setup.
4. With no valid active transition, the controller uses the steady-state fast path and draws only `StyleRegistry.get(State.visualMode)` to the live backend. No target clear, dual draw, or composite occurs.
5. During an active transition, outgoing and incoming identities draw to separate backends. `computeCrossfadeAlpha()` derives smoothstep progress from song/export time. Completion or time before the recorded start clears the transition and draws only the logical incoming identity. A record whose `to` no longer matches the logical mode is bypassed.
6. `P5RenderTargetCompositor` clears both targets on every active transition frame, resizes them only when surface dimensions change, and composites to the live/export target with Canvas2D `source-over`: `outgoing * (1 - alpha) + incoming * alpha`. Additive `lighter` blending is forbidden for identity replacement.
7. Shared particle/shockwave simulation advances once per transition frame. Incoming owns advancement when it declares shared-simulation use, or when neither participant does. If incoming is not a shared-pool identity and outgoing is, outgoing owns the single advance. The other participant receives `advanceSharedSimulation: false` and must not update or remove shared objects.
8. Render targets and compositing remain renderer-private. Identities receive only `VisualRendererBackend` plus `VisualIdentityDrawContext`; they must not write visual-mode/transition state or own target lifecycle.

## Consequences

- Logical state, UI selection, preset routing, and metronome/style consumers observe the new mode immediately, while presentation can still crossfade.
- Normal frames retain the direct single-identity path; the extra clear/draw/composite cost is bounded to active transitions.
- Transparent, chroma-key, video-backplate, live, and export output use the same replacement semantics without prior-frame target ghosting.
- The renderer owns two persistent offscreen surfaces for its lifetime and may resize them with the live surface.
- A new request replaces the current record from the current logical mode; the implementation does not snapshot an in-progress mixed frame.
- Seek/backward time terminates the active crossfade instead of replaying a stale transition.

## Rejected Alternatives

- **Immediate visual cut only:** does not provide identity replacement continuity.
- **Delay `State.visualMode` until completion:** creates split logical/UI/renderer ownership and complicates automation/export behavior.
- **Effect-owned overlays:** violates the backend boundary and cannot enforce one shared simulation advance.
- **Additive blend:** brightens overlapping content and is not a true A-to-B replacement.
- **Allocate targets per transition/frame:** adds avoidable allocation and garbage-collection pressure.

## Verification

`tests/visual-mode-transition.test.mjs` covers alpha boundaries, synchronous switching, clock anchoring, duration clamps, compositor blend/clear behavior, active-only compositing, shared simulation ownership, and the single `State.visualMode` runtime writer. `tests/contracts.test.mjs` pins renderer delegation and the draw-context contract.
