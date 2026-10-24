# ADR-008: MVP Host and Shared Renderer

## Status

Implemented; documents the existing local integration. Validation gaps are tracked in
the [integration audit](../audits/mvp-renderer-integration-audit.md).

## Date

2026-09-22

## Context

A focused music-video workspace needs a simpler UI, its own canvas container and relative
artistic controls while keeping the dashboard's audio, Visual OS, rendering and export
behavior. Its files now live under `src/ui/mvp/`; relying on an undocumented analogy to
DashboardUI leaves its composition and export imports ambiguous.

## Decision

- Vite has two HTML entries. `src/main.ts` composes the dashboard and `src/ui/mvp/main.ts`
  composes MVP. The latter is an explicit composition exception under the UI directory,
  not permission for other UI components to instantiate renderers or audio engines.
- MvpUI composes leaf DOM components; MvpVisualController is the application facade,
  equivalent in responsibility to DashboardUI. It requests AudioEngine actions, owns UI
  plan/preset state handoffs and treats WebMExporter as a workflow boundary. Its suffix
  does not make it a leaf controller.
- The two hosts instantiate the shared StyleRegistry/PlexusRenderer. Canvas sizing and
  preview policy enter through explicit host options; renderer/backend modules own all
  drawing, retained targets and pause invalidation. Export keeps its own sampling policy.
- Relative macros and advanced controls project raw tuning into a host-owned scratch
  output before renderer morphing. Raw preset/semantic tuning remains authoritative.
  Reuse is safe only with value-based consumers, including the paused preview gate.
- Pure plan edits and scaled plan views are shared automation utilities. Semantic domain
  code remains headless. Current UI orchestration helper extraction is partial: Dashboard
  still owns its established trigger/semantic bodies and preset cache.
- Each page has its own runtime. Browser preference persistence is not cross-tab playback
  synchronization. The original integration introduced no new State schema, worker protocol or audio clock.
  The additive preview-worker contract below preserves State/audio ownership.

## Consequences

Renderer performance fixes benefit both surfaces, while MVP tuning projection is local to
that host. UI and export orchestration are explicit exceptions for the application facade,
not general dependency permission for controls. The nested composition entrypoint remains
an intentional layout exception; future layout changes must update the entry HTML and this
ownership map together.

The feature, acceptance criteria and validation evidence remain separate:
[MVP feature](../features/mvp-workspace.md), [criteria](../acceptance-criteria/mvp-workspace-acs.md),
[performance](../features/playback-performance.md), [architecture contract](../governance/architecture-contract.md).

## Addendum — MVP Offscreen preview (2026-10-24)

The MVP composition root may supply a resolved-frame worker factory to the shared renderer.
The host still resolves preset automation, semantics, macros, morph and director exactly once.
The worker owns only the existing Wormhole identity geometry/material/raster, using private state,
OffscreenCanvas and transferred ImageBitmaps. Shared transport types do not depend on visual
implementations. A bounded 30 Hz / 960 px preview (Reduced 640) keeps main-thread cost low;
this is explicitly a softer preview. Export uses its synchronous full-resolution renderer and
never encodes a pending/late preview bitmap. No isolated export runtime is claimed.

The player selects Offscreen/Compatible/WebGL in Advanced tuning; device persistence and Copy
reuse the existing preview controls. Fresh MVP uses Offscreen; previous choices are preserved.
Failure falls back safely, and teardown/seek/load/generation/bitmap ownership is tested.
See [worker contract](../governance/worker-communication.md#mvp-resolved-frame-preview-worker) and
[review/performance evidence](../audits/xr-review-checkpoint.md).
