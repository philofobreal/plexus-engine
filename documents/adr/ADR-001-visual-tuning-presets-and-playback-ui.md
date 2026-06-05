# ADR-001: Visual Tuning Presets And Playback UI Chrome

## Status

Accepted

## Date

2026-05-25

## Context

The visual tuning surface had grown from a small debugging panel into a user-facing performance tool. New requirements needed:

- Wider ranges for live visual experimentation.
- Editable circle background, circle opacity, stroke, and global background color.
- A single sensitivity control over the already-derived musical values.
- JSON presets that can be collected in a folder and loaded by name.
- Backward-compatible preset loading as the tuning schema evolves.
- A cleaner top control layout.
- VJ-style playback controls on the visual surface.
- Responsive metrics and seekbar chrome.
- Idle fading of UI chrome, including cursor hiding.
- Smooth parameter transitions that avoid abrupt visual jumps during live performance.
- A track dramaturgy timeline that can expose offline `TrackAnalysis` data with DAW-style inspection controls.
- A fullscreen timeline overlay that must escape the seekbar row cleanly without covering controls incorrectly.
- A performance issue near the end of long tracks where paused/stopped rendering repeatedly scanned large event and cue arrays with `findIndex()`.
- A scrubbing performance issue where pointer and slider movement could call `AudioEngine.seek()` many times per second, repeatedly rebuilding Web Audio source nodes and flooding the canvas redraw path.

The app is a static Vite browser app, so it cannot enumerate files in a public directory without a manifest or a backend endpoint.

## Decision

Use typed visual tuning defaults plus metadata-driven controls as the source of truth.

Store preset files in `public/visual-tuning-presets/` and list them through `public/visual-tuning-presets/index.json`. Load presets through the browser fetch API and normalize every payload through `normalizeVisualTuningConfig`.

Keep the shared `State.visualTuning` object reference stable and introduce `State.targetTuning` as the preset/UI destination. Preset loads and slider input mutate `targetTuning`; the renderer interpolates `visualTuning` toward it at the configured transition speed.

Implement music sensitivity as a render-time scale in the modulation bus over accepted audio frames and visual feature frames. Do not change analyzer output for this UI-level tuning.

Add an abstract `State.modulation` bus so visual effects consume normalized musical intent (`kineticTension`, `densityDrive`, `spectralChaos`, `rhythmicImpulse`, `macroMomentum`) instead of coupling every animation to raw analyzer fields.

Keep playback ownership in `AudioEngine`. UI input dispatches play, pause, seek, and loop changes, while the engine owns source-node lifecycle and natural-end behavior.

Move VJ chrome behavior into `DashboardUI`: top controls, metrics toggle, panel visibility, dragging, keyboard shortcuts, and idle auto-hide are DOM concerns. Visual renderers only consume state and draw.

Render the dramaturgy timeline as a canvas projection of precomputed `TrackAnalysis`: sections, BPM-derived bar gridlines, bar RMS, buildup, tension trends, cue markers, and playhead state. Use a DOM tooltip (`#timeline-tooltip`) for hover details instead of drawing hover text into the canvas.

Separate scrubbing from committed audio seeking. `DashboardUI` buffers in-progress drag targets in `scrubTime`, updates the visible time/seekbar/playhead, and commits one `AudioEngine.seek()` call through `commitScrubTime()` when the gesture ends.

Store timeline zoom and pan in shared state as `State.zoom` and `State.pan`. `DashboardUI` still owns the user interaction semantics, but the canonical viewport values live in the same state surface consumed by the declarative timeline renderer. This keeps timeline redraw throttling, playhead following, and render synchronization aligned around one source of truth instead of private UI-only fields.

Use a two-level fullscreen overlay structure: `.seek-container.timeline-overlay-active` becomes the fixed viewport shell, `.timeline-wrapper.is-fullscreen-overlay` becomes the absolute canvas surface, and `body.timeline-overlay-open` hides unrelated chrome.

Keep visual event index synchronization event-driven. `PlexusRenderer` registers `syncEventIndex` through `AudioEngine.addPositionChangedListener()` and does not run redundant O(N) `findIndex()` scans from the paused/stopped draw path.

## Decisions Extended (2026-06-02)

- **Performance Presets & Sticky Normalization:** Extend the tuning contract with typed `PerformancePreset`, `MorphProfile`, and `DramaturgyProfile` data. `normalizeVisualTuningConfig` keeps missing payload fields sticky against the current tuning object when possible, then falls back to defaults. This allows older JSON presets and partial section presets to remain usable while newer live-performance fields are introduced.
- **Envelope Drawing & Automation:** Keep timeline draw mode, section sensitivity overrides, and preset painting in `DashboardUI`. The timeline writes section automation and preset tags against `State.sectionOverrides`, while playback position listeners trigger preset automation from canonical audio time. This keeps editing and scheduling in the UI/playback boundary instead of moving automation into visual effects.
- **Playback Fade-out & Resource Conservation:** Add `State.playbackFade` and `State.rotationPhase` as render-facing motion continuity state. Particles and temporal rotation consume these values so stopping playback creates a controlled visual slowdown without keeping audio nodes alive or deriving timing from p5 frame count.
- **GPU-accelerated Low-DPI Waveform Blitting:** Render the dramaturgy waveform inside `TimelineCanvas` into a reusable low-DPI offscreen canvas and blit it into the visible timeline. The cache is invalidated by source waveform data, visible dimensions, and viewport state (`State.zoom` / `State.pan`). The waveform uses bar-based `fillRect` rasterization over precomputed audio-derived amplitudes, with `AudioFrame.e` as fallback, to avoid large per-frame canvas paths.

## Consequences

Positive:

- Presets remain backward-compatible when new tuning fields are added.
- The tuning panel can grow by adding defaults and control metadata instead of duplicating slider markup.
- Presets are simple static assets and work in the existing Vite deployment model.
- Renderers receive sensitivity-adjusted values without adding analyzer coupling.
- Live parameter changes and preset changes are smooth enough for performance use.
- Effects become easier to evolve because animation inputs are decoupled from analyzer implementation details.
- UI chrome can be refined independently from p5 visual effects.
- Loop mode stays aligned with audio source-node lifecycle.
- Timeline inspection scales from compact to resized to fullscreen without changing playback ownership.
- DOM-based hover details remain readable and avoid text-heavy canvas redraw work on pointer movement.
- Dragging the seekbar or timeline no longer floods Web Audio with repeated source-node rebuilds.
- Paused or ended playback near the end of long tracks avoids frame-by-frame linear scans over large event/cue arrays.
- Partial and older performance presets can coexist with new tuning fields without destructive resets.
- Section preset painting and envelope drawing are schedulable from playback position events, including seek and paused inspection paths.
- Playback stop feels visually continuous while Web Audio source-node lifecycle remains strict.
- Timeline waveform redraw cost is bounded by cache invalidation instead of normal frame cadence.

Tradeoffs:

- `index.json` must be updated when adding or removing preset files.
- Preset names are file-name based; richer metadata would require extending the manifest or JSON schema.
- RGB background tuning is explicit and simple, but less compact than a color picker.
- Auto-hide behavior is intentionally owned by the UI layer, so new top-level chrome must opt into the same CSS/DOM classes.
- The timeline has coordinated UI interaction state (`scrubTime`, pan/seek/draw flags) plus shared viewport state (`State.zoom`, `State.pan`), so tests must guard both interaction semantics and state handoff to `TimelineCanvas`.
- In-progress scrub is visual until release; this is intentional for performance, but it means audio preview during drag is not currently supported.
- The fullscreen timeline relies on coordinated classes across the seek container, wrapper, and body; future layout changes must preserve that contract.
- Sticky preset normalization makes the current tuning state part of partial-preset semantics, so tests must cover both current-aware and default-only normalization.
- Draw mode adds more timeline interaction modes, so pointer handling must keep seek, pan, resize, draw, and preset paint paths explicitly separated.
- The waveform cache must be invalidated whenever timeline scale or analysis data changes; stale cache keys would show incorrect waveform placement.

## Alternatives Considered

- **Runtime directory listing:** Rejected because static browser deployments cannot reliably enumerate `public/` directory contents.
- **Replacing `State.visualTuning` on preset load:** Rejected because shared mutable state readers expect a stable object reference and abrupt preset replacement creates poor live-performance UX.
- **Changing analyzer output for sensitivity:** Rejected because sensitivity is a live visual preference, not a change to offline music analysis.
- **Writing UI controls directly to live tuning:** Rejected because large jumps in particle speed, glow intensity, or line weight are visually disruptive during live playback.
- **Persisting presets in local storage only:** Rejected because the user explicitly wanted named JSON files collected in a directory.
- **Canvas-only tooltip text:** Rejected because hover details are easier to position, style, and throttle as DOM without forcing complex canvas text redraw logic.
- **Audio seek on every drag event:** Rejected because pointer and input events can arrive far above frame rate and can overload Web Audio node lifecycle.
- **Frame-by-frame index repair in the draw loop:** Rejected because the linear scan cost grows toward the end of tracks and duplicates the event-driven position listener.
- **Immediate visual freeze on pause/stop:** Rejected because it makes playback state transitions feel abrupt and encourages renderer timing hacks. A render-facing fade keeps motion continuity separate from audio lifecycle.
- **Drawing waveform paths directly on every timeline frame:** Rejected because long tracks and high zoom levels create excessive canvas path work. Cached bar rasterization keeps redraw cost predictable.

## Implementation References

- `src/config/visualTuning.ts`
- `src/types/index.ts`
- `src/state/store.ts`
- `src/ui/DashboardUI.ts`
- `src/ui/GestureEngine.ts`
- `src/ui/TimelineCanvas.ts`
- `src/audio/AudioEngine.ts`
- `src/visuals/ClassicPlexusEffect.ts`
- `src/visuals/TemporalMusicEffect.ts`
- `src/visuals/PlexusRenderer.ts`
- `src/visuals/RendererBackend.ts`
- `src/visuals/P5RendererBackend.ts`
- `public/visual-tuning-presets/`
