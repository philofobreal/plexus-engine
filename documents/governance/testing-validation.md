# Testing And Validation

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## Validation Matrix

Documentation-only governance changes:

- Check all referenced files exist.
- Check `CLAUDE.md` explicitly inherits from `AGENTS.md`.
- Check supporting docs do not contradict `AGENTS.md`.
- Check policy is not duplicated wholesale across files.

Build-level changes:

- Run `bun run build` from `plexus-engine/`, or the package-manager equivalent if Bun is unavailable.
- If package-manager shims are unavailable on PATH, use the Codex bundled Node executable with local `node_modules` entrypoints for `tsc`, Vite, and Node test runs.
- When using the bundled Node fallback, report the exact commands run and why the fallback was used.
- For renderer, UI, or performance-contract changes, include TypeScript checking, a production Vite build, Node tests, and `git diff --check` in the handoff whenever practical. A Vite chunk-size warning is informational unless the task is specifically about bundle splitting or load performance.

Audio playback changes:

- Validate play, pause, resume, seek while playing, seek while paused, rapid seek, load new file during playback, and natural end.
- Confirm old source nodes are stopped, disconnected, and not allowed to fire stale `onended` behavior.

Worker changes:

- Validate success, failure, cancellation, superseded load, request-id mismatch, and deterministic output for the same fixture.
- Validate worker termination in every path.

State/event changes:

- Validate ordered transitions for load, analysis complete, play, pause, seek, stop, and end.
- Validate beat event index reset and no duplicate event playback after seek.

Visual changes:

- Run a render smoke check in a browser when practical.
- Confirm canvas is nonblank, particles remain bounded, shockwaves expire, and the draw loop does not allocate unbounded persistent objects.
- For visual identity or style-registry changes, run the browser-free deterministic style harness (`node --test tests/styles-deterministic.test.mjs`) or explain why it was not applicable.
- If in-app browser automation cannot reach a transient local dev server, verify server startup and HTTP status with a short-lived shell job, then report browser smoke as not completed.

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
- Any runtime fallback used, such as bundled Node instead of `bun` or `npm`.
- Whether browser smoke validation was full browser automation, HTTP-only, or skipped.
- Whether `diff_export.ps1` was used when the task involved PR-style review, handoff, or broad change summarization.

## Minimum Gate For Risky Areas

Changes touching `src/audio`, `src/audio/*.worker.ts`, `src/state`, event indexes, or playback time require build validation and targeted regression notes.
