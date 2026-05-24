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

UI changes:

- Validate disabled/enabled states, dashboard text, BPM badge, seek bar, time display, and responsive layout.

## Reporting Requirements

Every final report must state:

- Validation commands run.
- Manual checks performed.
- Checks not run and why.
- Residual risk.

## Minimum Gate For Risky Areas

Changes touching `src/audio`, `src/audio/*.worker.ts`, `src/state`, event indexes, or playback time require build validation and targeted regression notes.
