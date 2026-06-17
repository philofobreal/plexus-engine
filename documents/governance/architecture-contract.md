# Architecture Contract

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## System Shape

The app is a Vite TypeScript project with explicit runtime layers:

- Composition: `src/main.ts`
- Audio playback and analysis orchestration: `src/audio/`
- Offline analyzer core: `src/analyzer/`
- Offline analyzer worker adapter: `src/audio/analyzer.worker.ts`
- Shared mutable state: `src/state/`
- Shared static contracts: `src/types/`
- DOM controls and dashboard projection: `src/ui/`
- Offline export orchestration and encoding: `src/export/`
- p5 canvas rendering and backend adaptation: `src/visuals/`

The UI layer has an explicit internal shape:

- `src/ui/DashboardUI.ts` is the facade/orchestrator. It owns cross-controller coordination, timeline interaction state, dashboard projection, preset/performance-plan handoff, `State` writes, and `AudioEngine` calls. It composes the focused controller classes and timeline submodules but must not re-accumulate all DOM listener code, raw pointer normalization, or low-level canvas drawing logic.
- `src/ui/controllers/PlaybackController.ts` owns playback-surface DOM bindings: file selection, play/stop buttons, center play button, seekbar drag state, loop toggle, fullscreen button, canvas click/double-click handling, surface keyboard shortcuts, playback labels, time display, BPM badge, and playback enable/disable state. It delegates intent through callbacks and must not own Web Audio source lifecycle or analysis publication.
- `src/ui/controllers/TuningController.ts` owns tuning and presentation-control DOM bindings: tuning-panel visibility and dragging, metadata-driven tuning controls, preset selector projection, preset brush selector, copy-config feedback, metrics toggle, and visual mode select. It delegates preset loading and state-changing decisions through callbacks and must not normalize preset payloads outside the established config helpers.
- `src/ui/controllers/ExportController.ts` owns export-control DOM bindings: resolution/aspect selectors, capability warnings, export button state, progress labels, stop/cancel controls, and active export UI state. It delegates export workflow start/stop/cancel through callbacks and must not encode video, slice audio, or manage worker messages directly.
- `src/ui/GestureEngine.ts` is the deep interaction module. It normalizes pointer, wheel, mouse, and touch events into stable semantic callbacks (`onStart`, `onMove`, `onEnd`, `onHover`, `onZoom`, `onDoubleClick`) and has no knowledge of music sections, playback state, presets, or rendering.
- `src/ui/TimelineCanvas.ts` is the deep declarative timeline renderer. It renders from a `RenderState` payload, owns HDPI canvas sizing and waveform offscreen cache internals, and must not read global `State` directly or handle user input.

## Dependency And Module Boundary Map

Allowed dependency directions:

- `main.ts` may import audio, UI, visuals, CSS, and shared types.
- `src/audio/` may import `src/state/`, `src/types/`, `src/analyzer/`, and worker modules.
- `src/analyzer/` may import `src/types/` and analyzer-local modules only. It must remain environment-independent and must not import Worker APIs, DOM, p5, UI, renderer modules, `AudioEngine`, or shared mutable runtime state.
- `src/audio/analyzer.worker.ts` may import `src/analyzer/` and `src/types/` only. It must remain a message adapter around `analyzeAudio()`.
- `src/ui/` may import `src/audio/`, `src/state/`, and types.
- `src/ui/DashboardUI.ts` may import `src/export/WebMExporter.ts` to orchestrate user-triggered exports, but it must treat the exporter as a black-box workflow module.
- `src/export/WebMExporter.ts` may import `src/state/` and its worker module. It may receive `AudioEngine` through construction and use only the public `getAudioBuffer()` surface.
- `src/export/export.worker.ts` must remain dependency-free from DOM, p5, UI, audio engine, renderer, and shared mutable state. It may use worker globals, WebCodecs, `Blob`, typed arrays, local pure TypeScript EBML helpers, and the Origin Private File System API (`navigator.storage.getDirectory()`) for direct-to-disk chunk streaming.
- Within `src/ui/`, `DashboardUI.ts` may compose `GestureEngine.ts` and `TimelineCanvas.ts`; those submodules must stay independent from each other.
- Within `src/ui/`, `DashboardUI.ts` may compose focused controllers from `src/ui/controllers/`. Controllers may depend on DOM APIs, callback interfaces, and narrow state reads needed for UI projection, but they must delegate application decisions back to `DashboardUI`.
- UI controllers must not import `src/audio/AudioEngine.ts`, analyzer workers, renderer modules, or export worker modules. Export UI may reference export capability/config types but must not perform export encoding or worker orchestration.
- `GestureEngine.ts` may depend on DOM event and geometry APIs plus shared callback types, but must not import `src/state/`, `src/audio/`, `src/visuals/`, or timeline rendering modules.
- `TimelineCanvas.ts` may depend on canvas APIs and shared render types, but must not import `src/state/`, `src/audio/`, `src/visuals/`, or gesture modules.
- `src/visuals/P5RendererBackend.ts`, `Particle.ts`, `Shockwave.ts`, and `PlexusRenderer.ts` may import p5.
- Effect modules and visual identity modules under `src/visuals/` must draw through `VisualRendererBackend` rather than direct p5 APIs.
- `src/visuals/` may import `src/state/`, visual classes, config helpers, renderer backend contracts, and types.
- `src/state/` may import types only.
- `src/types/` must not import app runtime modules.

Forbidden dependency directions:

- Analyzer core to Worker APIs, DOM, p5, UI, renderer, audio engine, or shared mutable state.
- Worker adapter to DOM, p5, UI, renderer, audio engine, shared mutable state, or duplicated analyzer logic.
- State to UI, audio engine, renderer, worker, DOM, or p5.
- Renderer to UI implementation details except through an explicit composition boundary.
- UI to worker internals or DSP algorithms.
- Export worker to application runtime modules.
- Renderer-owned polling for export loop state. Export loop/no-loop ownership belongs to `WebMExporter`.
- Gesture or timeline renderer submodules to application-level state ownership. Gesture input stays generic; timeline rendering receives data through `RenderState`.
- Types to runtime modules.

Mode-specific visual implementations should live in separate `VisualIdentity` implementations under `src/visuals/`. The renderer entrypoint may orchestrate playback synchronization and delegate drawing, but it must not accumulate multiple full effect implementations inline or hard-code visual-mode drawing branches.

`StyleRegistry` is the deep style-management module. It may hide registered identities behind a private map and expose only simple registration/lookup methods. Application composition should create a registry instance and pass it into the renderer; modules must not rely on a writable unmanaged global registry.

`VisualRendererBackend` is the render boundary for effect modules. The p5 implementation lives in `P5RendererBackend`; future WebGPU, shader, or mock backends must implement the same draw-command contract.

## Lifecycle Ownership

- File decode and analysis request creation belong to audio.
- Worker compute lifecycle belongs to audio plus worker; publication of accepted results belongs to audio.
- Analyzer computation belongs to `src/analyzer/`, not to the worker. `analyzeAudio()` is the single offline analysis orchestration implementation. `FeatureExtractor` owns FFT-derived feature extraction, `GridAligner` owns BPM/grid alignment, `SectionAnalyzer` owns bar and section analysis, and `DramaturgyBuilder` owns beats, cues, and recurring pattern output.
- The analyzer worker message handler is a thin typed response boundary. It destructures `AnalysisRequest`, calls `analyzeAudio()`, forwards progress, posts success, and formats errors. It must not contain DSP, scoring, threshold, BPM detection, dramaturgy, Spectral Pivot, or result-normalization logic.
- Playback start, pause, seek, stop, and end belong to audio.
- Offline export frame timing, p5 loop suppression, export canvas resize/restore, `VideoFrame` capture, audio slicing, watermark drawing, hardware encoder queue synchronization, and stop/cancel semantics belong to `src/export/WebMExporter.ts`.
- WebM byte layout, WebCodecs encoder lifecycle, and muxing belong to `src/export/export.worker.ts`.
- Event consumption for visual effects belongs to visuals, but event index reset rules are part of the playback synchronization contract.
- DOM enable/disable states and dashboard text belong to UI.

## Public Contracts

Shared interfaces must live in `src/types/`. When a schema crosses a worker boundary, define both request and response types before wiring runtime behavior.

Worker result payloads must be append-only unless a coordinated migration updates every consumer. Optional fields are acceptable only when consumers define deterministic defaults.

## State Authority

Every shared state field needs a clear owner:

- Audio owns duration, sample rate, play state, timing, analysis result publication, and accepted worker metadata.
- Audio owns analysis reset isolation. Resetting `State.trackAnalysis` must create a fresh deep copy of the empty analysis template so nested arrays and objects cannot be shared across track loads.
- Analyzer owns canonical `TrackAnalysis` normalization and the empty analysis template. Analyzer normalization must accept explicit fallback context, such as `fallbackBpm`, instead of reading shared runtime state.
- Visuals own render-derived decay values and visual-only transient state.
- Visuals own `State.modulation`, derived from accepted frame/features plus transient beat/cue decays.
- `State.modulation` must keep a stable object reference during rendering. Visuals update it through `writeModulationBus(State.modulation, ...)`, and transient reset must zero its fields in place instead of assigning `State.modulation = { ... }`.
- UI owns DOM projection and user input dispatch.
- Visual mode selection is user input owned by UI and stored in shared state as an explicit render-facing setting. Preset loading may update this field only after validating the selected id against the supported `VisualMode` union.
- UI owns `State.targetTuning` writes from sliders and presets; visuals own interpolation into `State.visualTuning`.
- `State.isExporting` and `State.exportTime` are export-owned render clock fields. `WebMExporter` writes them during offline export; `PlexusRenderer` and timeline/dashboard projections consume them. Export must reset both fields in cleanup.
- State module owns shape and initialization defaults.

When ownership is ambiguous, add a small explicit API or handoff contract instead of adding hidden direct writes.
