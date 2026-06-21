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

Move render-time dramaturgy state control into `src/visuals/VisualDirectorFSM.ts`. The class owns dynamic thresholds, state dampening, drop anticipation, and buildup boost as a deep visual module. `PlexusRenderer` computes the current frame and modulation inputs, calls the director, and publishes the resulting `State.directorOutput` for effect modules to consume.

Keep playback ownership in `AudioEngine`. UI input dispatches play, pause, seek, and loop changes, while the engine owns source-node lifecycle and natural-end behavior.

Move VJ chrome behavior into `DashboardUI`: top controls, metrics toggle, panel visibility, dragging, keyboard shortcuts, and idle auto-hide are DOM concerns. Visual renderers only consume state and draw.

Render the dramaturgy timeline as a canvas projection of precomputed `TrackAnalysis`: sections, BPM-derived bar gridlines, bar RMS, buildup, tension trends, cue markers, and playhead state. Use a DOM tooltip (`#timeline-tooltip`) for hover details instead of drawing hover text into the canvas.

Separate scrubbing from committed audio seeking. `DashboardUI` buffers in-progress drag targets in `scrubTime`, updates the visible time/seekbar/playhead, and commits one `AudioEngine.seek()` call through `commitScrubTime()` when the gesture ends.

Store timeline zoom and pan in shared state as `State.zoom` and `State.pan`. `DashboardUI` still owns the user interaction semantics, but the canonical viewport values live in the same state surface consumed by the declarative timeline renderer. This keeps timeline redraw throttling, playhead following, and render synchronization aligned around one source of truth instead of private UI-only fields.

Use a two-level fullscreen overlay structure: `.seek-container.timeline-overlay-active` becomes the fixed viewport shell, `.timeline-wrapper.is-fullscreen-overlay` becomes the absolute canvas surface, and `body.timeline-overlay-open` hides unrelated chrome.

Keep visual event index synchronization event-driven. `PlexusRenderer` registers `syncEventIndex` through `AudioEngine.addPositionChangedListener()` and does not run redundant O(N) `findIndex()` scans from the paused/stopped draw path.

## Decisions Extended (2026-06-02)

- **Performance Presets & Sticky Normalization:** Extend the tuning contract with typed `PerformancePreset`, `MorphProfile`, and `DramaturgyProfile` data. `normalizeVisualTuningConfig` keeps missing payload fields sticky against the current tuning object when possible, then falls back to defaults. This allows older JSON presets and partial section presets to remain usable while newer live-performance fields are introduced.
- **Performance Automation Plan:** Replace per-section `State.sectionOverrides` with a unified `PerformanceAutomationPlan` stored in `State.performancePlan` (auto-generated) and `State.editedPerformancePlan` (user-edited). Each plan carries `version: 1`, `source: 'auto' | 'edited'`, and `points: PerformanceAutomationPoint[]`. Each point carries `id`, `time`, `sectionId`, `preset`, `confidence`, `intensity` (local sensitivity override, 0.1-4.0), `reason` (`intro` / `build` / `drop` / `break` / `peak` / `harmonicShift` / `manual`), `morphDurationSec`, `morphCurve` (`linear` / `easeInOut` / `exponential`), optional `analysisConfidence`, optional `timingMode` (`bar-aligned` / `novelty` / `energy-reactive`), and optional `locked`. Playback position listeners trigger preset morphs from the canonical audio time against this plan. Editing and scheduling remain in the UI/playback boundary. `State.sectionOverrides` is fully removed.
- **Playback Fade-out & Resource Conservation:** Add `State.playbackFade` and `State.rotationPhase` as render-facing motion continuity state. Particles and temporal rotation consume these values so stopping playback creates a controlled visual slowdown without keeping audio nodes alive or deriving timing from p5 frame count.
- **GPU-accelerated Low-DPI Waveform Blitting:** Render the dramaturgy waveform inside `TimelineCanvas` into a reusable low-DPI offscreen canvas and blit it into the visible timeline. The cache is invalidated by source waveform data, visible dimensions, and viewport state (`State.zoom` / `State.pan`). The waveform uses bar-based `fillRect` rasterization over precomputed audio-derived amplitudes, with `AudioFrame.e` as fallback, to avoid large per-frame canvas paths.

## Decisions Extended (2026-06-06)

- **Visual Identity Registry:** Introduce `VisualIdentity` as the stable style contract and `StyleRegistry` as the deep registry module. `PlexusRenderer` receives a registry instance and delegates drawing through `StyleRegistry.get(State.visualMode).draw(...)`, removing hard-coded mode branches from the draw loop.
- **Built-in Style Set:** Extend `VisualMode` to `classic`, `temporal`, `dark-techno`, `organic-ambient`, and `cyberpunk`. The new identities keep their own color, movement, and polygon/network rules behind the same backend-only draw contract.
- **Preset Mode Compatibility:** Treat `visualMode` in performance presets as optional. Known style ids update both `State.visualMode` and the visual-mode select; missing or unknown ids are ignored for backward compatibility. Unknown registry lookup at render time falls back to `classic`.
- **Deterministic Style Harness:** Add `tests/styles-deterministic.test.mjs` to run every built-in identity against five genre-specific mock track profiles without a browser or real p5 instance. The harness verifies no crashes and deterministic backend call counts across repeated 60-frame simulations.

## Decisions Extended (2026-06-16)

- **Evidence-Based Section Labels:** `SectionAnalyzer` assigns section labels through deterministic confidence scoring across all supported labels instead of a rigid threshold chain. Energy, previous-section energy, density, bass/density context, tension, dominant feature, and section position contribute weighted evidence; weak evidence falls back to `verse`.
- **Fuzzy Pattern Recognition:** `DramaturgyBuilder` groups recurring musical patterns by Euclidean distance over energy, density, and dominant-feature evidence. Pattern grouping no longer requires exact string-signature equality, so repeated choruses or drops remain grouped when their later occurrence has small energy or density variation.
- **Semantic Preset Mapping:** `PerformancePlanGenerator` scores preloaded preset metadata from `State.preloadedPresets` / `GeneratorOptions.presetMetadata` before using legacy filename hints. Drop/peak, build, break/intro, vocal, melody, and fx sections are matched against tuning and dramaturgy parameters such as `particleEnergySpeed`, `particleBeatSpeed`, `dropDampening`, `buildupIntensity`, `breakRestraint`, `vocalHighlight`, and `fxChaos`.
- **Reactive Video Backplate:** The muted video backplate remains synchronized to the `AudioEngine` master clock, but normal playback may modulate `video.playbackRate` from `macroMomentum` and `rhythmicImpulse` in the `0.5x..2.0x` range. `DashboardUI` also samples a 4x4 offscreen canvas from the current video frame and publishes averaged RGB into `State.videoDominantColor`. Export mode skips playback-rate modulation.

## Decisions Extended (2026-06-21)

- **Same-File Reload:** `PlaybackController` clears the upload input value after reading the selected file from the `change` event. This allows the same media file to be selected again and routed through the normal load path. The decision stays inside the DOM controller and does not alter `AudioEngine` ownership of decode, playback lifecycle, source nodes, request ids, or stale worker rejection.
- **Locked-Visible Chrome Start:** Dashboard chrome starts locked visible. The visual-surface single-click gesture can unpin it into chrome auto-hide, using `400ms` for explicit unpin feedback and about `1400ms` for ordinary inactivity. Hovering or focusing chrome cancels the pending hide; if a timer expires while chrome is hovered, hiding is rescheduled instead of applied. This remains UI chrome behavior owned by `DashboardUI` and CSS.
- **Dynamic Timeline Viewport Zoom:** `State.zoom` and `State.pan` remain the canonical timeline viewport state. `DashboardUI` and `TimelineCanvas` use the same max zoom calculation, `max(16, duration / 5.0)`, so long tracks can zoom beyond the old fixed `16x` cap while preserving at least about five visible seconds. User interaction semantics remain in `DashboardUI`; rendering consumes the clamped viewport declaratively in `TimelineCanvas`.
- **Automation Rendering At Viewport Edges:** `TimelineCanvas` keeps partially visible automation zones visible at timeline viewport boundaries. Morph curve math uses unclipped x coordinates and relies on canvas clipping, so offscreen starts or ends do not distort `linear`, `easeInOut`, or `exponential` curves. Preset-derived colors mark automation zones, morph curves, intensity lines, and sensitivity handle state; the post-morph zone segment is dimmed. Curve segment count is at least `15` and grows with curve width. RMS/bar drawing includes a small offscreen time margin so lines remain visually continuous at viewport edges.
- **Waveform Cache For Deep Zoom:** `TimelineCanvas.setAudioBuffer()` stores precomputed waveform peaks in a `Float32Array` with a target `80 Hz` bucket resolution and a `500000` bucket upper bound. Waveform sampling linearly interpolates adjacent buckets to avoid blocky deep-zoom output. This is still a cached waveform projection and fallback to precomputed `AudioFrame.e`; no runtime audio analysis or analyzer DSP behavior changes.

## Consequences

Positive:

- Presets remain backward-compatible when new tuning fields are added.
- The tuning panel can grow by adding defaults and control metadata instead of duplicating slider markup.
- Presets are simple static assets and work in the existing Vite deployment model.
- Renderers receive sensitivity-adjusted values without adding analyzer coupling.
- Live parameter changes and preset changes are smooth enough for performance use.
- Effects become easier to evolve because animation inputs are decoupled from analyzer implementation details.
- The renderer loop is decoupled from the macro-dramaturgy state machine; it delegates state decisions to `VisualDirectorFSM` and consumes `DirectorOutput`.
- Music-dramaturgy logic is separately testable through deterministic `VisualDirectorFSM` unit tests.
- `GLITCH_LOW_DROP` animations use a deterministic, exponentially decaying `glitchIntensity`, which keeps video export behavior reproducible for the same playback state.
- State changes use a 150ms `MIN_STATE_DURATION` cooldown and hysteresis margin to reduce dense state jitter.
- UI chrome can be refined independently from p5 visual effects.
- File input reload behavior is isolated to `PlaybackController`, so same-file reload does not add playback lifecycle coupling to UI code.
- Loop mode stays aligned with audio source-node lifecycle.
- Timeline inspection scales from compact to resized to fullscreen without changing playback ownership.
- DOM-based hover details remain readable and avoid text-heavy canvas redraw work on pointer movement.
- Dragging the seekbar or timeline no longer floods Web Audio with repeated source-node rebuilds.
- Paused or ended playback near the end of long tracks avoids frame-by-frame linear scans over large event/cue arrays.
- Partial and older performance presets can coexist with new tuning fields without destructive resets.
- Performance automation points in `State.editedPerformancePlan` are schedulable from playback position events, including seek and paused inspection paths.
- Playback stop feels visually continuous while Web Audio source-node lifecycle remains strict.
- Timeline waveform redraw cost is bounded by cache invalidation instead of normal frame cadence.
- Deep timeline zoom keeps the waveform and automation curves readable without moving audio analysis into the render path.
- Visual identities can be added without changing `PlexusRenderer` branching logic.
- Invalid or future preset visual mode values no longer crash rendering because style lookup falls back to `classic`.
- New visual styles receive deterministic, browser-free smoke coverage through mock backend tests.

Tradeoffs:

- `index.json` must be updated when adding or removing preset files.
- Preset display names remain file-name based, but performance-plan preset selection is metadata-aware when preset JSON payloads are preloaded. Sparse or legacy metadata still falls back to name hints, so tests must cover both paths.
- RGB background tuning is explicit and simple, but less compact than a color picker.
- Auto-hide behavior is intentionally owned by the UI layer, so new top-level chrome must opt into the same CSS/DOM classes.
- The timeline has coordinated UI interaction state (`scrubTime`, pan/seek/draw flags) plus shared viewport state (`State.zoom`, `State.pan`), so tests must guard both interaction semantics and state handoff to `TimelineCanvas`.
- Dynamic max zoom means tests should assert the shared `max(16, duration / 5.0)` rule rather than a fixed `16x` ceiling.
- In-progress scrub is visual until release; this is intentional for performance, but it means audio preview during drag is not currently supported.
- The fullscreen timeline relies on coordinated classes across the seek container, wrapper, and body; future layout changes must preserve that contract.
- Sticky preset normalization makes the current tuning state part of partial-preset semantics, so tests must cover both current-aware and default-only normalization.
- Draw mode adds more timeline interaction modes, so pointer handling must keep seek, pan, resize, draw, and preset paint paths explicitly separated.
- The waveform cache must be invalidated whenever timeline scale or analysis data changes; stale cache keys would show incorrect waveform placement.
- The waveform peak cache can be larger than the previous short fixed bucket array on long tracks, bounded by `500000` `Float32Array` entries.
- The director adds a separate render-facing state contract beside `AudioFrame.state`, so future changes must keep worker frame compatibility and `DirectorOutput` semantics documented together.
- `StyleRegistry` centralizes built-in style registration, so tests and docs must be updated when a built-in identity is added or removed.

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
- **Using clipped x coordinates for morph curve math:** Rejected because clipping the start/end before curve evaluation distorts partially visible automation zones at viewport edges. Canvas clipping should hide offscreen pixels after the real curve geometry is computed.
- **Fixed `16x` timeline zoom ceiling:** Rejected because long tracks still showed too much time at max zoom. A dynamic ceiling keeps at least about five seconds visible while preserving `16x` as the minimum max zoom.
- **Runtime waveform analysis during timeline zoom:** Rejected because timeline zoom is a UI projection concern. Precomputed `Float32Array` waveform peaks and interpolation provide deep-zoom readability without changing analyzer DSP or adding render-loop audio analysis.

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
- `src/visuals/DarkTechnoIdentity.ts`
- `src/visuals/OrganicAmbientIdentity.ts`
- `src/visuals/CyberpunkIdentity.ts`
- `src/visuals/VisualIdentity.ts`
- `src/visuals/StyleRegistry.ts`
- `src/visuals/PlexusRenderer.ts`
- `src/visuals/VisualDirectorFSM.ts`
- `src/visuals/RendererBackend.ts`
- `src/visuals/P5RendererBackend.ts`
- `public/visual-tuning-presets/`
