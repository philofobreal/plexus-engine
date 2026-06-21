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

- Bun is the preferred default package manager, compiler, and runner for this repository when it is available on `PATH`.
- Avoid using plain `npm`, `npx`, or package-manager-equivalent commands unless specifically requested.
- First try scripts and tests through the commands declared in `package.json`:
  - Developer environment: `bun run dev`
  - Tests: `bun run test`
  - Production build: `bun run build`
  - Deploy: `bun run deploy`
- If Bun is temporarily blocked or unavailable in the local sandbox shell, fall back to the Codex bundled Node executable with local project entrypoints. This is the recommended fallback in Codex Desktop on Windows when `bun` is not recognized.
- Use the workspace dependency tool to discover the actual bundled Node path. Then run the local project entrypoints directly:

```powershell
& '<bundled-node>\node.exe' 'node_modules\typescript\bin\tsc'
& '<bundled-node>\node.exe' 'node_modules\vite\bin\vite.js' build
& '<bundled-node>\node.exe' --test tests\*.test.mjs tests\ui\*.test.mjs
```

- For targeted test runs, keep the same shape and list explicit test files:

```powershell
& '<bundled-node>\node.exe' --test tests\ui-interaction.test.mjs tests\timeline-ui.test.mjs tests\contracts.test.mjs
```

- Do not add dependencies just to make validation runnable when local `node_modules` and bundled Node are sufficient.

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

## Documentation Drift

- Product/spec history in `v0.1/` and `v0.2/` is reference material only. Current implementation clarifications belong under `plexus-engine/documents/`.
- Prefer a focused addendum document when legacy markdown has encoding drift or broad historical content that would make line-level patching risky.
- Governance documents should contain rules and repeatable process. Product AC clarifications should live in product documentation or a current implementation addendum.
