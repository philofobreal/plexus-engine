# Anti-Patterns

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

Stop and redesign if a change introduces any pattern below.

## Architecture Anti-Patterns

- Hidden shared state writes without a documented owner.
- Circular dependencies between audio, UI, renderer, worker, and state modules.
- Importing runtime-heavy dependencies into `src/types/`.
- Worker code importing DOM, p5, UI, renderer, or shared mutable state.
- UI code reaching into worker internals or DSP implementation details.
- Renderer code controlling playback lifecycle.

## Semantic Layer Anti-Patterns (ADR-003)

- **Physical Preset Coupling in Dramaturgy.** Hard-coding physical preset names or file names (for example `temporal1.json`) into the music analysis, narrative, intent, or choreography stages. The semantic chain must stay style- and preset-independent; preset binding belongs to `SemanticResolver` / the automation layer.
- **String-Based DSL Parsers.** Introducing a runtime regex/string-parsed domain-specific language for dramaturgy in the browser. Use a structured, typed, JSON-serializable AST instead, so plans stay deterministic, serializable, and machine-writable.
- **Cross-channel writes.** Letting `SemanticResolver` touch the modulation bus / `directorOutput`, or letting `VisualDirectorFSM` read `ChoreographyFrame`. The two channels are separate by contract; bridging them requires a new ADR.
- **Per-frame narrative recompute.** Running `buildNarrative` / `generateIntents` / `processChoreography` inside the render loop. They are offline, run-once stages; only `resolveSemanticState` runs per frame.

## Realtime Audio Anti-Patterns

- Realtime FFT, beat detection, or spectral analysis in p5 `draw()`.
- Reusing an `AudioBufferSourceNode`.
- Manual source stop without clearing `onended`.
- Deriving canonical playback time from UI or frame count.
- Accidentally detaching playback audio data by transferring a buffer still needed by the main thread.

## Event And State Anti-Patterns

- Beat event indexes that are not reset on seek, load, stop, and end.
- Worker results that can overwrite newer loads.
- Mutating worker result arrays from renderer or UI code.
- Async state transitions without a request id or cancellation path.
- Multiple modules claiming ownership of the same state field.

## Render Anti-Patterns

- `new Particle()` during normal draw loop.
- Unbounded shockwave or event object growth.
- Async work inside `draw()`.
- DOM updates every frame when throttling is sufficient.
- Replacing squared-distance checks with unconditional square roots in hot loops.
- Direct p5 drawing calls inside effect modules. All effect drawing must go through `VisualRendererBackend`; p5-specific calls belong in backend adapters or p5-owned primitives.
- Reading raw analyzer fields for animation intensity when an equivalent `State.modulation` signal exists.

## Documentation Anti-Patterns

- Duplicating canonical rules from `AGENTS.md` into compatibility shims.
- Letting product history in `v0.1/` or `v0.2/` override current governance.
- Updating governance docs without checking links and drift from `AGENTS.md`.
- Encoding-damaged legacy markdown rewrites that mix broad cleanup with behavioral changes.
- Scattering platform/runtime workarounds across subsystem docs instead of centralizing them in `platform-operations.md`.

## Platform Anti-Patterns

- Assuming `bun`, `npm`, or shell shims are available on PATH without checking.
- Treating a dev-server background process as healthy without an HTTP reachability check.
- Reporting browser smoke validation as complete when only build or HTTP startup was verified.
- Adding a new dependency only to run simple contract tests that Node's built-in test runner can cover.
- Forgetting `diff_export.ps1` when a PR-style complete snapshot, handoff artifact, or broad review context is explicitly useful.
- Staging or committing generated `branch_pr_snapshot.md`.
- Running `diff_export.ps1` blindly when its `git fetch` side effect or generated local artifact is irrelevant to the task.
