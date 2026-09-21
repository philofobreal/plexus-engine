# MVP and Renderer Integration Audit

Follow-up status: the [local development review](local-development-review.md) repairs the
geometry test backends and R1 async handoffs, and records current validation plus the
preset-only comparison. The 818/831 result below is the earlier integration snapshot.

Review date: 2026-09-22. Scope: the local tracked diff against HEAD, staged diff (empty),
and untracked product source/tests/documentation. This is an implementation inventory and
validation record, not a chronological task log or an assertion that the entire diff is
ready to merge. Existing authored preset changes were retained.

## Implementation inventory and ownership

| Capability | Source ownership / changed files | Product contract |
| --- | --- | --- |
| Focused workspace and second production entry | Build: `vite.config.ts`, `mvp/index.html`; composition: `src/ui/mvp/main.ts`; UI: MvpUI, FirstRunScreen, AnalyzingScreen, PreviewStage, TransportBar, QuickTuningDrawer, CSS/format helpers | [MVP workspace](../features/mvp-workspace.md), [ADR-008](../adr/ADR-008-mvp-host-and-shared-renderer.md) |
| Relative character, advanced gains, grain ends and saved track settings | UI: MacroControls, macroTuningMapper, AdvancedTuningPanel, metaTuningBoost, metaTuningStorage, MvpVisualController; config: visualTuning/identityTuningRegistry; shared type: VisualTuningConfig | [MVP tuning](../features/mvp-workspace.md#visual-character-and-advanced-tuning), [MVP-2](../acceptance-criteria/mvp-workspace-acs.md#mvp-2-tuning-projection-and-persistence) |
| Editable musical journey and cached scaled plan | Pure automation: automationPlanEditing/automationPlanView; UI: DashboardUI, MvpVisualController, JourneyTimeline, TimelineToolbar, MomentInspector, IntentInfoPanel | [Journey editing](../features/mvp-workspace.md#journey-editing), [MVP-3](../acceptance-criteria/mvp-workspace-acs.md#mvp-3-journey-and-preset-handoff) |
| Automation and semantic handoff helpers | UI: performanceAutomationRuntime, semanticPlanRuntime; current consumers are documented separately from shared domain logic | [MVP implementation](../features/mvp-workspace.md#implementation-and-validation) |
| Desktop/mobile Reduced load and bounded canvas/material size | Config: previewQuality; UI: PreviewQualityControl/CSS and both entrypoints; visuals: PlexusRenderer, RendererBackend, P5RendererBackend, raster budget selection | [Performance contracts](../features/playback-performance.md), [preview validation](preview-rendering-validation.md) |
| Settled paused image reuse | Visuals: PausedPreviewGate and PlexusRenderer; value-based invalidation, no new playback clock or loop owner | [Paused frame reuse](../features/playback-performance.md#paused-frame-reuse) |
| Export sampling and density-correct transitions | Export: WebCodecsBackend; visuals: P5RenderTargetCompositor, P5RendererBackend; UI: ExportDialog delegates through facade | [Offline export](../features/offline-webm-export.md), [ADR-006](../adr/ADR-006-renderer-owned-visual-identity-crossfade.md) |
| Exact-zero material bypass, discrete budgets and square vector caps | Config: visualTuning; visuals: CosmicWormholeIdentity, backend, wormholeGrainMaterialRaster | [Grain appearance](../features/playback-performance.md), [VT-11](../acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md#vt-11-playback-performance-and-grain-appearance) |
| Bounded scanline coverage, bloom traversal, offscreen rejection, RGBA conversion | Pure raster: wormholeGrainMaterialRaster; surface: CanvasFieldRasterSurface; frozen reference helpers and regression suites | [Material validation](wormhole-material-performance-validation.md) |
| Skybox dome motion, straight-flight cue and continuous spiral-arm morph | Visuals: CosmicWormholeIdentity, WormholeCosmicSync; angular-agreement regression | [Skybox and spiral behavior](../features/visual-identities.md#skybox-heading-and-spiral-interpolation) |
| Authored wormhole roles | Data: vos-wh-establish/drive/sparse/drift/overdrive/punch JSON; no preset edits during this review | [Current preset tuning](../features/wormhole-clip-profile.md#current-preset-tuning) |

Tests additionally cover automation editing, export determinism, morph completion, depth
test-backend support, material integration/raster/surface behavior, macro bounds, line
caps, paused rendering, preview quality/density/budgets and frozen bloom/culling/conversion
equivalence. Documentation changes update features, acceptance criteria, architecture and
validation together. The old performance-step reports are consolidated into the two
topic-specific validation documents above; measurement counts are preserved as historical
evidence, not added together. Stable ADR/acceptance/finding identifiers remain identifiers.

The local `.claude/settings.local.json` is a tool setting, not product functionality, and
is excluded from this product inventory. No dependency, analyzer, worker protocol, shared
State shape or audio lifecycle implementation change was found in this diff.

## MVP tuning projection validation

The mapper now accepts the existing host scratch output and initializes its macro-key
array once. It removes a partial object plus an Object.keys array per projection call.
The raw-copy, macro arithmetic/clamping and advanced-gain order remain unchanged. The
fresh-output API is preserved. This is allocation-count reasoning; no FPS/GC benchmark
was performed and other frame allocations are not claimed to be eliminated.

The 1,000-case Node regression varies raw values/macros, compares every mapped result,
checks reused identity, input immutability and retention of unmapped fields. A real-browser
fixture repeated 1,000 cases / 21,000 exact value comparisons. The same fixture loaded a
generated 40-second 120 BPM kick track through the real MVP file input; analysis finished,
the journey/transport/export controls enabled, and screenshot inspection showed a nonblank
paused preview. This was in-app browser automation, not HTTP-only validation. This run did
not exercise audible playback, fullscreen, mobile hardware or encoded export; prior scoped
preview/export evidence remains in its own report. Temporary fixtures/tabs were removed.

## Full-suite findings

`node --test tests/*.test.mjs tests/ui/*.test.mjs`: **831 tests, 818 passed, 13 failed**.
There were no skipped/cancelled tests. The integration is not fully green. These failures
are outside the MVP mapper's code path and must not be hidden by a performance claim.

| Failing area | Count | Observed result / follow-up |
| --- | ---: | --- |
| Background turn cue, long-run (two cases), vertical bend | 4 | Test backends lack `beginFieldRaster`; material-enabled presets now reach it. Update the fixtures to model the material backend before judging their geometry assertions. |
| Wormhole clip profile | 4 | Local presets overwrite user-global backgrounds, establish falls below the old opacity floor, depth differs from the old weak-role value, and drift/establish depth ordering differs. The same user-global test also covers material/spiral knobs now authored by presets. Resolve the intended preset contract explicitly. |
| Geometry LFO integration | 1 | Dissolve/drift projected scale contrast is about 0.580/0.492 and fails the old near/far expectation. |
| Preset differentiation | 2 | Drift/establish normalized distance is 0.073388 below 0.09; dissolve/drift authored speed ordering differs. |
| Projected motion | 2 | Measured drive motion exceeds overdrive in the fixture, violating both role ordering and the speed comparison. Preset geometry affects this measurement; do not classify it as a proven transport regression without isolation. |

The ownership-registry test was missing the new `wormholeGrainShape` key. Its expected
owned-key list and user-global classification now include it, without requiring all
factory presets to overwrite the user's line-end choice. A final focused rerun of clip
profile plus macro mapper passed **36/40**, retaining the same four preset assertions;
the owned-key guard and all 13 macro tests pass. Preset expectations were not weakened.

Additional review gaps at that snapshot: MVP post-analysis asynchronous plan/persistence work
lacked a superseded-load guard (now repaired as R1 in the follow-up review); stored tuning has only shallow shape validation;
fingerprinting is based on analysis descriptors, not audio identity. Existing UI helper
extraction is partial, as documented in the [remediation tracker](mvp-review-remediation-tracker.md).
These are inspection findings, not newly reproduced runtime failures or fixes in this turn.

## Reproduction and handoff

Node is available from the Codex bundled runtime; npm is not available. The declared
build/test scripts were run through Node/local package entrypoints without installation:

```powershell
node --test tests/*.test.mjs tests/ui/*.test.mjs
node --test tests/wormhole-clip-profile.test.mjs tests/mvp-macro-tuning-mapper.test.mjs
node --test tests/mvp-macro-tuning-mapper.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git diff --check
```

An initial narrower investigation also ran:

```powershell
node --test tests/mvp-macro-tuning-mapper.test.mjs tests/automation-plan-editing.test.mjs tests/wormhole-angular-agreement.test.mjs tests/wormhole-cosmic-sync.test.mjs tests/wormhole-clip-profile.test.mjs
```

TypeScript and both-entry production build pass; Vite retains its informational >500 kB
chunk warning. Whitespace, current-document local links and governance inheritance were
checked (19 current/changed Markdown files, 88 local links, no missing files or anchors).
AGENTS remains authoritative and CLAUDE a thin shim; the MVP entrypoint/facade
exceptions are now explicit in the architecture map, without expanding leaf-UI ownership.

`diff_export.ps1` was reviewed and skipped: it fetches origin and compares branch history,
whereas this task concerns the existing local working tree. `git diff HEAD`,
`git diff --cached`, `git ls-files --others --exclude-standard` and direct source inspection
provided the inventory. Graphify's launcher was unavailable in this environment; targeted
source searches supplied the ownership verification. No graph rebuild, commit or deployment.

The follow-up review completed the fixture and async handoff repairs. Preset intent, paused
MVP journey seek and per-track defaults remain open; see the linked review before treating the full
integration as ready to merge. User testing remains the gate before another optimization.
