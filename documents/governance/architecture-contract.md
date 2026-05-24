# Architecture Contract

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## System Shape

The app is a Vite TypeScript project with explicit runtime layers:

- Composition: `src/main.ts`
- Audio playback and analysis orchestration: `src/audio/`
- Offline worker analysis: `src/audio/analyzer.worker.ts`
- Shared mutable state: `src/state/`
- Shared static contracts: `src/types/`
- DOM controls and dashboard projection: `src/ui/`
- p5 canvas rendering: `src/visuals/`

## Dependency And Module Boundary Map

Allowed dependency directions:

- `main.ts` may import audio, UI, visuals, CSS, and shared types.
- `src/audio/` may import `src/state/`, `src/types/`, and worker modules.
- `src/audio/analyzer.worker.ts` may import types only.
- `src/ui/` may import `src/audio/`, `src/state/`, and types.
- `src/visuals/` may import p5, `src/state/`, visual classes, and types.
- `src/state/` may import types only.
- `src/types/` must not import app runtime modules.

Forbidden dependency directions:

- Worker to DOM, p5, UI, renderer, audio engine, or shared mutable state.
- State to UI, audio engine, renderer, worker, DOM, or p5.
- Renderer to UI implementation details except through an explicit composition boundary.
- UI to worker internals or DSP algorithms.
- Types to runtime modules.

Mode-specific visual implementations should live in separate files under `src/visuals/`. The renderer entrypoint may orchestrate playback synchronization and delegate drawing, but it should not accumulate multiple full effect implementations inline.

## Lifecycle Ownership

- File decode and analysis request creation belong to audio.
- Worker compute lifecycle belongs to audio plus worker; publication of accepted results belongs to audio.
- Playback start, pause, seek, stop, and end belong to audio.
- Event consumption for visual effects belongs to visuals, but event index reset rules are part of the playback synchronization contract.
- DOM enable/disable states and dashboard text belong to UI.

## Public Contracts

Shared interfaces must live in `src/types/`. When a schema crosses a worker boundary, define both request and response types before wiring runtime behavior.

Worker result payloads must be append-only unless a coordinated migration updates every consumer. Optional fields are acceptable only when consumers define deterministic defaults.

## State Authority

Every shared state field needs a clear owner:

- Audio owns duration, sample rate, play state, timing, analysis result publication, and accepted worker metadata.
- Visuals own render-derived decay values and visual-only transient state.
- UI owns DOM projection and user input dispatch.
- Visual mode selection is user input owned by UI and stored in shared state as an explicit render-facing setting.
- State module owns shape and initialization defaults.

When ownership is ambiguous, add a small explicit API or handoff contract instead of adding hidden direct writes.
