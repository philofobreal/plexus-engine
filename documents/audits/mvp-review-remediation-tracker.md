# MVP Review Remediation Tracker

Source: governance/anti-pattern review of the local `src/mvp/` diff against `MVP_design.md`,
`AGENTS.md`, `documents/governance/architecture-contract.md`, `documents/governance/anti-patterns.md`.
This file tracks remediation status for every finding from that review. Update the Status column
as work lands; do not delete resolved rows (mark them Done instead) so the review trail stays
intact.

Current layout: MVP modules and the composition entrypoint are under `src/ui/mvp/`, with
`mvp/index.html` as the HTML entry. The earlier proposed outside-UI entrypoint layout did
not match the final source. [ADR-008](../adr/ADR-008-mvp-host-and-shared-renderer.md) and the
[architecture contract](../governance/architecture-contract.md) now name the narrow
composition exception and distinguish the application facade from leaf controls.

This tracker preserves historical finding ids; it is not the product feature specification
or evidence that the entire local diff passes all contracts. The current behavior and
validation gaps are in [MVP workspace](../features/mvp-workspace.md) and the
[integration audit](mvp-renderer-integration-audit.md).

## Status legend

- `TODO` - not started
- `IN PROGRESS` - actively being worked
- `DONE` - fixed and verified (build/tests)
- `DEFERRED` - intentionally not fixing now, with reason noted

## Issues

| # | Priority | Area | Summary | Status |
|---|---|---|---|---|
| 1 | P0 | Runtime correctness | Macro re-apply after preset load clobbers `audioSensitivity`/dramaturgy-profile/several wormhole keys the preset just set - most dramaturgy is effectively a no-op under default macros | DONE |
| 2 | P0 | Runtime correctness | `MomentInspector` time-input path (`updateMoment`) skips `constrainAutomationPointTime` and `points.sort`, breaking the non-overlap invariant and silently dropping automation triggers when order flips | DONE |
| 3 | P1 | Governance / module boundary | `src/mvp/` is an undeclared module with forbidden import directions (WebMExporter, GestureEngine, TimelineCanvas, `src/ui/*` policy modules) - move to `src/ui/mvp/` | DONE |
| 4 | P1 | Governance / ADR-005 | Non-ASCII (em-dashes) in `macroTuningMapper.ts`, the only offending file under the automation tree | DONE |
| 5 | P1 | Governance / ADR-005 | `macroTuningMapper.ts` lives in `src/automation/` (Visual OS domain) but is pure UI-tier tuning-key mapping - relocate under `src/ui/mvp/` | DONE |
| 6 | P1 | Governance / wormhole ownership | `MvpVisualController` hardcodes `wormholeOpticsEnabled = 0` in UI logic; contract says the ownership registry lives in config, not UI logic | DONE |
| 7 | P2 | Testing gate | No tests for the new shared helpers (`constrainAutomationPointTime`, `nudgeAutomationPointTime`, `snapTimeToNearestGrid`, `createAutomationPointAtTime`) or `macroTuningMapper` | DONE |
| 8 | P2 | Performance | No absolute backing-store pixel cap - only a devicePixelRatio cap, so fullscreen on HiDPI can render far above the 720p/1080p tiers the design doc specifies | DONE |
| 9 | P2 | Performance | Per-frame `getBoundingClientRect()` fallback in `p.draw()` forces a layout flush every frame | DONE |
| 10 | P2 | Performance | `JourneyTimeline` redraws on every `setPlayhead` call with no throttle gate (DashboardUI's `shouldDrawTimelineForDashboard` has one, MVP doesn't) | DONE |
| 11 | P2 | Duplication | `MvpVisualController` duplicates ~5 blocks of `DashboardUI` automation-runtime logic (plan view cache, trigger tick, preset preload/apply, semantic plan compute) | DONE (partial, see note) |
| 12 | P3 | Dead code / export UX | `detectExportCapabilities()` is declared but never called; `ExportDialog` always offers 4K with no capability warnings | DONE |
| 13 | P3 | Minor polish | Misc: touch target sizes below 44px on toolbar/nudge buttons, `TimelineToolbar` field-order readability, explicit `visualMode` assertion for the MVP surface | DONE |

## Notes / non-fixes

- `confirm()`-based destructive-action guards (regenerate journey, cancel export) and the
  `xForTime`/`timeAtPercent` read-with-side-effect-on-`State.pan` pattern are both copied 1:1 from
  `DashboardUI`'s own established convention. Not treated as new defects; flagged only if the user
  wants a broader convention change across both surfaces (out of scope for this pass).
- Issue 11 (duplication) was split by risk once `tests/contracts.test.mjs` turned out to lock
  DashboardUI's exact source shape (regex-matching literal variable names and method bodies) for
  `triggerPerformanceAutomation`, `computeSemanticPlan`, and `snapshotSemanticBase` -- an explicit,
  deliberate contract guarding the "morph authority applied atomically with the preset payload,
  never synchronously before it" invariant. Extracted and shared (both DashboardUI and
  MvpVisualController now use them): the morph-scale plan-view cache
  (`src/automation/automationPlanView.ts`). Left duplicated on purpose in DashboardUI, with a new
  shared implementation used only by MvpVisualController (no contract test constrains the MVP
  surface's shape, so no regression risk there): the automation-trigger decision logic
  (`resolveAutomationTrigger` in `src/ui/performanceAutomationRuntime.ts`) and the semantic
  narrative/intent/choreography compute + base-tuning snapshot
  (`computeAndPublishSemanticPlan`/`snapshotSemanticBaseTuning` in `src/ui/semanticPlanRuntime.ts`).
  Left duplicated in both (not attempted): `presetUrl`/`preloadPresetsForPlan`/preset `Map` cache
  and the full `applyPerformancePreset`/`applyAutomationPreset` preset-apply bodies -- DashboardUI
  has 9 call sites around its preset cache (including an `index.json` manifest fetch and a
  dev-preset-save write-back) and a real behavioral difference (publishing to
  `State.preloadedPresets`, which only DashboardUI's preset browser reads), so unifying it would
  touch a much larger, higher-traffic surface of the advanced dashboard for comparatively low
  remaining duplication value. Revisit only if that specific area needs a bug fix anyway.
