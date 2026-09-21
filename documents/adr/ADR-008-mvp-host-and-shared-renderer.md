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
  synchronization. No new State schema, worker protocol or audio clock is introduced.

## Consequences

Renderer performance fixes benefit both surfaces, while MVP tuning projection is local to
that host. UI and export orchestration are explicit exceptions for the application facade,
not general dependency permission for controls. The nested composition entrypoint remains
an intentional layout exception; future layout changes must update the entry HTML and this
ownership map together.

The feature, acceptance criteria and validation evidence remain separate:
[MVP feature](../features/mvp-workspace.md), [criteria](../acceptance-criteria/mvp-workspace-acs.md),
[performance](../features/playback-performance.md), [architecture contract](../governance/architecture-contract.md).
