# Platform Operations

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

Use this file for practical platform behavior that affects repeatability in Codex Desktop, Windows PowerShell, sandboxed shells, bundled runtimes, and browser smoke checks.

## Workspace And Shell

- Treat `plexus-engine/` as the active project root. Do not run project commands from sibling historical folders unless explicitly auditing historical docs.
- Use PowerShell-native commands on Windows. Avoid cross-shell command composition for filesystem operations.
- Prefer `rg` for searches and `Get-Content -Raw` for targeted file reads.
- If a parallel shell read fails because of Windows sandbox process setup, retry the same read as a single targeted command before escalating.
- Do not treat unrelated dirty worktree entries outside `plexus-engine/` as part of this project.

## Runtime Discovery and Execution Policy

- Before validation, inspect `package.json` and determine which runtime and package manager are actually available in the environment.
- Start with the project's declared scripts using an environment-compatible Node/npm invocation, normally `npm run dev`, `npm test`, or `npm run build`.
- The current `deploy` script invokes Bun internally. Do not treat it as a normal Node/npm validation command or run it automatically in a Bun-free environment.
- For a targeted Node test, use `node --test <test-file>`.
- If a declared script is absent or broken, use `npx`, a local `node_modules/.bin` executable, or the package's local Node entrypoint. When Codex Desktop provides the only working Node executable, discover its path with the workspace dependency tool and use it with the local project entrypoint:

```powershell
& '<bundled-node>\node.exe' 'node_modules\typescript\bin\tsc'
& '<bundled-node>\node.exe' 'node_modules\vite\bin\vite.js' build
& '<bundled-node>\node.exe' --test tests\*.test.mjs tests\ui\*.test.mjs
```

- For targeted test runs, keep the same shape and list explicit test files:

```powershell
& '<bundled-node>\node.exe' --test tests\ui-interaction.test.mjs tests\timeline-ui.test.mjs tests\contracts.test.mjs
```

- Do not install or add dependencies only to make validation runnable.
- Do not use a Bun-first strategy. Use Bun only if runtime discovery shows it is the project's current, working runner and no suitable Node/npm/npx route is available.
- Report every runtime or package-manager fallback, including why it was needed and the exact command used.

## Build And Test Execution

- Split `tsc` and Vite build when package-manager scripts are unavailable, so failures identify either type checking or bundling.
- Record Vite chunk-size warnings separately from failures. A large p5 bundle warning is not a failed build by itself.
- For Node built-in tests, prefer dependency-free `node --test` suites for contract and lifecycle invariants when browser/Web Audio mocking would otherwise require new packages.
- Keep regression tests focused on stable contracts: worker schema, request-id handling, copy-vs-transfer policy, event-index sync, and documented thresholds.

## Diff Export Workflow

- `diff_export.ps1` is the repository-owned PR snapshot tool. Agents should recognize it and consider it before reviews, handoffs, PR preparation, large-change summaries, or when the user asks for a complete diff/context export.
- The script writes `branch_pr_snapshot.md`, which is intentionally ignored by Git. Treat the generated file as a local review artifact, not source documentation.
- The script compares the current branch against a base branch, defaulting to `main`. Pass `-BaseBranch <branch>` when the target branch is known to be different.
- The script may run `git fetch origin <base>`. If network access is blocked or escalation is required, ask for approval only when the snapshot is actually needed for the task.
- Use the generated snapshot as input for summarizing, reviewing, or transferring context. Do not edit source files based only on the snapshot when the live working tree can be inspected directly.
- Regenerate the snapshot after material code or documentation changes if the previous snapshot is being used for a final review, PR description, or handoff.
- If the script cannot run, fall back to targeted `git diff`, `git diff --cached`, `git diff --name-only`, and direct file reads, then report that the snapshot was not generated.

## Dev Server And Browser Smoke Checks

- Browser smoke validation is best-effort unless the task explicitly requires interactive manual QA.
- Prefer a short-lived server job that verifies HTTP reachability, then stop the job after the check.
- On Windows/Codex, `Start-Process` may create a process that does not expose the dev server to later sandboxed checks. If that happens, use a PowerShell job or a foreground command with a short timeout to confirm the server can start.
- A successful HTTP status check is an acceptable minimal smoke check when in-app browser automation cannot reach the transient server.
- If browser automation fails after a confirmed HTTP check, report the browser limitation separately from build/test status.
- The in-app browser screenshot tool has repeatedly timed out against this project's live canvas across unrelated sessions (observed again during the 2026-08-16 wormhole documentation audit, unrelated to any code change). Do not retry it in a sleep loop; fall back immediately to one of:
  - A live dev-server pass through the real UI (`javascript_tool`/DOM `select`/`change` events) that confirms the target visual mode and every relevant preset load without console or server errors. This proves wiring but not pixel content, and typically cannot render a canvas frame without an audio file loaded (the p5 canvas commonly stays sized `0x0` until playback starts).
  - For pixel-level or per-frame verification of renderer/effect-module changes, dynamically `import()` the real compiled ESM modules (e.g. `/plexus-engine/src/visuals/...`) into a scratch script, construct a small hand-built Canvas2D mock `VisualRendererBackend`, drive the real `draw()`/effect functions directly with deterministic fixture state (no `Math.random`, explicit `travelDistance`/`canonicalTime`), and read back `line()`/`glow()` call counts or `getImageData()` brightness statistics. This has been the working substitute across the wormhole membrane-wall and gravitational-lens work (see `../audits/wormhole-wall-membrane-plan.md`, `../audits/wormhole-lens-overhaul-plan.md`, `../audits/wormhole-true-lens-plan.md`) and should be reused instead of re-deriving it per task.
  - Report explicitly which of the two above was used, and that the in-app screenshot path was skipped after a timeout, per the Reporting Requirements in `testing-validation.md`.

## Documentation Drift

- Product/spec history in `v0.1/` and `v0.2/` is reference material only. Current implementation clarifications belong under `plexus-engine/documents/`.
- Prefer a focused addendum document when legacy markdown has encoding drift or broad historical content that would make line-level patching risky.
- Governance documents should contain rules and repeatable process. Product AC clarifications should live in product documentation or a current implementation addendum.
