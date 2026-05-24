# Platform Operations

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

Use this file for practical platform behavior that affects repeatability in Codex Desktop, Windows PowerShell, sandboxed shells, bundled runtimes, and browser smoke checks.

## Workspace And Shell

- Treat `plexus-engine/` as the active project root. Do not run project commands from sibling historical folders unless explicitly auditing historical docs.
- Use PowerShell-native commands on Windows. Avoid cross-shell command composition for filesystem operations.
- Prefer `rg` for searches and `Get-Content -Raw` for targeted file reads.
- If a parallel shell read fails because of Windows sandbox process setup, retry the same read as a single targeted command before escalating.
- Do not treat unrelated dirty worktree entries outside `plexus-engine/` as part of this project.

## Runtime Discovery

- First try the project package manager command documented by the repo.
- If `bun` is unavailable, try the package-manager equivalent.
- If `bun`, `npm`, or other package-manager shims are unavailable on PATH, use the Codex bundled Node executable with local project entrypoints:

```powershell
& '<bundled-node>\node.exe' 'node_modules\typescript\bin\tsc'
& '<bundled-node>\node.exe' 'node_modules\vite\bin\vite.js' build
& '<bundled-node>\node.exe' --test tests\*.test.mjs
```

- Discover the bundled Node path with the Codex workspace dependency tool when available.
- Do not add dependencies just to make validation runnable when local `node_modules` and bundled Node are sufficient.

## Build And Test Execution

- Split `tsc` and Vite build when package-manager scripts are unavailable, so failures identify either type checking or bundling.
- Record Vite chunk-size warnings separately from failures. A large p5 bundle warning is not a failed build by itself.
- For Node built-in tests, prefer dependency-free `node --test` suites for contract and lifecycle invariants when browser/Web Audio mocking would otherwise require new packages.
- Keep regression tests focused on stable contracts: worker schema, request-id handling, copy-vs-transfer policy, event-index sync, and documented thresholds.

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
