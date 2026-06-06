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
- p5 canvas rendering and backend adaptation: `src/visuals/`

The UI layer has an explicit internal shape:

- `src/ui/DashboardUI.ts` is the facade/orchestrator. It owns DOM control wiring, playback input dispatch, timeline interaction state, `State` writes, and `AudioEngine` calls. It composes the timeline submodules but must not accumulate raw pointer normalization or low-level canvas drawing logic.
- `src/ui/GestureEngine.ts` is the deep interaction module. It normalizes pointer, wheel, mouse, and touch events into stable semantic callbacks (`onStart`, `onMove`, `onEnd`, `onHover`, `onZoom`, `onDoubleClick`) and has no knowledge of music sections, playback state, presets, or rendering.
- `src/ui/TimelineCanvas.ts` is the deep declarative timeline renderer. It renders from a `RenderState` payload, owns HDPI canvas sizing and waveform offscreen cache internals, and must not read global `State` directly or handle user input.

## Dependency And Module Boundary Map

Allowed dependency directions:

- `main.ts` may import audio, UI, visuals, CSS, and shared types.
- `src/audio/` may import `src/state/`, `src/types/`, and worker modules.
- `src/audio/analyzer.worker.ts` may import types only.
- `src/ui/` may import `src/audio/`, `src/state/`, and types.
- Within `src/ui/`, `DashboardUI.ts` may compose `GestureEngine.ts` and `TimelineCanvas.ts`; those submodules must stay independent from each other.
- `GestureEngine.ts` may depend on DOM event and geometry APIs plus shared callback types, but must not import `src/state/`, `src/audio/`, `src/visuals/`, or timeline rendering modules.
- `TimelineCanvas.ts` may depend on canvas APIs and shared render types, but must not import `src/state/`, `src/audio/`, `src/visuals/`, or gesture modules.
- `src/visuals/P5RendererBackend.ts`, `Particle.ts`, `Shockwave.ts`, and `PlexusRenderer.ts` may import p5.
- Effect modules and visual identity modules under `src/visuals/` must draw through `VisualRendererBackend` rather than direct p5 APIs.
- `src/visuals/` may import `src/state/`, visual classes, config helpers, renderer backend contracts, and types.
- `src/state/` may import types only.
- `src/types/` must not import app runtime modules.

Forbidden dependency directions:

- Worker to DOM, p5, UI, renderer, audio engine, or shared mutable state.
- State to UI, audio engine, renderer, worker, DOM, or p5.
- Renderer to UI implementation details except through an explicit composition boundary.
- UI to worker internals or DSP algorithms.
- Gesture or timeline renderer submodules to application-level state ownership. Gesture input stays generic; timeline rendering receives data through `RenderState`.
- Types to runtime modules.

Mode-specific visual implementations should live in separate `VisualIdentity` implementations under `src/visuals/`. The renderer entrypoint may orchestrate playback synchronization and delegate drawing, but it must not accumulate multiple full effect implementations inline or hard-code visual-mode drawing branches.

`StyleRegistry` is the deep style-management module. It may hide registered identities behind a private map and expose only simple registration/lookup methods. Application composition should create a registry instance and pass it into the renderer; modules must not rely on a writable unmanaged global registry.

`VisualRendererBackend` is the render boundary for effect modules. The p5 implementation lives in `P5RendererBackend`; future WebGPU, shader, or mock backends must implement the same draw-command contract.

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
- Visuals own `State.modulation`, derived from accepted frame/features plus transient beat/cue decays.
- `State.modulation` must keep a stable object reference during rendering. Visuals update it through `writeModulationBus(State.modulation, ...)`, and transient reset must zero its fields in place instead of assigning `State.modulation = { ... }`.
- UI owns DOM projection and user input dispatch.
- Visual mode selection is user input owned by UI and stored in shared state as an explicit render-facing setting. Preset loading may update this field only after validating the selected id against the supported `VisualMode` union.
- UI owns `State.targetTuning` writes from sliders and presets; visuals own interpolation into `State.visualTuning`.
- State module owns shape and initialization defaults.

When ownership is ambiguous, add a small explicit API or handoff contract instead of adding hidden direct writes.
