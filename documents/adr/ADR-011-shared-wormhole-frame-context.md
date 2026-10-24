# ADR-011: Shared Wormhole frame context and presentation boundaries

## Status

Proposed by T01 on 2026-10-23. Partially delivered through T04 and T05a/b/c; the appendices state
the accepted scope. Remaining proposals do not amend current governance by themselves.
Integration owner: this chat; owners: visuals/config, automation, host composition and export.
ADR-010 is reserved for the existing PR 8 World Formation decision. Related:
[ADR-008](ADR-008-mvp-host-and-shared-renderer.md),
[ADR-009](ADR-009-xr-rhythm-game-host.md),
[execution plan](../audits/xr-development-plan.md).

## Problem and source evidence

`WormholeCanvasSource` already injects private state into the real CosmicWormholeIdentity and
can use the shared WebGLRendererBackend. It initializes macros and boosts from XR-authored
constants and performs its own tuning, director and event projection. Routing another host's
existing renderer through this source without an ownership handoff would apply gains, consume
events or draw the identity twice. GrainLineFrame and GrainMaterialFrame use raster coordinates;
WormholeSpatialFrame is an aggregate signal, not a complete native 3D scene.

CanvasVisualSource.render is synchronous latest-frame preview. Protocol v1 identifies preparation
generations but not individual exact-frame requests. It cannot guarantee that an export receives
the image requested for frame N. Its continuous/jump branches also differ in tuning and route
reconstruction; matching timestamps alone does not prove history-independent visual parity.

## Proposed decision

One visuals-owned Wormhole context per renderer context owns tuning interpolation, preset
application, director, decays, event cursors and identity simulation. A host chooses either its
existing identity path or the embedded context for Wormhole, never both. Other identities keep
their existing p5/backend and renderer-owned crossfade/PostFX paths.

Composition provides a resolved, copied tuning seed: raw tuning, macros, Advanced boosts, depth
cue and presentation policy. No host UI objects or host scene imports enter visuals/types.
XR supplies its existing XR defaults; dashboard/MVP supply their own current policy. The source
must not implicitly substitute XR defaults for those supplied values. Plan and asset resolution
remain offline and revision-checked. A ready context does not fetch mutable presets per frame.

Proposed small interfaces, to be implemented in the owning tasks:

| Contract | Owner | Required behavior |
| --- | --- | --- |
| Wormhole context seed v1 | visuals/config, lightweight type in types | Analysis/plan identity, resolved preset assets, tuning seed, policy/version; immutable per preparation |
| Preview adapter | visuals | Preserve CanvasVisualSource latest-frame behavior and staged/shown ownership |
| Exact-frame adapter | visuals + export | Promise for a requested frame or explicit error; no stale-image substitution |
| Frame identity | types | `{contextId, generation, requestSerial, songTime}` echoed by image and companion data |
| Render result lease | visuals | Bitmap and carrier buffers owned until release; release idempotent; stale/cancelled results closed/returned |

Exact time is `frameIndex/fps` supplied by export; live time remains AudioEngine-owned.
Export requests bypass preview lead, pacing and unchanged-frame rate caps. At most one render
request is in flight per context, at most one pending result; the existing maximum three-buffer
carrier pool remains bounded. Image, focal, material, lines and spatial data form one atomic
frame identity, including during upload/pass-ahead presentation.

For exact worker rendering propose protocol v2 with an explicit capability handshake and echoed
frame identity on success/error/unchanged. Keep the v1 preview adapter during migration; refuse
exact rendering against a v1 worker and choose an exact-capable local context, or report the
capability failure. Do not label a delayed v1 preview response as an exact export frame.
Version change, adapters and purity tests must land together under one owner.

Deterministic time sampling is a separate gate: evaluate or reconstruct morph/route/director
state from the same song-time anchors/checkpoints with shared pure functions. Fixed replay steps
are based on song time, never display frame count. Seek, repeated frame and 24/36/60 Hz history
fixtures must agree within declared geometry/pixel tolerances before exact rendering is accepted.
No second semantic planner or detector is introduced. Current parity is not presumed.

### Signed spiral (T04)

Keep wormholeSpiral's current nonnegative magnitude and legacy default. Propose a separate
config-owned `wormholeSpiralDirection` numeric tuning value in [-1,1], default +1, with
`effectiveTwist = resolvedMagnitude * resolvedDirection`. This is a proposal, not a present key.
Direction has no macro/Advanced gain; a transition interpolates signed effective twist through
zero, retaining phase rather than restarting the field. Define the interpolation in one helper
so interpolating magnitude and direction separately cannot introduce a different trajectory.

Propose optional top-level point `spiralDirection: -1 | 1` in PerformanceAutomationPoint (beside
bendMirror, not in semantic meta), with absent = legacy +1. The paired adapter selects opposite
directions only for explicitly mirrorable Wormhole targets; authored directional identities
retain their authored behavior. It applies the direction once at preset resolution. Reapplying a
point is idempotent. bendMirror continues to mirror horizontal path bend only.

T04 must register owner/default/range/normalization/preset/storage and transfer support together.
Plan version 1 may retain an additive optional field only with legacy-payload tests and a writer
that preserves it in sessions and undo snapshots. Existing readers may drop the field; do not
promise round-trip fidelity through an older application. Persisted default remains +1.
Raster and spatial consumers receive the resolved signed frame, not another mirror instruction.
Inventory arm/weave/wall/lens rules in T04; lens swirl, local turbulence and path bend stay separate
unless their law explicitly uses coherent twist. No camera or canvas roll is a replacement.

### Native 3D (T06, experimental)

Keep canvas/hybrid as compatibility behavior. Propose opt-in `presentationMode`:
`canvas | hybrid | native3d`, normalized to each host's current mode when absent or unsupported.
Thread choice remains independent. A native spatial-carrier schema must be separate from raster
carriers, produced from the original preprojection geometry and versioned independently as v1.
It must name coordinate system (stage-relative metres, +y up, forward -z), units, record stride,
stable element IDs, bounded counts, time/frame identity, ownership and release law before code.
T06 will supply the element-specific record layouts after the grains/trails inventory; this ADR
does not pretend to specify unknown haze/lens/skybox geometry in one DTO.

## Rollout, governance and rollback

T06a now delivers the first, separately labelled `native-grains` spike. Hybrid remains default.
Its source uses the shared private context/identity and a new spatial v1 grain schema captured
before projection, with no background raster surface/worker. XR consumes it in one instanced
draw per eye. The requested mode is a persisted/copied XR renderer preference; artistic grain
parameters remain preset-owned. Unsupported/failed native creation/preparation falls back to
Hybrid; switching back disposes native geometry and restores saved raster settings. The complete
native3d mode is not delivered: the inventory explicitly lists the missing material, wall,
background and optic families. See [T06a contract](../audits/xr-native-wormhole-contract.md) and
[validation](../audits/xr-native-grains-validation.md). Physical Quest gates remain unmeasured.

T05 extraction and host adaptation, exact sampling and worker-v2 integration are separate slices;
T06 is separately gated. Proposed flags `sharedWormholeContext` and `nativeWormhole3d` start off;
flags are composition-injected choices, not conditionals spread through domain code.
Existing semantic flags retain their checked-in values. Do not flag-gate normal Visual OS generation.

Before implementation, update applicable composition exceptions and tests together if new shared
factory imports are required. Moving an XR GPU pass into shared visuals requires removing its
Three dependency or adding an explicit reviewed boundary; other hosts cannot import xr/scene.
Canonical AGENTS/architecture changes are not implicitly authorized by this proposal.
Rollback selects each host's existing path and disposes the new context; legacy assets/keys remain
readable. No existing preset/golden is rewritten as a rollout mechanism.

## Acceptance

T04: grain/spatial/preset-transfer/seek parity, left/right pair, continuous zero crossing and no
double mirror. T05: existing renderer crossfade/PostFX, chroma/transparency, macro gain and
MVP history behavior preserved; WebGL/context-loss/fallback smoke across three hosts. Exact path:
frame identity, stale responses, dispose/cancel and deterministic history tests, plus decoded
frame comparisons. T06: complete element inventory and real stereo/occlusion measurements.
Quantitative promotion gates are in the execution plan; physical Quest evidence is required to
promote a new XR default. At T01 all new capabilities remain unimplemented/unmeasured.

## T05c exact capability delivery (2026-10-24)

The separate exact contract is now implemented in `WormholeExactFrame.ts`, with local
`WormholeExactFrameSource` and worker `WormholeExactWorkerSource` adapters. Composition must
select an exact adapter explicitly. No live host or exporter is silently switched to it.
The existing v1 preview proxy and its pacing/lead behavior remain compatible.

Protocol v2 negotiates `fixed-song-60-v1` and a context identity before preparation can succeed.
Exact requests name context, preparation generation, monotonic request serial, frame index,
fps and the exact `frameIndex / fps` song time. A success echoes that identity around one
transferred bitmap and its focal/material/line/spatial payload; an error echoes it as well.
Preview `unchanged` is never an exact success. Wrong/stale identities close and return the
received frame without settling a newer request. A v1 peer fails capability negotiation.

One request or one result lease is allowed per exact adapter. Idempotent release closes its
bitmap and transfers the carrier buffer back. Worker material and line views share that one
buffer. Local leases copy only valid records. Preparation supersession settles pending work;
cancellation, disposal, worker error and deadline terminate an exact worker and close owned
results. Local bitmap creation is also guarded after the asynchronous copy. The existing
preview pool remains limited to three; exact mode additionally permits only one leased frame.

Deterministic reconstruction rewinds the private context to its immutable analysis and already
resolved preset assets, then executes the same context/identity at song-zero-based 60 Hz ticks
and one exact fractional endpoint. It includes tuning, director, route, release state and
signed automation, with no asset refetch, second plan generator or wall-clock classification.
All requests replay from zero; memory is bounded but cost grows linearly with requested song
time for each frame. The worker has a 120-second request deadline; local replay is synchronous.
This is an offline correctness foundation. Efficient checkpoints, full-length encoded video,
export workflow integration and comparison with the existing live preview remain T19 gates.
No claim is made that the old cadence-dependent live path now produces the canonical exact image.

Desktop checks include 24/36/60 Hz preview histories, repeat/fractional/backward requests,
real identity/material geometry and browser Canvas2D/WebGL local-versus-worker bitmap pixels.
See [validation](../audits/xr-exact-frame-validation.md). T06 native 3D and OffscreenCanvas
replacement remain separate; no new player setting or preset parameter is introduced here.

## T04a implementation status (2026-10-24)

The signed-direction subsection is now partially implemented: preset-owned direction, signed
morph helper, explicit spiral-pair permission, optional plan transfer, initial raster/spatial
consumer support, and persisted XR Auto/Left/Right override. The user's later clarification makes
preset configuration the base authority; an absent point follows authored direction (legacy +1).
Direction affects only active coherent material/twist and adds no macro/Advanced gain. Existing
factory tuning values remain intact, with an explicit +1 direction added to the ten configs.
See [T04a audit](../audits/xr-signed-spiral-validation.md) and ADR-009 AL for the exact implementation.
T04b consumer/history/seek/export acceptance remains pending. T05 context extraction, exact
sampling/worker-v2 and T06 native 3D remain proposals; this update does not accept the entire ADR.

Preset Straight (`wormholeSpiralDirection: 0`) also disables automatic pair variation. An explicit
XR player Left/Right selection remains a manual override; Auto returns to preset/plan authority.

## T04b consumer/history delivery (2026-10-24)

The directional coherent channel now uses shared absolute preset/plan/gain anchors after the
ordinary tuning morph in the source and the Studio/MVP renderer host. A matching authored
transition id/time prevents its visual disturbance from restarting on first observation after
seek. Legacy all-right paths and independent semantic transitions retain their prior owners.
Actual grain/arm/weave, optics, export-time, worker and XR signed consumer evidence is in the
[T04b audit](../audits/xr-spiral-history-validation.md). This accepts the T04 signed-channel scope.
General route/director/context reconstruction, exact worker export, compositing and cross-backend
pixel parity remain T05 gates. Neither encoded-video parity nor physical Quest performance is
promoted by this delivery. The remainder of this ADR retains its proposed status.

## T05a context/policy extraction (2026-10-24)

`WormholeFrameContext` now owns the embedded source's private tuning, preset/semantic runtime,
signed timeline, transient/modulation/director state and one identity. It has no canvas, cadence,
wall clock or asset IO. The existing `WormholeCanvasSource` owns preparation revisions, fetches
only supplied-plan assets, decides accepted preview steps and draws/presents that context's identity
once. The worker still wraps this source; protocol v1, buffer bounds and preview behavior remain.

`types/WormholeContext.ts` defines the copied version-1 host tuning/policy seed: unboosted raw
tuning, macro positions, Advanced positions, raw/meta gain mode and semantic policy. The common
context requires it and imports no XR defaults. The compatibility source supplies existing XR
defaults only when its optional explicit seed is omitted. Raw mode supports Studio's control
semantics; meta mode resolves supplied MVP/XR gains once. This is an internal ownership seam,
not a new player option or preset toggle. Relevant authored visual choices stay in presets.

Analysis and plan remain borrowed immutable host publications; resolved preset objects are copied
and published together after the adapter's revision check. The signed helper accepts the same raw
seed for initial anchors, preserving its existing default for prior Studio/MVP callers. No new
planner, event stream, director, clock or gameplay calculation was introduced. The architecture
contract moves the former adapter's explicit analyzer/automation/semantics exception to the context.

Studio/MVP still run their existing renderer and composition path. T05b owns their actual backend
handoff and crossfade/PostFX/chroma/transparency/context-loss acceptance. T05c owns general
deterministic sampling, exact frame identity/lease and worker-v2 capability negotiation; the new
context is still a history-dependent preview simulation outside the signed channel. No exact
export, cross-backend pixel or physical Quest parity is claimed. See the
[T05a audit](../audits/xr-frame-context-validation.md) for cumulative and retained-source evidence.

## T05b host backend/composition delivery (2026-10-24)

Studio/MVP use the proposed existing-identity-path option: their renderer already owns live/export
tuning, semantic projection, event cursors and director updates. The common WebGL backend receives
that resolved frame through renderer-owned `WormholeRasterPass`; no embedded XR simulation is run
beside it. This preserves current Studio raw controls, MVP gains and host-specific history instead
of silently substituting XR policy. XR continues to use its private T05a context and the same backend.
This is a presentation handoff, not a claim that general simulation/history is unified; T05c/T19
remain responsible for exact sampling and isolated job snapshots.

One lazy GPU surface per renderer supports CSS geometry plus backing density, reusable size changes,
explicit transparent video-background clearing and finished-frame copying. The p5 target resolver
selects live, crossfade or offscreen export output. The transition controller delegates identity
drawing to the renderer but keeps its one shared-simulation owner and source-over weights. PostFX
continues after the final composite once. Renderer removal disposes GPU resources. Missing WebGL
or context loss falls back once to compatibility drawing; it never redraws an already advanced
identity to hide a failure. A context loss in the existing XR source uses its typed worker/host
failure path rather than silently presenting new blank frames.

Rollout is opt-in: existing Preview quality settings also expose Wormhole renderer, default
Compatible versus WebGL (experimental). The device preference persists in localStorage and Copy
preview settings. This choice is independent of artistic presets and musical undo/session slices;
restoring a musical workspace does not replace another device's renderer capability choice.
Cycling Compatible then WebGL explicitly retries an unavailable/lost context. Existing XR defaults
are unchanged. Browser A/B tolerances and retained evidence are in the
[T05b audit](../audits/xr-shared-backend-validation.md). Encoded-video and physical Quest parity
remain unmeasured; worker-v2 exact-frame capability is not enabled by this delivery.
