# Manual Commit Plan

Prepared for local HEAD `0de24b14c674e1ddc4a497a5d16630fae19b1aae` on `master`.
**No staging or commit command in this document has been executed.** Read the
[local review](local-development-review.md) first: R1 is repaired; R2-R5
remain open. The latest full suite is **835/844**, with the same nine preset failures.
These messages describe the current work; they do not certify release readiness.
For a release-ready history, fix the findings and refresh this inventory before committing.

The six product commits follow source dependencies. Pure automation extraction precedes
the renderer and MVP host; authored presets remain separate. Documentation is consolidated
in the final product commit because its feature/audit links describe the complete series.
This is a commit procedure, not numbered product-feature documentation. No interactive
hunk selection, reset, checkout, stash, force push or blanket git add is required.

The source dependency order was checked before the R1 repair in an isolated HEAD copy:
overlaying groups 1-4 in sequence passed TypeScript after each group. Current complete-tree
TypeScript also passes with R1 included. This does not certify intermediate full
test suites or resolve the final integration findings above.

The optional seventh commit accounts for machine-specific tooling separately. All 97
current changed/untracked paths are assigned exactly once (96 product/documentation paths,
1 local tool setting). Ignored build output, dependencies and temporary review artifacts are excluded.

## Before starting

Run in PowerShell. The guard assumes the currently empty index; if you have staged something
since the review, inspect it rather than resetting it. Keep the working tree unchanged between
groups. No branch switch is required; the commands commit on the branch you intentionally
choose before starting. Run each commit block separately and inspect its staged diff.

```powershell
Set-Location -LiteralPath 'C:\novy\Plexus Engine (VJ System)\plexus-engine'
git status --short
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw 'The index is not empty; inspect staged changes before proceeding.' }
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Resolve whitespace errors before staging.' }
```

## 1. Geometry test backends

```powershell
$commitPaths = @(
    'tests/wormhole-background-turn-cue.test.mjs',
    'tests/wormhole-long-run.test.mjs',
    'tests/wormhole-vertical-bend.test.mjs'
)
git add -- $commitPaths
if ($LASTEXITCODE -ne 0) { throw "Staging failed; stop here." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed; stop here." }
git diff --cached --stat
# Inspect the staged diff before running the commit line.
git diff --cached
git commit -m 'test(wormhole): support material-aware geometry fixtures' -m 'Model raster refusal explicitly and keep the long-run star sample isolated from grain-copy growth.'
if ($LASTEXITCODE -ne 0) { throw "Commit failed; stop before the next group." }
```

## 2. Shared automation editing

```powershell
$commitPaths = @(
    'src/automation/automationPlanEditing.ts',
    'src/automation/automationPlanView.ts',
    'src/ui/DashboardUI.ts',
    'tests/automation-plan-editing.test.mjs'
)
git add -- $commitPaths
if ($LASTEXITCODE -ne 0) { throw "Staging failed; stop here." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed; stop here." }
git diff --cached --stat
# Inspect the staged diff before running the commit line.
git diff --cached
git commit -m 'refactor(automation): share timeline editing and plan-view caching' -m 'Reuse pure moment constraints and morph-scale views across UI hosts while preserving raw plans.'
if ($LASTEXITCODE -ne 0) { throw "Commit failed; stop before the next group." }
```

## 3. Shared renderer and preview policy

This includes the current skybox behavior; reconcile R5 before release. Mixed changes in
CosmicWormholeIdentity and visualTuning stay together to avoid ambiguous interactive staging.

```powershell
$commitPaths = @(
    'src/config/identityTuningRegistry.ts',
    'src/config/previewQuality.ts',
    'src/config/visualTuning.ts',
    'src/export/WebCodecsBackend.ts',
    'src/main.ts',
    'src/types/index.ts',
    'src/ui/PreviewQualityControl.ts',
    'src/ui/previewQualityControl.css',
    'src/visuals/CanvasFieldRasterSurface.ts',
    'src/visuals/CosmicWormholeIdentity.ts',
    'src/visuals/P5RenderTargetCompositor.ts',
    'src/visuals/P5RendererBackend.ts',
    'src/visuals/PausedPreviewGate.ts',
    'src/visuals/PlexusRenderer.ts',
    'src/visuals/RendererBackend.ts',
    'src/visuals/WormholeCosmicSync.ts',
    'src/visuals/wormholeGrainMaterialRaster.ts',
    'tests/bloom-smoothing.test.mjs',
    'tests/export-deterministic.test.mjs',
    'tests/grain-line-caps.test.mjs',
    'tests/helpers/legacy-bloom-smoothing.mjs',
    'tests/helpers/legacy-material-carrier.mjs',
    'tests/helpers/legacy-raster-conversion.mjs',
    'tests/material-culling.test.mjs',
    'tests/material-preview-budget.test.mjs',
    'tests/morphing.test.mjs',
    'tests/paused-renderer.test.mjs',
    'tests/preview-quality.test.mjs',
    'tests/raster-conversion.test.mjs',
    'tests/renderer-preview-density.test.mjs',
    'tests/wormhole-angular-agreement.test.mjs',
    'tests/wormhole-clip-profile.test.mjs',
    'tests/wormhole-depth-integrity.test.mjs',
    'tests/wormhole-grain-material-integration.test.mjs',
    'tests/wormhole-grain-material-raster.test.mjs',
    'tests/wormhole-nebula-raster-surface.test.mjs'
)
git add -- $commitPaths
if ($LASTEXITCODE -ne 0) { throw "Staging failed; stop here." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed; stop here." }
git diff --cached --stat
# Inspect the staged diff before running the commit line.
git diff --cached
git commit -m 'feat(renderer): bound preview work and optimize wormhole rendering' -m 'Add selectable reduced preview load, settled-pause reuse, square grain ends and density-correct exports. Optimize material coverage, bloom and RGBA conversion; refine skybox motion and spiral interpolation.'
if ($LASTEXITCODE -ne 0) { throw "Commit failed; stop before the next group." }
```

## 4. MVP workspace

The R1 async handoff repair and its regression suite are included. Open findings R2-R3
still affect this commit; repair them first for a release-ready series.

```powershell
$commitPaths = @(
    'mvp/index.html',
    'src/ui/mvp/AdvancedTuningPanel.ts',
    'src/ui/mvp/AnalyzingScreen.ts',
    'src/ui/mvp/ExportDialog.ts',
    'src/ui/mvp/FirstRunScreen.ts',
    'src/ui/mvp/IntentInfoPanel.ts',
    'src/ui/mvp/JourneyTimeline.ts',
    'src/ui/mvp/MacroControls.ts',
    'src/ui/mvp/MomentInspector.ts',
    'src/ui/mvp/MvpUI.ts',
    'src/ui/mvp/MvpVisualController.ts',
    'src/ui/mvp/PreviewStage.ts',
    'src/ui/mvp/QuickTuningDrawer.ts',
    'src/ui/mvp/TimelineToolbar.ts',
    'src/ui/mvp/TransportBar.ts',
    'src/ui/mvp/macroTuningMapper.ts',
    'src/ui/mvp/main.ts',
    'src/ui/mvp/metaTuningBoost.ts',
    'src/ui/mvp/metaTuningStorage.ts',
    'src/ui/mvp/mvp.css',
    'src/ui/mvp/mvpFormat.ts',
    'src/ui/performanceAutomationRuntime.ts',
    'src/ui/semanticPlanRuntime.ts',
    'tests/mvp-async-lifecycle.test.mjs',
    'tests/mvp-macro-tuning-mapper.test.mjs',
    'vite.config.ts'
)
git add -- $commitPaths
if ($LASTEXITCODE -ne 0) { throw "Staging failed; stop here." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed; stop here." }
git diff --cached --stat
# Inspect the staged diff before running the commit line.
git diff --cached
git commit -m 'feat(mvp): add the focused wormhole workspace' -m 'Add the multi-page entry, transport and journey editor, relative tuning, per-track persistence and shared export UI. Retain scratch output for macro projection. Guard asynchronous plan, preset and storage publication against superseded requests; enable the workspace after accepted preparation.'
if ($LASTEXITCODE -ne 0) { throw "Commit failed; stop before the next group." }
```

## 5. Authored preset changes

Open finding R4 affects this commit. Keep it separate until preset intent and tests agree.

```powershell
$commitPaths = @(
    'public/visual-tuning-presets/vos-wh-drift.json',
    'public/visual-tuning-presets/vos-wh-drive.json',
    'public/visual-tuning-presets/vos-wh-establish.json',
    'public/visual-tuning-presets/vos-wh-overdrive.json',
    'public/visual-tuning-presets/vos-wh-punch.json',
    'public/visual-tuning-presets/vos-wh-sparse.json'
)
git add -- $commitPaths
if ($LASTEXITCODE -ne 0) { throw "Staging failed; stop here." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed; stop here." }
git diff --cached --stat
# Inspect the staged diff before running the commit line.
git diff --cached
git commit -m 'feat(presets): retune wormhole roles and material appearance' -m 'Update six role presets with revised geometry, material and post-FX values. Existing role-contract assertions require explicit reconciliation before release.'
if ($LASTEXITCODE -ne 0) { throw "Commit failed; stop before the next group." }
```

## 6. Product contracts and review evidence

```powershell
$commitPaths = @(
    'AGENTS.md',
    'README.md',
    'documents/acceptance-criteria/mvp-workspace-acs.md',
    'documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md',
    'documents/adr/ADR-006-renderer-owned-visual-identity-crossfade.md',
    'documents/adr/ADR-008-mvp-host-and-shared-renderer.md',
    'documents/audits/local-change-commit-plan.md',
    'documents/audits/local-development-review.md',
    'documents/audits/mvp-renderer-integration-audit.md',
    'documents/audits/mvp-review-remediation-tracker.md',
    'documents/audits/preview-rendering-validation.md',
    'documents/audits/wormhole-material-performance-validation.md',
    'documents/audits/wormhole-nebula-grain-material-architecture-gate.md',
    'documents/features/mvp-workspace.md',
    'documents/features/offline-webm-export.md',
    'documents/features/playback-performance.md',
    'documents/features/visual-identities.md',
    'documents/features/visual-tuning-presets-and-playback-ui.md',
    'documents/features/wormhole-clip-profile.md',
    'documents/governance/architecture-contract.md',
    'documents/implementation/current-typescript-implementation.md'
)
git add -- $commitPaths
if ($LASTEXITCODE -ne 0) { throw "Staging failed; stop here." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed; stop here." }
git diff --cached --stat
# Inspect the staged diff before running the commit line.
git diff --cached
git commit -m 'docs: align MVP and renderer documentation with implemented behavior' -m 'Organize feature contracts, acceptance criteria and topic-based validation; record ownership, open review findings and the manual commit plan.'
if ($LASTEXITCODE -ne 0) { throw "Commit failed; stop before the next group." }
```

## 7. Optional machine-specific Claude configuration

Not recommended for shared product history: this contains local paths and broad tool
permissions. Omit this block to leave it untracked. It is included only to account for a
literal commit of every local file; do not execute commands embedded inside the JSON.

```powershell
$commitPaths = @(
    '.claude/settings.local.json'
)
git add -- $commitPaths
if ($LASTEXITCODE -ne 0) { throw "Staging failed; stop here." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed; stop here." }
git diff --cached --stat
# Inspect the staged diff before running the commit line.
git diff --cached
git commit -m 'chore(claude): record local tool permissions' -m 'Record the reviewed local permission allowlist separately from product code.'
if ($LASTEXITCODE -ne 0) { throw "Commit failed; stop before the next group." }
```

## After the selected blocks

```powershell
git status --short
git log -7 --oneline
```

If the optional tooling block was omitted, only `.claude/settings.local.json` should remain
untracked (assuming no intervening work). No push is included. A successful git commit does
not imply passing tests; validation commands and outstanding failures are in the review.
