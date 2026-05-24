# Plexus Engine Agent Governance

`AGENTS.md` is the canonical source of truth for every agent, subagent, and automation working in this repository. If another local instruction file conflicts with this file, follow this file and report the conflict.

The active project root is `plexus-engine/`. The sibling `v0.1/` and `v0.2/` directories are historical product/spec references, not governance sources.

## Mission

Plexus Engine is a modular TypeScript realtime audio visualization system. Changes must preserve deterministic playback, offline analysis, safe worker communication, stable module ownership, and predictable rendering performance.

Optimize all work for:

- Architectural consistency.
- Deterministic event and state handling.
- Safe parallel execution by agents.
- Long-term maintainability during large refactors.
- Minimal hidden coupling between audio, worker, state, UI, and renderer modules.

## Governance Documents

These documents extend this file and must not override it:

- [Architecture Contract](documents/governance/architecture-contract.md)
- [Subagent Orchestration](documents/governance/subagent-orchestration.md)
- [Realtime Audio Safety](documents/governance/realtime-audio-safety.md)
- [Worker Communication](documents/governance/worker-communication.md)
- [Testing and Validation](documents/governance/testing-validation.md)
- [Anti-Patterns](documents/governance/anti-patterns.md)

`CLAUDE.md` is a compatibility shim only. It must explicitly inherit from this file and must not accumulate independent policy.

## Module Ownership

- `src/main.ts` composes the app, creates subsystem instances, and wires startup.
- `src/audio/` owns file decode, `AudioContext`, playback lifecycle, source nodes, timing, and worker invocation.
- `src/audio/analyzer.worker.ts` owns offline analysis only. It must not depend on DOM, p5, UI, shared mutable runtime state, or browser main-thread objects other than worker APIs.
- `src/state/` owns the shared state shape and documented mutation semantics.
- `src/visuals/` owns p5 rendering, particle lifecycle, shockwaves, and visual consumption of precomputed events.
- `src/ui/` owns DOM binding, controls, dashboard projection, and user-facing state display.
- `src/types/` owns shared contracts and must remain dependency-light.
- `documents/` owns product and governance documentation.

## Deterministic State And Event Rules

- Playback time is derived only from `playOffset + (audioContext.currentTime - playStartTime)`.
- Beat event consumption must be index-based and must reset explicitly on load, play, seek, stop, and end.
- Worker results may be applied only if they match the current load request id.
- State transitions must occur in this order when loading a new file: stop old playback, invalidate old worker/result, decode, analyze, publish result, enable UI.
- Shared state writes must have a single documented owner per field or a documented handoff between owners.
- Renderer code may consume playback state but must not initiate playback lifecycle decisions.
- UI code may request playback actions but must not compute audio analysis or mutate worker result payloads.

## Realtime Audio Safety Rules

- Do not use `p5.sound` for playback.
- Do not perform realtime FFT, beat detection, or spectral analysis inside p5 `draw()`.
- Do not allocate unbounded objects or run async work inside `draw()`.
- Do not create `Particle` instances during normal rendering; the particle pool is initialized once.
- `AudioBufferSourceNode` is one-shot. Play, pause, resume, and seek must create a fresh source and disconnect the previous source.
- Before manually stopping a source, set `source.onended = null`, then stop and disconnect.
- Audio data sent to workers must use an explicit copy-vs-transfer decision. Never accidentally detach data still needed by playback.

## Worker Communication Rules

- Worker messages must be typed at the boundary.
- Worker output must be treated as immutable by renderer and UI code.
- Every analysis request must be identifiable so stale worker results cannot overwrite newer state.
- Workers must terminate on success, error, cancellation, and superseded load.
- Worker output must be deterministic for the same input samples, sample rate, and algorithm version.
- Schema changes to worker input or output require single-agent ownership and validation across audio, state, renderer, and UI consumers.

## Task Decomposition

Decompose tasks by subsystem ownership first, then by file. Every task must identify affected owners: audio, worker, state, visuals, UI, docs, or build.

Safe to parallelize:

- Documentation-only edits in separate governance or product docs, with one integration owner checking consistency.
- Visual styling changes isolated to `src/style.css` when no DOM ids/classes are renamed.
- Renderer visual tuning that does not touch event consumption, audio timing, or shared state shape.
- Worker algorithm research or profiling when no schema or playback integration changes are made.
- Product documentation cleanup separate from code changes.

Single-agent ownership required:

- `AudioEngine` playback lifecycle, source-node handling, seek/play/pause/end behavior.
- Worker message schema and request-id race prevention.
- Shared `State` shape and mutation semantics.
- Cross-module refactors that change imports or ownership boundaries.
- Any change that alters event ordering between UI, audio, worker, state, and renderer.
- Dependency upgrades affecting Vite, TypeScript, p5, Web Audio assumptions, or worker bundling.

## Merge And Ownership Rules

- Each change must name the owner for each affected subsystem.
- Cross-boundary changes require one integration owner before merge.
- Do not mechanically merge parallel agent outputs. The integration owner must check duplicated rules, conflicting contracts, import boundary violations, stale docs, and broken validation.
- Updates to this file require checking every governance document for drift.
- `CLAUDE.md` must remain a thin adapter.

## Testing Gates

- Any change touching `src/audio`, `src/audio/*.worker.ts`, `src/state`, event indexes, or playback timing requires a build plus targeted regression notes.
- Any visual-only change requires render smoke validation.
- Any worker algorithm change requires deterministic fixture-style validation where practical.
- Any governance-only change must verify references, inheritance, and absence of contradictory policy.
- Before reporting completion, state what validation was run and what was not run.

## Dependency Policy

- Keep runtime dependencies minimal.
- Do not add dependencies for simple state, timing, math, or DOM operations without an architecture justification.
- Dependency upgrades that affect Vite, TypeScript, p5, worker bundling, or Web Audio behavior require single-agent ownership and build validation.
- `src/types/` must not import runtime-heavy modules.

## Anti-Pattern Policy

The anti-pattern catalog is maintained in [Anti-Patterns](documents/governance/anti-patterns.md). If a change introduces one of those patterns, stop and redesign before implementation.
