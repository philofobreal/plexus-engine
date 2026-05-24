# Subagent Orchestration

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## Operating Model

Use subagents to reduce exploration time and isolate risk, not to bypass ownership. One integration owner is responsible for combining outputs, resolving conflicts, and validating the final state.

## Agent Roles

- Architecture owner: checks module boundaries, import direction, shared contracts, and documentation consistency.
- Audio owner: handles `AudioEngine`, Web Audio lifecycle, timing, seek/play/pause/end, and memory safety.
- Worker owner: handles offline analysis, message schemas, deterministic output, request ids, and cancellation.
- State owner: handles shared state shape, mutation rules, and event/state ordering.
- Visuals owner: handles p5 renderer, particles, shockwaves, canvas performance, and render smoke checks.
- UI owner: handles DOM binding, dashboard updates, controls, accessibility, and layout behavior.
- Validation owner: runs build/tests/manual checks and reports gaps.

## Safe Parallel Work

Parallelize only when boundaries are stable:

- Separate documentation files with one docs integration owner.
- Isolated CSS work without class/id contract changes.
- Visual tuning that does not alter playback timing, event indexes, or shared state shape.
- Worker algorithm experiments that do not change message schemas or runtime integration.
- Independent audit tasks that produce findings, not code changes.

## Single-Owner Work

Assign one owner for:

- Playback lifecycle or timing changes.
- Worker schema, cancellation, or request-id changes.
- Shared `State` shape changes.
- Cross-module refactors.
- Dependency upgrades.
- Any change that affects ordering between UI input, audio actions, worker output, state publication, and renderer consumption.

## Task Decomposition Rules

Break work into:

1. Contract changes.
2. Implementation changes by subsystem.
3. Integration wiring.
4. Validation.
5. Documentation updates.

Do not start parallel implementation before contract changes are settled. Subagents must report files touched, subsystem owner, assumptions, validation performed, and unresolved risks.

## Integration Rules

The integration owner must:

- Compare all outputs against `AGENTS.md`.
- Remove duplicated or conflicting rules.
- Check import direction and module ownership.
- Run or record required validation.
- Produce a final summary with residual risk.
