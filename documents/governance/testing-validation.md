# Testing And Validation

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## Validation Matrix

Documentation-only governance changes:

- Check all referenced files exist.
- Check `CLAUDE.md` explicitly inherits from `AGENTS.md`.
- Check supporting docs do not contradict `AGENTS.md`.
- Check policy is not duplicated wholesale across files.

Build-level changes:

- Inspect the available runtime/package manager and the scripts in `package.json`, then start with `npm run build` and `npm test` when those scripts are declared.
- For targeted tests, use `node --test <test-file>` with explicit files.
- If a required script is absent or broken, use `npx`, a local `node_modules/.bin` executable, or a local package entrypoint. For example, when a bundled Node executable is the available Node runtime:

```powershell
& '<bundled-node>\node.exe' .\node_modules\typescript\bin\tsc
& '<bundled-node>\node.exe' .\node_modules\vite\bin\vite.js build
```

- A local-entrypoint fallback for the full test suite is:

```powershell
& '<bundled-node>\node.exe' --test tests\*.test.mjs tests\ui\*.test.mjs
```

- A targeted local-entrypoint fallback uses explicit files, for example:

```powershell
& '<bundled-node>\node.exe' --test tests\ui-interaction.test.mjs tests\timeline-ui.test.mjs tests\contracts.test.mjs
```

- Do not install a dependency only to enable validation. Do not use a Bun-first strategy; use Bun only if it is the only available, working project runner.
- Report the exact commands run and why every runtime or package-manager fallback was used.
- For renderer, UI, or performance-contract changes, include TypeScript checking, a production Vite build, Node tests, and `git diff --check` in the handoff whenever practical. A Vite chunk-size warning is informational unless the task is specifically about bundle splitting or load performance.

Audio playback changes:

- Validate play, pause, resume, seek while playing, seek while paused, rapid seek, load new file during playback, and natural end.
- Confirm old source nodes are stopped, disconnected, and not allowed to fire stale `onended` behavior.

Worker changes:

- Validate success, failure, cancellation, superseded load, request-id mismatch, and deterministic output for the same fixture.
- Validate worker termination in every path.

Analyzer timing changes (tempo / beat / grid):

- The analyzer timing subsystem has two layers of fixtures, kept distinct on purpose:
  - **Regression (golden master)**: `tests/analyzer-golden.test.mjs` compares against snapshots in `tests/fixtures/golden/` with tolerances (+/-15ms on time arrays, 1e-4 scalars, exact counts). These only encode "what the algorithm currently does".
  - **Musical correctness (verification)**: `tests/analyzer-verification.test.mjs` asserts the engine against KNOWN ground truth (tempo metric-match, beat precision, bar precision) for fixtures spanning 70-176 BPM and house/techno/trance/dnb/breakbeat/sparse/breakdown. `strictTempo` fixtures (e.g. drum & bass) must lock the actual beat rate — a half/double read is a failure.
  - Focused suites: `analyzer-metric-ambiguity` (half/double), `analyzer-timing-confidence` (unified confidence), `analyzer-timing-edgecases` (silence, click track, tempo transition, breakdown extrapolation vs. suppressed visual events), `analyzer-dsp` (TempoEstimator / BeatTracker / onset envelope units).
- The current `update-golden-masters` package script is Bun-dependent. Migrating it to a Node-compatible entrypoint is a separate task; in an environment without a working Bun runtime, do not attempt to run or emulate it automatically. Snapshot generation intentionally OVERWRITES baselines and must run ONLY when a timing change is a deliberate, reviewed improvement. Inspect the git diff before committing regenerated snapshots.
- `tests/fixtures/analyzer/headless-baseline.summary.json` is the exact-match contract baseline for the synthetic SaaS/VST fixture; regenerate it deliberately when the algorithm legitimately changes, never to silence an unexplained drift.
- Benchmark/fixture framework changes and timing-algorithm changes are ideally landed as separate commits so a baseline diff makes clear whether the algorithm actually improved.

State/event changes:

- Validate ordered transitions for load, analysis complete, play, pause, seek, stop, and end.
- Validate beat event index reset and no duplicate event playback after seek.

Visual changes:

- Run a render smoke check in a browser when practical.
- Confirm canvas is nonblank, particles remain bounded, shockwaves expire, and the draw loop does not allocate unbounded persistent objects.
- For visual identity or style-registry changes, run the browser-free deterministic style harness (`node --test tests/styles-deterministic.test.mjs`) or explain why it was not applicable.
- If in-app browser automation cannot reach a transient local dev server, verify server startup and HTTP status with a short-lived shell job, then report browser smoke as not completed.

Visual identity transition changes:

- Run `node --test tests/visual-mode-transition.test.mjs tests/wormhole-depth-integrity.test.mjs tests/wormhole-lifecycle.test.mjs` plus `tests/contracts.test.mjs` and `tests/styles-deterministic.test.mjs` when the shared identity contract changes.
- `computeCrossfadeAlpha` coverage must pin start, midpoint, completion, and backward-song-time behavior. Transition request coverage must pin synchronous logical switching, no paused dual render, live/export clock anchoring, and the `0.1..4.0` duration clamp.
- Compositor regressions must assert two persistent targets, per-active-frame clearing, `source-over`, and the true `A * (1 - alpha) + B * alpha` weights. Additive `lighter` blending is forbidden.
- Controller regressions must assert that compositing runs only during an active transition, completion returns to the direct steady-state path, and `State.visualMode` has one runtime writer.
- Transition ownership coverage must keep record creation/replacement in `requestVisualModeChange()` and completion cleanup in the renderer-owned controller. Effect modules must not own compositing or transition state.
- Shared simulation gating must prove that one participant advances shared particle/shockwave pools exactly once. Incoming normally owns advancement; when it does not use the shared pool, eligible outgoing owns it and the other participant receives `advanceSharedSimulation: false`.
- Wormhole determinism coverage must include immutable depth-phase uniformity under a moving horizon, authored coherence determinism, repeated seeks without accumulated density damage, identical tunnel and curved-galaxy geometry after different histories, and automation-transition re-arming after backward seek.

Semantic dramaturgy layer changes (ADR-003):

- **Semantic Determinism Test (required).** Identical `TrackAnalysis` must produce identical narrative, intent, Visual Score, and choreography plans, independent of the selected style. Assert this with `node --test tests/semantics.test.mjs tests/visual-score-dsl.test.mjs`.
- Confirm the Visual Score survives a JSON stringify/parse round trip, every adjacent motif has a transition, fast BPM uses coarse subdivisions, slow BPM retains internal variation, and low timing confidence falls back to phrase/section timing.
- Confirm cascade, grow, and shrink produce measurably different resolved tuning outputs through propagated motif intensity/density/motion fields, and long transitions contain more than three progress samples.
- Confirm the layer stays headless: no p5, DOM, `src/state/`, `src/visuals/`, `src/ui/`, or `src/audio/` imports under `src/semantics/` (guarded by a test).
- Confirm `SemanticResolver` keeps every resolved parameter within `visualTuningControls` min/max bounds for all styles, including saturated/empty choreography input.
- Confirm channel separation: the resolver writes only `State.targetTuning`; the modulation bus and `directorOutput` remain FSM-owned.
- Confirm `featureFlags.semanticResolver` defaults off and that the legacy `performancePlan` path is unchanged when off (run `node --test tests/styles-deterministic.test.mjs` and `tests/contracts.test.mjs`).

UI changes:

- Validate disabled/enabled states, dashboard text, BPM badge, seek bar, time display, and responsive layout.

Documentation and governance changes:

- Verify every referenced governance file exists.
- Verify `AGENTS.md` remains the only canonical root policy and `CLAUDE.md` remains a thin inheritance shim.
- Prefer adding platform-specific operating rules to `platform-operations.md` instead of scattering shell/runtime advice across subsystem docs.

Diff export and handoff checks:

- When preparing a PR summary, final handoff, or large-change review, consider running `.\diff_export.ps1 -BaseBranch <branch>` from `plexus-engine/`.
- If `branch_pr_snapshot.md` is generated, verify it is not staged for commit and use it only as a local review artifact.
- Report whether the snapshot was generated, skipped as unnecessary, or blocked by network/execution policy.

## Reporting Requirements

Every final report must state:

- Validation commands run.
- Manual checks performed.
- Checks not run and why.
- Residual risk.
- Every runtime or package-manager fallback used, with the reason and exact command.
- Whether browser smoke validation was full browser automation, HTTP-only, or skipped.
- Whether `diff_export.ps1` was used when the task involved PR-style review, handoff, or broad change summarization.

## Minimum Gate For Risky Areas

Changes touching `src/audio`, `src/audio/*.worker.ts`, `src/state`, event indexes, or playback time require build validation and targeted regression notes.
